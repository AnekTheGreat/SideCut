// 80.2.4 - AN ALBUM'S SONGS, IN THE ORDER THE ALBUM PLAYS THEM.
//
// Drives the release the way a thumb would, on a real boot of the patched page:
//
//   * the albums card carries its own three dots, they open the album menu, and
//     tapping them does not fold the card;
//   * the menu's first row files the album into the order Album History lists,
//     and its second row opens the hand reorder the long press already had;
//   * the same row sits in a song's three-dot sheet, in a view that is NOT
//     Albums, and names the album it would sort;
//   * the read is the one Album History makes - an iTunes album search, then the
//     collection lookup - and the answer is kept per album on the device;
//   * a song the record does not name keeps its place at the END, and a second
//     sort reads the cache instead of the network;
//   * Undo puts the album back exactly as it was;
//   * an album Album History has nothing for is left untouched and says so.
//
//   node dev/album-real-order-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

function fakeIndexedDB() {
  const data = { tracks: new Map(), meta: new Map([['pinnedReleases', {}]]) };
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
  return { open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
}

// ---- the world the check talks to -------------------------------------------
const ALBUM = 'Order Test Album';
const ARTIST = 'Test Artist';
// Scrambled on purpose: the imported order is never the record's.
const LIB = [
  { id: 't1', name: 'Second Song', album: ALBUM },
  { id: 't2', name: 'First Song', album: ALBUM },
  { id: 't3', name: 'Third Song (Remastered 2011)', album: ALBUM },
  { id: 't4', name: 'A Song That Is Not On It', album: ALBUM },
  { id: 't5', name: 'Fourth Song', album: ALBUM },
];
// What the store says the album is, in its own order.
const REAL = ['First Song', 'Second Song', 'Third Song', 'Fourth Song'];

const calls = [];
let storeEmpty = false;

function searchReply(url) {
  if (storeEmpty) return { results: [] };
  return { results: [{ wrapperType: 'collection', collectionId: 9001, collectionName: ALBUM, artistName: ARTIST, artworkUrl100: 'https://example.test/art.jpg' }] };
}
function lookupReply() {
  return { results: REAL.map((name, i) => ({ wrapperType: 'track', trackName: name, trackNumber: i + 1, discNumber: 1, previewUrl: '' })) };
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    win.indexedDB = fakeIndexedDB();
    win.navigator.vibrate = () => true;
    win.fetch = function (url) {
      const u = String(url);
      calls.push(u);
      let body = { results: [], data: [] };
      if (u.indexOf('itunes.apple.com/search') !== -1) body = searchReply(u);
      else if (u.indexOf('itunes.apple.com/lookup') !== -1) body = lookupReply(u);
      return Promise.resolve({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    };
  },
});

const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 120, clientY: 300 }));

function albumOrder(win) {
  const a = win.__scGetUserAlbums()[ALBUM];
  return a ? a.trackIds.join(',') : '';
}
function toastText(win) {
  const t = win.document.getElementById('toast');
  return t ? (t.textContent || '').trim() : '';
}

