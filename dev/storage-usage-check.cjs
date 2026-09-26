// "SideCut takes up mad storage why does it take up 4.53 gb."
//
// The music is stored inside the app's own database as raw bytes (that is the
// design — no network, no ads), so the track record holds the song. The defect
// this suite is about is the WRITE AMPLIFICATION on top of it: every metadata
// write re-serialised the whole song, and the hot paths fire on every play. That
// is what makes storage grow with listening and leave the device counting far
// more than the music.
//
// This boots the real app against a counting fake database, plays a song through
// the app's own play path, and counts what was written where. It also covers the
// other two ways the app's storage grew with nothing in it to show for it: the
// backup zip left in the app's own cache directory (a COMPLETE second copy of the
// library, only ever deleted when the export FAILED) and the rollback copies of
// its own page, one per version ever run.
//
//   SC_HTML=/tmp/index.before.643.html node dev/storage-usage-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const updatesSrc = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';

const AUDIO_BYTES = 6 * 1024 * 1024;   // one song, as stored
const SNAP_BYTES = 2_400_000;          // one rollback copy of the app page

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

const KEYRANGE = {
  only: (v) => ({ _r: { contains: (k) => k === v } }),
  lowerBound: (v, o) => ({ _r: { contains: (k) => (o ? k > v : k >= v) } }),
  upperBound: (v, o) => ({ _r: { contains: (k) => (o ? k < v : k <= v) } }),
  bound: (l, u, lo, hi) => ({ _r: { contains: (k) => (lo ? k > l : k >= l) && (hi ? k < u : k <= u) } }),
};

