// "It takes way to long for the app to boot."
//
// The boot path was measured, not guessed. The app is booted for real in jsdom
// against a phone-shaped store: a dozen versions of rollback history (each
// `versionSnapshot_<v>` row holds the app's whole page HTML), a real library,
// and settings that must still load.
//
// What is measured:
//
//   * how many BYTES of the meta store boot deserialises, and whether it ever
//     touches a rollback row (the page-sized ones) at all;
//   * whether the on-device snapshot FILE is opened on a healthy boot;
//   * how many times each track's audio blob and cover are restored;
//   * whether the list render is still inside the boot turn;
//   * the two CDN dependency tags (source), which used to sit in front of the
//     app's own script and block a cold start.
//
// Run it against the pre-fix build too:
//   SC_HTML=/tmp/index.before.639.html node dev/boot-639-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const updatesSrc = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';

const SNAP_HTML_BYTES = 2_400_000;   // one version snapshot row: the app's whole page
const HISTORY = 12;                  // a phone that has been through a dozen builds

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
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

// ---- A range-aware fake IndexedDB -----------------------------------------
// The real fix reads meta through key ranges so the storage layer never hands
// back the page-sized rollback rows. A fake that ignores ranges cannot tell the
// two builds apart, so this one implements range filtering and counts every
// byte it hands out.
function makeIdbKeyRange() {
  const contains = (r, k) => {
    if (typeof k !== 'string') return false;
    if (r.lower !== null && (r.lowerOpen ? !(k > r.lower) : !(k >= r.lower))) return false;
    if (r.upper !== null && (r.upperOpen ? !(k < r.upper) : !(k <= r.upper))) return false;
    return true;
  };
  return {
    only: (v) => ({ _r: { lower: v, upper: v, lowerOpen: false, upperOpen: false, contains: (k) => k === v } }),
    lowerBound: (v, open) => ({ _r: { lower: v, lowerOpen: !!open, contains: (k) => (open ? k > v : k >= v) } }),
    upperBound: (v, open) => ({ _r: { lower: null, upper: v, upperOpen: !!open, contains: (k) => (open ? k < v : k <= v) } }),
    bound: (l, u, lo, hi) => ({ _r: { lower: l, lowerOpen: !!lo, upper: u, upperOpen: !!hi, contains: (k) => contains({ lower: l, upper: u, lowerOpen: !!lo, upperOpen: !!hi }, k) } }),
  };
}

function sizeofValue(v) {
  if (typeof v === 'string') return v.length;
  try { return JSON.stringify(v).length; } catch (e) { return 0; }
}

function makeIDB(counters, opts) {
  const trackBlobs = [new Blob(['a']), new Blob(['b']), new Blob(['c'])];
  const trackArts = [new Blob(['x']), new Blob(['y']), new Blob(['z'])];
  const tracks = new Map();
  for (let i = 0; i < 3; i++) {
    const rec = {
      id: 't' + i, name: 'Song ' + i, artist: 'Artist ' + i, album: 'Album ' + i,
      duration: 120 + i, fileName: 'song' + i + '.mp3', blobType: 'audio/mpeg',
      artType: 'image/jpeg', dateAdded: Date.now(),
    };
    // Every read of the audio blob and the cover is counted: the old boot path
    // restored each one three times per song.
    Object.defineProperty(rec, 'blob', { get() { counters.blobGets++; return trackBlobs[i]; }, enumerable: true, configurable: true });
    Object.defineProperty(rec, 'art', { get() { counters.artGets++; return trackArts[i]; }, enumerable: true, configurable: true });
    tracks.set(rec.id, rec);
  }
  const meta = new Map();
  const setMeta = (k, v) => meta.set(k, { key: k, value: v });
  setMeta('idCounter', 3);
  setMeta('playlists', { 'All Songs': ['t0', 't1', 't2'], 'Favorites': [], 'Unsorted': [] });
  setMeta('userAlbums', {});
  setMeta('albumOrder', []);
  setMeta('theme', 'coral');
  setMeta('lastSeenVersion', version);       // no "what's new" popup in the way
  setMeta('hasSeenOnboarding', true);
  setMeta('notifLastReadVersion', version);
  setMeta('pinnedArtists', ['Diljit Dosanjh']);
  setMeta('pinnedReleases', {});
  setMeta('enrichAttemptedIds', ['t0']);
  setMeta('edgeGlowBaseLen', 44);            // an observable setting, checked below
  if (opts && opts.wiped) { meta.delete('idCounter'); meta.delete('playlists'); }
  // The rollback history.
  for (let i = 0; i < HISTORY; i++) {
    setMeta('versionSnapshot_58.8.' + i, { version: '58.8.' + i, html: 'x'.repeat(SNAP_HTML_BYTES), savedAt: Date.now() - i * 60000 });
  }
  const data = { tracks, meta };
  return {
    _data: data,
    _size: () => data.meta.size,
    open() {
      const req = { error: null };
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => ({}),
        close() {},
        transaction(store) {
          const t = { oncomplete: null, onerror: null, onabort: null, error: null };
          const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
          const asObjectStore = () => ({
            put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
            get(k) {
              counters.getKeys.push(store + '/' + k);
              const q = {};
              setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0);
              return q;
            },
            getKey(k) {
              counters.getKeyCalls++;
              const q = {};
              setTimeout(() => { q.result = data[store].has(k) ? k : undefined; q.onsuccess && q.onsuccess(); }, 0);
              return q;
            },
            getAll(range) {
              const q = {};
              setTimeout(() => {
                let rows = Array.from(data[store].values()).filter((v) => v && (v.key !== undefined || v.id !== undefined));
                if (range) rows = rows.filter((r) => range._r.contains(r.key));
                if (store === 'meta') {
                  for (const r of rows) {
                    const bytes = sizeofValue(r.value);
                    counters.metaBytes += bytes;
                    if (bytes > 100000) counters.bigRowsReturned++;
                    if (typeof r.key === 'string' && r.key.indexOf('versionSnapshot_') === 0) counters.snapshotRowsReturned++;
                    else counters.settingsKeys.add(r.key);
                  }
                }
                counters.getAllCalls++;
                q.result = rows;
                q.onsuccess && q.onsuccess();
              }, 0);
              return q;
            },
            delete(k) { data[store].delete(k); fire(); return {}; },
          });
          t.objectStore = asObjectStore;
          return t;
        },
      };
      setTimeout(() => {
        req.result = db;
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
  };
}

async function boot(opts) {
  opts = opts || {};
  const counters = {
    metaBytes: 0, snapshotRowsReturned: 0, bigRowsReturned: 0, getAllCalls: 0,
    getKeyCalls: 0, getKeys: [], settingsKeys: new Set(),
    blobGets: 0, artGets: 0, fileReads: 0, snapFileReads: 0, readPaths: [], idle: [],
  };
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not parse CSS/i.test(m)) errors.push(m); });
  vc.on('error', (...a) => { const m = a.map(String).join(' ').split('\n')[0]; if (!/Storage|offline/i.test(m)) errors.push(m); });
  const idb = makeIDB(counters, opts);
  const snapshotFile = opts.snapshotFile || null;

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: opts.native ? 'https://localhost/' : 'https://anekthegreat.github.io/SideCut/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      // jsdom has no object URLs, and loadFromDB makes one per song.
      win.URL.createObjectURL = () => 'blob:fake-' + (++counters.objectUrls || (counters.objectUrls = 1));
      win.URL.revokeObjectURL = () => {};
      win.indexedDB = idb;
      win.IDBKeyRange = makeIdbKeyRange();
      win.fetch = () => Promise.reject(new Error('offline'));
      win.navigator.vibrate = () => true;
      // The app runs the list render on the first idle slice; holding those
      // callbacks here is how we see whether it is still inside the boot turn.
      win.requestIdleCallback = (fn) => { counters.idle.push(fn); return counters.idle.length; };
      win.Capacitor = {
        isNativePlatform: () => !!opts.native,
        getPlatform: () => (opts.native ? 'android' : 'web'),
        nativePromise: () => Promise.resolve({}),
        nativeCallback: () => Promise.resolve({}),
        Plugins: {
          Filesystem: {
            readFile: (o) => {
              const p = (o && o.path) || '';
              counters.fileReads++;
              counters.readPaths.push(p);
              // The OTA client reads its own bundle files; only the recovery file
              // is what this suite is about.
              if (/sidecut-snapshot\.json/.test(p)) counters.snapFileReads++;
              if (snapshotFile && /sidecut-snapshot\.json/.test(p)) return Promise.resolve({ data: JSON.stringify(snapshotFile) });
              return Promise.reject(new Error('no such file'));
            },
            writeFile: () => Promise.resolve({}),
          },
          MediaSession: { setMetadata: () => Promise.resolve({}), setPlaybackState: () => Promise.resolve({}), setPositionState: () => Promise.resolve({}), setActionHandler: () => Promise.resolve({}) },
        },
      };
      // A phone that has booted before carries the snapshot marker; a wiped one
      // does not (that is the signal the restore hook reads).
      if (!opts.wiped) { try { win.localStorage.setItem('sidecut_snapshot_marker', 'saved'); } catch (e) {} }
    },
  });
  await wait(2600);
  return { win: dom.window, counters, errors, idb,
    fireIdle() { const q = counters.idle.splice(0); q.forEach((fn) => { try { fn(); } catch (e) {} }); } };
}

