// The pinned-artists rail's paint guard, driven for real (64.2.3).
//
// The report this release answers - "pinned artists island sometimes doesn't
// show but comes back after a split second" - is the same WebView painting fault
// 64.2.2 fixed on Home, still living on the rail: 64.2.1 hid the strip for a
// frame (visibility:hidden -> layout flush -> restore) to force a redraw, and a
// phone can present that frame. Reading index.html cannot prove a frame was
// never hidden, so this probe DOES it: the app is really booted, the rail is
// really scrolled, and the strip's inline style is recorded at the moment every
// frame callback runs. Against the pre-fix file that recording contains
// visibility:hidden - the blink itself.
//
//   node dev/railpaint-6423-check.cjs
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
// Two pins, the way the screenshots show the rail populated.
const PINS = [{ name: 'Diljit Dosanjh' }, { name: 'Sidhu Moose Wala' }];

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: {} }],
      ['pinnedArtists', { key: 'pinnedArtists', value: JSON.parse(JSON.stringify(PINS)) }],
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
// Comments describe the code these "is it gone" checks look for, so they run over
// the code only - the same strip dev/test-6058.mjs and the release gate use.
const code = html.replace(/^\s*\/\/.*$/gm, '');
const chips = (win) => Array.from(win.document.querySelectorAll('#pinnedArtistsList .pinned-artist-chip')).map((c) => c.dataset.name);
// One settled scroll, the way the watcher sees it.
const settle = async (win) => {
  win.document.getElementById('discoverView').dispatchEvent(new win.Event('scroll'));
  await wait(420);
};

(async () => {
  const { win, errors } = boot();
  await wait(3200);
  const doc = win.document;
  const strip = doc.getElementById('pinnedArtistsStrip');
  const list = doc.getElementById('pinnedArtistsList');
  const dv = doc.getElementById('discoverView');

  console.log('\n— the rail a scroll starts from —');
  ok('the rail is on the page', !!strip && !!list);
  ok('the pins loaded from the phone', chips(win).length === PINS.length, chips(win).join(','));

  console.log('\n— a settled scroll never hides the strip, and no longer re-rasters a healthy one —');
  {
    // Record the strip's inline style at the moment each frame callback runs: a
    // hide-and-restore repaint is still "hidden" at that point, so this is where
    // the blink shows up.
    const frames = [];
    const raf = win.requestAnimationFrame.bind(win);
    win.requestAnimationFrame = function (cb) {
      return raf(function (t) {
        frames.push({ v: strip.style.visibility, t: strip.style.transform, o: strip.style.outline });
        cb(t);
      });
    };
    await settle(win);
    const hidden = frames.filter((f) => f.v && f.v !== 'visible');
    ok('no frame of the repaint was ever hidden', hidden.length === 0, JSON.stringify(hidden.slice(0, 3)));
    ok('and a healthy rail is asked to paint again, without a layer and without being hidden',
    frames.some((f) => /1px solid transparent/.test(f.o || '')) && !frames.some((f) => /translateZ/.test(f.t || '')),
    JSON.stringify(frames.slice(0, 3)));
    ok('nothing was promoted and left behind', !strip.style.transform, strip.style.transform);
    ok('nor an inline visibility', !strip.style.visibility, strip.style.visibility);
    win.requestAnimationFrame = raf;
  }

  console.log('\n— the scroll does not lay the page out again (the lag spike) —');
  {
    ok('no forced layout in the repaint', !/void strip\.offsetHeight/.test(code));
    ok('and none on Home either', !/void wrap\.offsetHeight/.test(code));
    const watchAt = code.indexOf('  (function watchPinnedRail(){');
    const watch = watchAt === -1 ? '' : code.slice(watchAt, code.indexOf('  function ', watchAt + 10));
    ok('the chip list is judged from the DOM, not measured', watch !== '' && !/getBoundingClientRect/.test(watch));
    // The strip really does get a fresh paint path without a flush: one settle,
    // and the rail is still the rail.
    await settle(win);
    ok('the rail is unchanged by a settled scroll', chips(win).length === PINS.length, chips(win).join(','));
  }

  console.log('\n— a chip left carrying a drag still gets the fresh paint —');
  {
    const chip = list.querySelector('.pinned-artist-chip');
    chip.style.transform = 'translate(4px, 4px) scale(1.04)';
    chip.style.zIndex = '5';
    chip.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    const dragFrames = [];
    const raf2 = win.requestAnimationFrame.bind(win);
    win.requestAnimationFrame = function (cb) {
      return raf2(function (t) {
        dragFrames.push({ t: strip.style.transform, o: strip.style.outline });
        cb(t);
      });
    };
    await settle(win);
    win.requestAnimationFrame = raf2;
    ok('the drag carry is cleared', !chip.style.transform && !chip.style.zIndex, chip.style.transform);
    ok('and that rail was asked to paint again', dragFrames.some((f) => /1px solid transparent/.test(f.o || '')), JSON.stringify(dragFrames.slice(0, 3)));
    ok('with nothing left promoted', !strip.style.transform, strip.style.transform);
  }

  console.log('\n— a rail with no chips on the page is still rebuilt —');
  {
    list.innerHTML = '';
    ok('the chips really are gone', list.querySelectorAll('.pinned-artist-chip').length === 0);
    await settle(win);
    ok('one settled scroll later they are back', chips(win).length === PINS.length, chips(win).join(','));
    ok('with their names on them', /Diljit Dosanjh/.test(list.textContent));
  }

  console.log('\n— and nothing about the guard can be seen or can throw —');
  {
    ok('a drag carry on a chip is still cleared', html.indexOf("if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }") !== -1);
    ok('the watch is wired once, not once per render', /dv\._paRailWatch/.test(html));
    ok('with the 140ms settle', html.indexOf('      }, 140);') !== -1);
    const errs = realErrors(errors);
    ok('no error was raised while all of that ran', errs.length === 0, errs.slice(0, 2).join(' | '));
    ok('and the strip gained no inline style beyond its own',
      !/visibility|transform/.test(strip.getAttribute('style') || ''), strip.getAttribute('style'));
  }

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
