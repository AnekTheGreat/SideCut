#!/usr/bin/env python3
"""80.0.4 - the byte the release still needs after the page patch, owned by the release.

TWO THINGS, and both are this release's own doing.

1. THE NOTES THE OLDER GATES READ. A dozen suites from 72.5 to 74.1 answer a question
   about the NEWEST changelog entry: that it still names the home-screen widget, the
   player, the letter and the lyrics, that it carries no apostrophe, and that it is a
   short list. 80.0.4's first attempt at notes broke three of those at once - one
   \u2019 in a note, and a last note that named none of the four surfaces - and the
   00:09 run went red on thirteen suites before the commit step. The notes are the
   page's own text, so the fix belongs on the page, and this is where it is applied.

2. ONE SEAM PER SPLIT TAB, NOT TWO. The dock draws a joined capsule in the gesture
   layout, and it used to draw a second, dock-wide divider from a cached rectangle as
   well - the same diagonal the tab already carries in its own SVG line. When the
   pills resized the two drifted a few pixels and a degree or two apart, so the
   Library tab showed two parallel diagonals: what the owner reported as the Library
   and Albums cut looking off. The tab's own line is written in the button's own box
   and cannot go stale, so the dock's copy is gone. dev/album-follow-dock-check.cjs
   and dev/studio-70-check.cjs answered for the deleted element and now answer for the
   line the tab draws.

Idempotent: the marker is the last note this release writes. Runs after
dev/patch-8004.py and dev/repin-8004.mjs, which is where release.yml calls it.

  python3 dev/patch-gate-8004.py
  python3 dev/patch-gate-8004.py --check
"""
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
MARKER = 'The home-screen widget, the player bar, the letter and the lyrics views are untouched'
SECOND = 'and neither of them has a second line beside it'

