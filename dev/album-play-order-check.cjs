// 73.2.1 — album songs must play in the album's (possibly reordered) order.
//
// The owner: "albums songs should play in order not flip flap around especially
// if you reorder a song". This drives the real Albums tab and the real play
// path (row tap -> playFromList -> playCurrent) and checks:
//   A. tapping a row queues the album's SAVED trackIds in order,
//   B. after a reorder the SAME tap queues the NEW order (rows read the store
//      at tap time, so a stale card can never resurrect an old order),
//   C. the playing song's own album stays open across leave+return even when
//      another album also holds the song (the focus rule used to collapse the
//      card that was tapped — the visible "flip flap"),
//   D. a stale start id can no longer push queueIndex out of the queue.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}
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
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171 },
  { id: 't5', name: 'Do You Know', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 199 },
];
// Mixtape is listed FIRST so a library-scan answer would name it, not the
// album the play actually came from.
// 'Aurora Sessions' sorts FIRST by name but is ranked LAST in albumOrder, so
// anything that answers "which album comes first" by the name gets E. wrong.
const ALBUMS_START = {
  'Mixtape': { artist: 'Diljit Dosanjh', trackIds: ['t2', 't1'], createdAt: 5, manual: true },
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, manual: true },
  'Aurora Sessions': { artist: 'Diljit Dosanjh', trackIds: ['t4', 't5'], createdAt: 3, manual: true },
};
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_START)) }],
      ['albumOrder', { key: 'albumOrder', value: ['Mixtape', 'MoonChild Era', 'Aurora Sessions'] }],
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

