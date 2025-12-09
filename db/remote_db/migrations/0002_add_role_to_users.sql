-- Add a 'role' column to the users table to distinguish between admin and regular users.
-- Default new users to the 'user' role.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
