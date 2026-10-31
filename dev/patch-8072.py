#!/usr/bin/env python3
"""80.7.2 - the phone follows the song that is playing, and a crop can come off it.

    python3 dev/patch-8072.py
    python3 dev/patch-8072.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

 1. THE WIDGET AND THE CARD. widgetTrackSeq is the native side's high-water mark:
    a push carrying an older sequence is dropped as stale. Only a downloaded song
    bumped it, so a streamed song went out with the last download's number and the
    widget kept the deck while the stream played. A streamed song is a new sequence
    now, and the six-second heartbeat pushes the stream too - it used to return at
    `if(!widgetTrack)` and never run for a song that had never been on the deck.
 2. THE PRESS FROM OUTSIDE. Resuming was written for a downloaded song: a paused
    stream answered "nothing to pick back up". The same press now starts the stream
    at the second it stopped on, and the boot arm no longer replaces the stream's
    card with a silent deck song three seconds after launch.
 3. CROP OFF A STREAM. The crop sheet refused anything without a File, so a song
    played from the catalogue could not be cropped at all. Its bytes are read the
    same way the deck reads them and the clip is saved as a new library song - the
    streamed row is not a file and is never rewritten.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.2'
MARKER = '80.7.2 - THE PHONE FOLLOWS THE SONG THAT IS PLAYING'
ANCHOR = '  // 80.7.1 - THE STREAM IS A SONG OUTSIDE THE APP'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8072: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []

for _part in ('patch-8072-blocks.py',):
    _path = os.path.join(HERE, _part)
    with open(_path, encoding='utf-8') as _fh:
        exec(compile(_fh.read(), _path, 'exec'), globals())


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


for _step_file in ('patch-8072-a.py', 'patch-8072-b.py', 'patch-8072-c.py'):
    _step_path = os.path.join(HERE, _step_file)
    with open(_step_path, encoding='utf-8') as _fh:
        exec(compile(_fh.read(), _step_path, 'exec'), globals())


if failed:
    print('patch-8072: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8072: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8072: %d steps applied, page is %s' % (len(applied), VERSION))
