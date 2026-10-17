#!/usr/bin/env python3
"""74.8 - listening time did not move while the music played out of sight.

The owner: "the listening stats aren't working ... it doesn't go up in time when I'm
listening outside of the app or with headphones like it should".

TWO THINGS STOOD IN THE WAY, and both are in this file:

  1. The counter itself began `if(document.hidden) return;` - a deliberate "don't count
     time when app is backgrounded" that is exactly backwards for a music player. With
     the screen off, or while an audiobook/other app was in front, the seconds were
     dropped.
  2. The battery saver at the top of the page clears EVERY interval over 500 ms while
     `document.hidden`, and its own comment lists the "listening counter" among them -
     so even without the guard the one-second tick was stopped, and every second it
     would have counted was lost with it.

The clock is now the playhead and the wall clock: each tick banks the seconds the audio
actually moved, bounded by real time passed (a seek forward is not listening; a seek
back is not a debt), and it is marked keep-alive so the saver leaves it running. Ticks
that never happened - a frozen WebView - are recovered by the next one, because the
math is elapsed time rather than a count of ticks. The final partial second is banked
when the app hides, when the page goes away and when the sound stops.

    python3 dev/patch-748-listen.py           # apply
    python3 dev/patch-748-listen.py --check   # does the page carry it?
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"

KEEP_OLD = """  function pauseAll(){
    killTimers.forEach(function(t){
      if(t.alive){ _origCI.call(window, t.id); t.alive = false; }
    });
  }
"""

KEEP_NEW = """  // 74.8 - A TIMER THAT MUST KEEP RUNNING IN THE BACKGROUND CAN SAY SO.
  // The listening clock is one: it is how a song heard with the screen off gets
  // counted at all, and the platform only throttles it, never stops it. Everything
  // else still stops with the app, which is what this saver is for.
  window.__scKeepAliveTimer = function(id){
    killTimers.forEach(function(t){ if(t.id === id) t.keep = true; });
  };
  function pauseAll(){
    killTimers.forEach(function(t){
      if(t.alive && !t.keep){ _origCI.call(window, t.id); t.alive = false; }
    });
  }
"""

CLOCK_START = "  let _lastListenPos = -1;\n  setInterval(() => {\n"
CLOCK_END = "  }, 1000);\n"

CLOCK_NEW = """  // 74.8 - THE LISTENING CLOCK FOLLOWS THE AUDIO, NOT THE APP WINDOW.
  // It used to add one second per tick and to refuse to count at all while
  // `document.hidden`; the battery saver above ALSO stops every interval over 500 ms
  // while hidden, so music heard with the screen off - the way music is normally
  // heard - was worth nothing. The clock is now the playhead against the wall clock:
  // every tick banks the seconds the audio actually moved, never more than real time
  // passed (a seek forward is not listening, a seek back is not a debt), and a span
  // the page was frozen through is recovered by the next tick instead of lost.
  let _listenPos = -1, _listenAt = 0, _listenFrac = 0, _listenSaved = 0;
  function scSaveListen(force){
    try{
      if(!force && totalListenSeconds - _listenSaved < 30) return;
      _listenSaved = totalListenSeconds;
      dbPut('meta', { key: 'stats', value: { totalListenSeconds, totalPlays } });
    }catch(_eSave){}
  }
  function scListenTick(){
    try{
      // The tick that measures listening time also decides whether the song has been
      // heard past its halfway point - one check, no extra timer. It runs in the
      // background too, so a song played from the lock screen counts a play.
      checkPendingPlay();
      const a = activeAudio();
      if(a && !a.paused && !a.ended && (a.src || a.currentSrc)){
        const now = Date.now();
        const pos = a.currentTime || 0;
        if(_listenPos < 0){ _listenPos = pos; _listenAt = now; return; }
        const moved = pos - _listenPos;
        const passed = Math.max(0, (now - _listenAt) / 1000);
        _listenFrac += Math.max(0, Math.min(moved, passed + 0.5));
        _listenPos = pos;
        _listenAt = now;
        if(_listenFrac >= 1){
          const whole = Math.floor(_listenFrac);
          _listenFrac -= whole;
          totalListenSeconds += whole;
          scSaveListen(false);
        }
      } else {
        _listenPos = -1;
        _listenAt = 0;
      }
    }catch(_e){}
  }
  const scListenTimer = setInterval(scListenTick, 1000);
  try{ if(window.__scKeepAliveTimer) window.__scKeepAliveTimer(scListenTimer); }catch(_eKA){}
  window.__scListenTick = scListenTick;
  window.__scListenSeconds = function(){ return totalListenSeconds + _listenFrac; };
  // Bank the last partial second where it can still be banked: when the app is about
  // to hide, when the page is going away, and when the sound stops.
  document.addEventListener('visibilitychange', function(){ scListenTick(); scSaveListen(true); });
  window.addEventListener('pagehide', function(){ scListenTick(); scSaveListen(true); });
  try{
    audios.forEach(function(a){
      a.addEventListener('pause', function(){ scListenTick(); scSaveListen(true); });
      a.addEventListener('ended', function(){ scListenTick(); scSaveListen(true); });
    });
  }catch(_eAudio){}
"""

CHECK = "--check" in sys.argv
src = PAGE.read_text(encoding="utf-8")

if CHECK:
    bad = 0
    checks = [
        ("the clock is a named, drivable tick", "window.__scListenTick = scListenTick;" in src),
        ("it no longer refuses to count while hidden", "if(document.hidden) return; // Don't count time" not in src),
        ("its timer is exempt from the battery saver", "window.__scKeepAliveTimer(scListenTimer)" in src),
        ("and the saver honours that exemption", "if(t.alive && !t.keep)" in src),
        ("elapsed time, not ticks", "_listenFrac += Math.max(0, Math.min(moved, passed + 0.5));" in src),
        ("the partial second is banked on hide and pagehide", "scSaveListen(true); });" in src),
    ]
    for label, ok in checks:
        print(("  ok   " if ok else "  MISSING ") + label)
        bad += 0 if ok else 1
    if bad:
        print("patch-748-listen: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-748-listen: CHECK OK")
    sys.exit(0)

if "window.__scListenTick = scListenTick;" in src:
    print("patch-748-listen: already applied")
    sys.exit(0)

if src.count(KEEP_OLD) != 1:
    raise SystemExit("pauseAll anchor found %d times" % src.count(KEEP_OLD))
src = src.replace(KEEP_OLD, KEEP_NEW, 1)

i = src.index(CLOCK_START)
j = src.index(CLOCK_END, i) + len(CLOCK_END)
old_block = src[i:j]
if "if(document.hidden) return; // Don't count time" not in old_block:
    raise SystemExit("the clock block does not look like the one this patch replaces")
src = src[:i] + CLOCK_NEW + src[j:]

PAGE.write_text(src, encoding="utf-8")
print("patch-748-listen: applied 2 edits - the clock follows the audio in the background")
