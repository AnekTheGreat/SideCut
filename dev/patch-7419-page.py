# The page text dev/patch-7419.py writes, part one: THE THREE CHANGES.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7419.py's globals.
#
# 74.1.9 is a feel release, asked for by the owner in one message:
#
#   "In albums, when you skip a song to the next album if it starts a new album,
#    the old one should automatically close and the new one should automatically
#    show un-collapsed. Also make the apps and transitions in the apps very smooth
#    and add a feature in the bottom where the tabs are to set them to a pill like
#    shape all together kind of like iOS where you can hold and hover over what you
#    want to click or like slide it nicely, that would be a cool feature."
#
# So there are three edits, and each one is anchored on text the page has carried
# for several releases:
#
#   1. THE ALBUM FOLLOWS THE SONG. highlightPlaying() is the one place in the app
#      every track change passes through - Next, Previous, a song ending, a tap on
#      a row, a track picked in DJ Mode - and its Albums-tab half already opens the
#      card that holds the playing song. What it never did was close the card it
#      opened for the song before this one, so skipping into another record left
#      two albums open and the row that was playing somewhere inside them. The
#      cards THIS RULE opened are now tracked (scAlbPlayingCards) and closed again
#      when the song moves on: cards the owner opened by hand are never touched,
#      and a card that still holds the playing song (a saved album and a tag-only
#      card can both hold it) stays open.
#
#   2. THE VIEWS COME IN. Home, Discover, Library and Studio each toggle between
#      display:flex and display:none, which is a hard cut. scViewIn() lets the view
#      that just arrived fade and settle in about a fifth of a second, on the
#      compositor, and does nothing at all when reduced motion has been asked for
#      (the Sandbox switch) or when the device says so.
#
#   3. THE PILL DOCK. A setting (Studio -> Gestures) that joins the tabs into one
#      rounded capsule with a highlight that slides to the tab being pressed,
#      hovered or slid over - an iOS segmented control. Its two drawn pieces are
#      built by the code rather than written into the markup, so the dock that
#      ships still holds the four pills and nothing else until the setting asks
#      for more. A plain tap is untouched: the pill still gets its own click, and
#      only a SLIDE is answered by this code, with the click the browser fires at
#      the press's common ancestor swallowed once.
#
# WHAT THIS FILE IS NOT: the version, the shell cache and the changelog entry live
# in dev/patch-7419-notes.py, the same split as every release before it.

# ---------------------------------------------------------------- 1. THE ALBUM

ALB_STATE_OLD = """  window.__scAlbumFocusOn = scAlbumFocusOn;
  window.__scAlbumsRememberOnLeave = scAlbumsRememberOnLeave;
"""

ALB_STATE_NEW = """  window.__scAlbumFocusOn = scAlbumFocusOn;
  window.__scAlbumsRememberOnLeave = scAlbumsRememberOnLeave;
  // 74.1.9 - WHICH CARDS THE LAST TRACK CHANGE OPENED.
  // The owner: "when you skip a song to the next album if it starts a new album,
  // the old one should automatically close and the new one should automatically
  // show un-collapsed". highlightPlaying() runs on every track change (Next, the
  // song ending, a row tap, a track picked in DJ Mode), so the rule lives there,
  // and this is the one thing it needs to remember: the cards it opened for the
  // song before this one, so they can be closed again. Cards the owner opened by
  // hand are never in this list, which is why they are never closed by it.
  var scAlbPlayingCards = [];
  function scAlbumCollapseCard(card){
    try{
      if(!card) return;
      var nm = card.dataset ? card.dataset.albumName : '';
      var body = card.querySelector('[id^="alb_card_"]');
      if(body){
        // The rows go with it, so the next open rebuilds them with the playing
        // song marked - a stale ".playing" row is a row naming the wrong song.
        body.style.display = 'none';
        body.style.opacity = '';
        body.style.transform = '';
        body.innerHTML = '';
      }
      var hdr = card.firstElementChild;
      var chev = hdr ? hdr.querySelector('span') : null;
      if(chev) chev.style.transform = '';
      if(nm){ try{ localStorage.setItem('sidecut_albColl_' + nm, '1'); }catch(_eSt){} }
    }catch(e){}
  }
"""

ALB_OPEN_OLD = """    // Auto-expand album cards containing the playing track and scroll to it
    if(typeof libraryMode !== 'undefined' && libraryMode === 'albums'){
      document.querySelectorAll('[data-album-name]').forEach(function(card){
        var albName = card.dataset.albumName;
"""

ALB_OPEN_NEW = """    // Auto-expand album cards containing the playing track and scroll to it.
    // 74.1.9 - and the album it came from closes behind it: every track change in
    // the app comes through here, so no path has to remember the rule itself.
    if(typeof libraryMode !== 'undefined' && libraryMode === 'albums'){
      var _scOpenNow = [];
      document.querySelectorAll('[data-album-name]').forEach(function(card){
        var albName = card.dataset.albumName;
"""

ALB_PUSH_OLD = """        if(_cardIds && _cardIds.indexOf(id) !== -1){
          var body = card.querySelector('[id^="alb_card_"]');
"""

ALB_PUSH_NEW = """        if(_cardIds && _cardIds.indexOf(id) !== -1){
          _scOpenNow.push(card);
          var body = card.querySelector('[id^="alb_card_"]');
"""

ALB_CLOSE_OLD = """          } else if(body && body.style.display !== 'none'){
            var pr = body.querySelector('[data-id="' + id + '"]');
            if(pr) smoothScrollIn(body, pr);
          }
        }
      });
    }
  }
"""

ALB_CLOSE_NEW = """          } else if(body && body.style.display !== 'none'){
            var pr = body.querySelector('[data-id="' + id + '"]');
            if(pr) smoothScrollIn(body, pr);
          }
        }
      });
      // The album the track BEFORE this one was in closes, unless the song playing
      // now is in it too - a saved album and a tag-only card can both hold the same
      // song, and a card that still holds it is not a card to shut. Only the cards
      // this rule opened are ever closed here; anything the owner opened by hand
      // is left exactly as it is.
      var _scWasCards = scAlbPlayingCards;
      var _scMoved = !_scOpenNow.length || !_scOpenNow.every(function(c){
        return _scWasCards.indexOf(c.dataset.albumName) !== -1;
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-album-name]'), function(card){
        if(_scOpenNow.indexOf(card) !== -1) return;
        if(_scWasCards.indexOf(card.dataset.albumName) === -1) return;
        scAlbumCollapseCard(card);
      });
      scAlbPlayingCards = _scOpenNow.map(function(card){ return card.dataset.albumName; });
      // A skip into another album brings that album's card into view: "the new one
      // shows un-collapsed" has to mean visible, not merely open off-screen.
      if(_scMoved && _scOpenNow.length){
        var _scPane = document.getElementById('listPane');
        if(_scPane) smoothScrollIn(_scPane, _scOpenNow[0]);
      }
    }
  }
"""

