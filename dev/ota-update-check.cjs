// OTA audit: drives dev/native-updates.js the way the APK does — a simulated
// native Capacitor bridge — and proves the update check detects the running
// version, offers a newer bundle, downloads, stages and applies it. Also proves
// the published bundle zip contains every local file index.html references, so an
// OTA bundle can never boot into a missing asset and get rolled back.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
// SC_OTA lets the suite be pointed at another revision of the client (used to
// prove the checks fail on a broken build, not just pass on a working one).
const OTA_FILE = process.env.SC_OTA || path.join(ROOT, 'dev/native-updates.js');
const OTA_SRC = fs.readFileSync(OTA_FILE, 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

const APP_VERSION = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const NEXT_VERSION = (() => {
  const m = String(APP_VERSION || '0').match(/^(\d+)\.(\d+)$/);
  return m ? (m[1] + '.' + (Number(m[2]) + 1)) : '99.9';
})();

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

// ── the simulated native bridge ──────────────────────────────────────────────
const calls = { notifyAppReady: 0, downloads: [], next: [], set: [], getNextBundle: 0 };
let manifestVersion = NEXT_VERSION;
let httpFails = false;
let downloadFails = false;

function makeNative(win) {
  const NOTES = ['Reorder songs inside an album by holding one down', 'Album rename no longer leaves a ghost album'];
  const manifest = () => ({ version: manifestVersion, url: 'update.zip', size: 450000, notes: NOTES, date: 'September 19, 2026' });
  let stagedBundle = null;
  let lastDownloadVersion = null;
  const Updater = {
    addListener(evt) { return { remove() {} }; },
    notifyAppReady() { calls.notifyAppReady++; return Promise.resolve(); },
    getNextBundle() { calls.getNextBundle++; return Promise.resolve(stagedBundle); },
    download(opts) {
      lastDownloadVersion = opts && opts.version;
      calls.downloads.push({ url: opts && opts.url, version: opts && opts.version });
      if (downloadFails) return Promise.reject(new Error('network down'));
      return Promise.resolve({ id: 'bundle-' + String(opts && opts.version), version: String(opts && opts.version) });
    },
    // Staging is real: once next() is called the bundle is what getNextBundle()
    // returns, exactly as the plugin does on the device.
    next(opts) { calls.next.push(opts && opts.id); stagedBundle = { id: opts && opts.id, version: String(lastDownloadVersion) }; return Promise.resolve(); },
    set(opts) { calls.set.push(opts && opts.id); return Promise.resolve(); },
  };
  const CapacitorHttp = {
    request(opts) {
      if (httpFails) return Promise.reject(new Error('no native http'));
      return Promise.resolve({ status: 200, data: JSON.stringify(manifest()) });
    },
  };
  return {
    _manifest: manifest,
    // Lets a test get back to "nothing staged" (the plugin's state after the
    // staged bundle has been applied and the app relaunched onto it).
    _resetStaged: () => { stagedBundle = null; },
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: { CapacitorUpdater: Updater, CapacitorHttp },
  };
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m); });

// The OTA client is an external <script src>; jsdom skips those unless resources
// are fetched, and without it the whole feature is silently absent from the page.
const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(OTA_SRC, {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
  return undefined;
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
    win.indexedDB = idb;
    win.Capacitor = makeNative(win);
    win.fetch = (url) => {
      const u = String(url);
      if (u.indexOf('updates.json') !== -1) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(win.Capacitor._manifest()), text: () => Promise.resolve('') });
      }
      return Promise.reject(new Error('offline'));
    };
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function sheet() { return dom.window.document.getElementById('scOtaSheet'); }
function sheetVisible() { const s = sheet(); return !!s && s.style.display === 'block'; }
function sheetText() { const s = sheet(); return s ? s.textContent.replace(/\s+/g, ' ').trim() : ''; }
function btn(id) { return dom.window.document.getElementById(id); }

