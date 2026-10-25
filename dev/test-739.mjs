// v73.9 - a refresh only adds the new ones, and a removed row stays removed.
//
// The owner, verbatim: "Why do singles refresh and albums refresh refetch every
// single one that even I deleted it should only refetch new ones not delete ones".
//
// WHAT WAS WRONG. `__refetchSingles` rebuilt every artist group from the one
// reply it had just fetched, and `__singlesRefreshArtistGroup` (the per-artist ↻)
// swapped a group's rows for that reply as well. Two things fell out of that:
//
//   • a SHORT reply deleted songs the list already had. One storefront having a
//     bad minute, or a single filed under another store id, was enough for a row
//     that was on the list to disappear;
//   • the fallback the refetch takes when a reply carries nothing is the SAVED
//     list (`loadCachedDiscoverPopup`), and that saved body still contains the
//     rows the user removed - a remove hides the row where it stands, and the
//     snapshot is copied off the screen. So a removed single was drawn again.
//
// WHAT 73.9 DOES. The saved rows are kept and the reply is walked for what is not
// among them yet: a refresh can only add. Every reader of a saved body goes
// through ONE cleaner (`scCleanRemovedRows`), so a removed row cannot come back
// through any of them.
//
//   [1] release metadata - APP_VERSION, the head entry, the shell cache;
//   [2] the rules, read out of the shipped file;
//   [3] the list, DRIVEN: refetched, extended, starved, refreshed per artist,
//       emptied - a stub iTunes answers every call;
//   [4] an album, DRIVEN: removed, then refetched;
//   [5] inline script syntax and the two-newline OTA tail.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '80.2.4'; /* repinned by dev/repin-8024.mjs */
const PREV = '80.2.3'; /* repinned by dev/repin-8024.mjs */
// The release this gate DESCRIBES. VER moves with every repin (the gate runs on
// whatever the app is now); OWN does not move, because the entry it reads is the
// one this file was written about and it stays in the changelog for ever.
const OWN = '73.9';
const SHELL_CACHE = 'sidecut-shell-v80.2.4';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const notes = (head.items || []).join('\n');
    ok(String(head.version) === VER, 'the newest entry is this release (' + head.version + ')');
    ok((head.items || []).length >= 7, 'with at least seven notes (' + (head.items || []).length + ')');
    ok(String(entries[1].version) === PREV, 'and the release it replaced is still listed next (' + entries[1].version + ')');
    ok(!/['\u2019]/.test(notes), 'no apostrophe anywhere in the notes');
    ok((head.items || []).every((it) => it.length <= 260), 'and every note is one short sentence or two');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test(notes),
      'and no downloader or converter term');
    ok(!/\bapk\b|\bgithub\b|release asset/i.test(notes), 'and nothing about release files');
    ok(String(head.date).endsWith('EDT'), 'the ship stamp is Eastern (' + head.date + ')');
    // 74.0 repin: these two read THIS gate's own entry, not the head. They quote
    // the words 73.9's notes use, and 74.0's head entry is about the skip button
    // - so reading the head made a gate that describes 73.9 fail on the very next
    // release for saying nothing about refetching. Same fix 73.6.2 gave
    // test-7317: the entry this gate describes is found by its own version and
    // read by name, so it stays answered however many entries ride above it.
    const own = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (own.items || []).join('\n');
    ok(/refetch/i.test(ownNotes), 'the notes of the release this gate describes name what the owner reported');
    ok(/single/i.test(ownNotes) && /album/i.test(ownNotes), 'and the two lists that release is about');
    // The words the gates that read the HEAD look for, kept in the head.
    ok(/widget/i.test(notes) && /player/i.test(notes) && /lyrics/i.test(notes) && /letter/i.test(notes),
      'and the surfaces the earlier gates read the head for');
  }
  ok(sw.includes("const CACHE_NAME = '" + SHELL_CACHE + "'"), 'the shell cache is this release name');
}

