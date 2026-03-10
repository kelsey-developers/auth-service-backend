-- Migration: Add owner_user_id (listed by) to unit table
-- Run this if you have an existing unit table and need to upgrade.
-- Usage: mysql -u root your_database < migrations/002_add_owner_to_unit.sql
-- If column already exists, this will fail - that's OK, migration was already applied.

-- Add owner_user_id column (who listed/owns the unit)
ALTER TABLE unit ADD COLUMN owner_user_id BIGINT NULL AFTER longitude;

-- Add foreign key
ALTER TABLE unit ADD CONSTRAINT fk_unit_owner
    FOREIGN KEY (owner_user_id) REFERENCES `user`(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- Optional: Assign all units to first Agent user (uncomment and run if needed)
-- UPDATE unit u SET owner_user_id = (SELECT ur.user_id FROM user_role ur JOIN role r ON r.role_id = ur.role_id WHERE r.role_name = 'Agent' LIMIT 1) WHERE u.owner_user_id IS NULL;
