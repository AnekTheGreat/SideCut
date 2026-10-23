#!/usr/bin/env python3
"""80.0.10 - the gate answers for the corner flight, the covering bar and the sheet.

80.0.9 rewrote dev/staircase-check.cjs whole for the width-wide staircase, and its
release step only checked that the rewritten file arrived. This release replaces that
design, so the gate is replaced with it: the flight is five 46px treads joined edge to
edge in the bottom right corner, one riser a step; the bar is bottom-zero and full
width with the phone's inset inside it; the add-songs sheet is a screen-level panel
above the bar that closes on its X, on the backdrop, on Escape and after a choice.

This step is the check that the replacement arrived intact. If the gate is the 80.0.9
one, or a truncated copy of it, the release stops here rather than six minutes into
the battery.

Idempotent by construction: it writes nothing.

    python3 dev/patch-gate-80010.py
    python3 dev/patch-gate-80010.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')

# One line of the gate per claim this release makes about the page. Each has to be in
# the file: a gate that lost one of these is a gate that stopped answering.
CLAIMS = [
    ("console.log('[1] the flight is a small rail in the bottom right corner');",
     'the flight is a corner rail'),
    ("console.log('[2] five treads, one riser apart, the plus closing the flight');",
     'the five treads are asserted'),
    ("console.log('[3] the tabs are icons, and the split treads keep their cut');",
     'the icons and the split treads are asserted'),
    ("console.log('[4] the bar covers the bottom');",
     'the bar covers the bottom'),
    ("console.log('[5] the add-songs sheet is above the bar, and closes four ways');",
     'the sheet is asserted'),
    ("--sc10-tread: 46px;", 'the tread is 46px'),
    ("right: 10px;", 'the rail is pinned to the right'),
    ("bottom: var(--sc10-bar);", 'the rail stands on the bar'),
    ("left: 0; right: 0; bottom: 0;", 'the bar is flush with the bottom'),
    ("id=\"addSongsClose\"", 'the sheet has a close button'),
    ("ev.key === 'Escape' || ev.key === 'Esc'", 'Escape closes the sheet'),
    ("label: 'DJ Mode'", 'DJ Mode is still answered in the menu'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-80010: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-80010: the gate is not the 80.0.10 one (%s)' % ', '.join(missing))
    print('  the gate answers for the corner flight, the covering bar and the sheet (%d claims)' % len(CLAIMS))
    print('patch-gate-80010%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
