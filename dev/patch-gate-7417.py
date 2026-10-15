#!/usr/bin/env python3
"""
74.1.7 - put this release's new gate blocks into dev/studio-70-check.cjs.

The same problem the page has, one file down. dev/studio-70-check.cjs is 1770 lines
and the machine that prepares a release has no git credentials, so a release that had
to hand-carry the whole file could not be cut at all - and a release that skipped it
would ship four features with no gate driving any of them. So the blocks live on their
own (dev/storeinfo-7417-block.js), the gate keeps its line count, and this script puts
the one in the other, exactly as dev/patch-7417.py does for the page.

It inserts them immediately above the [7] section, which is where 74.1.6's block went -
these four are the same screen's, so they sit with it: [6c] the row that clips, [6d] the
rates, [6e] the playlists that move, [6f] the compress that carries on.

Idempotent: a file already carrying the blocks is left alone.

  python3 dev/patch-gate-7417.py            # apply
  python3 dev/patch-gate-7417.py --check    # report only, exit 1 if missing
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
TARGET = os.path.join(ROOT, 'dev', 'studio-70-check.cjs')
BLOCK = os.path.join(ROOT, 'dev', 'storeinfo-7417-block.js')
# The section the blocks are inserted above, and the marker that says they are there.
ANCHOR = "  console.log('[7] the batch tag editor, and the tag inside the file');\n"
MARK = "console.log('[6c] a cleaner row never lets a song name out of it');"

problems = []


def main():
    src = open(TARGET, encoding='utf-8').read()
    if MARK in src:
        print('  = the Studio gate already carries the 74.1.7 blocks')
        return 0
    # Past this line the blocks are missing, so a --check run has a problem to report
    # whatever else it finds.
    if src.count(ANCHOR) != 1:
        problems.append('the [7] anchor appears %d times' % src.count(ANCHOR))
    block = open(BLOCK, encoding='utf-8').read()
    if MARK not in block:
        problems.append('dev/storeinfo-7417-block.js does not carry [6c]')
    for mark in ("console.log('[6d]", "console.log('[6e]", "console.log('[6f]"):
        if mark not in block:
            problems.append('dev/storeinfo-7417-block.js does not carry %s' % mark)
    if problems:
        for p in problems:
            print('  ! %s' % p)
        print('CHECKS: FAILED')
        return 1
    if CHECK:
        problems.append('the 74.1.7 blocks are not in the Studio gate')
    else:
        open(TARGET, 'w', encoding='utf-8').write(src.replace(ANCHOR, block + ANCHOR, 1))
        print('  + the Studio gate now drives the row clip, the rates, the reorder and the job')
    return 0


if __name__ == '__main__':
    rc = main()
    if CHECK:
        print('CHECKS: %s' % ('FAILED' if rc or problems else 'OK'))
    sys.exit(1 if (rc or problems) else 0)
