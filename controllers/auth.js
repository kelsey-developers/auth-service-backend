const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { jwtSecret } = require('../config/config');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT user_id, email, password_hash FROM app_user WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = jwt.sign(
      { userId: user.user_id, email: user.email },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 86400,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function userinfo(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const [rows] = await pool.query(
      `SELECT u.user_id, u.email, u.first_name, u.middle_name, u.last_name,
              u.phone, u.status, u.created_at,
              IF(COUNT(r.role_name) > 0, JSON_ARRAYAGG(r.role_name), JSON_ARRAY()) AS roles
       FROM app_user u
       LEFT JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       LEFT JOIN role r ON r.role_id = ur.role_id
       WHERE u.user_id = ?
       GROUP BY u.user_id`,
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    res.json({
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      middleName: user.middle_name,
      lastName: user.last_name,
      phone: user.phone,
      status: user.status,
      roles: typeof user.roles === 'string' ? JSON.parse(user.roles) : (user.roles ?? []),
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('UserInfo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { login, userinfo };
