// Album isolation audit. Two rules are under test:
//   1. Album work can only ever write userAlbums — every playlist survives it
//      byte-for-byte, and no reorder drops a song from an album.
//   2. The Albums tab is MANUAL-ONLY: it lists the albums the user created by
//      hand, and never invents cards for albums that exist only as file tags
//      (the "why are there 400 songs in my albums" report).
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
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return { width: 300, height: 150 };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'createPattern') return () => ({});
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop === 'measureText') return () => ({ width: 10 });
      if (typeof prop === 'string' && /^[a-z]/.test(prop)) return () => undefined;
      return undefined;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

// Five downloaded files carrying album TAGS, and ONE album the user made by hand
// ('My Mix', holding t1..t3). The tagged-only albums ('MoonChild Era', 'Other
// Album') must never get cards of their own.
const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Other One', artist: 'Someone', album: 'Other Album', duration: 100 },
  { id: 't5', name: 'Other Two', artist: 'Someone', album: 'Other Album', duration: 120 },
];
const ALBUMS_START = {
  'My Mix': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 1 },
};
// The point of the suite: 'Moon Faves' contains ONLY album songs. That shape is
// what the old render-time "playlist looks corrupted, refill it with the whole
// library" heuristic used to rewrite.
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], 'Moon Faves': ['t1', 't2'] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    // Deep copy: the app mutates whatever object it loads, so handing it the
    // constant itself would make the "unchanged?" comparisons tautological.
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_START)) }],
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function storedPlaylists() { const m = idb._data.meta.get('playlists'); return m ? m.value : undefined; }
// The app legitimately adds an 'Unsorted' view of its own, so compare only the
// playlists under test — those must never change shape.
function ourPlaylists() {
  const p = storedPlaylists() || {};
  return { 'All Songs': p['All Songs'], Favorites: p['Favorites'], 'Moon Faves': p['Moon Faves'] };
}
function storedAlbums() { const m = idb._data.meta.get('userAlbums'); return m ? m.value : undefined; }
function cardEls(win) { return Array.from(win.document.querySelectorAll('#listPane [data-album-name]')); }
function cardNames(win) { return cardEls(win).map((c) => c.dataset.albumName); }
function paneHeader(win) {
  const h = win.document.querySelector('#listPane .pane-header');
  return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
}
function pev(win, el, type, opts) {
  const o = Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 300, pointerId: 9, pointerType: 'touch', button: 0, isPrimary: true }, opts || {});
  let ev;
  try { ev = new win.PointerEvent(type, o); } catch (e) { ev = new win.MouseEvent(type, o); }
  try { if (ev.pointerId !== 9) Object.defineProperty(ev, 'pointerId', { value: 9 }); } catch (e) {}
  el.dispatchEvent(ev);
  return ev;
}
function docEv(win, type, opts) {
  return pev(win, win.document, type, opts);
}
// Switch playlists the way a user does — by tapping the tab. (activePlaylist is a
// closure variable inside the app, so assigning win.activePlaylist would silently
// leave the view on whatever was already open.)
function clickTab(win, name) {
  const t = win.document.querySelector('#tabs .tab[data-playlist-name="' + name + '"]');
  if (!t) return false;
  t.click();
  return true;
}

let toasts = [];

