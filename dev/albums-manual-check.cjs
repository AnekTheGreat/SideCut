// "Fix the damn auto albums I hate those because I make an album and it says it
// already exists just remove the auto albums and make sure that doesn't affect my
// regular albums." The panel behind the report read "25 albums · 227 not created
// by you" — so the library is polluted exactly the way older builds polluted it,
// and this file proves what 73.1.8 does with it:
//
//   1. An entry the app created for itself (an old card-drag auto-save, or a tag
//      album materialised so a reorder had somewhere to live) is cleared from the
//      Albums tab by the boot sweep, and the name it had taken is free again —
//      which is what made "Create album" answer "an album named X already exists"
//      and then file the songs into an album that never appeared. 73.1.8: the
//      entry's full song list is ARCHIVED first (sidecut_albumsArchive), and a
//      tag-named entry is rebuilt before the sweep ever runs — a flag can cost a
//      name, never an album again.
//   2. Albums you made are untouched: same songs, same order, same artist, same
//      entry. That includes an entry that predates the flag entirely and carries no
//      marker at all — a "no marker means not yours" rule is what once emptied a
//      library of twelve hand-made albums down to one card, so it is not applied.
//   3. Nothing else moves: every song stays in the library, every album tag stays
//      on its file, and playlists are byte-for-byte unchanged.
//   4. Manage albums lists the albums you have, searches them, and — 73.1.8 —
//      offers the archived lists back with an It-is-mine button per album.
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
];
// What the store looks like on a phone that lived through the old auto-save:
//   • 'MoonChild Era' / 'G.O.A.T' — every track with that tag, in tag order, and
//     wearing the flag the app put on the entries it wrote for itself: auto.
//     73.1.8: the tag is on the files, so the recovery pass REBUILDS these as
//     albums of yours before the sweep runs — they are kept, not cleared.
//   • 'My Mix' — songs from TWO different tags, gathered by hand: keep.
//   • 'DJ Set' — two songs of one tag in MY order: keep.
//   • 'Pre Flag' — an entry that predates the flag and has no marker at all: keep.
const ALBUMS_POLLUTED = {
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, auto: true },
  'G.O.A.T': { artist: 'Sidhu Moose Wala', trackIds: ['t4', 't5'], createdAt: 12, auto: true },
  'My Mix': { artist: 'Various Artists', trackIds: ['t1', 't4'], createdAt: 13, manual: true },
  'DJ Set': { artist: 'Diljit Dosanjh', trackIds: ['t3', 't2'], createdAt: 14, manual: true },
  'Pre Flag': { artist: 'Sidhu Moose Wala', trackIds: ['t5'], createdAt: 10 },
};
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], 'Moon Faves': ['t1', 't4'] };
const ALBUM_ORDER_START = ['MoonChild Era', 'G.O.A.T', 'My Mix', 'DJ Set', 'Pre Flag'];
const KEPT = ['MoonChild Era', 'G.O.A.T', 'My Mix', 'DJ Set', 'Pre Flag'];
// What an album IS: its songs and its artist. The bookkeeping fields are compared
// separately, because those are the app's, not the album's.
function contentOf(a) {
  const out = {};
  Object.keys(a || {}).sort().forEach((k) => {
    const e = a[k] || {};
    out[k] = { artist: e.artist, trackIds: e.trackIds };
  });
  return out;
}

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_POLLUTED)) }],
      ['albumOrder', { key: 'albumOrder', value: ALBUM_ORDER_START.slice() }],
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

const storedAlbums = () => { const m = idb._data.meta.get('userAlbums'); return m ? m.value : undefined; };
const storedOrder = () => { const m = idb._data.meta.get('albumOrder'); return m ? m.value : undefined; };
const storedPlaylists = () => { const m = idb._data.meta.get('playlists'); return m ? m.value : undefined; };
const ourPlaylists = () => { const p = storedPlaylists() || {}; return { 'All Songs': p['All Songs'], Favorites: p['Favorites'], 'Moon Faves': p['Moon Faves'] }; };
const tags = () => { const out = {}; idb._data.tracks.forEach((t, id) => { out[id] = t.album; }); return out; };
const cardEls = (win) => Array.from(win.document.querySelectorAll('#listPane [data-album-name]'));
const cardNames = (win) => cardEls(win).map((c) => c.dataset.albumName);
const paneHeader = (win) => {
  const h = win.document.querySelector('#listPane .pane-header');
  return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
};
const mgrRows = (win) => Array.from(win.document.querySelectorAll('#discPopupBody .mgr-alb-row'));
const visibleRows = (win) => mgrRows(win).filter((r) => r.style.display !== 'none');
const q = (win, sel) => win.document.querySelector(sel);

