#!/bin/sh

# ONE70 CRM — Xcode Cloud Post-Clone Script
# Runs after Xcode Cloud clones the repo, before building
# Installs Node.js, npm dependencies, and syncs Capacitor iOS

set -e

echo "================================================"
echo "  ONE70 CRM — Xcode Cloud Build Setup"
echo "================================================"

# Navigate to repo root
cd "$CI_PRIMARY_REPOSITORY_PATH"

echo ""
echo "📦 Installing Node.js..."
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node@20 || true
brew link node@20 --overwrite || true

echo ""
echo "📦 Installing npm dependencies..."
npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

echo ""
echo "🔄 Building web assets..."
# Create minimal out directory (app loads remote URL, this is just the loading screen)
mkdir -p out
if [ ! -f out/index.html ]; then
  echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ONE70 CRM</title></head><body style="margin:0;background:#1A1A1A;display:flex;align-items:center;justify-content:center;height:100vh"><p style="color:#FFE500;font-family:Arial">Loading...</p></body></html>' > out/index.html
fi

echo ""
echo "🔄 Syncing Capacitor iOS..."
npx cap sync ios

echo ""
echo "✅ Post-clone setup complete"
echo "================================================"
