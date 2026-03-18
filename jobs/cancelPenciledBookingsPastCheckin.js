/**
 * Cron job: cancel penciled bookings whose checkin_date has already started (PH time).
 * Same pattern as completeBookingsAndCommission (confirmed → completed when checkout passed).
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
 * Run the job: cancel penciled bookings whose checkin_date has already started (PH time).
 */
async function run() {
  const connection = await pool.getConnection();
  try {
    const phDate = getPHDateNow();
    const systemUserId = await getSystemUserId();

    // Penciled bookings where checkin_date <= today (PH time) — start date has already started
    const [bookings] = await connection.query(
      `SELECT b.booking_id
       FROM booking b
       WHERE b.booking_status = 'penciled'
         AND b.checkin_date <= ?`,
      [phDate]
    );

    if (bookings.length === 0) {
      return { cancelled: 0 };
    }

    let cancelled = 0;

    for (const row of bookings) {
      const bookingId = row.booking_id;

      await connection.beginTransaction();

      try {
        // 1. Update booking_status to 'cancelled'
        await connection.query(
          `UPDATE booking SET booking_status = 'cancelled' WHERE booking_id = ?`,
          [bookingId]
        );
        cancelled++;

        // 2. Insert booking_status_history (if we have a system user)
        if (systemUserId) {
          await connection.query(
            `INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by_user_id)
             VALUES (?, 'penciled', 'cancelled', ?)`,
            [bookingId, systemUserId]
          );
        }

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        console.error(`[cancelPenciledBookingsPastCheckin] Error processing booking ${bookingId}:`, err);
      }
    }

    return { cancelled };
  } finally {
    connection.release();
  }
}

module.exports = { run, getPHDateNow };
