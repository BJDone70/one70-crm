-- Add project_type, contract_value, and percent_complete to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'renovation' CHECK (project_type IN ('major_construction', 'renovation'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_value NUMERIC(14,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS percent_complete INTEGER DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100);
