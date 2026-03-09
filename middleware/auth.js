const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwtSecret } = require('../config/config');

/**
 * Verifies JWT and attaches req.user = { userId, email, roles }.
 * Returns 401 if token missing or invalid.
 */
async function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  let rows;
  try {
    [rows] = await pool.query(
      `SELECT u.user_id, u.email,
              IF(COUNT(r.role_name) > 0, JSON_ARRAYAGG(r.role_name), JSON_ARRAY()) AS roles
       FROM app_user u
       LEFT JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       LEFT JOIN role r ON r.role_id = ur.role_id
       WHERE u.user_id = ?
       GROUP BY u.user_id`,
      [decoded.userId]
    );
  } catch (err) {
    console.error('Auth middleware DB error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = rows[0];
  const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : (user.roles ?? []);

  req.user = {
    userId: user.user_id,
    email: user.email,
    roles,
  };

  next();
}

/**
 * Requires user to have Admin or Agent role.
 * Must be used after requireAuth.
 */
function requireAdminOrAgent(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const allowed = ['Admin', 'Agent'];
  const hasRole = req.user.roles.some((r) => allowed.includes(r));

  if (!hasRole) {
    return res.status(403).json({
      error: 'Only Admin or Agent can create bookings',
    });
  }

  next();
}

/**
 * Optional auth: attaches req.user when token is valid, does not fail when missing.
 * Use for routes that work with or without auth (e.g. guest viewing booking confirmation).
 */
async function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch {
    req.user = null;
    return next();
  }

  let rows;
  try {
    [rows] = await pool.query(
      `SELECT u.user_id, u.email,
              IF(COUNT(r.role_name) > 0, JSON_ARRAYAGG(r.role_name), JSON_ARRAY()) AS roles
       FROM app_user u
       LEFT JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       LEFT JOIN role r ON r.role_id = ur.role_id
       WHERE u.user_id = ?
       GROUP BY u.user_id`,
      [decoded.userId]
    );
  } catch (err) {
    console.error('Auth middleware DB error:', err);
    req.user = null;
    return next();
  }

  if (rows.length === 0) {
    req.user = null;
    return next();
  }

  const user = rows[0];
  const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : (user.roles ?? []);

  req.user = {
    userId: user.user_id,
    email: user.email,
    roles,
  };

  next();
}

module.exports = { requireAuth, requireAdminOrAgent, optionalAuth };
