#!/usr/bin/env python3
"""74.5 - the release itself: the version, the service worker's cache and the notes.

The work this number carries was rehearsed and proven on 74.1.9; what a release needs on top of
that is the number the app reports, the cache name the service worker must match (the OTA suite
requires the two to be the same), and the entry the update sheet and the store listing read.

    python3 dev/patch-745.py           # apply
    python3 dev/patch-745.py --check   # is the page already this release?
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "74.5"
VERSION_OLD = "const APP_VERSION = '74.1.9';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION
CACHE_OLD = "const CACHE_NAME = 'sidecut-shell-v74.1.9';"
CACHE_NEW = "const CACHE_NAME = 'sidecut-shell-v74.5';"

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"

# The head entry is what the update sheet and the store listing read: at least six notes, ASCII,
# no downloader term, no other build's name, no [FULL] marker, and a last note that says what did
# not move. Everything here is a thing this build does.
CHANGELOG_ENTRY = """  { version: '74.5', date: 'October 17, 2026 · 11:05 AM EDT', title: 'Ask SideCut turns a sentence into a plan you approve, the delete buttons delete with an Undo, Home bubbles get the middle size, and the pill dock and its beat pads behave like the controls they look like', items: [
    'Ask SideCut is a button in the Home header and on the multi-select bar. Say what you want - make a playlist from these songs, crossfade 6 seconds, DJ mode on - and it shows the plan before anything changes.',
    'The plan has an Undo: a playlist it built, the crossfade it changed and the DJ switch it flipped all go back to what they were, in one tap from the message bar.',
    'Clear playlist and Delete all songs work now. Both used to remove nothing and still say Deleted, because they answered the Albums tab while they were drawn in the playlist one.',
    'Deleting a song asks in the app instead of a system dialog the phone can swallow, and Undo brings it back with its file, its plays and its place in every playlist.',
    'Home bubbles finally have the middle size: Medium sits between automatic and tall, the height steppers move in half steps, and the expand chip cycles through every preset.',
    'Reset to automatic clears the sizes the chip set as well as the exact ones, so the button does what it says instead of leaving a bubble at its preset.',
    'The pill dock feels like one control: a slide keeps the highlight under the finger, the seam between two pills no longer throws it back and forth, and letting go picks the tab it shows.',
    'The split Library tab is drawn as the slant it is, and a slide that leaves the dock puts the highlight back and opens nothing. A short tick marks each crossing for a thumb; a mouse stays quiet.',
    'The 1/8 pad repeats an eighth note instead of whatever 62 ms of audio the playhead sat on: a tap latches the slice and keeps the pad lit, a hold loops while the finger is down, and an empty deck says so.',
    'The Beat repeat badge can be earned the way its own text reads - holding a pad credits it, and the loop lock no longer does - and every badge on the wall is reached by something.',
    'Nothing about the music moved: the player, the home widget, the letter-by-letter lyrics and the albums are where the last release left them, and no saved song or setting changed.',
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
    print("patch-745: checking the shipped page")
    look("APP_VERSION is %s" % VERSION, VERSION_NEW in src)
    look("the old version is gone", VERSION_OLD not in src)
    look("the service worker cache is sidecut-shell-v%s" % VERSION, CACHE_NEW in sw)
    look("the head entry is %s" % VERSION, "  { version: '%s', date:" % VERSION in src)
    head = CHANGELOG_ENTRY.split("\n")[0]
    look(
        "the head entry is the newest entry",
        head in src and src.index(head) < src.index("  { version: '74.1.9'"),
    )
    look("the notes still end with what did not move", "the player, the home widget, the letter-by-letter lyrics and the albums" in CHANGELOG_ENTRY)
    if bad:
        print("patch-745: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-745: CHECK OK - the page is this release")
    sys.exit(0)

# The version.
if VERSION_NEW in src:
    print("  . the version is already %s" % VERSION)
else:
    n = src.count(VERSION_OLD)
    if n != 1:
        raise SystemExit("APP_VERSION anchor found %d times" % n)
    src = src.replace(VERSION_OLD, VERSION_NEW)
    edits += 1
    print("  . the app runs %s" % VERSION)

# The cache, which the OTA suite requires to match the version.
if CACHE_NEW in sw:
    print("  . the cache is already sidecut-shell-v%s" % VERSION)
else:
    n = sw.count(CACHE_OLD)
    if n != 1:
        raise SystemExit("cache anchor found %d times" % n)
    sw = sw.replace(CACHE_OLD, CACHE_NEW)
    edits += 1
    print("  . the service worker caches sidecut-shell-v%s" % VERSION)

# The notes.
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
print("patch-745: applied %d edit(s)" % edits)
