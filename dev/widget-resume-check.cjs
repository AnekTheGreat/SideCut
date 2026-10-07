#!/usr/bin/env node
// 73.4.2 - a tap on the home-screen widget picks the last song back up.
//
// The owner's words: "Also the widgit If I'm not in the app I should be able to
// click on it to resume a song that was previously playing". The widget cannot
// play anything itself - the sound comes out of the WebView - so the press has to
// travel: the widget leaves a resume request in its own prefs and opens the app,
// and the web layer reads the request and presses play on the song the boot
// restore already put on the deck, at the position it was left at.
//
// Nothing here can run Android, so this gate does the two things that ARE
// checkable: it pins the injection contract in .github/workflows/patch-widget.py
// (the plugin method, the tap paths, the "only when nothing is playing" rule) and
// it RUNS the shipped web path in jsdom with a stubbed bridge - a real boot, a
// real restore from a saved playback row, and a real play() on the resumed song.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const py = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-widget.py'), 'utf8');

let pass = 0, fail = 0;
// (condition first, then the label - the order every call below uses.)
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  [' + extra + ']' : '')); }
};

console.log('[1] the widget leaves a resume request and opens the app');
ok(/public void getPendingResume\(PluginCall call\)/.test(py), 'the plugin exposes getPendingResume');
ok(py.includes('boolean resume = sp.getBoolean("pendingResume", false);')
  && py.includes('if (resume) sp.edit().remove("pendingResume").apply();'),
  'and it hands the request over exactly once');
ok(/static void askResume\(Context ctx\)/.test(py) && py.includes('putBoolean("pendingResume", true)'),
  'the provider can leave the request');
ok(/static boolean musicActive\(Context ctx\)/.test(py) && py.includes('am.isMusicActive()'),
  'the phone own audio state is what decides whether anything is playing');
ok(py.includes('if (!musicActive(context)) askResume(context);'),
  'a tap on the widget body resumes only when nothing is playing');
ok(py.includes('// press that opens the app is the press that starts the song.')
  && py.includes('askResume(context);\n                    openApp(context);'),
  'and the play button that opens the app asks for the resume too');
ok(/static void openApp\(Context ctx\)/.test(py) && py.includes('Intent.FLAG_ACTIVITY_NEW_TASK'),
  'the launch goes through one helper that carries NEW_TASK');
ok(!/if \(i != null\) context\.startActivity\(i\);/.test(py),
  'and no bare startActivity is left on the tap path');
// The templates are %-formatted with APP_ID: a literal % would break the build.
const rendered = spawnSync('python3', ['-c', 'import importlib.util,sys;'
  + "spec=importlib.util.spec_from_file_location('pw','.github/workflows/patch-widget.py');"
  + 'm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);'
  + "assert 'getPendingResume' in m.PLUGIN_JAVA and 'askResume' in m.PROVIDER_JAVA"
  + " and 'pendingResume' in m.PROVIDER_JAVA and 'musicActive' in m.PROVIDER_JAVA"
  + " and '%}' not in m.PROVIDER_JAVA"], { encoding: 'utf8' });
ok(rendered.status === 0, 'both Java templates still render with the resume wiring', (rendered.stderr || '').slice(0, 120));

console.log('[2] the app reads the request and presses play');
ok(src.includes('function scWidgetResumeCheck(){') && src.includes('function scResumeRestoredSong(){'),
  'the shipped resume path exists');
ok(src.includes('scWidgetResumeCheck();\n      }catch(e){}\n    }, 10000);'),
  'the existing widget poll asks for a request');
ok(src.includes("setTimeout(function(){ try{ scWidgetResumeCheck(); }catch(_eWr){} }, 700);"),
  'boot asks once right after the playback restore');
ok(src.includes("setTimeout(function(){ scWidgetResumeCheck(); }, 1200);"),
  'and coming back to the foreground asks again (a warm app never re-runs boot)');
ok(src.includes('if(!activeAudio().paused) return;'),
  'a request is never read while a song is already playing');
ok(src.includes('getPendingResume') && src.includes("nativePromise('SideCutWidget', 'getPendingResume', {})"),
  'both bridge shapes are used, like the playlist poll');
ok(src.includes('if(a.duration && a.currentTime >= a.duration - 0.5) a.currentTime = 0;'),
  'a song that had already finished starts over instead of ending on the first tick');
ok(src.includes('userPaused = false;'), 'and the press clears an earlier manual pause');
ok(src.includes('Tapping the widget - or its play button - picks the song you were last playing back up where you left it.'),
  'the Widget settings tab says what a tap does');

// ---------------------------------------------------------------- the jsdom run
const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 135, blob: 1 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155, blob: 1 },
];
// The saved session the boot restore reads: the second song, 42 seconds in.
const SAVED = { queue: ['t1', 't2'], queueIndex: 1, trackId: 't2', currentTime: 42, shuffle: false, repeatMode: 'off', sourcePlaylist: 'All Songs', isMixMode: false };

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