(async () => {
  const win = dom.window;
  const realToast = win.toast;
  await wait(3000);
  win.toast = function (m) { toasts.push(String(m)); return realToast ? realToast.apply(null, arguments) : undefined; };

  console.log('\n— the Albums tab is the albums the user created —');
  win.navigate('albums');
  await wait(800);
  ok('only the hand-made album has a card', eq(cardNames(win), ['My Mix']), JSON.stringify(cardNames(win)));
  ok('the album tagged on the files is NOT listed', cardNames(win).indexOf('MoonChild Era') === -1, JSON.stringify(cardNames(win)));
  ok('nor is the other tag-only album', cardNames(win).indexOf('Other Album') === -1, JSON.stringify(cardNames(win)));
  ok('no album the user never created exists in storage', eq(Object.keys(storedAlbums() || {}), ['My Mix']),
     JSON.stringify(Object.keys(storedAlbums() || {})));
  const myCard = cardEls(win).find((c) => c.dataset.albumName === 'My Mix');
  ok('the album shows all three of its songs', !!myCard && myCard.querySelectorAll('.track').length === 3,
     myCard ? String(myCard.querySelectorAll('.track').length) : 'no card');
  ok('the header counts only the albums’ songs (3, not the whole library)', /\b3 tracks\b/.test(paneHeader(win)), paneHeader(win));
  ok('the tag-only songs are not smuggled into the count', !/\b5 tracks\b/.test(paneHeader(win)), paneHeader(win));

  console.log('\n— rendering the Albums tab must not rewrite playlists —');
  ok('playlist backed by only album songs is untouched', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  ok('no "auto-recovered" toast was raised', toasts.filter((t) => /recover/i.test(t)).length === 0, JSON.stringify(toasts.slice(0, 3)));
  const beforeHeal = toasts.slice();
  win.navigate('playlists');
  await wait(500);
  win.navigate('albums');
  await wait(500);
  ok('switching views repeatedly still never touches playlists', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  ok('and still raises no recovery toast', toasts.length === beforeHeal.length, JSON.stringify(toasts.slice(-2)));

  console.log('\n— the "Moon Faves" playlist itself —');
  win.navigate('playlists');
  await wait(500);
  ok('playlist tab found and opened', clickTab(win, 'Moon Faves'));
  await wait(500);
  let rows = Array.from(win.document.querySelectorAll('#listPane .track')).map((r) => r.dataset.id);
  ok('playlist still lists exactly its two songs', eq(rows, ['t1', 't2']), JSON.stringify(rows));

  console.log('\n— album reorder via the sheet —');
  win.navigate('albums');
  await wait(600);
  win.showAlbumReorderPopup('My Mix');
  await wait(300);
  let sheet = win.document.getElementById('albumReorderPopup');
  ok('reorder sheet opens for the album', !!sheet);
  let sheetRows = Array.from(sheet.querySelectorAll('[data-id]')).map((r) => r.dataset.id);
  ok('sheet lists the album songs unchanged', eq(sheetRows, ['t1', 't2', 't3']), JSON.stringify(sheetRows));
  ok('opening it still left playlists alone', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  // Drag the first row to the end with its grip.
  const firstRow = sheet.querySelector('[data-id="t1"]');
  const grip = firstRow.querySelector('.ar-grip');
  pev(win, grip, 'pointerdown', { clientY: 100 });
  docEv(win, 'pointermove', { clientY: 900 });
  docEv(win, 'pointerup', { clientY: 900 });
  await wait(400);
  sheetRows = Array.from(sheet.querySelectorAll('[data-id]')).map((r) => r.dataset.id);
  ok('dragging reorders the album', eq(sheetRows, ['t2', 't3', 't1']), JSON.stringify(sheetRows));
  const albumsAfter = storedAlbums() || {};
  ok('the new order is persisted to userAlbums', eq((albumsAfter['My Mix'] || {}).trackIds, ['t2', 't3', 't1']),
     JSON.stringify((albumsAfter['My Mix'] || {}).trackIds));
  ok('no song was dropped from the album', ((albumsAfter['My Mix'] || {}).trackIds || []).length === 3);
  ok('reordering invented no album', eq(Object.keys(albumsAfter), ['My Mix']), JSON.stringify(Object.keys(albumsAfter)));
  ok('playlists untouched by the album reorder', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  // Done -> refresh the library view.
  Array.from(sheet.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Done').click();
  await wait(500);
  ok('sheet closed', !win.document.getElementById('albumReorderPopup'));
  const myAfter = cardEls(win).find((c) => c.dataset.albumName === 'My Mix');
  ok('album card still shows every song after the reorder', !!myAfter && myAfter.querySelectorAll('.track').length === 3,
     myAfter ? String(myAfter.querySelectorAll('.track').length) : 'no card');
  ok('album card rows reflect the new order', !!myAfter && eq(Array.from(myAfter.querySelectorAll('.track')).map((r) => r.dataset.id), ['t2', 't3', 't1']),
     myAfter ? JSON.stringify(Array.from(myAfter.querySelectorAll('.track')).map((r) => r.dataset.id)) : 'no card');
  ok('still no tag-only album card after a reorder', eq(cardNames(win), ['My Mix']), JSON.stringify(cardNames(win)));
  ok('playlists still untouched after closing', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  console.log('\n— dragging a card can never invent an album —');
  const albumsBeforeDrag = JSON.stringify(storedAlbums() || {});
  const dragCard = cardEls(win)[0];
  pev(win, dragCard, 'pointerdown', { clientY: 200 });
  await wait(420);                                  // hold to enter the drag
  docEv(win, 'pointermove', { clientY: 1200 });
  await wait(120);
  docEv(win, 'pointerup', { clientY: 1200 });
  await wait(700);
  ok('the drag changed no album content', JSON.stringify(storedAlbums() || {}) === albumsBeforeDrag,
     JSON.stringify(storedAlbums() || {}));
  ok('and card drag never touched playlists', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  console.log('\n— picker route (⋮ → Reorder an album\'s songs) —');
  win.navigate('albums');
  await wait(600);
  ok('picker entry point is exposed', typeof win.__scOpenAlbumReorderPicker === 'function');
  win.__scOpenAlbumReorderPicker();
  await wait(400);
  const picks = Array.from(win.document.querySelectorAll('.ap-pick'));
  // The saved album, plus the tag-only album whose songs no saved album claims.
  // 'MoonChild Era' is not offered separately because t1..t3 already belong to
  // 'My Mix' — offering it would split the same songs across two albums.
  ok('picker offers the saved album and the unclaimed tag-only album', picks.length === 2,
     'picks=' + picks.length + ' ' + picks.map((b) => b.textContent.trim().replace(/\s+/g, ' ')).join(' | '));
  const pickOther = picks.find((b) => b.textContent.indexOf('Other Album') !== -1);
  ok('the tag-only album is offered by the picker', !!pickOther);
  pickOther.click();
  await wait(400);
  const sheet2 = win.document.getElementById('albumReorderPopup');
  ok('picking an album opens its reorder sheet', !!sheet2);
  const pickedIds = sheet2 ? Array.from(sheet2.querySelectorAll('[data-id]')).map((r) => r.dataset.id) : [];
  ok('and it opened the album that was picked', eq(pickedIds, ['t4', 't5']), JSON.stringify(pickedIds));
  ok('picker route left playlists alone', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  Array.from(sheet2.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Done').click();
  await wait(500);
  // Only an explicit "reorder this tag album" action saves it — then it is an
  // album the user asked for, and it shows up like any other.
  ok('the album the user explicitly took in now has a card', cardNames(win).indexOf('Other Album') !== -1, JSON.stringify(cardNames(win)));
  ok('and the hand-made album is still there, unmoved', cardNames(win)[0] === 'My Mix', JSON.stringify(cardNames(win)));
  ok('no other album appeared', cardNames(win).length === 2, JSON.stringify(cardNames(win)));

  console.log('\n— everything still reachable in the normal views —');
  win.navigate('playlists');
  await wait(500);
  clickTab(win, 'Moon Faves');
  await wait(500);
  rows = Array.from(win.document.querySelectorAll('#listPane .track')).map((r) => r.dataset.id);
  ok('"Moon Faves" still shows exactly its two songs', eq(rows, ['t1', 't2']), JSON.stringify(rows));
  clickTab(win, 'All Songs');
  await wait(500);
  rows = Array.from(win.document.querySelectorAll('#listPane .track')).map((r) => r.dataset.id);
  ok('All Songs still has all five', eq(rows, ['t1', 't2', 't3', 't4', 't5']), JSON.stringify(rows));

  console.log('\n— the playing song is highlighted inside album cards —');
  win.navigate('albums');
  await wait(700);
  try { win.playFromList(['t1', 't2', 't3'], 't3'); } catch (e) {}
  await wait(900);
  win.navigate('albums');
  await wait(900);
  const playingRows = Array.from(win.document.querySelectorAll('#listPane [data-album-name] .track.playing')).map((r) => r.dataset.id);
  ok('its song row is marked as playing inside the card', playingRows.indexOf('t3') !== -1, JSON.stringify(playingRows));
  const myBody = win.document.querySelector('[data-album-name="My Mix"] [id^="alb_card_"]');
  ok('the card is open and lists all three songs',
     !!myBody && myBody.querySelectorAll('.track').length === 3,
     myBody ? ('display=' + myBody.style.display + ' rows=' + myBody.querySelectorAll('.track').length) : 'no body');
  ok('the playing highlight did not add or remove any album card', eq(cardNames(win), ['My Mix', 'Other Album']), JSON.stringify(cardNames(win)));

  // jsdom cannot actually play audio ('Not implemented: HTMLMediaElement.play')
  // plus the app's known boot-order race; neither is an app error.
  const unexpected = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no new page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
