#!/usr/bin/env python3
"""SideCut 83.3.0 - the press wakes the mixer, and a failed press says why.

A deck song's sound leaves through the Web Audio graph, and an element inside a graph
sends its audio there and nowhere else - so an AudioContext the phone has put to sleep
turns a healthy play() into silence. The press now wakes the mixer first, a parked song
keeps it awake, and a press that still cannot make sound says why, on screen and in the
Settings -> Widget trail.

    python3 dev/patch-8330.py            # apply
    python3 dev/patch-8330.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")

V = "83.3.0"
OLD = "83.2.9"

ENTRY = """      { version: '%s', date: 'November 11, 2026', title: 'The headphones wake the sound again', items: [
    'Pressing play on the earbuds after a pause wakes the audio mixer before it starts the song. The sound of a song leaves through that mixer, and a mixer the phone had put to sleep could turn a good press into silence.',
    'A paused song keeps that mixer awake while it waits on the deck, so a press that arrives twenty minutes later finds it ready.',
    'A press that still cannot start the song says so - one short line on screen, and the same line kept in Settings, Widget - instead of the app doing nothing.'
  ] },
""" % V

ANCHOR = ("      { version: '%s', date: 'November 11, 2026', "
          "title: 'The headphones get the player back', items: [\n" % OLD)

PRESS_OLD = """  function scTransportPress(){
    try{ scTransportResume(); }catch(_eTpResume){}
"""
PRESS_NEW = """  function scTransportPress(){
    try{ scTransportResume(); }catch(_eTpResume){}
    // 83.3.0 - and the mixer, before anything is asked to play through it.
    try{ scAudioCtxAwake(); }catch(_eTpCtx){}
"""

FUNCS_ANCHOR = "  function registerMediaSessionHandlers(){\n"

DRIVE = os.path.join(ROOT, "dev", "8330-drive.js.txt")
FUNCS = ""

PLAY_OLD = """    mediaSetActionHandler('play', () => {
      try{ scTransportPress(); }catch(e){}
      if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
      const _pa = activeAudio();
      if(!_pa) return;
"""
PLAY_NEW = """    mediaSetActionHandler('play', () => {
      // 83.3.0 - one door: wake the mixer, start the song, say what happened.
      if(scTransportPlay('the headphones or the lock screen')) return;
      try{ scTransportPress(); }catch(e){}
      const _pa = activeAudio();
      if(!_pa) return;
"""

PARK_OLD = """        if(!mediaParkedInBackground){ stopParkedBeat(); return; }
"""
PARK_NEW = """        if(!mediaParkedInBackground){ stopParkedBeat(); return; }
        // 83.3.0 - a paused song still needs a live mixer for the press that resumes it.
        try{ scAudioCtxAwake(); }catch(_ePkCtx){}
"""


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8330: %s appears %d times, expected exactly 1" % (what, n))
    return text


def drive_text():
    if not os.path.exists(DRIVE):
        raise SystemExit("patch-8330: missing dev/8330-drive.js.txt")
    return io.open(DRIVE, encoding="utf-8").read()


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and "scTransportPlay" in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the %s changelog entry" % OLD)
    once(page, PRESS_OLD, "scTransportPress")
    once(page, FUNCS_ANCHOR, "registerMediaSessionHandlers")
    once(page, PLAY_OLD, "the deck's play handler")
    once(page, PARK_OLD, "the parked beat")
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(PRESS_OLD, PRESS_NEW, 1)
    out = out.replace(FUNCS_ANCHOR, drive_text() + FUNCS_ANCHOR, 1)
    out = out.replace(PLAY_OLD, PLAY_NEW, 1)
    out = out.replace(PARK_OLD, PARK_NEW, 1)
    return out


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    out = patched(page)
    sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V)
    if out == page and sw_new == sw:
        print("already on the page")
        return 0
    if check:
        print("not applied yet")
        return 1
    once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    print("page at %s, cache at sidecut-shell-v%s" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
