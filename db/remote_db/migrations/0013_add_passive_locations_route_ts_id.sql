CREATE INDEX IF NOT EXISTS idx_passive_locations_route_ts_id
  ON passive_locations(route_id, timestamp DESC, id DESC);
