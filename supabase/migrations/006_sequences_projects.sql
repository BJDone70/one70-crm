-- ============================================================
-- ONE70 GROUP CRM - Migration 006
-- Email Sequencing, Projects, Re-engagement
-- ============================================================

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================
create table public.email_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject text not null,
  body text not null,
  vertical text check (vertical in ('multifamily', 'hotel', 'senior_living')),
  channel text not null default 'email' check (channel in ('email', 'linkedin', 'text')),
  merge_fields text[],
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SEQUENCES (multi-step outreach flows)
-- ============================================================
create table public.sequences (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  vertical text check (vertical in ('multifamily', 'hotel', 'senior_living')),
  description text,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- SEQUENCE STEPS (ordered steps within a sequence)
-- ============================================================
create table public.sequence_steps (
  id uuid primary key default uuid_generate_v4(),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  step_number integer not null,
  channel text not null default 'email' check (channel in ('email', 'linkedin', 'text', 'call')),
  delay_days integer not null default 0,
  template_id uuid references public.email_templates(id) on delete set null,
  subject text,
  body text,
  created_at timestamptz not null default now(),
  unique(sequence_id, step_number)
);

-- ============================================================
-- SEQUENCE ENROLLMENTS (contacts enrolled in sequences)
-- ============================================================
create table public.sequence_enrollments (
  id uuid primary key default uuid_generate_v4(),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  current_step integer not null default 1,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'replied', 'bounced', 'unsubscribed')),
  enrolled_by uuid references auth.users(id),
  next_action_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- EMAIL SENDS (tracking every sent email)
-- ============================================================
create table public.email_sends (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid references public.sequence_enrollments(id) on delete set null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  resend_id text,
  opened_at timestamptz,
  clicked_at timestamptz,
  sent_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROJECTS (won deals converted to active work)
-- ============================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  deal_id uuid references public.deals(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  assigned_to uuid references auth.users(id),
  vertical text not null check (vertical in ('multifamily', 'hotel', 'senior_living')),
  status text not null default 'scoping' check (status in ('scoping', 'in_progress', 'punch_list', 'complete', 'on_hold')),
  contract_value numeric(12,2),
  start_date date,
  target_end_date date,
  actual_end_date date,
  scope_description text,
  notes text,
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ADD fit_rationale AND services_to_lead to organizations
-- (used by import and AI features, was missing from schema)
-- ============================================================
alter table public.organizations add column if not exists fit_rationale text;
alter table public.organizations add column if not exists services_to_lead text;

-- ============================================================
-- ADD last_activity_at to organizations for re-engagement
-- ============================================================
alter table public.organizations add column if not exists last_activity_at timestamptz;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_sequence_steps_sequence on public.sequence_steps(sequence_id);
create index idx_enrollments_contact on public.sequence_enrollments(contact_id);
create index idx_enrollments_sequence on public.sequence_enrollments(sequence_id);
create index idx_enrollments_status on public.sequence_enrollments(status) where status = 'active';
create index idx_enrollments_next_action on public.sequence_enrollments(next_action_at) where status = 'active';
create index idx_email_sends_contact on public.email_sends(contact_id);
create index idx_email_sends_enrollment on public.email_sends(enrollment_id);
create index idx_projects_org on public.projects(org_id) where deleted_at is null;
create index idx_projects_deal on public.projects(deal_id);
create index idx_projects_status on public.projects(status) where deleted_at is null;

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table public.email_templates enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.email_sends enable row level security;
alter table public.projects enable row level security;

-- Read policies (all authenticated users)
create policy "email_templates: read" on public.email_templates for select to authenticated using (true);
create policy "sequences: read" on public.sequences for select to authenticated using (true);
create policy "sequence_steps: read" on public.sequence_steps for select to authenticated using (true);
create policy "sequence_enrollments: read" on public.sequence_enrollments for select to authenticated using (true);
create policy "email_sends: read" on public.email_sends for select to authenticated using (true);
create policy "projects: read" on public.projects for select to authenticated using (true);

-- Write policies (non-viewers only, using existing is_non_viewer() helper)
create policy "email_templates: insert" on public.email_templates for insert to authenticated with check (is_non_viewer());
create policy "email_templates: update" on public.email_templates for update to authenticated using (is_non_viewer());
create policy "email_templates: delete" on public.email_templates for delete to authenticated using (is_non_viewer());

create policy "sequences: insert" on public.sequences for insert to authenticated with check (is_non_viewer());
create policy "sequences: update" on public.sequences for update to authenticated using (is_non_viewer());
create policy "sequences: delete" on public.sequences for delete to authenticated using (is_non_viewer());

create policy "sequence_steps: insert" on public.sequence_steps for insert to authenticated with check (is_non_viewer());
create policy "sequence_steps: update" on public.sequence_steps for update to authenticated using (is_non_viewer());
create policy "sequence_steps: delete" on public.sequence_steps for delete to authenticated using (is_non_viewer());

create policy "enrollments: insert" on public.sequence_enrollments for insert to authenticated with check (is_non_viewer());
create policy "enrollments: update" on public.sequence_enrollments for update to authenticated using (is_non_viewer());

create policy "email_sends: insert" on public.email_sends for insert to authenticated with check (is_non_viewer());
create policy "email_sends: update" on public.email_sends for update to authenticated using (is_non_viewer());

create policy "projects: insert" on public.projects for insert to authenticated with check (is_non_viewer());
create policy "projects: update" on public.projects for update to authenticated using (is_non_viewer());
create policy "projects: delete" on public.projects for delete to authenticated using (is_non_viewer());

-- ============================================================
-- TRIGGER: update last_activity_at on organizations
-- ============================================================
create or replace function update_org_last_activity()
returns trigger as $$
begin
  if new.org_id is not null then
    update public.organizations set last_activity_at = now() where id = new.org_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_activity_update_org_last
  after insert on public.activities
  for each row execute function update_org_last_activity();
