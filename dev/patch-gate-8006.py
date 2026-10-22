#!/usr/bin/env python3
"""80.0.6 - the staircase gate learns to answer for the bug 80.0.5 shipped.

80.0.5's gate asserts that the staircase is a staircase. It could not have caught
the thing that actually broke: Library and Studio were on the page, in the right
places, with the right margins - and 0px tall, because 80.0.3's top-bar rules
(`> #libraryBtn{ flex: 1.18 1 0 }`, `> #studioBtn{ flex: 1.5 1 0 }`) are ID
selectors and outrank the staircase's `> button`. A missing pill has no margin
to measure, so the gate was green while the layout was unusable, and the way out
of the layout (Settings, behind Studio) was gone with it.

So this release adds one section to dev/staircase-check.cjs, in place: it reads
the sizing block, requires `flex: 0 0 auto` and the staircase's own variables on
all five pills, requires that the old bar rule is still present and overridden
AFTER it, and requires the sixteen extra pixels the two split pills need.

The gate is a 108-line file. It is edited here rather than re-emitted whole for
the same reason the page is patched rather than pushed: the release carries the
block, not the file.

Idempotent: the marker is the section's own banner in the gate.

  python3 dev/patch-gate-8006.py
  python3 dev/patch-gate-8006.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = '[8] every pill is sized by the staircase'

SECTION = r"""console.log('[8] every pill is sized by the staircase, not by the old bar');
{
  // 80.0.5 shipped two of these pills at 0px tall, and nothing in [2] could see
  // it: a pill with no height still has its margin. The rules that did it are
  // 80.0.3's, written with IDs, so they outranked the staircase's `> button` and
  // gave the two split pills a HEIGHT with a basis of zero. This answers for the
  // bug itself, because it is a bug that looks like nothing at all.
  const banner = src.indexOf('6. 80.0.6: the staircase pills are sized by the staircase');
  ok(banner > 0, 'the 80.0.6 sizing block is in the page');
  const sized = src.indexOf('body.sc80-cloud .action-strip > #homeBtn,\n' +
    'body.sc80-cloud .action-strip > #libraryBtn,\n' +
    'body.sc80-cloud .action-strip > #discoverBtn,\n' +
    'body.sc80-cloud .action-strip > #studioBtn,\n' +
    'body.sc80-cloud .action-strip > #dockAddBtn{');
  ok(sized > banner, 'and it restates the size of all five pills');
  const rule = sized > 0 ? src.slice(sized, src.indexOf('}', sized)) : '';
  ok(/flex: 0 0 auto;/.test(rule), 'with flex 0 0 auto, so no basis-zero height');
  ok(/width: var\(--sc80-pill-w\); height: var\(--sc80-pill-h\);/.test(rule),
    'and the staircase variables, not the old bar flex');
  const oldFlex = src.indexOf('body.sc80-cloud .action-strip > #libraryBtn{ flex: 1.18 1 0; }');
  ok(oldFlex > 0 && oldFlex < sized, 'the bar rule is still in the sheet, and the staircase overrides it after it');
  ok(/body\.sc80-cloud \.action-strip > #libraryBtn,\nbody\.sc80-cloud \.action-strip > #studioBtn\{ width: calc\(var\(--sc80-pill-w\) \+ 16px\); \}/.test(src),
    'and the two split pills carry sixteen pixels more width, for their two names');
}

"""

ANCHOR = "console.log('');\nconsole.log((fail ? fail + ' FAILED, ' : 'ALL PASS: ')"


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        f.write(text)


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8006: dev/staircase-check.cjs is not here - patch-gate-8005 writes it')
    src = read('dev/staircase-check.cjs')
    if MARKER in src:
        print('  present: the staircase gate answers for the pill sizes')
        print('patch-gate-8006%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if ANCHOR not in src:
        sys.exit('patch-gate-8006: dev/staircase-check.cjs is not the shape this release expects')
    if CHECK:
        print('  pending: the staircase gate has no pill-size section yet')
        print('patch-gate-8006 --check: pending, 1 step(s) to apply')
        return 1
    write('dev/staircase-check.cjs', src.replace(ANCHOR, SECTION + ANCHOR, 1))
    print('  added the pill-size section to dev/staircase-check.cjs')
    print('patch-gate-8006: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
