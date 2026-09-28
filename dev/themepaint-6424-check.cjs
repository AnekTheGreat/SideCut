// The launch paints in your theme, driven for real (64.2.4).
//
// "Every time it boots ... it blinks now slightly" - and part of that blink is
// the app painting itself in the DEFAULT colours and then restyling every colour
// in it (the accent, the raised surfaces, the text drawn on the accent) the
// moment the saved theme row came back out of the database. The fix is a small
// cache that applyTheme() writes and the next launch reads at the top of the app
// script.
//
// "At the top of the app script" is the whole point and it is exactly what is
// driven here: the page is built with a cache already in place, and the root
// variables are read the instant the document finishes parsing - before any of
// the app's asynchronous boot has run - so a pass means the colours were there
// for the FIRST paint, not a moment later. Against the pre-fix file the same read
// comes back empty.
//
//   node dev/themepaint-6424-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// What the last launch would have left behind: a theme nothing in this test
// boot's database has, so anything that shows up can only have come from here.
const CACHE = {
  v: 1, key: 'custom',
  bg: '#102030', bgRaised: '#1a2b3c', coral: '#ff0000', gold: '#00ff00',
  onCoral: '#000000', dyn: 'aurora',
};

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

function fakeIndexedDB() {
  const data = {
    tracks: new Map(),
    meta: new Map([['playlists', { key: 'playlists', value: { 'All Songs': [], Favorites: [] } }]]),
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
      win.confirm = () => true;
      win.localStorage.clear();
      win.localStorage.setItem('sidecut_theme_prepaint', JSON.stringify(CACHE));
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, idb, errors, win: dom.window };
}

// Read the moment the document has been parsed - the JSDOM constructor runs the
// page's scripts, so this is already "before anything asynchronous has had a
// chance to run", which is the state the first paint would see.
const painted = (win) => {
  const root = win.document.documentElement.style;
  return {
    bg: root.getPropertyValue('--bg'), bgRaised: root.getPropertyValue('--bg-raised'),
    coral: root.getPropertyValue('--coral'), gold: root.getPropertyValue('--gold'),
    onCoral: root.getPropertyValue('--on-coral'), dyn: win.document.body.className || '',
  };
};
const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);

(async () => {
  const { win, errors } = boot();
  const first = painted(win);

  console.log('\n— what the very first paint carries —');
  ok('the saved background is already set', first.bg === CACHE.bg, first.bg);
  ok('and the raised surface', first.bgRaised === CACHE.bgRaised, first.bgRaised);
  ok('and the accent', first.coral === CACHE.coral, first.coral);
  ok('and the second accent', first.gold === CACHE.gold, first.gold);
  ok('and the text drawn on the accent', first.onCoral === CACHE.onCoral, first.onCoral);
  ok('and the dynamic-theme class', /theme-dyn-aurora/.test(first.dyn), first.dyn);

  console.log('\n— and the launch still boots normally after it —');
  await wait(3200);
  ok('the app finished its boot', !!win.document.getElementById('homeBubbles') && !!win.document.getElementById('listPane'));
  const after = painted(win);
  // This boot's database has no saved theme, so the app settles on the default -
  // the cache is only a head start on the first paint, never a second source of
  // truth.
  ok('the saved theme from the database still wins a moment later', after.bg !== CACHE.bg || after.coral !== CACHE.coral,
    after.bg + ' / ' + after.coral);
  const rewritten = JSON.parse(win.localStorage.getItem('sidecut_theme_prepaint') || 'null');
  ok('and this launch rewrote the cache for the next one', !!rewritten && rewritten.v === 1 && !!rewritten.coral,
    JSON.stringify(rewritten));
  ok('the cache it wrote is the theme it settled on', !!rewritten && rewritten.bg === after.bg, rewritten && rewritten.bg);
  const errs = realErrors(errors);
  ok('no error was raised along the way', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
