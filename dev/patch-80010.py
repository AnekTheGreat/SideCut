#!/usr/bin/env python3
"""80.0.10 - a small flight in the corner, a bar that covers the bottom, and the
add-songs sheet where the plus is.

THE OWNER, ON 80.0.9: "THE ADD SONGS POPUP ISNT SHOWIJG IN CLOUD MODE JUST MAKE IT
ICONS ON THE BOTTOM IS A SMALL BOTTOM RIGBT STAIRCASE. THE SIMPLIEF NOW BAR SHOULD
COVER THE BOTTOM NOT PORTUDE LIKE IT IS NOW FIX IT AND ADD INPROVEMENTS TO THE USER
EXPERIENCE"

Three faults, one design:

  1. THE SHEET WAS OFF SCREEN, not missing. 80.0.9 kept the old dock rule
     `#addSongsMenu{ bottom: calc(100% + 10px) }` from a menu hanging off the bottom
     of the screen. The menu is position:fixed inside a fixed strip, so 100% is the
     VIEWPORT: it opened a full screen above the top edge, and the plus looked dead.
     It is a screen-level sheet now - fixed above the bar, with its own X, Escape,
     the backdrop, and a close after you pick something.

  2. THE FLIGHT WAS A WALL. Five treads across the WHOLE width, each one a riser
     taller than the one before, is a band with steps, not a staircase. This is five
     46px treads joined edge to edge in the bottom RIGHT corner: each one exactly
     10px taller than the one on its left, all standing on the bar, the plus closing
     the flight at the top. 230px wide. A corner control.

  3. THE BAR STOOD PROUD. 80.0.3 lifted it by the phone's inset and 80.0.9 gave it
     the inset's height on top of that, so it floated one inset above the edge with a
     strip of the page underneath. Bottom zero, full width, the inset part of the bar.

Replaces the 80.0.9 cloud block wholesale rather than layering another set of IDs on
top of it. The JS half adds the X, Escape, the close-on-pick and the reparent.

Idempotent: the marker is the 80.0.10 banner in the page.

    python3 dev/patch-80010.py
    python3 dev/patch-80010.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.10'
MARKER = '9. 80.0.10: a small flight in the corner'
NL = chr(10)

START = '/* ---------- 9. 80.0.9: the flight, built across the whole width ------------- */'
END = '/* ---------- 5. Bigger screens, foldables, landscape ---------- */'

CSS = '''/* ---------- 9. 80.0.10: a small flight in the corner, a bar that covers ------ */
/* "JUST MAKE IT ICONS ON THE BOTTOM IS A SMALL BOTTOM RIGBT STAIRCASE. THE
   SIMPLIEF NOW BAR SHOULD COVER THE BOTTOM NOT PORTUDE LIKE IT IS NOW."

   80.0.9 answered the icon request with five treads across the WHOLE width, each
   one a riser taller than the one before. Five treads the width of the screen is a
   wall with steps, and on the phone it stood on the bubble grid.

   THIS IS THE FLIGHT: five treads, 46px wide, joined edge to edge, standing on the
   top of the bar in the bottom RIGHT corner. Each tread is exactly one riser (10px)
   taller than the one on its left, so the tops climb from the first step to the
   plus and the icons climb with them. It is 230px wide - a corner control, not a
   band across the page.

   AND THE BAR COVERS THE BOTTOM. 80.0.3 lifted the player by the phone's inset and
   80.0.9 gave it the inset's height as well, so it stood one inset above the edge
   with a strip of the page showing under it. Bottom zero, full width, the inset is
   part of the bar, and nothing of the page shows below it.

   The add-songs sheet is fixed above the bar. It used to open a screen above the
   TOP edge: `bottom: calc(100% + 10px)` on a fixed child of a fixed strip measures
   the viewport, not the strip. */
body.sc80-cloud{
  --sc10-row: 60px;                                        /* the mini player's row */
  --sc10-bar: calc(var(--sc10-row) + env(safe-area-inset-bottom));
  --sc10-tread: 46px;                                      /* one step, wide */
  --sc10-rise: 10px;                                       /* one riser, tall */
  --sc10-rail: calc(var(--sc10-tread) + var(--sc10-rise) * 4);
}
/* THE BAR, EDGE TO EDGE AND FLUSH WITH THE BOTTOM. Height carries the inset and the
   row sits at the top of it, so the controls are where a thumb expects them and the
   inset's own strip is bar, not page. It is nearly opaque: the wall of bubbles must
   not read through the transport. */
body.sc80-cloud #nowPlaying{
  left: 0; right: 0; bottom: 0;
  width: 100%; max-width: none; margin: 0;
  height: var(--sc10-bar); min-height: var(--sc10-bar);
  padding: 0 12px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: flex-start;
  border-radius: 0;
  border: 0;
  background: color-mix(in srgb, var(--bg-raised) 96%, #000);
  -webkit-backdrop-filter: blur(22px) saturate(1.25);
  backdrop-filter: blur(22px) saturate(1.25);
  /* The top hairline is the scrub track, so the edge itself adds no second line -
     and an inset shadow keeps the row's sixty pixels inside the bar's height. */
  box-shadow: inset 0 1px 0 var(--line), 0 -12px 34px rgba(0,0,0,0.40);
  z-index: 55;
}
body.sc80-cloud #nowPlaying .np-row{
  flex: 0 0 var(--sc10-row); height: var(--sc10-row);
  width: 100%; max-width: 760px; margin: 0 auto; gap: 10px;
}
/* The DJ/LYRICS row and the seek row are not in this layout; the hairline on top of
   the bar is the scrub control, and DJ Mode, Lyrics, Shuffle and Repeat live in the
   ... menu. */
body.sc80-cloud #nowPlaying .np-row + .np-row{ display: none; }
body.sc80-cloud #nowPlaying .seek-row{ display: none; }
body.sc80-cloud #nowPlaying #miniBar{
  display: block;
  position: absolute; left: 0; right: 0; top: 0;
  width: auto;
  margin: 0; padding: 0;
  height: 3px;
}
body.sc80-cloud #nowPlaying #miniBar::before{
  height: 3px; border-radius: 0;
  background: color-mix(in srgb, var(--ink) 16%, transparent);
}
body.sc80-cloud #nowPlaying #miniBar .fill{ top: 0; height: 3px; border-radius: 0; }
/* THE RECORD, NOT THE DECK. At forty pixels the turntable's plinth, lid and tonearm
   are a smudge around a record, so this bar shows the record itself. */
body.sc80-cloud #npPlayerStage{ width: 40px; height: 40px; perspective: none; overflow: visible; }
body.sc80-cloud #npPlayerStage .np-tt-3d{ transform: none; }
body.sc80-cloud #npPlayerStage .np-plinth,
body.sc80-cloud #npPlayerStage .np-base,
body.sc80-cloud #npPlayerStage .np-lid,
body.sc80-cloud #npPlayerStage .np-tonearm,
body.sc80-cloud #npPlayerStage .np-tonearm-base,
body.sc80-cloud #npPlayerStage .np-platter-mat{ display: none; }
body.sc80-cloud #npPlayerBody{ right: 0; bottom: 0; width: 40px; height: 40px; transform: none; }
body.sc80-cloud #nowPlaying .disc{ width: 40px; height: 40px; }
body.sc80-cloud #npInfo{ min-width: 0; }
body.sc80-cloud #npInfo .t{ font-size: 13px; line-height: 1.25; font-weight: 600; }
body.sc80-cloud #npInfo .a{ font-size: 11px; line-height: 1.25; }
/* A long title stops at the edge with an ellipsis instead of shoving the transport
   across the bar, which is what "a very long name" looked like at this width. */
body.sc80-cloud #npInfo .t,
body.sc80-cloud #npInfo .a{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
body.sc80-cloud #npControls{ gap: 2px; margin-left: auto; }
body.sc80-cloud #npControls button{ width: 32px; height: 32px; }
body.sc80-cloud #npControls svg{ width: 17px; height: 17px; }
body.sc80-cloud #playPauseBtn{ width: 40px; height: 40px; }
body.sc80-cloud #playPauseBtn svg{ width: 22px; height: 22px; }
body.sc80-cloud #npControls #shuffleBtn,
body.sc80-cloud #npControls #repeatBtn{ display: none; }

/* THE FLIGHT. A rail with no paint of its own, in the corner, sitting on the bar.
   pointer-events: none means the wall under it is still the wall; only the treads
   and the sheet take a tap. */
body.sc80-cloud .action-strip{
  position: fixed;
  left: auto; right: 10px;
  top: auto; bottom: var(--sc10-bar);
  width: auto; max-width: none; height: var(--sc10-rail);
  margin: 0; padding: 0;
  display: flex; flex-direction: row;
  align-items: flex-end; justify-content: flex-end;
  gap: 0;
  border: none; border-radius: 0;
  background: none;
  -webkit-backdrop-filter: none; backdrop-filter: none;
  box-shadow: none;
  pointer-events: none;
  z-index: 45;
}
body.sc80-cloud .action-strip > #addSongsMenu,
body.sc80-cloud .action-strip > #addSongsBackdrop{ pointer-events: auto; }
/* The joined-dock capsule belongs to the classic row of worded pills (74.1.9): a
   sliding highlight around labels this layout does not have. */
body.sc80-cloud #scDockPillTrack,
body.sc80-cloud #scDockPillThumb{ display: none !important; }
/* ONE TREAD, whatever tab it holds. They are joined - no gap - so the silhouette is
   one staircase: the first step is square, the plus closes the flight, and each
   tread's top edge carries a lit hairline. */
body.sc80-cloud .action-strip > #homeBtn,
body.sc80-cloud .action-strip > #libraryBtn,
body.sc80-cloud .action-strip > #discoverBtn,
body.sc80-cloud .action-strip > #studioBtn,
body.sc80-cloud .action-strip > #dockAddBtn{
  pointer-events: auto;
  flex: 0 0 var(--sc10-tread);
  width: var(--sc10-tread); min-height: 0;
  margin: 0;
  padding: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 0;
  border: 1px solid var(--line);
  border-left: 0;
  border-bottom: 0;
  border-top-color: color-mix(in srgb, var(--ink) 26%, transparent);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--bg-raised) 97%, transparent),
    color-mix(in srgb, var(--bg-raised) 84%, #000));
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  backdrop-filter: blur(18px) saturate(1.25);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
  color: var(--ink-dim);
  font-size: 0;
  transition: background 180ms ease, color 180ms ease;
}
body.sc80-cloud .action-strip > button span{ font-size: 0 !important; }
/* THE HEIGHTS ARE THE STAIRCASE. One riser a step, from the bottom left of the
   flight to the plus at the top right, and every tread stands on the bar. */
body.sc80-cloud .action-strip > #homeBtn{
  height: var(--sc10-tread);
  border-left: 1px solid var(--line);
  border-radius: 14px 0 0 0;
}
body.sc80-cloud .action-strip > #libraryBtn{ height: calc(var(--sc10-tread) + var(--sc10-rise)); }
body.sc80-cloud .action-strip > #discoverBtn{ height: calc(var(--sc10-tread) + var(--sc10-rise) * 2); }
body.sc80-cloud .action-strip > #studioBtn{ height: calc(var(--sc10-tread) + var(--sc10-rise) * 3); }
body.sc80-cloud .action-strip > #dockAddBtn{
  height: calc(var(--sc10-tread) + var(--sc10-rise) * 4);
  border-right: 1px solid var(--line);
  border-radius: 0 14px 0 0;
}
/* THE TAB YOU ARE ON IS THE LOUD ONE. */
body.sc80-cloud .action-strip > #homeBtn.active,
body.sc80-cloud .action-strip > #libraryBtn.active,
body.sc80-cloud .action-strip > #discoverBtn.active,
body.sc80-cloud .action-strip > #studioBtn.active{
  background: var(--coral);
  border-color: color-mix(in srgb, var(--coral) 62%, #000);
  color: #1b1410;
}
body.sc80-cloud .action-strip > button:active{ filter: brightness(1.08); }
/* THE ICONS. A mask, so one glyph is painted in currentColor and takes the tread's
   own colour - glass grey while the tab is asleep, dark on coral when it is the tab
   you are on. */
body.sc80-cloud .action-strip > #homeBtn::before,
body.sc80-cloud .action-strip > #discoverBtn::before{
  content: '';
  display: block;
  width: 22px; height: 22px;
  background-color: currentColor;
  -webkit-mask-image: var(--sc89-icon);
  -webkit-mask-position: center;
  -webkit-mask-size: 22px 22px;
  -webkit-mask-repeat: no-repeat;
  mask-image: var(--sc89-icon);
  mask-position: center;
  mask-size: 22px 22px;
  mask-repeat: no-repeat;
}
body.sc80-cloud #homeBtn{
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/%3E%3C/svg%3E");
}
body.sc80-cloud #discoverBtn{
  /* A ring and a needle, both painted: the filled-circle spelling of this glyph
     renders as a solid disc with a dot in the middle at 22px, because the needle
     only reads as a hole under a fill rule the mask does not carry. */
  --sc89-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='9' fill='none' stroke='black' stroke-width='1.8'/%3E%3Cpath d='M16.2 7.8l-2.3 5.9-5.9 2.3 2.3-5.9z'/%3E%3C/svg%3E");
}
body.sc80-cloud #dockAddBtn svg{ width: 22px; height: 22px; }
/* THE TWO SPLIT TREADS ARE STILL TWO TABS, and their icons sit side by side at the
   middle of the tread, one on each side of the diagonal. On a 76px-tall tread the
   corner placement of 80.0.9 spread them a hand's width apart; side by side they
   read as one tab with two things in it. */
body.sc80-cloud .action-strip > #libraryBtn::before,
body.sc80-cloud .action-strip > #studioBtn::before{ display: none; }
body.sc80-cloud .action-strip > #libraryBtn > div,
body.sc80-cloud .action-strip > #studioBtn > div{
  padding: 0 5px !important;
  align-items: center !important;
}
body.sc80-cloud #playlistsHalf{ justify-content: flex-start !important; }
body.sc80-cloud #albumsHalf{ justify-content: flex-end !important; }
body.sc80-cloud #studioHalf{ justify-content: flex-start !important; }
body.sc80-cloud #toolsHalf{ justify-content: flex-end !important; }
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
/* The flight floats over the bottom of every view, so the views reserve it and the
   bar under it - and a little air, so the last row is not touching the flight. */
body.sc80-cloud #homeView, body.sc80-cloud #library, body.sc80-cloud #discoverView,
body.sc80-cloud #studioView{
  padding-bottom: calc(var(--sc10-bar) + var(--sc10-rail) + 16px);
  scroll-padding-bottom: calc(var(--sc10-bar) + var(--sc10-rail) + 16px);
}

/* ---------- 10. 80.0.10: the add-songs sheet, above the bar ------------------ */
/* THE SHEET IS A SCREEN-LEVEL PANEL. It is raised into view above the bar, right
   where the plus is, instead of opening a screen above the top edge. The JS half
   moves it and its backdrop to <body>, so their fixed positions measure the screen
   and not the strip. */
body.sc80-cloud #addSongsMenu{
  position: fixed;
  left: 50%; right: auto;
  top: auto; bottom: calc(var(--sc10-bar) + 10px);
  transform: translate(-50%, 14px);
  width: min(430px, calc(100vw - 24px));
  max-width: none;
  max-height: min(62vh, calc(100vh - var(--sc10-bar) - 96px));
  margin: 0;
  padding: 6px 14px 14px;
  gap: 6px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg-raised) 98%, #000);
  box-shadow: 0 24px 64px rgba(0,0,0,0.62);
  opacity: 0;
  z-index: 400;
  transition: transform 180ms cubic-bezier(0.2,0.9,0.2,1), opacity 140ms ease;
}
body.sc80-cloud #addSongsMenu.open{ display: flex; opacity: 1; transform: translate(-50%, 0); }
body.sc80-cloud #addSongsBackdrop{
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.52);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  z-index: 399;
}
body.sc80-cloud .add-songs-head{
  display: flex; align-items: center; gap: 10px;
  padding: 4px 0 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 4px;
  flex: 0 0 auto;
}
body.sc80-cloud .add-songs-head .add-songs-title{
  flex: 1;
  padding: 0; margin: 0; border: 0;
  font-size: 14px; font-weight: 600;
}
body.sc80-cloud .add-songs-close{
  flex: 0 0 auto;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink-dim);
  font-size: 14px; line-height: 1;
  cursor: pointer;
}
body.sc80-cloud .add-songs-close:active{ background: color-mix(in srgb, var(--coral) 22%, transparent); color: var(--ink); }
/* THE ITEMS ARE ROWS, NOT WORDS IN A PILE. The cloud layout gave every .action-pill
   a transparent background and a column layout, so the sheet read as five floating
   labels with the coral one sitting in the middle. Each row is a surface now, the
   text is on the left where the eye scans it, and the primary keeps the coral. */
body.sc80-cloud #addSongsMenu .action-pill{
  flex-direction: row; align-items: center; justify-content: flex-start;
  min-height: 44px; padding: 0 14px; gap: 8px;
  font-size: 13.5px; text-align: left;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--ink);
}
body.sc80-cloud #addSongsMenu .action-pill.primary{
  background: var(--coral);
  border-color: var(--coral);
  color: #1b1410;
  font-weight: 600;
}
body.sc80-cloud #addSongsMenu .action-pill:active{ filter: brightness(1.1); }
@media (prefers-reduced-motion: reduce){
  body.sc80-cloud #addSongsMenu{ transition: none; }
}
/* A computer keeps the same corner flight, the same covering bar and the same
   sheet; only the window around them changes. */
@media (min-width: 900px){
  body.sc80-cloud .action-strip{ right: 18px; }
  body.sc80-cloud{ --sc10-tread: 50px; --sc10-rise: 11px; }
}

'''

NOTE = """  { version: '80.0.10', date: 'October 22, 2026 \\u00b7 8:20 PM EDT', title: 'The plus works, the flight is small, the bar covers the bottom', items: [
    'The tabs are a small icon staircase in the bottom right corner: five 46px treads, joined edge to edge, each one 10px taller than the one on its left, with the plus closing the flight at the top.',
    'The plus works again. The add-songs sheet was opening a full screen above the top edge in cloud mode; it now rises above the bar with a close button, and Escape or a tap outside closes it.',
    'The mini player covers the bottom of the screen edge to edge, so the phone inset is part of the bar instead of a strip of the page showing underneath it.',
    'The record, the two lines, previous, play, next and the menu are all still in that row, and a long title now ends in an ellipsis instead of shoving the controls.',
    'The progress hairline is part of the bar now, so drag-to-seek looks like something you can drag - and it still drags.',
    'Nothing was dropped with the console: Shuffle, Repeat and DJ Mode stay in the ... menu, and Lyrics and Song info are where they were.',
    'Library/Albums and Studio/Tools keep their diagonal cut, and their two icons now sit side by side at the middle of the tread instead of spread to the corners.',
    'Nothing else moved - the widget, the player, the letter covers, the lyrics view and the album pill dock are where 80.0.9 left them, and every album, playlist and setting is as it was.',
  ],
    details: [
      'The sheet was not missing, it was off screen: `#addSongsMenu{ bottom: calc(100% + 10px) }` on a fixed child of a fixed strip measures the viewport, so it opened a full screen above the top edge. It is a screen-level sheet above the bar now, and it closes on its own X, the backdrop, Escape, and after you pick something.',
      'Five treads across the whole width were a wall with steps, not a staircase. The flight is 230px wide in the bottom right corner, joined edge to edge, one riser a step, and it no longer stands on the bubble grid.',
      'The bar is bottom zero and full width; its sixty pixel row sits at the top of the bar and the phone inset below it is bar. Nothing of the page shows under it any more.',
      'The scrub line is part of the bar, the title and artist truncate with an ellipsis, and the sheet closes itself once a choice is made.',
      'The treads are icons painted with a mask in currentColor, the split treads keep their cut, and the tab you are on is coral.',
      'Nothing else moved: the album pill dock, the bubbles, the letter covers, the lyrics view and the classic layout are exactly as 80.0.9 left them.',
    ] },
