-- Migration: 0004_place_visits_and_labels.sql
-- Adds server-side stay detection tables for Life360 / Google Timeline support.
-- Run via: wrangler d1 execute RouteDB --file=0004_place_visits_and_labels.sql

-- ── place_visits ─────────────────────────────────────────────────────────────
-- One row per detected stay cluster (device was STILL within CLUSTER_RADIUS_M
-- for at least MIN_STAY_DURATION_MS). Mirrors PlaceVisitStore.java on Android.

CREATE TABLE IF NOT EXISTS place_visits (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key    TEXT,
  device_id      TEXT NOT NULL,
  centroid_lat   REAL NOT NULL,
  centroid_lng   REAL NOT NULL,
  arrival_ms     INTEGER NOT NULL,
  departure_ms   INTEGER,               -- NULL while stay is still open
  duration_ms    INTEGER,               -- departure_ms - arrival_ms
  fix_count      INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  label_id       INTEGER,               -- FK → place_labels.id (nullable)
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_place_visits_account_arrival
  ON place_visits(account_key, arrival_ms);

CREATE INDEX IF NOT EXISTS idx_place_visits_device_arrival
  ON place_visits(device_id, arrival_ms);

CREATE INDEX IF NOT EXISTS idx_place_visits_status
  ON place_visits(status);

-- ── place_labels ──────────────────────────────────────────────────────────────
-- One row per frequently-visited location cluster. Frequency-based labeling
-- auto-sets auto_label = 'frequent' after STAY_AUTO_LABEL_MIN_VISITS visits.
-- Users can override with a human name via PATCH /places/:id.

CREATE TABLE IF NOT EXISTS place_labels (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key    TEXT,
  device_id      TEXT,
  centroid_lat   REAL NOT NULL,
  centroid_lng   REAL NOT NULL,
  name           TEXT NOT NULL DEFAULT '',     -- user-provided label ("Home", "Work")
  auto_label     TEXT NOT NULL DEFAULT 'new', -- 'new' | 'frequent'
  visit_count    INTEGER NOT NULL DEFAULT 0,
  first_seen_ms  INTEGER NOT NULL,
  last_seen_ms   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_place_labels_account
  ON place_labels(account_key);

CREATE INDEX IF NOT EXISTS idx_place_labels_account_coords
  ON place_labels(account_key, centroid_lat, centroid_lng);