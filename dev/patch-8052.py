#!/usr/bin/env python3
"""80.5.2 - nothing in the app names another build, and the notes stop doing it too.

The owner's ask, verbatim:

    "don't mention the actual full version web or apk in the app or apk or web,
     same thing in patch notes don't mention this"

80.5 and 80.5.1 pointed at a second build to explain where the tools went - a card
in Discover, a row in About, a three-way version label, notes naming the full web
app and the full APK. That is advertising, and this release removes all of it while
leaving the behaviour alone: the web page still carries no converters, the
installed builds still carry them, and /full/ still opens the full web app by
address.

The edits live in dev/patch_8052_web.py (constants only). This file applies them,
proves them, bumps the version and the shell cache.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8052.py
    python3 dev/patch-8052.py --check
"""
import datetime
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.5.2'
OLD_VERSION = '80.5.1'
MARKER = "80.5.2 - ONE BUILD ON THE SCREEN"

sys.path.insert(0, HERE)

import patch_8051_web     # noqa: E402
import patch_8052_web     # noqa: E402
import patch_805_web      # noqa: E402


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-8052: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:80].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in patch_8052_web.ENTRY_ITEMS)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, patch_8052_web.ENTRY_TITLE, body))


def drop_entry(page, version, why):
    """Remove one whole changelog entry, keeping the rest of the array intact."""
    pattern = (r"  \{ version: '%s', date: '[^']*', title: '[^']*', items: \[\n"
               r"[\s\S]*?\n  \]\},\n" % re.escape(version))
    page, count = re.subn(pattern, '', page, count=1)
    if count != 1:
        raise SystemExit('patch-8052: could not remove the %s changelog entry (%s)' % (version, why))
    return page


def keep_first_note(page, version, title, why):
    """Rewrite one entry: a new title, and only its first note."""
    pattern = (r"  \{ version: '%s', date: '([^']*)', title: '[^']*', items: \[\n"
               r"[\s\S]*?\n  \]\},\n" % re.escape(version))
    m = re.search(pattern, page)
    if not m:
        raise SystemExit('patch-8052: could not find the %s changelog entry (%s)' % (version, why))
    first = re.search(r"\n    ('(?:[^'\\]|\\.)*'),\n", m.group(0))
    if not first:
        raise SystemExit('patch-8052: the %s entry has no note to keep (%s)' % (version, why))
    entry = ("  { version: '%s', date: '%s', title: '%s', items: [\n    %s,\n  ]},\n"
             % (version, m.group(1), title, first.group(1)))
    return page[:m.start()] + entry + page[m.end():]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', and nothing on it names another build')
        print('patch-8052%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8052 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8052: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    # 1. The two signposts, whole: the Discover card 80.5 added and the About row
    #    80.5.1 added. Both are removed by putting back the exact text they were
    #    inserted into, so nothing of either can be left behind.
    page = swap(page, patch_805_web.CARD_ADDED, patch_805_web.CARD_ANCHOR,
                'the Discover card that pointed at the full web app')
    page = swap(page, patch_8051_web.BLOCK + patch_8051_web.ANCHOR, patch_8051_web.ANCHOR,
                'the About row that linked to the full web app')

    # 2. The version line is the version.
    page = swap(page, "SideCut v${APP_VERSION} \u00b7 " + patch_805_web.LABEL_NEW,
                "SideCut v${APP_VERSION}", 'the build name on the version line')

    # 3. The one runtime sentence that names the store build.
    page = swap(page, patch_8052_web.RUNTIME_OLD, patch_8052_web.RUNTIME_NEW,
                'the licensed-search failure message')

    # 4. The notes that named a build.
    page = drop_entry(page, '80.5.1', 'it asked for a link that no longer exists')
    page = keep_first_note(page, '80.5', patch_8052_web.ENTRY_805_TITLE,
                           'the three notes that named the full web app / full APK')
    for old, new, expect in patch_8052_web.ITEMS:
        found = page.count(old)
        if found != expect:
            sys.exit('patch-8052: an older note that named another build appears %d times, '
                     'expected %d' % (found, expect))
        page = page.replace(old, new)

    # 5. This release's note, the version, and the marker.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "var SC_IS_WEB = (function(){", "// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8052: the page did not end up 80.5.2 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8052: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 6. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8052: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: both signposts out, the version line back to the version, the Play-build '
          'sentence reworded, the 80.5.1 entry dropped, 80.5 cut to its own note, the older notes '
          'reworded, the new entry, the version and the shell cache')
    print('patch-8052: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.5.2';", 'the page runs 80.5.2'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.5.2', date:", 'the changelog records the release'),
    ("SideCut v${APP_VERSION}`", 'the version line is the version'),
    ("{ version: '80.5', date:", 'the 80.5 history entry is still there'),
    ('this copy only searches openly-licensed catalogs', 'the licensed-search failure message is neutral'),
]

GONE = [
    ("const APP_VERSION = '80.5.1';", 'the old version constant'),
    ("{ version: '80.5.1', date:", 'the entry that asked for the removed link'),
    ("scFullWebNote", 'the Discover card'),
    ("scFullWebRow", 'the About row'),
    ("'Web build \u2014 your files only'", 'the build name on the version line'),
    ("'Web build \u2014 full'", 'the other build name on the version line'),
    ("'Play build \u2014 licensed sources'", 'the store build name'),
    ("'Full build \u2014 all sources'", 'the full build name'),
    ("the Play build only searches", 'the store build named in a runtime message'),
    ('The full build\\u2019s converter transport', 'an older note naming the full build'),
    ('Nothing was taken from the other build', 'an older note naming the other build'),
    ('Each build checks its own update channel (ota/ or ota-play/)',
     'an older note naming both channels as builds'),
]


if __name__ == '__main__':
    sys.exit(main())
