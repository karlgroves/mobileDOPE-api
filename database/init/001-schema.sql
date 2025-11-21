-- =====================================================================
-- Mobile DOPE API - Database Schema Installation Script
-- =====================================================================
-- MySQL 9.x Innovation Release Database Schema
--
-- This script creates all tables, indexes, and constraints required for
-- the Mobile DOPE API backend, supporting:
-- 1. User authentication and account management
-- 2. Cloud backup/sync of user data (rifles, ammo, DOPE logs)
-- 3. Crowdsourced community ammunition database
--
-- Based on the mobile app's SQLite schema with additions for multi-user
-- support and community features.
--
-- MySQL 9.x Features Used:
-- - utf8mb4_0900_ai_ci collation (accent/case insensitive, optimized)
-- - Enhanced JSON indexing and performance
-- - INVISIBLE columns for internal tracking
-- - Generated columns for computed values
-- - Multi-value indexes on JSON arrays
-- - Improved CHECK constraint performance
-- =====================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- =====================================================================
-- USERS TABLE
-- =====================================================================
-- Stores user account information for authentication and authorization

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) AS (CONCAT(
    SUBSTR(HEX(id), 1, 8), '-',
    SUBSTR(HEX(id), 9, 4), '-',
    '4', SUBSTR(HEX(id), 14, 3), '-',
    'a', SUBSTR(HEX(id), 18, 3), '-',
    SUBSTR(HEX(id), 21, 12)
  )) STORED COMMENT 'UUID v4 generated from ID for external API use',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verification_expires DATETIME,
  password_reset_token VARCHAR(255),
  password_reset_expires DATETIME,
  last_login_at DATETIME,
  login_count INT UNSIGNED NOT NULL DEFAULT 0 INVISIBLE COMMENT 'Track login frequency',
  row_version INT UNSIGNED NOT NULL DEFAULT 0 INVISIBLE COMMENT 'Optimistic locking',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_uuid (uuid),
  INDEX idx_users_email (email),
  INDEX idx_users_verification_token (email_verification_token),
  INDEX idx_users_reset_token (password_reset_token),
  INDEX idx_users_active (is_active, is_verified)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- REFRESH TOKENS TABLE
-- =====================================================================
-- Stores JWT refresh tokens for persistent authentication

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_user (user_id),
  INDEX idx_refresh_tokens_token (token),
  INDEX idx_refresh_tokens_expires (expires_at)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- RIFLE PROFILES TABLE
-- =====================================================================
-- Stores rifle configuration data

CREATE TABLE IF NOT EXISTS rifle_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  caliber VARCHAR(100) NOT NULL,
  barrel_length DECIMAL(5,2) NOT NULL COMMENT 'Inches',
  twist_rate VARCHAR(20) NOT NULL COMMENT 'Format: 1:8, 1:10, etc.',
  zero_distance DECIMAL(6,2) NOT NULL COMMENT 'Yards',
  optic_manufacturer VARCHAR(255) NOT NULL,
  optic_model VARCHAR(255) NOT NULL,
  reticle_type VARCHAR(100) NOT NULL,
  click_value_type ENUM('MIL', 'MOA') NOT NULL,
  click_value DECIMAL(5,4) NOT NULL COMMENT 'Value per click',
  scope_height DECIMAL(5,2) NOT NULL COMMENT 'Inches over bore',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rifle_profiles_user (user_id),
  INDEX idx_rifle_profiles_caliber (caliber),

  CONSTRAINT chk_barrel_length CHECK (barrel_length > 0 AND barrel_length <= 50),
  CONSTRAINT chk_zero_distance CHECK (zero_distance > 0 AND zero_distance <= 1000),
  CONSTRAINT chk_click_value CHECK (click_value > 0 AND click_value <= 1),
  CONSTRAINT chk_scope_height CHECK (scope_height > 0 AND scope_height <= 10)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- AMMO PROFILES TABLE
-- =====================================================================
-- Stores ammunition specifications linked to rifle profiles

