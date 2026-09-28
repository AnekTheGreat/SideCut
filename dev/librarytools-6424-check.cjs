// Where "Refetch missing covers" lives, driven for real (64.2.4).
//
// The report - "why is refetch missing covers in watermark remover it should be
// in library tools and fetching" - is about which settings card the button is in,
// so it is asserted where it actually sits: the app is booted, Settings is opened
// on the More tab, and the button is asked for its own ancestors. Being inside
// the Watermark Remover card is the fault; being inside Library Tools & Fetching
// is the fix.
//
// It also drives the button once, because the ONLINE badge next to its label used
// to be wiped by the first tap (the run wrote its progress straight onto the
// button's textContent): the label is its own element now, so the badge has to
// still be there afterwards.
//
//   node dev/librarytools-6424-check.cjs
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
];

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2'], Favorites: ['t1'] } }],
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

(async () => {
  const { win, errors } = boot();
  await wait(3200);
  const doc = win.document;

  console.log('\n— Settings, on the More tab (where both cards live) —');
  doc.getElementById('themeBtn').click();
  await wait(80);
  const moreTab = Array.from(doc.querySelectorAll('#settingsTabsWrap button, .tabs button'))
    .find((b) => /more/i.test(b.textContent || ''));
  if (moreTab) moreTab.click();
  await wait(120);
  const btn = doc.getElementById('refetchCoversBtn');
  ok('the button is on the page', !!btn, btn && btn.textContent);

  const inLibrary = doc.getElementById('collapsibleLibraryContent');
  const inWatermark = doc.getElementById('collapsibleWatermarkContent');
  ok('Library Tools & Fetching is still a card of its own', !!inLibrary);
  ok('and so is Watermark Remover', !!inWatermark);
  ok('the button lives in Library Tools & Fetching', !!btn && !!inLibrary && inLibrary.contains(btn));
  ok('and not in Watermark Remover', !!btn && !!inWatermark && !inWatermark.contains(btn),
    inWatermark && inWatermark.contains(btn) ? 'still in the watermark card' : '');

  console.log('\n— it sits with the rest of the fetching, in order —');
  const ids = Array.from(inLibrary.querySelectorAll('button[id]')).map((b) => b.id);
  ok('it is right next to "Fetch missing covers"', ids.indexOf('refetchCoversBtn') === ids.indexOf('fetchMissingCoversBtn') + 1, ids.join(' → '));
  ok('and before the lyrics fetch', ids.indexOf('refetchCoversBtn') < ids.indexOf('fetchMissingLyricsBtn'));
  ok('the watermark card keeps its own controls', !!doc.getElementById('watermarkEnabledToggle') && !!doc.getElementById('watermarkConfirmBtn')
    && !inWatermark.contains(btn));

  console.log('\n— the ONLINE badge survives a run (it did not before) —');
  const label = doc.getElementById('refetchCoversLabel');
  ok('the label is its own element', !!label && /refetch/i.test(label.textContent), label && label.textContent);
  ok('with the badge beside it', /ONLINE/.test(btn.textContent));
  // The run wrote its progress straight onto the BUTTON's textContent, which took
  // the badge with it the first time it ran - so what is asserted is the whole
  // button, before and after: the wording and the badge both have to survive.
  const before = btn.textContent;
  ok('the badge is part of the button to begin with', /ONLINE/.test(before));
  btn.click();
  await wait(300);
  ok('and a run leaves the badge and the wording exactly as they were', btn.textContent === before, btn.textContent);
  ok('because the run reports into its own label element', !!label && label !== btn && label.parentNode === btn);
  ok('while the notes above it are untouched', /Refetch missing covers now sits with the rest of the library tools/.test(html));

  console.log('\n— nothing about it can throw —');
  const errs = realErrors(errors);
  ok('no error was raised while all of that ran', errs.length === 0, errs.slice(0, 2).join(' | '));

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
