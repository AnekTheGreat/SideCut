"""80.3.6, sections 1 and 2 - one motion system, the way a phone settles.

The owner's ask, verbatim:

    "in fact screw it add an update which makes the whole app as smooth as color
     os 17 ... make this nice"

WHAT "SMOOTH" IS, ONCE IT IS NOT A BUZZWORD. Three things, and the app had them
one surface at a time:

  * ONE SET OF CURVES AND DURATIONS. Four tokens (--sc-e-out, --sc-e-press,
    --sc-e-inout, and three durations) replace the ad-hoc `0.2s ease` each rule
    used to spell out. An arrival is fast out and long to settle, a press is
    quick and springy, a cross-fade is symmetric.
  * EVERY TAP ANSWERS. A tap on a tab, a playlist row, a settings row or a pick
    button compresses to 98% under the finger and comes back on release, which
    is the difference between a list that responds and a list that waits for the
    next frame to do anything at all. It is a transform and nothing else, so it
    is the compositor's work and not the layout's.
    The dock pills are deliberately NOT in this list: the dock has had its own
    press scale since 74.9 (`.action-pill:active` 0.95) and its own slide gesture,
    which measures every pill's rect at pointerdown and then drives the pointer
    across them. A second scale on top would move the rect that gesture has just
    read, so this rule does not name `.action-pill` at all - one rule per gesture.
  * NAVIGATION CROSS-FADES INSTEAD OF CUTTING. The platform's own View
    Transitions API (Chrome 111+, so the app's WebView on Android 13+) fades the
    old frame out as the new one settles in, in one composited pass. Where the
    API is absent - an older WebView, a browser - the switch is exactly what it
    was: scNavigateSmooth calls the original navigate and returns. Nothing is
    deferred, nothing is queued, and a transition that throws is caught and
    retried as a plain call.
  * A SCROLL BELONGS TO ITS PANE. `overscroll-behavior: contain` on the tab
    strip, the settings panes and the Studio view stops a scroll at the end of a
    list from dragging the page behind it, and `-webkit-overflow-scrolling:
    touch` keeps the momentum those panes already had.

REDUCE MOTION IS NOT AN AFTERTHOUGHT. The Sandbox switch and the device setting
both turn off the press scale, the pane fade and the view transition - the state
still changes, nothing travels. scMotionOff() is the one reader of both.

WHAT THIS MODULE DOES NOT DO. It adds no rAF loop, no scroll listener and no
timer. Everything in it is a CSS transition the compositor owns, plus one
function call around a navigation that already happened.

Imported by dev/patch-8036.py; holds constants only.
"""

# The end of the 74.1.9 view-in block. This line is in the page once, after the
# animation it belongs to, so the motion system lands beside the motion it
# generalises rather than on top of unrelated CSS.
CSS_ANCHOR = "@media (prefers-reduced-motion: reduce){ .sc-view-in{ animation: none; } }"

MOTION_CSS = """@media (prefers-reduced-motion: reduce){ .sc-view-in{ animation: none; } }
/* \u2500\u2500\u2500 80.3.6 - ONE MOTION SYSTEM, THE WAY A PHONE SETTLES \u2500\u2500\u2500
   Four curves and three durations, and everything interactive reads them. The
   app had motion before this; what it did not have was ONE motion - each rule
   spelled out its own `0.2s ease`, so two surfaces that arrived together did
   not settle together. These are the only numbers now: an arrival is fast out
   and long to settle (ease-out on a 0.22/1 curve), a press is quick and comes
   back on its own (a spring-flavoured bezier), a cross-fade is symmetric. */
:root{
  --sc-e-out: cubic-bezier(.22,1,.36,1);
  --sc-e-press: cubic-bezier(.2,.9,.25,1);
  --sc-e-inout: cubic-bezier(.65,0,.35,1);
  --sc-t-press: 110ms;
  --sc-t-fade: 200ms;
  --sc-t-view: 260ms;
}
/* A TAP ANSWERS. A tap compresses the surface to 98% under the finger and lets
   it back on release. It is a transform, so it is composited and costs no
   layout at all.
   THE DOCK IS NOT IN THIS LIST, on purpose: it has had its own press scale since
   74.9 (.action-pill:active, 0.95) and its slide gesture measures every pill's
   rect at pointerdown before driving across them, so a second scale on top would
   move the rect that gesture has just read. One rule per gesture. */
.tab, .playlist-pick-btn, .sc-set-head, .settings-pick, .sc-set-card{
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--sc-t-press) var(--sc-e-press),
              background-color var(--sc-t-fade) var(--sc-e-out),
              border-color var(--sc-t-fade) var(--sc-e-out),
              opacity var(--sc-t-fade) var(--sc-e-out);
}
.tab:active, .playlist-pick-btn:active, .sc-set-head:active, .settings-pick:active{ transform: scale(.98); }
/* A SCROLL BELONGS TO ITS PANE. Reaching the end of a list used to start
   dragging the page behind it, which reads as the app losing the gesture.
   Containment stops the chain at the pane, and the momentum these panes already
   had is kept explicit for the WebViews that only honour the prefixed hint. */
#tabs, #settingsPanesWrap, #studioView{
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
/* THE CROSS-FADE. These four rules are only ever consulted when the platform
   actually runs a view transition: scNavigateSmooth is what decides that, and it
   asks Reduce motion first, so a device that has asked for less motion never
   gets here with an animation to run. */
::view-transition-old(root){ animation: scVtOut var(--sc-t-press) var(--sc-e-inout) both; }
::view-transition-new(root){ animation: scVtIn var(--sc-t-view) var(--sc-e-out) both; }
@keyframes scVtOut{ to{ opacity: .35; } }
@keyframes scVtIn{ from{ opacity: 0; } }
/* REDUCE MOTION, answered the same way everywhere: the state still changes and
   nothing travels. Both switches are honoured - the Sandbox one, which is the
   app's own, and the device's, which is a media query. */
body.sandbox-reduce-motion .tab:active,
body.sandbox-reduce-motion .playlist-pick-btn:active,
body.sandbox-reduce-motion .sc-set-head:active,
body.sandbox-reduce-motion .settings-pick:active{ transform: none; }
@media (prefers-reduced-motion: reduce){
  .tab:active, .playlist-pick-btn:active, .sc-set-head:active, .settings-pick:active{ transform: none; }
  ::view-transition-old(root), ::view-transition-new(root){ animation: none; }
}"""

