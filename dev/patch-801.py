#!/usr/bin/env python3
"""80.1 - the corner flight, under the number the app's own rule gives it.

80.0.10 WAS NEVER A VERSION. The page has carried the rule since 60.1, in the
comment directly above APP_VERSION: "the third number stops at nine: 60.0.9 is
followed by 60.1 (never 60.0.10)". That makes the release after 80.0.9 read 80.1 -
and the work that shipped under the wrong number is this design, so this release
carries it forward instead of inventing new UI.

What moves is the number, and only the number:

  - the banner over the cloud block (9. 80.0.10 -> 9. 80.1, 10. -> 10.)
  - APP_VERSION 80.0.10 -> 80.1
  - the changelog head's version and its stamp, plus one note saying why
  - the shell cache sidecut-shell-v80.0.10 -> sidecut-shell-v80.1

The flight, the bar and the sheet are byte-for-byte what 80.0.10 shipped: the tree
this patch starts from is the one that release produced.

Idempotent: the marker is the 80.1 banner in the page.

    python3 dev/patch-801.py
    python3 dev/patch-801.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.1'
MARKER = '9. 80.1: a small flight in the corner'

BANNER_FLIGHT_OLD = '/* ---------- 9. 80.0.10: a small flight in the corner, a bar that covers ------ */'
BANNER_FLIGHT_NEW = '/* ---------- 9. 80.1: a small flight in the corner, a bar that covers -------- */'
BANNER_SHEET_OLD = '/* ---------- 10. 80.0.10: the add-songs sheet, above the bar ------------------ */'
BANNER_SHEET_NEW = '/* ---------- 10. 80.1: the add-songs sheet, above the bar -------------------- */'
JS_NOTE_OLD = '  // 80.0.10 - THE SHEET IS A SCREEN-LEVEL PANEL.'
JS_NOTE_NEW = '  // 80.1 - THE SHEET IS A SCREEN-LEVEL PANEL.'
HEAD_OLD = ("  { version: '80.0.10', date: 'October 22, 2026 \\u00b7 8:20 PM EDT', "
            "title: 'The plus works, the flight is small, the bar covers the bottom', items: [\n")
HEAD_NEW = ("  { version: '80.1', date: 'October 22, 2026 \\u00b7 9:05 PM EDT', "
            "title: 'The plus works, the flight is small, the bar covers the bottom', items: [\n"
            "    'This release is 80.1, not 80.0.10: the third number stops at nine, so 80.0.9 is followed by 80.1.',\n")


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and (("const APP_VERSION = '%s';" % VERSION) in page):
        print('  present: the 80.1 banner and the page runs as ' + VERSION)
        print('patch-801%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    bad = []
    if BANNER_FLIGHT_OLD not in page:
        bad.append('the flight banner')
    if BANNER_SHEET_OLD not in page:
        bad.append('the sheet banner')
    if JS_NOTE_OLD not in page:
        bad.append('the sheet comment')
    if HEAD_OLD not in page:
        bad.append('the changelog head')
    if "const APP_VERSION = '80.0.10';" not in page:
        bad.append('the version')
    if "'sidecut-shell-v80.0.10'" not in sw:
        bad.append('the shell cache')
    if bad:
        sys.exit('patch-801: the page is not the shape this release expects (%s)' % ', '.join(bad))
    if CHECK:
        print('patch-801 --check: the release is pending, 6 steps to apply')
        return 1
    page = page.replace(BANNER_FLIGHT_OLD, BANNER_FLIGHT_NEW, 1)
    page = page.replace(BANNER_SHEET_OLD, BANNER_SHEET_NEW, 1)
    page = page.replace(JS_NOTE_OLD, JS_NOTE_NEW, 1)
    page = page.replace(HEAD_OLD, HEAD_NEW, 1)
    page = page.replace("const APP_VERSION = '80.0.10';", "const APP_VERSION = '%s';" % VERSION, 1)
    open(page_path, 'w', encoding='utf-8').write(page)
    sw = sw.replace("'sidecut-shell-v80.0.10'", "'sidecut-shell-v80.1'", 1)
    open(sw_path, 'w', encoding='utf-8').write(sw)
    print('  applied: the banners, the version, the changelog head and the shell cache')
    print('patch-801: 6 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