function stubAudio(win) {
  ['audioEl', 'audioEl2'].forEach((id) => {
    const el = win.document.getElementById(id);
    if (!el) return;
    let pos = 0;
    try {
      Object.defineProperty(el, 'paused', { get: () => el.__paused !== false, configurable: true });
      Object.defineProperty(el, 'ended', { get: () => false, configurable: true });
      Object.defineProperty(el, 'duration', { get: () => el.__dur || 180, configurable: true });
      Object.defineProperty(el, 'currentTime', { get: () => pos, set: (v) => { pos = v; }, configurable: true });
      Object.defineProperty(el, 'src', { get: () => el.__src || 'blob:fake', set: (v) => { el.__src = v; }, configurable: true });
    } catch (e) {}
    el.load = () => {};
    el.play = () => { el.__paused = false; return Promise.resolve(); };
    el.pause = () => { el.__paused = true; };
  });
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
  stubAudio(win);
  const store = () => { const m = idb._data.meta.get('userAlbums'); return m ? m.value : undefined; };
  const snap = () => win.__scPlaybackSnapshot();

  console.log('boot store:', JSON.stringify(Object.keys(store() || {})));
  ok('both albums booted', !!(store()['MoonChild Era'] && store()['Mixtape']));

  // Open the Albums tab.
  win.navigate('albums');
  await wait(800);
  const pane = win.document.getElementById('listPane');
  const card = pane.querySelector('[data-album-name="MoonChild Era"]');
  ok('the album card is on screen', !!card);
  let body = card && card.querySelector('[id^="alb_card_"]');
  if (body && body.style.display === 'none') {
    const hdr = card.firstElementChild;
    hdr && hdr.click();
    await wait(300);
    body = card.querySelector('[id^="alb_card_"]');
  }
  ok('the card is expanded with rows', !!body && body.querySelectorAll('.track').length === 3);

  // A. tap the LAST row — the queue must be the album's saved order.
  const row3 = body.querySelector('.track[data-id="t3"]');
  ok('row for t3 exists in card order position 3', !!row3 && row3.querySelector('.idx').textContent === '3');
  row3.click();
  await wait(400);
  let s = snap();
  ok('queue is the album order [t1,t2,t3]', eq(s.queue, ['t1', 't2', 't3']), s.queue);
  ok('the tapped song is the one playing', s.queueIndex === 2, s.queueIndex);
  ok('the play is tagged with its album', s.album === 'MoonChild Era', s.album);
  ok('focus rule answers the album the play came from', win.__scAlbumForPlayingTrack() === 'MoonChild Era', win.__scAlbumForPlayingTrack());

  // B. Reorder the album the way the reorder sheet saves it (trackIds through
  // the real store), then re-render exactly like Done does, and tap again.
  const live = win.__scGetUserAlbums();
  live['MoonChild Era'].trackIds = ['t2', 't3', 't1'];
  if (typeof win.dbPut === 'function') win.dbPut('meta', { key: 'userAlbums', value: live });
  await wait(300);
  win.renderList();
  await wait(600);
  const card2 = pane.querySelector('[data-album-name="MoonChild Era"]');
  let body2 = card2.querySelector('[id^="alb_card_"]');
  if (body2.style.display === 'none') { card2.firstElementChild.click(); await wait(300); body2 = card2.querySelector('[id^="alb_card_"]'); }
  ok('card now shows the new order', body2.querySelector('.track[data-id="t2"] .idx').textContent === '1');
  body2.querySelector('.track[data-id="t2"]').click();
  await wait(400);
  s = snap();
  ok('after reorder the queue plays the NEW order', eq(s.queue, ['t2', 't3', 't1']), s.queue);
  ok('and starts on the tapped song', s.queueIndex === 0, s.queueIndex);

  // B2. A STALE card (reorder without a re-render) must still queue the saved
  // order — rows read the store at tap time.
  live['MoonChild Era'].trackIds = ['t3', 't1', 't2'];
  if (typeof win.dbPut === 'function') win.dbPut('meta', { key: 'userAlbums', value: live });
  await wait(300);
  body2.querySelector('.track[data-id="t1"]').click(); // stale row says t1 is #2
  await wait(400);
  s = snap();
  ok('stale card still queues the saved order', eq(s.queue, ['t3', 't1', 't2']), s.queue);

  // C. The tapped album stays open across leave+return even though Mixtape
  // also holds the playing song (and is scanned first).
  win.navigate('playlists');
  await wait(400);
  win.navigate('albums');
  await wait(600);
  const keepOpen = win.localStorage.getItem('sidecut_albColl_MoonChild Era');
  const mixState = win.localStorage.getItem('sidecut_albColl_Mixtape');
  ok('playing album card stays open after leave+return', keepOpen === '0', keepOpen);
  ok('the other album collapsed instead', mixState === '1', mixState);
  const card3 = pane.querySelector('[data-album-name="MoonChild Era"]');
  const body3 = card3 && card3.querySelector('[id^="alb_card_"]');
  ok('the open card is really expanded on screen', !!body3 && body3.style.display === 'block');

  // E. The albums themselves. A play straight through the tab must walk the
  // albums in the order the CARDS are in. The cards sit in albumOrder (Mixtape,
  // MoonChild Era, Aurora Sessions), while sorting by name would put Aurora
  // Sessions first - so a queue built from a year/name sort plays the tab in a
  // different order from the one on screen, which is the reported bug.
  win.navigate('albums');
  await wait(800);
  const cardNames = Array.prototype.map.call(
    pane.querySelectorAll('[data-album-name]'), (c) => c.dataset.albumName);
  ok('cards are in your album order, not by name', eq(cardNames, ['Mixtape', 'MoonChild Era', 'Aurora Sessions']), cardNames);
  // Play through the tab the way a user does it: the search box drops Albums
  // mode to its flat list, and a tap there queues the whole tab (fullIds).
  const si = win.document.getElementById('searchInput');
  si.value = 'diljit';
  si.dispatchEvent(new win.Event('input'));
  await wait(700);
  const flatRows = pane.querySelectorAll('.track[data-id]');
  ok('the flat list shows every song in the albums', flatRows.length === 5, flatRows.length);
  ok('and it is listed in the card order',
    Array.prototype.map.call(flatRows, (r) => r.dataset.id).join(',') === 't2,t1,t3,t4,t5',
    Array.prototype.map.call(flatRows, (r) => r.dataset.id).join(','));
  flatRows[0].click();
  await wait(400);
  s = snap();
  ok('playing the tab walks the albums in card order', eq(s.queue, ['t2', 't1', 't3', 't4', 't5']), s.queue);
  // The order the cards are in IS albumOrder, so this pairing is the whole
  // claim: same albums, same order, on screen and in the queue.
  ok('the queue order is not a name sort', !eq(s.queue, ['t4', 't5', 't2', 't1', 't3']), s.queue);
  si.value = '';
  si.dispatchEvent(new win.Event('input'));
  await wait(400);

  // D. A start id that is not in the queue must not push the index out of it.
  win.playFromList(['t1', 't2', 't3'], 'ghost-id', 'MoonChild Era');
  await wait(300);
  s = snap();
  ok('stale start id clamps to the top of the queue', s.queueIndex === 0 && s.queue.length === 3, s);

  const realErrors = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1 && e.indexOf('offline') === -1);
  ok('no unexpected page errors', realErrors.length === 0, realErrors.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
