# ONE70 CRM — Continuation Guide
## Last Updated: March 27, 2026

---

## CREDENTIALS & INFRASTRUCTURE

- **Supabase URL:** `https://jmwwngvleszbdlevabbh.supabase.co`
- **Anon Key:** Available in Vercel env vars (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) or Supabase Dashboard → Settings → API
- **Service Role Key:** Available in Vercel env vars (`SUPABASE_SERVICE_ROLE_KEY`) or Supabase Dashboard → Settings → API. **Never commit this to git.**
- **Production URL:** `https://crm.one70group.com`
- **GitHub Repo:** `https://github.com/BJDone70/one70-crm.git`
- **Supabase Plan:** Pro
- **Hosting:** Vercel (auto-deploys from GitHub main branch)
- **iOS:** Native via Codemagic → TestFlight (capacitor-based)

---

## DEPLOY INSTRUCTIONS (PowerShell)

```powershell
cd ~\Downloads
tar -xzf one70-crm-release7.tar.gz
cd one70-crm
git init
git remote add origin https://github.com/BJDone70/one70-crm.git
git branch -m main
git add -A
git commit -m "Release 7"
git push -u origin main --force
```

---

## TECH STACK

- **Framework:** Next.js 14 (App Router) with TypeScript
- **Database:** Supabase (PostgreSQL) with RLS
- **Auth:** Supabase Auth (email/password + magic link)
- **Styling:** Tailwind CSS with ONE70 brand tokens (black, yellow #FFE500, white)
- **Mobile:** Capacitor for native iOS wrapper
- **Email Integration:** Microsoft Graph API (OAuth2, M365)
- **AI:** Anthropic API (claude-sonnet-4-20250514) for assistant + writing style
- **Document generation:** Node.js `docx` library for DOCX, build scripts in project
- **Storage:** Supabase Storage (avatars, documents)
- **Cron:** Vercel cron jobs (vercel.json)

---

## DATABASE SCHEMA (KEY TABLES)

### Core CRM
- `organizations` — name, vertical, org_role, hq_city, hq_state, portfolio_size, annual_spend, website, linkedin_url, phone, priority_rating, source, territory_id, notes, deleted_at
- `contacts` — first_name, last_name, title, email, phone, mobile_phone, linkedin_url, org_id, contact_type, rating (cold/warm/active), avatar_url, is_decision_maker, is_prime_contact, is_referrer, referred_by, referral_notes, preferred_channel, notes, deleted_at
- `deals` — name, org_id, contact_id, property_id, stage, vertical, value, assigned_to, territory_id, loss_reason, notes, deleted_at
- `properties` — name, org_id, address (+city/state/zip), vertical, unit_count, key_count, bed_count, star_rating, year_built, last_renovation, deleted_at
- `projects` — name, org_id, contact_id, property_id, deal_id, vertical, status, project_type, contract_value, start_date, end_date, assigned_to, notes, deleted_at
- `tasks` — title, description, type, priority, status, due_date, due_time, assigned_to, created_by, contact_id, org_id, deal_id, parent_task_id, is_private, completed_at
- `activities` — type, body, source_channel, user_id, contact_id, org_id, deal_id, occurred_at
- `sequences` — name, vertical, status, steps (jsonb)
- `email_sends` — sequence_id, contact_id, step_number, status, sent_at, opened_at, replied_at

### Lookup/Config Tables
- `custom_verticals` — name (string, snake_case)
- `contact_types` — name, label, color (Client, Prospect, Strategic Partner, Vendor, Internal + custom)
- `org_roles` — name, label, sort_order (Owner/Operator, Developer, Architect/Designer, GC/Contractor, Procurement/FF&E, Capital, Advisor, Vendor + custom)
- `pipeline_config` — stage, label, color, sort_order, is_terminal
- `project_stages` — id (slug), label, color, sort_order, is_terminal
- `custom_roles` — name, label, permissions (jsonb), 19 permission flags
- `territories` — name, color, assigned_to, pipeline_target, revenue_target, is_active, sort_order, notes

### Multi-relation Tables
- `contact_organizations` — contact_id, org_id, role (many-to-many affiliations)
- `deal_stage_history` — deal_id, stage, entered_at, exited_at (velocity tracking)

### M365 Integration
- `m365_tokens` — user_id, access_token, refresh_token, token_expires_at, connected_email, connected_at, last_sync_at, sync_status, sync_error
- `emails` — message_id, user_id, subject, from_address, to_addresses, received_at, body_preview, folder, is_read, has_attachments, importance, web_link
- `calendar_events` — event_id, user_id, subject, start_time, end_time, location, organizer, attendees, is_all_day, web_link

### System Tables
- `profiles` — id (=auth.users.id), full_name, role, is_active, push_subscription (jsonb)
- `notifications` — user_id, type, title, body, link, is_read, created_at
- `task_updates` — task_id, user_id, body, update_type (step/status_change/note/reassigned)
- `feedback` — user_id, subject, body, type, status, created_at
- `feedback_comments` — feedback_id, user_id, body, created_at
- `key_notes` — contact_id, title, note, category, reminder_date, reminder_recurring
- `documents` — org_id, contact_id, deal_id, project_id, file_name, file_url, uploaded_by
- `user_style_profiles` — user_id, style_instruction, sample_count, analyzed_at

---

## KEY FILE PATHS

### API Routes
- `/api/assistant/route.ts` — AI assistant with 16 tools
- `/api/m365/connect/route.ts` — M365 OAuth initiation
- `/api/m365/callback/route.ts` — M365 OAuth callback
- `/api/send-email/route.ts` — Send email via Graph
- `/api/search-recipients/route.ts` — CRM + M365 People autocomplete
- `/api/m365/contacts/route.ts` — Import M365 contacts
- `/api/style-profile/route.ts` — Writing style analysis
- `/api/cron/backup/route.ts` — Weekly data backup
- `/api/cron/email-monitor/route.ts` — Unreplied email detection
- `/api/cron/m365-sync/route.ts` — Email + calendar sync
- `/api/notifications/task/route.ts` — Task notifications
- `/api/notifications/feedback/route.ts` — Feedback notifications
- `/api/notifications/push/route.ts` — Push notification sender

### Core Libraries
- `src/lib/supabase/server.ts` — Server-side Supabase client
- `src/lib/supabase/client.ts` — Client-side Supabase client
- `src/lib/microsoft-graph.ts` — Graph API helpers with token refresh
- `src/lib/stages.ts` — Pipeline stage constants
- `src/lib/verticals.ts` — Vertical defaults + formatting
- `src/lib/contact-types.ts` — Server-safe contact type labels/colors
- `src/lib/org-roles.ts` — Server-safe org role labels
- `src/lib/project-stages.ts` — Server-safe project stage loading
- `src/lib/notify.ts` — Notification creation helper
- `src/lib/ai-utils.ts` — AI assistant system prompt + tool definitions

### Hooks (Client-side)
- `src/hooks/use-verticals.ts` — Load verticals + addVertical()
- `src/hooks/use-contact-types.ts` — Load contact types + add custom
- `src/hooks/use-org-roles.ts` — Load org roles + addRole()
- `src/hooks/use-project-stages.ts` — Load configurable project stages

### Key Components
- `src/components/contact-form.tsx` — Full contact CRUD with duplicate detection, rating, photo, multi-org
- `src/components/org-form.tsx` — Org CRUD with vertical + role inline add
- `src/components/deal-form.tsx` — Deal CRUD with VerticalSelector
- `src/components/task-form.tsx` — Task CRUD with parent_task_id + contact company display
- `src/components/property-form.tsx` — Property CRUD with Google Places autocomplete
- `src/components/vertical-selector.tsx` — Reusable vertical picker (select or pills) with inline add
- `src/components/compose-email.tsx` — Email composition with recipient autocomplete
- `src/components/recipient-input.tsx` — Autocomplete input for email recipients
- `src/components/import-m365-contacts.tsx` — Import contacts from M365
- `src/components/notification-bell.tsx` — Bell icon with count + dropdown
- `src/components/contact-timeline.tsx` — Unified chronological activity view
- `src/components/key-notes.tsx` — Birthday, preferences, personal notes with reminders
- `src/components/ai-draft.tsx` — AI outreach drafting
- `src/components/ai-meeting-prep.tsx` — AI meeting prep briefings
- `src/components/ai-note-processor.tsx` — AI note processing
- `src/components/writing-style-profile.tsx` — Writing style training UI
- `src/components/pill-filter.tsx` — Reusable pill-style filter component
- `src/components/territory-filter.tsx` — Territory multi-select filter
- `src/components/admin-delete.tsx` — Soft-delete button (admin only)
- `src/components/quick-add-contact.tsx` — Slide-out quick add
- `src/components/save-to-phone.tsx` — vCard export for contacts

### Admin Pages
- `/settings/users/page.tsx` — User management, invite, password reset
- `/settings/roles/page.tsx` — Custom roles + 19 permissions
- `/settings/project-stages/page.tsx` — Configurable project stages
- `/settings/territories/page.tsx` — Territory management
- `/settings/integrations/page.tsx` — M365 connect/disconnect, writing style
- `/settings/data/page.tsx` — Manual backup export
- `/settings/notifications/page.tsx` — Notification preferences

---

## CRON SCHEDULE (vercel.json)

- `/api/cron/backup` — Weekly Monday 6am ET
- `/api/cron/email-monitor` — 3x daily (8am, 12pm, 5pm ET)
- `/api/cron/m365-sync` — 5x daily (7am, 10am, 1pm, 4pm, 7pm ET)

---

## M365 AZURE SETUP

- App registered in Microsoft Entra ID
- Admin consent granted for all 12 permissions
- Redirect URI: `https://crm.one70group.com/api/m365/callback`
- OAuth prompt: `select_account` (NOT consent — causes infinite loop)
- Enterprise Apps → Properties → "Assignment required" must be set to **No**
- Scopes: openid, profile, email, offline_access, Mail.Read, Mail.ReadWrite, Mail.Send, Calendars.Read, Calendars.ReadWrite, Contacts.Read, People.Read, User.Read

---

## AI ASSISTANT TOOLS (16)

search_contacts, search_deals, search_organizations, create_task, log_activity, move_deal_stage, create_contact, get_my_tasks, get_outreach_due, get_pipeline_summary, search_projects, get_recent_activities, web_search, search_emails, search_calendar, send_email

---

## DESIGN PREFERENCES

- **Brand colors:** Black (#000), Yellow (#FFE500), White, Gray (#F5F5F5)
- **Document layout:** Preserve established layouts, add new elements as clean accents (not replacements). Logos as smaller right-aligned accents in two-column header.
- **Logo files:** `ONE70_Logo_final.jpg` (1316×924px), `ONE70_Logo_300x300.jpg`, white variants as PNG
- **Logo handling:** ImageRun requires pixel dimensions, not EMU
- **Build scripts:** `build_onepager_multifamily.js`, `build_onepager_hotel.js` (Node.js + `docx` library)
- **Tech stack philosophy:** Keep lean — avoid redundant tools when one platform handles it

---

## MIGRATIONS APPLIED (in order)

017: task_updates
018: m365_tokens  
019: notifications + deal_stage_history
020: contact_types, contact_organizations, custom_roles
021: user_style_profiles (**PENDING — SQL not yet run**)
022: project_stages
023: contact enhancements (avatar_url, rating, parent_task_id, type rename)
024: org_roles

### SQL for migration 021 (still needs to be run):
```sql
CREATE TABLE IF NOT EXISTS user_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  style_instruction TEXT NOT NULL,
  sample_count INTEGER DEFAULT 0,
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_style_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own style" ON user_style_profiles;
CREATE POLICY "Users can view own style" ON user_style_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own style" ON user_style_profiles;
CREATE POLICY "Users can manage own style" ON user_style_profiles FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access style" ON user_style_profiles;
CREATE POLICY "Service role full access style" ON user_style_profiles FOR ALL USING (auth.role() = 'service_role');
```

### CHECK constraints that have been dropped (do NOT recreate):
- deals_vertical_check
- properties_vertical_check
- projects_vertical_check
- sequences_vertical_check
- profiles_role_check

---

## PENDING / FUTURE WORK

1. Migration 021 `user_style_profiles` — SQL needs to be run in Supabase
2. Codemagic rebuild for iOS `resize:'native'` keyboard fix
3. Share Sheet extension — built but excluded from Codemagic build pending reintegration
4. Enhanced reporting — scheduled email reports, PDF pipeline snapshots
5. Workflow builder expansion — admin UI for creating/editing workflows
6. Deeper M365 — reply-to-thread, attachment handling
7. Feedback thread notifications — currently only notifies original creator, not all thread participants
8. Senior living vertical — newest, most room for prospecting development
9. Apollo.io integration — $49/month recommended plan, filters/NAICS codes documented in master prospect DB

---

## FEATURE INVENTORY (50+)

### Core CRM
Organizations, Contacts, Deals (pipeline), Properties, Projects, Tasks, Activities, Sequences/Outreach, Territories

### Contact Features
Duplicate detection (email/name/phone), rating (cold/warm/active), photo/avatar upload, multi-org affiliations, contact types (5 defaults + custom), contact timeline, key notes with reminders, import tools (camera/photo/QR/phone contacts), save-to-phone vCard, quick-add slide-out

### Organization Features
Org roles (8 defaults + custom inline add), vertical (dynamic + inline add), priority rating, role filter pills on list page

### Task Features
Subtasks (parent_task_id), follow-up prompt on ALL completions with type/priority/assignee selection, task updates/steps log, hand-off/reassign with notes, view mode, quick complete

### Deal Features
Pipeline board + list view, deal velocity tracking (stage history), territory assignment, dynamic verticals

### Dashboard
Stale deals widget (14+ days), unreplied emails widget, AI briefing with M365 data, WIP tracking, dynamic verticals from actual data (not hardcoded)

### M365 Integration
Email sync, calendar sync, send emails from CRM, recipient autocomplete (CRM + M365 People), import M365 contacts, email monitoring for unreplied

### AI Assistant
16 tools including M365 search/send, web search, per-user writing style learning

### Admin
Custom roles (19 permissions), configurable project stages, territory management, user management with password reset, data backup (manual + automated), feedback system with discussion threads + notifications

### Mobile/PWA
Push notifications (HTTP/2 APNS), native iOS via Capacitor/TestFlight, safe-area-inset handling, responsive design throughout

### Data Quality
Soft-delete across all entities, deleted_at filters on 15+ queries, auto-capitalize names, whitespace-pre-wrap on all notes/body fields

---

## SESSION 3 ADDITIONS (March 27, 2026)

### Multi-select Verticals
- `verticals TEXT[]` column added to organizations, deals, projects
- `vertical` (single, TEXT) kept in sync as first element for backward compatibility with dashboard/filters
- VerticalSelector component supports both `multi` and single modes
- Org form, deal form, project new/edit all use multi-select
- Tag-chip UI with removable pills for the select variant, toggle pills for the pills variant
- Migration 025 migrates existing single vertical into array

### Hotel → Hospitality Rename
- DEFAULT_VERTICALS updated: 'hotel' → 'hospitality'
- Color maps updated in verticals.ts
- Migration 025 renames in all tables (organizations, deals, projects, properties, sequences, custom_verticals)
- Property form/detail accept both 'hotel' and 'hospitality' for backward compatibility
- Pipeline filters and sequence seeds updated

### Sub-task Visual Overhaul
- Task list page groups sub-tasks under parent tasks
- Parent tasks show expandable badge with completion count (e.g., "2/3") and chevron toggle
- Sub-tasks render indented (ml-8) with blue left border, ↳ icon, and "SUB-TASK" label badge
- Each sub-task has full functionality: complete, edit, delete, click to detail, individual assignment
- Orphaned sub-tasks (parent not in current filtered view) show at top level
- Task detail page shows parent task link and sub-task list (from previous session)

### Migration 025 SQL
```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verticals TEXT[] DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS verticals TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS verticals TEXT[] DEFAULT '{}';
UPDATE organizations SET verticals = ARRAY[vertical] WHERE vertical IS NOT NULL AND (verticals IS NULL OR verticals = '{}');
UPDATE deals SET verticals = ARRAY[vertical] WHERE vertical IS NOT NULL AND (verticals IS NULL OR verticals = '{}');
UPDATE projects SET verticals = ARRAY[vertical] WHERE vertical IS NOT NULL AND (verticals IS NULL OR verticals = '{}');
UPDATE organizations SET vertical = 'hospitality', verticals = array_replace(verticals, 'hotel', 'hospitality') WHERE 'hotel' = ANY(verticals) OR vertical = 'hotel';
UPDATE deals SET vertical = 'hospitality', verticals = array_replace(verticals, 'hotel', 'hospitality') WHERE 'hotel' = ANY(verticals) OR vertical = 'hotel';
UPDATE projects SET vertical = 'hospitality', verticals = array_replace(verticals, 'hotel', 'hospitality') WHERE 'hotel' = ANY(verticals) OR vertical = 'hotel';
UPDATE properties SET vertical = 'hospitality' WHERE vertical = 'hotel';
UPDATE sequences SET vertical = 'hospitality' WHERE vertical = 'hotel';
UPDATE custom_verticals SET name = 'hospitality' WHERE name = 'hotel';
```
