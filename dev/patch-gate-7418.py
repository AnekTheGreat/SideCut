#!/usr/bin/env python3
"""
74.1.8 - put this release's new gate block into dev/studio-70-check.cjs.

The same problem the page has, one file down. dev/studio-70-check.cjs is 1800 lines
and the machine that prepares a release has no git credentials, so a release that had
to hand-carry the whole file could not be cut at all - and a release that skipped it
would ship a fix with no gate that would have caught the bug it fixes. So the block
lives on its own (dev/storeinfo-7418-block.js), the gate keeps its line count, and
this script puts the one in the other, exactly as dev/patch-gate-7417.py did.

It inserts it immediately above the [7] section, with the other storage-cleaner blocks
it belongs beside: [6g] is the re-encode that really runs.

Idempotent: a file already carrying the block is left alone.

  python3 dev/patch-gate-7418.py            # apply
  python3 dev/patch-gate-7418.py --check    # report only, exit 1 if missing
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
TARGET = os.path.join(ROOT, 'dev', 'studio-70-check.cjs')
BLOCK = os.path.join(ROOT, 'dev', 'storeinfo-7418-block.js')
# The section the block is inserted above, and the marker that says it is there.
ANCHOR = "  console.log('[7] the batch tag editor, and the tag inside the file');\n"
MARK = "console.log('[6g] a re-encode really runs: the encoders can reach what they call');"

problems = []


def main():
    src = open(TARGET, encoding='utf-8').read()
    if MARK in src:
        print('  = the Studio gate already carries the 74.1.8 block')
        return 0
    # Past this line the block is missing, so a --check run has a problem to report
    # whatever else it finds.
    if src.count(ANCHOR) != 1:
        problems.append('the [7] anchor appears %d times' % src.count(ANCHOR))
    block = open(BLOCK, encoding='utf-8').read()
    if MARK not in block:
        problems.append('dev/storeinfo-7418-block.js does not carry [6g]')
    # What makes this block worth its lines: it drives the REAL encoder (so the stub
    # that let 74.1.7 ship cannot hide a broken one) and it reads the page as scripts.
    for needle, label in (
        ('win.SC70.pickRate(victim.id, 128)', 'the real re-encode'),
        ('win.lamejs = {', 'lamejs stood in for'),
        ('no script block calls an sc-helper that only another block defines', 'the scope rule'),
    ):
        if needle not in block:
            problems.append('dev/storeinfo-7418-block.js does not carry %s' % label)
    if problems:
        for p in problems:
            print('  ! %s' % p)
        print('CHECKS: FAILED')
        return 1
    if CHECK:
        problems.append('the 74.1.8 block is not in the Studio gate')
    else:
        open(TARGET, 'w', encoding='utf-8').write(src.replace(ANCHOR, block + ANCHOR, 1))
        print('  + the Studio gate now runs a real re-encode, and reads the page as scripts')
    return 0


if __name__ == '__main__':
    rc = main()
    if CHECK:
        print('CHECKS: %s' % ('FAILED' if rc or problems else 'OK'))
    sys.exit(1 if (rc or problems) else 0)
