#!/usr/bin/env python3
"""74.7 - a fix inside 74.6: the Ask drawer was invisible, so the sparkle looked dead.

The owner, again: "the ai button literally doesn't do anything ... only the keyboard
randomly open[s] up". 74.6 fixed a real bug on the multi-select bar, but this is the one
that was actually being reported: the drawer opens and focuses its input - the keyboard
comes up - while the sheet stays at `opacity: 0` because its reveal rule is keyed on
`.sc-sheet-backdrop.in` and the Ask drawer's backdrop is `#scAiBackdrop`.
dev/patch-747-ask-visible.py is the edit; dev/ai-button-check.cjs now reads the computed
opacity so this cannot pass again.

This script is the release itself: the number, the service worker cache (the OTA suite
requires the two to match) and the entry the update sheet reads.

    python3 dev/patch-747.py           # apply
    python3 dev/patch-747.py --check   # is the page already this release?
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "74.7"
VERSION_OLD = "const APP_VERSION = '74.6';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION
CACHE_OLD = "const CACHE_NAME = 'sidecut-shell-v74.6';"
CACHE_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"

# The head entry is what the update sheet and the store listing read: at least seven notes,
# ASCII, no downloader term, no [FULL] marker, no apostrophes in the single-quoted array,
# and every note short enough for the sheet. The last one says what did not move.
CHANGELOG_ENTRY = """  { version: '74.7', date: 'October 17, 2026 · 4:52 PM EDT', title: 'Ask SideCut fades up like the sheet it is built from - the drawer was opening invisibly and only the keyboard showed', items: [
    'The Ask SideCut drawer actually appears now. It was opening the whole time: the sheet it is built from starts transparent, and the rule that fades it in was keyed to a different backdrop, so the button looked dead while only the keyboard came up.',
    'It now fades up exactly like every other sheet, both from the sparkle in the Home header and from the sparkle on the multi-select bar.',
    'Nothing else about the drawer changed: it still names what is selected, still turns a sentence into a plan, and still changes nothing until Do it is tapped.',
    'The gate that guards it reads the sheet opacity from the page cascade instead of trusting a class name, so a drawer nobody can see is a red suite and not a passing one.',
    'Undo still takes the playlist, the crossfade and the DJ switch back together from the message bar.',
    'Medium is still the Home bubble size between automatic and tall, with the half-step heights and the Reset that clears them.',
    'The pill dock, the split Library tab and the 1/8 pad latch are where the last build left them.',
    'Nothing about the music moved: the player, the home widget, the letter-by-letter lyrics and the albums are unchanged, and no saved song or setting changed.',
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
    print("patch-747: checking the shipped page")
    look("APP_VERSION is %s" % VERSION, VERSION_NEW in src)
    look("the old version is gone", VERSION_OLD not in src)
    look("the service worker cache is sidecut-shell-v%s" % VERSION, CACHE_NEW in sw)
    head = CHANGELOG_ENTRY.split("\n")[0]
    look("the head entry is %s" % VERSION, head in src)
    look("the head entry is the newest entry", head in src and src.index(head) < src.index("  { version: '74.6',"))
    look("the drawer's reveal rule is in the page", "#scAiBackdrop.in .sc-sheet{" in src)
    if bad:
        print("patch-747: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-747: CHECK OK - the page is this release")
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
print("patch-747: applied %d edit(s)" % edits)
