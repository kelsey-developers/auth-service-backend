const pool = require('../config/db');

// GET /api/employees
// Derive "employees" view from user + role tables.
async function listEmployees(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id,
              u.first_name,
              u.middle_name,
              u.last_name,
              u.status,
              u.city,
              u.phone,
              GROUP_CONCAT(r.role_name ORDER BY r.role_name SEPARATOR ',') AS roles
       FROM \`user\` u
       LEFT JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       LEFT JOIN role r ON r.role_id = ur.role_id
       GROUP BY u.user_id, u.first_name, u.middle_name, u.last_name, u.status, u.city, u.phone
       ORDER BY u.first_name, u.last_name`
    );

    const employees = rows.map((u) => {
      const fullName = [u.first_name, u.middle_name, u.last_name]
        .filter(Boolean)
        .join(' ');
      const roleNames = (u.roles || '')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      // Map DB roles -> frontend employment_type & cleaner.role
      const hasAgent = roleNames.includes('Agent');
      const hasAdmin = roleNames.includes('Admin');

      const employment_type = hasAgent ? 'COMMISSION' : 'DAILY';
      const position = hasAdmin ? 'Admin' : 'Employee';

      return {
        employee_id: u.user_id,
        full_name: fullName || 'Unnamed User',
        position,
        employment_type,
        current_rate: 0,
        unit_id: null,
        status: u.status,
      };
    });

    return res.json(employees);
  } catch (error) {
    console.error('listEmployees error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listEmployees };