"""

MARKUP_OLD = '      <div class="add-songs-title">Add songs</div>\n'
MARKUP_NEW = ('      <div class="add-songs-head">\n'
              '        <div class="add-songs-title">Add songs</div>\n'
              '        <button id="addSongsClose" class="add-songs-close" aria-label="Close add songs"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>\n'
              '      </div>\n')

ANCHOR = "  $('addSongsBackdrop').addEventListener('click', closeAddSongsMenu);"

JS = """

  // 80.0.10 - THE SHEET IS A SCREEN-LEVEL PANEL.
  // It used to be a fixed child of the fixed strip, and `bottom: calc(100% + 10px)`
  // measured the viewport: the sheet opened a full screen above the top edge, which
  // is exactly what a dead plus looks like. Moving it and its backdrop to <body>
  // gives both the screen to be fixed against - and gives the sheet a z-index the
  // strips cannot clip - without changing a single handler that uses it by id.
  (function(){
    ['addSongsMenu','addSongsBackdrop'].forEach(function(id){
      var el = $(id);
      if(el && el.parentNode !== document.body) document.body.appendChild(el);
    });
    var x = $('addSongsClose');
    if(x) x.addEventListener('click', closeAddSongsMenu);
    // A choice closes the sheet. The pickers and the exports have taken over from
    // there, and the sheet left open behind them was covering the page it acts on.
    var menu = $('addSongsMenu');
    if(menu) menu.addEventListener('click', function(ev){
      var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if(!b || b.id === 'addSongsClose') return;
      setTimeout(function(){
        if($('addSongsMenu').classList.contains('open')) closeAddSongsMenu();
      }, 160);
    });
  })();
  // ...and Escape closes it, the way every other sheet in this app closes.
  document.addEventListener('keydown', function(ev){
    if((ev.key === 'Escape' || ev.key === 'Esc') && $('addSongsMenu').classList.contains('open')) closeAddSongsMenu();
  });"""


def main():
    page = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    if MARKER in page and (("const APP_VERSION = '%s';" % VERSION) in page):
        print('  present: the corner flight, the covering bar, the sheet, and the page runs as ' + VERSION)
        print('patch-80010%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    bad = []
    if START not in page:
        bad.append('the 80.0.9 cloud block')
    if END not in page:
        bad.append('the stylesheet anchor')
    if MARKUP_OLD not in page:
        bad.append('the add-songs title')
    if ANCHOR not in page:
        bad.append('the add-songs sheet wiring')
    if "const APP_VERSION = '80.0.9';" not in page:
        bad.append('the version')
    if "'sidecut-shell-v80.0.9'" not in sw:
        bad.append('the shell cache')
    if bad:
        sys.exit('patch-80010: the page is not the shape this release expects (%s)' % ', '.join(bad))
    if CHECK:
        print('patch-80010 --check: the release is pending, 6 steps to apply')
        return 1
    a = page.index(START)
    b = page.index(END)
    if b <= a:
        sys.exit('patch-80010: the 80.0.9 block does not end before the stylesheet anchor')
    page = page[:a] + CSS + page[b:]
    page = page.replace("const APP_VERSION = '80.0.9';", "const APP_VERSION = '%s';" % VERSION, 1)
    at = page.index('  const CHANGELOG = [')
    eol = page.index(NL, at)
    page = page[:eol + 1] + NOTE + page[eol + 1:]
    page = page.replace(MARKUP_OLD, MARKUP_NEW, 1)
    page = page.replace(ANCHOR, ANCHOR + JS, 1)
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    sw = sw.replace("'sidecut-shell-v80.0.9'", "'sidecut-shell-v80.0.10'", 1)
    open(sw_path, 'w', encoding='utf-8').write(sw)
    print('  applied: the corner flight, the covering bar, the sheet, the scrub, the notes and the version')
    print('patch-80010: 6 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
