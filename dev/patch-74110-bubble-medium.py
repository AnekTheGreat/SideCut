#!/usr/bin/env python3
"""74.1.9 - a bubble size that is actually in between, and half steps to land on it.

The owner, looking at Home: *"there should be like an inbetween settings for the bubble size
like in the middle but without all that gap but not too little"*.

What was on offer:
  * the expand chip on a bubble cycled mini (60) -> small (84) -> automatic (118) -> tall (158)
    -> wide -> full -> xl, with no middle;
  * Sandbox -> Home bubble sizes gave W (columns) and H (1..4 x 118px) - whole steps only, so
    118 -> 236 with nothing between them, and 236 is a card with a quarter of a metre of empty
    middle in it.

So: a **Medium** preset at 146px (between automatic and tall), and **half steps** on H, so an
in-between height exists wherever the owner wants it. The size is still per bubble, still saved
to `homeBubbleExact` / `homeBubbleSizes`, and still scaled by the Sandbox bubble-size slider.

    python3 dev/patch-74110-bubble-medium.py           # apply
    python3 dev/patch-74110-bubble-medium.py --check   # the shipped page carries every edit
"""
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"

src = PAGE.read_text(encoding="utf-8")
edits, pairst = [], []
CHECK = "--check" in sys.argv


def rep(old, new, why):
    global src
    pairst.append((old, new, why))
    if CHECK:
        return
    n = src.count(old)
    if n != 1:
        raise SystemExit("anchor found %d times (%s):\n%s" % (n, why, old[:200]))
    src = src.replace(old, new, 1)
    edits.append(why)


# ---------------------------------------------------------------------------
# 1. The size itself: 146px, between automatic (118) and tall (158).
# ---------------------------------------------------------------------------
rep(
    ".home-bubble.hb-size-small{ min-height:calc(84px * var(--hb-s, 1)); }\n",
    ".home-bubble.hb-size-small{ min-height:calc(84px * var(--hb-s, 1)); }\n"
    "/* THE MIDDLE SIZE. Automatic is 118 and tall is 158, and 158 is a card with a\n"
    "   stretch of empty middle between its icon and its label - the owner's \"all that\n"
    "   gap\". 146 is the size between them: still a card you can read at a glance, with\n"
    "   the least empty height that keeps the icon and the two lines apart. */\n"
    ".home-bubble.hb-size-medium{ min-height:calc(146px * var(--hb-s, 1)); justify-content:center; }\n"
    "/* The extra height of the middle size is shared above and below the words instead of\n"
    "   becoming one hole between the icon and the label - which is the whole reason a\n"
    "   middle size was asked for. */\n"
    ".home-bubble.hb-size-medium .hb-value{ font-size:calc(20px * var(--hb-s, 1)); }\n",
    "Medium is a real size (146px), between automatic and tall",
)

# ---------------------------------------------------------------------------
# 2. It joins the presets and the chip's cycle.
# ---------------------------------------------------------------------------
rep(
    "  const HB_SIZE_CLASSES = ['hb-size-mini', 'hb-size-small', 'hb-size-tall', 'hb-size-wide', 'hb-size-full', 'hb-size-xl'];\n"
    "  const HB_SIZE_CYCLE = ['mini', 'small', null, 'tall', 'wide', 'full', 'xl']; // null = back to automatic\n"
    "  const HB_EXACT_MIN = 1, HB_EXACT_MAX = 4;\n",
    "  const HB_SIZE_CLASSES = ['hb-size-mini', 'hb-size-small', 'hb-size-medium', 'hb-size-tall', 'hb-size-wide', 'hb-size-full', 'hb-size-xl'];\n"
    "  // The chip walks up from mini through the middle to full width. `null` is the\n"
    "  // automatic template size, and it stays in the walk because that is where a bubble\n"
    "  // starts: the first tap on an untouched bubble goes to tall, as it always did.\n"
    "  const HB_SIZE_CYCLE = ['mini', 'small', 'medium', null, 'tall', 'wide', 'full', 'xl']; // null = back to automatic\n"
    "  const HB_EXACT_MIN = 1, HB_EXACT_MAX = 4;\n"
    "  // Half a step of 118px. Whole steps only ever offered 118 or 236, and the size the\n"
    "  // owner asked for - the middle, without a cardful of empty space - sits between them.\n"
    "  const HB_EXACT_STEP = 0.5;\n",
    "the Medium preset is in the class list and the chip cycle, and H has a half step",
)

