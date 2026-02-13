-- Passive Locations table
CREATE TABLE IF NOT EXISTS passive_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL,
  lng REAL,
  timestamp INTEGER
);
