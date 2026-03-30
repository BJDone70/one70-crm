# ONE70 CRM — Native Mobile App

## Overview

The ONE70 CRM mobile app wraps the web CRM in a native iOS/Android shell using Capacitor. The app loads `crm.one70group.com` inside a native WebView, giving you App Store/Play Store presence plus access to native device APIs that browsers can't touch.

## What You Get vs. the PWA

| Feature | PWA (current) | Native App |
|---------|:---:|:---:|
| Home screen icon | ✓ | ✓ |
| Full screen (no browser) | ✓ | ✓ |
| App Store listing | ✗ | ✓ |
| Push notifications (iOS) | ✗ | ✓ |
| Native contact picker (iOS) | ✗ | ✓ |
| Haptic feedback | ✗ | ✓ |
| Background refresh | ✗ | ✓ |
| Auto-update | ✓ (instant) | ✓ (instant — loads live URL) |

Since the app loads your live CRM URL, every web update you deploy is immediately available in the native app — no App Store review needed for feature updates.

## Prerequisites

- **For iOS**: A Mac with Xcode 15+ installed, Apple Developer account ($99/year)
- **For Android**: Android Studio installed (Mac, Windows, or Linux), Google Play Developer account ($25 one-time)
- **Node.js 18+** installed on the build machine

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/BJDone70/one70-crm.git
cd one70-crm

# 2. Install dependencies
npm install

# 3. Run the setup script
node native-setup.js

# 4. Open in Xcode (iOS) or Android Studio (Android)
npx cap open ios      # Mac only
npx cap open android  # Any platform
```

## iOS Setup (Mac Only)

### First time setup

1. Run `node native-setup.js` to create the iOS project
2. Run `npx cap open ios` to open in Xcode
3. In Xcode, select the "App" target
4. Under "Signing & Capabilities":
   - Select your Apple Developer Team
   - Set Bundle Identifier to `com.one70group.crm`
5. Under "General":
   - Set Display Name to `ONE70 CRM`
   - Set Version to `1.0.0`
6. Replace the app icon:
   - In the left sidebar, navigate to App > App > Assets.xcassets > AppIcon
   - Drag `native-assets/icon-1024.png` into the 1024x1024 slot
   - Xcode will auto-generate all required sizes
7. Connect your iPhone via USB, select it as the build target, and click Run

### Submit to App Store

1. In Xcode: Product > Archive
2. Once archived, click "Distribute App"
3. Choose "App Store Connect"
4. Follow the prompts to upload
5. In App Store Connect (appstoreconnect.apple.com):
   - Fill in app description, screenshots, pricing
   - Submit for review (typically 1-2 days)

### iOS Info.plist permissions

The Capacitor project already includes these, but verify in `ios/App/App/Info.plist`:

```xml
<!-- Camera (for business card scanning) -->
<key>NSCameraUsageDescription</key>
<string>ONE70 CRM needs camera access to scan business cards and QR codes</string>

<!-- Contacts (for importing contacts) -->
<key>NSContactsUsageDescription</key>
<string>ONE70 CRM needs contacts access to import contacts from your phone</string>

<!-- Push Notifications -->
<key>UIBackgroundModes</key>
<array><string>remote-notification</string></array>
```

## Android Setup

### First time setup

1. Run `node native-setup.js` to create the Android project
2. Run `npx cap open android` to open in Android Studio
3. In Android Studio:
   - Wait for Gradle sync to complete
   - Open `android/app/build.gradle`
   - Verify `applicationId` is `com.one70group.crm`
4. Replace the app icon:
   - Copy `native-assets/icon-foreground.png` to `android/app/src/main/res/`
   - Or use Android Studio: right-click `res` > New > Image Asset
   - Select `native-assets/icon-1024.png` as the source
5. Connect your Android phone via USB, enable USB debugging, and click Run

### Submit to Google Play Store

1. In Android Studio: Build > Generate Signed Bundle / APK
2. Choose "Android App Bundle"
3. Create or select a keystore (keep this file safe — you need it for every update)
4. Build the release bundle
5. In Google Play Console (play.google.com/console):
   - Create a new app
   - Upload the .aab file
   - Fill in store listing, screenshots, pricing
   - Submit for review (typically a few hours to 2 days)

### Android permissions

Verify in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
```

## Native Features

### Contact Picker
When the app detects it's running inside Capacitor, the "Import from Phone" button opens the native iOS/Android contact picker directly — no .vcf file workaround needed. The `src/lib/native.ts` utility handles detection and API calls.

### Push Notifications
The push notification infrastructure is in place (`@capacitor/push-notifications`). To activate:
1. Set up Apple Push Notification service (APNs) for iOS
2. Set up Firebase Cloud Messaging (FCM) for Android
3. Store device tokens in the `profiles` table
4. Send notifications from your server when deals move stages, tasks are due, etc.

### Haptic Feedback
Available via `hapticFeedback()` from `src/lib/native.ts`. Can be added to button taps, stage changes, and task completions for tactile feedback.

## Updating the App

Since the native app loads `crm.one70group.com` remotely, most updates require zero App Store changes:

- **Web feature updates**: Deploy to Vercel as usual. The app picks them up instantly.
- **Native plugin changes**: Run `npx cap sync` then rebuild in Xcode/Android Studio.
- **App Store metadata changes**: Update in App Store Connect / Play Console directly.

You only need to submit a new app build when:
- Adding a new Capacitor plugin (new native permission)
- Changing the app icon or splash screen
- Updating the Capacitor version itself

## Files

```
capacitor.config.ts          — Capacitor configuration (URL, plugins, styling)
native-setup.js              — One-time setup script
src/lib/native.ts            — Native API bridge (contact picker, push, haptics)
native-assets/
  icon-1024.png              — 1024x1024 app icon (App Store)
  icon-foreground.png        — 432x432 Android adaptive icon foreground
  splash-2732.png            — 2732x2732 splash screen
out/
  index.html                 — Minimal loading screen (shown before remote URL loads)
ios/                         — Generated by `npx cap add ios` (not in repo)
android/                     — Generated by `npx cap add android` (not in repo)
```

## Annual Costs

- Apple Developer Program: $99/year
- Google Play Developer: $25 one-time
- Total first year: $124
- Total subsequent years: $99
