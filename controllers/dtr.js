const pool = require('../config/db');

function toDateOnly(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.substring(0, 10);
  }
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().substring(0, 10);
}

function toTime(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{2}:\d{2}/.test(val)) {
    return val.substring(0, 8);
  }
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toTimeString().substring(0, 8);
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // metres
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/dtr?employee_id=1&date=2024-02-01
async function getDTR(req, res) {
  try {
    const { employee_id, date } = req.query;

    if (!employee_id || !date) {
      return res.status(400).json({ error: 'employee_id and date are required' });
    }

    const workDate = toDateOnly(date);
    const [rows] = await pool.query(
      `SELECT * FROM dtr_records WHERE employee_id = ? AND work_date = ? LIMIT 1`,
      [employee_id, workDate]
    );

    if (rows.length === 0) {
      return res.json(null);
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('getDTR error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/dtr/time-in
async function timeIn(req, res) {
  try {
    const {
      employee_id,
      work_date,
      shift_start,
      shift_end,
      latitude,
      longitude,
      site_id,
    } = req.body || {};

    if (!employee_id || !work_date || !site_id) {
      return res
        .status(400)
        .json({ error: 'employee_id, work_date, and site_id are required' });
    }

    const workDate = toDateOnly(work_date);

    // Validate site
    const [siteRows] = await pool.query(
      `SELECT site_id, latitude, longitude, radius_m FROM site WHERE site_id = ?`,
      [site_id]
    );
    if (siteRows.length === 0) {
      return res.status(400).json({ error: 'Invalid site_id for time-in' });
    }
    const site = siteRows[0];

    // Optional geo-radius check
    if (
      site.latitude != null &&
      site.longitude != null &&
      latitude != null &&
      longitude != null
    ) {
      const radius = site.radius_m != null ? Number(site.radius_m) : 200;
      const distance = haversineDistanceMeters(
        Number(site.latitude),
        Number(site.longitude),
        Number(latitude),
        Number(longitude)
      );
      if (distance > radius) {
        return res
          .status(403)
          .json({ error: 'You are not within the allowed area for this site.' });
      }
    }

    // Prevent duplicate time-in for same day
    const [existing] = await pool.query(
      `SELECT dtr_id FROM dtr_records WHERE employee_id = ? AND work_date = ? LIMIT 1`,
      [employee_id, workDate]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Already timed in for today' });
    }

    const now = new Date();
    const [result] = await pool.query(
      `INSERT INTO dtr_records
       (employee_id, work_date, time_in, status, shift_start, shift_end, latitude, longitude, site_id)
       VALUES (?, ?, ?, 'OPEN', ?, ?, ?, ?, ?)`,
      [
        employee_id,
        workDate,
        now,
        shift_start ? toTime(shift_start) : null,
        shift_end ? toTime(shift_end) : null,
        latitude != null ? latitude : null,
        longitude != null ? longitude : null,
        site_id,
      ]
    );

    const insertId = result.insertId;
    const [rows] = await pool.query(
      `SELECT * FROM dtr_records WHERE dtr_id = ?`,
      [insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('timeIn error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/dtr/time-out
async function timeOut(req, res) {
  try {
    const { employee_id, dtr_id, latitude, longitude, site_id } = req.body || {};

    if (!employee_id || !dtr_id || !site_id) {
      return res
        .status(400)
        .json({ error: 'employee_id, dtr_id, and site_id are required' });
    }

    const [records] = await pool.query(
      `SELECT time_in, site_id FROM dtr_records WHERE dtr_id = ? AND employee_id = ?`,
      [dtr_id, employee_id]
    );
    if (records.length === 0) {
      return res.status(404).json({ error: 'DTR record not found' });
    }
    const record = records[0];

    if (record.site_id && record.site_id !== site_id) {
      return res
        .status(400)
        .json({ error: 'Site does not match original time-in location.' });
    }

    const [siteRows] = await pool.query(
      `SELECT site_id, latitude, longitude, radius_m FROM site WHERE site_id = ?`,
      [site_id]
    );
    if (siteRows.length === 0) {
      return res.status(400).json({ error: 'Invalid site_id for time-out' });
    }
    const site = siteRows[0];

    if (
      site.latitude != null &&
      site.longitude != null &&
      latitude != null &&
      longitude != null
    ) {
      const radius = site.radius_m != null ? Number(site.radius_m) : 200;
      const distance = haversineDistanceMeters(
        Number(site.latitude),
        Number(site.longitude),
        Number(latitude),
        Number(longitude)
      );
      if (distance > radius) {
        return res
          .status(403)
          .json({ error: 'You are not within the allowed area for this site.' });
      }
    }

    const timeOutNow = new Date();
    const timeInDate = new Date(record.time_in);
    const hoursWorked =
      (timeOutNow.getTime() - timeInDate.getTime()) / 1000 / 3600;

    await pool.query(
      `UPDATE dtr_records
       SET time_out = ?, hours_worked = ?, status = 'CLOSED'
       WHERE dtr_id = ?`,
      [timeOutNow, parseFloat(hoursWorked.toFixed(2)), dtr_id]
    );

    const [rows] = await pool.query(
      `SELECT * FROM dtr_records WHERE dtr_id = ?`,
      [dtr_id]
    );

    return res.json(rows[0]);
  } catch (error) {
    console.error('timeOut error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/dtr/tasks?employee_id=1&date=2024-02-01
async function getTasks(req, res) {
  try {
    const { employee_id, date } = req.query;

    if (!employee_id || !date) {
      return res.status(400).json({ error: 'employee_id and date are required' });
    }

    const day = toDateOnly(date);
    const start = `${day} 00:00:00`;
    const end = `${day} 23:59:59`;

    const [rows] = await pool.query(
      `SELECT * FROM task_logs
       WHERE employee_id = ?
         AND completed_at BETWEEN ? AND ?
       ORDER BY completed_at ASC`,
      [employee_id, start, end]
    );

    return res.json(rows);
  } catch (error) {
    console.error('getTasks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/dtr/tasks  (multipart/form-data)
async function uploadTask(req, res) {
  try {
    const { employee_id, dtr_id, task_type, location, completed_at } = req.body || {};
    const file = req.file;

    if (!employee_id || !dtr_id || !task_type || !location) {
      return res.status(400).json({
        error: 'employee_id, dtr_id, task_type, and location are required',
      });
    }

    let proof_photo_url = '';
    if (file) {
      // In this service, uploaded files are served from /uploads/*
      const fileName = `task-photos/${employee_id}/${Date.now()}-${file.originalname}`;
      const fs = require('fs');
      const path = require('path');
      const destPath = path.join(__dirname, '..', 'uploads', fileName);
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
      await fs.promises.writeFile(destPath, file.buffer);
      proof_photo_url = `/uploads/${fileName}`;
    }

    const completedAt =
      completed_at && toDateOnly(completed_at)
        ? new Date(completed_at)
        : new Date();

    const [result] = await pool.query(
      `INSERT INTO task_logs
       (dtr_id, employee_id, unit_name, task_type, proof_photo_url, completed_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')`,
      [
        dtr_id,
        employee_id,
        location,
        task_type,
        proof_photo_url || null,
        completedAt,
      ]
    );

    const insertId = result.insertId;
    const [rows] = await pool.query(
      `SELECT * FROM task_logs WHERE id = ?`,
      [insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('uploadTask error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/dtr/range?employee_id=1&start=2024-01-01&end=2024-01-15
async function getDTRRange(req, res) {
  try {
    const { employee_id, start, end } = req.query;

    if (!employee_id || !start || !end) {
      return res
        .status(400)
        .json({ error: 'employee_id, start, and end are required' });
    }

    const startDate = toDateOnly(start);
    const endDate = toDateOnly(end);

    const [rows] = await pool.query(
      `SELECT * FROM dtr_records
       WHERE employee_id = ?
         AND work_date >= ?
         AND work_date <= ?
       ORDER BY work_date ASC`,
      [employee_id, startDate, endDate]
    );

    return res.json(rows);
  } catch (error) {
    console.error('getDTRRange error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/dtr/all?start=2024-01-01&end=2024-01-15
async function getAllDTR(req, res) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end are required' });
    }

    const startDate = toDateOnly(start);
    const endDate = toDateOnly(end);

    const [records] = await pool.query(
      `SELECT * FROM dtr_records
       WHERE work_date >= ? AND work_date <= ?
       ORDER BY work_date DESC`,
      [startDate, endDate]
    );

    const rows = records || [];
    const employeeIds = [
      ...new Set(rows.map((r) => r.employee_id).filter(Boolean)),
    ];

    let employeeMap = {};
    if (employeeIds.length > 0) {
      const [employees] = await pool.query(
        `SELECT employee_id, full_name, position, employment_type
         FROM employees
         WHERE employee_id IN (?)`,
        [employeeIds]
      );
      employeeMap = Object.fromEntries(
        employees.map((e) => [e.employee_id, e])
      );
    }

    return res.json(
      rows.map((r) => ({
        ...r,
        employee: employeeMap[r.employee_id] || null,
      }))
    );
  } catch (error) {
    console.error('getAllDTR error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/dtr/:id/verify
async function verifyDTR(req, res) {
  try {
    const { id } = req.params;
    const { verified, notes } = req.body || {};

    if (verified === undefined) {
      return res
        .status(400)
        .json({ error: 'verified (true/false) is required' });
    }

    await pool.query(
      `UPDATE dtr_records
       SET is_verified = ?, verification_notes = ?, verified_at = NOW()
       WHERE dtr_id = ?`,
      [verified ? 1 : 0, notes || null, id]
    );

    const [rows] = await pool.query(
      `SELECT * FROM dtr_records WHERE dtr_id = ?`,
      [id]
    );

    return res.json(rows[0]);
  } catch (error) {
    console.error('verifyDTR error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/dtr/summary?start=2024-01-01&end=2024-01-15
async function getDTRSummary(req, res) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end are required' });
    }

    const startDate = toDateOnly(start);
    const endDate = toDateOnly(end);

    const [records] = await pool.query(
      `SELECT employee_id, work_date, status, hours_worked
       FROM dtr_records
       WHERE work_date >= ? AND work_date <= ? AND status = 'CLOSED'`,
      [startDate, endDate]
    );

    const rows = records || [];
    const employeeIds = [
      ...new Set(rows.map((r) => r.employee_id).filter(Boolean)),
    ];

    let employeeMap = {};
    if (employeeIds.length > 0) {
      const [employees] = await pool.query(
        `SELECT employee_id, full_name, position, employment_type, current_rate
         FROM employees
         WHERE employee_id IN (?)`,
        [employeeIds]
      );
      employeeMap = Object.fromEntries(
        employees.map((e) => [e.employee_id, e])
      );
    }

    const summaryMap = {};
    for (const r of rows) {
      if (!summaryMap[r.employee_id]) {
        summaryMap[r.employee_id] = { days_worked: 0, total_hours: 0 };
      }
      summaryMap[r.employee_id].days_worked += 1;
      summaryMap[r.employee_id].total_hours += r.hours_worked || 0;
    }

    const summary = Object.entries(summaryMap).map(([empId, stats]) => ({
      employee_id: Number(empId),
      employee: employeeMap[Number(empId)] || null,
      days_worked: stats.days_worked,
      total_hours: parseFloat(stats.total_hours.toFixed(2)),
    }));

    return res.json(summary);
  } catch (error) {
    console.error('getDTRSummary error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getDTR,
  timeIn,
  timeOut,
  getTasks,
  uploadTask,
  getDTRRange,
  getAllDTR,
  verifyDTR,
  getDTRSummary,
};

