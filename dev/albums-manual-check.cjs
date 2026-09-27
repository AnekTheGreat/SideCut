// "Fix the damn auto albums I hate those because I make an album and it says it
// already exists just remove the auto albums and make sure that doesn't affect my
// regular albums." The panel behind the report read "25 albums · 227 not created
// by you" — so the library is polluted exactly the way older builds polluted it,
// and this file proves what 63.1.4 does with it:
//
//   1. An entry the app created for itself (an old card-drag auto-save, or a tag
//      album materialised so a reorder had somewhere to live) is DELETED at boot,
//      not flagged and hidden. The name it had taken is free again — which is what
//      made "Create album" answer "an album named X already exists" and then file
//      the songs into an album that never appeared.
//   2. Albums you made are untouched: same songs, same order, same artist, same
//      entry. That includes an entry that predates the flag entirely and carries no
//      marker at all — a "no marker means not yours" rule is what once emptied a
//      library of twelve hand-made albums down to one card, so it is not applied.
//   3. Nothing else moves: every song stays in the library, every album tag stays
//      on its file, and playlists are byte-for-byte unchanged. An auto album was
//      only ever a copy of a tag that is still there.
//   4. Manage albums lists the albums you have and searches them: match count,
//      hidden non-matches, an honest empty state, a clear button, and the query
//      kept across the re-render a rename causes.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 64, height: 64 };
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 210 },
  { id: 't5', name: 'Legend', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 190 },
];
// What the store looks like on a phone that lived through the old auto-save:
//   • 'MoonChild Era' / 'G.O.A.T' — every track with that tag, in tag order, and
//     wearing the flag the app put on the entries it wrote for itself: auto.
//   • 'My Mix' — songs from TWO different tags, gathered by hand: keep.
//   • 'DJ Set' — two songs of one tag in MY order: keep.
//   • 'Pre Flag' — an entry that predates the flag and has no marker at all: keep.
const ALBUMS_POLLUTED = {
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, auto: true },
  'G.O.A.T': { artist: 'Sidhu Moose Wala', trackIds: ['t4', 't5'], createdAt: 12, auto: true },
  'My Mix': { artist: 'Various Artists', trackIds: ['t1', 't4'], createdAt: 13, manual: true },
  'DJ Set': { artist: 'Diljit Dosanjh', trackIds: ['t3', 't2'], createdAt: 14, manual: true },
  'Pre Flag': { artist: 'Sidhu Moose Wala', trackIds: ['t5'], createdAt: 10 },
};
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], 'Moon Faves': ['t1', 't4'] };
const ALBUM_ORDER_START = ['MoonChild Era', 'G.O.A.T', 'My Mix', 'DJ Set', 'Pre Flag'];
const KEPT = ['My Mix', 'DJ Set', 'Pre Flag'];
// What an album IS: its songs and its artist. The bookkeeping fields are compared
// separately, because those are the app's, not the album's.
function contentOf(a) {
  const out = {};
  Object.keys(a || {}).sort().forEach((k) => {
    const e = a[k] || {};
    out[k] = { artist: e.artist, trackIds: e.trackIds };
  });
  return out;
}

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_POLLUTED)) }],
      ['albumOrder', { key: 'albumOrder', value: ALBUM_ORDER_START.slice() }],
    ]),
  };
  function tx(store) {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
    });
    return t;
  }
  return {
    _data: data,
    open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
  };
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

const idb = fakeIndexedDB();
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    win.indexedDB = idb;
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

const storedAlbums = () => { const m = idb._data.meta.get('userAlbums'); return m ? m.value : undefined; };
const storedOrder = () => { const m = idb._data.meta.get('albumOrder'); return m ? m.value : undefined; };
const storedPlaylists = () => { const m = idb._data.meta.get('playlists'); return m ? m.value : undefined; };
const ourPlaylists = () => { const p = storedPlaylists() || {}; return { 'All Songs': p['All Songs'], Favorites: p['Favorites'], 'Moon Faves': p['Moon Faves'] }; };
const tags = () => { const out = {}; idb._data.tracks.forEach((t, id) => { out[id] = t.album; }); return out; };
const cardEls = (win) => Array.from(win.document.querySelectorAll('#listPane [data-album-name]'));
const cardNames = (win) => cardEls(win).map((c) => c.dataset.albumName);
const paneHeader = (win) => {
  const h = win.document.querySelector('#listPane .pane-header');
  return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
};
const mgrRows = (win) => Array.from(win.document.querySelectorAll('#discPopupBody .mgr-alb-row'));
const visibleRows = (win) => mgrRows(win).filter((r) => r.style.display !== 'none');
const q = (win, sel) => win.document.querySelector(sel);

