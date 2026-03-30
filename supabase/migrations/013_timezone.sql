-- Add timezone to profiles for server-side time calculations
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
