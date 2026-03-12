-- Migration: Add unit_agent junction table for many-to-many unit-agent assignments
-- Owners can assign multiple agents to a unit. Agents see assigned units on their profile.
-- Run: mysql -u root your_database < migrations/009_add_unit_agent.sql

CREATE TABLE IF NOT EXISTS unit_agent (
  unit_id BIGINT NOT NULL,
  agent_user_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (unit_id, agent_user_id),
  CONSTRAINT fk_unit_agent_unit
    FOREIGN KEY (unit_id) REFERENCES unit(unit_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_unit_agent_agent
    FOREIGN KEY (agent_user_id) REFERENCES `user`(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_unit_agent_agent_user_id ON unit_agent(agent_user_id);
