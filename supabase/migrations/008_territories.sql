-- ============================================================
-- ONE70 GROUP CRM - Migration 008
-- Territories: custom regions with rep assignment and targets
-- ============================================================

-- ============================================================
-- TERRITORIES TABLE
-- ============================================================
create table public.territories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#888780',
  states text[] not null default '{}',
  assigned_to uuid references auth.users(id),
  pipeline_target numeric(12,2),
  revenue_target numeric(12,2),
  notes text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ADD territory_id TO CORE TABLES
-- ============================================================
alter table public.organizations add column if not exists territory_id uuid references public.territories(id) on delete set null;
alter table public.deals add column if not exists territory_id uuid references public.territories(id) on delete set null;
alter table public.properties add column if not exists territory_id uuid references public.territories(id) on delete set null;
alter table public.projects add column if not exists territory_id uuid references public.territories(id) on delete set null;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_orgs_territory on public.organizations(territory_id) where deleted_at is null;
create index idx_deals_territory on public.deals(territory_id) where deleted_at is null;
create index idx_properties_territory on public.properties(territory_id);
create index idx_projects_territory on public.projects(territory_id) where deleted_at is null;

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table public.territories enable row level security;

create policy "territories: read" on public.territories for select to authenticated using (true);
create policy "territories: insert" on public.territories for insert to authenticated with check (is_admin());
create policy "territories: update" on public.territories for update to authenticated using (is_admin());
create policy "territories: delete" on public.territories for delete to authenticated using (is_admin());

-- ============================================================
-- AUTO-ASSIGN FUNCTION: match state to territory
-- ============================================================
create or replace function assign_territory_by_state(state_val text)
returns uuid as $$
declare
  terr_id uuid;
begin
  if state_val is null or state_val = '' then return null; end if;
  select id into terr_id from public.territories
    where upper(state_val) = any(states) and is_active = true
    order by sort_order limit 1;
  return terr_id;
end;
$$ language plpgsql stable;

-- ============================================================
-- TRIGGER: auto-assign territory on org insert/update
-- ============================================================
create or replace function auto_assign_org_territory()
returns trigger as $$
begin
  if new.territory_id is null and new.hq_state is not null then
    new.territory_id := assign_territory_by_state(new.hq_state);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_org_territory
  before insert or update of hq_state on public.organizations
  for each row execute function auto_assign_org_territory();

-- ============================================================
-- TRIGGER: auto-assign territory on property insert/update
-- ============================================================
create or replace function auto_assign_property_territory()
returns trigger as $$
begin
  if new.territory_id is null and new.state is not null then
    new.territory_id := assign_territory_by_state(new.state);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_property_territory
  before insert or update of state on public.properties
  for each row execute function auto_assign_property_territory();

-- ============================================================
-- TRIGGER: auto-assign territory on deal (from org)
-- ============================================================
create or replace function auto_assign_deal_territory()
returns trigger as $$
begin
  if new.territory_id is null and new.org_id is not null then
    select territory_id into new.territory_id from public.organizations where id = new.org_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_deal_territory
  before insert on public.deals
  for each row execute function auto_assign_deal_territory();

-- ============================================================
-- SEED 6 TERRITORIES
-- ============================================================
insert into public.territories (name, color, states, sort_order, notes) values
  ('Tri-State / NYC Metro', '#378ADD', '{NY,NJ,CT,MA,RI,NH,VT,ME}', 1, 'Home base. NYC boroughs, Long Island, Northern NJ, Westchester, New England.'),
  ('Mid-Atlantic', '#534AB7', '{PA,DE,MD,DC}', 2, 'Philadelphia, Baltimore, Washington DC. Strong senior living presence.'),
  ('Southeast', '#1D9E75', '{VA,NC,SC,GA}', 3, 'Fastest-growing multifamily markets. Dense hotel corridor on I-95/I-64.'),
  ('Gulf / South', '#D85A30', '{FL,TX,LA,AL,MS}', 4, 'FL and TX are massive hotel PIP markets. Senior living growing fast in FL.'),
  ('Midwest / Great Lakes', '#BA7517', '{OH,MI,IN,KY,WV,TN}', 5, 'Value-add multifamily in Columbus, Nashville, Indianapolis. Breakout markets.'),
  ('New England', '#888780', '{MA,RI,NH,VT,ME}', 6, 'Boston metro. Benchmark Senior Living HQ. Can merge with Tri-State if needed.');

-- ============================================================
-- BACKFILL: assign territories to existing orgs
-- ============================================================
update public.organizations set territory_id = assign_territory_by_state(hq_state)
  where hq_state is not null and territory_id is null;

-- BACKFILL: assign territories to existing properties
update public.properties set territory_id = assign_territory_by_state(state)
  where state is not null and territory_id is null;

-- BACKFILL: assign territories to existing deals (from org)
update public.deals d set territory_id = o.territory_id
  from public.organizations o
  where d.org_id = o.id and d.territory_id is null and o.territory_id is not null;

-- BACKFILL: assign territories to existing projects (from org)
update public.projects p set territory_id = o.territory_id
  from public.organizations o
  where p.org_id = o.id and p.territory_id is null and o.territory_id is not null;
