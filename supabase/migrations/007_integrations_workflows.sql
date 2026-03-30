-- ============================================================
-- ONE70 GROUP CRM - Migration 007
-- Integrations, Workflows, Email/Calendar Sync
-- ============================================================

-- ============================================================
-- INTEGRATION CONNECTIONS (OAuth tokens, API keys)
-- ============================================================
create table public.integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'apollo')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  api_key text,
  email_address text,
  scopes text[],
  is_active boolean not null default true,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

-- ============================================================
-- SYNCED EMAILS (emails logged from Gmail/Outlook)
-- ============================================================
create table public.synced_emails (
  id uuid primary key default uuid_generate_v4(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  external_id text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  subject text,
  snippet text,
  from_email text,
  to_emails text[],
  direction text check (direction in ('inbound', 'outbound')),
  received_at timestamptz,
  synced_at timestamptz not null default now(),
  unique(integration_id, external_id)
);

-- ============================================================
-- SYNCED CALENDAR EVENTS
-- ============================================================
create table public.synced_events (
  id uuid primary key default uuid_generate_v4(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  external_id text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  title text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  location text,
  attendees text[],
  synced_at timestamptz not null default now(),
  unique(integration_id, external_id)
);

-- ============================================================
-- WORKFLOW DEFINITIONS
-- ============================================================
create table public.workflows (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  trigger_type text not null check (trigger_type in ('deal_stage_change', 'deal_won', 'deal_lost', 'new_contact', 'inactivity')),
  trigger_config jsonb not null default '{}',
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WORKFLOW ACTIONS (ordered actions within a workflow)
-- ============================================================
create table public.workflow_actions (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  action_order integer not null,
  action_type text not null check (action_type in ('create_project', 'send_email', 'create_task', 'enroll_sequence', 'notify_team', 'update_field')),
  action_config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- WORKFLOW EXECUTION LOG
-- ============================================================
create table public.workflow_log (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  trigger_record_id uuid,
  trigger_record_type text,
  status text not null default 'success' check (status in ('success', 'partial', 'failed')),
  actions_executed integer not null default 0,
  error_message text,
  executed_at timestamptz not null default now()
);

-- ============================================================
-- ADD source_channel to activities (for channel ROI tracking)
-- ============================================================
alter table public.activities add column if not exists source_channel text;

-- ============================================================
-- ADD stage probability weights to a config table
-- ============================================================
create table public.pipeline_config (
  stage text primary key,
  probability integer not null default 0,
  sort_order integer not null default 0
);

insert into public.pipeline_config (stage, probability, sort_order) values
  ('lead', 10, 1),
  ('contacted', 20, 2),
  ('discovery', 35, 3),
  ('site_walk', 50, 4),
  ('proposal', 70, 5),
  ('negotiation', 85, 6),
  ('won', 100, 7),
  ('lost', 0, 8);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_integrations_user on public.integrations(user_id);
create index idx_synced_emails_contact on public.synced_emails(contact_id);
create index idx_synced_emails_integration on public.synced_emails(integration_id);
create index idx_synced_events_integration on public.synced_events(integration_id);
create index idx_workflow_actions_workflow on public.workflow_actions(workflow_id);
create index idx_workflow_log_workflow on public.workflow_log(workflow_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table public.integrations enable row level security;
alter table public.synced_emails enable row level security;
alter table public.synced_events enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_actions enable row level security;
alter table public.workflow_log enable row level security;
alter table public.pipeline_config enable row level security;

-- Integrations: users can only see their own
create policy "integrations: own read" on public.integrations for select to authenticated
  using (user_id = auth.uid());
create policy "integrations: own insert" on public.integrations for insert to authenticated
  with check (user_id = auth.uid());
create policy "integrations: own update" on public.integrations for update to authenticated
  using (user_id = auth.uid());
create policy "integrations: own delete" on public.integrations for delete to authenticated
  using (user_id = auth.uid());

-- Synced emails/events: readable by all authenticated (team-wide visibility)
create policy "synced_emails: read" on public.synced_emails for select to authenticated using (true);
create policy "synced_emails: insert" on public.synced_emails for insert to authenticated with check (is_non_viewer());
create policy "synced_events: read" on public.synced_events for select to authenticated using (true);
create policy "synced_events: insert" on public.synced_events for insert to authenticated with check (is_non_viewer());

-- Workflows: all authenticated can read, non-viewers can write
create policy "workflows: read" on public.workflows for select to authenticated using (true);
create policy "workflows: insert" on public.workflows for insert to authenticated with check (is_non_viewer());
create policy "workflows: update" on public.workflows for update to authenticated using (is_non_viewer());
create policy "workflow_actions: read" on public.workflow_actions for select to authenticated using (true);
create policy "workflow_actions: insert" on public.workflow_actions for insert to authenticated with check (is_non_viewer());
create policy "workflow_log: read" on public.workflow_log for select to authenticated using (true);
create policy "workflow_log: insert" on public.workflow_log for insert to authenticated with check (true);

-- Pipeline config: readable by all
create policy "pipeline_config: read" on public.pipeline_config for select to authenticated using (true);
create policy "pipeline_config: update" on public.pipeline_config for update to authenticated using (is_admin());
