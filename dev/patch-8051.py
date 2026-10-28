#!/usr/bin/env python3
"""80.5.1 - the web page's About & updates row links to the full web app.

80.5 made the plain web page the build without the converters and gave the full
web app its own address. This release answers the question that leaves behind -
"which build am I on, and where is the other one" - in the one place a reader asks
it: the version row.

The edit lives in dev/patch_8051_web.py (constants only). This file applies it,
proves it, bumps the version and the shell cache.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8051.py
    python3 dev/patch-8051.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.5.1'
OLD_VERSION = '80.5'
MARKER = "80.5.1 - THE WEB PAGE'S VERSION ROW KNOWS WHERE THE FULL BUILD IS"

sys.path.insert(0, HERE)

import patch_8051_web     # noqa: E402


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-8051: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:80].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    item = patch_8051_web.CHANGELOG_ITEM
    body = "    '%s'" % item.replace('\\', '\\\\').replace("'", "\\'")
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, patch_8051_web.CHANGELOG_TITLE, body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', and the About row links to the full web app')
        print('patch-8051%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8051 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8051: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    # 1. The row, in the About & updates card, right after the build label is written.
    page = swap(page, patch_8051_web.ANCHOR,
                patch_8051_web.BLOCK + patch_8051_web.ANCHOR,
                'the version stamp in About & updates')

    # 2. The changelog head and the version.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8051: the page did not end up 80.5.1 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8051: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 3. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8051: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the web-only About row, the changelog head, the version and the shell cache')
    print('patch-8051: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.5.1';", 'the page runs 80.5.1'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.5.1', date:", 'the changelog records the release'),
    ('if(SC_IS_WEB && SC_IS_PLAY){', 'the row is web-without-tools only'),
    ("_fullRow.href = './full/';", 'and it points at the full web app'),
    ("var _about = document.getElementById('collapsibleAboutContent');", 'inside the About & updates card'),
    ('Open the full web app', 'with a label that says what it opens'),
    ("}catch(_eScFullRow){}", 'and it cannot break the boot if the card is absent'),
]

GONE = [
    ("const APP_VERSION = '80.5';", 'the old version constant'),
]


if __name__ == '__main__':
    sys.exit(main())
