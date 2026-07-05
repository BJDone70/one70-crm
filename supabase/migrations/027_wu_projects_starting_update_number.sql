-- ============================================================
-- Weekly Update Tool — starting update number per project
--
-- Many projects are already partway through their update cycle when
-- they're first added to this standalone tool. This lets a project's
-- very first update be numbered to match wherever it actually is,
-- instead of always starting over at 1.
--
-- Already applied directly to the live project (jmwwngvleszbdlevabbh)
-- via Supabase MCP; checked in here for the repo's migration history.
-- ============================================================

ALTER TABLE wu_projects
  ADD COLUMN IF NOT EXISTS starting_update_number INTEGER NOT NULL DEFAULT 1
    CHECK (starting_update_number >= 1);
