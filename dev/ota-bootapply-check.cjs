// "Can it auto update on boot so I actually get the update."
//
// The staged hand-over was pinned to "when the app is killed", and phones that
// keep the app warm never fire that, so an update could sit staged forever. A
// staged bundle must now install on a REAL launch (the load event) — and only
// there, never on a background/foreground resume, which is the thing that used
// to look like the app refreshing itself — at most once per bundle, with a bundle
// that fails to take over still marked failed so it can never loop.
//
// Also: the update prompt is painted from the app's theme variables instead of
// fixed teal/orange, so it matches the theme (and a live RGB palette).
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const OTA_SRC = fs.readFileSync(process.env.SC_OTA || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

const APP = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '0.0.0';
const NEXT = APP.replace(/(\d+)$/, (m) => String(Number(m) + 1));

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

function fakeIndexedDB() {
  const meta = new Map([
    ['idCounter', { key: 'idCounter', value: 3 }],
    ['playlists', { key: 'playlists', value: { 'All Songs': [] } }],
    ['userAlbums', { key: 'userAlbums', value: {} }],
  ]);
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

async function boot(opts) {
  const o = opts || {};
  const calls = { set: [], delays: [], cancelledDelays: 0 };
  const staged = o.stagedVersion ? { id: 'bundle-' + o.stagedVersion, version: String(o.stagedVersion) } : null;
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/i.test(m)) errors.push(m); });
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
      win.indexedDB = fakeIndexedDB();
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      try { win.location.reload = function () {}; } catch (e) {}
      for (const k of Object.keys(o.localStorage || {})) win.localStorage.setItem(k, o.localStorage[k]);
      const Updater = {
        addListener() { return { remove() {} }; },
        notifyAppReady: () => Promise.resolve(),
        getNextBundle: () => Promise.resolve(staged),
        set: (a) => { calls.set.push(a && a.id); return Promise.resolve(); },
        setMultiDelay: (a) => { calls.delays.push(JSON.stringify(a)); return Promise.resolve(); },
        cancelDelay: () => { calls.cancelledDelays++; return Promise.resolve(); },
        download: (a) => Promise.resolve({ id: 'bundle-' + (a && a.version), version: String(a && a.version) }),
        next: () => Promise.resolve(),
      };
      const Filesystem = { readFile: () => Promise.reject(new Error('none')), writeFile: () => Promise.resolve({}) };
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
  // A track actually playing: `somethingIsPlaying()` looks for a live <audio>,
  // which is the condition every automatic install defers to.
  if (o.playing) {
    const a = dom.window.document.createElement('audio');
    a.src = 'blob:playing';
    Object.defineProperty(a, 'paused', { get: () => false });
    Object.defineProperty(a, 'ended', { get: () => false });
    dom.window.document.body.appendChild(a);
  }
  await wait(o.wait || 6500);   // the boot update path arms a few seconds after load
  return { win: dom.window, dom, calls, errors, staged };
}

