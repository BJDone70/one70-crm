-- ============================================================
-- ONE70 CRM - Migration 003
-- WebAuthn / Passkeys for Face ID & Biometric Login
-- ============================================================

create table public.passkeys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_name text,
  transports text[], -- e.g. ['internal', 'hybrid']
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index idx_passkeys_user on public.passkeys(user_id);
create index idx_passkeys_credential on public.passkeys(credential_id);

-- Challenges table (temporary, cleaned up after use)
create table public.webauthn_challenges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  challenge text not null,
  type text not null check (type in ('registration', 'authentication')),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

create index idx_challenges_user on public.webauthn_challenges(user_id);

-- RLS
alter table public.passkeys enable row level security;
alter table public.webauthn_challenges enable row level security;

-- Passkeys: users see only their own
create policy "Passkeys: read own" on public.passkeys for select to authenticated using (user_id = auth.uid());
create policy "Passkeys: insert own" on public.passkeys for insert to authenticated with check (user_id = auth.uid());
create policy "Passkeys: delete own" on public.passkeys for delete to authenticated using (user_id = auth.uid());
create policy "Passkeys: update own" on public.passkeys for update to authenticated using (user_id = auth.uid());

-- Challenges: need service role for auth flow (handled via admin client)
-- Public read for validation during auth (challenge is single-use and expires)
create policy "Challenges: read" on public.webauthn_challenges for select to authenticated using (true);
create policy "Challenges: insert" on public.webauthn_challenges for insert to authenticated with check (true);
create policy "Challenges: anon read" on public.webauthn_challenges for select to anon using (true);

-- Cleanup: delete expired challenges (run periodically or on each auth)
create or replace function public.cleanup_expired_challenges()
returns void as $$
  delete from public.webauthn_challenges where expires_at < now();
$$ language sql security definer;
