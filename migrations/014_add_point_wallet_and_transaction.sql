-- Migration: Restore point_wallet and point_transaction (used by points-system-backend /api/rewards)
-- Run: mysql -u root your_database < migrations/014_add_point_wallet_and_transaction.sql

CREATE TABLE IF NOT EXISTS point_wallet (
    wallet_id               BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    agent_user_id           BIGINT NOT NULL UNIQUE,
    current_points          INT NOT NULL DEFAULT 0,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_point_wallet_user
        FOREIGN KEY (agent_user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT chk_point_wallet_current_points
        CHECK (current_points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS point_transaction (
    point_txn_id            BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    wallet_id               BIGINT NOT NULL,
    booking_id              BIGINT,
    points                  INT NOT NULL,
    txn_type                VARCHAR(30) NOT NULL,
    txn_status              VARCHAR(30) NOT NULL DEFAULT 'posted',
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_point_transaction_wallet
        FOREIGN KEY (wallet_id) REFERENCES point_wallet(wallet_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_point_transaction_booking
        FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT chk_point_transaction_type
        CHECK (txn_type IN ('earn', 'redeem', 'adjustment', 'reversal')),
    CONSTRAINT chk_point_transaction_status
        CHECK (txn_status IN ('pending', 'posted', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_point_transaction_wallet_id ON point_transaction(wallet_id);
CREATE INDEX idx_point_transaction_booking_id ON point_transaction(booking_id);
CREATE INDEX idx_point_transaction_status ON point_transaction(txn_status);
