#!/usr/bin/env node
// 80.6.32 - pills that stop where you aimed, and a rail you can arrange.
//
//   node dev/check-80632.cjs      (run from the repository root)
//
// The release touches two surfaces: the playlist pill strip (snapping, taller
// targets) and the rail's three glyphs (hold, drag, remembered order). The second
// half of this file opens the published bundles, because a page that is right in
// the repo and wrong in the zip is the failure that matters.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

/* -- the release is recorded ---------------------------------------- */
ok(page.includes("const APP_VERSION = '80.6.32';"), 'the page runs 80.6.32');
const at = page.indexOf("version: '80.6.32'");
ok(at > 0, 'the changelog records 80.6.32');
ok(at < page.indexOf("version: '80.6.31'"), 'and 80.6.32 is the newest entry in it');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
ok(entry.includes("title: 'Pills that stop where you aimed, and a rail you can arrange'"), 'and a title that names what changed');
const items = (entry.slice(entry.indexOf('items: [')).match(/'[^']*'/g) || []).map((s) => s.slice(1, -1));
ok(items.length === 3, 'three notes (' + items.length + ')');
ok(!items.some((i) => i.startsWith('[FULL] ')), 'none of them is kept back from a build');
ok(!items.some((i) => /both builds|each build|catch-?up|this build|other build|channel/i.test(i)),
  'and no note talks about release channels instead of the app');

/* -- the pill strip -------------------------------------------------- */
ok(page.includes('#tabs{ scroll-snap-type: x proximity; scroll-padding: 0 20px; }'), 'the pill strip snaps');
ok(page.includes('#tabs .tab{ scroll-snap-align: center; min-height: 38px; padding: 9px 16px; display: inline-flex; align-items: center; }'),
  'each pill is a snap target, taller than before');
ok(page.includes('body.sc-tab-drag #tabs{ scroll-snap-type: none; }'), 'and the snapping is off while a pill is carried');
const strip = page.slice(page.indexOf('function wireTabReorder'), page.indexOf('function persistTabOrder'));
ok(strip.includes("document.body.classList.add('sc-tab-drag');"), 'a held pill turns the snapping off');
ok(strip.includes("document.body.classList.remove('sc-tab-drag');"), 'and letting go turns it back on');

/* -- the rail -------------------------------------------------------- */
ok(page.includes("var SC_RAIL_PAGES = ['library', 'playlists', 'albums'];"), 'the rail knows its three pages');
ok(page.includes('function scShelfOrder(){') && page.includes('function scShelfSaveOrder(){') &&
  page.includes('function scRailDrag(b){'), 'and has an order, a way to keep it, and a drag');
ok(page.includes("JSON.parse(localStorage.getItem('sidecut_railOrder') || 'null')"), 'the order is read from storage');
ok(page.includes("localStorage.setItem('sidecut_railOrder', JSON.stringify(ids))"), 'and written back after a drag');
ok(page.includes("var pages = scShelfOrder().map(function(id){ return [id, _pageMeta[id][0], _pageMeta[id][1]]; });"),
  'the glyphs are built in that order');
ok(page.includes("if(b.getAttribute('data-shelf')) scRailDrag(b);"), 'each page glyph is wired for the drag');
const wire = page.indexOf("if(b.getAttribute('data-shelf')) scRailDrag(b);");
const tap = page.indexOf("if(this.getAttribute('data-src') === '1'){ scShelfSetSrc(", wire);
ok(wire > 0 && tap > wire, 'the drag is wired before the tap handler, so a release cannot open a page');
const drag = page.slice(page.indexOf('function scRailDrag(b){'), page.indexOf('function scShelfRender(){'));
ok(drag.includes('}, 380);'), 'the hold is 380ms, the same as the pill strip');
ok(drag.includes("b.classList.add('lift')"), 'the carried glyph lifts');
ok(drag.includes('rail.insertBefore(b, sibs[i]);') && drag.includes('rail.insertBefore(b, sibs[i].nextSibling);'),
  'and swaps places when its middle passes a neighbour');
ok(drag.includes('releasePointerCapture'), 'the pointer capture is released on every end');
ok(drag.includes("b.setAttribute('data-dragged', '1');") && drag.includes("ev.stopImmediatePropagation();"),
  'the click at the end of a drag is swallowed');
ok(page.includes("'#scShelfRail .scshelf-tab.lift{transform:scale(1.14);opacity:.92;z-index:3;'"), 'the lift is visible');
ok(page.includes("'#scShelfRail .scshelf-tab{pointer-events:auto;touch-action:none}'"),
  'and the glyph takes the vertical drag instead of scrolling the list');

/* -- what each channel publishes ------------------------------------ */
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
const playNotes = items.filter((i) => !i.startsWith('[FULL] ') && !hidesOnPlay(i));
ok(playNotes.length === 3, 'the Play channel publishes all three notes (' + playNotes.length + ')');

const rootMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
ok(String(rootMan.version) === '80.6.32', 'ota/updates.json is 80.6.32 (' + rootMan.version + ')');
ok(Array.isArray(rootMan.notes) && rootMan.notes.length === 3, 'with three notes (' + (rootMan.notes || []).length + ')');

const playMan = path.join(ROOT, 'ota-play', 'updates.json');
const playZip = path.join(ROOT, 'ota-play', 'update.zip');
ok(fs.existsSync(playMan), 'the Play channel has a manifest');
if (fs.existsSync(playMan)) {
  const man = JSON.parse(fs.readFileSync(playMan, 'utf8'));
  ok(String(man.version) === '80.6.32', 'ota-play/updates.json is 80.6.32 (' + man.version + ')');
  ok(Array.isArray(man.notes) && man.notes.length === 3, 'with the three notes this build publishes (' + (man.notes || []).length + ')');
  ok(man.size === (fs.existsSync(playZip) ? fs.statSync(playZip).size : -1), 'and its size matches the zip beside it');
}
if (fs.existsSync(playZip)) {
  const zipped = execFileSync('unzip', ['-p', playZip, 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(zipped.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'the bundle carries the Play flag');
  ok(/const APP_VERSION = '80\.6\.32';/.test(zipped), 'and the page inside it is 80.6.32');
  ok(zipped.includes('#tabs{ scroll-snap-type: x proximity;'), 'the page in the zip has the snapping strip');
  ok(zipped.includes('function scRailDrag(b){'), 'and the draggable rail');
}

/* -- the page still parses ----------------------------------------- */
{
  const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1]));
  let failing = 0;
  for (const s of scripts) {
    try { new vm.Script(s[2]); } catch (_e) { failing++; }
  }
  ok(scripts.length === 7, 'seven inline scripts (' + scripts.length + ')');
  ok(failing === 0, 'all seven inline scripts compile (' + failing + ' fail)');
}

if (bad.length) {
  console.log('check-80632: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80632: %d passed, 0 failed', pass);
