CREATE TABLE IF NOT EXISTS puv_queue_weather_cache (
  route_key TEXT PRIMARY KEY,
  weather_json TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS puv_queue_holiday_calendar (
  holiday_date TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  year INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS puv_queue_holiday_calendar_year_idx
ON puv_queue_holiday_calendar (year, holiday_date);

CREATE TABLE IF NOT EXISTS puv_queue_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_key TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  venue_name TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  score_delta REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS puv_queue_incidents_route_window_idx
ON puv_queue_incidents (route_key, is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS puv_queue_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_key TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  queue_level TEXT,
  wait_minutes INTEGER,
  observed_score REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS puv_queue_observations_route_observed_idx
ON puv_queue_observations (route_key, observed_at DESC);
