-- Migration: Add social links to user_profile (Facebook, Instagram, etc.)
-- Run: mysql -u root your_database < migrations/008_add_social_links.sql

ALTER TABLE user_profile
  ADD COLUMN facebook_url VARCHAR(500) NULL AFTER contact_info,
  ADD COLUMN instagram_url VARCHAR(500) NULL AFTER facebook_url,
  ADD COLUMN twitter_url VARCHAR(500) NULL AFTER instagram_url,
  ADD COLUMN linkedin_url VARCHAR(500) NULL AFTER twitter_url,
  ADD COLUMN whatsapp_url VARCHAR(500) NULL AFTER linkedin_url;
