#!/usr/bin/env python3
"""80.0.2 - the gate wiring this release needs, owned by the release.

One edit, and it is held here rather than made by hand so the release reproduces
from the 80.0.1 tip: run patch-8002.py, repin-8002.mjs and this script over a clean
checkout and the tree comes out byte-identical.

  * dev/gates.sh - the extra arm gains assistant-duck-depth-check, the new gate for
    the depth ladder. It is NOT a retarget: assistant-duck-check keeps describing
    80.0.1's engine unchanged (a default library still ducks to 0.2, the tap still
    ends a duck, the cap still holds), and the new gate measures only the layer
    80.0.2 adds - the ladder, the chosen level, the restore and the mid-duck change.

No other gate is retargeted: 80.0.2 changes how far the duck steps, not the four
ways it ends or the node it rides, so nothing that pinned those had to move.

  python3 dev/patch-gate-8002.py
  python3 dev/patch-gate-8002.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv

GATES = os.path.join(ROOT, 'dev', 'gates.sh')
OLD = 'listen-time-check assistant-duck-check converter-identity-check'
NEW = 'listen-time-check assistant-duck-check assistant-duck-depth-check converter-identity-check'

EDITS = [('the extra arm gains the depth gate', GATES, OLD, NEW)]


def main():
    applied, present, missing = 0, 0, []
    for label, path, old, new in EDITS:
        src = open(path, encoding='utf-8').read()
        if new in src:
            present += 1
            continue
        if src.count(old) != 1:
            missing.append('%s (anchor found %d times)' % (label, src.count(old)))
            continue
        if not CHECK:
            open(path, 'w', encoding='utf-8').write(src.replace(old, new, 1))
        applied += 1
        print('  applied: ' + label)
    for m in missing:
        print('  MISSING ANCHOR: ' + m)
    if CHECK:
        print('patch-gate-8002 --check: %d to apply, %d already in place, %d anchors missing'
              % (applied, present, len(missing)))
        return 1 if (applied or missing) else 0
    if missing:
        sys.exit('patch-gate-8002: %d anchor(s) not found - nothing was written for them'
                 % len(missing))
    print('patch-gate-8002: %d applied, %d already in place' % (applied, present))
    return 0


if __name__ == '__main__':
    sys.exit(main())