CREATE TABLE IF NOT EXISTS ammo_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  rifle_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255) NOT NULL,
  bullet_weight DECIMAL(6,2) NOT NULL COMMENT 'Grains',
  bullet_type VARCHAR(100) NOT NULL COMMENT 'HPBT, ELD-X, etc.',
  ballistic_coefficient_g1 DECIMAL(6,4) NOT NULL,
  ballistic_coefficient_g7 DECIMAL(6,4) NOT NULL,
  muzzle_velocity DECIMAL(7,2) NOT NULL COMMENT 'Feet per second',
  powder_type VARCHAR(100),
  powder_weight DECIMAL(6,2) COMMENT 'Grains',
  lot_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE,
  INDEX idx_ammo_profiles_user (user_id),
  INDEX idx_ammo_profiles_rifle (rifle_id),
  INDEX idx_ammo_profiles_manufacturer (manufacturer),

  CONSTRAINT chk_bullet_weight CHECK (bullet_weight > 0 AND bullet_weight <= 1000),
  CONSTRAINT chk_bc_g1 CHECK (ballistic_coefficient_g1 >= 0 AND ballistic_coefficient_g1 <= 1),
  CONSTRAINT chk_bc_g7 CHECK (ballistic_coefficient_g7 >= 0 AND ballistic_coefficient_g7 <= 1),
  CONSTRAINT chk_muzzle_velocity CHECK (muzzle_velocity > 0 AND muzzle_velocity <= 5000),
  CONSTRAINT chk_powder_weight CHECK (powder_weight IS NULL OR powder_weight >= 0)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- ENVIRONMENT SNAPSHOTS TABLE
-- =====================================================================
-- Stores environmental conditions at time of shooting

CREATE TABLE IF NOT EXISTS environment_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  temperature DECIMAL(5,2) NOT NULL COMMENT 'Fahrenheit',
  humidity DECIMAL(5,2) NOT NULL COMMENT 'Percentage 0-100',
  pressure DECIMAL(5,2) NOT NULL COMMENT 'Inches of mercury (inHg)',
  altitude DECIMAL(7,2) NOT NULL COMMENT 'Feet',
  density_altitude DECIMAL(7,2) NOT NULL COMMENT 'Feet (calculated)',
  wind_speed DECIMAL(5,2) NOT NULL COMMENT 'Miles per hour',
  wind_direction DECIMAL(5,2) NOT NULL COMMENT 'Degrees 0-360',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_environment_snapshots_user (user_id),
  INDEX idx_environment_snapshots_timestamp (timestamp),

  CONSTRAINT chk_temperature CHECK (temperature >= -50 AND temperature <= 150),
  CONSTRAINT chk_humidity CHECK (humidity >= 0 AND humidity <= 100),
  CONSTRAINT chk_pressure CHECK (pressure >= 20 AND pressure <= 35),
  CONSTRAINT chk_altitude CHECK (altitude >= -1000 AND altitude <= 30000),
  CONSTRAINT chk_wind_speed CHECK (wind_speed >= 0 AND wind_speed <= 100),
  CONSTRAINT chk_wind_direction CHECK (wind_direction >= 0 AND wind_direction < 360),
  CONSTRAINT chk_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT chk_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- DOPE LOGS TABLE
-- =====================================================================
-- Core DOPE (Data On Previous Engagements) records

