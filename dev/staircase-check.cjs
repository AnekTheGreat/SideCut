// 80.0.10 - A SMALL FLIGHT IN THE CORNER, A BAR THAT COVERS THE BOTTOM, AND THE
// ADD-SONGS SHEET ABOVE THE PLUS.
//
// 80.0.9 answered "make the tabs icons" with five treads across the WHOLE width,
// each a riser taller than the one before - a band with steps standing on the bubble
// grid - and it kept the old dock rule that opened the add-songs sheet a full screen
// above the top edge. The owner's reply was:
//
//   "THE ADD SONGS POPUP ISNT SHOWING IN CLOUD MODE JUST MAKE IT ICONS ON THE BOTTOM
//    IS A SMALL BOTTOM RIGHT STAIRCASE. THE SIMPLIFIED NOW BAR SHOULD COVER THE
//    BOTTOM NOT PROTRUDE LIKE IT IS NOW."
//
// This file answers for what replaced them, read straight out of index.html: five
// 46px treads joined edge to edge in the bottom right corner, one riser a step,
// standing on a bar that is bottom-zero and full width, and a sheet that is a
// screen-level panel above that bar with its own X, Escape and backdrop.
//
//   node dev/staircase-check.cjs
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass += 1; console.log('  PASS ' + label); }
  else { fail += 1; console.log('  FAIL ' + label); }
}
const count = (hay, needle) => hay.split(needle).length - 1;

