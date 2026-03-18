const crypto = require('crypto');
const pool = require('../config/db');
const { computeSubtotalWithPricing } = require('../utils/unitPricing');

const PH_TZ = 'Asia/Manila';

function generateReferenceCode() {
  return 'BKG-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function toDateOnly(val) {
  if (val == null) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.split('T')[0].substring(0, 10);
  }
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${day}`;
}

function rangesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
}

async function getBookings(req, res) {
  try {
    const { listingId } = req.query;
    if (!listingId) {
      return res.status(400).json({ error: 'listingId is required' });
    }

    const [rows] = await pool.query(
      `SELECT b.booking_id, b.checkin_date, b.checkout_date, b.booking_status
       FROM booking b
       WHERE b.unit_id = ? AND b.booking_status IN ('penciled', 'confirmed')
       ORDER BY b.checkin_date`,
      [listingId]
    );

    const bookings = rows.map((r) => ({
      id: String(r.booking_id),
      check_in_date: toDateOnly(r.checkin_date) || r.checkin_date,
      check_out_date: toDateOnly(r.checkout_date) || r.checkout_date,
      status: r.booking_status,
    }));

    // Include blocked dates as "booked" so they appear unavailable
    const [blockRows] = await pool.query(
      `SELECT block_id, start_date, end_date, reason
       FROM unit_block_dates
       WHERE (unit_id = ? OR unit_id IS NULL)
       ORDER BY start_date`,
      [listingId]
    );

    const blockedAsBookings = blockRows.map((r) => ({
      id: `block-${r.block_id}`,
      check_in_date: toDateOnly(r.start_date) || r.start_date,
      check_out_date: toDateOnly(r.end_date) || r.end_date,
      status: 'blocked',
      reason: r.reason,
    }));

    res.json([...bookings, ...blockedAsBookings]);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/bookings
 * Create a booking. Checks for overlapping dates. Returns success or error.
 * guest_user_id can be null; guest info goes in guest_booking_info.
 */
async function createBooking(req, res) {
  const connection = await pool.getConnection();

  try {
    const body = req.body || {};
    const unitId = body.listing_id || body.unit_id;
    const checkIn = toDateOnly(body.check_in_date) || body.check_in_date;
    const checkOut = toDateOnly(body.check_out_date) || body.check_out_date;
    const totalGuests = Math.max(1, parseInt(body.total_guests, 10) || 1);
    const pax = totalGuests;
    const client = body.client || {};

    // For agent bookings, client is always from the form. Never use guest_user_id from body.
    const guestUserId = null;

    if (!unitId || !checkIn || !checkOut) {
      return res.status(400).json({
        error: 'listing_id (or unit_id), check_in_date, and check_out_date are required',
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'check_out_date must be after check_in_date' });
    }

    // Fetch unit and unit_pricing from DB (never trust client for amounts)
    const [unitRows] = await connection.query(
      `SELECT base_price, excess_pax_fee, min_pax, max_capacity FROM unit WHERE unit_id = ?`,
      [unitId]
    );
    if (unitRows.length === 0) {
      return res.status(400).json({ error: 'Unit not found' });
    }
    const unit = unitRows[0];
    const basePricePerNight = parseFloat(unit.base_price) || 0;
    const excessPaxFee = parseFloat(unit.excess_pax_fee) || 0;
    const minPax = parseInt(unit.min_pax, 10) || 1;
    const maxCapacity = parseInt(unit.max_capacity, 10) || minPax;

    // Fetch unit_pricing (stay_length_discount + holiday_pricing)
    const [pricingRows] = await connection.query(
      `SELECT pricing_type, rule_data FROM unit_pricing WHERE unit_id = ? ORDER BY sort_order ASC`,
      [unitId]
    );
    const discountRules = [];
    const holidayPricingRules = [];
    for (const pr of pricingRows) {
      try {
        const data = typeof pr.rule_data === 'string' ? JSON.parse(pr.rule_data) : pr.rule_data;
        const rule = { ...data };
        if (pr.pricing_type === 'stay_length_discount') discountRules.push(rule);
        else if (pr.pricing_type === 'holiday_pricing') holidayPricingRules.push(rule);
      } catch (_) { /* skip invalid JSON */ }
    }

    // Calculate total: accommodation (with holiday + stay-length discount) + excess pax fees
    const { subtotal: accommodationSubtotal, nights } = computeSubtotalWithPricing(
      basePricePerNight,
      checkIn,
      checkOut,
      discountRules,
      holidayPricingRules
    );
    const guestsOverMax = Math.max(0, pax - maxCapacity);
    const excessOverCapacityFees = guestsOverMax * excessPaxFee * Math.max(1, nights);
    const totalAmount = Math.round(accommodationSubtotal + excessOverCapacityFees);

    // Check for overlapping bookings
    const [existing] = await connection.query(
      `SELECT checkin_date, checkout_date FROM booking
       WHERE unit_id = ? AND booking_status IN ('penciled', 'confirmed')`,
      [unitId]
    );

    for (const row of existing) {
      const existingStart = toDateOnly(row.checkin_date);
      const existingEnd = toDateOnly(row.checkout_date);
      if (!existingStart || !existingEnd) continue;
      if (rangesOverlap(checkIn, checkOut, existingStart, existingEnd)) {
        return res.status(409).json({
          error: 'Dates overlap with an existing booking. Please choose different dates.',
          overlapping: true,
        });
      }
    }

    // Check for overlapping blocked dates (unit-specific or global)
    const [blockRows] = await connection.query(
      `SELECT start_date, end_date, reason FROM unit_block_dates
       WHERE (unit_id = ? OR unit_id IS NULL)`,
      [unitId]
    );

    for (const row of blockRows) {
      const blockStart = toDateOnly(row.start_date);
      const blockEnd = toDateOnly(row.end_date);
      if (!blockStart || !blockEnd) continue;
      if (rangesOverlap(checkIn, checkOut, blockStart, blockEnd)) {
        return res.status(409).json({
          error: 'Dates overlap with a blocked period. Please choose different dates.',
          overlapping: true,
          blocked: true,
        });
      }
    }

    let guestBookingInfoId = null;

    // Always insert guest_booking_info when we have client data from the form
    if (client.first_name || client.last_name || client.email) {
      const [guestResult] = await connection.query(
        `INSERT INTO guest_booking_info
         (first_name, last_name, email, middle_name, nickname, contact_number, gender, birth_date, preferred_contact, referred_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          (client.first_name || client.firstName || '').trim() || 'N/A',
          (client.last_name || client.lastName || '').trim() || 'N/A',
          (client.email || '').trim() || 'N/A',
          (client.middle_name || client.middleName || '').trim() || null,
          (client.nickname || '').trim() || null,
          (client.contact_number || client.contactNumber || '').trim() || null,
          (client.gender || '').trim() || null,
          (client.birth_date || client.birthDate || '').trim() || null,
          (client.preferred_contact || client.preferredContact || '').trim() || null,
          (client.referred_by || client.referredBy || '').trim() || null,
        ]
      );
      guestBookingInfoId = guestResult.insertId;
    }

    // agent_user_id comes from JWT (req.user) - only Admin/Agent can create bookings
    const agentUserId = req.user ? req.user.userId : null;

    const referenceCode = generateReferenceCode();
    const [bookingResult] = await connection.query(
      `INSERT INTO booking
       (reference_code, guest_user_id, guest_booking_info_id, unit_id, agent_user_id, checkin_date, checkout_date, pax, booking_status, penciled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'penciled', NOW())`,
      [
        referenceCode,
        guestUserId,
        guestBookingInfoId,
        unitId,
        agentUserId,
        checkIn,
        checkOut,
        pax,
      ]
    );
    const bookingId = bookingResult.insertId;

    // Insert payment record for the booking (cash, bank_transfer, etc.)
    // totalAmount is calculated server-side above, never from client
    const paymentMethod = mapPaymentMethod(body.payment_method || 'other');
    const requirePayment = body.require_payment !== false;
    const depositAmount = requirePayment ? Math.max(0, totalAmount) : 0;
    await connection.query(
      `INSERT INTO payment (booking_id, deposit_amount, method, payment_status)
       VALUES (?, ?, ?, 'pending')`,
      [bookingId, depositAmount, paymentMethod]
    );

    res.status(201).json({
      id: String(bookingId),
      booking_id: bookingId,
      reference_code: referenceCode,
      check_in_date: checkIn,
      check_out_date: checkOut,
      total_guests: pax,
      status: 'penciled',
      guest_user_id: guestUserId,
      guest_booking_info_id: guestBookingInfoId,
      total_amount: totalAmount,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    connection.release();
  }
}