# ------------------------------------------- 2 + 3. THE VIEW, AND THE PILL DOCK

# The tail of navigate(): the view that just arrived comes in, and the dock's
# highlight follows whatever is lit now.
NAV_TAIL_OLD = """    // Close the add-songs menu whenever we navigate.
    closeAddSongsMenu();
  }
"""

NAV_TAIL_NEW = """    // Close the add-songs menu whenever we navigate.
    closeAddSongsMenu();
    // 74.1.9 - the view that just arrived comes in rather than cutting in, and the
    // dock's highlight follows whatever is lit now.
    try{ scViewIn(isHome ? $('homeView') : isDiscover ? $('discoverView') : isStudio ? $('studioView') : (isLibrary ? $('library') : null)); }catch(_eVIn){}
    try{ scDockPillSync(); }catch(_eDockSync){}
  }
"""

# The new block itself, put after the dock's own click wiring (homeBtn/libraryBtn/
# discoverBtn/studioBtn) and before the add-songs menu wiring, inside the app's own
# <script> so navigate(), libraryMode and the dock's elements are all in scope.
DOCK_JS_OLD = """  // ---- Add-songs collapsible menu ----
"""

DOCK_JS_NEW = """  /* --------------------------------------------------------------------------
     74.1.9 - THE PILL DOCK, AND THE VIEWS THAT COME IN
     --------------------------------------------------------------------------
     Two feel changes, both asked for by name: a view arrives instead of cutting
     in, and the dock can be ONE rounded capsule with a highlight that slides -
     press and slide across it to pick a tab, or move a mouse over it and watch the
     highlight say what a click would take, the way an iOS segmented control
     behaves. The joined shape is a setting (Studio -> Gestures) and it is off
     until it is asked for, because four separate pills is the dock every screen in
     this app has been built around.

     HOW THE SLIDE IS SAFE. A pill still gets its own pointerdown and its own
     click, so a plain tap is exactly what it always was. Only a SLIDE is answered
     here: the highlight follows the pointer, and on release the tab under the
     finger is activated while the click the browser fires at the press's common
     ancestor is swallowed once - a press that began on Home and ended on Studio
     must not open both. The plus is never a landing place: it opens a menu, it is
     not somewhere to be.
     -------------------------------------------------------------------------- */

  // Views come in. Opacity and a few pixels of travel, both cheap for the
  // compositor, and nothing at all when less motion has been asked for - by the
  // Sandbox switch or by the device itself.
  var scMotionDown = false;
  try{ scMotionDown = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(_eMotion){}
  function scViewIn(el){
    try{
      if(!el || scMotionDown) return;
      if(document.body && document.body.classList.contains('sandbox-reduce-motion')) return;
      el.classList.remove('sc-view-in');
      void el.offsetWidth;          // restart the animation on a repeat visit
      el.classList.add('sc-view-in');
      setTimeout(function(){ try{ el.classList.remove('sc-view-in'); }catch(_eVOff){} }, 340);
    }catch(e){}
  }

  var scDockPillOn = false;       // the setting itself
  var scDockPillDown = null;      // what the current press started on
  var scDockPillHotEl = null;     // what the pointer is over right now
  var scDockPillSwallow = false;  // the next click belongs to a slide, not a tab
  var scDockPillSegs = [];        // the pills a slide can land on, in dock order
  var scDockPillRects = [];       // where those pills are, measured while they are still
  try{ scDockPillOn = localStorage.getItem('sidecut_dockPill') === '1'; }catch(_eDockP0){}

  // The pills that share the capsule: the four tabs, plus any quick action that was
  // pinned to the dock. The add-songs plus is not one of them.
  function scDockPillCollect(){
    var strip = $('actionStrip');
    scDockPillSegs = [];
    if(!strip) return scDockPillSegs;
    Array.prototype.forEach.call(strip.children, function(el){
      if(!el.classList || !el.classList.contains('action-pill')) return;
      if(el.classList.contains('dock-add')) return;
      scDockPillSegs.push(el);
    });
    return scDockPillSegs;
  }
  // Measured once per gesture rather than per pointermove: reading a rect forces a
  // layout, and a slide would otherwise do that on every frame of the drag.
  function scDockPillMeasure(){
    var segs = scDockPillCollect();
    scDockPillRects = [];
    for(var i = 0; i < segs.length; i++){
      var r = segs[i].getBoundingClientRect();
      scDockPillRects.push({ el: segs[i], left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
    }
    return scDockPillRects;
  }
  // The two drawn pieces are built here rather than written into the markup, and
  // both sit BEHIND the labels (a negative z-index inside the dock's own stacking
  // context), so no name is ever covered by the highlight.
  function scDockPillEls(){
    var strip = $('actionStrip');
    if(!strip) return null;
    var track = $('scDockPillTrack'), thumb = $('scDockPillThumb');
    if(!track){
      track = document.createElement('div');
      track.id = 'scDockPillTrack';
      thumb = document.createElement('div');
      thumb.id = 'scDockPillThumb';
      strip.insertBefore(thumb, strip.firstChild);
      strip.insertBefore(track, strip.firstChild);
    }
    return { strip: strip, track: track, thumb: thumb };
  }
  // Which half of the split Library tab a point is over. The halves are the two
  // triangles of a diagonal cut, so this is the test the clip-path draws: the
  // top-left triangle is Library, the bottom-right is Albums.
  function scDockPillHalf(seg, x, y){
    try{
      if(!seg || seg.id !== 'libraryBtn') return seg;
      var r = seg.getBoundingClientRect();
      if(!r.width || !r.height) return seg;
      var pl = document.getElementById('playlistsHalf'), al = document.getElementById('albumsHalf');
      if(!pl || !al) return seg;
      return (((x - r.left) / r.width) + ((y - r.top) / r.height)) < 1 ? pl : al;
    }catch(e){ return seg; }
  }
  function scDockPillAt(x, y){
    var rects = scDockPillRects.length ? scDockPillRects : scDockPillMeasure();
    for(var i = 0; i < rects.length; i++){
      var r = rects[i];
      if(r.width && r.height && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
        return scDockPillHalf(r.el, x, y);
      }
    }
    return null;
  }
  // Where the highlight sits when nothing is being pressed or hovered: the lit tab,
  // or the half of the split Library tab the library is really showing.
  function scDockPillRest(){
    var segs = scDockPillCollect();
    for(var i = 0; i < segs.length; i++){
      if(!segs[i].classList.contains('active')) continue;
      if(segs[i].id === 'libraryBtn'){
        var pl = document.getElementById('playlistsHalf'), al = document.getElementById('albumsHalf');
        if(pl && al) return (typeof libraryMode !== 'undefined' && libraryMode === 'albums') ? al : pl;
      }
      return segs[i];
    }
    return segs.length ? segs[0] : null;
  }
  // The box a target owns, in the dock's own coordinates. A half of the split tab
  // shares its parent's box and takes the left or the right of it.
  function scDockPillBox(target, strip){
    var sr = strip.getBoundingClientRect();
    var r = target.getBoundingClientRect();
    var left = r.left, width = r.width, top = r.top, height = r.height;
    if(target.id === 'albumsHalf' || target.id === 'playlistsHalf'){
      var pr = target.parentNode.getBoundingClientRect();
      left = pr.left + (target.id === 'albumsHalf' ? pr.width / 2 : 0);
      width = pr.width / 2;
      top = pr.top;
      height = pr.height;
    }
    return { left: left - sr.left, top: top - sr.top, width: width, height: height };
  }
  function scDockPillMark(el){
    try{
      scDockPillSegs.forEach(function(s){ s.classList.toggle('sc-dock-hot', s === el); });
      ['playlistsHalf', 'albumsHalf'].forEach(function(id){
        var h = document.getElementById(id);
        if(h) h.classList.toggle('sc-dock-hot', h === el);
      });
    }catch(e){}
  }
  // The capsule and the highlight, drawn from where the pills actually are. Every
  // state change - a slide, a hover, a tab opening, a rotation - comes back here, so
  // there is one place that knows where the highlight belongs.
  function scDockPillSync(){
    try{
      if(!scDockPillOn) return;
      var e = scDockPillEls();
      if(!e) return;
      var rects = scDockPillMeasure();
      if(!rects.length || !rects[0].width) return;   // nothing is laid out yet
      var sr = e.strip.getBoundingClientRect();
      var first = rects[0], last = rects[rects.length - 1];
      e.track.style.left = (first.left - sr.left - 4) + 'px';
      e.track.style.top = (first.top - sr.top - 4) + 'px';
      e.track.style.width = (last.right - first.left + 8) + 'px';
      e.track.style.height = (first.height + 8) + 'px';
      var t = scDockPillHotEl || scDockPillRest();
      if(!t){ e.thumb.style.width = '0px'; return; }
      var b = scDockPillBox(t, e.strip);
      e.thumb.style.width = Math.max(0, b.width - 8) + 'px';
      e.thumb.style.height = Math.max(0, b.height - 8) + 'px';
      e.thumb.style.top = Math.max(0, b.top + 4) + 'px';
      e.thumb.style.transform = 'translateX(' + (b.left + 4) + 'px)';
    }catch(e){}
  }
  function scDockPillApply(on){
    try{
      scDockPillOn = !!on;
      localStorage.setItem('sidecut_dockPill', scDockPillOn ? '1' : '0');
      document.body.classList.toggle('sc-dock-pill', scDockPillOn);
      if(scDockPillOn) scDockPillEls();
    }catch(_eDockPA){}
    scDockPillSync();
    return scDockPillOn;
  }
  // The Studio is a later <script> and cannot read this scope, so the setting is
  // published the one way that works across blocks: a name on the window.
  window.__scDockPillOn = function(){ return !!scDockPillOn; };
  window.__scSetDockPill = function(on){ return scDockPillApply(on); };

  (function scDockPillWire(){
    var strip = $('actionStrip');
    if(!strip || window.__scDockPillWired) return;
    window.__scDockPillWired = true;
    function offDrag(){
      try{
        window.removeEventListener('pointermove', onDrag, true);
        window.removeEventListener('pointerup', onDrop, true);
        window.removeEventListener('pointercancel', onDrop, true);
      }catch(e){}
    }
    function onDrag(ev){
      if(!scDockPillOn || !scDockPillDown) return;
      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(t && t !== scDockPillHotEl){
        scDockPillHotEl = t;
        scDockPillMark(t);
        scDockPillSync();
      }
    }
    function onDrop(ev){
      var down = scDockPillDown;
      scDockPillDown = null;
      offDrag();
      if(!scDockPillOn || !down) return;
      var up = scDockPillAt(ev.clientX, ev.clientY) || down;
      if(up !== down){
        // A slide is a choice: the tab the finger finished on is activated first -
        // while the swallow below is still off, so this click is not the one it
        // eats - and the click the browser is ABOUT to fire for this press is
        // swallowed once, so the tab it started on cannot answer as well. The
        // order matters: the browser's own click arrives after this handler.
        try{ up.click(); }catch(_eDockClick){}
        scDockPillSwallow = true;
        // ...and it is spent on ONE click. A browser always fires the click for a
        // press, but if anything ever stops it - another listener, an engine that
        // decides the two targets are too far apart - the flag must not be left
        // armed to eat an unrelated click later. It expires, and the next press
        // clears it too.
        setTimeout(function(){ scDockPillSwallow = false; }, 600);
      }
      scDockPillHotEl = null;
      scDockPillMark(null);
      scDockPillSync();
    }
    strip.addEventListener('pointerdown', function(ev){
      if(!scDockPillOn) return;
      scDockPillSwallow = false;      // a new press is never the old press's business
      scDockPillMeasure();
      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(!t) return;                 // the plus and the menu are their own thing
      scDockPillDown = t;
      scDockPillHotEl = t;
      scDockPillMark(t);
      scDockPillSync();
      // Tracked on the window rather than with pointer capture: capture retargets
      // the pointerup at the dock, and the click that follows a tap is then fired
      // at the dock instead of at the pill - which would break the plain tap this
      // whole feature has to keep working.
      window.addEventListener('pointermove', onDrag, true);
      window.addEventListener('pointerup', onDrop, true);
      window.addEventListener('pointercancel', onDrop, true);
    });
    // A mouse says what it is about to take before it takes it. Touch never hovers,
    // and a finger that is already down is sliding.
    strip.addEventListener('pointermove', function(ev){
      if(!scDockPillOn || scDockPillDown) return;
      if(ev.pointerType && ev.pointerType !== 'mouse') return;
      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(t === scDockPillHotEl) return;
      scDockPillHotEl = t;
      scDockPillMark(t);
      scDockPillSync();
    });
    strip.addEventListener('pointerleave', function(){
      if(!scDockPillOn || scDockPillDown) return;
      scDockPillHotEl = null;
      scDockPillMark(null);
      scDockPillSync();
    });
    // The click that follows a slide, swallowed once, in the capture phase.
    strip.addEventListener('click', function(ev){
      if(!scDockPillSwallow) return;
      scDockPillSwallow = false;
      ev.stopPropagation();
      ev.preventDefault();
    }, true);
    window.addEventListener('resize', function(){ scDockPillSync(); });
    window.addEventListener('orientationchange', function(){ scDockPillSync(); });
  })();
  // Put the dock the page was left on back on screen - now, and once more after
  // layout has settled (a font or a rotation moves the pills), so the highlight is
  // never left sitting where the dock used to be.
  try{ scDockPillApply(scDockPillOn); }catch(_eDockPBoot){}
  setTimeout(function(){ scDockPillSync(); }, 400);

  // ---- Add-songs collapsible menu ----
"""

