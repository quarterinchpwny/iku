ALTER TABLE passive_locations ADD COLUMN route_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_passive_locations_route_id ON passive_locations(route_id);
