#!/usr/bin/env python3
"""80.2.6 - the listening stats bubble keeps its words on the floor, bigger.

The owner, looking at Home on a phone:

  "fix this why is there a random bottom gap in the listening stats bubble for this
   move the stuff lower the actual stats and you can make the stuff a lil bigger"

THE GAP WAS REAL AND IT WAS THE MIDDLE SIZE'S OWN RULE. The stats card is the one
full-width bubble, and it was wearing hb-size-medium (146px). That rule centres its
two lines so the extra height is shared above and below them - which is the right
answer for a card whose icon sits in the middle and the wrong one here, because the
stats icon is pinned in the top-left corner. The room above the words was already
spoken for, so the sharing showed up as a hole under them: 53px of empty card, the
"random bottom gap".

This release:

  1. THE FLOOR. The stats bubble anchors its words to the card's own floor, the way
     every other bubble's are anchored, so any height it is given lands above the
     words - behind the icon - instead of beneath them. It is scoped to
     body:not(.sc80-cloud), so the circle wall's centring is untouched.
  2. THE TYPE. Where the card has the height for it (medium, tall, full, xl) the
     value goes 20px -> 26px and the label 11.5px -> 12.5px, with the label stopping
     26px short of the expand hint in the bottom-right corner. The automatic 96px
     wide card is deliberately NOT in that list: its words already fill it, and the
     bigger type put the icon's foot on the number.

Nothing is pinned to a stored size, so the fix holds whether the height came from
the expand chip or from the Sandbox stepper.

Idempotent: the marker is the stylesheet block's own comment.

    python3 dev/patch-8026.py
    python3 dev/patch-8026.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.6'
MARKER = '/* 80.2.6 - THE WIDE STATS BUBBLE PUTS ITS WORDS ON THE FLOOR.'
TEXT = os.path.join(ROOT, 'dev', 'patch-8026-text.py')

# What this release has to have left in the page, once the edit has landed.
CLAIMS = [
    ("const APP_VERSION = '80.2.6';", 'the page runs 80.2.6'),
    (MARKER, 'the stylesheet block is in the page'),
    ('body:not(.sc80-cloud) #homeBubbles .home-bubble[data-bubble="stats"]{ justify-content:flex-end; }',
     'the stats card anchors to its floor'),
    ('body:not(.sc80-cloud) #homeBubbles', 'and only outside the circle wall'),
    ('.hb-size-medium, .hb-size-tall, .hb-size-full, .hb-size-xl) .hb-value{ font-size:calc(26px',
     'the value grows where the card has room'),
    ('.hb-size-medium, .hb-size-tall, .hb-size-full, .hb-size-xl) .hb-label{ font-size:calc(12.5px',
     'and so does the label'),
    ('padding-right:26px', 'the label stops short of the expand hint'),
    ('.home-bubble.hb-size-medium{ min-height:calc(146px * var(--hb-s, 1)); justify-content:center; }',
     'the middle size itself is untouched'),
    ('.home-bubble.hb-size-wide{ grid-column:1 / -1; min-height:calc(96px * var(--hb-s, 1)); }',
     'and so is the automatic wide card'),
    ("{ version: '80.2.6', date:", 'the changelog records the release'),
    ("{ version: '80.2.5', date:", 'with 80.2.5 still listed next'),
]

# The pieces the release must NOT leave behind.
GONE = [
    ('body:not(.sc80-cloud) #homeBubbles .home-bubble{ justify-content:flex-end;',
     'a rule that would floor every bubble on Home'),
]


def load_text():
    spec = importlib.util.spec_from_file_location('sc_patch_8026_text', TEXT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8026: %s appears %d times, expected once' % (what, src.count(old)))
    return src.replace(old, new, 1)


def apply_all(src):
    t = load_text()
    # 1. THE STYLESHEET BLOCK, under the last of the size rules.
    src = swap(src, t.CSS_ANCHOR, t.CSS_ANCHOR + t.CSS, 'the size rules')
    # 2. THE RELEASE ITSELF.
    src = swap(src, t.CHANGELOG_ANCHOR, t.CHANGELOG_HEAD + t.CHANGELOG_ANCHOR,
               'the changelog head')
    src = swap(src, "  const APP_VERSION = '80.2.5';", "  const APP_VERSION = '%s';" % VERSION,
               'the version')
    return src


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the floor-anchored stats card and the page runs as ' + VERSION)
        print('patch-8026%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8026 --check: the release is pending, 3 steps to apply')
        return 1
    if "const APP_VERSION = '80.2.5';" not in page:
        sys.exit('patch-8026: the page is not 80.2.5, so it is not the shape this release expects')
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8026: the page did not end up 80.2.6 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle in page]
    if left:
        sys.exit('patch-8026: the page carries a rule this release refuses (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v80.2.5'" not in sw:
        sys.exit('patch-8026: the shell cache is not the 80.2.5 one')
    open(sw_path, 'w', encoding='utf-8').write(
        sw.replace("'sidecut-shell-v80.2.5'", "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the stats floor, the bigger two lines, the notes and the shell cache')
    print('patch-8026: 3 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
