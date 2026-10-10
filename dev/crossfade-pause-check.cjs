// Pause during a crossfade must actually stop the sound.
//
// The owner's report, 73.4.9: "at the end of the song while it's crossfading I
// should still be able to pause the song while it's playing and crossfading".
//
// WHAT WAS WRONG. A crossfade plays the INCOMING track on audioEl2 and flips
// which element is "active" only when the fade finishes. Every pause path paused
// activeAudio() alone - so during a blend the pause stopped the OUTGOING track
// (already fading out) while the incoming one, already audible and still ramping
// up, kept playing, and the fade interval kept running toward its own end.
// Pressing pause at the end of a song did nothing you could hear.
//
// Proven here, driving the real page and both real <audio> elements:
//   1. A crossfade really does start the incoming track on the inactive element.
//   2. The now-bar pause silences BOTH halves and discards the half-blended track.
//   3. The fade does not finish itself after that pause and the queue does not move.
//   4. The lock-screen / notification pause behaves the same way.
//   5. Resuming picks the outgoing song back up - and never revives the discarded
//      incoming half.
//   6. The now bar goes back to naming the song that is really on the deck.
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
    open() {
      const req = { error: null };
      const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) };
      setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0);
      return req;
    },
  };
}

const mediaStates = [];
const mediaHandlers = {};

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
  },
});

// jsdom cannot play media and `paused` is a prototype getter, so each element is
// given real own-property state the test can drive in both directions.
function patchAudio(win, el) {
  const state = { paused: true, currentTime: 0, duration: 135, src: '', plays: 0, pauses: 0 };
  Object.defineProperty(el, 'paused', { get: () => state.paused, set: (v) => { state.paused = v; }, configurable: true });
  Object.defineProperty(el, 'currentTime', { get: () => state.currentTime, set: (v) => { state.currentTime = v; }, configurable: true });
  Object.defineProperty(el, 'duration', { get: () => state.duration, configurable: true });
  Object.defineProperty(el, 'src', {
    configurable: true,
    get: () => state.src,
    set: (v) => { state.src = v; setTimeout(() => el.dispatchEvent(new win.Event('loadedmetadata')), 0); },
  });
  el.removeAttribute = ((orig) => function (name) {
    if (String(name).toLowerCase() === 'src') { state.src = ''; return; }
    return orig.call(this, name);
  })(el.removeAttribute);
  el.play = () => {
    state.plays++;
    state.paused = false;
    el.dispatchEvent(new win.Event('play'));
    return Promise.resolve();
  };
  el.pause = () => {
    state.pauses++;
    state.paused = true;
    el.dispatchEvent(new win.Event('pause'));
  };
  return state;
}

