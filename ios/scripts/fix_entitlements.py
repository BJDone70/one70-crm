#!/usr/bin/env python3
"""Ensure CODE_SIGN_ENTITLEMENTS for the main app target in pbxproj."""
import sys
import os

pbxproj = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('CM_BUILD_DIR', '.'), 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')

with open(pbxproj, 'r') as f:
    content = f.read()

# Check specifically for the main app's entitlements (not extension's)
if 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements' in content:
    print('Main app entitlements reference already in pbxproj')
    sys.exit(0)

# Add entitlements before the main app's bundle identifier line
old = 'PRODUCT_BUNDLE_IDENTIFIER = com.one70group.crm;'
new = 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.one70group.crm;'
content = content.replace(old, new)

with open(pbxproj, 'w') as f:
    f.write(content)

print('Added main app entitlements reference to pbxproj')
