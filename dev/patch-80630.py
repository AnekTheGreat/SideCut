#!/usr/bin/env python3
"""80.6.30 - the Play build catches up.

    python3 dev/patch-80630.py
    python3 dev/patch-80630.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.

This release changes no behaviour. It exists because the two update channels read
the same version number, so the held Play channel could not publish anything until
the page moved to a version neither channel had shipped. The work is the version,
the changelog entry that says exactly that, and the deletion of
dev/channel-hold.json - after which dev/ota-bundle-play.mjs rebuilds ota-play/
instead of leaving it where it is.

The long-form account is in dev/release-entry.md.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')
HOLD = os.path.join(HERE, 'channel-hold.json')

CHECK = '--check' in sys.argv
VERSION = '80.6.30'
OLD = '80.6.29'
MARKER = '80.6.30 - THE PLAY BUILD CATCHES UP'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80630: already on the page, the page is %s' % VERSION)
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


ENTRY = (
    "  // 80.6.30 - THE PLAY BUILD CATCHES UP. dev/channel-hold.json held the Play side\n"
    "  // at 80.6.12 while this page moved ahead; the owner lifted it, so both channels\n"
    "  // publish v80.6.30. Nothing on the page itself changed - no layout, no colour, no\n"
    "  // behaviour - which is why this entry says what a catch-up is instead of dressing\n"
    "  // an unchanged page up as a change.\n"
    "  { version: '80.6.30', date: '{{STAMP}}', title: 'The Play build catches up', items: [\n"
    "    'Both builds publish the same page from here. The Play build was held at 80.6.12 while the other one moved ahead, and it catches up at this version with every note in this list that belongs to it.',\n"
    "    'Nothing on the page itself changed in this release: no layout, no colour, no behaviour, so what is new to a Play install is everything in this list, not something on top of it.',\n"
    "    'Each build updates to itself: the Play bundle carries its own flag, so a catch-up can never hand a Play install the other build\u2019s page.',\n"
    "    '[FULL] Nothing changed for this build since 80.6.29 either - the dock tab is still one Library pill, and the side rail is still yours to set in Tools.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
once('the changelog records the release',
     "  // 80.6.29 - ONE LIBRARY PILL, A RAIL YOU CAN SEE THROUGH, AND A RAIL THAT HOLDS STILL.",
     ENTRY + "  // 80.6.29 - ONE LIBRARY PILL, A RAIL YOU CAN SEE THROUGH, AND A RAIL THAT HOLDS STILL.")

# -- 2. the hold, which is data rather than a build flag -------------------------
# dev/ota-bundle-play.mjs reads this file on every release: with "play": true it
# leaves ota-play/ exactly as it is and its --check reports the hold. Deleting the
# file is how a release says the channel may publish again - there is no flag in the
# page for it, and nothing about the bundle changes.
HOLDED = os.path.exists(HOLD)
if HOLDED:
    applied.append('the channel hold is lifted')

if failed:
    print('patch-80630: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80630: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
if HOLDED:
    os.remove(HOLD)
print('patch-80630: %d steps applied, page is %s' % (len(applied), VERSION))
