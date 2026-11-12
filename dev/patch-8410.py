#!/usr/bin/env python3
"""SideCut 84.1.0 - the Mix Pad belongs to Studio, and on a phone it is a desk.

The Mix Pad was offered twice: a card in Studio, and a MIX PAD button in the row
under the player next to DJ MODE. That row is the listening screen - you are on it
to play a song, not to open a mixing desk - so the button is gone and Studio is the
only way in.

The window itself was a bottom sheet: 82vh, a honking paragraph under the title,
44px lanes, and 9px buttons with 3px of padding, which is a desk you cannot touch
on a phone. On a phone it is now the whole screen: the title row and the transport
stay pinned at the top while the timeline scrolls under them, Close stays pinned at
the bottom, the lanes are 58px, every button is at least 32px tall and the sliders
have real thumbs. The desktop window is unchanged apart from the same larger
buttons.

    python3 dev/patch-8410.py            # apply
    python3 dev/patch-8410.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")

V = "84.1.0"
OLD = "84.0.0"

ENTRY = """      { version: '84.1.0', date: 'November 12, 2026', title: 'Mix Pad: one door, and a desk you can actually touch', items: [
    'The MIX PAD button under the player is gone. It sat next to DJ MODE on the listening screen, which is where you are to play a song, so the Mix Pad is opened from Studio and nowhere else - one door, and the place the rest of the tools live.',
    'On a phone the Mix Pad is the whole screen now instead of a sheet that covered most of it. The title row and PLAY / STOP / REC / EXPORT stay pinned at the top while the timeline scrolls underneath, and Close stays pinned at the bottom, so the transport is never something you have to scroll back to find.',
    'Every control is a finger wide: the small buttons are at least 32 pixels tall, the volume and pan sliders have real thumbs, and the four lanes are 58 pixels instead of 44 so a waveform and its crop handles are readable and a clip can be dragged without hitting the wrong thing.',
    'The four lines of instructions under the title are gone from the phone layout. They were taking a third of the screen to explain a timeline that is now big enough to show it.'
  ] },
"""

ANCHOR = """      { version: '84.0.0', date: 'November 12, 2026', title: 'Mix Pad: free placement, and clips you can lay on top of each other', items: [
"""

BUTTON = """    <button id="mixPadBtn" title="Mix Pad" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:10px; padding:2px 9px; font-size:9.5px; font-family:'JetBrains Mono',monospace; letter-spacing:1px; cursor:pointer;">MIX PAD</button>\n"""

CSS_ANCHOR = ".mp-hint{ font-size:10.5px; line-height:1.45; color:var(--ink-dim); margin-top:10px; }\n"

CSS_NEW = """
/* 84.1.0 - the Mix Pad is Studio's room, and on a phone it is a desk rather than a
   sheet. The transport and the title stay put at the top of the screen while the
   timeline scrolls under them; Close stays put at the bottom; everything you touch
   is at least 32px. The desktop window is only slightly changed: bigger buttons and
   taller lanes, no layout surgery. */
.mp-mini{ min-height:26px; padding:5px 9px; font-size:9.5px; }
.mp-t-knobs input[type=range]{ height:22px; }
.mp-lane{ height:52px; }
#mixPadBackdrop .deck-btn{ min-height:32px; }
@media (max-width:760px){
  #mixPadBackdrop{ align-items:stretch; justify-content:stretch; }
  #mixPadBackdrop .mp-modal{
    width:100%; max-width:none; height:100dvh; max-height:100dvh;
    border-radius:0; border-top:0; margin:0;
    padding:0 12px calc(8px + env(safe-area-inset-bottom));
    gap:10px;
  }
  .mp-head{
    position:sticky; top:0; z-index:5; background:var(--bg-raised);
    margin:0 -12px; padding:10px 12px 6px;
  }
  .mp-sub{ display:none; }
  .mp-transport{
    position:sticky; top:52px; z-index:5; background:var(--bg-raised);
    margin:0 -12px; padding:6px 12px 8px;
    border-bottom:1px solid var(--line);
  }
  #mixPadBackdrop .modal-btns{
    position:sticky; bottom:0; z-index:5; background:var(--bg-raised);
    margin:0 -12px; padding:8px 12px calc(4px + env(safe-area-inset-bottom));
  }
  .mp-mini{ min-height:32px; padding:6px 10px; }
  .mp-lane{ height:58px; }
  .mp-t-knobs input[type=range]{ height:28px; }
  #mixPadBackdrop .deck-btn{ min-height:36px; padding:0 12px; }
  .mp-hint{ display:none; }
  .mp-tracks{ gap:10px; }
}
"""


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8410: %s appears %d times, expected exactly 1" % (what, n))
    return text


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and 'id="mixPadBtn"' not in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the 84.0.0 changelog entry")
    once(page, BUTTON, "the MIX PAD button under the player")
    once(page, CSS_ANCHOR, "the end of the 83.6.0 mix pad stylesheet")
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(BUTTON, "", 1)
    out = out.replace(CSS_ANCHOR, CSS_ANCHOR + CSS_NEW, 1)
    return out


NOTES = [
    "The MIX PAD button under the player is gone. It sat next to DJ MODE on the listening screen, which is where you are to play a song, so the Mix Pad is opened from Studio and nowhere else - one door, and the place the rest of the tools live.",
    "On a phone the Mix Pad is the whole screen now instead of a sheet that covered most of it. The title row and PLAY / STOP / REC / EXPORT stay pinned at the top while the timeline scrolls underneath, and Close stays pinned at the bottom, so the transport is never something you have to scroll back to find.",
    "Every control is a finger wide: the small buttons are at least 32 pixels tall, the volume and pan sliders have real thumbs, and the four lanes are 58 pixels instead of 44 so a waveform and its crop handles are readable and a clip can be dragged without hitting the wrong thing.",
    "The four lines of instructions under the title are gone from the phone layout. They were taking a third of the screen to explain a timeline that is now big enough to show it.",
]


def updates_json(current):
    raw = io.open(UPDATES, encoding="utf-8").read()
    data = json.loads(raw)
    if data.get("version") == V:
        return raw
    data["version"] = V
    data["notes"] = NOTES
    data["date"] = "November 12, 2026"
    out = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    if raw.endswith("\n"):
        out += "\n"
    return out


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    out = patched(page)
    sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V)
    upd_new = updates_json(page)
    if out == page and sw_new == sw and upd_new == io.open(UPDATES, encoding="utf-8").read():
        print("already on the page")
        return 0
    if check:
        print("not applied yet")
        return 1
    once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    io.open(UPDATES, "w", encoding="utf-8").write(upd_new)
    print("page at %s, cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
