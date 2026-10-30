#!/usr/bin/env node
// 80.6.22 - the bar is the bar, a row is held for two seconds, and a list holds
// both kinds of song.
//
//   node dev/check-80622.cjs
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

ok(page.includes("const APP_VERSION = '80.6.22';"), 'the page runs 80.6.22');
ok(page.includes("version: '80.6.22'"), 'the changelog records 80.6.22');

/* -- the bar is the bar --------------------------------------------- */
const barOn = between('function scStreamBarOn(t){', 'function scStreamBarOff(){');
ok(barOn.includes("who.textContent = String(t.artist || 'Streaming');"),
  'the bar writes the artist, the way the deck does');
ok(!barOn.includes('STREAM</span>'), 'with no pill of its own');
ok(!barOn.includes('scStreamMeta(t)'), 'and no length or genre on that line');
ok(!page.includes('body.sc-stream-now #nowPlaying{'), 'the bar draws no coral edge for a stream');
ok(!page.includes('body.sc-stream-now #npDisc{'), 'and the disc draws no glow for one');

/* -- no x, a two second hold --------------------------------------- */
ok(!page.includes('class="scs-del"'), 'no close glyph on a shelf row');
ok(!page.includes('class="scsp-del"'), 'no close glyph on a list row');
ok(!page.includes("querySelectorAll('.scs-del')"), 'and nothing is wired to one');
ok(!page.includes("querySelectorAll('.scsp-del')"), 'in either place');
ok(page.includes('}, 2000);'), 'the hold is two seconds');
ok(page.includes("scStreamHold(host.querySelectorAll('.scs-row'), 'shelf');"), 'a shelf row is held');
ok(page.includes("scStreamHold(host.querySelectorAll('.scsp-row'), 'list');"), 'a list row is held');
ok(page.includes("scStreamMenu(row.getAttribute('data-hold'), where);"), 'the hold opens that row');
const menu = between('function scStreamMenu(', 'function scStreamToAlbum(');
ok(menu.includes("label: 'Delete this song'"), 'the popup can delete the song');
ok(menu.includes('Add to a playlist'), 'and file it in a playlist');
ok(menu.includes('Add to an album'), 'and in an album');

/* -- albums, and lists that hold both ------------------------------ */
ok(page.includes('id="scStreamNewAl"'), 'the shelf offers a new album');
ok(page.includes('function scStreamNewAlbum(){'), 'and there is a maker for it');
ok(page.includes("dbGet('meta', 'streamAlbums')"), 'the albums are read back');
ok(page.includes("key: 'streamAlbums'"), 'and written down');
ok(page.includes("row('Albums', 'al', scStreamAlbums());"), 'the albums are listed beside the playlists');
ok(page.includes("if(scStreamState.plKind === 'al')"), 'a list knows which kind it is');
ok(page.includes("String(t.kind || 's') === 'd'"), 'a file and a stream are told apart');
ok(page.includes('ON DEVICE'), 'and the row says which one it is');
ok(page.includes('scMixPlay(items, id);'), 'a list plays through the mix');
ok(page.includes("if(typeof scMix !== 'undefined' && scMix.active && scMixAdvance(dir)) return;"),
  'the stream hands an advance to the list');
ok(page.includes('String(pendingPlayId) === String(scMix.lastFile)'),
  'and so does the deck, at the end of its run');

/* -- driven: the lists --------------------------------------------- */
const libCode = between('function scStreamPlItem(t){', '// --- storage');
{
  const ctx = {
    String, Number, Array, Object, Math, isFinite, JSON, Promise,
    escapeHtml: (s) => String(s == null ? '' : s),
    window: {},
    scStreamPlay: () => {},
    playFromList: () => {},
    scStreamQuiet: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }), body: { appendChild() {} } },
    scStreamState: { tracks: [], playlists: [], albums: [], pl: '', plKind: 'pl', curId: '', playing: false }
  };
  ctx.scStreamById = (id) => (ctx.scStreamState.tracks || []).find((t) => String(t.id) === String(id)) || null;
  vm.createContext(ctx);
  vm.runInContext(libCode, ctx);
  const P = vm.runInContext('({ scLibAdd, scLibRemove, scStreamPlItems, scStreamRestore, scStreamListOpen, scStreamAlbums })', ctx);

  const streamed = { id: 's_abc', videoId: 'abc', title: 'Roll', artist: 'Diljit', dur: 200 };
  const file = { kind: 'd', id: 't_9', title: 'Local', artist: 'Me', duration: 180 };
  let list = P.scLibAdd([], 'Late night', streamed);
  ok(list.length === 1 && list[0].items.length === 1, 'an album/playlist is made with its first song');
  ok(list[0].items[0].kind === 's', 'a song from the source is marked as one');
  list = P.scLibAdd(list, 'Late night', file);
  ok(list[0].items.length === 2 && list[0].items[1].kind === 'd',
    'a file from the device joins the same list, marked as one');
  const again = P.scLibAdd(list, 'Late night', file);
  ok(again[0].items.length === 2, 'adding it twice is still one song');
  const afterDrop = P.scLibRemove(list, 'Late night', 's_abc');
  ok(afterDrop[0].items.length === 1 && afterDrop[0].items[0].kind === 'd',
    'removing one leaves the other kind in place');

  const restored = P.scStreamRestore([], [{ name: 'X', items: [
    { id: 's_gone', videoId: '', title: 'gone' },
    { kind: 'd', id: 't_1', title: 'kept' }
  ] }]);
  ok(restored.length === 1 && restored[0].items.length === 1 && restored[0].items[0].kind === 'd',
    'a file survives a load; a stream nobody can resolve is dropped');

  ctx.scStreamState.playlists = list;
  ctx.scStreamState.pl = 'Late night';
  ok(P.scStreamListOpen() && P.scStreamListOpen().items.length === 2, 'the open list is the one asked for');
  ctx.scStreamState.albums = [{ name: 'A', items: [] }];
  ctx.scStreamState.plKind = 'al';
  ctx.scStreamState.pl = 'A';
  ok(P.scStreamListOpen() && P.scStreamListOpen().name === 'A', 'and an album opens the same way');
  ctx.scStreamState.pl = 'nope';
  ok(P.scStreamListOpen() === null, 'a name nobody holds opens nothing');
}