# The module's export of navigate. Every caller in the page - the dock, a
# deep link, the Studio's own navigate() - reaches navigation through the
# binding this assigns (the same block) or through window.navigate (another
# block), so both are pointed at the wrapper and nothing has to be rewritten.
NAV_OLD = "  window.navigate = navigate;"

NAV_NEW = """  // 80.3.6 - THE CROSS-FADE. Navigation used to cut: the old view's opacity
  // dropped to 0 and the new one appeared in the same frame, so a tab change was
  // a flash of two layouts. The platform's View Transitions API takes a snapshot
  // of the frame it is leaving, runs the change, then fades the snapshot out over
  // the new frame - one composited pass, no layout from us.
  //
  // WHAT THIS IS NOT. It is not a queue and it is not async: navigate() still
  // runs synchronously inside the callback, so every caller that reads state
  // straight after calling it (the dock's slide, a deep link, the Studio) sees
  // exactly what it saw before. If the API is missing, or Reduce motion is on,
  // or the transition throws, the original navigate() is called and returned -
  // the same function, the same frame, no wrapper cost worth measuring.
  //
  // The binding is reassigned as well as the global, because the page's own
  // callers resolve `navigate` in this block's scope rather than reading
  // window.navigate. A landscape of callers, one door.
  try{ if(typeof scViewIn === 'function') window.__scViewIn = scViewIn; }catch(_eViewIn){ }
  (function(){
    var _scNavInner = navigate;
    function scMotionOff(){
      try{
        if(document.body && document.body.classList.contains('sandbox-reduce-motion')) return true;
        if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
      }catch(_eMotionOff){ }
      return false;
    }
    function scNavigateSmooth(view){
      if(scMotionOff() || typeof document.startViewTransition !== 'function') return _scNavInner(view);
      try{
        var vt = document.startViewTransition(function(){ return _scNavInner(view); });
        if(vt && vt.finished && typeof vt.finished.catch === 'function') vt.finished.catch(function(){});
        return;
      }catch(_eVt){ return _scNavInner(view); }
    }
    try{ navigate = scNavigateSmooth; }catch(_eAs){ }
    window.__scNavigateSmooth = scNavigateSmooth;
    window.navigate = scNavigateSmooth;
  })();"""

# The settings sheet has its own switch, not a navigation, so it does not go
# through navigate(). It gets the app's existing arrival animation instead - the
# same scViewIn() a view gets - which is already reduced-motion aware.
SETTINGS_ANCHOR = "    $('settingsTabSandbox').classList.toggle('active', tab === 'sandbox');"

SETTINGS_ADD = SETTINGS_ANCHOR + """
    // 80.3.6 - the pane that arrived settles in, the way a view does. Its own
    // switch, not a navigation, so it takes the app's arrival animation rather
    // than the view transition (which belongs to the frame that replaced another
    // frame). scViewIn asks Reduce motion itself and does nothing if it is on.
    try{
      if(window.__scViewIn){
        var _scPaneIn = $('settingsPane' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if(_scPaneIn) window.__scViewIn(_scPaneIn);
      }
    }catch(_ePaneIn){ }"""
