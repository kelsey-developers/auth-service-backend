/**
 * Cron job: every 24 hours, complete confirmed bookings whose checkout + 24h has passed (PH time),
 * then add 10% commission to agent balance and record in balance_history.
 */

const pool = require('../config/db');

const PH_TZ_OFFSET_HOURS = 8; // UTC+8 for Asia/Manila

/**
 * Get current date in Philippines timezone (YYYY-MM-DD).
 */
function getPHDateNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ph = new Date(utc + PH_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return ph.toISOString().slice(0, 10);
}

/**
 * Get first admin user_id for booking_status_history (system actions).
 */
async function getSystemUserId() {
  const [rows] = await pool.query(
    `SELECT u.user_id FROM \`user\` u
     INNER JOIN user_role ur ON ur.user_id = u.user_id AND ur.status = 'active'
     INNER JOIN role r ON r.role_id = ur.role_id AND r.role_name = 'Admin'
     LIMIT 1`
  );
  return rows.length > 0 ? rows[0].user_id : null;
}

/**
 * Check if commission was already added for this booking.
 */
async function hasCommissionForBooking(conn, bookingId) {
  const [rows] = await conn.query(
    `SELECT 1 FROM balance_history
     WHERE reference_type = 'booking' AND reference_id = ?
     LIMIT 1`,
    [String(bookingId)]
  );
  return rows.length > 0;
}

/**
 * Run the job: complete eligible bookings and add agent commissions.
 */
async function run() {
  const connection = await pool.getConnection();
  try {
    const phDate = getPHDateNow();
    const systemUserId = await getSystemUserId();

    // Confirmed bookings where checkout_date + 1 day <= today (PH time)
    // i.e. 24 hours have passed since checkout
    const [bookings] = await connection.query(
      `SELECT b.booking_id, b.agent_user_id, b.checkin_date, b.checkout_date,
              u.base_price, u.excess_pax_fee, u.min_pax, u.max_capacity,
              b.pax,
              p.deposit_amount
       FROM booking b
       JOIN unit u ON u.unit_id = b.unit_id
       LEFT JOIN payment p ON p.booking_id = b.booking_id
       WHERE b.booking_status = 'confirmed'
         AND DATE(DATE_ADD(DATE(b.checkout_date), INTERVAL 1 DAY)) <= ?`,
      [phDate]
    );

    if (bookings.length === 0) {
      return { completed: 0, commissionsAdded: 0 };
    }

    let completed = 0;
    let commissionsAdded = 0;

    for (const row of bookings) {
      const bookingId = row.booking_id;
      const agentUserId = row.agent_user_id;

      // Compute total_amount (same logic as getAllBookings)
      const checkIn = row.checkin_date;
      const checkOut = row.checkout_date;
      const nights = checkIn && checkOut
        ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / (24 * 60 * 60 * 1000)))
        : 0;
      const basePricePerNight = Number(row.base_price) || 0;
      const excessPaxFee = Number(row.excess_pax_fee) || 0;
      const maxCapacity = parseInt(row.max_capacity, 10) || parseInt(row.min_pax, 10) || 1;
      const pax = parseInt(row.pax, 10) || 1;
      const guestsOverMax = Math.max(0, pax - maxCapacity);
      const baseTotal = basePricePerNight * Math.max(1, nights);
      const excessFees = guestsOverMax * excessPaxFee * Math.max(1, nights);
      const totalAmount = row.deposit_amount
        ? Number(row.deposit_amount)
        : baseTotal + excessFees;

      const commissionAmount = Math.round(totalAmount * 0.1);

      await connection.beginTransaction();

      try {
        // 1. Update booking_status to 'completed'
        await connection.query(
          `UPDATE booking SET booking_status = 'completed' WHERE booking_id = ?`,
          [bookingId]
        );
        completed++;

        // 2. Insert booking_status_history (if we have a system user)
        if (systemUserId) {
          await connection.query(
            `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by_user_id)
             VALUES (?, 'confirmed', 'completed', ?)`,
            [bookingId, systemUserId]
          );
        }

        // 3. Add commission to agent balance (if agent exists and commission not already added)
        if (agentUserId && commissionAmount > 0) {
          const alreadyAdded = await hasCommissionForBooking(connection, bookingId);
          if (!alreadyAdded) {
            // Ensure balance row exists
            await connection.query(
              `INSERT INTO balance (agent_user_id, current_amount) VALUES (?, 0)
               ON DUPLICATE KEY UPDATE agent_user_id = agent_user_id`,
              [agentUserId]
            );
            // Add to balance
            await connection.query(
              `UPDATE balance SET current_amount = current_amount + ? WHERE agent_user_id = ?`,
              [commissionAmount, agentUserId]
            );
            // Record in balance_history
            await connection.query(
              `INSERT INTO balance_history (agent_user_id, type, amount, reference_type, reference_id)
               VALUES (?, 'add', ?, 'booking', ?)`,
              [agentUserId, commissionAmount, String(bookingId)]
            );
            commissionsAdded++;
          }
        }

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        console.error(`[completeBookingsAndCommission] Error processing booking ${bookingId}:`, err);
      }
    }

    return { completed, commissionsAdded };
  } finally {
    connection.release();
  }
}

module.exports = { run, getPHDateNow };
