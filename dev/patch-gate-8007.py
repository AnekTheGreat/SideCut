#!/usr/bin/env python3
"""80.0.7 - the gate learns to answer for the cloud layout's now bar.

The owner asked for "a simpler now bar" in the cloud layout. The thing that can go
wrong with a simpler anything is that it quietly stops being the same thing: a
control dropped here, a seek line hidden there, and the bar is smaller but it is
no longer the player. So this section asserts BOTH halves of the request, from
the page's own text:

  - the duplicate chip is hidden in this layout (one bar, not two);
  - the bar is smaller in the four places that make it smaller;
  - and NOTHING ELSE is hidden: the only `display: none` in the whole block is
    the chip's, so every control the full player has is still on the bar;
  - the bar does not reserve the bottom inset a second time (studio-70-check owns
    that rule, and this one must not fight it).

Idempotent: the marker is the section's own banner in the gate.

  python3 dev/patch-gate-8007.py
  python3 dev/patch-gate-8007.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = '[9] the cloud layout has one now bar'

SECTION = r"""console.log('[9] the cloud layout has one now bar, and nothing was dropped with it');
{
  const from = src.indexOf('7. 80.0.7: the cloud layout has one now bar');
  const to = src.indexOf('/* ---------- 5. Bigger screens', from);
  const bar = from > 0 && to > from ? src.slice(from, to) : '';
  ok(from > 0, 'the 80.0.7 now-bar block is in the page');
  ok(/body\.sc80-cloud #sc80Now\{ display: none; \}/.test(bar),
    'the duplicate chip is hidden in this layout - one bar, not two');
  ok(/body\.sc80-cloud #npPlayerStage\{ width: 38px; height: 34px;/.test(bar),
    'the turntable is smaller');
  ok(/body\.sc80-cloud #npControls button\{ width: 30px; height: 30px; \}/.test(bar),
    'the control buttons are smaller');
  ok(/body\.sc80-cloud #npInfo \.t\{ font-size: 12px;/.test(bar),
    'and the two lines of text are a point smaller');
  const hidden = (bar.match(/display:\s*none/g) || []).length;
  ok(hidden === 1,
    'nothing else is hidden: the chip is the only display:none in the block (' + hidden + ')');
  ok(!/env\(safe-area-inset-bottom\)/.test(bar),
    'and the bar does not reserve the bottom inset a second time');
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
        sys.exit('patch-gate-8007: dev/staircase-check.cjs is missing')
    src = read('dev/staircase-check.cjs')
    if MARKER in src:
        print('  present: the gate answers for the cloud now bar')
        print('patch-gate-8007%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if ANCHOR not in src:
        sys.exit('patch-gate-8007: dev/staircase-check.cjs is not the shape this release expects')
    if CHECK:
        print('  pending: the gate has no now-bar section yet')
        print('patch-gate-8007 --check: pending, 1 step(s) to apply')
        return 1
    write('dev/staircase-check.cjs', src.replace(ANCHOR, SECTION + ANCHOR, 1))
    print('  added the now-bar section to dev/staircase-check.cjs')
    print('patch-gate-8007: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
