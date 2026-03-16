-- Migration: 0012_fix_places_missing_columns.sql
-- Fixes the error "no such column: last_fix_ms" in place_visits.

-- Check if table exists (it should if 0011 was run) and add column.
-- SQLite ALTER TABLE ADD COLUMN is safe even if there's data.
-- We use DEFAULT 0 since arrival_ms is also an integer timestamp.

ALTER TABLE place_visits ADD COLUMN last_fix_ms INTEGER NOT NULL DEFAULT 0;

-- Update existing open stays to have last_fix_ms = arrival_ms as a starting point.
UPDATE place_visits SET last_fix_ms = arrival_ms WHERE last_fix_ms = 0;
