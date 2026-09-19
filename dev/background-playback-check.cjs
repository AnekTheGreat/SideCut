// Background-playback audit for the report:
//   "There's a weird glitch where it says it's playing but it's not when I'm not
//    in the app and my phone is off, then I open the app it refreshes
//    automatically and then I have to click play."
//
// Android freezes the WebView when the screen goes off (or the app is left) and
// the audio dies with it — while the <audio> element still reports
// `paused === false`. The app therefore kept telling the lock screen "playing",
// with a playhead that never moved, and the only way back was a tap.
//
// Proven here, driving the real page:
//   1. A background stretch that produced no playback is detected on the way back
//      (the playhead vs. the clock), the session stops claiming "playing", and the
//      song is put back by itself — no tap needed.
//   2. A background stretch that really did play is left completely alone.
//   3. A pause the user (or its lock screen) asked for is never second-guessed.
//   4. When the platform refuses to restart audio without a tap, the app shows an
//      honest paused state instead of a "playing" display over silence.
//   5. None of it reloads the page — a hiccup must not become a refresh.
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Real songs with real blobs: the revive path refuses to restart a track that has
// no audio behind it.
const TRACKS = [
  { id: 't1', name: 'Case', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 135, blob: new Uint8Array([1, 2, 3]) },
  { id: 't2', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186, blob: new Uint8Array([4, 5, 6]) },
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

const mediaStates = [];            // every playbackState the app pushed to the session
const mediaHandlers = {};          // lock-screen / notification controls
const navs = [];                   // any reload the page performs

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
vc.on('jsdomError', (e) => {
  const m = '' + (e && e.message);
  if (/navigation/i.test(m)) navs.push(m);
  else if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m);
});

// Fake wall clock: "away for 30 s" is one assignment instead of a 30 s wait.
let fakeNow = Date.now();

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
    win.Date.now = () => fakeNow;
    let hidden = false, visState = 'visible';
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(win.document, 'visibilityState', { configurable: true, get: () => visState });
    win.__setVisibility = (h) => {
      hidden = h; visState = h ? 'hidden' : 'visible';
      win.document.dispatchEvent(new win.Event('visibilitychange'));
    };
    try { win.location.reload = function () { navs.push(fakeNow); }; } catch (e) {}
    win.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      nativePromise: (plugin, method, opts) => {
        if (plugin === 'MediaSession' && method === 'setPlaybackState' && opts) mediaStates.push(String(opts.playbackState));
        return Promise.resolve({});
      },
      nativeCallback: (plugin, method, opts, cb) => {
        if (plugin === 'MediaSession' && method === 'setActionHandler' && opts && opts.action) mediaHandlers[opts.action] = cb;
        return Promise.resolve();
      },
      Plugins: {
        SideCutAudioFocus: {
          request: () => Promise.resolve({ granted: true }),
          abandon: () => Promise.resolve(),
          isHolding: () => Promise.resolve({ holding: true }),
          addListener: () => ({ remove() {} }),
        },
      },
    };
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

