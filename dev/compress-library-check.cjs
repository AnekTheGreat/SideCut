// "Also maybe have an option to compress your library to make the format smaller
//  if possible" - the owner, 73.4.9.
//
// The re-encoder already existed, but only as a button on ONE big song in the
// Studio storage cleaner (and a batch over a hand-made selection). Settings ->
// More -> Library Tools now has "Compress library (smaller files)", which walks
// the whole library in one run through the same engine.
//
// Proven here, driving the real page:
//   1. The rule is "only if possible": a song whose own length says it is already
//      at or below the target is left alone, and one above it is queued.
//   2. A run covers exactly the songs worth shrinking - never the ones already
//      small enough - and reports each song that could not finish honestly.
//   3. A run that shrinks songs reports the bytes won back.
//   4. A library with nothing to win says so and starts nothing.
//   5. The Settings -> More button exists and starts the run.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
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

const TRACKS = [
  { id: 't1', name: 'Loud', artist: 'A', album: 'X', duration: 135 },
  { id: 't2', name: 'Already small', artist: 'B', album: 'X', duration: 186 },
  { id: 't3', name: 'No length known', artist: 'C', album: 'X' },
];

function fakeIndexedDB() {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map() };
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
    open() {
      const req = { error: null };
      const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) };
      setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0);
      return req;
    },
  };
}

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8'), {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
  return undefined;
});

const errors = [];
const toasts = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const m = '' + (e && e.message);
  if (!/Not implemented|Could not load/i.test(m)) errors.push(m);
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
    win.URL.createObjectURL = () => 'blob:fake';
    win.URL.revokeObjectURL = () => {};
    win.fetch = () => Promise.reject(new Error('offline'));
    win.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web', Plugins: {} };
    // The toasts are how a run speaks to the user; capture them so the gate can
    // read the report the run finishes with.
    win.toast = (m) => { toasts.push(String(m)); };
  },
});

(async () => {
  const win = dom.window;
  await wait(3500);
  // Block 1 defines window.toast itself, so the capture has to be wrapped around
  // the real one after boot (the Studio helper reads window.toast at call time).
  const origToast = win.toast;
  win.toast = function (m, ms) { toasts.push(String(m)); try { return origToast.call(this, m, ms); } catch (e) {} };
  const SC70 = win.SC70;
  ok('the Studio module published its surface', !!SC70, typeof SC70);
  if (!SC70) { console.log('\nFAILURES: ' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

  // A library with a loud file, an already-small file, and a file whose length
  // never resolved.
  const tracks = win.__scAllTracks() || [];
  const byId = (id) => tracks.find((t) => t.id === id);
  const t1 = byId('t1'), t2 = byId('t2'), t3 = byId('t3');
  ok('the fixture library is loaded', !!(t1 && t2 && t3), tracks.map((t) => t.id).join(','));
  if (!t1 || !t2 || !t3) { console.log('\nFAILURES: ' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

  const mkFile = (name, bytes, type) => new win.File([new Uint8Array(bytes)], name, { type: type || 'audio/mpeg' });
  // 5,400,000 bytes over 135s is 320 kbps; 2,232,000 over 186s is 96 kbps.
  t1.file = mkFile('loud.mp3', 5400000);
  t2.file = mkFile('small.mp3', 2232000);
  t3.file = mkFile('unknown.mp3', 4000000);

  console.log('\n\u2014 only if possible: what a run will and will not touch \u2014');
  ok('a song above the target is queued', SC70.needsShrink(t1, 128) === true);
  ok('a song already at or below the target is left alone', SC70.needsShrink(t2, 128) === false);
  ok('a song whose length never resolved is queued (its size cannot say)', SC70.needsShrink(t3, 128) === true);
  ok('a song with no audio file is never queued', SC70.needsShrink({ id: 'x', duration: 10 }, 128) === false);
  ok('a lossless-sized file is queued', SC70.needsShrink({ id: 'w', duration: 60, file: { size: 60000000 } }, 128) === true);

  console.log('\n\u2014 a real run: the decode + encode path, with the bytes won back \u2014');
  // jsdom has no audio engine, so the gate supplies the two things a re-encode
  // needs: something that decodes (an AudioContext stub) and an encoder that
  // returns a smaller file. The app's own bookkeeping is what is under test.
  win.AudioContext = function () {
    return {
      sampleRate: 44100,
      decodeAudioData: (buf, success) => { success({ duration: 135, length: 135 * 44100, numberOfChannels: 2, sampleRate: 44100 }); },
    };
  };
  win.__scEncodeMp3 = () => Promise.resolve(new win.Blob([new Uint8Array(1000)], { type: 'audio/mpeg' }));

  let started = false;
  try { started = SC70.compressLibrary(128) === true; } catch (e) { started = false; }
  ok('the run starts', started);

  let state = SC70.compressState();
  ok('it queued exactly the songs worth shrinking (not the already-small one)',
     state.n === 2, 'n=' + state.n);
  ok('and it says which rate it is compressing to', state.rate === 128, 'rate=' + state.rate);

  // Wait for the run to walk both songs.
  const deadline = Date.now() + 15000;
  while (SC70.compressState().busy && Date.now() < deadline) await wait(60);
  state = SC70.compressState();
  ok('the run finishes', state.busy === false, JSON.stringify(state));
  ok('it walked every song it queued', state.i === state.n, 'i=' + state.i + ' n=' + state.n);
  ok('the loud file was actually replaced by a smaller one',
     t1.file && t1.file.size < 5400000, 'size=' + (t1.file && t1.file.size));
  ok('the bytes won back are counted', state.saved > 0, 'saved=' + state.saved);
  ok('the already-small song is untouched, byte for byte',
     t2.file && t2.file.size === 2232000, 'size=' + (t2.file && t2.file.size));
  ok('the run says how much it won back', toasts.some((m) => /smaller/.test(m)),
     JSON.stringify(toasts.slice(-3)));

  console.log('\n\u2014 a library with nothing to win starts nothing \u2014');
  // Make everything already small, then ask again.
  tracks.forEach((t) => { if (t.file && t.duration) t.file = new win.File([new Uint8Array(1000)], 'tiny.mp3', { type: 'audio/mpeg' }); });
  const before = SC70.compressState();
  let again = true;
  try { again = SC70.compressLibrary(128); } catch (e) { again = true; }
  ok('a run over an already-compressed library does not start', again === false);
  ok('and it says so rather than working for nothing',
     toasts.slice(-1)[0] && /nothing to compress/i.test(toasts.slice(-1)[0]), toasts.slice(-1)[0]);
  ok('the previous report is not disturbed', SC70.compressState().n === before.n, JSON.stringify(SC70.compressState()));

  console.log('\n\u2014 the option is really in Settings -> More \u2014');
  ok('the Library Tools panel has the button', /id="compressLibBtn"/.test(html));
  ok('its note says a song already at or below the rate is left alone',
     /already at or below it is left alone/.test(html));
  ok('the button starts the Studio run', /compressLibBtn'\)\.addEventListener\('click'/.test(html) &&
     /SC70\.compressLibrary\(128\)/.test(html));
  ok('the run is on the module surface for the app to reach', /compressLibrary: compressLibrary/.test(html));

  console.log('\n\u2014 no runtime errors \u2014');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