console.log('[2] the rules, read out of the shipped file');
{
  // ONE cleaner, and it is what every reader of a saved body goes through.
  ok(count('function scCleanRemovedRows(bodyHTML){') === 1, 'a saved body is cleaned by one function');
  ok(count('window.__scCleanRemovedRows = scCleanRemovedRows;') === 1, 'and it is the one on window');
  ok(/function cleanCachedSinglesBody\(body\)\{\n    return scCleanRemovedRows\(body\);\n  \}/.test(src),
    'the name the Singles popup has always read its saved bodies through is that function');
  const loader = src.slice(src.indexOf('function loadCachedDiscoverPopup(key){'), src.indexOf('window.orderArtistKeys = function'));
  ok(loader.length > 200, 'the saved-popup loader is still the one function');
  ok(/__scCleanRemovedRows/.test(loader),
    'and the lists it opens - the refetch fallback - are cleaned of removed rows');
  // What a removed row is removed BY, for both lists.
  const cleaner = src.slice(src.indexOf('function scCleanRemovedRows(bodyHTML){'));
  const cleanerBody = cleaner.slice(0, cleaner.indexOf('window.__scCleanRemovedRows'));
  ok(/isSingleHidden\(tid, title\)/.test(cleanerBody), 'a single is dropped by the id it was removed under and by its name');
  ok(/isAlbumHidden\(cid, cname\)/.test(cleanerBody), 'and an album the same way');
  ok(/if\(_junk \|\| _gone\) row\.remove\(\);/.test(cleanerBody), 'the row itself is what goes');
  ok(/!group\.querySelector\('\.dp-track\[data-si\]'\) && !group\.querySelector\('\.dp-ah-album'\)/.test(cleanerBody),
    'and an artist group left with nothing to show goes with its rows');
  // 72.1's rule is untouched: the fetch itself never asks for a removed single.
  ok(count('var skipHidden = true;') === 1, 'the singles fetch always applies the removed list');
  ok(count('skipHidden && isSingleHidden(sr.trackId || sr.collectionId, sr.trackName)') === 1,
    'and it is the removed list it applies');
  // The merge: keep what the list has, add only what it does not.
  ok(count('function _scSavedRowsFor(artist){') === 1, 'the refetch reads the rows an artist already has');
  ok(count('if(!_sHave) _scNewSingles.push(singles[_sn]);') === 1, 'and walks the reply for the ones it does not');
  ok(count('html += _scSaved.html;') === 1, 'then keeps those rows on the new list');
  ok(count("var _scTotal = _scSaved.rows + _scNewSingles.length;") === 1, 'with the count taken from both halves');
  ok(count('_scShownRows += _scTotal;') === 1, 'and a total that counts what is actually drawn');
  ok(count('(kept.rows + _scShownRows) + \' single\'') === 1, 'which is what the subtitle reports');
  // The per-artist refresh does not swap the group any more.
  ok(/bodyEl\.innerHTML = _newRows\.length/.test(src),
    'the per-artist refresh adds rows instead of replacing the group');
  ok(count('bodyEl.innerHTML = matched.length') === 0,
    'and the old swap - which drew one reply over the whole group - is gone from every renderer');
  ok(/window\.__singlesDeepRefreshArtistGroup = async function\(groupEl\)\{\n  if\(typeof window\.__singlesRefreshArtistGroup === 'function'\) return window\.__singlesRefreshArtistGroup\(groupEl\);/.test(src),
    'the retired deep-refetch handler is the ordinary refresh, not a second implementation');
  ok(count('includeHidden') === 0, 'and nothing asks the fetch to ignore the removed list');
  ok(count("if(cntEl) cntEl.textContent = _groupRows + ' single'") === 1, 'with a count for the group as it now stands');
}

// ---------------------------------------------------------------------------
// The stub iTunes the page talks to. Two artists, each with one-track releases,
// and two switches: one drops a song out of the reply, one adds a new single.
const SONGS = {
  'Test Artist': [
    { trackName: 'Naina', artistName: 'Test Artist', collectionName: 'Naina - Single', trackCount: 1, trackId: 77, collectionId: 210, releaseDate: '2026-06-02T07:00:00Z', artworkUrl100: 'https://art/naina.jpg', previewUrl: 'https://p/naina.m4a' },
    { trackName: 'Luna', artistName: 'Test Artist', collectionName: 'Luna - Single', trackCount: 1, trackId: 78, collectionId: 211, releaseDate: '2026-05-01T07:00:00Z', artworkUrl100: 'https://art/luna.jpg', previewUrl: 'https://p/luna.m4a' },
  ],
  'Second Artist': [
    { trackName: 'Echo', artistName: 'Second Artist', collectionName: 'Echo - Single', trackCount: 1, trackId: 12, collectionId: 120, releaseDate: '2026-04-01T07:00:00Z', artworkUrl100: 'https://art/echo.jpg', previewUrl: 'https://p/echo.m4a' },
  ],
};
const ARTIST_IDS = { 'Test Artist': 9001, 'Second Artist': 9002 };
const NEW_SINGLE = { trackName: 'Jaan', artistName: 'Test Artist', collectionName: 'Jaan - Single', trackCount: 1, trackId: 79, collectionId: 212, releaseDate: '2026-07-09T07:00:00Z', artworkUrl100: 'https://art/jaan.jpg', previewUrl: 'https://p/jaan.m4a' };
const ALBUMS = [
  { collectionId: 110, collectionName: 'MoonChild Era', trackCount: 12, artistName: 'Test Artist', releaseDate: '2026-05-01T07:00:00Z', artworkUrl100: 'https://art/mce.jpg' },
  { collectionId: 210, collectionName: 'Naina - Single', trackCount: 1, artistName: 'Test Artist', releaseDate: '2026-06-02T07:00:00Z', artworkUrl100: 'https://art/naina.jpg' },
];

const json = (payload) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload), text: () => Promise.resolve(JSON.stringify(payload)) });

