/**
 * Admin: agent registration management (approve/reject)
 * Data from agent_registration table.
 */

const pool = require('../config/db');

/**
 * GET /api/agents/register/pending
 * Admin only. Returns all agent registrations (pending, approved, rejected).
 */
async function getRegistrations(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const [rows] = await pool.query(
      `SELECT ar.agent_registration_id, ar.user_id, ar.payment_proof_url, ar.referred_by_user_id, ar.status, ar.created_at,
              u.first_name, u.last_name, u.email, u.phone,
              ref.first_name AS ref_first_name, ref.last_name AS ref_last_name
       FROM agent_registration ar
       JOIN \`user\` u ON u.user_id = ar.user_id
       LEFT JOIN \`user\` ref ON ref.user_id = ar.referred_by_user_id
       ORDER BY ar.created_at DESC`
    );

    const registrations = rows.map((r) => {
      const fullname = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email;
      const recruitedByName = r.ref_first_name || r.ref_last_name
        ? [r.ref_first_name, r.ref_last_name].filter(Boolean).join(' ').trim()
        : null;
      return {
        id: String(r.agent_registration_id),
        fullname,
        email: r.email || '',
        contactNumber: r.phone || '',
        recruitedById: r.referred_by_user_id ? String(r.referred_by_user_id) : undefined,
        recruitedByName: recruitedByName || undefined,
        registrationFeeStatus: r.payment_proof_url ? 'paid' : 'unpaid',
        status: r.status,
        appliedAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        proofOfPaymentUrl: r.payment_proof_url || undefined,
      };
    });

    res.json(registrations);
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/registrations/:id/approve
 * Admin only. Approves a pending registration: sets status to 'approved' and updates
 * the user's existing user_role (role_id) to Agent instead of adding a new role row.
 */
async function approveRegistration(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const regId = parseInt(req.params.id, 10);
    if (!Number.isFinite(regId)) {
      return res.status(400).json({ error: 'Invalid registration ID' });
    }

    const [regRows] = await pool.query(
      `SELECT agent_registration_id, user_id, status FROM agent_registration WHERE agent_registration_id = ?`,
      [regId]
    );

    if (regRows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const reg = regRows[0];
    if (reg.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending registrations can be approved' });
    }

    const userId = reg.user_id;

    await pool.query('START TRANSACTION');
    try {
      await pool.query(
        `UPDATE agent_registration SET status = 'approved' WHERE agent_registration_id = ?`,
        [regId]
      );

      const [roleRows] = await pool.query("SELECT role_id FROM role WHERE role_name = 'Agent'");
      if (roleRows.length > 0) {
        const agentRoleId = roleRows[0].role_id;
        await pool.query(
          `UPDATE user_role SET role_id = ?, status = 'active' WHERE user_id = ?`,
          [agentRoleId, userId]
        );
      }

      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    res.json({ id: String(regId), status: 'approved' });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/agents/register/:id/reject
 * Admin only. Rejects a pending registration: sets status to 'rejected'.
 */
async function rejectRegistration(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const regId = parseInt(req.params.id, 10);
    if (!Number.isFinite(regId)) {
      return res.status(400).json({ error: 'Invalid registration ID' });
    }

    const [regRows] = await pool.query(
      `SELECT agent_registration_id, status FROM agent_registration WHERE agent_registration_id = ?`,
      [regId]
    );

    if (regRows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (regRows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending registrations can be rejected' });
    }

    await pool.query(
      `UPDATE agent_registration SET status = 'rejected' WHERE agent_registration_id = ?`,
      [regId]
    );

    res.json({ id: String(regId), status: 'rejected' });
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getRegistrations, approveRegistration, rejectRegistration };