// Open Albums tab ⋮ → Manage albums, the same way a user does.
async function openManage(win) {
  win.navigate('albums');
  await wait(700);
  win.document.getElementById('listMoreBtn').click();
  await wait(350);
  const manage = Array.from(win.document.querySelectorAll('#songActionsList button')).find((b) => /Manage albums/.test(b.textContent));
  if (!manage) return false;
  manage.click();
  await wait(600);
  return true;
}
function closeManage(win) {
  const cancel = win.document.getElementById('songActionsCancel');
  if (cancel) cancel.click();
}
function type(win, text) {
  const input = q(win, '#mgrAlbumSearch');
  if (!input) return false;
  input.value = text;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  return true;
}
// Drive the real rename dialog (it is closure-local, so the DOM is the only honest
// way in). The row is found by the album name, the way a user reads it.
async function rename(win, currentName, newName, newArtist) {
  const row = mgrRows(win).find((r) => (r.getAttribute('data-name') || '') === currentName.toLowerCase());
  if (!row) return 'no-row';
  const btn = row.querySelector('.mgr-alb-rename');
  if (!btn) return 'no-button';
  btn.click();
  await wait(350);
  const input = win.document.getElementById('_albRenameName');
  const artistInput = win.document.getElementById('_albRenameArtist');
  if (!input || !artistInput) return 'no-prompt';
  input.value = newName;
  if (newArtist !== undefined) artistInput.value = newArtist;
  win.document.getElementById('_albRenameOk').click();
  await wait(800);
  return 'ok';
}

