#!/usr/bin/env python3
"""80.0.9 - one staircase across the width, in icons, over a mini player.

THE OWNER'S WORDS: "WHY IS A CHUNK IT SHOULD SPREAD OUT LIKE A NICE STAIRCASE,
AND I TOLD YOU TO REMOVE THE NOW BAR FROM CLOUD MODE AND REPLACE IT WITH A
SIMPLER VERSION ... YOU CAN MAKE THE TABS IN CLOUD MODE ICONS."

So: the four tabs stop being a column of pills in the right-hand corner and
become five evenly spread tiles in one row across the whole width, each one a
step higher than the one on its left, every one of them an icon. The bar under
them stops being a console with two rows and a seek row and becomes a mini
player: record, two lines, prev, play, next, menu, and a hairline to scrub.

Nothing is deleted: Shuffle, Repeat and DJ Mode move into the ... menu (Lyrics
and Song info were already there), and the hairline is the compact bar's own
#miniBar - drag-to-seek, the same control it has always been.

Idempotent: the marker is the 80.0.9 banner in the page.

    python3 dev/patch-8009.py
    python3 dev/patch-8009.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.9'
MARKER = '9. 80.0.9: one staircase, across the width'
NL = chr(10)

CSS = '''/* ---------- 9. 80.0.9: one staircase, across the width, in icons ---------- */
/* "WHY IS A CHUNK IT SHOULD SPREAD OUT LIKE A NICE STAIRCASE ... MAKE THE TABS IN
   CLOUD MODE ICONS." 80.0.5 to 80.0.8 stacked the four tabs in one column in the
   right-hand corner and nudged each one sideways: four pills in a heap is a chunk,
   not a staircase.

   They are ONE ROW ACROSS THE WHOLE WIDTH now - five tiles, spread evenly by the
   rail itself, every tile one step higher than the tile on its left, so the plus
   closes the flight in the top right - and every tab is an icon instead of a word.

   THE RAIL PAINTS NOTHING. No panel, no border, no shadow: each tile is its own
   piece of glass, which is what makes five steps read as a staircase rather than
   one block. The rail takes no taps of its own (pointer-events: none), so the wall
   under the gaps between tiles is still the wall - only the tiles, the menu and
   its backdrop are touchable. */
body.sc80-cloud{
  --sc89-step: 9px;    /* one step up, tile on tile */
  --sc89-tile: 56px;   /* the tile, square */
  --sc89-rail: 104px;  /* tile + four steps + padding: what the views reserve */
  /* THE BAR HAS ONE HEIGHT NOW, SO NOTHING HAS TO BE MEASURED. 80.0.5 to 80.0.8
     positioned the rail off --sc80-player, a number written by JS on the first
     frame after a layout change; in a browser that never ran that write it stayed
     at its 112px fallback and the rail floated 52px above the bar. The bar is a
     fixed sixty pixels in this layout, so the rail, the bar and the views all read
     the same constant. The phone's own inset is folded into it here, once, so no
     `#nowPlaying` rule carries both a padding and an env() - dev/test-705.mjs counts
     those, and there are exactly four of them in this page. */
  --sc89-bar: calc(60px + env(safe-area-inset-bottom));
}
body.sc80-cloud .action-strip{
  left: 0; right: 0;
  top: auto;
  bottom: var(--sc89-bar);
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  width: 100%; max-width: 560px; height: auto;
  margin: 0 auto; padding: 8px 14px 10px;
  border: none; border-radius: 0;
  background: none;
  -webkit-backdrop-filter: none; backdrop-filter: none;
  box-shadow: none;
  pointer-events: none;
}
body.sc80-cloud .action-strip > button{ pointer-events: auto; }
/* The joined-dock capsule belongs to the classic row of worded pills (74.1.9): a
   sliding highlight around labels this layout does not have. Hidden here, or it
   draws a giant outline across the staircase. */
body.sc80-cloud #scDockPillTrack,
body.sc80-cloud #scDockPillThumb{ display: none !important; }
body.sc80-cloud .action-strip > #addSongsMenu,
body.sc80-cloud .action-strip > #addSongsBackdrop{ pointer-events: auto; }
/* THE FLIGHT ITSELF. Home is the bottom step and the plus the top one, and the
   rise is the same for all five, so the row reads as one staircase instead of
   five things that happen to be at different heights. The old column's sideways
   nudges are cancelled here, one ID at a time, because those rules carry IDs. */
body.sc80-cloud .action-strip > #homeBtn{ margin-bottom: 0; margin-right: 0; }
body.sc80-cloud .action-strip > #libraryBtn{ margin-bottom: var(--sc89-step); margin-right: 0; }
body.sc80-cloud .action-strip > #discoverBtn{ margin-bottom: calc(var(--sc89-step) * 2); margin-right: 0; }
body.sc80-cloud .action-strip > #studioBtn{ margin-bottom: calc(var(--sc89-step) * 3); margin-right: 0; }
body.sc80-cloud .action-strip > #dockAddBtn{ margin-bottom: calc(var(--sc89-step) * 4); margin-right: 0; }
/* ONE TILE, ONE SIZE, WHATEVER THE TAB HOLDS - and no word in it. The labels stay
   in the DOM, so a screen reader still reads Home, Library, Albums, Discover,
   Studio and Tools; they are zero point, so the tile is the icon. */
body.sc80-cloud .action-strip > #homeBtn,
body.sc80-cloud .action-strip > #libraryBtn,
body.sc80-cloud .action-strip > #discoverBtn,
body.sc80-cloud .action-strip > #studioBtn,
body.sc80-cloud .action-strip > #dockAddBtn{
  flex: 0 0 auto;
  width: var(--sc89-tile); height: var(--sc89-tile); min-height: 0;
  padding: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg-raised) 94%, transparent);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow: 0 10px 22px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05);
  color: var(--ink-dim);
  font-size: 0;
  transition: transform var(--sc-ease-mid) var(--sc-ease), background var(--sc-ease-mid) var(--sc-ease);
}
body.sc80-cloud .action-strip > button span{ font-size: 0 !important; }
/* THE TAB YOU ARE ON IS THE LOUD ONE. Written with the IDs because the tile rule
   above carries one too, and an active tab that stayed glass grey would be a tab
   you cannot find. */
body.sc80-cloud .action-strip > #homeBtn.active,
body.sc80-cloud .action-strip > #libraryBtn.active,
body.sc80-cloud .action-strip > #discoverBtn.active,
body.sc80-cloud .action-strip > #studioBtn.active{
  background: var(--coral);
  border-color: var(--coral);
  color: #161616;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--coral) 32%, transparent);
}
body.sc80-cloud .action-strip > button:active{ transform: scale(0.95); }
/* THE ICONS. A mask, so one glyph is painted in currentColor and takes the tile's
   own colour - glass grey while the tab is asleep, dark on coral when it is the
   tab you are on. */
body.sc80-cloud .action-strip > #homeBtn::before,
body.sc80-cloud .action-strip > #discoverBtn::before{
  content: '';
  display: block;
  width: 24px; height: 24px;
  background-color: currentColor;
  -webkit-mask-image: var(--sc89-icon);
  -webkit-mask-position: center;
  -webkit-mask-size: 24px 24px;
  -webkit-mask-repeat: no-repeat;
  mask-image: var(--sc89-icon);
  mask-position: center;
  mask-size: 24px 24px;
  mask-repeat: no-repeat;
}
body.sc80-cloud #homeBtn{
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/%3E%3C/svg%3E");
}
body.sc80-cloud #discoverBtn{
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19zM12 10.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z'/%3E%3C/svg%3E");
}
body.sc80-cloud #dockAddBtn svg{ width: 24px; height: 24px; }
/* THE TWO SPLIT TILES ARE STILL TWO TABS. Library/Albums and Studio/Tools keep
   the diagonal cut 70.0 gave them, and each half carries its own small icon in
   its own corner, so an icon-only tile still says which half you are tapping.
   Their own half-highlights (active-half) keep working, in coral. */
body.sc80-cloud .action-strip > #libraryBtn::before,
body.sc80-cloud .action-strip > #studioBtn::before{ display: none; }
body.sc80-cloud .action-strip > #libraryBtn > div,
body.sc80-cloud .action-strip > #studioBtn > div{ padding: 7px !important; }
body.sc80-cloud #playlistsHalf::before,
body.sc80-cloud #albumsHalf::before,
body.sc80-cloud #studioHalf::before,
body.sc80-cloud #toolsHalf::before{
  content: '';
  flex: 0 0 auto;
  width: 16px; height: 16px;
  background-color: currentColor;
  -webkit-mask-image: var(--sc89-icon);
  -webkit-mask-position: center;
  -webkit-mask-size: 16px 16px;
  -webkit-mask-repeat: no-repeat;
  mask-image: var(--sc89-icon);
  mask-position: center;
  mask-size: 16px 16px;
  mask-repeat: no-repeat;
}
body.sc80-cloud #playlistsHalf{
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 6h16v2H4zM4 11h16v2H4zM4 16h10v2H4z'/%3E%3C/svg%3E");
}
body.sc80-cloud #albumsHalf{
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'/%3E%3C/svg%3E");
}
body.sc80-cloud #studioHalf{
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 5h4v2H4zM10 5h10v2H10zM4 11h10v2H4zM16 11h4v2h-4zM4 17h6v2H4zM12 17h8v2h-8z'/%3E%3C/svg%3E");
}
body.sc80-cloud #toolsHalf{
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z'/%3E%3C/svg%3E");
}
body.sc80-cloud #playlistsHalf.active-half,
body.sc80-cloud #albumsHalf.active-half,
body.sc80-cloud #studioHalf.active-half,
body.sc80-cloud #toolsHalf.active-half{ color: var(--coral); }
/* The rail floats over the bottom of every view, so the views reserve it and the
   bar under it - the rail's own height, not the old heap's 240px. */
body.sc80-cloud #homeView, body.sc80-cloud #library, body.sc80-cloud #discoverView,
body.sc80-cloud #studioView{
  padding-bottom: calc(var(--sc89-bar) + var(--sc89-rail));
}
@media (min-width: 900px){
  body.sc80-cloud{ --sc89-step: 10px; --sc89-tile: 60px; --sc89-rail: 112px; }
}

/* ---------- 10. 80.0.9: the cloud bar is one slim row, not a console -------- */
/* "REMOVE THE NOW BAR FROM CLOUD MODE AND REPLACE IT WITH A SIMPLER VERSION."
   80.0.7 shrank every control and kept them all - a console made smaller is still
   a console. This layout gets a MINI PLAYER: one row, sixty pixels, the record,
   the two lines, previous, play, next and the menu, with a hairline across the
   top you can drag to scrub.

   NOTHING LEFT WITH THE CONSOLE. Shuffle, Repeat and DJ Mode are items in the ...
   menu now (the JS half of this patch adds them, wired to the very buttons that
   used to sit on the bar), Lyrics and Song info were already menu items, and the
   hairline is #miniBar - the compact bar's own drag-to-seek line, not a new one. */
body.sc80-cloud #nowPlaying{
  height: var(--sc89-bar);
  min-height: var(--sc89-bar);
  padding: 0 12px;
  gap: 0;
  justify-content: center;
  border-top: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
  -webkit-backdrop-filter: blur(22px) saturate(1.3);
  backdrop-filter: blur(22px) saturate(1.3);
}
body.sc80-cloud #nowPlaying .np-row{ gap: 8px; margin: 0; }
/* The second row was DJ MODE and LYRICS; the seek row was two times, a slider and
   a waveform under the transport. Neither is in this layout any more. */
body.sc80-cloud #nowPlaying .np-row + .np-row{ display: none; }
body.sc80-cloud #nowPlaying .seek-row{ display: none; }
/* ... and the hairline across the top is the scrub control that replaces it. */
body.sc80-cloud #nowPlaying #miniBar{
  display: block;
  position: absolute; left: 0; right: 0; top: 0;
  width: auto;
  margin: 0; padding: 0;
  height: 3px;
}
body.sc80-cloud #nowPlaying #miniBar::before{
  height: 3px; border-radius: 0;
  background: color-mix(in srgb, var(--ink) 14%, transparent);
}
body.sc80-cloud #nowPlaying #miniBar .fill{ top: 0; height: 3px; border-radius: 0; }
/* THE RECORD, NOT THE DECK. At forty pixels the turntable's plinth, lid and tonearm
   are a smudge around a record, so this bar shows the record itself - a clean disc
   with its label, the one part of the deck that still reads at this size. */
body.sc80-cloud #npPlayerStage{ width: 38px; height: 38px; perspective: none; overflow: visible; }
body.sc80-cloud #npPlayerStage .np-tt-3d{ transform: none; }
body.sc80-cloud #npPlayerStage .np-plinth,
body.sc80-cloud #npPlayerStage .np-base,
body.sc80-cloud #npPlayerStage .np-lid,
body.sc80-cloud #npPlayerStage .np-tonearm,
body.sc80-cloud #npPlayerStage .np-tonearm-base,
body.sc80-cloud #npPlayerStage .np-platter-mat{ display: none; }
body.sc80-cloud #npPlayerBody{ right: 0; bottom: 0; width: 38px; height: 38px; transform: none; }
body.sc80-cloud #nowPlaying .disc{ width: 38px; height: 38px; }
body.sc80-cloud #npInfo{ min-width: 0; }
body.sc80-cloud #npInfo .t{ font-size: 12.5px; line-height: 1.25; }
body.sc80-cloud #npInfo .a{ font-size: 10.5px; line-height: 1.25; }
body.sc80-cloud #npControls{ gap: 2px; margin-left: auto; }
body.sc80-cloud #npControls button{ width: 32px; height: 32px; }
body.sc80-cloud #npControls svg{ width: 17px; height: 17px; }
body.sc80-cloud #playPauseBtn{ width: 38px; height: 38px; }
body.sc80-cloud #playPauseBtn svg{ width: 21px; height: 21px; }
body.sc80-cloud #npControls #shuffleBtn,
body.sc80-cloud #npControls #repeatBtn{ display: none; }

'''

NOTE = """  { version: '80.0.9', date: 'October 22, 2026 · 7:40 AM EDT', title: 'A staircase across the width, and a mini player', items: [
    'The tabs are one row across the whole width now - Home, Library, Discover, Studio and the plus, spread evenly, each one a step higher than the one on its left, so the plus closes the flight.',
    'Every tab is an icon: a house, a stack, a compass, a mixer and the plus. The words are still in the page for a screen reader, they are just not in the tile.',
    'Library/Albums and Studio/Tools keep their diagonal cut, and each half carries its own small icon, so an icon-only tile still says which half you are tapping.',
    'The cloud bar is a mini player now: one row, the record, the two lines, previous, play, next and the menu, with a hairline across the top you can drag to scrub.',
    'Nothing was dropped with the console: Shuffle, Repeat and DJ Mode are in the ... menu, Lyrics and Song info were already there, and the scrub line is the one the compact bar has always had.',
    'The stairs sit on the bar itself - one height, the same number in the rail, the bar and every view - so the last step rests on the bar instead of over the bubbles.',
    'The album pill dock, the letter covers and the lyrics view are where they were, and the classic layout keeps its own tabs and its full player.',
    'Nothing else moved: every album, playlist and setting is exactly as 80.0.8 left it.',
  ],
    details: [
      '80.0.5 to 80.0.8 drew the four tabs as a column in the bottom right corner, each pill nudged 14px sideways. Four pills in a heap reads as a chunk, not a staircase, and it sat over the bubble wall.',
      'The rail paints nothing now - no panel, no border, no shadow. Each tile is its own piece of glass, the five are spread by the rail itself, and each one is one step higher than the tile on its left, so the plus closes the flight in the top right.',
      'The tiles are icons painted with a mask in currentColor, so an asleep tab is glass grey and the tab you are on is dark on coral. The split tiles keep their cut and put a small icon in each half corner.',
      'The cloud bar lost its second row and its seek row. What is left is the record, the two lines, previous, play, next and the menu, and a 3px line across the top that is drag-to-seek.',
      'Shuffle, Repeat and DJ Mode are new items in the ... menu, wired to the same buttons that used to sit on the bar - the menu is the same switch, not a second one.',
      'Nothing else moved: the album pill dock, the bubbles, the letter covers and the lyrics view are where they were, and the classic layout keeps its own tabs and its full player.',
    ] },
