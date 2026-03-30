-- ============================================================
-- ONE70 GROUP CRM - Migration 009
-- Tasks: private flag, soft deletes, performance indexes
-- ============================================================

-- Add private flag
alter table public.tasks add column if not exists is_private boolean not null default false;

-- Add deleted_at to contacts and properties if missing (for admin soft deletes)
alter table public.contacts add column if not exists deleted_at timestamptz;
alter table public.properties add column if not exists deleted_at timestamptz;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Soft delete indexes
create index if not exists idx_contacts_deleted on public.contacts(deleted_at) where deleted_at is null;
create index if not exists idx_properties_deleted on public.properties(deleted_at) where deleted_at is null;

-- Documents: queried by record_type + record_id on every detail page
create index if not exists idx_documents_record on public.documents(record_type, record_id);

-- Activities: composite index for contact + date (contact detail page)
create index if not exists idx_activities_contact_date on public.activities(contact_id, occurred_at desc);

-- Activities: composite for org + date (org detail, project detail)
create index if not exists idx_activities_org_date on public.activities(org_id, occurred_at desc);

-- Activities: composite for deal + date (deal detail)
create index if not exists idx_activities_deal_date on public.activities(deal_id, occurred_at desc);

-- Tasks: composite for assigned_to + status (tasks page main query)
create index if not exists idx_tasks_assigned_status on public.tasks(assigned_to, status) where deleted_at is null;

-- Sequence enrollments: composite for status + next_action (outreach queue, dashboard)
create index if not exists idx_enrollments_active_next on public.sequence_enrollments(status, next_action_at) where status = 'active';

-- Organizations: last_activity_at for dormant org detection (dashboard)
create index if not exists idx_orgs_last_activity on public.organizations(last_activity_at) where deleted_at is null and last_activity_at is not null;

-- Projects: status for active project counts (dashboard)
create index if not exists idx_projects_active_status on public.projects(status) where deleted_at is null and status in ('scoping', 'in_progress', 'punch_list');

-- Deals: composite for vertical + deleted_at (pipeline filters)
create index if not exists idx_deals_vertical_active on public.deals(vertical, stage) where deleted_at is null;
