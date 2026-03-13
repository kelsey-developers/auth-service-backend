-- Migration: Add payout_withdrawal table for agent commission withdrawal requests
-- Run: mysql -u root your_database < migrations/010_add_payout_withdrawal.sql

CREATE TABLE IF NOT EXISTS payout_withdrawal (
    payout_id             BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    agent_user_id         BIGINT NOT NULL,
    amount                DECIMAL(12,2) NOT NULL,
    method                VARCHAR(30) NOT NULL,
    recipient_number      VARCHAR(50),
    recipient_name        VARCHAR(255),
    bank_name             VARCHAR(100),
    account_number        VARCHAR(50),
    status                VARCHAR(20) NOT NULL DEFAULT 'pending',
    proof_of_payment_url  TEXT,
    notes                 TEXT,
    requested_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at          TIMESTAMP NULL,
    processed_by_user_id  BIGINT,

    CONSTRAINT fk_payout_agent
        FOREIGN KEY (agent_user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_payout_processed_by
        FOREIGN KEY (processed_by_user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT chk_payout_amount
        CHECK (amount > 0),
    CONSTRAINT chk_payout_method
        CHECK (method IN ('gcash', 'maya', 'bank_transfer')),
    CONSTRAINT chk_payout_status
        CHECK (status IN ('pending', 'paid', 'declined'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_payout_agent_user_id ON payout_withdrawal(agent_user_id);
CREATE INDEX idx_payout_status ON payout_withdrawal(status);
CREATE INDEX idx_payout_requested_at ON payout_withdrawal(requested_at);
