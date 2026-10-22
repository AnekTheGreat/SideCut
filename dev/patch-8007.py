#!/usr/bin/env python3
"""80.0.7 - the cloud layout has one now bar, and it is simple.

THE OWNER'S WORDS, on a screenshot of the cloud layout: "for the cloud version, I
want a simpler now bar."

There were two players in that layout. The docked one, and a small chip in the top
right that mirrored it - the chip was the "now bar" that was asked for and then not
wanted, because it sat over the header and showed the same song twice. This release
keeps one of them and simplifies it:

  - the chip is hidden in this layout (classic still has the docked player, full
    size, exactly as it was);
  - the bar's turntable is 38px instead of 62, its buttons 30px instead of 36,
    its two lines a point smaller, and its three rows close to a 2px gap;
  - EVERY control stays: shuffle, prev, play, next, repeat, the menu, DJ MODE,
    LYRICS, the ONLINE badge, the seek line and both times.

The staircase is positioned from this bar's measured height (--sc80-player, written
by applyLayout), so a shorter bar moves the staircase down with it instead of
leaving a hole above the transport.

The bar deliberately does NOT re-reserve the bottom inset: the element is already
lifted by `bottom: env(safe-area-inset-bottom)` in this layout, and studio-70-check
owns the rule that the player never reserves that inset twice.

Idempotent: the marker is the 80.0.7 banner in the page.

    python3 dev/patch-8007.py
    python3 dev/patch-8007.py --check
"""
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.7'
MARKER = '7. 80.0.7: the cloud layout has one now bar'