(async () => {
  const win = dom.window;
  // The page defines its globals when readyState reaches complete; wait for the
  // hook rather than guessing how long the boot takes.
  for (let i = 0; i < 120 && typeof win.__scSortAlbumRealOrder !== 'function'; i++) await wait(250);

  ok('the release hook is on the page', typeof win.__scSortAlbumRealOrder === 'function');
  // The live build, not the release this file was written for: 80.2.5 added a third
  // row to this same menu, and 80.2.6 will move the number again. The pin is a
  // quoted literal on purpose, because that is what dev/repin-<version>.mjs sweeps
  // - a literal is repinned every release, an escape sequence is not.
  const VER = '80.2.6'; /* repinned by dev/repin-8026.mjs */
  ok('the page runs ' + VER, new RegExp("const APP_VERSION = '" + VER.replace(/\./g, '\\.') + "';").test(html));
  if (typeof win.__scSortAlbumRealOrder !== 'function') {
    console.log('album-real-order-check: ' + pass + ' passed, ' + (fail + 1) + ' failed');
    process.exit(1);
  }

  // ---- the library -----------------------------------------------------------
  const tracks = win.__scGetAllTracks();
  tracks.length = 0;
  LIB.forEach((t) => tracks.push({ id: t.id, name: t.name, artist: ARTIST, album: t.album, duration: 180, url: '', artUrl: '' }));
  const pls = win.__scGetPlaylists();
  if (pls['All Songs']) { pls['All Songs'].length = 0; LIB.forEach((t) => pls['All Songs'].push(t.id)); }
  const albums = win.__scGetUserAlbums();
  albums[ALBUM] = { artist: ARTIST, trackIds: LIB.map((t) => t.id), createdAt: Date.now(), manual: true };
  ok('the album starts in its imported order', albumOrder(win) === 't1,t2,t3,t4,t5', albumOrder(win));

  // ---- 1. THE CARD'S THREE DOTS ---------------------------------------------
  win.navigate('library');
  const albumsTab = win.document.querySelector('[data-playlist-name="__albums__"]');
  ok('the Albums tab is there to open', !!albumsTab);
  if (albumsTab) { click(win, albumsTab); await wait(60); }

  const kebab = win.document.querySelector('[data-album-kebab]');
  ok('the album card carries its own three dots', !!kebab);
  ok('and they name the album they belong to', kebab && kebab.getAttribute('data-album-kebab') === ALBUM, kebab && kebab.getAttribute('data-album-kebab'));
  const cardBody = win.document.getElementById('alb_card_0');
  const before = cardBody ? cardBody.style.display : '';
  if (kebab) { click(win, kebab); await wait(60); }
  ok('tapping them does not fold the card', cardBody && cardBody.style.display === before, cardBody && cardBody.style.display);

  const rows = Array.from(win.document.querySelectorAll('#discPopupBody .sc-alm-row'));
  // Two rows here, and the album's own delete joined them in 80.2.5: the count is
  // not this file's to pin, the two it added are.
  ok('they open an album menu', rows.length >= 2, String(rows.length));
  ok('whose first row is the real-order sort', rows[0] && /real order/i.test(rows[0].textContent), rows[0] && rows[0].textContent);
  ok('and whose second row is the hand reorder', rows[1] && /by hand/i.test(rows[1].textContent), rows[1] && rows[1].textContent);

  // ---- 2. THE SORT, THROUGH THE CARD ---------------------------------------
  calls.length = 0;
  click(win, rows[0]);
  await wait(400);
  ok('the sort called the album search Album History makes', calls.some((u) => u.indexOf('itunes.apple.com/search') !== -1), calls.join(' | '));
  ok('and looked the collection up for its songs', calls.some((u) => u.indexOf('itunes.apple.com/lookup') !== -1));
  ok('the album is now in the store order, the song it does not name kept at the end',
    albumOrder(win) === 't2,t1,t3,t5,t4', albumOrder(win));
  const overlay = win.document.getElementById('discPopupOverlay');
  ok('the popup closed behind it', !!overlay && overlay.style.display === 'none', overlay && overlay.style.display);
  ok('and the toast says what was done', /Sorted .{0,3}Order Test Album.{0,3} into its real order/.test(toastText(win)), toastText(win));
  ok('with an Undo beside it', !!Array.from(win.document.querySelectorAll('#toast button')).find((b) => /undo/i.test(b.textContent)));

  // ---- 3. THE CACHE ---------------------------------------------------------
  let cache = {};
  try { cache = JSON.parse(win.localStorage.getItem('sidecut_albumRealOrder') || '{}'); } catch (e) {}
  const entry = cache[ALBUM.toLowerCase()];
  ok('the order is kept per album on the device', !!entry && Array.isArray(entry.tracks) && entry.tracks.length === 4, JSON.stringify(entry && entry.tracks));
  ok('with the artist it was read for', !!entry && entry.artist === ARTIST, entry && entry.artist);
  ok('and the storefront it came from', !!entry && /itunes/i.test(entry.source || ''), entry && entry.source);

  // ---- 4. UNDO --------------------------------------------------------------
  const undo = Array.from(win.document.querySelectorAll('#toast button')).find((b) => /undo/i.test(b.textContent));
  if (undo) { click(win, undo); await wait(80); }
  ok('Undo puts the album back the way it was', albumOrder(win) === 't1,t2,t3,t4,t5', albumOrder(win));

  // ---- 5. A SECOND SORT READS THE CACHE, NOT THE NETWORK -------------------
  calls.length = 0;
  const again = await win.__scSortAlbumRealOrder(ALBUM);
  ok('a second sort succeeds', again === true);
  ok('and reads no network at all', calls.length === 0, calls.join(' | '));
  ok('and files the same order', albumOrder(win) === 't2,t1,t3,t5,t4', albumOrder(win));

  // ---- 6. THE SONG'S THREE DOTS --------------------------------------------
  win.navigate('library');
  const playlistsTab = win.document.querySelector('[data-playlist-name="All Songs"]');
  if (playlistsTab) { click(win, playlistsTab); await wait(40); }
  win.__scOpenSongActions('t1');
  await wait(60);
  const sheetRow = win.document.getElementById('songActionsAlbumReal');
  ok('the song menu carries the same sort outside Albums', !!sheetRow);
  ok('and names the album it would sort', sheetRow && sheetRow.textContent.indexOf(ALBUM) !== -1, sheetRow && sheetRow.textContent);
  ok('in the Organize group, not a group of its own',
    !!sheetRow && !!sheetRow.closest('.sc-sheet-group') && /Organize/.test(sheetRow.closest('.sc-sheet-group').textContent));
  if (sheetRow) { click(win, sheetRow); await wait(60); }
  ok('tapping it closes the sheet', win.document.getElementById('songActionsBackdrop').style.display === 'none',
    win.document.getElementById('songActionsBackdrop').style.display);

  // ---- 7. WHAT IT WILL NOT DO ----------------------------------------------
  albums['Unknown Record'] = { artist: 'Nobody', trackIds: ['t1', 't2'], createdAt: Date.now(), manual: true };
  storeEmpty = true;
  calls.length = 0;
  const nothing = await win.__scSortAlbumRealOrder('Unknown Record');
  ok('an album Album History has nothing for is not sorted', nothing === false);
  ok('and is left exactly as it was', albums['Unknown Record'].trackIds.join(',') === 't1,t2', albums['Unknown Record'].trackIds.join(','));
  ok('and says so instead of guessing', /not an album Album History knows/.test(toastText(win)), toastText(win));
  ok('it did ask the store first', calls.length > 0, String(calls.length));
  ok('and nothing was cached for it', !JSON.parse(win.localStorage.getItem('sidecut_albumRealOrder') || '{}')['unknown record']);

  storeEmpty = false;
  const missing = await win.__scSortAlbumRealOrder('No Such Album');
  ok('an album that is not in the library at all says so', missing === false && /No album called/.test(toastText(win)), toastText(win));

  // A one-song album has no order to sort, and must not pretend it did.
  albums['One Song'] = { artist: ARTIST, trackIds: ['t1'], createdAt: Date.now(), manual: true };
  const one = await win.__scSortAlbumRealOrder('One Song');
  ok('a one-song album says there is no order to sort', one === false && /one song/.test(toastText(win)), toastText(win));
  ok('and is untouched', albums['One Song'].trackIds.join(',') === 't1');

  console.log('album-real-order-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('album-real-order-check FAILED: ' + (e && e.stack || e));
  process.exit(1);
});
