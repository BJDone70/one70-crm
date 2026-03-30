#!/usr/bin/env node
// ONE70 CRM — Native App Setup
// Run this once on your Mac to initialize iOS and Android projects
// Usage: node native-setup.js

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function run(cmd, label) {
  console.log(`\n▸ ${label}...`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: __dirname })
  } catch (err) {
    console.error(`  ✗ Failed: ${label}`)
    return false
  }
  console.log(`  ✓ ${label}`)
  return true
}

console.log('')
console.log('╔════════════════════════════════════════════╗')
console.log('║  ONE70 CRM — Native App Setup             ║')
console.log('╠════════════════════════════════════════════╣')
console.log('║  This creates iOS and Android projects     ║')
console.log('║  for the ONE70 CRM native mobile app.      ║')
console.log('╚════════════════════════════════════════════╝')
console.log('')

// Check prerequisites
console.log('Checking prerequisites...')
const isMac = process.platform === 'darwin'

if (!isMac) {
  console.log('')
  console.log('⚠️  iOS builds require a Mac with Xcode.')
  console.log('   You can still set up Android on Windows.')
  console.log('')
}

// Add iOS platform
if (isMac) {
  if (!fs.existsSync(path.join(__dirname, 'ios'))) {
    run('npx cap add ios', 'Adding iOS platform')
  } else {
    console.log('  ✓ iOS platform already exists')
  }
}

// Add Android platform
if (!fs.existsSync(path.join(__dirname, 'android'))) {
  run('npx cap add android', 'Adding Android platform')
} else {
  console.log('  ✓ Android platform already exists')
}

// Copy assets
console.log('\n▸ Copying app icons and splash screen...')
if (isMac && fs.existsSync(path.join(__dirname, 'ios'))) {
  // iOS icons go in ios/App/App/Assets.xcassets/AppIcon.appiconset/
  const iconSrc = path.join(__dirname, 'native-assets', 'icon-1024.png')
  if (fs.existsSync(iconSrc)) {
    const dest = path.join(__dirname, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
    if (fs.existsSync(dest)) {
      fs.copyFileSync(iconSrc, path.join(dest, 'AppIcon-1024@1x.png'))
      console.log('  ✓ iOS app icon copied')
    }
  }
}

// Sync web content to native projects
run('npx cap sync', 'Syncing to native projects')

console.log('')
console.log('════════════════════════════════════════════')
console.log('  Setup complete!')
console.log('')
console.log('  Next steps:')
console.log('')
if (isMac) {
  console.log('  iOS:')
  console.log('    1. npx cap open ios')
  console.log('    2. Select your Apple Developer Team in Xcode')
  console.log('    3. Set Bundle Identifier to: com.one70group.crm')
  console.log('    4. Replace the app icon in Assets.xcassets')
  console.log('    5. Build & Run on your iPhone (or simulator)')
  console.log('')
}
console.log('  Android:')
console.log('    1. npx cap open android')
console.log('    2. Replace app icon in android/app/src/main/res/')
console.log('    3. Build & Run on your phone (or emulator)')
console.log('')
console.log('  To update after code changes:')
console.log('    npx cap sync')
console.log('')
console.log('  To build for App Store / Play Store:')
console.log('    See native-assets/README.md')
console.log('════════════════════════════════════════════')