# The capsule and the highlight, and the view that just arrived. Appended to the
# 70.0 dock block, after the narrow-phone rule for the plus.
CSS_OLD = """@media (max-width: 380px){ .action-strip .action-pill.dock-add{ width: 38px; min-width: 38px; } }
"""

CSS_NEW = """@media (max-width: 380px){ .action-strip .action-pill.dock-add{ width: 38px; min-width: 38px; } }
/* ---------- 74.1.9: the pill dock (one capsule, one sliding highlight) -------
   A setting, off until it is asked for (Studio -> Gestures). In this mode the tabs
   share one rounded capsule and a highlight slides to the tab being pressed,
   hovered or slid over, the way an iOS segmented control behaves. The capsule and
   the highlight are built by the dock's own code rather than written into the
   markup, and both sit BEHIND the labels (a negative z-index inside the dock's own
   stacking context), so no name is ever covered by them. */
#scDockPillTrack, #scDockPillThumb{ display: none; position: absolute; left: 0; top: 0; z-index: -1; pointer-events: none; box-sizing: border-box; }
#scDockPillTrack{ background: color-mix(in srgb, var(--bg) 60%, transparent); border: 1px solid var(--line); border-radius: 999px; }
#scDockPillThumb{
  width: 0; height: 0;
  background: color-mix(in srgb, var(--coral) 26%, var(--bg-raised));
  border: 1px solid color-mix(in srgb, var(--coral) 55%, transparent);
  box-shadow: 0 2px 10px rgba(0,0,0,0.30);
  border-radius: 999px;
  transition: transform 0.24s cubic-bezier(0.22,1,0.36,1), width 0.24s cubic-bezier(0.22,1,0.36,1), height 0.2s ease, top 0.2s ease;
}
body.sc-dock-pill #scDockPillTrack, body.sc-dock-pill #scDockPillThumb{ display: block; }
/* Joined: the pills give up the shapes that made them separate - no fill, no
   border - and keep everything that makes them pills (the press spring, the label,
   and the slide, which is theirs to answer, so the touch is not handed to the
   page's own scrolling). */
body.sc-dock-pill .action-strip > .action-pill{
  position: relative; z-index: 1; touch-action: none;
  background: transparent; border-color: transparent; color: var(--ink-dim);
}
body.sc-dock-pill .action-strip > .action-pill:active{ transform: scale(0.96); }
body.sc-dock-pill .action-strip > .action-pill::after{ display: none; }
body.sc-dock-pill .action-strip > #homeBtn.active,
body.sc-dock-pill .action-strip > #libraryBtn.active,
body.sc-dock-pill .action-strip > #discoverBtn.active,
body.sc-dock-pill .action-strip > #studioBtn.active,
body.sc-dock-pill .action-strip > .action-pill.sc-dock-hot{
  background: transparent; border-color: transparent; color: var(--ink); font-weight: 700;
}
body.sc-dock-pill #playlistsHalf.sc-dock-hot span, body.sc-dock-pill #albumsHalf.sc-dock-hot span{ color: var(--ink) !important; }
/* The plus is not part of the capsule - it opens a menu rather than going
   somewhere - so it keeps its own fill, its own shape and its own place. */
body.sc-dock-pill .action-strip > .action-pill.dock-add{
  background: color-mix(in srgb, var(--bg-raised) 90%, transparent); border-color: var(--line); color: var(--ink);
}
/* ---------- 74.1.9: the view that just arrived ------------------------------- */
@keyframes scViewIn{ from{ opacity: 0; transform: translateY(6px); } to{ opacity: 1; transform: none; } }
.sc-view-in{ animation: scViewIn 0.22s cubic-bezier(0.22,1,0.36,1) both; }
body.sandbox-reduce-motion .sc-view-in{ animation: none; }
@media (prefers-reduced-motion: reduce){ .sc-view-in{ animation: none; } }
"""

