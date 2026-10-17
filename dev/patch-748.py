#!/usr/bin/env python3
"""74.8 - a fix inside 74.7: listening time did not move while the music played out of sight.

The owner: "the listening stats aren't working ... it doesn't go up in time when I'm
listening outside of the app or with headphones like it should".

dev/patch-748-listen.py is the fix (the counter refused to run while hidden, and the
battery saver stopped its timer besides; the clock now follows the playhead against the
wall clock and is marked keep-alive). dev/listen-time-check.cjs is the gate that drives
it: 12/0 here, 6 named reds on the shipped 74.7 page.

This script is the release itself: the number, the service worker cache (the OTA suite
requires the two to match) and the entry the update sheet reads.

    python3 dev/patch-748.py           # apply
    python3 dev/patch-748.py --check   # is the page already this release?
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "74.8"
VERSION_OLD = "const APP_VERSION = '74.7';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION
CACHE_OLD = "const CACHE_NAME = 'sidecut-shell-v74.7';"
CACHE_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"

# Head entry rules (test-728): at least seven notes, ASCII, no downloader term, no [FULL]
# marker, no apostrophes in the single-quoted array, every note short enough for the sheet,
# and a last note that says what did not move.
CHANGELOG_ENTRY = """  { version: '74.8', date: 'October 17, 2026 · 5:20 PM EDT', title: 'Listening time counts while the music is out of sight - and it follows the song instead of a timer', items: [
    'Listening time now counts with the screen off, the phone in a pocket, or another app in front. It used to need SideCut on screen, and it also needed a timer the battery saver stops the moment the app hides.',
    'The clock follows the song rather than counting ticks: it adds the seconds the audio actually moved, so a span the phone froze through is recovered by the next check instead of being lost.',
    'It cannot be talked into hours: pausing adds nothing, skipping forward is not listening, a seek back is not a debt, and a player with no source counts nothing.',
    'A song played from the lock screen or through headphones counts toward total time, plays and the streak exactly like one played with the app open in front of you.',
    'The last part of a minute is saved when the app hides, when the page closes and when the sound stops, so a phone that ends the app does not take the visit with it.',
    'A new gate drives the clock through a backgrounded minute, a ten-minute freeze, a pause, a seek and an empty player, and it reads the number the stats screen reads.',
    'The badge wall and the average-per-day figure read that same total, so they move with it.',
    'Nothing about the music moved: the player, the home widget, the letter-by-letter lyrics and the albums are where the last build left them, and no saved song or setting changed.',
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
    print("patch-748: checking the shipped page")
    look("APP_VERSION is %s" % VERSION, VERSION_NEW in src)
    look("the old version is gone", VERSION_OLD not in src)
    look("the service worker cache is sidecut-shell-v%s" % VERSION, CACHE_NEW in sw)
    head = CHANGELOG_ENTRY.split("\n")[0]
    look("the head entry is %s" % VERSION, head in src)
    look("the head entry is the newest entry", head in src and src.index(head) < src.index("  { version: '74.7',"))
    look("the listening fix is in the page", "window.__scListenTick = scListenTick;" in src)
    if bad:
        print("patch-748: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-748: CHECK OK - the page is this release")
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
print("patch-748: applied %d edit(s)" % edits)
