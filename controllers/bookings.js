const pool = require('../config/db');

const PH_TZ = 'Asia/Manila';

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

    res.json(bookings);
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
    const numGuests = Math.max(1, parseInt(body.num_guests, 10) || 1);
    const extraGuests = Math.max(0, parseInt(body.extra_guests, 10) || 0);
    const pax = numGuests + extraGuests;
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

    // Fetch unit pricing from DB (never trust client for amounts)
    const [unitRows] = await connection.query(
      `SELECT base_price, excess_pax_fee, min_pax FROM unit WHERE unit_id = ?`,
      [unitId]
    );
    if (unitRows.length === 0) {
      return res.status(400).json({ error: 'Unit not found' });
    }
    const unit = unitRows[0];
    const basePricePerNight = parseFloat(unit.base_price) || 0;
    const excessPaxFee = parseFloat(unit.excess_pax_fee) || 0;
    const minPax = parseInt(unit.min_pax, 10) || 1;

    // Calculate nights and total server-side
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.max(0, Math.round((checkOutDate - checkInDate) / (24 * 60 * 60 * 1000)));
    const guestsAboveMinPax = Math.max(0, pax - minPax);
    const baseTotal = basePricePerNight * Math.max(1, nights);
    const extraGuestFees = guestsAboveMinPax * excessPaxFee * Math.max(1, nights);
    const SERVICE_CHARGE = 100;
    const totalAmount = baseTotal + extraGuestFees + SERVICE_CHARGE;

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

    await connection.query(
      `INSERT INTO booking
       (guest_user_id, guest_booking_info_id, unit_id, agent_user_id, checkin_date, checkout_date, pax, booking_status, penciled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'penciled', NOW())`,
      [
        guestUserId,
        guestBookingInfoId,
        unitId,
        agentUserId,
        checkIn,
        checkOut,
        pax,
      ]
    );

    const [insertResult] = await connection.query(
      `SELECT LAST_INSERT_ID() AS id`
    );
    const bookingId = insertResult[0].id;

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
      check_in_date: checkIn,
      check_out_date: checkOut,
      num_guests: pax,
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
 * GET /api/bookings/:id
 * Get a single booking by ID. Only the assigned agent (or Admin) can view.
 */
async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = roles.includes('Admin');
    const bookingId = parseInt(id, 10);
    if (!Number.isFinite(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const [rows] = await pool.query(
      `SELECT b.booking_id, b.guest_user_id, b.guest_booking_info_id, b.unit_id, b.agent_user_id,
              b.checkin_date, b.checkout_date, b.pax, b.booking_status, b.created_at,
              u.unit_name, u.location, u.base_price, u.excess_pax_fee, u.check_in_time, u.check_out_time,
              u.latitude, u.longitude, u.unit_type,
              (SELECT image_url FROM unit_image WHERE unit_id = u.unit_id ORDER BY is_main DESC, sort_order ASC LIMIT 1) AS main_image_url,
              g.first_name AS guest_first_name, g.last_name AS guest_last_name, g.email AS guest_email, g.contact_number AS guest_contact,
              gu.first_name AS app_guest_first_name, gu.last_name AS app_guest_last_name, gu.email AS app_guest_email, gu.phone AS app_guest_phone,
              a.user_id AS agent_id, a.first_name AS agent_first_name, a.middle_name AS agent_middle_name, a.last_name AS agent_last_name, a.email AS agent_email,
              p.payment_id, p.method AS payment_method, p.payment_status, p.deposit_amount
       FROM booking b
       JOIN unit u ON u.unit_id = b.unit_id
       LEFT JOIN guest_booking_info g ON g.guest_booking_info_id = b.guest_booking_info_id
       LEFT JOIN app_user gu ON gu.user_id = b.guest_user_id
       LEFT JOIN app_user a ON a.user_id = b.agent_user_id
       LEFT JOIN payment p ON p.booking_id = b.booking_id
       WHERE b.booking_id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const row = rows[0];

    // Only the assigned agent or Admin can view
    const agentUserId = row.agent_user_id ? Number(row.agent_user_id) : null;
    if (!isAdmin && agentUserId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this booking' });
    }

    const checkIn = row.checkin_date;
    const checkOut = row.checkout_date;
    const nights = checkIn && checkOut
      ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000)))
      : 0;

    const unitCharge = Number(row.base_price) || 0;
    const totalAmount = unitCharge * Math.max(1, nights);

    const agentFullname = row.agent_first_name || row.agent_last_name
      ? [row.agent_first_name, row.agent_middle_name, row.agent_last_name].filter(Boolean).join(' ')
      : '';

    // Client from guest_booking_info or app_user (guest_user_id)
    const clientFirst = row.guest_first_name || row.app_guest_first_name || '';
    const clientLast = row.guest_last_name || row.app_guest_last_name || '';
    const clientEmail = row.guest_email || row.app_guest_email || '';
    const clientContact = row.guest_contact || row.app_guest_phone || '';

    const booking = {
      id: String(row.booking_id),
      listing_id: String(row.unit_id),
      check_in_date: checkIn,
      check_out_date: checkOut,
      nights,
      num_guests: row.pax || 1,
      extra_guests: 0,
      unit_charge: unitCharge,
      amenities_charge: 0,
      service_charge: 0,
      discount: 0,
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

module.exports = { getBookings, getBookingById, createBooking };
