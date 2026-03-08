const pool = require('../config/db');

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

module.exports = { listUnits, getUnitById };