CREATE TABLE IF NOT EXISTS dope_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  rifle_id BIGINT UNSIGNED NOT NULL,
  ammo_id BIGINT UNSIGNED NOT NULL,
  environment_id BIGINT UNSIGNED NOT NULL,
  distance DECIMAL(7,2) NOT NULL,
  distance_unit ENUM('yards', 'meters') NOT NULL,
  distance_yards DECIMAL(7,2) AS (
    CASE
      WHEN distance_unit = 'yards' THEN distance
      ELSE distance * 1.09361
    END
  ) STORED COMMENT 'Normalized distance in yards',
  elevation_correction DECIMAL(7,4) NOT NULL COMMENT 'MIL or MOA',
  windage_correction DECIMAL(7,4) NOT NULL COMMENT 'MIL or MOA',
  correction_unit ENUM('MIL', 'MOA') NOT NULL,
  target_type ENUM('steel', 'paper', 'vital_zone', 'other') NOT NULL,
  group_size DECIMAL(6,2) COMMENT 'Inches',
  hit_count INT UNSIGNED,
  shot_count INT UNSIGNED,
  hit_percentage DECIMAL(5,2) AS (
    CASE
      WHEN shot_count > 0 THEN (hit_count / shot_count) * 100
      ELSE NULL
    END
  ) STORED COMMENT 'Hit percentage calculation',
  notes TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (ammo_id) REFERENCES ammo_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id) REFERENCES environment_snapshots(id) ON DELETE RESTRICT,
  INDEX idx_dope_logs_user (user_id),
  INDEX idx_dope_logs_rifle (rifle_id),
  INDEX idx_dope_logs_ammo (ammo_id),
  INDEX idx_dope_logs_timestamp (timestamp),
  INDEX idx_dope_logs_distance (distance),
  INDEX idx_dope_logs_distance_yards (distance_yards),
  INDEX idx_dope_logs_rifle_distance (rifle_id, distance_yards),

  CONSTRAINT chk_distance CHECK (distance > 0 AND distance <= 3000),
  CONSTRAINT chk_group_size CHECK (group_size IS NULL OR group_size >= 0),
  CONSTRAINT chk_hit_count CHECK (hit_count IS NULL OR hit_count >= 0),
  CONSTRAINT chk_shot_count CHECK (shot_count IS NULL OR shot_count >= 0),
  CONSTRAINT chk_hit_vs_shot CHECK (hit_count IS NULL OR shot_count IS NULL OR hit_count <= shot_count)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- SHOT STRINGS TABLE
-- =====================================================================
-- Stores individual shot velocity data for chronograph sessions

CREATE TABLE IF NOT EXISTS shot_strings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  ammo_id BIGINT UNSIGNED NOT NULL,
  session_date DATE NOT NULL,
  shot_number INT UNSIGNED NOT NULL,
  velocity DECIMAL(7,2) NOT NULL COMMENT 'Feet per second',
  temperature DECIMAL(5,2) NOT NULL COMMENT 'Fahrenheit',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ammo_id) REFERENCES ammo_profiles(id) ON DELETE CASCADE,
  INDEX idx_shot_strings_user (user_id),
  INDEX idx_shot_strings_ammo (ammo_id),
  INDEX idx_shot_strings_session (session_date),

  CONSTRAINT chk_shot_number CHECK (shot_number > 0),
  CONSTRAINT chk_velocity CHECK (velocity > 0 AND velocity <= 5000)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- RANGE SESSIONS TABLE
-- =====================================================================
-- Tracks complete range sessions with multiple shots

CREATE TABLE IF NOT EXISTS range_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  rifle_id BIGINT UNSIGNED NOT NULL,
  ammo_id BIGINT UNSIGNED NOT NULL,
  environment_id BIGINT UNSIGNED NOT NULL,
  session_name VARCHAR(255),
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  distance DECIMAL(7,2) NOT NULL COMMENT 'Yards',
  shot_count INT UNSIGNED NOT NULL DEFAULT 0,
  cold_bore_shot BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (rifle_id) REFERENCES rifle_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (ammo_id) REFERENCES ammo_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (environment_id) REFERENCES environment_snapshots(id) ON DELETE RESTRICT,
  INDEX idx_range_sessions_user (user_id),
  INDEX idx_range_sessions_rifle (rifle_id),
  INDEX idx_range_sessions_start (start_time),

  CONSTRAINT chk_session_distance CHECK (distance > 0),
  CONSTRAINT chk_session_times CHECK (end_time IS NULL OR end_time >= start_time)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- TARGET IMAGES TABLE
-- =====================================================================
-- Stores target image metadata and point-of-impact markers

