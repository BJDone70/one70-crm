-- ============================================================
-- Migration 027: Build Projects table + auto-sync from CRM
--
-- When a deal is awarded and a CRM project is created, a
-- corresponding build_projects record is created automatically.
-- Both apps share this Supabase database.
-- ============================================================

-- 1. Build Projects table — construction operations side
CREATE TABLE IF NOT EXISTS public.build_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_project_id UUID UNIQUE REFERENCES public.projects(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  project_number TEXT,  -- internal job number (can be set later by Build team)
  project_type TEXT DEFAULT 'renovation' CHECK (project_type IN ('major_construction', 'renovation', 'tenant_improvement', 'capital_improvement', 'maintenance')),
  vertical TEXT,
  status TEXT NOT NULL DEFAULT 'pre_construction' CHECK (status IN (
    'pre_construction', 'permitting', 'mobilization', 'in_progress',
    'punch_list', 'closeout', 'complete', 'on_hold', 'cancelled'
  )),
  contract_value NUMERIC(14,2),
  scope_description TEXT,

  -- Build-specific fields
  site_address TEXT,
  city TEXT,
  state TEXT,
  superintendent_id UUID REFERENCES auth.users(id),
  pm_id UUID REFERENCES auth.users(id),
  estimator_id UUID REFERENCES auth.users(id),
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  percent_complete INTEGER DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_build_projects_crm ON build_projects(crm_project_id);
CREATE INDEX IF NOT EXISTS idx_build_projects_org ON build_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_build_projects_status ON build_projects(status);

-- RLS
ALTER TABLE build_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active users can view build projects" ON build_projects
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );
CREATE POLICY "Active users can insert build projects" ON build_projects
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );
CREATE POLICY "Active users can update build projects" ON build_projects
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true)
  );

-- 2. Auto-create build_project when a CRM project is inserted
--    This trigger fires on the projects table so both manual conversion
--    and workflow automation are covered.
CREATE OR REPLACE FUNCTION public.sync_project_to_build()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create if no build_project already exists for this CRM project
  IF NOT EXISTS (SELECT 1 FROM build_projects WHERE crm_project_id = NEW.id) THEN
    INSERT INTO build_projects (
      crm_project_id, deal_id, org_id, property_id,
      name, vertical, contract_value, scope_description,
      project_type, pm_id, created_by
    ) VALUES (
      NEW.id, NEW.deal_id, NEW.org_id, NEW.property_id,
      NEW.name, NEW.vertical, NEW.contract_value, NEW.scope_description,
      COALESCE(NEW.project_type, 'renovation'), NEW.assigned_to, NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_project_to_build
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_to_build();
