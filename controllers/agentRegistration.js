const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const multer = require('multer');
const pool = require('../config/db');

const uploadDir = path.join(__dirname, '..', 'uploads', 'agent_registration');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `agent-reg-${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, WebP, GIF) or PDF are allowed'));
  }
};

const uploadAgentProof = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

function parseFullname(fullname) {
  const parts = String(fullname).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function resolveReferredByUserId(recruitedBy) {
  if (!recruitedBy) return null;
  const refId = parseInt(recruitedBy, 10);
  if (Number.isNaN(refId) || refId <= 0) return null;
  return refId;
}

async function validateReferredByAgent(refId) {
  const [refUser] = await pool.query(
    `SELECT u.user_id FROM \`user\` u
     JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
     JOIN role r ON r.role_id = ur.role_id AND r.role_name = 'Agent'
     WHERE u.user_id = ?`,
    [refId]
  );
  return refUser.length > 0 ? refId : null;
}

async function submitAgentRegistration(req, res) {
  try {
    const body = req.body || {};
    const recruitedBy = body.recruitedBy ? String(body.recruitedBy).trim() : null;
    const agreeTerms = body.agreeTerms === 'true' || body.agreeTerms === true;
    const file = req.file;
    const isAuthenticated = !!req.user?.userId;

    if (!agreeTerms) {
      return res.status(400).json({ error: 'You must agree to the terms and conditions' });
    }
    if (!file) {
      return res.status(400).json({ error: 'Proof of payment file is required' });
    }

    const baseUrl = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
    const paymentProofUrl = `${baseUrl}/uploads/agent_registration/${file.filename}`;

    let userId;
    let referredByUserId = null;

    if (isAuthenticated) {
      userId = req.user.userId;
      const [existingReg] = await pool.query('SELECT agent_registration_id FROM agent_registration WHERE user_id = ?', [userId]);
      if (existingReg.length > 0) {
        return res.status(409).json({ error: 'You have already submitted an agent registration' });
      }
      const refId = resolveReferredByUserId(recruitedBy);
      if (refId && refId !== userId) {
        referredByUserId = await validateReferredByAgent(refId);
      }
    } else {
      const fullname = (body.fullname || '').trim();
      const email = (body.email || '').trim().toLowerCase();
      const phone = (body.phone || '').trim() || null;
      const password = String(body.password || '');

      if (!fullname || !email || !password) {
        return res.status(400).json({ error: 'Full name, email, and password are required' });
      }

      const { firstName, lastName } = parseFullname(fullname);
      if (firstName.length < 2 || firstName.length > 100) {
        return res.status(400).json({ error: 'First name must be between 2 and 100 characters' });
      }
      if (!/^[\p{L}\s'\-]+$/u.test(firstName)) {
        return res.status(400).json({ error: 'First name contains invalid characters' });
      }
      if (lastName.length < 2 || lastName.length > 100) {
        return res.status(400).json({ error: 'Last name must be between 2 and 100 characters' });
      }
      if (!/^[\p{L}\s'\-]+$/u.test(lastName)) {
        return res.status(400).json({ error: 'Last name contains invalid characters' });
      }
      if (email.length > 255) {
        return res.status(400).json({ error: 'Email address is too long' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      if (password.length > 128) {
        return res.status(400).json({ error: 'Password must not exceed 128 characters' });
      }
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
      }
      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
      }
      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Password must contain at least one number' });
      }

      const [existing] = await pool.query('SELECT user_id FROM `user` WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const refId = resolveReferredByUserId(recruitedBy);
      if (refId) {
        referredByUserId = await validateReferredByAgent(refId);
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await pool.query('START TRANSACTION');
      try {
        const [userResult] = await pool.query(
          `INSERT INTO \`user\` (first_name, last_name, email, password_hash, phone)
           VALUES (?, ?, ?, ?, ?)`,
          [firstName, lastName, email, passwordHash, phone]
        );
        userId = userResult.insertId;

        const [roleRows] = await pool.query("SELECT role_id FROM role WHERE role_name = 'Guest'");
        if (roleRows.length > 0) {
          await pool.query('INSERT INTO user_role (user_id, role_id) VALUES (?, ?)', [
            userId,
            roleRows[0].role_id,
          ]);
        }

        await pool.query(
          `INSERT INTO agent_registration (user_id, payment_proof_url, referred_by_user_id, status)
           VALUES (?, ?, ?, 'pending')`,
          [userId, paymentProofUrl, referredByUserId]
        );

        if (referredByUserId) {
          await pool.query(
            `INSERT INTO agent_relationship (parent_agent_user_id, child_agent_user_id, level)
             VALUES (?, ?, 1)`,
            [referredByUserId, userId]
          );
        }

        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    }

    if (isAuthenticated) {
      await pool.query(
        `INSERT INTO agent_registration (user_id, payment_proof_url, referred_by_user_id, status)
         VALUES (?, ?, ?, 'pending')`,
        [userId, paymentProofUrl, referredByUserId]
      );

      if (referredByUserId) {
        await pool.query(
          `INSERT INTO agent_relationship (parent_agent_user_id, child_agent_user_id, level)
           VALUES (?, ?, 1)`,
          [referredByUserId, userId]
        );
      }
    }

    res.status(201).json({ message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Agent registration error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMyRegistration(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const [rows] = await pool.query(
      `SELECT ar.status, u.email, u.first_name, u.last_name, ar.referred_by_user_id
       FROM agent_registration ar
       JOIN \`user\` u ON u.user_id = ar.user_id
       WHERE ar.user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ hasRegistration: false });
    }

    const r = rows[0];
    return res.json({
      hasRegistration: true,
      status: r.status,
      email: r.email,
      fullname: [r.first_name, r.last_name].filter(Boolean).join(' '),
    });
  } catch (error) {
    console.error('Get my registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { uploadAgentProof, submitAgentRegistration, getMyRegistration };
