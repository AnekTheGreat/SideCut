#!/usr/bin/env python3
"""80.0.5 - the gate that describes the staircase, and the store block it moves.

THE GATE IS NEW BECAUSE THE LAYOUT IS. Every gate in this repository that reads the
dock was written when the dock was a bar across the top or a rail down the side; none
of them can answer "is the softwar right now a staircase", because none of them has
ever seen one. Rather than rewrite a 1700-line gate mid-release, this release ships
one small gate of its own - dev/staircase-check.cjs - and puts it in the battery's
EXTRA list so it runs with the rest.

It asserts the CONTRACT rather than a screenshot, the same way the rest of dev/ does:
the container is fixed to the bottom right, the four tabs carry four different step
margins, the player height comes from a measurement rather than a number somebody
guessed, the old top bar's reserved band is gone, and the wide-window rules exist.

Idempotent: the marker is the staircase comment in the gate it writes. Runs after
dev/patch-8005.py and dev/repin-8005.mjs, which is where release.yml calls it.

  python3 dev/patch-gate-8005.py
  python3 dev/patch-gate-8005.py --check
"""
import io
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
# The marker has to be a string the gate itself carries - the file's own opening
# comment - or this script never recognises the gate it just wrote and --check is
# red forever. 80.0.5's first rehearsal found exactly that: the marker named a
# phrase that lives in dev/release-entry.md, not in GATE_SRC, so the release would
# have died at its proof step with "pending, 1 step(s) to apply".
MARKER = 'THE STAIRCASE, answered from the page'

