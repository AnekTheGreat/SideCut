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
//     to wake the radio every half hour around the clock. The audit proves a player
//     with nothing on the deck hands the session back, that the controls return the
//     moment anything plays again, and that the update poll refuses to run while the
//     app is hidden.
//
//  3. 73.4.6 - "if I go to another app that has audio but I want to play SideCut audio
//     again from the widget / now bar / control centre, I should be able to,
//     seamlessly, without going into the app." The grace period used to END by
//     dropping the session to 'none', which took SideCut off the lock screen, out of
//     the shade player and out of the now bar - so a paused song could only be
//     restarted by opening the app. The requirement CHANGED, and this gate moved with
//     it rather than being loosened: with a song on the deck the session is PARKED
//     (the entry and every control stay, the state says 'paused', and the heartbeat
//     and the wake lock are still given back), and with nothing on the deck it is
//     still released outright. Both are RUN below, as is the press from outside that
//     starts the parked song while the app stays in the background.
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
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186, blob: 1 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155, blob: 1 },
];

// The app only ever offers to bring a song back when its audio file is still on the
// device (`mediaResumableTrack` checks exactly that), so the fixture carries one -
// otherwise the park branch can never be reached and the audit would quietly prove
// nothing about it.
const TRACK_BLOB = { type: 'audio/mpeg', size: 8, marker: 'sidecut-audit' };

