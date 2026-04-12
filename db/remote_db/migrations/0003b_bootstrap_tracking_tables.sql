-- Bootstrap core tracking tables for fresh databases.
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routeId INTEGER NOT NULL,
  lat REAL,
  lng REAL,
  timestamp INTEGER,
  FOREIGN KEY(routeId) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_points_route_time ON points(routeId, timestamp);
