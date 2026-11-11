#!/usr/bin/env python3
"""SideCut 83.2.9 - the headphones get the player back.

Two halves, one report: a pause from the earbuds is not followed by a play.

  THE NATIVE HALF is dev/native-session.py (run by android-build.yml): the player that
  survives the recents swipe (dev/native-play-service.java.txt, 83.2.0) had no
  MediaSession, so the phone had no player to route a pause or a play to. It now
  answers the earbuds, the lock screen and the shade itself, and its card carries one
  button that plays or pauses to match. That needs the newest sideloaded build.

  THE PAGE HALF is here. A press on a streamed song only started the element: it did
  not clear the deliberate-pause mark, cancel the sleep clock, restart the keep-alive
  or re-arm the session - everything a press on a downloaded song already does. After
  ten minutes away that press landed on a player that had stopped listening. It now
  goes through the same door as the deck's press.

--check says whether the tree ALREADY carries the page change, which is what the
release asks before deciding there is nothing to do.

    python3 dev/patch-8329.py            # apply
    python3 dev/patch-8329.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")

V = "83.2.9"
OLD = "83.2.8"

ENTRY = """      { version: '%s', date: 'November 11, 2026', title: 'The headphones get the player back', items: [
    'Pressing play on your earbuds after a pause starts the music again, including the player that keeps going with the app swiped away: it answers the earbud, lock-screen and shade buttons itself instead of leaving them to a session that went with the swipe.',
    'That player shows itself properly now: the song and artist on the shade and the lock screen, and one button that pauses or plays to match what it is doing, so a pause no longer leaves a card with no way back.',
    'A press on a streamed song now does everything a press on a downloaded one does - it ends the deliberate pause, cancels the clock that parks the session, restarts the keep-alive and re-arms the controls - instead of only starting the element.',
    'The listening half is in the page, so it arrives on its own. The player itself comes with the newest sideloaded Android build.'
  ] },
""" % V

ANCHOR = ("      { version: '83.2.8', date: 'November 10, 2026', "
          "title: 'The example comes out', silent: true, items: [] },\n")

STREAM_OLD = """      mediaSetActionHandler('play', function(){
        var a = el();
        if(!a) return;
        // 81.6 - THE PRESS IS THE REQUEST. The deck's handlers cleared the deliberate
        // pause mark and the stream's did not, so a source paused from the headphones
        // kept saying "the owner paused this on purpose" for as long as it stayed up.
        scStreamState.userPaused = false;
        if(!a.src && scStreamState.curId){ scStreamPlay(scStreamState.curId); return; }
        if(a.paused){ Promise.resolve(a.play()).catch(function(){}); }
      });
"""

STREAM_NEW = """      mediaSetActionHandler('play', function(){
        var a = el();
        if(!a) return;
        // 81.6 - THE PRESS IS THE REQUEST. The deck's handlers cleared the deliberate
        // pause mark and the stream's did not, so a source paused from the headphones
        // kept saying "the owner paused this on purpose" for as long as it stayed up.
        scStreamState.userPaused = false;
        // 83.2.9 - AND IT ASKS FOR THE WHOLE PLAYER BACK, the way the deck's press does.
        // This started the element and nothing else: the sleep clock that parks a
        // session ten minutes into a pause stayed armed, the heartbeat stayed stopped
        // and the controls stayed un-armed, so a press that arrived later landed on a
        // player that had stopped listening. scTransportPress() is that same door.
        try{ scTransportPress(); }catch(_eSpPress){}
        if(!a.src && scStreamState.curId){ scStreamPlay(scStreamState.curId); return; }
        if(a.paused){ Promise.resolve(a.play()).catch(function(){}); }
      });
"""


def read(path):
    return io.open(path, encoding="utf-8").read()


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-%s: %s appears %d times, expected exactly 1" % (V.replace('.', ''), what, n))
    return text


def patched(page):
    # Already this release: the release asks --check after applying, and a second
    # dispatch for the same version must find nothing to do rather than fail.
    if ("const APP_VERSION = '%s';" % V) in page and "The headphones get the player back" in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the %s changelog entry" % OLD)
    once(page, STREAM_OLD, "the stream's play handler")
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(STREAM_OLD, STREAM_NEW, 1)
    return out


def main():
    check = "--check" in sys.argv
    page = read(PAGE)
    sw = read(SW)
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