/**
 * GET /api/bookings/:idOrRef
 * Get a single booking by ID. Authenticated: agent or Admin can view. Unauthenticated: anyone can view (for guest confirmation links).
 * Accepts numeric id or reference_code (e.g. BKG-A7X9K2M1B4C5).
 */
async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes('Admin');

    const isRef = typeof id === 'string' && /^BKG-[A-Z0-9]+$/i.test(id);
    const whereClause = isRef ? 'b.reference_code = ?' : 'b.booking_id = ?';
    const whereVal = isRef ? id : parseInt(id, 10);

    if (!isRef && !Number.isFinite(whereVal)) {
      return res.status(400).json({ error: 'Invalid booking ID or reference' });
    }

    const [rows] = await pool.query(
      `SELECT b.booking_id, b.reference_code, b.guest_user_id, b.guest_booking_info_id, b.unit_id, b.agent_user_id,
              b.checkin_date, b.checkout_date, b.pax, b.booking_status, b.created_at,
              u.unit_name, u.location, u.base_price, u.excess_pax_fee, u.min_pax, u.max_capacity, u.check_in_time, u.check_out_time,
              u.latitude, u.longitude, u.unit_type,
              (SELECT image_url FROM unit_image WHERE unit_id = u.unit_id ORDER BY is_main DESC, sort_order ASC LIMIT 1) AS main_image_url,
              g.first_name AS guest_first_name, g.last_name AS guest_last_name, g.email AS guest_email, g.contact_number AS guest_contact,
              gu.first_name AS app_guest_first_name, gu.last_name AS app_guest_last_name, gu.email AS app_guest_email, gu.phone AS app_guest_phone,
              a.user_id AS agent_id, a.first_name AS agent_first_name, a.middle_name AS agent_middle_name, a.last_name AS agent_last_name, a.email AS agent_email,
              p.payment_id, p.method AS payment_method, p.payment_status, p.deposit_amount
       FROM booking b
       JOIN unit u ON u.unit_id = b.unit_id
       LEFT JOIN guest_booking_info g ON g.guest_booking_info_id = b.guest_booking_info_id
       LEFT JOIN user gu ON gu.user_id = b.guest_user_id
       LEFT JOIN user a ON a.user_id = b.agent_user_id
       LEFT JOIN payment p ON p.booking_id = b.booking_id
       WHERE ${whereClause}`,
      [whereVal]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const row = rows[0];

    // When authenticated: only assigned agent or Admin can view. When unauthenticated: allow (guest confirmation link).
    const agentUserId = row.agent_user_id ? Number(row.agent_user_id) : null;
    if (userId && !isAdmin && agentUserId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this booking' });
    }

    const checkIn = toDateOnly(row.checkin_date) || row.checkin_date;
    const checkOut = toDateOnly(row.checkout_date) || row.checkout_date;
    const nights = checkIn && checkOut
      ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000)))
      : 0;

    const basePricePerNight = Number(row.base_price) || 0;
    const excessPaxFee = Number(row.excess_pax_fee) || 0;
    const maxCapacity = parseInt(row.max_capacity, 10) || parseInt(row.min_pax, 10) || 1;
    const pax = parseInt(row.pax, 10) || 1;
    const guestsOverMax = Math.max(0, pax - maxCapacity);
    const excessOverCapacityFees = guestsOverMax * excessPaxFee * Math.max(1, nights);

    // Fetch unit_pricing and compute accommodation breakdown (holiday + stay-length discount)
    const [pricingRows] = await pool.query(
      `SELECT pricing_type, rule_data FROM unit_pricing WHERE unit_id = ? ORDER BY sort_order ASC`,
      [row.unit_id]
    );
    const discountRules = [];
    const holidayPricingRules = [];
    for (const pr of pricingRows) {
      try {
        const data = typeof pr.rule_data === 'string' ? JSON.parse(pr.rule_data) : pr.rule_data;
        const rule = { ...data };
        if (pr.pricing_type === 'stay_length_discount') discountRules.push(rule);
        else if (pr.pricing_type === 'holiday_pricing') holidayPricingRules.push(rule);
      } catch (_) { /* skip invalid JSON */ }
    }

    const { subtotal: accommodationSubtotal, stayLengthDiscountAmount, subtotalBeforeDiscount } = computeSubtotalWithPricing(
      basePricePerNight,
      checkIn,
      checkOut,
      discountRules,
      holidayPricingRules
    );

    const totalAmount = row.deposit_amount != null && row.payment_id
      ? Number(row.deposit_amount)
      : Math.round(accommodationSubtotal + excessOverCapacityFees);

    const agentFullname = row.agent_first_name || row.agent_last_name
      ? [row.agent_first_name, row.agent_middle_name, row.agent_last_name].filter(Boolean).join(' ')
      : '';

    // Client from guest_booking_info or user (guest_user_id)
    const clientFirst = row.guest_first_name || row.app_guest_first_name || '';
    const clientLast = row.guest_last_name || row.app_guest_last_name || '';
    const clientEmail = row.guest_email || row.app_guest_email || '';
    const clientContact = row.guest_contact || row.app_guest_phone || '';

    const referenceCode = row.reference_code || `BKG-${String(row.booking_id).padStart(6, '0')}`;

    const booking = {
      id: String(row.booking_id),
      reference_code: referenceCode,
      listing_id: String(row.unit_id),
      check_in_date: checkIn,
      check_out_date: checkOut,
      nights,
      total_guests: pax,
      excess_pax_charge: excessOverCapacityFees,
      unit_charge: basePricePerNight,
      subtotal_before_discount: Math.round(subtotalBeforeDiscount),
      discount: Math.round(stayLengthDiscountAmount),
      amenities_charge: 0,
      service_charge: 0,
      total_amount: totalAmount,
      currency: 'PHP',
      status: mapBookingStatus(row.booking_status),
      landmark: '',
      parking_info: '',
      notes: '',
      listing: {
        id: String(row.unit_id),
        title: row.unit_name || '',
        location: row.location || '',
        main_image_url: row.main_image_url || '/heroimage.png',
        property_type: row.unit_type || 'unit',
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        latitude: row.latitude ? Number(row.latitude) : 0,
        longitude: row.longitude ? Number(row.longitude) : 0,
      },
      agent: {
        id: row.agent_id ? String(row.agent_id) : '',
        fullname: agentFullname,
        email: row.agent_email || '',
        profile_photo: undefined,
      },
      client: {
        first_name: clientFirst || 'N/A',
        last_name: clientLast || 'N/A',
        email: clientEmail || 'N/A',
        contact_number: clientContact || 'N/A',
      },
      payment: row.payment_id ? {
        payment_method: row.payment_method || 'other',
        reference_number: row.payment_id ? `TXN-${row.payment_id}` : '',
        payment_status: row.payment_status || 'pending',
        deposit_amount: row.deposit_amount ? Number(row.deposit_amount) : 0,
      } : null,
    };

    res.json(booking);
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/bookings/my
 * Agent: bookings where agent_user_id = current user.
 * Admin: all bookings across all agents.
 * Supports ?status= filter (penciled|confirmed|cancelled|completed).
 */