function fakeIndexedDB() {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map() };
  function tx(store) {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()).map((r) => (store === 'tracks' ? Object.assign({}, r, { blob: TRACK_BLOB }) : r)); q.onsuccess && q.onsuccess(); }, 0); return q; },
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
// The title on the phone's player / on the widget is how this audit can see WHICH
// song a press moved to - the harness has no other window onto the queue.
const mediaTitles = [];
const lastTitle = () => (mediaTitles.length ? mediaTitles[mediaTitles.length - 1] : '');

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
        if (plugin === 'MediaSession' && method === 'setMetadata' && opts) mediaTitles.push(String(opts.title));
        if (plugin === 'SideCutWidget' && method === 'update' && opts && opts.data) {
          try { mediaTitles.push(String((JSON.parse(opts.data) || {}).title || '')); } catch (e) {}
        }
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
  let paused = true, currentTime = 0, duration = 135, plays = 0, srcValue = '';
  els.forEach((a) => {
    Object.defineProperty(a, 'paused', { get: () => paused, set: (v) => { paused = v; }, configurable: true });
    Object.defineProperty(a, 'currentTime', { get: () => currentTime, set: (v) => { currentTime = v; }, configurable: true });
    Object.defineProperty(a, 'duration', { get: () => duration, configurable: true });
    // A shared playhead AND a shared src: an empty src is what a deck that came
    // back with nothing loaded on it looks like, which is the case the outside
    // press has to repair itself.
    Object.defineProperty(a, 'src', {
      configurable: true,
      get: () => srcValue,
      set: (v) => { srcValue = v; setTimeout(() => a.dispatchEvent(new win.Event('loadedmetadata')), 0); },
    });
    a.play = () => { plays++; paused = false; els.forEach((x) => x.dispatchEvent(new win.Event('play'))); return Promise.resolve(); };
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

  console.log('\n— with nothing on the deck the session is still given up —');
  // 73.4.6 keeps a PAUSED SONG reachable from outside the app (see the sections
  // below), but a player with no song on the deck has nothing to come back to, so it
  // must still hand the session and its service back instead of sitting there for a
  // song that does not exist. Nothing has played yet here, which is exactly that
  // state.
  win.__scMediaBgGraceMs = 300;
  mediaStates.length = 0;
  win.__setVisibility(true);
  await wait(700);
  ok('the session is released once it has been paused and away long enough',
     mediaStates.indexOf('none') !== -1, 'states=' + JSON.stringify(mediaStates));
  win.__setVisibility(false);
  await wait(150);

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
  const songDeep = lastTitle();
  webHandlers.previoustrack({});
  ok('deep into a song, "previous" restarts it', currentTime === 0, 'currentTime=' + currentTime);
  ok('and it is the same song it restarted', lastTitle() === songDeep,
     'now="' + lastTitle() + '" before="' + songDeep + '"');
  currentTime = 1.2;
  const songBefore = lastTitle();
  webHandlers.previoustrack({});
  // The intent of this rule is that "previous" in the opening seconds MOVES to the
  // previous song rather than jumping this one back to 0. The fixture now carries a
  // real audio file, so the advance actually happens - which means the playhead IS
  // allowed to reset (it is a different song on the deck now). What must hold is that
  // the SONG changed.
  ok('a second in, "previous" asks for the previous song instead of restarting this one',
     lastTitle() !== songBefore, 'now="' + lastTitle() + '" before="' + songBefore + '"');
  currentTime = 60;

  console.log('\n— a paused song stays pressable from outside the app —');
  win.__scMediaBgGraceMs = 300;              // ten minutes, compressed for the audit
  mediaStates.length = 0;
  const metaBefore = nativeCalls.filter((c) => c === 'MediaSession.setMetadata').length;
  paused = true;                             // the user paused, then left the app
  win.__setVisibility(true);
  await wait(700);
  ok('the session is kept, so there is something to press play on',
     mediaStates.indexOf('none') === -1, 'states=' + JSON.stringify(mediaStates));
  ok('and it is told the truth: the song is paused',
     mediaStates.indexOf('paused') !== -1, 'states=' + JSON.stringify(mediaStates));
  ok('with the song it would bring back named on it',
     nativeCalls.filter((c) => c === 'MediaSession.setMetadata').length > metaBefore);

  console.log('\n— a press from outside starts it again, without opening the app —');
  mediaStates.length = 0;
  const playsBefore = plays;
  const resumedBefore = win.__scWidgetResumed || 0;
  // The harder press, and the one the report was about: the deck came back EMPTY
  // (a reload, or audio the phone reclaimed while it was away). play() on an empty
  // element does nothing at all, so the press has to put the song back itself - and
  // the app stays in the background the whole time. That is the point of the change.
  srcValue = '';
  currentTime = 42;
  webHandlers.play({});
  await wait(400);
  ok('the song is put back on the empty deck and starts', paused === false && plays > playsBefore,
     'paused=' + paused + ' plays=' + plays);
  ok('through the restore path, not by play() on an element with nothing on it',
     (win.__scWidgetResumed || 0) > resumedBefore, 'resumed=' + win.__scWidgetResumed);
  ok('and the phone is told it is playing', mediaStates.indexOf('playing') !== -1,
     'states=' + JSON.stringify(mediaStates));
  ok('with the app still in the background', !!win.document.hidden);

  console.log('\n— the park is cheap, and the release is still real —');
  const arm = (html.match(/function armMediaRelease\(\)\{[\s\S]*?\n  \}/) || [''])[0];
  const stopAt = arm.indexOf('stopMediaSessionHeartbeat();');
  const decideAt = arm.indexOf('const back = mediaResumableTrack();');
  const noneAt = arm.indexOf("mediaSetPlaybackState('none')");
  ok('the heartbeat stops before the park/release decision, so neither branch leaves it running',
     stopAt !== -1 && decideAt !== -1 && stopAt < decideAt);
  ok('and the wake lock is handed back the same way',
     arm.indexOf('releaseWakeLock();') !== -1 && arm.indexOf('releaseWakeLock();') < decideAt);
  ok('the session is only taken down when no song can come back',
     decideAt !== -1 && noneAt !== -1 && decideAt < noneAt);
  ok('the parked branch keeps the entry and tells the phone the song is paused',
     /mediaParkedInBackground = true;/.test(arm) && /mediaSetPlaybackState\('paused'\)/.test(arm));
  ok('a press from outside also repairs a deck that came back empty',
     /if\(!_pa\.src\)\{/.test(html) && html.indexOf('if(scResumeRestoredSong()) return;') !== -1);

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

  console.log('\n— the phone files the playback card as media, not as an alert —');
  // 73.4.6 - the surfaces the owner named (the Android ones: the lock screen, the
  // quick-settings/control-centre player, Samsung's now bar, the shade player) all
  // read a MEDIA notification, and the card only counts as one when the system can
  // tell what it is. The category, the single alert and the immediate foreground
  // behaviour are patched into the plugin in CI (.github/workflows/patch-mediaplugin.py,
  // run right before the Gradle build), so the gate pins the patch - and pins the
  // library code the patch lands on, because that is what CI can only check by
  // running.
  const mediaPy = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-mediaplugin.py'), 'utf8');
  ok('the notification is tagged as a transport (media) notification',
     mediaPy.indexOf('setCategory(NotificationCompat.CATEGORY_TRANSPORT)') !== -1);
  ok('it alerts once per song instead of once per refresh',
     mediaPy.indexOf('setOnlyAlertOnce(true)') !== -1);
  ok('and the card appears immediately when playback starts',
     mediaPy.indexOf('setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)') !== -1);
  ok('with the platform rule that media cannot use Android 16 live updates recorded where the patch lives',
     /NOT available to media, by platform rule/.test(mediaPy));
  const LIB = path.join(ROOT, 'node_modules', '@jofr', 'capacitor-media-session', 'android', 'src', 'main', 'java', 'io', 'github', 'jofr', 'capacitor', 'mediasessionplugin');
  const svcPath = path.join(LIB, 'MediaSessionService.java');
  const plugPath = path.join(LIB, 'MediaSessionPlugin.java');
  if (fs.existsSync(svcPath) && fs.existsSync(plugPath)) {
    const svc = fs.readFileSync(svcPath, 'utf8');
    const plug = fs.readFileSync(plugPath, 'utf8');
    // Either state is correct: a fresh `npm install` has the untouched builder CI
    // patches, and a tree where the patcher has already run has the patched one.
    ok('and the builder the patch targets is there (untouched, or already patched)',
       svc.indexOf('.setVisibility(NotificationCompat.VISIBILITY_PUBLIC);') !== -1
       || svc.indexOf('setCategory(NotificationCompat.CATEGORY_TRANSPORT)') !== -1);
    ok('the card is built as a MediaStyle notification bound to the session token',
       /MediaStyle\(\)\.setMediaSession\(mediaSession\.getSessionToken\(\)\)/.test(svc));
    ok('tapping the card / now bar opens the app (a content intent is set)',
       /setContentIntent\(PendingIntent\.getActivity/.test(svc));
    ok('and the compact (lock screen) row carries the actions the app registered',
       svc.indexOf('notificationStyle.setShowActionsInCompactView(') !== -1);
    // The native half of the park/release design: the web layer deciding 'paused'
    // is what makes the phone keep a resumable session.
    ok('the native session keeps STATE_PAUSED for a paused song, which is what the park relies on',
       /else if \(playbackState\.equals\("paused"\)\) \{\s*service\.setPlaybackState\(PlaybackStateCompat\.STATE_PAUSED\);/.test(plug));
    ok('and drops to STATE_NONE only when the web layer releases the session',
       /else \{\s*service\.setPlaybackState\(PlaybackStateCompat\.STATE_NONE\);/.test(plug));
  } else {
    console.log('  (note) node_modules media plugin is not installed here - the native pins could not run');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  const realErrors = errors.filter((e) => !/dbPromise|offline|no network|Not implemented/i.test(e));
  if (realErrors.length) { console.log('page errors:'); realErrors.slice(0, 8).forEach((e) => console.log('  ' + e)); }
  process.exit(fail ? 1 : 0);
})();
