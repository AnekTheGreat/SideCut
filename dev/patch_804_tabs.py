"""80.4, section 3 - the strips are taller, and they drag.

The owner's ask, verbatim:

    "make the tabs and the bottom smooth bro like buttery smooth to drag my
     fingers across and make them slightly taller ... make cloud version better"

WHAT WAS WRONG, CONCRETELY. The settings tab strip is the one horizontally
draggable surface in the app, and it had three small things against it:

  * no snap, so a diagonal finger left it parked between two tabs with half of
    each showing and nothing to say which one was current;
  * `touch-action` unset, so the browser was free to reinterpret a sideways drag
    (and a vertical one that started on a tab could scroll the pane underneath);
  * tapping a tab further along did not bring it into view, so the strip could sit
    with the active tab off the right edge.

And the tabs themselves were short: 34-38px of a finger's worth of target.

WHAT THIS DOES.

  * TALLER TABS. The settings tabs get a 46px minimum height and are centered
    boxes; the dock's pills go from 36 to 44 (48 in the cloud layout), which is
    the smallest size that stops a thumb catching two pills at once.
  * THE DRAG BELONGS TO THE STRIP. `touch-action: pan-x` says the browser may not
    turn this gesture into a vertical scroll, and `scroll-snap-type: x proximity`
    settles a drag on a tab boundary instead of wherever the finger stopped.
  * THE ACTIVE TAB COMES INTO VIEW. `scTabIntoView()` scrolls the strip to the tab
    that was just opened, smoothly, once - it is called from showSettingsTab, so
    every route into a tab (a tap, a deep link, a settings button on Home) leaves
    the strip showing the tab you are in.

None of this is a new animation system: the scroll is the platform's own, the
snap is CSS, and the centring asks for `behavior: 'smooth'`, which the WebView
honours natively. A device with Reduce motion on gets an instant jump, because
`scTabIntoView` asks the same two switches the rest of the app asks.

WHAT CLOUD GETS. The taller pills, and the same snap, so the bottom row is the
same surface in both layouts instead of two different ones.

Imported by dev/patch-804.py; holds constants only.
"""

# The settings tab strip's rule, as it stood.
STRIP_OLD = """#settingsTabStrip {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overflow-x: auto !important;
  scroll-behavior: auto;
  overscroll-behavior-x: contain;
}"""

STRIP_NEW = """#settingsTabStrip {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overflow-x: auto !important;
  scroll-behavior: auto;
  overscroll-behavior-x: contain;
  /* 80.4 - the drag belongs to the strip. pan-x stops the browser turning a
     sideways drag into a page scroll, proximity snap settles it on a tab instead
     of between two, and scroll-padding lets a tab sit flush at the ends. */
  touch-action: pan-x;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 10px;
}
#settingsTabStrip > .tab{
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  scroll-snap-align: center;
  scroll-margin-inline: 10px;
}"""

# The dock's pill: 36px tall was the smallest target in the app.
PILL_OLD = "    touch-action:manipulation; min-height:36px;"

PILL_NEW = "    touch-action:manipulation; min-height:44px;"

# The wide-screen step, kept a step above the new base.
PILL_WIDE_OLD = "    .action-pill{ font-size:13px; padding:10px 8px; min-height:42px; }"

PILL_WIDE_NEW = "    .action-pill{ font-size:13px; padding:10px 8px; min-height:48px; }"

# Cloud: the same row, a size up - it is the only navigation in that layout.
CLOUD_OLD = "body.sc80-cloud #sc80Now{ display: flex; }"

CLOUD_NEW = """body.sc80-cloud #sc80Now{ display: flex; }
/* 80.4 - in the cloud layout the dock is the whole navigation, so its pills get
   the taller target and the same snap the settings strip has. */
body.sc80-cloud .action-strip{
  scroll-snap-type: x proximity;
  touch-action: pan-x;
}
body.sc80-cloud .action-strip > .action-pill{
  min-height: 48px;
  scroll-snap-align: center;
}
/* 80.4 - the now bar's cover is a rounded square, the same shape the widget uses,
   and the bar itself breathes a little more in the corners. */
body.sc80-cloud #sc80Now{ padding: 6px 11px 6px 6px; }
body.sc80-cloud #sc80Now .art{ width: 26px; height: 26px; border-radius: 8px; }"""

# The tab buttons are centred by the strip now; the inline style keeps its size.
TAB_CENTER_ANCHOR = "    $('settingsTabMore').classList.toggle('active', tab === 'more');"

TAB_CENTER_ADD = TAB_CENTER_ANCHOR + """
    // 80.4 - and the strip scrolls the tab you just opened into view, so the one
    // you are in is never the one half off the right edge.
    try{ scTabIntoView(tab); }catch(_eTabView){ }"""

# The helper, beside the sheet's own functions rather than in a second block, so
# it reads the same $-lookup and the same motion switches as its neighbours.
HELPER_ANCHOR = TAB_CENTER_ADD

HELPER_ADD = HELPER_ANCHOR + """
  // 80.4 - one smooth scroll, asked for once per tab change. Guarded by the same
  // two Reduce-motion switches the rest of the app asks: reduced, the tab is
  // brought into view in the same frame with no travel.
  function scTabIntoView(tab){
    try{
      var strip = $('settingsTabStrip');
      if(!strip) return;
      var id = 'settingsTab' + String(tab || '').charAt(0).toUpperCase() + String(tab || '').slice(1);
      var btn = $(id);
      if(!btn) return;
      var rm = false;
      try{
        rm = !!(document.body && document.body.classList.contains('sandbox-reduce-motion')) ||
             !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }catch(_eRm){ }
      // Scroll ONLY the strip: scrollIntoView on a nested scroller can also move
      // the sheet it lives in, which is the bug this is meant to avoid.
      var left = btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2;
      if(left < 0) left = 0;
      var max = Math.max(0, strip.scrollWidth - strip.clientWidth);
      if(left > max) left = max;
      if(rm){ strip.scrollLeft = left; return; }
      if(typeof strip.scrollTo === 'function') strip.scrollTo({ left: left, behavior: 'smooth' });
      else strip.scrollLeft = left;
    }catch(_eTabInto){ }
  }"""