async function getMyBookings(req, res) {
  try {
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = roles.includes('Admin');

    const ALLOWED_STATUSES = ['penciled', 'confirmed', 'cancelled', 'completed'];
    const statusFilter = req.query.status && ALLOWED_STATUSES.includes(req.query.status)
      ? req.query.status
      : null;

    let sql = `
      SELECT b.booking_id, b.unit_id, b.reference_code, b.checkin_date, b.checkout_date, b.pax, b.booking_status,
             u.unit_name, u.location, u.base_price,
             (SELECT image_url FROM unit_image WHERE unit_id = u.unit_id ORDER BY is_main DESC, sort_order ASC LIMIT 1) AS main_image_url,
             g.first_name AS guest_first_name, g.last_name AS guest_last_name,
             a.first_name AS agent_first_name, a.last_name AS agent_last_name,
             p.payment_id, p.payment_status, p.deposit_amount
      FROM booking b
      JOIN unit u ON u.unit_id = b.unit_id
      LEFT JOIN guest_booking_info g ON g.guest_booking_info_id = b.guest_booking_info_id
      LEFT JOIN \`user\` a ON a.user_id = b.agent_user_id
      LEFT JOIN payment p ON p.booking_id = b.booking_id
      WHERE 1=1
    `;
    const params = [];

    if (!isAdmin) {
      sql += ' AND b.agent_user_id = ?';
      params.push(userId);
    }

    if (statusFilter) {
      sql += ' AND b.booking_status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY b.created_at DESC';

    const [rows] = await pool.query(sql, params);

    const bookings = rows.map((r) => {
      const checkIn = r.checkin_date;
      const checkOut = r.checkout_date;
      const nights = checkIn && checkOut
        ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000)))
        : 0;
      const basePrice = Number(r.base_price) || 0;
      const totalAmount = r.deposit_amount ? Number(r.deposit_amount) : Math.round(basePrice * Math.max(1, nights));

      return {
        id: String(r.booking_id),
        unit_id: String(r.unit_id),
        reference_code: r.reference_code || `BKG-${String(r.booking_id).padStart(6, '0')}`,
        check_in_date: toDateOnly(checkIn) || checkIn,
        check_out_date: toDateOnly(checkOut) || checkOut,
        status: mapBookingStatus(r.booking_status),
        raw_status: r.booking_status,
        total_amount: totalAmount,
        transaction_number: r.payment_id ? `TXN-${r.payment_id}` : '',
        listing: {
          title: r.unit_name || '',
          location: r.location || '',
          main_image_url: r.main_image_url || '/heroimage.png',
        },
        agent: isAdmin ? {
          first_name: r.agent_first_name || '',
          last_name: r.agent_last_name || '',
        } : undefined,
        client: {
          first_name: r.guest_first_name || '',
          last_name: r.guest_last_name || '',
        },
        payment: r.payment_id ? {
          reference_number: `TXN-${r.payment_id}`,
          status: r.payment_status || 'pending',
        } : null,
      };
    });

    res.json(bookings);
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/bookings/all
 * Admin only. All bookings with pagination and filters.
 * Query params:
 *   page      - page number (default 1)
 *   limit     - per page (default 20, max 100)
 *   status    - penciled | confirmed | cancelled | completed
 *   unit_id   - filter by unit
 *   agent_id  - filter by agent user
 *   search    - reference_code, client first/last name, agent first/last name, OR unit name
 */