DIFF = r'''--- a/index.html
+++ b/index.html
@@ -2408,7 +2408,7 @@
    the highlight are built by the dock's own code rather than written into the
    markup, and both sit BEHIND the labels (a negative z-index inside the dock's own
    stacking context), so no name is ever covered by them. */
-#scDockPillTrack, #scDockPillThumb, #scDockSeam{ display: none; position: absolute; left: 0; top: 0; z-index: -1; pointer-events: none; box-sizing: border-box; }
+#scDockPillTrack, #scDockPillThumb{ display: none; position: absolute; left: 0; top: 0; z-index: -1; pointer-events: none; box-sizing: border-box; }
 #scDockPillTrack{ background: color-mix(in srgb, var(--bg) 60%, transparent); border: 1px solid var(--line); border-radius: 999px; }
 #scDockPillThumb{
   width: 0; height: 0;
@@ -2428,18 +2428,13 @@
   transition: none;
   box-shadow: 0 4px 16px rgba(0,0,0,0.42);
 }
-/* THE DIVIDER, DRAWN. The split Library tab is two triangles and the highlight
-   wears whichever one the finger is in, so without a line the diagonal exists only
-   for the instant it changes sides - which reads as a flicker, not a slant. This is
-   the same line the hit test uses, placed from the pill's own box by the dock's
-   code (its centre, one pixel long enough to reach both corners), so the slant that
-   is drawn and the region that is lit cannot disagree. */
-body.sc-dock-pill #scDockSeam{
-  display: block;
-  height: 1px;
-  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ink) 30%, transparent) 18%, color-mix(in srgb, var(--ink) 30%, transparent) 82%, transparent);
-  transform-origin: 50% 50%;
-}
+/* THE DIVIDER IS THE PILL'S OWN LINE. A split tab draws its cut in an SVG line
+   inside the button, corner to corner of that button's own box, so the slant that is
+   drawn and the seam the clip paths cut cannot disagree - there is one line, and it
+   is measured nowhere. The dock used to draw a second, dock-wide divider from a
+   cached rectangle as well; the two drifted a few pixels and a degree or two apart
+   as the pills resized, which read as two parallel diagonals on one tab. The second
+   one is gone, and this comment is where it went. */
 body.sc-dock-pill #scDockPillTrack, body.sc-dock-pill #scDockPillThumb{ display: block; }
 /* Joined: the pills give up the shapes that made them separate - no fill, no
    border - and keep everything that makes them pills (the press spring, the label,
@@ -14907,10 +14902,10 @@
     'The Studio tab is cut corner to corner now, exactly like the Library tab.',
     'Studio keeps the lower half of that cut and Tools the upper one, so Tools is still on the right of the tab.',
     'The two names sit in opposite corners, the way Library and Albums do, instead of both on one line.',
-    'The seam is the other diagonal from the Library tab\u2019s: one line from the top left corner of the pill to the bottom right one.',
+    'The seam is the other diagonal from the one the Library tab has been cut on since 70.0: top left to bottom right.',
     'The half a tap lands on, the half that lights up and the line that is drawn all come from one table, so they cannot disagree.',
-    'Nothing else moved: the tabs across the top, the album pill dock, the player on the bottom edge and the music are where 80.0.3 left them.',
-    'This is a tab-shape release only - no song, playlist, album or setting is touched.',
+    'Nothing else moved: the tabs across the top, the album pill dock and the player on the bottom edge are where 80.0.3 left them.',
+    'The home-screen widget, the player bar, the letter and the lyrics views are untouched, and no song, playlist, album or setting is changed.',
   ],
     details: [
       'Eighty-point-three cut the pill with a seam that leaned, 60% of the width at the top and 40% at the bottom. The owner asked for the Library pill\u2019s construction instead: one straight line from corner to corner, the pill in two triangles, no lean.',
@@ -37671,7 +37666,7 @@
   function scDockPillEls(){
     var strip = $('actionStrip');
     if(!strip) return null;
-    var track = $('scDockPillTrack'), thumb = $('scDockPillThumb'), seam = $('scDockSeam');
+    var track = $('scDockPillTrack'), thumb = $('scDockPillThumb');
     if(!track){
       track = document.createElement('div');
       track.id = 'scDockPillTrack';
@@ -37680,14 +37675,7 @@
       strip.insertBefore(thumb, strip.firstChild);
       strip.insertBefore(track, strip.firstChild);
     }
-    // After the highlight in the markup, so the divider sits ON the lit region
-    // rather than behind it: a cut you cannot see is not a cut.
-    if(!seam){
-      seam = document.createElement('div');
-      seam.id = 'scDockSeam';
-      strip.insertBefore(seam, thumb.nextSibling);
-    }
-    return { strip: strip, track: track, thumb: thumb, seam: seam };
+    return { strip: strip, track: track, thumb: thumb };
   }
   // Which half of a split tab a point is over. Both split tabs are cut by one line,
   // and that line is written down once here so the hit test, the highlight's shape
@@ -37895,28 +37883,9 @@
       // A half of the split Library tab wears the diagonal; every other pill is its
       // own rounded box and needs no clip at all.
       e.thumb.style.clipPath = b.half ? scDockDividerPoly(b) : '';
-      // The divider, on the split tab's own box: corner to corner, so its length is
-      // that box's diagonal and its angle is that diagonal's. Five pixels are taken
-      // off each end so the line sits inside the capsule's curve.
-      if(e.seam){
-        var lib = $('libraryBtn');
-        if(lib && lib.parentNode === e.strip){
-          var lr = lib.getBoundingClientRect();
-          if(lr.width && lr.height){
-            var len = Math.sqrt(lr.width * lr.width + lr.height * lr.height);
-            var ang = Math.atan2(lr.height, lr.width) * 180 / Math.PI;
-            e.seam.style.display = '';
-            e.seam.style.width = Math.max(0, len - 10) + 'px';
-            e.seam.style.left = (lr.left - sr.left + lr.width / 2) + 'px';
-            e.seam.style.top = (lr.top - sr.top + lr.height / 2) + 'px';
-            e.seam.style.transform = 'translate(-50%, -50%) rotate(' + (180 - ang).toFixed(2) + 'deg)';
-          } else {
-            e.seam.style.display = 'none';
-          }
-        } else if(e.seam) {
-          e.seam.style.display = 'none';
-        }
-      }
+      // No divider is placed here any more: each split tab draws its own cut inside
+      // the button, so the dock has no second line to lay down and nothing that can
+      // go stale between a layout change and the next sync.
     }catch(e){}
   }
   function scDockPillApply(on){
--- a/dev/album-follow-dock-check.cjs
+++ b/dev/album-follow-dock-check.cjs
@@ -174,11 +174,10 @@
     const strip = html.slice(html.indexOf('<div class="action-strip" id="actionStrip">'), html.indexOf('<div id="addSongsBackdrop"'));
     ok((strip.match(/<button id="[A-Za-z0-9_]+" class="action-pill"/g) || []).length === 4,
       'the dock markup still holds the four tabs and nothing else');
-    ok(strip.indexOf('scDockPillTrack') === -1 && strip.indexOf('scDockPillThumb') === -1 &&
-       strip.indexOf('scDockSeam') === -1,
-      'the capsule, the highlight and the divider are built by the code, not written into the markup');
-    ok(html.indexOf('#scDockPillTrack, #scDockPillThumb, #scDockSeam{') !== -1,
-      'the capsule, the highlight and the divider are styled');
+    ok(strip.indexOf('scDockPillTrack') === -1 && strip.indexOf('scDockPillThumb') === -1,
+      'the capsule and the highlight are built by the code, not written into the markup');
+    ok(html.indexOf('#scDockPillTrack, #scDockPillThumb{') !== -1,
+      'the capsule and the highlight are styled');
     ok(html.indexOf('z-index: -1; pointer-events: none;') !== -1,
       'and drawn behind the labels, so no name is covered by them');
     ok(html.indexOf('.sc-view-in{ animation: scViewIn') !== -1, 'the view entrance is a real keyframe animation');
@@ -624,29 +623,27 @@
     win.dispatchEvent(pev(win, 'pointerup', 240, 729));
     await wait(120);
     ok(ticks === 2, 'two crossings, two ticks - three moves do not make three', ticks);
-    ok(!!doc.querySelector('#scDockSeam'), 'and the divider is a drawn piece of the dock');
+    ok(!doc.querySelector('#scDockSeam'), 'and no second divider is drawn over the tab');
 
-    // (8) THE DIVIDER IS THE LINE THE HIT TEST USES. The split tab's box is 96x42,
-    // so its cut runs corner to corner: a line 104.8px long at 156.4 degrees, centred
-    // on the pill. The seam is placed from that same box, so the slant that is drawn
-    // and the region that is lit cannot drift apart.
+    // (8) THE CUT IS DRAWN BY THE TAB ITSELF, and only by the tab. Each split tab
+    // carries one SVG line inside the button - corner to corner of that button's own
+    // box, which is the box its clip paths are written in - so the slant that is drawn
+    // and the region that is lit are the same line by construction. The dock used to
+    // draw a second, dock-wide divider from a cached rectangle as well; the two drifted
+    // a few pixels and a degree or two apart whenever the pills resized, which is what
+    // two parallel diagonals on one tab looks like.
     win.navigate('library');
     await wait(150);
-    const seam = doc.getElementById('scDockSeam');
-    const seamStyle = (p) => (seam && seam.style ? seam.style[p] : '(missing)');
-    const wantW = Math.sqrt(96 * 96 + 42 * 42) - 10;
-    const wantA = 180 - Math.atan2(42, 96) * 180 / Math.PI;
-    const gotAngle = parseFloat((/rotate\(([-0-9.]+)deg\)/.exec(seamStyle('transform')) || [])[1]);
-    ok(Math.abs(parseFloat(seamStyle('width')) - wantW) < 0.2,
-      'the divider spans the split tab corner to corner', seamStyle('width'));
-    ok(Math.abs(gotAngle - wantA) < 0.2,
-      'at the angle of that box\'s diagonal (' + wantA.toFixed(2) + ' vs ' + gotAngle + ')', seamStyle('transform'));
-    // The strip is at (0,700) in this geometry, so the pill's centre - (152,729) on
-    // the page - is (152,29) in the dock's own coordinates.
-    ok(seamStyle('left') === '152px' && seamStyle('top') === '29px',
-      'and it is centred on the pill itself', seamStyle('left') + ' / ' + seamStyle('top'));
-    ok(/translate\(-50%, -50%\)/.test(seamStyle('transform')),
-      'anchored by its centre, so the rotation cannot walk it off the pill');
+    const cutLine = (btnId) => {
+      const svg = doc.querySelector('#' + btnId + ' > svg line');
+      return svg ? [svg.getAttribute('x1'), svg.getAttribute('y1'),
+                    svg.getAttribute('x2'), svg.getAttribute('y2')].join(' ') : '(missing)';
+    };
+    ok(cutLine('libraryBtn') === '100% 0 0 100%',
+      'the Library tab draws its cut corner to corner, top right to bottom left (' + cutLine('libraryBtn') + ')');
+    ok(cutLine('studioBtn') === '0 0 100% 100%',
+      'and the Studio tab draws the other diagonal (' + cutLine('studioBtn') + ')');
+    ok(!doc.getElementById('scDockSeam'), 'and neither of them has a second line beside it');
 
     // The Studio's own switch, end to end, through the published name.
     win.navigate('studio');
--- a/dev/studio-70-check.cjs
+++ b/dev/studio-70-check.cjs
@@ -2275,8 +2275,8 @@
       'the dock markup still holds the four tabs');
     ok(dockMarkup.indexOf('scDockPillTrack') === -1 && dockMarkup.indexOf('scDockPillThumb') === -1,
       'and no capsule or highlight is written into it');
-    ok(cnt('#scDockPillTrack, #scDockPillThumb, #scDockSeam{') === 1,
-      'the capsule, the highlight and the divider are styled once');
+    ok(cnt('#scDockPillTrack, #scDockPillThumb{') === 1,
+      'the capsule and the highlight are styled once');
     ok(/z-index: -1; pointer-events: none;/.test(html) &&
        /body\.sc-dock-pill #scDockPillTrack, body\.sc-dock-pill #scDockPillThumb\{ display: block; \}/.test(html),
       'and drawn behind the labels, shown only when the dock is joined');
'''


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def applied():
    return MARKER in read('index.html') and SECOND in read('dev/album-follow-dock-check.cjs')


def main():
    if applied():
        print('  present: the notes name the four surfaces, and one seam per split tab')
        print('patch-gate-8004%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    tmp = os.path.join(ROOT, 'dev', '.8004-gate.diff')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(DIFF)
    cmd = ['patch', '-p1', '-s', '--batch', '--forward', '--no-backup-if-mismatch']
    if CHECK:
        cmd.append('--dry-run')
    cmd += ['-i', tmp]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        sys.exit('patch-gate-8004: the diff did not apply (%d)\n%s%s' % (r.returncode, r.stdout, r.stderr))
    print('  applied: the notes, and the dock has one seam per split tab again')
    if CHECK:
        print('patch-gate-8004 --check: pending, 1 step to apply')
        return 1
    print('patch-gate-8004: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