function makeApi() {
  const api = { calls: [], drop: null, addNew: false };
  api.fetch = (url) => {
    const u = String(url);
    api.calls.push(u);
    if (/entity=musicArtist/.test(u)) {
      const term = decodeURIComponent((/term=([^&]*)/.exec(u) || [])[1] || '');
      return json({ results: Object.keys(ARTIST_IDS).filter((n) => term.indexOf(n) !== -1).map((n) => ({ artistId: ARTIST_IDS[n], artistName: n })) });
    }
    if (/lookup\?id=\d+&entity=album/.test(u)) return json({ results: [] });
    if (/entity=album/.test(u)) {
      const term = decodeURIComponent((/term=([^&]*)/.exec(u) || [])[1] || '');
      const mine = term.indexOf('Test Artist') !== -1;
      return json({ results: mine ? ALBUMS.map((a) => Object.assign({ wrapperType: 'collection', country: 'US' }, a)) : [] });
    }
    if (/entity=song/.test(u)) {
      const term = decodeURIComponent((/term=([^&]*)/.exec(u) || [])[1] || '');
      const owner = Object.keys(SONGS).find((n) => term.indexOf(n) !== -1);
      if (!owner) return json({ results: [] });
      let rows = SONGS[owner].slice();
      if (api.drop) rows = rows.filter((s) => s.trackName !== api.drop);
      if (api.addNew && owner === 'Test Artist') rows = rows.concat([NEW_SINGLE]);
      return json({ results: rows });
    }
    return json({ results: [] });
  };
  return api;
}

function make2dCtx() {
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

function fakeIndexedDB() {
  const data = { tracks: new Map(), meta: new Map([['playlists', { key: 'playlists', value: { 'All Songs': [], Favorites: [] } }]]) };
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
  return { open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n), close() {} }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
}

async function boot() {
  const api = makeApi();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not load/i.test(m)) errors.push(m); });
  vc.on('warn', () => {});
  vc.on('error', (...a) => errors.push(a.map(String).join(' ').split('\n')[0]));
  const dom = new JSDOM(src, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return make2dCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = fakeIndexedDB();
      win.URL.createObjectURL = () => 'blob:jsdom';
      win.URL.revokeObjectURL = () => {};
      try { win.localStorage.clear(); } catch (e) {}
      win.fetch = (url, opts) => api.fetch(url, opts);
      win.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web', nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}), Plugins: {} };
    },
  });
  await wait(3200);
  const win = dom.window;
  for (const n of Object.keys(ARTIST_IDS)) { try { win.__scTogglePinArtist(n, ''); } catch (e) {} }
  await wait(700);
  const doc = win.document;
  const rows = () => Array.from(doc.querySelectorAll('#discPopupBody .dp-track[data-si]')).map((r) => {
    const x = r.querySelector('.dp-ah-x');
    return x ? (x.getAttribute('data-tname') || '') : '';
  });
  const bodyHTML = () => { const b = doc.getElementById('discPopupBody'); return b ? b.innerHTML : ''; };
  async function removeRow(name) {
    const row = Array.from(doc.querySelectorAll('#discPopupBody .dp-track[data-si]')).find((r) => {
      const x = r.querySelector('.dp-ah-x');
      return x && (x.getAttribute('data-tname') || '') === name;
    });
    if (!row) return false;
    row.querySelector('.dp-ah-x').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(180);
    const c = doc.querySelector('.pop-confirm');
    if (c) c.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(280);
    return true;
  }
  return { dom, win, doc, api, errors, rows, bodyHTML, removeRow };
}

