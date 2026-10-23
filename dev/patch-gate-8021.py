#!/usr/bin/env python3
"""80.2.1 - put this release's block into dev/staircase-check.cjs, and check it landed.

dev/staircase-check.cjs is the gate for the cloud layout: the wall, the flight, the
lyrics button and the reserved band. 80.2.1 changes what that gate has to answer for,
so the release carries its section alone - the same divide the release carries for the
page and for the Studio store-info block - and this puts it where it goes, before the
battery runs on the bytes it wrote.

Idempotent: the marker is the section's own heading.

    python3 dev/patch-gate-8021.py
    python3 dev/patch-gate-8021.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = "console.log('[7] 80.2.1: the icon is the cloud bar alone"

BANNER_OLD = """// 80.2 - ROUND BUBBLES THAT HOLD THEIR WORDS, A CURVE OF ICON TABS, LYRICS IN THE
// BAR, AND NO BAND OF EMPTY THEME COLOUR UNDER THE LISTS.
//
"""
BANNER_NEW = """// 80.2 - ROUND BUBBLES THAT HOLD THEIR WORDS, A CURVE OF ICON TABS, LYRICS IN THE
// BAR, AND NO BAND OF EMPTY THEME COLOUR UNDER THE LISTS.
//
// 80.2.1 - and the four things that release got wrong or left rough: the Lyrics icon
// painted in BOTH layouts (it is the cloud bar alone now), the diagonal seam of the
// old dock pill still drawn across the two split tiles, circles that wanted a little
// air, and a fade under the flight that was a patch behind the tiles rather than the
// width of the screen. Section [7] answers for those.
//
"""

ANCHOR = "console.log('');\nconsole.log(pass + ' passed, ' + fail + ' failed');"

SECTION = """console.log('[7] 80.2.1: the icon is the cloud bar alone, the seam is gone, the circles breathe');
{
  const block12 = src.indexOf('/* ---------- 12. 80.2.1: the icon stays in the cloud bar');
  ok(block12 > 0, 'the 80.2.1 block is in the page');
  // THE HIDE HAS TO OUTRANK #npControls button{ display:flex } - one id plus a type.
  ok(src.indexOf('#npControls #sc11Lyrics{ display:none;') > 0,
    'the lyrics icon is hidden at a weight that beats #npControls button');
  ok(src.indexOf('body.sc80-cloud #npControls #sc11Lyrics{ display:flex; }') > 0,
    'and the cloud bar still shows it');
  // THE SEAM: the svg inside each split tile stops painting; the halves already did.
  ok(src.indexOf('body.sc80-cloud #libraryBtn > svg,') > 0 &&
     src.indexOf('body.sc80-cloud #studioBtn > svg{ display:none; }') > 0,
    'the diagonal seam is off both split tiles');
  ok(count(src, '> svg{ display:none; }') === 1,
    'and that is the only thing the split tiles stop painting');
  // THE CIRCLES: more air, a lighter disc, a label that breaks without an orphan.
  const blockText = src.slice(block12, block12 + 4000);
  ok(blockText.indexOf('padding:14% 11%;') > 0, 'the circles carry more side padding');
  ok(blockText.indexOf('width:28px; height:28px;') > 0, 'the icon disc is a shade smaller');
  ok(blockText.indexOf('text-wrap:pretty;') > 0, 'and a two-line label breaks without an orphan');
  ok(blockText.indexOf('.hb-miniplay{ margin-top:8px; }') > 0 &&
     blockText.indexOf('#sc80CloudCtl{ margin-top:8px; gap:6px; }') > 0,
    'the buttons under the label have room to breathe');
  // THE FADE: from the left edge of the screen to the right one.
  ok(blockText.indexOf('left:calc(12px + 100% - 100vw);') > 0 &&
     blockText.indexOf('right:-12px;') > 0,
    'the fade under the flight spans the screen');
}

"""

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ('// 80.2.1 - and the four things that release got wrong or left rough', 'the gate names 80.2.1'),
    ("const block12 = src.indexOf('/* ---------- 12. 80.2.1:", 'the gate reads the 80.2.1 banner'),
    ("'#npControls #sc11Lyrics{ display:none;'", 'the hide that beats #npControls button is pinned'),
    ("body.sc80-cloud #studioBtn > svg{ display:none; }", 'the seam coming off the tiles is pinned'),
    ("'padding:14% 11%;'", 'the circles air is pinned'),
    ("'text-wrap:pretty;'", 'the label break is pinned'),
    ("'left:calc(12px + 100% - 100vw);'", 'the full-width fade is pinned'),
    ("const APP_VERSION = '80.2.1';", 'the gate pins 80.2.1'),
    ('sidecut-shell-v80.2.1', 'the gate pins the 80.2.1 shell cache'),
    ("version: '80.2.1'", 'the gate pins the 80.2.1 changelog head'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8021: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: section [7] is already in the gate')
    else:
        if CHECK:
            print('patch-gate-8021 --check: section [7] is not in the gate yet')
            return 1
        if src.count(BANNER_OLD) != 1 or src.count(ANCHOR) != 1:
            sys.exit('patch-gate-8021: the gate is not the shape this release expects')
        src = src.replace(BANNER_OLD, BANNER_NEW, 1)
        src = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        open(GATE, 'w', encoding='utf-8').write(src)
        print('  applied: the 80.2.1 banner and section [7]')
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8021: the gate is not the 80.2.1 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2.1: the icon, the seam, the circles and the fade (%d claims)' % len(CLAIMS))
    print('patch-gate-8021%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
