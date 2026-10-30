#!/usr/bin/env node
// 80.6.23 - streaming moves into the Library and the Albums, and the rail stops
// flickering.
//
//   node dev/check-80623.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }
function between(a, b) {
  const i = page.indexOf(a);
  if (i < 0) return '';
  const j = page.indexOf(b, i);
  return j < 0 ? page.slice(i) : page.slice(i, j);
}

ok(page.includes("const APP_VERSION = '80.6.23';"), 'the page runs 80.6.23');
ok(page.includes("version: '80.6.23'"), 'the changelog records 80.6.23');

/* -- one rail, two pages, one switch --------------------------------- */
const railCss = between("'#scShelfRail{display:none;height:0}'", "'#scShelfHead{");
ok(railCss.includes("'#scShelfRail .scshelf-sep{"), 'the rail has a divider above the switch');
ok(railCss.includes('s-on'), 'and the switch has a state of its own');
ok(page.includes("var scShelf = { page: 'library', src: 'd', open: false, built: false };"),
  'the shelf carries a page and a source');
const render = between('function scShelfRender(){', 'function scShelfMark(){');
ok(render.includes("rail.getAttribute('data-built') !== '1'"), 'the rail is built once');
ok(!render.includes("rail.innerHTML = tabs.map"), 'not rebuilt on every render');
ok(render.includes("var pages = [['library', 'Library', 'list'], ['albums', 'Albums', 'grid']];"),
  'two pages, and streaming is not one of them');
ok(render.includes('data-src="1"'), 'and one glyph switches the source');
ok(page.includes('function scShelfMark(){'), 'a mark moves from one glyph to the next');
const mark = between('function scShelfMark(){', 'function scShelfPage(');
ok(mark.includes("b.className = 'scshelf-tab' + (on ? ' on' : '');"), 'the page mark is a class');
ok(!mark.includes('rail.innerHTML'), 'and the rail is not rebuilt to move it');
ok(page.includes('function scShelfSetSrc(src){'), 'the switch has one entry point');
ok(page.includes("var want = (src === 's') ? 's' : 'd';"), 'with two sources');
ok(page.includes('function scShelfApply(){'), 'and one function paints a page');

/* -- a page is drawn once, not twice -------------------------------- */
const apply = between('function scShelfApply(){', 'function scShelfBoot(){');
ok(apply.includes("if(typeof navigate === 'function') navigate('library');"), 'navigate owns the device render');
ok(apply.includes("if(typeof navigate !== 'function'){"), 'the hand paint is the fallback');
ok(apply.includes("libraryMode = (page === 'albums') ? 'albums' : 'playlists';"), 'each page keeps its library mode');
const openTab = between('function scShelfOpenTab(tab){', 'function scShelfSetSrc(');
ok(!openTab.includes('renderList()'), 'opening a tab does not paint the list a second time');
ok(!openTab.includes('renderTabs()'), 'nor the tabs');
ok(openTab.includes('scShelfApply();'), 'it asks the one painter');
ok(openTab.includes("if(tab === 'streaming')"), 'the old name still lands on streaming');
ok(openTab.includes("scShelf.src === 'd' && !scShelf.open"), 'and a page already up is not redrawn');

/* -- the albums page is the albums page ---------------------------- */
const albums = between('function scShelfGrid(', 'function scStreamAddTo(');
ok(albums.includes("var isAl = (kind === 'al');"), 'a grid knows which kind it is');
ok(albums.includes('aspect-ratio:1/1'), 'a tile is square, like a cover');
ok(albums.includes("'scs-al' : 'scs-pl'"), 'an album tile opens its album');
ok(albums.includes("' song' + (items.length === 1 ? '' : 's')"), 'and says how many songs it holds');
ok(page.includes("h += scShelfGrid('al', scStreamAlbums());"), 'the albums page draws the streaming albums');
ok(page.includes("if(!open && scShelf.src === 's' && scShelf.page === 'albums'){"),
  'only when the switch says streaming and the page is Albums');
ok(page.includes('id="scStreamNewAl"'), 'New album is on that page');
ok(page.includes('id="scStreamAlLink"'), 'and the shelf points across to it');
ok(page.includes("on('scStreamAlLink', 'click', function(){ scShelf.page = 'albums'; scShelfApply(); });"),
  'which goes through the same painter');
ok(!page.includes("    row('Albums', 'al', scStreamAlbums());"), 'albums are not chips any more');

/* -- the plus asks both questions ---------------------------------- */
const addTo = between('function scStreamAddTo(', 'function scStreamPickList(');
ok(addTo.includes("'Add to a playlist\\u2026'"), 'the plus offers a playlist');
ok(addTo.includes("'Add to an album\\u2026'"), 'and an album');
ok(addTo.includes('scStreamSheet('), 'in the sheet the hold already uses');
const pick = between('function scStreamPickList(', 'function scStreamNewPlaylist(');
ok(pick.includes('(lists || []).forEach(function(p){'), 'the lists that exist are offered');
ok(pick.includes("(isAl ? 'New album' : 'New playlist')"), 'with a new one as the last choice');
ok(page.includes("b.addEventListener('click', function(){ scStreamAddTo(this.getAttribute('data-id')); });"),
  'the row plus opens it');
