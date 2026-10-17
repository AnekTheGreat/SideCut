#!/usr/bin/env python3
"""
74.1.9 - put this release's gate block into dev/studio-70-check.cjs.

The same problem the page has, one file down. dev/studio-70-check.cjs is 2200 lines
and the machine that prepares a release has no git credentials, so a release that had
to hand-carry the whole file could not be cut at all - and a release that skipped it
would ship three changes with nothing in the battery that would notice them going
away. So the block lives on its own (dev/storeinfo-7419-block.js), the gate keeps its
line count, and this script puts the one in the other, exactly as
dev/patch-gate-7418.py and dev/patch-gate-7417.py did.

It inserts it immediately above the closing [12] section, after every block it builds
on: [1] already drove the dock, and [10] already drove the app's own next/previous.

Idempotent: a file already carrying the block is left alone.

  python3 dev/patch-gate-7419.py            # apply
  python3 dev/patch-gate-7419.py --check    # report only, exit 1 if missing
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
TARGET = os.path.join(ROOT, 'dev', 'studio-70-check.cjs')
BLOCK = os.path.join(ROOT, 'dev', 'storeinfo-7419-block.js')
# The section the block is inserted above, and the marker that says it is there.
ANCHOR = "  console.log('[12] the page still holds together');\n"
MARK = "console.log('[11s] the album follows the song, the views come in, and the dock can be one sliding pill');"

problems = []


def main():
    src = open(TARGET, encoding='utf-8').read()
    already = MARK in src
    if already:
        print('  = the Studio gate already carries the 74.1.9 block')
    elif src.count(ANCHOR) != 1:
        # Past this line the block is missing, so a --check run has a problem to report
        # whatever else it finds.
        problems.append('the [12] anchor appears %d times' % src.count(ANCHOR))
    block = open(BLOCK, encoding='utf-8').read()
    if MARK not in block:
        problems.append('dev/storeinfo-7419-block.js does not carry [11s]')
    # WHAT THE BLOCK MUST CARRY, ASKED OF THE BLOCK FILE EVERY TIME - because the file
    # is what a re-cut of this release would insert, and the section it pins would
    # otherwise be checked only on the machine that had not inserted it yet. What makes
    # this block worth its lines: it pins the rules that a small, sensible-looking edit
    # would break - the collapse that only closes what it opened, the entrance that can
    # be switched off, the joined dock that is a setting rather than a second dock, the
    # swallowed click that is spent, the whole-word title rule, the lyric sheet measured
    # against the recording, and the finished pill's label - and then it drives the
    # setting on the real Studio and the pill over a synthetic one.
    for needle, label in (
        ('function scAlbumCollapseCard(card){', 'the one place that closes a card'),
        ('_scWasCards.indexOf(card.dataset.albumName) === -1', 'the guard that spares a hand-opened album'),
        ('body.sandbox-reduce-motion .sc-view-in{ animation: none; }', 'the entrance that can be switched off'),
        ('scDockPillSwallow = false; }, 600', 'the swallow that expires'),
        ('sw.click()', 'the switch driven on the real Studio'),
        ("// (6) THE CONVERTER'S IDENTITY", 'the converter identity and the frame budget'),
        ('// (7) THE WORDS LINE UP WITH THE RECORDING.', 'the lyric sheet measured against the recording'),
        ('// DRIVEN, because a label is a behavior.', 'the finished pill run over the shapes a run ends on'),
    ):
        if needle not in block:
            problems.append('dev/storeinfo-7419-block.js does not carry %s' % label)
    if problems:
        for p in problems:
            print('  ! %s' % p)
        print('CHECKS: FAILED')
        return 1
    if already:
        return 0                      # nothing to insert, and the block itself is checked above
    if CHECK:
        problems.append('the 74.1.9 block is not in the Studio gate')
    else:
        open(TARGET, 'w', encoding='utf-8').write(src.replace(ANCHOR, block + ANCHOR, 1))
        print('  + the Studio gate now pins the album follow, the view entrance and the pill dock')
    return 0


if __name__ == '__main__':
    rc = main()
    if CHECK:
        print('CHECKS: %s' % ('FAILED' if rc or problems else 'OK'))
    sys.exit(1 if (rc or problems) else 0)
