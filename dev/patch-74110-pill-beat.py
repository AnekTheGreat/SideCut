#!/usr/bin/env python3
"""
74.1.10 (workspace) - the pill drag, the beat pads and the two badges that could
never be earned.

The owner, twice, in the same words:

    "make the pill like drag and move nicer it should feel really smooth and nice
     and easy to use especially the diagonal slant that especially and when I'm
     dragging it and releasing the pill it should be nice and make the badges
     actually rechable and the loops 1/8 and stuff actually need to work."

THREE CHANGES.

1. THE DRAG. Four faults, each one felt at the finger:

   * the seam. The tabs sit 6px apart, so a finger dragged across the dock passed
     over six pixels of "nothing" several times a second. Nothing there meant the
     highlight threw itself back to the lit tab and forward again on every seam -
     a flicker at exactly the moment the dock was being slid. A seam between two
     pills now answers for the nearer one. Only between two: past the last pill is
     the plus, and the plus is not a place to be.
   * the release. A slide that ended a few pixels below the dock opened nothing,
     although the highlight was still sitting on the tab it was going to take. The
     highlight is the promise now: whatever it shows when the finger comes up is
     what the slide takes. A drag that really left the dock already put the
     highlight back, so that still cancels.
   * the diagonal. The highlight wore one triangle or the other, so the slant only
     existed for the instant it changed sides. The divider is drawn now, from the
     pill's own box - the same line the hit test uses, placed by the same code -
     so the split reads as a slant you can see rather than a flicker.
   * the crossing. A short tick when the finger crosses into another tab, one per
     crossing rather than one per pointermove, the way the rest of this app marks
     a boundary. A mouse does not buzz.

2. THE 1/8 PAD. The slice was armed and then disarmed by the same gesture: a tap -
   which is how a pad is pressed on a phone - held it for about 50ms and then let
   go, so it made a buzz or nothing at all. And it was armed at the playhead, which
   is an arbitrary instant of the song, so even a held pad was a click against no
   beat. Now:

   * a TAP latches: the slice keeps repeating and the pad stays lit; tapping the
     lit pad stops it and says so. A HOLD still loops for as long as the finger is
     down, which is the gesture the badge's own text describes.
   * a pad's slice is placed ON the grid - floored to its own length in beats,
     never forward - so 1/8 repeats an eighth note instead of whatever 62ms of
     audio the playhead was sitting on.
   * a pad over an empty deck says which of the two it is instead of doing nothing
     in silence.

3. THE BADGE THAT COULD NOT BE EARNED THE WAY IT READS. "Beat repeat" - "Hold a
   beat repeat" - was credited by turning LOOP LOCK on. Holding a pad could never
   earn the badge that describes holding a pad. The pad credits it now, and the lock
   no longer does.

   The other badge that looked unreachable from the outside - "Every preset", six
   Studios presets - is reached, and this patch does NOT touch it: setFx already
   counts DISTINCT presets through seenPreset(), by writing counters.presets rather
   than calling bump(). A grep for bump('presets') said otherwise, which is exactly
   why the new check drives the sheet instead of reading the file.

Every edit is one exact replacement, applied at most once, and the script is its own
check: --check reports whether every edit is already in place.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / 'index.html'

EDITS = []


def edit(name, old, new):
    EDITS.append((name, old, new))


# ---------------------------------------------------------------- 1. the drag --
edit('css: the seam is a third drawn piece',
     "#scDockPillTrack, #scDockPillThumb{ display: none; position: absolute; left: 0; top: 0; z-index: -1; pointer-events: none; box-sizing: border-box; }",
     "#scDockPillTrack, #scDockPillThumb, #scDockSeam{ display: none; position: absolute; left: 0; top: 0; z-index: -1; pointer-events: none; box-sizing: border-box; }")

edit('css: the lift under the finger, and the divider drawn',
     "body.sc-dock-pill.sc-dock-dragging #scDockPillThumb{ transition: none; }",
     """body.sc-dock-pill.sc-dock-dragging #scDockPillThumb{
  transition: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.42);
}
/* THE DIVIDER, DRAWN. The split Library tab is two triangles and the highlight
   wears whichever one the finger is in, so without a line the diagonal exists only
   for the instant it changes sides - which reads as a flicker, not a slant. This is
   the same line the hit test uses, placed from the pill's own box by the dock's
   code (its centre, one pixel long enough to reach both corners), so the slant that
   is drawn and the region that is lit cannot disagree. */
