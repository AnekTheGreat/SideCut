#!/usr/bin/env python3
"""80.2.1 - the Lyrics icon belongs to the cloud bar, the seam comes off the tiles,
and the circles get a little air.

The owner, one release after 80.2:

  "THE EXTRA LYRICS BUTTON IN THE NOW BAR SHOULD SHOW FOR [THE] CLOUD MODE ...
   AND EDIT THE CIRCLES SLIGHTLY AND PATCH MINOR BUGS UP IN THAT MODE"

Four things, one page block, appended after 80.2's so every 80.2 rule still holds
unless this block says otherwise:

  1. THE ICON WAS IN BOTH BARS. 80.2 hid it with #sc11Lyrics{ display:none }, but
     #npControls button{ display:flex } is one id PLUS a type and outranks it, so the
     icon painted in the original layout too - a second Lyrics beside the LYRICS
     pill it forwards every tap to. The hide is spelled #npControls #sc11Lyrics.
  2. THE SEAM HAIRLINE WAS STILL ON THE TILES. Library and Studio are cut corner to
     corner by an <svg> inside the button, from the days when the dock was one pill.
     80.2 set the two label halves to opacity:0 and left the line painting.
  3. THE CIRCLES, A LITTLE. A lighter icon disc, a quieter coral wash, a touch more
     side padding, more room under the label, and a two-line label that breaks without
     leaving one word alone on its second line.
  4. THE FADE UNDER THE FLIGHT IS THE WIDTH OF THE SCREEN. The scrim reached 18px
     past the tiles, so a row of a list stood at full contrast beside them while the
     same row behind them was faded.

Idempotent: the marker is the 80.2.1 banner in the page.

    python3 dev/patch-8021.py
    python3 dev/patch-8021.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.1'
MARKER = '/* ---------- 12. 80.2.1: the icon stays in the cloud bar'

CSS_ANCHOR = '/* ---------- 5. Bigger screens, foldables, landscape ---------- */'

CSS_BLOCK = r'''/* ---------- 12. 80.2.1: the icon stays in the cloud bar, the seam leaves the
   tiles, the circles get a little air ---------------------------------------- */
/* "THE EXTRA LYRICS BUTTON IN THE NOW BAR SHOULD SHOW FOR THE CLOUD MODE ... AND
   EDIT THE CIRCLES SLIGHTLY AND PATCH MINOR BUGS UP IN THAT MODE."

   1. THE ICON WAS IN BOTH BARS. 80.2 hid it with #sc11Lyrics{ display:none }, and
      #npControls button{ display:flex } is one id PLUS a type, so it won: the icon
      painted in the original layout too, a second Lyrics beside the LYRICS pill it
      forwards to. The hide is at the weight that beat it; the cloud rule is 80.2's.
   2. THE SEAM WAS STILL ON THE TILES. Library and Studio are cut corner to corner
      by an <svg> inside the button - the diagonal the dock pill wore when it was
      one control. The two label halves are opacity:0; the line was not. It is now.
   3. THE CIRCLES, A LITTLE. Lighter icon discs, a quieter coral wash, more side
      padding, more room between the label and the buttons, and a two-line label that
      breaks without leaving one word alone on its second line.
   4. THE FADE WAS A PATCH, NOT A BAND. The scrim under the flight reached 18px past
      the tiles, so the row of a list beside them stayed at full contrast while the
      part behind them faded. It spans the screen now, so the whole band fades. */

/* 1. THE LYRICS ICON IS THE CLOUD BAR'S, AND ONLY THE CLOUD BAR'S. */
#npControls #sc11Lyrics{ display:none; width:32px; height:32px; }
body.sc80-cloud #npControls #sc11Lyrics{ display:flex; }

/* 2. THE SEAM COMES OFF THE TILES. The svg is pointer-events:none, so putting it
   away costs neither of the two taps the split halves still take. */
body.sc80-cloud #libraryBtn > svg,
body.sc80-cloud #studioBtn > svg{ display:none; }

/* 3. THE CIRCLES, A LITTLE: lighter disc, quieter wash, more air. */
body.sc80-cloud #homeBubbles{ gap:14px 12px; }
body.sc80-cloud #homeBubbles > .home-bubble{
  padding:14% 11%;
  gap:4px;
  background:
    radial-gradient(circle at 34% 26%, color-mix(in srgb, var(--coral) 11%, transparent), transparent 62%),
    linear-gradient(158deg, color-mix(in srgb, var(--bg-raised) 96%, transparent), color-mix(in srgb, var(--bg-raised) 78%, #000));
  box-shadow:0 9px 22px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.06),
             inset 0 -20px 34px rgba(0,0,0,0.14);
}
body.sc80-cloud #homeBubbles > .home-bubble.gold-bubble{
  background:
    radial-gradient(circle at 34% 26%, color-mix(in srgb, var(--gold) 13%, transparent), transparent 62%),
    linear-gradient(158deg, color-mix(in srgb, var(--bg-raised) 96%, transparent), color-mix(in srgb, var(--bg-raised) 78%, #000));
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-ico{
  width:28px; height:28px;
  margin:0 0 3px;
  background:color-mix(in srgb, var(--coral) 15%, transparent);
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-ico.gold{
  background:color-mix(in srgb, var(--gold) 17%, transparent);
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-value{
  font-size:clamp(16px, 4.5vw, 20px);
  letter-spacing:-0.3px;
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-label{
  font-size:10px; line-height:1.4;
  text-wrap:pretty;
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-miniplay{ margin-top:8px; }
body.sc80-cloud #sc80CloudCtl{ margin-top:8px; gap:6px; }

/* 4. THE FADE IS THE WIDTH OF THE SCREEN. The strip is anchored 12px from the
   right, so the distance to the left edge is 12px + its own width - the viewport. */
body.sc80-cloud .action-strip::before{
  left:calc(12px + 100% - 100vw);
  right:-12px;
  bottom:-14px;
  height:calc(100% + 34px);
  border-radius:0;
  background:linear-gradient(to top,
    color-mix(in srgb, var(--bg) 94%, transparent) 26%,
    color-mix(in srgb, var(--bg) 58%, transparent) 64%,
    transparent);
}

'''

HEAD_OLD = ("  { version: '80.2', date: 'October 22, 2026 \\u00b7 10:50 PM EDT', "
            "title: 'Round bubbles that hold their words, a curve of icon tabs, and Lyrics back in the bar', items: [\n")
HEAD_NEW = (
    "  { version: '80.2.1', date: 'October 23, 2026 \\u00b7 6:40 AM EDT', "
    "title: 'The Lyrics icon stays in the cloud bar, the seam leaves the tiles, the circles get air', items: [\n"
    "    'The Lyrics icon in the mini bar is the cloud layout only now: the original layout keeps its LYRICS pill and no longer shows a second Lyrics beside it.',\n"
    "    'The cloud tabs lose the hairline seam - the diagonal that cut the old dock pill was still painted across the Library and Studio tiles.',\n"
    "    'The circles get a little air: lighter icon discs, a quieter coral wash, more side padding and more room under the label before the buttons.',\n"
    "    'Long bubble labels keep both lines full and stop leaving one word alone on a line of its own.',\n"
    "    'The fade under the floating tabs spans the screen now, so a row of a list no longer stands at full contrast beside the tiles.',\n"
    "    'The now bar keeps its menu, its lyrics icon and its three transport buttons at the size 80.2 gave them; nothing moved in the bar.',\n"
    "    'The album pill dock, the letter covers, the widget, the player and the lyrics view are where 80.2 left them.',\n"
    "  ],\n"
    "    details: [\n"
    "      'The icon was hidden with #sc11Lyrics{ display:none }, and #npControls button{ display:flex } is one id plus a type, so the page painted it in both layouts. The hide is spelled #npControls #sc11Lyrics and the cloud rule is unchanged, so there is still one button, one handler and one lyrics view.',\n"
    "      'The seam is the <svg> inside #libraryBtn and #studioBtn that drew the diagonal of the old dock pill. It is pointer-events:none, so hiding it takes nothing from the two taps the split halves still take - it just stops drawing a line across a 44px tile.',\n"
    "      'The circles keep their column and their corners: the icon disc drops from 30px to 28px at 15 percent instead of 22, the coral wash from 16 to 11, the padding from 15/12 percent to 14/11, the gap under the value is 4px, the play button and the three header buttons move 8px down, and a two-line label breaks without leaving one word alone on its second line.',\n"
    "      'The scrim under the flight used to reach 18px past the tiles, which left the row of a list beside them at full contrast. It now runs from the left edge of the screen to the right edge, so the whole band fades into the page and only the tiles sit on it.',\n"
    "    ],\n"
    "  },\n"
) + HEAD_OLD


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and (("const APP_VERSION = '%s';" % VERSION) in page):
        print('  present: the 80.2.1 block and the page runs as ' + VERSION)
        print('patch-8021%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    bad = []
    if page.count(CSS_ANCHOR) != 1:
        bad.append('the bigger-screens banner (%d)' % page.count(CSS_ANCHOR))
    if page.count(HEAD_OLD) != 1:
        bad.append('the 80.2 changelog head (%d)' % page.count(HEAD_OLD))
    if "const APP_VERSION = '80.2';" not in page:
        bad.append('the version')
    if "'sidecut-shell-v80.2'" not in sw:
        bad.append('the shell cache')
    if bad:
        sys.exit('patch-8021: the page is not the shape this release expects (%s)' % ', '.join(bad))
    if CHECK:
        print('patch-8021 --check: the release is pending, 4 steps to apply')
        return 1
    page = page.replace(CSS_ANCHOR, CSS_BLOCK + CSS_ANCHOR, 1)
    page = page.replace(HEAD_OLD, HEAD_NEW, 1)
    page = page.replace("const APP_VERSION = '80.2';", "const APP_VERSION = '%s';" % VERSION, 1)
    open(page_path, 'w', encoding='utf-8').write(page)
    sw = sw.replace("'sidecut-shell-v80.2'", "'sidecut-shell-v%s'" % VERSION, 1)
    open(sw_path, 'w', encoding='utf-8').write(sw)
    print('  applied: the 80.2.1 block, the changelog head, the version and the shell cache')
    print('patch-8021: 4 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
