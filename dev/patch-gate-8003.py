#!/usr/bin/env python3
"""80.0.3 - the gate wiring this release needs, owned by the release.

NONE. This release moves a layout, and the gate that describes the layout is
dev/revamp-check.cjs, which this release edits directly (sections [4] and [6] now
describe the bar across the top and the Studio/Tools split in the dock instead of
the rail and the tab bar inside the view). dev/shots-800.cjs, the visual script,
clicks the dock half now instead of the deleted in-view tab.

Why a no-op file exists at all: the release runner requires every release to carry
its own tools - patch, repin, patch-gate, storeinfo block, proof - so a release
whose wiring is already in the tree ships a script that says so rather than a
missing file. It is idempotent by construction and --check is green on a clean
checkout.

  python3 dev/patch-gate-8003.py
  python3 dev/patch-gate-8003.py --check
"""
import sys

CHECK = '--check' in sys.argv

if CHECK:
    print('patch-gate-8003 --check: 0 to apply, 0 already in place, 0 anchors missing')
else:
    print('patch-gate-8003: 0 applied, 0 already in place - the layout gate is edited by this release itself')
sys.exit(0)
