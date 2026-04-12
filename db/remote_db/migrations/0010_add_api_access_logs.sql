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
