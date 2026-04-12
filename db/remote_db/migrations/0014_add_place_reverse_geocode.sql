ALTER TABLE place_labels ADD COLUMN geocode_name TEXT NOT NULL DEFAULT '';
ALTER TABLE place_labels ADD COLUMN geocode_provider TEXT NOT NULL DEFAULT '';
ALTER TABLE place_labels ADD COLUMN geocode_updated_at INTEGER;
