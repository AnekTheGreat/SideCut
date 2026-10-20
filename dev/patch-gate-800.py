#!/usr/bin/env python3
"""80.0 - add the revamp gate to the extra arm of the battery.

dev/revamp-check.cjs is the new gate. It belongs with the other Home/Studio
drawer gates in EXTRA, because it boots the page and drives the new switches
rather than reading the tree. Idempotent.

  python3 dev/patch-gate-800.py
  python3 dev/patch-gate-800.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
PATH = os.path.join(ROOT, 'dev', 'gates.sh')

OLD = 'lyrics-timing-check ask-rail-check"'
NEW = 'lyrics-timing-check ask-rail-check revamp-check"'

src = open(PATH, encoding='utf-8').read()
changed = False
if NEW not in src:
    if OLD not in src:
        raise SystemExit('patch-gate-800: the EXTRA line in dev/gates.sh is not the expected one')
    src = src.replace(OLD, NEW, 1)
    changed = True
    if not CHECK:
        open(PATH, 'w', encoding='utf-8').write(src)

if CHECK:
    if changed:
        print('patch-gate-800 --check: revamp-check is not in the battery yet')
        sys.exit(1)
    print('patch-gate-800 --check: revamp-check is in the extra arm')
    sys.exit(0)

print('patch-gate-800: ' + ('added revamp-check to the extra arm' if changed else 'already applied'))
