-- Migration: Add balance and balance_history tables for agent commission tracking
-- Run: mysql -u root your_database < migrations/005_add_balance_and_balance_history.sql
-- For fresh installs, schema.sql already includes these tables.

-- 1. Create balance table (one row per agent, current_amount only)
CREATE TABLE IF NOT EXISTS balance (
    balance_id             BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    agent_user_id           BIGINT NOT NULL UNIQUE,
    current_amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_balance_agent
        FOREIGN KEY (agent_user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT chk_balance_current
        CHECK (current_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create balance_history table (add/remove ledger entries)
CREATE TABLE IF NOT EXISTS balance_history (
    balance_history_id      BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    agent_user_id           BIGINT NOT NULL,
    type                    VARCHAR(20) NOT NULL,
    amount                  DECIMAL(12,2) NOT NULL,
    reference_type          VARCHAR(50),
    reference_id            VARCHAR(100),
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_balance_history_agent
        FOREIGN KEY (agent_user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT chk_balance_history_type
        CHECK (type IN ('add', 'remove')),
    CONSTRAINT chk_balance_history_amount
        CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
