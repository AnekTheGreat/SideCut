#!/usr/bin/env python3
"""80.0.6 - the two missing tabs are back on the staircase.

WHAT WENT WRONG IN 80.0.5, EXACTLY. The staircase puts each tab in its own
capsule in a COLUMN. Three rules from 80.0.3's top bar survived into it, and all
three are written with IDs, which outrank the new block no matter where it sits:

    body.sc80-cloud .action-strip > *           { flex: 1 1 0; width: auto; }
    body.sc80-cloud .action-strip > #libraryBtn { flex: 1.18 1 0; }
    body.sc80-cloud .action-strip > #studioBtn  { flex: 1.5  1 0; }

Level, that is width. In a column it is HEIGHT, with a basis of zero - so the
two pills that carry their own IDs, Library and Studio, laid out at 0px tall.
They were on the page the whole time, invisible, with an 8px gap where each one
should have been. The one that hurts is Studio: Settings lives behind it, so the
cloud layout could not be left from inside itself.

THE FIX IS A RULE WITH THE SAME IDS. It restates the size of all five pills with
the staircase's own variables, so it carries the same weight as the rules it
replaces and comes later in the sheet. The two split pills get sixteen pixels
more width, because each one still holds two names across 80.0.4's cut.

WHAT IS NOT IN THIS DIFF: the layout itself. The staircase, the wider wall, the
wide-window rows, the motion set and the measured player height are all exactly
as 80.0.5 shipped them. This is the bug in 80.0.5 and nothing else.

Idempotent: the marker is the 80.0.6 banner in the page.

    python3 dev/patch-8006.py
    python3 dev/patch-8006.py --check
"""
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.6'
MARKER = '6. 80.0.6: the staircase pills are sized by the staircase'