# ------------------------------------------------------- the Studio's own switch

GEST_FOLD_OLD = """      foldSec('', 'scFoldGestures', 'Gestures', ((gestures.shake ? 1 : 0) + (gestures.swipe ? 1 : 0)) + '/2 on',
"""

GEST_FOLD_NEW = """      foldSec('', 'scFoldGestures', 'Gestures', ((gestures.shake ? 1 : 0) + (gestures.swipe ? 1 : 0) + (dockPillOn() ? 1 : 0)) + '/3 on',
"""

GEST_ROW_OLD = """        '<button class="sc-switch' + (gestures.swipe ? ' on' : '') + '" data-act="swipe" role="switch" aria-checked="' + (gestures.swipe ? 'true' : 'false') + '"><i></i></button></div>') +
"""

GEST_ROW_NEW = """        '<button class="sc-switch' + (gestures.swipe ? ' on' : '') + '" data-act="swipe" role="switch" aria-checked="' + (gestures.swipe ? 'true' : 'false') + '"><i></i></button></div>' +
        '<div class="sc-toggle-row"><div><div class="sc-toggle-name">Pill dock</div><div class="sc-toggle-sub">Joins the four tabs into one rounded dock with a highlight that slides: press and slide across it to pick a tab, or move a mouse over it to see which one a click would take.</div></div>' +
        '<button class="sc-switch' + (dockPillOn() ? ' on' : '') + '" data-act="dockpill" role="switch" aria-checked="' + (dockPillOn() ? 'true' : 'false') + '"><i></i></button></div>') +
"""

