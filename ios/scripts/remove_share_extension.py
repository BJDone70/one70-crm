#!/usr/bin/env python3
"""Remove ShareExtension references from Xcode project file."""
import sys
import os

pbxproj = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('CM_BUILD_DIR', '.'), 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')

with open(pbxproj, 'r') as f:
    lines = f.readlines()

clean = [l for l in lines if 'ShareExtension' not in l]

if len(clean) < len(lines):
    with open(pbxproj, 'w') as f:
        f.writelines(clean)
    print(f'Removed {len(lines) - len(clean)} ShareExtension references from pbxproj')
else:
    print('No ShareExtension references found in pbxproj')
