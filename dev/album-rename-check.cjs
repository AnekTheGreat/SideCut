// Album rename audit: proves Rename (Albums tab ⋮ → Manage albums) moves every
// song carrying the old album tag — not just the ones the saved entry lists — so a
// later-tagged song cannot come back as a ghost one-song album beside the renamed
// one, and proves the whole operation never touches a playlist.
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
// v58.8.1: the manual-only migration adds an `auto` flag to an entry that is nothing
// but a copy of a file-tag group (it is kept out of the Albums tab, not deleted). So
// "untouched" comparisons have to compare what an album IS — its songs and artist —
// not the bookkeeping fields the app maintains about it.
function contentOf(a) {
  const out = {};
  Object.keys(a || {}).sort().forEach((k) => {
    const e = a[k] || {};
    out[k] = { artist: e.artist, trackIds: e.trackIds };
  });
  return out;
}

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

// t3 carries the 'MoonChild Era' tag but is NOT in the saved entry — exactly the
// shape left behind when a tagged file is imported after the album was saved.
const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Other One', artist: 'Someone', album: 'Other Album', duration: 100 },
  { id: 't5', name: 'Other Two', artist: 'Someone', album: 'Other Album', duration: 120 },
];
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], 'Faves From One Album': ['t1', 't2', 't3'] };
const ALBUMS_START = {
  'MoonChild Era': { trackIds: ['t1', 't2'], artist: 'Diljit Dosanjh', manual: true },
  'Other Album': { trackIds: ['t4', 't5'], artist: 'Someone' },
};

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
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
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m)) errors.push(m); });

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
function storedMeta(key) { const m = idb._data.meta.get(key); return m ? m.value : undefined; }
function albums() { return storedMeta('userAlbums'); }
function ourPlaylists() {
  const p = storedMeta('playlists') || {};
  return { 'All Songs': p['All Songs'], Favorites: p['Favorites'], 'Faves From One Album': p['Faves From One Album'] };
}
function tags() {
  const out = {};
  idb._data.tracks.forEach((t, id) => { out[id] = t.album; });
  return out;
}
function cards(win) {
  return Array.from(win.document.querySelectorAll('[data-album-name]'))
    .map((c) => ({ name: c.dataset.albumName, n: c.querySelectorAll('.track').length, ids: (c.dataset.albumIds || '').split(',').filter(Boolean) }));
}
// Open Albums tab ⋮ → Manage albums, the same way a user does.
async function openManage(win) {
  win.navigate('albums');
  await wait(800);
  win.document.getElementById('listMoreBtn').click();
  await wait(350);
  const manage = Array.from(win.document.querySelectorAll('#songActionsList button')).find((b) => /Manage albums/.test(b.textContent));
  if (!manage) return false;
  manage.click();
  await wait(600);
  return true;
}
function closeManage(win) {
  const cancel = win.document.getElementById('songActionsCancel');
  if (cancel) cancel.click();
}
// Drive the real rename prompt (modalPrompt is closure-local, so the DOM is the
// only honest way in).
async function rename(win, newName, index) {
  const btn = win.document.querySelectorAll('.mgr-alb-rename')[index || 0];
  if (!btn) return 'no-button';
  btn.click();
  await wait(350);
  const input = win.document.getElementById('_modalPromptInput');
  if (!input) return 'no-prompt';
  const prefill = input.value;
  input.value = newName;
  win.document.getElementById('_modalPromptOk').click();
  await wait(800);
  return prefill;
}