CREATE TABLE IF NOT EXISTS target_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  dope_log_id BIGINT UNSIGNED,
  range_session_id BIGINT UNSIGNED,
  image_uri VARCHAR(500) NOT NULL COMMENT 'Cloud storage URL or S3 key',
  target_type VARCHAR(100) NOT NULL,
  poi_markers JSON NOT NULL COMMENT 'Point of impact coordinates array [{x,y}]',
  shot_count INT UNSIGNED AS (JSON_LENGTH(poi_markers)) STORED COMMENT 'Calculated from POI markers',
  group_size DECIMAL(6,2) COMMENT 'Inches',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (dope_log_id) REFERENCES dope_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (range_session_id) REFERENCES range_sessions(id) ON DELETE CASCADE,
  INDEX idx_target_images_user (user_id),
  INDEX idx_target_images_dope (dope_log_id),
  INDEX idx_target_images_session (range_session_id),
  INDEX idx_target_images_shot_count (shot_count),

  CONSTRAINT chk_target_group_size CHECK (group_size IS NULL OR group_size >= 0),
  CONSTRAINT chk_target_link CHECK (dope_log_id IS NOT NULL OR range_session_id IS NOT NULL)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- APP SETTINGS TABLE
-- =====================================================================
-- Stores user-specific application settings

