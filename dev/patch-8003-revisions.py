"""80.0.3 - the revisions the owner asked for while the release was open.

The first cut of the Studio split put Studio on the top-left half and Tools on the
bottom-right, and the Look-and-feel card in Settings -> More as well as in Tools.
The owner looked at it and said no to both: "studio sharing a diagonal, tools should
be their right", and "the new look shouldn't be in settings and more just In tools".

So this file carries the difference between the page dev/patch-8003.py's own steps
produce and the page that actually ships, as one unified diff, and patch-8003.py
applies it after its steps - by `git apply`, byte for byte, rather than by another
dozen hand-written anchors. It covers three files:

  index.html                      the pill cut left/right, the seam table the hit
                                  test and the drawn line now share, the look card
                                  that is only built into Tools, the release notes
  dev/revamp-check.cjs            [8] asserts the card is in Tools and NOT in
                                  Settings -> More, and that only one copy exists
  dev/album-follow-dock-check.cjs the drift test expects the Tools half

dev/release-proof.sh hashes every dev/patch-8003-*.py, so this file is part of the
proof that the prepared tree is the rehearsed one.
"""

REVISIONS_PATCH = r'''--- a/index.html
+++ b/index.html
@@ -2475,7 +2475,8 @@
 body.sc-dock-pill .action-strip > .action-pill.sc-dock-hot{
   background: transparent; border-color: transparent; color: var(--ink); font-weight: 700;
 }
-body.sc-dock-pill #playlistsHalf.sc-dock-hot span, body.sc-dock-pill #albumsHalf.sc-dock-hot span{ color: var(--ink) !important; }
+body.sc-dock-pill #playlistsHalf.sc-dock-hot span, body.sc-dock-pill #albumsHalf.sc-dock-hot span,
+body.sc-dock-pill #studioHalf.sc-dock-hot span, body.sc-dock-pill #toolsHalf.sc-dock-hot span{ color: var(--ink) !important; }
 /* The plus is not part of the capsule - it opens a menu rather than going
    somewhere - so it keeps its own fill, its own shape and its own place. */
 body.sc-dock-pill .action-strip > .action-pill.dock-add{
@@ -2996,11 +2997,13 @@
 .sc80-pane{ display: none; flex-direction: column; }
 .sc80-pane.active{ display: flex; }
 .sc80-pane .sc-sec:first-child{ margin-top: 0; }
-/* The Studio pill is cut corner to corner like the Library pill: the two halves
-   are the controls, and the diagonal is the seam between them. */
-#studioBtn{ flex: 1.18 1 0; border-radius: 14px; }
-#studioBtn #studioHalf, #studioBtn #toolsHalf{ transition: background 0.15s; }
-#studioBtn #studioHalf span, #studioBtn #toolsHalf span{ font-size: 9.5px; }
+/* The Studio pill is cut diagonally the way the Library pill is. Studio is the
+   LEFT of the pill and Tools the RIGHT, so the two names read across: the pill is
+   wide and short, and two names stacked one above the other were two rows of
+   9.5px type fighting for 44px of height. */
+#studioBtn{ flex: 1.5 1 0; border-radius: 14px; }
+#studioBtn #studioHalf, #studioBtn #toolsHalf{ align-items: center; transition: background 0.15s; }
+#studioBtn #studioHalf span, #studioBtn #toolsHalf span{ font-size: 9.5px; letter-spacing: 0.2px; }
 #studioHalf:active, #toolsHalf:active{ transform: scale(0.97); }
 #studioHalf:hover, #toolsHalf:hover{ background: rgba(255,255,255,0.06); }
 #studioHalf.active-half, #toolsHalf.active-half{ background: transparent !important; }
@@ -3145,8 +3148,12 @@
 }
 body.sc80-cloud .action-strip > *{ flex: 1 1 0; width: auto; min-width: 0; }
 body.sc80-cloud .action-strip > .dock-add{ flex: 0 0 46px; }
-body.sc80-cloud .action-strip > #libraryBtn,
-body.sc80-cloud .action-strip > #studioBtn{ flex: 1.18 1 0; }
+body.sc80-cloud .action-strip > #libraryBtn{ flex: 1.18 1 0; }
+/* The Studio pill carries two names on one line, so it needs the room the other
+   pills do not: measured at 390px, 1.18 gave it 73px and the two names met at the
+   seam with two pixels between them. 1.5 gives it 92px - a gap wide enough to see
+   the cut through, and a cut angled enough to read as a diagonal. */
+body.sc80-cloud .action-strip > #studioBtn{ flex: 1.5 1 0; }
 body.sc80-cloud .action-pill{
   border-radius: 16px;
   font-size: 10.5px;
@@ -3425,18 +3432,19 @@
   <svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;z-index:3;"><line x1="100%" y1="0" x2="0" y2="100%" stroke="var(--line)" stroke-width="1"/></svg>
 </button>
   <button id="discoverBtn" class="action-pill">Discover</button>
-  <!-- 80.0.3 - the Studio tab, cut corner to corner the way the Library tab has
-       been since 70.0: the top-left half is the studio work, the bottom-right
-       half is Tools. Both halves are in the one pill, and there is no second tab
-       bar inside the Studio view any more. -->
+  <!-- 80.0.3 - the Studio tab, cut diagonally the way the Library tab has been
+       since 70.0. Studio is the LEFT half and Tools the RIGHT half, both on one
+       line: the seam runs from 60% of the pill's width at the top to 40% at the
+       bottom. Both halves are in the one pill, and there is no second tab bar
+       inside the Studio view any more. -->
   <button id="studioBtn" class="action-pill" style="position:relative;overflow:hidden;padding:0;cursor:pointer;">
-  <div id="studioHalf" data-studio-tab="studio" style="position:absolute;inset:0;clip-path:polygon(0 0, 100% 0, 0 100%);display:flex;align-items:flex-start;justify-content:flex-start;padding:4px 0 0 8px;cursor:pointer;z-index:2;transition:background 0.15s;">
-    <span style="font-size:10px;font-weight:700;color:var(--ink-dim);letter-spacing:0.3px;">Studio</span>
+  <div id="studioHalf" data-studio-tab="studio" style="position:absolute;inset:0;clip-path:polygon(0 0, 60% 0, 40% 100%, 0 100%);display:flex;align-items:center;justify-content:flex-start;box-sizing:border-box;padding:0 0 0 6px;cursor:pointer;z-index:2;transition:background 0.15s;">
+    <span style="font-size:9.5px;font-weight:700;color:var(--ink-dim);letter-spacing:0.2px;">Studio</span>
   </div>
-  <div id="toolsHalf" data-studio-tab="tools" style="position:absolute;inset:0;clip-path:polygon(100% 0, 100% 100%, 0 100%);display:flex;align-items:flex-end;justify-content:flex-end;padding:0 8px 4px 0;cursor:pointer;z-index:1;transition:background 0.15s;">
-    <span style="font-size:10px;font-weight:700;color:var(--ink-dim);letter-spacing:0.3px;">Tools</span>
+  <div id="toolsHalf" data-studio-tab="tools" style="position:absolute;inset:0;clip-path:polygon(60% 0, 100% 0, 100% 100%, 40% 100%);display:flex;align-items:center;justify-content:flex-end;box-sizing:border-box;padding:0 6px 0 0;cursor:pointer;z-index:1;transition:background 0.15s;">
+    <span style="font-size:9.5px;font-weight:700;color:var(--ink-dim);letter-spacing:0.2px;">Tools</span>
   </div>
-  <svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;z-index:3;"><line x1="100%" y1="0" x2="0" y2="100%" stroke="var(--line)" stroke-width="1"/></svg>
+  <svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;z-index:3;"><line x1="60%" y1="0" x2="40%" y2="100%" stroke="var(--line)" stroke-width="1"/></svg>
 </button>
   <button id="dockAddBtn" class="action-pill dock-add" title="Add songs" aria-label="Add songs">
     <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
@@ -14896,11 +14904,12 @@
   const CHANGELOG = [
   { version: '80.0.3', date: 'October 21, 2026 \u00b7 9:15 AM EDT', title: 'The tabs move over the screen, and Tools is a half of the Studio tab', items: [
     'The tabs are one bar across the top of the screen now, floating over the bubbles so the wall scrolls underneath them.',
-    'The Studio tab is a diagonal split - Studio on one half, Tools on the other - so Tools is a tab in the dock you can tap, not a tab hidden inside Studio.',
+    'The Studio tab is a diagonal split - Studio on the left of the pill, Tools on the right - so Tools is a tab in the dock you can tap, not a tab hidden inside Studio.',
     'Opening Studio no longer shows a second tab bar: the Studio view is just its two halves of work.',
     'The player is back on the bottom edge of the screen in the bubbles layout, where a thumb can reach it.',
     'The header keeps one row now: the bell, refresh and settings stop doubling up, and the small now-playing pill sits in the corner they freed.',
     'The Library pill and the Studio pill are cut the same way, so the two split tabs read as one idea.',
+    'Look and feel lives in Studio, Tools only now - the second copy in Settings, More is gone.',
     'The home-screen widget, the player, the letter-by-letter lyrics, the album pill dock and the albums are exactly where 80.0.2 left them.',
   ],
     details: [
@@ -14909,6 +14918,7 @@
       'The tab bar that 80.0 put inside the Studio view is gone. Tools is a place in the dock now, so there is one place to look for it and the view keeps its room for the work.',
       'The player was being lifted by the height of the dock so it would clear it. In the bubbles layout the dock is at the top, so that arithmetic put the player in the middle of the page over the bubbles; it sits on the bottom edge now, above the safe area, with nothing underneath it.',
       'The three header buttons move onto the listening-stats bubble in this layout, and their old row was supposed to hide. It did not, because its own inline style beat the stylesheet, so the same three buttons were on the screen twice and the small now pill was drawn over them. The row hides for real now and the pill has that corner.',
+      'The four buttons that choose the layout and the pinned window were in two places at once, and the one in Settings, More only worked if Settings had been opened. Studio, Tools, Look and feel is the one now, beside the milestones, where the rest of the switches for the look of the app already are; nothing else left the More pane.',
       'Two splits in one dock could easily read as two different ideas; they are the same seam, the same corner-to-corner cut and the same corner labels, so a tap in the top-left half means the first thing and a tap in the bottom-right half means the second, in both pills.',
       'Nothing about the music changed in this release: the widget, the player, the letter-by-letter lyrics and the albums are untouched.',
     ] },
@@ -37534,10 +37544,10 @@
     navigate($('discoverView').classList.contains('active') ? 'home' : 'discover');
   });
   // 80.0.3 - the Studio tab is a diagonal split, the same construction the
-  // Library tab has used since 70.0: the top-left half is the studio work, the
-  // bottom-right half is Tools. Both halves land on the Studio view and pick
-  // their pane; there is no second tab bar inside the view for either to fight
-  // with. Tapping the half you are already on leaves you where you are (the old
+  // Library tab has used since 70.0: Studio is the left of the pill, Tools the
+  // right, with the cut running top to bottom between them. Both halves land on
+  // the Studio view and pick their pane; there is no second tab bar inside the
+  // view for either to fight with. Tapping the half you are already on leaves you where you are (the old
   // single pill toggled back to Home, which a two-sided tab cannot do without
   // one side meaning two things).
   $('studioBtn').addEventListener('click', (ev) => {
@@ -37660,17 +37670,44 @@
     }
     return { strip: strip, track: track, thumb: thumb, seam: seam };
   }
-  // Which half of the split Library tab a point is over. The halves are the two
-  // triangles of a diagonal cut, so this is the test the clip-path draws: the
-  // top-left triangle is Library, the bottom-right is Albums.
+  // Which half of a split tab a point is over. Both split tabs are cut by one line,
+  // and that line is written down once here so the hit test, the highlight's shape
+  // and the drawn seam cannot disagree about where the cut is:
+  //   libraryBtn - corner to corner, top-right to bottom-left: the top-left
+  //                triangle is Library, the bottom-right is Albums.
+  //   studioBtn  - the same cut stood on its side, x = 0.60 at the top to 0.40 at
+  //                the bottom: Studio owns the left of the pill, Tools the right.
+  var SC_DOCK_SPLITS = {
+    libraryBtn: { ids: ['playlistsHalf', 'albumsHalf'], edge: 0.5,
+                  line: function(xn, yn){ return xn + yn - 1; } },
+    studioBtn:  { ids: ['studioHalf', 'toolsHalf'], edge: 0.60,
+                  line: function(xn, yn){ return xn - (0.60 - 0.20 * yn); } }
+  };
+  // ...and the same table read the other way round: which split a HALF belongs to.
+  // The two lookups stay apart because the box of a whole pill and the box of one of
+  // its halves are not the same box, and confusing them would draw the highlight
+  // over half the dock.
+  function scDockSplitHalf(el){
+    if(!el || !el.id) return null;
+    for(var k in SC_DOCK_SPLITS){
+      if(SC_DOCK_SPLITS[k].ids.indexOf(el.id) !== -1) return SC_DOCK_SPLITS[k];
+    }
+    return null;
+  }
+  function scDockSplitOf(el){
+    if(!el || !el.id) return null;
+    return SC_DOCK_SPLITS[el.id] || scDockSplitHalf(el);
+  }
   function scDockPillHalf(seg, x, y){
     try{
-      if(!seg || seg.id !== 'libraryBtn') return seg;
+      var sp = seg ? SC_DOCK_SPLITS[seg.id] : null;
+      if(!sp) return seg;
       var r = seg.getBoundingClientRect();
       if(!r.width || !r.height) return seg;
-      var pl = document.getElementById('playlistsHalf'), al = document.getElementById('albumsHalf');
-      if(!pl || !al) return seg;
-      return (((x - r.left) / r.width) + ((y - r.top) / r.height)) < 1 ? pl : al;
+      var a = document.getElementById(sp.ids[0]), b = document.getElementById(sp.ids[1]);
+      if(!a || !b) return seg;
+      // Negative on the first half's side of the line, positive on the second's.
+      return sp.line((x - r.left) / r.width, (y - r.top) / r.height) < 0 ? a : b;
     }catch(e){ return seg; }
   }
   // A POINT IN A SEAM BELONGS TO THE NEARER PILL. The tabs sit a few pixels apart,
@@ -37726,6 +37763,14 @@
         var pl = document.getElementById('playlistsHalf'), al = document.getElementById('albumsHalf');
         if(pl && al) return (typeof libraryMode !== 'undefined' && libraryMode === 'albums') ? al : pl;
       }
+      if(segs[i].id === 'studioBtn'){
+        var sh = document.getElementById('studioHalf'), th = document.getElementById('toolsHalf');
+        if(sh && th){
+          var st = 'studio';
+          try{ if(window.SC80 && SC80.studioTab) st = SC80.studioTab(); }catch(_eSt){}
+          return st === 'tools' ? th : sh;
+        }
+      }
       return segs[i];
     }
     return segs.length ? segs[0] : null;
@@ -37736,13 +37781,19 @@
     var sr = strip.getBoundingClientRect();
     var r = target.getBoundingClientRect();
     var left = r.left, width = r.width, top = r.top, height = r.height;
-    var half = null, pill = null;
-    if(target.id === 'albumsHalf' || target.id === 'playlistsHalf'){
+    var half = null, pill = null, line = null;
+    var sp = scDockSplitHalf(target);
+    if(sp && target.parentNode){
       var pr = target.parentNode.getBoundingClientRect();
-      half = target.id === 'albumsHalf' ? 'al' : 'pl';
+      var first = sp.ids.indexOf(target.id) === 0;
+      // -1 keeps the first half's side of the cut, +1 the second's.
+      half = first ? -1 : 1;
+      line = sp.line;
       pill = pr;
-      left = pr.left + (target.id === 'albumsHalf' ? pr.width / 2 : 0);
-      width = pr.width / 2;
+      // The highlight's own box is the slice of the pill that half occupies: half
+      // the width for the Library cut, and the 56% the Studio cut gives each side.
+      left = pr.left + (first ? 0 : pr.width * (1 - sp.edge));
+      width = pr.width * sp.edge;
       top = pr.top;
       height = pr.height;
     }
@@ -37751,7 +37802,7 @@
     // the clip-path is written in the percentages of the highlight's own box.
     return { left: left - sr.left, top: top - sr.top, width: width, height: height,
              vleft: left, vtop: top, vright: left + width, vbottom: top + height,
-             half: half, pill: pill };
+             half: half, pill: pill, line: line };
   }
   // THE SHAPE OF A HALF. The divider runs the pill's full width: from its top-right
   // corner to its bottom-left one, which is the line `scDockPillHalf` tests a point
@@ -37765,9 +37816,11 @@
       // The highlight sits 4px inside the half, the same inset the capsule gives it.
       var box = { left: b.vleft + 4, top: b.vtop + 4, right: b.vright - 4, bottom: b.vbottom - 4 };
       if(!(box.right > box.left) || !(box.bottom > box.top)) return '';
-      // Negative on the top-left (Playlists) side of the divider, positive below it.
-      function f(x, y){ return ((x - pr.left) / pr.width) + ((y - pr.top) / pr.height) - 1; }
-      var keep = b.half === 'pl' ? -1 : 1;
+      // Negative on the first half's side of the divider, positive on the second's -
+      // the very line scDockPillHalf tests a finger against.
+      var line = b.line;
+      function f(x, y){ return line((x - pr.left) / pr.width, (y - pr.top) / pr.height); }
+      var keep = b.half;
       var poly = [[box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom]];
       var out = [];
       for(var i = 0; i < poly.length; i++){
@@ -37790,7 +37843,7 @@
   function scDockPillMark(el){
     try{
       scDockPillSegs.forEach(function(s){ s.classList.toggle('sc-dock-hot', s === el); });
-      ['playlistsHalf', 'albumsHalf'].forEach(function(id){
+      ['playlistsHalf', 'albumsHalf', 'studioHalf', 'toolsHalf'].forEach(function(id){
         var h = document.getElementById(id);
         if(h) h.classList.toggle('sc-dock-hot', h === el);
       });
@@ -55218,32 +55271,7 @@
   }
 
   /* ------------------------------------------------------------------------
-     5. SETTINGS & MORE - the two switches, in the place people look for them
-     ------------------------------------------------------------------------ */
-  function mountSettings(){
-    var pane = $('settingsPaneMore');
-    if(!pane || $('sc80Look')) return;
-    var card = document.createElement('div');
-    card.className = 'sc80-settings-card';
-    card.style.cssText = 'margin:0 0 14px; padding:12px 14px; border:1px solid var(--line); border-radius:14px; background:rgba(255,255,255,0.03);';
-    card.innerHTML = '<div style="font-size:12.5px; font-weight:700;">The new look · ' + esc(VERSION) + '</div>' +
-      '<div style="font-size:11px; color:var(--ink-dim); margin-top:3px; line-height:1.45;">A second layout, and a choice of pinned-artists window. The original is the default and never goes away.</div>' +
-      '<div class="sc80-opt-row">' +
-        '<button class="sc80-opt' + (isCloud() ? '' : ' on') + '" data-sc80-layout="classic">Classic tabs<small>Bottom tabs, card bubbles - the original.</small></button>' +
-        '<button class="sc80-opt' + (isCloud() ? ' on' : '') + '" data-sc80-layout="cloud">Cloud bubbles<small>Round floating bubbles, dock on the right, small now bar up top.</small></button>' +
-      '</div>' +
-      '<div class="sc80-opt-row">' +
-        '<button class="sc80-opt' + (pinnedLayout() === 'grid' ? '' : ' on') + '" data-sc80-pinned="row">Pinned: four in a row<small>Sideways scroll, four on screen.</small></button>' +
-        '<button class="sc80-opt' + (pinnedLayout() === 'grid' ? ' on' : '') + '" data-sc80-pinned="grid">Pinned: eight squares<small>2 x 4 window of smaller squares.</small></button>' +
-      '</div>';
-    card.id = 'sc80Look';
-    pane.insertBefore(card, pane.firstChild);
-    wireLookCard(card);
-    paintOptions();
-  }
-
-  /* ------------------------------------------------------------------------
-     6. WIRING
+     5. WIRING
      ------------------------------------------------------------------------ */
   var toastEl = null;
   function toast(msg){
@@ -55269,7 +55297,6 @@
 
   function start(){
     try{ applyLayout(); }catch(e){}
-    try{ mountSettings(); }catch(e){}
     try{ watchStudio(); }catch(e){}
     try{ watchDock(); }catch(e){}
     try{ watchTabStrip(); }catch(e){}
--- a/dev/revamp-check.cjs
+++ b/dev/revamp-check.cjs
@@ -11,14 +11,18 @@
 //       called Unsorted (which it does as soon as a song has no playlist);
 //   [3] pinned artists: the row is the default, the grid is a switch, both are
 //       remembered, and neither caps the number of pins;
-//   [4] cloud layout: circles, the dock on the right, the small now bar, the three
-//       header buttons on the stats bubble - and classic puts every one back;
+//   [4] cloud layout: circles, the tabs as a bar ACROSS the top (80.0.3: not a
+//       rail down the right), the views clearing it, the player on the bottom
+//       edge, the small now bar, the three header buttons on the stats bubble -
+//       and classic puts every one back;
 //   [5] the celebration: number, unit, once-per-milestone record, replay from
 //       Studio, and the manual replay that does not mark anything;
-//   [6] Studio is one pill split down the diagonal into Studio and Tools, with the
-//       non-studio sections moved and the chosen tab remembered;
+//   [6] the Studio TAB is the diagonal split - Studio on one half, Tools on the
+//       other, in the dock - with the non-studio sections moved, no tab bar left
+//       inside the view, and the chosen half remembered;
 //   [7] the dock highlight exists and the tab strip keeps the active tab in view;
-//   [8] Settings -> More carries both switches;
+//   [8] the look switches live in Studio, Tools only - Settings, More carries no
+//       second copy of them;
 //   [9] no uncaught page errors while any of this ran.
 const fs = require('fs');
 const path = require('path');
@@ -245,8 +249,20 @@
     ok(!!doc.getElementById('notifBtn') && !!doc.getElementById('refreshBtn') && !!doc.getElementById('themeBtn'),
       'the real header buttons are still on the page (hidden, not deleted)');
     const css = html.replace(/\s+/g, ' ');
-    ok(/body\.sc80-cloud \.action-strip\{[^}]*right: 10px/.test(css), 'the dock floats on the right');
-    ok(/body\.sc80-cloud \.action-strip\{[^}]*flex-direction: column/.test(css), 'as a column');
+    ok(/body\.sc80-cloud \.action-strip\{[^}]*left: 10px; right: 10px/.test(css), 'the dock is a bar across the top');
+    ok(/body\.sc80-cloud \.action-strip\{[^}]*flex-direction: row/.test(css), 'laid out in a row, not a column');
+    ok(/body\.sc80-cloud \.action-strip\{[^}]*top: calc\(env\(safe-area-inset-top\) \+ var\(--sc80-head\) \+ 6px\)/.test(css),
+      'floating under the header, over the content');
+    ok(/body\.sc80-cloud #homeView, body\.sc80-cloud #library[^{]*\{[^}]*padding-top: calc\(var\(--sc80-bar\) \+ 12px\)/.test(css),
+      'and the views give its band back as padding so the wall scrolls under it');
+    // Two rules, on purpose: dev/studio-70-check counts every `#nowPlaying` rule that
+    // reserves the bottom inset as a padding rule, so the bottom edge is its own
+    // declaration. Asserted as the pair, so either half going missing is red.
+    ok(/body\.sc80-cloud #nowPlaying\{ padding-right: 0; \}/.test(css) &&
+       /body\.sc80-cloud #nowPlaying\{ bottom: env\(safe-area-inset-bottom\); \}/.test(css),
+      'the player sits on the bottom edge again, not above a rail');
+    ok(/body\.sc80-cloud header > div:last-child\{ display: none !important/.test(css),
+      'the header row really hides (its wrapper carries an inline display:flex)');
     ok(/body\.sc80-cloud \.home-bubble\{[^}]*border-radius: 50%/.test(css), 'and the bubbles are round');
     ok(/body\.sc80-cloud \.brand span\{ display: none/.test(css), 'the your files no ads line is gone in this layout');
     ok(win.localStorage.getItem('sc80Layout') === '"cloud"', 'the layout choice is remembered');
@@ -290,25 +306,45 @@
     click(win, doc.getElementById('sc80Milestone').querySelector('[data-sc80-close]:not([data-sc80-replay])'));
   }
 
-  console.log('[6] Studio: one pill, split down the diagonal');
+  console.log('[6] Studio: the diagonal split is the dock tab, not a bar in the view');
   {
-    click(win, doc.getElementById('studioBtn'));
-    await wait(600);
     const host = doc.getElementById('studioView');
-    const bar = host.querySelector('.sc80-tabs');
-    ok(!!bar, 'the Studio tab bar is on the page');
-    ok(bar && bar.querySelectorAll('.sc80-tab').length === 2, 'two halves');
-    const names = bar ? Array.from(bar.querySelectorAll('.sc80-tab')).map((b) => b.getAttribute('data-tab')) : [];
-    ok(names.join('|') === 'studio|tools', 'called Studio and Tools (' + names.join('|') + ')');
-    const labels = bar ? Array.from(bar.querySelectorAll('.sc80-tab')).map((b) => (b.firstChild && b.firstChild.textContent || '').trim()) : [];
-    ok(labels.join('|') === 'Studio|Tools', 'and both halves are labelled (' + labels.join('|') + ')');
-    const line = bar && bar.querySelector('line');
-    ok(!!line && line.getAttribute('x1') === '100%' && line.getAttribute('y1') === '100%' &&
-       line.getAttribute('x2') === '0' && line.getAttribute('y2') === '0',
-       'the diagonal runs bottom right to top left (' + (line && [line.getAttribute('x1'), line.getAttribute('y1'), line.getAttribute('x2'), line.getAttribute('y2')].join(' ')) + ')');
+    ok(!host.querySelector('.sc80-tabs') && !host.querySelector('.sc80-tab'),
+      'there is no tab bar inside the Studio view any more');
+    const btn = doc.getElementById('studioBtn');
+    const sh = doc.getElementById('studioHalf');
+    const th = doc.getElementById('toolsHalf');
+    ok(!!btn && !!sh && !!th, 'the Studio pill in the dock has two halves');
+    ok(sh && sh.getAttribute('data-studio-tab') === 'studio' && th && th.getAttribute('data-studio-tab') === 'tools',
+      'called Studio and Tools');
+    ok(sh && /Studio/.test(sh.textContent) && th && /Tools/.test(th.textContent),
+      'and both halves are labelled');
+    const line = btn && btn.querySelector('line');
+    ok(!!line && line.getAttribute('x1') === '60%' && line.getAttribute('y1') === '0' &&
+       line.getAttribute('x2') === '40%' && line.getAttribute('y2') === '100%',
+       'the seam between them is a diagonal, not a straight divider (' +
+       (line && [line.getAttribute('x1'), line.getAttribute('y1'), line.getAttribute('x2'), line.getAttribute('y2')].join(' ')) + ')');
+    // Which half owns which SIDE is answered by the clip paths, not by the order the
+    // two divs happen to sit in the markup: Studio keeps the left of the pill and
+    // Tools the right of it.
+    // The cut is written in the two halves' own style attributes, so it is read from
+    // there - whitespace normalised, because the attribute is authored by hand.
+    const cutOf = (el) => ((/clip-path:\s*([^;]+)/i.exec((el && el.getAttribute('style')) || '') || [])[1] || '')
+      .replace(/\s+/g, '');
+    const shPoly = cutOf(sh);
+    const thPoly = cutOf(th);
+    ok(shPoly === 'polygon(00,60%0,40%100%,0100%)', 'Studio owns the left of the pill (' + shPoly + ')');
+    ok(thPoly === 'polygon(60%0,100%0,100%100%,40%100%)', 'and Tools the right of it (' + thPoly + ')');
+    // Both names on the pill's centre line, so Tools sits BESIDE Studio rather than
+    // under it - the shape a two-row split took in the first cut of this tab.
+    ok(sh && /align-items:\s*center/.test(sh.getAttribute('style') || '') &&
+       th && /align-items:\s*center/.test(th.getAttribute('style') || ''),
+       'and both names sit on the same line, either side of the seam');
     const paneStudio = host.querySelector('.sc80-pane[data-pane="studio"]');
     const paneTools = host.querySelector('.sc80-pane[data-pane="tools"]');
     ok(!!paneStudio && !!paneTools, 'both panes exist');
+    ok(host.querySelectorAll('.sc80-pane').length === 2, 'and there are exactly two, not panes inside panes (' +
+      host.querySelectorAll('.sc80-pane').length + ')');
     ok(paneStudio && !!paneStudio.querySelector('.sc-tools'), 'Studio keeps the creative tool cards');
     const folds = paneTools ? Array.from(paneTools.querySelectorAll('[data-fold]')).map((b) => b.getAttribute('data-fold')) : [];
     ['scFoldBadges', 'scFoldStorage', 'scFoldAutodj', 'scFoldGestures', 'scFoldBatchTags', 'scFoldBatchSel']
@@ -318,14 +354,28 @@
     const replayBtns = paneTools ? paneTools.querySelectorAll('[data-sc80-ms]') : [];
     ok(replayBtns.length >= 2, 'with replay buttons on it (' + replayBtns.length + ')');
     ok(!!paneTools.querySelector('#sc80Look'), 'and the Look and feel switches');
-    ok(paneTools.classList.contains('active') === false, 'Studio is the tab it opens on');
-    click(win, bar.querySelector('[data-tab="tools"]'));
-    await wait(80);
-    ok(paneTools.classList.contains('active') && !paneStudio.classList.contains('active'), 'tapping Tools switches the pane');
+    // The live pane, read fresh every time: decorateStudio may legitimately
+    // re-wrap the view on a render, and a reference captured before a click can
+    // point at a node that is no longer the one on screen.
+    const paneOn = (name) => {
+      const el = host.querySelector('.sc80-pane[data-pane="' + name + '"]');
+      return !!(el && el.classList.contains('active'));
+    };
+    // The half IS the control: tapping it is what opens Studio, the same way the
+    // Library pill opens its two halves.
+    click(win, th);
+    await wait(400);
+    ok(host.classList.contains('active'), 'tapping the Tools half opens Studio');
+    ok(paneOn('tools') && !paneOn('studio'), 'on the Tools pane');
     ok(win.localStorage.getItem('sc80StudioTab') === '"tools"', 'and the choice is remembered');
-    click(win, bar.querySelector('[data-tab="studio"]'));
-    await wait(80);
-    ok(paneStudio.classList.contains('active'), 'and back to Studio');
+    ok(th.classList.contains('active-half') && !sh.classList.contains('active-half'),
+      'the half you are in is the one lit');
+    click(win, sh);
+    await wait(400);
+    ok(paneOn('studio') && !paneOn('tools'),
+      'and the Studio half takes you back to the work');
+    ok(sh.classList.contains('active-half') && !th.classList.contains('active-half'),
+      'with the light moved to that half');
   }
 
   console.log('[7] the tabs glide');
@@ -339,14 +389,19 @@
     ok(/scrollTo\(\{ left: Math\.max\(0, left\), behavior: 'smooth' \}\)/.test(html), 'the active tab is scrolled into the middle');
   }
 
-  console.log('[8] Settings -> More carries the switches');
+  console.log('[8] the look switches live in Tools, not in Settings -> More');
   {
     const pane = doc.getElementById('settingsPaneMore');
+    ok(!!pane, 'the More pane is still on the page');
+    const cards = doc.querySelectorAll('#sc80Look');
+    ok(cards.length === 1, 'there is exactly one look card in the document (' + cards.length + ')');
     const card = doc.getElementById('sc80Look');
-    ok(!!pane && !!card, 'the new-look card is in the More pane');
-    ok(card && !!card.querySelector('[data-sc80-layout="classic"]') && !!card.querySelector('[data-sc80-layout="cloud"]'),
+    ok(!!card && !pane.contains(card), 'and it is not the one in Settings, More');
+    const tools = doc.querySelector('.sc80-pane[data-pane="tools"]');
+    ok(!!tools && !!card && tools.contains(card), 'it lives in Studio, Tools');
+    ok(!!card && !!card.querySelector('[data-sc80-layout="classic"]') && !!card.querySelector('[data-sc80-layout="cloud"]'),
       'both layouts are offered');
-    ok(card && !!card.querySelector('[data-sc80-pinned="row"]') && !!card.querySelector('[data-sc80-pinned="grid"]'),
+    ok(!!card && !!card.querySelector('[data-sc80-pinned="row"]') && !!card.querySelector('[data-sc80-pinned="grid"]'),
       'both pinned windows are offered');
     click(win, card.querySelector('[data-sc80-layout="cloud"]'));
     await wait(80);
@@ -354,6 +409,8 @@
     click(win, card.querySelector('[data-sc80-layout="classic"]'));
     await wait(80);
     ok(!win.SC80.isCloud(), 'and switches it back');
+    ok(doc.querySelectorAll('[data-sc80-layout]').length === 2,
+      'and those two buttons are the only copy on the page (' + doc.querySelectorAll('[data-sc80-layout]').length + ')');
   }
 
   console.log('[9] no page errors');
--- a/dev/album-follow-dock-check.cjs
+++ b/dev/album-follow-dock-check.cjs
@@ -569,11 +569,21 @@
     homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
     win.dispatchEvent(pev(win, 'pointermove', 340, 754));   // 4px past the dock's edge
     await wait(20);
-    ok(th('transform') === 'translateX(302px)',
-      'a slide that drifts just past the edge still points at Studio', th('transform'));
+    // The Studio tab is cut in two: 340px is over its Tools half (the cut runs from
+    // 60% of the pill at the top to 40% at the bottom, so the right of the pill is
+    // Tools), and the highlight has to say which half the finger is really over.
+    const toolsLeft = R.studioBtn.left + R.studioBtn.width * 0.40 + 4;
+    // The style round-trips through a string, so the number is what is compared, not
+    // its spelling: 338px and 338.0px are the same place on the dock.
+    const movedTo = parseFloat(String(th('transform')).replace(/[^0-9.]/g, ''));
+    ok(Math.abs(movedTo - toolsLeft) < 0.6,
+      'a slide that drifts just past the edge still points at Studio - at its Tools half',
+      th('transform') + ' vs ' + toolsLeft.toFixed(1));
     win.dispatchEvent(pev(win, 'pointerup', 340, 754));
     await wait(150);
     ok(studioView.classList.contains('active'), 'and releasing there takes it');
+    ok(doc.getElementById('toolsHalf').classList.contains('active-half'),
+      'onto the half the finger was over');
     ok(!homeView.classList.contains('active'), 'without Home answering too');
 
     // (7) A TICK PER CROSSING. One short buzz when the finger moves into another
'''
