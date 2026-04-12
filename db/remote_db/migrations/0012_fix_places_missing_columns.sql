ALTER TABLE place_visits ADD COLUMN last_fix_ms INTEGER NOT NULL DEFAULT 0;
UPDATE place_visits SET last_fix_ms = arrival_ms WHERE last_fix_ms = 0;
