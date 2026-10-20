#!/usr/bin/env python3
"""75.1.2 - the pinned-artists rail shows exactly FOUR at a time, and scrolls on.

The owner: "pinned artists plateu should have 4 displayed at one time with
scrolling potential unlimited". The rail was a 72px-chip flex row: on a phone
card about 316px wide that is three and a half chips, so the fourth was sliced
in half and the row read as if it ended there. The chips are a quarter of the
rail's content width now (minus the three gaps), which puts four in the card and
starts the fifth exactly at the edge; the row still scrolls sideways with no cap
on how many pins can be there.

Idempotent. `--check` reports whether the page already carries it.
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
PAGE = os.path.join(ROOT, 'index.html')

CSS_OLD = "#pinnedArtistsStrip{ position:relative; z-index:1; }"
CSS_NEW = """#pinnedArtistsStrip{ position:relative; z-index:1; }
/* 75.1.2 - FOUR ARTISTS AT A TIME, AND THE RAIL KEEPS GOING.
   The rail used to show whatever happened to fit: 72px chips in a card that is
   about 316px wide on a phone, so the fourth artist was cut in half and the rail
   read as if it ended there. The chips are not a fixed number of pixels any more.
   Each one is exactly a quarter of the rail's content width minus the three gaps
   between them, so FOUR sit inside the card and the fifth starts exactly at the
   edge. Nothing is hidden and nothing is capped: the number of chips comes from
   the pins the phone holds, `flex-wrap:nowrap` and `overflow-x:auto` were already
   right, and because the width is computed from the container rather than from
   how many chips there are, two pins and twenty scroll the same way. Proximity
   snapping settles a swipe on a chip edge without fighting a fast flick that
   crosses three artists. */
#pinnedArtistsList{
  --pa-gap: 10px;
  gap: var(--pa-gap) !important;
  scroll-snap-type: x proximity;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
#pinnedArtistsList::-webkit-scrollbar{ display:none; width:0; height:0; }
#pinnedArtistsList > .pinned-artist-chip{
  flex: 0 0 calc((100% - 3 * var(--pa-gap)) / 4);
  width: calc((100% - 3 * var(--pa-gap)) / 4);
  max-width: calc((100% - 3 * var(--pa-gap)) / 4);
  scroll-snap-align: start;
}
/* The cover is square at whatever width the quarter gives it (56px on a 360px
   phone, up to 64px on a wide one), so the artwork never decides the chip width. */
#pinnedArtistsList .pa-tile{
  width: 100%;
  max-width: 64px;
  aspect-ratio: 1 / 1;
  height: auto;
  border-radius: 14px;
  margin: 0 auto;
  border: 1px solid var(--line);
  background-size: cover;
  background-position: center;
}
#pinnedArtistsList .pa-tile-initial{
  display:flex; align-items:center; justify-content:center;
  font-size:22px; font-weight:700; color:#fff;
  background:linear-gradient(135deg,#ff4f7e,#7a5cff);
}
#pinnedArtistsList .pa-name{
  font-size:10.5px; margin-top:4px; color:var(--ink);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 1px;
}
#pinnedArtistsList .pa-photo{
  font-size:9px; color:var(--ink-dim); margin-top:1px; cursor:pointer;
  opacity:0.75; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}"""

MARK_OLD = """      <span style="flex:1;font-size:12.5px;font-weight:600;">Pinned artists</span>
      <button id="pinnedArtistsHelp\""""
MARK_NEW = """      <span style="flex:1;font-size:12.5px;font-weight:600;">Pinned artists</span>
      <span id="pinnedArtistsCount" style="font-size:11px;color:var(--ink-dim);font-variant-numeric:tabular-nums;"></span>
      <button id="pinnedArtistsHelp\""""

LIST_OLD = '<div id="pinnedArtistsList" style="display:flex;align-items:flex-start;gap:12px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;min-height:64px;padding:0 2px 4px;"></div>'
LIST_NEW = '<div id="pinnedArtistsList" style="display:flex;align-items:flex-start;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;min-height:64px;padding:0 2px 4px;-webkit-overflow-scrolling:touch;"></div>'

