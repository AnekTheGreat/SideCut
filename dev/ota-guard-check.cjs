// "It updated to v58.9.1, it was working, and then it rolled itself back to
// v58.8.7 and now it restarts the app every few seconds."
//
// Three defects, all in the staged-bundle hand-over, all drivable here:
//
//  1. It applied WHATEVER the native updater had staged, with no direction check
//     (every other path refused an older version). So an old bundle left staged
//     could be handed in over a newer build — the app downgrading itself.
//
//  2. A bundle refused in JS stayed staged, and the native updater applies
//     whatever is "next" on every background BY ITSELF. So the refusal changed
//     nothing: the plugin swapped it in anyway, the app came back, swap again —
//     the app restarting itself over and over.
//
//  3. A version pinned in the rollback picker swaps the page back to that
//     version's saved snapshot on every launch, while the BUNDLE underneath keeps
//     updating. The two fight: install, swap back, install, forever — always
//     reporting the old version. Installing an update now clears the pin.
//
// And the bookkeeping moved off localStorage (flushed asynchronously, so a die
// mid-hand-over loses it and the bundle is retried forever) onto a real file in
// the app's data directory, written and awaited BEFORE the hand-over.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const OTA_SRC = fs.readFileSync(process.env.SC_OTA || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

const APP = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '0.0.0';
const NEXT = APP.replace(/(\d+)$/, (m) => String(Number(m) + 1));
const OLD = APP.replace(/(\d+)$/, (m) => String(Math.max(0, Number(m) - 1)));

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

function fakeIndexedDB(extraRows) {
  const meta = new Map([
    ['idCounter', { key: 'idCounter', value: 3 }],
    ['playlists', { key: 'playlists', value: { 'All Songs': [] } }],
    ['userAlbums', { key: 'userAlbums', value: {} }],
  ]);
  (extraRows || []).forEach((r) => meta.set(r.key, r));
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
    open() {
      const req = { error: null };
      const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), close() {}, transaction: (n) => tx(n) };
      setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0);
      return req;
    },
  };
}

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(OTA_SRC, { headers: { 'Content-Type': 'application/javascript' } });
  }
  return undefined;
});

// One native launch of the real page, with a controllable native updater.
async function boot(opts) {
  const o = opts || {};
  const calls = { set: [], next: [], reloads: 0, delays: [] };
  const staged = o.stagedVersion ? { id: 'bundle-' + o.stagedVersion, version: String(o.stagedVersion) } : null;
  const runId = o.runningVersion || APP;
  const files = Object.assign({}, o.files || {});        // the native filesystem
  const vc = new VirtualConsole();
  const errors = [];
  // jsdom refuses to navigate, and says so — which is the only way it reports a
  // page reload, so keep those (and filter them out of the real-error list).
  vc.on('jsdomError', (e) => {
    const m = '' + (e && e.message);
    if (/Not implemented/i.test(m)) { if (/navigation to another Document/i.test(m)) errors.push('NAVIGATION'); return; }
    errors.push(m);
  });
  vc.on('error', () => {});
  vc.on('warn', () => {});

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = fakeIndexedDB(o.metaRows);
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      try { win.location.reload = function () { calls.reloads++; }; } catch (e) {}
      for (const k of Object.keys(o.localStorage || {})) win.localStorage.setItem(k, o.localStorage[k]);
      const Updater = {
        addListener() { return { remove() {} }; },
        notifyAppReady: () => Promise.resolve(),
        getNextBundle: () => Promise.resolve(staged),
        // The running bundle as the native side sees it. For a page that is a
        // pinned snapshot this is NEWER than the page's own version.
        current: () => Promise.resolve({ id: 'bundle-' + runId, version: String(runId) }),
        set: (a) => { calls.set.push(a && a.id); return Promise.resolve(); },
        next: (a) => { calls.next.push(a && a.id); return Promise.resolve({ id: a && a.id, version: 'x' }); },
        setMultiDelay: (a) => { calls.delays.push(JSON.stringify(a)); return Promise.resolve(); },
        cancelDelay: () => Promise.resolve(),
        download: (a) => Promise.resolve({ id: 'bundle-' + (a && a.version), version: String(a && a.version) }),
      };
      const Filesystem = {
        readFile: (a) => {
          if (!(a.path in files)) return Promise.reject(new Error('ENOENT'));
          return Promise.resolve({ data: files[a.path] });
        },
        writeFile: (a) => { files[a.path] = a.data; return Promise.resolve({}); },
      };
      win.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        Plugins: { CapacitorUpdater: Updater, Filesystem },
        nativePromise: () => Promise.resolve({}),
        nativeCallback: () => Promise.resolve({}),
      };
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  await wait(o.wait || 6500);
  const win = dom.window;
  const ledger = () => { try { return JSON.parse(files['sidecut-ota-ledger.json'] || '{}'); } catch (e) { return {}; } };
  return { win, dom, calls, errors, files, ledger, staged };
}

function ledgerWith(o) {
  return { 'sidecut-ota-ledger.json': JSON.stringify(Object.assign({ tried: {}, bad: {}, boots: [] }, o)) };
}