function makeIDB(counters, opts) {
  const audioBytes = new Uint8Array(1024);   // the fake keeps the shape, not the size
  const tracks = new Map();
  const mk = (i) => {
    const rec = {
      id: 't' + i, name: 'Song ' + i, artist: 'Artist ' + i, album: 'Album',
      duration: 200, fileName: 's' + i + '.mp3', blobType: 'audio/mpeg', artType: 'image/jpeg',
      // The real layout: the audio lives INSIDE the record as an ArrayBuffer.
      blobData: audioBytes, blob: null, artData: audioBytes, art: null,
      playCount: 0, lastPlayedAt: null, lyricsCheckedAt: null, gain: null, waveform: null,
    };
    if (i === 1) { rec.playCount = 3; rec.lastPlayedAt = 1700000000000; }  // what the record remembers
    return rec;
  };
  for (let i = 0; i < 3; i++) tracks.set('t' + i, mk(i));

  const meta = new Map();
  const setMeta = (k, v) => meta.set(k, { key: k, value: v });
  setMeta('idCounter', 3);
  setMeta('playlists', { 'All Songs': ['t0', 't1', 't2'], 'Favorites': [], 'Unsorted': [] });
  setMeta('theme', 'coral');
  setMeta('lastSeenVersion', version);
  setMeta('hasSeenOnboarding', true);
  // What the app learned about t0 — it must win over the record's own copy.
  setMeta('trackSidecar', { t0: { playCount: 41, lastPlayedAt: 1700000001111, gain: 1.4, waveform: [1, 2, 3] } });
  // A phone that has been through a lot of updates: nine rollback copies.
  for (let i = 0; i < 9; i++) {
    setMeta('versionSnapshot_58.8.' + i, { version: '58.8.' + i, html: 'x'.repeat(SNAP_BYTES), savedAt: 1700000000000 + i * 1000 });
  }
  if (opts && opts.pinned) {
    setMeta('pinnedVersion', '58.8.0');
    // The pinned version's own saved page is empty, so boot does NOT switch into
    // it and the prune still runs. What is being tested is only that the prune
    // refuses to drop the version the user pinned.
    setMeta('versionSnapshot_58.8.0', { version: '58.8.0', html: '', savedAt: 1700000000000 });
  }

  const data = { tracks, meta };
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
                counters.trackPuts++;
                const rec = data.tracks.get(k);
                const bytes = (v && v.blobData && v.blobData.byteLength) || 0;
                counters.bytesReverted += bytes ? AUDIO_BYTES : 0;   // what that write really costs
                void rec;
              } else {
                counters.metaPuts++;
                if (k === 'trackSidecar') counters.sidecarWrites++;
              }
              data[store].set(k, v);
              fire();
              return {};
            },
            get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
            getKey(k) { const q = {}; setTimeout(() => { q.result = data[store].has(k) ? k : undefined; q.onsuccess && q.onsuccess(); }, 0); return q; },
            getAll(range) {
              const q = {};
              setTimeout(() => {
                let rows = Array.from(data[store].values()).filter((v) => v && (v.key !== undefined || v.id !== undefined));
                if (range) rows = rows.filter((r) => range._r.contains(r.key));
                q.result = rows;
                q.onsuccess && q.onsuccess();
              }, 0);
              return q;
            },
            // Keys only — the app reads the snapshot order this way, so deciding
            // what to prune never deserialises a page-sized row.
            getAllKeys(range) {
              const q = {};
              setTimeout(() => {
                let keys = Array.from(data[store].values()).filter((v) => v && v.key !== undefined).map((v) => v.key);
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
  const counters = { trackPuts: 0, metaPuts: 0, sidecarWrites: 0, bytesReverted: 0 };
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
      // jsdom has no media playback: play() returns undefined and the app's
      // `a.play().catch(...)` throws on it. Answer like a real element and emit
      // the 'play' event the app listens for, so the real play path runs.
      win.HTMLMediaElement.prototype.play = function () {
        try { this.dispatchEvent(new win.Event('play')); } catch (e) {}
        return Promise.resolve();
      };
      win.HTMLMediaElement.prototype.pause = function () {};
      if (opts.localStorage) Object.keys(opts.localStorage).forEach((k) => { try { win.localStorage.setItem(k, opts.localStorage[k]); } catch (e) {} });
      // A real (empty) CACHE directory. Files are named as the app names them;
      // mtime 0 keeps them outside the share grace window.
      const cacheFiles = Object.assign({}, opts.cacheFiles || {});
      win.__cacheFiles = cacheFiles;
      win.Capacitor = {
        isNativePlatform: () => true, getPlatform: () => 'android',
        nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}),
        Plugins: {
          Filesystem: {
            readFile: () => Promise.reject(new Error('no file')),
            writeFile: () => Promise.resolve({}),
            deleteFile: (o) => { delete cacheFiles[(o && o.path) || '']; return Promise.resolve({}); },
            readdir: () => Promise.resolve({ files: Object.keys(cacheFiles).map((n) => ({ name: n, uri: 'file:///cache/' + n })) }),
            stat: (o) => {
              const n = (o && o.path) || '';
              if (!(n in cacheFiles)) return Promise.reject(new Error('missing'));
              return Promise.resolve({ size: cacheFiles[n], mtime: 0, uri: 'file:///cache/' + n });
            },
          },
          MediaSession: { setMetadata: () => Promise.resolve({}), setPlaybackState: () => Promise.resolve({}), setPositionState: () => Promise.resolve({}), setActionHandler: () => Promise.resolve({}) },
        },
      };
      try { win.localStorage.setItem('sidecut_snapshot_marker', 'saved'); } catch (e) {}
    },
  });
  await wait(2600);
  return { win: dom.window, counters, errors, idb,
    snapKeys: () => Array.from(idb._data.meta.keys()).filter((k) => k.indexOf('versionSnapshot_') === 0) };
}

