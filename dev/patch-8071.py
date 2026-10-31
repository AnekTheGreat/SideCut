#!/usr/bin/env python3
"""80.7.1 - the stream is a song outside the app.

    python3 dev/patch-8071.py
    python3 dev/patch-8071.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

 1. LYRICS FOR A STREAM. The sheet asked the deck's queue and allTracks, so on a
    song playing from the source it said "Play a song first" over a song you could
    hear - and even when it did open, its clock read the paused deck. It is fed the
    streamed song now, the highlight follows the stream element, and the words are
    kept on the streamed song in the stream's own store.
 2. DJ MODE FOR A STREAM. Same cause: the deck took music from queue[queueIndex],
    which a stream is not in. The deck decodes the same bytes the stream is playing,
    every deck lookup resolves the streamed song, and leaving the rig hands the
    sound back to the stream at the second the platter stopped on.
 3. OUTSIDE THE APP. The background heartbeat watched activeAudio() - the deck's
    element - so a backgrounded stream read as "nothing playing" and the one thing
    that keeps a page alive out there stopped running for the song that was actually
    playing. It listens to whichever player is making sound, revives a stream the
    phone silenced, and the song and the second are remembered so a launch comes
    back to them.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.1'
OLD = '80.7'
MARKER = '80.7.1 - THE STREAM IS A SONG OUTSIDE THE APP'
ANCHOR = '  // 80.7 - A COLLAB IS A DROP, A FAKE RELEASE CAN BE DELETED, AND THE ALBUM'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8071: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


# The page block this release inserts lives in patch-8071-blocks.py: one file of
# twenty kilobytes is one silent truncation away from a broken release, and two
# readable halves are not.
BLOCKS = os.path.join(HERE, 'patch-8071-blocks.py')
with open(BLOCKS, encoding='utf-8') as fh:
    exec(compile(fh.read(), BLOCKS, 'exec'), globals())


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# The steps live beside this file, one section of the release per file, for the
# same reason the block does.
for _step_file in ('patch-8071-a.py', 'patch-8071-b1.py', 'patch-8071-b2.py', 'patch-8071-c.py'):
    _step_path = os.path.join(HERE, _step_file)
    with open(_step_path, encoding='utf-8') as _fh:
        exec(compile(_fh.read(), _step_path, 'exec'), globals())


if failed:
    print('patch-8071: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8071: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8071: %d steps applied, page is %s' % (len(applied), VERSION))