/* -- driven: the order across both players ------------------------- */
{
  const played = [];
  const ctx = {
    String, Number, Array, Object, Math, isFinite, JSON, Promise,
    escapeHtml: (s) => String(s == null ? '' : s),
    window: {},
    scStreamState: { tracks: [
      { id: 's_1', videoId: 'v1', title: 'one' },
      { id: 's_2', videoId: 'v2', title: 'two' }
    ] },
    scStreamById: (id) => [{ id: 's_1' }, { id: 's_2' }].find((t) => String(t.id) === String(id)) || null,
    scStreamPlay: (id, q) => played.push('stream:' + id + ':' + (q || []).join('|')),
    playFromList: (ids, id) => played.push('deck:' + id + ':' + ids.join('|')),
    scStreamQuiet: () => played.push('quiet')
  };
  vm.createContext(ctx);
  vm.runInContext(between('var scMix = {', '// --- storage'), ctx);
  const S = vm.runInContext('({ scMixPlay, scMixAdvance, scMixStop, state: window.__scMixState })', ctx);

  S.scMixPlay([
    { kind: 's', id: 's_1' },
    { kind: 'd', id: 't_a' },
    { kind: 'd', id: 't_b' },
    { kind: 's', id: 's_2' }
  ], 's_1');
  ok(played[0] === 'stream:s_1:s_1', 'a streamed entry plays on the stream');
  played.length = 0;
  S.scMixAdvance(1);
  ok(played[0] === 'quiet', 'crossing to a file puts the stream down first');
  ok(played[1] === 'deck:t_a:t_a|t_b', 'the deck gets the whole run of files, in order');
  ok(S.state().lastFile === 't_b', 'and the list remembers the last file of the run');
  played.length = 0;
  S.scMixAdvance(1);
  ok(played[1] === 'deck:t_b:t_a|t_b', 'the next file in the run plays on the deck');
  played.length = 0;
  S.scMixAdvance(1);
  ok(played[0] === 'stream:s_2:s_2', 'the end of the run crosses back to the stream');
  played.length = 0;
  const more = S.scMixAdvance(1);
  ok(more === true && S.state().active === false, 'the end of the list ends the list');
  ok(played.length === 0, 'and starts nothing else');

  played.length = 0;
  S.scMixPlay([{ kind: 's', id: 's_1' }, { kind: 's', id: 's_gone' }, { kind: 'd', id: 't_a' }], 's_gone');
  ok(played.length === 2 && played[1] === 'deck:t_a:t_a',
    'a streamed entry that left the shelf is skipped, not played');
}

/* -- driven: the hold ---------------------------------------------- */
{
  const timers = [];
  const menus = [];
  const rows = [];
  const ctx = {
    String, Number, Array, Object, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {}, scStreamMenu: (id, where) => menus.push(where + ':' + id)
  };
  vm.createContext(ctx);
  vm.runInContext(between('function scStreamHold(rows, where){', 'function scStreamMenu('), ctx);
  function row(id) {
    const h = {};
    return {
      getAttribute: () => id,
      addEventListener: (ev, fn) => { h[ev] = fn; },
      fire: (ev, arg) => h[ev] && h[ev](arg)
    };
  }
  const a = row('s_1');
  rows.push(a);
  vm.runInContext('scStreamHold', ctx)(rows, 'shelf');
  a.fire('pointerdown');
  ok(timers.length === 1 && timers[0].ms === 2000, 'a press starts one two-second timer');
  timers[0].fn();
  ok(menus[0] === 'shelf:s_1', 'and it opens that row');
  a.fire('click', { preventDefault() {}, stopPropagation() {} });
  ok(menus.length === 1, 'the tap that follows a hold opens nothing else');
}

if (bad.length) {
  console.log('check-80622: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80622: %d passed, 0 failed', pass);