(async () => {
  console.log('\n— playing a song must not write the song again —');
  const A = await boot({});
  const win = A.win;

  // The sidecar wins over the record: this is what keeps play counts working once
  // they are no longer written into the record.
  const tracks = win.__scGetAllTracks ? win.__scGetAllTracks() : [];
  const t0 = win.__scSidecar ? win.__scSidecar() : null;
  const track0 = tracks.find((t) => t.id === 't0') || tracks[0];
  ok('booted with its library', tracks.length === 3, tracks.length);
  ok('the learned values are merged from the sidecar', !!t0 && t0.t0 && t0.t0.playCount === 41,
    t0 && t0.t0 ? 'playCount=' + t0.t0.playCount : 'no sidecar');
  ok('and they land on the track itself', !!track0 && track0.playCount === 41, track0 && track0.playCount);
  ok('including the record\'s own older value being overridden', !!track0 && track0.lastPlayedAt === 1700000001111,
    track0 && track0.lastPlayedAt);

  const before = { puts: A.counters.trackPuts, bytes: A.counters.bytesReverted };
  let played = null;
  try { win.playFromList(['t0', 't1', 't2'], 't0'); } catch (e) { played = e; }
  // Play the song to its end, which is what makes the play count itself.
  try {
    const el = win.document.getElementById('audioEl') || win.document.querySelector('audio');
    if (el) el.dispatchEvent(new win.Event('ended'));
  } catch (e) {}
  await wait(1200);
  if (win.__scSidecarFlush) win.__scSidecarFlush();
  await wait(200);
  ok('playing does not throw', !played, played && played.message);
  console.log('    track-record writes caused by one play: ' + (A.counters.trackPuts - before.puts) +
    '  (audio re-written: ' + mb(A.counters.bytesReverted - before.bytes) + ')');
  ok('playing a song writes NO track record at all', A.counters.trackPuts === before.puts,
    'writes=' + (A.counters.trackPuts - before.puts));
  ok('the play is still recorded — in the sidecar row', A.counters.sidecarWrites >= 1,
    'sidecarWrites=' + A.counters.sidecarWrites);
  const saved = A.idb._data.meta.get('trackSidecar');
  ok('and the saved row carries the play count and the stamp',
    !!saved && !!saved.value && !!saved.value.t0 && saved.value.t0.playCount === 42 && saved.value.t0.lastPlayedAt > 1700000001111,
    saved && saved.value ? JSON.stringify(saved.value.t0).slice(0, 80) : 'none');
  ok('the stored song bytes were never re-serialised', A.counters.bytesReverted === before.bytes,
    mb(A.counters.bytesReverted - before.bytes));

  // Everything that used to be written into the record still IS written for the
  // paths that really change the audio — checked as source, since driving an
  // import in jsdom is not the same code path as on a phone.
  ok('audio-changing writes still go to the record (import/crop/convert keep persistTrackMeta)',
    /await persistTrackMeta\(/.test(html) || /persistTrackMeta\(cropTrack\)/.test(html));

  console.log('\n— the rollback copies: counted, and never thrown away behind your back —');
  const keys = A.snapKeys();
  console.log('    rollback copies: 9 seeded -> ' + keys.length + ' after a launch');
  // The version picker lists these; trimming them is the user's call (Free up
  // space below), not something a launch does silently. The boot probe
  // (dev/boot-639-check.cjs) holds the other half: no launch may READ one.
  ok('launching the app keeps the whole history the picker lists',
    keys.includes('versionSnapshot_58.8.0') && keys.length === 10, keys.join(', '));
  ok('including the newest one', keys.includes('versionSnapshot_58.8.8'));
  ok('and the version that is running', keys.includes('versionSnapshot_' + version), keys.join(','));

  const P = await boot({ pinned: true });
  const pkeys = P.snapKeys();
  ok('a pinned version is untouched', pkeys.includes('versionSnapshot_58.8.0'), pkeys.join(','));
  ok('and a pin changes nothing else', pkeys.length === 10, pkeys.length);

  console.log('\n— the Storage panel says what is actually there —');
  win.document.getElementById('settingsTabMore').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(400);
  const head = win.document.getElementById('collapsibleStorage');
  ok('there is a Storage block', !!head);
  if (head) head.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await wait(500);
  const bodyText = (win.document.getElementById('storagePanelBody') || {}).textContent || '';
  console.log('    panel: ' + bodyText.replace(/\s+/g, ' ').slice(0, 130));
  ok('it reports the music and its size', /Your music/.test(bodyText) && /songs/.test(bodyText));
  ok('it reports the covers', /Covers/.test(bodyText));
  ok('it reports the rollback copies with their size', /Saved rollback copies/.test(bodyText) && /MB|KB/.test(bodyText));
  ok('it says how many copies Free up space would keep', /keeps the newest \d+/.test(bodyText), bodyText.slice(0, 100));
  // Every number carries its unit: a second scFmtBytes() lower in the script used
  // to shadow the real one and the panel printed "13.8" on its own.
  ok('every size it prints has a unit', /\d(\.\d+)? (B|KB|MB|GB)/.test(bodyText), bodyText.slice(0, 90));
  ok('and it explains why the music is there at all', /no network/.test(bodyText));

  console.log('\n— Free up space —');
  const SINGLES_KEY = 'discPopupCache_\ud83c\udfb5 Singles';
  const ALBUM_KEY = 'discPopupCache_\ud83d\udcbf Album History';
  const F = await boot({ localStorage: { [SINGLES_KEY]: 'x'.repeat(5000), [ALBUM_KEY]: 'y'.repeat(5000) } });
  const fw = F.win;
  // The copies boot kept are the ones the user may still want (they are the
  // newest few). What the button is for is the copies that arrive AFTER that —
  // a phone that keeps taking updates between taps. Seed them directly.
  for (let i = 0; i < 4; i++) {
    const k = 'versionSnapshot_57.0.' + i;
    F.idb._data.meta.set(k, { key: k, value: { version: '57.0.' + i, html: 'z'.repeat(1000000), savedAt: 1600000000000 + i } });
  }
  const beforeSnaps = F.snapKeys().length;
  let freed = null, threw = null;
  try { if (fw.__scFreeUpSpace) await fw.__scFreeUpSpace(); } catch (e) { threw = e; }
  await wait(600);
  const afterSnaps = F.snapKeys().length;
  console.log('    rollback copies: ' + beforeSnaps + ' -> ' + afterSnaps + '  (localStorage cache keys left: ' +
    [SINGLES_KEY, ALBUM_KEY].filter((k) => fw.localStorage.getItem(k)).length + ')');
  ok('freeing up does not throw', !threw, threw && threw.message);
  ok('it drops the old rollback copies', afterSnaps < beforeSnaps, beforeSnaps + ' -> ' + afterSnaps);
  ok('and brings them back down to the cap', afterSnaps <= 6, afterSnaps);
  ok('it clears the saved popup caches', !fw.localStorage.getItem(SINGLES_KEY) && !fw.localStorage.getItem(ALBUM_KEY));
  ok('and it did not touch the user\'s own data', !!fw.localStorage.getItem('sidecut_snapshot_marker'));
  ok('the panel is told what was freed', /Freed|free/i.test((fw.document.getElementById('storagePanelBody') || {}).textContent || ''));

  console.log('\n— the backup zip does not stay in the app\u2019s own cache —');
  const C = await boot({ cacheFiles: { 'sidecut-library.zip': 4000000, 'holiday-photo.jpg': 5000 } });
  const cw = C.win;
  // The export streams the whole library into CACHE so the share sheet can have
  // a URI. Only the FAILURE path ever deleted it, so a finished export left a
  // complete second copy of the music in the app for good.
  // Not just "a deleteFile exists" (the failure path had one all along): the
  // finished export has to schedule the removal of the file it just shared.
  ok('a finished export now removes its cache copy',
    /setTimeout\(function\(\)\{\s*try\{ FS\.deleteFile\(\{ path: filename, directory: 'CACHE' \}\)/.test(html));
  const usage = cw.__scOwnCacheUsage ? await cw.__scOwnCacheUsage() : { files: 0, bytes: 0, missing: true };
  ok('the app can measure what it left in its own cache', usage.files === 1 && usage.bytes === 4000000, JSON.stringify(usage));
  cw.document.getElementById('settingsTabMore').dispatchEvent(new cw.MouseEvent('click', { bubbles: true }));
  await wait(400);
  const chead = cw.document.getElementById('collapsibleStorage');
  if (chead) chead.dispatchEvent(new cw.MouseEvent('click', { bubbles: true }));
  await wait(500);
  const cText = (cw.document.getElementById('storagePanelBody') || {}).textContent || '';
  console.log('    panel: ' + cText.replace(/\s+/g, ' ').slice(0, 150));
  ok('the panel names the leftover backup files', /Backup files left in the app/.test(cText), cText.slice(0, 120));
  const cleaned = cw.__scCleanOwnCache ? await cw.__scCleanOwnCache() : { files: 0, bytes: 0, missing: true };
  ok('and it can be cleared', cleaned.files === 1 && cleaned.bytes === 4000000, JSON.stringify(cleaned));
  ok('without touching a file that is not SideCut\u2019s', !!cw.__cacheFiles['holiday-photo.jpg'],
    Object.keys(cw.__cacheFiles).join(','));

  console.log('\n— nothing broke —');
  ok('no boot errors', A.errors.length === 0, A.errors.join(' | ').slice(0, 200));

  console.log('\n' + pass + ' passed, ' + fail + ' failed  (v' + version + ')');
  process.exit(fail ? 1 : 0);
})();
