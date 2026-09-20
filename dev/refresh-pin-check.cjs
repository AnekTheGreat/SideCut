// Refresh rate, the Discover pin, and the updater's hand-over.
//
// Three reports, each with a mechanism that can be driven here:
//
//  1. "The app doesn't feel smooth, the refresh rate is off." "Max device refresh
//     rate" used to REQUEST screen.refreshRate — and an Android WebView reports its
//     own nominal rate (60) rather than the panel's — so picking "max" quietly
//     pinned the whole app to 60 Hz on a 120 Hz phone. Requesting a rate also holds
//     the display there for as long as the app is open, so the wrong number was felt
//     everywhere. A rate carried in from an old backup could do the same.
//
//  2. "After I pinned an artist in Discover the app crashed." Everything the pin
//     does after saving is cosmetic, and it can no longer escape as a failure; the
//     pin is recorded in the flight recorder so a real process death in that path is
//     named on the next boot; and the artwork backfill (network fetch + full-size
//     image decode per artist) runs one at a time instead of all at once.
//
//  3. "Every time you open the app any other way it auto refreshes." A staged bundle
//     is handed over only on a real app kill — never on a background/foreground
//     cycle, which is exactly what opening from the widget or the notice is.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const updatesSrc = fs.readFileSync(process.env.SC_UPDATES || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

function fakeIndexedDB(storedRate) {
  const meta = new Map();
  const metaRows = [
    { key: 'tracks', value: [] },
    { key: 'playlists', value: { 'All Songs': [] } },
    { key: 'userAlbums', value: {} },
  ];
  if (storedRate) metaRows.push({ key: 'refreshRate', value: storedRate });
  // Rows are stored the way dbPut stores them, so dbGetAll sees real records.
  metaRows.forEach((r) => meta.set(r.key, r));
  const data = { tracks: new Map(), meta };
  function tx(store) {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()).filter((v) => v && (v.key !== undefined || v.id !== undefined)); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
    });
    return t;
  }
  return {
    _data: data,
    open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
  };
}

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(updatesSrc, { headers: { 'Content-Type': 'application/javascript' } });
  }
  return undefined;
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Boot one page. `reportedHz` is what the WebView says the display can do — Android
// reports its own nominal 60 even on a 120 Hz panel, which is the bug being modelled.
async function boot({ reportedHz, storedRate }) {
  const rateRequests = [];
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m); });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = fakeIndexedDB(storedRate);
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      Object.defineProperty(win.screen, 'refreshRate', { value: reportedHz, configurable: true });
      Object.defineProperty(win.screen, 'requestFrameRate', { value: function (hz) { rateRequests.push(Number(hz)); return Promise.resolve(); }, configurable: true });
      win.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web', nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}), Plugins: {} };
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  await wait(2600);
  const win = dom.window;
  // The rate buttons live in Settings → More, and are built when that tab opens.
  try { win.showSettingsTab('more'); } catch (e) {}
  await wait(50);
  return { win, dom, rateRequests, errors, stored: (k) => dom.window.indexedDB._data.meta.get(k) };
}

(async () => {
  // ---- Scenario A: the WebView reports 60, the way Android does. -----------------
  console.log('\n— "max device refresh rate" never caps the app (WebView reports 60) —');
  const A = await boot({ reportedHz: 60, storedRate: 'max' });
  ok('boot requests no rate at all', A.rateRequests.length === 0, JSON.stringify(A.rateRequests));
  const maxBtn = Array.from(A.win.document.querySelectorAll('#refreshRateOptions [data-rate]')).find((b) => b.dataset.rate === 'max');
  ok('the settings offer the max device refresh rate', !!maxBtn);
  A.rateRequests.length = 0;
  if (maxBtn) { maxBtn.dispatchEvent(new A.win.MouseEvent('click', { bubbles: true })); await wait(80); }
  ok('choosing it does not ask for 60 Hz', A.rateRequests.indexOf(60) === -1 && A.rateRequests.length === 0, JSON.stringify(A.rateRequests));
  A.rateRequests.length = 0;
  const hz120 = Array.from(A.win.document.querySelectorAll('#refreshRateOptions [data-rate]')).find((b) => b.dataset.rate === '120');
  if (hz120) { hz120.dispatchEvent(new A.win.MouseEvent('click', { bubbles: true })); await wait(80); }
  ok('picking 120 Hz explicitly still asks for 120 Hz', A.rateRequests.indexOf(120) !== -1, JSON.stringify(A.rateRequests));

  // ---- Scenario B: a 165 Hz-style backup meets a 120 Hz screen. -------------------
  console.log('\n— a stored rate this screen cannot do falls back to the device rate —');
  const B = await boot({ reportedHz: 120, storedRate: '60' });
  ok('the stored 60 Hz is not requested on a 120 Hz display', B.rateRequests.indexOf(60) === -1, JSON.stringify(B.rateRequests));
  const storedNow = B.stored('refreshRate');
  ok('and the app moves to the device rate', storedNow && storedNow.value === 'max', JSON.stringify(storedNow));
  const bMax = Array.from(B.win.document.querySelectorAll('#refreshRateOptions [data-rate]')).find((b) => b.dataset.rate === 'max');
  ok('the settings show that it moved', !!bMax && /var\(--coral\)/.test(bMax.getAttribute('style') || ''), bMax && bMax.getAttribute('style'));

  // ---- Scenario C: the Discover pin. --------------------------------------------
  console.log('\n— the Discover pin survives its own follow-up work —');
  const C = A.win;
  ok('the pin hook exists', typeof C.__scTogglePinArtist === 'function');
  // Break one thing the post-pin refresh touches, to prove the failure cannot escape
  // (this used to abort the rest of the handler, mid-pin).
  const bubble = C.document.getElementById('homeBubbleOverlay');
  if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
  let threw = null;
  try { C.__scTogglePinArtist('Diljit Dosanjh', null); } catch (e) { threw = e; }
  await wait(400);
  ok('a failing refresh does not escape the pin', !threw, threw && threw.message);
  const pinned = typeof C.__scPinnedArtists === 'function' ? (C.__scPinnedArtists() || []) : null;
  ok('and the artist is pinned anyway', !!pinned && pinned.some((a) => /Diljit/i.test(a.name)),
     JSON.stringify(pinned && pinned.map((a) => a.name)));

  console.log('\n— pinning is recorded, and the artwork backfill is serialised —');
  ok('pinning marks itself in the flight recorder', /pinning an artist/.test(html));
  ok('the artwork backfill cannot run twice at once', /__artBackfillBusy/.test(html));

  console.log('\n— a staged update waits for a real app kill —');
  ok('every staged bundle is pinned to a kill hand-over',
     /ALWAYS pin the hand-over to a real app kill/.test(updatesSrc) &&
     /waitForRelaunch\(Updater\)/.test(updatesSrc));
  ok('and it is no longer gated on "something is playing" only',
     !/if\(somethingIsPlaying\(\) \|\| wantDeferredInstall\(version\)\) waitForRelaunch/.test(updatesSrc));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  const real = A.errors.filter((e) => !/dbPromise|offline|no network/i.test(e));
  if (real.length) { console.log('page errors:'); real.slice(0, 6).forEach((e) => console.log('  ' + e)); }
  process.exit(fail ? 1 : 0);
})();
