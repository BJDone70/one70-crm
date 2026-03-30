-- ============================================================
-- ONE70 CRM - Migration 002
-- Tasks, Key Notes, Referral Tracking
-- ============================================================

-- ============================================================
-- TASKS (follow-ups, next steps, todos)
-- ============================================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  type text not null default 'follow_up' check (type in ('follow_up', 'next_step', 'todo', 'reminder')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  due_date date,
  due_time time,
  completed_at timestamptz,
  -- Linked records (all optional, task can link to any combination)
  contact_id uuid references public.contacts(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  -- Assignment
  assigned_to uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- KEY NOTES (special dates, personal details on contacts)
-- ============================================================
create table public.key_notes (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  category text not null check (category in ('birthday', 'anniversary', 'holiday', 'preference', 'family', 'hobby', 'important_date', 'other')),
  title text not null,
  note text,
  -- For date-based reminders
  reminder_date date,
  reminder_recurring boolean not null default false,
  last_reminded_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ADD REFERRAL FIELDS TO CONTACTS
-- ============================================================
alter table public.contacts add column if not exists is_referrer boolean not null default false;
alter table public.contacts add column if not exists referred_by uuid references public.contacts(id) on delete set null;
alter table public.contacts add column if not exists referral_notes text;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_tasks_assigned on public.tasks(assigned_to) where deleted_at is null;
create index idx_tasks_due on public.tasks(due_date) where deleted_at is null and status = 'pending';
create index idx_tasks_status on public.tasks(status) where deleted_at is null;
create index idx_tasks_contact on public.tasks(contact_id) where deleted_at is null;
create index idx_tasks_org on public.tasks(org_id) where deleted_at is null;
create index idx_tasks_deal on public.tasks(deal_id) where deleted_at is null;
create index idx_key_notes_contact on public.key_notes(contact_id);
create index idx_key_notes_reminder on public.key_notes(reminder_date) where reminder_recurring = true or reminder_date >= current_date;
create index idx_contacts_referrer on public.contacts(is_referrer) where is_referrer = true and deleted_at is null;
create index idx_contacts_referred_by on public.contacts(referred_by) where referred_by is not null and deleted_at is null;

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table public.tasks enable row level security;
alter table public.key_notes enable row level security;

-- Tasks: all active users can read, non-viewers can write
create policy "Tasks: read" on public.tasks for select to authenticated using (public.is_active_user() and deleted_at is null);
create policy "Tasks: insert" on public.tasks for insert to authenticated with check (public.is_active_user());
create policy "Tasks: update" on public.tasks for update to authenticated using (public.is_active_user());

-- Key Notes: all active users can read, non-viewers can write
create policy "Key notes: read" on public.key_notes for select to authenticated using (public.is_active_user());
create policy "Key notes: insert" on public.key_notes for insert to authenticated with check (public.is_active_user());
create policy "Key notes: update" on public.key_notes for update to authenticated using (public.is_active_user());
create policy "Key notes: delete" on public.key_notes for delete to authenticated using (public.is_active_user());

-- ============================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================
create trigger set_updated_at before update on public.tasks for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.key_notes for each row execute function public.update_updated_at();
