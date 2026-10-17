#!/usr/bin/env python3
"""74.6 - the Ask button on the multi-select bar, which did nothing at all.

The owner: "the ai button doesn't do anything".

Two sparkles open Ask SideCut: #homeAiBtn in the Home header and #selectAskBtn on
the bar that appears once songs are ticked. The drawer wired BOTH of them once,
at startup, with getElementById(...).addEventListener. The header is static, so
that button kept its listener. The multi-select bar is not: renderPane() rebuilds
it from innerHTML every time the selection changes, so the element the listener
was attached to was thrown away the first time the bar was drawn. From then on
the sparkle on the bar - the one whose whole point is "these songs" - was a
button with no handler. Pressing it did nothing, on the shipped 74.5 bundle,
while the Home one worked.

This script replaces that one-time wiring with ONE delegated listener on the
document, which no re-render can strand. It runs in the capture phase and stops
the click there, so the drawer opens on the tap that asked for it and the page's
own click plumbing does not run underneath it.

    python3 dev/patch-746-ask.py           # apply
    python3 dev/patch-746-ask.py --check   # does the page carry it?
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"

OLD = """      var hb = document.getElementById('homeAiBtn');
      if(hb) hb.addEventListener('click', open);
      var sb = document.getElementById('selectAskBtn');
      if(sb) sb.addEventListener('click', open);
"""

NEW = """      // ONE delegated listener, not one per button: the multi-select bar is rebuilt
      // from innerHTML on every selection change (renderPane), so a listener put on
      // the #selectAskBtn that existed at startup died with that element and the
      // sparkle on the bar did nothing at all. The document cannot be re-rendered.
      var askHit = function(el){
        while(el && el !== document){
          if(el.id === 'homeAiBtn' || el.id === 'selectAskBtn') return el;
          el = el.parentNode;
        }
        return null;
      };
      document.addEventListener('click', function(e){
        var hit = askHit(e.target);
        if(!hit || hit.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        open();
      }, true);
"""

CHECK = "--check" in sys.argv
src = PAGE.read_text(encoding="utf-8")

if CHECK:
    bad = 0
    for label, ok in [
        ("the delegated Ask listener is in the page", NEW in src),
        ("the startup per-button wiring is gone", OLD not in src),
    ]:
        print(("  ok   " if ok else "  MISSING ") + label)
        bad += 0 if ok else 1
    if bad:
        print("patch-746-ask: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-746-ask: CHECK OK")
    sys.exit(0)

if NEW in src and OLD not in src:
    print("patch-746-ask: already applied")
    sys.exit(0)
n = src.count(OLD)
if n != 1:
    raise SystemExit("the startup wiring anchor was found %d times" % n)
PAGE.write_text(src.replace(OLD, NEW), encoding="utf-8")
print("patch-746-ask: applied 1 edit - the Ask buttons are delegated now")
