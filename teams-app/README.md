# ONE70 CRM — Microsoft Teams Integration

## Overview

The ONE70 CRM can run inside Microsoft Teams as a tab app. Your team can access the full CRM — dashboard, pipeline, contacts, projects, and more — without leaving Teams.

## How It Works

- **Personal tabs**: Dashboard, Pipeline, Contacts, and Projects are pinned as tabs in the Teams sidebar under the ONE70 CRM app
- **Channel tabs**: Add any CRM page (analytics, outreach queue, tasks, etc.) as a tab in any Teams channel
- **Teams navigation**: When running inside Teams, the CRM sidebar is hidden since Teams provides its own navigation via tabs
- **Full functionality**: Everything works — filters, forms, AI tools, document uploads, etc.

## Setup Instructions

### Step 1: Package the Teams App

Run the packaging script with your CRM URL:

```bash
node teams-app/package.js https://crm.one70group.com
```

This creates `teams-app/ONE70-CRM.zip` with your URL baked into the manifest.

### Step 2: Upload to Teams

**Option A: Sideload (for testing)**
1. Open Microsoft Teams
2. Click **Apps** in the left sidebar
3. Click **Manage your apps** at the bottom
4. Click **Upload an app** → **Upload a custom app**
5. Select `teams-app/ONE70-CRM.zip`
6. Click **Add**

**Option B: Admin deployment (for the whole org)**
1. Go to the Teams Admin Center (admin.teams.microsoft.com)
2. Navigate to **Teams apps** → **Manage apps**
3. Click **Upload new app**
4. Upload `teams-app/ONE70-CRM.zip`
5. The app will be available to all users in your organization

### Step 3: Use the App

After installing:
- The ONE70 CRM app appears in your Teams left sidebar
- Click it to see the Dashboard, Pipeline, Contacts, and Projects tabs
- To add a CRM page to a Team channel: click **+** on any channel tab bar → select **ONE70 CRM** → choose which page to display

## IT Requirements

- **Custom app uploads must be enabled** in your Teams admin policy. Your IT admin can enable this at admin.teams.microsoft.com → Teams apps → Permission policies
- The CRM domain (e.g., `crm.one70group.com`) must be accessible from your network
- Users must have an active CRM account — the app uses the same login as the web version

## Technical Details

- The CRM pages load directly inside Teams via iframe
- The Teams JS SDK is initialized automatically when `?teams=1` is in the URL
- The middleware sets `Content-Security-Policy: frame-ancestors` to allow Teams domains
- When in Teams, the CRM sidebar is hidden via CSS (Teams provides navigation)
- Authentication uses the same Supabase session — users log in once

## Files

- `teams-app/manifest.json` — Teams app manifest (edit URLs before packaging)
- `teams-app/color.png` — 192x192 app icon
- `teams-app/outline.png` — 32x32 outline icon
- `teams-app/package.js` — Script to replace URLs and create the .zip
- `src/components/teams-init.tsx` — Teams SDK initialization component
- `src/app/teams/config/page.tsx` — Configuration page for channel tabs
