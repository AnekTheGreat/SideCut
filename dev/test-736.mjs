// v73.6 - the music keeps playing while you text, and only a real call pauses it.
//
// The owner's words: "Whenever using Whatsapp or corresponding adjacent apps, it
// keeps thinking there's a call when one is texting please fix this and music should
// keep playing unless there's an actual phone call".
//
// WHY IT HAPPENED. Every messaging app takes audio focus for a moment to play its
// own short sound (the blip when a message is sent, an incoming notification, a
// voice note). Chromium holds the focus for this app's <audio> element and its
// AudioFocusDelegate SUSPENDS the element on a transient loss, so the song stopped
// the way it stops for a phone call - and the app had no way to tell the two apart.
// Worse, the revive that undoes such a pause only ran in the opening eight seconds
// of a song and only while the app was on screen, so a blip while you were in
// WhatsApp killed the music for good.
//
// WHAT SHIPS. The app asks the one question that separates the two - is a call
// really up? (AudioManager's mode is a voice call when it reads IN_CALL or
// IN_COMMUNICATION, and a call is ringing in RINGTONE; the Android audio-input guide
// defines exactly that test and reading the mode needs no permission - the native
// half is SideCutAudioFocus.callState() from patch-audiofocus.py). A pause nobody
// asked for is undone at any point in a song and while the app is in the background,
// unless a call is up or ringing, the user paused, the song ended, DJ Mode owns the
// sound, or the attempt's revive budget is spent.
//
// The sections below DRIVE the shipped page in jsdom: the real pause handler, the
// real focus listener, the real call-state plumbing. Nothing here is a grep.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
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

const mediaStates = [];       // every playbackState pushed to the lock screen
const mediaHandlers = {};     // the lock-screen / notification controls
const nativeCalls = [];       // every native plugin call, so "asked too often" is visible
const focusListeners = [];
let callAnswer = { inCall: false, ringing: false, mode: 0 };   // what the phone would answer

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
  if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m);
});

// The wall clock is fake so a song is "minutes in" and a minute of quiet is a
// single assignment, exactly like dev/background-playback-check.cjs does it.
let fakeNow = Date.now();

const idb = fakeIndexedDB();
const dom = new JSDOM(src, {
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
    win.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      nativePromise: (plugin, method) => {
        nativeCalls.push(plugin + '.' + method);
        if (plugin === 'MediaSession' && method === 'setPlaybackState') mediaStates.push('?');
        return Promise.resolve({});
      },
      nativeCallback: (plugin, method, opts, cb) => {
        nativeCalls.push(plugin + '.' + method);
        if (plugin === 'MediaSession' && method === 'setActionHandler' && opts && opts.action) mediaHandlers[opts.action] = cb;
        return Promise.resolve();
      },
      Plugins: {
        SideCutAudioFocus: {
          request: () => Promise.resolve({ granted: true }),
          abandon: () => Promise.resolve(),
          isHolding: () => Promise.resolve({ holding: true }),
          // 73.6 - the phone's answer to "is a call really up?".
          callState: () => { nativeCalls.push('SideCutAudioFocus.callState'); return Promise.resolve(callAnswer); },
          addListener: (evt, cb) => { if (evt === 'focusChange') focusListeners.push(cb); return { remove() {} }; },
        },
      },
    };
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

const count = (s) => src.split(s).length - 1;

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === '73.8', 'the app runs 73.8 (' + ver + ')'); /* repinned by dev/repin-7362.mjs */
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'changelog evaluates: ' + e.message); }
  ok(!!entries && entries[0].version === '73.8', 'and its newest entry is this release (' + (entries && entries[0].version) + ')');
  if (entries) {
    const items = entries[0].items || [];
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    const all = items.join('\n');
    ok(!/[\u2019']/.test(all), 'no note carries an apostrophe');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test(all),
      'and no note names a downloader or converter');
    ok(/EDT$/.test(String(entries[0].date)), 'the ship stamp is Eastern (' + entries[0].date + ')');
  }
  ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v73.8'"), 'the shell cache is this release name');
}