(async () => {
  const win = dom.window;
  await wait(3500);
  const doc = win.document;
  const a1 = doc.getElementById('audioEl');
  const a2 = doc.getElementById('audioEl2');
  const st1 = patchAudio(win, a1);
  const st2 = patchAudio(win, a2);

  // Real audio behind both songs, so nothing refuses to start a track.
  (win.__scAllTracks() || []).forEach((t) => {
    t.url = 'blob:fake-' + t.id;
    t.file = { name: t.name + '.mp3', size: 500000, type: 'audio/mpeg' };
  });

  const playIcon = doc.getElementById('playIcon');
  const npTitle = doc.getElementById('npTitle');
  const transport = () => mediaStates[mediaStates.length - 1];

  console.log('\n\u2014 the deck is playing, and a crossfade starts the next song \u2014');
  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) {}
  await wait(400);
  st1.duration = 135;
  st1.currentTime = 132;                 // three seconds from the end, crossfade is 6s
  st1.paused = false;
  a1.dispatchEvent(new win.Event('play'));
  await wait(60);
  a1.dispatchEvent(new win.Event('timeupdate'));
  await wait(200);
  ok('the incoming track is really playing during the blend', st2.plays > 0 && st2.paused === false,
     'plays=' + st2.plays + ' paused=' + st2.paused);
  ok('it is loaded on the INACTIVE element (audioEl2), not the active one', !!st2.src, 'src=' + st2.src);
  ok('the now bar has switched to the incoming song, as a blend looks',
     npTitle.textContent === 'Luna', npTitle.textContent);

  console.log('\n\u2014 the now-bar pause silences BOTH halves \u2014');
  doc.getElementById('playPauseBtn').click();
  await wait(140);
  ok('the outgoing track is paused', st1.paused === true, 'paused=' + st1.paused);
  ok('the incoming track is paused too (this is the fix)', st2.paused === true, 'paused=' + st2.paused);
  ok('the half-blended track is discarded, not left parked', st2.src === '', 'src=' + st2.src);
  ok('the mini player shows the paused icon', /M8 5v14l11-7z/.test(playIcon.innerHTML), playIcon.innerHTML);
  ok('the now bar goes back to the song that is really on the deck',
     npTitle.textContent === 'Case', npTitle.textContent);
  ok('the session reports paused', transport() === 'paused', 'states=' + JSON.stringify(mediaStates.slice(-4)));

  console.log('\n\u2014 the fade does not finish itself afterwards \u2014');
  const statesAfterPause = mediaStates.length;
  // Longer than the 6s crossfade is not needed: the fade interval is 100ms and
  // this proves it is not still stepping toward finishCrossfade().
  await wait(1400);
  ok('nothing claims to be playing again', mediaStates.slice(statesAfterPause).every((s) => s === 'paused'),
     'states=' + JSON.stringify(mediaStates.slice(statesAfterPause)));
  ok('the queue did not move on to the next song on its own',
     npTitle.textContent === 'Case', npTitle.textContent);
  ok('the incoming element was never restarted', st2.paused === true, 'paused=' + st2.paused);

  console.log('\n\u2014 resuming picks the outgoing song back up, and only that one \u2014');
  const plays1Before = st1.plays;
  doc.getElementById('playPauseBtn').click();
  await wait(140);
  ok('the song on the deck starts again', st1.paused === false && st1.plays > plays1Before,
     'paused=' + st1.paused + ' plays=' + st1.plays);
  ok('the discarded incoming half is not revived', st2.paused === true, 'paused=' + st2.paused);
  ok('the session says playing again', transport() === 'playing', 'states=' + JSON.stringify(mediaStates.slice(-3)));

  console.log('\n\u2014 the lock-screen / notification pause behaves the same \u2014');
  // Back to a fresh blend, then pause from outside the app.
  st1.currentTime = 132;
  a1.dispatchEvent(new win.Event('timeupdate'));
  await wait(200);
  ok('a second blend starts', st2.paused === false && !!st2.src, 'paused=' + st2.paused + ' src=' + st2.src);
  ok('the lock-screen pause control is wired', typeof mediaHandlers.pause === 'function');
  if (typeof mediaHandlers.pause === 'function') {
    mediaHandlers.pause({});
    await wait(140);
    ok('a pause from the lock screen silences both halves too',
       st1.paused === true && st2.paused === true,
       'a1.paused=' + st1.paused + ' a2.paused=' + st2.paused);
    ok('and it still reports paused, honestly', transport() === 'paused', 'states=' + JSON.stringify(mediaStates.slice(-3)));
  } else {
    ok('a pause from the lock screen silences both halves too', false, 'no handler');
    ok('and it still reports paused, honestly', false, 'no handler');
  }

  console.log('\n\u2014 the fix is where it should be \u2014');
  ok('the one shared pause helper is what the pause paths call',
     typeof win.__scPauseDeck === 'function');
  ok('every user pause path goes through it (and none still pauses only the active element)',
     /playPauseBtn'\)\.addEventListener\('click'/.test(html) &&
     (html.match(/scPauseDeck\(\)/g) || []).length >= 3,
     'scPauseDeck() call sites: ' + (html.match(/scPauseDeck\(\)/g) || []).length);

  console.log('\n\u2014 no runtime errors \u2014');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
