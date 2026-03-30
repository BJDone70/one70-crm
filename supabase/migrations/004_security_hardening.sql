-- ============================================================
-- ONE70 CRM - Migration 004
-- Security Hardening
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTION: is_non_viewer()
-- Returns true only if user is active AND not a viewer
-- ============================================================
create or replace function public.is_non_viewer()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('admin', 'rep')
  );
$$ language sql security definer stable;

-- ============================================================
-- 2. HELPER FUNCTION: is_admin()
-- Returns true only if user is active AND an admin
-- ============================================================
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = 'admin'
  );
$$ language sql security definer stable;

-- ============================================================
-- 3. TIGHTEN WRITE POLICIES ON ALL TABLES
-- Drop old permissive insert/update policies, recreate with role check
-- ============================================================

-- ORGANIZATIONS
drop policy if exists "Orgs: insert" on public.organizations;
drop policy if exists "Orgs: update" on public.organizations;
create policy "Orgs: insert" on public.organizations for insert to authenticated with check (public.is_non_viewer());
create policy "Orgs: update" on public.organizations for update to authenticated using (public.is_non_viewer());

-- CONTACTS
drop policy if exists "Contacts: insert" on public.contacts;
drop policy if exists "Contacts: update" on public.contacts;
create policy "Contacts: insert" on public.contacts for insert to authenticated with check (public.is_non_viewer());
create policy "Contacts: update" on public.contacts for update to authenticated using (public.is_non_viewer());

-- PROPERTIES
drop policy if exists "Properties: insert" on public.properties;
drop policy if exists "Properties: update" on public.properties;
create policy "Properties: insert" on public.properties for insert to authenticated with check (public.is_non_viewer());
create policy "Properties: update" on public.properties for update to authenticated using (public.is_non_viewer());

-- DEALS
drop policy if exists "Deals: insert" on public.deals;
drop policy if exists "Deals: update" on public.deals;
create policy "Deals: insert" on public.deals for insert to authenticated with check (public.is_non_viewer());
create policy "Deals: update" on public.deals for update to authenticated using (public.is_non_viewer());

-- ACTIVITIES
drop policy if exists "Activities: insert" on public.activities;
drop policy if exists "Activities: update" on public.activities;
create policy "Activities: insert" on public.activities for insert to authenticated with check (public.is_non_viewer());
create policy "Activities: update" on public.activities for update to authenticated using (public.is_non_viewer());

-- TASKS
drop policy if exists "Tasks: insert" on public.tasks;
drop policy if exists "Tasks: update" on public.tasks;
create policy "Tasks: insert" on public.tasks for insert to authenticated with check (public.is_non_viewer());
create policy "Tasks: update" on public.tasks for update to authenticated using (public.is_non_viewer());

-- KEY NOTES
drop policy if exists "Key notes: insert" on public.key_notes;
drop policy if exists "Key notes: update" on public.key_notes;
drop policy if exists "Key notes: delete" on public.key_notes;
create policy "Key notes: insert" on public.key_notes for insert to authenticated with check (public.is_non_viewer());
create policy "Key notes: update" on public.key_notes for update to authenticated using (public.is_non_viewer());
create policy "Key notes: delete" on public.key_notes for delete to authenticated using (public.is_non_viewer());

-- DOCUMENTS
drop policy if exists "Documents: insert" on public.documents;
drop policy if exists "Documents: update" on public.documents;
create policy "Documents: insert" on public.documents for insert to authenticated with check (public.is_non_viewer());
create policy "Documents: update" on public.documents for update to authenticated using (public.is_non_viewer());

-- TAGS
drop policy if exists "Tags: insert" on public.tags;
drop policy if exists "Tags: update" on public.tags;
create policy "Tags: insert" on public.tags for insert to authenticated with check (public.is_non_viewer());
create policy "Tags: update" on public.tags for update to authenticated using (public.is_non_viewer());

-- RECORD_TAGS
drop policy if exists "Record tags: insert" on public.record_tags;
drop policy if exists "Record tags: delete" on public.record_tags;
create policy "Record tags: insert" on public.record_tags for insert to authenticated with check (public.is_non_viewer());
create policy "Record tags: delete" on public.record_tags for delete to authenticated using (public.is_non_viewer());

-- USER INVITES (admin only)
drop policy if exists "Invites: insert" on public.user_invites;
drop policy if exists "Invites: update" on public.user_invites;
create policy "Invites: insert" on public.user_invites for insert to authenticated with check (public.is_admin());
create policy "Invites: update" on public.user_invites for update to authenticated using (public.is_admin());

-- PROFILES (admin can update any, users can update own)
drop policy if exists "Profiles: update" on public.profiles;
create policy "Profiles: update own" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Profiles: admin update" on public.profiles for update to authenticated using (public.is_admin());

-- ============================================================
-- 4. BLOCK DIRECT SIGNUP
-- Add a trigger that prevents profile creation for users
-- who were not invited. The invite flow sets the profile via
-- service_role, so this only blocks direct signups.
-- ============================================================
create or replace function public.check_invite_exists()
returns trigger as $$
begin
  -- Allow if profile is being created by service_role (invite flow)
  -- or if the user has an accepted invite
  if exists (
    select 1 from public.user_invites
    where email = NEW.email
      and status = 'accepted'
  ) then
    return NEW;
  end if;

  -- Allow the first user (bootstrap admin)
  if (select count(*) from public.profiles) = 0 then
    return NEW;
  end if;

  -- Block all other signups
  raise exception 'Signup not allowed. Contact an administrator for an invite.';
end;
$$ language plpgsql security definer;

-- Only create the trigger if it doesn't exist
drop trigger if exists enforce_invite_only on public.profiles;
create trigger enforce_invite_only
  before insert on public.profiles
  for each row
  execute function public.check_invite_exists();

-- ============================================================
-- 5. AUTO-CLEANUP EXPIRED CHALLENGES
-- Runs every time a new challenge is created
-- ============================================================
create or replace function public.auto_cleanup_challenges()
returns trigger as $$
begin
  delete from public.webauthn_challenges where expires_at < now();
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists cleanup_challenges_on_insert on public.webauthn_challenges;
create trigger cleanup_challenges_on_insert
  after insert on public.webauthn_challenges
  for each row
  execute function public.auto_cleanup_challenges();
