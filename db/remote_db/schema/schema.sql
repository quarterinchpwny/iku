-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER
);

-- Points table
CREATE TABLE IF NOT EXISTS points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routeId INTEGER NOT NULL,
  lat REAL,
  lng REAL,
  timestamp INTEGER,
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
  sample_hash TEXT,
  received_at INTEGER,
  route_id INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_passive_locations_sample_hash ON passive_locations(sample_hash);
CREATE INDEX IF NOT EXISTS idx_passive_locations_time ON passive_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_locations_device_time ON passive_locations(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_locations_route_id ON passive_locations(route_id);

CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  checksum TEXT ,
  uploaded_at TEXT NOT NULL
);
