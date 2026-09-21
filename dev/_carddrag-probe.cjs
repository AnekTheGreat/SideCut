// Scratch probe: does a long-press album-card drag actually change the saved
// album order? (v60.1.3 follow-up — "it lets me reorder but flicks back".)
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 300, height: 150 };
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'createPattern') return () => ({});
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const TRACKS = [
  { id: 't1', name: 'One', artist: 'A', album: 'Zeta', duration: 100 },
  { id: 't2', name: 'Two', artist: 'B', album: 'Alpha', duration: 100 },
  { id: 't3', name: 'Three', artist: 'C', album: 'Moon', duration: 100 },
  { id: 't4', name: 'Four', artist: 'D', album: 'Beta', duration: 100 },
];
const ALBUMS = {
  Zeta: { artist: 'A', trackIds: ['t1'], manual: true },
  Alpha: { artist: 'B', trackIds: ['t2'], manual: true },
  Moon: { artist: 'C', trackIds: ['t3'], manual: true },
  Beta: { artist: 'D', trackIds: ['t4'], manual: true },
};
const META = [
  { key: 'userAlbums', value: ALBUMS },
  { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3', 't4'], Favorites: [] } },
];

function fakeIndexedDB() {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map(META.map((m) => [m.key, m])) };
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
  return { _data: data, open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const win = dom.window;

function pev(el, type, opts) {
  const o = Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 300, pointerId: 7, pointerType: 'touch', button: 0, isPrimary: true }, opts || {});
  let ev;
  try { ev = new win.PointerEvent(type, o); } catch (e) { ev = new win.MouseEvent(type, o); }
  try { if (!ev.pointerId) Object.defineProperty(ev, 'pointerId', { value: 7 }); } catch (e) {}
  try { if (!ev.pointerType) Object.defineProperty(ev, 'pointerType', { value: 'touch' }); } catch (e) {}
  el.dispatchEvent(ev);
}

const cards = () => Array.from(win.document.querySelectorAll('#listPane [data-album-name]'));
const domOrder = () => cards().map((c) => c.dataset.albumName);
const savedOrder = () => Object.keys(idb._data.meta.get('userAlbums').value);

(async () => {
  await wait(3000);
  // geometry: jsdom reports 0-height boxes; the drag math needs real heights.
  win.Element.prototype.getBoundingClientRect = function () {
    if (this.dataset && this.dataset.albumName) return { top: 0, bottom: 100, height: 100, left: 0, right: 360, width: 360 };
    if (this.id === 'listPane') return { top: 0, bottom: 800, height: 800, left: 0, right: 360, width: 360 };
    return { top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 };
  };
  if(process.env.SC_SORT){
    win.eval("currentSort = " + JSON.stringify(process.env.SC_SORT));
    console.log('currentSort set to', win.eval('currentSort'));
  }
  win.navigate('albums');
  await wait(700);
  console.log('cards:', domOrder().join(','), '| saved:', savedOrder().join(','));
  const first = cards()[0];
  const hdr = first.firstElementChild;
  pev(hdr, 'pointerdown', { clientY: 300, clientX: 120 });
  await wait(450);                       // the card drag arms after 350ms
  pev(win.document, 'pointermove', { clientY: 560, clientX: 120 });
  await wait(60);
  console.log('mid-drag siblings transform:', Array.from(cards()).map((c) => c.style.transform || '-').join(' '));
  pev(win.document, 'pointerup', { clientY: 560, clientX: 120 });
  await wait(600);
  console.log('after drag -> cards:', domOrder().join(','), '| saved:', savedOrder().join(','));
  console.log('errors:', errors.filter((e) => e.indexOf('Not implemented') === -1).slice(0, 3));
  process.exit(0);
})().catch((e) => { console.error('probe crashed', e); process.exit(1); });
