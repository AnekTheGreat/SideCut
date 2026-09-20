// Media-controls + background-power audit.
//
// Two reported problems, both of which have a mechanism that can be modelled:
//
//  1. "The lock-screen forward/back buttons don't work, and sometimes aren't even
//     there." The sound comes out of the WebView's <audio> element, and the phone's
//     media player follows THAT session — whose button set is what the page
//     registered through navigator.mediaSession. Registering only on the native
//     plugin left the session the system actually routes presses to with nothing
//     but its own play/pause: no handler for previous/next, so they were missing,
//     greyed out, or dead. This audit drives BOTH sessions and checks every control
//     is on both, that a rebuilt session gets them back, and that the controls the
//     plugin offers actually do what their icons say.
//
//  2. "It drains my phone even when the app isn't open." A media foreground service
//     keeps the device out of doze for as long as it lives, and the OTA check used
//     to wake the radio every half hour around the clock. The audit proves a paused
//     player left in the background hands the session back, that the controls
//     return the moment anything plays again, and that the update poll refuses to
//     run while the app is hidden.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
// The OTA client is a separate file; SC_UPDATES lets the audit run against the
// previous version of it, so the background-poll checks can be shown to fail
// before the change rather than only pass after it.
const updatesSrc = fs.readFileSync(process.env.SC_UPDATES || path.join(ROOT, 'dev/native-updates.js'), 'utf8');

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

// The native plugin's controls (the lock-screen / notification player)…
const nativeHandlers = {};
// …and the browser Media Session, which is the one the phone's player follows when
// the sound is coming out of the WebView's own <audio> element.
const webHandlers = {};
const mediaStates = [];
const nativeCalls = [];

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(updatesSrc, { headers: { 'Content-Type': 'application/javascript' } });
  }
  return undefined;
});

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m); });

