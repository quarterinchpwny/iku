-- Migration: continuous tracking support

-- 1. passive_locations telemetry + retention
ALTER TABLE passive_locations ADD COLUMN acc REAL;
ALTER TABLE passive_locations ADD COLUMN vel REAL;
ALTER TABLE passive_locations ADD COLUMN cog REAL;
ALTER TABLE passive_locations ADD COLUMN alt REAL;
ALTER TABLE passive_locations ADD COLUMN provider TEXT;
ALTER TABLE passive_locations ADD COLUMN trigger TEXT;
ALTER TABLE passive_locations ADD COLUMN retained_until INTEGER;

CREATE INDEX IF NOT EXISTS idx_passive_locations_retained
  ON passive_locations(retained_until);

-- 2. routes lifecycle rollups
ALTER TABLE routes ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE routes ADD COLUMN last_point_at INTEGER;
ALTER TABLE routes ADD COLUMN point_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routes ADD COLUMN distance_meters REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_routes_device_status
  ON routes(device_id, status);
CREATE INDEX IF NOT EXISTS idx_routes_account_status
  ON routes(account_key, status);

-- 3. device auth tokens
CREATE TABLE IF NOT EXISTS device_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key TEXT NOT NULL,
  device_id TEXT NOT NULL,
  label TEXT,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  UNIQUE(account_key, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_account
  ON device_tokens(account_key);
CREATE INDEX IF NOT EXISTS idx_device_tokens_lookup
  ON device_tokens(account_key, device_id, revoked);

-- Note: points.routeId rename is intentionally deferred for compatibility.
