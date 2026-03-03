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
