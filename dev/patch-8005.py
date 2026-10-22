#!/usr/bin/env python3
"""80.0.5 - the tabs are a staircase, and a computer gets the room it has.

Owner's words: "v80.0.5, staircase with tabs nice, make the UI on SideCut for
computers and stuff nice."

80.0.3 put the four tabs in a bar across the top of the cloud layout: one row, five
equal capsules, the shape every app has. The cloud layout floats its content
everywhere else, so this release floats the tabs too - each one its own capsule, one
step up and to the LEFT of the one below it, in the bottom right corner the bubble
wall leaves empty. The bar across the top is gone from that layout; the classic
layout keeps its own bottom dock, untouched.

WHAT ELSE IS IN THE SAME DIFF, and why it belongs in one release:

  - the bubbles are bigger (the wall runs to the edges of the screen, a 10px gap, and
    the two numbers inside take the room that buys);
  - a wide window gets three bubbles to a row past 900px and four past 1280, with the
    wall and the views in centred columns instead of hugging the left edge;
  - one motion set in the theme (--sc-ease and friends) that the pills, the bubbles
    and the now chip all read, on transforms and opacity only;
  - the player measured height goes into --sc80-player, so the staircase floats above
    the transport rather than over it;
  - the shell cache moves to this release name.

ONE THING THAT IS NOT IN THIS DIFF, deliberately: the converter. Its proxy legs were
measured dead out here (allorigins 522 after 19.8s, codetabs a timeout at 25s,
cors.lol 429) and the app own backend answers /metadata with a 500 and /download with a
502/503 - both recorded in AGENTS.md. A release that edits the page cannot make a
broken server answer, so this one does not pretend to.

Idempotent: the marker is the staircase banner in the page. A second run says so and
changes nothing.

    python3 dev/patch-8005.py
    python3 dev/patch-8005.py --check
"""
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.5'
MARKER = '5. 80.0.5: the tabs are a staircase'

