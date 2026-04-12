CREATE TABLE IF NOT EXISTS puv_queue_routes (
  route_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  origin_lng REAL NOT NULL,
  origin_lat REAL NOT NULL,
  destination_lng REAL NOT NULL,
  destination_lat REAL NOT NULL,
  timezone TEXT NOT NULL,
  cache_ttl_ms INTEGER NOT NULL,
  baseline_by_hour_json TEXT NOT NULL,
  tod_score_by_hour_json TEXT NOT NULL,
  holidays_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS puv_queue_routes_single_default
ON puv_queue_routes (is_default)
WHERE is_default = 1 AND is_active = 1;

CREATE INDEX IF NOT EXISTS puv_queue_routes_active_idx
ON puv_queue_routes (is_active, route_key);

INSERT OR IGNORE INTO puv_queue_routes (
  route_key,
  label,
  origin_lng,
  origin_lat,
  destination_lng,
  destination_lat,
  timezone,
  cache_ttl_ms,
  baseline_by_hour_json,
  tod_score_by_hour_json,
  holidays_json,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  'ortigas-pateros-uv',
  'Ortigas -> Pateros UV Express',
  121.0614,
  14.5847,
  121.0794,
  14.5441,
  'Asia/Manila',
  300000,
  '[480,480,480,480,480,540,660,900,960,780,600,600,660,620,600,660,840,1020,1020,840,660,560,500,480]',
  '[1,1,1,1,1,1,2,4,5,3,2,2,3,2,2,2,3,5,5,4,3,2,1,1]',
  '["01-01","04-09","05-01","06-12","08-26","11-01","11-30","12-25","12-30","12-31"]',
  1,
  1,
  CAST(strftime('%s','now') AS INTEGER) * 1000,
  CAST(strftime('%s','now') AS INTEGER) * 1000
);