(async () => {
  console.log('\n— an update still installs itself on launch (the point of 58.9.1) —');
  const A = await boot({ stagedVersion: NEXT });
  ok('a newer staged bundle is handed over on boot', A.calls.set.length >= 1, 'set=' + JSON.stringify(A.calls.set));
  ok('the hand-over is recorded on disk BEFORE the swap (survives a crash)',
     !!(A.ledger().tried || {})[NEXT], JSON.stringify(A.ledger()));
  ok('and it clears any pinned version so the new bundle really runs',
     A.win.localStorage.getItem('sidecut_ota_pin_clear') === '1');

  console.log('\n— it can never install a DOWNGRADE (the auto-roll-back) —');
  const B = await boot({ stagedVersion: OLD });
  ok('an older staged bundle is never handed over', B.calls.set.length === 0, 'set=' + JSON.stringify(B.calls.set));
  ok('and it is taken away from the native updater, which applies "next" by itself',
     B.calls.next.length >= 1 && B.calls.next.indexOf('bundle-' + APP) !== -1, JSON.stringify(B.calls.next));
  const bSheet = B.win.document.getElementById('scOtaSheet');
  ok('the downgrade is not offered in the update sheet either',
     !bSheet || bSheet.style.display !== 'block');

  if (/^5[0-9]\./.test(OLD)) {
    const B2 = await boot({ stagedVersion: '58.8.7' });
    ok('the version from the report (v58.8.7) is refused over a newer build',
       B2.calls.set.length === 0, 'running ' + APP + ', staged 58.8.7, set=' + JSON.stringify(B2.calls.set));
  }

  console.log('\n— a failed hand-over can never repeat (even if the app died before writing anything) —');
  const C = await boot({ stagedVersion: NEXT, files: ledgerWith({ tried: { [NEXT]: { at: Date.now(), why: 'hand-over' } } }) });
  ok('a bundle recorded as already attempted on disk is not tried again', C.calls.set.length === 0, 'set=' + JSON.stringify(C.calls.set));
  ok('it is remembered as failed on disk too', !!(C.ledger().bad || {})[NEXT], JSON.stringify(C.ledger().bad));
  ok('and it stops the native updater applying the same bundle', C.calls.next.length >= 1, JSON.stringify(C.calls.next));

  console.log('\n— three launches in a minute shuts the automatic hand-over off entirely —');
  const now = Date.now();
  const hot = await boot({ stagedVersion: NEXT, files: ledgerWith({ boots: [now - 9000, now - 5000, now - 1000] }) });
  ok('during a restart loop nothing is auto-installed', hot.calls.set.length === 0, 'set=' + JSON.stringify(hot.calls.set));
  ok('and the staged bundle is taken off the updater so it cannot swap itself in', hot.calls.next.length >= 1, JSON.stringify(hot.calls.next));

  console.log('\n— a pinned old version can no longer fight an installed newer bundle —');
  const P = await boot({
    runningVersion: NEXT,                       // the BUNDLE is newer than the page…
    localStorage: { sidecut_pinned_snapshot: APP }, // …because a pin put this older page on screen
  });
  ok('the masking pin is detected', P.win.localStorage.getItem('sidecut_ota_pin_clear') === '1');
  ok('the staged bundle is taken off the updater so it stops swapping in', P.calls.next.length >= 1, JSON.stringify(P.calls.next));
  // jsdom cannot run a real page reload, so the reload is observed the only way it
  // reports one: a navigation attempt.
  const navAway = P.errors.filter((e) => e === 'NAVIGATION').length;
  ok('and the app returns to the newest installed version once', navAway === 1, 'navigations=' + navAway);

  console.log('\n— the page itself: an update clears a pinned version —');
  const snapHtml = '<!DOCTYPE html><html><head><title>old</title></head><body>SNAPSHOT-OLD-MARKER</body></html>';
  const metaRows = [
    { key: 'pinnedVersion', value: APP === '58.8.7' ? OLD : '58.8.7' },
    { key: 'versionSnapshot_' + (APP === '58.8.7' ? OLD : '58.8.7'), value: { version: APP === '58.8.7' ? OLD : '58.8.7', savedAt: Date.now(), html: snapHtml } },
  ];
  const pinned = await boot({ metaRows, wait: 2500 });
  ok('a pin still works when nothing was installed',
     pinned.win.document.documentElement.innerHTML.indexOf('SNAPSHOT-OLD-MARKER') !== -1,
     'the pinned snapshot did not load — harness problem, not an app bug');
  const cleared = await boot({ metaRows, localStorage: { sidecut_ota_pin_clear: '1' }, wait: 2500 });
  ok('but an update drops the pin and runs the installed version',
     cleared.win.document.documentElement.innerHTML.indexOf('SNAPSHOT-OLD-MARKER') === -1);
  ok('and the pin is really deleted, not just skipped',
     !cleared.win.indexedDB._data.meta.get('pinnedVersion'));
  ok('the one-shot flag is consumed', cleared.win.localStorage.getItem('sidecut_ota_pin_clear') === null);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
