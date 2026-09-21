#!/usr/bin/env python3
"""v60.4 — the foreground drain.

The two things that kept a phone working hard the entire time SideCut was on
screen:

  * "Max device refresh rate" requested screen.refreshRate whenever it reported
    above 60. A request does not just allow a rate, it PINS the panel there for
    as long as the app is open, so on a 120 Hz phone the display never got to
    drop between frames. "Max" now requests nothing (an explicit Hz still does).
  * the RGB cycle and the RGB + glow ran on requestAnimationFrame loops, i.e. a
    frame every vsync, 60-120 a second, for as long as the theme was selected —
    whether or not anything was playing, touched or not. Both are timers now, at
    the same update rates the old loops throttled themselves to.
"""
import io, sys
from datetime import datetime, timedelta, timezone

p = 'index.html'
src = io.open(p, encoding='utf-8').read()


def rep(label, old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit('ANCHOR FAIL %s: expected %d, found %d\n---\n%s' % (label, count, n, old[:400]))
    src = src.replace(old, new, count)
    print('ok  ' + label)


# ═══════════════════════════════════════════════════════ 1. RGB cycle is a timer
rep('rgb cycle header', '''  // The cycle runs on a TIMER, not requestAnimationFrame. A phone can stop
  // delivering rAF callbacks entirely — a WebView that is visible but not
  // compositing (after a screen-off, a call, a lifecycle transition, under memory
  // pressure) gets no frames at all while its timers keep running — and the
  // accents then sit frozen on the hue the last frame happened to draw. That is
  // "RGB is on a weird colour and doesn't pulse". Every tick recomputes the hue
  // from the wall clock, so a timer the system suspended comes back on the right
  // colour instead of carrying on from a stale one, and the work stays the same
  // (two custom properties, ~5 times a second — the same rate the old rAF loop
  // throttled itself to anyway).''', '''  // The cycle runs on a TIMER, and nothing else — there is no requestAnimationFrame
  // loop behind it any more. A phone can stop delivering rAF callbacks entirely — a
  // WebView that is visible but not compositing (after a screen-off, a call, a
  // lifecycle transition, under memory pressure) gets no frames at all while its
  // timers keep running — and the accents then sit frozen on the hue the last frame
  // happened to draw. That is "RGB is on a weird colour and doesn't pulse". Every
  // tick recomputes the hue from the wall clock, so a timer the system suspended
  // comes back on the right colour instead of carrying on from a stale one.
  //
  // The other half of it is what a frame loop costs, which is why this is a timer
  // rather than a rAF loop with a timer as a watchdog. While a frame loop runs, the
  // page produces a frame every vsync and never goes idle: the GPU stays awake and
  // the display stays in its high-rate mode for as long as the theme is selected.
  // Ten steps a second moves the accent as smoothly as ten repaints a second did,
  // and leaves the other 110 of a 120 Hz phone's frames unspent.''')

rep('rgb tick interval', '''  let rgbSpeedSec = 8; // full hue cycle duration
  const RGB_TICK_MS = 200;''', '''  let rgbSpeedSec = 8; // full hue cycle duration
  // ~10 steps a second. The default sweep is about 45 degrees a second, so ten
  // steps read as one continuous move, while ten full-app repaints a second is a
  // tenth of what a per-frame loop cost for a colour nobody can pick apart.
  const RGB_TICK_MS = 100;''')

rep('stopRgbAnimation', '''  function stopRgbAnimation(){
    if(rgbAnimHandle){ clearInterval(rgbAnimHandle); rgbAnimHandle = null; }
    if(rgbRafHandle){ cancelAnimationFrame(rgbRafHandle); rgbRafHandle = null; }
    rgbLastAppliedHue = null;
    rgbLastApplyAt = 0;
    rgbLastFrameAt = 0;''', '''  function stopRgbAnimation(){
    if(rgbAnimHandle){ clearInterval(rgbAnimHandle); rgbAnimHandle = null; }
    rgbLastAppliedHue = null;
    rgbLastApplyAt = 0;''')

rep('rgbTick step rule comment', '''        // variables are used by essentially every element — so one write is a full
        // repaint of the app. On a 120Hz phone the old 0.25° rule qualified on
        // EVERY frame: 120 repaints a second for a colour sweep nobody can tell
        // apart from 12. Now a write needs a visible step (0.7°) AND at least
        // 90ms since the last one, which lands at ~11/s — smoother than the old
        // 200ms timer, at a tenth of the frames.''', '''        // variables are used by essentially every element — so one write is a full
        // repaint of the app. A write therefore needs a visible step (0.7°) AND at
        // least 90ms since the last one, so a tick that lands on a colour the eye
        // cannot tell from the one already on screen costs nothing at all.''')

rep('drop the rgb frame loop', '''  let rgbLastAppliedHue = null;   // last hue actually written to the page
  let rgbLastApplyAt = 0;         // when the page was last repainted for the hue
  let rgbRafHandle = null;        // the frame loop (smooth path)
  let rgbLastFrameAt = 0;         // for the watchdog below
  function rgbFrameLoop(){
    rgbRafHandle = requestAnimationFrame(rgbFrameLoop);
    rgbLastFrameAt = Date.now();
    rgbTick(false);
  }
''', '''  let rgbLastAppliedHue = null;   // last hue actually written to the page
  let rgbLastApplyAt = 0;         // when the page was last repainted for the hue
''')

rep('startRgbAnimation schedule', '''    rgbTick(true);
    // Smooth path: one hue update per display frame (RGB says "let the phone stop
    // handing over frames" is the failure mode, so the interval below stays as a
    // watchdog — it only forces a tick when no frame has arrived for half a
    // second, which is exactly the frozen-WebView case).
    if(!rgbRafHandle) rgbFrameLoop();
    rgbAnimHandle = setInterval(function(){
      if(Date.now() - rgbLastFrameAt > 500) rgbTick(true);
    }, RGB_TICK_MS);
  }''', '''    rgbTick(true);
    // ONE timer drives the whole cycle; nothing re-requests a frame. This used to
    // start a requestAnimationFrame loop with the interval kept only as a watchdog —
    // which meant a frame every vsync, and a re-style of every element in the app,
    // 60 to 120 times a second for the entire time an RGB theme was selected,
    // playing or not, touched or not. A page animating at vsync for ever cannot let
    // the display or the GPU idle, and that is exactly what shows up as foreground
    // drain. rgbTick still works the hue out from the wall clock, so nothing can
    // freeze on a stale colour and a tick the system held back lands correctly.
    rgbAnimHandle = setInterval(rgbTick, RGB_TICK_MS);
  }''')

# ═══════════════════════════════════════════════ 2. RGB + glow loop is a timer
rep('stopGlowSync', '''  function stopGlowSync(){
    if(glowLoopHandle){ cancelAnimationFrame(glowLoopHandle); glowLoopHandle = null; }''', '''  function stopGlowSync(){
    if(glowLoopHandle){ clearTimeout(glowLoopHandle); glowLoopHandle = null; }''')

rep('glow locals', '''    let reuseBuffer = null;
    let lastPumped = -1, lastPumpRounded = -1;''', '''    let reuseBuffer = null;
    let lastPumped = -1, lastPumpRounded = -1, idleApplied = false;''')

rep('glow tick head', '''    function tick(){
      glowLoopHandle = requestAnimationFrame(tick);
      if(!(THEMES[currentTheme] && THEMES[currentTheme].rgbPlus)) { stopGlowSync(); return; }
      // Style writes still throttled to ~20fps (same as before) — only the audio read
      // moved to its own interval above; this just controls how often we apply it.
      glowFrameSkip++;
      if(glowFrameSkip % 3 !== 0) return;
      // The seek-wave bars are nudged at half the glow rate: each bar write is a
      // layout on the now bar, and at ~20/s it was the heaviest thing running
      // while a song played.
      const _writeWaveBars = (glowFrameSkip % 6 === 0);''', '''    function tick(){
      // A timer, not a frame loop. This re-requested an animation frame for as long
      // as RGB + was selected, so the page drew a frame every vsync (60-120 a
      // second) to move a glow that updates about 20 times a second — and a page
      // animating at vsync never lets the display or the GPU idle. The writes below
      // keep the rates they always had; only the empty frames between them are gone.
      if(!(THEMES[currentTheme] && THEMES[currentTheme].rgbPlus)) { stopGlowSync(); return; }
      // Nothing on screen to pump: stop paying for it and look again shortly. The
      // audio-read interval above already stands down while the app is hidden.
      if(document.hidden){ glowLoopHandle = setTimeout(tick, 500); return; }
      glowFrameSkip++;
      // The seek-wave bars are nudged at half the glow rate: each bar write is a
      // layout on the now bar, and at ~20/s it was the heaviest thing running
      // while a song played.
      const _writeWaveBars = (glowFrameSkip % 2 === 0);''')

rep('glow idle branch', '''      if(lineLevel < 0.03){
        svg.classList.remove('live');
        path.setAttribute('d', '');
        // Reset CSS to idle state so browser stops compositing glow effects
        var _ttG = $('npPlayerBody'); if(_ttG) _ttG.style.setProperty('--np-glow-boost','0');
        document.documentElement.style.setProperty('--glow-pump','0');
        if(glowSettings.rightLine){ var _el = $('edgeGlowLine'); if(_el) _el.style.setProperty('--edge-glow-len', String(edgeGlowBaseLen)); }
        if(glowSettings.leftLine){ var _ell = $('edgeGlowLineLeft'); if(_ell) _ell.style.setProperty('--edge-glow-len-left', String(edgeGlowBaseLen)); }
        // Sleep 250ms (~4fps) when idle to reduce GPU heat — check again via setTimeout
        cancelAnimationFrame(glowLoopHandle); glowLoopHandle = null;
        glowLoopHandle = requestAnimationFrame(tick);
        // Skip next ~4 frames (150ms) to throttle idle polling
        glowFrameSkip += 5;
        return;
      }
      svg.classList.add('live');''', '''      if(lineLevel < 0.03){
        if(!idleApplied){
          idleApplied = true;
          svg.classList.remove('live');
          path.setAttribute('d', '');
          // Reset CSS to idle state so browser stops compositing glow effects
          var _ttG = $('npPlayerBody'); if(_ttG) _ttG.style.setProperty('--np-glow-boost','0');
          document.documentElement.style.setProperty('--glow-pump','0');
          if(glowSettings.rightLine){ var _el = $('edgeGlowLine'); if(_el) _el.style.setProperty('--edge-glow-len', String(edgeGlowBaseLen)); }
          if(glowSettings.leftLine){ var _ell = $('edgeGlowLineLeft'); if(_ell) _ell.style.setProperty('--edge-glow-len-left', String(edgeGlowBaseLen)); }
        }
        // Quiet: four checks a second and no writes, until the music moves again.
        glowLoopHandle = setTimeout(tick, 250);
        return;
      }
      idleApplied = false;
      svg.classList.add('live');''')

rep('glow tick schedule', '''        });
      }
    }
    glowLoopHandle = requestAnimationFrame(tick);''', '''        });
      }
      glowLoopHandle = setTimeout(tick, 50); // ~20 updates a second
    }
    glowLoopHandle = setTimeout(tick, 50);''')

# ══════════════════════════════════════════════════ 3. no display-rate pin at max
rep('max refresh rate', '''      if(refreshRate === 'max'){
        var advertised = Number((window.screen && window.screen.refreshRate) || 0);
        // Only speak up when the platform reports a rate that is plainly above the
        // WebView's own default; otherwise leave the display alone.
        if(advertised > 61) Promise.resolve(requestRate.call(window.screen, advertised)).catch(function(){});
        return;
      }''', '''      if(refreshRate === 'max'){
        // Nothing to request. That is the whole point of the setting: the system
        // keeps the rate and drops it when nothing is moving.
        //
        // This used to request screen.refreshRate whenever that reported above 60 —
        // and a request does not merely allow a rate, it PINS the panel there for as
        // long as the app is open. On a 120 Hz phone that is the display held in its
        // highest mode for the whole session, which is by far the largest thing this
        // app can do to a battery: the low rate an adaptive display would drop to
        // between frames simply never happens.
        //
        // An explicit Hz choice still requests exactly that rate, so pinning the
        // display is something you can ask for on purpose.
        return;
      }''')

# ═══════════════════════════════════════════════════════ 4. the tab icon
rep('favicon throttle', '''  let lastFaviconUpdate = 0;
  function maybeUpdateFavicon(now){
    // throttled version for the RGB hue-cycle loop — a full canvas redraw every animation
    // frame would be wasteful, so this only actually redraws a few times per second.
    if(now - lastFaviconUpdate < 200) return;
    lastFaviconUpdate = now;
    updateFavicon(false);
  }''', '''  let lastFaviconUpdate = 0;
  function maybeUpdateFavicon(now){
    // Throttled version for the RGB hue-cycle tick. Each one is a full canvas
    // redraw PLUS a PNG encode (toDataURL), and it ran five times a second for as
    // long as an RGB theme was on — one of the most expensive things the app did
    // per second, for a 16-pixel icon. Once a second is more than a tab can show,
    // and nothing at all is drawn while the app is off screen.
    if(document.hidden) return;
    if(now - lastFaviconUpdate < 1000) return;
    lastFaviconUpdate = now;
    updateFavicon(false);
  }''')

# ═══════════════════════════════════════════════════════════ 5. version + notes
rep('version', "  const APP_VERSION = '60.3';", "  const APP_VERSION = '60.4';")

edt = datetime.now(timezone.utc) - timedelta(hours=4)
ap = 'AM' if edt.hour < 12 else 'PM'
h12 = edt.hour % 12 or 12
stamp = '%s %d, %d \\u00b7 %d:%02d %s EDT' % (edt.strftime('%B'), edt.day, edt.year, h12, edt.minute, ap)

anchor = "  { version: '60.3', date:"
assert src.count(anchor) == 1, 'changelog anchor'
entry = """  { version: '60.4', date: '%s', title: 'The display is not pinned at max refresh, and the animated themes stop drawing at vsync', items: [
    'Foreground drain, the two big ones. "Max device refresh rate" now genuinely asks the display for nothing: it used to request screen.refreshRate whenever that reported above 60, and a request pins the panel at that rate for as long as the app is open \\u2014 so on a 120 Hz phone the display sat in its top mode the whole session and never got to drop between frames. An explicit rate (60/90/120\\u2026/240 Hz) still requests exactly that, so pinning the display is now something you ask for on purpose rather than the default',
    'The RGB and RGB + cycles no longer run on a frame loop. They drove themselves from requestAnimationFrame with the 200ms timer kept only as a watchdog, so the page drew a frame every vsync \\u2014 60 to 120 a second \\u2014 and re-styled every element in the app for the whole time the theme was selected, playing or not. One 100ms timer now steps the hue (about ten repaints a second, which is what the old loop\\u2019s own visible-step rule already allowed), and the sweep looks the same',
    'RGB + \\u2019s glow loop is a timer too: the same ~20 updates a second, dropping to four a second once the music goes quiet, and nothing at all while the app is off screen \\u2014 instead of re-requesting a frame for ever',
    'The tab icon is redrawn once a second instead of five times a second, and never in the background. Every one of those was a canvas paint plus a PNG encode, for a 16-pixel icon',
    'Nothing about the look changed. The pulse, the glow, the bass reaction, the cycle speed and every theme colour are the same \\u2014 only the frames nobody could see between the updates are gone',
  ]},
""" % stamp
src = src.replace(anchor, entry + anchor, 1)
print('ok  changelog entry %s' % stamp)

io.open(p, 'w', encoding='utf-8').write(src)
print('\npatched index.html')
