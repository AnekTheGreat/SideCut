// 80.2 - ROUND BUBBLES THAT HOLD THEIR WORDS, A CURVE OF ICON TABS, LYRICS IN THE
// BAR, AND NO BAND OF EMPTY THEME COLOUR UNDER THE LISTS.
//
// 80.2.1 - and the four things that release got wrong or left rough: the Lyrics icon
// painted in BOTH layouts (it is the cloud bar alone now), the diagonal seam of the
// old dock pill still drawn across the two split tiles, circles that wanted a little
// air, and a fade under the flight that was a patch behind the tiles rather than the
// width of the screen. Section [7] answers for those.
//
// The owner, on the phone:
//
//   "THE CIRCLES NEED TO BE MORE WELL OPTIMIZED THINGS ARE LOOKING WEIRD AND TABS
//    SHOULD LEGIT JUST BE ICONS ... SHOULD KIND OF CURVE UP BUT NICELY, IT'S NOT
//    SMOOTH AT ALL IN THIS MODE LIKE IT SHOULD BE AND IN THE NOW BAR THERE SHOULD BE
//    LYRICS OPTIONS STILL, IN ALBUMS AND PLAYLISTS A WHOLE PART GETS LIKE TURNS
//    THEME MATCHING BLUE AT THE BOTTOM WHICH WASTES SPACE."
//
// This file answers for what replaced them, read straight out of index.html: the
// two-column circle grid whose contents are a column (so the icon is never on the
// value), five equal icon tiles lifted along a curve with one painted glyph each,
// the lyrics button in #npControls wired to the same #lyricsBtn, and the views that
// now reserve the bar rather than the bar plus the whole rail.
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

