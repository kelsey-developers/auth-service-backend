-- Migration: Add Finance, Inventory, Housekeeping roles
-- Run: mysql -u root your_database < migrations/004_add_finance_inventory_housekeeping_roles.sql

-- Drop existing CHECK constraint on role_name
ALTER TABLE role DROP CONSTRAINT chk_role_name;

-- Add updated CHECK constraint with new roles
ALTER TABLE role ADD CONSTRAINT chk_role_name
  CHECK (role_name IN ('Guest', 'Agent', 'Admin', 'Finance', 'Inventory', 'Housekeeping'));

-- Insert new roles (ignore if already exist)
INSERT IGNORE INTO role (role_name, description) VALUES
  ('Finance', 'Access to Finance section of Sales Report'),
  ('Inventory', 'Access to Inventory section of Sales Report'),
  ('Housekeeping', 'Access to Housekeeping section of Sales Report');
