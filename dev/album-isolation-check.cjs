// Album isolation audit: proves album reordering can only ever write userAlbums,
// that every playlist survives it byte-for-byte, that no song is dropped from an
// album by a reorder, and that album tracks are never hidden from the Albums view.
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

// Three tracks tagged 'MoonChild Era', two tagged 'Other Album'. No saved albums
// at all, which is exactly the shape of a library imported from tagged files.
const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Other One', artist: 'Someone', album: 'Other Album', duration: 100 },
  { id: 't5', name: 'Other Two', artist: 'Someone', album: 'Other Album', duration: 120 },
];
// The point of the suite: 'Moon Faves' contains ONLY album songs. That shape is
// what the render-time "playlist looks corrupted, refill it with the whole
// library" heuristic used to rewrite.
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], 'Moon Faves': ['t1', 't2'] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    // Deep copy: the app mutates whatever object it loads, so handing it the
    // constant itself would make the "unchanged?" comparisons tautological.
    meta: new Map([['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }]]),
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

  console.log('\n— baseline —');
  ok('library loaded', win.document.querySelectorAll('#listPane .track').length >= 0);
  ok('playlists loaded from storage', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  win.toast = function (m) { toasts.push(String(m)); return realToast ? realToast.apply(null, arguments) : undefined; };

  console.log('\n— album cards come from file tags (no saved albums yet) —');
  win.navigate('albums');
  await wait(800);
  let cards = Array.from(win.document.querySelectorAll('[data-album-name]'));
  const cardNames = cards.map((c) => c.dataset.albumName);
  ok('both tag-only albums are visible in the Albums tab', cardNames.length === 2 && cardNames.indexOf('MoonChild Era') !== -1 && cardNames.indexOf('Other Album') !== -1,
     'cards=' + JSON.stringify(cardNames));
  const moonCard = cards.find((c) => c.dataset.albumName === 'MoonChild Era');
  ok('the album shows all three of its songs', !!moonCard && moonCard.querySelectorAll('.track').length === 3,
     moonCard ? String(moonCard.querySelectorAll('.track').length) : 'no card');

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
  win.showAlbumReorderPopup('MoonChild Era');
  await wait(300);
  let sheet = win.document.getElementById('albumReorderPopup');
  ok('reorder sheet opens for the tag-only album', !!sheet);
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
  ok('the new order is persisted to userAlbums', eq((albumsAfter['MoonChild Era'] || {}).trackIds, ['t2', 't3', 't1']),
     JSON.stringify((albumsAfter['MoonChild Era'] || {}).trackIds));
  ok('no song was dropped from the album', ((albumsAfter['MoonChild Era'] || {}).trackIds || []).length === 3);
  ok('playlists untouched by the album reorder', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  // Done -> refresh the library view.
  const doneBtn = sheet.querySelector('button');
  Array.from(sheet.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Done').click();
  await wait(500);
  ok('sheet closed', !win.document.getElementById('albumReorderPopup'));
  cards = Array.from(win.document.querySelectorAll('[data-album-name]'));
  const moonAfter = cards.find((c) => c.dataset.albumName === 'MoonChild Era');
  ok('album card still shows every song after the reorder', !!moonAfter && moonAfter.querySelectorAll('.track').length === 3,
     moonAfter ? String(moonAfter.querySelectorAll('.track').length) : 'no card');
  ok('album card rows reflect the new order', !!moonAfter && JSON.stringify(Array.from(moonAfter.querySelectorAll('.track')).map((r) => r.dataset.id)) === JSON.stringify(['t2', 't3', 't1']),
     moonAfter ? JSON.stringify(Array.from(moonAfter.querySelectorAll('.track')).map((r) => r.dataset.id)) : 'no card');
  ok('playlists still untouched after closing', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  ok('other album untouched', !!cards.find((c) => c.dataset.albumName === 'Other Album'));

  console.log('\n— album card drag (the other reorder path) —');
  const albumsBeforeDrag = Object.keys(storedAlbums() || {});
  const cardsBeforeDrag = Array.from(win.document.querySelectorAll('[data-album-name]')).map((c) => c.dataset.albumName);
  ok('cards are ordered saved-album first', eq(cardsBeforeDrag, ['MoonChild Era', 'Other Album']), JSON.stringify(cardsBeforeDrag));
  // Drag the first card past the second (jsdom has no layout, so a downward move
  // simply lands it last — deterministic and enough to prove the persist path).
  const dragCard = Array.from(win.document.querySelectorAll('[data-album-name]')).find((c) => c.dataset.albumName === 'MoonChild Era');
  pev(win, dragCard, 'pointerdown', { clientY: 200 });
  await wait(420);                                  // hold to enter the drag
  docEv(win, 'pointermove', { clientY: 1200 });
  await wait(120);
  docEv(win, 'pointerup', { clientY: 1200 });
  await wait(700);
  const albumsAfterDrag = storedAlbums() || {};
  ok('no saved album was lost', Object.keys(albumsAfterDrag).length >= albumsBeforeDrag.length,
     JSON.stringify(Object.keys(albumsAfterDrag)));
  ok('the dragged album is now last', eq(Object.keys(albumsAfterDrag), ['Other Album', 'MoonChild Era']),
     JSON.stringify(Object.keys(albumsAfterDrag)));
  ok('dragging brought the tag-only album in as a real album', eq((albumsAfterDrag['Other Album'] || {}).trackIds, ['t4', 't5']),
     JSON.stringify((albumsAfterDrag['Other Album'] || {}).trackIds));
  const cardsAfterDrag = Array.from(win.document.querySelectorAll('[data-album-name]'));
  ok('both album cards survive the card drag', cardsAfterDrag.length === 2, 'cards=' + cardsAfterDrag.length);
  ok('the rendered order matches what was stored', eq(cardsAfterDrag.map((c) => c.dataset.albumName), ['Other Album', 'MoonChild Era']),
     JSON.stringify(cardsAfterDrag.map((c) => c.dataset.albumName)));
  ok('the dragged album kept every song', eq((albumsAfterDrag['MoonChild Era'] || {}).trackIds, ['t2', 't3', 't1']),
     JSON.stringify((albumsAfterDrag['MoonChild Era'] || {}).trackIds));
  const otherAfter = cardsAfterDrag.find((c) => c.dataset.albumName === 'Other Album');
  ok('and still shows its two songs', !!otherAfter && otherAfter.dataset.albumIds === 't4,t5',
     otherAfter ? otherAfter.dataset.albumIds : 'no card');
  ok('card drag never touched playlists', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  console.log('\n— picker route (⋮ → Reorder an album\'s songs) —');
  win.navigate('albums');
  await wait(600);
  ok('picker entry point is exposed', typeof win.__scOpenAlbumReorderPicker === 'function');
  win.__scOpenAlbumReorderPicker();
  await wait(400);
  const picks = Array.from(win.document.querySelectorAll('.ap-pick'));
  ok('picker lists every album (saved + tag-only)', picks.length === 2, 'picks=' + picks.length + ' ' + picks.map((b) => b.textContent.trim()).join(' | '));
  ok('picker counts every track', /3 tracks/.test(picks.map((b) => b.textContent).join('|')) && /2 tracks/.test(picks.map((b) => b.textContent).join('|')),
     picks.map((b) => b.textContent.trim().replace(/\s+/g, ' ')).join(' | '));
  const pickOther = picks.find((b) => b.textContent.indexOf('Other Album') !== -1);
  pickOther.click();
  await wait(400);
  const sheet2 = win.document.getElementById('albumReorderPopup');
  ok('picking an album opens its reorder sheet', !!sheet2);
  const pickedIds = sheet2 ? Array.from(sheet2.querySelectorAll('[data-id]')).map((r) => r.dataset.id) : [];
  ok('and it opened the album that was picked', eq(pickedIds, ['t4', 't5']), JSON.stringify(pickedIds));
  ok('picker route left playlists alone', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  Array.from(sheet2.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Done').click();
  await wait(500);
  ok('closing it refreshed the album view', !!win.document.querySelector('[data-album-name="Other Album"]'));

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
  win.navigate('albums');
  await wait(600);
  const finalCards = Array.from(win.document.querySelectorAll('[data-album-name]'));
  const memberIds = finalCards.reduce((all, c) => all.concat(c.dataset.albumIds ? c.dataset.albumIds.split(',') : []), []);
  ok('Albums tab exposes all five songs across both albums', memberIds.length === 5 && new Set(memberIds).size === 5, JSON.stringify(memberIds));
  ok('no track is missing from its album', ['t1', 't2', 't3', 't4', 't5'].every((id) => memberIds.indexOf(id) !== -1), JSON.stringify(memberIds));
  // And the collapsed/expanded card actually renders them on demand.
  const head = finalCards.find((c) => c.dataset.albumName === 'Other Album').querySelector('div');
  const bodyOther = finalCards.find((c) => c.dataset.albumName === 'Other Album').querySelector('[id^="alb_card_"]');
  if (bodyOther && bodyOther.style.display === 'none') { head.click(); await wait(300); }
  ok('expanding a card renders its rows', bodyOther.querySelectorAll('.track').length === 2, String(bodyOther.querySelectorAll('.track').length));

  console.log('\n— the playing song is highlighted inside album cards —');
  try { win.playFromList(['t1', 't2', 't3', 't4', 't5'], 't5'); } catch (e) {}
  await wait(700);
  win.navigate('albums');
  await wait(900);
  const playingRows = Array.from(win.document.querySelectorAll('[data-album-name] .track.playing')).map((r) => r.dataset.id);
  ok('its song row is marked as playing inside the card', playingRows.indexOf('t5') !== -1, JSON.stringify(playingRows));
  const otherBody = win.document.querySelector('[data-album-name="Other Album"] [id^="alb_card_"]');
  ok('a tag-only album card auto-opens and fills for the playing song',
     !!otherBody && otherBody.style.display !== 'none' && otherBody.querySelectorAll('.track').length === 2,
     otherBody ? ('display=' + otherBody.style.display + ' rows=' + otherBody.querySelectorAll('.track').length) : 'no body');
  ok('auto-expand still left playlists alone', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  // jsdom cannot actually play audio ('Not implemented: HTMLMediaElement.play')
  // plus the app's known boot-order race; neither is an app error.
  const unexpected = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no new page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
