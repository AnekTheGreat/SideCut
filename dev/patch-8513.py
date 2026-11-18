#!/usr/bin/env python3
"""SideCut 85.1.3 - the size chip fits, and the wide header sits right.

85.1.2's quality chip inherited the header's `button` rule, which is written for
the round close button: 34 by 34, border-box. The chip carries a label - `1080p`
is 41px - so the size spilled out of its own pill and into the close button. It
now takes its own width and height, and its chevron turns over while the list is
open.

Two smaller things from the same pass:

  * the landscape header hides the title, which was the flex spacer that kept the
    chip and the close button on the right - so both control the wide picture
    from the top right, not the top left;
  * the high-size soundtrack element is kept in the page with a 1px box instead
    of `display:none`, because a media element with no box is one some phones
    will not play.

This is a fix release on top of 85.1.2's module: the edits are matched exactly in
both `index.html` and `dev/video-8512.js`, so the file stays the module that
shipped, and the version, cache name, one notes entry and `updates.json` move to
85.1.3 together.

    python3 dev/patch-8513.py            # apply
    python3 dev/patch-8513.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8512.js")

V = "85.1.3"
OLD = "85.1.2"
DATE = "November 18, 2026"
TITLE = "The size chip fits, and the wide header sits right"

NOTES = [
    "[FULL] The size chip in the video header keeps its own shape now. The header rule that sizes the round close button was sizing the chip too, so a label like 1080p spilled out of its pill and into the close button; the chip fits its label, and its chevron turns over while the list is open.",
    "[FULL] The landscape header keeps the size chip and the close button at the top right of the wide picture, where they were meant to be, instead of sliding to the left when the title hides.",
    "[FULL] The paired soundtrack of a high size is kept in the page with a one-pixel box rather than hidden from the layout, because a media element with no box at all is one some phones will not play.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.1.2', date: 'November 18, 2026', "
    "title: 'A quality list, and a picture that turns sideways', items: [\n"
)

MODULE_MARK = "85.1.2 - A LADDER OF QUALITIES"
EDITS = [
    (
        "'#scVideoHead .sv-chip{display:inline-flex;align-items:center;gap:5px;font-family:\"JetBrains Mono\",monospace;',",
        "'#scVideoHead .sv-chip{display:inline-flex;align-items:center;gap:5px;width:auto;height:auto;font-family:\"JetBrains Mono\",monospace;',",
        "the size chip rule",
    ),
    (
        "'border-bottom:1.5px solid currentColor;transform:translateY(-1px) rotate(45deg);opacity:.85}',",
        "'border-bottom:1.5px solid currentColor;transform:translateY(-1px) rotate(45deg);opacity:.85}',\n"
        "      '#scVideoHead .sv-chip.on::after{transform:translateY(1px) rotate(-135deg)}',",
        "the chip chevron",
    ),
    (
        "'left:calc(env(safe-area-inset-left) + 10px);right:calc(env(safe-area-inset-right) + 10px);padding:0}',",
        "'left:calc(env(safe-area-inset-left) + 10px);right:calc(env(safe-area-inset-right) + 10px);padding:0;justify-content:flex-end}',",
        "the wide header rule",
    ),
    (
        "'#scVideoAuxEl{display:none}',",
        "'#scVideoAuxEl{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0}',",
        "the soundtrack element rule",
    ),
]


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8513: %s appears %d times, expected exactly 1" % (what, n))


def fix(text, what):
    """Apply the four layout edits, each matched exactly once.

    Already-applied is not an error: a second run must be a no-op, so an edit
    whose replacement is present is skipped and only an edit that is missing
    both halves stops the release.
    """
    for old, new, label in EDITS:
        if new in text:
            continue
        once(text, old, label + " (%s)" % what)
        text = text.replace(old, new, 1)
    return text


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    module = io.open(MODULE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()

    if MODULE_MARK not in page:
        raise SystemExit("patch-8513: the page does not carry the 85.1.2 module")

    out = fix(page, "page")
    mod = fix(module, "module")

    if ("const APP_VERSION = '%s';" % V) not in out:
        once(out, "const APP_VERSION = '%s';" % OLD, "the version line")
        out = out.replace("const APP_VERSION = '%s';" % OLD,
                          "const APP_VERSION = '%s';" % V, 1)
    if ENTRY not in out:
        once(out, NOTES_ANCHOR, "the 85.1.2 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)

    sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V)

    up_new = up
    if json.loads(up).get("version") != V:
        data = json.loads(up)
        data["version"] = V
        data["notes"] = NOTES
        data["date"] = DATE
        up_new = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        if up.endswith("\n"):
            up_new += "\n"

    if out == page and mod == module and sw_new == sw and up_new == up:
        print("already on the page")
        return 0
    if check:
        print("not applied yet")
        return 1

    once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(MODULE, "w", encoding="utf-8").write(mod)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    io.open(UPDATES, "w", encoding="utf-8").write(up_new)
    print("page and module at %s: the size chip takes its own width, the wide "
          "header keeps its controls on the right, and the soundtrack element "
          "keeps a box; cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
