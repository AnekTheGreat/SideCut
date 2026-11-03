#!/usr/bin/env node
// 80.10 - add to an album shows the albums that exist, and the sheet stays on screen.
//
// Static: the version, the three notes (through the updater's own filter), the sheet's
// height cap and scroller, the chooser's two sources, the empty-list skip, the wiring,
// every inline script, and both OTA bundles.
// Driven: the chooser is run against a device store and a source store (an empty list is
// not offered, a name that exists in both is offered once, a device album with no songs
// is not offered, the labels count what they say, the last choice makes a new one, and
// choosing a device album files the song under that album's own name); the sheet is run
// against a fake DOM (capped, rows inside the scroller, Cancel outside it); the grid is
// run against lists with and without songs; scStreamDeviceAlbums filters and keeps the
// album order it is given.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
const failed = [];
function ok(cond, msg) {
  if (cond) { passed++; return; }
  failed.push(msg);
}
function between(a, b) {
  const i = html.indexOf(a);
  if (i < 0) throw new Error('missing anchor: ' + a);
  const j = html.indexOf(b, i + a.length);
  if (j < 0) throw new Error('missing end anchor: ' + b);
  return html.slice(i, j);
}
const count = (s, needle) => s.split(needle).length - 1;

// ── the version ──────────────────────────────────────────────────────────────
ok(count(html, "const APP_VERSION = '80.10';") === 1, 'the page says 80.10, once');
ok(count(html, "const APP_VERSION = '80.9';") === 0, 'and no longer says 80.9');

// ── the notes, through the updater's own filter ──────────────────────────────
const entry = between("{ version: '80.10',", "{ version: '80.9',");
const notes = entry.match(/'\[FULL\] ([^']*)'/g) || [];
ok((notes.length === 3), 'three notes ship with this release, not ' + notes.length);
const DROP = /streaming|streams?\b|from the source|pinned artist/i;
notes.forEach((n, i) => {
  const text = n.replace(/^'\[FULL\] /, '').replace(/'$/, '');
  ok(!DROP.test(text), 'note ' + (i + 1) + ' survives the updater filter');
  ok(text.indexOf("'") === -1, 'note ' + (i + 1) + ' carries no apostrophe');
});
ok(/title: 'Add to an album shows the albums you have'/.test(entry), 'the title is the album chooser');

// ── the sheet: capped, and its rows scroll inside it ─────────────────────────
const sheet = between('  function scStreamSheet(title, actions){', '  function scStreamHold(');
ok(sheet.includes('max-height:calc(100dvh - 18px)'), 'the panel stops at the height of the screen');
ok(sheet.includes("'display:flex;flex-direction:column;max-height:calc(100vh - 18px)"), 'and is a column, so its header and Cancel can stay put');
ok(/var body = document\.createElement\('div'\);/.test(sheet), 'its rows get their own body');
ok(sheet.includes('overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain'), 'the body is the scroller');
ok(sheet.includes('body.appendChild(b);'), 'every choice is appended to that body');
ok(!sheet.includes('m.appendChild(b);'), 'and none is appended to the panel itself');
ok(sheet.includes("hd.style.cssText = 'margin:0 0 4px;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 0 auto;'"), 'the title is pinned');
ok(sheet.includes("c.style.cssText = 'flex:0 0 auto;"), 'so is Cancel');

// ── the chooser: both stores, empty lists out ────────────────────────────────
const devAlbums = between('  function scStreamDeviceAlbums(){', '  function scStreamPickList(kind, id){');
ok(devAlbums.includes('visibleAlbumNames()'), 'the chooser reads the albums the Albums page shows');
ok(devAlbums.includes('scAlbumCardOrder('), 'in the order the Album cards are in');
ok(devAlbums.includes('!e.trackIds.length'), 'a device album with no songs is not offered either');
const pick = between('  function scStreamPickList(kind, id){', '  function scStreamNewPlaylist(){');
ok(pick.includes('if(!name || !n) return;'), 'a list that holds nothing is not offered');
ok(pick.includes('scStreamDeviceAlbums().forEach('), 'the device albums are offered beside the lists');
ok(pick.includes("seen[key] = 1;"), 'and a name that exists in both is offered once');
ok(pick.includes("a.n + ' on device'"), 'the labels say where each album lives');
ok(count(pick, "acts.push({ label: (isAl ? 'New album' : 'New playlist')") === 1, 'a new one is still the last choice');
ok(count(html, "scStreamToAlbum(id);") === 1, 'typing a name is reachable only from the new-album choice');
ok(count(html, "acts.push({ label: 'Add to an album\\u2026', run: function(){ scStreamPickList('al', id); } });") === 1,
  'the row popup opens the chooser instead of a name box');

