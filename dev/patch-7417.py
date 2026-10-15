#!/usr/bin/env python3
"""
74.1.7 - four things in the Studio, all of them the owner's words.

  * "why are their protruding lines" (with a screenshot): the storage cleaner's rows
    had the song name and the artist painted straight across the Re-encode button
    and off the right of the screen. 74.1.6 made the left of a row a <button>, and a
    button may only hold phrasing content - so the two lines became <span>s, and a
    span lays out INLINE, where `overflow: hidden` and `text-overflow: ellipsis` do
    nothing at all. The lines are blocks again and the row clips.
  * "have an option to re encode to a higher quality various options should appear":
    the Re-encode button opens the rates - 96 to 320 kbps - and each one says what it
    would do to THAT song in MB, including saying plainly when it would grow the file.
  * "it should be able to re encode in the background": the job holds a Web Lock, works
    in three-times slices while the page is hidden, is written down before its first
    byte and cleared when it ends, and shows its song, rate and percentage in the
    cleaner while it runs.
  * "you should be able to reorder playlists in manage playlists": a Reorder mode in
    the panel, arrows instead of drag, and the Library tabs follow the order - the
    same order the tab strip's own drag writes.

The page is ONE 3.2 MB index.html and the machine that prepares a release has no git
credentials and cannot push a file that size, so a page change can only ship from
inside the repository - by something that edits the file and pushes what it wrote.
This script is that something, exactly as dev/patch-7416.py was: the release workflow
runs it on the checked-out tree and commits the result.

THE TEXT IT WRITES IS NOT IN THIS FILE. dev/patch-7417-page.py holds the page, its
stylesheet and its wires; dev/patch-7417-notes.py holds the version bump and the
changelog entry. Both are exec'd into this module's globals below. The reason is the
same one that makes the page ship this way at all: every byte travels by hand, one API
call per file, and a single call big enough to be cut off is a release that does not
ship.

It is idempotent. Every edit checks for its own output first and skips when the page
already carries it, so re-running it changes nothing and pushes nothing.

  python3 dev/patch-7417.py            # apply (or report it is already applied)
  python3 dev/patch-7417.py --check    # report only, exit 1 if the page is behind
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
CHECK = '--check' in sys.argv

# The page text, into this module's globals: the CSS, the rate sheet, the job, the
# cleaner row, the wires, the panel - and VERSION, the changelog anchor and entry.
for _text in ('patch-7417-page.py', 'patch-7417-notes.py'):
    with open(os.path.join(HERE, _text), encoding='utf-8') as _fh:
        exec(_fh.read(), globals())

changes = []
problems = []


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as fh:
        fh.write(text)


def edit(rel, old, new, label):
    """Replace one exact block, once. Already-applied counts as done, not an error."""
    src = read(rel)
    if new in src:
        print('  = %s (already applied)' % label)
        return
    n = src.count(old)
    if n != 1:
        problems.append('%s: anchor found %d times in %s' % (label, n, rel))
        print('  ! %s: anchor found %d times in %s' % (label, n, rel))
        return
    write(rel, src.replace(old, new, 1))
    changes.append(label)
    print('  + %s' % label)


def eastern_stamp():
    """Eastern time of this run as 'Month D, YYYY · H:MM PM EDT'.

    The build sandbox runs on UTC with no tzdata, so Eastern is computed as UTC minus
    four hours (EDT) rather than asked for - and the date rolls back with it, which is
    the bug the versioning note records (64.2.4/64.2.5 were stamped a day ahead). The
    stamp is this run's own time, so it is never in the future of the commit that
    carries it.
    """
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    hour = now.hour % 12 or 12
    ampm = 'AM' if now.hour < 12 else 'PM'
    return '%s %d, %d · %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, hour, now.minute, ampm)


print('74.1.7 patch - %s' % ROOT)
if CHECK:
    for rel, needle, label in (
        ('index.html', VERSION_NEW, 'APP_VERSION is %s' % VERSION),
        ('sw.js', SW_NEW, 'sw cache is v%s' % VERSION),
        ('index.html', "version: '%s'" % VERSION, 'changelog entry'),
        ('index.html', '.sc-store-name{ display: block;', 'a row line is a block that can clip'),
        ('index.html', 'var REENCODE_RATES = [96, 128, 160, 192, 256, 320];', 'the six rates'),
        ('index.html', 'function scReenPickHtml', 'the rate sheet'),
        ('index.html', 'function scJobLock', 'the job holds a Web Lock'),
        ('index.html', 'sidecut_encodeJob', 'a running job is written down'),
        ('index.html', 'function movePlaylist', 'the playlists can move'),
        ('index.html', 'manageReorderBtn', 'the panel offers reorder mode'),
    ):
        if needle not in read(rel):
            problems.append('%s: %s missing' % (label, rel))
            print('  ! %s missing in %s' % (label, rel))
        else:
            print('  \u2713 %s' % label)
    print('CHECKS: %s' % ('FAILED' if problems else 'OK'))
    sys.exit(1 if problems else 0)

# 1. the row that no longer lets a name out of it
edit('index.html', CSS_OLD, CSS_NEW, 'a cleaner row clips its own lines')
edit('index.html', CSS_PICK_OLD, CSS_PICK_NEW, 'the rate sheet and the job strip get their rules')
# 2. the rates, including up
edit('index.html', REEN_OLD, REEN_NEW, 'the Re-encode button offers six rates, 96 to 320 kbps')
# 3. the compress that carries on
edit('index.html', JOB_OLD, JOB_NEW, 'a job holds a Web Lock and is written down before it starts')
edit('index.html', STRIP_OLD, STRIP_NEW, 'the cleaner shows the job and reports a killed one')
edit('index.html', ROW_OPEN_OLD, ROW_OPEN_NEW, 'the row is highlighted for whichever panel it opens')
edit('index.html', ROW_DIV_OLD, ROW_DIV_NEW, 'including the rate sheet')
edit('index.html', ROWBTN_OLD, ROWBTN_NEW, 'the row it belongs to says Encoding...')
edit('index.html', ROWPICK_OLD, ROWPICK_NEW, 'the rate sheet hangs under its own row')
edit('index.html', RO_HEAD_OLD, RO_HEAD_NEW, 'reencodeOne records the job before it decodes')
edit('index.html', RO_TAIL_OLD, RO_TAIL_NEW, 'and hands the whole run to the lock')
edit('index.html', ENCODE_OLD, ENCODE_NEW, 'the encoder reports its slices to the job')
edit('index.html', SLICE_DEF_OLD, SLICE_DEF_NEW, 'a hidden page does three slices per wake-up')
edit('index.html', SLICE_MP3_OLD, SLICE_MP3_NEW, 'the mp3 loop reads the hidden-slice rule')
edit('index.html', SLICE_WAV_OLD, SLICE_WAV_NEW, 'and so does the wav writer')
edit('index.html', WIRE_OLD, WIRE_NEW, 'the two buttons answer the tap')
edit('index.html', ACT_OLD, ACT_NEW, 'the bubble and the rate sheet never both show')
# 4. the playlists that can move
edit('index.html', MP_HEAD_OLD, MP_HEAD_NEW, 'Manage playlists carries reorder mode and the move')
edit('index.html', MP_ROWBTN_OLD, MP_ROWBTN_NEW, 'a row in reorder mode is a name, not a switch')
edit('index.html', MP_ROWTAIL_OLD, MP_ROWTAIL_NEW, 'and it carries the two arrows')
edit('index.html', MP_UNSORTED_OLD, MP_UNSORTED_NEW, 'the Unsorted switch stands down while reordering')
edit('index.html', MP_CLOSE_OLD, MP_CLOSE_NEW, 'closing the panel leaves reorder mode')
# 5. what the gates drive, and the promise a caller can wait on
edit('index.html', PUB_OLD, PUB_NEW, 'the job and the panel are published for the gates')
edit('index.html', TRACK_OLD, TRACK_NEW, 'reencodeTrack hands back the job it started')
# 6. the release itself
edit('index.html', VERSION_OLD, VERSION_NEW, 'APP_VERSION -> %s' % VERSION)
edit('sw.js', SW_OLD, SW_NEW, 'sw cache -> v%s' % VERSION)
edit('index.html', CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + CHANGELOG_ENTRY % eastern_stamp(), 'changelog entry')

if problems:
    print('\nFATAL: %d anchor(s) could not be applied - the page has moved on:' % len(problems))
    for p in problems:
        print('  - %s' % p)
    sys.exit(1)

if not changes:
    print('\nThe page already carries %s - nothing written.' % VERSION)
else:
    print('\nApplied %d edit(s) for %s.' % (len(changes), VERSION))
