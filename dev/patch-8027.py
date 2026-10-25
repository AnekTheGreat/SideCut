#!/usr/bin/env python3
"""80.2.7 - the Home bubble sizes come in order, with more steps between them.

The owner, looking at the size chip on Home:

  "it should be in order the way it goes the resizing and add more in between spots"

BOTH HALVES WERE REAL. The chip walked this list:

  mini 60 -> small 84 -> medium 146 -> automatic 118 -> tall 158 -> wide 96 ->
  full 200 -> XL 260

Two taps made the card SHORTER than the one before them (automatic after medium,
the 96px wide banner after tall), and the two remaining gaps were single taps of
62px (small to medium) and 60px (full to XL). The Sandbox height stepper was
coarse from the other end: half steps of a 118px base, so 118, 177, 236...

This release:

  1. THE LADDER, IN ORDER. The walk is one ascending line - mini 60, small 84,
     wide 96, automatic 118, medium 146, tall 158, roomy 179, full 200, grand 230,
     XL 260 - so every tap is a taller card than the last, and one tap past XL
     returns the bubble to automatic. The heights live in one table beside the
     walk, so the chip cannot get out of step with the stylesheet.
  2. TWO NEW RUNGS. Roomy (179px) between tall and full and Grand (230px) between
     full and XL are ordinary presets: same kind of rule, same scaling, saved the
     same way. No step in the walk is now bigger than 30px.
  3. THE STEPPER. The Sandbox height stepper moves in quarter steps, so it lands
     on 148, 177, 207, 236 ... instead of 118 and 236 with a half step between.
  4. THE STATS CARD follows: the bigger two lines it grew in 80.2.6 now apply on
     Roomy and Grand as well, so a taller card is not a taller empty card.

Nothing here changes a size that is already saved: the heights of mini, small,
wide, medium, tall, full and XL are untouched, and a bubble wearing one of them
keeps it.

Idempotent: the marker is the stylesheet block's own comment.

    python3 dev/patch-8027.py
    python3 dev/patch-8027.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.7'
OLD_VERSION = '80.2.6'
MARKER = '/* 80.2.7 - THE SIZES COME IN ORDER, WITH MORE STEPS BETWEEN THEM.'
TEXT = os.path.join(ROOT, 'dev', 'patch-8027-text.py')

OLD_STATS_LIST = ':is(.hb-size-medium, .hb-size-tall, .hb-size-full, .hb-size-xl)'
NEW_STATS_LIST = ':is(.hb-size-medium, .hb-size-tall, .hb-size-roomy, .hb-size-full, .hb-size-grand, .hb-size-xl)'

OLD_CONSTANTS = """  const HB_SIZE_CLASSES = ['hb-size-mini', 'hb-size-small', 'hb-size-medium', 'hb-size-tall', 'hb-size-wide', 'hb-size-full', 'hb-size-xl'];
  // The chip walks up from mini through the middle to full width. `null` is the
  // automatic template size, and it stays in the walk because that is where a bubble
  // starts: the first tap on an untouched bubble goes to tall, as it always did.
  const HB_SIZE_CYCLE = ['mini', 'small', 'medium', null, 'tall', 'wide', 'full', 'xl']; // null = back to automatic
  const HB_EXACT_MIN = 1, HB_EXACT_MAX = 4;
  // Half a step of 118px. Whole steps only ever offered 118 or 236, and the size the
  // owner asked for - the middle, without a cardful of empty space - sits between them.
  const HB_EXACT_STEP = 0.5;"""

NEW_CONSTANTS = """  const HB_SIZE_CLASSES = ['hb-size-mini', 'hb-size-small', 'hb-size-wide', 'hb-size-medium', 'hb-size-tall', 'hb-size-roomy', 'hb-size-full', 'hb-size-grand', 'hb-size-xl'];
  // THE LADDER. Every size a bubble can be put at, smallest first, with the height the
  // stylesheet draws each one at - the same numbers, so the walk can say where it is
  // without measuring a card. `null` is automatic, the template's own size: 118 on a
  // normal card, and it sits at 118 in this line instead of off to one side, because
  // it is a size like the rest of them and has its own place on the way up.
  const HB_SIZE_HEIGHTS = { mini: 60, small: 84, wide: 96, medium: 146, tall: 158, roomy: 179, full: 200, grand: 230, xl: 260 };
  // THE WALK, IN ORDER. Every tap is a taller card than the one before it, and one tap
  // past XL puts the bubble back to automatic. It read mini, small, medium, automatic,
  // tall, wide, full, XL before - which made the card shorter at automatic and again at
  // the wide banner, and left 62px between small and medium with nothing in between.
  const HB_SIZE_CYCLE = ['mini', 'small', 'wide', null, 'medium', 'tall', 'roomy', 'full', 'grand', 'xl'];
  const HB_EXACT_MIN = 1, HB_EXACT_MAX = 4;
  // A quarter of a step of 118px. Whole steps offered 118 or 236 and half steps still
  // jumped 59px, so the Sandbox stepper now lands on 118, 148, 177, 207, 236 ... - a
  // spot every 30px between the two sizes it used to choose between.
  const HB_EXACT_STEP = 0.25;"""

OLD_CYCLE = """  function cycleHomeBubbleSize(kind){
    const cur = homeBubbleSizes[kind] || null;
    const next = HB_SIZE_CYCLE[(HB_SIZE_CYCLE.indexOf(cur) + 1) % HB_SIZE_CYCLE.length];"""

NEW_CYCLE = """  function cycleHomeBubbleSize(kind){
    const cur = homeBubbleSizes[kind] || null;
    // The next rung up the ladder, or automatic one tap past the top of it. A stored
    // size that is not on the ladder at all starts the walk over rather than guessing
    // a place for it.
    const at = HB_SIZE_CYCLE.indexOf(cur);
    const next = HB_SIZE_CYCLE[at < 0 ? 0 : (at + 1) % HB_SIZE_CYCLE.length];"""

OLD_ROUND = """    // Height moves in halves; width is a column count and can only be whole.
    const step = axis === 'h' ? HB_EXACT_STEP : 1;
    next[axis] = Math.max(HB_EXACT_MIN, Math.min(HB_EXACT_MAX, next[axis] + delta * step));
    next[axis] = Math.round(next[axis] * 10) / 10;   // 1.5, not 1.5000000000000002"""

NEW_ROUND = """    // Height moves in quarters; width is a column count and can only be whole.
    const step = axis === 'h' ? HB_EXACT_STEP : 1;
    next[axis] = Math.max(HB_EXACT_MIN, Math.min(HB_EXACT_MAX, next[axis] + delta * step));
    next[axis] = Math.round(next[axis] * 100) / 100;   // 1.25, not 1.2500000000000002"""

# The H readout is the only one that can now carry a decimal, so it gets the width.
OLD_H_VALUE = """'<span style="width:14px;text-align:center;font-size:11.5px;">' + (Number(ex.h) || 1)"""
NEW_H_VALUE = """'<span style="width:26px;text-align:center;font-size:11.5px;">' + (Number(ex.h) || 1)"""

# The Sandbox paragraph: the quarter steps, and the presets in the order they arrive.
OLD_STEP_TEXT = '(1–4×, in half steps, so 1.5 is a real size)'
NEW_STEP_TEXT = '(1–4×, in quarter steps, so 1.25 is a real size)'
OLD_PRESET_TEXT = 'mini, small, <b>medium</b>, automatic, tall, wide, full and XL.'
NEW_PRESET_TEXT = 'mini, small, wide, automatic, <b>medium</b>, tall, roomy, full, grand and XL.'

# What this release has to have left in the page, once the edits have landed.
CLAIMS = [
    ("const APP_VERSION = '80.2.7';", 'the page runs 80.2.7'),
    (MARKER, 'the stylesheet block is in the page'),
    ('.home-bubble.hb-size-roomy{ min-height:calc(179px * var(--hb-s, 1)); }', 'Roomy is a real size at 179px'),
    ('.home-bubble.hb-size-grand{ grid-column:1 / -1; min-height:calc(230px * var(--hb-s, 1)); }',
     'and Grand is a full-width size at 230px'),
    ("const HB_SIZE_HEIGHTS = { mini: 60, small: 84, wide: 96, medium: 146, tall: 158, roomy: 179, full: 200, grand: 230, xl: 260 };",
     'the ladder states every height once'),
    ("const HB_SIZE_CYCLE = ['mini', 'small', 'wide', null, 'medium', 'tall', 'roomy', 'full', 'grand', 'xl'];",
     'and the walk is that ladder in order'),
    ('const at = HB_SIZE_CYCLE.indexOf(cur);', 'the walk asks where it is before moving'),
    ('const HB_EXACT_STEP = 0.25;', 'the height stepper moves in quarter steps'),
    ('Math.round(next[axis] * 100) / 100;', 'and stores them cleanly'),
    (NEW_STEP_TEXT, 'the Sandbox editor says quarter steps'),
    (NEW_PRESET_TEXT, 'and lists the presets in the order they arrive'),
    (NEW_STATS_LIST + ' .hb-value', 'the stats card grows its two lines on the new sizes too'),
    (NEW_STATS_LIST + ' .hb-label', 'both of them'),
    ("{ version: '80.2.7', date:", 'the changelog records the release'),
    ("{ version: '80.2.6', date:", 'with 80.2.6 still listed next'),
]

# The pieces the release must NOT leave behind.
GONE = [
    ("const HB_SIZE_CYCLE = ['mini', 'small', 'medium', null, 'tall', 'wide', 'full', 'xl'];",
     'the out-of-order walk'),
    ('const HB_EXACT_STEP = 0.5;', 'the half-step stepper'),
    (OLD_STEP_TEXT, 'the half-step sentence'),
    (OLD_STATS_LIST, 'a stats rule that skips the new sizes'),
    ('in half steps, so 1.5 is a real size', 'an old half-step claim'),
]


def load_text():
    spec = importlib.util.spec_from_file_location('sc_patch_8027_text', TEXT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def swap(src, old, new, what, times=1):
    if src.count(old) != times:
        raise SystemExit('patch-8027: %s appears %d times, expected %d' % (what, src.count(old), times))
    return src.replace(old, new)


def apply_all(src):
    t = load_text()
    # 1. THE STYLESHEET BLOCK, under the last of the size rules.
    src = swap(src, t.CSS_ANCHOR, t.CSS_ANCHOR + t.CSS, 'the size rules')
    # 2. THE LADDER ITSELF: one ordered walk, two new rungs, quarter steps.
    src = swap(src, OLD_CONSTANTS, NEW_CONSTANTS, 'the size constants')
    src = swap(src, OLD_CYCLE, NEW_CYCLE, 'the chip walk')
    src = swap(src, OLD_ROUND, NEW_ROUND, 'the exact-size rounding')
    src = swap(src, OLD_H_VALUE, NEW_H_VALUE, 'the H readout')
    # 3. THE STATS CARD grows its two lines on the sizes that have room for them.
    src = swap(src, OLD_STATS_LIST, NEW_STATS_LIST, 'the stats size list', times=2)
    # 4. THE SANDBOX PARAGRAPH.
    src = swap(src, OLD_STEP_TEXT, NEW_STEP_TEXT, 'the half-step sentence')
    src = swap(src, OLD_PRESET_TEXT, NEW_PRESET_TEXT, 'the preset list')
    # 5. THE RELEASE ITSELF.
    src = swap(src, t.CHANGELOG_ANCHOR, t.CHANGELOG_HEAD + t.CHANGELOG_ANCHOR,
               'the changelog head')
    src = swap(src, "  const APP_VERSION = '%s';" % OLD_VERSION,
               "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the ordered ladder and the page runs as ' + VERSION)
        print('patch-8027%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8027 --check: the release is pending, 10 steps to apply')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8027: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8027: the page did not end up 80.2.7 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle in page]
    if left:
        sys.exit('patch-8027: the page still carries this (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v%s'" % OLD_VERSION not in sw:
        sys.exit('patch-8027: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(
        sw.replace("'sidecut-shell-v%s'" % OLD_VERSION, "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the ordered ladder, Roomy and Grand, the quarter steps, the notes and the shell cache')
    print('patch-8027: 10 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
