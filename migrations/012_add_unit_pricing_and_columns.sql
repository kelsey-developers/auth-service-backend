-- Migration: Add tower_building, unit_number to unit; create unit_pricing for Stay-Length Discounts & Holiday Pricing
-- Aligns manage-units frontend with backend schema.
-- Run: mysql -u root your_database < migrations/012_add_unit_pricing_and_columns.sql

-- Add new columns to unit table (run once; omit if columns already exist)
ALTER TABLE unit ADD COLUMN tower_building VARCHAR(150) NULL AFTER unit_name;
ALTER TABLE unit ADD COLUMN unit_number VARCHAR(50) NULL AFTER tower_building;

-- unit_pricing: Stay-Length Discounts and Holiday & Special Date Pricing
CREATE TABLE IF NOT EXISTS unit_pricing (
  unit_pricing_id   BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  unit_id           BIGINT NOT NULL,
  pricing_type      VARCHAR(30) NOT NULL,
  rule_data         JSON NOT NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_unit_pricing_unit
    FOREIGN KEY (unit_id) REFERENCES unit(unit_id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT chk_unit_pricing_type
    CHECK (pricing_type IN ('stay_length_discount', 'holiday_pricing'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_unit_pricing_unit_id ON unit_pricing(unit_id);
CREATE INDEX idx_unit_pricing_type ON unit_pricing(unit_id, pricing_type);