async function getAllBookings(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const ALLOWED_STATUSES = ['penciled', 'confirmed', 'cancelled', 'completed'];
    const statusFilter = req.query.status && ALLOWED_STATUSES.includes(req.query.status)
      ? req.query.status
      : null;
    const unitId = req.query.unit_id ? parseInt(req.query.unit_id, 10) : null;
    const agentId = req.query.agent_id ? parseInt(req.query.agent_id, 10) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const conditions = ['1=1'];
    const params = [];

    if (statusFilter) {
      conditions.push('b.booking_status = ?');
      params.push(statusFilter);
    }
    if (unitId && Number.isFinite(unitId)) {
      conditions.push('b.unit_id = ?');
      params.push(unitId);
    }
    if (agentId && Number.isFinite(agentId)) {
      conditions.push('b.agent_user_id = ?');
      params.push(agentId);
    }
    if (search) {
      conditions.push(
        '(b.reference_code LIKE ? OR g.first_name LIKE ? OR g.last_name LIKE ? OR a.first_name LIKE ? OR a.last_name LIKE ? OR u.unit_name LIKE ?)'
      );
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    const where = conditions.join(' AND ');

    // Count total for pagination
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM booking b
       JOIN unit u ON u.unit_id = b.unit_id
       LEFT JOIN guest_booking_info g ON g.guest_booking_info_id = b.guest_booking_info_id
       LEFT JOIN \`user\` a ON a.user_id = b.agent_user_id
       WHERE ${where}`,
      params
    );
    const total = Number(countRows[0].total) || 0;
    const totalPages = Math.ceil(total / limit);

    const orderClause = statusFilter === 'penciled'
      ? 'ORDER BY COALESCE(b.penciled_at, b.created_at) ASC'
      : 'ORDER BY b.created_at DESC';

    const [rows] = await pool.query(
      `SELECT b.booking_id, b.reference_code, b.checkin_date, b.checkout_date, b.pax, b.booking_status, b.created_at, b.penciled_at,
              u.unit_id, u.unit_name, u.location, u.base_price, u.excess_pax_fee, u.min_pax, u.max_capacity,
              (SELECT image_url FROM unit_image WHERE unit_id = u.unit_id ORDER BY is_main DESC, sort_order ASC LIMIT 1) AS main_image_url,
              g.first_name AS guest_first_name, g.last_name AS guest_last_name,
              g.email AS guest_email, g.contact_number AS guest_contact,
              b.agent_user_id,
              a.first_name AS agent_first_name, a.last_name AS agent_last_name, a.email AS agent_email,
              p.payment_id, p.payment_status, p.deposit_amount, p.method AS payment_method
       FROM booking b
       JOIN unit u ON u.unit_id = b.unit_id
       LEFT JOIN guest_booking_info g ON g.guest_booking_info_id = b.guest_booking_info_id
       LEFT JOIN \`user\` a ON a.user_id = b.agent_user_id
       LEFT JOIN payment p ON p.booking_id = b.booking_id
       WHERE ${where}
       ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const data = rows.map((r) => {
      const checkIn = toDateOnly(r.checkin_date) || r.checkin_date;
      const checkOut = toDateOnly(r.checkout_date) || r.checkout_date;
      const nights = checkIn && checkOut
        ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000)))
        : 0;
      const basePricePerNight = Number(r.base_price) || 0;
      const excessPaxFee = Number(r.excess_pax_fee) || 0;
      const maxCapacity = parseInt(r.max_capacity, 10) || parseInt(r.min_pax, 10) || 1;
      const pax = parseInt(r.pax, 10) || 1;
      const guestsOverMax = Math.max(0, pax - maxCapacity);
      const baseTotal = basePricePerNight * Math.max(1, nights);
      const excessFees = guestsOverMax * excessPaxFee * Math.max(1, nights);
      const totalAmount = r.deposit_amount
        ? Number(r.deposit_amount)
        : baseTotal + excessFees;

      return {
        id: String(r.booking_id),
        reference_code: r.reference_code || `BKG-${String(r.booking_id).padStart(6, '0')}`,
        check_in_date: checkIn,
        check_out_date: checkOut,
        nights,
        total_guests: pax,
        status: mapBookingStatus(r.booking_status),
        raw_status: r.booking_status,
        total_amount: totalAmount,
        created_at: r.created_at,
        penciled_at: r.penciled_at,
        listing: {
          id: String(r.unit_id),
          title: r.unit_name || '',
          location: r.location || '',
          main_image_url: r.main_image_url || '/heroimage.png',
        },
        agent: {
          id: r.agent_user_id ? String(r.agent_user_id) : null,
          first_name: r.agent_first_name || '',
          last_name: r.agent_last_name || '',
          email: r.agent_email || '',
        },
        client: {
          first_name: r.guest_first_name || '',
          last_name: r.guest_last_name || '',
          email: r.guest_email || '',
          contact_number: r.guest_contact || '',
        },
        payment: r.payment_id ? {
          payment_method: r.payment_method || 'other',
          reference_number: `TXN-${r.payment_id}`,
          status: r.payment_status || 'pending',
          deposit_amount: Number(r.deposit_amount) || 0,
        } : null,
      };
    });

    res.json({
      data,
      pagination: { page, limit, total, total_pages: totalPages },
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function mapBookingStatus(dbStatus) {
  const map = {
    penciled: 'pending',
    confirmed: 'booked',
    cancelled: 'cancelled',
    completed: 'completed',
  };
  return map[dbStatus] || dbStatus || 'pending';
}

function mapPaymentMethod(method) {
  const map = {
    credit_card: 'card',
    bank_transfer: 'bank_transfer',
    cash: 'cash',
    company_account: 'other',
    gcash: 'gcash',
  };
  return map[method] || 'other';
}

/**
 * PATCH /api/bookings/:id/confirm
 * Admin only. Confirms a penciled booking: sets status to 'confirmed', confirmed_at = NOW(), confirmed_by_user_id = current user.
 */
async function confirmBooking(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const bookingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query(
      `SELECT booking_id, booking_status FROM booking WHERE booking_id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (rows[0].booking_status !== 'penciled') {
      return res.status(400).json({ error: 'Only penciled bookings can be confirmed' });
    }

    await pool.query(
      `UPDATE booking
       SET booking_status = 'confirmed', confirmed_at = NOW(), confirmed_by_user_id = ?
       WHERE booking_id = ?`,
      [userId, bookingId]
    );

    await pool.query(
      `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by_user_id)
       VALUES (?, 'penciled', 'confirmed', ?)`,
      [bookingId, userId]
    );

    // Update payment status to verified when confirming
    const [paymentRows] = await pool.query(
      `SELECT payment_id, payment_status FROM payment WHERE booking_id = ?`,
      [bookingId]
    );
    if (paymentRows.length > 0) {
      const paymentId = paymentRows[0].payment_id;
      const fromStatus = paymentRows[0].payment_status || 'pending';
      await pool.query(
        `UPDATE payment SET payment_status = 'verified', verified_at = NOW(), verified_by_user_id = ? WHERE booking_id = ?`,
        [userId, bookingId]
      );
      await pool.query(
        `INSERT INTO payment_status_history (payment_id, from_status, to_status, changed_by_user_id)
         VALUES (?, ?, 'verified', ?)`,
        [paymentId, fromStatus, userId]
      );
    }

    res.json({
      id: String(bookingId),
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by_user_id: userId,
    });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/bookings/:id/decline
 * Admin only. Declines a penciled booking: sets status to 'cancelled'.
 */
async function declineBooking(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const bookingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query(
      `SELECT booking_id, booking_status FROM booking WHERE booking_id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (rows[0].booking_status !== 'penciled') {
      return res.status(400).json({ error: 'Only penciled bookings can be declined' });
    }

    const fromStatus = rows[0].booking_status;

    await pool.query(
      `UPDATE booking SET booking_status = 'cancelled' WHERE booking_id = ?`,
      [bookingId]
    );

    await pool.query(
      `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by_user_id)
       VALUES (?, ?, 'cancelled', ?)`,
      [bookingId, fromStatus, userId]
    );

    res.json({
      id: String(bookingId),
      status: 'cancelled',
    });
  } catch (error) {
    console.error('Decline booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getBookings, getMyBookings, getAllBookings, getBookingById, createBooking, confirmBooking, declineBooking };
