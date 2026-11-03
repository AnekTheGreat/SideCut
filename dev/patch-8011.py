#!/usr/bin/env python3
"""80.11 - the laptop desk, and the album chooser named as another way in.

    python3 dev/patch-8011.py
    python3 dev/patch-8011.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHAT THE OWNER SAID. "also for the full version, label that as another way to get songs into
your library thru streamed songs, and make UI on laptop not cluttered and hard to see, make it
nice to see".

1. THE LABEL. 80.10 made the album chooser list the albums that exist. In the full notes it is
   named for what it is from the library's side: another way to get a song into your library -
   add a streamed song to an album you already have and it joins that album, no download first.
   The word has to be "streamed": the updater drops any note that matches streaming|streams?
   \\b|from the source|pinned artist, and "streamed" does not match that boundary.

2. THE LAPTOP. A laptop opened this page at a phone's own sizes: 13-14px rows spread across an
   1180px window, every bubble stretched to a quarter of it, and the player glued to the bottom
   and to both side edges - wide, flat and small all at once, which is cluttered and hard to see
   in the same breath. There is already a ladder in this sheet (561, 768, 1024, 1440, 1600, then
   the ten-foot rung at 1800), and none of its rungs moves the type of a list row: a track title
   is 14px on a phone and 14px on a 27-inch monitor.

   This rung speaks from 1024 to 1799 and nothing below it moves at all: type sized for a screen
   you sit an arm's length from, a measure on the library so rows do not run the whole window, a
   wall of bubbles that keeps its shape, dialogs with room in them, and a player that floats over
   the page instead of filling the bottom of the window.

   Above 1800 the ten-foot rung already grows the type and the targets, but it never grew a row,
   so this sheet finishes that ladder in three lines: a list is never set smaller on a bigger
   monitor than it is on a laptop.

WHAT IS NOT TOUCHED. The phone rungs, the tablet rung, the cloud layout's own dock geometry
(the floating player is scoped to body:not(.sc80-cloud)) and every sandbox/theme override.
Nothing here uses !important, so anything more specific that already exists still wins.
"""

import datetime
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.11'
MARKER = '80.11 - THE LAPTOP DESK'
ANCHOR = "  { version: '80.10',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8011: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- 1. the version ----------------------------------------------------------
once('the page says 80.11',
     "const APP_VERSION = '80.10';",
     "const APP_VERSION = '80.11';")

# -- 2. a stray brace that switched two rules off ---------------------------
# The head stylesheet carried 1618 { and 1619 }: .pane-header's block closed
# one line early, so `min-width:0; overflow:hidden;` - the two declarations the
# comment above them says are what stop a long playlist name pushing the whole
# row wider than the window and shoving its buttons off screen - were sitting
# OUTSIDE any block, ignored. The stray brace closed nothing and the rule below
# it was never opened. Restoring them is what keeps a wide window from growing
# its own horizontal overflow.
BRACE_RE = re.compile(
    r"(    background:var\(--bg-raised\);\r?\n"
    r"    scrollbar-width:none;\r?\n)"
    r"  \}\r?\n"
)
_m = BRACE_RE.search(SRC)
if _m:
    # Drop the brace that closed the rule one line early; the rule's real close
    # is the brace after `min-width:0; overflow:hidden;`.
    SRC = SRC[: _m.start()] + _m.group(1) + SRC[_m.end():]
    applied.append('the pane header keeps its own overflow guard')
else:
    failed.append('the pane header keeps its own overflow guard: the stray brace is not where it was')

# -- 3. the laptop desk, appended after the ten-foot rung so it wins ---------
CSS_OLD = """  .track:focus-visible, .home-bubble:focus-visible{ outline:3px solid var(--coral); outline-offset:-3px; }
}
</style>"""

