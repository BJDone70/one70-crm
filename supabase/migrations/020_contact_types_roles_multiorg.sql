-- Contact types
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'lead';

-- Custom contact types
CREATE TABLE IF NOT EXISTS contact_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'bg-gray-100 text-gray-700',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE contact_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view contact types" ON contact_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage contact types" ON contact_types FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users can insert contact types" ON contact_types FOR INSERT WITH CHECK (true);

-- Seed default types
INSERT INTO contact_types (name, label, color) VALUES
  ('lead', 'Lead', 'bg-blue-100 text-blue-700'),
  ('client', 'Client', 'bg-green-100 text-green-700'),
  ('vendor', 'Vendor', 'bg-amber-100 text-amber-700'),
  ('team_member', 'Team Member', 'bg-purple-100 text-purple-700'),
  ('referral_source', 'Referral Source', 'bg-pink-100 text-pink-700')
ON CONFLICT (name) DO NOTHING;

-- Contact-Organization many-to-many
CREATE TABLE IF NOT EXISTS contact_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role TEXT, -- their role at this org
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, org_id)
);
ALTER TABLE contact_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view contact orgs" ON contact_organizations FOR SELECT USING (true);
CREATE POLICY "Users can manage contact orgs" ON contact_organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update contact orgs" ON contact_organizations FOR UPDATE USING (true);
CREATE POLICY "Users can delete contact orgs" ON contact_organizations FOR DELETE USING (true);
CREATE INDEX idx_contact_orgs_contact ON contact_organizations(contact_id);
CREATE INDEX idx_contact_orgs_org ON contact_organizations(org_id);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- admin, rep, viewer are system roles
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view roles" ON custom_roles FOR SELECT USING (true);
CREATE POLICY "Service role manages roles" ON custom_roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admins can manage roles" ON custom_roles FOR ALL USING (true);

-- Seed default roles with permissions
INSERT INTO custom_roles (name, label, description, is_system, permissions) VALUES
  ('admin', 'Admin', 'Full access to all features', true, '{
    "contacts": true, "organizations": true, "deals": true, "tasks": true,
    "properties": true, "projects": true, "sequences": true, "outreach": true,
    "analytics": true, "activities": true, "emails": true, "feedback": true,
    "import": true, "settings": true, "users": true, "integrations": true,
    "workflows": true, "data": true, "territories": true
  }'),
  ('rep', 'Rep', 'Standard user — can manage CRM data but not admin settings', true, '{
    "contacts": true, "organizations": true, "deals": true, "tasks": true,
    "properties": true, "projects": true, "sequences": true, "outreach": true,
    "analytics": true, "activities": true, "emails": true, "feedback": true,
    "import": false, "settings": false, "users": false, "integrations": true,
    "workflows": false, "data": false, "territories": false
  }'),
  ('viewer', 'Viewer', 'Read-only access — can view but not create or edit', true, '{
    "contacts": true, "organizations": true, "deals": true, "tasks": true,
    "properties": true, "projects": true, "sequences": false, "outreach": false,
    "analytics": true, "activities": true, "emails": true, "feedback": true,
    "import": false, "settings": false, "users": false, "integrations": false,
    "workflows": false, "data": false, "territories": false
  }')
ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Enhanced workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS trigger_config JSONB DEFAULT '{}';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS run_count INTEGER DEFAULT 0;