// Date.now() is deliberately NOT frozen here: the app throttles control
// re-registration by wall-clock time, and a frozen clock would make every
// re-assert look like it happened a moment ago.
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
    let hidden = false, visState = 'visible';
    Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(win.document, 'visibilityState', { configurable: true, get: () => visState });
    win.__setVisibility = (h) => {
      hidden = h; visState = h ? 'hidden' : 'visible';
      win.document.dispatchEvent(new win.Event('visibilitychange'));
    };
    // jsdom has no Media Session at all — the WebView does. Installing one is what
    // lets the audit see which controls the page registers on the session the
    // phone's media player actually follows.
    win.MediaMetadata = class MediaMetadata { constructor(init) { Object.assign(this, init || {}); } };
    const ms = {
      metadata: null,
      playbackState: 'none',
      setActionHandler(action, handler) { webHandlers[action] = handler; },
      setPositionState() {},
    };
    Object.defineProperty(win.navigator, 'mediaSession', { configurable: true, get: () => ms });
    win.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      nativePromise: (plugin, method, opts) => {
        nativeCalls.push(plugin + '.' + method);
        if (plugin === 'MediaSession' && method === 'setPlaybackState' && opts) mediaStates.push(String(opts.playbackState));
        return Promise.resolve({});
      },
      nativeCallback: (plugin, method, opts, cb) => {
        nativeCalls.push(plugin + '.' + method);
        if (plugin === 'MediaSession' && method === 'setActionHandler' && opts && opts.action) nativeHandlers[opts.action] = cb;
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const win = dom.window;
  await wait(4000);                      // boot + the native media-session adapter arming

  // The app alternates between two <audio> elements (crossfade), and its 'play'
  // handler ignores anything that isn't the currently active one — so the audit
  // patches both and drives whichever is live.
  const els = [win.document.getElementById('audioEl'), win.document.getElementById('audioEl2')].filter(Boolean);
  let paused = true, currentTime = 0, duration = 135;
  els.forEach((a) => {
    Object.defineProperty(a, 'paused', { get: () => paused, set: (v) => { paused = v; }, configurable: true });
    Object.defineProperty(a, 'currentTime', { get: () => currentTime, set: (v) => { currentTime = v; }, configurable: true });
    Object.defineProperty(a, 'duration', { get: () => duration, configurable: true });
    let srcValue = '';
    Object.defineProperty(a, 'src', {
      configurable: true,
      get: () => srcValue,
      set: (v) => { srcValue = v; setTimeout(() => a.dispatchEvent(new win.Event('loadedmetadata')), 0); },
    });
    a.play = () => { paused = false; els.forEach((x) => x.dispatchEvent(new win.Event('play'))); return Promise.resolve(); };
    a.pause = () => { paused = true; els.forEach((x) => x.dispatchEvent(new win.Event('pause'))); };
  });
  const startPlaying = () => { paused = false; els.forEach((x) => x.dispatchEvent(new win.Event('play'))); };
  const el = els[0];

  console.log('\n— every control is on BOTH sessions —');
  // This is the reported bug: the session the phone's player follows had no
  // previous/next handler at all.
  const CONTROLS = ['play', 'pause', 'previoustrack', 'nexttrack', 'stop', 'seekto', 'seekbackward', 'seekforward'];
  const missingNative = CONTROLS.filter((a) => !nativeHandlers[a]);
  const missingWeb = CONTROLS.filter((a) => !webHandlers[a]);
  ok('the phone\'s own media session has every control', missingWeb.length === 0, 'missing=' + missingWeb.join(','));
  ok('the native notification player has every control', missingNative.length === 0, 'missing=' + missingNative.join(','));
  ok('forward/back are on the session the system routes presses to',
     !!webHandlers.nexttrack && !!webHandlers.previoustrack);

  console.log('\n— a session rebuilt by the OS gets its buttons back —');
  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) {}
  await wait(300);
  startPlaying();                                            // a song really starts
  await wait(200);
  for (const a of Object.keys(webHandlers)) delete webHandlers[a];
  for (const a of Object.keys(nativeHandlers)) delete nativeHandlers[a];
  // Starting a song must NOT re-register the whole set: that handed the native
  // bridge a fresh callback per action per track. The controls only need
  // re-asserting when the session can actually have been rebuilt.
  try { win.playFromList(['t1', 't2'], 't2'); } catch (e) {}
  await wait(200);
  startPlaying();
  await wait(300);
  ok('starting a song does not re-register the whole control set',
     CONTROLS.some((a) => !webHandlers[a]), 'registered=' + Object.keys(webHandlers).join(','));

  // The rebuild that matters: the notification is torn down with the app in the
  // background, so coming back has to put every control on it again.
  for (const a of Object.keys(webHandlers)) delete webHandlers[a];
  for (const a of Object.keys(nativeHandlers)) delete nativeHandlers[a];
  win.__setVisibility(true);
  await wait(150);
  win.__setVisibility(false);
  await wait(400);
  ok('coming back to the app re-asserts every control on the phone\'s session',
     CONTROLS.every((a) => !!webHandlers[a]), 'got=' + Object.keys(webHandlers).join(','));
  ok('and on the native player too', CONTROLS.every((a) => !!nativeHandlers[a]),
     'got=' + Object.keys(nativeHandlers).join(','));

  console.log('\n— the controls do what their icons say —');
  currentTime = 60;
  webHandlers.seekbackward({});
  ok('the 30-second jump back moves the playhead 30s back', currentTime === 30, 'currentTime=' + currentTime);
  webHandlers.seekforward({});
  ok('the 30-second jump forward moves it 30s on', currentTime === 60, 'currentTime=' + currentTime);
  // Every player uses the same rule, and it is the difference between a working
  // button and a confusing one: past a few seconds "previous" restarts the song
  // that is playing; in the opening seconds it means the previous song.
  currentTime = 60;
  webHandlers.previoustrack({});
  ok('deep into a song, "previous" restarts it', currentTime === 0, 'currentTime=' + currentTime);
  currentTime = 1.2;
  webHandlers.previoustrack({});
  ok('a second in, "previous" does not restart it (it asks for the previous song)',
     currentTime === 1.2, 'currentTime=' + currentTime);
  currentTime = 60;

  console.log('\n— a paused player left in the background gives the phone back —');
  win.__scMediaBgGraceMs = 300;              // ten minutes, compressed for the audit
  mediaStates.length = 0;
  paused = true;                             // the user paused, then left the app
  win.__setVisibility(true);
  await wait(700);
  ok('the session is released once it has been paused and away long enough',
     mediaStates.indexOf('none') !== -1, 'states=' + JSON.stringify(mediaStates));

  console.log('\n— coming back and playing brings everything straight back —');
  mediaStates.length = 0;
  win.__setVisibility(false);
  await wait(150);
  ok('the session is live again on return', mediaStates.length > 0, 'states=' + JSON.stringify(mediaStates));
  currentTime = 20;
  startPlaying();
  await wait(250);
  ok('and it reports playing', mediaStates[mediaStates.length - 1] === 'playing',
     'states=' + JSON.stringify(mediaStates));
  ok('with every control still registered',
     CONTROLS.every((a) => !!webHandlers[a] && !!nativeHandlers[a]),
     'web=' + Object.keys(webHandlers).join(',') + ' native=' + Object.keys(nativeHandlers).join(','));

  console.log('\n— playing in the background does NOT get released —');
  mediaStates.length = 0;
  win.__scMediaBgGraceMs = 300;
  paused = false; currentTime = 40;
  win.__setVisibility(true);
  await wait(700);
  ok('a session that is still playing is left alone', mediaStates.indexOf('none') === -1,
     'states=' + JSON.stringify(mediaStates));
  win.__setVisibility(false);
  await wait(80);

  console.log('\n— the update poll stays out of the background —');
  const pollBody = (updatesSrc.match(/setInterval\(function\(\)\{[\s\S]{0,220}?\}, 3 \* 60 \* 60 \* 1000\);/) || [''])[0];
  ok('the periodic update check skips while the app is hidden', /visibilityState === 'hidden'\)\s*return/.test(pollBody),
     pollBody.slice(0, 120));
  ok('and it no longer fires every half hour', !/30 \* 60 \* 1000/.test(updatesSrc));

  console.log('\n— timers started while hidden do not run all session —');
  let fired = 0;
  win.__setVisibility(true);
  win.setInterval(() => { fired++; }, 600);
  await wait(900);
  ok('a poll or heartbeat started while the app is in the background starts stopped', fired === 0, 'fired=' + fired);
  win.__setVisibility(false);
  await wait(1200);
  ok('and it comes back when the app is shown again', fired > 0, 'fired=' + fired);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  const realErrors = errors.filter((e) => !/dbPromise|offline|no network|Not implemented/i.test(e));
  if (realErrors.length) { console.log('page errors:'); realErrors.slice(0, 8).forEach((e) => console.log('  ' + e)); }
  process.exit(fail ? 1 : 0);
})();
