/**
 * Payout withdrawal — agent requests and admin marks paid.
 * Status: pending | paid only.
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');

const uploadDir = path.join(__dirname, '..', 'uploads', 'payout_proof');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `payout-${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
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

const uploadPayoutProof = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

function mapPayoutRow(r) {
  const agentName = [r.agent_first_name, r.agent_last_name].filter(Boolean).join(' ').trim() || 'Agent';
  return {
    id: String(r.payout_id),
    agentId: String(r.agent_user_id),
    agentName,
    amount: Number(r.amount),
    method: r.method,
    recipientNumber: r.recipient_number || undefined,
    recipientName: r.recipient_name || undefined,
    bankName: r.bank_name || undefined,
    accountNumber: r.account_number || undefined,
    status: r.status,
    proofOfPaymentUrl: r.proof_of_payment_url || undefined,
    notes: r.notes || undefined,
    requestedAt: new Date(r.requested_at).toISOString(),
    processedAt: r.processed_at ? new Date(r.processed_at).toISOString() : undefined,
  };
}

/**
 * POST /api/agents/payouts
 * Agent creates a payout withdrawal request. Deducts from balance.
 */
async function createPayout(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const body = req.body || {};
    const amount = parseFloat(body.amount);
    const method = String(body.method || '').toLowerCase();
    const recipientNumber = body.recipientNumber ? String(body.recipientNumber).trim() : null;
    const recipientName = body.recipientName ? String(body.recipientName).trim() : null;
    const bankName = body.bankName ? String(body.bankName).trim() : null;
    const accountNumber = body.accountNumber ? String(body.accountNumber).trim() : null;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (!['gcash', 'maya', 'bank_transfer'].includes(method)) {
      return res.status(400).json({ error: 'Invalid method. Use gcash, maya, or bank_transfer' });
    }
    if (!recipientName) {
      return res.status(400).json({ error: 'Recipient name is required' });
    }
    if (method !== 'bank_transfer' && !recipientNumber) {
      return res.status(400).json({ error: 'Recipient number is required for GCash/Maya' });
    }
    if (method === 'bank_transfer' && (!bankName || !accountNumber)) {
      return res.status(400).json({ error: 'Bank name and account number are required for bank transfer' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [balanceRows] = await conn.query(
        `SELECT current_amount FROM balance WHERE agent_user_id = ?`,
        [userId]
      );
      const currentAmount = balanceRows.length > 0 ? Number(balanceRows[0].current_amount) : 0;
      if (currentAmount < amount) {
        await conn.rollback();
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      const [insertResult] = await conn.query(
        `INSERT INTO payout_withdrawal (agent_user_id, amount, method, recipient_number, recipient_name, bank_name, account_number, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, amount, method, recipientNumber, recipientName, bankName, accountNumber]
      );
      const payoutId = insertResult.insertId;

      await conn.query(
        `INSERT INTO balance_history (agent_user_id, type, amount, reference_type, reference_id)
         VALUES (?, 'remove', ?, 'payout', ?)`,
        [userId, amount, String(payoutId)]
      );

      await conn.query(
        `UPDATE balance SET current_amount = current_amount - ? WHERE agent_user_id = ?`,
        [amount, userId]
      );

      await conn.commit();

      const [rows] = await pool.query(
        `SELECT pw.*, u.first_name AS agent_first_name, u.last_name AS agent_last_name
         FROM payout_withdrawal pw
         JOIN \`user\` u ON u.user_id = pw.agent_user_id
         WHERE pw.payout_id = ?`,
        [payoutId]
      );

      res.status(201).json(mapPayoutRow(rows[0]));
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/agents/payouts
 * Agent lists their own payout requests.
 */
async function getAgentPayouts(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await pool.query(
      `SELECT pw.*, u.first_name AS agent_first_name, u.last_name AS agent_last_name
       FROM payout_withdrawal pw
       JOIN \`user\` u ON u.user_id = pw.agent_user_id
       WHERE pw.agent_user_id = ?
       ORDER BY pw.requested_at DESC`,
      [userId]
    );

    res.json(rows.map(mapPayoutRow));
  } catch (error) {
    console.error('Get agent payouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/payouts
 * Admin lists all payout requests. Query: status, agentId.
 */
async function getAllPayouts(req, res) {
  try {
    const status = req.query.status;
    const agentId = req.query.agentId;

    let sql = `
      SELECT pw.*, u.first_name AS agent_first_name, u.last_name AS agent_last_name
      FROM payout_withdrawal pw
      JOIN \`user\` u ON u.user_id = pw.agent_user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && ['pending', 'paid', 'declined'].includes(status)) {
      sql += ` AND pw.status = ?`;
      params.push(status);
    }
    if (agentId) {
      sql += ` AND pw.agent_user_id = ?`;
      params.push(agentId);
    }

    sql += ` ORDER BY (CASE WHEN pw.status = 'pending' THEN 0 WHEN pw.status = 'declined' THEN 1 ELSE 2 END), pw.requested_at ASC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows.map(mapPayoutRow));
  } catch (error) {
    console.error('Get all payouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/payouts/:id
 * Admin marks payout as paid. Accepts multipart (proof file) or JSON (proofOfPaymentUrl, notes).
 */
async function markPayoutPaid(req, res) {
  try {
    const payoutId = parseInt(req.params.id, 10);
    if (isNaN(payoutId) || payoutId <= 0) {
      return res.status(400).json({ error: 'Invalid payout ID' });
    }

    let proofUrl = null;
    if (req.file) {
      const baseUrl = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
      proofUrl = `${baseUrl}/uploads/payout_proof/${req.file.filename}`;
    }

    const body = req.body || {};
    const notes = body.notes ? String(body.notes).trim() : null;
    const providedProofUrl = body.proofOfPaymentUrl ? String(body.proofOfPaymentUrl).trim() : null;
    const finalProofUrl = proofUrl || providedProofUrl;

    const [rows] = await pool.query(
      `SELECT payout_id, status FROM payout_withdrawal WHERE payout_id = ?`,
      [payoutId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Payout is already processed' });
    }

    const userId = req.user?.userId;

    await pool.query(
      `UPDATE payout_withdrawal
       SET status = 'paid', proof_of_payment_url = COALESCE(?, proof_of_payment_url),
           notes = COALESCE(?, notes), processed_at = NOW(), processed_by_user_id = ?
       WHERE payout_id = ?`,
      [finalProofUrl, notes, userId, payoutId]
    );

    const [updated] = await pool.query(
      `SELECT pw.*, u.first_name AS agent_first_name, u.last_name AS agent_last_name
       FROM payout_withdrawal pw
       JOIN \`user\` u ON u.user_id = pw.agent_user_id
       WHERE pw.payout_id = ?`,
      [payoutId]
    );

    res.json(mapPayoutRow(updated[0]));
  } catch (error) {
    console.error('Mark payout paid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/payouts/:id/decline
 * Admin declines a payout. Refunds amount to agent balance.
 */
async function markPayoutDeclined(req, res) {
  try {
    const payoutId = parseInt(req.params.id, 10);
    if (isNaN(payoutId) || payoutId <= 0) {
      return res.status(400).json({ error: 'Invalid payout ID' });
    }

    const body = req.body || {};
    const notes = body.notes ? String(body.notes).trim() : null;
    const userId = req.user?.userId;

    const [rows] = await pool.query(
      `SELECT payout_id, agent_user_id, amount, status FROM payout_withdrawal WHERE payout_id = ?`,
      [payoutId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payout not found' });
    }
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Payout is already processed' });
    }

    const agentUserId = rows[0].agent_user_id;
    const amount = Number(rows[0].amount);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE payout_withdrawal
         SET status = 'declined', notes = COALESCE(?, notes), processed_at = NOW(), processed_by_user_id = ?
         WHERE payout_id = ?`,
        [notes, userId, payoutId]
      );

      await conn.query(
        `INSERT INTO balance_history (agent_user_id, type, amount, reference_type, reference_id)
         VALUES (?, 'add', ?, 'payout_refund', ?)`,
        [agentUserId, amount, String(payoutId)]
      );

      await conn.query(
        `UPDATE balance SET current_amount = current_amount + ? WHERE agent_user_id = ?`,
        [amount, agentUserId]
      );

      await conn.commit();

      const [updated] = await pool.query(
        `SELECT pw.*, u.first_name AS agent_first_name, u.last_name AS agent_last_name
         FROM payout_withdrawal pw
         JOIN \`user\` u ON u.user_id = pw.agent_user_id
         WHERE pw.payout_id = ?`,
        [payoutId]
      );

      res.json(mapPayoutRow(updated[0]));
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Mark payout declined error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createPayout,
  getAgentPayouts,
  getAllPayouts,
  markPayoutPaid,
  markPayoutDeclined,
  uploadPayoutProof,
};
