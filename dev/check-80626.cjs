#!/usr/bin/env node
// 80.6.26 - the streaming albums are a page, and a list is held to delete.
//
//   node dev/check-80626.cjs
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

/* -- a page glyph stays in the source that is on --------------------- */
const openTab = between('function scShelfOpenTab(', 'function scShelfSetSrc(');
ok(openTab.length > 0, 'the page glyph handler is in the page');
ok(!/scShelf\.src = 'd';/.test(openTab), 'a tap on Library or Albums no longer leaves the source');
ok(/scShelf\.page = page;/.test(openTab), 'it still sets the page the glyph names');
ok(/\(scShelf\.src === 's'\) \? \(scShelf\.open && !scStreamState\.pl\) : !scShelf\.open/.test(openTab),
  'a page already up in the current source is not drawn again');
ok(/tab === 'streaming'\)\{ scShelf\.page = 'library'; scShelf\.src = 's';/.test(openTab),
  'the streaming entry point still switches the source on');

// The truth table, run: the glyph keeps the source it was tapped in, and the page
// that is already up is only marked.
{
  const src = openTab;
  function make(state) {
    let applied = 0, marked = 0;
    const ctx = {
      SC_STREAM_OK: true,
      scShelf: Object.assign({ page: 'library', src: 's', open: true }, state),
      scStreamState: { pl: state.pl || '' },
      scShelfApply: () => { applied++; },
      scShelfMark: () => { marked++; }
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return { ctx, counts: () => ({ applied, marked }) };
  }
  let t = make({});
  t.ctx.scShelfOpenTab('albums');
  ok(t.ctx.scShelf.page === 'albums' && t.ctx.scShelf.src === 's',
    'on the source, Albums opens the streaming albums page (src stays s)');
  ok(t.counts().applied === 1, 'and the page is painted');

  t = make({ page: 'albums', src: 's', open: true });
  t.ctx.scShelfOpenTab('albums');
  ok(t.counts().applied === 0 && t.counts().marked === 1,
    'tapping the page that is already up only moves the mark');

  t = make({ page: 'albums', src: 's', open: true, pl: 'Rock' });
  t.ctx.scShelfOpenTab('albums');
  ok(t.counts().applied === 1, 'a list on that page still yields to the glyph');

  t = make({ page: 'library', src: 'd', open: false });
  t.ctx.scShelfOpenTab('albums');
  ok(t.ctx.scShelf.page === 'albums' && t.ctx.scShelf.src === 'd',
    'on the device, Albums opens the downloaded albums');
  ok(t.counts().applied === 1, 'and the device page is painted');
}

/* -- the streaming albums page says what it is ---------------------- */
const albumsPage = between("if(!open && scShelf.src === 's' && scShelf.page === 'albums'){", '// 80.6.13 - A PLAYLIST IS A PAGE.');
ok(albumsPage.length > 0, 'the streaming albums page still exists');
ok(/From the source/.test(albumsPage), 'it is labelled as coming from the source');
ok(/Hold an album for two seconds to delete it\./.test(albumsPage), 'and it says how an album goes away');

/* -- a list is held, and the hold deletes it ------------------------ */
ok(page.includes('function scStreamHoldList(els, kind){'), 'lists have a hold of their own');
ok(page.includes('function scStreamLibMenu(kind, name){'), 'and a popup of their own');
ok(page.includes('function scStreamLibDelete(kind, name){'), 'and one delete path');
const holdList = between('function scStreamHoldList(', 'function scStreamLibMenu(');
ok(/\}, 2000\);/.test(holdList), 'the hold is two seconds');
ok(/pointerdown/.test(holdList) && /pointercancel/.test(holdList) && /pointerleave/.test(holdList),
  'a finger that lifts or slides off cancels it');
