#!/usr/bin/env python3
"""74.6 - a fix inside 74.5: the Ask sparkle on the multi-select bar did nothing.

The owner: "the ai button doesn't do anything".

74.5 shipped two ways into Ask SideCut, and only one of them worked. The drawer wired
both once, at startup, by id. The Home header button is static and kept its listener.
The multi-select bar is rebuilt from innerHTML every time the selection changes, so the
element the listener was attached to was thrown away on the first redraw - the sparkle
on the bar, whose whole point is "these songs", was then a button with no handler.
dev/ai-button-check.cjs now presses that button (twice, either side of a redraw): it is
5 red on the shipped 74.5 page and green here. dev/patch-746-ask.py is the edit.

This script is the release itself: the number the app reports, the cache name the
service worker must match (the OTA suite requires the two to be the same), and the
entry the update sheet reads.

    python3 dev/patch-746.py           # apply
    python3 dev/patch-746.py --check   # is the page already this release?
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "74.6"
VERSION_OLD = "const APP_VERSION = '74.5';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION
CACHE_OLD = "const CACHE_NAME = 'sidecut-shell-v74.5';"
CACHE_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"

# The head entry is what the update sheet and the store listing read: at least seven
# notes, ASCII, no downloader term, no [FULL] marker, no apostrophes in the single-quoted
# array, and every note short enough for the sheet. The last one says what did not move.
CHANGELOG_ENTRY = """  { version: '74.6', date: 'October 17, 2026 · 3:58 PM EDT', title: 'Ask SideCut opens from the multi-select bar again - the rest of 74.5 is exactly where it was', items: [
    'The sparkle on the multi-select bar opens Ask SideCut again. It was the one button on that bar with no listener left: the bar is redrawn every time the selection changes, and the handler was attached to the copy that got thrown away.',
    'It is found on the page now instead of attached to one button, so the bar can be redrawn as often as you tick a song and Ask still opens with what is ticked.',
    'The Home header sparkle was never broken and is unchanged: it still opens the drawer on your whole library, and the plan still shows before anything runs.',
    'Do it and Undo work as they did: the playlist, the crossfade and the DJ switch change together and go back together from the message bar.',
    'Clear playlist, Delete all songs and the per-song delete still ask in the app and still restore the file, its plays and its place in every playlist from one Undo.',
    'Medium is still the Home bubble size between automatic and tall, and the half-step heights, the expand chip and the Reset that clears them are untouched.',
    'The pill dock, the split Library tab and the 1/8 pad latch are unchanged - the same routes were walked before this build was cut.',
    'Nothing about the music moved: the player, the home widget, the letter-by-letter lyrics and the albums are where 74.5 left them, and no saved song or setting changed.',
  ]},
"""

CHECK = "--check" in sys.argv
src = PAGE.read_text(encoding="utf-8")
sw = SW.read_text(encoding="utf-8")
edits, bad = 0, 0


def look(label, ok):
    global bad
    if ok:
        print("  ok   " + label)
    else:
        print("  MISSING " + label)
        bad += 1


if CHECK:
    print("patch-746: checking the shipped page")
    look("APP_VERSION is %s" % VERSION, VERSION_NEW in src)
    look("the old version is gone", VERSION_OLD not in src)
    look("the service worker cache is sidecut-shell-v%s" % VERSION, CACHE_NEW in sw)
    head = CHANGELOG_ENTRY.split("\n")[0]
    look("the head entry is %s" % VERSION, head in src)
    look("the head entry is the newest entry", head in src and src.index(head) < src.index("  { version: '74.5',"))
    if bad:
        print("patch-746: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-746: CHECK OK - the page is this release")
    sys.exit(0)

if VERSION_NEW in src:
    print("  . the version is already %s" % VERSION)
else:
    n = src.count(VERSION_OLD)
    if n != 1:
        raise SystemExit("APP_VERSION anchor found %d times" % n)
    src = src.replace(VERSION_OLD, VERSION_NEW)
    edits += 1
    print("  . the app runs %s" % VERSION)

if CACHE_NEW in sw:
    print("  . the cache is already sidecut-shell-v%s" % VERSION)
else:
    n = sw.count(CACHE_OLD)
    if n != 1:
        raise SystemExit("cache anchor found %d times" % n)
    sw = sw.replace(CACHE_OLD, CACHE_NEW)
    edits += 1
    print("  . the service worker caches sidecut-shell-v%s" % VERSION)

if CHANGELOG_ENTRY in src:
    print("  . the head entry is already %s" % VERSION)
else:
    n = src.count(CHANGELOG_ANCHOR)
    if n != 1:
        raise SystemExit("changelog anchor found %d times" % n)
    src = src.replace(CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + CHANGELOG_ENTRY, 1)
    edits += 1
    print("  . the head entry announces %s" % VERSION)

PAGE.write_text(src, encoding="utf-8")
SW.write_text(sw, encoding="utf-8")
print("patch-746: applied %d edit(s)" % edits)