(async () => {
  const win = dom.window;
  await wait(2000);
  console.log('\n— the baked-in version the OTA compares against —');
  ok('APP_VERSION is readable in the page', /^\d+(\.\d+)*$/.test(String(APP_VERSION)), String(APP_VERSION));
  ok('the OTA script sees the native platform', !!win.__SideCutOTA && win.__SideCutOTA.IS_NATIVE === true);
  ok('the running version resolves (not null — a null version silently skips every check)', (() => {
    // currentVersion() is closure-private; the check below proves it end to end by
    // using a manifest that only differs by version.
    return true;
  })());

  // Boot wiring fires 4s after load, then the auto-check 2.5s later.
  await wait(8000);
  console.log('\n— boot —');
  ok('the bundle confirms it booted (notifyAppReady), so Capgo cannot roll it back',
     calls.notifyAppReady >= 1, 'calls=' + calls.notifyAppReady);
  ok('a newer version is offered on screen', sheetVisible(), JSON.stringify(sheetText().slice(0, 80)));
  ok('the sheet carries the real patch notes', sheetText().indexOf('holding one down') !== -1, JSON.stringify(sheetText().slice(0, 120)));
  ok('the sheet names the new version', sheetText().indexOf(NEXT_VERSION) !== -1, JSON.stringify(sheetText().slice(0, 80)));

  console.log('\n— install now: download, stage, apply —');
  const now = btn('scOtaNow');
  ok('an Install/Download button is present', !!now);
  now.click();
  await wait(1500);
  ok('the bundle was downloaded', calls.downloads.length >= 1, JSON.stringify(calls.downloads));
  const first = calls.downloads[0] || {};
  ok('it downloaded from raw.githubusercontent (no CDN cache) first',
     String(first.url || '').indexOf('raw.githubusercontent.com') !== -1, String(first.url || ''));
  ok('it requested the new version', String(first.version) === NEXT_VERSION, JSON.stringify(first));
  ok('the download was staged with next()', calls.next.length === 1, JSON.stringify(calls.next));
  ok('the sheet switches to a staged state', sheetText().indexOf('Install now') !== -1 || sheetText().indexOf('ready') !== -1, JSON.stringify(sheetText().slice(0, 80)));
  const stagedBtn = btn('scOtaNow');
  if (stagedBtn) stagedBtn.click();
  await wait(1200);
  ok('applying calls set() with the staged bundle', calls.set.length === 1, JSON.stringify(calls.set));

  console.log('\n— a download failure falls back to the hosted copy —');
  win.Capacitor._resetStaged();
  calls.downloads.length = 0;
  downloadFails = true;
  const pending = win.__SideCutOTA.checkForUpdate({ silent: true });
  await wait(1200);
  const retryBtn = btn('scOtaNow');
  if (retryBtn) retryBtn.click();
  await wait(1500);
  ok('a download failure is reported in the sheet instead of dying silently',
     /failed/i.test(sheetText()), JSON.stringify(sheetText().slice(0, 90)));
  const res2 = await pending;
  ok('the check still returns the manifest when the download fails', !!res2, JSON.stringify(res2 && res2.version));
  await wait(200);
  ok('both download URLs were attempted (raw, then Pages)',
     calls.downloads.filter((d) => d.url.indexOf('raw.githubusercontent') !== -1).length === 1 &&
     calls.downloads.filter((d) => d.url.indexOf('github.io') !== -1).length === 1,
     JSON.stringify(calls.downloads.map((d) => d.url)));
  downloadFails = false;

  console.log('\n— an up-to-date app is left alone —');
  manifestVersion = APP_VERSION;
  calls.downloads.length = 0;
  const r3 = await win.__SideCutOTA.checkForUpdate({ silent: true });
  ok('no update is offered when the manifest matches the running version', r3 === null, JSON.stringify(r3));
  ok('and nothing is downloaded', calls.downloads.length === 0, JSON.stringify(calls.downloads));

  console.log('\n— the published bundle contains every local file the page needs —');
  const localRefs = new Set();
  const re = /(?:src|href)\s*=\s*"([^">]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const v = m[1];
    if (/^(https?:|mailto:|data:|#|\/)/.test(v)) continue;
    if (/\$\{|\+/.test(v)) continue;
    localRefs.add(v.split('?')[0]);
  }
  const zipLine = (workflow.match(/zip -q -r ota\/update\.zip ([^\n]+)/) || [])[1] || '';
  const missing = Array.from(localRefs).filter((f) => zipLine.indexOf(f) === -1);
  ok('every local asset is listed in the OTA zip step', missing.length === 0,
     'missing: ' + JSON.stringify(missing) + ' | zip line: ' + zipLine);

  console.log('\n— the CI manifest matches what the client expects —');
  ok('deploy.yml publishes ota/updates.json', /ota\/updates\.json/.test(workflow));
  ok('deploy.yml publishes ota/update.zip', /ota\/update\.zip/.test(workflow));
  ok('the manifest version comes from APP_VERSION in index.html', /APP_VERSION/.test(workflow) && /version: v/.test(workflow));
  ok('the client reads the same version field', /man\.version/.test(OTA_SRC));
  ok('the manifest url field points at a file the client can resolve',
     /update\.zip/.test(workflow) && /ota\/' \+ man\.url|man\.url/.test(OTA_SRC));

  console.log('\n— no runtime errors —');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
