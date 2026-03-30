-- Contact photo and rating
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rating TEXT DEFAULT 'cold';

-- Subtasks - parent_task_id on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Update contact types: Lead→Prospect, Team Member→Internal, Referral Source→Strategic Partner
UPDATE contact_types SET name = 'prospect', label = 'Prospect', color = 'bg-blue-100 text-blue-700' WHERE name = 'lead';
UPDATE contact_types SET name = 'strategic_partner', label = 'Strategic Partner', color = 'bg-pink-100 text-pink-700' WHERE name = 'referral_source';
UPDATE contact_types SET name = 'internal', label = 'Internal', color = 'bg-purple-100 text-purple-700' WHERE name = 'team_member';

-- Update existing contacts to new type names
UPDATE contacts SET contact_type = 'prospect' WHERE contact_type = 'lead';
UPDATE contacts SET contact_type = 'strategic_partner' WHERE contact_type = 'referral_source';
UPDATE contacts SET contact_type = 'internal' WHERE contact_type = 'team_member';

-- Ensure all 5 new types exist
INSERT INTO contact_types (name, label, color) VALUES
  ('client', 'Client', 'bg-green-100 text-green-700'),
  ('prospect', 'Prospect', 'bg-blue-100 text-blue-700'),
  ('strategic_partner', 'Strategic Partner', 'bg-pink-100 text-pink-700'),
  ('vendor', 'Vendor', 'bg-amber-100 text-amber-700'),
  ('internal', 'Internal', 'bg-purple-100 text-purple-700')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label, color = EXCLUDED.color;
