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
  timestamp INTEGER
);

CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  checksum TEXT ,
  uploaded_at TEXT NOT NULL
);