const start = src.indexOf('/* ---------- 11. 80.2: the cloud layout, tidied');
const wideStart = src.indexOf('/* ---------- 5. Bigger screens');
const block = start > 0 ? src.slice(start, wideStart > start ? wideStart : start + 30000) : '';
const flight = (() => {
  const a = block.indexOf('/* 2. THE FLIGHT.');
  const b = block.indexOf('/* 3. LYRICS');
  return a > 0 && b > a ? block.slice(a, b) : '';
})();
const wall = (() => {
  const a = block.indexOf('/* 1. THE WALL.');
  const b = block.indexOf('/* 2. THE FLIGHT.');
  return a > 0 && b > a ? block.slice(a, b) : '';
})();
const tabbar = (() => {
  const a = block.indexOf('/* 3. LYRICS');
  const b = block.indexOf('/* 4. THE BAND');
  return a > 0 && b > a ? block.slice(a, b) : '';
})();
const band = (() => {
  const a = block.indexOf('/* 4. THE BAND');
  return a > 0 ? block.slice(a) : '';
})();
const icons = (flight.match(/--sc89-icon:url\(/g) || []).length;

console.log('[1] the wall is a grid of circles, and a bubble holds its own words');
{
  ok(start > 0 && block.length > 4000, 'the 80.2 block is in the page (' + block.length + ' chars)');
  ok(wall.indexOf('grid-template-columns:repeat(2, minmax(0, 1fr));') > 0,
    'the wall is two equal columns');
  ok(wall.indexOf('aspect-ratio:1 / 1;') > 0, 'and every bubble is a square box turned into a circle');
  ok(wall.indexOf('grid-column:auto;') > 0,
    'a "wide" or "tall" bubble in the cloud wall is still ONE cell, not a full-width circle');
  ok(wall.indexOf('display:flex; flex-direction:column;') > 0,
    'the bubble content is a column');
  ok(wall.indexOf('position:static; top:auto; left:auto;') > 0 && wall.indexOf('transform:none;') > 0,
    'the icon is a flex item, not an absolute layer over the value');
  ok(wall.indexOf('-webkit-line-clamp:2;') > 0, 'the label is clamped to two lines');
  ok(wall.indexOf('animation:none;') > 0, 'and the six bubbles stop floating forever');
  ok(wall.indexOf('.hb-hint{ display:none; }') > 0, 'the second resize hint is gone');
  ok(wall.indexOf('.hb-miniplay{') > 0 && wall.indexOf('order:9;') > 0,
    'the play button sits under the label, not on it');
  ok(wall.indexOf('#sc80CloudCtl{') > 0 && wall.indexOf('position:static;') > 0,
    'the bell, refresh and gear sit under the label too');
  ok(wall.indexOf('@media (min-width:600px)') > 0 && wall.indexOf('@media (min-width:900px)') > 0,
    'a tablet gets three and four to a row');
}

console.log('[2] the flight is five icon tiles lifted along a curve');
{
  ok(flight.length > 900, 'the flight block is in the page (' + flight.length + ' chars)');
  ok(flight.indexOf('--sc11-tile:44px;') > 0 && flight.indexOf('--sc11-gap:8px;') > 0,
    'one tile is 44px and the gap 8px');
  ok(flight.indexOf('gap:var(--sc11-gap);') > 0 && flight.indexOf('align-items:flex-end;') > 0,
    'the tiles stand on one floor line with equal gaps');
  ok(flight.indexOf('#libraryBtn{ transform:translateY(-6px); }') > 0 &&
     flight.indexOf('#discoverBtn{ transform:translateY(-16px); }') > 0 &&
     flight.indexOf('#studioBtn{ transform:translateY(-28px); }') > 0 &&
     flight.indexOf('#dockAddBtn{ transform:translateY(-42px); }') > 0,
    'the lift is a curve - 0, 6, 16, 28, 42px - not a set of equal steps');
  ok(flight.indexOf('border-radius:16px;') > 0, 'a tile is a rounded square');
  ok(flight.indexOf('background:color-mix(in srgb, var(--bg-raised) 94%, #000);') > 0,
    'and a solid surface, not a blur');
  ok(flight.indexOf('backdrop-filter:none;') > 0, 'no per-tile backdrop blur');
  ok(icons === 2, 'two tab glyphs are declared in this block - library and studio (' + icons + ')');
  ok(flight.indexOf('position:absolute; left:50%; top:50%;') > 0 &&
     flight.indexOf('transform:translate(-50%,-50%);') > 0,
    'each tab paints ONE glyph, centred, over whatever the button holds');
  ok(flight.indexOf('#libraryBtn > div,') > 0 && flight.indexOf('opacity:0;') > 0,
    'the split treads keep their taps and stop painting their two icons');
  ok(flight.indexOf('--sc11-tile:44px') > 0 && flight.indexOf('flex:0 0 var(--sc11-tile);') > 0,
    'one tile, one size, whatever the tab holds');
  ok(flight.indexOf('body.sc80-cloud .action-strip::before{') > 0,
    'a soft scrim sits under the flight so the list fades into it');
  ok(src.indexOf("body.sc80-cloud #homeBtn{\n  --sc89-icon: url(") > 0 ||
     src.indexOf('body.sc80-cloud #discoverBtn{') > 0,
    'the home and discover glyphs are still the ones the tab block declares');
}

console.log('[3] the split treads are still two tabs, and the labels are still there');
{
  ok(src.indexOf('#playlistsHalf{') > 0 && src.indexOf('#albumsHalf{') > 0,
    'Library still has its two halves');
  ok(src.indexOf('#studioHalf{') > 0 && src.indexOf('#toolsHalf{') > 0,
    'Studio still has its two halves');
  ok(src.indexOf('body.sc80-cloud .action-strip > button span{ font-size: 0 !important; }') > 0,
    'no word is painted on a tile');
}

console.log('[4] lyrics is back in the bar');
{
  ok(src.indexOf("b.id = 'sc11Lyrics';") > 0, 'the page creates the button and names it');
  ok(src.indexOf("var pill = document.getElementById('lyricsBtn');") > 0,
    'and it clicks the same LYRICS pill the bar used to show');
  ok(src.indexOf("menu.parentNode.insertBefore(b, menu);") > 0,
    'it is placed before the ... menu, inside #npControls');
  ok(tabbar.indexOf('#sc11Lyrics{') > 0 && tabbar.indexOf('display:none;') > 0,
    'it is hidden in the classic layout');
  ok(tabbar.indexOf('body.sc80-cloud #npControls #sc11Lyrics{ display:flex; }') > 0,
    'and shown in the cloud bar');
  ok(src.indexOf("if(pill) pill.click();") > 0, 'the click is forwarded, not reimplemented');
}

console.log('[5] the band of theme colour under the lists is gone');
{
  ok(band.indexOf('padding-bottom:calc(var(--sc10-bar) + 12px);') > 0,
    'the views reserve the bar and 12px, not the bar plus the whole rail');
  ok(band.indexOf('scroll-padding-bottom:calc(var(--sc10-bar) + 12px);') > 0,
    'and a focused row still does not land behind the bar');
  ok(band.indexOf('padding-right:0;') > 0, 'the old dock strip is not reserved either');
  ok(band.indexOf('--sc10-rail') === -1, 'no view reserves the rail any more');
  ok(band.indexOf('body.sc80-cloud #nowPlaying{') > 0 && band.indexOf('blur(10px)') > 0,
    'and the bar carries less blur to recompute while the list scrolls');
}

console.log('[6] the release, the cache and the sheet are where 80.1 left them');
{
  ok(count(src, "const APP_VERSION = '80.2.3';") === 1, 'APP_VERSION = 80.2, once');
  ok(sw.indexOf("const CACHE_NAME = 'sidecut-shell-v80.2.3';") !== -1, 'the shell cache is the release number');
  ok(count(src, "version: '80.2.3'") === 1, 'and the changelog has one 80.2 entry');
  ok(src.indexOf("title: 'Round bubbles that hold their words, a curve of icon tabs, and Lyrics back in the bar'") > 0,
    'whose title is the release title');
  ok(src.indexOf('the letter covers, the lyrics view and the album pill dock are where 80.1 left them') > 0,
    'and whose notes say what did not move');
  ok(src.indexOf('body.sc80-cloud #addSongsMenu.open{ display: flex; opacity: 1;') > 0,
    'the add-songs sheet from 80.1 is untouched');
  ok(src.indexOf('bottom: calc(var(--sc10-bar) + 10px);') > 0,
    'and still sits above the bar');
}

console.log('[7] 80.2.1: the icon is the cloud bar alone, the seam is gone, the circles breathe');
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

console.log('[8] 80.2.2: one menu behind both sets of dots, one song or a selection saved');
{
  // THE FOLD. The now bar's own menu is gone: its modal, its list and its close
  // button, and showNpMenu hands the playing song to the one sheet a row opens.
  ok(src.indexOf('id="npMenuBackdrop"') === -1 && src.indexOf('id="npMenuList"') === -1,
    'the now bar has no menu of its own');
  const np = src.slice(src.indexOf('function showNpMenu()'));
  ok(np.slice(0, np.indexOf('\n  }')).indexOf('openSongActions(id);') !== -1,
    'its 3-dot opens the song sheet');
  ok(src.indexOf("$('npMenuClose')") === -1, 'and the old menu close button is gone');
  // ONE SONG. The sheet's save row, handed exactly the song it was opened for.
  ok(src.indexOf("dlSongBtn.id = 'songActionsDownload'") > 0, 'the song sheet has a save row');
  ok(src.indexOf("downloadTracksToDevice([id], 'Downloading this song');") > 0,
    'and it saves the one song it was opened for');
  // A SELECTION. The selection bar's button, handed the ticked ids.
  ok(src.indexOf('id="selectDownloadBtn"') > 0, 'the selection bar has a save button');
  ok(src.indexOf("downloadTracksToDevice(ids, ids.length === 1 ? 'Downloading this song' : 'Downloading ' + ids.length + ' songs');") > 0,
    'and it saves the rows that are ticked');
  // ONE WRITER, and the switches the slim bar hides live in the same sheet.
  ok(src.indexOf('async function downloadTracksToDevice(ids, label)') > 0 &&
     src.indexOf('function downloadPlaylistToDevice') === -1,
    'one writer serves the row, the playlist and the selection');
  ok(src.indexOf('function appendPlaybackGroup(host)') > 0 &&
     src.indexOf('try{ appendPlaybackGroup(list); }catch(_ePlayback){}') > 0,
    'the Playback group is appended after the grouping');
  ok(src.indexOf('const barBtn = $(r.btn);') > 0 && src.indexOf('if(barBtn) barBtn.click();') > 0,
    'and its rows click the bar own switches');
  ok(src.indexOf('has no audio file to download.') > 0,
    'a song with no stored audio says so instead of failing a progress bar');
}

console.log('[9] 80.2.3: the award card opens for plays, and every rung is a bigger card');
{
  // THE LADDER. The rungs the owner named, and the tail that keeps going past them.
  ok(src.indexOf('var PLAY_MILESTONES = [100, 200, 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000];') > 0,
    'the plays ladder names every rung asked for');
  ok(src.indexOf('var PLAY_LADDER_STEP = 5000, PLAY_LADDER_TOP = 100000;') > 0,
    'and it keeps going in steps of five thousand');
  ok(src.indexOf('function playRungs(){') > 0, 'the ladder is generated past its last named rung');
  // THE CARD. The same overlay a streak gets, with a medal and a ceremony per tier.
  ok(src.indexOf('function celebratePlays(plays, opts){') > 0, 'a plays award has its own celebration');
  ok(src.indexOf("host.querySelector('.sc80-ms-kicker').textContent = 'Award';") > 0,
    'it says Award where a streak says Milestone');
  ok(src.indexOf('medal.textContent = ') > 0 && src.indexOf('+ award.name;') > 0,
    'and it wears the medal it earned');
  ok(src.indexOf('function paintCeremony(host, tier){') > 0 &&
     src.indexOf("rings.appendChild(document.createElement('i'));") > 0,
    'the rings are painted per tier');
  ok(src.indexOf('function bitsHtml(n){') > 0 && src.indexOf('n = n || 26;') > 0,
    'so the bits take a count, and a streak keeps its own twenty-six');
  ok(src.indexOf('.sc80-ms-medal{') > 0 && src.indexOf('#sc80Milestone[data-tier="5"] .sc80-ms-card{') > 0,
    'the five medals and their glows have a stylesheet');
  // THE TRIGGER. The app's own play counter, a start, and a return to the front.
  ok(src.indexOf("try{ if(window.SC80 && typeof SC80.checkPlays === 'function') SC80.checkPlays(); }catch(_eAward){}") > 0,
    'the play counter tips the card');
  ok(src.indexOf('function checkPlays(opts){') > 0 && src.indexOf('markPlaysThrough(hit);') > 0,
    'and every rung crossed is recorded, so nothing queues behind it');
  ok(src.indexOf('function bootPlays(){') > 0 && src.indexOf('try{ bootPlays(); }catch(e){}') > 0,
    'a start checks the ladder');
  ok(src.indexOf("document.addEventListener('visibilitychange', function(){") > 0,
    'and so does a return to the front');
  // THE RECORD. Studio lists the next rung and replays the ones already earned.
  ok(src.indexOf('function playsCard(){') > 0 && src.indexOf('id="sc80Plays"') > 0,
    'Studio, Tools has a Plays block');
  ok(src.indexOf('data-sc80-plays="') > 0, 'with a Replay per rung');
  ok(src.indexOf("else if(t.hasAttribute('data-sc80-plays')) celebratePlays(Number(t.getAttribute('data-sc80-plays')), { manual: true });") > 0,
    'and a replay opens the same card');
  ok(src.indexOf("plays: 'sc80Plays'") > 0, 'the rungs are remembered on the device');
  // THE STREAK CARD is still the streak card, in what it says and in how it is painted.
  ok(src.indexOf("host.setAttribute('data-kind', 'streak');") > 0 &&
     src.indexOf("host.querySelector('.sc80-ms-kicker').textContent = 'Milestone';") > 0,
    'the streak card resets to its own word and its own rings');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