GEST_HELPER_OLD = """  var gestures = lsGet(LS.gestures, { shake: false, swipe: true }) || { shake: false, swipe: true };
"""

GEST_HELPER_NEW = """  var gestures = lsGet(LS.gestures, { shake: false, swipe: true }) || { shake: false, swipe: true };
  // 74.1.9 - the dock's joined (pill) shape is a setting the app's own script owns
  // and this block cannot see, so it is asked for through the published name - the
  // same way every other cross-block answer in the Studio is asked for.
  function dockPillOn(){ return !!call('__scDockPillOn'); }
"""

GEST_WIRE_OLD = """        else if(act === 'swipe'){ gestures.swipe = !gestures.swipe; lsSet(LS.gestures, gestures); toast(gestures.swipe ? 'Swipe the player is on' : 'Swipe the player is off'); renderStudio(); }
"""

GEST_WIRE_NEW = """        else if(act === 'swipe'){ gestures.swipe = !gestures.swipe; lsSet(LS.gestures, gestures); toast(gestures.swipe ? 'Swipe the player is on' : 'Swipe the player is off'); renderStudio(); }
        else if(act === 'dockpill'){
          var _dpOn = call('__scSetDockPill', !dockPillOn());
          toast(_dpOn ? 'Pill dock on - press and slide across the tabs to pick one' : 'Pill dock off - the four separate tabs are back');
          renderStudio();
        }
"""

# ======================================================================== 4 + 5
# Two more repairs, asked for in the SAME owner message as the three above (the
# owner, again, on 74.1.9):
#
#   "also I've seen frequent lag spikes inside the app while doing multiple
#    things simultaneously, also the Spotify to mp3 converter will frequently
#    confuse songs by the same artist while downloading a song and often
#    duplicate the same song in different metadata, this often happens when
#    downloading albums... it should download the correct audio"
#
# 4. THE CONVERTER'S IDENTITY. An album is one artist's whole run, so
#    scArtistMatch cannot tell its tracks apart and the TITLE gate is the only
#    thing standing between them - and both title gates were SUBSTRING tests.
#    "Yaar" is contained in "Yaarian"; "Pind" is contained in "Pind Waliyan".
#    So a track could take its neighbour's upload (the artist matched, the title
#    "matched"), and the neighbour was then told its own source had already been
#    claimed by the run - the same audio filed twice under two sets of tags,
#    which is the owner's "duplicate the same song in different metadata". Both
#    gates now match a RUN OF WHOLE WORDS, which turns a refusal into an
#    acceptance only where the run genuinely starts and ends on that word.
#
# 5. THE SLICE THE UI GETS BACK. The cooperative encoders hand the main thread
#    back every SC_ENCODE_SLICE_MS, and 90ms is ~5 dropped frames: while a track
#    is being converted the app stutters, which is the owner's "frequent lag
#    spikes inside the app while doing multiple things simultaneously". The slice
#    budget is now the FRAME budget while the page is on screen (12ms, one frame
#    at 60Hz) and the old, deliberately long one while the page is hidden - a
#    hidden page has no frames to drop and does three slices per wake-up, so
#    background work finishes exactly as soon as it did. The wake-up itself is
#    cheaper too (a MessageChannel hop instead of a timer, with the timer kept as
#    the fallback), because a smaller slice pays the wake-up cost more often.

IDENT_MATCH_OLD = r"""    var wantWords = want.split(' ').filter(function(w){ return w.length > 1; });
    if(!wantWords.length) return true;
    function overlap(blob){
      if(!blob) return 0;
      var hits = 0;
      for(var i = 0; i < wantWords.length; i++){
        if(blob.indexOf(wantWords[i]) !== -1) hits++;
      }
      return hits;
    }
    var best = Math.max(overlap(vt), overlap(ct));
    // Full containment is an instant pass; otherwise require most words.
    if(vt.indexOf(want) !== -1 || ct.indexOf(want) !== -1) return true;
    return best >= Math.max(2, Math.ceil(wantWords.length * 0.6));
"""

IDENT_MATCH_NEW = r"""    // 74.1.9 - A TITLE IS MATCHED AS WORDS, NEVER AS A SUBSTRING. The owner: "the
    // Spotify to mp3 converter will frequently confuse songs by the same artist while
    // downloading a song and often duplicate the same song in different metadata,
    // this often happens when downloading albums". An album is one artist's whole
    // run, so the artist check cannot tell its tracks apart and THIS check is the
    // only thing between them - and it was a substring test. Two tracks of one record
    // whose titles share a word each passed the OTHER's upload, because "Yaar" is
    // contained in "Yaarian" and "Pind" in "Pind Waliyan": the upload went to
    // whichever track asked first, and the other track was then refused its own
    // source as already claimed by the run - the same audio filed twice under two
    // sets of tags. Containment is a RUN OF WHOLE WORDS now, so "Yaarian" no longer
    // answers to "Yaar" - while every real upload that wraps the title in extra
    // words ("Song (Official Audio)", "Artist - Song") still passes, because norm()
    // has already made those the title's own words either side of it.
    var wantWords = want.split(' ').filter(function(w){ return w.length > 1; });
    if(!wantWords.length) return true;
    // Space-padded on both sides, so the phrase has to sit between word boundaries:
    // the whole difference between "yaar" and "yaarian" is that missing space.
    function hasRun(blob, phrase){
      if(!blob) return false;
      return (' ' + blob + ' ').indexOf(' ' + phrase + ' ') !== -1;
    }
    function overlap(blob){
      if(!blob) return 0;
      // Word for word as well: a hit is a word the upload actually prints, never one
      // it spells into the middle of a longer one.
      var bWords = blob.split(' ');
      var hits = 0;
      for(var i = 0; i < wantWords.length; i++){
        for(var j = 0; j < bWords.length; j++){
          if(bWords[j] === wantWords[i]){ hits++; break; }
        }
      }
      return hits;
    }
    var best = Math.max(overlap(vt), overlap(ct));
    // Full containment is an instant pass; otherwise require most words.
    if(hasRun(vt, want) || hasRun(ct, want)) return true;
    return best >= Math.max(2, Math.ceil(wantWords.length * 0.6));
"""

