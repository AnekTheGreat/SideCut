#!/usr/bin/env python3
"""75.1.2 - put dev/ask-rail-check.cjs in the extra arm of the battery.

ask-rail-check.cjs is the release's own gate: the four-up pinned-artists rail, the wider
Ask SideCut grammar, and the follow-ups. It boots the page in jsdom, so it belongs with
the drawer gates in the extra arm (ai-button-check, ask-album-check) rather than the
core tests or the OTA trio.
Idempotent.

  python3 dev/patch-gate-75120.py
  python3 dev/patch-gate-75120.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
PATH = os.path.join(ROOT, 'dev', 'gates.sh')

OLD = 'lyrics-timing-check"'
NEW = 'lyrics-timing-check ask-rail-check"'

src = open(PATH, encoding='utf-8').read()
changed = False
if NEW not in src:
    if OLD not in src:
        raise SystemExit('patch-gate-7512: the end of the EXTRA list is not the expected one')
    src = src.replace(OLD, NEW, 1)
    changed = True
    if not CHECK:
        open(PATH, 'w', encoding='utf-8').write(src)

if CHECK:
    if changed:
        print('patch-gate-7512 --check: ask-rail-check is not in the battery yet')
        sys.exit(1)
    print('patch-gate-7512 --check: ask-rail-check is in the extra arm')
    sys.exit(0)

print('patch-gate-7512: ' + ('added ask-rail-check to the extra arm' if changed else 'already applied'))
