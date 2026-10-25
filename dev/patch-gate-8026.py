#!/usr/bin/env python3
"""80.2.6 - put this release's section into dev/home-bubble-size-check.cjs, and check it.

That gate already answers for the Home bubble sizes - it is where the middle size
was argued for in 74.1.9 - so the one thing this release changes about those sizes
belongs in it: the full-width stats card no longer takes the middle size's
centring, and its two lines are a little bigger where the card has the height.

Idempotent: the marker is the section's own heading.

    python3 dev/patch-gate-8026.py
    python3 dev/patch-gate-8026.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'home-bubble-size-check.cjs')
MARKER = "console.log('[5] 80.2.6: the full-width stats card keeps its words on the floor');"

# Where the section goes: the gate's own last check, before its closing count.
ANCHOR = "  ok(errors.length === 0, 'no uncaught page errors while any of this ran', errors.slice(0, 3));\n"

# The header that lists what the gate answers for, so a reader of the file sees the
# new section without scrolling to it.
HEADER_OLD = "//   [4] it cannot go below 1x, and Reset puts every bubble back to automatic.\n"
HEADER_NEW = (HEADER_OLD +
              "//   [5] the full-width stats card is the one bubble that does not centre: its words sit on\n"
              "//       the card floor at every size, and its two lines grow where the card has the height.\n")

SECTION = r"""  console.log('[5] 80.2.6: the full-width stats card keeps its words on the floor');
  {
    // THE RULE, read out of the shipped bytes. The middle size centres its lines so its
    // extra height is shared above and below them, which is right for a card with an
    // icon in the middle and wrong for this one: the stats icon is pinned top-left, so
    // the sharing showed up as a hole under the words.
    const floor = (html.match(/body:not\([.]sc80-cloud\) #homeBubbles [.]home-bubble\[data-bubble="stats"\]\{[^}]*\}/) || [''])[0];
    ok(/justify-content:flex-end/.test(floor), 'the stats card anchors its words to the floor', floor);
    ok(/^body:not\([.]sc80-cloud\)/.test(floor), 'and the circle wall is held out of it', floor);
    ok((html.match(/body:not\([.]sc80-cloud\) #homeBubbles [.]home-bubble\{/g) || []).length === 0,
      'no blanket rule floors every other bubble with it');
    ok(/\.home-bubble\.hb-size-medium\{[^}]*justify-content:center/.test(html),
      'the middle size itself still centres, so the other cards are unchanged');
    // THE TYPE. It grows only where the card has the height to hold it.
    const grown = (html.match(/\[data-bubble="stats"\]:is\(([^)]*)\) [.]hb-value/) || [])[1] || '';
    ok(/hb-size-medium/.test(grown) && /hb-size-tall/.test(grown) &&
       /hb-size-full/.test(grown) && /hb-size-xl/.test(grown),
      'the value grows on the four sizes with room for it', grown);
    ok(grown.indexOf('hb-size-wide') === -1 && grown.indexOf('hb-size-mini') === -1 &&
       grown.indexOf('hb-size-small') === -1,
      'and not on the cards whose words already fill them', grown);
    const valueRule = (html.match(/\.hb-size-xl\) [.]hb-value\{[^}]*\}/) || [''])[0];
    ok(/font-size:calc\(26px \* var\(--hb-s, 1\)\)/.test(valueRule), 'the value is 26px, up from 20', valueRule);
    const labelRule = (html.match(/\.hb-size-xl\) [.]hb-label\{[^}]*\}/) || [''])[0];
    ok(/font-size:calc\(12\.5px \* var\(--hb-s, 1\)\)/.test(labelRule), 'the label is 12.5px, up from 11.5', labelRule);
    ok(/padding-right:26px/.test(labelRule), 'and it stops short of the expand hint', labelRule);
    // DRIVEN. The floor belongs to this one card, not to whatever is wearing the size:
    // the stats bubble is put at Medium and the card beside it at Medium too.
    const stats = bubbleFor(win, 'stats');
    ok(!!stats && stats.dataset.bubble === 'stats', 'the stats bubble is the card the rule names', stats && stats.dataset.bubble);
    const chip = stats && stats.querySelector('.hb-expand');
    let reached = false;
    for (let i = 0; i < 8 && chip; i++) {
      click(win, chip);
      if (stats.classList.contains('hb-size-medium')) { reached = true; break; }
    }
    ok(reached, 'it can still wear the middle size', stats && stats.className);
    const other = bubbleFor(win, 'topsong');
    ok(other && other.dataset.bubble !== 'stats', 'and the card beside it is not covered by the rule', other && other.dataset.bubble);
    click(win, doc.getElementById('sandboxBubbleSizesReset'));
    await wait(100);
  }

"""

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[5] 80.2.6: the full-width stats card keeps its words on the floor", 'the gate names 80.2.6'),
    ('the stats card anchors its words to the floor', 'the floor rule is pinned'),
    ('and the circle wall is held out of it', 'the circle wall exclusion is pinned'),
    ('no blanket rule floors every other bubble with it', 'the other bubbles are pinned untouched'),
    ('the middle size itself still centres, so the other cards are unchanged', '74.1.9 is pinned untouched'),
    ('the value grows on the four sizes with room for it', 'the grown sizes are pinned'),
    ('and not on the cards whose words already fill them', 'the excluded sizes are pinned'),
    ('the value is 26px, up from 20', 'the value size is pinned'),
    ('the label is 12.5px, up from 11.5', 'the label size is pinned'),
    ('and it stops short of the expand hint', 'the label inset is pinned'),
    ('the stats bubble is the card the rule names', 'the card is pinned by its own name'),
    ('it can still wear the middle size', 'and pinned to still take the size'),
    ('and the card beside it is not covered by the rule', 'the neighbouring card is pinned'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8026: dev/home-bubble-size-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: section [5] is already in the gate')
    else:
        if CHECK:
            print('patch-gate-8026 --check: section [5] is not in the gate yet')
            return 1
        if src.count(ANCHOR) != 1:
            sys.exit('patch-gate-8026: the gate is not the shape this release expects')
        src = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        if src.count(HEADER_OLD) != 1:
            sys.exit('patch-gate-8026: the gate header is not the shape this release expects')
        src = src.replace(HEADER_OLD, HEADER_NEW, 1)
        open(GATE, 'w', encoding='utf-8').write(src)
        print('  applied: section [5]')
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8026: the gate is not the 80.2.6 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2.6: the floor, the type, the excluded sizes (%d claims)' % len(CLAIMS))
    print('patch-gate-8026%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
