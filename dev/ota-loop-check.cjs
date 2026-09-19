// Loop audit for the "after I updated it just kept refreshing and nothing played"
// report. Three things are proven here:
//   1. A freshly installed bundle is confirmed as soon as it boots (not only at one
//      fixed moment 4s after 'load'), so a slow boot can't make Capgo roll it back.
//   2. When a bundle DOES fail to take over, that version is remembered and never
//      auto-installed again — one bad update can't become an endless refresh.
//   3. The snapshot self-heal reloads the app at most once per install, so a restore
//      that cannot stick can't leave the app reloading forever with no library.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const OTA_SRC = fs.readFileSync(process.env.SC_OTA || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const APP_VERSION = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const NEXT_VERSION = (() => {
  // Handles two- and three-part versions (58.8 and 58.8.1 both become 58.9).
  const m = String(APP_VERSION || '0').match(/^(\d+)\.(\d+)/);
  return m ? (m[1] + '.' + (Number(m[2]) + 1)) : '99.9';
})();

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 300, height: 150 };
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
  const data = { tracks: new Map(), meta: new Map() };
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

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(OTA_SRC, { headers: { 'Content-Type': 'application/javascript' } });
  }
  return undefined;
});

// Carry a session's localStorage into the next boot, so a multi-boot refresh
// loop can actually be reproduced (and counted) instead of guessed at.
function snapLS(win) {
  const out = {};
  try {
    for (let i = 0; i < win.localStorage.length; i++) {
      const k = win.localStorage.key(i);
      out[k] = win.localStorage.getItem(k);
    }
  } catch (e) {}
  return out;
}

const SNAPSHOT = {
  v: 1,
  localStorage: { sidecut_theme: 'coral', sidecut_snapshot_marker: 'restored' },
  meta: { idCounter: 42, playlists: { 'All Songs': ['t1'] }, theme: 'coral' },
};

function boot(opts) {
  const o = opts || {};
  const calls = { notifyAppReady: 0, notifyAppReadyAt: 0, set: [], next: [], downloads: 0 };
  const navs = [];              // every location.reload() the page performs
  const toasts = [];
  const manifest = { version: o.manifestVersion || NEXT_VERSION, url: 'update.zip', size: 450000, notes: ['x'], date: 'September 19, 2026' };
  const stagedBundle = o.stagedVersion ? { id: 'bundle-' + o.stagedVersion, version: String(o.stagedVersion) } : null;
  const startedAt = Date.now();

  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = '' + (e && e.message);
    if (/navigation/i.test(m)) navs.push(m);
    else if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1 && m.indexOf('error') === -1) { /* noise */ }
  });

  const idb = fakeIndexedDB();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      // jsdom refuses real navigation; spy on reload() so a refresh loop is
      // countable instead of a stream of "Not implemented" console noise.
      try { win.location.reload = function () { navs.push(Date.now()); }; } catch (e) {}
      win.indexedDB = idb;
      for (const k of Object.keys(o.localStorage || {})) {
        win.localStorage.setItem(k, o.localStorage[k]);
      }
      const Updater = {
        addListener() { return { remove() {} }; },
        notifyAppReady() { calls.notifyAppReady++; if (!calls.notifyAppReadyAt) calls.notifyAppReadyAt = Date.now() - startedAt; return Promise.resolve(); },
        getNextBundle() { return Promise.resolve(stagedBundle); },
        download(optsIn) { calls.downloads++; return Promise.resolve({ id: 'bundle-' + String(optsIn && optsIn.version), version: String(optsIn && optsIn.version) }); },
        next(optsIn) { calls.next.push(optsIn && optsIn.id); return Promise.resolve(); },
        set(optsIn) { calls.set.push(optsIn && optsIn.id); return Promise.resolve(); },
      };
      const CapacitorHttp = { request() { return Promise.resolve({ status: 200, data: JSON.stringify(manifest) }); } };
      const Filesystem = {
        readFile() {
          if (!o.snapshot) return Promise.reject(new Error('not found'));
          return Promise.resolve({ data: JSON.stringify(o.snapshot) });
        },
        writeFile() { return Promise.resolve({}); },
      };
      win.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        Plugins: { CapacitorUpdater: Updater, CapacitorHttp, Filesystem },
      };
      win.fetch = (url) => {
        if (String(url).indexOf('updates.json') !== -1) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest), text: () => Promise.resolve('') });
        }
        return Promise.reject(new Error('offline'));
      };
    },
  });
  const win = dom.window;
  win.toast = function (m) { toasts.push(String(m)); };
  return { dom, win, calls, navs, toasts, idb, startedAt };
}

