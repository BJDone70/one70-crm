# ONE70 CRM — Xcode Cloud Setup (No Mac Required)

## Overview

Xcode Cloud builds the iOS app on Apple's servers. You manage everything through your browser — no Mac needed. Apple Developer Program includes 25 free build hours per month.

## Prerequisites

1. **Apple Developer Program** — $99/year at developer.apple.com/programs
   - Sign up with your Apple ID
   - Enrollment takes up to 48 hours for approval

2. **GitHub repo** — The CRM code is already at github.com/BJDone70/one70-crm

## Step-by-Step Setup

### Step 1: Create the App in App Store Connect

1. Go to **appstoreconnect.apple.com** and sign in
2. Click **My Apps** → the **+** button → **New App**
3. Fill in:
   - **Platforms**: iOS
   - **Name**: ONE70 CRM
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select "Register a new bundle ID" if needed
     - Go to developer.apple.com/account → Identifiers → + → App IDs → App
     - Description: ONE70 CRM
     - Bundle ID (Explicit): `com.one70group.crm`
     - Enable: Push Notifications
     - Click Continue → Register
   - **SKU**: `one70crm`
4. Click **Create**

### Step 2: Connect GitHub to Xcode Cloud

1. In App Store Connect, click on **ONE70 CRM** (the app you just created)
2. Click **Xcode Cloud** in the top navigation
3. Click **Get Started**
4. It will ask you to **Connect a source code repository**
5. Choose **GitHub** and authorize Apple to access your account
6. Select the repository: **BJDone70/one70-crm**
7. Select the branch: **main**

### Step 3: Create a Workflow

1. After connecting the repo, Xcode Cloud will detect the `ios/App/App.xcodeproj`
2. Create a new workflow with these settings:
   - **Name**: ONE70 CRM Release
   - **Start Conditions**: Manual (you trigger builds when ready)
   - **Source**: Branch = main
   - **Environment**: 
     - Xcode Version: Latest Release
     - macOS Version: Latest
   - **Actions**: 
     - Archive → iOS
   - **Post-Actions**:
     - TestFlight (Internal Testing) — this uploads the build automatically

3. Click **Save**

### Step 4: Start Your First Build

1. In the Xcode Cloud tab, click **Start Build**
2. Select the workflow you created
3. Select branch: **main**
4. Click **Build**

The build will:
- Clone your repo from GitHub
- Run `ci_scripts/ci_post_clone.sh` (installs Node, npm packages, syncs Capacitor)
- Compile the iOS app
- Sign it with your developer certificate
- Upload to TestFlight

First build takes 10-15 minutes. Subsequent builds are faster due to caching.

### Step 5: Test via TestFlight

1. Once the build succeeds, go to App Store Connect → TestFlight
2. The build appears under "iOS Builds"
3. It may need a brief review (usually minutes for TestFlight)
4. Download the **TestFlight** app on your iPhone from the App Store
5. Open TestFlight — your ONE70 CRM build should appear
6. Tap **Install** to install it on your iPhone

### Step 6: Submit to App Store (when ready)

1. In App Store Connect → your app → App Store tab
2. Fill in:
   - **Description**: Sales pipeline, contacts, and project management for ONE70 Group
   - **Keywords**: CRM, construction, pipeline, contacts, projects
   - **Support URL**: https://one70group.com
   - **Screenshots**: Take screenshots from your iPhone running the app
   - **App Review Information**: 
     - Demo account credentials (so Apple's reviewer can test)
     - Notes: "This is an internal business tool for ONE70 Group"
3. Select the TestFlight build
4. Click **Submit for Review**

Review typically takes 1-2 days. For internal business apps, it usually goes faster.

## Updating the App

### Web-only changes (features, bug fixes, UI updates)
No rebuild needed. Deploy to Vercel as usual — the app loads crm.one70group.com live.

### Native changes (new plugin, icon, permissions)
1. Push changes to GitHub main branch
2. Go to App Store Connect → Xcode Cloud → Start Build
3. Once built, the new version appears in TestFlight
4. To push to App Store: go to App Store tab → select new build → Submit for Review

## Troubleshooting

### Build fails at post-clone script
Check the build logs in Xcode Cloud. Common issues:
- Node not installing: the `brew install node@20` command may need updating for newer Node versions
- npm install failing: check for any npm errors in the logs

### App shows blank screen
The app loads crm.one70group.com remotely. Check:
- Is the CRM deployed and accessible?
- Is the URL correct in `capacitor.config.ts`?

### Push notifications not working
Push notifications require additional setup:
- Create an APNs key in developer.apple.com → Keys
- Configure the key in your notification service
- This is a future enhancement and not required for launch

## Costs

- Apple Developer Program: $99/year (includes 25 build hours/month)
- Additional build hours: $0.08/min if you exceed 25 hours
- For an app that only rebuilds for native changes: 25 hours is more than enough
