// 64.2.6, driven for real: the two halves of the library keep their own place
// in the list, and the record tap moves only the half it is in.
//
// The user's report, as far as a WebView-less box can drive it:
//
//   "Why does me clicking on the record player in albums or playlists influence
//    the other it shouldnt scroll down in another place only in its place"
//
// Playlists and Albums are two lists that render into ONE #listPane, and the
// "put the scroll back where it was" restore in renderListInner never knew which
// half it belonged to. So the half you were NOT looking at handed its offset to
// the half you entered - and because the record tap renders the list before it
// glides, the tap visibly moved the other half's list on the way.
//
// This boots the real app, scrolls each half through the real library, and
// switches between them through the real navigate(). jsdom lays nothing out, so
// a glide has no distance to travel; what is measured here is the position each
// half is put back to, which is the whole of the fix.
//
//   node dev/libhalf-6426-check.cjs
//   SC_HTML=/tmp/prefix-6425.html node dev/libhalf-6426-check.cjs   # against 64.2.5
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  + ' + name); }
  else { fail++; console.log('  X ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Two albums with real track lists, so both halves have a list worth scrolling.
const TRACKS = [];
for (let i = 1; i <= 14; i++) {
  TRACKS.push({ id: 't' + i, name: 'Song ' + i, artist: 'Test Artist', album: i <= 7 ? 'First Album' : 'Second Album', duration: 180 + i });
}
const PLAYLISTS = { 'All Songs': TRACKS.map((t) => t.id), Favorites: ['t3'] };
const ALBUMS = {
  'First Album': { trackIds: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'] },
  'Second Album': { trackIds: ['t8', 't9', 't10', 't11', 't12', 't13', 't14'] },
};

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS)) }],
      ['pinnedArtists', { key: 'pinnedArtists', value: [{ name: 'Test Artist' }] }],
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

function boot() {
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
      win.confirm = () => true;
      win.localStorage.clear();
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);

(async () => {
  const { win, errors } = boot();
  await wait(3400);
  const doc = win.document;

  console.log('\n- both halves of the library can be reached -');
  const pane = doc.getElementById('listPane');
  // A build older than 64.2.6 has no such map: the checks below then fail one by
  // one instead of throwing on the first read.
  const mem = win.__scLibScroll || {};
  ok('the list pane is on the page', !!pane);
  ok('the library can be opened', typeof win.navigate === 'function');
  ok('and each half keeps its own remembered position', typeof win.__scLibScroll === 'object', typeof win.__scLibScroll);

  // A position is only meaningful inside a half, so a half is scrolled and then
  // LEFT: that is the moment its place is taken down.
  const scrollHalf = (top) => { pane.scrollTop = top; };

  win.navigate('playlists');
  await wait(140);
  ok('the playlists half renders', pane.querySelectorAll('.track').length > 3,
    pane.querySelectorAll('.track').length + ' rows: ' + pane.textContent.slice(0, 40));

  console.log('\n- each half is remembered where it was left -');
  scrollHalf(900);
  win.navigate('albums');
  await wait(140);
  const albumsRows = pane.querySelectorAll('[data-album-name]').length;
  ok('the albums half renders', albumsRows >= 2, albumsRows + ' album cards');
  ok('leaving Playlists remembers where Playlists was', mem.playlists === 900,
    JSON.stringify(mem));
  ok('and entering Albums starts Albums where ALBUMS was, not where Playlists was', pane.scrollTop === 0,
    'scrollTop = ' + pane.scrollTop);

  scrollHalf(240);
  win.navigate('playlists');
  await wait(140);
  ok('leaving Albums remembers where Albums was, without touching Playlists',
    mem.albums === 240 && mem.playlists === 900, JSON.stringify(mem));
  ok('and Playlists comes back where it was', pane.scrollTop === 900,
    'scrollTop = ' + pane.scrollTop + ', remembered ' + JSON.stringify(mem));

  win.navigate('albums');
  await wait(140);
  ok('and Albums comes back where it was', pane.scrollTop === 240,
    'scrollTop = ' + pane.scrollTop);

  console.log('\n- the record tap moves only the half it is in -');
  win.navigate('playlists');
  await wait(140);
  const track = { id: 't9', name: 'Song 9', artist: 'Test Artist', album: 'Second Album' };
  ok('the jump is reachable the way the record player reaches it', typeof win.__scJumpToPlayingSong === 'function');
  win.__scJumpToPlayingSong(track);
  await wait(500);
  const row = pane.querySelector('.track[data-id="t9"]');
  ok('it opened the Playlists half and holds the song the record player asked for', !!row);
  ok('and it left the Albums half exactly where it was', mem.albums === 240,
    'albums = ' + mem.albums);

  // jsdom lays nothing out, so a scroll animation has no distance to travel and
  // the shared engine takes the pane to 0 - which is why this measures the
  // WRITES the app makes rather than the value left behind: what has to be true
  // is that opening Albums asks for the Albums offset, and that nothing in a
  // Playlists-side jump ever asks for it.
  console.log('\n- and the other half is never written during a jump -');
  {
    const writes = [];
    // scrollTop lives on an ancestor of this element's own prototype, so the
    // descriptor is looked up the whole way up the chain.
    let desc = null;
    for (let p = pane; p && !desc; p = Object.getPrototypeOf(p)) desc = Object.getOwnPropertyDescriptor(p, 'scrollTop');
    ok('the pane scroll position can be watched', !!desc && !!desc.get && !!desc.set);
    Object.defineProperty(pane, 'scrollTop', {
      configurable: true,
      get() { return desc.get.call(pane); },
      set(v) { writes.push(v); desc.set.call(pane, v); },
    });

    win.navigate('playlists');
    await wait(140);
    scrollHalf(900);
    win.__scJumpToPlayingSong(track);
    await wait(500);
    await wait(140);
    ok('nothing in a jump made from Playlists asks for the Albums offset',
      writes.indexOf(240) === -1, 'writes: ' + JSON.stringify(writes.slice(0, 8)));
    ok('and the jump does not change what Albums remembers', mem.albums === 240,
      'albums = ' + mem.albums);

    writes.length = 0;
    win.navigate('albums');
    await wait(140);
    ok('opening Albums asks the pane for the Albums offset back',
      writes.indexOf(240) !== -1, 'writes: ' + JSON.stringify(writes.slice(0, 8)));
    delete pane.scrollTop;
  }

  console.log('\n- nothing threw while the halves were driven -');
  ok('no real runtime error', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