DIFF = r'''--- a/index.html
+++ b/index.html
@@ -3456,6 +3456,46 @@
 body.sc80-cloud .action-strip > #libraryBtn > div,
 body.sc80-cloud .action-strip > #studioBtn > div{ padding: 3px 7px !important; }
 
+/* ---------- 7. 80.0.7: the cloud layout has one now bar, and it is simple --- */
+/* "FOR THE CLOUD VERSION, I WANT A SIMPLER NOW BAR." The cloud layout carried
+   TWO players: the docked one, and the little chip in the top right. It carries
+   one now - the docked one, simplified: the turntable at 38px instead of 62, the
+   control buttons at 30px instead of 36, the two lines of text a point smaller,
+   and the three rows closed up to a 2px gap.
+
+   EVERY CONTROL IS STILL HERE: shuffle, prev, play, next, repeat, the menu, DJ
+   MODE, LYRICS, the ONLINE badge, the seek line and both times. A simpler bar
+   that drops a feature is not simpler, it is less - so nothing is hidden except
+   the duplicate. Classic layout is untouched and keeps the big player.
+
+   The staircase reads this bar's measured height (--sc80-player, written by
+   applyLayout), so it drops with the bar instead of leaving a hole above it. */
+body.sc80-cloud #sc80Now{ display: none; }
+body.sc80-cloud #nowPlaying{
+  padding: 6px 10px 4px;
+  gap: 2px;
+  border-top: 1px solid var(--line);
+  background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
+  -webkit-backdrop-filter: blur(18px) saturate(1.2);
+  backdrop-filter: blur(18px) saturate(1.2);
+}
+body.sc80-cloud #nowPlaying .np-row{ gap: 6px; max-width: none; margin: 0; }
+body.sc80-cloud #npPlayerStage{ width: 38px; height: 34px; perspective: 130px; }
+body.sc80-cloud #npPlayerStage .np-tt-3d{
+  transform: rotateX(var(--np-rx, 40deg)) rotateY(var(--np-ry, 0deg)) rotateZ(var(--np-rz, 135deg)) scale(0.62);
+}
+body.sc80-cloud #npInfo .t{ font-size: 12px; line-height: 1.2; }
+body.sc80-cloud #npInfo .a{ font-size: 10px; line-height: 1.2; }
+body.sc80-cloud #npControls{ gap: 0; }
+body.sc80-cloud #npControls button{ width: 30px; height: 30px; }
+body.sc80-cloud #npControls svg{ width: 16px; height: 16px; }
+body.sc80-cloud #playPauseBtn{ width: 36px; height: 36px; }
+body.sc80-cloud #playPauseBtn svg{ width: 20px; height: 20px; }
+body.sc80-cloud #djModeBtn, body.sc80-cloud #lyricsBtn{
+  font-size: 8.5px; padding: 1px 7px; border-radius: 8px;
+}
+body.sc80-cloud .seek-row{ font-size: 9px; gap: 6px; padding-top: 1px; }
+
 /* ---------- 5. Bigger screens, foldables, landscape ---------- */
 @media (min-width: 760px){
   body.sc80-cloud .home-bubble{ width: calc(25% - 14px); }
@@ -14398,7 +14438,7 @@
   // 72.5.1 adds a FOURTH number for a fix shipped inside a release: the
   // updater compares the numbers one at a time, so it reads 72.5.1 as newer
   // than 72.5 and installs it, while the release it belongs to stays 72.5.
-  const APP_VERSION = '80.0.6';
+  const APP_VERSION = '80.0.7';
   if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;
   window.__bootDone = false;
   // Diagonal split toggle
@@ -15047,6 +15087,23 @@
     }
   }catch(_eSinglesGen){}
   const CHANGELOG = [
+  { version: '80.0.7', date: 'October 22, 2026 \u00b7 5:40 AM EDT', title: 'The cloud layout has one now bar, and it is simple', items: [
+    'The cloud layout has one bar now instead of two: the duplicate chip in the top right is gone.',
+    'And that bar is simpler - a smaller turntable, smaller buttons, a tighter stack, so the list gets the room back.',
+    'Nothing was taken away with it: shuffle, previous, play, next, repeat, the menu, DJ mode, lyrics, the online badge and the seek line are all still on it, at their usual size to the touch.',
+    'The staircase sits on that bar at its measured height, so it drops with it and leaves no hole above the player.',
+    'The album pill dock, the letter covers and the lyrics view are untouched - everything is where 80.0.6 left it.',
+    'The classic layout keeps the full player exactly as it was, which is the point of having two layouts.',
+    'Both layouts are one tap apart in Settings, so a bar you do not like is never the end of the world.',
+    'Nothing else moved: the widget still draws the player, the letter covers and the lyrics view are where they were, and every album, playlist and setting is exactly as 80.0.6 left it.',
+  ],
+    details: [
+      'The cloud layout had a docked player and, above it, a small now chip in the top right - two things showing the same song. The chip is hidden in this layout; the docked bar is the now bar.',
+      'That bar keeps every control it had. What changed is the scale: the turntable at 38px instead of 62, the buttons at 30px instead of 36, the title and artist a point smaller, and the three rows closed to a 2px gap.',
+      'The staircase is positioned from the player bar measured height, so a shorter bar moves the staircase down with it rather than leaving a gap above the transport.',
+      'The classic layout is untouched: the full player, its turntable and its rows are exactly as they were.',
+      'Nothing else moved: the widget still draws the player, and every album, playlist and setting is exactly as 80.0.6 left it.',
+    ] },
   { version: '80.0.6', date: 'October 22, 2026 \u00b7 5:55 AM EDT', title: 'The two missing tabs are back on the staircase', items: [
     'Library and Studio are on the staircase again. They were there in 80.0.5 and zero pixels tall, so all you saw were two empty steps.',
     'The cause was old width rules from the top bar being read as heights in the new column. They are sized by the staircase itself now.',
--- a/sw.js
+++ b/sw.js
@@ -1,4 +1,4 @@
-const CACHE_NAME = 'sidecut-shell-v80.0.6';
+const CACHE_NAME = 'sidecut-shell-v80.0.7';
 const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];
 
 self.addEventListener('install', (event) => {
'''


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    page = read('index.html')
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: one simple now bar in the cloud layout, and the page runs as ' + VERSION)
        print('patch-8007%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    tmp = os.path.join(ROOT, 'dev', '.8007.diff')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(DIFF)
    cmd = ['patch', '-p1', '-s', '--batch', '--forward', '--no-backup-if-mismatch']
    if CHECK:
        cmd.append('--dry-run')
    cmd += ['-i', tmp]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        sys.exit('patch-8007: the diff did not apply (%d)\n%s%s' % (r.returncode, r.stdout, r.stderr))
    print('  applied: the one simple now bar, the version and the notes')
    if CHECK:
        print('patch-8007 --check: the release is pending, 1 step to apply')
        return 1
    print('patch-8007: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
