#!/usr/bin/env python3
"""83.0.8 - a widget press never starts somebody else's music.

83.0.7 handed the press back to SideCut as a system-wide media key, and judged success
by the phone's own "music is playing" answer. With SideCut gone, that key starts whichever
player the phone last saw (Spotify answered), and the answer came back "yes" - so the
hidden player never started and someone else's audio played from SideCut's widget.

This release is the page's half of the version bump; the behaviour lives in the native
half (dev/ghost-host.py). Re-running is a no-op, and --check reports without writing.

  python3 dev/patch-8308.py           apply
  python3 dev/patch-8308.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.0.8'
OLD = '83.0.7'

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()
CHECK = '--check' in sys.argv

if "const APP_VERSION = '%s';" % VERSION in s:
    print('%s is already on the page - nothing to do' % VERSION)
    sys.exit(0)

if CHECK:
    print('%s is NOT on the page - it needs applying' % VERSION)
    sys.exit(1)

changes = []


def sub(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit('%s: %d matches (expected exactly 1)' % (label, n))
    s = s.replace(old, new, 1)
    changes.append(label)
    print('ok  ' + label)


sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)


ENTRY = """  { version: '83.0.8', date: 'November 7, 2026 · 5:20 AM EST', title: 'The widget only ever plays SideCut', items: [
    'Pressing the widget with SideCut gone could start Spotify: the press was handed back to the phone as a system-wide play key, and that key goes to whichever player the phone saw last.',
    'That hand-back now only happens when SideCut itself is demonstrably running, and it counts as success only if SideCut answers - never because some other app started making noise.',
    'When nothing of SideCut is running, the press goes straight to the hidden player, with no media key involved at all.',
    'This half is native: install the newest Android build for it.'
  ]},
"""

ANCHOR = "  { version: '%s', date: 'November 7, 2026 · 4:55 AM EST'" % OLD
sub(ANCHOR, ENTRY + ANCHOR, 'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
