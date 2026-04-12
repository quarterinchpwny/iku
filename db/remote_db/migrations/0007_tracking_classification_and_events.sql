ALTER TABLE routes ADD COLUMN source TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE routes ADD COLUMN account_key TEXT;
ALTER TABLE routes ADD COLUMN device_id TEXT;
ALTER TABLE routes ADD COLUMN started_at INTEGER;
ALTER TABLE routes ADD COLUMN ended_at INTEGER;

ALTER TABLE points ADD COLUMN source TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE points ADD COLUMN account_key TEXT;
ALTER TABLE points ADD COLUMN device_id TEXT;

ALTER TABLE passive_locations ADD COLUMN account_key TEXT;
ALTER TABLE passive_locations ADD COLUMN activity_type TEXT;
ALTER TABLE passive_locations ADD COLUMN activity_confidence INTEGER;
ALTER TABLE passive_locations ADD COLUMN reason TEXT;

CREATE INDEX IF NOT EXISTS idx_routes_source_time ON routes(source, timestamp);
CREATE INDEX IF NOT EXISTS idx_routes_account_time ON routes(account_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_points_source_time ON points(source, timestamp);
CREATE INDEX IF NOT EXISTS idx_points_account_time ON points(account_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_account_time ON passive_locations(account_key, timestamp);

CREATE TABLE IF NOT EXISTS tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  route_id INTEGER,
  account_key TEXT,
  device_id TEXT,
  timestamp INTEGER NOT NULL,
  payload TEXT,
  FOREIGN KEY(route_id) REFERENCES routes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_time ON tracking_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_tracking_events_source_time ON tracking_events(source, timestamp);
CREATE INDEX IF NOT EXISTS idx_tracking_events_account_time ON tracking_events(account_key, timestamp);
