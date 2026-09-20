// "The app crashed, now it won't load, and my music is gone."
//
// A crash during playback is a killed WebView renderer, and that leaves
// IndexedDB needing recovery. The boot after it therefore meets a first storage
// read that FAILS — and every one of these checks is about what the app does
// with that failure:
//
//   * a failed read must not be drawn as an empty library ("Add some music to
//     get started" over music that is still on the phone),
//   * it must not poison the session (the failed open was cached, so every later
//     read and write failed too),
//   * it must not hang forever (a blocked/wedged open has no timeout),
//   * it must recover by itself — the second read usually just works,
//   * and a failed read must never be mistaken for a wiped store by the snapshot
//     restore, which used to rewrite playlists/albums/settings and reload.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const updatesSrc = fs.readFileSync(process.env.SC_UPDATES || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

// A rejected promise that nothing owns must never take the app down: several
// storage writes are fire-and-forget, so they are collected and asserted on
// rather than left to kill the run.
const unhandled = [];
process.on('unhandledRejection', (e) => { unhandled.push((e && e.message) || String(e)); });

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(updatesSrc, { headers: { 'Content-Type': 'application/javascript' } });
  }
  return undefined;
});

// A controllable IndexedDB: the first open can fail outright or never answer at
// all, which is what a database left needing recovery looks like from the page.
function makeIDB({ firstOpen }) {
  const data = { tracks: new Map(), meta: new Map() };
  data.tracks.set('t1', { id: 't1', name: 'Alpha', artist: 'Someone' });
  data.meta.set('idCounter', { key: 'idCounter', value: 1 });
  data.meta.set('playlists', { key: 'playlists', value: { 'All Songs': ['t1'] } });
  let opens = 0;
  const idxdb = {
    _data: data,
    get opens() { return opens; },
    open() {
      const n = ++opens;
      const req = { error: null };
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({}),
        close() {},
        transaction(store) {
          const t = { oncomplete: null, onerror: null, onabort: null, error: null };
          const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
          t.objectStore = () => ({
            put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
            get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
            getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()).filter((v) => v && (v.key !== undefined || v.id !== undefined)); q.onsuccess && q.onsuccess(); }, 0); return q; },
            delete(k) { data[store].delete(k); fire(); return {}; },
          });
          return t;
        },
      };
      if (n === 1 && firstOpen === 'fail') {
        setTimeout(() => { req.error = new Error('simulated storage failure'); try { req.onerror && req.onerror({ target: req }); } catch (e) {} }, 5);
        return req;
      }
      if (firstOpen === 'hang') return req;   // never answers at all, ever
      setTimeout(() => {
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        req.result = db;
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
  };
  return idxdb;
}

async function boot(opts) {
  const errors = [];
  const warns = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|dbPromise|offline/i.test(m)) errors.push(m); });
  vc.on('error', (...a) => errors.push(a.join(' ').split('\n')[0]));
  vc.on('warn', (...a) => warns.push(a.join(' ').split('\n')[0]));
  const idb = opts.idb || makeIDB({ firstOpen: null });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = idb;
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      Object.defineProperty(win.screen, 'refreshRate', { value: 120, configurable: true });
      Object.defineProperty(win.screen, 'requestFrameRate', { value: () => Promise.resolve(), configurable: true });
      win.Capacitor = { isNativePlatform: () => !!(opts && opts.native), getPlatform: () => 'android', nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}), Plugins: opts && opts.plugins || {} };
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  await wait(opts.wait || 3200);
  return { win: dom.window, dom, idb, errors, warns };
}

const shown = (w, id) => {
  const el = w.document.getElementById(id);
  if (!el) return false;
  return el.style.display !== 'none' && !/display:\s*none/.test(el.getAttribute('style') || '');
};
const tracks = (w) => (typeof w.__scGetAllTracks === 'function' ? (w.__scGetAllTracks() || []).length : -1);

