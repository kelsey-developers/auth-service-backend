/**
 * GET /api/admin/viewagent/:agentId
 * Admin only. Returns agent profile, wallet stats, commissions, payouts, and network for a specific agent.
 */

const pool = require('../config/db');

const COMMISSION_RATE = 0.1;

function computeBookingCommission(r) {
  const checkIn = r.checkin_date;
  const checkOut = r.checkout_date;
  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000)))
    : 0;
  const basePricePerNight = Number(r.base_price) || 0;
  const excessPaxFee = Number(r.excess_pax_fee) || 0;
  const maxCapacity = parseInt(r.max_capacity, 10) || parseInt(r.min_pax, 10) || 1;
  const pax = parseInt(r.pax, 10) || 1;
  const guestsOverMax = Math.max(0, pax - maxCapacity);
  const baseTotal = basePricePerNight * Math.max(1, nights);
  const excessFees = guestsOverMax * excessPaxFee * Math.max(1, nights);
  const totalAmount = r.deposit_amount
    ? Number(r.deposit_amount)
    : baseTotal + excessFees;
  return Math.round(totalAmount * COMMISSION_RATE);
}

async function getViewAgent(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    const agentId = parseInt(req.params.agentId, 10);
    if (!Number.isFinite(agentId) || agentId <= 0) {
      return res.status(400).json({ error: 'Invalid agent ID' });
    }

    // Agent profile
    const [userRows] = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at,
              up.username
       FROM \`user\` u
       INNER JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       INNER JOIN role r ON r.role_id = ur.role_id AND r.role_name = 'Agent'
       LEFT JOIN user_profile up ON up.user_id = u.user_id
       WHERE u.user_id = ?`,
      [agentId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const u = userRows[0];
    const fullname = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;

    // Available = balance.current_amount
    const [balanceRows] = await pool.query(
      `SELECT current_amount FROM balance WHERE agent_user_id = ?`,
      [agentId]
    );
    const available = balanceRows.length > 0 ? Number(balanceRows[0].current_amount) : 0;

    // Bookings for this agent
    const [bookingRows] = await pool.query(
      `SELECT b.booking_id, b.reference_code, b.checkin_date, b.checkout_date, b.pax, b.booking_status,
              u.unit_name, u.base_price, u.excess_pax_fee, u.min_pax, u.max_capacity,
              p.deposit_amount,
              g.first_name AS guest_first_name, g.last_name AS guest_last_name
       FROM booking b
       JOIN unit u ON u.unit_id = b.unit_id
       LEFT JOIN payment p ON p.booking_id = b.booking_id
       LEFT JOIN guest_booking_info g ON g.guest_booking_info_id = b.guest_booking_info_id
       WHERE b.agent_user_id = ?
       ORDER BY b.created_at DESC`,
      [agentId]
    );

    let pending = 0;
    let approved = 0;
    const totalCommissionsBookings = [];
    const commissionsList = [];

    for (const r of bookingRows) {
      const status = r.booking_status;
      if (status !== 'penciled' && status !== 'confirmed' && status !== 'completed') continue;

      const commission = computeBookingCommission(r);
      const checkIn = r.checkin_date;
      const checkOut = r.checkout_date;
      const nights = checkIn && checkOut
        ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000)))
        : 0;
      const basePricePerNight = Number(r.base_price) || 0;
      const excessPaxFee = Number(r.excess_pax_fee) || 0;
      const maxCapacity = parseInt(r.max_capacity, 10) || parseInt(r.min_pax, 10) || 1;
      const pax = parseInt(r.pax, 10) || 1;
      const guestsOverMax = Math.max(0, pax - maxCapacity);
      const baseTotal = basePricePerNight * Math.max(1, nights);
      const excessFees = guestsOverMax * excessPaxFee * Math.max(1, nights);
      const totalAmount = r.deposit_amount
        ? Number(r.deposit_amount)
        : baseTotal + excessFees;

      const ref = r.reference_code || `BKG-${String(r.booking_id).padStart(6, '0')}`;
      const property = r.unit_name || 'Unit';
      const guest = [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || 'Guest';

      totalCommissionsBookings.push({ ...r, commission });
      commissionsList.push({
        bookingRef: ref,
        property,
        guest,
        status,
        commission,
        checkIn: checkIn ? new Date(checkIn).toISOString().slice(0, 10) : null,
        checkOut: checkOut ? new Date(checkOut).toISOString().slice(0, 10) : null,
        nights,
        totalAmount,
      });

      if (status === 'penciled') pending += commission;
      if (status === 'confirmed') approved += commission;
    }

    // Total paid = sum of payout_withdrawal where status='paid' for this agent
    const [paidRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payout_withdrawal WHERE agent_user_id = ? AND status = 'paid'`,
      [agentId]
    );
    const totalPaid = Number(paidRows[0]?.total) || 0;

    // Network: children from agent_relationship
    const [childRows] = await pool.query(
      `SELECT child_agent_user_id FROM agent_relationship WHERE parent_agent_user_id = ?`,
      [agentId]
    );
    const childIds = childRows.map((r) => r.child_agent_user_id);
    const totalSubAgents = childIds.length;

    // Active = children with status active
    let activeSubAgents = 0;
    let networkBookings = 0;
    if (childIds.length > 0) {
      const placeholders = childIds.map(() => '?').join(',');
      const [activeRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM \`user\` WHERE user_id IN (${placeholders}) AND status = 'active'`,
        childIds
      );
      activeSubAgents = Number(activeRows[0]?.cnt) || 0;

      const [netBookingRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM booking WHERE agent_user_id IN (${placeholders}) AND booking_status IN ('penciled', 'confirmed', 'completed')`,
        childIds
      );
      networkBookings = Number(netBookingRows[0]?.cnt) || 0;
    }

    // Payouts for this agent
    const [payoutRows] = await pool.query(
      `SELECT pw.payout_id, pw.amount, pw.method, pw.status, pw.requested_at, pw.proof_of_payment_url
       FROM payout_withdrawal pw
       WHERE pw.agent_user_id = ?
       ORDER BY pw.requested_at DESC`,
      [agentId]
    );

    const payouts = payoutRows.map((p) => ({
      id: String(p.payout_id),
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      requestedAt: new Date(p.requested_at).toISOString(),
      proofOfPaymentUrl: p.proof_of_payment_url || undefined,
    }));

    res.json({
      agent: {
        id: String(agentId),
        fullname,
        email: u.email || '',
        phone: u.phone || '',
        username: u.username || `agent-${agentId}`,
        status: u.status === 'active' ? 'active' : 'inactive',
        joinedAt: u.created_at ? new Date(u.created_at).toISOString() : null,
      },
      wallet: {
        available,
        pending,
        approved,
        totalPaid,
      },
      totalCommissions: totalCommissionsBookings.length,
      commissions: commissionsList,
      payouts,
      network: {
        totalSubAgents,
        activeSubAgents,
        networkBookings,
      },
    });
  } catch (error) {
    console.error('View agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getViewAgent };