(async () => {
  // ------------------------------------------------------------------
  console.log('\n— a new bundle is confirmed as soon as it boots —');
  const a = boot({ manifestVersion: NEXT_VERSION });
  await wait(2600);
  ok('the bundle confirmed it booted (notifyAppReady)', a.calls.notifyAppReady >= 1, 'calls=' + a.calls.notifyAppReady);
  ok('and it did so within 3s, not only 4s after load', a.calls.notifyAppReadyAt > 0 && a.calls.notifyAppReadyAt < 3000,
     'at ' + a.calls.notifyAppReadyAt + 'ms');
  a.dom.window.close();

  // ------------------------------------------------------------------
  console.log('\n— a bundle that failed to take over is never retried —');
  // We handed over to NEXT_VERSION (sidecut_ota_pending) but the app came up on the
  // older build: exactly the rolled-back state, and NEXT_VERSION is still staged.
  const b = boot({
    manifestVersion: NEXT_VERSION,
    stagedVersion: NEXT_VERSION,
    localStorage: { sidecut_ota_pending: JSON.stringify({ version: NEXT_VERSION, at: Date.now() - 60000 }) },
  });
  await wait(11000);   // boot wiring (4s) + auto-check (2.5s) have both run
  ok('the failed version is remembered as bad', !!b.win.localStorage.getItem('sidecut_ota_bad_' + NEXT_VERSION),
     String(b.win.localStorage.getItem('sidecut_ota_bad_' + NEXT_VERSION)));
  ok('the hand-over record is cleared', !b.win.localStorage.getItem('sidecut_ota_pending'));
  ok('the failed bundle is NOT applied again (no set() call)', b.calls.set.length === 0, JSON.stringify(b.calls.set));
  ok('the user is told the update did not start', b.toasts.some((t) => /did not start/i.test(t)), JSON.stringify(b.toasts.slice(0, 3)));
  ok('an automatic check does not re-download it', b.calls.downloads === 0 && b.calls.next.length === 0,
     'downloads=' + b.calls.downloads + ' next=' + JSON.stringify(b.calls.next));

  // A deliberate Check for updates may still offer it — one tap, no automatic loop.
  const retry = await b.win.__SideCutOTA.checkForUpdate({});
  await wait(600);
  const sheet = b.win.document.getElementById('scOtaSheet');
  ok('a manual check can still offer the failed version', !!retry && sheet && sheet.style.display === 'block',
     JSON.stringify(retry && retry.version));
  b.dom.window.close();

  // ------------------------------------------------------------------
  console.log('\n— the snapshot restore reloads at most once —');
  // A wiped install (new origin after an update, restored from Android Auto
  // Backup, a partial wipe) with a snapshot file present: the app hydrates and
  // reloads ONCE so it boots against the restored data. That single reload is the
  // feature. What must never happen is a second one when the hydrate did not
  // stick — reload, restore, reload, restore… with no library and no playback.
  const c = boot({ manifestVersion: APP_VERSION, snapshot: SNAPSHOT, stagedVersion: null });
  await wait(2500);
  ok('a wiped install hydrates from the snapshot', String(c.win.localStorage.getItem('sidecut_snap_restore_tries')) === '1',
     String(c.win.localStorage.getItem('sidecut_snap_restore_tries')));
  ok('and reloads exactly once so the app boots against it', c.navs.length === 1, 'reloads=' + c.navs.length);
  // Simulate the hydrate not sticking: the stores come up empty again next boot.
  c.idb._data.meta.clear();
  c.win.localStorage.removeItem('sidecut_snapshot_marker');
  const second = await c.win.__scSnapRestore();
  await wait(400);
  ok('the repeat attempt still hydrates', second === true);
  ok('but it never reloads a second time', c.navs.length === 1, 'reloads=' + c.navs.length);
  // The restore's notice goes through the app's own toast() (a script-scope
  // function, not window.toast), so read it off the page.
  ok('the app says what happened instead of silently refreshing', /Recovered your library/i.test(c.win.document.body.textContent),
     JSON.stringify(c.win.document.body.textContent.replace(/\s+/g, ' ').slice(-120)));
  // And a third pass is just as quiet — no accumulation of reloads.
  c.idb._data.meta.clear();
  c.win.localStorage.removeItem('sidecut_snapshot_marker');
  await c.win.__scSnapRestore();
  await wait(300);
  ok('a third pass adds no reload either', c.navs.length === 1, 'reloads=' + c.navs.length);
  c.dom.window.close();

  // ------------------------------------------------------------------
  console.log('\n— a stale staged record can no longer restart the app forever —');
  // The reported loop: the native plugin keeps reporting a "next" bundle whose
  // version is the one ALREADY running (it only clears "next" once a boot
  // confirms it, and a native reload does not always run that confirm).
  // Auto-applying it reloads into the same build — apply, reload, apply, reload —
  // for as long as the app is open, which is exactly "it just kept refreshing
  // after I updated until I force-closed it".
  let ls = {};
  let staleSets = 0, staleReloads = 0;
  for (let i = 0; i < 3; i++) {
    const w = boot({ manifestVersion: NEXT_VERSION, stagedVersion: APP_VERSION, localStorage: ls });
    await wait(9000);
    staleSets += w.calls.set.length;
    staleReloads += w.navs.length;
    ls = snapLS(w.win);
    w.dom.window.close();
  }
  ok('a staged bundle that is already running is never applied', staleSets === 0, 'set() calls=' + staleSets);
  ok('so no boot reloads the app into the same build', staleReloads === 0, 'reloads=' + staleReloads);

  // ------------------------------------------------------------------
  console.log('\n— a staged bundle is never applied by the app itself —');
  // The report: "I open the app it refreshes automatically and then I have to
  // click play". The app used to hand over to a staged bundle by itself (on boot,
  // or on the way out of the app). Both are reloads the user did not ask for,
  // and a reload kills playback — restored or live — so the song was gone and
  // play had to be pressed again. Now the bundle is only ever staged: the sheet
  // offers it, one tap installs it, and nothing reloads on its own.
  let ls2 = {};
  let autoSets = 0, autoReloads = 0, offered = 0;
  for (let i = 0; i < 3; i++) {
    const w = boot({ manifestVersion: NEXT_VERSION, stagedVersion: NEXT_VERSION, localStorage: ls2 });
    await wait(9000);
    autoSets += w.calls.set.length;
    autoReloads += w.navs.length;
    const sheet = w.win.document.getElementById('scOtaSheet');
    if (i === 0 && sheet && sheet.style.display === 'block') offered++;
    ls2 = snapLS(w.win);
    w.dom.window.close();
  }
  ok('no boot applies a staged bundle (no set() call)', autoSets === 0, 'set() calls=' + autoSets + ' over 3 boots');
  ok('so the app never refreshes itself on launch', autoReloads === 0, 'reloads=' + autoReloads);
  ok('the staged update is still offered to the user', offered === 1, 'sheet shown=' + offered);
  ok('and it is still staged for the native updater (never marked bad)',
     !ls2['sidecut_ota_bad_' + NEXT_VERSION], String(ls2['sidecut_ota_bad_' + NEXT_VERSION]));

  // One tap still installs it — the update path has to keep working.
  const oneTap = boot({ manifestVersion: NEXT_VERSION, stagedVersion: NEXT_VERSION });
  await wait(6000);
  const tapNow = oneTap.win.document.getElementById('scOtaNow');
  ok('the update sheet offers Install now', !!tapNow);
  if (tapNow) tapNow.click();
  await wait(1500);
  ok('tapping it installs the bundle (one set() call)', oneTap.calls.set.length === 1, JSON.stringify(oneTap.calls.set));
  ok('and the sheet says it is installing instead of going silent',
     /Installing/i.test(String(oneTap.win.document.body.textContent)),
     JSON.stringify(String(oneTap.win.document.body.textContent).replace(/\s+/g, ' ').slice(-120)));
  oneTap.dom.window.close();

  // ------------------------------------------------------------------
  console.log('\n— the app stops refreshing itself even if something else loops —');
  // Whatever the cause of a wake-up/restart storm, the phone must not be stuck on
  // a refresh: four boots inside 90 seconds turn automatic reloads off for the
  // session, and the OTA client stops touching bundles for it too.
  const g = boot({
    manifestVersion: NEXT_VERSION,
    stagedVersion: NEXT_VERSION,
    localStorage: { scBootTimes: JSON.stringify([Date.now() - 5000, Date.now() - 4000, Date.now() - 3000, Date.now() - 2000]) },
  });
  await wait(1600);
  ok('four boots inside the window mark the session as looping', g.win.__scBootLooping === true,
     'count=' + g.win.__scBootCount);
  ok('automatic reloads are refused', typeof g.win.__scAutoReloadAllowed === 'function' && g.win.__scAutoReloadAllowed() === false,
     'hook=' + typeof g.win.__scAutoReloadAllowed);
  ok('the app says so instead of silently refreshing', /restarting itself in a loop/i.test(g.win.document.body.textContent),
     JSON.stringify(String(g.win.document.body.textContent).replace(/\s+/g, ' ').slice(-100)));
  await wait(9000);
  ok('nothing is auto-applied while the app is looping', g.calls.set.length === 0, JSON.stringify(g.calls.set));
  g.dom.window.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
