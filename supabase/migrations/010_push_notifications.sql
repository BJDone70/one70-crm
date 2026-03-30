-- ============================================================
-- ONE70 CRM - Migration 010
-- Push Notifications: Device tokens + notification preferences
-- ============================================================

-- ============================================================
-- 1. DEVICE TOKENS TABLE
-- Stores APNs/FCM tokens for each user's devices
-- ============================================================
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, token)
);

create index idx_device_tokens_user on public.device_tokens(user_id) where is_active = true;
create index idx_device_tokens_token on public.device_tokens(token);

alter table public.device_tokens enable row level security;

-- Users can manage their own tokens
create policy "Device tokens: read own" on public.device_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "Device tokens: insert own" on public.device_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "Device tokens: update own" on public.device_tokens
  for update to authenticated using (user_id = auth.uid());
create policy "Device tokens: delete own" on public.device_tokens
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- 2. NOTIFICATION PREFERENCES TABLE
-- Per-user notification settings
-- ============================================================
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  task_due_today boolean default true,
  task_assigned boolean default true,
  deal_stage_changed boolean default true,
  deal_won boolean default true,
  deal_lost boolean default true,
  sequence_action_due boolean default true,
  project_status_changed boolean default true,
  daily_digest boolean default false,
  quiet_hours_start time, -- e.g., '22:00'
  quiet_hours_end time,   -- e.g., '07:00'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notification_preferences enable row level security;

create policy "Notification prefs: read own" on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "Notification prefs: insert own" on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "Notification prefs: update own" on public.notification_preferences
  for update to authenticated using (user_id = auth.uid());

-- ============================================================
-- 3. NOTIFICATIONS LOG TABLE
-- Track sent notifications for debugging and analytics
-- ============================================================
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  category text not null, -- 'task_due', 'task_assigned', 'deal_stage', 'deal_won', 'deal_lost', 'sequence', 'project', 'digest'
  data jsonb default '{}',
  sent_at timestamptz default now(),
  delivered boolean default false,
  error text
);

create index idx_notification_log_user on public.notification_log(user_id, sent_at desc);

alter table public.notification_log enable row level security;

create policy "Notification log: read own" on public.notification_log
  for select to authenticated using (user_id = auth.uid());
-- Insert via service role only (server-side)
create policy "Notification log: insert" on public.notification_log
  for insert to authenticated with check (public.is_non_viewer());
