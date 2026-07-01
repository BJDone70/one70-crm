-- ============================================================
-- ONE70 Weekly Update Tool — Standalone Migration
-- Fully isolated from CRM / Build / Woven schemas.
-- Prefixed wu_ so there is zero collision risk with existing tables.
--
-- This backs the standalone tool at public/tools/weekly-update.html,
-- a manual/formal client-report format (commitments-vs-delivered,
-- % complete bar, decisions-needed, jsPDF export). It is intentionally
-- separate from the existing weekly_update_archive table (AI-narrative
-- based) — do not merge without explicit sign-off.
--
-- Already applied directly to the live project (jmwwngvleszbdlevabbh)
-- via Supabase MCP; checked in here for the repo's migration history.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROJECTS (manually maintained list, no dependency on the
--    CRM's `projects` table)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wu_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. WEEKLY UPDATES
--    update_number auto-increments PER PROJECT via trigger below.
--    Free-form sections stored as JSONB so the form can evolve
--    without further migrations.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wu_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES wu_projects(id) ON DELETE CASCADE,
  update_number INTEGER NOT NULL,

  -- header / meta
  report_date TEXT,               -- display string, e.g. "6.19.26"
  prepared_by TEXT,
  project_start_date DATE,
  original_completion DATE,
  revised_completion DATE,

  -- schedule status
  pct_complete INTEGER DEFAULT 0 CHECK (pct_complete BETWEEN 0 AND 100),
  days_delta INTEGER DEFAULT 0,
  days_delta_dir TEXT DEFAULT 'ahead' CHECK (days_delta_dir IN ('ahead','behind')),

  -- report sections (arrays of objects, shape owned by the app layer)
  commitments JSONB DEFAULT '[]'::jsonb,   -- what we said last week vs delivered
  look_ahead JSONB DEFAULT '[]'::jsonb,    -- two-week look ahead items
  look_ahead_period TEXT,                  -- display string, e.g. "6/22 - 7/3"
  open_items JSONB DEFAULT '[]'::jsonb,    -- issues + actions being taken
  decisions_required BOOLEAN DEFAULT false,
  decisions JSONB DEFAULT '[]'::jsonb,     -- decisions needed from client
  comments TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (project_id, update_number)
);

CREATE INDEX IF NOT EXISTS idx_wu_updates_project ON wu_updates(project_id, update_number DESC);

-- ------------------------------------------------------------
-- 3. AUTO-INCREMENT update_number PER PROJECT
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION wu_set_update_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.update_number IS NULL THEN
    SELECT COALESCE(MAX(update_number), 0) + 1
      INTO NEW.update_number
      FROM wu_updates
      WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trg_wu_set_update_number ON wu_updates;
CREATE TRIGGER trg_wu_set_update_number
  BEFORE INSERT ON wu_updates
  FOR EACH ROW
  EXECUTE FUNCTION wu_set_update_number();

-- ------------------------------------------------------------
-- 4. updated_at TRIGGER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION wu_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trg_wu_updates_touch ON wu_updates;
CREATE TRIGGER trg_wu_updates_touch
  BEFORE UPDATE ON wu_updates
  FOR EACH ROW
  EXECUTE FUNCTION wu_touch_updated_at();

-- ------------------------------------------------------------
-- 5. RLS — scoped ONLY to these two new tables.
--    Does not touch, alter, or reference any existing RLS
--    policy on CRM tables. Permissive by design (anon-key,
--    no-login tool) — matches migration 014's precedent for
--    non-CRM tables.
-- ------------------------------------------------------------
ALTER TABLE wu_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE wu_updates  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wu_projects_read"  ON wu_projects;
DROP POLICY IF EXISTS "wu_projects_write" ON wu_projects;
DROP POLICY IF EXISTS "wu_updates_read"   ON wu_updates;
DROP POLICY IF EXISTS "wu_updates_write"  ON wu_updates;

CREATE POLICY "wu_projects_read"  ON wu_projects FOR SELECT USING (true);
CREATE POLICY "wu_projects_write" ON wu_projects FOR ALL    USING (true) WITH CHECK (true);

CREATE POLICY "wu_updates_read"   ON wu_updates  FOR SELECT USING (true);
CREATE POLICY "wu_updates_write"  ON wu_updates  FOR ALL    USING (true) WITH CHECK (true);

-- ============================================================
-- Done. This migration only creates wu_projects and wu_updates.
-- Nothing else in the database is read, altered, or referenced.
-- ============================================================
