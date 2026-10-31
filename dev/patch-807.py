#!/usr/bin/env python3
"""80.7 - a collab is a drop, a fake release can be deleted, and the album
sheet opens in two seconds.

    python3 dev/patch-807.py
    python3 dev/patch-807.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

 1. THE COLLAB. fetchArtistReleases compared the FIRST name of a credit with the
    pinned artist, so a record filed under one artist and credited to both was
    thrown away when the pinned artist was not printed first - the Daddy Yankee x
    Diljit Dosanjh single never reached Diljit's list. A credit is a list of names
    now, and any credited name matching is enough.
 2. THE FAKE RELEASE. The Discover list dropped a row on a ~600ms hold, looked it
    up in one artist key only, and never asked. It is a two-second hold and a
    Delete button on every release surface, with Undo, and the delete goes through
    every stored copy of the drop.
 3. THE ALBUM SHEET. Both holds that open "Reorder Songs" were three seconds. They
    are two, and the sheet opens on the song that was held instead of the top.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7'
OLD = '80.6.32'
MARKER = '80.7 - A COLLAB IS A DROP'
ANCHOR = '  // 80.6.32 - THE PILLS SNAP, AND THE RAIL CAN BE ARRANGED.'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-807: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


# The two literals this release inserts live in patch-807-blocks.py - see the note
# at the top of that file for why.
BLOCKS = os.path.join(HERE, 'patch-807-blocks.py')
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

# The steps live beside this file, one section of the release per file: a
# thousand lines of page text copied into one driver is only a place to
# mistype them.
for _step_file in ('patch-807-steps1.py', 'patch-807-steps2.py', 'patch-807-steps3.py'):
    _step_path = os.path.join(HERE, _step_file)
    with open(_step_path, encoding='utf-8') as _fh:
        exec(compile(_fh.read(), _step_path, 'exec'), globals())


if failed:
    print('patch-807: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-807: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-807: %d steps applied, page is %s' % (len(applied), VERSION))
