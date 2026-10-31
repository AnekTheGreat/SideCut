#!/usr/bin/env python3
"""80.7.3 - the more-options menu on the player belongs to the song on the screen.

    python3 dev/patch-8073.py
    python3 dev/patch-8073.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

 1. THE MENU. 80.7.2 gave a song played from the catalogue a Crop, but only its
    row in the catalogue list could reach it: the sheet behind the player's
    vertical dots read the deck queue and nothing else, so with that song playing
    it answered "Play a song first" - or opened the menu of the last download,
    which is the one thing that is not playing. The dots ask the song on the
    screen first now, and the catalogue song's own sheet - Play, Crop a clip,
    the playlists, the albums - opens from there.
 2. THE CHANGELOG, as every release has it.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.3'
MARKER = '80.7.3 - THE MENU BELONGS TO THE SONG ON THE SCREEN'
ANCHOR = '  // 80.7.2 - THE PHONE FOLLOWS THE SONG THAT IS PLAYING.'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8073: already on the page, the page is %s' % VERSION)
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
once('the page says 80.7.3',
     "const APP_VERSION = '80.7.2';",
     "const APP_VERSION = '80.7.3';")

# -- 2. the dots on the player ask the song on the screen --------------------
once('the player menu asks the song that is playing',
     "  function showNpMenu() {\n"
     "    if(queueIndex < 0 || queueIndex >= queue.length) {\n"
     "      toast('Play a song first');\n"
     "      return;\n"
     "    }\n"
     "    const id = queue[queueIndex];\n"
     "    if(!allTracks.some(tr => tr.id === id)) return;\n"
     "    openSongActions(id);\n"
     "  }\n",
     "  function showNpMenu() {\n"
     "    // 80.7.3 - THE MENU BELONGS TO THE SONG ON THE SCREEN. This read the deck\n"
     "    // queue and nothing else, so with a song from the catalogue playing it\n"
     "    // answered 'Play a song first' - or opened the menu of the last download,\n"
     "    // which is the one song that is not playing. The Crop that a catalogue\n"
     "    // song earned in 80.7.2 could only be reached by long-pressing its row.\n"
     "    if(typeof scStreamMenu === 'function' && typeof scStreamState === 'object'\n"
     "       && scStreamState && scStreamState.barOn && scStreamState.curId){\n"
     "      scStreamMenu(scStreamState.curId, 'np');\n"
     "      return;\n"
     "    }\n"
     "    if(queueIndex < 0 || queueIndex >= queue.length) {\n"
     "      toast('Play a song first');\n"
     "      return;\n"
     "    }\n"
     "    const id = queue[queueIndex];\n"
     "    if(!allTracks.some(tr => tr.id === id)) return;\n"
     "    openSongActions(id);\n"
     "  }\n")

# -- 3. the changelog -------------------------------------------------------
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
    "  // 80.7.3 - THE MENU BELONGS TO THE SONG ON THE SCREEN.\n"
    "  // The vertical dots on the player read the deck queue and nothing else, so a\n"
    "  // song played from the catalogue answered \"Play a song first\" there - or\n"
    "  // opened the menu of the last downloaded song, the one song that is silent.\n"
    "  // The dots ask what is on the screen now, and its own sheet comes up with the\n"
    "  // crop and the lists on it.\n"
    "  { version: '80.7.3', date: '{{STAMP}}', title: 'The dots on the player open the menu of the song you are hearing', items: [\n"
    "    'The more-options menu on the player now opens the actions for the song on the screen instead of the last song in the download queue, so a song played straight from the catalogue offers Crop a clip right where you are already looking at it.',\n"
    "    'Cropping a song played straight from the catalogue saves the part you keep into your library as its own song, cover and all, and leaves the song it came off exactly as it was.',\n"
    "    'The same menu carries Play, Add to a playlist and Add to an album for that song, and it no longer answers that nothing is playing while that song is on the bar.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8073: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8073: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8073: %d steps applied, page is %s' % (len(applied), VERSION))
