#!/usr/bin/env python3
"""80.0.4 - the Studio tab is cut the way the Library tab is.

Owner's words: "the diagonal for tools and studio should be like the one for library
and albums except top left to bottom right."

80.0.3 cut the pill with a seam that leaned - 60% of the width at the top, 40% at the
bottom. That is not the Library pill's construction: the Library pill has been one
straight line from corner to corner since 70.0, with a name in each of the two
triangles. So this release mirrors exactly that:

  studioHalf  polygon(0 0, 0 100%, 100% 100%)   the LOWER triangle, name bottom left
  toolsHalf   polygon(0 0, 100% 0, 100% 100%)   the UPPER triangle, name top right
  the seam    0,0 -> 100%,100%                  top left to bottom right

Tools is still on the right of the cut, which is where the owner asked for it in the
release before this one. The hit test, the sliding highlight and the drawn line all
read one table (`SC_DOCK_SPLITS`), so the half a finger lands on, the half that lights
and the side of the line that is drawn cannot disagree: the studio line becomes
`x - y`, the same signed-distance form the Library cut uses.

The whole release is that diff - the page plus the two gates that describe it - applied
to the 80.0.3 tree. Idempotent: the marker is the shipped clip path, so a second run
says so and changes nothing.

    python3 dev/patch-8004.py
    python3 dev/patch-8004.py --check
"""
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.4'
MARKER = 'clip-path:polygon(0 0, 0 100%, 100% 100%)'