GATE_SRC = r'''// 80.0.5 - THE STAIRCASE, answered from the page's own text.
//
// The cloud layout's dock is not a bar any more: each tab is its own capsule, the
// container has no chrome of its own, and the four of them step right as they go
// down the screen so the last one sits in the corner. Every rule below is one line
// of that contract, read straight out of index.html - so a later release that drags
// the tabs back into a row has to say so here, in the open.
//
//   node dev/staircase-check.cjs
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log('  PASS ' + label); }
  else { fail += 1; console.log('  FAIL ' + label); }
}

// The block this release added, from its banner to the last wide-window rule.
const start = src.indexOf('5. 80.0.5: the tabs are a staircase');
const end = src.indexOf('/* COMPUTERS.', start);
const block = start >= 0 && end > start ? src.slice(start, end) : '';
const wide = start >= 0 ? src.slice(end, src.indexOf('</style>', end > 0 ? end : start)) : '';

console.log('[1] the block exists and is one block');
{
  ok(start > 0, 'the 80.0.5 staircase block is in the page');
  ok(block.length > 1500, 'and it is not a stub (' + block.length + ' chars)');
  ok(/body\.sc80-cloud \.action-strip\{[\s\S]*?position: fixed;/.test(block),
    'the dock is position: fixed');
  ok(/left: auto; right: 12px;/.test(block), 'and anchored to the right edge');
  ok(/top: auto; bottom: calc\(env\(safe-area-inset-bottom\) \+ var\(--sc80-player\) \+ 10px\);/.test(block),
    'and to the bottom, above the measured player');
  ok(/flex-direction: column/.test(block), 'the tabs stack as a column, not a row');
  ok(/align-items: flex-end/.test(block), 'against that right edge');
  ok(/background: none;/.test(block) && /box-shadow: none;/.test(block),
    'and the container carries no chrome of its own, so each tab is its own capsule');
}

console.log('[2] four steps, one per tab');
{
  const steps = ['#homeBtn', '#libraryBtn', '#discoverBtn'];
  ok(/\.action-strip > #homeBtn\{ margin-right: calc\(var\(--sc80-step\) \* 3\); \}/.test(block),
    'Home is three steps in from the edge');
  ok(/\.action-strip > #libraryBtn\{ margin-right: calc\(var\(--sc80-step\) \* 2\); \}/.test(block),
    'Library two');
  ok(/\.action-strip > #discoverBtn\{ margin-right: var\(--sc80-step\); \}/.test(block),
    'Discover one');
  ok(/\.action-strip > #studioBtn\{ margin-right: 0; \}/.test(block),
    'and Studio sits in the corner, so the four read as a staircase');
  const margins = steps.map((s) => (block.match(new RegExp('\\' + s + '\\{ margin-right: ([^}]+)\\}')) || [])[1]);
  ok(new Set(margins).size === 3, 'three different offsets, not one shared inset (' + margins.join(' | ') + ')');
  ok(/--sc80-step: 15px/.test(block), 'the step is one variable (--sc80-step)');
  ok(/--sc80-step: 18px/.test(wide), 'and it widens on a computer');
}

console.log('[3] the player is measured, not guessed');
{
  ok(/--sc80-player: 112px;/.test(block), 'the fallback is declared in the same block');
  ok(/getElementById\('nowPlaying'\)/.test(src), 'applyLayout reaches for the player');
  ok(/setProperty\('--sc80-player', nh \+ 'px'\)/.test(src),
    'and writes its measured height into the variable the dock sits above');
  ok(/if\(nh > 40 && nh < 320\)/.test(src), 'with a guard, so a hidden player cannot lift the dock off the screen');
}

console.log('[4] the old bar is gone from this layout, not hidden behind');
{
  ok(/padding-top: 10px; padding-right: 0;/.test(block),
    'the views no longer reserve the top bar band');
  ok(/padding-bottom: calc\(var\(--sc80-player\) \+ 240px\)/.test(block),
    'they reserve the staircase and the player at the bottom instead');
  ok(/bottom: calc\(100% \+ 10px\);/.test(block),
    'the add-songs menu opens above the staircase, not under a top bar');
}

console.log('[5] bubbles: bigger on a phone, more per row on a computer');
{
  ok(/body\.sc80-cloud #homeBubbles\{ gap: 10px; \}/.test(block), 'the gap between two bubbles is 10px');
  ok(/body\.sc80-cloud \.home-bubble\{ width: calc\(50% - 5px\); padding: 14px; \}/.test(block),
    'and two still fit on a phone row');
  ok(/@media \(min-width: 900px\)/.test(wide), 'a 900px window gets its own rules');
  ok(/width: calc\(33\.333% - 7px\)/.test(wide), 'three bubbles to a row there');
  ok(/@media \(min-width: 1280px\)/.test(wide), 'and a 1280px one');
  ok(/width: calc\(25% - 8px\)/.test(wide), 'four to a row');
  ok(/max-width: 1120px; margin: 0 auto;/.test(wide), 'the wall is centred in a column rather than hugging the left edge');
}

console.log('[6] one motion set');
{
  ok(/--sc-ease: cubic-bezier/.test(src), 'the easing curve is a theme variable');
  ok(/--sc-ease-mid: 260ms;/.test(src), 'with one mid duration');
  ok(/transition: transform var\(--sc-ease-mid\) var\(--sc-ease\), background var\(--sc-ease-mid\) var\(--sc-ease\)/.test(block),
    'and the tabs read it');
  ok(!/transition:[^;]*\b(width|height|top|left|padding|margin)\b/.test(block),
    'nothing in this block animates layout');
}

console.log('[7] the split tabs kept their cut');
{
  ok(/clip-path:polygon\(0 0, 0 100%, 100% 100%\)/.test(src), 'Studio still owns the lower triangle');
  ok(/clip-path:polygon\(0 0, 100% 0, 100% 100%\)/.test(src), 'Tools the upper one');
  ok(/<line x1="0" y1="0" x2="100%" y2="100%"/.test(src), 'and the seam still runs top left to bottom right');
}

console.log('');
console.log((fail ? fail + ' FAILED, ' : 'ALL PASS: ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
'''


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        f.write(text)


def gate_present():
    if not os.path.exists(GATE):
        return False
    return MARKER in read('dev/staircase-check.cjs')


def gates_sh_has_it():
    src = read('dev/gates.sh')
    return 'staircase-check' in src


def main():
    steps = 0
    if not gate_present():
        steps += 1
        if CHECK:
            print('  pending: dev/staircase-check.cjs is not there yet')
        else:
            write('dev/staircase-check.cjs', GATE_SRC)
            print('  wrote dev/staircase-check.cjs')
    if not gates_sh_has_it():
        steps += 1
        if CHECK:
            print('  pending: dev/gates.sh does not run the staircase gate yet')
        else:
            src = read('dev/gates.sh')
            old = 'assistant-duck-depth-check converter-identity-check lyrics-timing-check ask-rail-check revamp-check"'
            if old not in src:
                sys.exit('patch-gate-8005: dev/gates.sh is not the shape this release expects')
            src = src.replace(old, 'assistant-duck-depth-check converter-identity-check lyrics-timing-check ask-rail-check revamp-check staircase-check"', 1)
            write('dev/gates.sh', src)
            print('  added staircase-check to the battery')
    if CHECK:
        if steps:
            print('patch-gate-8005 --check: pending, %d step(s) to apply' % steps)
            return 1
        print('patch-gate-8005 --check: 0 step(s) applied')
        return 0
    print('patch-gate-8005: %d step(s) applied' % steps)
    return 0


if __name__ == '__main__':
    sys.exit(main())
