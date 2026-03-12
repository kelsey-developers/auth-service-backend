-- Migration: Add agent_registration table for become-an-agent applications
-- Run: mysql -u root your_database < migrations/006_add_agent_registration.sql

CREATE TABLE IF NOT EXISTS agent_registration (
    agent_registration_id   BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id                 BIGINT NOT NULL UNIQUE,
    payment_proof_url       TEXT,
    referred_by_user_id     BIGINT,
    status                  VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_agent_registration_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_agent_registration_referred_by
        FOREIGN KEY (referred_by_user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT chk_agent_registration_status
        CHECK (status IN ('pending', 'approved', 'rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_agent_registration_user_id ON agent_registration(user_id);
CREATE INDEX idx_agent_registration_status ON agent_registration(status);
CREATE INDEX idx_agent_registration_referred_by ON agent_registration(referred_by_user_id);