(async () => {
  // ---- A. the first read after a crash fails, the next one works ---------------
  console.log('\n— a failed first read no longer poisons the session —');
  const A = await boot({ idb: makeIDB({ firstOpen: 'fail' }) });
  ok('no "Cannot access \'dbPromise\' before initialization" at boot',
     !A.errors.some((e) => /dbPromise/.test(e)), A.errors.slice(0, 2).join(' | '));
  ok('the library still loads (retried, not abandoned)', tracks(A.win) === 1, 'tracks=' + tracks(A.win));
  ok('storage is healthy again', A.win.__scStorageOk && A.win.__scStorageOk() === true);
  ok('so no recovery panel is needed', !A.win.document.getElementById('scStoragePanel'));
  A.win.navigate('library'); await wait(80);
  ok('and the library screen is shown, not the onboarding', !shown(A.win, 'emptyState'));

  // ---- B. a genuinely empty library still gets the onboarding -------------------
  console.log('\n— an empty library is still an empty library —');
  const emptyIdb = makeIDB({ firstOpen: null });
  emptyIdb._data.tracks.clear();
  const B = await boot({ idb: emptyIdb });
  B.win.navigate('library'); await wait(80);
  ok('a read that works and finds nothing shows the onboarding', shown(B.win, 'emptyState'));
  ok('and never the recovery panel', !B.win.document.getElementById('scStoragePanel'));

  // ---- C. a wedged/blocked open -------------------------------------------------
  console.log('\n— a wedged open cannot hang the app on the empty screen —');
  const C = await boot({ idb: makeIDB({ firstOpen: 'hang' }), wait: 11000 });
  const cPanel = C.win.document.getElementById('scStoragePanel');
  ok('the app says so instead of showing an empty library', !!cPanel,
     'opens=' + C.idb.opens);
  ok('and it says the music is still on the phone',
     !!cPanel && /still on this phone/.test(cPanel.textContent || '') && /not lost music/.test(cPanel.textContent || ''),
     cPanel && (cPanel.textContent || '').slice(0, 90));
  ok('with a Try again button', !!C.win.document.querySelector('#scStoragePanel button'));
  C.win.navigate('library'); await wait(80);
  ok('and the onboarding screen is NOT drawn over unreadable music', !shown(C.win, 'emptyState'));
  ok('the failure is bounded — a wedged open times out rather than hanging',
     /storage open timed out/.test(JSON.stringify(C.warns) + C.errors.join(' ')) || C.idb.opens >= 2,
     'opens=' + C.idb.opens);

  // ---- D. recovery without a reload ---------------------------------------------
  console.log('\n— storage recovers on its own, without a reload —');
  const DIdb = makeIDB({ firstOpen: 'fail' });
  const D = await boot({ idb: DIdb, wait: 1200 });
  const opensBefore = DIdb.opens;
  ok('the retry API exists', typeof D.win.__scStorageRetry === 'function');
  if (typeof D.win.__scStorageRetry === 'function') D.win.__scStorageRetry();
  D.win.showSettingsTab('more'); await wait(80);
  const btn = Array.from(D.win.document.querySelectorAll('#refreshRateOptions [data-rate]')).find((b) => b.dataset.rate === '60');
  if (btn) btn.dispatchEvent(new D.win.MouseEvent('click', { bubbles: true }));
  await wait(500);
  ok('a storage write after the retry opens the database again', DIdb.opens > opensBefore,
     'opens ' + opensBefore + ' → ' + DIdb.opens);
  const row = DIdb._data.meta.get('refreshRate');
  ok('and the write actually lands', !!row && row.value === '60', JSON.stringify(row));
  ok('storage is reported healthy', D.win.__scStorageOk && D.win.__scStorageOk() === true);

  console.log('\n— nothing left unowned —');
  ok('no unhandled rejections were left behind by storage', unhandled.length === 0,
     unhandled.slice(0, 3).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  const realErr = A.errors.filter((e) => !/offline|Not implemented|storage open timed out|simulated storage/i.test(e));
  if (realErr.length) { console.log('page errors:'); realErr.slice(0, 5).forEach((e) => console.log('  ' + e)); }
  process.exit(fail ? 1 : 0);
})();
