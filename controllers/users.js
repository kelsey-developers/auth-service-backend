const pool = require('../config/db');

function requireAdmin(req, res) {
  if (!req.user || !req.user.roles.includes('Admin')) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

async function listUsers(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const {
      search = '',
      role = '',
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (search.trim()) {
      conditions.push(
        `(CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.email LIKE ?)`
      );
      const like = `%${search.trim()}%`;
      params.push(like, like);
    }

    if (role.trim()) {
      conditions.push(`r.role_name = ?`);
      params.push(role.trim());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(DISTINCT u.user_id) AS total
      FROM \`user\` u
      LEFT JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
      LEFT JOIN role r ON r.role_id = ur.role_id
      ${whereClause}
    `;

    const dataSql = `
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.gender,
        u.birth_date,
        u.status,
        u.created_at,
        IF(COUNT(r.role_name) > 0, JSON_ARRAYAGG(r.role_name), JSON_ARRAY()) AS roles,
        (SELECT COUNT(*) FROM booking b WHERE b.agent_user_id = u.user_id) AS booking_count,
        (SELECT COUNT(*) FROM agent_relationship ar WHERE ar.parent_agent_user_id = u.user_id) AS sub_agent_count,
        (SELECT COALESCE(MAX(ar.level), 0) + 1 FROM agent_relationship ar WHERE ar.child_agent_user_id = u.user_id) AS agent_level,
        (SELECT COALESCE(b.current_amount, 0) FROM balance b WHERE b.agent_user_id = u.user_id LIMIT 1) AS total_commissions
      FROM \`user\` u
      LEFT JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
      LEFT JOIN role r ON r.role_id = ur.role_id
      ${whereClause}
      GROUP BY u.user_id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [[{ total }]] = await pool.query(countSql, params);
    const [rows] = await pool.query(dataSql, [...params, limitNum, offset]);

    const users = rows.map((u) => {
      const roles = typeof u.roles === 'string' ? JSON.parse(u.roles) : (u.roles ?? []);
      const isAgent = roles.includes('Agent');
      const level = Math.min(3, Math.max(1, parseInt(u.agent_level, 10) || 1));
      return {
        id: u.user_id,
        firstName: u.first_name,
        lastName: u.last_name,
        fullname: `${u.first_name} ${u.last_name}`.trim(),
        email: u.email,
        phone: u.phone,
        gender: u.gender,
        birthDate: u.birth_date,
        status: u.status,
        createdAt: u.created_at,
        roles,
        ...(isAgent && {
          bookingCount: parseInt(u.booking_count, 10) || 0,
          subAgentCount: parseInt(u.sub_agent_count, 10) || 0,
          agentLevel: level,
          totalCommissions: Number(u.total_commissions) || 0,
        }),
      };
    });

    res.json({
      users,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('listUsers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateUser(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const { id } = req.params;
    const { firstName, lastName, email, role, status } = req.body;

    const [existing] = await pool.query(
      'SELECT user_id FROM `user` WHERE user_id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const updateParams = [];

    if (status !== undefined) {
      const v = String(status).toLowerCase();
      if (v !== 'active' && v !== 'inactive' && v !== 'suspended') {
        return res.status(400).json({ error: 'Status must be active, inactive, or suspended' });
      }
      updates.push('status = ?');
      updateParams.push(v);
    }

    if (firstName !== undefined) {
      const v = String(firstName).trim();
      if (!v) return res.status(400).json({ error: 'First name cannot be empty' });
      updates.push('first_name = ?');
      updateParams.push(v);
    }
    if (lastName !== undefined) {
      const v = String(lastName).trim();
      if (!v) return res.status(400).json({ error: 'Last name cannot be empty' });
      updates.push('last_name = ?');
      updateParams.push(v);
    }
    if (email !== undefined) {
      const v = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      const [dup] = await pool.query(
        'SELECT user_id FROM `user` WHERE email = ? AND user_id != ?',
        [v, id]
      );
      if (dup.length > 0) {
        return res.status(409).json({ error: 'Email already in use by another account' });
      }
      updates.push('email = ?');
      updateParams.push(v);
    }

    if (updates.length > 0) {
      await pool.query(
        `UPDATE \`user\` SET ${updates.join(', ')} WHERE user_id = ?`,
        [...updateParams, id]
      );
    }

    if (role !== undefined) {
      const [roleRows] = await pool.query(
        'SELECT role_id FROM role WHERE role_name = ?',
        [role]
      );
      if (roleRows.length === 0) {
        return res.status(400).json({ error: `Unknown role: ${role}` });
      }
      const roleId = roleRows[0].role_id;

      const [existingRow] = await pool.query(
        'SELECT user_id FROM user_role WHERE user_id = ?',
        [id]
      );

      if (existingRow.length > 0) {
        await pool.query(
          'UPDATE user_role SET role_id = ? WHERE user_id = ?',
          [roleId, id]
        );
      } else {
        await pool.query(
          `INSERT INTO user_role (user_id, role_id, status) VALUES (?, ?, 'active')`,
          [id, roleId]
        );
      }
    }

    const [updatedRows] = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.gender, u.birth_date, u.status, u.created_at,
              IF(COUNT(r.role_name) > 0, JSON_ARRAYAGG(r.role_name), JSON_ARRAY()) AS roles
       FROM \`user\` u
       LEFT JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       LEFT JOIN role r ON r.role_id = ur.role_id
       WHERE u.user_id = ?
       GROUP BY u.user_id`,
      [id]
    );

    const u = updatedRows[0];
    res.json({
      id: u.user_id,
      firstName: u.first_name,
      lastName: u.last_name,
      fullname: `${u.first_name} ${u.last_name}`.trim(),
      email: u.email,
      phone: u.phone,
      gender: u.gender,
      birthDate: u.birth_date,
      status: u.status,
      createdAt: u.created_at,
      roles: typeof u.roles === 'string' ? JSON.parse(u.roles) : (u.roles ?? []),
    });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listUsers, updateUser };
