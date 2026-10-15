#!/usr/bin/env python3
"""
74.1.6 - tapping a song in Studio's storage cleaner opens its bubble.

The ask, in the owner's words: "I should be able to click on the name of the song
and the bubble for it pops up showing the mb and full artist name."

That is the one thing a cleaner row cannot do. A row carries a clipped name and a
clipped artist on purpose - 24 of them have to fit one screen beside a Re-encode
button - so the row shows the artist as "Karan Aujla, Mxrci, Seshnolan ..." and the
size as "19.7 MB..." and the whole string is only ever in the data. Now the left of
the row (cover, name, the line under it) is a button: tapping it opens a bubble
under the row with the whole name, every artist in full, the exact size in MB, the
length, the album, the bitrate the file reads at, and what a re-encode at the
bitrate chosen above would win back.

The page is ONE 3.2 MB index.html and the machine that prepares a release has no
git credentials and cannot push a file that size, so a page change can only ship
from inside the repository - by something that edits the file and pushes what it
wrote. This script is that something, exactly as dev/patch-7415.py was: the release
workflow runs it on the checked-out tree and commits the result.

THE TEXT IT WRITES IS NOT IN THIS FILE. dev/patch-7416-bubble.py holds the bubble,
the row and their stylesheet rules; dev/patch-7416-notes.py holds the version bump
and the changelog entry. Both are exec'd into this module's globals below. The
reason is the same one that makes the page ship this way at all: every byte travels
by hand, one API call per file, and a single call big enough to be cut off is a
release that does not ship. Four files of four kilobytes cannot be cut off.

It is idempotent. Every edit checks for its own output first and skips when the
page already carries it, so re-running it changes nothing and pushes nothing.

  python3 dev/patch-7416.py            # apply (or report it is already applied)
  python3 dev/patch-7416.py --check    # report only, exit 1 if the page is behind
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
CHECK = '--check' in sys.argv

# The page text, into this module's globals: INFO_HELPERS, ROW_*, CSS_*, ACT_*,
# VERSION, *_OLD, *_NEW, CHANGELOG_ANCHOR, CHANGELOG_ENTRY.
for _text in ('patch-7416-bubble.py', 'patch-7416-notes.py'):
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


def edit_between(rel, start, end, new, label):
    """Rewrite everything from `start` up to and including `end` with `new`.

    The block being replaced is the cleaner's row builder - six lines that a future
    release is free to reflow - so it is picked out by its own first and last line
    rather than typed out here byte for byte.
    """
    src = read(rel)
    if new in src:
        print('  = %s (already applied)' % label)
        return
    a = src.find(start)
    b = src.find(end, a + 1) if a != -1 else -1
    if a == -1 or b == -1 or src.count(start) != 1 or src.count(end) != 1:
        problems.append('%s: block markers found start=%d end=%d in %s' % (label, a, b, rel))
        print('  ! %s: block markers not found cleanly in %s' % (label, rel))
        return
    write(rel, src[:a] + new + src[b + len(end):])
    changes.append(label)
    print('  + %s' % label)


def eastern_stamp():
    """Eastern time of this run as 'Month D, YYYY · H:MM PM EDT'.

    The build sandbox runs on UTC with no tzdata, so Eastern is computed as UTC
    minus four hours (EDT) rather than asked for - and the date rolls back with it,
    which is the bug the versioning note records (64.2.4/64.2.5 were stamped a day
    ahead). The stamp is this run's own time, so it is never in the future of the
    commit that carries it.
    """
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    hour = now.hour % 12 or 12
    ampm = 'AM' if now.hour < 12 else 'PM'
    return '%s %d, %d · %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, hour, now.minute, ampm)


print('74.1.6 patch - %s' % ROOT)
if CHECK:
    for rel, needle, label in (
        ('index.html', VERSION_NEW, 'APP_VERSION is %s' % VERSION),
        ('sw.js', SW_NEW, 'sw cache is v%s' % VERSION),
        ('index.html', "version: '%s'" % VERSION, 'changelog entry'),
        ('index.html', 'function scInfoHtml', 'the cleaner bubble'),
        ('index.html', 'data-act="storeinfo"', 'the row is a door'),
        ('index.html', '.sc-info-name{', 'the bubble keeps the whole name'),
    ):
        if needle not in read(rel):
            problems.append('%s: %s missing' % (label, rel))
            print('  ! %s missing in %s' % (label, rel))
        else:
            print('  ✓ %s' % label)
    print('CHECKS: %s' % ('FAILED' if problems else 'OK'))
    sys.exit(1 if problems else 0)

edit('index.html', STORAGE_ANCHOR, INFO_HELPERS + STORAGE_ANCHOR, 'the bubble markup and its two readings')
edit_between('index.html', ROW_START, ROW_END, ROW_NEW, 'a cleaner row opens its own bubble')
edit('index.html', CSS_ANCHOR, CSS_NEW, 'the bubble is never clipped')
edit('index.html', ACT_OLD, ACT_NEW, 'the row answers the tap')
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
