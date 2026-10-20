#!/usr/bin/env python3
"""75.1.1 - add the legacy update-path gate to the OTA arm of the battery.

dev/legacy-update-check.cjs is the new gate. It belongs with the OTA trio
because it reads the same manifests the updater reads. Idempotent.

  python3 dev/patch-gate-7511.py
  python3 dev/patch-gate-7511.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
PATH = os.path.join(ROOT, 'dev', 'gates.sh')

OLD = 'OTA="ota-guard-check ota-update-check ota-bootapply-check"'
NEW = 'OTA="ota-guard-check ota-update-check ota-bootapply-check legacy-update-check"'

src = open(PATH, encoding='utf-8').read()
changed = False
if NEW not in src:
    if OLD not in src:
        raise SystemExit('patch-gate-7511: the OTA line in dev/gates.sh is not the expected one')
    src = src.replace(OLD, NEW, 1)
    changed = True
    if not CHECK:
        open(PATH, 'w', encoding='utf-8').write(src)

if CHECK:
    if changed:
        print('patch-gate-7511 --check: legacy-update-check is not in the battery yet')
        sys.exit(1)
    print('patch-gate-7511 --check: legacy-update-check is in the OTA arm')
    sys.exit(0)

print('patch-gate-7511: ' + ('added legacy-update-check to the OTA arm' if changed else 'already applied'))
