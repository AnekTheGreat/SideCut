#!/usr/bin/env python3
"""80.1 - the gate speaks the release number the app is actually on.

The staircase gate carries the release it describes (its banner, the APP_VERSION
pin, the shell cache and the changelog head), so 80.1 moves those four strings with
the page. This step is the check that the gate moved with it: if it is still the
80.0.10 one - or a truncated copy - the release stops here rather than six minutes
into the battery.

Idempotent by construction: it writes nothing.

    python3 dev/patch-gate-801.py
    python3 dev/patch-gate-801.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[1] the flight is a small rail in the bottom right corner');",
     'the flight is a corner rail'),
    ("console.log('[2] five treads, one riser apart, the plus closing the flight');",
     'the five treads are asserted'),
    ("console.log('[4] the bar covers the bottom');",
     'the bar covers the bottom'),
    ("console.log('[5] the add-songs sheet is above the bar, and closes four ways');",
     'the sheet is asserted'),
    ("9. 80.1: a small flight in the corner", 'the gate reads the 80.1 banner'),
    ("const APP_VERSION = '80.1';", 'the gate pins 80.1'),
    ("sidecut-shell-v80.1", 'the gate pins the 80.1 shell cache'),
    ("version: '80.1'", 'the gate pins the 80.1 changelog head'),
    ("right: 10px;", 'the rail is pinned to the right'),
    ("left: 0; right: 0; bottom: 0;", 'the bar is flush with the bottom'),
    ("id=\"addSongsClose\"", 'the sheet has a close button'),
    ("label: 'DJ Mode'", 'DJ Mode is still answered in the menu'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-801: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-801: the gate is not the 80.1 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.1: the corner flight, the covering bar and the sheet (%d claims)' % len(CLAIMS))
    print('patch-gate-801%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
