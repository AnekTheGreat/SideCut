#!/usr/bin/env python3
"""80.3 - the announce-once fix, under the number it should have had.

The owner, one line:

  "v80. 3 NEVER. 0.10"

WHY 80.2.10 WAS WRONG, AND WHERE THE RULE IS. The comment directly above APP_VERSION
has carried it since 60.1 - "the third number stops at nine: 60.0.9 is followed by
60.1 (never 60.0.10)" - and 80.1 was itself a renumber release for exactly this mistake
(80.0.10 -> 80.1). The announce-once fix shipped the same way anyway.

SO THIS RELEASE MOVES THE NUMBER, AND ONLY THE NUMBER. APP_VERSION 80.2.10 -> 80.3, the
changelog head's version and stamp (with one note saying why), every code comment that
carried the old label, and the shell cache sidecut-shell-v80.2.10 -> sidecut-shell-v80.3.
The announcement block, the collapse, the bell and the key fix are byte-for-byte what
80.2.10 shipped.

NO ORPHAN ENTRY. The 80.2.10 changelog entry is not kept under a number that breaks the
page's own rule - it becomes the 80.3 entry, so the list reads 80.3, then 80.2.8. That
is what 80.1 did with 80.0.10, and it is why the adjacency anchor stays 80.2.8.

Idempotent: the marker is the announcement block's banner comment at its 80.3 spelling.

    python3 dev/patch-803.py
    python3 dev/patch-803.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.3'
OLD_VERSION = '80.2.10'
MARKER = '  // \u2500\u2500\u2500 80.3 - A DROP IS ANNOUNCED ONCE'
TEXT = os.path.join(ROOT, 'dev', 'patch-803-text.py')

# The old label, spelled as the page writes it in each place it appears.
OLD_LABEL = '80.2.10 - '
NEW_LABEL = '80.3 - '


def load_text():
    spec = importlib.util.spec_from_file_location('sc_patch_803_text', TEXT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def swap(src, old, new, what, times=1):
    if src.count(old) != times:
        raise SystemExit('patch-803: %s appears %d times, expected %d' % (what, src.count(old), times))
    return src.replace(old, new)


def apply_all(src):
    t = load_text()
    # 1. EVERY CODE COMMENT THAT CARRIED THE OLD LABEL.
    src = swap(src, OLD_LABEL, NEW_LABEL, 'the old label in the code comments', 7)
    # 2. THE CHANGELOG HEAD: same notes, the number it should have had, and the stamp of
    #    the commit that ships it.
    src = swap(src, t.CHANGELOG_OLD, t.CHANGELOG_NEW, 'the changelog head')
    #    …and the note that says why the number moved, at the head of the items.
    src = swap(src, t.FIRST_OLD, t.FIRST_NEW, 'the changelog note')
    # 3. THE RELEASE ITSELF.
    src = swap(src, "  const APP_VERSION = '%s';" % OLD_VERSION,
               "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src


CLAIMS = [
    ("const APP_VERSION = '80.3';", 'the page runs 80.3'),
    (MARKER, 'the announcement block is labelled 80.3'),
    ('// 80.3 - THE KEY IS THE NAME THE ROW IS STORED UNDER.', 'the catalog note moved with it'),
    ('// 80.3 - SAID ONCE.', 'the alert note moved with it'),
    ("{ version: '80.3', date:", 'the changelog records the release'),
    ("{ version: '80.2.8', date:", 'with 80.2.8 still listed next'),
    ("'This release is 80.3, not 80.2.10: the third number stops at nine, so 80.2.9 is "
     "followed by 80.3. The page is the same fix either way - the app only moves forward, "
     "so the number is how it reaches you.'", 'the note says why the number changed'),
    ('function scReleaseAnnouncements(){', 'the announcement list is still there'),
    ('function scCollapseReleaseDuplicates(map){', 'the collapse is still there'),
    ("if(flat !== pk){ prevKeys.add(flat); prevKeys.add('alb:' + flat); }", 'the key fix is still there'),
    ('      return window.__scReleaseList(31).some(function(r){', 'the bell still reads the panel list'),
]

GONE = [
    ("const APP_VERSION = '80.2.10';", 'the old version constant'),
    ('80.2.10 - ', 'a comment still labelled with it'),
    ("{ version: '80.2.10', date:", 'an orphan changelog entry'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the announcement block and the page runs as ' + VERSION)
        print('patch-803%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-803 --check: the renumber is pending, 4 steps to apply')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-803: the page is not %s, so it is not the shape this renumber expects' % OLD_VERSION)
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-803: the page did not end up 80.3 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle in page]
    if left:
        sys.exit('patch-803: the page still carries this (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v%s'" % OLD_VERSION not in sw:
        sys.exit('patch-803: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(
        sw.replace("'sidecut-shell-v%s'" % OLD_VERSION, "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the page number, the changelog head and its note, every comment and the shell cache')
    print('patch-803: 4 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
