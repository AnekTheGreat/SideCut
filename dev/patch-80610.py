#!/usr/bin/env python3
"""80.6.10 - the streaming note stops naming a build.

80.6.9 shipped one changelog line that said where the Streaming block lives, in the words
"full builds only". The owner's standing instruction is that a release note never names the
full build - the reader is not supposed to be told which build they have. The wording is the
only thing wrong with it: the feature, the gate and the module are all unchanged, and nothing
about the gate moves here.

So this is a text release, and only that:

  - the fifth item of the 80.6.9 changelog entry loses its build clause and keeps its point
    (a stream has its own player, so it cannot touch the queue, the widget or downloaded
    playback);
  - APP_VERSION and the shell cache move to 80.6.10 so the page is a new build and the OTA
    notes are rebuilt from the corrected changelog;
  - the entry is RE-LABELLED 80.6.10 rather than a second entry being added. A note that says
    "a note was reworded" is noise in the list the reader actually sees, and a new entry above
    it would push the streaming notes off the update sheet; the corrected entry is the one
    that belongs there. It is also what the release step reads its commit subject from, so a
    release with no entry for its own version cannot commit at all.

Idempotent: the marker is the corrected sentence plus the version.

    python3 dev/patch-80610.py
    python3 dev/patch-80610.py --check
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.10'
OLD_VERSION = '80.6.9'

# The clause that has to go, and the sentence that keeps the item's meaning without it.
BUILD_CLAUSE = ('It lives in the <b>full builds only</b> &mdash; the section is not built at '
                'all elsewhere &mdash; and it uses its own player, so a stream that dies '
                'cannot touch your queue, widget or downloaded playback.')
PLAIN = ('It uses its own player, so a stream that dies cannot touch your queue, widget or '
         'downloaded playback.')

# The entry keeps its items and its date; only the version it is filed under moves.
CHANGELOG_OLD = "  { version: '%s', date:" % OLD_VERSION
CHANGELOG_NEW = "  { version: '%s', date:" % VERSION

CLAIMS = [
    ("const APP_VERSION = '%s';" % VERSION, 'the page runs ' + VERSION),
    (PLAIN, 'the note keeps its point without naming a build'),
    (CHANGELOG_NEW, 'the changelog entry is the ' + VERSION + ' one'),
]

# The note is the only user-visible text that named a build. The module's own comments still say
# "full builds only" and "full APK and full web" and that is correct: a comment is read by whoever
# maintains the gate, not by the reader of a release note, and it is the one place the rule belongs.
GONE = [
    (BUILD_CLAUSE, 'the build clause in the note'),
    ('<b>full builds only</b>', 'the build named in the note'),
    (CHANGELOG_OLD, 'the old entry version'),
]


def swap(src, old, new, what, times=1):
    count = src.count(old)
    if count != times:
        raise SystemExit('patch-80610: %s appears %d times, expected %d (anchor: %s)'
                         % (what, count, times, old[:70].replace('\n', '\\n')))
    return src.replace(old, new)


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()

    if (("const APP_VERSION = '%s';" % VERSION) in page and BUILD_CLAUSE not in page
            and CHANGELOG_NEW in page):
        print('  present: the page runs ' + VERSION + ', and the note names no build')
        print('patch-80610%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-80610 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-80610: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, BUILD_CLAUSE, PLAIN, 'the build clause in the 80.6.9 note')
    page = swap(page, CHANGELOG_OLD, CHANGELOG_NEW, 'the version the entry is filed under')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-80610: the page did not end up %s (%s)' % (VERSION, why))
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-80610: the page still carries %s (%s)' % (why, needle))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-80610: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the note and the version')
    print('patch-80610: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
