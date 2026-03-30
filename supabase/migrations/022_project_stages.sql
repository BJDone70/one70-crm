-- Project stages (configurable)
CREATE TABLE IF NOT EXISTS project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'bg-gray-100 text-gray-600',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_terminal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view project stages" ON project_stages;
CREATE POLICY "Anyone can view project stages" ON project_stages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage project stages" ON project_stages;
CREATE POLICY "Users can manage project stages" ON project_stages FOR ALL USING (true);

-- Seed defaults
INSERT INTO project_stages (name, label, color, sort_order, is_terminal) VALUES
  ('scoping', 'Scoping', 'bg-purple-100 text-purple-700', 0, false),
  ('in_progress', 'In Progress', 'bg-blue-100 text-blue-700', 1, false),
  ('punch_list', 'Punch List', 'bg-amber-100 text-amber-700', 2, false),
  ('complete', 'Complete', 'bg-green-100 text-green-700', 3, true),
  ('on_hold', 'On Hold', 'bg-gray-100 text-gray-600', 4, true)
ON CONFLICT (name) DO NOTHING;

-- Remove any CHECK constraint on projects.status
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