function boot({ resumeOnce }) {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    // The app reads meta rows as { key, value } - the saved session is one row.
    meta: new Map([['playback', { key: 'playback', value: SAVED }]]),
  };
  const state = { resumeCalls: 0, asks: 0, mediaStates: [], bridge: [] };
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m); });

  const dom = new JSDOM(src, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      let hidden = false, visState = 'visible';
      Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(win.document, 'visibilityState', { configurable: true, get: () => visState });
      win.__setVisibility = (h) => {
        hidden = h; visState = h ? 'hidden' : 'visible';
        win.document.dispatchEvent(new win.Event('visibilitychange'));
      };
      const trackBlob = new win.Blob([new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3, 4, 5])], { type: 'audio/mpeg' });
      function tx(store) {
        const t = { oncomplete: null, onerror: null, onabort: null, error: null };
        const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
        t.objectStore = () => ({
          put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
          get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
          getAll() {
            const q = {};
            setTimeout(() => {
              q.result = Array.from(data[store].values()).map((r) => (store === 'tracks' ? Object.assign({}, r, { blob: trackBlob }) : r));
              q.onsuccess && q.onsuccess();
            }, 0);
            return q;
          },
          delete(k) { data[store].delete(k); fire(); return {}; },
        });
        return t;
      }
      win.indexedDB = {
        open() {
          const req = { error: null };
          const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) };
          setTimeout(() => {
            try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
            req.result = db;
            try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
          }, 0);
          return req;
        },
      };
      win.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        nativePromise: (plugin, method, opts) => {
          state.bridge.push(plugin + '.' + method);
          if (plugin === 'SideCutWidget' && method === 'getPendingResume') {
            state.resumeCalls++;
            const grant = resumeOnce && state.resumeCalls === 1;
            return Promise.resolve({ resume: !!grant });
          }
          if (plugin === 'SideCutWidget' && method === 'update') state.asks++;
          if (plugin === 'MediaSession' && method === 'setPlaybackState' && opts && opts.playbackState) {
            state.mediaStates.push(String(opts.playbackState));
          }
          return Promise.resolve({});
        },
        nativeCallback: () => Promise.resolve(),
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

  const win = dom.window;
  // The app alternates between two <audio> elements; the audit stubs both and
  // drives whichever is live (same shapes dev/media-controls-check.cjs uses).
  const els = [win.document.getElementById('audioEl'), win.document.getElementById('audioEl2')].filter(Boolean);
  const audio = { paused: true, currentTime: 0, duration: 135, plays: 0 };
  els.forEach((a) => {
    Object.defineProperty(a, 'paused', { get: () => audio.paused, set: (v) => { audio.paused = v; }, configurable: true });
    Object.defineProperty(a, 'currentTime', { get: () => audio.currentTime, set: (v) => { audio.currentTime = v; }, configurable: true });
    Object.defineProperty(a, 'duration', { get: () => audio.duration, configurable: true });
    let srcValue = '';
    Object.defineProperty(a, 'src', {
      configurable: true,
      get: () => srcValue,
      set: (v) => { srcValue = v; setTimeout(() => a.dispatchEvent(new win.Event('loadedmetadata')), 0); },
    });
    a.play = () => { audio.plays++; audio.paused = false; els.forEach((x) => x.dispatchEvent(new win.Event('play'))); return Promise.resolve(); };
    a.pause = () => { audio.paused = true; els.forEach((x) => x.dispatchEvent(new win.Event('pause'))); };
  });
  return { win, state, audio, errors };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('\n[3] a real boot with a request waiting RESUMES the song');
  const A = boot({ resumeOnce: true });
  await wait(4500);
  const elA = A.win.document.getElementById('audioEl');
  await A.win.__scWidgetResumeCheck();
  await wait(400);
  ok(A.state.resumeCalls > 0, 'the app asked the widget for a request (' + A.state.resumeCalls + ' call(s))');
  ok(A.win.__scWidgetResumed === 1, 'and resumed exactly once (' + A.win.__scWidgetResumed + ')');
  ok(A.audio.paused === false && A.audio.plays > 0, 'the song is playing (play() called ' + A.audio.plays + 'x)');
  ok(Math.abs(A.audio.currentTime - 42) < 0.01,
    'from the position it was left at, not the top (' + A.audio.currentTime.toFixed(2) + 's, saved 42s)');
  ok(elA.src.indexOf('blob:') === 0, 'on the restored song itself, the deck the restore filled');
  // The outside-the-app surfaces (lock screen, quick-settings player, notification)
  // all read the media session, and it only exists while the app is PLAYING - so a
  // resume has to hand it the state as well.
  ok(A.state.mediaStates.indexOf('playing') !== -1,
    'and the phone media session is told the song is playing (' + (A.state.mediaStates.join(',') || 'nothing sent') + ')');
  ok(!A.win.userPaused, 'with a manual pause from earlier cleared');
  // One press, one request: the poll must not fire a second resume.
  await A.win.__scWidgetResumeCheck();
  await wait(250);
  ok(A.win.__scWidgetResumed === 1, 'a second poll does not resume again (' + A.win.__scWidgetResumed + ')');
  ok(A.errors.length === 0, 'and the boot raised no jsdom error', A.errors.slice(0, 2).join(' | '));
  A.win.close();

  console.log('\n[4] without a request the app is left exactly where it was');
  const B = boot({ resumeOnce: false });
  await wait(4500);
  const elB = B.win.document.getElementById('audioEl');
  await B.win.__scWidgetResumeCheck();
  await wait(400);
  ok(B.state.resumeCalls > 0, 'the request was still asked for');
  ok(B.win.__scWidgetResumed === undefined, 'and nothing was resumed (' + B.win.__scWidgetResumed + ')');
  ok(B.audio.plays === 0 && B.audio.paused === true, 'the restored song stays paused, waiting for a tap');
  ok(elB.src.indexOf('blob:') === 0, 'though the song IS restored on the deck (the old cue path)');
  ok(elB.classList.contains('pulse-cue') || B.win.document.getElementById('playPauseBtn').classList.contains('pulse-cue'),
    'with the play button still cueing, exactly as before this release');
  ok(B.errors.length === 0, 'and no jsdom error there either', B.errors.slice(0, 2).join(' | '));
  B.win.close();
  void elA;

  console.log('');
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
  process.exit(fail ? 1 : 0);
})();