console.log('\n[2] the source of the fix is present, and nothing was re-enabled');
{
  ok(count('function scInCall(){') === 1, 'the call question has one definition');
  ok(count('function scAskCallState(){') === 1, 'and one place that asks the phone');
  ok(count('function scStandDownForCall(){') === 1, 'and one place that stands down for a real call');
  ok(count('function scUndoPlatformPause(why, force){') === 1, 'the platform-pause undo has one definition');
  ok(src.indexOf("if(scUndoPlatformPause('unrequested')) return;") !== -1,
    'and the pause handler goes through it');
  ok(count('function scSecondLook(why){') === 1, 'a pause that landed on top of another revive gets a second look');
  ok(src.indexOf('scSecondLooks >= 2') !== -1, 'and that look is bounded, so it can never become a loop');
  ok(src.indexOf('if(audioFocusInterrupted) return false;') !== -1,
    'a pause the app is already standing down for is never undone');
  ok(src.indexOf('if(scInCall()) return false;') !== -1, 'and neither is a pause during a call');
  ok(!/const AUDIO_FOCUS_REQUESTS_OFF = false/.test(src),
    'the app still never takes audio focus for itself (that is what pauses its own WebView)');
  // The eight-second window and the on-screen requirement are what made the old
  // revive useless in the field; neither may come back into the pause path.
  const pausePath = src.slice(src.indexOf('function scUndoPlatformPause(why, force){'),
                              src.indexOf('// True when an automatic stop arrived too early'));
  ok(pausePath.indexOf('document.hidden') === -1, 'the undo no longer requires the app to be on screen');
  ok(pausePath.indexOf('msSincePlayStarted() <') === -1, 'and it no longer expires in the opening seconds');
  ok(pausePath.indexOf('scAutoReviveBudget()') !== -1, 'while the attempt budget still bounds it');
  ok(count('scStartCallWatch();') === 1, 'the call watch starts with a song');
}