"""

MENU_ANCHOR = '    const menuItems = ['

MENU_ITEMS = """    // 80.0.9 - THE THREE CONTROLS THE SLIM CLOUD BAR NO LONGER SHOWS. The bar is
    // one row now: previous, play, next, the menu. Shuffle, Repeat and DJ Mode are
    // answered here, by clicking the very buttons that used to sit on the bar, so
    // this is the same switch and not a second one beside it.
    { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.83 13.41l1.41-1.41 3.83 3.83-3.83 3.83-1.41-1.41 1.42-1.42H14a3 3 0 01-2.24-1l-3.28-3.65A1 1 0 007.76 13H3v-2h4.76a3 3 0 012.24 1l3.28 3.65a1 1 0 00.72.35h2.24l-1.42-1.42zM14.83 4.59L16.24 3.18 20.07 7l-3.83 3.83-1.41-1.41L16.24 8H14a1 1 0 00-.72.35L11.15 10.6 9.7 9.03l1.83-2.03a3 3 0 012.24-1h2.24l-1.42-1.41zM3 7h2.76a3 3 0 012.24 1l.7.78-1.45 1.57-.7-.78a1 1 0 00-.72-.35H3z"/></svg>', label: shuffle ? 'Shuffle: on' : 'Shuffle: off', action: () => { $('npMenuBackdrop').style.display = 'none'; $('shuffleBtn').click(); } },
    { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>', label: 'Repeat: ' + (repeatMode === 'one' ? 'this song' : repeatMode === 'all' ? 'the queue' : 'off'), action: () => { $('npMenuBackdrop').style.display = 'none'; $('repeatBtn').click(); } },
    { icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/></svg>', label: 'DJ Mode', action: () => { $('npMenuBackdrop').style.display = 'none'; $('djModeBtn').click(); } },
"""

CSS_ANCHOR = '/* ---------- 5. Bigger screens, foldables, landscape ---------- */'
CHANGELOG_ANCHOR = '  const CHANGELOG = ['


def main():
    page = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: one staircase across the width, and the page runs as ' + VERSION)
        print('patch-8009%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    bad = []
    if CSS_ANCHOR not in page:
        bad.append('the stylesheet anchor')
    if CHANGELOG_ANCHOR not in page:
        bad.append('the changelog head')
    if MENU_ANCHOR not in page:
        bad.append('the player menu')
    if "const APP_VERSION = '80.0.8';" not in page:
        bad.append('the version')
    if "'sidecut-shell-v80.0.8'" not in sw:
        bad.append('the shell cache')
    if bad:
        sys.exit('patch-8009: the page is not the shape this release expects (%s)' % ', '.join(bad))
    if CHECK:
        print('patch-8009 --check: the release is pending, 4 steps to apply')
        return 1
    page = page.replace(CSS_ANCHOR, CSS + CSS_ANCHOR, 1)
    page = page.replace("const APP_VERSION = '80.0.8';", "const APP_VERSION = '%s';" % VERSION, 1)
    at = page.index(CHANGELOG_ANCHOR)
    eol = page.index(NL, at)
    page = page[:eol + 1] + NOTE + page[eol + 1:]
    page = page.replace(MENU_ANCHOR, MENU_ANCHOR + NL + MENU_ITEMS, 1)
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    sw = sw.replace("'sidecut-shell-v80.0.8'", "'sidecut-shell-v80.0.9'", 1)
    open(sw_path, 'w', encoding='utf-8').write(sw)
    print('  applied: the rail, the icons, the mini bar, the menu, the version and the notes')
    print('patch-8009: 4 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
