#!/usr/bin/env python3
"""80.6.31 - the rail reaches every version, and the notes say what is new.

    python3 dev/patch-80631.py
    python3 dev/patch-80631.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.

Two things the owner asked for, in one release:

  1. "in the play build it should have the right side playlists and albums" - the
     rail's three page glyphs were built behind SC_STREAM_OK together with the
     streaming sheet, so an install without a source had no rail at all and
     Playlists and Albums could only be reached from the strip above the list.
     The three glyphs are built on every version now. The source switch under
     them is still the one part that needs a source, and it is still gated.

  2. "why are the patch notes referencing multiple builds, only mention the stuff
     about the new things" - the 80.6.30 entry was written entirely about the
     channels (both builds, each build updates to itself, a catch-up) and described
     nothing the app does. It is removed, and this release's entry talks about the
     rail and nothing else.

The long-form account is in dev/release-entry.md.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.31'
OLD = '80.6.30'
MARKER = '80.6.31 - THE RAIL IS ON EVERY VERSION'
OLD_ENTRY_HEAD = '  // 80.6.30 - THE PLAY BUILD CATCHES UP. dev/channel-hold.json held the Play side'
ANCHOR = '  // 80.6.29 - ONE LIBRARY PILL, A RAIL YOU CAN SEE THROUGH, AND A RAIL THAT HOLDS STILL.'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80631: already on the page, the page is %s' % VERSION)
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


# -- 1. the release itself -------------------------------------------------------
once('the version moves',
     "  const APP_VERSION = '%s';" % OLD,
     "  const APP_VERSION = '%s';" % VERSION)


def eastern():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


# -- 2. the rail is not a streaming feature --------------------------------------
# scShelfRender, scShelfBoot and scShelfApply all opened with the streaming gate,
# and the rail is filled by the first of them. So the pages were built only where
# the source could be switched to, which is the opposite of what a page called
# "Playlists" needs: it is the library's own page on every version.
once('the rail is painted on every version',
     "  function scShelfRender(){\n"
     "    if(!SC_STREAM_OK) return;                 // no rail, no sheet, outside the full builds\n"
     "    var rail = document.getElementById('scShelfRail');",
     "  function scShelfRender(){\n"
     "    // 80.6.31 - THE RAIL IS NOT A STREAMING FEATURE. The three page glyphs are the\n"
     "    // library's own pages - Songs, Playlists, Albums - and gating them on the source\n"
     "    // took the only shortcut to Playlists and Albums away from the version that has\n"
     "    // no source switch. The glyphs are built everywhere; the switch below them is\n"
     "    // the part that is still gated, inside the markup below.\n"
     "    var rail = document.getElementById('scShelfRail');")

once('the page glyphs are built without the sheet',
     "  function scShelfBoot(){\n"
     "    if(!SC_STREAM_OK) return;\n"
     "    if(scShelf.built) return;",
     "  function scShelfBoot(){\n"
     "    // 80.6.31 - the sheet still needs the source; the rail does not. Everything the\n"
     "    // boot creates besides the sheet is the rail and its scrim, so it runs wherever\n"
     "    // the rail element is.\n"
     "    if(scShelf.built) return;")

once('the switch is the only part that needs a source',
     "      h += '<div class=\"scshelf-sep\"></div>';\n"
     "      h += '<button type=\"button\" class=\"scshelf-tab scshelf-src\" data-src=\"1\"' +\n"
     "        ' aria-pressed=\"false\" aria-label=\"On this device\" title=\"On this device\">' +\n"
     "        '<span class=\"scshelf-i scshelf-i-str\">' + scIcon('stream', 17) + '</span>' +\n"
     "        '<span class=\"scshelf-i scshelf-i-dev on\">' + scIcon('device', 17) + '</span>' +\n"
     "        '</button>';\n"
     "      rail.innerHTML = h;",
     "      // 80.6.31 - THE SWITCH NEEDS A SOURCE. The three glyphs above are the library's\n"
     "      // pages and every version gets them; a switch that flips between the device and\n"
     "      // a source would be a door into a room this build does not have, so it is built\n"
     "      // only where there is a source to flip to.\n"
     "      if(SC_STREAM_OK){\n"
     "        h += '<div class=\"scshelf-sep\"></div>';\n"
     "        h += '<button type=\"button\" class=\"scshelf-tab scshelf-src\" data-src=\"1\"' +\n"
     "          ' aria-pressed=\"false\" aria-label=\"On this device\" title=\"On this device\">' +\n"
     "          '<span class=\"scshelf-i scshelf-i-str\">' + scIcon('stream', 17) + '</span>' +\n"
     "          '<span class=\"scshelf-i scshelf-i-dev on\">' + scIcon('device', 17) + '</span>' +\n"
     "          '</button>';\n"
     "      }\n"
     "      rail.innerHTML = h;")

once('a page glyph opens a page without a source',
     "  function scShelfOpenTab(tab){\n"
     "    if(!SC_STREAM_OK) return;\n"
     "    if(tab === 'streaming'){ scShelf.page = 'library'; scShelf.src = 's'; scShelfApply(); return; }",
     "  function scShelfOpenTab(tab){\n"
     "    // 80.6.31 - the page glyphs are not gated any more; only the one destination that\n"
     "    // needs a source is, because there is nothing on the other side of it without one.\n"
     "    if(tab === 'streaming'){\n"
     "      if(!SC_STREAM_OK) return;\n"
     "      scShelf.page = 'library'; scShelf.src = 's'; scShelfApply(); return;\n"
     "    }")

once('the painter runs wherever the rail is',
     "  function scShelfApply(){\n"
     "    if(!SC_STREAM_OK) return;\n"
     "    var page = (scShelf.page === 'albums')",
     "  function scShelfApply(){\n"
     "    var page = (scShelf.page === 'albums')")

once('the source branch still needs a source',
     "    if(scShelf.src === 's'){\n"
     "      scShelf.open = true;",
     "    if(scShelf.src === 's' && SC_STREAM_OK){\n"
     "      scShelf.open = true;")

# -- 3. the rail setting is not a full-build row either --------------------------
# Tools hides the rail card when there is no source. There is a rail everywhere now,
# so the row that sets it belongs everywhere too - otherwise the rail ships at 85%
# with no way to change it.
once('the rail setting is offered on every version',
     "    // The rail is only in the full builds, so the row that sets it is only there too.\n"
     "    var card = document.getElementById('scRailGlassCard');\n"
     "    if(card && typeof SC_STREAM_OK !== 'undefined' && !SC_STREAM_OK) card.style.display = 'none';\n",
     "    // 80.6.31 - the rail is on every version now, so the row that sets it is too.\n")

# -- 4. the changelog ------------------------------------------------------------
# The 80.6.30 entry was about the channels, not the app: "Both builds publish the
# same page from here", "Each build updates to itself", a catch-up that changed
# nothing anyone can see. It is dropped rather than reworded, because a note that
# only explains the release process is not a patch note. The version itself stays
# released; a changelog is a list of what changed, and that version changed nothing.
if OLD_ENTRY_HEAD in SRC:
    start = SRC.index(OLD_ENTRY_HEAD)
    end = SRC.index('\n  ]},\n', SRC.index("{ version: '%s'" % OLD, start)) + len('\n  ]},\n')
    SRC = SRC[:start] + SRC[end:]
    applied.append('the catch-up entry, which talked about channels instead of the app')
else:
    failed.append('the catch-up entry: its comment is not on the page')

ENTRY = (
    "  // 80.6.31 - THE RAIL IS ON EVERY VERSION. The owner: \"in the play build it should\n"
    "  // have the right side playlists and albums\". The three page glyphs were built\n"
    "  // inside SC_STREAM_OK with the streaming sheet, so the version without a source\n"
    "  // had no rail at all and Playlists and Albums were a scroll back to the strip.\n"
    "  // The glyphs are built everywhere now; the switch under them is still gated.\n"
    "  { version: '80.6.31', date: '{{STAMP}}', title: 'Playlists and albums on the rail', items: [\n"
    "    'The side rail is there on every version now: Songs, Playlists and Albums, fixed at the right edge of the library, with the page you are on lit.',\n"
    "    'Playlists opens the playlist strip, Albums opens your albums and Songs opens All Songs - the same pages the strip above the list has, without scrolling back up to reach them.',\n"
    "    'The see-through amount in Tools sets that rail too, from solid to glyphs only, and the rail still holds its place while you move between the three pages.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
if ANCHOR in SRC:
    once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)
else:
    failed.append('the changelog anchor for 80.6.29 is not on the page')

if failed:
    print('patch-80631: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80631: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80631: %d steps applied, page is %s' % (len(applied), VERSION))
