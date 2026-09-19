// Audio-focus audit. The rule now: the app NEVER takes audio focus for itself.
// Its audio lives in a WebView, Chromium holds focus for that element, and taking
// it away makes Chromium pause the element it owns — which is the "the song stops a
// second or two after you press play" bug. The audit proves no request is ever
// made, that an unrequested pause in the opening seconds is undone (and cannot
// reload the page), and that an interruption the system does send us still pauses
// and still resumes without ever being treated as a user pause.
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
// Handlers the app registers on the phone's media session (lock screen /
// notification player). Captured so the test can drive a pause the way the
// native bridge would.
const mediaHandlers = {};
const nativePauseHandler = () => mediaHandlers.pause || null;

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
    // The bridge the app uses for native plugins that have no JS module: the
    // media session (lock screen controls) goes through these two.
    win.CapacitorNativeCalls = [];
    win.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      nativePromise: (plugin, method, opts) => { win.CapacitorNativeCalls.push(plugin + '.' + method); return Promise.resolve({}); },
      nativeCallback: (plugin, method, opts, cb) => {
        win.CapacitorNativeCalls.push(plugin + '.' + method);
        if (plugin === 'MediaSession' && method === 'setActionHandler' && opts && opts.action) {
          mediaHandlers[opts.action] = cb;
        }
        return Promise.resolve();
      },
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

  console.log('\n— the app never takes focus from its own WebView —');
  setPlaying();
  // v58.8.4: the app never asks for audio focus. Asking for it takes focus away
  // from this app's OWN WebView (Chromium holds it for the <audio> element), and
  // Chromium's answer to losing focus is to pause the element it owns — which is
  // exactly the "the song stops a second or two after you press play" report, on
  // every start, from the moment the focus helper shipped.
  await wait(120);
  ok('nothing is requested in the first frames of the song', calls.request === 0, 'requests=' + calls.request);
  await wait(2500);
  ok('and audio focus is never taken, even once the song is underway', calls.request === 0, 'requests=' + calls.request);
  ok('nothing is abandoned either (there is nothing to give back)', calls.abandon === 0, 'abandons=' + calls.abandon);
  ok('and the queue is real (resume has something to play)', win.document.querySelectorAll('#listPane .track').length >= 0);

  // The user's symptom, modelled exactly: Chromium pauses the media element the
  // moment this app's audio-focus request supersedes the focus Chromium holds for
  // it. With requests off there is nothing to react to, so the song simply plays.
  console.log('\n— a WebView that pauses on a focus request cannot stop the song —');
  played.pausedCount = 0; played.count = 0; calls.request = 0;
  el.paused = true; setPlaying();
  let reqSeen = 0, webviewPauses = 0;
  const chromium = setInterval(() => {
    if (calls.request > reqSeen) {
      reqSeen = calls.request;
      setTimeout(() => { if (!el.paused) { webviewPauses++; el.paused = true; el.dispatchEvent(new win.Event('pause')); } }, 60);
    }
  }, 50);
  await wait(6000);
  clearInterval(chromium);
  ok('the song is still playing six seconds after pressing play', el.paused === false, 'paused=' + el.paused);
  ok('it never stopped along the way (no pause to recover from)', webviewPauses === 0,
     'webview pauses=' + webviewPauses + ' replays=' + played.count);
  ok('because audio focus was never taken from it', calls.request === 0, 'requests=' + calls.request);

  console.log('\n— a focus loss at the very start of a song cannot stop it —');
  // The bug being fixed (twice over): another app with a live media session grabs
  // focus back the instant anyone asks for it, and obeying that loss meant "press
  // play, the song dies a millisecond later" — every single time.
  played.pausedCount = 0; played.count = 0; calls.request = 0;
  el.paused = true; setPlaying();
  await wait(30);
  emit('loss');
  await wait(750);                        // the take-back is deliberately unhurried
  ok('a loss straight after play does NOT pause the song', played.pausedCount === 0, 'pauses=' + played.pausedCount);
  ok('the song is still playing', el.paused === false, 'paused=' + el.paused);
  emit('loss'); emit('lossTransient');   // the other app grabs it again
  await wait(1200);                      // long enough that a reaction would show
  ok('nothing is asked for in reaction to it', calls.request === 0, 'requests=' + calls.request);
  ok('and the song is still playing through the whole exchange',
     played.pausedCount === 0 && el.paused === false, 'pauses=' + played.pausedCount + ' paused=' + el.paused);

  // A fight repeats: the other app keeps taking it back. Playback must survive.
  emit('loss'); emit('lossTransient');
  await wait(80);
  ok('a repeated fight still does not stop the song', played.pausedCount === 0 && el.paused === false,
     'pauses=' + played.pausedCount + ' paused=' + el.paused);
  ok('the fight is recorded so it can be diagnosed on the phone',
     /at play start/.test(String(win.localStorage.getItem('sidecut_playback_stops') || '')),
     String(win.localStorage.getItem('sidecut_playback_stops') || '').slice(0, 90));

  console.log('\n— a platform pause a second in is undone, and cannot reload the page —');
  // The reported symptom: press play, and about a second later the song stops. The
  // pause does not come from this app at all — the WebView pauses its media element
  // when the audio-focus request is superseded — so the app has to recognise an
  // automatic pause in the opening seconds and put the song straight back.
  played.pausedCount = 0; played.count = 0;
  el.paused = true; setPlaying();                            // a fresh attempt
  await wait(1000);                                          // ~a second into the song
  win.__pendingSWReload = true;                              // an update is waiting
  el.paused = true; el.dispatchEvent(new win.Event('pause')); // the platform pauses us
  await wait(120);
  ok('the song is put straight back instead of stopping', el.paused === false && played.count >= 1,
     'paused=' + el.paused + ' plays=' + played.count);
  ok('the pause is recorded as a platform pause',
     /platform-pause/.test(String(win.localStorage.getItem('sidecut_playback_stops') || '')),
     String(win.localStorage.getItem('sidecut_playback_stops') || '').slice(0, 120));
  ok('a waiting update is NOT applied off that pause (no reload mid-song)',
     win.__pendingSWReload === true);
  // A second one is still tolerated; a third is not (never fight forever).
  el.paused = true; el.dispatchEvent(new win.Event('pause'));
  await wait(80);
  await wait(800);                                            // the revive rate limit
  el.paused = true; el.dispatchEvent(new win.Event('pause'));
  await wait(80);
  ok('a second platform pause is also undone', el.paused === false, 'paused=' + el.paused);
  await wait(800);
  el.paused = true; el.dispatchEvent(new win.Event('pause'));
  await wait(80);
  ok('a third is undone too (that is the budget)', el.paused === false, 'paused=' + el.paused);
  await wait(800);
  el.paused = true; el.dispatchEvent(new win.Event('pause'));
  await wait(80);
  ok('a fourth is left alone rather than fought forever', el.paused === true, 'paused=' + el.paused);
  win.__pendingSWReload = false;
  el.paused = false;

  console.log('\n— a pause from the lock screen right after play is refused —');
  // A stale media-button event / session handover must not silence a song that
  // has only just started. Driven through the real handler the native bridge calls.
  played.pausedCount = 0; played.count = 0;
  el.paused = true; setPlaying();
  await wait(30);
  let handler = nativePauseHandler();
  for (let i = 0; i < 25 && !handler; i++) { await wait(200); handler = nativePauseHandler(); }
  ok('the lock-screen pause handler really is wired up', !!handler);
  if (handler) handler({});
  await wait(60);
  ok('an auto-pause that early is refused', played.pausedCount === 0, 'pauses=' + played.pausedCount);
  ok('and the song keeps playing', el.paused === false, 'paused=' + el.paused);
  ok('the refusal is recorded too',
     /refused-auto-pause/.test(String(win.localStorage.getItem('sidecut_playback_stops') || '')));

  console.log('\n— a call later in the song still pauses it —');
  // Real interruptions are the whole point of holding focus: unbroken playback
  // for the first seconds of a song must not make the app deaf to a call.
  played.pausedCount = 0; played.count = 0; calls.abandon = 0;
  el.paused = false;
  // The opening-seconds guard is six seconds long, so the song has to be genuinely
  // underway before an interruption counts.
  await wait(6200);
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

  console.log('\n— an interruption the system does send us still pauses and resumes —');
  played.pausedCount = 0;
  emit('loss');
  await wait(50);
  ok('a permanent loss later in the song does pause us', played.pausedCount === 1, 'pauses=' + played.pausedCount);
  const reqBefore = calls.request;
  setPlaying();
  await wait(1100);
  ok('a fresh start still leaves audio focus alone',
     calls.request === reqBefore && calls.request === 0, 'requests=' + calls.request + ' before=' + reqBefore);

  console.log('\n— a deliberate pause is honoured, and nothing is taken from anyone —');
  const abandonAtPause = calls.abandon;
  el.paused = false;                       // playing, so the button means "pause"
  win.document.getElementById('playPauseBtn').click();
  await wait(80);
  ok('the user pause stops the song', el.paused === true);
  ok('and it does not have to hand focus back to anyone',
     calls.abandon === abandonAtPause && calls.abandon === 0,
     'abandons=' + calls.abandon + ' before=' + abandonAtPause);

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
