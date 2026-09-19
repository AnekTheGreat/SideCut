// "There are random auto albums in Albums that I didn't put there — it should be
// manually only." This is the reported state: entries that got into userAlbums as a
// side effect (an old card-drag auto-save, a tag album materialised so a reorder had
// somewhere to live). The suite boots a library that is polluted exactly that way and
// proves:
//   1. An entry that is nothing but a copy of a file-tag group is flagged and kept
//      out of the Albums tab (cards AND header count).
//   2. Albums you actually made — songs gathered across tags, or in your own order —
//      are left alone.
//   3. Nothing is DELETED: every entry survives, every song stays in the library, and
//      playlists are byte-for-byte unchanged.
//   4. "It is mine" puts a hidden album back (markAlbumManual).
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
//   • 'MoonChild Era' — every track with that tag, in tag order, nothing added: auto.
//   • 'G.O.A.T' — same shape: auto.
//   • 'My Mix' — songs from TWO different albums, gathered by hand: keep.
//   • 'DJ Set' — same three songs as one tag group but in MY order (reordered by hand): keep.
const ALBUMS_POLLUTED = {
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11 },
  'G.O.A.T': { artist: 'Sidhu Moose Wala', trackIds: ['t4', 't5'], createdAt: 12 },
  'My Mix': { artist: 'Various Artists', trackIds: ['t1', 't4'], createdAt: 13 },
  'DJ Set': { artist: 'Diljit Dosanjh', trackIds: ['t2', 't1', 't3'], createdAt: 14 },
};
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], 'Moon Faves': ['t1', 't4'] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_POLLUTED)) }],
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
const storedPlaylists = () => { const m = idb._data.meta.get('playlists'); return m ? m.value : undefined; };
const ourPlaylists = () => { const p = storedPlaylists() || {}; return { 'All Songs': p['All Songs'], Favorites: p['Favorites'], 'Moon Faves': p['Moon Faves'] }; };
const cardEls = (win) => Array.from(win.document.querySelectorAll('#listPane [data-album-name]'));
const cardNames = (win) => cardEls(win).map((c) => c.dataset.albumName);
const paneHeader = (win) => {
  const h = win.document.querySelector('#listPane .pane-header');
  return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
};

let toasts = [];

(async () => {
  const win = dom.window;
  const realToast = win.toast;
  await wait(3200);
  win.toast = function (m) { toasts.push(String(m)); return realToast ? realToast.apply(null, arguments) : undefined; };

  console.log('\n— the auto-added albums are hidden, the hand-made ones stay —');
  win.navigate('albums');
  await wait(900);
  const names = cardNames(win);
  ok('the handed-over albums are not listed as cards',
     names.indexOf('MoonChild Era') === -1 && names.indexOf('G.O.A.T') === -1, JSON.stringify(names));
  ok('the albums gathered/ordered by hand are still there',
     names.indexOf('My Mix') !== -1 && names.indexOf('DJ Set') !== -1, JSON.stringify(names));
  ok('exactly the two hand-made albums are listed', names.length === 2, JSON.stringify(names));
  // 2 + 2 songs (the reordered 'DJ Set' duplicates ones the other albums own, so only
  // the four unique hand-owned songs count once each).
  ok('the header counts only what you made, not the whole tagged library',
     /\b4 tracks\b/.test(paneHeader(win)) && !/\b5 tracks\b/.test(paneHeader(win)), paneHeader(win));

  console.log('\n— nothing was lost —');
  const after = storedAlbums() || {};
  ok('every album entry still exists (nothing deleted)',
     eq(Object.keys(after).sort(), ['DJ Set', 'G.O.A.T', 'MoonChild Era', 'My Mix']), JSON.stringify(Object.keys(after)));
  ok('the hidden ones are flagged, not removed',
     after['MoonChild Era'] && after['MoonChild Era'].auto === true && after['G.O.A.T'] && after['G.O.A.T'].auto === true,
     JSON.stringify(after['MoonChild Era']));
  ok('the hand-made ones carry no auto flag',
     after['My Mix'] && !after['My Mix'].auto && after['DJ Set'] && !after['DJ Set'].auto,
     JSON.stringify([after['My Mix'], after['DJ Set']]));
  ok('playlists are byte-for-byte unchanged', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  win.navigate('playlists');
  await wait(500);
  const playlistRows = () => Array.from(win.document.querySelectorAll('#listPane .track')).map((r) => r.dataset.id);
  ok('every song is still in the library', eq(playlistRows().sort(), ['t1', 't2', 't3', 't4', 't5']), JSON.stringify(playlistRows()));
  win.navigate('albums');
  await wait(500);

  console.log('\n— "It is mine" brings one back —');
  ok('the restore hook exists', typeof win.__scMarkAlbumManual === 'function');
  ok('the hidden list is exposed for Manage albums', typeof win.__scAutoAlbumNames === 'function' && win.__scAutoAlbumNames().length === 2,
     JSON.stringify(typeof win.__scAutoAlbumNames === 'function' ? win.__scAutoAlbumNames() : null));
  const canRestore = typeof win.__scMarkAlbumManual === 'function';
  if (canRestore) win.__scMarkAlbumManual('MoonChild Era');
  win.navigate('albums');
  await wait(700);
  const names2 = cardNames(win);
  ok('the restored album has a card again', canRestore && names2.indexOf('MoonChild Era') !== -1, JSON.stringify(names2));
  ok('and it is no longer counted as auto',
     (storedAlbums()['MoonChild Era'] || {}).auto !== true && (storedAlbums()['MoonChild Era'] || {}).manual === true,
     JSON.stringify(storedAlbums()['MoonChild Era']));

  console.log('\n— the hand-made albums were never mistreated —');
  const myCard = cardEls(win).find((c) => c.dataset.albumName === 'My Mix');
  ok('the hand-made album still shows its songs', !!myCard && myCard.querySelectorAll('.track').length === 2,
     myCard ? String(myCard.querySelectorAll('.track').length) : 'no card');
  const djCard = cardEls(win).find((c) => c.dataset.albumName === 'DJ Set');
  ok('the album you ordered by hand keeps your order',
     !!djCard && eq(Array.from(djCard.querySelectorAll('.track')).map((r) => r.dataset.id), ['t2', 't1', 't3']),
     djCard ? JSON.stringify(Array.from(djCard.querySelectorAll('.track')).map((r) => r.dataset.id)) : 'no card');
  ok('the migration did not reject them', (storedAlbums()['DJ Set'] || {}).auto !== true, JSON.stringify(storedAlbums()['DJ Set']));

  const real = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