IDENT_STRONG_OLD = r"""  function scTitleStrong(expectedTitle, videoTitle, candTitle){
    function norm(s){
      return String(s || '').toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ').trim();
    }
    var want = norm(expectedTitle);
    if(!want) return true;
    var vt = norm(videoTitle);
    var ct = norm(candTitle);
    if(vt.indexOf(want) !== -1 || ct.indexOf(want) !== -1) return true;
"""

IDENT_STRONG_NEW = r"""  function scTitleStrong(expectedTitle, videoTitle, candTitle){
    function norm(s){
      return String(s || '').toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ').trim();
    }
    var want = norm(expectedTitle);
    if(!want) return true;
    var vt = norm(videoTitle);
    var ct = norm(candTitle);
    // 74.1.9 - THE SAME RULE AS scTitleMatch, AND HERE IT MATTERS MORE. This is the
    // exact-title bar: it is what lets an upload whose DECODED length is 15-60s off
    // still stand in as the closest cut of this track, and what makes a title claim
    // on a source count as a claim. As a substring test it passed "Yaar" for
    // "Yaarian", so the wrong recording by the right artist was not merely a
    // candidate - it was a STRONG one, and the length gate then bent around it.
    // Whole words only, exactly as above.
    function hasRun(blob, phrase){
      if(!blob) return false;
      return (' ' + blob + ' ').indexOf(' ' + phrase + ' ') !== -1;
    }
    if(hasRun(vt, want) || hasRun(ct, want)) return true;
"""

FRAME_DEF_OLD = r"""  var SC_ENCODE_SLICE_MS = 90;
"""

FRAME_DEF_NEW = r"""  var SC_ENCODE_SLICE_MS = 90;
  // 74.1.9 - THE SLICE THE UI GETS BACK WHILE IT IS ON SCREEN. The owner, on this
  // release: "frequent lag spikes inside the app while doing multiple things
  // simultaneously". 90ms of unbroken encode is ~5 dropped frames, and every
  // conversion and every re-encode pays it again; the app stutters for as long as
  // the encode runs. While the page is VISIBLE the budget is now one frame, so the
  // main thread is handed back before anyone can see it was taken. While the page
  // is HIDDEN nothing changes at all: no frames are being dropped there, and the
  // long, deliberately-chosen slice is what makes a background re-encode finish
  // soonest (see the note above).
  var SC_ENCODE_FRAME_MS = 12;
"""

FRAME_MP3_OLD = r"""      var out = chCount > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l, l);
      if(out && out.length) chunks.push(new Uint8Array(out));
      if(Date.now() - sliceStart >= SC_ENCODE_SLICE_MS * scBackSliceMul()){
"""

FRAME_MP3_NEW = r"""      var out = chCount > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l, l);
      if(out && out.length) chunks.push(new Uint8Array(out));
      if(Date.now() - sliceStart >= (document.hidden ? SC_ENCODE_SLICE_MS * scBackSliceMul() : SC_ENCODE_FRAME_MS)){
"""

FRAME_WAV_OLD = r"""      if((i2 & 4095) === 4095 && Date.now() - sliceStart >= SC_ENCODE_SLICE_MS * scBackSliceMul()){
"""

FRAME_WAV_NEW = r"""      if((i2 & 4095) === 4095 && Date.now() - sliceStart >= (document.hidden ? SC_ENCODE_SLICE_MS * scBackSliceMul() : SC_ENCODE_FRAME_MS)){
"""

YIELD_OLD = r"""  function scYieldToUI(){
    return new Promise(function(res){ setTimeout(res, 0); });
  }
"""

YIELD_NEW = r"""  function scYieldToUI(){
    // 74.1.9 - A SMALLER SLICE PAYS THE WAKE-UP COST MORE OFTEN, so the wake-up got
    // cheaper. setTimeout(0) is not "no wait": a browser clamps nested timers (4ms)
    // and a WebView with the app on screen is exactly where that happens, which is
    // a third of the run spent waiting to be scheduled again at 12ms slices. A
    // MessageChannel hop is a plain macrotask with no clamp and no timer queue, and
    // the browser is free to paint between macrotasks, which is the whole point of
    // yielding. The timer stays as the fallback for anything without MessageChannel.
    try{
      if(typeof MessageChannel === 'function'){
        if(!_scYieldCh){
          _scYieldCh = new MessageChannel();
          _scYieldCh.port1.onmessage = function(){ var r = _scYieldRes; _scYieldRes = null; if(r) r(); };
        }
        return new Promise(function(res){ _scYieldRes = res; _scYieldCh.port2.postMessage(0); });
      }
    }catch(_eYieldCh){}
    return new Promise(function(res){ setTimeout(res, 0); });
  }
  var _scYieldCh = null, _scYieldRes = null;
"""

# ============================================================================== 6
# The third report against this release, from the phone again:
#
#   "the lyrics for multi language songs is crazy it like doesn't play for 50
#    seconds while the audio is already playing and then starts really late and
#    the lyrics needs to be accurate"
#
# A lyric sheet that carries its own timestamps - LRCLIB's synced entry, or one the
# model timed - was trusted to be in sync with the file on the phone. It often is
# not: LRCLIB is community-uploaded and skews to official videos, full-length cuts
# and regional releases, so an entry can sit seconds or a whole intro away from the
# recording in the library. The only correction offered was the per-song nudge,
# clamped to +-15s - narrower than the error it exists to fix. Now the recording
# decides: every stamp is matched to the nearest real onset of THIS file, and the
# disagreements are read as one question - do the lines agree on the SAME error? A
# uniformly late sheet is another cut of the same song and gets ONE stored nudge; a
# sheet whose lines each disagree is a drift or a different song, and is left alone.

LYR_OFF_DEF_OLD = """  let lyricsSyncOffsetSec = 0;
"""

