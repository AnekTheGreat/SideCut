#!/usr/bin/env node
// 80.6.27 - the record player takes you to the song that is playing.
//
//   node dev/check-80627.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }
function between(from, to) {
  const a = page.indexOf(from);
  const b = page.indexOf(to, a + from.length);
  return (a < 0 || b < 0) ? '' : page.slice(a, b);
}

/* -- the tap asks the stream before the downloaded deck -------------- */
const albumTap = between('function openAlbumForCurrentSong(){', 'window.__scOpenAlbumForCurrentSong');
ok(albumTap.length > 0, 'the record tap is in the page');
const guard = albumTap.indexOf('scStreamPhoneOwns()');
const deck = albumTap.indexOf('queue[queueIndex]');
const find = albumTap.indexOf('allTracks.find');
ok(guard > 0, 'the tap consults the stream');
ok(deck > guard && find > guard, 'and does so before the downloaded queue is read');
ok(/scStreamPhoneOwns\(\) && scStreamJumpToPlaying\(\)\) return;/.test(albumTap),
  'a stream that took the tap returns before the album resolution');
ok(albumTap.indexOf('let tid = null;') > guard, 'the deck variables are only reached after it');

/* -- where the streaming song lives --------------------------------- */
const playingList = between('function scStreamPlayingList(', 'function scStreamJumpToPlaying(');
const jump = between('function scStreamJumpToPlaying(', 'function scStreamOpenList(');
ok(playingList.length > 0, 'the playing list resolver exists');
ok(jump.length > 0, 'and the jump exists');

function listCtx(state) {
  const ctx = {
    scStreamState: state,
    scStreamAlbums: () => state.albums || [],
    scStreamListOpen: () => {
      const kind = state.plKind === 'al' ? 'al' : 'pl';
      const list = kind === 'al' ? (state.albums || []) : (state.playlists || []);
      return list.filter((p) => String(p.name) === String(state.pl))[0] || null;
    }
  };
  vm.createContext(ctx);
  vm.runInContext(playingList, ctx);
  return ctx;
}
{
  let c = listCtx({
    albums: [{ name: 'A', items: [{ id: 's_1' }] }, { name: 'B', items: [{ id: 's_2' }] }],
    playlists: [{ name: 'P', items: [{ id: 's_1' }] }],
    pl: 'P', plKind: 'pl'
  });
  ok(JSON.stringify(c.scStreamPlayingList('s_1')) === JSON.stringify({ kind: 'pl', name: 'P' }),
    'the list already on screen wins, even when an album also holds the song');

  c = listCtx({
    albums: [{ name: 'A', items: [{ id: 's_1' }] }],
    playlists: [{ name: 'P', items: [{ id: 's_1' }] }],
    pl: '', plKind: 'pl'
  });
  ok(JSON.stringify(c.scStreamPlayingList('s_1')) === JSON.stringify({ kind: 'al', name: 'A' }),
    'with nothing open, the album is tried first');

  c = listCtx({ albums: [], playlists: [{ name: 'P', items: [{ id: 's_1' }] }], pl: '', plKind: 'pl' });
  ok(JSON.stringify(c.scStreamPlayingList('s_1')) === JSON.stringify({ kind: 'pl', name: 'P' }),
    'then the playlists');

  c = listCtx({ albums: [{ name: 'A', items: [{ id: 's_9' }] }], playlists: [], pl: 'A', plKind: 'al' });
  ok(c.scStreamPlayingList('s_1') === null, 'a song in no list resolves to nothing');
  ok(c.scStreamPlayingList('') === null, 'and no song at all resolves to nothing');

  // ids arrive as strings from the DOM and as whatever the store kept: both match.
  c = listCtx({ albums: [{ name: 'A', items: [{ id: 42 }] }], playlists: [], pl: '', plKind: 'pl' });
  ok(JSON.stringify(c.scStreamPlayingList('42')) === JSON.stringify({ kind: 'al', name: 'A' }),
    'a numeric id in the store still matches the string from the row');
}

