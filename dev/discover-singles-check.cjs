// Discover Singles: what you fetched has to stay, and it has to be complete.
//
// Reported:
//   • "If you refetch singles or albums, the songs should stay after leaving the
//     singles popup — they shouldn't disappear."
//   • "I am missing songs in singles for various artists."
//   • "When selecting multiple songs and adding them to an existing album only the
//     albums that you made should show up — remove all albums that weren't made by
//     me from Albums, it's manual albums only."
//
// Three defects produced the first two:
//   1. window.__refetchSingles lives in the second (top-level) <script> and called
//      `fetchWithProxy` / `primaryArtistName` / `isSingleHidden` bare — those are
//      private to the app's IIFE, so every fetch threw a ReferenceError straight
//      into a swallow-all catch and reported "No singles found". It had already
//      deleted the saved snapshot on its first line, so a refetch meant: list
//      gone, nothing in its place.
//   2. It also used a different popup title ('✨ Singles') from the Discover button
//      ('🎵 Singles'), so the two could never share a saved list.
//   3. The singles list came from one relevance-ranked iTunes *song* search per
//      artist, which only ever returns that artist's most relevant ~200 tracks —
//      a prolific artist's other singles were simply never in the results.
//
// The suite drives the real page with a stubbed iTunes API and reads the real
// localStorage cache and DOM.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const SINGLES_KEY = 'discPopupCache_\u{1f3b5} Singles';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Test Artist', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Naina', artist: 'Test Artist', album: 'Naina - Single', duration: 190 },
  { id: 't3', name: 'Echo', artist: 'Second Artist', album: 'Echo - Single', duration: 170 },
  { id: 't4', name: 'Legacy Song', artist: 'Test Artist', album: 'Legacy Album', duration: 200 },
];

// A stubbed iTunes: an artist whose *song* search returns only album tracks (so
// the old code found no singles at all), plus a 1-track release that only shows up
// in the artist's own release list.
const ARTISTS = [
  {
    name: 'Test Artist', artistId: 9001,
    songs: [{ trackName: 'Luna', artistName: 'Test Artist', collectionName: 'MoonChild Era', trackCount: 12, trackId: 11, collectionId: 110, releaseDate: '2026-05-01T07:00:00Z', artworkUrl100: 'https://art/luna.jpg', previewUrl: 'https://p/luna.m4a' }],
    collections: [
      { collectionId: 210, collectionName: 'Naina - Single', trackCount: 1, artistName: 'Test Artist', releaseDate: '2026-06-02T07:00:00Z', artworkUrl100: 'https://art/naina.jpg' },
      { collectionId: 110, collectionName: 'MoonChild Era', trackCount: 12, artistName: 'Test Artist', releaseDate: '2026-05-01T07:00:00Z', artworkUrl100: 'https://art/mce.jpg' },
    ],
    tracks: { 210: { trackName: 'Naina', trackId: 77, previewUrl: 'https://p/naina.m4a', releaseDate: '2026-06-02T07:00:00Z' } },
  },
  {
    name: 'Second Artist', artistId: 9002,
    songs: [{ trackName: 'Echo', artistName: 'Second Artist', collectionName: 'Echo', trackCount: 1, trackId: 12, collectionId: 120, releaseDate: '2026-04-01T07:00:00Z', artworkUrl100: 'https://art/echo.jpg', previewUrl: 'https://p/echo.m4a' }],
    collections: [],
    tracks: {},
  },
];

function okJson(payload) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload), text: () => Promise.resolve(JSON.stringify(payload)) });
}
function makeApi() {
  const api = { dead: false, calls: [] };
  api.fetch = (url) => {
    const u = String(url);
    api.calls.push(u);
    if (api.dead) return Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({}) });
    let m = /lookup\?id=(\d+)&entity=song/.exec(u);
    if (m) {
      const cid = Number(m[1]);
      const owner = ARTISTS.find((a) => a.tracks[cid]);
      if (!owner) return okJson({ results: [] });
      return okJson({ results: [{ wrapperType: 'collection', collectionId: cid }, Object.assign({ wrapperType: 'track', collectionId: cid, artistName: owner.name }, owner.tracks[cid])] });
    }
    m = /lookup\?id=(\d+)&entity=album/.exec(u);
    if (m) {
      const owner = ARTISTS.find((a) => String(a.artistId) === m[1]);
      if (!owner) return okJson({ results: [] });
      return okJson({ results: owner.collections.map((c) => Object.assign({ wrapperType: 'collection' }, c)) });
    }
    if (/entity=musicArtist/.test(u)) {
      const term = decodeURIComponent((/term=([^&]*)/.exec(u) || [])[1] || '');
      return okJson({ results: ARTISTS.filter((a) => term.indexOf(a.name) !== -1).map((a) => ({ artistId: a.artistId, artistName: a.name })) });
    }
    if (/entity=song/.test(u)) {
      const term = decodeURIComponent((/term=([^&]*)/.exec(u) || [])[1] || '');
      const owner = ARTISTS.find((a) => term.indexOf(a.name) !== -1);
      return okJson({ results: owner ? owner.songs : [] });
    }
    return okJson({ results: [] });
  };
  return api;
}

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

