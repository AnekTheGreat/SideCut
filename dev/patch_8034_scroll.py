"""80.3.4, section 1 - Discover, Studio and Tools come back where you left them.

The owner's ask, verbatim: *"discover studio and tools should all autoscroll to
where you were last, even if you refresh"*.

What the page did until now: Discover was explicitly put back at the TOP every
single time it opened (twice over - once in navigate(), once in showDiscover()),
with the reason written beside it ("so the pinned-artists + new-releases section,
and not the search results below it, is what first shows on screen"), and Studio
and Tools kept whatever scroll the container happened to hold - which a reload
throws away. So the owner's ask is a deliberate reversal of a rule that was put
there on purpose, and both resets go.

WHERE THE CODE LIVES. The studio panes and the tab machinery are inside blocks
whose closures the app's own IIFE cannot see (the revamp block's own comment
says so: "nothing in the app's IIFE is visible by name here, so every reach is a
guarded window.__sc* hook or a DOM query"). Rather than thread a hook through
three closures, this is one small top-level block at the end of the page that
watches the DOM the app already paints:

  * #discoverView and #studioView are the two scroll containers (both are
    `overflow-y: auto`); the studio view holds BOTH panes, so Studio and Tools
    are two memories over one element and the pane that is showing decides which
    one is being written.
  * a class change on those two views (and on the panes inside the studio view)
    is what "you moved" looks like from outside, so a MutationObserver on them is
    the signal - and it is the same signal for a tab tap, a studio half tap, a
    resumed view and the app's own boot.
  * the size remembered is read from a scroll listener, never from the container
    at the moment of a switch: hiding a pane re-lays out the container and clamps
    its scrollTop before anything outside can read it, so reading late would file
    a clamped number under the wrong tab.

The value is kept in localStorage, not in a session variable, because "even if I
refresh" is half the ask.

Imported by dev/patch-8034.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 1a. The two "start at the top" lines go.
# ---------------------------------------------------------------------------
DISCOVER_RESET_OLD = """  function showDiscover(on){
    $('discoverView').classList.toggle('active', on);
    if(on){
      var _dv = $('discoverView'); if(_dv) _dv.scrollTop = 0;
      if(!discoverActiveChip && !$('discoverResults').children.length){"""

DISCOVER_RESET_NEW = """  function showDiscover(on){
    $('discoverView').classList.toggle('active', on);
    if(on){
      // 80.3.4 - Discover is put back where the owner left it, not at the top:
      // the memory below the dock tab block owns this position now (the tests and
      // the release note both say where it is kept).
      if(!discoverActiveChip && !$('discoverResults').children.length){"""

NAVIGATE_RESET_OLD = """    if(isDiscover){
      // Start at the top each time so the pinned-artists + new-releases section
      // (and not the search results below it) is what first shows on screen.
      var _dv = $('discoverView'); if(_dv) _dv.scrollTop = 0;
      // Auto-search runs once per session (guarded so a slow/failed catalog call
      // can't re-fire on every open and stall the view)."""

NAVIGATE_RESET_NEW = """    if(isDiscover){
      // 80.3.4 - THIS IS THE REVERSAL OF A DELIBERATE RULE, at the owner's word:
      // "discover studio and tools should all autoscroll to where you were last,
      // even if you refresh". Until this release the first screen of Discover was
      // pinned by the two lines that used to be here, so a scroll down into the
      // results was thrown away every time the view opened. The position now lives
      // in the scroll-memory block at the end of the page (sidecut_scroll_discover
      // and its studio/tools siblings), which restores it when the view becomes
      // the active one - this branch and that block are the same decision, and
      // neither of them puts the view back at 0.
      // Auto-search runs once per session (guarded so a slow/failed catalog call
      // can't re-fire on every open and stall the view)."""

# ---------------------------------------------------------------------------
# 1b. The memory itself: one top-level block, appended after the 80.2 block.
# ---------------------------------------------------------------------------
SCROLL_BLOCK = r"""<script>
/* 80.3.4 - THE TABS COME BACK WHERE YOU LEFT THEM.
   ==========================================================================
   The ask, verbatim: "discover studio and tools should all autoscroll to where
   you were last, even if you refresh".

   Three memories, one per tab the owner named: Discover, Studio and Tools.
   Studio and Tools share one element (#studioView scrolls, and it holds both
   panes), so which of the two a scroll belongs to is decided by the pane that is
   showing - the same class toggle the dock tab drives. Discover has its own
   container (#discoverView), which is also where the app used to force
   scrollTop = 0 on every open.

   WHERE THE NUMBERS LIVE: localStorage (sidecut_scroll_<tab>), because "even if
   you refresh" is half of the ask, and because the app's own snapshot machinery
   already carries these keys across a storage wipe.

   HOW A SWITCH IS SEEN FROM OUT HERE. This block is a separate closure and the
   app's tab machinery is not reachable by name from it, so it watches the one
   thing the app is guaranteed to paint: the `active` class on the two views (and
   on the two studio panes inside the studio view). A tab tap, a studio half tap,
   a view resumed after a reload and the app's own boot all end in that class
   being set, so one observer covers every way in.

   WHY THE POSITION IS NOT READ AT THE MOMENT OF A SWITCH. Hiding a pane assigns
   a new layout, and the scroll container is clamped to the NEW content the
   instant anything reads scrollTop. Reading late therefore files the incoming
   pane's clamped position under the outgoing tab - the exact bug that would make
   Tools open half way down an album nobody asked for. So the outgoing number is
   the one the scroll listener last saw, taken while its pane was still the one on
   screen, and the incoming tab is restored from its own key.

   THE RESTORE IS A SHORT SETTLE, NOT ONE ASSIGNMENT. Discover's results and its
   pinned/new-releases rows arrive after the view opens, so a saved 4000px is not
   reachable on the frame the view turns active; the target is re-applied until it
   is reached or ~5s have passed, and the first real touch (a tap, a drag, a wheel,
   a key) ends the whole thing at once - the memory never fights the hand using
   the screen. Nothing remembered means the tab opens at the top exactly as it
   always did. */
(function(){
  'use strict';
  var KEYS = {
    discover: 'sidecut_scroll_discover',
    studio: 'sidecut_scroll_studio',
    tools: 'sidecut_scroll_tools'
  };
  var live = 0;            // the last position seen while the tracked tab was on screen
  var last = null;         // the tab the position in `live` belongs to
  var pending = null;      // { key, target, tries } while a restore is settling
  var applying = false;    // true only inside our own scrollTop assignment
  var writeTimer = 0;

  function $(id){ return document.getElementById(id); }
  function viewEl(key){
    return key === 'discover' ? $('discoverView') : (key ? $('studioView') : null);
  }
  function paneNow(){
    var host = $('studioView');
    if(!host) return 'studio';
    var pane = host.querySelector('.sc80-pane.active');
    return (pane && pane.getAttribute('data-pane') === 'tools') ? 'tools' : 'studio';
  }
  function keyNow(){
    var dv = $('discoverView');
    if(dv && dv.classList.contains('active')) return 'discover';
    var sv = $('studioView');
    if(sv && sv.classList.contains('active')) return paneNow();
    return null;
  }
  function read(key){
    try{
      var v = parseInt(localStorage.getItem(KEYS[key]) || '0', 10);
      return (isFinite(v) && v > 0) ? v : 0;
    }catch(e){ return 0; }
  }
  function write(key, val){
    try{
      if(key && val > 0) localStorage.setItem(KEYS[key], String(Math.round(val)));
      else if(key) localStorage.removeItem(KEYS[key]);
    }catch(e){}
  }
  function settle(){
    if(!pending) return;
    var el = viewEl(pending.key);
    if(!el || keyNow() !== pending.key){ pending = null; return; }
    var reach = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
    applying = true;
    try{ el.scrollTop = Math.min(pending.target, reach); }catch(e){}
    var at = el.scrollTop;
    applying = false;
    live = at;
    if(at >= pending.target - 1 || pending.tries++ >= 40){ pending = null; return; }
    setTimeout(settle, 120);
  }
  function enter(key){
    var el = viewEl(key);
    if(!el) return;
    pending = null;
    var target = read(key);
    if(target <= 0){
      // Nothing remembered (or the owner was at the very top): the tab opens at
      // the top, which is also what clears one tab's position out of a container
      // the other tab shares.
      applying = true;
      try{ el.scrollTop = 0; }catch(e){}
      applying = false;
      live = 0;
      return;
    }
    pending = { key: key, target: target, tries: 0 };
    live = target;
    settle();
  }
  function sync(){
    var key = keyNow();
    if(key === last) return;
    if(last) write(last, live);
    last = key;
    live = 0;
    if(key) enter(key);
  }
  function saveNow(){
    if(last) write(last, live);
  }
  function onScroll(ev){
    if(applying || pending) return;      // our own restore, not the hand
    var key = last || keyNow();
    if(!key) return;
    var el = viewEl(key);
    if(!el) return;
    live = el.scrollTop;
    if(writeTimer) return;
    writeTimer = setTimeout(function(){ writeTimer = 0; saveNow(); }, 250);
  }
  // A touch, a wheel or a key is the owner taking over: the settle stops where it
  // is rather than pulling the view back under their finger.
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function(ev){
    try{ window.addEventListener(ev, function(){ pending = null; }, { passive: true, capture: true }); }catch(e){}
  });
  ['discoverView', 'studioView'].forEach(function(id){
    var el = $(id);
    if(!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    if(window.MutationObserver){
      // The view's own class (which tab is on screen) and, inside the studio view,
      // each pane's class (Studio or Tools) - one observer each, no polling.
      var opts = { attributes: true, attributeFilter: ['class'] };
      if(id === 'studioView') opts.subtree = true;
      try{ new MutationObserver(sync).observe(el, opts); }catch(e){}
    }
  });
  try{
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', function(){ if(document.hidden) saveNow(); });
  }catch(e){}
  sync();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  // The studio panes are built (and the first Discover render lands) after this
  // block runs, so one late look settles a view that is already open.
  setTimeout(sync, 700);
  // For a gate or a future release: where the three memories are kept.
  window.__scScrollKeys = KEYS;
})();
</script>
"""

# The block that was last in the page (80.2's lyrics button), so the new one goes
# after it and before </body>.
TAIL_ANCHOR = """  window.addEventListener('load', sc11AddLyrics);
  setTimeout(sc11AddLyrics, 1200);
})();
</script>
</body>"""
