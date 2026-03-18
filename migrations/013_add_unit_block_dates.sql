-- Migration: Create unit_block_dates for blocking dates with reason
-- Run: mysql -u root your_database < migrations/013_add_unit_block_dates.sql

CREATE TABLE IF NOT EXISTS unit_block_dates (
  block_id        BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  unit_id         BIGINT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  reason          VARCHAR(255) NOT NULL DEFAULT 'Blocked',
  source          VARCHAR(50) NOT NULL DEFAULT 'manual',
  guest_name      VARCHAR(255) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_unit_block_dates_unit
    FOREIGN KEY (unit_id) REFERENCES unit(unit_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_unit_block_dates_dates
    CHECK (end_date >= start_date),
  CONSTRAINT chk_unit_block_dates_source
    CHECK (source IN ('manual', 'airbnb', 'booking.com', 'agoda', 'expedia', 'vrbo', 'walk_in', 'phone', 'other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_unit_block_dates_unit ON unit_block_dates(unit_id);
CREATE INDEX idx_unit_block_dates_dates ON unit_block_dates(start_date, end_date);
