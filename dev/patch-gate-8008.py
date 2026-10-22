#!/usr/bin/env python3
"""80.0.8 - the gate answers for the dock and for the live offset.

The section below is written with plain substring checks on purpose: no regular
expressions and no backslash escapes, so the bytes that ship are the bytes that
were rehearsed no matter what rewrites them on the way in.
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = '[10] the dock is one panel'

SECTION = """console.log('[10] the dock is one panel, and its offset is kept true');
{
  const from = src.indexOf('8. 80.0.8: the staircase is one dock');
  const to = src.indexOf('/* ---------- 5. Bigger screens', from);
  const panel = from > 0 && to > from ? src.slice(from, to) : '';
  ok(from > 0, 'the 80.0.8 dock block is in the page');
  ok(panel.indexOf('border-radius: 24px;') > 0 && panel.indexOf('box-shadow: 0 18px 40px') > 0,
    'the strip is one rounded panel, not a pile of capsules');
  ok(panel.indexOf('backdrop-filter: blur(20px)') > 0,
    'with its own glass');
  ok(panel.indexOf('.action-strip > button') > 0 && panel.indexOf('background: transparent;') > 0,
    'and the pills inside are unpainted until one is active');
  ok(panel.indexOf('.action-strip > button.active') > 0,
    'which is what paints the active tab');
  ok(src.indexOf('new ResizeObserver(writePlayerHeight).observe(np)') > 0,
    'the bar measured height is observed, not guessed once');
  ok(src.indexOf('orientationchange') > 0 && src.indexOf('__sc80PlayerRO') > 0,
    'and it is refreshed on rotation, once per page');
}

"""

ANCHOR = """console.log('');
console.log((fail ? fail + ' FAILED, ' : 'ALL PASS: ')"""


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8008: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: the gate answers for the dock')
        print('patch-gate-8008%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if ANCHOR not in src:
        sys.exit('patch-gate-8008: dev/staircase-check.cjs is not the shape this release expects')
    if CHECK:
        print('  pending: the gate has no dock section yet')
        print('patch-gate-8008 --check: pending, 1 step(s) to apply')
        return 1
    open(GATE, 'w', encoding='utf-8').write(src.replace(ANCHOR, SECTION + ANCHOR, 1))
    print('  added the dock section to dev/staircase-check.cjs')
    print('patch-gate-8008: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
