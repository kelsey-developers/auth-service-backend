-- Add unique reference_code to booking for user-facing booking reference (e.g. BKG-A7X9K2M1)
ALTER TABLE booking ADD COLUMN reference_code VARCHAR(20) NULL UNIQUE AFTER booking_id;

-- Backfill existing rows: BKG- + 6-digit padded id (unique per booking)
UPDATE booking SET reference_code = CONCAT('BKG-', LPAD(booking_id, 6, '0'))
WHERE reference_code IS NULL;