DIFF = r'''--- a/index.html
+++ b/index.html
@@ -3425,6 +3425,37 @@
 }
 
 
+/* ---------- 6. 80.0.6: the staircase pills are sized by the staircase ------ */
+/* 80.0.3 sized the pills from the old BAR, with ID selectors:
+     body.sc80-cloud .action-strip > *            { flex: 1 1 0; width: auto; }
+     body.sc80-cloud .action-strip > #libraryBtn  { flex: 1.18 1 0; }
+     body.sc80-cloud .action-strip > #studioBtn   { flex: 1.5  1 0; }
+   In the bar that was width. In 80.0.5's COLUMN it is HEIGHT, with a basis of
+   zero, and an ID outranks `body.sc80-cloud .action-strip > button` no matter
+   where it sits in the sheet. So Library and Studio - exactly the two split
+   pills, the two whose IDs carry their own flex - computed to 0px tall: two
+   invisible tabs, an 8px gap where each one should be, and no way out of the
+   layout, because Settings lives behind Studio.
+
+   These selectors carry the same IDs, so they win, and every pill is sized by
+   the staircase's own variables again. The two split pills get a little more
+   width than Home and Discover because each one holds two names. */
+body.sc80-cloud .action-strip > #homeBtn,
+body.sc80-cloud .action-strip > #libraryBtn,
+body.sc80-cloud .action-strip > #discoverBtn,
+body.sc80-cloud .action-strip > #studioBtn,
+body.sc80-cloud .action-strip > #dockAddBtn{
+  flex: 0 0 auto;
+  width: var(--sc80-pill-w); height: var(--sc80-pill-h); min-height: 0;
+}
+body.sc80-cloud .action-strip > #libraryBtn,
+body.sc80-cloud .action-strip > #studioBtn{ width: calc(var(--sc80-pill-w) + 16px); }
+body.sc80-cloud .action-strip > #dockAddBtn{ width: 46px; height: 46px; }
+/* A 42px pill with the split tabs' 10px names needs the two halves to breathe;
+   the halves themselves keep 80.0.4's cut untouched. */
+body.sc80-cloud .action-strip > #libraryBtn > div,
+body.sc80-cloud .action-strip > #studioBtn > div{ padding: 3px 7px !important; }
+
 /* ---------- 5. Bigger screens, foldables, landscape ---------- */
 @media (min-width: 760px){
   body.sc80-cloud .home-bubble{ width: calc(25% - 14px); }
@@ -14367,7 +14398,7 @@
   // 72.5.1 adds a FOURTH number for a fix shipped inside a release: the
   // updater compares the numbers one at a time, so it reads 72.5.1 as newer
   // than 72.5 and installs it, while the release it belongs to stays 72.5.
-  const APP_VERSION = '80.0.5';
+  const APP_VERSION = '80.0.6';
   if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;
   window.__bootDone = false;
   // Diagonal split toggle
@@ -15016,6 +15047,24 @@
     }
   }catch(_eSinglesGen){}
   const CHANGELOG = [
+  { version: '80.0.6', date: 'October 22, 2026 \u00b7 5:55 AM EDT', title: 'The two missing tabs are back on the staircase', items: [
+    'Library and Studio are on the staircase again. They were there in 80.0.5 and zero pixels tall, so all you saw were two empty steps.',
+    'The cause was old width rules from the top bar being read as heights in the new column. They are sized by the staircase itself now.',
+    'Which means you can reach Settings again, and switch back to the classic layout from inside the cloud one.',
+    'The split pills are a little wider than Home and Discover, because each one still carries two names across its cut.',
+    'The cut itself is untouched: Studio keeps the lower triangle and Tools the upper one, corner to corner, exactly as 80.0.4 drew it.',
+    'The staircase still sits above the player at its measured height, so it never covers the transport.',
+    'The album pill dock and its follow behaviour are untouched - the two tabs this release put back are the ones it hangs from.',
+    'The bubbles, the wide-window rows and the one easing curve are unchanged from 80.0.5.',
+    'Nothing else moved: the widget still draws the player, the letter covers and the lyrics view are where they were, and every album, playlist and setting is exactly as 80.0.5 left it.',
+  ],
+    details: [
+      '80.0.5 put each tab in its own capsule in the bottom right. Two of them did not appear, and the mode could not be left because the Studio tab is the way to Settings.',
+      'The staircase sizes its pills from its own variables. Three rules from the old top bar, written with ID selectors, still won: they set flex grow on the Library and Studio pills, which in a column is a height with a basis of zero. Both computed to 0px tall.',
+      'The fix restates those pill sizes with the same IDs, so they carry the same weight as the rules they replace, and adds sixteen pixels of width to the two split pills so both names still fit across the cut.',
+      'A new check in dev/staircase-check.cjs fails the release if any pill in the staircase is sized by anything but the staircase variables.',
+      'Nothing else moved: the widget still draws the player, the letter covers and the lyrics view are where they were, and every album, playlist and setting is exactly as 80.0.5 left it.',
+    ] },
   { version: '80.0.5', date: 'October 21, 2026 \u00b7 10:10 PM EDT', title: 'The tabs are a staircase, and a computer gets the room it has', items: [
     'The tabs are a staircase in the bottom right of the cloud layout now - Home, Library, Discover and Studio each one step up and to the left of the one below, the plus in the corner.',
     'The bar across the top is gone from that layout. Classic keeps its own bottom dock, unchanged.',
--- a/sw.js
+++ b/sw.js
@@ -1,4 +1,4 @@
-const CACHE_NAME = 'sidecut-shell-v80.0.5';
+const CACHE_NAME = 'sidecut-shell-v80.0.6';
 const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];
 
 self.addEventListener('install', (event) => {
'''


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    page = read('index.html')
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: every pill is sized by the staircase, and the page runs as ' + VERSION)
        print('patch-8006%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    tmp = os.path.join(ROOT, 'dev', '.8006.diff')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(DIFF)
    cmd = ['patch', '-p1', '-s', '--batch', '--forward', '--no-backup-if-mismatch']
    if CHECK:
        cmd.append('--dry-run')
    cmd += ['-i', tmp]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        sys.exit('patch-8006: the diff did not apply (%d)\n%s%s' % (r.returncode, r.stdout, r.stderr))
    print('  applied: the five pills sized by the staircase, the version and the notes')
    if CHECK:
        print('patch-8006 --check: the release is pending, 1 step to apply')
        return 1
    print('patch-8006: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