const start = src.indexOf('9. 80.0.10: a small flight in the corner');
const sheetStart = src.indexOf('10. 80.0.10: the add-songs sheet');
const wideStart = src.indexOf('/* ---------- 5. Bigger screens');
const flight = start > 0 ? src.slice(start, sheetStart > start ? sheetStart : wideStart) : '';
const sheet = sheetStart > 0 && wideStart > sheetStart ? src.slice(sheetStart, wideStart) : '';
// The one rule that sizes all five treads, from its first selector to the label rule.
const groupFrom = flight.indexOf('body.sc80-cloud .action-strip > #homeBtn,\nbody.sc80-cloud .action-strip > #libraryBtn,');
const groupTo = flight.indexOf('body.sc80-cloud .action-strip > button span');
const group = groupFrom > 0 && groupTo > groupFrom ? flight.slice(groupFrom, groupTo) : '';
const barFrom = flight.indexOf('body.sc80-cloud #nowPlaying{');
const barTo = flight.indexOf('/* THE FLIGHT.');
const bar = barFrom > 0 && barTo > barFrom ? flight.slice(barFrom, barTo) : '';
const icons = (flight.match(/--sc89-icon: url\(/g) || []).length;

console.log('[1] the flight is a small rail in the bottom right corner');
{
  ok(start > 0 && sheetStart > start && flight.length > 2500,
    'the 80.0.10 flight block is in the page (' + flight.length + ' chars)');
  ok(flight.indexOf('right: 10px;') > 0 && flight.indexOf('left: auto;') > 0,
    'the rail is pinned to the right, not stretched across the width');
  ok(flight.indexOf('bottom: var(--sc10-bar);') > 0,
    'and stands on the bar, not over the wall');
  ok(flight.indexOf('width: auto; max-width: none; height: var(--sc10-rail);') > 0,
    'it is as wide as its treads and no wider');
  ok(flight.indexOf('flex-direction: row;') > 0 && flight.indexOf('align-items: flex-end;') > 0,
    'the treads are a row resting on one floor line');
  ok(flight.indexOf('justify-content: flex-end;') > 0, 'and the row ends at the right edge');
  ok(flight.indexOf('gap: 0;') > 0, 'the treads are joined - no gap in the flight');
  ok(flight.indexOf('background: none;') > 0 && flight.indexOf('box-shadow: none;') > 0 &&
     flight.indexOf('border: none; border-radius: 0;') > 0,
    'the rail paints nothing of its own');
  ok(flight.indexOf('pointer-events: none;') > 0,
    'and takes no taps itself, so the wall is still the wall');
  ok(flight.indexOf('--sc10-tread: 46px;') > 0 && flight.indexOf('--sc10-rise: 10px;') > 0,
    'a tread is 46px wide and a riser 10px');
  ok(flight.indexOf('--sc10-rail: calc(var(--sc10-tread) + var(--sc10-rise) * 4);') > 0,
    'and the rail is exactly four risers above the first tread');
}

console.log('[2] five treads, one riser apart, the plus closing the flight');
{
  ok(flight.indexOf('body.sc80-cloud .action-strip > #homeBtn{\n  height: var(--sc10-tread);') > 0,
    'the first tread is one tread tall');
  ok(flight.indexOf('#libraryBtn{ height: calc(var(--sc10-tread) + var(--sc10-rise)); }') > 0,
    'the second is one riser above it');
  ok(flight.indexOf('#discoverBtn{ height: calc(var(--sc10-tread) + var(--sc10-rise) * 2); }') > 0,
    'the third two');
  ok(flight.indexOf('#studioBtn{ height: calc(var(--sc10-tread) + var(--sc10-rise) * 3); }') > 0,
    'the fourth three');
  ok(flight.indexOf('#dockAddBtn{\n  height: calc(var(--sc10-tread) + var(--sc10-rise) * 4);') > 0,
    'and the plus closes the flight, four risers up');
  ok(flight.indexOf('border-radius: 14px 0 0 0;') > 0 && flight.indexOf('border-radius: 0 14px 0 0;') > 0,
    'the flight is rounded at its own two outer corners, not at every step');
  ok(group.indexOf('margin: 0;') > 0,
    'the old corner column\'s sideways margins are cancelled, so the treads touch');
  ok(group.indexOf('flex: 0 0 var(--sc10-tread);') > 0 &&
     group.indexOf('width: var(--sc10-tread); min-height: 0;') > 0,
    'one tread, one size, whatever the tab holds');
  ok(group.indexOf('font-size: 0;') > 0, 'no word is painted on a tread');
  ok(flight.indexOf('border-top-color: color-mix(in srgb, var(--ink) 26%, transparent);') > 0,
    'each tread carries a lit hairline along its top edge');
  ok(flight.indexOf('filter: brightness(1.08);') > 0, 'and presses with a small lift, not a jump');
}

console.log('[3] the tabs are icons, and the split treads keep their cut');
{
  ok(icons === 6, 'six icon masks: home, discover and the four halves (' + icons + ')');
  ok(flight.indexOf('width: 22px; height: 22px;') > 0, 'a full tread paints its icon at 22px');
  ok(flight.indexOf('-webkit-mask-size: 16px 16px;') > 0, 'a split half paints its own at 16px');
  ok(flight.indexOf('mask-image: var(--sc89-icon);') > 0, 'as a mask, so the glyph takes currentColor');
  ok(flight.indexOf('#homeBtn.active,') > 0 && flight.indexOf('background: var(--coral);') > 0,
    'the tab you are on is filled coral');
  ok(flight.indexOf('#playlistsHalf.active-half,') > 0,
    'and the half you are in is marked inside a split tread');
  ok(flight.indexOf('#playlistsHalf{ justify-content: flex-start !important; }') > 0 &&
     flight.indexOf('#albumsHalf{ justify-content: flex-end !important; }') > 0,
    'the two halves sit side by side at the middle of the tread');
  ok(flight.indexOf('align-items: center !important;') > 0,
    'both icons at the same height, not one at each far corner');
  ok(flight.indexOf('#scDockPillTrack,') > 0 && flight.indexOf('display: none !important;') > 0,
    'the classic dock\'s sliding capsule is not drawn across the flight');
}

console.log('[4] the bar covers the bottom');
{
  ok(bar.length > 400, 'the bar block is in the page (' + bar.length + ' chars)');
  ok(bar.indexOf('left: 0; right: 0; bottom: 0;') > 0,
    'the bar is flush with the bottom edge, not lifted above it');
  ok(bar.indexOf('width: 100%; max-width: none;') > 0, 'and spans the whole width');
  ok(bar.indexOf('height: var(--sc10-bar); min-height: var(--sc10-bar);') > 0,
    'its height is the row plus the phone\'s inset');
  ok(bar.indexOf('border-radius: 0;') > 0, 'no floating corners');
  ok(bar.indexOf('border: 0;') > 0, 'and no border to sit inside its own height');
  ok(flight.indexOf('--sc10-bar: calc(var(--sc10-row) + env(safe-area-inset-bottom));') > 0,
    'the inset is part of the bar, not a strip of page under it');
  ok(bar.indexOf('padding-bottom: env(') === -1 && bar.indexOf('padding: 0 12px env(') === -1,
    'and the bar does not reserve that inset a second time in its padding');
  ok(bar.indexOf('flex: 0 0 var(--sc10-row); height: var(--sc10-row);') > 0,
    'the row is the top sixty pixels of the bar');
  ok(bar.indexOf('display: none;'.repeat(1)) > 0 && bar.indexOf('#npControls #shuffleBtn,') > 0,
    'Shuffle and Repeat are off the bar (they are in the ... menu)');
  ok(bar.indexOf('text-overflow: ellipsis; white-space: nowrap;') > 0,
    'a long title ends in an ellipsis instead of shoving the transport');
  ok(bar.indexOf('height: 3px;') > 0, 'the scrub hairline is thinner than a thumb and part of the bar');
  ok(src.indexOf("label: 'DJ Mode'") > 0 && src.indexOf("$('djModeBtn').click()") > 0,
    'DJ Mode is still answered in the ... menu, wired to the same button');
}

console.log('[5] the add-songs sheet is above the bar, and closes four ways');
{
  ok(sheet.length > 600, 'the sheet block is in the page (' + sheet.length + ' chars)');
  ok(sheet.indexOf('position: fixed;') > 0 && sheet.indexOf('bottom: calc(var(--sc10-bar) + 10px);') > 0,
    'the sheet is fixed above the bar, not a screen above the top edge');
  ok(sheet.indexOf('z-index: 400;') > 0 && sheet.indexOf('z-index: 399;') > 0,
    'the sheet and its backdrop are screen-level layers');
  ok(sheet.indexOf('body.sc80-cloud #addSongsMenu.open{ display: flex; opacity: 1;') > 0,
    'it opens by becoming visible, and rises into place');
  ok(sheet.indexOf('overscroll-behavior: contain;') > 0, 'and it does not drag the page behind it');
  ok(sheet.indexOf('body.sc80-cloud .add-songs-close{') > 0, 'it has a close button of its own');
  ok(sheet.indexOf('flex-direction: row; align-items: center; justify-content: flex-start;') > 0,
    'its rows read left to right, as rows');
  ok(sheet.indexOf('#addSongsMenu .action-pill.primary{') > 0, 'with the first one still coral');
  ok(src.indexOf('id="addSongsClose"') > 0 && src.indexOf('class="add-songs-head"') > 0,
    'the close button is in the sheet markup');
  ok(src.indexOf("['addSongsMenu','addSongsBackdrop'].forEach(function(id){") > 0,
    'and the script moves the sheet and its backdrop to <body>');
  ok(src.indexOf("var x = $('addSongsClose');") > 0 && src.indexOf("if(x) x.addEventListener('click', closeAddSongsMenu);") > 0,
    'the X is wired to the sheet\'s own close');
  ok(src.indexOf("ev.key === 'Escape' || ev.key === 'Esc'") > 0,
    'Escape closes it');
  ok(src.indexOf("ev.target.closest('button')") > 0,
    'and making a choice closes it once the choice is made');
  ok(src.indexOf('prefers-reduced-motion: reduce') > 0 && sheet.indexOf('transition: none;') > 0,
    'with no entrance animation for anyone who asked for less motion');
}

console.log('[6] the views make room for the flight, and this is the release');
{
  ok(flight.indexOf('padding-bottom: calc(var(--sc10-bar) + var(--sc10-rail) + 16px);') > 0,
    'every scrolling view reserves the bar, the flight and a little air');
  ok(flight.indexOf('scroll-padding-bottom: calc(var(--sc10-bar) + var(--sc10-rail) + 16px);') > 0,
    'and a focused row does not land behind it');
  ok(count(src, "const APP_VERSION = '80.0.10';") === 1, 'APP_VERSION = 80.0.10, once');
  ok(sw.indexOf("const CACHE_NAME = 'sidecut-shell-v80.0.10';") !== -1, 'the shell cache is the release number');
  ok(count(src, "version: '80.0.10'") === 1, 'and the changelog has one 80.0.10 entry');
  ok(src.indexOf("title: 'The plus works, the flight is small, the bar covers the bottom'") > 0,
    'whose title is the release title');
  ok(src.indexOf('the widget, the player, the letter covers, the lyrics view and the album pill dock') > 0,
    'and whose notes say what did not move');
  // The sheet's handlers are shared with the classic layout, which must not notice.
  ok(count(src, "$('addSongsBackdrop').addEventListener('click', closeAddSongsMenu);") === 1,
    'the classic dock\'s own backdrop handler is still there, once');
  ok(src.indexOf('body.sc80-cloud #addSongsMenu{') > 0, 'the new sheet is scoped to the cloud layout');
  const classic = src.indexOf('body.sc80-cloud #addSongsMenu{');
  ok(classic > 0 && src.slice(0, classic).indexOf('body:not(.sc80-cloud) #addSongsMenu') === -1,
    'so the classic layout keeps the centred sheet it always had');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