(async () => {
  const win = dom.window;
  await wait(3000);
  const realToast = win.toast;
  let toasts = [];
  try { win.toast = function (m) { toasts.push(String(m)); return realToast ? realToast.apply(null, arguments) : undefined; }; } catch (e) {}

  console.log('\n— baseline —');
  ok('the saved album only knows 2 of the 3 tagged songs', eq(albums()['MoonChild Era'].trackIds, ['t1', 't2']),
     JSON.stringify(albums()['MoonChild Era']));

  console.log('\n— Manage albums reaches Rename —');
  ok('the Albums tab ⋮ opens Manage albums', await openManage(win));
  let rows = Array.from(win.document.querySelectorAll('.mgr-alb-row')).map((r) => r.textContent.trim().replace(/\s+/g, ' '));
  // v58.8.1: an entry that is nothing but a copy of a file-tag group is listed under
  // "Not created by you" with its own Rename / Delete / It-is-mine controls, instead
  // of being mixed in with the albums you made.
  const visRename = win.document.querySelectorAll('.mgr-alb-rename').length;
  const hidRename = win.document.querySelectorAll('.mgr-alb-rename-auto').length;
  ok('the album you made is listed with a Rename button', visRename === 1, 'visible rename buttons=' + visRename);
  ok('the auto-added album is listed separately, with Rename and It-is-mine',
     hidRename === 1 && win.document.querySelectorAll('.mgr-alb-restore').length === 1,
     'hidden rename=' + hidRename + ' restore=' + win.document.querySelectorAll('.mgr-alb-restore').length);
  ok('each row names the album', rows.some((r) => r.startsWith('MoonChild Era')), JSON.stringify(rows));
  closeManage(win);
  await wait(200);

  console.log('\n— cancel changes nothing —');
  await openManage(win);
  const btn0 = win.document.querySelectorAll('.mgr-alb-rename')[0];
  btn0.click();
  await wait(350);
  const prefill = win.document.getElementById('_modalPromptInput').value;
  ok('the prompt is prefilled with the current album name', prefill === 'MoonChild Era', JSON.stringify(prefill));
  win.document.getElementById('_modalPromptCancel').click();
  await wait(600);
  ok('cancelling leaves the album untouched', eq(contentOf(albums()), contentOf(ALBUMS_START)), JSON.stringify(albums()));
  ok('cancelling leaves every album tag untouched', eq(tags(), { t1: 'MoonChild Era', t2: 'MoonChild Era', t3: 'MoonChild Era', t4: 'Other Album', t5: 'Other Album' }), JSON.stringify(tags()));

  console.log('\n— an empty name is refused —');
  await rename(win, '   ');
  ok('a blank name is ignored', eq(contentOf(albums()), contentOf(ALBUMS_START)), JSON.stringify(albums()));

  console.log('\n— a duplicate name is refused —');
  await rename(win, 'Other Album');
  ok('two albums can never share a name', eq(contentOf(albums()), contentOf(ALBUMS_START)), JSON.stringify(albums()));

  console.log('\n— rename moves every song carrying the old tag —');
  await rename(win, 'MoonChild Era (Deluxe)');
  const after = albums();
  ok('the album is renamed', !!after['MoonChild Era (Deluxe)'] && !after['MoonChild Era'], JSON.stringify(Object.keys(after)));
  ok('it keeps its position in album order', eq(Object.keys(after), ['MoonChild Era (Deluxe)', 'Other Album']), JSON.stringify(Object.keys(after)));
  ok('the later-tagged song is folded into the renamed album', eq(after['MoonChild Era (Deluxe)'].trackIds, ['t1', 't2', 't3']),
     JSON.stringify(after['MoonChild Era (Deluxe)'].trackIds));
  ok('the song that was not in the saved entry is re-tagged too',
     tags().t3 === 'MoonChild Era (Deluxe)', JSON.stringify(tags()));
  ok('no song is left carrying the old name', Object.keys(tags()).every((id) => tags()[id] !== 'MoonChild Era'), JSON.stringify(tags()));
  ok('the artist and other entry fields survive', after['MoonChild Era (Deluxe)'].artist === 'Diljit Dosanjh', JSON.stringify(after['MoonChild Era (Deluxe)']));
  ok('the other album is untouched', eq(contentOf({ x: after['Other Album'] }).x, contentOf({ x: ALBUMS_START['Other Album'] }).x), JSON.stringify(after['Other Album']));
  ok('the rename is written to storage, not just memory', eq(storedMeta('userAlbums'), after));

  console.log('\n— no ghost album, nothing hidden —');
  closeManage(win);
  await wait(200);
  win.navigate('albums');
  await wait(800);
  const c = cards(win);
  ok('the old name comes back as no album at all', c.every((x) => x.name !== 'MoonChild Era'), JSON.stringify(c.map((x) => x.name)));
  ok('the renamed album carries all three of its songs',
     c.some((x) => x.name === 'MoonChild Era (Deluxe)' && x.ids.length === 3), JSON.stringify(c));
  ok('the auto-added album stays out of the tab', c.every((x) => x.name !== 'Other Album'), JSON.stringify(c.map((x) => x.name)));
  ok('every song of the albums you made is on screen', c.reduce((n, x) => n + x.ids.length, 0) === 3, JSON.stringify(c));
  win.navigate('playlists');
  await wait(500);
  const allRows = Array.from(win.document.querySelectorAll('#listPane .track')).map((r) => r.dataset.id);
  ok('the renamed album hides no song from the library', allRows.length === 5, JSON.stringify(allRows));

  console.log('\n— a rename never touches a playlist —');
  ok('every playlist is byte-for-byte unchanged', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  console.log('\n— Manage albums reflects the new name —');
  ok('Manage albums still opens', await openManage(win));
  rows = Array.from(win.document.querySelectorAll('.mgr-alb-row')).map((r) => r.textContent.trim().replace(/\s+/g, ' '));
  ok('the list shows the new name and count', rows.some((r) => r.indexOf('MoonChild Era (Deluxe)') === 0 && /3 tracks/.test(r)), JSON.stringify(rows));
  ok('the old name is gone from the list', !rows.some((r) => r.indexOf('MoonChild Era3') === 0), JSON.stringify(rows));
  closeManage(win);

  console.log('\n— no runtime errors —');
  const unexpected = errors.filter((e) => e.indexOf('dbPromise') === -1);
  ok('no page errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
