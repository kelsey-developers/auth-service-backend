-- Migration: Add guest_booking_info table and make guest_user_id nullable
-- Run this if you have an existing booking table and need to upgrade.
-- For fresh installs, use schema.sql which already includes these changes.
--
-- If guest_booking_info_id column already exists, skip step 2 and 4.
-- If guest_user_id is already nullable, skip step 3.

-- 1. Create guest_booking_info table
CREATE TABLE IF NOT EXISTS guest_booking_info (
    guest_booking_info_id  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name             VARCHAR(100) NOT NULL,
    last_name              VARCHAR(100) NOT NULL,
    email                  VARCHAR(255) NOT NULL,
    middle_name            VARCHAR(100),
    nickname               VARCHAR(100),
    contact_number         VARCHAR(50),
    gender                 VARCHAR(20),
    birth_date             DATE,
    preferred_contact      VARCHAR(30),
    referred_by            VARCHAR(255),
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add guest_booking_info_id to booking (skip if column exists)
ALTER TABLE booking ADD COLUMN guest_booking_info_id BIGINT NULL AFTER guest_user_id;

-- 3. Make guest_user_id nullable
ALTER TABLE booking DROP FOREIGN KEY fk_booking_guest;
ALTER TABLE booking MODIFY COLUMN guest_user_id BIGINT NULL;
ALTER TABLE booking ADD CONSTRAINT fk_booking_guest
    FOREIGN KEY (guest_user_id) REFERENCES app_user(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- 4. Add FK for guest_booking_info (skip if constraint exists)
ALTER TABLE booking ADD CONSTRAINT fk_booking_guest_info
    FOREIGN KEY (guest_booking_info_id) REFERENCES guest_booking_info(guest_booking_info_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
