// REPRO probe for the 73.1.9 owner report:
//   "the second I leave the albums tab all of my songs that I add are removed"
// Drives the real UI: add a song to an album, leave the Albums tab, come back.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
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
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: '', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: '', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
];
const ALBUMS_START = {
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t3'], createdAt: 11, manual: true },
};
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3'], Favorites: [] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_START)) }],
      ['albumOrder', { key: 'albumOrder', value: ['MoonChild Era'] }],
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

(async () => {
  const win = dom.window;
  await wait(6000);
  const store = () => { const m = idb._data.meta.get('userAlbums'); return m ? m.value : undefined; };
  const live = () => win.__scGetAllTracks ? win.__scGetAllTracks() : [];

  console.log('boot store:', JSON.stringify(Object.keys(store() || {})));
  console.log('t1 album tag on file:', JSON.stringify((live().find(t => t.id === 't1') || {}).album));

  // 1) Add t1 to 'MoonChild Era' through the real path.
  console.log('NOTE driving real addTracksToAlbum');
  win.__scAddTracksToAlbum(['t1'], 'MoonChild Era', 'probe');
  await wait(500);
  console.log('after add:', JSON.stringify((store()['MoonChild Era'] || {}).trackIds));

  // 2) Leave the Albums tab and come back.
  win.navigate('playlists'); await wait(400);
  win.navigate('albums'); await wait(600);
  console.log('after leave+return:', JSON.stringify((store()['MoonChild Era'] || {}).trackIds));

  // 3) Remove t1 again — the exact action that must STICK.
  const rem = win.__scRemoveFromAlbum('t1', 'MoonChild Era');
  console.log('remove returned:', rem);
  await wait(300);
  console.log('after remove:', JSON.stringify((store()['MoonChild Era'] || {}).trackIds));

  // 4) Leave and return again.
  win.navigate('playlists'); await wait(400);
  win.navigate('albums'); await wait(600);
  console.log('after 2nd leave+return:', JSON.stringify((store()['MoonChild Era'] || {}).trackIds));

  // 5) Remove t3 — a song whose FILE TAG still says MoonChild Era. This is the
  // owner's exact fight: does the removal survive the boot recovery pass?
  const rem2 = win.__scRemoveFromAlbum('t3', 'MoonChild Era');
  console.log('remove t3 returned:', rem2);
  await wait(200);
  console.log('after removing the TAGGED song:', JSON.stringify((store()['MoonChild Era'] || {}).trackIds));
  win.navigate('home'); await wait(300);
  win.navigate('albums'); await wait(600);
  console.log('after leave+return (tagged-song removal):', JSON.stringify((store()['MoonChild Era'] || {}).trackIds));
  // And the boot recovery itself, which runs on every start:
  win.__scAlbumsRecoverDeleted();
  await wait(300);
  console.log('after boot-recovery pass:', JSON.stringify((store()['MoonChild Era'] || {}).trackIds));
  win.navigate('home'); await wait(400);
  win.navigate('albums'); await wait(600);
  console.log('final after navigation:', JSON.stringify(Object.keys(store() || {})), JSON.stringify((store()['MoonChild Era'] || {}).trackIds));

  process.exit(0);
})();