// ── the grid: no empty albums, and a name that wraps ────────────────────────
const grid = between('  function scShelfGrid(kind, list){', '  // 80.6.23 - THE PLUS ASKS, AND IT ASKS BOTH');
ok(grid.includes('var draw = (list || []).filter(function(p){ return !isAl || (((p && p.items) || []).length > 0); });'),
  'an album with no songs is filtered out');
ok(grid.includes('draw.forEach(function(p){'), 'the grid draws only what is left');
ok(grid.includes('-webkit-line-clamp:2'), 'a tile name wraps to two lines');
ok(!grid.includes('white-space:nowrap;">\' + escapeHtml(name)'), 'and is no longer cut to one');

// ── driven: the chooser ─────────────────────────────────────────────────────
function mkEl(tag) {
  return {
    tag, className: '', textContent: '', type: '', style: { cssText: '' }, children: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, setAttribute() {},
  };
}
const doc = { createElement: mkEl, body: { children: [], appendChild(c) { this.children.push(c); return c; } } };
const said = [];
let sheetCall = null;
let added = null;
const device = {
  'Road Trip': { artist: 'The Band', trackIds: ['1', '2', '3'] },
  'Empty One': { artist: 'Nobody', trackIds: [] },
};
const state = {
  albums: [
    { name: 'Never Filled', items: [] },
    { name: 'Keeper', items: [{ id: 's_9', kind: 's' }] },
    { name: 'Road Trip', items: [{ id: 's_8', kind: 's' }] },
  ],
  playlists: [],
};
const ctx = {
  document: doc,
  scStreamState: state,
  scStreamEntry: () => ({ id: 's_1', title: 'A song' }),
  scStreamById: () => ({ id: 's_1' }),
  scStreamAlbums: () => state.albums,
  scStreamPlItems: (p) => (p && p.items) || [],
  scStreamSong: () => null,
  userAlbums: device,
  visibleAlbumNames: () => Object.keys(device),
  scAlbumCardOrder: (names) => names.slice(),
  scLibAdd: (list, name, item) => {
    added = { list: list, name: name, item: item };
    const out = (list || []).map((p) => ({ name: p.name, items: (p.items || []).slice() }));
    const hit = out.filter((p) => p.name === name)[0];
    if (hit) hit.items.push(item); else out.push({ name: name, items: [item] });
    return out;
  },
  scStreamSave() {}, scStreamRender() {},
  scStreamSay: (s) => said.push(String(s)),
  scStreamSheet: (title, acts) => { sheetCall = { title: title, acts: acts }; },
  scStreamToAlbum: () => { sheetCall = { title: 'TYPED', acts: [] }; },
  scStreamToPlaylist: () => {},
  escapeHtml: (s) => String(s),
  scStreamThumb: () => '',
  scIcon: () => '<i></i>',
  scStreamPlAdd: (l) => l,
  console,
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(devAlbums + '\n' + pick, ctx);

const C = ctx;
const dev = C.scStreamDeviceAlbums();
ok(dev.length === 1 && dev[0].name === 'Road Trip' && dev[0].n === 3,
  'driven: the device store answers with the album that has songs, and its count');
ok(!dev.some((a) => a.name === 'Empty One'), 'driven: a device album with no songs is not offered');

C.scStreamPickList('al', 's_1');
ok(sheetCall && sheetCall.title === 'Add to an album', 'driven: the chooser still asks about albums');
const labels = sheetCall.acts.map((a) => a.label);
ok(labels.indexOf('Never Filled \u00b7 0 songs') === -1, 'driven: an empty list is not offered');
ok(labels.filter((l) => l.indexOf('Road Trip') === 0).length === 1, 'driven: a name in both stores is offered once');
ok(labels.indexOf('Keeper \u00b7 1 song') !== -1, 'driven: the list from the source is offered with its count');
ok(labels[labels.length - 1] === 'New album\u2026', 'driven: a new album is the last choice');
const deviceChoice = sheetCall.acts.filter((a) => a.label.indexOf('Road Trip') === 0)[0];
ok(!!deviceChoice, 'driven: the album that exists is reachable');
added = null;
deviceChoice.run();
ok(added && added.name === 'Road Trip', 'driven: choosing it files the song under that album\'s own name');
ok(added && added.item && added.item.id === 's_1', 'driven: and the song is the one that was chosen');
ok(said.length && said[said.length - 1].indexOf('Road Trip') !== -1, 'driven: and it says where the song went');

sheetCall = null;
state.albums = [];
delete device['Road Trip'];
delete device['Empty One'];
C.scStreamPickList('al', 's_1');
ok(sheetCall && sheetCall.acts[0].label.indexOf('No albums yet') === 0, 'driven: with nothing anywhere it says so');
ok(sheetCall.acts[sheetCall.acts.length - 1].label === 'New album\u2026', 'driven: and a new one is still offered');
const lastActs = sheetCall.acts.slice();
sheetCall = null;
lastActs[lastActs.length - 1].run();
ok(sheetCall && sheetCall.title === 'TYPED', 'driven: the new-album choice is the one that asks for a name');

// ── driven: the sheet ───────────────────────────────────────────────────────
sheetCall = null;
doc.body.children.length = 0;
const S = C;
S.scStreamSheetClose = () => {};
vm.runInContext('var scStreamSheetClose = function(){};', ctx);
vm.runInContext('var scStreamSheet = ' + sheet.replace('function scStreamSheet', 'function'), ctx);
void S;
vm.runInContext('scStreamSheet("Add to an album", [{label:"A"},{label:"B",danger:true},{label:"New album\u2026"}]);', ctx);
const bd = doc.body.children[doc.body.children.length - 1];
ok(!!bd, 'driven: the sheet is put on the page');
const modal = bd.children[0];
ok(!!modal && modal.className === 'modal', 'driven: as a panel');
ok(modal.style.cssText.indexOf('max-height:calc(100dvh - 18px)') !== -1, 'driven: capped at the height of the screen');
const hd = modal.children[0], body = modal.children[1], cancel = modal.children[2];
ok(hd && hd.tag === 'h3', 'driven: the title is the first child');
ok(body && body.style.cssText.indexOf('overflow-y:auto') !== -1, 'driven: the rows live in the scroller');
ok(body.children.length === 3, 'driven: all three choices are in the scroller');
ok(cancel && cancel.textContent === 'Cancel', 'driven: Cancel is its own child');
ok(modal.children.length === 3, 'driven: the panel holds the title, the scroller and Cancel - nothing else');

// ── driven: the grid ────────────────────────────────────────────────────────
vm.runInContext('var scShelfGrid = ' + grid.replace('function scShelfGrid', 'function'), ctx);
const drawn = vm.runInContext('scShelfGrid("al", [{name:"Never Filled",items:[]},{name:"Two",items:[{id:"s_1"},{id:"s_2"}]}])', ctx);
ok(count(drawn, 'data-name=') === 1, 'driven: one tile for the one album that holds songs');
ok(drawn.indexOf('2 songs') !== -1, 'driven: and it counts them');
ok(drawn.indexOf('Never Filled') === -1, 'driven: the empty album is not drawn');
ok(drawn.indexOf('-webkit-line-clamp:2') !== -1, 'driven: the name tile wraps');
const none = vm.runInContext('scShelfGrid("al", [{name:"x",items:[]}])', ctx);
ok(none.indexOf('No albums yet') !== -1, 'driven: a page of empty lists says there are no albums');

// ── every inline script still compiles ─────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc8010-'));
const scripts = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
  if (/\bsrc\s*=/.test(m[1])) continue;
  if (!m[2].trim()) continue;
  scripts.push(m[2]);
}
ok(scripts.length >= 5, 'the page carries its inline scripts (' + scripts.length + ')');
scripts.forEach((src, i) => {
  const f = path.join(tmp, 'script-' + i + '.js');
  fs.writeFileSync(f, src);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    ok(false, 'inline script ' + i + ' compiles: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' '));
  }
});
ok(true, 'all ' + scripts.length + ' inline scripts compile');

// ── both bundles ────────────────────────────────────────────────────────────
function zipEntry(zip, name) {
  return execFileSync('unzip', ['-p', zip, name], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
}
['ota', 'ota-play'].forEach((dir) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'updates.json'), 'utf8'));
  const zip = path.join(ROOT, dir, 'update.zip');
  ok(manifest.version === '80.10', dir + ': the bundle is 80.10');
  ok(manifest.size === fs.statSync(zip).size, dir + ': its recorded size is the zip');
  const inner = zipEntry(zip, 'index.html');
  ok(inner.includes("const APP_VERSION = '80.10';"), dir + ': the zip carries the 80.10 page');
  ok(inner.includes('scStreamDeviceAlbums'), dir + ': with the album chooser');
});

console.log('check-8010: ' + passed + ' passed, ' + failed.length + ' failed');
failed.forEach((f) => console.log('  x ' + f));
process.exit(failed.length ? 1 : 0);
