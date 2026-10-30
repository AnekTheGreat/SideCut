#!/usr/bin/env python3
"""80.6.22 - part 1 of 3: the bar is the bar.

The page edits are split across two sibling files because a release ships them by
being committed, and a single payload that size does not survive the commit call.
Each part is idempotent on its own and chains to the next, so running THIS file is
running the whole release:

    python3 dev/patch-80622.py
    python3 dev/patch-80622.py --check
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.22'
OLD = '80.6.21'
MARKER = '80.6.22 - THE BAR IS THE BAR. A streamed song'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()


def chain():
    rc = subprocess.call([sys.executable, os.path.join(HERE, 'patch-80622-b.py')] + (['--check'] if CHECK else []))
    sys.exit(rc)


if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80622: part 1 is already on the page')
    chain()

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- the bar draws no skin of its own --------------------------------------
swap('the stream skin leaves the bar',
     "body.sc-stream-now #nowPlaying{ border-top:1px solid color-mix(in srgb, var(--coral) 32%, transparent); }\n"
     "body.sc-stream-now #npDisc{ box-shadow: 0 0 0 2px color-mix(in srgb, var(--coral) 22%, transparent), 0 0 18px color-mix(in srgb, var(--coral) 16%, transparent); }\n"
     "body.sc-stream-now #npArtist .sc-pill{ }\n",
     "/* 80.6.22 - THE BAR IS THE BAR. A streamed song used to draw a coral edge, a\n"
     "   glowing disc and a pill on this bar, which made the player change shape the\n"
     "   moment the song came from the source. It draws nothing of its own now. */\n")

swap('the bar says the artist, and only the artist',
     "      var who = document.getElementById('npArtist');\n"
     "      if(who){\n"
     "        var pill = '<span style=\"display:inline-block;font-size:8.5px;font-weight:800;letter-spacing:1.2px;'\n"
     "          + 'color:var(--coral);border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);'\n"
     "          + 'border-radius:999px;padding:1px 5px;margin-right:5px;vertical-align:1.5px;\">STREAM</span>';\n"
     "        who.innerHTML = pill + escapeHtml(scStreamMeta(t));\n"
     "      }\n",
     "      // 80.6.22 - THE SAME TWO LINES A DOWNLOADED SONG WRITES. No pill, no\n"
     "      // length, no genre: the deck sets this element to the artist and stops, so\n"
     "      // a stream sets it to the artist and stops.\n"
     "      var who = document.getElementById('npArtist');\n"
     "      if(who) who.textContent = String(t.artist || 'Streaming');\n")

# -- the state grows albums, and remembers which kind of list is open ------
swap('the state carries albums and the open kind',
     "    via: '', err: '', barOn: false, genre: '', genres: null, railLeft: 0\n  };",
     "    via: '', err: '', barOn: false, genre: '', genres: null, railLeft: 0,\n"
     "    albums: null, plKind: 'pl'\n  };")

swap('an entry knows which player owns it',
     "  function scStreamPlItem(t){\n    t = t || {};\n    return {\n      id: String(t.id || ''),",
     "  function scStreamPlItem(t){\n    t = t || {};\n    return {\n"
     "      // 80.6.22 - WHICH PLAYER OWNS IT. 's' is a song from the source, 'd' is a\n"
     "      // file already on the device; a list holds either, and this is what tells\n"
     "      // the two apart when the list is played.\n"
     "      kind: (String(t.kind || 's') === 'd' ? 'd' : 's'),\n"
     "      id: String(t.id || ''),")

swap('a file is not thrown away on load',
     "      }).filter(function(it){ return !!(it.id && it.videoId); });",
     "      }).filter(function(it){ return !!(it.id && (it.videoId || it.kind === 'd')); });")

# -- the release itself ----------------------------------------------------
swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

swap('the changelog', "  const CHANGELOG = [\n",
     "  const CHANGELOG = [\n"
     "  { version: '80.6.22', date: '2026-10-30', title: 'The bar is the bar, and your streaming albums', items: [\n"
     "    '[FULL] The player bar no longer changes for a stream. A streamed song writes the same two lines a downloaded one does - the title and the artist - so there is no badge, no extra length and no colour of its own; the bar is the same bar either way.',\n"
     "    '[FULL] A row is held, not closed. The x on every streaming row is gone: press and hold a song for two seconds and it opens its own popup with Play, Add to a playlist, Add to an album and Delete.',\n"
     "    '[FULL] Streaming albums, made the way downloaded ones are. Name an album from the Streaming page, open it as a page, play the whole thing, and add songs to it from a row popup.',\n"
     "    '[FULL] One list can hold both. A streaming playlist or album can take songs from your device beside ones from the source, each row saying which it is, and Play all keeps your order across the two.',\n"
     "  ]},\n")

if failed:
    print('patch-80622: part 1, %d step(s) did not apply:' % len(failed))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80622: part 1 pending - %d step(s) to apply, the page is %s' % (len(applied), OLD))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80622: part 1 applied (%d steps), the page is %s' % (len(applied), VERSION))
chain()
