ALTER TABLE passive_locations ADD COLUMN device_id TEXT;
ALTER TABLE passive_locations ADD COLUMN sample_hash TEXT;
ALTER TABLE passive_locations ADD COLUMN received_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_passive_locations_sample_hash ON passive_locations(sample_hash);
CREATE INDEX IF NOT EXISTS idx_passive_locations_time ON passive_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_passive_locations_device_time ON passive_locations(device_id, timestamp);