(async () => {
  const win = dom.window;
  // The boot notice about the removed albums goes off on a 3 s timer, and the app's
  // own toast() is an IIFE local, so it cannot be wrapped from here — the toast
  // ELEMENT is watched instead, which is what the user reads.
  let removalToast = '';
  const watchToast = setInterval(() => {
    const el = win.document.getElementById('toast');
    if (el && /were removed/.test(el.textContent || '')) removalToast = String(el.textContent);
  }, 100);
  await wait(7000);
  clearInterval(watchToast);

  console.log('\n— the albums the app added for you are deleted, not hidden —');
  const after = storedAlbums() || {};
  ok('the flagged entries are gone from the store',
     eq(Object.keys(after), KEPT), JSON.stringify(Object.keys(after)));
  ok('and they are gone as entries, not flagged and hidden',
     !after['MoonChild Era'] && !after['G.O.A.T'], JSON.stringify(Object.keys(after)));
  ok('the album order drops their names too',
     eq(storedOrder(), KEPT), JSON.stringify(storedOrder()));
  ok('the boot says what it did', /^2 albums .*were removed/.test(removalToast) && /untouched/.test(removalToast),
     JSON.stringify(removalToast));

  console.log('\n— every album you made is untouched —');
  const keptStart = {};
  KEPT.forEach((k) => { keptStart[k] = ALBUMS_POLLUTED[k]; });
  ok('the albums you made are exactly as they were', eq(contentOf(after), contentOf(keptStart)),
     JSON.stringify(contentOf(after)));
  ok('the flags on them were not touched either',
     after['My Mix'] && after['My Mix'].manual === true && after['DJ Set'] && after['DJ Set'].manual === true,
     JSON.stringify([after['My Mix'], after['DJ Set']]));
  ok('an entry that predates the flag keeps no marker and keeps its songs',
     after['Pre Flag'] && !after['Pre Flag'].auto && !after['Pre Flag'].manual &&
     eq(after['Pre Flag'].trackIds, ['t5']), JSON.stringify(after['Pre Flag']));
  ok('the album you ordered by hand keeps your order',
     eq(after['DJ Set'].trackIds, ['t3', 't2']), JSON.stringify(after['DJ Set'].trackIds));
  ok('every album tag on every file is unchanged',
     eq(tags(), { t1: 'MoonChild Era', t2: 'MoonChild Era', t3: 'MoonChild Era', t4: 'G.O.A.T', t5: 'G.O.A.T' }),
     JSON.stringify(tags()));

  console.log('\n— nothing else moved —');
  ok('playlists are byte-for-byte unchanged', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  win.navigate('playlists');
  await wait(600);
  const rows = Array.from(win.document.querySelectorAll('#listPane .track')).map((r) => r.dataset.id);
  ok('every song is still in the library', eq(rows.slice().sort(), ['t1', 't2', 't3', 't4', 't5']), JSON.stringify(rows));

  console.log('\n— the Albums tab shows your albums, and only yours —');
  win.navigate('albums');
  await wait(900);
  const names = cardNames(win);
  ok('the albums the app added are not there at all',
     names.indexOf('MoonChild Era') === -1 && names.indexOf('G.O.A.T') === -1, JSON.stringify(names));
  ok('the albums you made are all there, and nothing else is',
     eq(names.slice().sort(), ['DJ Set', 'My Mix', 'Pre Flag']), JSON.stringify(names));
  ok('the header counts only your albums', /\b5 tracks\b/.test(paneHeader(win)), paneHeader(win));

  console.log('\n— the removal is a settled state, not a nightly chore —');
  ok('the removal hook exists', typeof win.__scRemoveAutoAlbums === 'function');
  ok('nothing is left flagged', (typeof win.__scAutoAlbumNames === 'function' ? win.__scAutoAlbumNames() : ['?']).length === 0,
     JSON.stringify(typeof win.__scAutoAlbumNames === 'function' ? win.__scAutoAlbumNames() : null));
  ok('running it again finds nothing to remove', win.__scRemoveAutoAlbums() === 0);

  console.log('\n— Manage albums now searches —');
  ok('Manage albums opens', await openManage(win));
  ok('one row per album you have', mgrRows(win).length === 3 && visibleRows(win).length === 3,
     'rows=' + mgrRows(win).length + ' visible=' + visibleRows(win).length);
  ok('no "not created by you" controls survive',
     !q(win, '.mgr-alb-restore') && !q(win, '.mgr-alb-rename-auto') && !q(win, '.mgr-alb-del-auto'));
  ok('the panel carries a search box', !!q(win, '#mgrAlbumSearch') && !!q(win, '#mgrAlbumSearchClear'));
  ok('the count line is hidden until you search', q(win, '#mgrAlbumCount').style.display === 'none',
     q(win, '#mgrAlbumCount').style.display);

  ok('typing narrows the list', type(win, 'dj') && visibleRows(win).length === 1,
     'visible=' + visibleRows(win).length + ' [' + visibleRows(win).map((r) => r.getAttribute('data-name')).join(',') + ']');
  ok('and says how many still match',
     q(win, '#mgrAlbumCount').textContent === '1 of 3 albums' && q(win, '#mgrAlbumCount').style.display === 'block',
     q(win, '#mgrAlbumCount').textContent);
  ok('the matching row is the one asked for',
     visibleRows(win)[0] && visibleRows(win)[0].getAttribute('data-name') === 'dj set',
     visibleRows(win)[0] ? visibleRows(win)[0].getAttribute('data-name') : 'none');

  ok('an artist matches too', type(win, 'moose') && visibleRows(win).length === 1 &&
     visibleRows(win)[0].getAttribute('data-name') === 'pre flag',
     visibleRows(win).map((r) => r.getAttribute('data-name')).join(','));

  ok('a search with no match hides every row', type(win, 'zzz') && visibleRows(win).length === 0,
     'visible=' + visibleRows(win).length);
  ok('and says so instead of showing an empty list',
     q(win, '#mgrAlbumNoMatch').style.display === 'block' && q(win, '#mgrAlbumCount').textContent === '0 of 3 albums',
     q(win, '#mgrAlbumNoMatch').style.display + ' / ' + q(win, '#mgrAlbumCount').textContent);

  q(win, '#mgrAlbumSearchClear').click();
  await wait(150);
  ok('the clear button puts them all back',
     visibleRows(win).length === 3 && q(win, '#mgrAlbumSearch').value === '' &&
     q(win, '#mgrAlbumNoMatch').style.display === 'none' && q(win, '#mgrAlbumCount').style.display === 'none',
     'visible=' + visibleRows(win).length + ' value=' + JSON.stringify(q(win, '#mgrAlbumSearch').value));

  // The panel is re-rendered in place after a rename, so a query has to survive
  // that: losing what you typed half-way through would be worse than not searching.
  console.log('\n— the search survives the panel rebuilding itself —');
  type(win, 'flag');
  await wait(120);
  ok('the search is narrowed before the rename', visibleRows(win).length === 1 &&
     visibleRows(win)[0].getAttribute('data-name') === 'pre flag', 'visible=' + visibleRows(win).length);
  ok('a rename can still be driven from the list',
     await rename(win, 'Pre Flag', 'Pre Flag Hits') === 'ok', JSON.stringify(storedAlbums() && Object.keys(storedAlbums())));
  ok('the album itself was renamed', !!storedAlbums()['Pre Flag Hits'], JSON.stringify(Object.keys(storedAlbums())));
  ok('the rebuilt list is still narrowed', visibleRows(win).length === 1,
     'visible=' + visibleRows(win).length + ' [' + visibleRows(win).map((r) => r.getAttribute('data-name')).join(',') + ']');
  ok('and the query is still in the box', q(win, '#mgrAlbumSearch').value === 'flag',
     JSON.stringify(q(win, '#mgrAlbumSearch').value));
  ok('with the count still honest about the new name',
     q(win, '#mgrAlbumCount').textContent === '1 of 3 albums', q(win, '#mgrAlbumCount').textContent);
  // Closing and reopening is a fresh start, not the same session: the panel must
  // come back unfiltered rather than holding a search the user has walked away from.
  closeManage(win);
  await wait(300);
  await openManage(win);
  ok('a fresh open starts with all albums and no query',
     visibleRows(win).length === 3 && q(win, '#mgrAlbumSearch').value === '',
     'visible=' + visibleRows(win).length + ' value=' + JSON.stringify(q(win, '#mgrAlbumSearch').value));

  console.log('\n— the songs are all where they were —');
  const finalAlbums = storedAlbums() || {};
  ok('the three albums you made are the three that are left',
     eq(Object.keys(finalAlbums).sort(), ['DJ Set', 'My Mix', 'Pre Flag Hits']), JSON.stringify(Object.keys(finalAlbums)));
  ok('the songs the removed entries carried are still in the library',
     eq(Object.keys(tags()).sort(), ['t1', 't2', 't3', 't4', 't5']), JSON.stringify(Object.keys(tags())));
  ok('playlists are still byte-for-byte unchanged', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  const real = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