ok(!page.includes('scStreamToPlaylist(this.getAttribute'), 'no longer one prompt for a list');
ok(page.includes('title="Add to a playlist or an album"'), 'and the glyph says so on a long press');

/* -- driven: the tile grid ----------------------------------------- */
{
  const ctx = {
    String, Number, Array, Object, JSON, Math,
    escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    scIcon: (n) => '<svg data-i="' + n + '"></svg>',
    scStreamThumb: (t) => (t && t.thumb) || ''
  };
  vm.createContext(ctx);
  vm.runInContext(between('function scShelfGrid(', 'function scStreamAddTo('), ctx);
  const grid = vm.runInContext('scShelfGrid', ctx);
  const empty = grid('al', []);
  ok(empty.includes('No streaming albums yet'), 'an empty albums page says so');
  const one = grid('al', [
    { name: 'Late night', items: [{ id: 's_1', thumb: 'https://x/1.jpg' }, { id: 's_2', thumb: 'https://x/2.jpg' }] },
    { name: 'No art', items: [{ id: 's_3', thumb: '' }] }
  ]);
  ok((one.match(/class="scs-al"/g) || []).length === 2, 'one tile per album');
  ok(one.includes('https://x/1.jpg'), 'a tile shows the cover of its first song');
  ok(one.includes('2 songs') && one.includes('1 song'), 'and counts them, in the singular when it is one');
  ok(one.includes('data-name="Late night"'), 'a tile knows the album it opens');
  ok(one.includes('data-i="grid"'), 'an album with no cover gets the album glyph');
  const pls = grid('pl', [{ name: 'Mix', items: [] }]);
  ok(pls.includes('class="scs-pl"'), 'a playlist tile opens a playlist');
}

/* -- driven: the plus, and then the list it names ------------------- */
{
  const sheets = [];
  const said = [];
  let albums = [{ name: 'Road', items: [] }];
  const ctx = {
    String, Number, Array, Object, JSON, Math,
    escapeHtml: (s) => String(s == null ? '' : s),
    scStreamSheet: (title, actions) => sheets.push({ title, actions }),
    scStreamSay: (m) => said.push(String(m)),
    scStreamSave: () => {},
    scStreamRender: () => {},
    scStreamState: { playlists: [], albums: null, tracks: [] },
    scStreamAlbums: () => albums,
    scStreamToAlbum: (id) => said.push('new-album:' + id),
    scStreamToPlaylist: (id) => said.push('new-playlist:' + id)
  };
  vm.createContext(ctx);
  vm.runInContext(
    between('function scStreamPlItem(t){', '  function scStreamPlItems(p){') +
    between('function scStreamPlItems(p){', '  // Read: fill what the old shape never stored') +
    between('function scLibAdd(', '  function scLibRemove(') +
    between('function scStreamAddTo(', 'function scStreamNewPlaylist('), ctx);
  ctx.scStreamEntry = (id) => ({ kind: 's', id: String(id), title: 'Roll', artist: 'Diljit' });
  const A = vm.runInContext('({ scStreamAddTo, scStreamPickList })', ctx);

  A.scStreamAddTo('s_9');
  ok(sheets.length === 1 && sheets[0].title === 'Add to a list', 'the plus opens one sheet');
  ok(sheets[0].actions.length === 2, 'with two questions in it');
  ok(sheets[0].actions[0].label.includes('playlist') && sheets[0].actions[1].label.includes('album'),
    'a playlist first, an album second');

  sheets.length = 0;
  A.scStreamPickList('al', 's_9');
  const sheet = sheets[sheets.length - 1];
  ok(sheet.title === 'Add to an album', 'the album question asks about albums');
  ok(sheet.actions.length === 2 && sheet.actions[0].label === 'Road \u00b7 0 songs',
    'the albums that exist, counted');
  sheet.actions[0].run();
  ok(ctx.scStreamState.albums[0].items.length === 1, 'choosing one files the song in it');
  ok(ctx.scStreamState.albums[0].items[0].kind === 's', 'marked as a song from the source');
  ok(said.some((m) => m.includes('Road')), 'and says where it went');
  sheet.actions[1].run();
  ok(said.includes('new-album:s_9'), 'the last choice makes a new one');

  said.length = 0;
  A.scStreamPickList('pl', 's_9');
  ok(sheets[sheets.length - 1].title === 'Add to a playlist', 'a playlist asks about playlists');
  sheets[sheets.length - 1].actions[0].run();
  ok(said.includes('new-playlist:s_9'), 'and makes one when there are none yet');
  ctx.scStreamEntry = () => null;
  A.scStreamAddTo('gone');
  ok(said.includes('That song is not in Streaming any more'), 'a song that left says so');
}

if (bad.length) {
  console.log('check-80623: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80623: %d passed, 0 failed', pass);
