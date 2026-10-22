// 80.0.9 - THE STAIRCASE ACROSS THE WIDTH, AND THE MINI PLAYER UNDER IT.
//
// 80.0.5 to 80.0.8 stacked the four tabs in the bottom right corner and nudged
// each one sideways: four pills in a heap. The owner's words on that heap were
// "WHY IS A CHUNK IT SHOULD SPREAD OUT LIKE A NICE STAIRCASE", and the bar under
// it was "a console made smaller", not a simpler now bar.
//
// This file answers for what replaced them, read straight out of index.html: five
// treads, edge to edge, across the whole width, each one a riser taller than the
// one on its left and all standing on the top of the bar, so the top of the row is
// a flight climbing to the plus; a tab per tread as an icon; and a sixty-pixel mini
// player with a drag-to-seek hairline - with Shuffle, Repeat and DJ Mode answered
// in the menu the bar still shows, not dropped.
//
//   node dev/staircase-check.cjs
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log('  PASS ' + label); }
  else { fail += 1; console.log('  FAIL ' + label); }
}

const railStart = src.indexOf('9. 80.0.9: the flight, built across the whole width');
const barStart = src.indexOf('10. 80.0.9: the cloud bar is one slim row');
const wideStart = src.indexOf('/* ---------- 5. Bigger screens', barStart > 0 ? barStart : 0);
const rail = railStart > 0 && barStart > railStart ? src.slice(railStart, barStart) : '';
const bar = barStart > 0 && wideStart > barStart ? src.slice(barStart, wideStart) : '';
const icons = (rail.match(/--sc89-icon: url\(/g) || []).length;
// The one rule that sizes all five treads, from its first selector to the heights
// that follow it.
const groupFrom = rail.indexOf('body.sc80-cloud .action-strip > #homeBtn,\nbody.sc80-cloud .action-strip > #libraryBtn,');
const groupTo = rail.indexOf('/* THE HEIGHTS, ONE RISER APART.');
const group = groupFrom > 0 && groupTo > groupFrom ? rail.slice(groupFrom, groupTo) : '';

console.log('[1] the rail is one row across the whole width');
{
  ok(railStart > 0 && barStart > railStart && rail.length > 2000,
    'the 80.0.9 rail block is in the page (' + rail.length + ' chars)');
  ok(rail.indexOf('left: 0; right: 0;') > 0, 'it spans the screen edge to edge');
  ok(rail.indexOf('bottom: var(--sc89-bar);') > 0,
    'and sits on the bar, not over the wall');
  ok(rail.indexOf('flex-direction: row;') > 0, 'the tabs are a row, not a column');
  ok(rail.indexOf('align-items: flex-end;') > 0, 'resting on one floor line');
  ok(rail.indexOf('justify-content: flex-start;') > 0 && group.indexOf('flex: 1 1 0;') > 0,
    'the treads fill the width between them, so they are not a heap');
  ok(rail.indexOf('width: 100%; max-width: 760px;') > 0,
    'full width on a phone, the bar\u2019s own 760px band on a computer');
  ok(rail.indexOf('background: none;') > 0 && rail.indexOf('box-shadow: none;') > 0 &&
     rail.indexOf('border: none; border-radius: 0;') > 0,
    'the rail paints nothing: no panel, no border, no shadow');
  ok(rail.indexOf('pointer-events: none;') > 0 && group.indexOf('pointer-events: auto;') > 0,
    'and it takes no taps itself; the treads do');
  ok(rail.indexOf('.action-strip > #addSongsMenu,') > 0 &&
     rail.indexOf('#addSongsBackdrop{ pointer-events: auto; }') > 0,
    'the menu inside it is still touchable');
  ok(rail.indexOf('body.sc80-cloud #scDockPillTrack,\nbody.sc80-cloud #scDockPillThumb{ display: none !important; }') > 0,
    'the joined-dock capsule of the classic row is not drawn across the flight');
}

console.log('[2] five steps, each one higher than the one on its left');
{
  const steps = [
    ['#homeBtn', 'height: var(--sc89-tread); margin: 0;'],
    ['#libraryBtn', 'height: calc(var(--sc89-tread) + var(--sc89-step)); margin: 0;'],
    ['#discoverBtn', 'height: calc(var(--sc89-tread) + var(--sc89-step) * 2); margin: 0;'],
    ['#studioBtn', 'height: calc(var(--sc89-tread) + var(--sc89-step) * 3); margin: 0;'],
    ['#dockAddBtn', 'height: calc(var(--sc89-tread) + var(--sc89-step) * 4); margin: 0;'],
  ];
  for (const [id, decl] of steps) {
    ok(rail.indexOf('.action-strip > ' + id + '{ ' + decl) > 0, id + ' is one riser above the tab on its left');
  }
  ok(/--sc89-step: 15px;/.test(rail), 'the riser is one variable, 15px on a phone');
  ok(/--sc89-rail: calc\(var\(--sc89-tread\) \+ var\(--sc89-step\) \* 4\);/.test(rail),
    'and the rail is the tallest tread: the first step plus four risers');
  ok(group.indexOf('align-self: flex-end;') > 0,
    'every tread stands on the bar, so their bottoms are one line');
  ok(/--sc89-step: 18px; --sc89-tread: 60px;/.test(rail), 'a computer gets a taller flight, not a shorter one');
  ok((rail.match(/margin: 0;/g) || []).length >= 5,
    'the old column\u2019s sideways nudges are cancelled, one ID at a time');
}

console.log('[3] the bar has one height, and nothing has to be measured for it');
{
  ok(/--sc89-bar: calc\(60px \+ env\(safe-area-inset-bottom\)\);/.test(rail),
    'the bar is sixty pixels, plus the phone\u2019s own inset, declared once');
  ok(rail.indexOf('bottom: var(--sc89-bar);') > 0, 'the rail reads it');
  ok(bar.indexOf('height: var(--sc89-bar);') > 0 && bar.indexOf('min-height: var(--sc89-bar);') > 0,
    'and so does the bar it sits on');
  // 80.0.5 to 80.0.8 positioned the rail off --sc80-player, a number JS wrote on the
  // first frame after a layout change. In a browser that never ran that write the
  // number stayed at its fallback and the rail floated 52px above the bar - the same
  // drift the owner photographed, from the same cause. Nothing in this release reads it.
  ok(rail.indexOf('var(--sc80-player)') === -1,
    'and the rail no longer reads the measured variable at all');
  ok(bar.indexOf('env(safe-area-inset-bottom)') === -1,
    'no #nowPlaying rule carries a padding and an env() together (dev/test-705 counts those)');
  ok(src.indexOf('new ResizeObserver(writePlayerHeight).observe(np)') > 0,
    'the bar is still measured, for the classic layout\u2019s own dock');
}

console.log('[4] the views and the menu know the flight is there');
{
  ok(rail.indexOf('padding-bottom: calc(var(--sc89-bar) + var(--sc89-rail));') > 0,
    'every view reserves the bar and the flight above it');
  ok(rail.indexOf('--sc89-rail: calc(var(--sc89-tread) + var(--sc89-step) * 4);') > 0,
    'and the flight has one height, not a guess per view');
  ok(src.indexOf('bottom: calc(100% + 10px);') > 0, 'the add-songs menu still opens above it');
  ok(src.indexOf('padding-top: 10px; padding-right: 0;') > 0,
    'the old top bar\u2019s band is still not reserved in this layout');
}

console.log('[5] bubbles: bigger on a phone, more per row on a computer');
{
  ok(src.indexOf('body.sc80-cloud #homeBubbles{ gap: 10px; }') > 0, 'the gap between two bubbles is 10px');
  ok(src.indexOf('body.sc80-cloud .home-bubble{ width: calc(50% - 5px); padding: 14px; }') > 0,
    'and two still fit on a phone row');
  ok(/@media \(min-width: 900px\)/.test(src), 'a 900px window gets its own rules');
  ok(src.indexOf('width: calc(33.333% - 7px)') > 0, 'three bubbles to a row there');
  ok(/@media \(min-width: 1280px\)/.test(src), 'and a 1280px one');
  ok(src.indexOf('width: calc(25% - 8px)') > 0, 'four to a row');
}

console.log('[6] one motion set, and no layout animated');
{
  ok(/--sc-ease: cubic-bezier/.test(src), 'the easing curve is a theme variable');
  ok(/--sc-ease-mid: 260ms;/.test(src), 'with one mid duration');
  ok(group.indexOf('transition: background var(--sc-ease-mid) var(--sc-ease), color var(--sc-ease-mid) var(--sc-ease);') > 0,
    'and the treads read it');
  ok(!/transition:[^;]*\b(width|height|top|left|padding|margin)\b/.test(rail),
    'nothing in the flight animates layout');
}

console.log('[7] the split tabs kept their cut');
{
  ok(src.indexOf('clip-path:polygon(0 0, 0 100%, 100% 100%)') > 0, 'Studio still owns the lower triangle');
  ok(src.indexOf('clip-path:polygon(0 0, 100% 0, 100% 100%)') > 0, 'Tools the upper one');
  ok(src.indexOf('<line x1="0" y1="0" x2="100%" y2="100%"') > 0,
    'and the seam still runs top left to bottom right');
}

console.log('[8] one tread, one width, one piece of glass');
{
  ok(group.length > 200 && group.indexOf('#dockAddBtn{\n') > 0, 'one rule names all five treads');
  ok(group.indexOf('flex: 1 1 0;') > 0, 'with flex 1 1 0, so the five share the width equally');
  ok(group.indexOf('padding: 15px 0 0;') > 0, 'and one inset for the icon at the top of the step');
  ok(group.indexOf('border-radius: 16px 16px 0 0;') > 0 && group.indexOf('border-bottom: 0;') > 0,
    'open at the bottom, so a tread stands on the bar instead of floating over it');
  ok(group.indexOf('border-top-color: color-mix(in srgb, var(--ink) 26%, transparent);') > 0,
    'with the lit hairline that makes five treads read as one flight');
  ok(group.indexOf('backdrop-filter: blur(18px)') > 0,
    'each tread its own piece of glass');
  // 80.0.5 shipped two of these tabs at 0px tall, and nothing saw it: a tile with no
  // height still has its margin. The old bar's flex rules carry IDs, so they outrank
  // a bare `> button` and gave the split tabs a HEIGHT with a basis of zero. The
  // heights are written with the IDs for that reason.
  ok((rail.match(/\.action-strip > #(?:homeBtn|libraryBtn|discoverBtn|studioBtn|dockAddBtn)\{ height:/g) || []).length === 5,
    'and every height is written with the ID, so no older ID rule can flatten a tread');
}

console.log('[9] the tabs are icons');
{
  ok(rail.indexOf('body.sc80-cloud .action-strip > button span{ font-size: 0 !important; }') > 0,
    'every label is zero point, so the tread is the icon');
  ok(group.indexOf('font-size: 0;') > 0, 'the tread itself carries no text size');
  ok(rail.indexOf('-webkit-mask-image: var(--sc89-icon);') > 0 &&
     rail.indexOf('mask-image: var(--sc89-icon);') > 0,
    'each icon is a mask, so one glyph takes the tread\u2019s own colour');
  ok(icons === 6, 'six icons are declared: home, discover, and one per split half (' + icons + ')');
  ok(rail.indexOf('--sc89-icon: url("data:image/svg+xml,') > 0, 'they are inline, so the page still loads nothing else');
  ok(rail.indexOf('body.sc80-cloud #dockAddBtn svg{ width: 23px; height: 23px; margin-top: 4px; }') > 0,
    'and the plus keeps its own glyph, at the size of the rest');
  ok(rail.indexOf('#playlistsHalf::before,') > 0 && rail.indexOf('#albumsHalf::before,') > 0 &&
     rail.indexOf('#studioHalf::before,') > 0 && rail.indexOf('#toolsHalf::before{') > 0,
    'the two split treads put an icon in each end of the cut, so an icon still says which half');
  ok(rail.indexOf('body.sc80-cloud #playlistsHalf{ padding: 15px 0 0 13px !important;') > 0 &&
     rail.indexOf('body.sc80-cloud #albumsHalf{ padding: 0 13px 13px 0 !important;') > 0 &&
     rail.indexOf('body.sc80-cloud #studioHalf{ padding: 0 0 13px 13px !important;') > 0 &&
     rail.indexOf('body.sc80-cloud #toolsHalf{ padding: 15px 13px 0 0 !important;') > 0,
    'each icon in its own half\u2019s corner, not on the seam');
  ok(rail.indexOf('body.sc80-cloud #playlistsHalf.active-half,') > 0 &&
     rail.indexOf('#toolsHalf.active-half{ color: var(--coral); }') > 0,
    'and the half you are in still lights up, in coral');
  ok(rail.indexOf('body.sc80-cloud .action-strip > #homeBtn.active,') > 0 &&
     rail.indexOf('body.sc80-cloud .action-strip > #studioBtn.active{') > 0 &&
     rail.indexOf('background: var(--coral);') > 0,
    'and the tab you are on is filled coral, written with the IDs so the tread rule cannot keep it glass');
  ok(rail.indexOf('.action-strip > #libraryBtn::before,\nbody.sc80-cloud .action-strip > #studioBtn::before{ display: none; }') > 0,
    'the split treads do not also paint a centre icon over their two halves');
  ok((src.match(/<button id="(homeBtn|libraryBtn|discoverBtn|studioBtn)" class="action-pill"/g) || []).length === 4,
    'all four tabs are still real buttons in the markup, and the plus is the fifth');
}

console.log('[10] the cloud bar is a mini player, and nothing left with the console');
{
  ok(bar.length > 1200, 'the 80.0.9 bar block is in the page (' + bar.length + ' chars)');
  ok(bar.indexOf('height: var(--sc89-bar);') > 0 && bar.indexOf('min-height: var(--sc89-bar);') > 0,
    'the bar is sixty pixels, plus whatever the phone reserves, from one token');
  ok(bar.indexOf('max-width: 760px;') > 0 && bar.indexOf('margin: 0 auto;') > 0,
    'and it keeps the flight\u2019s own 760px band, so the two stack');
  ok(bar.indexOf('body.sc80-cloud #nowPlaying .np-row + .np-row{ display: none; }') > 0,
    'the DJ / LYRICS row is not in this layout');
  ok(bar.indexOf('body.sc80-cloud #nowPlaying .seek-row{ display: none; }') > 0,
    'and neither is the seek row with its two times and its waveform');
  ok(bar.indexOf('body.sc80-cloud #npControls #shuffleBtn,') > 0 &&
     bar.indexOf('#npControls #repeatBtn{ display: none; }') > 0,
    'shuffle and repeat are not on the bar either');
  ok(bar.indexOf('#miniBar{') > 0 && bar.indexOf('height: 3px;') > 0 && bar.indexOf('top: 0;') > 0,
    'a 3px hairline across the top is where the progress is');
  ok(src.indexOf("mb.addEventListener('pointermove'") > 0 && src.indexOf("a.currentTime = pct * a.duration;") > 0,
    'and it is still drag-to-seek, not a picture of progress');
  ok(src.indexOf("label: shuffle ? 'Shuffle: on' : 'Shuffle: off'") > 0 &&
     src.indexOf("label: 'Repeat: ' + (repeatMode === 'one'") > 0 &&
     src.indexOf("label: 'DJ Mode'") > 0,
    'shuffle, repeat and DJ mode are items in the player menu');
  ok(src.indexOf("$('shuffleBtn').click();") > 0 && src.indexOf("$('repeatBtn').click();") > 0 &&
     src.indexOf("$('djModeBtn').click();") > 0,
    'wired to the bar\u2019s own buttons, so the menu is the same switch');
  ok(src.indexOf("label: 'Lyrics'") > 0, 'lyrics was already there, and still is');
  ok(bar.indexOf('#npPlayerStage{ width: 40px; height: 40px; perspective: none; overflow: visible;') > 0,
    'the record is the art, not the deck');
  ok(bar.indexOf('.np-plinth,') > 0 && bar.indexOf('.np-tonearm-base,') > 0 &&
     bar.indexOf('.np-platter-mat{ display: none; }') > 0,
    'so the plinth, the lid and the tonearm are not drawn at forty pixels');
  ok(bar.indexOf('body.sc80-cloud #nowPlaying .disc{ width: 38px; height: 38px; }') > 0,
    'and the disc is a clean 38px circle instead of an ellipse clipped by its stage');
  ok(bar.indexOf('#playPauseBtn{ width: 38px; height: 38px; }') > 0, 'play is the loudest control in the row');
  ok(bar.indexOf('#npControls{ gap: 2px; margin-left: 0; flex: 0 0 auto; }') > 0,
    'and the controls sit at the end of the row, not spread across it');
}

console.log('');
console.log((fail ? fail + ' FAILED, ' : 'ALL PASS: ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
