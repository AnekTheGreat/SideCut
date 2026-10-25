#!/usr/bin/env python3
"""80.2.7 - put this release's section into dev/home-bubble-size-check.cjs, and check it.

That gate already answers for the Home bubble sizes - it is where the middle size was
argued for in 74.1.9 and where the stats card's floor was pinned in 80.2.6 - so the two
things this release changes belong in it:

  1. the walk the size chip takes is now the ladder in order (it used to go backwards
     at automatic and again at the wide banner), with Roomy and Grand filling the two
     long jumps;
  2. the Sandbox height stepper moves in quarter steps, so 1.25x is a real size and the
     first tap is no longer a 59px jump.

Section [1] and [3] are repinned to the new walk and the new step, and section [6] is
added: the ladder read out of the shipped bytes, the stylesheet made to draw every rung
at the height the ladder names, the chip driven through all ten rungs in order, and the
stepper driven four quarter steps in a row.

Idempotent: the marker is the section's own heading.

    python3 dev/patch-gate-8027.py
    python3 dev/patch-gate-8027.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'home-bubble-size-check.cjs')
MARKER = "console.log('[6] 80.2.7: the sizes come in order, with the long jumps filled');"

# Where the section goes: the gate's own last check, before its closing count.
ANCHOR = "  ok(errors.length === 0, 'no uncaught page errors while any of this ran', errors.slice(0, 3));\n"

# The header that lists what the gate answers for, so a reader of the file sees the
# new section without scrolling to it.
HEADER_OLD = ("//   [5] the full-width stats card is the one bubble that does not centre: its words sit on\n"
              "//       the card floor at every size, and its two lines grow where the card has the height.\n")
HEADER_NEW = (HEADER_OLD +
              "//   [6] 80.2.7: the sizes arrive in order - every tap is a taller card, automatic and the\n"
              "//       wide banner sit at their own heights on the way up, Roomy and Grand fill the two\n"
              "//       long jumps, no step between neighbours is bigger than 30px, and the stepper moves\n"
              "//       in quarter steps.\n")

OLD_HEADER_3 = "//   [3] the Sandbox H stepper lands on 1.5 and the bubble is 177px (1.5 x 118), persisted;\n"
NEW_HEADER_3 = "//   [3] the Sandbox H stepper moves in quarter steps: 1.25x is 148px (1.25 x 118), persisted;\n"

# [1] - the bytes. The walk and the step it pins moved.
OLD_PINS = """    ok(/HB_SIZE_CYCLE = \\['mini', 'small', 'medium', null, 'tall', 'wide', 'full', 'xl'\\]/.test(html),
      'the expand chip walks through it');
    ok(/HB_EXACT_STEP = 0\\.5/.test(html), 'and the height stepper has a half step');
    ok(/H<\\/b> is how tall it is \\(1\u20134\u00d7, in half steps/.test(html), 'the Sandbox editor says so');"""
NEW_PINS = """    ok(/HB_SIZE_CYCLE = \\['mini', 'small', 'wide', null, 'medium', 'tall', 'roomy', 'full', 'grand', 'xl'\\]/.test(html),
      'the expand chip walks the ladder in order');
    ok(/HB_EXACT_STEP = 0\\.25/.test(html), 'and the height stepper moves in quarter steps');
    ok(/H<\\/b> is how tall it is \\(1\u20134\u00d7, in quarter steps/.test(html), 'the Sandbox editor says so');"""

# [3] - the stepper, driven. Quarter steps now, so the first tap is 1.25 and not 1.5.
OLD_STEPPER = """    click(win, plus);
    await wait(60);
    const ex = (meta('homeBubbleExact') || {})[kind] || {};
    ok(Number(ex.h) === 1.5, 'one tap is a half step, not a whole one', ex);
    const b = bubbleFor(win, kind);
    ok(b && /calc\\(177px \\* var\\(--hb-s, 1\\)\\)/.test(b.style.minHeight || ''), 'and the bubble is 177px (1.5 x 118)', b && b.style.minHeight);
    click(win, plus);
    await wait(60);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 2, 'a second tap reaches 2x', (meta('homeBubbleExact') || {})[kind]);
    const minus = doc.querySelector('#sandboxBubbleSizes [data-hbex="' + kind + '"][data-axis="h"][data-dir="-1"]');
    click(win, minus); await wait(40);
    click(win, minus); await wait(40);
    click(win, minus); await wait(40);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 1, 'and it stops at 1x rather than shrinking past it', (meta('homeBubbleExact') || {})[kind]);"""

NEW_STEPPER = """    click(win, plus);
    await wait(60);
    const ex = (meta('homeBubbleExact') || {})[kind] || {};
    ok(Number(ex.h) === 1.25, 'one tap is a quarter step, not a whole one', ex);
    const b = bubbleFor(win, kind);
    ok(b && /calc\\(148px \\* var\\(--hb-s, 1\\)\\)/.test(b.style.minHeight || ''), 'and the bubble is 148px (1.25 x 118)', b && b.style.minHeight);
    click(win, plus);
    await wait(60);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 1.5, 'a second tap reaches 1.5x, which used to be the first step', (meta('homeBubbleExact') || {})[kind]);
    const minus = doc.querySelector('#sandboxBubbleSizes [data-hbex="' + kind + '"][data-axis="h"][data-dir="-1"]');
    click(win, minus); await wait(40);
    click(win, minus); await wait(40);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 1, 'and two taps back stop at 1x rather than shrinking past it', (meta('homeBubbleExact') || {})[kind]);"""

# [4] - Reset must clear the new rungs too, or a bubble left at Roomy would pass.
OLD_RESET_RE = "      .filter((b) => /hb-size-(mini|small|medium|tall|wide|full|xl)/.test(b.className) || b.style.minHeight);"
NEW_RESET_RE = "      .filter((b) => /hb-size-(mini|small|wide|medium|tall|roomy|full|grand|xl)/.test(b.className) || b.style.minHeight);"

SECTION = r"""  console.log('[6] 80.2.7: the sizes come in order, with the long jumps filled');
  {
    // THE LADDER, read out of the shipped bytes: every rung and the height the
    // stylesheet draws it at. The walk is checked against this table, so the chip cannot
    // promise an order the page does not draw.
    const table = (html.match(/const HB_SIZE_HEIGHTS = \{([^}]*)\}/) || [])[1] || '';
    const heights = {};
    for (const m of table.matchAll(/([a-z]+): (\d+)/g)) heights[m[1]] = Number(m[2]);
    const auto = Number((html.match(/\.home-bubble\{\n[\s\S]{0,400}?min-height:calc\((\d+)px \* var\(--hb-s, 1\)\)/) || [])[1]);
    ok(auto === 118, 'automatic is 118px, the size a normal card starts at', auto);
    const order = ((html.match(/const HB_SIZE_CYCLE = \[([^\]]*)\]/) || [])[1] || '')
      .split(',').map((s) => s.trim().replace(/'/g, '')).map((s) => (s === 'null' ? null : s));
    ok(order.length === 10, 'the chip walks ten rungs, automatic included', order.join(','));
    ok(Object.keys(heights).length === 9, 'and the ladder names nine sizes besides automatic', Object.keys(heights).sort().join(','));
    const hOf = (name) => (name === null ? auto : heights[name]);
    const walked = order.map(hOf);
    const steps = walked.slice(1).map((v, i) => v - walked[i]);
    ok(steps.every((d) => d > 0), 'every tap is a taller card than the one before it', walked.join(' > '));
    // THE TWO STEPS THAT WENT BACKWARDS, named: automatic after the middle size, and the
    // 96px wide banner after tall. Automatic now sits at 118, where 118 belongs.
    ok(hOf(null) > hOf('wide') && hOf(null) < hOf('medium'),
      'automatic sits between wide and medium, at its own height', order.join(','));
    ok(order[order.length - 1] === 'xl', 'and the walk still ends at XL', order[order.length - 1]);
    // THE TWO NEW SPOTS, and the size of the steps around them.
    ok(heights.roomy === 179, 'Roomy is 179px, between tall and full', heights.roomy);
    ok(heights.grand === 230, 'and Grand is 230px, between full and XL', heights.grand);
    ok(order.indexOf('roomy') === order.indexOf('tall') + 1 &&
       order.indexOf('full') === order.indexOf('roomy') + 1 &&
       order.indexOf('grand') === order.indexOf('full') + 1 &&
       order.indexOf('xl') === order.indexOf('grand') + 1,
      'both sit in the walk where their heights say they do', order.join(','));
    ok(Math.max(...steps) <= 30, 'no step in the walk is bigger than 30px', steps.join(','));
    // THE STYLESHEET DRAWS WHAT THE LADDER PROMISES. A rung the CSS did not size would be
    // walked at the automatic height while the ladder claimed otherwise.
    const cssHeight = (name) => Number((html.match(new RegExp('\\.home-bubble\\.hb-size-' + name + '\\{ [^}]*min-height:calc\\((\\d+)px')) || [])[1] || 0);
    const undrawn = Object.keys(heights).filter((n) => cssHeight(n) !== heights[n]);
    ok(undrawn.length === 0, 'the stylesheet draws every rung at the height the ladder names', undrawn.join(','));
    ok(/\.home-bubble\.hb-size-grand\{ grid-column:1 \/ -1;/.test(html), 'Grand spans the row, like full and XL do');
    ok(/\.home-bubble\.hb-size-roomy\{ min-height:calc\(179px \* var\(--hb-s, 1\)\); \}/.test(html),
      'and Roomy is a plain one-column rung');
    // DRIVEN, the whole walk: from automatic, ten taps must be exactly the ladder in
    // order, and the eleventh puts the card back to automatic.
    const kind = 'topsong';
    const bubble = bubbleFor(win, kind);
    const chip = bubble && bubble.querySelector('.hb-expand');
    const seen = [];
    for (let i = 0; i < 10 && chip; i++) {
      click(win, chip);
      await wait(25);
      const at = order.find((n) => (n === null ? !/hb-size-/.test(bubble.className) : bubble.classList.contains('hb-size-' + n)));
      seen.push(at === undefined ? 'none' : at);
    }
    const want = order.slice(order.indexOf(null) + 1).concat(order.slice(0, order.indexOf(null) + 1));
    ok(JSON.stringify(seen) === JSON.stringify(want),
      'the chip lands on every rung in turn, in the order the ladder names', seen.join(','));
    ok(want[want.length - 1] === null && seen[seen.length - 1] === null,
      'and the tap past the top of the ladder is the one that puts the card back to automatic', String(seen[seen.length - 1]));
    ok(!(meta('homeBubbleSizes') || {})[kind], 'which clears the saved size instead of storing automatic', JSON.stringify((meta('homeBubbleSizes') || {})[kind]));
    // THE STATS CARD follows the ladder: the bigger two lines from 80.2.6 apply on the new
    // sizes too, so a taller card is not a taller empty one.
    const grown = (html.match(/\[data-bubble="stats"\]:is\(([^)]*)\) [.]hb-value/) || [])[1] || '';
    ok(/hb-size-roomy/.test(grown) && /hb-size-grand/.test(grown),
      'the stats card grows its words on Roomy and Grand as well', grown);
    ok(/mini, small, wide, automatic, <b>medium<\/b>, tall, roomy, full, grand and XL\./.test(html),
      'the Sandbox paragraph lists the presets in that same order');
    // DRIVEN, the other end of the same request: four taps on H are four quarter steps,
    // each drawn at its own height - 148, 177, 207, 236.
    const other = 'artists';
    const hplus = doc.querySelector('#sandboxBubbleSizes [data-hbex="' + other + '"][data-axis="h"][data-dir="1"]');
    ok(!!hplus, 'the Sandbox stepper is there to drive');
    const marks = [];
    for (let i = 0; i < 4 && hplus; i++) {
      click(win, hplus);
      await wait(40);
      const hv = Number(((meta('homeBubbleExact') || {})[other] || {}).h);
      const drawn = bubbleFor(win, other);
      marks.push(hv + 'x=' + Math.round(118 * hv) + 'px:' + /calc\((\d+)px/.test(drawn && drawn.style.minHeight || ''));
    }
    ok(marks.join(',') === '1.25x=148px:true,1.5x=177px:true,1.75x=207px:true,2x=236px:true',
      'four taps are four quarter steps, each drawn at its own height', marks.join(','));
    click(win, doc.getElementById('sandboxBubbleSizesReset'));
    await wait(100);
  }

"""

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[6] 80.2.7: the sizes come in order, with the long jumps filled", 'the gate names 80.2.7'),
    ('the chip walks ten rungs, automatic included', 'the length of the walk is pinned'),
    ('every tap is a taller card than the one before it', 'the order is pinned'),
    ('automatic sits between wide and medium, at its own height', 'the rung that went backwards is pinned'),
    ('Roomy is 179px, between tall and full', 'Roomy is pinned'),
    ('and Grand is 230px, between full and XL', 'Grand is pinned'),
    ('both sit in the walk where their heights say they do', 'their places are pinned'),
    ('no step in the walk is bigger than 30px', 'the size of the steps is pinned'),
    ('the stylesheet draws every rung at the height the ladder names', 'the ladder and the CSS are one thing'),
    ('Grand spans the row, like full and XL do', 'the new full-width rung is pinned'),
    ('and Roomy is a plain one-column rung', 'and the new one-column rung is pinned'),
    ('the chip lands on every rung in turn, in the order the ladder names', 'the walk is driven'),
    ('and the tap past the top of the ladder is the one that puts the card back to automatic', 'the wrap is driven'),
    ('which clears the saved size instead of storing automatic', 'and the move back to automatic is a real reset'),
    ('the stats card grows its words on Roomy and Grand as well', 'the stats type follows'),
    ('the Sandbox paragraph lists the presets in that same order', 'the editor text is pinned'),
    ('four taps are four quarter steps, each drawn at its own height', 'the quarter-step stepper is driven'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8027: dev/home-bubble-size-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: section [6] is already in the gate')
    else:
        if CHECK:
            print('patch-gate-8027 --check: section [6] is not in the gate yet')
            return 1
        if src.count(ANCHOR) != 1:
            sys.exit('patch-gate-8027: the gate is not the shape this release expects')
        for old, new, what in (
            (OLD_PINS, NEW_PINS, 'the [1] pins'),
            (OLD_STEPPER, NEW_STEPPER, 'the [3] stepper'),
            (OLD_RESET_RE, NEW_RESET_RE, 'the [4] reset filter'),
            (HEADER_OLD, HEADER_NEW, 'the gate header'),
            (OLD_HEADER_3, NEW_HEADER_3, 'the [3] header line'),
        ):
            if src.count(old) != 1:
                sys.exit('patch-gate-8027: %s are not the shape this release expects' % what)
            src = src.replace(old, new, 1)
        src = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        open(GATE, 'w', encoding='utf-8').write(src)
        print('  applied: section [6], the repinned [1] and [3], the [4] filter and the header')
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8027: the gate is not the 80.2.7 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2.7: the ladder, the order, the two new rungs, the quarter steps (%d claims)' % len(CLAIMS))
    print('patch-gate-8027%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
