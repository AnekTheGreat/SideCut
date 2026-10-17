#!/usr/bin/env python3
"""74.7 - the Ask SideCut drawer was invisible, so the button looked dead.

The owner: "the ai button literally doesn't do anything ... only the keyboard randomly
open[s] up".

That is exactly what the shipped 74.6 page does. The drawer is built out of the studio's
sheet component (`.sc-sheet`), which STARTS hidden - `opacity: 0; transform: translateY(14px)`
- and is revealed by `.sc-sheet-backdrop.in .sc-sheet`. Ask SideCut's backdrop is
`#scAiBackdrop`, not `.sc-sheet-backdrop`, so that rule never matched: the drawer was
appended, given the `in` class, and its input focused (the keyboard came up) while the sheet
itself stayed fully transparent at 86vh of the screen. The screen looked unchanged.

Proven on the shipped 74.6 bundle in jsdom, which resolves the cascade:
`getComputedStyle(#scAiSheet).opacity === "0"` with the backdrop `in`. After this patch it is
"1". `dev/ai-button-check.cjs` now reads that computed opacity, so a drawer nobody can see
is a red, not a pass.

    python3 dev/patch-747-ask-visible.py           # apply
    python3 dev/patch-747-ask-visible.py --check   # does the page carry it?
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"

OLD = "#scAiBackdrop.in{ display:flex; }\n"

NEW = """#scAiBackdrop.in{ display:flex; }
/* 74.7 - the sheet is a `.sc-sheet`, and that component starts at opacity 0; the rule that
   reveals it is keyed on `.sc-sheet-backdrop.in`, which this drawer's backdrop is not. So
   the drawer opened, focused its input (the keyboard came up) and stayed invisible. */
#scAiBackdrop.in .sc-sheet{ transform: translateY(0); opacity: 1; }
"""

CHECK = "--check" in sys.argv
src = PAGE.read_text(encoding="utf-8")

if CHECK:
    ok = NEW in src and src.count("#scAiBackdrop.in .sc-sheet{") == 1
    print(("  ok   " if ok else "  MISSING ") + "the drawer's sheet is revealed by its own backdrop")
    if not ok:
        print("patch-747-ask-visible: CHECK FAILED")
        sys.exit(1)
    print("patch-747-ask-visible: CHECK OK")
    sys.exit(0)

if NEW in src:
    print("patch-747-ask-visible: already applied")
    sys.exit(0)
n = src.count(OLD)
if n != 1:
    raise SystemExit("the Ask backdrop anchor was found %d times" % n)
PAGE.write_text(src.replace(OLD, NEW, 1), encoding="utf-8")
print("patch-747-ask-visible: applied 1 edit - the drawer now fades in")
