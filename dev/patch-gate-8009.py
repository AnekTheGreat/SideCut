#!/usr/bin/env python3
"""80.0.9 - the gate answers for the staircase across the width and the mini bar.

80.0.8 spliced a section into dev/staircase-check.cjs because the file it had to
amend was somebody else's. This release rewrites that file whole - the design it
described is gone - so the gate travels in the payload with the page and this step
is the check that it arrived: the sections 80.0.9 needs, named one by one. If the
gate is the 80.0.8 one, or a truncated copy of it, the release stops here rather
than six minutes into the battery.

Idempotent by construction: it writes nothing.

    python3 dev/patch-gate-8009.py
    python3 dev/patch-gate-8009.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')

# One line of the gate per claim this release makes about the page. Each has to be
# in the file: a gate that lost one of these is a gate that stopped answering.
CLAIMS = [
    ("console.log('[1] the rail is one row across the whole width');",
     'the rail is a row across the width'),
    ("console.log('[2] five steps, each one higher than the one on its left');",
     'the five steps are asserted'),
    ("console.log('[3] the bar has one height, and nothing has to be measured for it');",
     'the bar has one height'),
    ("console.log('[9] the tabs are icons');",
     'the tabs are icons'),
    ("console.log('[10] the cloud bar is a mini player, and nothing left with the console');",
     'the cloud bar is a mini player'),
    ("icons === 6", 'six icon masks are counted'),
    ("the tab you are on is filled coral", 'the active tile is filled coral'),
    ("label: 'DJ Mode'", 'DJ Mode is answered in the menu'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8009: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8009: the gate is not the 80.0.9 one (%s)' % ', '.join(missing))
    print('  the gate answers for the rail, the icons and the mini bar (%d claims)' % len(CLAIMS))
    print('patch-gate-8009%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