// Open Albums tab ⋮ → Manage albums, the same way a user does.
async function openManage(win) {
  win.navigate('albums');
  await wait(700);
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
function type(win, text) {
  const input = q(win, '#mgrAlbumSearch');
  if (!input) return false;
  input.value = text;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  return true;
}
// Drive the real rename dialog (it is closure-local, so the DOM is the only honest
// way in). The row is found by the album name, the way a user reads it.
async function rename(win, currentName, newName, newArtist) {
  const row = mgrRows(win).find((r) => (r.getAttribute('data-name') || '') === currentName.toLowerCase());
  if (!row) return 'no-row';
  const btn = row.querySelector('.mgr-alb-rename');
  if (!btn) return 'no-button';
  btn.click();
  await wait(350);
  const input = win.document.getElementById('_albRenameName');
  const artistInput = win.document.getElementById('_albRenameArtist');
  if (!input || !artistInput) return 'no-prompt';
  input.value = newName;
  if (newArtist !== undefined) artistInput.value = newArtist;
  win.document.getElementById('_albRenameOk').click();
  await wait(800);
  return 'ok';
}

(async () => {
  const win = dom.window;
  // The boot notice about cleared auto entries goes off on a 3 s timer, and the app's
  // own toast() is an IIFE local, so it cannot be wrapped from here — the toast
  // ELEMENT is watched instead, which is what the user reads. On this library every
  // flagged album is tag-named, so the recovery pass keeps them all and the sweep
  // finds nothing to clear: NO destructive boot on a tag-named library.
  let clearToast = '';
  const watchToast = setInterval(() => {
    const el = win.document.getElementById('toast');
    if (el && /were cleared/.test(el.textContent || '')) clearToast = String(el.textContent);
  }, 100);
  await wait(7000);
  clearInterval(watchToast);

  console.log('\n— a flagged album whose name is a file tag is kept, whole —');
  const after = storedAlbums() || {};
  ok('every album in the store is still there',
     eq(Object.keys(after).sort(), KEPT.slice().sort()), JSON.stringify(Object.keys(after)));
  ok('the flagged tag albums kept every song they listed',
     after['MoonChild Era'] && eq(after['MoonChild Era'].trackIds, ['t1', 't2', 't3']) &&
     after['G.O.A.T'] && eq(after['G.O.A.T'].trackIds, ['t4', 't5']), JSON.stringify([after['MoonChild Era'], after['G.O.A.T']]));
  ok('and the boot never announced a clearing',
     clearToast === '', JSON.stringify(clearToast));
  ok('the album order is exactly as it was',
     eq(storedOrder(), ALBUM_ORDER_START), JSON.stringify(storedOrder()));

  console.log('\n— the boot recovery marks every album as yours, once —');
  ok('the flagged tag albums are marked manual (never sweepable again)',
     after['MoonChild Era'] && after['MoonChild Era'].manual === true &&
     after['G.O.A.T'] && after['G.O.A.T'].manual === true,
     JSON.stringify([after['MoonChild Era'] && after['MoonChild Era'].manual, after['G.O.A.T'] && after['G.O.A.T'].manual]));
  ok('the stale auto flag is gone',
     !after['MoonChild Era'].auto && !after['G.O.A.T'].auto, JSON.stringify([after['MoonChild Era'].auto, after['G.O.A.T'].auto]));

  console.log('\n— every album you made is untouched —');
  const keptStart = {};
  ['My Mix', 'DJ Set', 'Pre Flag'].forEach((k) => { keptStart[k] = ALBUMS_POLLUTED[k]; });
  ok('the albums you made are exactly as they were', eq(contentOf({ 'My Mix': after['My Mix'], 'DJ Set': after['DJ Set'], 'Pre Flag': after['Pre Flag'] }), contentOf(keptStart)),
     JSON.stringify(contentOf({ 'My Mix': after['My Mix'], 'DJ Set': after['DJ Set'], 'Pre Flag': after['Pre Flag'] })));
  ok('the album you ordered by hand keeps your order',
     eq(after['DJ Set'].trackIds, ['t3', 't2']), JSON.stringify(after['DJ Set'].trackIds));
  // 73.1.9: a no-marker entry is stamped manual at boot - the files vouch for
  // it through its songs - so no future sweep can ever misread it again.
  ok('the no-marker entry is stamped yours (its songs untouched)',
     after['Pre Flag'] && !after['Pre Flag'].auto && after['Pre Flag'].manual === true &&
     eq(after['Pre Flag'].trackIds, ['t5']), JSON.stringify(after['Pre Flag']));
  ok('every album tag on every file is unchanged',
     eq(tags(), { t1: 'MoonChild Era', t2: 'MoonChild Era', t3: 'MoonChild Era', t4: 'G.O.A.T', t5: 'G.O.A.T' }),
     JSON.stringify(tags()));

  console.log('\n— nothing else moved —');
  ok('playlists are byte-for-byte unchanged', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));
  win.navigate('playlists');
  await wait(600);
  const rows = Array.from(win.document.querySelectorAll('#listPane .track')).map((r) => r.dataset.id);
  ok('every song is still in the library', eq(rows.slice().sort(), ['t1', 't2', 't3', 't4', 't5']), JSON.stringify(rows));

  console.log('\n— the Albums tab shows every album, flagged or not —');
  win.navigate('albums');
  await wait(900);
  const names = cardNames(win);
  ok('the albums the app once flagged are there again',
     names.indexOf('MoonChild Era') !== -1 && names.indexOf('G.O.A.T') !== -1, JSON.stringify(names));
  ok('the albums you made are all there too, and nothing else is',
     eq(names.slice().sort(), KEPT.slice().sort()), JSON.stringify(names));
  ok('the header counts the whole Albums tab',
     /\b5 tracks\b/.test(paneHeader(win)), paneHeader(win));

  console.log('\n— the sweep itself still frees a name, without keeping nothing —');
  ok('the removal hook exists', typeof win.__scRemoveAutoAlbums === 'function');
  ok('nothing is left flagged', (typeof win.__scAutoAlbumNames === 'function' ? win.__scAutoAlbumNames() : ['?']).length === 0,
     JSON.stringify(typeof win.__scAutoAlbumNames === 'function' ? win.__scAutoAlbumNames() : null));
  ok('running it again finds nothing to remove', win.__scRemoveAutoAlbums() === 0);
  ok('the recovery hook exists', typeof win.__scAlbumsRecoverDeleted === 'function');
  ok('the archived-names hook exists', typeof win.__scAlbumsArchivedNames === 'function');
  ok('the it-is-mine restore hook exists', typeof win.__scAlbumsRestoreArchived === 'function');

  console.log('\n— It is mine puts a cleared album back, whole —');
  {
    // The owner's case: an older boot cleared albums whole, so nothing is left
    // in the store to rebuild from — the archive (or a backup) is what brings
    // one back. Seed the archive the way the sweep writes it, then drive the
    // real panel: the row, the button, the restore.
    const m = idb._data.meta.get('userAlbums');
    const snapshot = JSON.parse(JSON.stringify(m.value));
    win.localStorage.setItem('sidecut_albumsArchive', JSON.stringify({
      'Ghost Drag': { at: 1, entry: { artist: 'Diljit Dosanjh', trackIds: ['t1', 't4'], createdAt: 99, auto: true } },
    }));
    await openManage(win);
    const row = win.document.querySelector('#discPopupBody .mgr-alb-archived-row');
    ok('the cleared album is listed in Manage albums', !!row, row ? '' : 'no archived row');
    const mine = row && row.querySelector('.mgr-alb-mine');
    ok('with an It is mine button on it', !!mine);
    if (mine) {
      mine.click();
      await wait(900);
      const s = storedAlbums() || {};
      ok('the album is back with the full song list it had', s['Ghost Drag'] && eq(s['Ghost Drag'].trackIds, ['t1', 't4']), JSON.stringify(s['Ghost Drag']));
      ok('marked yours, no stale flag', s['Ghost Drag'] && s['Ghost Drag'].manual === true && !s['Ghost Drag'].auto, JSON.stringify(s['Ghost Drag'] && [s['Ghost Drag'].manual, s['Ghost Drag'].auto]));
      ok('and it left the archive (claimed, not copied)', eq(win.__scAlbumsArchivedNames(), []), JSON.stringify(win.__scAlbumsArchivedNames()));
      const cards = cardNames(win);
      ok('it shows on the Albums tab like any album', cards.indexOf('Ghost Drag') !== -1, JSON.stringify(cards));
      // Leave the store as the boot left it for the checks below.
      win.deleteUserAlbum ? win.deleteUserAlbum('Ghost Drag') : null;
      const afterDel = storedAlbums() || {};
      if (afterDel['Ghost Drag']) { delete afterDel['Ghost Drag']; m.value = afterDel; win.__scRemoveAutoAlbums(); }
      await openManage(win);
      ok('the restored album is gone again after Delete', !(storedAlbums() || {})['Ghost Drag'], JSON.stringify(Object.keys(storedAlbums() || {})));
    }
    void snapshot;
  }

  console.log('\n— 73.1.9: recovery is every-boot, whole-list, and respects a real delete —');
  {
    // A sweep victim whose name no entry holds any more. 73.1.8 rebuilt this
    // only ONCE and only from the unclaimed songs; 73.1.9 rebuilds it on any
    // boot and WHOLE - the song My Mix also holds comes back into it.
    const m = idb._data.meta.get('userAlbums');
    delete m.value['MoonChild Era'];
    win.__scAlbumsRecoverDeleted();
    const s2 = storedAlbums() || {};
    ok('a sweep victim is rebuilt on a later boot too (every-boot, not one-shot)',
       !!s2['MoonChild Era'], JSON.stringify(Object.keys(s2)));
    ok('rebuilt WHOLE - the song My Mix also holds is included',
       s2['MoonChild Era'] && eq(s2['MoonChild Era'].trackIds, ['t1', 't2', 't3']), JSON.stringify(s2['MoonChild Era']));
    ok('the album that shared the song is untouched (additive only)',
       s2['My Mix'] && eq(s2['My Mix'].trackIds, ['t1', 't4']), JSON.stringify(s2['My Mix']));
    ok('and the rebuilt album is marked yours', s2['MoonChild Era'] && s2['MoonChild Era'].manual === true && !s2['MoonChild Era'].auto,
       JSON.stringify([s2['MoonChild Era'] && s2['MoonChild Era'].manual, s2['MoonChild Era'] && s2['MoonChild Era'].auto]));
  }

  console.log('\n— a delete the user makes through the panel STAYS deleted —');
  {
    // The tombstone: recovery runs on every boot now, so the one way it could
    // turn bad is resurrecting an album the user removed on purpose. Drive the
    // real two-tap Delete and then boot again.
    await openManage(win);
    const delRow = mgrRows(win).find((r) => (r.getAttribute('data-name') || '') === 'moonchild era');
    const del = delRow && delRow.querySelector('.mgr-alb-del');
    ok('the delete control is there', !!del);
    if (del) {
      del.click();
      await wait(150);
      del.click();
      await wait(800);
      ok('the album was deleted through the panel', !(storedAlbums() || {})['MoonChild Era'], JSON.stringify(Object.keys(storedAlbums() || {})));
      win.__scAlbumsRecoverDeleted();
      ok('and it STAYS deleted on the next boot (tombstone)', !(storedAlbums() || {})['MoonChild Era'], JSON.stringify(Object.keys(storedAlbums() || {})));
    }
  }

  console.log('\n— Manage albums now searches —');
  ok('Manage albums opens', await openManage(win));
  ok('one row per album you have', mgrRows(win).length === 4 && visibleRows(win).length === 4,
     'rows=' + mgrRows(win).length + ' visible=' + visibleRows(win).length);
  ok('no "not created by you" controls survive',
     !q(win, '.mgr-alb-restore') && !q(win, '.mgr-alb-rename-auto') && !q(win, '.mgr-alb-del-auto'));
  ok('the panel carries a search box', !!q(win, '#mgrAlbumSearch') && !!q(win, '#mgrAlbumSearchClear'));
  ok('the count line is hidden until you search', q(win, '#mgrAlbumCount').style.display === 'none',
     q(win, '#mgrAlbumCount').style.display);

  ok('typing narrows the list', type(win, 'dj') && visibleRows(win).length === 1,
     'visible=' + visibleRows(win).length + ' [' + visibleRows(win).map((r) => r.getAttribute('data-name')).join(',') + ']');
  ok('and says how many still match',
     q(win, '#mgrAlbumCount').textContent === '1 of 4 albums' && q(win, '#mgrAlbumCount').style.display === 'block',
     q(win, '#mgrAlbumCount').textContent);
  ok('the matching row is the one asked for',
     visibleRows(win)[0] && visibleRows(win)[0].getAttribute('data-name') === 'dj set',
     visibleRows(win)[0] ? visibleRows(win)[0].getAttribute('data-name') : 'none');

  ok('an artist matches too', type(win, 'moose') && visibleRows(win).length === 2 &&
     visibleRows(win).some((r) => r.getAttribute('data-name') === 'g.o.a.t') &&
     visibleRows(win).some((r) => r.getAttribute('data-name') === 'pre flag'),
     visibleRows(win).map((r) => r.getAttribute('data-name')).join(','));

  ok('a search with no match hides every row', type(win, 'zzz') && visibleRows(win).length === 0,
     'visible=' + visibleRows(win).length);
  ok('and says so instead of showing an empty list',
     q(win, '#mgrAlbumNoMatch').style.display === 'block' && q(win, '#mgrAlbumCount').textContent === '0 of 4 albums',
     q(win, '#mgrAlbumNoMatch').style.display + ' / ' + q(win, '#mgrAlbumCount').textContent);

  q(win, '#mgrAlbumSearchClear').click();
  await wait(150);
  ok('the clear button puts them all back',
     visibleRows(win).length === 4 && q(win, '#mgrAlbumSearch').value === '' &&
     q(win, '#mgrAlbumNoMatch').style.display === 'none' && q(win, '#mgrAlbumCount').style.display === 'none',
     'visible=' + visibleRows(win).length + ' value=' + JSON.stringify(q(win, '#mgrAlbumSearch').value));

  // The panel is re-rendered in place after a rename, so a query has to survive
  // that: losing what you typed half-way through would be worse than not searching.
  console.log('\n— the search survives the panel rebuilding itself —');
  type(win, 'flag');
  await wait(120);
  ok('the search is narrowed before the rename', visibleRows(win).length === 1 &&
     visibleRows(win)[0].getAttribute('data-name') === 'pre flag', 'visible=' + visibleRows(win).length);
  ok('a rename can still be driven from the list',
     await rename(win, 'Pre Flag', 'Pre Flag Hits') === 'ok', JSON.stringify(storedAlbums() && Object.keys(storedAlbums())));
  ok('the album itself was renamed', !!storedAlbums()['Pre Flag Hits'], JSON.stringify(Object.keys(storedAlbums())));
  ok('the rebuilt list is still narrowed', visibleRows(win).length === 1,
     'visible=' + visibleRows(win).length + ' [' + visibleRows(win).map((r) => r.getAttribute('data-name')).join(',') + ']');
  ok('and the query is still in the box', q(win, '#mgrAlbumSearch').value === 'flag',
     JSON.stringify(q(win, '#mgrAlbumSearch').value));
  ok('with the count still honest about the new name',
     q(win, '#mgrAlbumCount').textContent === '1 of 4 albums', q(win, '#mgrAlbumCount').textContent);
  // Closing and reopening is a fresh start, not the same session: the panel must
  // come back unfiltered rather than holding a search the user has walked away from.
  closeManage(win);
  await wait(300);
  await openManage(win);
  ok('a fresh open starts with all albums and no query',
     visibleRows(win).length === 4 && q(win, '#mgrAlbumSearch').value === '',
     'visible=' + visibleRows(win).length + ' value=' + JSON.stringify(q(win, '#mgrAlbumSearch').value));

  console.log('\n— the songs are all where they were —');
  const finalAlbums = storedAlbums() || {};
  // MoonChild Era is absent here ON PURPOSE: the tombstone test deleted it
  // through the real panel, and 73.1.9's whole point is that it stays deleted.
  ok('every album you have is still in the store (the one you deleted stays gone)',
     eq(Object.keys(finalAlbums).sort(), ['DJ Set', 'G.O.A.T', 'My Mix', 'Pre Flag Hits']), JSON.stringify(Object.keys(finalAlbums)));
  ok('the songs are all still in the library',
     eq(Object.keys(tags()).sort(), ['t1', 't2', 't3', 't4', 't5']), JSON.stringify(Object.keys(tags())));
  ok('playlists are still byte-for-byte unchanged', eq(ourPlaylists(), PLAYLISTS_START), JSON.stringify(ourPlaylists()));

  const real = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors', real.length === 0, real.slice(0, 2).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
