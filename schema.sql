-- Omeglo Cloudflare D1 Database Schema
-- Run with: npx wrangler d1 execute <DATABASE_NAME> --file=./schema.sql

-- 1. Reports Table (Stores comprehensive user reports & hardware/browser fingerprint)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_socket_id TEXT,
  reported_socket_id TEXT,
  reported_peer_id TEXT,
  reported_device_id TEXT,
  reported_user_agent TEXT,
  reported_platform TEXT,
  reported_screen TEXT,
  reported_timezone TEXT,
  reported_language TEXT,
  reported_gpu TEXT,
  reported_metadata TEXT, -- Full JSON snapshot of device & browser characteristics
  reason TEXT NOT NULL,
  details TEXT,
  mode TEXT NOT NULL DEFAULT 'video',
  ip_address TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'quarantined', 'banned', 'dismissed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reported_device ON reports(reported_device_id);
CREATE INDEX IF NOT EXISTS idx_reports_ip ON reports(ip_address);
CREATE INDEX IF NOT EXISTS idx_reports_reason ON reports(reason);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- 2. User Reputation & Toxic Shadow Queue Table (Quarantine Pool)
CREATE TABLE IF NOT EXISTS user_reputation (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,      -- Persistent Device UUID or IP Address
  identifier_type TEXT NOT NULL,        -- 'device_id' or 'ip'
  report_count INTEGER DEFAULT 1,       -- Number of times reported
  quarantine_level INTEGER DEFAULT 1,   -- 1 = light (30m), 2 = medium (2h-12h), 3 = heavy (24h), 4 = severe (7d)
  is_quarantined BOOLEAN DEFAULT 1,     -- 1 if currently restricted to toxic pool
  quarantined_until DATETIME,           -- Timestamp until which user is locked in toxic pool
  last_reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reputation_identifier ON user_reputation(identifier);
CREATE INDEX IF NOT EXISTS idx_reputation_quarantine ON user_reputation(is_quarantined, quarantined_until);

-- 3. Banned Users Table (Permanent hard bans for extreme violations)
CREATE TABLE IF NOT EXISTS banned_users (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE, -- IP Address, Device UUID, or Browser Fingerprint
  identifier_type TEXT NOT NULL,   -- 'ip', 'device_id', 'fingerprint'
  reason TEXT,
  banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_banned_identifier ON banned_users(identifier);

-- 4. Daily Traffic & Engagement Duration Analytics Table
CREATE TABLE IF NOT EXISTS daily_traffic_stats (
  date TEXT NOT NULL,                 -- 'YYYY-MM-DD'
  country TEXT NOT NULL,              -- 'LK', 'US', 'GB', etc.
  country_name TEXT,                  -- 'Sri Lanka'
  total_visitors INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  video_calls INTEGER DEFAULT 0,
  video_duration_seconds INTEGER DEFAULT 0,
  text_calls INTEGER DEFAULT 0,
  text_duration_seconds INTEGER DEFAULT 0,
  PRIMARY KEY (date, country)
);

CREATE INDEX IF NOT EXISTS idx_traffic_date ON daily_traffic_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_country ON daily_traffic_stats(country);
