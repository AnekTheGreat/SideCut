#!/usr/bin/env python3
"""80.5 - the converters leave the web page, and /full/ is the web build that keeps them.

The owner's ask, verbatim:

    "have the converters only on the full build apk version not web version
     either, make a seperate web version with the converters on a different URL
     with full attached to it"

The edits live in dev/patch_805_web.py (constants only); this file applies them in
one pass and proves the result:

  1. the build-mode block, above the page's existing build switch, which works out
     whether this is a web page and whether it was asked for full mode;
  2. the flags - `SC_PLAY_NATIVE` is the store build alone, and `SC_IS_PLAY`
     becomes the no-tools gate it has always been read as, now true on the plain
     web page as well;
  3. the web-only card in Discover that links to /full/;
  4. the three places a web page must NOT look like a Play install: Billing, the
     update channel, and the version line;
  5. the changelog entry, the version, and the shell cache.

Idempotent: the marker is this release's page comment, and it is in the page it
wrote.

    python3 dev/patch-805.py
    python3 dev/patch-805.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.5'
OLD_VERSION = '80.4'
MARKER = '80.5 - WHICH PAGE THIS IS, AND WHICH BUILD'

sys.path.insert(0, HERE)

import patch_805_web     # noqa: E402


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-805: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:80].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def swap_all(src, old, new, what, expect):
    count = src.count(old)
    if count != expect:
        raise SystemExit('patch-805: %s appears %d times, expected %d (anchor: %s)'
                         % (what, count, expect, old[:80].replace('\n', '\\n')))
    return src.replace(old, new)


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    # Two of these four notes are [FULL]: the web page and the store build filter
    # them out exactly as they filter every other downloader note, so neither
    # announces a tool it does not carry. The two that stay are the two that
    # changed for everybody: the page the reader is looking at, and the version
    # line they can check it on.
    stamp = changelog_stamp()
    items = [
        'The <b>web page</b> is the build for the files you already have: the tool cards that fetched songs are not part of it, and Discover\u2019s how-to now opens at <b>+ Add songs \u2192 + Files</b>.',
        '[FULL] The <b>full web app</b> is one link away: <b>/full</b> opens this same page with the Spotify, YouTube, MP4 and Expand URL tools back \u2014 no install, nothing to set up.',
        '[FULL] The <b>full APK</b> keeps every tool exactly as it was. The page decides from where it is served, and an installed app is never a web page, so nothing about a sideloaded or over-the-air install changed.',
        'The version line names the build you are running \u2014 <b>Full</b>, <b>Play</b> or <b>Web</b> \u2014 so a tool that seems to be missing can be checked against the build actually installed.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'") for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'The web page is the files-you-own build, and the full web app has a link of its own',
               body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the web page is the no-tools build and '
              'full mode is in the flags')
        print('patch-805%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-805 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-805: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    # 1. Which page is this, and was it asked for full?
    page = swap(page, patch_805_web.WEB_ANCHOR,
                patch_805_web.WEB_BLOCK + patch_805_web.WEB_ANCHOR,
                'the build switch heading')

    # 2. The flags: the store build, and the no-tools gate the web page joins.
    page = swap(page, patch_805_web.PLAY_OLD, patch_805_web.PLAY_NEW,
                'the build flags')

    # 3. The door to the full web app, inside the tools the page just dropped.
    page = swap(page, patch_805_web.CARD_ANCHOR, patch_805_web.CARD_ADDED,
                'the end of the tools how-to')

    # 4. Three things a web page is not: a store install.
    for old, new, what in patch_805_web.DONATE_SWAPS:
        page = swap(page, old, new, what)
    page = swap(page, patch_805_web.LABEL_OLD, patch_805_web.LABEL_NEW,
                'the version line')
    for old, new, what in patch_805_web.OTA_SWAPS:
        if what == 'the OTA bundle and manifest addresses':
            page = swap_all(page, old, new, what, 2)
        else:
            page = swap(page, old, new, what)

    # 5. The changelog head and the version.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-805: the page did not end up 80.5 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-805: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 6. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-805: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the build-mode block, the no-tools gate the web page joins, the /full/ card, '
          'the native-only Billing / update channel / version line, the changelog head, the version '
          'and the shell cache')
    print('patch-805: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.5';", 'the page runs 80.5'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.5', date:", 'the changelog records the release'),
    # the switch
    ('var SC_IS_WEB = (function(){', 'the page works out whether it is a web page'),
    ("if(_cap && typeof _cap.isNativePlatform === 'function' && _cap.isNativePlatform()) return false;",
     'the installed app is never a web page'),
    ("if(_host === 'localhost' || _host === '127.0.0.1' || _host === '::1' || _host === '[::1]') return false;",
     'a local preview keeps the tools'),
    ('var SC_WEB_FULL = !SC_IS_WEB ? false : (function(){', 'full mode is its own answer'),
    ("if(/(^|[?&])full(=|&|$)/.test(_q)) return true;", '?full turns it on'),
    # the gate
    ('var SC_PLAY_NATIVE = !!(typeof window !== \'undefined\' && window.__PLAY_BUILD__);',
     'the store build has its own flag'),
    ('var SC_IS_PLAY = SC_PLAY_NATIVE || (SC_IS_WEB && !SC_WEB_FULL);',
     'and the no-tools gate covers the web page'),
    # the door
    ("if(SC_IS_WEB){\n      try{\n        var _gsh = document.getElementById('getSongsHowToDisc');",
     'the web page says where the tools went'),
    ('<a href="./full/" style="color:var(--coral); font-weight:600; text-decoration:underline;">open SideCut full',
     'and links to the full web app'),
    # the three native-only properties
    ('if(promise && !SC_PLAY_NATIVE){', 'Billing copy is the store build\'s alone'),
    ("const web = SC_PLAY_NATIVE ? '' : donateUrlFor(amt);", 'so is the card-page fallback'),
]

GONE = [
    ("const APP_VERSION = '80.4';", 'the old version constant'),
    ("var SC_IS_PLAY = !!(typeof window !== 'undefined' && window.__PLAY_BUILD__);",
     'the old single-flag definition'),
    ("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);",
     'a web page that would refuse a tip'),
    ("var _scOtaDir = SC_IS_PLAY ? 'ota-play' : 'ota';",
     'a web page pointed at the store channel'),
]


if __name__ == '__main__':
    sys.exit(main())