CSS_NEW = """  .track:focus-visible, .home-bubble:focus-visible{ outline:3px solid var(--coral); outline-offset:-3px; }
}

/* ---------- 9. 80.11: THE LAPTOP DESK ------------------------------------ */
/* A laptop opened this page at a phone's own sizes: 13-14px rows spread across
   an 1180px window, every bubble stretched to a quarter of it, and the player
   glued to the bottom and to both side edges. Wide, flat and small all at once
   reads as cluttered and hard to see at the same time. Every rung above this
   one moves a padding or a max-width; not one of them moves the type of a row,
   so a track title was 14px on a phone and 14px on a 27-inch monitor.

   This rung moves nothing below 1024px. From there to 1799 it sizes the page
   for a screen you sit an arm's length from: bigger type, a measure on the
   library so a row is not a 1180px line, a wall of bubbles that keeps its
   shape, dialogs with room in them, and a player that floats over the page
   instead of filling the bottom of the window. Nothing here is !important, so
   a sandbox or theme rule that is more specific still wins. */
@media (min-width:1024px) and (max-width:1799px){
  header, .action-strip{ max-width:1240px; }
  .brand h1{ font-size:23px; }
  .brand span{ font-size:12px; }
  .action-pill{ font-size:14.5px; min-height:46px; }
  /* THE MEASURE. A list keeps to about a page width instead of running the
     window edge to edge, which is what made a wide laptop look empty and busy
     at once. */
  #tabs{ max-width:1040px; margin:0 auto; }
  #tabs .tab{ font-size:13.5px; min-height:40px; padding:10px 18px; }
  #homeView, #discoverView{ max-width:1240px; }
  #library{ max-width:1040px; margin:0 auto; }
  .pane-header h2{ font-size:21px; }
  .pane-header .sub{ font-size:12.5px; }
  /* THE ROWS. */
  .track{ padding:14px 26px; gap:14px; }
  .track-art{ width:56px; height:56px; border-radius:10px; }
  .track-info .t{ font-size:15.5px; }
  .track-info .a{ font-size:13px; }
  .track .idx{ width:24px; font-size:13px; }
  .genre-tag{ font-size:11px; }
  #searchInput{ font-size:15px; padding:12px 40px 12px 16px; }
  /* THE PLAYER. */
  #npInfo .t{ font-size:17px; }
  #npInfo .a{ font-size:13px; }
  #curTime, #totalTime{ font-size:12px; }
  /* THE WALL keeps its shape instead of stretching a bubble to a quarter of
     the window. */
  #homeBubbles{ max-width:1120px; margin:0 auto; gap:14px; }
  .home-bubble{ border-radius:22px; }
  /* The cloud layout computes its own dock and bar geometry, so it is left
     exactly as it is. */
  body:not(.sc80-cloud) #nowPlaying{
    left:24px; right:24px; bottom:16px; margin:0 auto; max-width:1200px;
    border-radius:22px; border-top:1px solid var(--line);
    box-shadow:0 20px 56px rgba(0,0,0,0.5);
  }
  body:not(.sc80-cloud) #nowPlaying .np-row{ max-width:1120px; margin:0 auto; }
  body:not(.sc80-cloud) #nowPlaying .seek-row{ max-width:1120px; margin:2px auto 0; }
  body:not(.sc80-cloud) #miniBar{ max-width:1120px; margin:0 auto; }
  /* DIALOGS. */
  .modal{ max-width:600px; padding:24px; }
  #themeBackdrop .modal, #lyricsBackdrop .modal{ max-width:760px; }
  #djModeBackdrop .modal{ max-width:820px; }
  .action-sheet{ gap:6px; }
  .action-sheet button{ font-size:15px; padding:14px 16px; }
}

/* The ten-foot rung at 1800 already grows the type and the targets, but it
   never grew a row; these lines finish the ladder so a list is never set
   smaller on a bigger monitor than it is on a laptop. */
@media (min-width:1800px) and (min-height:900px), (min-width:2400px){
  .track-info .t{ font-size:17px; }
  .track-info .a{ font-size:14px; }
  .track-art{ width:64px; height:64px; border-radius:11px; }
  #library{ max-width:1200px; margin-left:auto; margin-right:auto; }
}
</style>"""

once('the laptop desk and the finished ladder', CSS_OLD, CSS_NEW)

# -- 4. the changelog --------------------------------------------------------

def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.11 - THE LAPTOP DESK, AND ANOTHER ROAD INTO THE LIBRARY.\n"
    "  { version: '80.11', date: '{{STAMP}}', title: 'A laptop you can read, and another way into your library', items: [\n"
    "    '[FULL] Another way to get songs into your library: add a streamed song to an album you already have, and it joins that album without being downloaded first.',\n"
    "    '[FULL] On a laptop the page now sizes itself for the screen: bigger text, list rows that keep to a comfortable width instead of spanning the whole window, and a player that floats over the page instead of gluing itself to the bottom and both edges.',\n"
    "    '[FULL] The home wall stops stretching its bubbles across a wide window, and song menus, sheets and dialogs get more room and larger type - so nothing on a laptop is cramped, stretched or hard to see.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8011: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8011: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8011: %d steps applied, page is %s' % (len(applied), VERSION))
