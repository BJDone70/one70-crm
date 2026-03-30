-- Organization role column
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_role TEXT;

-- Org roles lookup table
CREATE TABLE IF NOT EXISTS org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE org_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view org roles" ON org_roles;
CREATE POLICY "Anyone can view org roles" ON org_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage org roles" ON org_roles;
CREATE POLICY "Users can manage org roles" ON org_roles FOR ALL USING (true);

INSERT INTO org_roles (name, label, sort_order) VALUES
  ('owner_operator', 'Owner / Operator', 0),
  ('developer', 'Developer', 1),
  ('architect_designer', 'Architect / Designer', 2),
  ('gc_contractor', 'GC / Contractor', 3),
  ('procurement_ffe', 'Procurement / FF&E', 4),
  ('capital', 'Capital (PE / Lender)', 5),
  ('advisor', 'Advisor (Tax / Broker / Valuation)', 6),
  ('vendor', 'Vendor', 7)
ON CONFLICT (name) DO NOTHING;
