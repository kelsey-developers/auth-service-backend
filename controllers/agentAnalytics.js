/**
 * Admin agent analytics — top performing agents this month from balance_history.
 * type='add', reference_type='booking', created_at in current month (PH time).
 */

const pool = require('../config/db');

// This month in PH time (UTC+8): use MySQL DATE_ADD(NOW(), INTERVAL 8 HOUR) for PH date

/**
 * GET /api/admin/analytics
 * Admin only. Returns totalAgents, activeAgents, totalCommissionsPaid, totalCommissionsPending,
 * and topAgents (this month, from balance_history type=add, reference_type=booking).
 */
async function getAgentAnalytics(req, res) {
  try {
    const roles = req.user?.roles || [];
    if (!roles.includes('Admin')) {
      return res.status(403).json({ error: 'Admin role required' });
    }

    // Total agents (users with Agent role)
    const [agentCountRows] = await pool.query(
      `SELECT COUNT(DISTINCT u.user_id) AS total
       FROM \`user\` u
       INNER JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       INNER JOIN role r ON r.role_id = ur.role_id AND r.role_name = 'Agent'`
    );
    const totalAgents = Number(agentCountRows[0]?.total) || 0;

    // Active agents (status = active)
    const [activeRows] = await pool.query(
      `SELECT COUNT(DISTINCT u.user_id) AS cnt
       FROM \`user\` u
       INNER JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
       INNER JOIN role r ON r.role_id = ur.role_id AND r.role_name = 'Agent'
       WHERE u.status = 'active'`
    );
    const activeAgents = Number(activeRows[0]?.cnt) || 0;

    // Total paid = sum of all payout_withdrawal where status='paid' (all time disbursed)
    const [paidRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payout_withdrawal WHERE status = 'paid'`
    );
    const totalCommissionsPaid = Number(paidRows[0]?.total) || 0;

    // Total pending = 10% of total_amount for every booking where booking_status = 'penciled'
    const [pendingRows] = await pool.query(
      `SELECT b.booking_id, b.checkin_date, b.checkout_date, b.pax, u.base_price, u.excess_pax_fee, u.min_pax, u.max_capacity,
              p.deposit_amount
       FROM booking b
       JOIN unit u ON u.unit_id = b.unit_id
       LEFT JOIN payment p ON p.booking_id = b.booking_id
       WHERE b.booking_status = 'penciled'`
    );
    let totalCommissionsPending = 0;
    for (const r of pendingRows) {
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
      totalCommissionsPending += Math.round(totalAmount * 0.1);
    }

    // Top agents THIS MONTH (PH time): from balance_history type='add', reference_type='booking'
    const [topRows] = await pool.query(
      `SELECT
         bh.agent_user_id,
         u.first_name,
         u.last_name,
         SUM(bh.amount) AS month_commission,
         COUNT(bh.reference_id) AS month_bookings
       FROM balance_history bh
       JOIN \`user\` u ON u.user_id = bh.agent_user_id
       WHERE bh.type = 'add'
         AND bh.reference_type = 'booking'
         AND MONTH(bh.created_at) = MONTH(DATE_ADD(NOW(), INTERVAL 8 HOUR))
         AND YEAR(bh.created_at) = YEAR(DATE_ADD(NOW(), INTERVAL 8 HOUR))
       GROUP BY bh.agent_user_id, u.first_name, u.last_name
       ORDER BY month_commission DESC
       LIMIT 10`
    );

    // Get activeSubAgents for each top agent
    const topAgents = await Promise.all(
      topRows.map(async (r) => {
        const [subRows] = await pool.query(
          `SELECT COUNT(*) AS cnt FROM agent_relationship WHERE parent_agent_user_id = ?`,
          [r.agent_user_id]
        );
        const activeSubAgents = Number(subRows[0]?.cnt) || 0;
        const fullname = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Agent';
        return {
          agentId: String(r.agent_user_id),
          agentName: fullname,
          referralCode: `AGENT-${r.agent_user_id}`,
          totalCommissions: Math.round(Number(r.month_commission) || 0),
          totalBookings: Number(r.month_bookings) || 0,
          activeSubAgents,
        };
      })
    );

    res.json({
      totalAgents,
      activeAgents,
      totalCommissionsPaid,
      totalCommissionsPending,
      topAgents,
      monthlyCommissionData: [], // Keep for UI compatibility; can be populated later
    });
  } catch (error) {
    console.error('Get agent analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAgentAnalytics };
