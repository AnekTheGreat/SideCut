// Why the installed app crashed after playing a song but the browser never did.
//
// The native app mirrors a recovery file to disk. Every version it has ever run
// stores its whole page HTML (~1.8 MB) as a `versionSnapshot_<v>` row and none
// are ever pruned, and that file is rewritten shortly after any storage change —
// and playing a song writes the playback position every 3 seconds. If the
// mirror carries those HTML rows, the app is stringifying and writing tens of
// megabytes repeatedly, on the UI thread: a memory spike Android can kill the
// process for (the "random crash after playing a song"), a stalled main thread
// (playback stopping), and constant flash writes (the battery drain). The whole
// path is behind isNative(), which is exactly why a browser is unaffected.
//
// This suite drives the real page as the native platform and measures the bytes.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const updatesSrc = fs.readFileSync(process.env.SC_UPDATES || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

const SNAP_HTML_BYTES = 700 * 1024;   // a version snapshot row, one per version ever run
const HISTORY = 12;                   // a phone that has been through a dozen builds

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

function makeIDB() {
  const data = {
    tracks: new Map([['t1', { id: 't1', name: 'Alpha', artist: 'Someone' }], ['t2', { id: 't2', name: 'Beta', artist: 'Someone' }]]),
    meta: new Map([
      ['idCounter', { key: 'idCounter', value: 7 }],
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2'], 'Late night': ['t2'] } }],
      ['userAlbums', { key: 'userAlbums', value: { 'My album': { trackIds: ['t1'], manual: true } } }],
      ['theme', { key: 'theme', value: 'coral' }],
    ]),
  };
  // The rollback history: one whole-page-HTML row per version the app has run.
  for (let i = 0; i < HISTORY; i++) {
    data.meta.set('versionSnapshot_58.8.' + i, {
      key: 'versionSnapshot_58.8.' + i,
      value: { version: '58.8.' + i, html: 'x'.repeat(SNAP_HTML_BYTES), savedAt: Date.now() - i * 60000 },
    });
  }
  return {
    _data: data,
    open() {
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
      setTimeout(() => {
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        req.result = db;
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
  };
}

async function boot({ native }) {
  const writes = [];   // every byte this app writes to the device
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline/i.test(m)) errors.push(m); });
  vc.on('warn', () => {});
  vc.on('error', (...a) => errors.push(a.join(' ').split('\n')[0]));

  const plugins = {
    Filesystem: {
      readFile: () => Promise.reject(new Error('no such file')),   // fresh install: nothing mirrored yet
      writeFile: (o) => { writes.push({ path: o.path, bytes: (o.data || '').length, data: o.data }); return Promise.resolve({}); },
    },
    MediaSession: { setMetadata: () => Promise.resolve({}), setPlaybackState: () => Promise.resolve({}), setPositionState: () => Promise.resolve({}), setActionHandler: () => Promise.resolve({}) },
  };

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = makeIDB();
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      Object.defineProperty(win.screen, 'refreshRate', { value: 120, configurable: true });
      Object.defineProperty(win.screen, 'requestFrameRate', { value: () => Promise.resolve(), configurable: true });
      win.Capacitor = {
        isNativePlatform: () => !!native,
        getPlatform: () => (native ? 'android' : 'web'),
        nativePromise: () => Promise.resolve({}),
        nativeCallback: () => Promise.resolve({}),
        Plugins: plugins,
      };
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  await wait(3000);
  return { win: dom.window, writes, errors, dom };
}

const biggest = (writes) => writes.reduce((m, w) => Math.max(m, w.bytes), 0);
const snapshotWrites = (writes) => writes.filter((w) => /sidecut-snapshot\.json/.test(w.path));

(async () => {
  console.log('\n— playing a song must not write tens of megabytes to the disk —');
  const N = await boot({ native: true });
  const win = N.win;
  ok('the recovery file is written at all (the feature still works)', snapshotWrites(N.writes).length > 0,
     'writes=' + N.writes.length);
  const before = snapshotWrites(N.writes).length;
  // Play a song: this is what makes the app write the playback position (and so
  // rewrite the recovery file) every few seconds in the real app.
  let broke = null;
  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) { broke = e; }
  await wait(400);
  win.__snapDirtyCall = null;
  try { win.__scSnapDirty(); } catch (e) {}
  await wait(2500);
  try { win.__scSnapDirty(); } catch (e) {}
  await wait(2500);
  ok('playing does not throw', !broke, broke && broke.message);
  const snaps = snapshotWrites(N.writes);
  console.log('    bytes written: [' + snaps.map((w) => w.bytes).join(', ') + ']  (rollback history in the store: ' +
    Math.round(HISTORY * SNAP_HTML_BYTES / 1048576) + ' MB)');
  ok('every recovery-file write stays small (under 1 MB)',
     snaps.every((w) => w.bytes <= 1000000),
     'bytes=' + snaps.map((w) => w.bytes).join(',') + ' history=' + (HISTORY * SNAP_HTML_BYTES / 1048576) + 'MB');
  ok('and nowhere near the rollback history it used to carry',
     biggest(snaps) < SNAP_HTML_BYTES / 4,
     'biggest=' + biggest(snaps) + ' vs one snapshot row=' + SNAP_HTML_BYTES);

  console.log('\n— the file still recovers what matters —');
  const last = snaps[snaps.length - 1];
  let payload = null;
  try { payload = JSON.parse(last.data); } catch (e) {}
  ok('it is valid JSON', !!payload);
  ok('it still carries the user\'s playlists', !!(payload && payload.meta && payload.meta.playlists),
     payload && JSON.stringify(Object.keys((payload.meta) || {})).slice(0, 120));
  ok('it still carries their albums', !!(payload && payload.meta && payload.meta.userAlbums));
  ok('it still carries their settings', !!(payload && payload.meta && payload.meta.theme));
  ok('and still carries localStorage', !!(payload && payload.localStorage));
  ok('but carries no page HTML', !payload || !JSON.stringify(payload).includes('xxxxxxxxxx'),
     'len=' + (payload ? JSON.stringify(payload).length : 0));

  console.log('\n— and it cannot hammer the disk —');
  const beforeCount = N.writes.length;
  for (let i = 0; i < 10; i++) { try { win.__scSnapDirty(); } catch (e) {} await wait(120); }
  await wait(1500);
  const added = N.writes.length - beforeCount;
  ok('ten rapid changes do not become ten writes', added <= 3, 'writes added=' + added);
  ok('an unchanged snapshot is not rewritten', snapshotWrites(N.writes).length - before <= 3,
     'snapshot writes=' + (snapshotWrites(N.writes).length - before));

  console.log('\n— the browser is untouched —');
  const B = await boot({ native: false });
  try { B.win.__scSnapDirty(); } catch (e) {}
  await wait(2200);
  ok('no recovery file is written when not on native', B.writes.length === 0, 'writes=' + B.writes.length);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