// 'Mine' is an album made by hand (the app records manual: true for every hand
// action). 'Legacy' and 'Auto' are what the automatic paths left behind — one
// flagged, one from before the flag existed.
const ALBUMS = {
  'Mine': { artist: 'Test Artist', trackIds: ['t1', 't2'], createdAt: 1, manual: true },
  'Legacy': { artist: 'Test Artist', trackIds: ['t4'], createdAt: 2 },
  'Auto': { artist: 'Test Artist', trackIds: ['t1'], createdAt: 3, auto: true },
};
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3', 't4'], Favorites: [] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS)) }],
      ['theme', { key: 'theme', value: 'coral' }],
    ]),
  };
  function tx(store) {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { data[store].set(v && v.key !== undefined ? v.key : v.id, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
    });
    return t;
  }
  return { _data: data, open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n), close() {} }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
}

async function boot({ pinned = ['Test Artist'] } = {}) {
  const api = makeApi();
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not load/i.test(m)) errors.push(m); });
  vc.on('warn', () => {});
  vc.on('error', (...a) => errors.push(a.map(String).join(' ').split('\n')[0]));
  const idb = fakeIndexedDB();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = idb;
      win.fetch = (url) => api.fetch(url);
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      try { win.localStorage.setItem('sidecut_premium', JSON.stringify({ active: true, granted: 1 })); } catch (e) {}
      win.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web', nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}), Plugins: {} };
    },
  });
  await wait(3000);
  const win = dom.window;
  win.__scErrors = errors;
  for (const name of pinned) { try { win.__scTogglePinArtist(name, ''); } catch (e) {} }
  await wait(700);
  return { dom, win, api, errors, idb };
}

const doc = (win) => win.document;
const cacheRaw = (win) => { try { return win.localStorage.getItem(SINGLES_KEY); } catch (e) { return null; } };
const cacheBody = (win) => { const r = cacheRaw(win); try { return r ? JSON.parse(r).body : ''; } catch (e) { return ''; } };
const popupBody = (win) => { const b = doc(win).getElementById('discPopupBody'); return b ? b.innerHTML : ''; };
const popupTitle = (win) => { const t = doc(win).getElementById('discPopupTitle'); return t ? t.textContent : ''; };
async function openSingles(win) {
  const btn = doc(win).getElementById('discoverSingles');
  if (btn) btn.click();
  await wait(2500);
}
async function refetchSingles(win) {
  if (typeof win.__refetchSingles === 'function') await win.__refetchSingles();
  await wait(400);
}

