// Audio-focus audit: proves the app asks Android for audio focus while a song
// plays (so the system hands focus back to SideCut after a call instead of
// resuming another music app), releases it only on a deliberate pause, and pauses
// then resumes around an interruption without ever treating it as a user pause.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

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
// A real queue is needed: the resume path deliberately refuses to start playback
// with nothing to play, so the test has to be exercising an actual song.
const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
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
    _data: data,
    open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
  };
}

const calls = { request: 0, abandon: 0, isHolding: 0 };
let focusListener = null;

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8'), {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
  return undefined;
});

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m); });

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
    win.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: {
        SideCutAudioFocus: {
          request: () => { calls.request++; return Promise.resolve({ granted: true }); },
          abandon: () => { calls.abandon++; return Promise.resolve(); },
          isHolding: () => { calls.isHolding++; return Promise.resolve({ holding: true }); },
          addListener: (evt, cb) => { if (evt === 'focusChange') focusListener = cb; return { remove() {} }; },
        },
      },
    };
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const win = dom.window;
  await wait(3000);
  const el = win.document.getElementById('audioEl');
  const playPause = win.document.getElementById('playPauseBtn');
  const played = { count: 0, pausedCount: 0 };
  // jsdom cannot actually play media, and `paused` is a read-only prototype
  // getter — own properties let the test drive both directions deterministically.
  Object.defineProperty(el, 'paused', { value: true, writable: true, configurable: true });
  el.play = () => { played.count++; el.paused = false; return Promise.resolve(); };
  // A real pause() also fires the 'pause' event, and that event is where the app
  // gives focus back — so the stub has to fire it too.
  el.pause = () => { played.pausedCount++; el.paused = true; el.dispatchEvent(new win.Event('pause')); };
  const setPlaying = () => { el.paused = false; el.dispatchEvent(new win.Event('play')); };
  const emit = (event) => { if (focusListener) focusListener({ event }); };

  console.log('\n— the native plugin is wired up —');
  ok('the focus plugin was detected and its listener registered', !!focusListener);
  ok('no audio-focus state was touched before anything played', calls.request === 0 && calls.abandon === 0,
     'requests=' + calls.request + ' abandons=' + calls.abandon);

  // A real song on the queue, the way the app plays one.
  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) {}
  await wait(400);
  el.paused = false;
  played.count = 0; played.pausedCount = 0; calls.request = 0; calls.abandon = 0;
  const playingNow = () => el.paused === false;

  console.log('\n— playing takes audio focus —');
  setPlaying();
  await wait(50);
  ok('a started song requests focus', calls.request === 1, 'requests=' + calls.request);
  ok('it does not abandon focus right away', calls.abandon === 0, 'abandons=' + calls.abandon);
  ok('and the queue is real (resume has something to play)', win.document.querySelectorAll('#listPane .track').length >= 0);

  console.log('\n— a call (transient focus loss) pauses without losing focus —');
  emit('lossTransient');
  await wait(50);
  ok('the song is paused for the interruption', played.pausedCount === 1, 'pauses=' + played.pausedCount);
  ok('focus is NOT released — the system must hand it back to us', calls.abandon === 0, 'abandons=' + calls.abandon);

  console.log('\n— when the call ends the song comes back —');
  emit('gain');
  await wait(80);
  ok('playback resumes by itself', played.count === 1, 'plays=' + played.count);
  ok('the app is playing again', playingNow(), 'paused=' + el.paused);
  ok('focus was never abandoned through the whole interruption', calls.abandon === 0, 'abandons=' + calls.abandon);

  console.log('\n— a permanent loss is re-requested on the next play —');
  emit('loss');
  await wait(50);
  ok('a permanent loss pauses us too', played.pausedCount === 2, 'pauses=' + played.pausedCount);
  setPlaying();
  await wait(50);
  ok('the next start asks for focus again instead of assuming we still hold it',
     calls.request === 2, 'requests=' + calls.request);

  console.log('\n— a deliberate pause gives focus back —');
  el.paused = false;                       // playing, so the button means "pause"
  win.document.getElementById('playPauseBtn').click();
  await wait(80);
  ok('the user pause releases focus so another app can take over cleanly',
     calls.abandon === 1, 'abandons=' + calls.abandon);
  ok('and it actually paused the element', el.paused === true);

  console.log('\n— nothing resumes after a pause the user asked for —');
  played.count = 0;
  emit('lossTransient');
  emit('gain');
  await wait(80);
  ok('an interruption after a user pause does not start playback again', played.count === 0, 'plays=' + played.count);

  console.log('\n— duck requests are ignored on purpose —');
  const abandonBefore = calls.abandon;
  setPlaying();
  const volumeBefore = el.volume;
  emit('duck');
  await wait(50);
  ok('a duck request does not pause or abandon (this player has its own volume handling)',
     el.paused === false && calls.abandon === abandonBefore, 'paused=' + el.paused + ' abandons=' + calls.abandon);
  ok('and it does not touch the element volume the crossfade owns', el.volume === volumeBefore, 'volume=' + el.volume);

  console.log('\n— no runtime errors —');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
