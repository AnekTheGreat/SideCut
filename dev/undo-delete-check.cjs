// 74.1.9 - the delete buttons keep their promise: the ask is in the app, and the song comes back.
//
// Three faults, reported as one feeling ("make the app nicer to use") and found in the code
// rather than in a screenshot:
//
//   1. "Clear playlist" and "Delete all songs" removed NOTHING and said "Deleted". Both call
//      deleteAllInView(), whose body only ever answered the Albums tab - and the two buttons
//      are drawn only in the playlist / All Songs view, which is exactly the tab it ignored.
//   2. every song delete asked through window.confirm(), which this page itself documents the
//      Android WebView as swallowing (it returns false) - so the app could silently do nothing,
//      or drop a system sheet into the middle of a themed app.
//   3. a delete was final. The file, its plays, its lyric sheet and its place in every playlist
//      went with one tap on the wrong row.
//
// Each claim is DRIVEN, through the buttons a thumb actually presses:
//
//   [1] the bytes: one delete path, no native dialog left on a destructive path, a real status
//       region on the toast;
//   [2] a song delete asks in the app's own sheet, Cancel keeps the song, Delete removes it from
//       the library, from every playlist and from the store - and Undo puts all of it back where
//       it was;
//   [3] Clear playlist clears THE PLAYLIST, with the library untouched, and Undo restores it;
//   [4] Delete all songs actually deletes, and Undo restores the whole library in order;
//   [5] the toast can be pushed out of the way with a flick, and a small wobble is not a flick.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

const CTX = () => new Proxy({}, {
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

const TRACKS = [
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171 },
  { id: 't5', name: 'Do You Know', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 199 },
].map((t) => Object.assign(t, { blobType: 'audio/mpeg', fileName: t.id + '.mp3' }));

const PLAYLISTS = {
  'All Songs': ['t1', 't2', 't3', 't4', 't5'],
  Chill: ['t1', 't2', 't3'],
  Favorites: ['t2'],
};

function fakeIDB(win) {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, Object.assign({}, t)])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: { 'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, manual: true } } }],
    ]),
  };
  const tx = (store) => {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { data[store].set(v && v.key !== undefined ? v.key : v.id, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
      clear() { data[store].clear(); fire(); return {}; },
    });
    return t;
  };
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

let idb = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return CTX(); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    win.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    win.HTMLMediaElement.prototype.pause = function () {};
    win.HTMLMediaElement.prototype.load = function () {};
    win.URL.createObjectURL = () => 'blob:jsdom-' + (win.__n = (win.__n || 0) + 1);
    win.URL.revokeObjectURL = () => {};
    // The page's own load path reads record.blob to build the song, so the audio has
    // to be a Blob from INSIDE this window.
    TRACKS.forEach((t) => { t.blob = new win.Blob([new win.Uint8Array(2048)], { type: 'audio/mpeg' }); });
    idb = fakeIDB(win);
    win.indexedDB = idb;
    win.fetch = () => Promise.reject(new Error('offline'));
    try { win.localStorage.clear(); } catch (e) {}
  },
});

const click = (win, el) => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, view: win })); };
const rows = (win) => Array.from(win.document.querySelectorAll('#listPane .track[data-id]'));
const rowIds = (win) => rows(win).map((r) => r.dataset.id);
const tab = (win, name) => win.document.querySelector('#tabs .tab[data-playlist-name="' + name + '"]');
const btnByText = (win, root, re) => Array.from((root || win.document).querySelectorAll('button')).find((b) => re.test(b.textContent));
const meta = (key) => { const r = idb._data.meta.get(key); return r ? r.value : null; };
const controls = (win) => Array.from(win.document.querySelectorAll('.modal-backdrop #_modalConfirmYes'));
const anyConfirm = (win) => Array.from(win.document.querySelectorAll('#_modalConfirmYes'));

async function openListMenu(win) {
  const more = win.document.getElementById('listMoreBtn');
  if (!more) return false;
  click(win, more);
  await wait(120);
  return win.document.getElementById('songActionsBackdrop').style.display === 'flex';
}
function menuBtn(win, re) {
  return Array.from(win.document.querySelectorAll('#songActionsList button')).find((b) => re.test(b.textContent));
}
async function closeMenus(win) {
  win.document.getElementById('songActionsBackdrop').style.display = 'none';
  anyConfirm(win).forEach((b) => { const bd = b.closest('.modal-backdrop'); if (bd) bd.remove(); });
  await wait(60);
}