LYR_OFF_DEF_NEW = """  let lyricsSyncOffsetSec = 0;
  // 74.1.9 - the biggest error the nudge has to be able to correct. It was 15s,
  // which is smaller than the miss a wrong-version sheet arrives with (the report
  // behind this is a sheet fifty seconds out), so the one control that could have
  // fixed it by hand could not reach the error it was shown.
  var SC_LYRICS_OFF_MAX = 120;
  var SC_LYRICS_SHEET_MIN = 8;        // a smaller miss than this is the nudge's job
  var SC_LYRICS_SHEET_LEN = 0.15;     // ...and this much of a length mismatch is another cut
  var SC_LYRICS_SHEET_SUSPECT = 12;   // a sheet whose first words start this late is worth a decode
"""

LYR_NUDGE_OLD = "Math.max(-15, Math.min(15, Math.round((lyricsSyncOffsetSec + delta) * 10) / 10))"

LYR_NUDGE_NEW = "Math.max(-SC_LYRICS_OFF_MAX, Math.min(SC_LYRICS_OFF_MAX, Math.round((lyricsSyncOffsetSec + delta) * 10) / 10))"

# Put in front of the evenly-spaced detector, so the whole envelope-to-offset unit
# (the quiet floor, the break finder, the measurement itself) slices out of the page in
# one piece for the probe - the same seam dev/test-66424 uses for the title gates.
LYR_MEASURE_OLD = "  // The fingerprint of the old guess: every gap between lines the same size.\n"

LYR_MEASURE_NEW = """  /* --------------------------------------------------------------------------
     74.1.9 - THE WORDS LINE UP WITH THE SONG, NOT WITH SOMEBODY ELSE'S COPY
     --------------------------------------------------------------------------
     The report: "the lyrics for multi language songs is crazy it like doesn't play
     for 50 seconds while the audio is already playing and then starts really late
     and the lyrics needs to be accurate".

     A stamped sheet was trusted in silence. This measures it instead, against the
     only thing that is at the right time: the recording. Each stamp is matched to
     the nearest real onset of THIS file - the same bar scTimeLyricsFromOnsets snaps
     to, and the same refusal to park a line inside a measured quiet stretch - and
     the differences are read as ONE question, because that is the only question a
     listener can answer: do the lines agree on the same error? A sheet that is
     uniformly late is another cut of the same song, and the answer is one number.
     A sheet whose lines disagree is drifting or belongs to a different song, and
     shifting it would only move the error around, so it is left exactly as it is.
     -------------------------------------------------------------------------- */
  function scLyricsSheetOffset(rows, env, hopSec, duration){
    if(!rows || rows.length < 4 || !env || !env.length) return null;
    var hop = hopSec > 0 ? hopSec : 0.02;
    var dur = Number(duration) || 0;
    var peak = 0;
    for(var m = 0; m < env.length; m++){ if(env[m] > peak) peak = env[m]; }
    if(!(peak > 0)) return null;
    // WHERE THE SINGING RUNS, from the same envelope the layout already reads. The
    // floor is scQuietFloor's own line: this asks where the song is, not where the
    // syllables are, because the syllables are the one thing a uniform offset leaves
    // exactly where they were - which is why they cannot measure it.
    var floor = peak * 0.05;
    var firstLive = -1, lastLive = -1;
    for(var f = 0; f < env.length; f++){
      if(env[f] > floor){ if(firstLive < 0) firstLive = f; lastLive = f; }
    }
    if(firstLive < 0) return null;
    var sungStart = firstLive * hop, sungEnd = (lastLive + 1) * hop;
    var sungSpan = sungEnd - sungStart;
    if(!(sungSpan > 0)) return null;
    // The words that are inside this file at all.
    var sFirst = -1, seen = 0;
    for(var i = 0; i < rows.length; i++){
      var t = Number(rows[i].t);
      if(!isFinite(t) || t < 0) continue;
      if(dur > 0 && t > dur + 1) continue;
      if(sFirst < 0 || t < sFirst) sFirst = t;
      seen++;
    }
    if(seen < 4 || sFirst < 0) return null;
    // THE ANSWER: the words begin where the singing begins. A song with a long
    // instrumental opening says so itself - its singing starts late too, the two
    // difference to zero, and nothing is touched.
    var off = Math.round((sFirst - sungStart) * 10) / 10;
    if(Math.abs(off) < SC_LYRICS_SHEET_MIN) return null;      // the nudge's job, not this one's
    if(Math.abs(off) > SC_LYRICS_OFF_MAX) return null;         // refuse; never clamp a lie
    // ...and the shift has to leave every word inside the song. Words parked in a
    // measured break, or pushed past the end of the singing, are a different cut being
    // forced onto this one - the one thing the recording can prove, so it is refused.
    var gaps = scFindQuietGaps(env, hop, dur);
    var outside = 0, lastAt = -1;
    for(var j = 0; j < rows.length; j++){
      var rt = Number(rows[j].t);
      if(!isFinite(rt) || rt < 0 || (dur > 0 && rt > dur + 1)) continue;
      var at = rt - off;
      if(at < sungStart - 4 || at > sungEnd + 4){
        outside++;
        continue;
      }
      if(at > lastAt) lastAt = at;
      for(var gi = 0; gi < gaps.length; gi++){
        if(at >= gaps[gi].s && at <= gaps[gi].e){ outside++; break; }
      }
    }
    if(outside > Math.max(1, Math.floor(seen * 0.1))) return null;
    // The shifted words also have to COVER the singing rather than sit in one end of
    // it: a jingle's worth of lines cannot be the sheet for a full song.
    if(lastAt < 0 || (lastAt - sungStart) < sungSpan * 0.5) return null;
    return off;
  }
  var scLyricsAlignBusy = false;
  var scLyricsAlignKey = '';
  // The measurement above, run on the song that is playing, written where every
  // other nudge lives - so it shows in the sheet's own label, survives a restart,
  // and one tap of the reset button takes it back off.
  async function scAutoAlignLyricsToAudio(){
    try{
      var tid = (queueIndex >= 0 && queueIndex < queue.length) ? queue[queueIndex] : null;
      var t = tid ? allTracks.find(function(tr){ return tr.id === tid; }) : null;
      if(!t || !t.file || !currentLyricsText) return false;
      if(scLyricsAlignedNow()) return false;              // the owner's own taps win
      var key = String(tid) + '|' + currentLyricsText.length;
      if(scLyricsAlignKey === key || scLyricsAlignBusy) return false;
      var rows = scParseLrcLines(currentLyricsText);
      if(rows.length < 4) return false;
      // AND ONLY A SHEET THE REPORT DESCRIBES IS WORTH A DECODE. Measuring means
      // decoding the file, which is a second of work and a second of battery, so it
      // is spent on the two shapes that are actually wrong: a sheet whose first
      // words begin tens of seconds in, and one whose tail runs past the end of
      // THIS file (which is what a sheet for a longer cut does). A song may open
      // with a long instrumental, so a late first word is only a suspicion - the
      // measurement below is what decides, and its answer for an honest sheet is
      // nothing at all.
      var firstStamp = null, lastStamp = null;
      for(var ri = 0; ri < rows.length; ri++){
        var rt = Number(rows[ri].t);
        if(!isFinite(rt) || rt < 0) continue;
        if(firstStamp === null || rt < firstStamp) firstStamp = rt;
        if(lastStamp === null || rt > lastStamp) lastStamp = rt;
      }
      var dur0 = Number(t.duration) || 0;
      var suspicious = (firstStamp !== null && firstStamp > SC_LYRICS_SHEET_SUSPECT) ||
                       (dur0 > 0 && lastStamp !== null && lastStamp > dur0 + SC_LYRICS_SHEET_MIN);
      if(!suspicious) return false;
      scLyricsAlignBusy = true;
      var arr = await blobToArrayBufferFallbackCrop(t.file);
      if(!arr) return false;
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var decoded = null;
      try{ decoded = await ctx.decodeAudioData(arr); }catch(_eDec){ decoded = null; }
      try{ ctx.close(); }catch(_eClose){}
      if(!decoded) return false;
      var off = scLyricsSheetOffset(rows, scOnsetEnvelope(decoded), SC_ONSET_HOP, decoded.duration || t.duration || 0);
      scLyricsAlignKey = key;
      if(off === null) return false;
      // The song may have moved on while the audio decoded.
      var still = (queueIndex >= 0 && queueIndex < queue.length) ? queue[queueIndex] : null;
      if(String(still) !== String(tid) || lyricsCurrentTrack !== tid) return false;
      lyricsSyncOffsetSec = off;
      try{ dbPut('meta', { key: 'lyricsSyncOff_' + String(tid), value: off }); }catch(_ePut){}
      try{ updateLyricsSyncLabel(); }catch(_eLbl){}
      lastLyricsIdx = -1;                                 // re-pick the live line now
      toast('Lyrics lined up with this song (moved ' + Math.abs(off).toFixed(1) + 's)', 2600);
      return true;
    }catch(_eAlign){ return false; }
    finally{ scLyricsAlignBusy = false; }
  }

  // The fingerprint of the old guess: every gap between lines the same size.
"""

