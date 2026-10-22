#!/usr/bin/env python3
"""80.0.8 - the gate answers for the dock and for the live offset."""
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
  ok(/body\\\\.sc80-cloud \\\\.action-strip\\\\{[\\\\s\\\\S]*?border-radius: 24px;/.test(panel),
    'the strip is one rounded panel');
  ok(/body\\\\.sc80-cloud \\\\.action-strip\\\\{[\\\\s\\\\S]*?backdrop-filter: blur\\\\(20px\\\\)/.test(panel),
    'with its own glass');
  ok(/body\\\\.sc80-cloud \\\\.action-strip > button\\\\{[\\\\s\\\\S]*?background: transparent;/.test(panel),
    'and the pills inside are unpainted until one is active');
  ok(/body\\\\.sc80-cloud \\\\.action-strip > button\\\\.active/.test(panel),
    'which is what paints the active tab');
  ok(/new ResizeObserver\\\\(writePlayerHeight\\\\)\\\\.observe\\\\(np\\\\)/.test(src),
    'the bar measured height is observed, not guessed once');
  ok(/orientationchange/.test(src) && /__sc80PlayerRO/.test(src),
    'and it is refreshed on rotation, once per page');
}

"""

ANCHOR = "console.log('');\nconsole.log((fail ? fail + ' FAILED, ' : 'ALL PASS: ')"


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
