// 80.2.5 - ALBUMS ONLY COME FROM YOU, AND AN ALBUM CAN BE DELETED FROM ITS DOTS.
//
// The owner: "sometimes they're making random albums with singles and stuff idk
// why it shouldn't be doing that and in the album 3 dots it should have an option
// to delete the album with confirmation".
//
// Drives a real boot of the patched page, on a library whose FILES carry album
// tags nobody ever made an album for - the shape that produced the cards nobody
// asked for:
//
//   * a launch invents no album from a tag, whatever the tag is and however many
//     songs carry it;
//   * the one thing a launch puts back is an album the app archived, with the song
//     list it had, and a name you deleted stays deleted;
//   * the record tap in the now bar opens an album you have and never makes one;
//   * the album card's three dots carries Delete album, which asks first and does
//     nothing until you say so;
//   * Delete removes the album, tombstones it, leaves every song and album tag
//     alone, and stays deleted on the next launch;
//   * Undo puts the album back exactly as it was, tombstone included.
//
//   node dev/album-auto-delete-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ---- the library -----------------------------------------------------------
// Two songs on a real album; then the tags that used to become cards on their own:
// one song whose album field is its own name, two songs sharing a tag, and one
// loose song that the record tap used to turn into an album.
const ALBUM = 'Real Album';
const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Test Artist', album: ALBUM, duration: 180 },
  { id: 't2', name: 'Vibe', artist: 'Test Artist', album: ALBUM, duration: 160 },
  { id: 't3', name: 'One', artist: 'Test Artist', album: 'One', duration: 150 },
  { id: 't4', name: 'Two', artist: 'Test Artist', album: 'Shared Tag', duration: 170 },
  { id: 't5', name: 'Three', artist: 'Test Artist', album: 'Shared Tag', duration: 175 },
  { id: 't6', name: 'Loose', artist: 'Test Artist', album: 'Loose Tag', duration: 165 },
];
const ALBUMS_START = { [ALBUM]: { artist: 'Test Artist', trackIds: ['t1', 't2'], createdAt: 5, manual: true } };
const PLAYLISTS_START = { 'All Songs': TRACKS.map((t) => t.id), Favorites: [] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_START)) }],
      ['albumOrder', { key: 'albumOrder', value: [ALBUM] }],
      ['pinnedReleases', { key: 'pinnedReleases', value: {} }],
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
    win.navigator.vibrate = () => true;
    win.localStorage.clear();
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 120, clientY: 300 }));
const store = () => { const m = idb._data.meta.get('userAlbums'); return (m && m.value) || {}; };
const order = () => { const m = idb._data.meta.get('albumOrder'); return (m && m.value) || []; };
const tombstones = (win) => { try { return JSON.parse(win.localStorage.getItem('sidecut_albumsUserDeleted') || '{}'); } catch (e) { return {}; } };
const archive = (win) => { try { return JSON.parse(win.localStorage.getItem('sidecut_albumsArchive') || '{}'); } catch (e) { return {}; } };
const toastText = (win) => { const t = win.document.getElementById('toast'); return t ? (t.textContent || '').trim() : ''; };
const toastUndo = (win) => Array.from(win.document.querySelectorAll('#toast button')).find((b) => /undo/i.test(b.textContent)) || null;
const popupTitle = (win) => { const t = win.document.getElementById('discPopupTitle'); return t ? (t.textContent || '').trim() : ''; };
const popupOpen = (win) => { const ov = win.document.getElementById('discPopupOverlay'); return !!ov && ov.style.display !== 'none'; };
const cardNames = (win) => Array.from(win.document.querySelectorAll('#listPane [data-album-name]')).map((c) => c.dataset.albumName);
const menuRows = (win) => Array.from(win.document.querySelectorAll('#discPopupBody .sc-alm-row'));

async function openAlbums(win) {
  win.navigate('albums');
  await wait(900);
}
async function openCardMenu(win) {
  await openAlbums(win);
  const kebab = win.document.querySelector('[data-album-kebab="' + ALBUM + '"]') || win.document.querySelector('[data-album-kebab]');
  if (!kebab) return null;
  click(win, kebab);
  await wait(120);
  return kebab;
}