(async () => {
  console.log('\n— a phone with ' + HISTORY + ' builds of rollback history (' + mb(HISTORY * SNAP_HTML_BYTES) + ') and a real library —');
  const A = await boot({});
  const win = A.win, c = A.counters;

  console.log('    meta bytes deserialised during boot: ' + mb(c.metaBytes) +
    '   rollback rows returned: ' + c.snapshotRowsReturned +
    '   meta reads: ' + c.getAllCalls);

  ok('a stored setting still loads (edge glow length)', (win.document.getElementById('edgeGlowLenValue') || {}).textContent === '44%',
    (win.document.getElementById('edgeGlowLenValue') || {}).textContent);

  // ---- the rollback rows stay out of every boot sweep ----
  ok('boot never reads a page-sized rollback row', c.snapshotRowsReturned === 0, 'rows=' + c.snapshotRowsReturned);
  ok('no oversized row value is ever handed to any caller', c.bigRowsReturned === 0, 'bigRows=' + c.bigRowsReturned);
  ok('and what boot does read is settings-sized, not megabytes', c.metaBytes < 200000, mb(c.metaBytes));
  for (const k of ['playlists', 'idCounter', 'theme', 'lastSeenVersion', 'notifLastReadVersion', 'pinnedArtists', 'edgeGlowBaseLen']) {
    ok('the settings read still sees "' + k + '"', c.settingsKeys.has(k));
  }
  ok('the enrich state is a keyed read, not a sweep', c.getKeys.indexOf('meta/enrichAttemptedIds') !== -1,
    c.getKeys.join(', '));
  ok('the current version still saves its rollback point (via a keyed test, not a sweep)',
    A.idb._data.meta.has('versionSnapshot_' + version) && c.getKeyCalls > 0,
    'getKeyCalls=' + c.getKeyCalls);

  // ---- the version picker still finds every saved version ----
  win.document.getElementById('settingsTabMore').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(300);
  const snapList = win.document.getElementById('versionSnapshotList');
  const snapText = (snapList && snapList.textContent) || '';
  ok('the version picker still lists the rollback history', /v58\.8\.0/.test(snapText) && /v58\.8\.11/.test(snapText),
    snapText.replace(/\s+/g, ' ').slice(0, 90));
  ok('and it lists the version that is running', snapText.indexOf('v' + version) !== -1, version);

  // ---- per-track restore work ----
  console.log('    per-song restores: audio blob read ' + c.blobGets + '×, cover read ' + c.artGets + '×  (3 songs)');
  ok('each song restores its audio blob twice at most (once + the no-audio check)', c.blobGets <= 6, c.blobGets);
  ok('each song restores its cover exactly once', c.artGets === 3, c.artGets);

  // ---- the list render is off the boot turn ----
  const paneBefore = win.document.getElementById('listPane').children.length;
  ok('the boot turn does not build the song list', paneBefore === 0, 'rows=' + paneBefore + ' queued=' + c.idle.length);
  ok('it is queued on the first idle slice instead', c.idle.length >= 1, 'queued=' + c.idle.length);
  A.fireIdle();
  await wait(400);
  const paneAfter = win.document.getElementById('listPane').children.length;
  const paneText = win.document.getElementById('listPane').textContent || '';
  ok('and it renders for real once the device is idle', paneAfter > 0, 'rows=' + paneAfter);
  ok('the app booted with its library', paneText.indexOf('Song 0') !== -1 && paneText.indexOf('Song 2') !== -1,
    paneText.replace(/\s+/g, ' ').slice(0, 90));

  // ---- the list still builds the moment Library is opened ----
  win.navigate('library');
  await wait(400);
  ok('opening Library renders the list itself', win.document.getElementById('listPane').children.length > 0);

  // ---- nothing broke ----
  ok('no boot errors', A.errors.length === 0, A.errors.join(' | ').slice(0, 200));

  // ---- the two blocking CDN tags ----
  console.log('\n— the two CDN dependencies no longer sit in front of the app script —');
  const jszip = (html.match(/<script[^>]*jszip[^>]*>/) || [''])[0];
  const lame = (html.match(/<script[^>]*lamejs[^>]*>/) || [''])[0];
  ok('JSZip is deferred', /\sdefer\s|\sdefer>/.test(jszip), jszip.slice(0, 90));
  ok('lamejs is deferred', /\sdefer\s|\sdefer>/.test(lame), lame.slice(0, 90));
  const external = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  ok('the order is untouched: JSZip, then lamejs, then the local OTA client',
    external.length === 3 && /jszip/.test(external[0]) && /lamejs/.test(external[1]) && /native-updates/.test(external[2]),
    external.join(' , '));

  console.log('\n— the on-device recovery file —');
  // A healthy phone: the stores are there, the marker is there. The snapshot file
  // used to be read and JSON.parse\'d before anything checked.
  const H = await boot({ native: true, snapshotFile: { v: 1, localStorage: {}, meta: {} } });
  console.log('    healthy native boot: recovery file opened ' + H.counters.snapFileReads + '× (all plugin reads: ' + H.counters.fileReads + ')');
  ok('a healthy boot never opens the recovery file', H.counters.snapFileReads === 0, H.counters.snapFileReads + ' path=' + H.counters.readPaths.join(','));
  H.fireIdle();
  await wait(300);
  ok('and it still boots its library',
    (H.win.document.getElementById('listPane').textContent || '').indexOf('Song 1') !== -1);
  ok('and still does not read the rollback rows', H.counters.snapshotRowsReturned === 0, H.counters.snapshotRowsReturned);

  // A wiped phone: no marker, no idCounter — the one case the file is for.
  const snap = {
    v: 1,
    localStorage: { sidecut_probe_restored: 'yes', sidecut_snapshot_marker: 'saved' },
    meta: { theme: 'coral' },
  };
  const W = await boot({ native: true, wiped: true, snapshotFile: snap });
  console.log('    wiped native boot: recovery file opened ' + W.counters.snapFileReads + '×');
  ok('a wiped store DOES open the recovery file', W.counters.snapFileReads >= 1, W.counters.snapFileReads);
  ok('and the restore still hydrates from it', W.win.localStorage.getItem('sidecut_probe_restored') === 'yes',
    W.win.localStorage.getItem('sidecut_probe_restored'));

  console.log('\n' + pass + ' passed, ' + fail + ' failed  (v' + version + ')');
  process.exit(fail ? 1 : 0);
})();