DIFF = r'''diff --git a/index.html b/index.html
index 38c0b76..e3165e8 100644
--- a/index.html
+++ b/index.html
@@ -33,6 +33,17 @@
     /* UI text uses the device's own system font so SideCut matches the rest of the OS,
        instead of pulling in a third-party web font. */
     --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', system-ui, sans-serif;
+    /* 80.0.5 - ONE MOTION SET. Every transition in this release that moves or
+       fades something reads these three, so a tab, a bubble and a menu settle on
+       the same curve at the same speed instead of each one carrying its own
+       numbers. --sc-ease is fast-out with a soft landing; --sc-ease-spring is the
+       one a pressed state uses. Nothing here animates layout - transforms and
+       opacity only, which the compositor can run on its own. */
+    --sc-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
+    --sc-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
+    --sc-ease-fast: 160ms;
+    --sc-ease-mid: 260ms;
+    --sc-ease-slow: 380ms;
   }
   /* Glow style button active states */
   .glow-style-btn.active {
@@ -3307,6 +3318,113 @@ body.sc80-cloud #homeView, body.sc80-cloud #library, body.sc80-cloud #discoverVi
 body.sc80-cloud #studioView{ padding-right: calc(var(--sc80-dock) + 12px); }
 body:not(.sc80-cloud) #sc80CloudCtl{ display: none; }
 
+/* ---------- 5. 80.0.5: the tabs are a staircase in the bottom right ------- */
+/* "STAIRCASE WITH TABS, NICE." 80.0.3 put the four tabs in a bar across the top:
+   one row, five equal capsules, the shape every app has. The cloud layout
+   already floats its content, so the tabs float too now, in the corner the
+   bubble wall leaves empty - each pill one step up and to the LEFT of the one
+   below it, in the bottom right. The top bar is gone from this layout. The
+   classic layout keeps its own bottom dock, so nothing here reaches it.
+
+   ONE PILL, ONE PIECE OF GLASS. The container loses its own background, border
+   and padding: each tab is its own capsule, which is what makes a step read as a
+   step. The two split pills keep the diagonal cut 80.0.4 gave them - the cut
+   lives inside the pill and does not know where the pill sits. */
+body.sc80-cloud{
+  --sc80-step: 15px; --sc80-pill-w: 132px; --sc80-pill-h: 42px;
+  /* The player's measured height, written by applyLayout(); 112px until it runs. */
+  --sc80-player: 112px;
+}
+body.sc80-cloud .action-strip{
+  position: fixed;
+  left: auto; right: 12px;
+  top: auto; bottom: calc(env(safe-area-inset-bottom) + var(--sc80-player) + 10px);
+  transform: none;
+  display: flex; flex-direction: column; align-items: flex-end;
+  gap: 8px;
+  width: auto; max-width: none; height: auto;
+  margin: 0; padding: 0;
+  border: none; border-radius: 0;
+  background: none;
+  -webkit-backdrop-filter: none; backdrop-filter: none;
+  box-shadow: none;
+  z-index: 45;
+}
+body.sc80-cloud .action-strip > button{
+  flex: 0 0 auto;
+  width: var(--sc80-pill-w); height: var(--sc80-pill-h); min-height: 0;
+  justify-content: center;
+  border-radius: 14px;
+  border: 1px solid var(--line);
+  background: color-mix(in srgb, var(--bg-raised) 86%, transparent);
+  -webkit-backdrop-filter: blur(16px) saturate(1.2);
+  backdrop-filter: blur(16px) saturate(1.2);
+  box-shadow: 0 12px 26px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.06);
+  transition: transform var(--sc-ease-mid) var(--sc-ease), background var(--sc-ease-mid) var(--sc-ease), box-shadow var(--sc-ease-mid) var(--sc-ease);
+}
+/* THE STAIRCASE ITSELF. The top tab is furthest left and each one under it steps
+   right by --sc80-step, so the bottom tab sits in the screen's own corner.
+   Reading the names down the screen is the order the bar read across it. */
+body.sc80-cloud .action-strip > #homeBtn{ margin-right: calc(var(--sc80-step) * 3); }
+body.sc80-cloud .action-strip > #libraryBtn{ margin-right: calc(var(--sc80-step) * 2); }
+body.sc80-cloud .action-strip > #discoverBtn{ margin-right: var(--sc80-step); }
+body.sc80-cloud .action-strip > #studioBtn{ margin-right: 0; }
+body.sc80-cloud .action-strip > #dockAddBtn{
+  width: 46px; height: 46px; min-height: 0; border-radius: 50%; padding: 0;
+  margin-right: 0;
+}
+body.sc80-cloud .action-strip > .action-pill{ font-size: 11px; }
+/* The add-songs menu opens ABOVE the staircase, from the plus in its corner. */
+body.sc80-cloud #addSongsMenu{
+  right: 0; left: auto; top: auto;
+  bottom: calc(100% + 10px);
+  transform: none;
+  max-height: 58vh; overflow-y: auto;
+}
+/* No bar across the top means the views stop reserving its band - but the
+   staircase floats over the bottom right of every one of them, so they reserve
+   that instead: the four pills, the plus, and the player under them. */
+body.sc80-cloud #homeView, body.sc80-cloud #library, body.sc80-cloud #discoverView,
+body.sc80-cloud #studioView{
+  padding-top: 10px; padding-right: 0;
+  scroll-padding-top: 10px;
+  padding-bottom: calc(var(--sc80-player) + 240px);
+}
+
+/* BUBBLES, BIGGER. The wall runs to the screen's own edges instead of a gutter,
+   the gap between two is 10px rather than 14, and the two numbers inside take
+   the room that buys. Still two to a row on a phone. */
+body.sc80-cloud #homeView{ padding-left: 6px; padding-right: 6px; }
+body.sc80-cloud #homeBubbles{ gap: 10px; }
+body.sc80-cloud .home-bubble{ width: calc(50% - 5px); padding: 14px; }
+body.sc80-cloud .home-bubble.wide{ width: calc(50% - 5px); }
+body.sc80-cloud .home-bubble .hb-value{ font-size: calc(24px * var(--hb-s, 1)); }
+body.sc80-cloud .home-bubble .hb-label{ font-size: calc(11.5px * var(--hb-s, 1)); }
+
+/* EVERYTHING SMOOTH. One curve, one speed, transforms and opacity only. */
+body.sc80-cloud .home-bubble{ transition: transform var(--sc-ease-mid) var(--sc-ease), box-shadow var(--sc-ease-mid) var(--sc-ease); }
+body.sc80-cloud .home-bubble:active{ transform: scale(0.975); }
+#sc80Now{ transition: transform var(--sc-ease-mid) var(--sc-ease), opacity var(--sc-ease-mid) var(--sc-ease); }
+
+/* COMPUTERS. The staircase holds its corner, the wall uses the room it has -
+   three bubbles to a row past 900px, four past 1280 - and the views stop
+   hugging the left edge of a wide window. */
+@media (min-width: 900px){
+  body.sc80-cloud{ --sc80-pill-w: 142px; --sc80-pill-h: 44px; --sc80-step: 18px; }
+  body.sc80-cloud .action-strip{ right: max(18px, calc(50vw - 660px)); }
+  body.sc80-cloud #homeView, body.sc80-cloud #library, body.sc80-cloud #discoverView,
+  body.sc80-cloud #studioView{ max-width: 1320px; margin: 0 auto; padding-bottom: calc(var(--sc80-player) + 120px); }
+  body.sc80-cloud #homeBubbles{ max-width: 1120px; margin: 0 auto; }
+  body.sc80-cloud .home-bubble{ width: calc(33.333% - 7px); }
+  body.sc80-cloud .home-bubble.wide{ width: calc(33.333% - 7px); }
+}
+@media (min-width: 1280px){
+  body.sc80-cloud #homeBubbles{ max-width: 1240px; }
+  body.sc80-cloud .home-bubble{ width: calc(25% - 8px); }
+  body.sc80-cloud .home-bubble.wide{ width: calc(25% - 8px); }
+}
+
+
 /* ---------- 5. Bigger screens, foldables, landscape ---------- */
 @media (min-width: 760px){
   body.sc80-cloud .home-bubble{ width: calc(25% - 14px); }
@@ -14249,7 +14367,7 @@ function startLyricsAutoScroll(keepPos, noReset) {
   // 72.5.1 adds a FOURTH number for a fix shipped inside a release: the
   // updater compares the numbers one at a time, so it reads 72.5.1 as newer
   // than 72.5 and installs it, while the release it belongs to stays 72.5.
-  const APP_VERSION = '80.0.4';
+  const APP_VERSION = '80.0.5';
   if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;
   window.__bootDone = false;
   // Diagonal split toggle
@@ -14898,6 +15016,26 @@ function startLyricsAutoScroll(keepPos, noReset) {
     }
   }catch(_eSinglesGen){}
   const CHANGELOG = [
+  { version: '80.0.5', date: 'October 21, 2026 \u00b7 10:10 PM EDT', title: 'The tabs are a staircase, and a computer gets the room it has', items: [
+    'The tabs are a staircase in the bottom right of the cloud layout now - Home, Library, Discover and Studio each one step up and to the left of the one below, the plus in the corner.',
+    'The bar across the top is gone from that layout. Classic keeps its own bottom dock, unchanged.',
+    'Each tab is its own piece of glass, so a step reads as a step instead of five capsules in one bar.',
+    'The bubbles are bigger: the wall runs to the edges of the screen and the gap between two is 10px instead of 14.',
+    'On a computer the wall fills the window - three bubbles to a row past 900px, four past 1280 - and the views stop hugging the left edge.',
+    'One easing curve and one speed for the whole app now, on transforms and opacity only.',
+    'The staircase sits above the player at its measured height, so it never covers the transport.',
+    'Nothing else moved: the widget still draws the player, the letter covers and the lyrics view are where they were, and every album, playlist and setting is exactly as 80.0.4 left it.',
+  ],
+    details: [
+      'Eighty-point-three put the four tabs in a bar across the top. That is a bar - one row, five equal capsules, the shape every app has - and the cloud layout floats its content everywhere else, so the tabs floated with it.',
+      'The order is the order the bar read across: Home at the top of the staircase, then Library, Discover and Studio, each pill stepping right by 15px, and the plus in the corner of the screen.',
+      'The container lost its background, border and padding: each pill is its own capsule, which is what makes a step read as a step rather than five names in one bar.',
+      'The bar\u2019s band is no longer reserved at the top of the views; the staircase\u2019s is reserved at the bottom instead, so the last row of bubbles clears it.',
+      'The player is measured when the layout is applied and its height is written to --sc80-player, so the staircase floats above the transport at any font size and any safe-area inset rather than over it.',
+      'A wide window gets three bubbles to a row past 900px and four past 1280, the wall centred in a 1120px column, and the views in a 1320px one.',
+      'Motion is one set of numbers in the theme (--sc-ease, --sc-ease-mid and friends) that the pills, the bubbles and the now chip all read, on transforms and opacity only - nothing in this release animates layout.',
+      'Nothing else moved: the widget still draws the player, the letter covers and the lyrics view are where they were, and every album, playlist and setting is exactly as 80.0.4 left it.',
+    ] },
   { version: '80.0.4', date: 'October 21, 2026 \u00b7 7:30 PM EDT', title: 'The Studio tab is cut the way the Library tab is', items: [
     'The Studio tab is cut corner to corner now, exactly like the Library tab.',
     'Studio keeps the lower half of that cut and Tools the upper one, so Tools is still on the right of the tab.',
@@ -54795,6 +54933,14 @@ window.showAlbumReorderPopup = function(albumName){
           var hh = Math.round(hd.getBoundingClientRect().height || 0);
           if(hh > 20 && hh < 160) document.documentElement.style.setProperty('--sc80-head', hh + 'px');
         }
+        // 80.0.5 - the staircase sits ABOVE the player, so it needs the player's
+        // real height rather than a guess: measured here, on the same frame the
+        // header is, and only while the cloud layout is the one on screen.
+        if(cloud){
+          var np = document.getElementById('nowPlaying');
+          var nh = np ? Math.round(np.getBoundingClientRect().height || 0) : 0;
+          if(nh > 40 && nh < 320) document.documentElement.style.setProperty('--sc80-player', nh + 'px');
+        }
       }catch(_eHead){}
       try{ if(window.SC70 && SC70.measureDock) SC70.measureDock(); }catch(_eMeasure){}
     });
@@ -54805,7 +54951,7 @@ window.showAlbumReorderPopup = function(albumName){
     lsSet(LS.layout, mode === 'cloud' ? 'cloud' : 'classic');
     applyLayout();
     toast(mode === 'cloud'
-      ? 'Cloud layout - bubbles, the tabs across the top, the small now bar up top'
+      ? 'Cloud layout - bubbles, the tabs in a staircase at the bottom right, the small now bar up top'
       : 'Classic layout - the original bottom tabs are back');
   }
   function setPinnedLayout(mode){
diff --git a/sw.js b/sw.js
index 8d19d3a..2fee32f 100644
--- a/sw.js
+++ b/sw.js
@@ -1,4 +1,4 @@
-const CACHE_NAME = 'sidecut-shell-v80.0.4';
+const CACHE_NAME = 'sidecut-shell-v80.0.5';
 const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];
 
 self.addEventListener('install', (event) => {
'''


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    page = read('index.html')
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the tabs are a staircase, and the page runs as ' + VERSION)
        print('patch-8005%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    tmp = os.path.join(ROOT, 'dev', '.8005.diff')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(DIFF)
    cmd = ['patch', '-p1', '-s', '--batch', '--forward', '--no-backup-if-mismatch']
    if CHECK:
        cmd.append('--dry-run')
    cmd += ['-i', tmp]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        sys.exit('patch-8005: the diff did not apply (%d)\n%s%s' % (r.returncode, r.stdout, r.stderr))
    print('  applied: the staircase, the wider wall, the motion set, the version and the notes')
    if CHECK:
        # A DRY RUN THAT SUCCEEDS MEANS THIS RELEASE IS STILL PENDING, and the exit
        # status has to say so: release.yml reads it to decide whether anything is
        # left to do, and a check that returns 0 on a clean tree turns a dispatch
        # into a silent no-op (80.0.4 first dispatch did exactly that).
        print('patch-8005 --check: the release is pending, 1 step to apply')
        return 1
    print('patch-8005: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