ok(/\}, true\);/.test(holdList), 'the click after a hold is swallowed in the capture phase');
ok(/contextmenu/.test(holdList), 'and the browser menu does not open on top of it');
const libMenu = between('function scStreamLibMenu(', 'function scStreamLibDelete(');
ok(/scStreamSheet\(/.test(libMenu), 'the hold opens the app\'s own sheet');
ok(/danger: true/.test(libMenu) && /Delete this album/.test(libMenu) && /Delete this playlist/.test(libMenu),
  'the delete is the danger row, named for what it deletes');
const libDel = between('function scStreamLibDelete(', 'function scStreamMenu(');
ok(/if\(isAl\) scStreamState\.albums = rest; else scStreamState\.playlists = rest;/.test(libDel),
  'the delete writes the right list');
ok(/if\(String\(scStreamState\.pl \|\| ''\) === String\(name \|\| ''\)\) scStreamState\.pl = '';/.test(libDel),
  'a list that is up comes off the page with it');
ok(/scStreamSave\(\);/.test(libDel) && /scStreamRender\(\);/.test(libDel), 'and the change is stored and repainted');
ok(/toastWithUndo\(/.test(libDel), 'the delete offers the same undo as the rest of the app');
const wire = between('function scStreamWire(){', 'function scStreamBoot(){');
ok(/scStreamHoldList\(host\.querySelectorAll\('\.scs-al'\), 'al'\)/.test(wire), 'the album tiles take the hold');
ok(/scStreamHoldList\(host\.querySelectorAll\('\.scs-pl'\), 'pl'\)/.test(wire), 'and the playlist chips do too');

// The delete, run against a fake shelf: it removes the named list, leaves the others,
// closes the page it was showing, and puts it back where it was on undo.
{
  let undo = null;
  const state = {
    albums: [{ name: 'A', items: [1] }, { name: 'B', items: [] }],
    playlists: [{ name: 'P', items: [] }],
    pl: 'A'
  };
  let saved = 0, painted = 0;
  const ctx = {
    scStreamState: state,
    scStreamAlbums: () => state.albums,
    scStreamSave: () => { saved++; },
    scStreamRender: () => { painted++; },
    scStreamSay: () => {},
    toastWithUndo: (msg, fn) => { undo = fn; }
  };
  vm.createContext(ctx);
  vm.runInContext(libDel, ctx);
  const took = ctx.scStreamLibDelete('al', 'A');
  ok(took === true, 'deleting an album answers that it happened');
  ok(state.albums.length === 1 && state.albums[0].name === 'B', 'only the named album goes');
  ok(state.playlists.length === 1, 'the playlists are untouched');
  ok(state.pl === '', 'the page for it is closed');
  ok(saved === 1 && painted === 1, 'once stored, once painted');
  ok(typeof undo === 'function', 'an undo is offered');
  if (typeof undo === 'function') undo();
  ok(state.albums.length === 2 && state.albums[0].name === 'A',
    'undo puts it back in the place it was, not at the end');
  ok(ctx.scStreamLibDelete('al', 'nope') === false, 'a name that is not there deletes nothing');
  ok(ctx.scStreamLibDelete('pl', 'P') === true && state.playlists.length === 0,
    'the same path deletes a playlist');
}

/* -- the release is recorded --------------------------------------- */
ok(page.includes("const APP_VERSION = '80.6.26';"), 'the page runs 80.6.26');
const entryStart = page.indexOf("version: '80.6.26'");
ok(entryStart > 0, 'the changelog records 80.6.26');
const entry = page.slice(entryStart, page.indexOf('{ version:', entryStart + 10));
ok(/date: 'October \d{1,2}, 2026 \u00b7 \d{1,2}:\d{2} (AM|PM) EDT'/.test(entry), 'with its day and Eastern time');
ok(entry.includes('The streaming albums are a page'), 'and a title that says what it does');
const items = entry.match(/'\[FULL\][^']*'/g) || [];
ok(items.length === 4, 'four notes, every one tagged [FULL] (' + items.length + ' tagged)');
ok(!/80\.6\.2[456]/.test(items.join(' ')), 'no note names a build number');

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
  console.log('check-80626: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80626: %d passed, 0 failed', pass);
