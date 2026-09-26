// "Boot takes 4 seconds and storage bro" — the two complaints are one defect.
//
// Every track record carried its song as a raw ArrayBuffer INSIDE it, and
// loadFromDB() does dbGetAll('tracks') — so opening the app deserialised the whole
// library's audio before the first paint, and a metadata write re-serialised a
// whole song. This probe boots the real app against a fake database that reports
// what such a read costs, then runs the app's own compaction and boots again.
//
// The fake keeps each "song" as a 1 KB Uint8Array (jsdom cannot hold 240 MB of
// real buffers) but REPORTS each inline-audio record as NOMINAL_BYTES, because
// that is the cost the storage engine actually pays for an ArrayBuffer inside a
// record. A record whose audio is a Blob handle reports zero bytes: IndexedDB
// keeps blob bytes out of the record, which is the entire point of the change.
//
//   SC_HTML=/tmp/index.before.647.html node dev/compact-647-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const updatesSrc = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');

const SONGS = 40;
const NOMINAL_BYTES = 6 * 1024 * 1024;   // one song, as the engine would read it
const NOMINAL_MB = (n) => (n / 1048576).toFixed(1) + ' MB';

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

const KEYRANGE = {
  only: (v) => ({ _r: { contains: (k) => k === v } }),
  lowerBound: (v, o) => ({ _r: { contains: (k) => (o ? k > v : k >= v) } }),
  upperBound: (v, o) => ({ _r: { contains: (k) => (o ? k < v : k <= v) } }),
  bound: (l, u, lo, hi) => ({ _r: { contains: (k) => (lo ? k > l : k >= l) && (hi ? k < u : k <= u) } }),
};

// A library stored the way the app stored it before this release: the song lives
// inside the record as an ArrayBuffer.
function seedLibrary() {
  const tracks = new Map();
  for (let i = 0; i < SONGS; i++) {
    tracks.set('t' + i, {
      id: 't' + i, name: 'Song ' + i, artist: 'Artist ' + i, album: 'Album',
      duration: 200, fileName: 's' + i + '.mp3', blobType: 'audio/mpeg',
      blobData: new Uint8Array(1024),        // stands in for the real 6 MB
      blob: null, artData: null, art: null,
      playCount: 0, lastPlayedAt: null, gain: null, waveform: null,
    });
  }
  const meta = new Map();
  const setMeta = (k, v) => meta.set(k, { key: k, value: v });
  setMeta('idCounter', SONGS);
  setMeta('playlists', { 'All Songs': Array.from(tracks.keys()), Favorites: [], Unsorted: [] });
  setMeta('theme', 'coral');
  setMeta('lastSeenVersion', (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '');
  setMeta('hasSeenOnboarding', true);
  return { tracks, meta };
}

function makeIDB(counters, opts) {
  const data = (opts && opts.data) || seedLibrary();
  const refuseBlob = !!(opts && opts.refuseBlob);
  // What the record would cost the storage engine if it were read/written: an
  // ArrayBuffer in a record is the song; a Blob handle is a reference to it.
  const cost = (v) => (v && v.blobData ? NOMINAL_BYTES : 0);
  return {
    _data: data,
    open() {
      const req = { error: null };
      const db = {
        objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), close() {},
        transaction(store) {
          const t = { oncomplete: null, onerror: null, onabort: null, error: null };
          const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
          t.objectStore = () => ({
            put(v) {
              const k = v && v.key !== undefined ? v.key : v.id;
              if (store === 'tracks') {
                if (refuseBlob && v && v.blob) {
                  // What Android WebView does to a generated Blob: the write is
                  // refused and dbPut() reports it by resolving false.
                  throw new Error('InvalidBlob: refusing to store this value');
                }
                counters.trackWrites++;
                counters.writeBytes += cost(v);
              }
              data[store].set(k, v);
              fire();
              return {};
            },
            get(k) {
              const q = {};
              setTimeout(() => {
                const v = data[store].get(k);
                if (store === 'tracks') counters.readBytes += cost(v);
                q.result = v;
                q.onsuccess && q.onsuccess();
              }, 0);
              return q;
            },
            getKey(k) { const q = {}; setTimeout(() => { q.result = data[store].has(k) ? k : undefined; q.onsuccess && q.onsuccess(); }, 0); return q; },
            getAll(range) {
              const q = {};
              setTimeout(() => {
                let rows = Array.from(data[store].values()).filter((v) => v && (v.key !== undefined || v.id !== undefined));
                if (range) rows = rows.filter((r) => range._r.contains(r.key));
                if (store === 'tracks') rows.forEach((r) => { counters.readBytes += cost(r); });
                q.result = rows;
                q.onsuccess && q.onsuccess();
              }, 0);
              return q;
            },
            getAllKeys(range) {
              const q = {};
              setTimeout(() => {
                // Tracks are keyed by `id`, meta rows by `key` — the app reads the
                // track keys this way to find the records worth converting.
                let keys = Array.from(data[store].values())
                  .filter((v) => v && (v.key !== undefined || v.id !== undefined))
                  .map((v) => (v.key !== undefined ? v.key : v.id));
                if (range) keys = keys.filter((k) => range._r.contains(k));
                q.result = keys;
                q.onsuccess && q.onsuccess();
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
  };
}

async function boot(opts) {
  opts = opts || {};
  const counters = { readBytes: 0, writeBytes: 0, trackWrites: 0 };
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not parse CSS/i.test(m)) errors.push(m); });
  vc.on('error', (...a) => { const m = a.map(String).join(' ').split('\n')[0]; if (!/Storage|offline/i.test(m)) errors.push(m); });
  const idb = makeIDB(counters, opts);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://localhost/',
    resources: { interceptors: [serveLocalScript] },
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      win.indexedDB = idb;
      win.IDBKeyRange = KEYRANGE;
      win.fetch = () => Promise.reject(new Error('offline'));
      win.navigator.vibrate = () => true;
      win.HTMLMediaElement.prototype.play = function () {
        try { this.dispatchEvent(new win.Event('play')); } catch (e) {}
        return Promise.resolve();
      };
      win.HTMLMediaElement.prototype.pause = function () {};
      win.Capacitor = {
        isNativePlatform: () => true, getPlatform: () => 'android',
        nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}),
        Plugins: {
          Filesystem: { readFile: () => Promise.reject(new Error('no file')), writeFile: () => Promise.resolve({}), deleteFile: () => Promise.resolve({}) },
          MediaSession: { setMetadata: () => Promise.resolve({}), setPlaybackState: () => Promise.resolve({}), setPositionState: () => Promise.resolve({}), setActionHandler: () => Promise.resolve({}) },
        },
      };
      try { win.localStorage.setItem('sidecut_snapshot_marker', 'saved'); } catch (e) {}
    },
  });
  await wait(2600);
  return { win: dom.window, counters, errors, idb,
    records: () => Array.from(idb._data.tracks.values()) };
}