# ...and called from the one place a sheet becomes the sheet on screen: the auto
# timing block in showLyrics(). It only ran for a sheet WITHOUT stamps (or one shaped
# like the old even split), which is exactly why a stamped sheet fifty seconds out
# was never looked at twice.
LYR_ALIGN_CALL_OLD = """        }catch(_eAutoTimeCall){}
      }
    }
"""

LYR_ALIGN_CALL_NEW = """        }catch(_eAutoTimeCall){}
      } else {
        // 74.1.9 - a sheet WITH stamps is not a sheet in sync with this file. The
        // recording is asked how far out it is and the answer becomes the song's
        // nudge; a sheet that is simply right is left alone by the same measurement.
        try{ scAutoAlignLyricsToAudio(); }catch(_eAlignCall){}
      }
    }
"""

# ============================================================================== 7
# The fourth report against this release, and the shortest:
#
#   "the in tab thing that shows up after you download a song should be replaced
#    with open library"
#
# The "in tab thing" is the conversion pill - the little card that appears while a song
# is being saved and stays for nine seconds afterwards. When the run added songs it
# carried the run's own SENTENCE as its title ("3 songs added to your library") and put
# the way into the library in a small line underneath, so the one thing anyone wants at
# the end of a save - getting in to hear it - read as a status report. The action is the
# label now, and what happened is kept underneath it. The pill was already tappable and
# still opens All Songs; a run that added nothing still says so and still points at the
# bell rather than promising a library it did not fill - and that second half is its own
# repair, because "did this run fill the library" was a substring test on the run's own
# sentence: "Cancelled - nothing was added" contains "added", and so does the batch line
# for a run where every track failed ("0 songs added to your library - 3 failed"). Either
# one used to promise a library that was never filled, so the test now reads the count as
# well as the words.
PILL_TITLE_OLD = r"""    var t = pill.querySelector('.sc-pill-title');
    if(t) t.textContent = text || 'Conversions finished';
    var s = pill.querySelector('.sc-pill-sub');
    var pc = pill.querySelector('.sc-pill-cancel');
    if(pc){ pc.style.display = 'none'; }
    var _dtxt = String(text || '');
    var _opened = /library|added/i.test(_dtxt) && !/could not/i.test(_dtxt);
    if(s) s.textContent = _opened ? 'Tap here to open your library — All Songs' : 'See the \uD83D\uDD14 bell for details';
"""

PILL_TITLE_NEW = r"""    var pc = pill.querySelector('.sc-pill-cancel');
    if(pc){ pc.style.display = 'none'; }
    var _dtxt = String(text || '');
    // 74.1.9 - AND A RUN THAT SAVED NOTHING KEEPS ITS OWN TEXT, INCLUDING BY COUNT.
    // Two sentences that reach here are not a filled library: a cancelled single save
    // says "Cancelled - nothing was added", and a batch where every track failed says
    // "0 songs added to your library - 3 failed", which contains "added to your
    // library" and was read as a success. The first is excluded by its own words, the
    // second by the count, so the pill never offers a library it did not fill.
    var _opened = /library|added/i.test(_dtxt) &&
      !/could not|nothing was added|(\D|^)0 songs/i.test(_dtxt);
    // 74.1.9 - WHAT THE FINISHED PILL SAYS, AND WHY IT WAS THE WRONG WAY ROUND. The
    // title used to be the run's sentence and the way in was the small print under it,
    // so the only thing anyone wants at the end of a save - getting in to hear it -
    // read as a report about a save. The action is the label; what happened is under it.
    var t = pill.querySelector('.sc-pill-title');
    if(t) t.textContent = _opened ? 'Open library' : (text || 'Conversions finished');
    var s = pill.querySelector('.sc-pill-sub');
    if(s) s.textContent = _opened ? (text + ' · tap to open') : 'See the \uD83D\uDD14 bell for details';
"""

