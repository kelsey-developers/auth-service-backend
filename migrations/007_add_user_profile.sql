-- Migration: Add user_profile table for username, about_me, contact
-- Run: mysql -u root your_database < migrations/007_add_user_profile.sql

CREATE TABLE IF NOT EXISTS user_profile (
    user_profile_id   BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT NOT NULL UNIQUE,
    username          VARCHAR(50) NOT NULL UNIQUE,
    about_me          TEXT,
    contact_info      VARCHAR(255),
    profile_photo_url VARCHAR(500),
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_profile_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX idx_user_profile_username ON user_profile(username);
CREATE INDEX idx_user_profile_user_id ON user_profile(user_id);
