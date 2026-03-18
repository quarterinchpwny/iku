-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  source TEXT NOT NULL DEFAULT 'UNKNOWN',
  account_key TEXT,
  device_id TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  last_point_at INTEGER,
  point_count INTEGER NOT NULL DEFAULT 0,
  distance_meters REAL NOT NULL DEFAULT 0
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
  reason TEXT,
  acc REAL,
  vel REAL,
  cog REAL,
  alt REAL,
  provider TEXT,
  trigger TEXT,
  retained_until INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_passive_locations_sample_hash ON passive_locations(sample_hash);
CREATE INDEX IF NOT EXISTS idx_passive_locations_time ON passive_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_locations_device_time ON passive_locations(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_locations_route_id ON passive_locations(route_id);
CREATE INDEX IF NOT EXISTS idx_passive_locations_route_ts_id ON passive_locations(route_id, timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_passive_locations_retained ON passive_locations(retained_until);
CREATE INDEX IF NOT EXISTS idx_routes_source_time ON routes(source, timestamp);
CREATE INDEX IF NOT EXISTS idx_routes_account_time ON routes(account_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_routes_device_status ON routes(device_id, status);
CREATE INDEX IF NOT EXISTS idx_routes_account_status ON routes(account_key, status);
CREATE INDEX IF NOT EXISTS idx_points_source_time ON points(source, timestamp);
CREATE INDEX IF NOT EXISTS idx_points_account_time ON points(account_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_account_time ON passive_locations(account_key, timestamp);

CREATE TABLE IF NOT EXISTS geofences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  account_key TEXT,
  device_id TEXT,
  last_state TEXT NOT NULL DEFAULT 'outside',
  last_transition_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_geofences_account ON geofences(account_key, updated_at);
CREATE INDEX IF NOT EXISTS idx_geofences_device ON geofences(device_id, updated_at);

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

CREATE TABLE IF NOT EXISTS api_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  query TEXT,
  status INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  cf_ray TEXT,
  request_bytes INTEGER,
  response_bytes INTEGER,
  auth_subject TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_access_logs_time ON api_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_access_logs_path_time ON api_access_logs(path, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_access_logs_status_time ON api_access_logs(status, timestamp);

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
CREATE INDEX IF NOT EXISTS idx_device_tokens_account ON device_tokens(account_key);
CREATE INDEX IF NOT EXISTS idx_device_tokens_lookup ON device_tokens(account_key, device_id, revoked);

CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  checksum TEXT ,
  uploaded_at TEXT NOT NULL
);

-- Place Visits table (Stay detection)
CREATE TABLE IF NOT EXISTS place_visits (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key    TEXT,
  device_id      TEXT NOT NULL,
  centroid_lat   REAL NOT NULL,
  centroid_lng   REAL NOT NULL,
  arrival_ms     INTEGER NOT NULL,
  last_fix_ms    INTEGER NOT NULL,      -- Missing column fixed
  departure_ms   INTEGER,               -- NULL while stay is still open
  duration_ms    INTEGER,               -- departure_ms - arrival_ms
  fix_count      INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  label_id       INTEGER,               -- FK -> place_labels.id (nullable)
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_place_visits_account_arrival ON place_visits(account_key, arrival_ms);
CREATE INDEX IF NOT EXISTS idx_place_visits_device_arrival ON place_visits(device_id, arrival_ms);
CREATE INDEX IF NOT EXISTS idx_place_visits_status ON place_visits(status);

-- Place Labels table (Frequency-based locations)
CREATE TABLE IF NOT EXISTS place_labels (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key    TEXT,
  device_id      TEXT,
  centroid_lat   REAL NOT NULL,
  centroid_lng   REAL NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  auto_label     TEXT NOT NULL DEFAULT 'new', -- 'new' | 'frequent'
  visit_count    INTEGER NOT NULL DEFAULT 0,
  first_seen_ms  INTEGER NOT NULL,
  last_seen_ms   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_place_labels_account ON place_labels(account_key);
CREATE INDEX IF NOT EXISTS idx_place_labels_account_coords ON place_labels(account_key, centroid_lat, centroid_lng);
