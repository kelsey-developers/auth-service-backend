-- Migration: Add 'declined' status to payout_withdrawal
-- Run: mysql -u root your_database < migrations/011_add_payout_declined_status.sql

ALTER TABLE payout_withdrawal DROP CHECK chk_payout_status;
ALTER TABLE payout_withdrawal ADD CONSTRAINT chk_payout_status
  CHECK (status IN ('pending', 'paid', 'declined'));
