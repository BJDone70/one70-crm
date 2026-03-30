# ONE70 CRM

Custom CRM for ONE70 Group — commercial construction, Eastern USA.

**Verticals:** Multifamily | Hotel (PIP) | Senior Living

## Tech Stack

- **Framework:** Next.js 14+ (React, TypeScript)
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **Hosting:** Vercel
- **Styling:** Tailwind CSS
- **Icons:** Lucide React

## Setup Guide

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** — this creates all 13 tables, RLS policies, triggers, and indexes
4. Go to **Settings > API** and copy your Project URL and anon public key

### 2. Create Your Admin Account

1. In Supabase, go to **Authentication > Users**
2. Click **Add User** > **Create New User**
3. Enter your email and a strong password
4. After the user is created, go to **Table Editor > profiles**
5. Find your profile row and change `role` from `rep` to `admin`

### 3. Environment Variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
```

### 4. Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in.

### 5. Deploy to Vercel

1. Push this repo to GitHub
2. Go to vercel.com and click Import Project
3. Select your GitHub repo
4. Add environment variables
5. Click Deploy

### 6. Custom Domain

1. In Vercel project settings > Domains
2. Add `crm.one70group.com`
3. Update your DNS with the CNAME record Vercel provides

## Pipeline Stages

Lead → Contacted → Discovery → Site Walk → Proposal → Negotiation → Won / Lost

## User Roles

- **Admin:** Full access + user management + audit log
- **Rep:** Create/edit all records, cannot manage users
- **Viewer:** Read-only access

## Release History

- **Release 1 (current):** Foundation — Auth, Organizations, Contacts, Properties, Activities, User Management
