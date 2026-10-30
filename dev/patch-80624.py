#!/usr/bin/env python3
"""80.6.24 - the patch notes carry their day and their Eastern time again.

    python3 dev/patch-80624.py
    python3 dev/patch-80624.py --check

Twelve releases (80.6.12 through 80.6.23) were stamped `2026-10-30` - a bare ISO day,
with no clock on it - while the 393 entries before them carry the day and the Eastern
time the release actually happened at ('October 29, 2026 · 8:04 PM EDT'). This puts
the real times back, taken from each release commit, and keeps the convention.

Idempotent: a second run over the patched page is a no-op and --check says so.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.24'
OLD = '80.6.23'
MARKER = '80.6.24 - THE PATCH NOTES CARRY THE DAY AND THE TIME'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80624: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


def eastern(now=None):
    """The Eastern time of this run, as the page's changelog has always written it.

    'October 30, 2026 · 7:02 PM EDT'. October still runs on daylight time, so the
    clock is UTC-4 and the label is EDT; the arithmetic is the same one
    dev/release-record.py does for the memory entry.
    """
    now = now or datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    now = now - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


# The time each of these releases actually landed, read from its release commit in
# Eastern time - not the day the patch happened to be written on. 80.6.12 through
# 80.6.20 landed on the evening of October 29; 80.6.21 through 80.6.23 on October 30.
STAMPS = [
    ('80.6.12', 'October 29, 2026 \u00b7 8:04 PM EDT'),
    ('80.6.13', 'October 29, 2026 \u00b7 9:14 PM EDT'),
    ('80.6.14', 'October 29, 2026 \u00b7 9:37 PM EDT'),
    ('80.6.15', 'October 29, 2026 \u00b7 9:46 PM EDT'),
    ('80.6.16', 'October 29, 2026 \u00b7 10:24 PM EDT'),
    ('80.6.17', 'October 29, 2026 \u00b7 10:37 PM EDT'),
    ('80.6.18', 'October 29, 2026 \u00b7 10:46 PM EDT'),
    ('80.6.19', 'October 29, 2026 \u00b7 10:54 PM EDT'),
    ('80.6.20', 'October 29, 2026 \u00b7 11:10 PM EDT'),
    ('80.6.21', 'October 30, 2026 \u00b7 7:26 AM EDT'),
    ('80.6.22', 'October 30, 2026 \u00b7 5:20 PM EDT'),
    ('80.6.23', 'October 30, 2026 \u00b7 6:25 PM EDT'),
]

# -- the twelve bare days get their day and their clock back -----------------
for ver, stamp in STAMPS:
    swap('the day and time on ' + ver,
         "{ version: '%s', date: '2026-10-30'," % ver,
         "{ version: '%s', date: '%s'," % (ver, stamp))

# -- the release itself ------------------------------------------------------
swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

swap('the changelog', "  const CHANGELOG = [\n",
     "  const CHANGELOG = [\n"
     "  // 80.6.24 - THE PATCH NOTES CARRY THE DAY AND THE TIME. Twelve entries (80.6.12 through\n"
     "  // 80.6.23) were stamped with a bare `2026-10-30` - no time, and the wrong day for the\n"
     "  // nine that landed on the evening of the 29th - while every earlier entry carries\n"
     "  // 'October 29, 2026 \u00b7 8:04 PM EDT'. Each of the twelve now carries the Eastern time of\n"
     "  // its own release commit; the app has never shown anything but a date there, and this\n"
     "  // is why the date alone was not enough.\n"
     "  { version: '%s', date: '%s', title: 'The patch notes carry their day and their time', items: [\n"
     "    '[FULL] Every release in this list now shows the day it landed and the Eastern time it landed at, the way the notes before 80.6.12 always did - not a bare 2026-10-30 with no clock on it.',\n"
     "    '[FULL] Nine of those dates were wrong as well as bare: 80.6.12 through 80.6.20 landed on the evening of October 29, and were dated the 30th.',\n"
     "    '[FULL] The app itself is unchanged; nothing about your songs, your lists or the side rail moves with this.'\n"
     "  ]},\n" % (VERSION, eastern()))

if failed:
    print('patch-80624: %d step(s) did not apply:' % len(failed))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80624: pending - %d step(s) to apply, the page is %s' % (len(applied), OLD))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80624: applied (%d steps), the page is %s' % (len(applied), VERSION))
