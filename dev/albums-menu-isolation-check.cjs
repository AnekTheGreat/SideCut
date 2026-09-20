// "Why does Albums still have a connection to one of my playlists?" — the Albums
// tab's ⋮ menu was drawing playlist-scoped entries that acted on whichever
// playlist happened to be open BEHIND the tab:
//   • "Clear playlist"  → deleteAllInView()'s albums branch, which emptied every
//                         album of every one of its songs (under a playlist label)
//   • "Delete playlist" → deleted the hidden open playlist by name
//   • "DJ Mode: ..."    → flipped the DJ-mode setting of that hidden playlist
//   • "Export albums"   → exportPlaylist(), which zips playlists[activePlaylist]
//                         and even names the file after it
// This suite drives the real page: it opens the real ⋮ menu on the Albums tab and
// asserts nothing on it can reach a playlist, then proves Export albums exports
// the albums, and that a playlist's own menu still has all of the above.
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
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 210 },
  { id: 't5', name: 'Legend', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 190 },
  { id: 't6', name: 'Tension', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 200 },
];
// Two albums made by hand, plus one the app created on its own (must stay out).
const ALBUMS_START = {
  'My Mix': { artist: 'Various Artists', trackIds: ['t1', 't4'], createdAt: 1, manual: true },
  'Late Night': { artist: 'Diljit Dosanjh', trackIds: ['t5', 't6'], createdAt: 2, manual: true },
  'Tag Album': { artist: 'Diljit Dosanjh', trackIds: ['t2'], createdAt: 3, auto: true },
};
// 'Punjabi Gaane' is the playlist that used to leak into Albums: it is left as
// the open playlist while the albums tab is shown.
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5', 't6'], Favorites: [], 'Punjabi Gaane': ['t1', 't2', 't3'] };
const OPEN_PLAYLIST = 'Punjabi Gaane';

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_START)) }],
      ['lastUsedPlaylist', { key: 'lastUsedPlaylist', value: OPEN_PLAYLIST }],
      ['libraryMode', { key: 'libraryMode', value: 'playlists' }],
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
    open() {
      const req = { error: null };
      const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) };
      setTimeout(() => {
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        req.result = db;
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
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
    win.confirm = () => true;
  },
});

const storedPlaylists = () => { const m = idb._data.meta.get('playlists'); return m ? m.value : undefined; };
const ourPlaylists = () => {
  const p = storedPlaylists() || {};
  return { 'All Songs': p['All Songs'], Favorites: p.Favorites, [OPEN_PLAYLIST]: p[OPEN_PLAYLIST] };
};
const menuTexts = (win) => Array.from(win.document.querySelectorAll('#songActionsList button'))
  .map((b) => b.textContent.replace(/\s+/g, ' ').trim());
const hasMenu = (texts, re) => texts.some((t) => re.test(t));
const openKebab = async (win) => {
  const btn = win.document.getElementById('listMoreBtn');
  if (!btn) return false;
  btn.click();
  await wait(60);
  return true;
};
const pickPlaylistTab = async (win, name) => {
  const tab = Array.from(win.document.querySelectorAll('#tabs .tab')).find((el) => el.dataset.playlistName === name);
  if (!tab) return false;
  tab.click();
  await wait(400);
  return true;
};

let toasts = [];