CHIP_OLD = """      return `<div class="pinned-artist-chip" data-name="${escapeHtml(a.name)}" style="flex:0 0 auto;width:72px;text-align:center;cursor:pointer;position:relative;padding-top:4px;">
        <button class="unpin-artist" data-name="${escapeHtml(a.name)}" title="Unpin ${escapeHtml(a.name)}" style="position:absolute;top:0;right:-4px;width:17px;height:17px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;border:1px solid var(--line);font-size:10px;line-height:16px;cursor:pointer;z-index:3;">×</button>
        ${a.photo || a.art
          ? `<div style="width:56px;height:56px;border-radius:14px;background-size:cover;background-position:center;margin:0 auto;border:1px solid var(--line);${bg}"></div>`
          : `<div style="width:56px;height:56px;border-radius:14px;margin:0 auto;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,#ff4f7e,#7a5cff);">${escapeHtml((a.name||'?').trim().charAt(0).toUpperCase())}</div>`}
        <div style="font-size:10.5px;margin-top:4px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px;">${escapeHtml(a.name)}</div>
        <div style="font-size:9px;color:var(--ink-dim);margin-top:1px;cursor:pointer;opacity:0.75;" class="pa-pick-photo" data-artist="${escapeHtml(a.name)}" title="Change picture">✎ set photo</div>
      </div>`;"""

CHIP_NEW = """      return `<div class="pinned-artist-chip" data-name="${escapeHtml(a.name)}" style="text-align:center;cursor:pointer;position:relative;padding-top:4px;">
        <button class="unpin-artist" data-name="${escapeHtml(a.name)}" title="Unpin ${escapeHtml(a.name)}" style="position:absolute;top:0;right:-2px;width:17px;height:17px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;border:1px solid var(--line);font-size:10px;line-height:16px;cursor:pointer;z-index:3;">×</button>
        ${a.photo || a.art
          ? `<div class="pa-tile" style="${bg}"></div>`
          : `<div class="pa-tile pa-tile-initial">${escapeHtml((a.name||'?').trim().charAt(0).toUpperCase())}</div>`}
        <div class="pa-name">${escapeHtml(a.name)}</div>
        <div class="pa-photo pa-pick-photo" data-artist="${escapeHtml(a.name)}" title="Change picture">✎ photo</div>
      </div>`;"""

COUNT_OLD = """  function renderPinnedArtists(){
    const list = $('pinnedArtistsList');
    if(!list) return;"""

COUNT_NEW = """  function renderPinnedArtists(){
    const list = $('pinnedArtistsList');
    if(!list) return;
    // 75.1.2 - the header says how many are pinned. Four are on screen at a time and
    // the rail scrolls for the rest, so without this the only way to know there is
    // a fifth artist was to swipe. The number is the list itself, never a cap.
    try{
      const cnt = $('pinnedArtistsCount');
      if(cnt) cnt.textContent = pinnedArtists.length ? String(pinnedArtists.length) : '';
    }catch(_eCnt){}"""


def main():
    src = open(PAGE, encoding='utf-8').read()
    before = src
    problems = []

    if CSS_NEW not in src:
        if CSS_OLD not in src:
            problems.append('the #pinnedArtistsStrip rule is not where it was')
        else:
            src = src.replace(CSS_OLD, CSS_NEW, 1)

    if 'id="pinnedArtistsCount"' not in src:
        if MARK_OLD not in src:
            problems.append('the pinned-artists header is not the expected one')
        else:
            src = src.replace(MARK_OLD, MARK_NEW, 1)

    if LIST_NEW not in src:
        if LIST_OLD not in src:
            problems.append('the pinned-artists list is not the expected one')
        else:
            src = src.replace(LIST_OLD, LIST_NEW, 1)

    if 'class="pa-tile"' not in src:
        if CHIP_OLD not in src:
            problems.append('the pinned-artist chip template is not the expected one')
        else:
            src = src.replace(CHIP_OLD, CHIP_NEW, 1)

    if 'const cnt = $(\'pinnedArtistsCount\');' not in src:
        if COUNT_OLD not in src:
            problems.append('renderPinnedArtists is not the expected one')
        else:
            src = src.replace(COUNT_OLD, COUNT_NEW, 1)

    if problems:
        print('patch-7512-rail: ' + '; '.join(problems))
        return 1

    changed = src != before
    if CHECK:
        print('patch-7512-rail --check: ' + ('already applied' if not changed else 'NOT applied yet'))
        return 0 if not changed else 1
    if changed:
        open(PAGE, 'w', encoding='utf-8').write(src)
        print('patch-7512-rail: four-up rail applied')
    else:
        print('patch-7512-rail: already applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
