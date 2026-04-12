-- Ensure history table exists in fresh environments.
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

-- Add checksum column for OTA bundle integrity.
ALTER TABLE history ADD COLUMN checksum TEXT;