(async () => {
  const win = dom.window;
  await wait(6500);
  const doc = win.document;
  // The app boots on Home; the library list is drawn when the tab is opened, the
  // same way a thumb opens it.
  click(win, doc.getElementById('libraryBtn'));
  await wait(500);
  if (tab(win, 'All Songs')) { click(win, tab(win, 'All Songs')); await wait(400); }

  console.log('[1] one delete path, no system dialogs, a real status region');
  {
    ok(typeof win.__scDeleteSongs === 'function', 'the page publishes one delete path (scDeleteSongs)');
    ok(typeof win.__scUndoSongDelete === 'function', 'and the undo that goes with it');
    ok(typeof win.__scDeleteAllInView === 'function', 'the list-level delete is the same code');
    ok(html.indexOf('if(!confirm(') === -1 && html.indexOf('if(confirm(') === -1,
      'no destructive path asks through window.confirm() any more');
    const toastEl = doc.getElementById('toast');
    ok(toastEl.getAttribute('role') === 'status', 'the toast is a status region');
    ok(toastEl.getAttribute('aria-live') === 'polite', 'and it is announced politely');
    ok(idb._data.tracks.size === 5, 'the harness library loaded (5 songs)', idb._data.tracks.size);
  }

  console.log('[2] a song delete asks in the app, and Undo brings it back');
  try {
    const before = rowIds(win);
    ok(before.join(',') === 't1,t2,t3,t4,t5', 'the Library starts with all five songs', before.join(','));

    // The row's own menu, which is how a song is deleted by hand.
    const row = rows(win).find((r) => r.dataset.id === 't2');
    const kebab = row && row.querySelector('.kebab-btn');
    ok(!!kebab, 'the row has its kebab');
    click(win, kebab);
    await wait(200);
    const del = menuBtn(win, /Delete from library/i);
    ok(!!del, 'the row menu offers Delete from library');
    click(win, del);
    await wait(250);

    const yes = anyConfirm(win)[0];
    ok(!!yes, 'tapping it opens the app\'s own confirm sheet');
    const sheetText = yes ? yes.closest('.modal').textContent : '';
    ok(/"Born To Shine"/.test(sheetText), 'the sheet names the song being deleted', sheetText.slice(0, 120));
    ok(/every playlist/i.test(sheetText) && /Undo/i.test(sheetText), 'and says what it takes and that it can come back');
    ok(!win.document.getElementById('songActionsBackdrop') || win.document.getElementById('songActionsBackdrop').style.display === 'none',
      'the menu behind it is closed');

    click(win, doc.getElementById('_modalConfirmNo'));
    await wait(250);
    ok(rowIds(win).join(',') === before.join(','), 'Cancel keeps every song', rowIds(win).join(','));
    ok(idb._data.tracks.has('t2'), 'and the store is untouched');

    // Now for real.
    click(win, rows(win).find((r) => r.dataset.id === 't2').querySelector('.kebab-btn'));
    await wait(200);
    click(win, menuBtn(win, /Delete from library/i));
    await wait(250);
    click(win, anyConfirm(win)[0]);
    await wait(450);

    ok(rowIds(win).join(',') === 't1,t3,t4,t5', 'Delete removes the song from the list', rowIds(win).join(','));
    ok(!idb._data.tracks.has('t2'), 'and from the audio store');
    ok(meta('playlists')['All Songs'].indexOf('t2') === -1, 'and from All Songs');
    ok(meta('playlists').Chill.indexOf('t2') === -1, 'and from every other playlist');
    ok(meta('playlists').Favorites.indexOf('t2') === -1, 'including Favorites');
    const toastEl = doc.getElementById('toast');
    ok(/Deleted "Born To Shine"/.test(toastEl.textContent), 'the toast says what happened', toastEl.textContent);
    const undo = toastEl.querySelector('button');
    ok(!!undo && /Undo/i.test(undo.textContent), 'and offers Undo');

    click(win, undo);
    await wait(700);
    ok(rowIds(win).join(',') === 't1,t2,t3,t4,t5', 'Undo puts the song back in its own place', rowIds(win).join(','));
    ok(idb._data.tracks.has('t2'), 'the audio record is written back, so it survives a restart');
    ok(meta('playlists')['All Songs'].join(',') === 't1,t2,t3,t4,t5', 'All Songs is whole again, in order');
    ok(meta('playlists').Chill.join(',') === 't1,t2,t3', 'Chill is whole again, in order');
    ok(meta('playlists').Favorites.join(',') === 't2', 'and so is Favorites');
    ok(/Restored/.test(toastEl.textContent), 'and the app says it came back', toastEl.textContent);
  } catch (e) { fail++; console.log('  \u2717 this section could not finish: ' + (e && e.message)); }

  console.log('[3] Clear playlist clears the playlist, and only the playlist');
  try {
    click(win, tab(win, 'Chill'));
    await wait(350);
    ok(rowIds(win).join(',') === 't1,t2,t3', 'the Chill tab shows its three songs', rowIds(win).join(','));
    ok(await openListMenu(win), 'the list menu opens on a playlist');
    const clear = menuBtn(win, /Clear playlist/i);
    ok(!!clear, 'and carries Clear playlist');
    click(win, clear);
    await wait(250);
    const yes = anyConfirm(win)[0];
    ok(!!yes, 'Clear playlist asks in the app first');
    ok(/Clear "Chill"/.test(yes ? yes.closest('.modal').textContent : ''), 'and names the playlist');
    click(win, yes);
    await wait(450);
    ok(rowIds(win).length === 0, 'the playlist is empty', rowIds(win).join(','));
    ok(meta('playlists').Chill.length === 0, 'and stored empty - this is the button that used to do nothing');
    ok(meta('playlists')['All Songs'].join(',') === 't1,t2,t3,t4,t5', 'the library is untouched');
    ok(idb._data.tracks.size === 5, 'no audio was deleted');
    const undo = doc.getElementById('toast').querySelector('button');
    ok(!!undo && /Undo/i.test(undo.textContent), 'and the toast offers Undo');
    click(win, undo);
    await wait(600);
    ok(meta('playlists').Chill.join(',') === 't1,t2,t3', 'Undo restores the playlist in order', meta('playlists').Chill.join(','));
    ok(rowIds(win).join(',') === 't1,t2,t3', 'and the list shows it again', rowIds(win).join(','));
  } catch (e) { fail++; console.log('  \u2717 this section could not finish: ' + (e && e.message)); }

  console.log('[4] Delete all songs deletes, and Undo restores the library');
  try {
    click(win, tab(win, 'All Songs'));
    await wait(350);
    ok(rowIds(win).length === 5, 'the Library tab is back to five songs', rowIds(win).length);
    ok(await openListMenu(win), 'the list menu opens');
    const delAll = menuBtn(win, /Delete all songs/i);
    ok(!!delAll, 'and carries Delete all songs');
    click(win, delAll);
    await wait(250);
    const yes = anyConfirm(win)[0];
    ok(!!yes, 'it asks in the app, with the count');
    ok(/5 songs/.test(yes ? yes.closest('.modal').textContent : ''), 'the sheet says how many go');
    click(win, yes);
    await wait(600);
    ok(rowIds(win).length === 0, 'the library is empty', rowIds(win).join(','));
    ok(idb._data.tracks.size === 0, 'and the store is empty - this is the button that used to do nothing');
    const undo = doc.getElementById('toast').querySelector('button');
    ok(!!undo && /Undo/i.test(undo.textContent), 'the toast offers Undo');
    click(win, undo);
    await wait(900);
    ok(rowIds(win).join(',') === 't1,t2,t3,t4,t5', 'Undo restores all five songs, in their order', rowIds(win).join(','));
    ok(idb._data.tracks.size === 5, 'with their audio written back');
    ok(meta('playlists')['All Songs'].join(',') === 't1,t2,t3,t4,t5', 'and their place in the library list');
  } catch (e) { fail++; console.log('  \u2717 this section could not finish: ' + (e && e.message)); }

  console.log('[5] the toast can be pushed out of the way');
  try {
    const toastEl = doc.getElementById('toast');
    win.toast('A message to push away', 9000);
    ok(toastEl.style.display === 'block', 'a toast is showing');
    const pev = (type, y) => toastEl.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y, view: win }));
    pev('pointerdown', 100); pev('pointerup', 88);
    ok(toastEl.style.display === 'block', 'a 12px wobble does not dismiss it');
    pev('pointerdown', 100); pev('pointerup', 60);
    ok(toastEl.style.display === 'none', 'but a 40px flick up does');
  } catch (e) { fail++; console.log('  \u2717 this section could not finish: ' + (e && e.message)); }

  const realErrors = errors.filter((e) => !/Not implemented|Could not parse CSS|offline|Failed to load|fetch/i.test(e));
  ok(realErrors.length === 0, 'no uncaught page errors while any of this ran', realErrors.slice(0, 3));

  console.log('\nundo-delete-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
