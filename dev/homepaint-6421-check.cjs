// Home's paint guard, driven for real (64.2.1).
//
// The user's report - "the favorites bubble just disappears when I scroll" - is a
// WebView painting fault, so it cannot be reproduced here. What CAN be driven is
// the half of the fix that runs in the app: with the app really booted, a Home
// grid that has lost a bubble must draw it again once a scroll settles, and a
// bubble still holding the state a drag gives it must be put back to a plain
// bubble. Both are asserted against the shipped index.html, not against a copy
// of the code.
//
//   node dev/homepaint-6421-check.cjs
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
  { id: 't3', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 210 },
];
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3'], Favorites: ['t1'], 'Punjabi Gaane': ['t1'] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: {} }],
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
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, idb, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
const kinds = (win) => Array.from(win.document.querySelectorAll('#homeBubbles .home-bubble')).map((b) => b.dataset.bubble);
// One settled scroll, the way the watcher sees it.
const settle = async (win) => {
  win.document.getElementById('homeView').dispatchEvent(new win.Event('scroll'));
  await wait(420);
};

(async () => {
  const { win, errors } = boot();
  await wait(3200);
  const doc = win.document;
  const grid = doc.getElementById('homeBubbles');
  const home = doc.getElementById('homeView');

  console.log('\n— the grid a scroll starts from —');
  ok('Home is rendered', !!grid && kinds(win).length > 0, kinds(win).join(','));
  ok('the Favorites bubble is on it', kinds(win).indexOf('favorites') !== -1);
  ok('and every bubble the layout asks for is drawn', kinds(win).length === 11, kinds(win).length);
  ok('the paint watch is wired to the Home view', home && home._hbPaintWatch === true);
  ok('and Home carries its own stacking context', /#homeView\{[^}]*position:relative; z-index:20;/.test(html));

  console.log('\n— a grid that lost a bubble draws it again (what the screenshot shows) —');
  {
    const before = kinds(win).length;
    const fav = grid.querySelector('.home-bubble[data-bubble="favorites"]');
    fav.parentNode.removeChild(fav);
    ok('the bubble really is gone', !grid.querySelector('.home-bubble[data-bubble="favorites"]'), before);
    await settle(win);
    const after = grid.querySelector('.home-bubble[data-bubble="favorites"]');
    ok('one settled scroll later it is back on the page', !!after);
    ok('with its count drawn', !!after && /Favorites/.test(after.textContent));
    ok('and no extra bubble came with it', kinds(win).length === before, kinds(win).length);
  }

  console.log('\n— a bubble holding what a drag gives it is put back —');
  {
    const b = grid.querySelector('.home-bubble[data-bubble="notifications"]');
    b.classList.add('hb-dragging');
    b.style.position = 'fixed';
    b.style.left = '0';
    b.style.top = '0';
    b.style.width = '180px';
    b.style.height = '130px';
    b.style.transform = 'translate(0px, 0px) scale(1.05)';
    b.style.transition = 'none';
    const ph = doc.createElement('div');
    ph.className = 'home-bubble hb-drag-placeholder';
    grid.appendChild(ph);
    await settle(win);
    const after = grid.querySelector('.home-bubble[data-bubble="notifications"]');
    ok('the carry class is cleared', !!after && !after.classList.contains('hb-dragging'));
    ok('and the box that lifted it out of the grid', !!after && !after.style.position && !after.style.transform && !after.style.width);
    ok('a placeholder an abandoned drag left is removed', grid.querySelectorAll('.hb-drag-placeholder').length === 0);
    ok('the grid is whole again', kinds(win).length === 11, kinds(win).length);
  }

  console.log('\n— nothing about the guard can be seen or can throw —');
  {
    ok('the repaint leaves no inline visibility behind', grid.style.visibility === '' || grid.style.visibility === undefined, grid.style.visibility);
    ok('a reorder in progress is never treated as a fault', /reorder-mode\'\)\) return true;/.test(html));
    ok('a live drag owns the grid', html.indexOf('if(hbDrag) return; // a drag in progress owns the grid') !== -1);
    const errs = realErrors(errors);
    ok('no error was raised while all of that ran', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