DIFF = r'''--- a/index.html
+++ b/index.html
@@ -2997,12 +2997,13 @@
 .sc80-pane{ display: none; flex-direction: column; }
 .sc80-pane.active{ display: flex; }
 .sc80-pane .sc-sec:first-child{ margin-top: 0; }
-/* The Studio pill is cut diagonally the way the Library pill is. Studio is the
-   LEFT of the pill and Tools the RIGHT, so the two names read across: the pill is
-   wide and short, and two names stacked one above the other were two rows of
-   9.5px type fighting for 44px of height. */
+/* The Studio pill is cut exactly the way the Library pill is - corner to corner,
+   one seam, two triangles - only the seam runs the other way: top left to bottom
+   right. Studio keeps the lower half and Tools the upper one, which is the right
+   of the cut, and each name sits in its own corner the way Library and Albums do.
+   The pill keeps more of the bar than the others because it carries two names. */
 #studioBtn{ flex: 1.5 1 0; border-radius: 14px; }
-#studioBtn #studioHalf, #studioBtn #toolsHalf{ align-items: center; transition: background 0.15s; }
+#studioBtn #studioHalf, #studioBtn #toolsHalf{ transition: background 0.15s; }
 #studioBtn #studioHalf span, #studioBtn #toolsHalf span{ font-size: 9.5px; letter-spacing: 0.2px; }
 #studioHalf:active, #toolsHalf:active{ transform: scale(0.97); }
 #studioHalf:hover, #toolsHalf:hover{ background: rgba(255,255,255,0.06); }
@@ -3432,19 +3433,19 @@
   <svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;z-index:3;"><line x1="100%" y1="0" x2="0" y2="100%" stroke="var(--line)" stroke-width="1"/></svg>
 </button>
   <button id="discoverBtn" class="action-pill">Discover</button>
-  <!-- 80.0.3 - the Studio tab, cut diagonally the way the Library tab has been
-       since 70.0. Studio is the LEFT half and Tools the RIGHT half, both on one
-       line: the seam runs from 60% of the pill's width at the top to 40% at the
-       bottom. Both halves are in the one pill, and there is no second tab bar
-       inside the Studio view any more. -->
+  <!-- 80.0.4 - the Studio tab is cut the way the Library tab has been since 70.0:
+       corner to corner, with the seam running top LEFT to bottom RIGHT. Studio
+       keeps the lower half of the pill and Tools the upper half, which puts Tools
+       on the right of the cut, and the two names sit diagonally the way Library
+       and Albums do. One pill, and no second tab bar inside the Studio view. -->
   <button id="studioBtn" class="action-pill" style="position:relative;overflow:hidden;padding:0;cursor:pointer;">
-  <div id="studioHalf" data-studio-tab="studio" style="position:absolute;inset:0;clip-path:polygon(0 0, 60% 0, 40% 100%, 0 100%);display:flex;align-items:center;justify-content:flex-start;box-sizing:border-box;padding:0 0 0 6px;cursor:pointer;z-index:2;transition:background 0.15s;">
+  <div id="studioHalf" data-studio-tab="studio" style="position:absolute;inset:0;clip-path:polygon(0 0, 0 100%, 100% 100%);display:flex;align-items:flex-end;justify-content:flex-start;box-sizing:border-box;padding:0 0 4px 8px;cursor:pointer;z-index:2;transition:background 0.15s;">
     <span style="font-size:9.5px;font-weight:700;color:var(--ink-dim);letter-spacing:0.2px;">Studio</span>
   </div>
-  <div id="toolsHalf" data-studio-tab="tools" style="position:absolute;inset:0;clip-path:polygon(60% 0, 100% 0, 100% 100%, 40% 100%);display:flex;align-items:center;justify-content:flex-end;box-sizing:border-box;padding:0 6px 0 0;cursor:pointer;z-index:1;transition:background 0.15s;">
+  <div id="toolsHalf" data-studio-tab="tools" style="position:absolute;inset:0;clip-path:polygon(0 0, 100% 0, 100% 100%);display:flex;align-items:flex-start;justify-content:flex-end;box-sizing:border-box;padding:4px 8px 0 0;cursor:pointer;z-index:1;transition:background 0.15s;">
     <span style="font-size:9.5px;font-weight:700;color:var(--ink-dim);letter-spacing:0.2px;">Tools</span>
   </div>
-  <svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;z-index:3;"><line x1="60%" y1="0" x2="40%" y2="100%" stroke="var(--line)" stroke-width="1"/></svg>
+  <svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;z-index:3;"><line x1="0" y1="0" x2="100%" y2="100%" stroke="var(--line)" stroke-width="1"/></svg>
 </button>
   <button id="dockAddBtn" class="action-pill dock-add" title="Add songs" aria-label="Add songs">
     <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
@@ -14253,7 +14254,7 @@
   // 72.5.1 adds a FOURTH number for a fix shipped inside a release: the
   // updater compares the numbers one at a time, so it reads 72.5.1 as newer
   // than 72.5 and installs it, while the release it belongs to stays 72.5.
-  const APP_VERSION = '80.0.3';
+  const APP_VERSION = '80.0.4';
   if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;
   window.__bootDone = false;
   // Diagonal split toggle
@@ -14902,6 +14903,24 @@
     }
   }catch(_eSinglesGen){}
   const CHANGELOG = [
+  { version: '80.0.4', date: 'October 21, 2026 \u00b7 7:30 PM EDT', title: 'The Studio tab is cut the way the Library tab is', items: [
+    'The Studio tab is cut corner to corner now, exactly like the Library tab.',
+    'Studio keeps the lower half of that cut and Tools the upper one, so Tools is still on the right of the tab.',
+    'The two names sit in opposite corners, the way Library and Albums do, instead of both on one line.',
+    'The seam is the other diagonal from the Library tab\u2019s: one line from the top left corner of the pill to the bottom right one.',
+    'The half a tap lands on, the half that lights up and the line that is drawn all come from one table, so they cannot disagree.',
+    'Nothing else moved: the tabs across the top, the album pill dock, the player on the bottom edge and the music are where 80.0.3 left them.',
+    'This is a tab-shape release only - no song, playlist, album or setting is touched.',
+  ],
+    details: [
+      'Eighty-point-three cut the pill with a seam that leaned, 60% of the width at the top and 40% at the bottom. The owner asked for the Library pill\u2019s construction instead: one straight line from corner to corner, the pill in two triangles, no lean.',
+      'Down-left of that line is Studio, up-right is Tools. Tools is still where the owner asked for it in the release before this one - on the right - and the cut is now the same idea as the Library tab\u2019s, just the other diagonal.',
+      'Studio sits at the bottom left corner and Tools at the top right one, one name in each corner of one pill, on either side of the one seam - which is exactly how Library and Albums have read since 70.0.',
+      'The Library tab\u2019s line runs from its top right corner to its bottom left one; this one runs from the top left to the bottom right. Same construction, mirrored, so the two split tabs in the dock are one idea rather than two.',
+      'The hit test that decides which half a finger is over, the sliding highlight that lights it and the drawn SVG line all read the same entry in SC_DOCK_SPLITS, so the half a tap lands on, the half that lights and the side of the line that is drawn cannot drift apart.',
+      'This release is a tab shape and nothing else. The bar across the top, the player on the safe area, the bubbles, the library, Discover, Studio\u2019s tools and the album pill dock are untouched.',
+      'No music changed: every song, playlist, album, cover and setting is exactly as 80.0.3 left it, and the update is a page and a bundle like any other.',
+    ] },
   { version: '80.0.3', date: 'October 21, 2026 \u00b7 9:15 AM EDT', title: 'The tabs move over the screen, and Tools is a half of the Studio tab', items: [
     'The tabs are one bar across the top of the screen now, floating over the bubbles so the wall scrolls underneath them.',
     'The Studio tab is a diagonal split - Studio on the left of the pill, Tools on the right - so Tools is a tab in the dock you can tap, not a tab hidden inside Studio.',
@@ -37675,13 +37694,14 @@
   // and the drawn seam cannot disagree about where the cut is:
   //   libraryBtn - corner to corner, top-right to bottom-left: the top-left
   //                triangle is Library, the bottom-right is Albums.
-  //   studioBtn  - the same cut stood on its side, x = 0.60 at the top to 0.40 at
-  //                the bottom: Studio owns the left of the pill, Tools the right.
+  //   studioBtn  - the same construction, mirrored: top left to bottom right, so
+  //                Studio owns the lower triangle and Tools the upper one (the
+  //                right of the cut).
   var SC_DOCK_SPLITS = {
     libraryBtn: { ids: ['playlistsHalf', 'albumsHalf'], edge: 0.5,
                   line: function(xn, yn){ return xn + yn - 1; } },
-    studioBtn:  { ids: ['studioHalf', 'toolsHalf'], edge: 0.60,
-                  line: function(xn, yn){ return xn - (0.60 - 0.20 * yn); } }
+    studioBtn:  { ids: ['studioHalf', 'toolsHalf'], edge: 0.5,
+                  line: function(xn, yn){ return xn - yn; } }
   };
   // ...and the same table read the other way round: which split a HALF belongs to.
   // The two lookups stay apart because the box of a whole pill and the box of one of
--- a/sw.js
+++ b/sw.js
@@ -1,4 +1,4 @@
-const CACHE_NAME = 'sidecut-shell-v80.0.3';
+const CACHE_NAME = 'sidecut-shell-v80.0.4';
 const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];
 
 self.addEventListener('install', (event) => {
--- a/dev/revamp-check.cjs
+++ b/dev/revamp-check.cjs
@@ -38,7 +38,7 @@
   else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
 }
 
-const VER = '80.0.3';
+const VER = '80.0.4';
 // The release the 80.0 revamp REPLACED. This gate asserts adjacency against the
 // revamp's own entry (found by version), not against the head, so this pin stays
 // on the release 80.0 itself replaced.
@@ -320,26 +320,28 @@
     ok(sh && /Studio/.test(sh.textContent) && th && /Tools/.test(th.textContent),
       'and both halves are labelled');
     const line = btn && btn.querySelector('line');
-    ok(!!line && line.getAttribute('x1') === '60%' && line.getAttribute('y1') === '0' &&
-       line.getAttribute('x2') === '40%' && line.getAttribute('y2') === '100%',
-       'the seam between them is a diagonal, not a straight divider (' +
+    ok(!!line && line.getAttribute('x1') === '0' && line.getAttribute('y1') === '0' &&
+       line.getAttribute('x2') === '100%' && line.getAttribute('y2') === '100%',
+       'the seam is the Library cut mirrored - corner to corner, top left to bottom right (' +
        (line && [line.getAttribute('x1'), line.getAttribute('y1'), line.getAttribute('x2'), line.getAttribute('y2')].join(' ')) + ')');
     // Which half owns which SIDE is answered by the clip paths, not by the order the
-    // two divs happen to sit in the markup: Studio keeps the left of the pill and
-    // Tools the right of it.
+    // two divs happen to sit in the markup: the seam runs top left to bottom right,
+    // so Studio keeps the lower triangle and Tools the upper one - the right of the
+    // cut, which is where the owner asked for it.
     // The cut is written in the two halves' own style attributes, so it is read from
     // there - whitespace normalised, because the attribute is authored by hand.
     const cutOf = (el) => ((/clip-path:\s*([^;]+)/i.exec((el && el.getAttribute('style')) || '') || [])[1] || '')
       .replace(/\s+/g, '');
     const shPoly = cutOf(sh);
     const thPoly = cutOf(th);
-    ok(shPoly === 'polygon(00,60%0,40%100%,0100%)', 'Studio owns the left of the pill (' + shPoly + ')');
-    ok(thPoly === 'polygon(60%0,100%0,100%100%,40%100%)', 'and Tools the right of it (' + thPoly + ')');
-    // Both names on the pill's centre line, so Tools sits BESIDE Studio rather than
-    // under it - the shape a two-row split took in the first cut of this tab.
-    ok(sh && /align-items:\s*center/.test(sh.getAttribute('style') || '') &&
-       th && /align-items:\s*center/.test(th.getAttribute('style') || ''),
-       'and both names sit on the same line, either side of the seam');
+    ok(shPoly === 'polygon(00,0100%,100%100%)', 'Studio owns the lower half of the pill (' + shPoly + ')');
+    ok(thPoly === 'polygon(00,100%0,100%100%)', 'and Tools the upper half, on the right of the cut (' + thPoly + ')');
+    // The two triangles put the names in opposite corners, which is exactly what the
+    // Library pill does with Library and Albums: one at the bottom left, one at the
+    // top right, either side of the one seam.
+    ok(sh && /align-items:\s*flex-end/.test(sh.getAttribute('style') || '') &&
+       th && /align-items:\s*flex-start/.test(th.getAttribute('style') || ''),
+       'and the two names sit in opposite corners, the way Library and Albums do');
     const paneStudio = host.querySelector('.sc80-pane[data-pane="studio"]');
     const paneTools = host.querySelector('.sc80-pane[data-pane="tools"]');
     ok(!!paneStudio && !!paneTools, 'both panes exist');
--- a/dev/album-follow-dock-check.cjs
+++ b/dev/album-follow-dock-check.cjs
@@ -159,7 +159,7 @@
 
   console.log('[1] release metadata');
   {
-    ok(/^80\.0\.3$/.test(VER), 'the page is the release this probe is for (' + VER + ')');
+    ok(/^80\.0\.4$/.test(VER), 'the page is the release this probe is for (' + VER + ')');
     ok(sw.indexOf("const CACHE_NAME = 'sidecut-shell-v" + VER + "'") !== -1,
       'the shell cache moved with it');
     const head = (html.match(/const CHANGELOG = \[\n  \{ version: '([^']+)'/) || [])[1];
@@ -569,23 +569,46 @@
     homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
     win.dispatchEvent(pev(win, 'pointermove', 340, 754));   // 4px past the dock's edge
     await wait(20);
-    // The Studio tab is cut in two: 340px is over its Tools half (the cut runs from
-    // 60% of the pill at the top to 40% at the bottom, so the right of the pill is
-    // Tools), and the highlight has to say which half the finger is really over.
-    const toolsLeft = R.studioBtn.left + R.studioBtn.width * 0.40 + 4;
+    // The Studio tab is cut corner to corner - top LEFT to bottom RIGHT - so the two
+    // halves are the LOWER triangle (Studio) and the UPPER one (Tools). Which half a
+    // point is over is that line and nothing else: below it Studio, above it Tools.
+    const studioBox = (name) => name === 'tools'
+      ? R.studioBtn.left + R.studioBtn.width * 0.5 + 4      // the Tools half's box
+      : R.studioBtn.left + 4;                               // the Studio half's box
+    const over = (x, y) => ((x - R.studioBtn.left) / R.studioBtn.width)
+                         - ((y - R.studioBtn.top) / R.studioBtn.height) > 0;
+    const litName = () => {
+      const sh = doc.getElementById('studioHalf'), tl = doc.getElementById('toolsHalf');
+      return tl && tl.classList.contains('active-half') ? 'tools'
+           : sh && sh.classList.contains('active-half') ? 'studio' : 'none';
+    };
     // The style round-trips through a string, so the number is what is compared, not
     // its spelling: 338px and 338.0px are the same place on the dock.
     const movedTo = parseFloat(String(th('transform')).replace(/[^0-9.]/g, ''));
-    ok(Math.abs(movedTo - toolsLeft) < 0.6,
-      'a slide that drifts just past the edge still points at Studio - at its Tools half',
-      th('transform') + ' vs ' + toolsLeft.toFixed(1));
+    const halfHere = over(340, 754) ? 'tools' : 'studio';
+    ok(Math.abs(movedTo - studioBox(halfHere)) < 0.6,
+      'a slide that drifts just past the edge still points at Studio - at the half the seam puts it in',
+      th('transform') + ' vs ' + studioBox(halfHere).toFixed(1) + ' (' + halfHere + ')');
     win.dispatchEvent(pev(win, 'pointerup', 340, 754));
     await wait(150);
     ok(studioView.classList.contains('active'), 'and releasing there takes it');
-    ok(doc.getElementById('toolsHalf').classList.contains('active-half'),
-      'onto the half the finger was over');
+    ok(litName() === halfHere, 'onto the half the seam put the finger in (' + litName() + ')');
     ok(!homeView.classList.contains('active'), 'without Home answering too');
 
+    // ...and the other side of that same seam is reachable too: a drift over the pill's
+    // top right is above the cut, which is Tools.
+    win.navigate('home');
+    await wait(80);
+    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
+    win.dispatchEvent(pev(win, 'pointermove', 370, 712));
+    await wait(20);
+    ok(over(370, 712) && Math.abs(parseFloat(String(th('transform')).replace(/[^0-9.]/g, '')) - studioBox('tools')) < 0.6,
+      'and a drift over the top right of the pill lights the Tools half (' + th('transform') + ')');
+    win.dispatchEvent(pev(win, 'pointerup', 370, 712));
+    await wait(150);
+    ok(litName() === 'tools' && studioView.classList.contains('active'),
+      'which opens Studio on Tools (' + litName() + ')');
+
     // (7) A TICK PER CROSSING. One short buzz when the finger moves into another
     // tab - not one per pointermove, and not a burst per seam crossing.
     win.navigate('home');
'''


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    page = read('index.html')
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the Studio cut is the Library cut mirrored, and the page runs as ' + VERSION)
        print('patch-8004%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    tmp = os.path.join(ROOT, 'dev', '.8004.diff')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(DIFF)
    cmd = ['patch', '-p1', '-s', '--batch', '--forward', '--no-backup-if-mismatch']
    if CHECK:
        cmd.append('--dry-run')
    cmd += ['-i', tmp]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        sys.exit('patch-8004: the diff did not apply (%d)\n%s%s' % (r.returncode, r.stdout, r.stderr))
    print('  applied: the Studio cut is the Library cut mirrored, the version and the notes')
    print('patch-8004%s: 1 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
