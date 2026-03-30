#!/usr/bin/env python3
"""Revoke all distribution certificates and delete matching provisioning profiles."""
import subprocess
import json
import sys

def run(cmd, timeout=30):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.returncode
    except Exception as e:
        print(f"  Command failed: {e}")
        return "", 1

def revoke_certificates():
    """Try multiple approaches to find and revoke certificates."""
    revoked = 0
    
    for cert_type in ["DISTRIBUTION", "IOS_DISTRIBUTION"]:
        # Approach 1: --json flag
        stdout, rc = run(["app-store-connect", "certificates", "list", "--type", cert_type, "--json"])
        if rc == 0 and stdout:
            try:
                certs = json.loads(stdout)
                if isinstance(certs, list):
                    for cert in certs:
                        cid = cert.get("id", "")
                        if cid:
                            print(f"  Revoking {cert_type}: {cid}")
                            run(["app-store-connect", "certificates", "revoke", cid])
                            revoked += 1
                    continue
            except json.JSONDecodeError:
                pass
        
        # Approach 2: Parse text output for IDs
        stdout, rc = run(["app-store-connect", "certificates", "list", "--type", cert_type])
        if rc == 0 and stdout:
            for line in stdout.split('\n'):
                line = line.strip()
                # Look for lines that look like certificate IDs (alphanumeric, ~10+ chars)
                if line and len(line) > 8 and line.replace('-', '').replace('_', '').isalnum():
                    print(f"  Trying to revoke {cert_type}: {line}")
                    run(["app-store-connect", "certificates", "revoke", line])
                    revoked += 1
    
    return revoked

def delete_profiles():
    """Delete provisioning profiles matching one70."""
    deleted = 0
    
    stdout, rc = run(["app-store-connect", "profiles", "list", "--type", "IOS_APP_STORE", "--json"])
    if rc == 0 and stdout:
        try:
            profiles = json.loads(stdout)
            if isinstance(profiles, list):
                for profile in profiles:
                    pid = profile.get("id", "")
                    attrs = profile.get("attributes", {})
                    pname = attrs.get("name", "") if isinstance(attrs, dict) else ""
                    bundle_id = attrs.get("bundleId", "") if isinstance(attrs, dict) else ""
                    if pid and ("one70" in pname.lower() or "one70" in bundle_id.lower()):
                        print(f"  Deleting profile: {pname} ({pid})")
                        run(["app-store-connect", "profiles", "delete", pid])
                        deleted += 1
        except json.JSONDecodeError:
            pass
    
    return deleted

if __name__ == "__main__":
    print("=== Cleaning certificates ===")
    n_revoked = revoke_certificates()
    print(f"Revoked {n_revoked} certificate(s)")
    
    print("=== Cleaning profiles ===")
    n_deleted = delete_profiles()
    print(f"Deleted {n_deleted} profile(s)")
    
    print("=== Done ===")
