-- Add a 'checksum' column to the history table to check bundle.

ALTER TABLE history ADD checksum TEXT;