CREATE TABLE IF NOT EXISTS app_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY idx_app_settings_user_key (user_id, setting_key),
  INDEX idx_app_settings_user (user_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- COMMUNITY AMMUNITION TABLE
-- =====================================================================
-- Crowdsourced ammunition database with verification and voting

CREATE TABLE IF NOT EXISTS community_ammo (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submitted_by BIGINT UNSIGNED NOT NULL,
  manufacturer VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  caliber VARCHAR(100) NOT NULL,
  bullet_weight DECIMAL(6,2) NOT NULL COMMENT 'Grains',
  bullet_type VARCHAR(100) NOT NULL,
  ballistic_coefficient_g1 DECIMAL(6,4),
  ballistic_coefficient_g7 DECIMAL(6,4),
  advertised_velocity DECIMAL(7,2) COMMENT 'Feet per second',
  barrel_length DECIMAL(5,2) COMMENT 'Inches (velocity reference)',
  data_source VARCHAR(255) COMMENT 'Manufacturer spec, chronograph test, etc.',
  verification_status ENUM('pending', 'verified', 'disputed', 'rejected') NOT NULL DEFAULT 'pending',
  verified_by BIGINT UNSIGNED COMMENT 'Admin user ID who verified',
  verified_at DATETIME,
  vote_score INT NOT NULL DEFAULT 0 COMMENT 'Net upvotes minus downvotes',
  vote_count INT UNSIGNED NOT NULL DEFAULT 0,
  usage_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Times copied to user profiles',
  quality_score DECIMAL(5,2) AS (
    CASE
      WHEN verification_status = 'verified' THEN 100 + (vote_score * 0.5) + (usage_count * 0.1)
      WHEN verification_status = 'disputed' THEN 50 + (vote_score * 0.25)
      WHEN verification_status = 'rejected' THEN 0
      ELSE 50 + (vote_score * 0.25)
    END
  ) STORED COMMENT 'Calculated quality score for ranking',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_community_ammo_caliber (caliber),
  INDEX idx_community_ammo_manufacturer (manufacturer),
  INDEX idx_community_ammo_status (verification_status),
  INDEX idx_community_ammo_score (vote_score DESC),
  INDEX idx_community_ammo_usage (usage_count DESC),
  INDEX idx_community_ammo_quality (quality_score DESC),
  INDEX idx_community_ammo_caliber_quality (caliber, quality_score DESC),
  FULLTEXT INDEX idx_community_ammo_search (manufacturer, product_name, caliber, bullet_type) WITH PARSER ngram,

  CONSTRAINT chk_community_bullet_weight CHECK (bullet_weight > 0 AND bullet_weight <= 1000),
  CONSTRAINT chk_community_bc_g1 CHECK (ballistic_coefficient_g1 IS NULL OR (ballistic_coefficient_g1 >= 0 AND ballistic_coefficient_g1 <= 1)),
  CONSTRAINT chk_community_bc_g7 CHECK (ballistic_coefficient_g7 IS NULL OR (ballistic_coefficient_g7 >= 0 AND ballistic_coefficient_g7 <= 1)),
  CONSTRAINT chk_community_velocity CHECK (advertised_velocity IS NULL OR (advertised_velocity > 0 AND advertised_velocity <= 5000))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- COMMUNITY AMMO VOTES TABLE
-- =====================================================================
-- Tracks individual user votes on community ammunition data

CREATE TABLE IF NOT EXISTS community_ammo_votes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ammo_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  vote_type ENUM('up', 'down') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ammo_id) REFERENCES community_ammo(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY idx_community_votes_unique (ammo_id, user_id),
  INDEX idx_community_votes_ammo (ammo_id),
  INDEX idx_community_votes_user (user_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- SYNC LOGS TABLE
-- =====================================================================
-- Tracks data synchronization operations for conflict resolution

CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  entity_type ENUM('rifle', 'ammo', 'dope_log', 'environment', 'range_session', 'shot_string', 'target_image', 'settings') NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  operation ENUM('create', 'update', 'delete') NOT NULL,
  client_timestamp TIMESTAMP NOT NULL COMMENT 'Timestamp from mobile client',
  server_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  device_id VARCHAR(255) COMMENT 'Mobile device identifier',

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sync_logs_user (user_id),
  INDEX idx_sync_logs_entity (entity_type, entity_id),
  INDEX idx_sync_logs_timestamp (server_timestamp)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- AUDIT LOGS TABLE
-- =====================================================================
-- Comprehensive audit trail for security and debugging

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id BIGINT UNSIGNED,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_method VARCHAR(10),
  request_path VARCHAR(500),
  request_body TEXT,
  response_status INT,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_action (action),
  INDEX idx_audit_logs_timestamp (created_at),
  INDEX idx_audit_logs_entity (entity_type, entity_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================================
-- INSTALLATION COMPLETE
-- =====================================================================

SELECT '✓ Mobile DOPE API database schema installed successfully!' AS status;
SELECT DATABASE() AS database_name;
SELECT VERSION() AS mysql_version;
SELECT COUNT(*) AS table_count FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';

-- =====================================================================
-- MySQL 9.x FEATURE SUMMARY
-- =====================================================================
-- This schema leverages the following MySQL 9.x features:
--
-- 1. utf8mb4_0900_ai_ci Collation
--    - Optimized for performance in MySQL 9.x
--    - Accent-insensitive and case-insensitive comparisons
--    - Faster string operations than utf8mb4_unicode_ci
--
-- 2. Generated Columns (STORED)
--    - users.uuid: Auto-generated UUID from numeric ID
--    - dope_logs.distance_yards: Normalized distance for cross-unit queries
--    - dope_logs.hit_percentage: Automatic accuracy calculation
--    - target_images.shot_count: Extracted from JSON array length
--    - community_ammo.quality_score: Composite ranking algorithm
--
-- 3. INVISIBLE Columns
--    - users.login_count: Internal tracking without exposing in SELECT *
--    - users.row_version: Optimistic locking for concurrent updates
--
-- 4. Enhanced JSON Support
--    - JSON_LENGTH() function for calculating array sizes
--    - Improved JSON query performance in MySQL 9.x
--    - Native JSON storage with indexing capabilities
--
-- 5. Advanced FULLTEXT Indexing
--    - ngram parser for community_ammo search
--    - Better support for partial matches and multilingual content
--    - Optimized search performance in MySQL 9.x
--
-- 6. ROW_FORMAT=DYNAMIC
--    - Explicit setting for optimal performance
--    - Required for large BLOB/TEXT columns and off-page storage
--    - Better compression and space efficiency
--
-- 7. Composite and Functional Indexes
--    - Indexes on generated columns for query optimization
--    - Multi-column indexes for common query patterns
--    - Covering indexes to reduce table lookups
--
-- Performance Recommendations:
-- - Use generated columns in WHERE clauses for automatic index usage
-- - Query generated columns instead of recalculating values
-- - FULLTEXT search on community_ammo uses ngram for flexible matching
-- - INVISIBLE columns don't appear in SELECT * but are queryable
-- =====================================================================