# ---------------------------------------------------------------------------
# 3. The H stepper moves in those halves (W stays whole columns).
# ---------------------------------------------------------------------------
rep(
    "  function setHomeBubbleExact(kind, axis, delta){\n"
    "    const cur = homeBubbleExact[kind] || { w: 1, h: 1 };\n"
    "    const next = { w: Number(cur.w) || 1, h: Number(cur.h) || 1 };\n"
    "    next[axis] = Math.max(HB_EXACT_MIN, Math.min(HB_EXACT_MAX, next[axis] + delta));\n",
    "  function setHomeBubbleExact(kind, axis, delta){\n"
    "    const cur = homeBubbleExact[kind] || { w: 1, h: 1 };\n"
    "    const next = { w: Number(cur.w) || 1, h: Number(cur.h) || 1 };\n"
    "    // Height moves in halves; width is a column count and can only be whole.\n"
    "    const step = axis === 'h' ? HB_EXACT_STEP : 1;\n"
    "    next[axis] = Math.max(HB_EXACT_MIN, Math.min(HB_EXACT_MAX, next[axis] + delta * step));\n"
    "    next[axis] = Math.round(next[axis] * 10) / 10;   // 1.5, not 1.5000000000000002\n",
    "the H stepper moves in half steps and stores a clean number",
)

# ---------------------------------------------------------------------------
# 4. The editor says so.
# ---------------------------------------------------------------------------
rep(
    "Set each bubble to exactly the size you want — <b>W</b> is how many columns it takes (1 or 2, 2 = full width) and <b>H</b> is how tall it is (1–4×). Also available: tap the ⤢ chip on any bubble to cycle through the presets.",
    "Set each bubble to exactly the size you want — <b>W</b> is how many columns it takes (1 or 2, 2 = full width) and <b>H</b> is how tall it is (1–4×, in half steps, so 1.5 is a real size). Also available: tap the ⤢ chip on any bubble to cycle through the presets — mini, small, <b>medium</b>, automatic, tall, wide, full and XL.",
    "the Sandbox editor explains the half steps and the Medium preset",
)

# ---------------------------------------------------------------------------
# 5. The release note.
# ---------------------------------------------------------------------------
rep(
    "    'The message bar can be flicked up out of the way, and it is announced to a screen reader.',\n",
    "    'The message bar can be flicked up out of the way, and it is announced to a screen reader.',\n"
    "    'Home bubbles have the size that was missing: Medium sits between automatic and tall, and the height steppers move in half steps now, so the middle size exists instead of a cardful of empty space or a card that is too small.',\n",
    "the release note offers the middle bubble size",
)

# ---------------------------------------------------------------------------
# 6. "Reset to automatic" also clears the chip's presets, or it breaks its promise.
# ---------------------------------------------------------------------------
rep(
    "      homeBubbleExact = {};\n"
    "      dbPut('meta', { key: 'homeBubbleExact', value: {} });\n"
    "      applyHomeBubbleSizes();\n",
    "      // BOTH ways a bubble can be sized, or the button breaks its own promise. The\n"
    "      // presets the expand chip sets live in homeBubbleSizes, and this used to clear\n"
    "      // only the exact sizes - so after tapping the chip, \"Reset to automatic\" left\n"
    "      // the bubble at the preset size while saying every bubble was back to automatic.\n"
    "      homeBubbleExact = {};\n"
    "      homeBubbleSizes = {};\n"
    "      dbPut('meta', { key: 'homeBubbleExact', value: {} });\n"
    "      dbPut('meta', { key: 'homeBubbleSizes', value: {} });\n"
    "      applyHomeBubbleSizes();\n",
    "Reset clears both the exact sizes and the chip presets, which is what it says",
)

if CHECK:
    bad = 0
    for old, new, why in pairst:
        # The Ask note is inserted between this block's lines by the patch that runs
        # after it, so the Medium note is no longer glued to the line above it on the
        # shipped page. Every line this edit adds must still be there.
        added = [ln for ln in new.splitlines() if ln.strip() and ln not in old.splitlines()]
        if new not in src and not (added and all(ln in src for ln in added)):
            print("  MISSING result: " + why)
            bad += 1
        elif old not in new and old in src:
            # An anchor that is a PREFIX of its own replacement is still in the page
            # by construction; only a genuinely un-replaced anchor is a failure.
            print("  STALE anchor:  " + why)
            bad += 1
    if bad:
        print("patch-74110-bubble-medium: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-74110-bubble-medium: CHECK OK - %d edits are in the page" % len(pairst))
    for _, _, e in pairst:
        print("  . " + e)
    sys.exit(0)

PAGE.write_text(src, encoding="utf-8")
print("patch-74110-bubble-medium: applied %d edits" % len(edits))
for e in edits:
    print("  . " + e)