body.sc-dock-pill #scDockSeam{
  display: block;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ink) 30%, transparent) 18%, color-mix(in srgb, var(--ink) 30%, transparent) 82%, transparent);
  transform-origin: 50% 50%;
}""")

edit('js: the seam element',
     """    var track = $('scDockPillTrack'), thumb = $('scDockPillThumb');
    if(!track){
      track = document.createElement('div');
      track.id = 'scDockPillTrack';
      thumb = document.createElement('div');
      thumb.id = 'scDockPillThumb';
      strip.insertBefore(thumb, strip.firstChild);
      strip.insertBefore(track, strip.firstChild);
    }
    return { strip: strip, track: track, thumb: thumb };""",
     """    var track = $('scDockPillTrack'), thumb = $('scDockPillThumb'), seam = $('scDockSeam');
    if(!track){
      track = document.createElement('div');
      track.id = 'scDockPillTrack';
      thumb = document.createElement('div');
      thumb.id = 'scDockPillThumb';
      strip.insertBefore(thumb, strip.firstChild);
      strip.insertBefore(track, strip.firstChild);
    }
    // After the highlight in the markup, so the divider sits ON the lit region
    // rather than behind it: a cut you cannot see is not a cut.
    if(!seam){
      seam = document.createElement('div');
      seam.id = 'scDockSeam';
      strip.insertBefore(seam, thumb.nextSibling);
    }
    return { strip: strip, track: track, thumb: thumb, seam: seam };""")

edit('js: a point in a seam belongs to the nearer pill',
     """  function scDockPillAt(x, y){
    var rects = scDockPillRects.length ? scDockPillRects : scDockPillMeasure();
    for(var i = 0; i < rects.length; i++){
      var r = rects[i];
      if(r.width && r.height && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
        return scDockPillHalf(r.el, x, y);
      }
    }
    return null;
  }""",
     """  // A POINT IN A SEAM BELONGS TO THE NEARER PILL. The tabs sit a few pixels apart,
  // so a finger dragged across the dock passes over six pixels of nothing several
  // times a second - and "nothing" threw the highlight back to the lit tab and
  // forward again on every seam, a flicker at exactly the moment the dock was being
  // slid. A seam is inside the capsule, so it answers for the pill beside it; only
  // BETWEEN two pills, never past the first or the last, because past the last one
  // is the plus and the plus is not a landing place. The slack up and down is the
  // same idea for a release that drifts a few pixels off the dock's edge.
  var SC_DOCK_SEAM_SLACK = 10;
  function scDockPillSeam(x, y){
    var rects = scDockPillRects.length ? scDockPillRects : scDockPillMeasure();
    for(var i = 0; i + 1 < rects.length; i++){
      var a = rects[i], b = rects[i + 1];
      if(!a.width || !b.width) continue;
      if(x <= a.right || x >= b.left) continue;
      var top = Math.min(a.top, b.top), bottom = Math.max(a.bottom, b.bottom);
      if(y < top - SC_DOCK_SEAM_SLACK || y > bottom + SC_DOCK_SEAM_SLACK) continue;
      var seg = (x - a.right) < (b.left - x) ? a : b;
      var cx = Math.max(seg.left, Math.min(seg.right, x));
      var cy = Math.max(seg.top, Math.min(seg.bottom, y));
      return scDockPillHalf(seg.el, cx, cy);
    }
    return null;
  }
  function scDockPillAt(x, y){
    var rects = scDockPillRects.length ? scDockPillRects : scDockPillMeasure();
    for(var i = 0; i < rects.length; i++){
      var r = rects[i];
      if(r.width && r.height && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
        return scDockPillHalf(r.el, x, y);
      }
    }
    // ...and the same slack up and down: a finger that comes up four pixels below
    // the bar is still on the tab the highlight was showing, not in nowhere.
    for(var j = 0; j < rects.length; j++){
      var q = rects[j];
      if(!q.width || !q.height) continue;
      if(x < q.left || x > q.right) continue;
      if(y < q.top - SC_DOCK_SEAM_SLACK || y > q.bottom + SC_DOCK_SEAM_SLACK) continue;
      return scDockPillHalf(q.el, x, Math.max(q.top, Math.min(q.bottom, y)));
    }
    return scDockPillSeam(x, y);
  }""")

edit('js: the divider placed from the split tab its own box',
     """      e.thumb.style.clipPath = b.half ? scDockDividerPoly(b) : '';""",
     """      e.thumb.style.clipPath = b.half ? scDockDividerPoly(b) : '';
      // The divider, on the split tab's own box: corner to corner, so its length is
      // that box's diagonal and its angle is that diagonal's. Five pixels are taken
      // off each end so the line sits inside the capsule's curve.
      if(e.seam){
        var lib = $('libraryBtn');
        if(lib && lib.parentNode === e.strip){
          var lr = lib.getBoundingClientRect();
          if(lr.width && lr.height){
            var len = Math.sqrt(lr.width * lr.width + lr.height * lr.height);
            var ang = Math.atan2(lr.height, lr.width) * 180 / Math.PI;
            e.seam.style.display = '';
            e.seam.style.width = Math.max(0, len - 10) + 'px';
            e.seam.style.left = (lr.left - sr.left + lr.width / 2) + 'px';
            e.seam.style.top = (lr.top - sr.top + lr.height / 2) + 'px';
            e.seam.style.transform = 'translate(-50%, -50%) rotate(' + (180 - ang).toFixed(2) + 'deg)';
          } else {
            e.seam.style.display = 'none';
          }
        } else if(e.seam) {
          e.seam.style.display = 'none';
        }
      }""")

edit('js: a tick when the finger crosses into another tab',
     """      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(t !== scDockPillHotEl){
        scDockPillHotEl = t;
        scDockPillMark(t);
        scDockPillSync();
      }
    }
    function onDrop(ev){""",
     """      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(t !== scDockPillHotEl){
        // One tick per CROSSING, not one per pointermove: the finger has moved from
        // one tab to the next, and the phone says so the way the rest of this app
        // marks a boundary. A mouse does not buzz - it is already previewing.
        if(t && scDockPillHotEl && ev.pointerType && ev.pointerType !== 'mouse'){
          try{ if(navigator.vibrate) navigator.vibrate(5); }catch(_eDockTick){}
        }
        scDockPillHotEl = t;
        scDockPillMark(t);
        scDockPillSync();
      }
    }
    function onDrop(ev){""")

edit('js: the release takes what the highlight is showing',
     """      var landed = scDockPillAt(ev.clientX, ev.clientY);
      var up = (slid && landed) ? landed : down;""",
     """      var landed = scDockPillAt(ev.clientX, ev.clientY);
      // THE HIGHLIGHT IS THE PROMISE. A slide that ended a few pixels below the dock
      // used to open nothing at all, while the highlight was still sitting on the
      // tab it looked like it was going to take. Whatever the highlight shows when
      // the finger comes up is what the slide takes; a drag that really left the
      // dock already put the highlight back on the lit tab, so that still cancels.
      var up = slid ? (landed || scDockPillHotEl || down) : down;""")

# ------------------------------------------------------------ 2. the beat pads --
edit('js: a pad slice is placed on the beat grid',
     """  function armDeckLoop(len){
    const dur = (deckEngine.buffer && deckEngine.buffer.duration) || 0;
    if(!dur || !(len > 0)) return false;
    const span = Math.min(len, dur);
    const start = Math.max(0, Math.min(deckNow(), dur - span));""",
     """  function armDeckLoop(len, beats){
    const dur = (deckEngine.buffer && deckEngine.buffer.duration) || 0;
    if(!dur || !(len > 0)) return false;
    const span = Math.min(len, dur);
    // A PAD'S SLICE IS MEASURED IN BEATS, so it is placed on the grid rather than at
    // whatever instant the playhead happened to be sitting on. A 1/8 slice armed at
    // an arbitrary point is a buzz against nothing; the same slice starting on the
    // eighth note it belongs to is a stutter you can play with. Floored, never
    // rounded up: a repeat must never jump forward, and at most it starts one slice
    // early - 62ms, for the 1/8 pad.
    let at = deckNow();
    if(beats > 0) at = Math.floor(at / len) * len;
    const start = Math.max(0, Math.min(at, dur - span));""")

edit('js: a tap latches, and the pad credits its own badge',
     """  let beatRepeatActive = false;
  function beatLenToSeconds(beats){""",
     """  let beatRepeatActive = false;
  // A TAP LATCHES, A HOLD DOES NOT. Pressing a pad armed a slice and the release
  // disarmed it in the same gesture, so a tap - which is how a pad is pressed on a
  // phone - held it for about 50ms: a buzz, or nothing at all. Tapping now leaves the
  // slice repeating and the pad lit; tapping the lit pad stops it. Holding still
  // loops for as long as the finger is down, which is the gesture the pad's own text
  // describes.
  let beatRepeatLatched = false;
  let beatRepeatLatchedBeats = null;
  const SC_BEAT_TAP_MS = 220;   // under this is a tap, over it is a hold
  function beatLenToSeconds(beats){""")

edit('js: an armed pad slice is quantised to the beat',
     """    if(!armDeckLoop(beatLenToSeconds(beats))) return false;""",
     """    if(!armDeckLoop(beatLenToSeconds(beats), beats)) return false;""")

edit('js: letting go of the pad ends the latch with it',
     """  function stopBeatRepeat(){
    if(!beatRepeatActive) return;
    beatRepeatActive = false;""",
     """  function stopBeatRepeat(){
    beatRepeatLatched = false;
    beatRepeatLatchedBeats = null;
    if(!beatRepeatActive) return;
    beatRepeatActive = false;""")

edit('js: the badge the pad earns, and the pad that has nothing to say',
     """  let beatRepeatLocked = false;
  let beatRepeatLockedBeats = 0.5;""",
     """  // THE BADGE THE PAD EARNS. "Beat repeat" says "Hold a beat repeat", and the only
  // thing that can hold one is a pad - yet the badge was credited by turning LOOP
  // LOCK on, so holding a pad could never earn the badge that describes holding a
  // pad. The wall is scored by the Studio's own script block, so it is asked by the
  // name it publishes rather than reached across blocks.
  function scBeatRepeatCredit(){
    try{ if(window.SC70 && typeof SC70.bump === 'function') SC70.bump('beatRepeat', 1); }catch(_eBR){}
  }
  // A pad over an empty deck used to do nothing at all and say nothing, which reads
  // as a dead pad. It says which of the two it is.
  function scBeatPadSaysNothing(){
    toast(deckEngine.buffer ? 'That slice did not arm \\u00b7 try a shorter one'
                            : 'Nothing on the deck \\u00b7 load a song in DJ Mode first');
  }
  let beatRepeatLocked = false;
  let beatRepeatLockedBeats = 0.5;""")

edit('js: each pad remembers when it was pressed',
     """  document.querySelectorAll('.beat-pad').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {""",
     """  document.querySelectorAll('.beat-pad').forEach(btn => {
    let downAt = 0;
    btn.addEventListener('pointerdown', (e) => {""")

edit('js: pressing the lit pad is how a latched repeat stops',
     """      document.querySelectorAll('.beat-pad').forEach(b => b.classList.remove('active'));
      beatRepeatLockedBeats = parseFloat(btn.dataset.beats);
      // Light the pad only if a slice was actually armed - the old order lit it
      // first and asked questions later.
      if(startBeatRepeat(beatRepeatLockedBeats)) btn.classList.add('active');
    });""",
     """      const beats = parseFloat(btn.dataset.beats);
      // THE LIT PAD IS THE WAY OUT OF ITSELF: pressing it stops the slice now rather
      // than re-arming it for the length of a press, which is what made a latched
      // repeat impossible to switch off with the pad that started it.
      if(beatRepeatLatched && beatRepeatLatchedBeats === beats){
        beatRepeatLatched = false;
        beatRepeatLatchedBeats = null;
        downAt = 0;
        document.querySelectorAll('.beat-pad').forEach(b => b.classList.remove('active'));
        stopBeatRepeat();
        toast('Beat repeat off');
        return;
      }
      document.querySelectorAll('.beat-pad').forEach(b => b.classList.remove('active'));
      // A different pad takes the latch over: one repeat at a time, and the one it
      // replaces is no longer the lit pad anyone can switch off.
      beatRepeatLatched = false;
      beatRepeatLatchedBeats = null;
      beatRepeatLockedBeats = beats;
      downAt = Date.now();
      // Light the pad only if a slice was actually armed - the old order lit it
      // first and asked questions later.
      if(startBeatRepeat(beatRepeatLockedBeats)){
        btn.classList.add('active');
        scBeatRepeatCredit();
      } else {
        downAt = 0;
        scBeatPadSaysNothing();
      }
    });""")

edit('js: the release decides latch or hold',
     """    ['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {
      if(beatRepeatLocked) return; // stays looping until Loop Lock is switched off
      btn.classList.remove('active');
      stopBeatRepeat();
    }));""",
     """    ['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {
      if(beatRepeatLocked) return; // stays looping until Loop Lock is switched off
      const held = downAt ? Date.now() - downAt : -1;
      downAt = 0;
      const beats = parseFloat(btn.dataset.beats);
      // A TAP over a slice that really armed KEEPS it, and says so - otherwise the
      // most natural press in the app was the one that made no sound. A hold is the
      // gesture that loops only while it lasts, so its release is the end of it.
      if(ev === 'pointerup' && held >= 0 && held < SC_BEAT_TAP_MS && beatRepeatActive){
        beatRepeatLatched = true;
        beatRepeatLatchedBeats = beats;
        toast(btn.textContent.trim() + ' repeating \\u00b7 tap it again to stop', 1800);
        return;
      }
      btn.classList.remove('active');
      stopBeatRepeat();
    }));""")

# ------------------------------------------------------------- 3. the badges ----
edit('js: the lock is not the beat repeat',
     """    ['#beatRepeatLockBtn', 'beatRepeat'],""",
     """    // '#beatRepeatLockBtn' used to be here, and it credited "Beat repeat" - "Hold a
    // beat repeat" - by turning Loop Lock ON: a switch over whatever is loaded, not
    // a hold on a pad. The pad credits it itself (scBeatRepeatCredit, in the deck's
    // block), so it is deliberately NOT in this table: a click table would count the
    // same gesture twice.""") 

edit('js: the deck, by name, for the gates and for a bug report',
     """  window.__scDjModeState = function(){""",
     """  // The deck's own state, by name: what is loaded, where the playhead is and which
  // loop window is armed - the object the deck itself reads, not a copy of it. The
  // loop controls cannot be driven without a sound card, so the gate drives them
  // through this, the way __scPlaybackSnapshot is used for the player.
  window.__scDjDeck = function(){ return deckEngine; };
  window.__scDjModeState = function(){""")


def main():
    src = PAGE.read_text(encoding='utf-8')
    check = '--check' in sys.argv
    missing, already, applied = [], 0, 0
    for name, old, new in EDITS:
        if new and new in src:
            already += 1
            continue
        n = src.count(old)
        if n != 1:
            missing.append('%s (%d matches for the original)' % (name, n))
            continue
        if check:
            missing.append('%s (not applied)' % name)
            continue
        src = src.replace(old, new, 1)
        applied += 1
    if check:
        if missing:
            print('patch-74110: NOT in place:')
            for m in missing:
                print('  ' + m)
            return 1
        print('patch-74110: in place - %d of %d edits' % (already, len(EDITS)))
        return 0
    if missing:
        print('patch-74110: could not apply:')
        for m in missing:
            print('  ' + m)
        return 1
    PAGE.write_text(src, encoding='utf-8')
    print('patch-74110: %d applied, %d already there' % (applied, already))
    return 0


if __name__ == '__main__':
    sys.exit(main())