(async () => {
  console.log('\n— a staged update installs by itself on launch —');
  const A = await boot({ stagedVersion: NEXT });
  ok('the staged bundle was handed to the updater on boot', A.calls.set.length >= 1,
     'set=' + JSON.stringify(A.calls.set) + ' delays=' + A.calls.delays.length);
  ok('and the kill-condition is lifted for it (it is installing now)', A.calls.cancelledDelays >= 1,
     'cancelDelay=' + A.calls.cancelledDelays);
  ok('the attempt is recorded so it can never repeat', A.win.localStorage.getItem('sidecut_ota_bootapply_' + NEXT) === '1');
  ok('and it is remembered as auto-handled', A.win.localStorage.getItem('sidecut_ota_autohandled_' + NEXT) === '1');
  ok('the pending hand-over is written for the next boot to confirm',
     !!A.win.localStorage.getItem('sidecut_ota_pending'));

  console.log('\n— it can never become a refresh loop —');
  const B = await boot({ stagedVersion: NEXT, localStorage: { ['sidecut_ota_bootapply_' + NEXT]: '1' } });
  ok('a bundle whose boot attempt already ran is not installed again', B.calls.set.length === 0,
     'set=' + JSON.stringify(B.calls.set));
  const C = await boot({ stagedVersion: NEXT, localStorage: { ['sidecut_ota_bad_' + NEXT]: String(Date.now()) } });
  ok('a bundle that failed to start before is never auto-installed', C.calls.set.length === 0,
     'set=' + JSON.stringify(C.calls.set));
  const D = await boot({ stagedVersion: NEXT, localStorage: { ['sidecut_ota_autohandled_' + NEXT]: '1' } });
  ok('a bundle already handed over to once is not tried again', D.calls.set.length === 0,
     'set=' + JSON.stringify(D.calls.set));
  const E = await boot({ stagedVersion: APP });
  ok('a staged record that is the RUNNING version is never applied', E.calls.set.length === 0,
     'set=' + JSON.stringify(E.calls.set) + ' (running ' + APP + ')');

  console.log('\n— a launch that has to defer must not burn the update\u2019s one attempt —');
  // The phone in the report plays music all day, so every automatic hand-over is
  // deferred to "when you close the app". The one-attempt record used to be written
  // BEFORE the hand-over ran, so a deferral burnt it and that version was never
  // auto-installed again: it sat staged while the app kept booting the old bundle,
  // and every fix that shipped looked like it had done nothing.
  const P = await boot({ stagedVersion: NEXT, playing: true });
  ok('the hand-over is deferred while a song plays', P.calls.set.length === 0, 'set=' + JSON.stringify(P.calls.set));
  ok('it is handed over with the close-the-app condition instead', P.calls.delays.length >= 1, 'delays=' + P.calls.delays.length);
  ok('the single automatic attempt is NOT burnt', P.win.localStorage.getItem('sidecut_ota_bootapply_' + NEXT) !== '1',
     String(P.win.localStorage.getItem('sidecut_ota_bootapply_' + NEXT)));
  ok('and no pending hand-over is recorded, so the next boot cannot call it rolled back',
     !P.win.localStorage.getItem('sidecut_ota_pending'),
     String(P.win.localStorage.getItem('sidecut_ota_pending')).slice(0, 60));
  const Q = await boot({ stagedVersion: NEXT });
  ok('so the next launch (no music) installs it', Q.calls.set.length >= 1, 'set=' + JSON.stringify(Q.calls.set));

  console.log('\n— Install now installs, even while music is playing —');
  const R = await boot({ stagedVersion: NEXT, playing: true, localStorage: { ['sidecut_ota_prompt_' + NEXT]: '1' } });
  try { R.win.__SideCutOTA.staged(); } catch (e) {}
  await wait(500);
  const rCard = R.win.document.getElementById('scOtaSheet');
  ok('the update sheet is on screen for the staged bundle', !!rCard && rCard.style.display === 'block', rCard ? rCard.style.display : 'missing');
  const rMsg = R.win.document.getElementById('scOtaMsg');
  ok('it states which build you are actually running',
     /You are on v/.test(rMsg ? rMsg.textContent : '') && (rMsg ? rMsg.textContent.indexOf(APP) !== -1 : false),
     rMsg ? rMsg.textContent : 'missing');
  const rNow = R.win.document.getElementById('scOtaNow');
  if (rNow) rNow.click();
  await wait(900);
  ok('tapping Install now hands the bundle over despite the playing track', R.calls.set.length >= 1,
     'set=' + JSON.stringify(R.calls.set));

  console.log('\n— the update prompt follows your theme —');
  const sheetWin = A.win;
  const card = sheetWin.document.getElementById('scOtaSheet');
  ok('the update prompt exists', !!card);
  const cardStyle = card ? (card.getAttribute('style') || '') : '';
  ok('its surface is a theme variable, not a fixed colour',
     /var\(--bg-raised/.test(cardStyle) && /var\(--ink/.test(cardStyle), cardStyle.slice(0, 90));
  // The old values may only survive INSIDE a var() as a fallback, never as the
  // colour the sheet actually paints with.
  const stripped = cardStyle.replace(/var\([^)]*\)/g, 'VAR');
  ok('it paints nothing from a hardcoded colour',
     ['#13262b', '#2b4450', '#f47a55', '#eef', '#cfe3e3'].every((c) => stripped.indexOf(c) === -1),
     stripped.slice(0, 120));
  const nowBtn = sheetWin.document.getElementById('scOtaNow');
  ok('the primary button is the theme accent', !!nowBtn && /var\(--coral/.test(nowBtn.getAttribute('style') || ''),
     nowBtn && nowBtn.getAttribute('style'));
  ok('the secondary button is themed too',
     /var\(--bg,/.test((sheetWin.document.getElementById('scOtaLater') || {}).getAttribute
       ? sheetWin.document.getElementById('scOtaLater').getAttribute('style') : ''));
  ok('the sheet source declares no fixed accent colour at all',
     !/background:#f47a55|color:#f47a55/.test(OTA_SRC));
  ok('every themed value keeps the old colour as a fallback',
     (OTA_SRC.match(/var\(--[a-z-]+,\s*#[0-9a-f]{3,6}\)/gi) || []).length >= 6,
     'fallbacks=' + (OTA_SRC.match(/var\(--[a-z-]+,\s*#[0-9a-f]{3,6}\)/gi) || []).length);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
