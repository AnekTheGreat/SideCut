// v60.1.4 audit:
//   1. dragging an album card sticks — including when the list redraws mid-drag
//      (this is the "it flicks back" bug)
//   2. the Albums sort sheet says albums, and a drag takes over as the order
//   3. "Get song" resolves and fetches the song itself, with the Spotify handoff
//      left as the fallback
//   4. this build: version, notes and the published OTA bundle
//
// The drag checks run the REAL drag handler out of index.html in jsdom, because
// the bug was never in the maths — it was in what the commit did with the result.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'manifest.json'), 'utf8'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}

const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];

/* ── source-level checks ─────────────────────────────────────────────────── */
console.log('\n— a drag becomes the album order —');
ok('the commit knows whether a sort was in charge',
  /var _wasSorted = \(typeof currentSort !== 'undefined' && currentSort && currentSort !== 'default'\);/.test(html));
ok('and takes the album list over when it was',
  /if\(_wasSorted\)\{ try\{ currentSort = 'default'; \}catch\(_eSort\)\{\} \}/.test(html));
ok('the scroll position of the cards is not touched by that', /renderList\(\);\n\s*if\(_wasSorted\)\{/.test(html));
ok('it says so once, in words', /Album order saved/.test(html));
ok('the order comes off the screen at release, not from the hold-time snapshot',
  /var dragged = \(card && card\.dataset\) \? card\.dataset\.albumName : '';/.test(html) &&
  /\(dragged && liveNames\.indexOf\(dragged\) !== -1\)/.test(html));
ok('a stale snapshot is still the fallback if the card itself is gone',
  /: siblings\.map\(function\(s\)\{ return s\.dataset\.albumName; \}\);/.test(html));
ok('the target index is clamped to the list being written',
  /var to = Math\.max\(0, Math\.min\(keys\.length - 1, currentIndex\)\);/.test(html));

console.log('\n— the sort sheet says albums in Albums —');
ok('title switches with the mode',
  /const _sortTitle = _albumMode \? 'Sort albums' : 'Sort songs';/.test(html));
ok('the first option is named after what you actually do',
  /'default': \['Your own order', 'Where you drag the cards'\]/.test(html));
ok('and the option markup renders those labels',
  /const _lab = _sortLabels\[opt\[0\]\] \|\| \[opt\[1\], opt\[2\]\];/.test(html) && /_lab\[0\]/.test(html));
ok('songs mode keeps its wording', /head\.textContent = _sortTitle;/.test(html));

console.log('\n— Get song fetches the song —');
ok('the button runs the on-device resolver first',
  /async function triggerDiscoverDownload\(card, r, btn\)\{/.test(html) &&
  /got = await window\.__scSaveDiscoverTrack\(r, btn \|\| null\);/.test(html));
ok('and only reaches for Spotify when that found nothing',
  /if\(got\) return;\s*\n\s*\}\s*\n\s*scOpenSpotifySearch\(q\);/.test(html));
ok('the resolver reports success so the fallback can run',
  /if\(!out \|\| !out\.ok\) return false;/.test(html) && /return true;\s*\n\s*\}catch\(e\)\{/.test(html));
ok('the second copy of the same button is gone', !/saveBtn\.textContent = 'Save';/.test(html));
ok('the old "try Get song instead" advice is gone', !/try "Get song" instead/.test(html));
ok('the button describes what it now does',
  /dlBtn\.title = 'Find this song and add it to your library';/.test(html));
ok('the Spotify handoff is still there as the fallback',
  /function scOpenSpotifySearch\(q\)\{/.test(html) && /scOpenSpotifySearch\(q\);/.test(html));

/* ── behavioural checks: the real drag handler ──────────────────────────── */
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

const TRACKS = [
  { id: 't1', name: 'One', artist: 'A', album: 'Zeta', duration: 100 },
  { id: 't2', name: 'Two', artist: 'B', album: 'Alpha', duration: 100 },
  { id: 't3', name: 'Three', artist: 'C', album: 'Moon', duration: 100 },
  { id: 't4', name: 'Four', artist: 'D', album: 'Beta', duration: 100 },
];
const ALBUMS = {
  Zeta: { artist: 'A', trackIds: ['t1'], manual: true },
  Alpha: { artist: 'B', trackIds: ['t2'], manual: true },
  Moon: { artist: 'C', trackIds: ['t3'], manual: true },
  Beta: { artist: 'D', trackIds: ['t4'], manual: true },
};
const META = [
  { key: 'userAlbums', value: ALBUMS },
  { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3', 't4'], Favorites: [] } },
];

function fakeIndexedDB() {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map(META.map((m) => [m.key, m])) };
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

(async () => {
  const jsdomPath = fs.existsSync('/tmp/h/node_modules/jsdom')
    ? '/tmp/h/node_modules/jsdom'
    : 'jsdom';
  let JSDOM, VirtualConsole;
  try { ({ JSDOM, VirtualConsole } = require(jsdomPath)); }
  catch (e) { console.log('\n  (jsdom unavailable — skipping the behavioural drag checks)'); }

  if (JSDOM) {
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
    const win = dom.window;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    function pev(el, type, opts) {
      const o = Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 300, pointerId: 7, pointerType: 'touch', button: 0, isPrimary: true }, opts || {});
      let ev;
      try { ev = new win.PointerEvent(type, o); } catch (e) { ev = new win.MouseEvent(type, o); }
      try { if (!ev.pointerId) Object.defineProperty(ev, 'pointerId', { value: 7 }); } catch (e) {}
      try { if (!ev.pointerType) Object.defineProperty(ev, 'pointerType', { value: 'touch' }); } catch (e) {}
      el.dispatchEvent(ev);
    }
    const cards = () => Array.from(win.document.querySelectorAll('#listPane [data-album-name]'));
    const domOrder = () => cards().map((c) => c.dataset.albumName);
    const savedOrder = () => Object.keys(idb._data.meta.get('userAlbums').value);

    await wait(3000);
    win.Element.prototype.getBoundingClientRect = function () {
      if (this.dataset && this.dataset.albumName) return { top: 0, bottom: 100, height: 100, left: 0, right: 360, width: 360 };
      if (this.id === 'listPane') return { top: 0, bottom: 800, height: 800, left: 0, right: 360, width: 360 };
      return { top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 };
    };
    win.navigate('albums');
    await wait(700);

    console.log('\n— the drag itself —');
    ok('the four manual albums are on screen in their saved order',
      domOrder().join(',') === 'Zeta,Alpha,Moon,Beta', domOrder().join(','));

    // A plain drag: pull the first card down past the next two.
    {
      const hdr = cards()[0].firstElementChild;
      pev(hdr, 'pointerdown', { clientY: 300 });
      await wait(450);
      pev(win.document, 'pointermove', { clientY: 560 });
      await wait(60);
      pev(win.document, 'pointerup', { clientY: 560 });
      await wait(500);
      ok('dropping it two slots down moves it in the list',
        domOrder().join(',') === 'Alpha,Moon,Zeta,Beta', domOrder().join(','));
      ok('and the new order is what the library saved',
        savedOrder().join(',') === 'Alpha,Moon,Zeta,Beta', savedOrder().join(','));
    }

    // The regression: a redraw lands between the drag and the release, so the
    // hold-time snapshot no longer describes the screen.
    {
      const hdr = cards()[0].firstElementChild;   // Alpha, currently first
      pev(hdr, 'pointerdown', { clientY: 300 });
      await wait(450);
      pev(win.document, 'pointermove', { clientY: 520 });   // two slots down
      await wait(60);
      win.renderList();                            // the list is rebuilt mid-drag
      await wait(60);
      pev(win.document, 'pointerup', { clientY: 520 });
      await wait(500);
      ok('a redraw mid-drag no longer undoes the move',
        domOrder().join(',') === 'Moon,Zeta,Alpha,Beta', domOrder().join(','));
      ok('the saved order agrees with the screen',
        savedOrder().join(',') === domOrder().join(','), savedOrder().join(','));
    }

    ok('no album was lost or duplicated by either drag',
      savedOrder().length === 4 && new Set(savedOrder()).size === 4, savedOrder().join(','));
    const real = errors.filter((e) => e.indexOf('Not implemented') === -1);
    ok('nothing threw while dragging', real.length === 0, real.slice(0, 2).join(' | '));
  }

  /* ── this build ─────────────────────────────────────────────────────────── */
  console.log('\n— version, notes and the published bundle —');
  const atLeast = (v, min) => {
    const a = String(v).split('.').map(Number), b = String(min).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return true;
  };
  ok('index.html is v60.1.4 or later', atLeast(version, '60.1.4'), version);
  ok('sw.js cache matches', sw.indexOf('sidecut-shell-v' + version) !== -1);
  const entries = [...html.matchAll(/version: '(\d+(?:\.\d+)*)', date: '([^']*)'/g)].map((m) => ({ v: m[1], d: m[2] }));
  ok('the newest entry is this build', entries[0] && entries[0].v === version, entries[0] && entries[0].v);
  ok('its stamp is Eastern time with minutes', /(EDT|EST)$/.test(entries[0].d) && /:\d\d /.test(entries[0].d), entries[0].d);
  ok('the version history is contiguous on this line (60.1.3 -> 60.1.4)',
    entries.findIndex((e) => e.v === '60.1.3') >= 0 &&
    entries.findIndex((e) => e.v === '60.1.4') < entries.findIndex((e) => e.v === '60.1.3'));
  ok('the numbering rule is still recorded', /third number stops at nine/.test(html));
  const own = (html.match(/\{ version: '60\.1\.4'[\s\S]*?\n  \]}/) || [''])[0];
  ok('the notes describe the album-order fix', /Album order now sticks when you drag a card/.test(own));
  ok('the notes describe the sort-sheet wording', /The sort sheet says what it is in Albums/.test(own));
  ok('the notes describe Get song fetching the song', /Get song gets the song/.test(own));
  ok('the notes say what cannot be done (the Spotify link)',
    /Spotify\\u2019s own track link cannot be read for you automatically/.test(own));
  ok('the OTA manifest carries this version', String(manifest.version) === version, manifest.version);
  ok('the OTA bundle exists for it', fs.existsSync(path.join(ROOT, 'ota', 'update.zip')));
  const updates = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  ok('updates.json carries this version', String(updates.version) === version, updates.version);
  ok('and the notes reach the update popup', Array.isArray(updates.notes) && updates.notes.length >= 3, updates.notes && updates.notes.length);

  console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + '/' + (pass + fail) + ' checks passed (v60.1.4)\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('audit crashed:', (e && e.stack) || e);
  process.exit(1);
});