(async () => {
  const win = dom.window;
  const realToast = win.toast;
  await wait(3200);
  win.toast = function (m) { toasts.push(String(m)); return realToast ? realToast.apply(null, arguments) : undefined; };

  const headerText = () => {
    const h = win.document.querySelector('#listPane .pane-header');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  };

  console.log('\n— the reported session: a playlist is open, then you tap Albums —');
  win.navigate('playlists');
  await wait(400);
  ok('the playlist is the open view', await pickPlaylistTab(win, OPEN_PLAYLIST) && headerText().indexOf(OPEN_PLAYLIST) !== -1, headerText());
  win.navigate('albums');
  await wait(800);
  ok('the albums tab says Albums, not the playlist', headerText().indexOf('Albums') !== -1, headerText());
  console.log('\n— the Albums tab menu cannot reach a playlist —');
  ok('we are on the Albums tab', win.__scGetLibraryMode && win.__scGetLibraryMode() === 'albums');
  ok('the albums tab shows your hand-made albums only',
     win.__scAutoAlbumNames && win.__scAutoAlbumNames().length === 1, JSON.stringify(win.__scAutoAlbumNames ? win.__scAutoAlbumNames() : null));
  const opened = await openKebab(win);
  ok('the ⋮ menu opens on the Albums tab', opened && win.document.getElementById('songActionsBackdrop').style.display === 'flex');
  const albumMenu = menuTexts(win);
  console.log('    Albums menu: ' + JSON.stringify(albumMenu));
  ok('no "Clear playlist" entry in Albums', !hasMenu(albumMenu, /clear playlist/i));
  ok('no library-wide "Delete all songs" either', !hasMenu(albumMenu, /delete all songs/i));
  ok('no "Delete playlist" entry in Albums', !hasMenu(albumMenu, /delete playlist/i));
  ok('no playlist-scoped DJ Mode entry in Albums', !hasMenu(albumMenu, /dj mode/i));
  ok('the album actions are all still there',
     hasMenu(albumMenu, /export albums/i) && hasMenu(albumMenu, /manage albums/i) && hasMenu(albumMenu, /reorder an album/i),
     JSON.stringify(albumMenu));
  // The destructive entries were the dangerous half: "Clear playlist" ran
  // deleteAllInView(), whose albums branch empties every album.
  win.document.getElementById('songActionsBackdrop').style.display = 'none';

  console.log('\n— "Export albums" exports the albums, not the open playlist —');
  await openKebab(win);
  const exportBtn = Array.from(win.document.querySelectorAll('#songActionsList button')).find((b) => /export albums/i.test(b.textContent));
  ok('an Export albums button exists', !!exportBtn);
  if (exportBtn) {
    exportBtn.click();
    await wait(80);
    const body = (win.document.getElementById('exportConfirmBody') || {}).textContent || '';
    console.log('    confirm: ' + body.slice(0, 160));
    ok('the export confirm is about albums', /album/i.test(body));
    ok('it never names the open playlist', body.indexOf(OPEN_PLAYLIST) === -1, body);
    ok('it counts the songs of your hand-made albums (4, not the auto one)',
       /\b4 songs?\b/.test(body), body.slice(0, 120));
    ok('it names the two albums you made', /\b2 albums?\b/.test(body), body.slice(0, 120));
  }
  win.document.getElementById('exportConfirmBackdrop').style.display = 'none';
  win.document.getElementById('songActionsBackdrop').style.display = 'none';

  console.log('\n— nothing above touched a playlist —');
  ok('playlists are byte-for-byte unchanged', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  ok('the album entries are unchanged too',
     eq(idb._data.meta.get('userAlbums').value, ALBUMS_START), JSON.stringify(idb._data.meta.get('userAlbums').value));

  console.log('\n— a playlist keeps its own playlist actions —');
  win.navigate('playlists');
  await wait(400);
  const picked = await pickPlaylistTab(win, OPEN_PLAYLIST);
  ok('the playlist tab is selectable', picked);
  await openKebab(win);
  const plMenu = menuTexts(win);
  console.log('    Playlist menu: ' + JSON.stringify(plMenu));
  ok('the playlist menu still offers "Clear playlist"', hasMenu(plMenu, /clear playlist/i));
  ok('the playlist menu still offers "Delete playlist"', hasMenu(plMenu, /delete playlist/i));
  ok('the playlist menu still offers the DJ Mode toggle', hasMenu(plMenu, /dj mode/i));
  ok('the playlist menu exports the playlist (not albums)', hasMenu(plMenu, /export playlist/i));
  win.document.getElementById('songActionsBackdrop').style.display = 'none';

  console.log('\n— and in the playlist view the export still targets that playlist —');
  await openKebab(win);
  const plExport = Array.from(win.document.querySelectorAll('#songActionsList button')).find((b) => /export playlist/i.test(b.textContent));
  ok('an Export playlist button exists', !!plExport);
  if (plExport) {
    plExport.click();
    await wait(80);
    const body = (win.document.getElementById('exportConfirmBody') || {}).textContent || '';
    ok('the playlist export names the playlist', body.indexOf(OPEN_PLAYLIST) !== -1, body.slice(0, 120));
  }
  win.document.getElementById('exportConfirmBackdrop').style.display = 'none';
  win.document.getElementById('songActionsBackdrop').style.display = 'none';

  const real = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1 && e.indexOf('Not implemented: HTMLCanvasElement') === -1);
  ok('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
