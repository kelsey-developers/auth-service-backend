const pool = require('../config/db');

async function listSites(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT site_id, name, latitude, longitude, radius_m
       FROM site
       ORDER BY name ASC`
    );

    const sites = rows.map((r) => ({
      site_id: r.site_id,
      name: r.name,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      radius_m: r.radius_m != null ? Number(r.radius_m) : null,
    }));

    res.json(sites);
  } catch (error) {
    console.error('List sites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createSite(req, res) {
  try {
    const { site_id, name, latitude, longitude, radius_m } = req.body || {};

    if (!site_id || typeof site_id !== 'string' || !site_id.trim()) {
      return res.status(400).json({ error: 'site_id is required and must be a non-empty string' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }

    const trimmedId = site_id.trim();
    const trimmedName = name.trim();

    let lat = null;
    let lon = null;
    let radius = null;

    if (latitude != null) {
      const parsed = parseFloat(latitude);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: 'latitude must be a valid number' });
      }
      lat = parsed;
    }

    if (longitude != null) {
      const parsed = parseFloat(longitude);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: 'longitude must be a valid number' });
      }
      lon = parsed;
    }

    if (radius_m != null) {
      const parsed = parseFloat(radius_m);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res
          .status(400)
          .json({ error: 'radius_m must be a positive number when provided' });
      }
      radius = parsed;
    }

    const [existing] = await pool.query(
      'SELECT site_id FROM site WHERE site_id = ?',
      [trimmedId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A site with this site_id already exists' });
    }

    await pool.query(
      `INSERT INTO site (site_id, name, latitude, longitude, radius_m)
       VALUES (?, ?, ?, ?, ?)`,
      [trimmedId, trimmedName, lat, lon, radius]
    );

    res.status(201).json({
      site_id: trimmedId,
      name: trimmedName,
      latitude: lat,
      longitude: lon,
      radius_m: radius,
    });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteSite(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'site_id is required' });
    }

    const [existing] = await pool.query(
      'SELECT site_id FROM site WHERE site_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    await pool.query('DELETE FROM site WHERE site_id = ?', [id]);

    return res.json({ site_id: id, deleted: true });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listSites, createSite, deleteSite };

