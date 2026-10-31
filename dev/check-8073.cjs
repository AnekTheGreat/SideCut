#!/usr/bin/env node
// 80.7.3 - the dots on the player belong to the song on the screen.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }
function fnBody(name) {
  const at0 = page.indexOf('function ' + name + '(');
  ok(at0 > 0, name + ' exists');
  if (at0 < 0) return '';
  const a = page.slice(at0 - 6, at0) === 'async ' ? at0 - 6 : at0;
  let i = page.indexOf('{', a), depth = 0;
  for (let j = i; j < page.length; j++) {
    if (page[j] === '{') depth++;
    else if (page[j] === '}') { depth--; if (!depth) return page.slice(a, j + 1); }
  }
  return '';
}

// ---- the release ------------------------------------------------------------
ok(page.includes("const APP_VERSION = '80.7.3';"), 'the page runs 80.7.3');
const at = page.indexOf("version: '80.7.3'");
ok(at > 0, 'the changelog records 80.7.3');
ok(at < page.indexOf("version: '80.7.2'"), 'and it is the newest entry in it');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
const itemsBlock = entry.slice(entry.indexOf('items: ['), entry.indexOf(']},'));
const items = (itemsBlock.match(/'((?:[^'\\]|\\.)*)'/g) || []).map(s => s.slice(1, -1));
ok(items.length === 3, 'three notes (' + items.length + ')');
ok(!items.some(i => i.includes("'")), 'no note carries an apostrophe');
ok(!items.some(i => /streaming|streams?\b|from the source|pinned artist/i.test(i)),
  'and none of them trips the updater filter');
ok(!items.some(i => /both builds|each build|this build|other build|release channel|play store|sideload/i.test(i)),
  'or talks about release channels');

// ---- the dots on the player -------------------------------------------------
const menu = fnBody('showNpMenu');
ok(menu.includes('scStreamMenu(scStreamState.curId'), 'the dots open the menu of the song on the screen');
ok(menu.indexOf('scStreamMenu(scStreamState.curId') < menu.indexOf("toast('Play a song first')"),
  'before they can answer that nothing is playing');
ok(menu.indexOf('scStreamMenu(scStreamState.curId') < menu.indexOf('openSongActions(id)'),
  'and before they can open a download menu instead');
ok(menu.includes("scStreamState.barOn && scStreamState.curId"), 'only while that song owns the bar');

// ---- it runs ----------------------------------------------------------------
(function dotsOnASong() {
  const seen = { menu: [], actions: [], toast: [] };
  const ctx = {
    queue: ['t7'], queueIndex: 0,
    allTracks: [{ id: 't7' }, { id: 't9' }],
    scStreamState: { barOn: true, curId: 'k9' },
    scStreamMenu: (id, where) => seen.menu.push([id, where]),
    openSongActions: (id) => seen.actions.push(id),
    toast: (m) => seen.toast.push(m)
  };
  vm.createContext(ctx);
  const showNpMenu = vm.runInContext('(' + menu + ')', ctx);
  showNpMenu.call(ctx);
  ok(seen.menu.length === 1 && seen.menu[0][0] === 'k9' && seen.menu[0][1] === 'np',
    'with a catalogue song up, the dots open its sheet (' + JSON.stringify(seen.menu) + ')');
  ok(seen.actions.length === 0, 'and not the queue song that is silent');
  ok(seen.toast.length === 0, 'and never the nothing-is-playing toast');
})();

(function dotsWithNoSong() {
  const seen = { menu: [], actions: [], toast: [] };
  const ctx = {
    queue: [], queueIndex: -1, allTracks: [],
    scStreamState: { barOn: false, curId: '' },
    scStreamMenu: (id, where) => seen.menu.push([id, where]),
    openSongActions: (id) => seen.actions.push(id),
    toast: (m) => seen.toast.push(m)
  };
  vm.createContext(ctx);
  const showNpMenu = vm.runInContext('(' + menu + ')', ctx);
  showNpMenu.call(ctx);
  ok(seen.menu.length === 0, 'with nothing on the bar the stream sheet is not opened');
  ok(seen.toast.length === 1 && seen.toast[0] === 'Play a song first', 'and the old answer is still there');
})();

(function dotsOnADownload() {
  const seen = { menu: [], actions: [] };
  const ctx = {
    queue: ['t7'], queueIndex: 0, allTracks: [{ id: 't7' }],
    scStreamState: { barOn: false, curId: 'k9' },
    scStreamMenu: (id, where) => seen.menu.push([id, where]),
    openSongActions: (id) => seen.actions.push(id),
    toast: () => {}
  };
  vm.createContext(ctx);
  const showNpMenu = vm.runInContext('(' + menu + ')', ctx);
  showNpMenu.call(ctx);
  ok(seen.actions.length === 1 && seen.actions[0] === 't7', 'a downloaded song keeps its own menu');
  ok(seen.menu.length === 0, 'and a released bar does not interpose');
})();

// ---- the crop a catalogue song earned in 80.7.2 is still whole --------------
ok(page.includes("    if(!isFile){\n      acts.push({ label: 'Crop a clip from this song"), 'the catalogue row still offers Crop');
ok(page.includes('  async function scStreamCropFile(t){'), 'the reader still exists');
ok(page.includes('const cropStream = (!t.file && (t.stream || t.streamId)) ? t : null;'), 'the sheet still accepts a file-less song');
ok(page.includes('  async function scCropStreamSave(){'), 'the clip writer still exists');
ok(fnBody('scCropStreamSave').includes('allTracks.push(track)'), 'and still saves the clip into the library');
ok(fnBody('scStreamMenu').includes('scStreamCrop(id)'), 'the menu entry still reaches the sheet');
ok(page.includes("    if(typeof scStreamResumeFromPhone === 'function' && scStreamResumeFromPhone()) return true;"),
  'and 80.7.2 press-from-outside still resumes a catalogue song');

// ---- every inline script still compiles ------------------------------------
const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
ok(scripts.length >= 6, 'the page has its inline scripts (' + scripts.length + ')');
let compiled = 0;
scripts.forEach((s, i) => {
  try { new vm.Script(s); compiled++; } catch (e) { bad.push('inline script ' + i + ' does not compile: ' + e.message); }
});
ok(compiled === scripts.length, 'and all ' + scripts.length + ' of them compile');

// ---- the channels -----------------------------------------------------------
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
ok(full.version === '80.7.3', 'ota/updates.json is 80.7.3');
ok((full.notes || []).length === 3, 'and publishes all three notes (' + (full.notes || []).length + ')');
const play = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota-play', 'updates.json'), 'utf8'));
ok(play.version === '80.7', 'the Play channel is held at 80.7 (' + play.version + ')');
const hold = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'channel-hold.json'), 'utf8'));
ok(hold.play === true && !!hold.why, 'and the hold says why');

console.log('check-8073: %d passed, %d failed', pass, bad.length);
for (const b of bad) console.log('  x ' + b);
process.exit(bad.length ? 1 : 0);
