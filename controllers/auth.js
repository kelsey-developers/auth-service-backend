const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { jwtSecret } = require('../config/config');

async function register(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      gender,
      birthDate,
      street,
      barangay,
      city,
      zipCode,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }

    const firstNameTrimmed = String(firstName).trim();
    const lastNameTrimmed  = String(lastName).trim();
    const emailTrimmed     = String(email).trim().toLowerCase();
    const passwordStr      = String(password);

    if (firstNameTrimmed.length < 2 || firstNameTrimmed.length > 100) {
      return res.status(400).json({ error: 'First name must be between 2 and 100 characters' });
    }
    if (!/^[\p{L}\s'\-]+$/u.test(firstNameTrimmed)) {
      return res.status(400).json({ error: 'First name contains invalid characters' });
    }

    if (lastNameTrimmed.length < 2 || lastNameTrimmed.length > 100) {
      return res.status(400).json({ error: 'Last name must be between 2 and 100 characters' });
    }
    if (!/^[\p{L}\s'\-]+$/u.test(lastNameTrimmed)) {
      return res.status(400).json({ error: 'Last name contains invalid characters' });
    }

    if (emailTrimmed.length > 255) {
      return res.status(400).json({ error: 'Email address is too long' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (passwordStr.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (passwordStr.length > 128) {
      return res.status(400).json({ error: 'Password must not exceed 128 characters' });
    }
    if (!/[A-Z]/.test(passwordStr)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }
    if (!/[a-z]/.test(passwordStr)) {
      return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
    }
    if (!/[0-9]/.test(passwordStr)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }

    const [existing] = await pool.query(
      'SELECT user_id FROM `user` WHERE email = ?',
      [emailTrimmed]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(passwordStr, 10);

    const [result] = await pool.query(
      `INSERT INTO \`user\`
        (first_name, last_name, email, password_hash, phone, gender, birth_date, street, barangay, city, zip_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstNameTrimmed,
        lastNameTrimmed,
        emailTrimmed,
        passwordHash,
        phone || null,
        gender || null,
        birthDate || null,
        street || null,
        barangay || null,
        city || null,
        zipCode || null,
      ]
    );

    const userId = result.insertId;

    // Assign Guest role
    const [roleRows] = await pool.query(
      "SELECT role_id FROM role WHERE role_name = 'Guest'",
    );
    if (roleRows.length > 0) {
      await pool.query(
        'INSERT INTO user_role (user_id, role_id) VALUES (?, ?)',
        [userId, roleRows[0].role_id]
      );
    }

    res.status(201).json({ message: 'Account created successfully' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT user_id, email, password_hash FROM `user` WHERE email = ?',
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
       FROM \`user\` u
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

module.exports = { register, login, userinfo };
