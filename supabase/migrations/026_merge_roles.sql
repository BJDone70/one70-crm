-- ============================================================
-- Migration 026: Expand role check constraints to support custom roles
--
-- Problem: profiles.role and user_invites.role have hardcoded
-- CHECK (role in ('admin','rep','viewer')) which blocks custom roles
-- created through the Roles & Permissions UI.
--
-- Solution: Replace the rigid check constraint with a foreign key
-- to custom_roles(name), so any role defined in custom_roles is valid.
-- Also seed Build-specific roles for the construction side of ONE70.
-- ============================================================

-- 1. Drop the old hardcoded check constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE user_invites DROP CONSTRAINT IF EXISTS user_invites_role_check;

-- 2. Add foreign key constraints referencing custom_roles(name)
--    This ensures only roles defined in custom_roles can be assigned.
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_fk FOREIGN KEY (role) REFERENCES custom_roles(name);

ALTER TABLE user_invites
  ADD CONSTRAINT user_invites_role_fk FOREIGN KEY (role) REFERENCES custom_roles(name);

-- 3. Seed Build application roles (construction operations)
INSERT INTO custom_roles (name, label, description, is_system, permissions) VALUES
  ('pm', 'Project Manager', 'Manages construction projects, schedules, and budgets', false, '{
    "contacts": true, "organizations": true, "deals": true, "tasks": true,
    "properties": true, "projects": true, "sequences": false, "outreach": false,
    "analytics": true, "activities": true, "emails": true, "feedback": true,
    "import": false, "settings": false, "users": false, "integrations": true,
    "workflows": false, "data": false, "territories": false
  }'),
  ('superintendent', 'Superintendent', 'On-site construction supervision and daily operations', false, '{
    "contacts": true, "organizations": true, "deals": false, "tasks": true,
    "properties": true, "projects": true, "sequences": false, "outreach": false,
    "analytics": false, "activities": true, "emails": true, "feedback": true,
    "import": false, "settings": false, "users": false, "integrations": false,
    "workflows": false, "data": false, "territories": false
  }'),
  ('estimator', 'Estimator', 'Prepares cost estimates and proposals for projects', false, '{
    "contacts": true, "organizations": true, "deals": true, "tasks": true,
    "properties": true, "projects": true, "sequences": false, "outreach": false,
    "analytics": true, "activities": true, "emails": true, "feedback": true,
    "import": false, "settings": false, "users": false, "integrations": true,
    "workflows": false, "data": false, "territories": false
  }'),
  ('foreman', 'Foreman', 'Leads work crews and manages day-to-day field operations', false, '{
    "contacts": false, "organizations": true, "deals": false, "tasks": true,
    "properties": true, "projects": true, "sequences": false, "outreach": false,
    "analytics": false, "activities": true, "emails": false, "feedback": true,
    "import": false, "settings": false, "users": false, "integrations": false,
    "workflows": false, "data": false, "territories": false
  }'),
  ('exec', 'Executive', 'Executive leadership with full visibility and deal oversight', false, '{
    "contacts": true, "organizations": true, "deals": true, "tasks": true,
    "properties": true, "projects": true, "sequences": true, "outreach": true,
    "analytics": true, "activities": true, "emails": true, "feedback": true,
    "import": true, "settings": true, "users": false, "integrations": true,
    "workflows": true, "data": true, "territories": true
  }')
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;