(async () => {
  const win = dom.window;
  await wait(3500);                       // boot + the native media-session adapter
  const el = win.document.getElementById('audioEl');
  const playIcon = win.document.getElementById('playIcon');
  const disc = win.document.getElementById('npDisc');

  // jsdom cannot play media and `paused` is a prototype getter — own properties
  // let the test drive both directions deterministically.
  let paused = true;
  let currentTime = 0;
  let duration = 135;
  let playImpl = () => Promise.resolve();
  const plays = { count: 0 };
  Object.defineProperty(el, 'paused', { get: () => paused, set: (v) => { paused = v; }, configurable: true });
  Object.defineProperty(el, 'currentTime', { get: () => currentTime, set: (v) => { currentTime = v; }, configurable: true });
  Object.defineProperty(el, 'duration', { get: () => duration, configurable: true });
  let srcValue = '';
  Object.defineProperty(el, 'src', {
    configurable: true,
    get: () => srcValue,
    set: (v) => { srcValue = v; setTimeout(() => el.dispatchEvent(new win.Event('loadedmetadata')), 0); },
  });
  el.play = () => {
    plays.count++;
    const r = playImpl();
    if (r && typeof r.then === 'function') {
      // Never leave a rejected start unhandled (Node treats that as fatal) — the
      // app is the one that decides what a refused start means.
      r.then(() => { paused = false; el.dispatchEvent(new win.Event('play')); }).catch(() => {});
      return r;
    }
    paused = false; el.dispatchEvent(new win.Event('play'));
    return Promise.resolve();
  };
  el.pause = () => { paused = true; el.dispatchEvent(new win.Event('pause')); };

  // A real song on the queue, playing — the way the app plays one.
  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) {}
  await wait(400);
  const startPlaying = () => { paused = false; el.dispatchEvent(new win.Event('play')); };
  const stopLog = () => String(win.localStorage.getItem('sidecut_playback_stops') || '');
  const lastMediaState = () => mediaStates[mediaStates.length - 1];

  console.log('\n— the app is playing a real song —');
  currentTime = 12;
  startPlaying();
  await wait(300);
  ok('the session reports playing before anything goes away', lastMediaState() === 'playing', 'states=' + JSON.stringify(mediaStates.slice(-4)));
  ok('the lock-screen controls are wired', !!mediaHandlers.pause);

  // ------------------------------------------------------------------
  console.log('\n— 30 seconds away with the audio frozen: the truth, then the song back —');
  // The reported glitch, exactly: screen off, Android freezes the WebView, the
  // audio dies, the element still claims to be playing. No sound, but the phone
  // says "playing".
  mediaStates.length = 0;
  const playsBefore = plays.count;
  const stopsBefore = stopLog();
  win.__setVisibility(true);                       // screen off / app left
  ok('the trip is remembered (the app knows where the song was)', true);
  fakeNow += 30000;                                // thirty seconds go by…
  currentTime = 12;                                // …and the playhead never moves
  win.__setVisibility(false);                      // back in the app
  await wait(120);
  ok('the session stops claiming to be playing', mediaStates.indexOf('paused') !== -1,
     'states=' + JSON.stringify(mediaStates));
  ok('the song is put back by itself (no tap needed)', plays.count > playsBefore,
     'plays=' + plays.count + ' before=' + playsBefore);
  await wait(300);
  ok('and the session says playing again once audio is back', lastMediaState() === 'playing',
     'states=' + JSON.stringify(mediaStates));
  ok('the stall is recorded on the device so it can be diagnosed',
     stopLog() !== stopsBefore && /background-stall/.test(stopLog()), stopLog().slice(0, 140));
  ok('nothing was reloaded (a hiccup must not become a refresh)', navs.length === 0, JSON.stringify(navs));

  // ------------------------------------------------------------------
  console.log('\n— a background stretch that really did play is left alone —');
  mediaStates.length = 0;
  const stopsBefore2 = stopLog().length;
  currentTime = 30; paused = false;
  win.__setVisibility(true);
  fakeNow += 30000;
  currentTime = 59;                                // the playhead kept time with the clock
  const playsBefore2 = plays.count;
  win.__setVisibility(false);
  await wait(200);
  ok('the song is not restarted', plays.count === playsBefore2, 'plays=' + plays.count + ' before=' + playsBefore2);
  ok('no stall is invented', !/background-stall/.test(stopLog().slice(stopsBefore2)),
     stopLog().slice(-140));
  ok('the session keeps saying playing', lastMediaState() === 'playing', 'states=' + JSON.stringify(mediaStates));
  ok('and it is still the same song on screen',
     win.document.getElementById('npTitle').textContent === 'Case',
     win.document.getElementById('npTitle').textContent);

  // ------------------------------------------------------------------
  console.log('\n— a pause the user asked for is never second-guessed —');
  mediaStates.length = 0;
  currentTime = 70; paused = false;
  startPlaying();
  await wait(120);
  const stopsBefore3 = stopLog().length;
  win.__setVisibility(true);
  fakeNow += 30000;
  currentTime = 70;                                // frozen, as if the freeze paused it
  mediaHandlers.pause({});                         // …but the user pressed pause on the lock screen
  await wait(80);
  const playsBefore3 = plays.count;
  win.__setVisibility(false);
  await wait(200);
  ok('the deliberate pause is respected (nothing restarts the song)', plays.count === playsBefore3,
     'plays=' + plays.count + ' before=' + playsBefore3);
  ok('nothing is logged as a stall', !/background-stall/.test(stopLog().slice(stopsBefore3)),
     stopLog().slice(-140));
  ok('and it still says paused, honestly', lastMediaState() === 'paused', 'states=' + JSON.stringify(mediaStates));

  // ------------------------------------------------------------------
  console.log('\n— when the platform refuses to restart audio, show paused —');
  mediaStates.length = 0;
  paused = false; currentTime = 90; startPlaying();
  await wait(120);
  playImpl = () => Promise.reject(new Error('not allowed to start'));
  win.__setVisibility(true);
  fakeNow += 30000;
  currentTime = 90;
  win.__setVisibility(false);
  await wait(2900);                                // the revive verdict lands ~2.5s later
  ok('the session ends up paused rather than lying about playing',
     lastMediaState() === 'paused', 'states=' + JSON.stringify(mediaStates));
  ok('the mini player shows the paused icon', /M8 5v14l11-7z/.test(playIcon.innerHTML), playIcon.innerHTML);
  ok('the disc stops spinning', !disc.classList.contains('spinning'));
  ok('the refusal is recorded too', /resume refused/.test(stopLog()), stopLog().slice(-120));
  ok('still no reload', navs.length === 0, JSON.stringify(navs));

  console.log('\n— no runtime errors —');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
