#!/usr/bin/env python3
"""80.0.8 - the staircase is one dock, and it hugs the bar.

FLOATING: the dock sits at `var(--sc80-player) + 10px`, and that number was
measured once on the first frame after a layout change and never again - so on a
phone the dock sat ~90px too high, across the bubble wall. It is written from a
ResizeObserver on the bar now, plus resize/orientation and two delayed passes.

NOISE: five separate glass capsules over a wall of glass bubbles is noise. The
steps stay (each tab one notch right of the one above) but they sit on ONE rounded
glass panel, the pills inside unpainted until active, the plus the panel's own.

Idempotent: the marker is the 80.0.8 banner in the page.

    python3 dev/patch-8008.py
    python3 dev/patch-8008.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.8'
MARKER = '8. 80.0.8: the staircase is one dock'

CSS = '''/* ---------- 8. 80.0.8: the staircase is one dock, and it hugs the bar ------- */
/* "MAKE IT BETTER BRO WHAT THE HELL IS THIS." Two things were wrong.

   ONE: it floated in the middle of the wall. The staircase is positioned from
   --sc80-player, the bar measured height, and that was measured ONCE on the first
   frame after the layout changed - before the bar had its final height - then
   never again. It sat ~90px too high on a phone, over the bubbles. The measure now
   runs from a ResizeObserver on the bar (patch-8008's JS half) plus a resize and
   an orientation change, so the dock follows the bar.

   TWO: five separate glass capsules over a wall of glass bubbles is noise. The
   steps stay - each tab is still one notch right of the one above - but they sit
   ON one dock now: a single rounded glass panel with a border, a shadow and a
   blur, and the pills inside it are unpainted until one is active. The plus is
   the dock own button in its corner. One object, not six. */
body.sc80-cloud .action-strip{
  padding: 8px;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: color-mix(in srgb, var(--bg-raised) 88%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  backdrop-filter: blur(20px) saturate(1.2);
  box-shadow: 0 18px 40px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05);
}
body.sc80-cloud .action-strip > button{
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none; backdrop-filter: none;
  border-radius: 16px;
}
body.sc80-cloud .action-strip > button.active,
body.sc80-cloud .action-strip > button[aria-current="page"]{
  background: color-mix(in srgb, var(--coral) 24%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--coral) 40%, transparent);
}
body.sc80-cloud .action-strip > #dockAddBtn{
  background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
  border-color: var(--line);
}
body.sc80-cloud{ --sc80-step: 14px; }

'''

NOTE = '''  { version: '80.0.8', date: 'October 22, 2026 \\u00b7 6:10 AM EDT', title: 'The staircase is one dock now, and it hugs the bar', items: [
    'The staircase sits on one glass dock instead of five floating capsules, so it reads as one thing instead of five.',
    'It also stopped floating in the middle of the wall: it follows the player bar now, every time the bar changes height.',
    'The steps are still there - each tab one notch to the right of the one above it - and the plus is the dock own button in its corner.',
    'The active tab is the one that is painted, so where you are is the loudest thing in the dock.',
    'The smaller turntable and the tighter rows from 80.0.7 are untouched, and so is every control on the bar.',
    'The album pill dock, the letter covers and the lyrics view are where they were - none of this reached them.',
    'The classic layout keeps its own bottom tabs and its full player, exactly as they were.',
    'Nothing else moved: the widget still draws the player, the letter covers and the lyrics view are where they were, every album, playlist and setting is exactly as 80.0.7 left it, and the bubbles are untouched.',
  ],
    details: [
      '80.0.5 to 80.0.7 drew the four tabs as four separate glass capsules floating over the bubble wall. Over a wall of glass bubbles that is noise, and on a phone the whole stack also sat too high, over the content.',
      'The offset is the bar measured height, and it was measured once on the first frame after a layout change - before the bar had settled - then cached. It is now written from a ResizeObserver on the bar, and once more on a resize or an orientation change, so the dock moves with the bar.',
      'The dock is one rounded panel with a border, a shadow and a blur. The pills inside are unpainted until one is active, which is what makes one object out of five steps.',
      'The steps themselves are unchanged in meaning: the top tab is furthest left and each one below it moves right by 14px, so the plus in the corner closes the staircase.',
      'Nothing else moved: the widget still draws the player, the letter covers and the lyrics view are where they were, and every album, playlist and setting is exactly as 80.0.7 left it.',
    ] },
'''

OLD_JS = """        if(cloud){
          var np = document.getElementById('nowPlaying');
          var nh = np ? Math.round(np.getBoundingClientRect().height || 0) : 0;
          if(nh > 40 && nh < 320) document.documentElement.style.setProperty('--sc80-player', nh + 'px');
        }"""
NEW_JS = """        if(cloud){
          var np = document.getElementById('nowPlaying');
          var nh = np ? Math.round(np.getBoundingClientRect().height || 0) : 0;
          if(nh > 40 && nh < 320) document.documentElement.style.setProperty('--sc80-player', nh + 'px');
          // 80.0.8 - KEEP IT TRUE. The bar's height changes (a new track, the
          // lyrics line, a keyboard, a safe-area inset), and the staircase is
          // positioned off this one number. Measuring it once on the first frame
          // after a layout change left the dock ~90px too high, over the wall, on
          // a phone. The observer writes it whenever the bar actually changes.
          if(np && !np.__sc80PlayerRO){
            var writePlayerHeight = function(){
              var h = Math.round(np.getBoundingClientRect().height || 0);
              if(h > 40 && h < 320) document.documentElement.style.setProperty('--sc80-player', h + 'px');
            };
            np.__sc80PlayerRO = true;
            if(window.ResizeObserver){
              try{ new ResizeObserver(writePlayerHeight).observe(np); }catch(_eRO){}
            }
            window.addEventListener('resize', writePlayerHeight);
            window.addEventListener('orientationchange', writePlayerHeight);
            setTimeout(writePlayerHeight, 120);
            setTimeout(writePlayerHeight, 900);
          }
        }"""


def main():
    page = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the staircase is one dock, and the page runs as ' + VERSION)
        print('patch-8008%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    anchor = '/* ---------- 5. Bigger screens, foldables, landscape ---------- */'
    bad = []
    if anchor not in page:
        bad.append('the stylesheet anchor')
    if OLD_JS not in page:
        bad.append('the layout measure')
    if "const APP_VERSION = '80.0.7';" not in page:
        bad.append('the version')
    if '  const CHANGELOG = [\n' not in page:
        bad.append('the changelog head')
    if 'sidecut-shell-v80.0.7' not in open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read():
        bad.append('the shell cache')
    if bad:
        sys.exit('patch-8008: the page is not the shape this release expects (%s)' % ', '.join(bad))
    if CHECK:
        print('patch-8008 --check: the release is pending, 1 step to apply')
        return 1
    page = page.replace(anchor, CSS + anchor, 1)
    page = page.replace("const APP_VERSION = '80.0.7';", "const APP_VERSION = '80.0.8';", 1)
    page = page.replace('  const CHANGELOG = [\n', '  const CHANGELOG = [\n' + NOTE, 1)
    page = page.replace(OLD_JS, NEW_JS, 1)
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
    sw = sw.replace("'sidecut-shell-v80.0.7'", "'sidecut-shell-v80.0.8'", 1)
    open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8').write(sw)
    print('  applied: the dock, the observer, the version and the notes')
    print('patch-8008: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
