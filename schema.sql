-- =========================
-- OPTIONAL: CLEAN DROP ORDER
-- =========================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS reward_redemption;
DROP TABLE IF EXISTS reward;
DROP TABLE IF EXISTS point_transaction;
DROP TABLE IF EXISTS point_wallet;
DROP TABLE IF EXISTS agent_relationship;
DROP TABLE IF EXISTS payment_status_history;
DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS booking_status_history;
DROP TABLE IF EXISTS guest_booking_info;
DROP TABLE IF EXISTS booking;
DROP TABLE IF EXISTS unit_image;
DROP TABLE IF EXISTS unit;
DROP TABLE IF EXISTS user_role;
DROP TABLE IF EXISTS role;
DROP TABLE IF EXISTS app_user;
SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- USERS
-- =========================
CREATE TABLE app_user (
    user_id              BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name           VARCHAR(100) NOT NULL,
    middle_name          VARCHAR(100),
    last_name            VARCHAR(100) NOT NULL,
    email                VARCHAR(255) NOT NULL UNIQUE,
    phone                VARCHAR(50),
    address              TEXT,
    password_hash        TEXT NOT NULL,
    status               VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_app_user_status
        CHECK (status IN ('active', 'inactive', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- ROLES
-- =========================
CREATE TABLE role (
    role_id              BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    role_name            VARCHAR(30) NOT NULL UNIQUE,
    description          TEXT,
    status               VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_role_name
        CHECK (role_name IN ('Guest', 'Agent', 'Admin')),
    CONSTRAINT chk_role_status
        CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_role (
    user_role_id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id              BIGINT NOT NULL,
    role_id              BIGINT NOT NULL,
    assigned_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status               VARCHAR(30) NOT NULL DEFAULT 'active',

    CONSTRAINT fk_user_role_user
        FOREIGN KEY (user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_user_role_role
        FOREIGN KEY (role_id) REFERENCES role(role_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT uq_user_role_user_role
        UNIQUE (user_id, role_id),

    CONSTRAINT chk_user_role_status
        CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- UNIT / INVENTORY
-- =========================
CREATE TABLE unit (
    unit_id               BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    unit_name             VARCHAR(150) NOT NULL,
    location              TEXT,
    city                  VARCHAR(100),
    country               VARCHAR(100),
    bedroom_count         INT NOT NULL DEFAULT 0,
    bathroom_count        INT NOT NULL DEFAULT 0,
    area_sqm              DECIMAL(10,2),
    unit_type             VARCHAR(50) NOT NULL DEFAULT 'apartment',
    description           TEXT,
    amenities             JSON,
    min_pax               INT NOT NULL,
    max_capacity          INT NOT NULL,
    base_price            DECIMAL(12,2) NOT NULL,
    excess_pax_fee        DECIMAL(12,2) NOT NULL DEFAULT 0,
    status                VARCHAR(30) NOT NULL DEFAULT 'available',
    is_featured           TINYINT(1) NOT NULL DEFAULT 0,
    check_in_time         VARCHAR(10),
    check_out_time        VARCHAR(10),
    latitude              DECIMAL(10,7),
    longitude             DECIMAL(10,7),
    owner_user_id         BIGINT,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_unit_owner
        FOREIGN KEY (owner_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT chk_unit_min_pax
        CHECK (min_pax >= 1),
    CONSTRAINT chk_unit_max_capacity
        CHECK (max_capacity >= min_pax),
    CONSTRAINT chk_unit_base_price
        CHECK (base_price >= 0),
    CONSTRAINT chk_unit_excess_pax_fee
        CHECK (excess_pax_fee >= 0),
    CONSTRAINT chk_unit_status
        CHECK (status IN ('available', 'unavailable', 'maintenance'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE unit_image (
    image_id              BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    unit_id               BIGINT NOT NULL,
    image_url             VARCHAR(500) NOT NULL,
    is_main               TINYINT(1) NOT NULL DEFAULT 0,
    sort_order            INT NOT NULL DEFAULT 0,

    CONSTRAINT fk_unit_image_unit
        FOREIGN KEY (unit_id) REFERENCES unit(unit_id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- GUEST INFORMATION (for bookings without app_user)
-- =========================
CREATE TABLE guest_booking_info (
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
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_guest_booking_info_gender
        CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- BOOKING MANAGEMENT
-- =========================
CREATE TABLE booking (
    booking_id             BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    guest_user_id          BIGINT,
    guest_booking_info_id  BIGINT,
    unit_id                BIGINT NOT NULL,
    agent_user_id          BIGINT,
    checkin_date           DATE NOT NULL,
    checkout_date          DATE NOT NULL,
    pax                    INT NOT NULL,
    booking_status         VARCHAR(30) NOT NULL DEFAULT 'penciled',
    penciled_at            TIMESTAMP NULL,
    confirmed_at           TIMESTAMP NULL,
    confirmed_by_user_id   BIGINT,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_guest
        FOREIGN KEY (guest_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_booking_guest_info
        FOREIGN KEY (guest_booking_info_id) REFERENCES guest_booking_info(guest_booking_info_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_booking_unit
        FOREIGN KEY (unit_id) REFERENCES unit(unit_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_booking_agent
        FOREIGN KEY (agent_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT fk_booking_confirmed_by
        FOREIGN KEY (confirmed_by_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT chk_booking_dates
        CHECK (checkout_date > checkin_date),
    CONSTRAINT chk_booking_pax
        CHECK (pax > 0),
    CONSTRAINT chk_booking_status
        CHECK (booking_status IN ('penciled', 'confirmed', 'cancelled', 'completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_status_history (
    booking_status_history_id  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id                 BIGINT NOT NULL,
    from_status                VARCHAR(30),
    to_status                  VARCHAR(30) NOT NULL,
    changed_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by_user_id         BIGINT NOT NULL,
    remarks                    TEXT,

    CONSTRAINT fk_booking_status_history_booking
        FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_booking_status_history_changed_by
        FOREIGN KEY (changed_by_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_booking_status_history_from
        CHECK (from_status IS NULL OR from_status IN ('penciled', 'confirmed', 'cancelled', 'completed')),
    CONSTRAINT chk_booking_status_history_to
        CHECK (to_status IN ('penciled', 'confirmed', 'cancelled', 'completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- PAYMENT MANAGEMENT
-- =========================
CREATE TABLE payment (
    payment_id              BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    booking_id              BIGINT NOT NULL UNIQUE,
    deposit_amount          DECIMAL(12,2) NOT NULL,
    method                  VARCHAR(30) NOT NULL,
    proof_url               TEXT,
    payment_status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    paid_at                 TIMESTAMP NULL,
    verified_at             TIMESTAMP NULL,
    verified_by_user_id     BIGINT,

    CONSTRAINT fk_payment_booking
        FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_payment_verified_by
        FOREIGN KEY (verified_by_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT chk_payment_amount
        CHECK (deposit_amount >= 0),
    CONSTRAINT chk_payment_method
        CHECK (method IN ('cash', 'bank_transfer', 'gcash', 'card', 'other')),
    CONSTRAINT chk_payment_status
        CHECK (payment_status IN ('pending', 'submitted', 'verified', 'rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_status_history (
    payment_status_history_id  BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    payment_id                 BIGINT NOT NULL,
    from_status                VARCHAR(30),
    to_status                  VARCHAR(30) NOT NULL,
    changed_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by_user_id         BIGINT NOT NULL,
    remarks                    TEXT,

    CONSTRAINT fk_payment_status_history_payment
        FOREIGN KEY (payment_id) REFERENCES payment(payment_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_payment_status_history_changed_by
        FOREIGN KEY (changed_by_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_payment_status_history_from
        CHECK (from_status IS NULL OR from_status IN ('pending', 'submitted', 'verified', 'rejected')),
    CONSTRAINT chk_payment_status_history_to
        CHECK (to_status IN ('pending', 'submitted', 'verified', 'rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- AGENT RELATIONSHIP
-- =========================
CREATE TABLE agent_relationship (
    relationship_id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    parent_agent_user_id    BIGINT NOT NULL,
    child_agent_user_id     BIGINT NOT NULL,
    level                   INT NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_agent_relationship_parent
        FOREIGN KEY (parent_agent_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT fk_agent_relationship_child
        FOREIGN KEY (child_agent_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT uq_agent_relationship_pair
        UNIQUE (parent_agent_user_id, child_agent_user_id),

    CONSTRAINT chk_agent_relationship_level
        CHECK (level >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- POINT SYSTEM
-- =========================
CREATE TABLE point_wallet (
    wallet_id               BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    agent_user_id           BIGINT NOT NULL UNIQUE,
    current_points          INT NOT NULL DEFAULT 0,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_point_wallet_agent
        FOREIGN KEY (agent_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT chk_point_wallet_current_points
        CHECK (current_points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE point_transaction (
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

CREATE TABLE reward (
    reward_id               BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reward_name             VARCHAR(150) NOT NULL,
    reward_type             VARCHAR(50) NOT NULL,
    point_cost              INT NOT NULL,
    stock_qty               INT NOT NULL DEFAULT 0,
    status                  VARCHAR(30) NOT NULL DEFAULT 'active',

    CONSTRAINT chk_reward_point_cost
        CHECK (point_cost > 0),
    CONSTRAINT chk_reward_stock_qty
        CHECK (stock_qty >= 0),
    CONSTRAINT chk_reward_status
        CHECK (status IN ('active', 'inactive', 'out_of_stock'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reward_redemption (
    redemption_id           BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reward_id               BIGINT NOT NULL,
    agent_user_id           BIGINT NOT NULL,
    wallet_id               BIGINT NOT NULL,
    points_used             INT NOT NULL,
    redemption_status       VARCHAR(30) NOT NULL DEFAULT 'requested',
    requested_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at             TIMESTAMP NULL,
    approved_by_user_id     BIGINT,
    issued_at               TIMESTAMP NULL,

    CONSTRAINT fk_reward_redemption_reward
        FOREIGN KEY (reward_id) REFERENCES reward(reward_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_reward_redemption_agent
        FOREIGN KEY (agent_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_reward_redemption_wallet
        FOREIGN KEY (wallet_id) REFERENCES point_wallet(wallet_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_reward_redemption_approved_by
        FOREIGN KEY (approved_by_user_id) REFERENCES app_user(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT chk_reward_redemption_points_used
        CHECK (points_used > 0),
    CONSTRAINT chk_reward_redemption_status
        CHECK (redemption_status IN ('requested', 'approved', 'rejected', 'issued', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_user_role_user_id ON user_role(user_id);
CREATE INDEX idx_user_role_role_id ON user_role(role_id);

CREATE INDEX idx_unit_status ON unit(status);
CREATE INDEX idx_unit_is_featured ON unit(is_featured);
CREATE INDEX idx_unit_unit_type ON unit(unit_type);
CREATE INDEX idx_unit_city ON unit(city);

CREATE INDEX idx_unit_image_unit_id ON unit_image(unit_id);
CREATE INDEX idx_unit_image_is_main ON unit_image(unit_id, is_main);

CREATE INDEX idx_booking_guest_user_id ON booking(guest_user_id);
CREATE INDEX idx_booking_guest_booking_info_id ON booking(guest_booking_info_id);
CREATE INDEX idx_booking_agent_user_id ON booking(agent_user_id);
CREATE INDEX idx_booking_unit_id ON booking(unit_id);
CREATE INDEX idx_booking_status ON booking(booking_status);
CREATE INDEX idx_booking_dates ON booking(checkin_date, checkout_date);

CREATE INDEX idx_booking_status_history_booking_id ON booking_status_history(booking_id);
CREATE INDEX idx_booking_status_history_changed_by ON booking_status_history(changed_by_user_id);

CREATE INDEX idx_payment_status ON payment(payment_status);
CREATE INDEX idx_payment_verified_by ON payment(verified_by_user_id);

CREATE INDEX idx_payment_status_history_payment_id ON payment_status_history(payment_id);
CREATE INDEX idx_payment_status_history_changed_by ON payment_status_history(changed_by_user_id);

CREATE INDEX idx_agent_relationship_parent ON agent_relationship(parent_agent_user_id);
CREATE INDEX idx_agent_relationship_child ON agent_relationship(child_agent_user_id);

CREATE INDEX idx_point_transaction_wallet_id ON point_transaction(wallet_id);
CREATE INDEX idx_point_transaction_booking_id ON point_transaction(booking_id);
CREATE INDEX idx_point_transaction_status ON point_transaction(txn_status);

CREATE INDEX idx_reward_status ON reward(status);

CREATE INDEX idx_reward_redemption_agent_user_id ON reward_redemption(agent_user_id);
CREATE INDEX idx_reward_redemption_wallet_id ON reward_redemption(wallet_id);
CREATE INDEX idx_reward_redemption_reward_id ON reward_redemption(reward_id);
CREATE INDEX idx_reward_redemption_status ON reward_redemption(redemption_status);

-- =========================
-- SEED DATA (development)
-- =========================
INSERT INTO role (role_name, description) VALUES
  ('Guest', 'Guest user'),
  ('Agent', 'Booking agent'),
  ('Admin', 'Administrator');

INSERT INTO unit (unit_name, location, city, country, bedroom_count, bathroom_count, area_sqm, unit_type, description, amenities, min_pax, max_capacity, base_price, excess_pax_fee, status, is_featured, check_in_time, check_out_time) VALUES
  ('Luxury Beachfront Villa', 'Boracay, Aklan', 'Boracay', 'Philippines', 4, 3, 232, 'villa', 'Experience paradise in this stunning beachfront villa with panoramic ocean views, private pool, and direct beach access.', '["Beach Access","Private Pool","WiFi","Air Conditioning","Full Kitchen"]', 2, 10, 8500, 500, 'available', 1, '14:00', '11:00'),
  ('Modern City Condo', 'Makati, Metro Manila', 'Makati', 'Philippines', 2, 2, 111, 'condo', 'Contemporary 2-bedroom condo in the heart of Manila. Walking distance to shopping malls and restaurants.', '["WiFi","Gym Access","Pool","Parking","Security"]', 1, 4, 3500, 200, 'available', 1, '14:00', '11:00'),
  ('Cozy Mountain Retreat', 'Tagaytay, Cavite', 'Tagaytay', 'Philippines', 3, 2, 167, 'house', 'Escape to this charming mountain cabin surrounded by nature. Features fireplace and mountain views.', '["Fireplace","Mountain View","Garden","BBQ Area","Parking"]', 2, 6, 4200, 300, 'available', 1, '15:00', '10:00'),
  ('Apartment in Davao', 'Medina, Apilaya Davao City', 'Davao City', 'Philippines', 2, 1, 74, 'apartment', 'A beautiful apartment complex in the heart of Davao City with modern amenities.', '["WiFi","Air Conditioning","Kitchen","Parking","TV","Washing Machine"]', 1, 4, 4320, 250, 'available', 1, '14:00', '11:00');

INSERT INTO unit_image (unit_id, image_url, is_main, sort_order) VALUES
  (1, '/heroimage.png', 1, 0),
  (1, '/heroimage.png', 0, 1),
  (1, '/heroimage.png', 0, 2),
  (2, '/heroimage.png', 1, 0),
  (2, '/heroimage.png', 0, 1),
  (3, '/heroimage.png', 1, 0),
  (4, '/heroimage.png', 1, 0),
  (4, '/heroimage.png', 0, 1),
  (4, '/heroimage.png', 0, 2);
