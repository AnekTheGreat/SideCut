#!/usr/bin/env python3
"""80.2 - the gate speaks the release number the app is actually on.

dev/staircase-check.cjs carries the release it describes (its banner, the
APP_VERSION pin, the shell cache and the changelog head), so 80.2 moves those four
strings with the page. This step is the check that the gate moved with it: if it is
still the 80.1 one - or a truncated copy - the release stops here rather than six
minutes into the battery.

Idempotent by construction: it writes nothing.

    python3 dev/patch-gate-802.py
    python3 dev/patch-gate-802.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[1] the wall is a grid of circles, and a bubble holds its own words');",
     'the wall is a grid of circles'),
    ("console.log('[2] the flight is five icon tiles lifted along a curve');",
     'the curve of icon tiles is asserted'),
    ("console.log('[4] lyrics is back in the bar');",
     'the lyrics button is asserted'),
    ("console.log('[5] the band of theme colour under the lists is gone');",
     'the removed band is asserted'),
    ("/* ---------- 11. 80.2: the cloud layout, tidied", 'the gate reads the 80.2 banner'),
    ("const APP_VERSION = '80.2';", 'the gate pins 80.2'),
    ("sidecut-shell-v80.2", 'the gate pins the 80.2 shell cache'),
    ("version: '80.2'", 'the gate pins the 80.2 changelog head'),
    ("#libraryBtn{ transform:translateY(-6px); }", 'the curve is pinned'),
    ("padding-bottom:calc(var(--sc10-bar) + 12px);", 'the new reserve is pinned'),
    ("b.id = 'sc11Lyrics';", 'the lyrics button is pinned'),
    ("grid-template-columns:repeat(2, minmax(0, 1fr));", 'the two-column wall is pinned'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-802: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-802: the gate is not the 80.2 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2: the wall, the curve, the lyrics button and the band (%d claims)' % len(CLAIMS))
    print('patch-gate-802%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
