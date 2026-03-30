-- ============================================================
-- ONE70 GROUP CRM - Initial Schema
-- Migration 001: Foundation tables, RLS policies, audit logging
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'rep' check (role in ('admin', 'rep', 'viewer')),
  avatar_url text,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id),
  invited_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- USER INVITES
-- ============================================================
create table public.user_invites (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  role text not null default 'rep' check (role in ('admin', 'rep', 'viewer')),
  invited_by uuid not null references auth.users(id),
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  accepted_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  vertical text not null check (vertical in ('multifamily', 'hotel', 'senior_living')),
  hq_city text,
  hq_state text,
  portfolio_size integer,
  annual_spend text,
  website text,
  phone text,
  priority_rating text check (priority_rating in ('high', 'medium_high', 'medium', 'low')),
  source text,
  notes text,
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CONTACTS
-- ============================================================
create table public.contacts (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  org_id uuid references public.organizations(id) on delete set null,
  is_decision_maker boolean not null default false,
  preferred_channel text check (preferred_channel in ('email', 'linkedin', 'phone', 'text')),
  notes text,
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROPERTIES
-- ============================================================
create table public.properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  city text,
  state text,
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_type text,
  -- Multifamily fields
  unit_count integer,
  common_area_scope text,
  -- Hotel fields
  key_count integer,
  brand_flag text,
  pip_status text check (pip_status in ('active', 'upcoming', 'completed', 'none', null)),
  pip_deadline date,
  -- Senior Living fields
  bed_count integer,
  acuity_level text check (acuity_level in ('independent', 'assisted', 'memory_care', 'skilled_nursing', 'mixed', null)),
  -- Common
  notes text,
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DEALS
-- ============================================================
create table public.deals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  org_id uuid references public.organizations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  vertical text not null check (vertical in ('multifamily', 'hotel', 'senior_living')),
  stage text not null default 'lead' check (stage in ('lead', 'contacted', 'discovery', 'site_walk', 'proposal', 'negotiation', 'won', 'lost')),
  value numeric(12,2),
  expected_close date,
  assigned_to uuid references auth.users(id),
  services_offered text,
  message_theme text,
  loss_reason text,
  notes text,
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ACTIVITIES
-- ============================================================
create table public.activities (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('call', 'email', 'meeting', 'note', 'linkedin', 'text', 'site_visit', 'other')),
  subject text,
  body text,
  direction text check (direction in ('inbound', 'outbound', null)),
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  file_url text not null,
  file_size integer,
  mime_type text,
  record_type text not null,
  record_id uuid not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- TAGS
-- ============================================================
create table public.tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#FFE500',
  created_at timestamptz not null default now()
);

create table public.record_tags (
  id uuid primary key default uuid_generate_v4(),
  tag_id uuid not null references public.tags(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  created_at timestamptz not null default now(),
  unique(tag_id, record_type, record_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null check (action in ('create', 'update', 'delete')),
  table_name text not null,
  record_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_organizations_vertical on public.organizations(vertical) where deleted_at is null;
create index idx_organizations_priority on public.organizations(priority_rating) where deleted_at is null;
create index idx_contacts_org on public.contacts(org_id) where deleted_at is null;
create index idx_contacts_email on public.contacts(email) where deleted_at is null;
create index idx_properties_org on public.properties(org_id) where deleted_at is null;
create index idx_deals_org on public.deals(org_id) where deleted_at is null;
create index idx_deals_stage on public.deals(stage) where deleted_at is null;
create index idx_deals_assigned on public.deals(assigned_to) where deleted_at is null;
create index idx_deals_vertical on public.deals(vertical) where deleted_at is null;
create index idx_activities_contact on public.activities(contact_id);
create index idx_activities_deal on public.activities(deal_id);
create index idx_activities_org on public.activities(org_id);
create index idx_activities_user on public.activities(user_id);
create index idx_activities_occurred on public.activities(occurred_at desc);
create index idx_audit_log_table on public.audit_log(table_name, record_id);
create index idx_audit_log_user on public.audit_log(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.user_invites enable row level security;
alter table public.organizations enable row level security;
alter table public.contacts enable row level security;
alter table public.properties enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.documents enable row level security;
alter table public.tags enable row level security;
alter table public.record_tags enable row level security;
alter table public.audit_log enable row level security;

-- Helper: check if user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$ language sql security definer stable;

-- Helper: check if user is active (any role)
create or replace function public.is_active_user()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$ language sql security definer stable;

-- PROFILES: everyone sees all profiles, only admin edits others
create policy "Profiles: read all" on public.profiles for select to authenticated using (true);
create policy "Profiles: update own" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Profiles: admin update" on public.profiles for update to authenticated using (public.is_admin());
create policy "Profiles: insert own" on public.profiles for insert to authenticated with check (id = auth.uid());

-- USER INVITES: admin only
create policy "Invites: admin read" on public.user_invites for select to authenticated using (public.is_admin());
create policy "Invites: admin create" on public.user_invites for insert to authenticated with check (public.is_admin());
create policy "Invites: admin update" on public.user_invites for update to authenticated using (public.is_admin());

-- DATA TABLES: all active users can read, non-viewers can write
-- Organizations
create policy "Orgs: read" on public.organizations for select to authenticated using (public.is_active_user() and deleted_at is null);
create policy "Orgs: insert" on public.organizations for insert to authenticated with check (public.is_active_user());
create policy "Orgs: update" on public.organizations for update to authenticated using (public.is_active_user());

-- Contacts
create policy "Contacts: read" on public.contacts for select to authenticated using (public.is_active_user() and deleted_at is null);
create policy "Contacts: insert" on public.contacts for insert to authenticated with check (public.is_active_user());
create policy "Contacts: update" on public.contacts for update to authenticated using (public.is_active_user());

-- Properties
create policy "Properties: read" on public.properties for select to authenticated using (public.is_active_user() and deleted_at is null);
create policy "Properties: insert" on public.properties for insert to authenticated with check (public.is_active_user());
create policy "Properties: update" on public.properties for update to authenticated using (public.is_active_user());

-- Deals
create policy "Deals: read" on public.deals for select to authenticated using (public.is_active_user() and deleted_at is null);
create policy "Deals: insert" on public.deals for insert to authenticated with check (public.is_active_user());
create policy "Deals: update" on public.deals for update to authenticated using (public.is_active_user());

-- Activities
create policy "Activities: read" on public.activities for select to authenticated using (public.is_active_user());
create policy "Activities: insert" on public.activities for insert to authenticated with check (public.is_active_user());

-- Documents
create policy "Documents: read" on public.documents for select to authenticated using (public.is_active_user());
create policy "Documents: insert" on public.documents for insert to authenticated with check (public.is_active_user());

-- Tags
create policy "Tags: read" on public.tags for select to authenticated using (true);
create policy "Tags: insert" on public.tags for insert to authenticated with check (public.is_active_user());
create policy "Record tags: read" on public.record_tags for select to authenticated using (true);
create policy "Record tags: insert" on public.record_tags for insert to authenticated with check (public.is_active_user());
create policy "Record tags: delete" on public.record_tags for delete to authenticated using (public.is_active_user());

-- Audit log: admin read only
create policy "Audit: admin read" on public.audit_log for select to authenticated using (public.is_admin());
create policy "Audit: system insert" on public.audit_log for insert to authenticated with check (true);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'rep')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- AUTO-UPDATE updated_at TIMESTAMPS
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.organizations for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.contacts for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.properties for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.deals for each row execute function public.update_updated_at();
