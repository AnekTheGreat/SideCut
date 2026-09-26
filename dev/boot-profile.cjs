// Boot profiler. Not a pass/fail suite: it boots the app with a realistic
// library and prints where the startup time goes, phase by phase.
//
// The phase hooks are injected into a COPY of index.html in /tmp (the shipped
// file is never touched), on a boundary before block 1 so the parse+compile cost
// of the app's own script shows up as its own row.
//
//   node dev/boot-profile.cjs                       # the working tree
//   SC_HTML=/tmp/index.before.639.html node dev/boot-profile.cjs
//
// jsdom caveats, so the numbers are read correctly: the fake IndexedDB is
// in-memory (a real phone reads blob-backed rows from disk), there is no image
// decoding, and jsdom's DOM/HTML serialisation is far slower than a WebView's.
// What it does show honestly is the SHAPE of startup: which phases scale with
// the library, which are fixed costs, and what each one is made of.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.SC_HTML || path.join(ROOT, 'index.html');
const updatesSrc = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const TRACKS = Number(process.env.TRACKS || 600);
const HISTORY = Number(process.env.HISTORY || 12);
const SNAP_HTML_BYTES = 2_400_000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- inject the phase hooks -------------------------------------------------
function instrument(html) {
  let s = html;
  // A build that predates a hook simply loses that row instead of failing: the
  // point of this script is to compare two builds' shapes, and an older build is
  // exactly what it gets pointed at half the time.
  const skipped = [];
  const put = (label, oldStr, newStr) => {
    if (s.indexOf(oldStr) === -1) { skipped.push(label); return; }
    s = s.split(oldStr).join(newStr);
  };
  setTimeout(() => { if (skipped.length) console.log('    (no hook for: ' + skipped.join(', ') + ')'); }, 0);
  // T0 is stamped BEFORE block 1 exists in the document, so the first hook inside
  // block 1 measures parse + compile of everything the app ships.
  put('t0', '<script src="dev/native-updates.js"></script>\n<script>',
    '<script src="dev/native-updates.js"></script>\n<script>window.__T0=performance.now();window.__PH=[];window.__t=function(l,e){window.__PH.push([l,Math.round(performance.now()-window.__T0),e===undefined?\'\':e]);};window.__t(\'block1: started (parse+compile of the app script)\');</script>\n<script>');
  put('boot start', "      if(window.__scMark) __scMark('starting up');", "      __t('boot: entered');\n      if(window.__scMark) __scMark('starting up');");
  put('snapshot html', "  const SHELL_SNAPSHOT_HTML = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;",
    "  var _tSnap = performance.now();\n  const SHELL_SNAPSHOT_HTML = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;\n  try{ window.__t('block1: shell snapshot serialised (page HTML -> string)', Math.round(performance.now()-_tSnap) + ' ms'); }catch(e){}");
  put('notif', '      updateNotifBadge();', '      window.__t(\'boot: notification state read\');\n      updateNotifBadge();\n      window.__t(\'boot: notification badge\');');
  put('theme', '      let loaded = await loadFromDB();', "      window.__t('boot: theme + recovery check done');\n      let loaded = await loadFromDB();");
  put('library read', "      if(!loaded && window.__scStorageTrouble && window.__scStorageTrouble()){", "      window.__t('boot: LIBRARY READ + track records built' + (loaded ? '' : ' (empty)'), (allTracks ? allTracks.length + ' tracks' : '?'));\n      if(!loaded && window.__scStorageTrouble && window.__scStorageTrouble()){");
  put('tabs', '        scRunWhenIdle(function(){ renderList(); });', "        scRunWhenIdle(function(){ renderList(); window.__t('idle: LIST RENDERED'); });\n        window.__t('boot: tabs rendered, list queued on idle');");
  put('home', "      navigate(loaded ? 'home' : 'home');", "      navigate(loaded ? 'home' : 'home');\n      window.__t('boot: HOME on screen');");
  put('done', '      if(window.__scMarkDone) __scMarkDone();\n    }catch(e){\n      console.error(\'Auto-load failed\', e);',
    "      window.__t('boot: enrich + pinned artists (Promise.all)');\n      if(window.__scMarkDone) __scMarkDone();\n      window.__t('boot: DONE (everything boot does)');\n    }catch(e){\n      console.error('Auto-load failed', e);");
  return s;
}

