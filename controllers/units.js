const pool = require('../config/db');

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function listUnits(req, res) {
  try {
    const { featured, city, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT u.unit_id, u.unit_name, u.location, u.city, u.country,
             u.bedroom_count, u.bathroom_count, u.area_sqm, u.unit_type,
             u.description, u.amenities, u.min_pax, u.max_capacity,
             u.base_price, u.excess_pax_fee, u.status, u.is_featured,
             u.check_in_time, u.check_out_time, u.latitude, u.longitude,
             u.created_at, u.updated_at,
             (SELECT image_url FROM unit_image WHERE unit_id = u.unit_id ORDER BY is_main DESC, sort_order ASC LIMIT 1) AS main_image_url
      FROM unit u
      WHERE u.status = 'available'
    `;
    const params = [];

    if (featured === 'true') {
      sql += ' AND u.is_featured = 1';
    }
    if (city) {
      sql += ' AND u.city = ?';
      params.push(city);
    }

    sql += ' ORDER BY u.is_featured DESC, u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

    const [rows] = await pool.query(sql, params);

    const units = rows.map((r) => ({
      id: String(r.unit_id),
      title: r.unit_name,
      description: r.description,
      price: Number(r.base_price),
      price_unit: 'night',
      currency: '₱',
      location: r.location || '',
      city: r.city,
      country: r.country,
      bedrooms: r.bedroom_count,
      bathrooms: r.bathroom_count,
      square_feet: r.area_sqm ? Math.round(r.area_sqm * 10.764) : null,
      area_sqm: r.area_sqm ? Number(r.area_sqm) : null,
      property_type: r.unit_type,
      main_image_url: r.main_image_url || null,
      image_urls: [],
      amenities: parseJsonArray(r.amenities) || [],
      is_available: r.status === 'available',
      is_featured: Boolean(r.is_featured),
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    res.json(units);
  } catch (error) {
    console.error('List units error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUnitById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT u.unit_id, u.unit_name, u.location, u.city, u.country,
              u.bedroom_count, u.bathroom_count, u.area_sqm, u.unit_type,
              u.description, u.amenities, u.min_pax, u.max_capacity,
              u.base_price, u.excess_pax_fee, u.status, u.is_featured,
              u.check_in_time, u.check_out_time, u.latitude, u.longitude,
              u.created_at, u.updated_at
       FROM unit u
       WHERE u.unit_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const [imgRows] = await pool.query(
      `SELECT image_url, is_main, sort_order FROM unit_image
       WHERE unit_id = ? ORDER BY is_main DESC, sort_order ASC`,
      [id]
    );

    const r = rows[0];
    const images = imgRows.map((i) => i.image_url);
    const mainImg = imgRows.find((i) => i.is_main)?.image_url || imgRows[0]?.image_url;

    const unit = {
      id: String(r.unit_id),
      title: r.unit_name,
      description: r.description,
      price: Number(r.base_price),
      price_unit: 'night',
      currency: '₱',
      location: r.location || '',
      city: r.city,
      country: r.country,
      bedrooms: r.bedroom_count,
      bathrooms: r.bathroom_count,
      square_feet: r.area_sqm ? Math.round(r.area_sqm * 10.764) : null,
      area_sqm: r.area_sqm ? Number(r.area_sqm) : null,
      property_type: r.unit_type,
      main_image_url: mainImg || null,
      image_urls: images,
      amenities: parseJsonArray(r.amenities) || [],
      is_available: r.status === 'available',
      is_featured: Boolean(r.is_featured),
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };

    res.json(unit);
  } catch (error) {
    console.error('Get unit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/units/manage
 * List units for manage-units page. Requires auth.
 * Admin: all units. Agent: only units where owner_user_id = userId.
 */
async function listUnitsForManage(req, res) {
  try {
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = roles.includes('Admin');
    const isAgent = roles.includes('Agent');

    if (!isAdmin && !isAgent) {
      return res.status(403).json({ error: 'Admin or Agent role required' });
    }

    let sql = `
      SELECT u.unit_id, u.unit_name, u.location, u.city, u.country,
             u.bedroom_count, u.bathroom_count, u.area_sqm, u.unit_type,
             u.description, u.amenities, u.min_pax, u.max_capacity,
             u.base_price, u.excess_pax_fee, u.status, u.is_featured,
             u.check_in_time, u.check_out_time, u.latitude, u.longitude,
             u.owner_user_id, u.created_at, u.updated_at,
             (SELECT image_url FROM unit_image WHERE unit_id = u.unit_id ORDER BY is_main DESC, sort_order ASC LIMIT 1) AS main_image_url,
             o.first_name AS owner_first_name, o.last_name AS owner_last_name, o.email AS owner_email,
             (SELECT COUNT(*) FROM booking b WHERE b.unit_id = u.unit_id AND b.booking_status IN ('penciled', 'confirmed')) AS bookings_count
      FROM unit u
      LEFT JOIN user o ON o.user_id = u.owner_user_id
      WHERE 1=1
    `;
    const params = [];

    if (!isAdmin && isAgent) {
      sql += ' AND u.owner_user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY u.updated_at DESC';

    const [rows] = await pool.query(sql, params);

    const units = rows.map((r) => ({
      id: String(r.unit_id),
      title: r.unit_name,
      description: r.description,
      price: Number(r.base_price),
      price_unit: 'night',
      currency: '₱',
      location: r.location || '',
      city: r.city,
      country: r.country,
      bedrooms: r.bedroom_count,
      bathrooms: r.bathroom_count,
      square_feet: r.area_sqm ? Math.round(r.area_sqm * 10.764) : null,
      area_sqm: r.area_sqm ? Number(r.area_sqm) : null,
      property_type: r.unit_type,
      main_image_url: r.main_image_url || null,
      image_urls: [],
      amenities: parseJsonArray(r.amenities) || [],
      is_available: r.status === 'available',
      is_featured: Boolean(r.is_featured),
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      created_at: r.created_at,
      updated_at: r.updated_at,
      bookings_count: Number(r.bookings_count) || 0,
      owner: r.owner_user_id
        ? {
            id: String(r.owner_user_id),
            fullname: [r.owner_first_name, r.owner_last_name].filter(Boolean).join(' ') || 'N/A',
            email: r.owner_email || '',
          }
        : null,
    }));

    res.json(units);
  } catch (error) {
    console.error('List units for manage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/units/:id
 * Update unit status (available/unavailable) or is_featured. Requires auth.
 * Admin: can update any. Agent: only units they own.
 */
async function updateUnit(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = roles.includes('Admin');
    const isAgent = roles.includes('Agent');

    if (!isAdmin && !isAgent) {
      return res.status(403).json({ error: 'Admin or Agent role required' });
    }

    const unitId = parseInt(id, 10);
    if (!Number.isFinite(unitId)) {
      return res.status(400).json({ error: 'Invalid unit ID' });
    }

    const [existing] = await pool.query(
      'SELECT unit_id, owner_user_id, status, is_featured FROM unit WHERE unit_id = ?',
      [unitId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const unit = existing[0];
    if (!isAdmin && unit.owner_user_id !== userId) {
      return res.status(403).json({ error: 'You can only update units you own' });
    }

    const updates = [];
    const params = [];

    if (body.status !== undefined) {
      const allowed = ['available', 'unavailable', 'maintenance'];
      if (!allowed.includes(body.status)) {
        return res.status(400).json({ error: 'Invalid status. Use: available, unavailable, maintenance' });
      }
      updates.push('status = ?');
      params.push(body.status);
    }

    if (body.is_featured !== undefined) {
      updates.push('is_featured = ?');
      params.push(body.is_featured ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(unitId);
    await pool.query(
      `UPDATE unit SET ${updates.join(', ')} WHERE unit_id = ?`,
      params
    );

    const [updated] = await pool.query(
      'SELECT unit_id, status, is_featured, updated_at FROM unit WHERE unit_id = ?',
      [unitId]
    );

    res.json({
      id: String(unitId),
      status: updated[0].status,
      is_available: updated[0].status === 'available',
      is_featured: Boolean(updated[0].is_featured),
      updated_at: updated[0].updated_at,
    });
  } catch (error) {
    console.error('Update unit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/units
 * Create a new unit with optional images.
 * Admin: can set any owner_user_id.
 * Agent: owner_user_id is forced to their own userId.
 */
async function createUnit(req, res) {
  try {
    const body = req.body || {};
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];

    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const isAdmin = roles.includes('Admin');
    const isAgent = roles.includes('Agent');
    if (!isAdmin && !isAgent) return res.status(403).json({ error: 'Admin or Agent role required' });

    // --- Required fields ---
    const { unit_name, min_pax, max_capacity, base_price } = body;

    if (!unit_name || typeof unit_name !== 'string' || !unit_name.trim())
      return res.status(400).json({ error: 'unit_name is required' });
    if (unit_name.trim().length > 150)
      return res.status(400).json({ error: 'unit_name must be 150 characters or fewer' });

    const parsedMinPax = parseInt(min_pax, 10);
    if (!Number.isFinite(parsedMinPax) || parsedMinPax < 1)
      return res.status(400).json({ error: 'min_pax must be an integer >= 1' });

    const parsedMaxCap = parseInt(max_capacity, 10);
    if (!Number.isFinite(parsedMaxCap) || parsedMaxCap < parsedMinPax)
      return res.status(400).json({ error: 'max_capacity must be an integer >= min_pax' });

    const parsedBasePrice = parseFloat(base_price);
    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0)
      return res.status(400).json({ error: 'base_price must be a non-negative number' });

    // --- Optional fields ---
    const location = body.location != null ? String(body.location) : null;
    const city = body.city != null ? String(body.city) : null;
    const country = body.country != null ? String(body.country) : null;

    const bedroomCount = body.bedroom_count != null ? parseInt(body.bedroom_count, 10) : 0;
    if (!Number.isFinite(bedroomCount) || bedroomCount < 0)
      return res.status(400).json({ error: 'bedroom_count must be a non-negative integer' });

    const bathroomCount = body.bathroom_count != null ? parseInt(body.bathroom_count, 10) : 0;
    if (!Number.isFinite(bathroomCount) || bathroomCount < 0)
      return res.status(400).json({ error: 'bathroom_count must be a non-negative integer' });

    const areaSqm = body.area_sqm != null ? parseFloat(body.area_sqm) : null;
    if (areaSqm !== null && (!Number.isFinite(areaSqm) || areaSqm < 0))
      return res.status(400).json({ error: 'area_sqm must be a non-negative number' });

    const allowedTypes = ['apartment', 'condo', 'villa', 'house', 'studio', 'townhouse', 'cabin', 'penthouse', 'duplex', 'other'];
    const unitType = body.unit_type != null ? String(body.unit_type).toLowerCase() : 'apartment';
    if (!allowedTypes.includes(unitType))
      return res.status(400).json({ error: `unit_type must be one of: ${allowedTypes.join(', ')}` });

    const description = body.description != null ? String(body.description) : null;

    let amenities = null;
    if (body.amenities != null) {
      if (!Array.isArray(body.amenities))
        return res.status(400).json({ error: 'amenities must be an array of strings' });
      amenities = JSON.stringify(body.amenities.map(String));
    }

    const excessPaxFee = body.excess_pax_fee != null ? parseFloat(body.excess_pax_fee) : 0;
    if (!Number.isFinite(excessPaxFee) || excessPaxFee < 0)
      return res.status(400).json({ error: 'excess_pax_fee must be a non-negative number' });

    const allowedStatuses = ['available', 'unavailable', 'maintenance'];
    const status = body.status != null ? String(body.status) : 'available';
    if (!allowedStatuses.includes(status))
      return res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(', ')}` });

    const isFeatured = body.is_featured ? 1 : 0;
    const checkInTime = body.check_in_time != null ? String(body.check_in_time) : null;
    const checkOutTime = body.check_out_time != null ? String(body.check_out_time) : null;

    const latitude = body.latitude != null ? parseFloat(body.latitude) : null;
    if (latitude !== null && !Number.isFinite(latitude))
      return res.status(400).json({ error: 'latitude must be a valid number' });

    const longitude = body.longitude != null ? parseFloat(body.longitude) : null;
    if (longitude !== null && !Number.isFinite(longitude))
      return res.status(400).json({ error: 'longitude must be a valid number' });

    // Owner: Admin can set any; Agent is forced to their own userId
    let ownerUserId = null;
    if (isAdmin && body.owner_user_id != null) {
      ownerUserId = parseInt(body.owner_user_id, 10);
      if (!Number.isFinite(ownerUserId))
        return res.status(400).json({ error: 'owner_user_id must be a valid integer' });
    } else if (isAgent) {
      ownerUserId = userId;
    }

    // --- Images ---
    const images = Array.isArray(body.images) ? body.images : [];
    for (const img of images) {
      if (typeof img.url !== 'string' || !img.url.trim())
        return res.status(400).json({ error: 'Each image must have a non-empty url string' });
    }

    // --- Insert unit ---
    const [result] = await pool.query(
      `INSERT INTO unit
         (unit_name, location, city, country, bedroom_count, bathroom_count,
          area_sqm, unit_type, description, amenities, min_pax, max_capacity,
          base_price, excess_pax_fee, status, is_featured, check_in_time,
          check_out_time, latitude, longitude, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unit_name.trim(), location, city, country, bedroomCount, bathroomCount,
        areaSqm, unitType, description, amenities, parsedMinPax, parsedMaxCap,
        parsedBasePrice, excessPaxFee, status, isFeatured, checkInTime,
        checkOutTime, latitude, longitude, ownerUserId,
      ]
    );

    const newUnitId = result.insertId;

    // --- Insert images if provided ---
    if (images.length > 0) {
      const imgValues = images.map((img, idx) => [
        newUnitId,
        img.url.trim(),
        img.is_main ? 1 : 0,
        img.sort_order != null ? parseInt(img.sort_order, 10) : idx,
      ]);
      await pool.query(
        'INSERT INTO unit_image (unit_id, image_url, is_main, sort_order) VALUES ?',
        [imgValues]
      );
    }

    // --- Return created unit ---
    const [rows] = await pool.query(
      `SELECT u.unit_id, u.unit_name, u.location, u.city, u.country,
              u.bedroom_count, u.bathroom_count, u.area_sqm, u.unit_type,
              u.description, u.amenities, u.min_pax, u.max_capacity,
              u.base_price, u.excess_pax_fee, u.status, u.is_featured,
              u.check_in_time, u.check_out_time, u.latitude, u.longitude,
              u.owner_user_id, u.created_at, u.updated_at
       FROM unit u WHERE u.unit_id = ?`,
      [newUnitId]
    );

    const [imgRows] = await pool.query(
      'SELECT image_url, is_main, sort_order FROM unit_image WHERE unit_id = ? ORDER BY is_main DESC, sort_order ASC',
      [newUnitId]
    );

    const r = rows[0];
    res.status(201).json({
      id: String(r.unit_id),
      title: r.unit_name,
      description: r.description,
      price: Number(r.base_price),
      price_unit: 'night',
      currency: '₱',
      location: r.location || '',
      city: r.city,
      country: r.country,
      bedrooms: r.bedroom_count,
      bathrooms: r.bathroom_count,
      square_feet: r.area_sqm ? Math.round(r.area_sqm * 10.764) : null,
      area_sqm: r.area_sqm ? Number(r.area_sqm) : null,
      property_type: r.unit_type,
      main_image_url: imgRows.find((i) => i.is_main)?.image_url || imgRows[0]?.image_url || null,
      image_urls: imgRows.map((i) => i.image_url),
      amenities: parseJsonArray(r.amenities),
      is_available: r.status === 'available',
      is_featured: Boolean(r.is_featured),
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      check_in_time: r.check_in_time,
      check_out_time: r.check_out_time,
      owner_user_id: r.owner_user_id ? String(r.owner_user_id) : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  } catch (error) {
    console.error('Create unit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listUnits, getUnitById, listUnitsForManage, updateUnit, createUnit };
