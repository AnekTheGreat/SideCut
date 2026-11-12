#!/usr/bin/env python3
"""SideCut 84.0.0 - the number after 83.9.0 is 84.0.0.

83.10.0 was cut by mistake. A release here is major.minor.patch and the middle
number is a single digit: when 83.9.0 is used up the major goes up and the rest
starts again at zero. This renumbers that release 84.0.0 - the page, the service
worker's cache, its What's New entry and this memory - and changes nothing else
about it.

It also teaches dev/release-record.py to refuse a two-digit minor, which is the
step every release runs, so a number like 83.10.0 cannot be cut again.

    python3 dev/patch-840.py            # apply
    python3 dev/patch-840.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGE = os.path.join(ROOT, 'index.html')
SW = os.path.join(ROOT, 'sw.js')
MEM = os.path.join(ROOT, 'AGENTS.md')
REC = os.path.join(ROOT, 'dev', 'release-record.py')

V = '84.0.0'
OLD = '83.10.0'

APP_OLD = "  const APP_VERSION = '%s';" % OLD
APP_NEW = "  const APP_VERSION = '%s';" % V

CH_OLD = ("      { version: '%s', date: 'November 12, 2026', title: 'Mix Pad: free placement, "
          "and clips you can lay on top of each other', items: [\n" % OLD)
ITEM = ("    'The version is %s. A release here is numbered major.minor.patch and the "
        "middle number is a single digit, so when 83.9.0 is used up the major goes up and the "
        "numbers after it start again at zero. Nothing else in this release has changed.',\n"
        % V)
CH_NEW = ("      { version: '%s', date: 'November 12, 2026', title: 'Mix Pad: free placement, "
          "and clips you can lay on top of each other', items: [\n" % V) + ITEM

SW_OLD = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
SW_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % V

MEM_OLD = "## %s (November 11, 2026 \u00b7 8:20 PM EDT): manual placement in the Mix Pad\n" % OLD
MEM_NEW = "## %s (November 11, 2026 \u00b7 8:20 PM EDT): manual placement in the Mix Pad\n\n" % V + (
    "First cut as %s, which is a number this project does not use. A release is\n"
    "major.minor.patch and the middle number is a single digit - 83.9.0 is followed by\n"
    "84.0.0 - so the page, the service worker's cache, the release notes and this memory\n"
    "all say %s, and `dev/release-record.py` now stops a release that carries a\n"
    "two-digit minor. Nothing else about the release changed.\n" % (OLD, V))

REC_OLD = "def write_entry():\n    ver = version()\n"
REC_NEW = ("def write_entry():\n    ver = version()\n"
           "    # 84.0.0 - the middle number is a single digit. 83.10.0 shipped by mistake\n"
           "    # because nothing looked: after 83.9.0 comes 84.0.0, never a two-digit minor.\n"
           "    minor = re.match(r'^[0-9]+\\.([0-9]+)', ver).group(1)\n"
           "    if len(minor) > 1:\n"
           "        raise SystemExit('FATAL: %s has a two-digit minor (%s). A release is '\n"
           "                         'major.minor.patch with a single-digit minor: after 83.9.0 '\n"
           "                         'comes 84.0.0.' % (ver, minor))\n")


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with io.open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def one(text, old, what):
    if text.count(old) != 1:
        sys.exit('patch-840: %s appears %d times, expected exactly 1' % (what, text.count(old)))
    return text


def main():
    check = '--check' in sys.argv
    page, sw, mem, rec = read(PAGE), read(SW), read(MEM), read(REC)
    done = ["const APP_VERSION = '%s'" % V in page, SW_NEW in sw,
            '## %s (' % V in mem, 'two-digit minor' in rec]
    if all(done):
        print('already on the page')
        return 0
    if check:
        print('not applied yet')
        return 1
    one(page, APP_OLD, 'the version line')
    one(page, CH_OLD, "the What's New entry")
    one(sw, SW_OLD, 'the cache name')
    one(mem, MEM_OLD, "the memory's heading")
    one(rec, REC_OLD, 'release-record.py')
    write(PAGE, page.replace(APP_OLD, APP_NEW, 1).replace(CH_OLD, CH_NEW, 1))
    write(SW, sw.replace(SW_OLD, SW_NEW, 1))
    write(MEM, mem.replace(MEM_OLD, MEM_NEW, 1))
    write(REC, rec.replace(REC_OLD, REC_NEW, 1))
    print('page, cache and memory at %s; release-record.py refuses a two-digit minor' % V)
    return 0


if __name__ == '__main__':
    sys.exit(main())