function instrumentedPath(html) {
  const p = '/tmp/sc-profile-' + process.pid + '.html';
  fs.writeFileSync(p, html);
  return p;
}

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(updatesSrc, { headers: { 'Content-Type': 'application/javascript' } });
  }
  return undefined;
});

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

function makeIDB(counters) {
  const audio = new Blob(['a'.repeat(1024)]);
  const art = new Blob(['b'.repeat(1024)]);
  const tracks = new Map();
  for (let i = 0; i < TRACKS; i++) {
    tracks.set('t' + i, {
      id: 't' + i, name: 'Song ' + i, artist: 'Artist ' + (i % 7), album: 'Album ' + (i % 60),
      duration: 180 + (i % 120), fileName: 's' + i + '.mp3', blobType: 'audio/mpeg', artType: 'image/jpeg',
      blob: audio, art, dateAdded: Date.now() - i * 1000, playCount: i % 5,
    });
  }
  const meta = new Map();
  const setMeta = (k, v) => meta.set(k, { key: k, value: v });
  const allIds = [...tracks.keys()];
  setMeta('idCounter', TRACKS);
  setMeta('playlists', { 'All Songs': allIds, 'Favorites': allIds.slice(0, 20), 'Unsorted': [] });
  setMeta('userAlbums', {});
  setMeta('albumOrder', []);
  setMeta('theme', 'coral');
  setMeta('lastSeenVersion', 'x');
  setMeta('hasSeenOnboarding', true);
  setMeta('pinnedArtists', ['Diljit Dosanjh', 'Sidhu Moose Wala']);
  setMeta('enrichAttemptedIds', allIds.slice(0, 50));
  for (let i = 0; i < HISTORY; i++) setMeta('versionSnapshot_58.8.' + i, { version: '58.8.' + i, html: 'x'.repeat(SNAP_HTML_BYTES), savedAt: Date.now() - i * 60000 });
  const data = { tracks, meta };
  let metaBytes = 0, snapRows = 0;
  return {
    _data: data, _counters: counters,
    open() {
      const req = { error: null };
      const db = {
        objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), close() {},
        transaction(store) {
          const t = { oncomplete: null, onerror: null, onabort: null, error: null };
          const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
          t.objectStore = () => ({
            put(v) { data[store].set(v && v.key !== undefined ? v.key : v.id, v); fire(); return {}; },
            get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
            getKey(k) { counters.getKeyCalls++; const q = {}; setTimeout(() => { q.result = data[store].has(k) ? k : undefined; q.onsuccess && q.onsuccess(); }, 0); return q; },
            getAll(range) {
              const q = {};
              setTimeout(() => {
                let rows = Array.from(data[store].values());
                if (store === 'meta') rows = rows.filter((r) => r && r.key !== undefined);
                if (range) rows = rows.filter((r) => range._r.contains(r.key));
                if (store === 'meta') {
                  for (const r of rows) {
                    const b = typeof r.value === 'string' ? r.value.length : 1;
                    metaBytes += b;
                    if (b > 100000) snapRows++;
                  }
                }
                counters.getAlls++;
                q.result = rows; q.onsuccess && q.onsuccess();
              }, 0);
              return q;
            },
            delete(k) { data[store].delete(k); fire(); return {}; },
          });
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
    bytes: () => metaBytes,
    snapRows: () => snapRows,
  };
}

const KEYRANGE = {
  only: (v) => ({ _r: { contains: (k) => k === v } }),
  lowerBound: (v, o) => ({ _r: { contains: (k) => (o ? k > v : k >= v) } }),
  upperBound: (v, o) => ({ _r: { contains: (k) => (o ? k < v : k <= v) } }),
  bound: (l, u, lo, hi) => ({ _r: { contains: (k) => (lo ? k > l : k >= l) && (hi ? k < u : k <= u) } }),
};

(async () => {
  const raw = fs.readFileSync(SRC, 'utf8');
  const html = instrument(raw);
  const file = instrumentedPath(html);
  const counters = { getAlls: 0, getKeyCalls: 0, objectUrls: 0, rowsBuilt: 0, idle: [] };
  const idb = makeIDB(counters);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not parse CSS/i.test(m)) errors.push(m); });

  console.log('\nprofiling ' + path.basename(SRC) + ' — ' + TRACKS + ' tracks, ' + HISTORY + ' versions of rollback history');
  const t0 = Date.now();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.URL.createObjectURL = () => { counters.objectUrls++; return 'blob:fake'; };
      win.URL.revokeObjectURL = () => {};
      win.indexedDB = idb;
      win.IDBKeyRange = KEYRANGE;
      win.fetch = () => Promise.reject(new Error('offline'));
      win.navigator.vibrate = () => true;
      win.requestIdleCallback = (fn) => { counters.idle.push(fn); return counters.idle.length; };
      win.Capacitor = {
        isNativePlatform: () => true, getPlatform: () => 'android',
        nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}),
        Plugins: {
          Filesystem: { readFile: () => Promise.reject(new Error('no file')), writeFile: () => Promise.resolve({}) },
          MediaSession: { setMetadata: () => Promise.resolve({}), setPlaybackState: () => Promise.resolve({}), setPositionState: () => Promise.resolve({}), setActionHandler: () => Promise.resolve({}) },
        },
      };
      try { win.localStorage.setItem('sidecut_snapshot_marker', 'saved'); } catch (e) {}
      // Count DOM rows as they are built, so "the list render" is a number and
      // not just a timestamp.
      const desc = Object.getOwnPropertyDescriptor(win.Element.prototype, 'innerHTML') || {};
      if (desc.set) {
        Object.defineProperty(win.Element.prototype, 'innerHTML', {
          configurable: true, enumerable: desc.enumerable, get: desc.get,
          set(v) { counters.rowsBuilt += (String(v).match(/<div/g) || []).length; desc.set.call(this, v); },
        });
      }
    },
  });
  await wait(3000);
  const phases = dom.window.__PH || [];
  const idle = counters.idle.splice(0);
  const tIdle = Date.now();
  idle.forEach((fn) => { try { fn(); } catch (e) {} });
  await wait(200);
  const idleMs = Date.now() - tIdle;

  console.log('    wall clock to interactive: ' + (Date.now() - t0) + ' ms (jsdom, includes its own setup)\n');
  console.log('    phase'.padEnd(52) + 'at (ms)   delta   note');
  let prev = 0;
  for (const [label, at, note] of phases) {
    const delta = at - prev; prev = at;
    console.log('    ' + label.padEnd(50) + String(at).padStart(7) + String(delta).padStart(8) + '   ' + (note || ''));
  }
  console.log('    ' + 'idle: list render (run after boot)'.padEnd(50) + ''.padStart(7) + String(idleMs).padStart(8));
  console.log('\n    counters: ' + counters.getAlls + ' store reads · ' + (idb.bytes() / 1048576).toFixed(1) + ' MB of meta read (' +
    idb.snapRows() + ' page-sized rows) · ' + counters.getKeyCalls + ' key-only checks');
  console.log('              ' + counters.objectUrls + ' object URLs · ' + counters.rowsBuilt + ' <div>s built via innerHTML');
  if (errors.length) console.log('    errors: ' + errors.slice(0, 3).join(' | '));
  fs.unlinkSync(file);
})();
