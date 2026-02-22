-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  source TEXT NOT NULL DEFAULT 'UNKNOWN',
  account_key TEXT,
  device_id TEXT,
  started_at INTEGER,
  ended_at INTEGER
);

-- Points table
CREATE TABLE IF NOT EXISTS points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routeId INTEGER NOT NULL,
  lat REAL,
  lng REAL,
  timestamp INTEGER,
  source TEXT NOT NULL DEFAULT 'UNKNOWN',
  account_key TEXT,
  device_id TEXT,
  FOREIGN KEY(routeId) REFERENCES routes(id) ON DELETE CASCADE
);

-- Index for fast lookup of points by route in timestamp order
CREATE INDEX IF NOT EXISTS idx_points_route_time ON points(routeId, timestamp);

-- Passive Locations table
CREATE TABLE IF NOT EXISTS passive_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL,
  lng REAL,
  timestamp INTEGER,
  device_id TEXT,
  account_key TEXT,
  sample_hash TEXT,
  received_at INTEGER,
  route_id INTEGER,
  activity_type TEXT,
  activity_confidence INTEGER,
  reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_passive_locations_sample_hash ON passive_locations(sample_hash);
CREATE INDEX IF NOT EXISTS idx_passive_locations_time ON passive_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_locations_device_time ON passive_locations(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_locations_route_id ON passive_locations(route_id);
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

CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  checksum TEXT ,
  uploaded_at TEXT NOT NULL
);