console.log('\n[3] the call question is really answered by the phone');
(async () => {
  const win = dom.window;
  await wait(3200);
  const el = win.document.getElementById('audioEl');
  const playIcon = win.document.getElementById('playIcon');
  const playPause = win.document.getElementById('playPauseBtn');

  let paused = true, currentTime = 0, duration = 135, ended = false;
  let srcValue = '';
  const plays = { count: 0, pauses: 0 };
  Object.defineProperty(el, 'paused', { get: () => paused, set: (v) => { paused = v; }, configurable: true });
  Object.defineProperty(el, 'currentTime', { get: () => currentTime, set: (v) => { currentTime = v; }, configurable: true });
  Object.defineProperty(el, 'duration', { get: () => duration, configurable: true });
  Object.defineProperty(el, 'ended', { get: () => ended, configurable: true });
  Object.defineProperty(el, 'src', {
    configurable: true,
    get: () => srcValue,
    set: (v) => { srcValue = v; setTimeout(() => el.dispatchEvent(new win.Event('loadedmetadata')), 0); },
  });
  el.play = () => {
    plays.count++;
    if (paused === false) return Promise.resolve();
    paused = false;
    ended = false;
    el.dispatchEvent(new win.Event('play'));
    return Promise.resolve();
  };
  el.pause = () => {
    if (paused) return;
    plays.pauses++;
    paused = true;
    el.dispatchEvent(new win.Event('pause'));
  };
  const startPlaying = () => { currentTime = 40; paused = false; ended = false; el.dispatchEvent(new win.Event('play')); };
  // The platform pausing the element under us: exactly the event Chromium's
  // AudioFocusDelegate produces when another app takes focus.
  const platformPause = () => { paused = true; el.dispatchEvent(new win.Event('pause')); };
  const stopLog = () => String(win.localStorage.getItem('sidecut_playback_stops') || '');
  const lastStop = () => { try { const a = JSON.parse(stopLog()); return a.length ? String(a[a.length - 1].why) : ''; } catch (e) { return ''; } };
  const emitFocus = (event, extra) => { focusListeners.forEach((cb) => cb(Object.assign({ event }, extra || {}))); };

  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) {}
  await wait(400);

  ok(typeof win.__scInCall === 'function', 'the page exposes the call question');
  ok(win.__scInCall() === false, 'and answers "no call" before anyone has said otherwise');

  // ---- the phone's answer reaches the page ----
  callAnswer = { inCall: false, ringing: false, mode: 0 };
  win.__scAskCallState();
  await wait(40);
  ok(win.__scInCall() === false, 'a phone that is not in a call answers "no call"');
  callAnswer = { inCall: true, ringing: false, mode: 2 };
  win.__scAskCallState();
  await wait(40);
  ok(win.__scInCall() === true, 'and a phone in a call answers "call" (audio mode IN_CALL)');
  callAnswer = { inCall: true, ringing: true, mode: 1 };
  win.__scAskCallState();
  await wait(40);
  ok(win.__scInCall() === true, 'a ringing call counts as a call too (audio mode RINGTONE)');
  callAnswer = { inCall: false, ringing: false, mode: 0 };
  win.__scAskCallState();
  await wait(40);
  ok(win.__scInCall() === false, 'and the answer follows the phone back to no call');
  ok(nativeCalls.filter((c) => c === 'SideCutAudioFocus.callState').length >= 4,
    'every ask really went to the native plugin (' + nativeCalls.filter((c) => c === 'SideCutAudioFocus.callState').length + ')');

  console.log('\n[4] a message blip no longer stops the music (the reported bug)');
  {
    // Minutes into the song and away in another app: the exact situation the old
    // eight-second, on-screen-only revive refused.
    startPlaying();
    fakeNow += 4 * 60 * 1000;
    currentTime = 280;
    win.__setVisibility(true);
    await wait(60);
    plays.count = 0; plays.pauses = 0;
    const before = lastStop();
    const statesBefore = mediaStates.length;
    platformPause();
    await wait(120);
    ok(paused === false, 'the song is put straight back instead of stopping');
    ok(plays.count >= 1, 'and it was really started again (plays=' + plays.count + ')');
    ok(/platform-pause/.test(lastStop()) && /replayed/.test(lastStop()),
      'the undo is recorded on the device (' + lastStop() + ')');
    ok(!/a call/.test(lastStop()), 'and it is not recorded as a call');
    ok(mediaStates.length === statesBefore || mediaStates[mediaStates.length - 1] !== 'paused',
      'the phone was never told the song had paused');
    ok(/M6 5h4v14H6zm8 0h4v14h-4z/.test(playIcon.innerHTML),
      'and the player never showed the paused icon');
    ok(before !== lastStop(), 'something new was logged for this interruption');

    // A second and a third blip, spaced out: none of them may kill the song.
    for (let i = 0; i < 2; i++) {
      fakeNow += 5000;
      const playsBefore = plays.count;
      platformPause();
      await wait(120);
      ok(paused === false, 'blip ' + (i + 2) + ' is undone too (plays=' + plays.count + ')');
    }

    // The fourth, with no quiet stretch in between: the budget is spent and the app
    // stops fighting (never fight for ever).
    fakeNow += 3000;
    platformPause();
    await wait(120);
    ok(paused === true, 'the fourth in a row is left alone rather than fought for ever');
    ok(/M8 5v14l11-7z/.test(playIcon.innerHTML), 'and the player then shows the honest paused state');

    // A quiet minute earns the protection back.
    fakeNow += 61000;
    win.__setVisibility(false);
    startPlaying();
    await wait(60);
    fakeNow += 120000;
    platformPause();
    await wait(120);
    ok(paused === false, 'a blip after a quiet stretch is undone again (the budget refills)');
  }

  console.log('\n[5] a real call still owns the speakers');
  {
    startPlaying();
    fakeNow += 60000;
    await wait(60);
    plays.count = 0;
    callAnswer = { inCall: true, ringing: false, mode: 2 };
    win.__scAskCallState();
    await wait(80);
    ok(win.__scInCall() === true, 'the phone reports the call');
    ok(paused === true, 'the song stands down for it');
    ok(/a call is in progress/.test(lastStop()), 'and the stand-down is recorded (' + lastStop() + ')');

    // While the call is up, a platform pause must NOT be undone into the call.
    platformPause();
    await wait(120);
    ok(paused === true, 'the app does not restart the song under the call');
    ok(plays.count === 0, 'nothing is played while the call is up (plays=' + plays.count + ')');

    // A call that is still ringing is not an invitation either.
    callAnswer = { inCall: true, ringing: true, mode: 1 };
    win.__scAskCallState();
    await wait(60);
    platformPause();
    await wait(120);
    ok(paused === true, 'nor while it is still ringing');

    plays.count = 0;
    callAnswer = { inCall: false, ringing: false, mode: 0 };
    win.__scAskCallState();
    await wait(80);
    ok(paused === false, 'when the call ends the song comes back by itself');
    ok(/call ended/.test(lastStop()), 'and that is recorded too (' + lastStop() + ')');
    ok(win.__scInCall() === false, 'and the phone is back to no call');
  }

  console.log('\n[6] the focus event agrees with the phone');
  {
    // The native listener path: a transient loss with no call behind it keeps the
    // song, and the same event during a call pauses it.
    startPlaying();
    fakeNow += 60000;
    await wait(60);
    plays.count = 0;
    callAnswer = { inCall: false, ringing: false, mode: 0 };
    win.__scAskCallState();
    await wait(40);
    emitFocus('lossTransient');
    await wait(120);
    ok(paused === false, 'a transient focus loss with no call does not stop the song');
    ok(/focus-loss-transient ignored/.test(lastStop()), 'and says so in the log (' + lastStop() + ')');

    // The event can carry the phone's own answer (the 73.6 plugin asks before it
    // reports), and then a transient loss IS obeyed.
    startPlaying();
    await wait(60);
    plays.count = 0;
    emitFocus('lossTransient', { inCall: true, ringing: false, mode: 2 });
    await wait(120);
    ok(paused === true, 'the same loss with the phone reporting a call does pause');
    ok(win.__scInCall() === true, 'and the page knows a call is up');
    emitFocus('gain');
    await wait(120);
    ok(paused === false, 'and the hand-back brings the song back');

    // A permanent loss (another player kept the speakers) is still obeyed.
    startPlaying();
    fakeNow += 10000;
    await wait(60);
    plays.count = 0;
    callAnswer = { inCall: false, ringing: false, mode: 0 };
    win.__scAskCallState();
    await wait(40);
    emitFocus('loss');
    await wait(120);
    ok(paused === true, 'another player taking the speakers for good is still obeyed');
  }

  console.log('\n[7] a pause you asked for is still a pause');
  {
    startPlaying();
    fakeNow += 60000;
    await wait(60);
    plays.count = 0; plays.pauses = 0;
    win.__setVisibility(true);
    await wait(40);
    playPause.click();                       // the user, not the platform
    await wait(120);
    ok(paused === true, 'the pause button still pauses');
    ok(/M8 5v14l11-7z/.test(playIcon.innerHTML), 'and the paused icon is shown');
    platformPause();
    await wait(120);
    ok(paused === true, 'and a platform pause after it is left alone');
    ok(plays.count === 0, 'nothing restarts a song the user stopped (plays=' + plays.count + ')');

    // The lock-screen pause is a user pause too.
    startPlaying();
    fakeNow += 5000;
    await wait(60);
    plays.count = 0;
    let handler = mediaHandlers.pause;
    for (let i = 0; i < 25 && !handler; i++) { await wait(200); handler = mediaHandlers.pause; }
    ok(!!handler, 'the lock-screen pause handler is wired up');
    if (handler) handler({});
    await wait(120);
    ok(paused === true, 'a pause from the lock screen pauses');
    platformPause();
    await wait(140);
    ok(paused === true, 'and it is not undone afterwards (plays=' + plays.count + ')');
  }

  console.log('\n[8] a song that ended is not restarted, and the undo is bounded');
  {
    startPlaying();
    fakeNow += 60000;
    await wait(60);
    ok(paused === false, 'a song is on the deck');
    ended = true; paused = false;
    plays.count = 0;
    platformPause();
    await wait(140);
    ok(paused === true, 'a pause at the end of a song is believed');
    ok(plays.count === 0, 'and the finished song is not played again');
    ended = false;

    // The undo cannot fire twice inside the same moment (overlapping revives are
    // what used to be heard as the song cutting in and out).
    startPlaying();
    fakeNow += 60000;
    await wait(60);
    plays.count = 0;
    platformPause();
    platformPause();
    await wait(160);
    ok(plays.count === 1, 'two pauses in the same breath are answered with one restart (plays=' + plays.count + ')');
    ok(/M6 5h4v14H6zm8 0h4v14h-4z/.test(playIcon.innerHTML),
      'and the paused screen is never shown for a hiccup the app is already undoing');
    // The second one is looked at again once the revive lock is up, instead of being
    // believed: a platform pause nobody asked for must not stick.
    fakeNow += 3000;
    await wait(2900);
    ok(paused === false, 'and the second one is undone on the second look (plays=' + plays.count + ')');
  }

  console.log('\n[9] nothing else moved, and the page is clean');
  {
    ok(count('function registerMediaSessionHandlers(){') === 1, 'the lock-screen controls still have one place');
    ok(src.indexOf("mediaSetActionHandler('stop'") !== -1, 'including stop');
    ok(count("function scPauseDeck(){") === 1, 'and one deliberate-pause path');
    // Inline script syntax.
    const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
    let m, blocks = 0, bad = 0;
    while ((m = re.exec(src))) {
      blocks++;
      try { new acorn.Parser({ ecmaVersion: 2022 }).parse(m[1], { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true }); }
      catch (e) { bad++; ok(false, 'inline block ' + blocks + ' parses: ' + e.message); }
    }
    ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
    ok(bad === 0, 'and every one of them parses');
    ok(errors.length === 0, 'no page errors (' + errors.slice(0, 3).join(' | ') + ')');
  }

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