(async () => {
  // ---------------------------------------------------------------------
  console.log('\n\u2014 a refetch actually fetches, and saves where the button looks \u2014');
  {
    const { win } = await boot();
    await refetchSingles(win);
    ok('the popup shows the refetched singles', /Naina/.test(popupBody(win)), popupBody(win).replace(/\s+/g, ' ').slice(0, 120));
    ok('it opens as the same popup the Discover button uses', popupTitle(win) === '\u{1f3b5} Singles', popupTitle(win));
    ok('and it is saved under that same key', /Naina/.test(cacheBody(win)), cacheBody(win).replace(/\s+/g, ' ').slice(0, 120));
    ok('no page errors during the refetch', errors(win).length === 0, errors(win).slice(0, 2).join(' | '));
    win.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 a refetch that comes back empty must not eat the list \u2014');
  {
    const { win, api } = await boot();
    await refetchSingles(win);
    const before = cacheBody(win);
    ok('there is a saved list to protect', /Naina/.test(before));
    api.dead = true;                       // the API starts refusing (rate limit / offline)
    await refetchSingles(win);
    ok('the popup still shows the song', /Naina/.test(popupBody(win)), popupBody(win).replace(/\s+/g, ' ').slice(0, 120));
    ok('the saved list is still there', /Naina/.test(cacheBody(win)));
    ok('it is not replaced by "no singles found"', !/No singles found/.test(popupBody(win)));
    win.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 refetch, leave the popup, come back: the songs are still there \u2014');
  {
    const { win, api } = await boot();
    await openSingles(win);
    ok('the list opened with the song in it', /Naina/.test(popupBody(win)));
    const refetchBtn = doc(win).getElementById('singlesRefetchBtn');
    ok('the popup offers a refetch button', !!refetchBtn);
    if (refetchBtn) refetchBtn.click();
    await wait(2500);
    // The API now goes quiet, exactly like a rate-limited iTunes while the user
    // closes the popup and opens it again.
    api.dead = true;
    win.closeDiscoverPopup();
    await wait(200);
    await openSingles(win);
    ok('reopening still shows the singles', /Naina/.test(popupBody(win)), popupBody(win).replace(/\s+/g, ' ').slice(0, 140));
    const ov = doc(win).getElementById('discPopupOverlay');
    ok('the popup really is on screen', !!ov && ov.style.display !== 'none', ov ? ov.style.display : 'missing');
    ok('nothing was swapped for an empty popup', !/No singles found/.test(popupBody(win)));
    ok('no refetch was needed to show them', api.calls.filter((u) => /entity=song|entity=musicArtist/.test(u)).length < 8,
       api.calls.length + ' api calls');
    win.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 singles the song search never returns are still found \u2014');
  {
    const { win } = await boot();
    const fn = win.__scFetchArtistSingles;
    ok('the one shared singles fetcher is exposed', typeof fn === 'function');
    let rows = [];
    if (typeof fn === 'function') rows = await fn('Test Artist');
    const names = rows.map((r) => r.trackName);
    ok('the artist\u2019s one-track release is included', names.indexOf('Naina') !== -1, JSON.stringify(names));
    ok('an album track is not mistaken for a single', names.indexOf('Luna') === -1, JSON.stringify(names));
    const naina = rows.find((r) => r.trackName === 'Naina');
    ok('and it carries its preview so it can be played', !!naina && !!naina.previewUrl, naina ? naina.previewUrl : 'missing');
    ok('it carries a date and cover for the row', !!naina && !!naina.releaseDate && !!naina.artworkUrl100,
       naina ? naina.releaseDate + ' ' + naina.artworkUrl100 : 'missing');
    win.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 a per-artist refresh keeps the other artists \u2014');
  {
    const { win, api } = await boot({ pinned: ['Test Artist', 'Second Artist'] });
    await openSingles(win);
    const groups = doc(win).querySelectorAll('#discPopupBody .dp-ah-artist');
    ok('both artists are listed', groups.length === 2, String(groups.length));
    if (groups.length === 2 && typeof win.__singlesRefreshArtistGroup === 'function') {
      await win.__singlesRefreshArtistGroup(groups[0]);
      await wait(400);
      ok('the refreshed artist kept its rows', /Naina/.test(popupBody(win)));
      ok('the other artist is still listed too', /Echo/.test(popupBody(win)), popupBody(win).replace(/\s+/g, ' ').slice(0, 160));
      api.dead = true;
      win.closeDiscoverPopup();
      await wait(200);
      await openSingles(win);
      ok('reopening after a ↻ still shows the refreshed artist', /Naina/.test(popupBody(win)));
      ok('and the artist that was not refreshed', /Echo/.test(popupBody(win)), popupBody(win).replace(/\s+/g, ' ').slice(0, 160));
    } else {
      ok('the refreshed artist kept its rows', false, 'no groups / no hook');
    }
    win.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 Albums is the albums you made, and the picker offers only those \u2014');
  {
    const { win, idb } = await boot();
    const visible = (typeof win.__scVisibleAlbumNames === 'function') ? win.__scVisibleAlbumNames() : null;
    ok('only the hand-made album is listed', JSON.stringify(visible) === JSON.stringify(['Mine']), JSON.stringify(visible));
    ok('the flagged auto album is out', !(visible || []).includes('Auto'));
    ok('the legacy unflagged album is out too', !(visible || []).includes('Legacy'));
    const auto = (typeof win.__scAutoAlbumNames === 'function') ? win.__scAutoAlbumNames() : [];
    ok('and they are not deleted \u2014 they are in the "not created by you" list',
       auto.sort().join(',') === 'Auto,Legacy', JSON.stringify(auto));
    ok('nothing was removed from storage', Object.keys(idb._data.meta.get('userAlbums').value).sort().join(',') === 'Auto,Legacy,Mine',
       Object.keys(idb._data.meta.get('userAlbums').value).join(','));

    // Albums tab cards.
    win.navigate('albums');
    await wait(700);
    const cards = Array.from(doc(win).querySelectorAll('#listPane [data-album-name]')).map((c) => c.dataset.albumName);
    ok('the Albums tab shows only your album', JSON.stringify(cards) === JSON.stringify(['Mine']), JSON.stringify(cards));

    // Multi-select -> Add to album.
    win.__scEnterSelectMode(['t3']);
    await wait(200);
    const addBtn = doc(win).getElementById('selectAlbumAddBtn');
    ok('the multi-select bar offers Add to album', !!addBtn);
    if (addBtn) {
      addBtn.click();
      await wait(300);
      const picks = Array.from(doc(win).querySelectorAll('body > div.modal-backdrop .modal button'))
        .map((b) => b.textContent.replace(/\s+/g, ' ').trim());
      ok('the picker offers your album', picks.some((t) => /^Mine \(/.test(t)), JSON.stringify(picks));
      ok('the picker offers no album you did not make',
         !picks.some((t) => /^(Legacy|Auto) \(/.test(t)),
         JSON.stringify(picks));
    }
    ok('no page errors', errors(win).length === 0, errors(win).slice(0, 2).join(' | '));
    win.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

function errorsOf(win) {
  return ((win && win.__scErrors) || []).filter(Boolean);
}
const errors = errorsOf;