/* -- the jump, run against a fake shelf ----------------------------- */
function jumpCtx(opts) {
  const timers = [];
  const calls = { apply: 0, open: [], render: 0, scroll: 0 };
  const rows = (opts.rows || []).map((id) => {
    const style = {};
    const row = {
      style,
      getAttribute: (n) => (n === 'data-hold' ? id : null),
      getBoundingClientRect: () => ({ top: 100, height: 40 })
    };
    return row;
  });
  const host = {
    scrollTop: 0, scrollHeight: 900, clientHeight: 300,
    querySelectorAll: () => rows,
    getBoundingClientRect: () => ({ top: 0, height: 300 })
  };
  const ctx = {
    SC_STREAM_OK: true,
    scStreamState: Object.assign({ curId: 's_1' }, opts.state || {}),
    scShelf: Object.assign({ open: true, src: 's', page: 'library' }, opts.shelf || {}),
    scStreamPhoneOwns: () => (opts.owns === undefined ? true : opts.owns),
    scStreamAlbums: () => ctx.scStreamState.albums || [],
    scStreamListOpen: () => {
      const kind = ctx.scStreamState.plKind === 'al' ? 'al' : 'pl';
      const list = kind === 'al' ? (ctx.scStreamState.albums || []) : (ctx.scStreamState.playlists || []);
      return list.filter((p) => String(p.name) === String(ctx.scStreamState.pl))[0] || null;
    },
    scShelfApply: () => { calls.apply++; },
    scStreamOpenList: (kind, name) => { calls.open.push(kind + ':' + name); },
    scStreamRender: () => { calls.render++; },
    document: { getElementById: (id) => (id === 'scStreamBlock' ? (opts.noHost ? null : host) : null) },
    smoothScrollIn: () => { calls.scroll++; },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); }
  };
  vm.createContext(ctx);
  vm.runInContext(playingList, ctx);
  vm.runInContext(jump, ctx);
  return { ctx, calls, rows, host, timers, run: () => timers.splice(0).forEach((t) => t.fn()) };
}
{
  const j = jumpCtx({
    state: { pl: 'A', plKind: 'al', albums: [{ name: 'A', items: [{ id: 's_1' }] }], playlists: [] },
    rows: ['s_9', 's_1']
  });
  ok(j.ctx.scStreamJumpToPlaying() === true, 'the jump takes the tap');
  ok(j.calls.open.join(',') === 'al:A', 'it opens the album the song is in');
  ok(j.calls.apply === 0, 'a shelf already showing that page is not repainted');
  j.run();                                   // the seek
  ok(j.calls.scroll === 1, 'it scrolls to the row inside the shelf');
  ok(/coral/.test(String(j.rows[1].style.background || '')), 'and lights that row');
  ok(!j.rows[0].style.background, 'not the row above it');
  j.run();                                   // the unlight
  ok(j.rows[1].style.background === '' && j.rows[1].style.boxShadow === '',
    'the light is taken off again');
}
{
  const j = jumpCtx({
    shelf: { open: false, src: 'd', page: 'library' },
    state: { pl: 'A', plKind: 'al', albums: [{ name: 'A', items: [{ id: 's_1' }] }], playlists: [] },
    rows: ['s_1']
  });
  ok(j.ctx.scStreamJumpToPlaying() === true, 'from the downloaded side the jump still takes the tap');
  ok(j.ctx.scShelf.src === 's' && j.ctx.scShelf.page === 'library', 'and puts the source on');
  ok(j.calls.apply === 1, 'repainting the shelf once');
  ok(j.calls.open.join(',') === 'al:A', 'then opens the list');
}
{
  const j = jumpCtx({ state: { pl: '', albums: [], playlists: [] }, rows: ['s_1'] });
  ok(j.ctx.scStreamJumpToPlaying() === true, 'a song in no list still takes the tap');
  ok(j.calls.open.length === 0, 'nothing is opened for it');
  ok(j.calls.render === 1, 'the shelf is drawn instead, where the playing song is');
  j.run();
  ok(j.calls.scroll === 1, 'and a shelf row for it is still scrolled to');
}
{
  const rowsSeen = jumpCtx({ state: { pl: '', albums: [], playlists: [] }, rows: [] });
  ok(rowsSeen.ctx.scStreamJumpToPlaying() === true, 'a shelf with no row for it answers the tap');
  rowsSeen.run();
  ok(rowsSeen.calls.scroll === 0, 'and scrolls nothing, without throwing');
}
{
  const j = jumpCtx({ owns: false, state: { pl: '', albums: [], playlists: [] }, rows: ['s_1'] });
  ok(j.ctx.scStreamJumpToPlaying() === false, 'when the stream does not own the bar it does not take the tap');
  ok(j.calls.apply === 0 && j.calls.render === 0, 'and the shelf is left alone');
}
{
  const j = jumpCtx({ state: { curId: '' } });
  ok(j.ctx.scStreamJumpToPlaying() === false, 'with no streaming song it does not take the tap');
}
{
  const j = jumpCtx({ noHost: true, state: { pl: '', albums: [], playlists: [] } });
  ok(j.ctx.scStreamJumpToPlaying() === true, 'a page without the shelf block answers the tap');
  j.run();
  ok(j.calls.scroll === 0, 'and does not throw');
}

/* -- the release is recorded --------------------------------------- */
ok(page.includes("const APP_VERSION = '80.6.27';"), 'the page runs 80.6.27');
const entryStart = page.indexOf("version: '80.6.27'");
ok(entryStart > 0, 'the changelog records 80.6.27');
const entry = page.slice(entryStart, page.indexOf('{ version:', entryStart + 10));
ok(/date: 'October \d{1,2}, 2026 \u00b7 \d{1,2}:\d{2} (AM|PM) EDT'/.test(entry), 'with its day and Eastern time');
ok(entry.includes('The record player takes you to the song that is playing'), 'and a title that says what it does');
const items = entry.match(/'\[FULL\][^']*'/g) || [];
ok(items.length === 4, 'four notes, every one tagged [FULL] (' + items.length + ' tagged)');
ok(!/80\.6\.2[4-7]/.test(items.join(' ')), 'no note names a build number');

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
  console.log('check-80627: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80627: %d passed, 0 failed', pass);