console.log('[3] the Singles list, driven');
{
  const { win, doc, api, errors, rows, bodyHTML, removeRow } = await boot();

  await win.__refetchSingles();
  await wait(400);
  const first = rows();
  ok(first.length === 3, 'a refetch builds the list from the pinned artists (' + first.join(',') + ')');
  ok(['Naina', 'Luna', 'Echo'].every((n) => first.indexOf(n) !== -1), 'with one row per single the stubbed catalog holds');

  // [3a] ONLY THE NEW ONES. A single the catalog did not have before is added,
  // and every row that was already there is still there.
  api.addNew = true;
  await win.__refetchSingles();
  await wait(400);
  const after = rows();
  ok(after.indexOf('Jaan') !== -1, 'a new single is added (' + after.join(',') + ')');
  ok(after.length === 4, 'and the list is one row longer, not rebuilt (' + after.length + ')');
  ok(['Naina', 'Luna', 'Echo'].every((n) => after.indexOf(n) !== -1),
    'with the three that were there untouched');

  // [3b] A SHORT REPLY. One storefront answering with less than it did before
  // must not delete the row that is already on the list.
  api.drop = 'Luna';
  await win.__refetchSingles();
  await wait(400);
  const short = rows();
  ok(short.indexOf('Luna') !== -1, 'a reply without Luna keeps Luna on the list (' + short.join(',') + ')');
  ok(short.length === 4, 'and nothing else moved (' + short.length + ')');

  // [3c] THE PER-ARTIST REFRESH, the same way: it adds, it never deletes.
  const group = Array.from(doc.querySelectorAll('#discPopupBody .dp-ah-artist')).find((g) => {
    const hdr = g.querySelector('.dp-ah-artist-hdr span[style*="flex:1"]');
    return hdr && /Test Artist/.test(hdr.textContent || '');
  });
  ok(!!group, 'the artist group is there to refresh');
  if (group) {
    await win.__singlesRefreshArtistGroup(group);
    await wait(400);
    ok(rows().indexOf('Luna') !== -1, 'the per-artist refresh keeps the songs the group already shows (' + rows().join(',') + ')');
  }

  // [3d] EVERY ROW REMOVED, then a refetch whose reply carries nothing visible:
  // the saved list is what it falls back to, and it may not hand a removed row
  // back. Before 73.9 this drew the removed singles again.
  for (const n of ['Jaan', 'Naina', 'Luna', 'Echo']) {
    const did = await removeRow(n);
    if (!did) console.log('    could not find a row to remove for ' + n + ' (rows: ' + rows().join(',') + ')');
  }
  ok(rows().length === 0, 'every row can be removed from the list (' + rows().join(',') + ')');
  const hidden = win.localStorage.getItem('sidecut_hiddenSingles') || '';
  ok(['Naina', 'Luna', 'Echo', 'Jaan'].every((n) => hidden.indexOf('t:' + n.toLowerCase()) !== -1),
    'and each removal is written down (' + hidden + ')');
  await win.__refetchSingles();
  await wait(500);
  ok(rows().length === 0, 'a refetch after that draws none of them back (' + rows().join(',') + ')');
  const body = bodyHTML();
  ok(['Naina', 'Luna', 'Echo', 'Jaan'].every((n) => body.indexOf('data-tname="' + n + '"') === -1),
    'and no removed single is in the popup at all');
  ok(/singlesRefetchBtn/.test(body), 'the list still offers its Refetch button');
  ok(errors.length === 0, 'the page throws nothing through all of this' + (errors.length ? ': ' + errors[0] : ''));
  win.close();
}

console.log('[4] an album, driven: removed, then refetched');
{
  const { win, doc, errors } = await boot();
  win.navigate('discover');
  await wait(600);
  const ahBtn = doc.getElementById('discoverAlbumHistory');
  ok(!!ahBtn, 'the Albums button is on Discover');
  if (ahBtn) ahBtn.click();
  await wait(1800);
  const albums = () => Array.from(doc.querySelectorAll('#discPopupBody .dp-ah-album'));
  ok(albums().length === 1 && /MoonChild Era/.test(albums()[0].textContent),
    'Album History draws the albums it fetched (' + albums().map((a) => a.getAttribute('data-collection-id')).join(',') + ')');
  const rm = doc.querySelector('#discPopupBody .dp-ah-rm');
  ok(!!rm, 'each album carries its remove button');
  if (rm) {
    rm.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(250);
    const c = doc.querySelector('.pop-confirm');
    if (c) c.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(350);
  }
  ok((win.localStorage.getItem('sidecut_hiddenAlbums') || '').indexOf('110') !== -1,
    'removing it writes it to the removed list (' + win.localStorage.getItem('sidecut_hiddenAlbums') + ')');
  const refetchBtn = doc.getElementById('ahRefetchBtn');
  ok(!!refetchBtn, 'and the list offers Refetch albums');
  if (refetchBtn) refetchBtn.click();
  await wait(2200);
  ok(albums().length === 0, 'a refetch does not put the removed album back (' + albums().length + ' rows)');
  ok(doc.getElementById('discPopupBody').innerHTML.indexOf('MoonChild Era') === -1,
    'and it is nowhere in the list');
  // The stub answers every request with the same shape, so the app's own
  // chart call reports an empty chart - that is the harness, not the app.
  const real = errors.filter((e) => !/chart/i.test(e));
  ok(real.length === 0, 'the page throws nothing through this either' + (real.length ? ': ' + real[0] : ''));
  win.close();
}

console.log('[5] inline script syntax and the OTA tail');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
  ok(/\n\n$/.test(src), 'the page ends with the two-newline OTA tail');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
