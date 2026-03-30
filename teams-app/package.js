#!/usr/bin/env node
// Usage: node teams-app/package.js https://crm.one70group.com
// Creates: teams-app/ONE70-CRM.zip ready for Teams sideloading

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const os = require('os')

const baseUrl = process.argv[2]
if (!baseUrl) {
  console.error('Usage: node teams-app/package.js <YOUR_CRM_URL>')
  console.error('Example: node teams-app/package.js https://crm.one70group.com')
  process.exit(1)
}

const domain = new URL(baseUrl).hostname
const dir = path.join(__dirname)
const outFile = path.join(dir, 'ONE70-CRM.zip')

// Create temp directory with the three files Teams needs
const tmpDir = path.join(os.tmpdir(), 'one70-teams-' + Date.now())
fs.mkdirSync(tmpDir, { recursive: true })

// Read manifest and replace placeholders
let manifest = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8')
manifest = manifest.replace(/REPLACE_WITH_YOUR_URL/g, baseUrl.replace(/\/$/, ''))
manifest = manifest.replace(/REPLACE_WITH_YOUR_DOMAIN/g, domain)
fs.writeFileSync(path.join(tmpDir, 'manifest.json'), manifest)

// Copy icons
fs.copyFileSync(path.join(dir, 'color.png'), path.join(tmpDir, 'color.png'))
fs.copyFileSync(path.join(dir, 'outline.png'), path.join(tmpDir, 'outline.png'))

// Remove old zip if exists
try { fs.unlinkSync(outFile) } catch {}

// Create zip
if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${outFile}' -Force"`,
    { stdio: 'inherit' }
  )
} else {
  execSync(`cd "${tmpDir}" && zip -j "${outFile}" manifest.json color.png outline.png`, { stdio: 'inherit' })
}

// Cleanup temp
fs.rmSync(tmpDir, { recursive: true, force: true })

console.log('')
console.log('Teams app package created: ' + outFile)
console.log('')
console.log('Domain: ' + domain)
console.log('Base URL: ' + baseUrl)
console.log('')
console.log('Next steps:')
console.log('1. Open Microsoft Teams')
console.log('2. Click "Apps" in the left sidebar')
console.log('3. Click "Manage your apps" at the bottom')
console.log('4. Click "Upload an app" > "Upload a custom app"')
console.log('5. Select the ONE70-CRM.zip file')
console.log('6. Click "Add" to install')