(async () => {
  console.log('\n— a launch that reads the whole library\'s audio before the first paint —');
  const data = seedLibrary();
  const A = await boot({ data });
  const win = A.win;
  const tracks = win.__scGetAllTracks ? win.__scGetAllTracks() : [];
  console.log('    40 songs stored the old way: ' + NOMINAL_MB(A.counters.readBytes) + ' deserialised during boot');
  ok('the library read pulls every song\'s audio', A.counters.readBytes >= SONGS * NOMINAL_BYTES,
    NOMINAL_MB(A.counters.readBytes));
  ok('and it still boots its library', tracks.length === SONGS, tracks.length);
  ok('with each song playable (a File built from the stored audio)',
    !!tracks[0] && !!tracks[0].file && tracks[0].file.size === 1024 && !!tracks[0].url,
    tracks[0] ? 'size=' + (tracks[0].file && tracks[0].file.size) : 'no track');

  console.log('\n— the app\'s own compaction, on the same library —');
  const writesBefore = A.counters.trackWrites;
  let res = null;
  try { res = await win.__scCompactLibraryStep(0); } catch (e) { res = { error: e && e.message }; }
  await wait(400);
  const recs = A.records();
  const inline = recs.filter((r) => r.blobData).length;
  const handled = recs.filter((r) => r.blob && !r.blobData).length;
  console.log('    converted ' + handled + '/' + SONGS + ' · records rewritten ' + (A.counters.trackWrites - writesBefore) +
    ' · audio bytes inside those records: ' + NOMINAL_MB(A.counters.writeBytes) + ' (the bytes move to the blob store once)');
  ok('every song is converted to the handle form', handled === SONGS && inline === 0, handled + ' converted, ' + inline + ' inline');
  ok('compaction does not throw', !(res && res.error), res && res.error);
  ok('and it is recorded as clean', res && res.left === 0, res && JSON.stringify(res));

  console.log('\n— the next launch reads no audio at all —');
  const B = await boot({ data });
  const bwin = B.win;
  const btracks = bwin.__scGetAllTracks ? bwin.__scGetAllTracks() : [];
  console.log('    same library, after compaction: ' + NOMINAL_MB(B.counters.readBytes) + ' deserialised during boot');
  ok('a compacted launch reads none of the music', B.counters.readBytes === 0, NOMINAL_MB(B.counters.readBytes));
  ok('and the library is still all there', btracks.length === SONGS, btracks.length);
  ok('and every song still has its audio', btracks.every((t) => t.file && t.file.size === 1024),
    btracks.filter((t) => !t.file).length + ' without audio');

  console.log('\n— and a play still costs nothing but the numbers it learns —');
  const before = { writes: B.counters.trackWrites, read: B.counters.readBytes };
  try {
    bwin.playFromList(['t0', 't1'], 't0');
    const el = bwin.document.getElementById('audioEl');
    if (el) el.dispatchEvent(new bwin.Event('ended'));
  } catch (e) {}
  await wait(1200);
  if (bwin.__scSidecarFlush) bwin.__scSidecarFlush();
  await wait(200);
  ok('playing a compacted song writes no track record', B.counters.trackWrites === before.writes,
    'writes=' + (B.counters.trackWrites - before.writes));
  ok('while the play is still recorded', (B.idb._data.meta.get('trackSidecar') || {}).value !== undefined,
    'no sidecar row');
  const side = ((B.idb._data.meta.get('trackSidecar') || {}).value || {}).t0 || {};
  ok('with the song play count in it', side.playCount === 1, JSON.stringify(side).slice(0, 70));

  console.log('\n— a device that refuses the compacted form is left alone —');
  const C = await boot({ refuseBlob: true });
  const cwin = C.win;
  let cres = null;
  try { cres = await cwin.__scCompactLibraryStep(0); } catch (e) { cres = { error: e && e.message }; }
  await wait(300);
  const cInline = C.records().filter((r) => r.blobData).length;
  const form = cwin.__scAudioForm ? cwin.__scAudioForm() : {};
  console.log('    refused: ' + JSON.stringify(cres) + ' · still inline: ' + cInline + ' · note: ' + form.note);
  ok('the refusal is detected, not ignored', !!(cres && cres.refused), JSON.stringify(cres));
  ok('and every song is left exactly as it was', cInline === SONGS, cInline + '/' + SONGS);
  ok('the app remembers not to try again', form.inlineOnly === true, JSON.stringify(form));
  ok('and that library still boots from the old form', (cwin.__scGetAllTracks() || []).length === SONGS,
    (cwin.__scGetAllTracks() || []).length);

  console.log('\n— the write path, and what the panel says —');
  ok('new writes try the handle form first', /THE CHEAP FORM FIRST/.test(html));
  ok('and fall back to the inline form rather than losing the write',
    /catch\(_eBlob\)\{[\s\S]{0,200}?scAudioInlineOnly = true[\s\S]{0,400}?await normalize\('blob', 'blobData', 'blobType'\)/.test(html));
  ok('a refused write is treated as a failure (dbPut resolves false)',
    /if\(_ok === false\) throw new Error\('IndexedDB refused the Blob form'\)/.test(html));
  const btn = win.document.getElementById('storageCompactBtn');
  ok('the Storage panel has the Compact library button', !!btn, btn ? btn.textContent : 'missing');
  win.document.getElementById('settingsTabMore').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(400);
  const head = win.document.getElementById('collapsibleStorage');
  ok('and the Storage block is there', !!head);
  if (head) head.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(500);
  const body = (win.document.getElementById('storagePanelBody') || {}).textContent || '';
  console.log('    panel: ' + body.replace(/\s+/g, ' ').slice(0, 120));
  ok('it reports how much is read at every launch', /Songs read at every launch/.test(body), body.slice(0, 90));

  console.log('\n— nothing broke —');
  ok('no boot errors', A.errors.length === 0 && B.errors.length === 0, (A.errors.concat(B.errors)).join(' | ').slice(0, 200));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