(async () => {
  const win = dom.window;
  for (let i = 0; i < 160 && typeof win.__scAlbumsRecoverDeleted !== 'function'; i++) await wait(250);
  await wait(1200);

  ok('the release hook is on the page', typeof win.__scAlbumDeletePrompt === 'function');
  ok('the page runs 80.2.5', /const APP_VERSION = '80\.2\.5';/.test(html));
  if (typeof win.__scAlbumDeletePrompt !== 'function') {
    console.log('album-auto-delete-check: ' + pass + ' passed, ' + (fail + 1) + ' failed');
    process.exit(1);
  }

  console.log('\n- a launch invents no album from a tag -');
  const after = store();
  ok('the album that exists is still the only album', JSON.stringify(Object.keys(after)) === JSON.stringify([ALBUM]), JSON.stringify(Object.keys(after)));
  ok('the tag two songs share made no album', !after['Shared Tag'], JSON.stringify(Object.keys(after)));
  ok('the tag that is a song name made no album', !after['One'], JSON.stringify(Object.keys(after)));
  ok('the loose song tag made no album', !after['Loose Tag'], JSON.stringify(Object.keys(after)));
  ok('the album order holds one name', JSON.stringify(order()) === JSON.stringify([ALBUM]), JSON.stringify(order()));
  await openAlbums(win);
  ok('the Albums tab shows only the album that exists', JSON.stringify(cardNames(win)) === JSON.stringify([ALBUM]), JSON.stringify(cardNames(win)));
  ok('every song is still in the library', win.__scGetAllTracks().length === TRACKS.length, String(win.__scGetAllTracks().length));
  ok('and every album tag is untouched', win.__scGetAllTracks().map((t) => t.album).join(',') === TRACKS.map((t) => t.album).join(','),
    win.__scGetAllTracks().map((t) => t.album).join(','));

  console.log('\n- the one thing a launch puts back is what the app took -');
  win.localStorage.setItem('sidecut_albumsArchive', JSON.stringify({
    'Taken By The Sweep': { at: 1, entry: { artist: 'Test Artist', trackIds: ['t4', 't5'], createdAt: 9, auto: true } },
    'Deleted On Purpose': { at: 2, entry: { artist: 'Test Artist', trackIds: ['t3'] } },
  }));
  win.localStorage.setItem('sidecut_albumsUserDeleted', JSON.stringify({ 'deleted on purpose': 1 }));
  win.__scAlbumsRecoverDeleted();
  await wait(500);
  const rec = store();
  ok('the archived album is back', !!rec['Taken By The Sweep'], JSON.stringify(Object.keys(rec)));
  ok('with the song list it had', rec['Taken By The Sweep'] && rec['Taken By The Sweep'].trackIds.join(',') === 't4,t5',
    rec['Taken By The Sweep'] && rec['Taken By The Sweep'].trackIds.join(','));
  ok('and it is marked yours, with no stale flag',
    rec['Taken By The Sweep'] && rec['Taken By The Sweep'].manual === true && !rec['Taken By The Sweep'].auto,
    JSON.stringify(rec['Taken By The Sweep'] && [rec['Taken By The Sweep'].manual, rec['Taken By The Sweep'].auto]));
  ok('it is in the album order', order().indexOf('Taken By The Sweep') !== -1, JSON.stringify(order()));
  ok('and it left the archive (restored, not copied)', !archive(win)['Taken By The Sweep'], JSON.stringify(Object.keys(archive(win))));
  ok('a name you deleted is not restored, even from the archive', !rec['Deleted On Purpose'], JSON.stringify(Object.keys(rec)));

  console.log('\n- the record tap never makes an album -');
  let played = null;
  try { win.playFromList(['t6'], 't6'); } catch (e) { played = e; }
  await wait(300);
  ok('a song with a tag but no album is playing', played === null, played && played.message);
  await openAlbums(win);
  const beforeTap = JSON.stringify(Object.keys(store()).sort());
  try { win.__scOpenAlbumForCurrentSong(); } catch (e) { played = e; }
  await wait(900);
  ok('the record tap runs', played === null, played && played.message);
  ok('and the tag it read made no album', !store()['Loose Tag'] && !store()['One'], JSON.stringify(Object.keys(store())));
  ok('nothing in the store changed at all', JSON.stringify(Object.keys(store()).sort()) === beforeTap,
    beforeTap + ' -> ' + JSON.stringify(Object.keys(store()).sort()));
  ok('the loose song is still just a song', win.__scGetAllTracks().find((t) => t.id === 't6').album === 'Loose Tag');

  console.log('\n- the album three dots carries Delete album -');
  ok('the card menu opens', !!(await openCardMenu(win)));
  const rows = menuRows(win);
  ok('the menu has three rows now', rows.length === 3, String(rows.length));
  ok('the first two are still the sorts',
    rows[0] && /real order/i.test(rows[0].textContent) && rows[1] && /by hand/i.test(rows[1].textContent),
    rows.map((r) => r.textContent.trim().slice(0, 24)).join(' | '));
  ok('and the third is Delete album', rows[2] && rows[2].getAttribute('data-alm') === 'delete' && /Delete album/.test(rows[2].textContent),
    rows[2] && rows[2].textContent);

  console.log('\n- and it asks first -');
  click(win, rows[2]);
  await wait(200);
  ok('the confirmation opens', popupOpen(win) && popupTitle(win) === 'Delete album', popupTitle(win));
  const body = win.document.getElementById('discPopupBody').textContent;
  ok('it names the album', /Real Album/.test(body), body.slice(0, 80));
  ok('and says the songs stay', /2 songs stay in your library/.test(body), body.slice(0, 160));
  ok('it offers Keep it and Delete album', !!win.document.getElementById('scAlbDelCancel') && !!win.document.getElementById('scAlbDelGo'));
  ok('nothing is deleted until you say so', !!store()[ALBUM], JSON.stringify(Object.keys(store())));

  click(win, win.document.getElementById('scAlbDelCancel'));
  await wait(200);
  ok('Keep it closes the sheet', !popupOpen(win));
  ok('and the album is untouched', !!store()[ALBUM] && order().indexOf(ALBUM) !== -1, JSON.stringify(Object.keys(store())));
  ok('with no tombstone written', !tombstones(win)['real album'], JSON.stringify(tombstones(win)));

  console.log('\n- Delete album deletes it, and leaves the songs -');
  await openCardMenu(win);
  click(win, menuRows(win)[2]);
  await wait(200);
  click(win, win.document.getElementById('scAlbDelGo'));
  await wait(400);
  ok('the album is gone', !store()[ALBUM], JSON.stringify(Object.keys(store())));
  ok('and left the album order', order().indexOf(ALBUM) === -1, JSON.stringify(order()));
  ok('the name is tombstoned, so no launch can bring it back', !!tombstones(win)['real album'], JSON.stringify(tombstones(win)));
  ok('the songs are all still in the library', win.__scGetAllTracks().length === TRACKS.length, String(win.__scGetAllTracks().length));
  ok('their album tags are untouched', win.__scGetAllTracks().filter((t) => t.album === ALBUM).length === 2,
    String(win.__scGetAllTracks().filter((t) => t.album === ALBUM).length));
  ok('the delete says what happened', /Deleted "Real Album"/.test(toastText(win)), toastText(win));
  ok('and carries Undo', !!toastUndo(win));
  ok('deleting from a card does not open Manage albums over the list', !popupOpen(win) && popupTitle(win) !== 'Manage albums',
    popupTitle(win) + ' open=' + popupOpen(win));
  win.__scAlbumsRecoverDeleted();
  ok('and the next launch (the same pass) leaves it deleted', !store()[ALBUM], JSON.stringify(Object.keys(store())));

  console.log('\n- Undo puts it back, exactly -');
  const undo = toastUndo(win);
  if (undo) { click(win, undo); await wait(300); }
  ok('the album is back', !!store()[ALBUM], JSON.stringify(Object.keys(store())));
  ok('with the same songs', store()[ALBUM] && store()[ALBUM].trackIds.join(',') === 't1,t2', store()[ALBUM] && store()[ALBUM].trackIds.join(','));
  ok('in its place in the album order', order().indexOf(ALBUM) !== -1, JSON.stringify(order()));
  ok('the tombstone is gone with it', !tombstones(win)['real album'], JSON.stringify(tombstones(win)));
  ok('and the toast says so', /Put "Real Album" back/.test(toastText(win)), toastText(win));
  await openAlbums(win);
  ok('the card is on the Albums tab again', cardNames(win).indexOf(ALBUM) !== -1, JSON.stringify(cardNames(win)));

  console.log('\n- the quiet delete the panel path uses -');
  ok('the quiet hook exists', typeof win.__scDeleteAlbumQuiet === 'function');
  win.__scDeleteAlbumQuiet('Taken By The Sweep');
  ok('it deletes without a toast', !store()['Taken By The Sweep'], JSON.stringify(Object.keys(store())));
  ok('and it still tombstones', !!tombstones(win)['taken by the sweep'], JSON.stringify(tombstones(win)));

  const real = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  console.log('\nalbum-auto-delete-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('album-auto-delete-check FAILED: ' + (e && e.stack || e));
  process.exit(1);
});
