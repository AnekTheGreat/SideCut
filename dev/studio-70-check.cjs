// 70.0, driven for real. The user's request, in one message:
//
//   "A new tab in the app: Studio tab: one home for the creative tools, with crop,
//    slowed + reverb, karaoke mode, sampler pads and loop recorder... Achievements
//    and streaks... Storage cleaner... Crop -> share as clip... Assistant that
//    acts, not just answers... Auto-DJ / beat-matched crossfade... Batch tag
//    editor... Make the 3 dots menu for songs nicer too."
//
// This boots the REAL app in jsdom with a synthetic AudioContext and drives what
// the release actually does:
//
//   [1] the dock: the Studio tab switches the view, and the dock/player/dock
//       stacking is what the stylesheet says it is;
//   [2] the Studio view renders its five tools, its badge grid, its storage rows
//       and its two gesture switches;
//   [3] the live FX chain is built into the app's own graph - a dry path, a
//       reverb send and a vocal-cancel path per deck - and the fader moves them;
//   [4] the BPM reader finds 120 BPM in a synthetic 120 BPM click track, which is
//       what the beat-matched crossfade is built on;
//   [5] achievements unlock from the real stats, once, and never twice;
//   [6] the storage cleaner ranks the biggest songs correctly and a re-encode
//       swaps the stored file for a smaller one with a working undo;
//   [7] the batch tag editor writes to the SONGS, and __scWriteTagsToFile really
//       rewrites the ID3 tag inside the stored bytes;
//   [8] the assistant acts: a theme request switches the theme, a playlist request
//       builds the playlist, and a crop request opens Studio with the range armed;
//   [9] the grouped song menu moves the real buttons into labelled sections;
//   [10] gestures: a shake and a swipe both reach the app's own next/prev.
//
//   node dev/studio-70-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = process.env.SC_ROOT || path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
// (condition, name) - the other probe files read (name, condition), which is a
// trap for a file written top-down like this one, so the order is stated here.
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  + ' + name); }
  else { fail++; console.log('  X ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------- fake audio */
function fakeBuffer(ch, len, sr) {
  const data = [];
  for (let i = 0; i < ch; i++) data.push(new Float32Array(len));
  return {
    numberOfChannels: ch,
    length: len,
    sampleRate: sr,
    duration: len / sr,
    getChannelData: (i) => data[Math.min(i, data.length - 1)],
  };
}
function anode(extra) {
  const n = {
    connect() { return n; }, disconnect() {}, start() {}, stop() {},
    gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    frequency: { value: 0 }, Q: { value: 0 },
    threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
    delayTime: { value: 0 }, pan: { value: 0 }, offset: { value: 0 },
    playbackRate: { value: 1 },
    type: '', value: 0, buffer: null, loop: false, stream: {}, fftSize: 1024, frequencyBinCount: 512,
    getByteFrequencyData() {}, getByteTimeDomainData() {}, getFloatFrequencyData() {},
    createPeriodicWave() { return {}; }, setPeriodicWave() {}, curve: null, oversample: 'none',
    reduction: 0, normalRange: {}, getFrequencyResponse() {},
  };
  return Object.assign(n, extra || {});
}
// The app's boot reaches for a wide slice of the Web Audio API (the DJ deck, the
// scratch engine, the analysers), so the fake has to answer all of it or an
// uncaught TypeError in block 1 stops the whole app from booting - which is
// exactly what happened the first time this probe was written.
class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = anode();
    this.baseLatency = 0.01; this.outputLatency = 0.01;
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return anode(); }
  createConvolver() { return anode(); }
  createChannelSplitter() { return anode(); }
  createChannelMerger() { return anode(); }
  createBiquadFilter() { return anode(); }
  createDynamicsCompressor() { return anode(); }
  createAnalyser() { return anode(); }
  createOscillator() { return anode(); }
  createBufferSource() { return anode(); }
  createMediaElementSource() { return anode(); }
  createMediaStreamSource() { return anode(); }
  createMediaStreamDestination() { return anode(); }
  createDelay() { return anode(); }
  createWaveShaper() { return anode(); }
  createStereoPanner() { return anode(); }
  createPanner() { return anode(); }
  createConstantSource() { return anode(); }
  createIIRFilter() { return anode(); }
  createScriptProcessor() { return anode(); }
  createBuffer(ch, len, sr) { return fakeBuffer(ch, len, sr); }
  decodeAudioData(ab, okCb, errCb) {
    // Five minutes at 8kHz: long enough that a "1:20 to 2:00" clip request is not
    // clamped to the end of the buffer (which a short stand-in silently did), and
    // cheap enough to keep allocating.
    const b = fakeBuffer(2, 8000 * 300, 8000);
    setTimeout(() => { try { okCb && okCb(b); } catch (e) { errCb && errCb(e); } }, 0);
    return Promise.resolve(b);
  }
}
function make2dCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 64, height: 64 };
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

/* -------------------------------------------------------------- fake library */
const SIZES = {};
let TRACKS = [];
function buildTracks(win) {
  TRACKS = TRACK_META.map((m) => Object.assign({}, m, {
    blob: new win.Blob([new win.Uint8Array(SIZES[m.id])], { type: 'audio/mpeg' }),
  }));
  return TRACKS;
}
const TRACK_META = [];
for (let i = 1; i <= 12; i++) {
  const id = 't' + i;
  // Deliberately NOT in library order, so "biggest songs" has to sort rather than
  // read the library order.
  SIZES[id] = 100000 + ((i * 7919) % 9) * 100000;
  TRACK_META.push({
    id, name: 'Song ' + i, artist: 'Artist ' + (i % 3), album: 'Album ' + (i % 2),
    duration: 150 + i * 7, playCount: 40 - i * 3, dateAdded: 1000 + i,
    blobType: 'audio/mpeg', fileName: 'song' + i + '.mp3',
  });
}
// The audio Blobs are built INSIDE the jsdom window: a Blob from this Node realm
// is not a Blob as far as jsdom's File constructor is concerned, so it would be
// stringified to "[object Blob]" - thirteen bytes - and every size in the storage
// cleaner would read 13. buildTracks(win) fills TRACKS in beforeParse.
const PLAYLISTS = { 'All Songs': TRACK_META.map((t) => t.id), Favorites: ['t3', 't4'] };

// 71.6. `seedMeta` is the boot's stored settings, for the cases that have to
// start from a library with something already in it - [11p] boots one whose
// albums were taken by the 63.1.4 sweep and whose tags are still on the songs.
function fakeIndexedDB(seedMeta) {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['stats', { key: 'stats', value: { totalListenSeconds: 100 * 3600, totalPlays: 1234 } }],
    ]),
  };
  for (const k of Object.keys(seedMeta || {})) data.meta.set(k, { key: k, value: seedMeta[k] });
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
      setTimeout(() => {
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        req.result = db;
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
  };
}

// 70.2.0. The sideloaded package is NOT "no Capacitor" - it is Capacitor with a
// Billing plugin that Play refuses, which is a different answer from the browser
// and the one that was broken. This stands in for it: the plugin reports itself
// supported and then has no products, which is exactly what a package Google Play
// never distributed gets back (getProducts -> [] -> "not-found").
// 71.5. Every theme object the web layer pushes to the widget, in order. The
// bars themselves are drawn by the Android widget, so the half the web layer
// owes it is the ANSWER - and [11o] reads it out of these payloads.
const widgetThemePushes = [];

function fakeCapacitor() {
  return {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: {
      // 71.5. The widget plugin CI injects, standing in for it: it records what
      // it was told instead of drawing anything.
      SideCutWidget: {
        update: (body) => { try { widgetThemePushes.push(JSON.parse((body && body.theme) || '{}')); } catch (_) {} },
      },
      NativePurchases: {
        isBillingSupported: async () => ({ isBillingSupported: true }),
        getPluginVersion: async () => ({ version: '7.19.3' }),
        getProducts: async () => ({ products: [] }),
        purchaseProduct: async () => { throw new Error('BILLING_SETUP_FAILED'); },
      },
    },
  };
}

// 71.2. The last id in the dock. reorderActionPills() runs at boot and rebuilds
// the strip from the saved order, so "after Studio" is a claim about what that
// pass leaves behind rather than about the written markup.
function stripsLastId(strip) {
  const kids = Array.from(strip.children).filter((el) => el.tagName === "BUTTON");
  return kids.length ? kids[kids.length - 1].id : "";
}

function bootWithAlbumTags(mode, seedMeta, albumForTrack) {
  const prior = TRACK_META.map((track) => track.album);
  TRACK_META.forEach((track, index) => { track.album = albumForTrack(track, index); });
  try { return boot(mode, seedMeta); }
  finally { TRACK_META.forEach((track, index) => { track.album = prior[index]; }); }
}

function boot(mode, seedMeta) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return make2dCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      // jsdom leaves the media element half-implemented: play() answers
      // undefined, and the app chains .catch() onto it, so asking it to play a
      // song throws instead of starting one. These three make it a no-op that
      // keeps its promise, which is all this probe needs from it.
      win.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      win.HTMLMediaElement.prototype.pause = function () {};
      win.HTMLMediaElement.prototype.load = function () {};
      // BEFORE the fake database is built: it copies the track list at call time.
      buildTracks(win);
      win.indexedDB = fakeIndexedDB(seedMeta);
      win.AudioContext = FakeAudioContext;
      win.webkitAudioContext = FakeAudioContext;
      // jsdom has no object URLs, and the library load is what asks for one per
      // song - without this the whole auto-load fails and nothing below is real.
      win.URL.createObjectURL = () => 'blob:jsdom-' + (win.__scObjN = (win.__scObjN || 0) + 1);
      win.URL.revokeObjectURL = () => {};
      win.confirm = () => true;
      // A fake Capacitor for the apk boot: see fakeCapacitor() below.
      if (mode === 'apk') win.Capacitor = fakeCapacitor();
      // Before any inline script runs: SC_IS_PLAY reads this once, at parse time.
      if (mode === 'play') win.__PLAY_BUILD__ = true;
      win.localStorage.clear();
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, errors, win: dom.window };
}
const realErrors = (errors) => errors.filter((e) =>
  e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1 &&
  e.indexOf('Could not parse CSS') === -1 && e.indexOf('not implemented') === -1);

/* ---------------------------------------------------------------------- run */
(async () => {
  const { win, errors } = boot();
  await wait(3600);
  const doc = win.document;

  console.log('[1] the dock and the Studio tab');
  {
    const strip = doc.querySelector('#action-strip, .action-strip');
    ok(!!strip, 'the nav strip is still in the document');
    ok(!!doc.getElementById('studioBtn'), 'and it has a Studio tab');
    const dockRule = html.match(/\.action-strip\{\s*position:\s*fixed[^}]*\}/);
    ok(!!dockRule, 'the dock is fixed to the bottom of the screen');
    ok(!!dockRule && /bottom:\s*0/.test(dockRule[0]), 'at the very bottom');
    const npRule = html.match(/#nowPlaying\{[^}]*bottom:\s*calc\(var\(--sc-dock-h\)/);
    ok(!!npRule, 'and the player is lifted above it');

    // 70.0.7, the user's words: "why is their a huge gap between the media player and
    // tabs". The bar is the middle surface now, so its own padding must not reserve the
    // bottom inset the dock already reserves and `bottom` already counts - on a phone
    // that reports a real inset (Android 15 edge to edge, 3-button nav) that stray
    // inset was the gap. Asserted against the page the app loads, not a description.
    const cssOnly = html.replace(/\/\*[\s\S]*?\*\//g, '');
    const npPads = (cssOnly.match(/#nowPlaying[^{}]*\{[^}]*padding[^}]*\}/g) || [])
      .filter((r) => /env\(safe-area-inset-bottom\)/.test(r));
    ok(npPads.length === 4, 'the player paddings that counted the inset are all still in the page');
    ok(npPads.every((r) => cssOnly.indexOf(r) < cssOnly.indexOf('#nowPlaying{ padding-bottom: 10px; }')),
      'and a later rule overrides every one of them, so the bar does not reserve it twice');
    ok(/\.action-strip\{\s*position:\s*fixed[^}]*padding:\s*6px 10px calc\(6px \+ env\(safe-area-inset-bottom\)\)/.test(html),
      'while the dock, which does touch the bottom edge, still reserves it');


    const before = doc.getElementById('homeView').classList.contains('active');
    doc.getElementById('studioBtn').click();
    await wait(120);
    ok(before, 'Home is the view you start on');
    ok(doc.getElementById('studioView').classList.contains('active'), 'tapping Studio opens the Studio view');
    ok(!doc.getElementById('homeView').classList.contains('active'), 'and Home closes');
    ok(doc.getElementById('studioBtn').classList.contains('active'), 'the Studio tab lights up');
    ok(doc.getElementById('libraryBtn').className.indexOf('active') === -1, 'and the library tab goes dark');
    doc.getElementById('studioBtn').click();
    await wait(120);
    ok(doc.getElementById('homeView').classList.contains('active'), 'tapping Studio again goes back Home');

    // 71.2 reverses 70.0.5's trade. The user asked for the refresh button back
    // beside the gear at the top, and for the add-songs plus to come down to the
    // tab bar as just the smaller plus icon. The dock therefore carries a COMPACT
    // plus at the end of the row - not a fifth tab, so it is filtered out of the
    // tab list by its own dock-add class - and the header carries refresh again.
    // Only the dock's OWN children are tabs - the menu lives inside this subtree
    // and its five buttons wear .action-pill as well.
    const tabs = Array.from(strip.children)
      .filter((el) => el.classList.contains('action-pill') && !el.classList.contains('dock-add'));
    ok(tabs.length === 4, 'the dock is still four tabs (' + tabs.map((b) => b.id).join(',') + ')');
    ok(tabs.map((b) => b.id).join(',') === 'homeBtn,libraryBtn,discoverBtn,studioBtn',
       'and they are Home, Library/Albums, Discover and Studio');
    ok(!doc.getElementById('addSongsToggle'), 'the old add-songs pill is still gone from the dock');
    ok(!doc.getElementById('addSongsWrap'), 'and so is the wrap it sat in - it was a flex child, so it would still take a share of the row');

    const plus = doc.getElementById('dockAddBtn');
    ok(!!plus, 'the dock has the add-songs plus');
    ok(!!plus && plus.parentNode === strip, 'and it is a child of the dock itself');
    ok(!!plus && plus.getAttribute('title') === 'Add songs', 'titled Add songs, so it says what it is when held');
    ok(!!plus && stripsLastId(strip) === 'dockAddBtn', 'last in the row, after Studio and the four tabs');
    ok(!!doc.getElementById('refreshBtn') && !doc.getElementById('addSongsBtn'),
       'and the header has refresh back with no + left in it');
    ok(!!doc.getElementById('addSongsMenu') && !!doc.getElementById('addSongsBackdrop'),
       'the menu and its backdrop are still on the page after the move');

    ok(!doc.getElementById('addSongsMenu').classList.contains('open'), 'the menu starts shut');
    plus.click();
    await wait(60);
    ok(doc.getElementById('addSongsMenu').classList.contains('open'), 'tapping the + opens the Add songs menu');
    ok(doc.getElementById('addSongsBackdrop').classList.contains('open'), 'and dims what is behind it');
    ok(strip.classList.contains('menu-open'), 'and lifts the dock, so the menu clears the player');
    ['addFolderBtn', 'addBtn', 'importLibBtn', 'exportSongsBtn', 'exportLibBtn'].forEach((id) =>
      ok(!!doc.getElementById(id), 'the menu still offers ' + id));
    plus.click();
    await wait(60);
    ok(!doc.getElementById('addSongsMenu').classList.contains('open'), 'tapping the + again shuts it');
    ok(!strip.classList.contains('menu-open'), 'and the dock drops back');
    plus.click();
    await wait(60);
    doc.getElementById('addSongsBackdrop').click();
    await wait(60);
    ok(!doc.getElementById('addSongsMenu').classList.contains('open'), 'and tapping outside shuts it too');
  }

  console.log('[2] the Studio view');
  {
    // 70.0.5: the module reads the version the app publishes instead of pinning
    // the release it was written in, so the Studio header cannot go stale.
    ok(!!win.SC70 && win.SC70.version === win.APP_VERSION,
       'the Studio module is on the page as the app version (' + (win.SC70 && win.SC70.version) + ')');
    win.SC70.renderStudio();
    await wait(60);
    const tools = Array.from(doc.querySelectorAll('#studioView [data-tool]')).map((b) => b.getAttribute('data-tool'));
    // 70.0.8: six of them. Crop is the app's own cropper now (the card that used to
    // wear that word was a clip exporter), and the clip exporter kept a card of its
    // own instead of being deleted - so the Studio grew a card, it did not trade one.
    // 70.1.2: eight of them. The sleep timer and the practice loop were added to
    // the row, and nothing that was there was traded away for either.
    // 71.4: nine. The edit rack joined the row for the pro-editing pass - trim,
    // fades, level, reverse and a saved copy - and again nothing was traded away
    // for it.
    // 72.2: ten. The clean-up joined the row - the rack's silence trim and level
    // match with the knobs already set - and again nothing was traded away for it.
    // 73.6.2: eleven. DJ Mode joined the row, first, because the deck is the one
    // creative tool the Studio was missing entirely - it lived only on the DJ MODE
    // chip under the player - and again nothing was traded away for it. The card
    // opens the app's own deck through window.__scOpenDjMode. The count here is
    // the rack's shape; dev/test-7362.mjs drives the card itself, the deck it
    // opens and the playlist that switches it off.
    ok(tools.length === 11, 'eleven tool cards (' + tools.join(',') + ')');
    ['djmode', 'crop', 'clip', 'edit', 'cleanup', 'fx', 'karaoke', 'sampler', 'looper', 'sleep', 'practice'].forEach((k) =>
      ok(tools.indexOf(k) !== -1, 'including ' + k));
    ok(tools[0] === 'djmode', 'and the deck leads the rack (' + tools[0] + ')');
    // 70.0.5: the wall was 201 badges; 73.3 removed the Discovery group at the
    // owner's word, and 73.3.8 replaced the generated thresholds with 150
    // hand-written badges, so the wall is 151 tiles here, the last one blank.
    // Section [11] walks the rest.
    const badges = doc.querySelectorAll('#studioView .sc-badge');
    ok(badges.length === 151, 'the badge grid has 151 tiles, the last one blank (' + badges.length + ')');
    ok(doc.querySelectorAll('#studioView .sc-badge-bar').length === badges.length,
      'every badge carries its own progress bar');
    ok(doc.querySelectorAll('#studioView [data-act="autodj"], #studioView [data-act="shake"], #studioView [data-act="swipe"]').length === 3,
      'Auto-DJ and both gestures have switches');
    ok(doc.querySelectorAll('#studioView .sc-store-row').length > 0, 'the storage cleaner lists the big songs');
    ok(doc.querySelectorAll('#studioView [data-reenc]').length === doc.querySelectorAll('#studioView .sc-store-row').length,
      'with a re-encode button on every one');
  }

  console.log('[3] the live FX chain (slowed + reverb, karaoke)');
  {
    ok(typeof win.scStudioBuildChain === 'function', 'the chain builder is published for the app graph');
    // Build one the way ensureAudioGraph does and read the fader positions.
    const ctx = new FakeAudioContext();
    const deckGain = ctx.createGain(), limiter = ctx.createGain();
    const ch = win.scStudioBuildChain(ctx, 0, deckGain, limiter);
    ok(!!ch && !!ch.fxIn && !!ch.fxOut, 'deck gain now lands in a chain that closes on the limiter');
    ok(!!ch.dry && !!ch.send && !!ch.wet, 'the chain has a dry path and a reverb send');
    ok(!!ch.kar && !!ch.kar.gate, 'and a vocal-cancel path of its own');
    ok(!!ch.loopIn, 'and an input the sampler and the loop recorder play into');

    win.SC70.setFx({ reverb: 0.7, karaoke: 0, rate: 1 }, true);
    ok(Math.abs(ch.send.gain.value - 0.7) < 1e-6, 'the reverb fader moves the send');
    ok(Math.abs(ch.dry.gain.value - 1) < 1e-6, 'and leaves the dry path alone');
    win.SC70.setFx({ karaoke: 1, rate: 1 }, true);
    ok(Math.abs(ch.kar.gate.gain.value - 1) < 1e-6, 'and the karaoke fader opens the cancel path');
    ok(Math.abs(ch.dry.gain.value - 0.1) < 1e-6, 'while ducking the dry path so the two do not fight');
    win.SC70.setFx({ karaoke: 0, reverb: 0, rate: 1 }, true);
    ok(Math.abs(ch.dry.gain.value - 1) < 1e-6 && Math.abs(ch.kar.gate.gain.value) < 1e-6,
      'and turning it off restores a plain dry signal');
    ok(win.__scStudioRate() === 1, 'the Studio speed reads 1x when it is off');
    win.SC70.setFx({ rate: 0.85 }, true);
    ok(win.__scStudioRate() === 0.85, 'and 0.85x after a slowed preset');
    ok(html.indexOf('.playbackRate = playbackSpeed * (typeof window.__scStudioRate') !== -1,
      'every place the app sets a deck rate multiplies by it');
    win.SC70.setFx({ rate: 1, reverb: 0, karaoke: 0 }, true);
  }

  console.log('[4] the BPM reader behind Auto-DJ');
  {
    // A synthetic 120 BPM click track: a kick every half second on a 44.1k stream.
    const sr = 44100, seconds = 8, len = sr * seconds;
    const data = new Float32Array(len);
    for (let b = 0; b < seconds * 2; b++) {
      const at = b * 22050;
      for (let i = 0; i < 900 && at + i < len; i++) data[at + i] = Math.sin((i / 900) * Math.PI * 8) * Math.exp(-i / 220);
    }
    const buf = { sampleRate: sr, length: len, numberOfChannels: 1, duration: seconds, getChannelData: () => data };
    const r = win.SC70.detectBpm(buf);
    ok(!!r, 'a tempo is read off the buffer');
    ok(r && Math.abs(r.bpm - 120) < 6, 'and a 120 BPM click track reads ' + (r ? r.bpm : '?') + ' BPM');
    ok(r && r.firstBeat >= 0 && r.firstBeat < 1, 'with a downbeat inside the first second (' + (r ? r.firstBeat : '?') + 's)');

    win.SC70.setAutoDj(true);
    ok(win.SC70.autodj.on === true, 'Auto-DJ can be turned on');
    ok(typeof win.__scAutoDjGate === 'function', 'and the app asks the gate before it starts a blend');
    ok(html.indexOf('if(scBeatOk) maybeStartCrossfade();') !== -1, 'the gate decides when the crossfade starts');
    ok(typeof win.__scAutoDjAlign === 'function', 'and where the incoming song starts');
    ok(html.indexOf('nxt.currentTime = scAlign') !== -1, 'which the crossfade applies to the incoming deck');
    win.SC70.setAutoDj(false);
    ok(win.__scAutoDjGate({ currentTime: 3.7 }, 5) === true, 'with Auto-DJ off the blend is never held back');
  }

  console.log('[5] achievements and streaks');
  {
    const before = win.SC70.unlockedCount();
    var before11 = before;
    ok(before > 0, 'badges already earned from the real stats: ' + before);
    const all = win.SC70.achievements();
    const century = all.filter((a) => a.id === 'century_of_sound')[0];
    ok(!!century, 'there is a 100-hour badge');
    ok(century.need.got >= century.need.want, 'and 100 hours of real listening meets it');
    const lists = all.map((a) => a.id);
    ok(lists.length === new Set(lists).size, 'no badge id appears twice');
    ok(all.every((a) => a.need.want > 0), 'every badge has a target above zero');
    ok(all.every((a) => Number.isFinite(a.need.got)), 'and a countable progress');

    win.SC70.markFeature('clip');
    const fresh = win.SC70.checkAchievements(true);
    ok(fresh.some((a) => a.id === 'clip_artist'), 'exporting a clip unlocks the clip badge');
    const after = win.SC70.unlockedCount();
    // Not "exactly one": a feature flag also feeds the "used every feature" tile, so
    // marking one can legitimately cross a threshold on the counters as well.
    // What matters is that clip_1 is in the fresh list and the count went up.
    ok(after > before, 'and the count moves up (' + before + ' -> ' + after + ')');
    const again = win.SC70.checkAchievements(true);
    ok(again.length === 0, 'checking again unlocks nothing a second time');
    ok(win.localStorage.getItem('sidecut_achievements') !== null, 'and what is unlocked is remembered on the device');
  }

  console.log('[6] the storage cleaner');
  {
    const rows = win.SC70.biggestSongs(24);
    ok(rows.length === TRACKS.length, 'every song with a file is listed (' + rows.length + ')');
    let sorted = true;
    for (let i = 1; i < rows.length; i++) if (rows[i].size > rows[i - 1].size) sorted = false;
    ok(sorted, 'biggest first');
    const biggest = Math.max.apply(null, rows.map((r) => r.size));
    ok(rows[0].size === biggest, 'and the largest file really is first');

    const victim = win.SC70.biggestSongs(1)[0].t;
    const oldFile = victim.file;
    const oldSize = oldFile.size;
    const oldUrl = victim.url;
    // Stand in for the encoder: the app's mp3 encoder is a CDN script that jsdom
    // does not load, so the swap is what is driven here, not lamejs.
    const realEncode = win.__scEncodeMp3;
    win.__scEncodeMp3 = () => Promise.resolve(new Blob([new Uint8Array(2000)], { type: 'audio/mpeg' }));
    ok(typeof win.SC70.reencodeTrack === 'function', 'the cleaner can re-encode a song');
    win.SC70.reencodeTrack(victim.id, 128);
    await wait(1400);
    ok(victim.file !== oldFile, 'the stored file is replaced');
    ok(victim.file.size < oldSize, 'with a smaller one (' + oldSize + ' -> ' + (victim.file && victim.file.size) + ')');
    ok(victim.reencoded === true, 'and the song is marked as re-encoded');
    ok(String(victim.url || '').indexOf('blob:') === 0, 'the player is pointed at the new file');
    win.SC70.undoReencode(victim.id);
    ok(victim.file === oldFile, 'undo puts the original file back');
    ok(victim.reencoded === false, 'and clears the re-encoded mark');
    win.__scEncodeMp3 = realEncode;
  }

  console.log('[7] the batch tag editor, and the tag inside the file');
  {
    ok(typeof win.__scWriteTagsToFile === 'function', 'the app can write a tag into a stored file');
    ok(html.indexOf('selectTagBtn') !== -1, 'the selection bar has a tag button');
    ok(html.indexOf('openBatchTags(Array.from(selectedIds))') !== -1, 'and it opens the editor on the selection');

    const ids = ['t1', 't2', 't3'];
    win.SC70.openBatchTags(ids);
    await wait(40);
    const sheet = doc.getElementById('scSheet');
    ok(sheet && sheet.style.display === 'flex', 'the editor opens as a sheet');
    ok(doc.getElementById('scSheetTitle').textContent === 'Batch tag editor', 'titled as the tag editor');
    doc.getElementById('scBatchArtist').value = 'One Artist For Three';
    doc.getElementById('scBatchAlbum').value = 'One Album';
    doc.getElementById('scBatchGo').click();
    await wait(900);
    const done = ids.map((id) => win.__scGetAllTracks().filter((t) => t.id === id)[0]);
    ok(done.every((t) => t.artist === 'One Artist For Three'), 'the artist is changed on every selected song');
    ok(done.every((t) => t.album === 'One Album'), 'and so is the album');
    ok(win.__scGetAllTracks().filter((t) => t.id === 't4')[0].artist !== 'One Artist For Three',
      'and a song that was not selected is untouched');
    ok(win.localStorage.getItem('sidecut_feature_flags').indexOf('retag') !== -1, 'the feature is recorded for the badges');

    // The part that makes it a change to the FILES: a real ID3v2 block written in
    // front of the stored bytes.
    const t = win.__scGetAllTracks().filter((x) => x.id === 't5')[0];
    const raw = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]);
    t.file = new File([raw], 'plain.mp3', { type: 'audio/mpeg' });
    const wrote = await win.__scWriteTagsToFile(t);
    ok(wrote === true, 'writing the tag reports success');
    const bytes = new Uint8Array(await t.file.arrayBuffer());
    ok(bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33, 'the file now starts with an ID3 tag');
    ok(bytes.length > raw.length, 'and the audio behind it is still there');
    const tail = bytes.slice(bytes.length - raw.length);
    ok(tail[0] === 0xFF && tail[1] === 0xFB, 'byte for byte');
  }

  console.log('[8] the assistant that acts');
  {
    ok(!!win.SCACT && typeof win.SCACT.tryRun === 'function', 'the action layer is on the page');
    ok(html.indexOf('var _scAction = window.SCACT.tryRun(msg);') !== -1, 'and the chat asks it before anything else');
    ok(html.indexOf('statusEl.textContent = \'Done in SideCut\'' ) !== -1, 'and says so when it acted');

    // The crop request cuts the CURRENT song's audio, so something has to be
    // playing for it to be a real request (and a request with an empty player is
    // answered honestly rather than claimed - see the module).
    win.playFromList(['t1', 't2', 't3'], 't1');
    await wait(120);
    ok(!!win.__scCurrentTrack(), 'a song is loaded for the assistant to act on');

    const themeBefore = win.__scGetTheme();
    const said = win.SCACT.tryRun('turn on the Ember theme');
    ok(!!said, 'a theme request is answered with what was done');
    ok(win.__scGetTheme() === 'ember', 'and the theme really is Ember now (' + themeBefore + ' -> ' + win.__scGetTheme() + ')');

    const pls = win.__scGetPlaylists();
    const before = Object.keys(pls).length;
    const said2 = win.SCACT.tryRun('make a playlist of my most played songs');
    ok(!!said2, 'a playlist request is carried out');
    const made = Object.keys(win.__scGetPlaylists()).filter((n) => pls[n] === undefined || n.indexOf('Most played') === 0)[0];
    ok(!!made, 'a playlist called "' + made + '" exists');
    const ids = win.__scGetPlaylists()[made] || [];
    ok(ids.length > 0, 'with songs in it (' + ids.length + ')');
    const counts = ids.map((id) => (win.__scGetAllTracks().filter((t) => t.id === id)[0] || {}).playCount || 0);
    let ranked = true;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[i - 1]) ranked = false;
    ok(ranked, 'sorted by play count, most played first');
    ok(Object.keys(win.__scGetPlaylists()).length === before + 1, 'and nothing else was added');

    const said3 = win.SCACT.tryRun('crop this from 1:20 to 2:00');
    await wait(120);
    ok(!!said3, 'a crop request is carried out');
    ok(doc.getElementById('scSheet').style.display === 'flex', 'Studio opens with the clip sheet up');
    ok(win.SC70.clip.start === 80 && win.SC70.clip.end === 120,
      'and the range is armed at 1:20-2:00 (' + win.SC70.clip.start + '-' + win.SC70.clip.end + ')');
    ok(win.SCACT.tryRun('what is the capital of France') === null, 'and a question it cannot act on is left alone');
  }

  console.log('[8b] lyrics off for one song, and the APK count');
  {
    // 70.0.8 - "If the lyrics is not right just add an option to disable lyrics for
    // that song". Driven through the real setter that the chip and the panel both
    // call: the flag has to put the panel up, live in the sidecar (next to the play
    // count, so no audio is rewritten for one boolean) and come back off again.
    const t0 = win.__scGetAllTracks()[0];
    const btn = doc.getElementById('lyricsDisableBtn');
    const panel = doc.getElementById('lyricsOffPanel');
    ok(!!btn && !!panel, 'the lyrics sheet has a switch and a panel for it');
    ok(typeof win.__scLyricsSetOff === 'function', 'and one setter behind both of them');
    ok(t0.lyricsOff !== true, 'a song starts with online lyrics on');
    win.__scLyricsSetOff(t0, true);
    await wait(40);
    ok(t0.lyricsOff === true, 'switching it off flags the song');
    ok(panel.style.display === 'block', 'and the sheet says so instead of loading');
    const side = win.__scSidecar()[t0.id] || {};
    ok(side.lyricsOff === true, 'and it is kept in the sidecar, so no audio is rewritten for one flag');
    win.__scLyricsSetOff(t0, false);
    await wait(60);
    ok(t0.lyricsOff === false, 'and it can be turned back on');
    ok(panel.style.display === 'none', 'with the panel out of the way again');

    // 73.7 - the download-count section is out of the Studio. What is driven here
    // is that it is really out of the BUILT page and not merely unrendered: no
    // section, no button that reads one, and the Studio surface still builds - a
    // removal that left a name published would have thrown before this line.
    ok(!doc.querySelector('#scStudioApks'), 'the Studio carries no download-count section');
    ok(!doc.querySelector('#studioView [data-act="apkread"]'), 'and no button left that would read one');
    ok(!!win.SC70 && typeof win.SC70.openClipSheet === 'function', 'while the Studio surface itself still builds');
  }

  console.log('[9] the grouped song menu');
  {
    const host = doc.getElementById('songActionsList');
    host.classList.remove('sc-grouped');
    host.innerHTML = '<button>▶ Play now</button><button>✂ Crop song</button>' +
      '<button>♡ Add to favourites</button><button>⬇ Download</button><button>🗑 Delete from library</button>' +
      '<button>✎ Edit info</button><button>🎤 Lyrics</button>';
    const did = win.__scDecorSongSheet();
    ok(did === true, 'the sheet is grouped');
    ok(host.classList.contains('sc-grouped'), 'and marked as grouped');
    const labels = Array.from(host.querySelectorAll('.sc-sheet-group-label')).map((e) => e.textContent);
    ok(labels.length >= 4, 'with labelled sections (' + labels.join(', ') + ')');
    ok(labels.indexOf('Play') !== -1 && labels.indexOf('Edit') !== -1 && labels.indexOf('Danger') !== -1,
      'Play, Edit and Danger among them');
    const danger = host.querySelector('.sc-sheet-group.danger');
    ok(!!danger, 'the destructive one is its own group');
    ok(danger.textContent.indexOf('Delete from library') !== -1, 'and it holds the delete');
    ok(host.querySelectorAll('.sc-sheet-group-body button').length === 7, 'no button was lost in the move');
    // 70.0.8 - "where is speed adjuster in song 3 dots menu". The real sheet is
    // built with a speed control in it, and the control is NOT a button - so the
    // rebuild that groups the sheet has to carry it across. Driven here on the
    // real host, with the real markup the app puts there.
    const speed = doc.createElement('div');
    speed.innerHTML = '<span>Playback speed</span><input type="range" id="actionSpeedSlider" min="0.5" max="2" step="0.05" value="1">';
    host.insertBefore(speed, host.firstChild);
    host.classList.remove('sc-grouped');
    host.innerHTML = speed.outerHTML + host.innerHTML.replace(speed.outerHTML, '');
    const did2 = win.__scDecorSongSheet();
    ok(did2 === true, 'the sheet groups again with a control in it');
    const slider = doc.getElementById('actionSpeedSlider');
    ok(!!slider, 'and the playback speed slider is still in the sheet, not thrown away by the rebuild');
    const playGroup = host.querySelector('.sc-sheet-group-body');
    ok(!!slider && !!playGroup && playGroup.contains(slider), 'and it was put back at the top of the Play group');
    ok(!!playGroup && playGroup.firstChild && playGroup.firstChild.contains(slider), 'where it is the first row');

    // 70.0.8 - one cropper. The Studio card asks the app for it by id through the
    // hook, so this drives exactly the path the card drives.
    const tapped = [];
    const realCropHook = win.__scCropSong;
    const loaded = win.__scCurrentTrack();
    ok(!!loaded, 'a song is loaded in the Studio');
    win.__scCropSong = (id) => { tapped.push(id); return true; };
    ok(win.SC70.cropCurrent() === true, 'the Studio crop card opens the app cropper');
    ok(tapped.length === 1 && tapped[0] === loaded.id, 'for the song that is loaded, by id');
    win.__scCropSong = () => false;
    ok(win.SC70.cropCurrent() === false, 'and a build without the cropper says so instead of pretending');
    win.__scCropSong = realCropHook;

    ok(Array.from(host.querySelectorAll('.sc-sheet-ico')).length >= 6, 'and every row got its icon');
  }

  console.log('[10] gestures');
  {
    const realNext = win.__scNext, realPrev = win.__scPrev;
    let nexts = 0, prevs = 0;
    win.__scNext = () => { nexts++; };
    win.__scPrev = () => { prevs++; };

    win.SC70.enableShake(true);
    const motion = new win.Event('devicemotion');
    Object.defineProperty(motion, 'accelerationIncludingGravity', { value: { x: 30, y: 2, z: 1 } });
    win.dispatchEvent(motion);
    await wait(30);
    ok(nexts === 1, 'a shake skips the song');
    const motion2 = new win.Event('devicemotion');
    Object.defineProperty(motion2, 'accelerationIncludingGravity', { value: { x: 31, y: 2, z: 1 } });
    win.dispatchEvent(motion2);
    await wait(30);
    ok(nexts === 1, 'and a second shake inside the same moment does not skip twice');

    const host = doc.getElementById('nowPlaying');
    function swipe(dx) {
      const e = new win.Event('touchstart');
      Object.defineProperty(e, 'touches', { value: [{ clientX: 200, clientY: 300, target: host }] });
      Object.defineProperty(e, 'target', { value: host });
      host.dispatchEvent(e);
      const e2 = new win.Event('touchend');
      Object.defineProperty(e2, 'changedTouches', { value: [{ clientX: 200 + dx, clientY: 300 }] });
      host.dispatchEvent(e2);
    }
    win.SC70.gestures.swipe = true;
    swipe(-90);

    await wait(20);
    ok(nexts === 2, 'a swipe left on the player goes to the next song');
    swipe(90);
    await wait(20);
    ok(prevs === 1, 'and a swipe right goes back');

    win.SC70.gestures.swipe = false;
    swipe(-90);
    await wait(20);
    ok(nexts === 2, 'switched off, the swipe does nothing');

    win.__scNext = realNext;
    win.__scPrev = realPrev;
    win.SC70.gestures.shake = false;
  }

  console.log('[11] 150 badges, one secret, five rewards');
  {
    const all = win.SC70.achievements();
    // 73.3.8, the owner's words: "just make it 150 meaningful badges plus secret
    // badge instead of 201 random badges". The tables that generated 171 of the old
    // tiles are gone, so the wall is 150 hand-written badges and the one that is
    // deliberately not on the grid.
    ok(all.length === 151, 'the wall is 150 badges plus the secret one (' + all.length + ')');
    ok(all.filter((a) => a.secret).length === 1, 'exactly one of them is secret');
    ok(all.filter((a) => a.secret)[0].id === 'secret_door', 'and it is the door behind the version line');
    ok(all.filter((a) => !a.secret).length === 150, 'the other 150 are on the grid from the start');
    ok(new Set(all.map((a) => a.id)).size === 151, 'no two of the 151 share an id');
    ok(all.every((a) => Number.isFinite(a.need.got) && a.need.want > 0),
      'and every one of them has a target and a countable progress');
    // Every tile was hand-written this time, so every tile has a name of its own
    // and a sentence of its own. A wall whose tiles differ only by a number is
    // exactly what this release took away, and these two checks are what keep it
    // from coming back.
    ok(new Set(all.map((a) => a.name)).size === 151, 'every badge has a name of its own');
    ok(new Set(all.map((a) => a.sub)).size === 151, 'and a sentence of its own');

    // 70.0.6, the user's words: "The badges shouldny do with altering your songs".
    // Crop, the batch tag editor and the re-encoder are tools, not achievements -
    // no tile on the wall may name one of them or what it saves.
    const EDIT_WORD = /re-encod|retagg|batch tag|cropped|space won|saved by/i;
    ok(all.every((a) => !EDIT_WORD.test(a.name + ' ' + a.sub)),
      'and no badge asks you to alter a song you already have');

    win.SC70.renderStudio();
    const heads = Array.from(doc.querySelectorAll('#studioView .sc-ach-group-head'));
    const titles = heads.map((h) => h.firstElementChild.textContent);
    ok(titles.length === 8, 'they are grouped into eight sections (' + titles.join(' / ') + ')');
    ok(titles.join('|') === 'Streaks|Listening|Library|Studio & the deck|Assistant & gestures|Themes|Milestones|Secret',
       'and the sections are the app\u2019s own areas of the app');
    const counted = heads.reduce((n, h) => {
      const m = /\/(\d+)/.exec(h.lastElementChild.textContent);
      return n + (m ? Number(m[1]) : 0);
    }, 0);
    ok(counted === 151, 'the eight group counts add up to 151 (' + counted + ')');

    // ---- before the door is found: the secret one is a blank tile, not a spoiler
    ok(win.SC70.doorOpen() === false, 'the door starts closed');
    ok(doc.querySelectorAll('#studioView .sc-badge-secret').length === 1,
      'so the wall shows one blank tile where the secret badge would be');
    ok(doc.querySelectorAll('#studioView .sc-dev').length === 0, 'and there is no dev panel on it');
    ok(win.SC70.achievements().filter((a) => a.secret)[0].need.got === 0,
      'the secret badge is not met');
    ok(win.SC70.unlockedCount() < 151, 'and it is not part of the count');
    // The gate is live, so it has to agree with the COUNT, not with a stored flag -
    // and it does, whatever the count happens to be on this device.
    const rewardAt = { cinder: 40, quartz: 80, lumen: 110, vortex: 140 };
    const n11 = win.SC70.unlockedCount();
    Object.keys(rewardAt).forEach((k) =>
      ok(win.SC70.themeUnlocked(k) === (n11 >= rewardAt[k]),
         k + ' unlocks exactly when the count reaches ' + rewardAt[k] + ' (at ' + n11 + ')'));
    ok(win.SC70.themeUnlocked('vortex') === false, 'and Vortex is still out of reach at ' + n11 + ' badges');

    // ---- the gesture the user asked for: seven taps open the door -------------
    const label = doc.getElementById('currentVersionLabel');
    ok(!!label, 'the version line is on the Settings page');
    for (let i = 0; i < 6; i++) { label.click(); await wait(4); }
    ok(win.SC70.doorOpen() === false, 'six taps are not enough');
    label.click();
    await wait(40);
    ok(win.SC70.doorOpen() === true, 'the seventh opens the door');
    ok(win.localStorage.getItem('sidecut_door') !== null, 'and an open door is remembered on the device');
    // The door writes its own key and nothing else: the dev-mode key the release
    // before this one wrote is neither read nor written any more.
    ok(win.localStorage.getItem('sidecut_devmode') === null,
      'while the old dev-mode key is never written');

    win.SC70.renderStudio();
    ok(doc.querySelectorAll('#studioView .sc-dev').length === 0, 'the wall still has no dev panel');
    ok(doc.querySelectorAll('#studioView .sc-badge-secret').length === 0,
      'the blank tile is replaced by the real badge');
    const secret = win.SC70.achievements().filter((a) => a.secret)[0];
    ok(secret.need.got === 1, 'and the secret badge is met by having opened the door');
    ok(win.SC70.unlockedCount() > before11, 'so the count moves up by it');

    // ---- the five rewards ----
    const rw = win.SC70.rewards();
    ok(rw.length === 5, 'there are five rewards');
    ok(rw.map((r) => r.at).join(',') === '40,80,110,140,151',
       'at 40, 80, 110, 140 and 151 (' + rw.map((r) => r.at).join(',') + ')');
    ok(rw.slice(0, 4).every((r) => r.kind === 'theme'), 'the first four are themes');
    ok(rw[3].key === 'vortex' && rw[3].dynamic === true, 'the 140 one is the dynamic Vortex');
    ok(rw[4].kind === 'complete', 'and the last one is the finished wall');
    // The one number that must never drift: the trophy's count IS the wall's length.
    ok(rw[4].at === win.SC70.achievements().length,
      'and it sits on the wall it counts (' + rw[4].at + ' of ' + win.SC70.achievements().length + ')');

    // ---- nothing on the wall can be pretended any more ----
    // 73.3.8 took the dev-mode panel and its "pretend all earned" switch out of
    // Studio, so there is no way to walk the reward path without earning it. What
    // is left to prove is that the gate is arithmetic and not a stored flag.
    ['devsim', 'devreset', 'devoff', 'devself'].forEach((a) =>
      ok(doc.querySelectorAll('#studioView [data-act="' + a + '"]').length === 0,
        'no ' + a + ' control survives on the wall'));
    ['cinder', 'quartz', 'lumen', 'vortex'].forEach((k) =>
      ok(win.SC70.themeUnlocked(k) === (win.SC70.unlockedCount() >= rewardAt[k]),
         k + ' answers off the live count, not a switch'));
    ok(typeof win.isPremiumActive === 'undefined', 'and there is no entitlement for it to mint');
    ok(win.localStorage.getItem('sidecut_premium') === null,
      'and nothing is recorded, because there is nothing to lock');

    // ---- the app's Theme tab asks the wall, live ----
    ok(typeof win.__scRewardThemeUnlocked === 'function', 'the Theme tab has a gate to ask');
    ok(['cinder', 'quartz', 'lumen', 'vortex'].every((k) =>
      win.__scRewardThemeUnlocked(k) === (win.SC70.unlockedCount() >= rewardAt[k])),
      'and the tab agrees with the wall, tile for tile');
    const prog = win.__scRewardThemeProgress('vortex');
    ok(!!prog && prog.at === 140, 'it knows Vortex unlocks at 140 badges');
    const themeCss = html.indexOf('body.theme-dyn-vortex::before') !== -1;
    ok(themeCss, 'and the Vortex backdrop is in the stylesheet');

    // ---- Vortex whirls with the finger ----
    win.__scApplyTheme('vortex');
    await wait(60);
    ok(doc.body.classList.contains('theme-dyn-vortex'), 'Vortex applies as a dynamic theme');
    const at = (type, x, y, target) => {
      const e = new win.Event(type);
      Object.defineProperty(e, 'clientX', { value: x });
      Object.defineProperty(e, 'clientY', { value: y });
      Object.defineProperty(e, 'target', { value: target || doc.body });
      win.dispatchEvent(e);
    };
    at('pointerdown', 500, 300);
    at('pointermove', 500, 500);
    await wait(40);
    const spun = win.SC70.spin();
    ok(Math.abs(spun) > 1, 'dragging a finger around the screen whirls it (' + spun.toFixed(1) + '\u00b0)');
    ok(doc.documentElement.style.getPropertyValue('--whirl-deg') !== '',
      'and the angle is written to the page as --whirl-deg');
    win.SC70.spinWhirl(45);
    ok(doc.documentElement.style.getPropertyValue('--whirl-deg') === '45.00deg',
      'and it can be spun to an angle directly');
    win.__scApplyTheme('coral');
    await wait(30);
    ok(!doc.body.classList.contains('theme-dyn-vortex'), 'leaving Vortex clears its class and its layer');

    // ---- the door can be closed again, and the reward is not a switch ----
    ok(win.SC70.rewards().length === 5 && win.localStorage.getItem('sidecut_premium') === null,
      'the trophy has no entitlement behind it to take back');
    win.SC70.setDoorOpen(false);
    await wait(60);
    ok(win.SC70.doorOpen() === false, 'and the door can be closed again');
    ok(doc.querySelectorAll('#studioView .sc-badge-secret').length === 1,
      'so its tile goes back to being a blank one');
    ok(win.localStorage.getItem('sidecut_achievements') !== null || win.SC70.unlockedCount() >= 1,
      'while the badges earned from real use are still there');
    win.SC70.setDoorOpen(true);
    await wait(40);
    ok(win.SC70.doorOpen() === true, 'and opening it again puts the badge back');
  }

  console.log('[11b] the player is lifted by the dock that is really there');
  {
    // 70.0.9 - "there is way to much of a gap" on a foldable. Driven with a fake
    // dock height, because jsdom measures every element as 0: the mechanism is the
    // class plus the custom property, and the fallback has to survive a dock that
    // cannot be measured.
    const strip = doc.querySelector('.action-strip');
    ok(!!strip, 'the dock is in the page');
    ok(win.SC70.measureDock() === false, 'an unmeasurable dock (0 tall) leaves the guess alone');
    ok(!doc.documentElement.classList.contains('sc-dock-measured'), 'and the measured lift stays off');
    const real = strip.getBoundingClientRect;
    strip.getBoundingClientRect = () => ({ height: 132, width: 400, top: 0, left: 0, right: 400, bottom: 132 });
    ok(win.SC70.measureDock() === true, 'a real dock height is taken');
    ok(doc.documentElement.classList.contains('sc-dock-measured'), 'and the player is switched to it');
    ok(doc.documentElement.style.getPropertyValue('--sc-dock-real') === '132px',
      'with the measured height (' + doc.documentElement.style.getPropertyValue('--sc-dock-real') + ')');
    strip.getBoundingClientRect = () => ({ height: 4000, width: 400, top: 0, left: 0, right: 400, bottom: 4000 });
    ok(win.SC70.measureDock() === false, 'and a 4000px dock is refused as nonsense');
    ok(!doc.documentElement.classList.contains('sc-dock-measured'), 'falling back to the arithmetic');
    strip.getBoundingClientRect = real;
  }

  console.log('[11d] a badge that reaches its goal shows up on the wall');
  {
    // 70.1.1 - "fix the badges not working when you reach the goal". The wall is
    // drawn when it is drawn, and nothing redrew it when the count moved, so a
    // badge could be earned, saved and toasted with the grid in front of the user
    // still showing the count from an earlier paint. Driven for real here: the
    // header, the ring and the tiles all have to agree with the count after a
    // goal is crossed, and opening Studio has to redraw.
    const hero = () => { const el = doc.querySelector('.sc-hero-badges'); return el ? el.textContent : ''; };
    const all = win.SC70.achievements().length;
    doc.querySelector('#studioBtn').click();
    await wait(120);
    ok(!!doc.querySelector('#studioView').classList.contains('active'), 'Studio is the view');
    ok(hero() === win.SC70.unlockedCount() + ' of ' + all + ' badges',
      'and its wall is drawn from the real count (' + hero() + ')');
    const chip = doc.querySelector('#studioView [data-f="all"]');
    if (chip && !chip.classList.contains('on')) { chip.click(); await wait(60); }
    // Cross the next goal the honest way: move a counter the badges read.
    const before = win.SC70.unlockedCount();
    let steps = 0;
    while (win.SC70.unlockedCount() <= before && steps < 400) { win.SC70.bump('studio', 1); steps++; }
    const after = win.SC70.unlockedCount();
    ok(after > before, 'a goal that is reached is counted (' + before + ' -> ' + after + ')');
    const fresh = win.SC70.checkAchievements(true);
    ok(fresh.length > 0, 'and recorded (' + fresh.length + ' at once)');
    await wait(80);
    ok(hero() === after + ' of ' + all + ' badges',
      'and the wall the user is looking at agrees with it (' + hero() + ')');
    ok(doc.querySelectorAll('#studioView .sc-badge.have').length >= after,
      'with every earned badge a lit tile on that wall');
    // Opening Studio has to redraw rather than trust the last paint: the
    // sentinel can only disappear if a fresh render really ran.
    const wall = doc.querySelector('.sc-hero-badges');
    wall.textContent = 'STALE';
    doc.querySelector('#libraryBtn').click();
    await wait(80);
    doc.querySelector('#studioBtn').click();
    await wait(140);
    ok(hero() !== 'STALE', 'and opening Studio redraws it rather than trusting the last paint');
  }

  console.log('[11e] the sleep timer stops the music, and the loops and presets just work');
  {
    // 70.1.2 - "add more features to studio", and 70.1.3 - "Remove premium make
    // everything free keep donations". Driven here: the timer really pauses when
    // the song ends, and the loop really seeks back to A with no entitlement to
    // ask for first.
    ok(typeof win.SC70.setSleep === 'function' && typeof win.SC70.practiceRun === 'function',
      'the new tools are on the module surface');
    ok(!!doc.querySelector('#studioView [data-tool="sleep"]') && !!doc.querySelector('#studioView [data-tool="practice"]'),
      'and both are cards on the Studio screen');
    // --- the free half: the sleep timer
    const audio = win.__scActiveAudio();
    ok(!!audio, 'the app has an audio element to stop');
    // jsdom never plays anything, so the app own pause hook is watched instead:
    // the timer has to ASK the app to pause - that is the whole mechanism.
    let pauses = 0;
    const realPause = win.__scPause;
    win.__scPause = function(){ pauses++; };
    win.SC70.setSleep('song');
    ok(win.SC70.sleep().mode === 'song', 'a sleep timer can be set to the end of the song');
    audio.dispatchEvent(new win.Event('ended'));
    await wait(40);
    ok(win.SC70.sleep().mode === '', 'and when the song ends the timer has done its job');
    ok(pauses === 1, 'and it asks the app to pause (' + pauses + ' call(s))');
    win.__scPause = realPause;
    win.SC70.setSleep('15');
    ok(win.SC70.sleep().mode === '15' && /15 min/.test(win.SC70.sleepLabel()),
      'and a timed one counts down (' + win.SC70.sleepLabel() + ')');
    win.SC70.setSleep('off');
    ok(win.SC70.sleep().mode === '', 'and it can be cancelled');
    // --- the paid half: the practice loop
    audio.currentTime = 12;
    win.SC70.practiceMark('a');
    audio.currentTime = 20;
    win.SC70.practiceMark('b');
    ok(win.SC70.practice.a === 12 && win.SC70.practice.b === 20, 'the loop can be set to a section');
    // The loop only steps while the element says it is playing, and jsdom is
    // never playing anything, so this is the one thing that has to be forced.
    Object.defineProperty(audio, 'paused', { get: () => false, configurable: true });
    win.SC70.practiceRun();
    ok(win.SC70.practice.on === true, 'and it loops with nothing to unlock');
    audio.currentTime = 21;
    await wait(320);
    ok(audio.currentTime >= 12 && audio.currentTime < 20, 'and it really pulled playback back to the start of the section (' + audio.currentTime + ')');
    const passes = win.SC70.practice.passes;
    ok(passes >= 1, 'a pass was counted (' + passes + ')');
    const rateBefore = win.SC70.fx.rate;
    win.SC70.practice.ramp = true;
    win.SC70.practiceRun();
    win.SC70.practice.passes = 1;
    audio.currentTime = 21;
    await wait(320);
    ok(win.SC70.fx.rate > rateBefore, 'and the ramp speeds it up (' + rateBefore + 'x -> ' + win.SC70.fx.rate + 'x)');
    win.SC70.practiceStop();
    ok(win.SC70.practice.on === false, 'stopping the loop stops the seeking');
    // --- the paid half: your own presets
    win.localStorage.removeItem('sidecut_sidecut_studio_mypresets');
    win.SC70.myPresets().length = 0;
    win.SC70.fx.rate = 0.9; win.SC70.fx.reverb = 0.4; win.SC70.fx.karaoke = 0;
    const beforeCount = win.SC70.myPresets().length;
    win.SC70.saveMyPreset();
    ok(win.SC70.myPresets().length === beforeCount + 1, 'a preset saves with nothing to ask for');
    const saved = win.SC70.myPresets()[win.SC70.myPresets().length - 1];
    win.SC70.fx.rate = 1.2; win.SC70.fx.reverb = 0.1;
    win.SC70.useMyPreset(saved.id);
    ok(win.SC70.fx.rate === saved.rate && win.SC70.fx.reverb === saved.reverb, 'and recalling it puts the chain back');
    win.SC70.dropMyPreset(saved.id);
    ok(win.SC70.myPresets().length === beforeCount, 'and it can be deleted again');
  }

  console.log('[11g] a backup carries everything, at any size');
  {
    // 70.1.4 - "Make sure export includes everything all functions of the app".
    // The backup used to read the same size-capped sweep as the on-device
    // mirror, so any stored value past 256 KB was dropped from the zip. This
    // writes two of those - one localStorage key and one meta row - and asks the
    // collector the export actually calls for them back.
    const big = 'x'.repeat(300000);
    ok(typeof win.__scSnapCollect === 'function' && typeof win.__scSnapHydrate === 'function',
      'the backup collector and its hydrate are on the window');
    win.localStorage.setItem('sidecut_probe_big', big);
    await win.__scSnapHydrate({ v: 1, meta: { probeBigRow: big } });
    const state = await win.__scSnapCollect();
    ok(!!state && state.v === 1, 'the collector answers with a v1 state');
    ok(!!state && !!state.localStorage && state.localStorage.sidecut_probe_big === big,
      'a stored value past the snapshot cap rides in the backup');
    ok(!!state && !!state.meta && state.meta.probeBigRow === big,
      'and so does a meta row of the same size');
    ok(!!state && !!state.localStorage && state.localStorage.sidecut_pinned_snapshot === undefined,
      'while a pinned shell page is still kept out of it');
    // The mirror must NOT follow the backup up: it is rewritten every 1.5 s and
    // its own cap is the whole reason that stays cheap.
    ok(html.indexOf('var MAX_ITEM = 262144;') !== -1 && html.indexOf('if(valSize > MAX_ITEM) continue;') !== -1,
      'and the on-device mirror still skips oversized rows');
    win.localStorage.removeItem('sidecut_probe_big');
  }

  console.log('[11h] the search box clears, and the sheet and the cover are real');
  {
    // 70.1.5 - "in the search bar the actual regular one there needs to be a
    // clear button". Driven here: type, watch the list narrow to the match, tap
    // the X, and require the field, the query and the whole list back.
    doc.querySelector('#libraryBtn').click();
    await wait(120);
    const si = doc.querySelector('#searchInput');
    const x = doc.querySelector('#searchClearBtn');
    ok(!!si && !!x, 'the library search box has a clear button beside it');
    ok(html.indexOf('#searchInput:not(:placeholder-shown) + #searchClearBtn') !== -1,
      'and the stylesheet is what decides whether it is shown');
    if (si && x) {
      si.value = 'song 3';
      si.dispatchEvent(new win.Event('input', { bubbles: true }));
      await wait(140);
      const narrowed = doc.querySelectorAll('#listPane .track').length;
      ok(narrowed > 0 && narrowed < TRACKS.length, 'typing narrows the list (' + narrowed + ' of ' + TRACKS.length + ')');
      x.click();
      await wait(140);
      ok(si.value === '', 'tapping the X empties the field');
      ok(doc.querySelectorAll('#listPane .track').length === TRACKS.length,
        'and puts the whole list back (' + doc.querySelectorAll('#listPane .track').length + ')');
    }
    // The album cover picker is markup 70.1.5 added, and 70.2.1 moved the camera
    // off the album card into Manage albums. Driving it needs an album to exist,
    // so what is pinned here is where it is reached from: the row button in
    // Manage albums, and never the album header again.
    ok(html.indexOf('albumCoverBackdrop') !== -1 &&
      html.indexOf("bEl.querySelectorAll('.mgr-alb-cover')") !== -1 &&
      html.indexOf('alb-cover-btn') === -1,
      'and the cover picker is reached from Manage albums, not the album row');
    ok(html.indexOf('width:440px; max-width:calc(100vw - 32px)') !== -1,
      'with the Add songs sheet wide enough for its buttons');
  }

  console.log('[11i] the select bar and the Discover search row');
  {
    // 70.1.6. Driven, not read: select mode really builds a new header, and the
    // class on that header is what the stylesheet keys off. jsdom has no layout,
    // so what is claimed is the class and the wiring, not the pixel widths.
    doc.querySelector('#libraryBtn').click();
    await wait(120);
    const pick = win.__scGetAllTracks().slice(0, 2).map((t) => t.id);
    win.__scEnterSelect(pick);
    await wait(140);
    const bar = doc.querySelector('#listPane .pane-header');
    ok(!!bar && bar.classList.contains('select-bar'),
      'entering select mode marks the bar the stylesheet keeps one line tall');
    const marks = bar ? bar.className.split(' ').filter(Boolean) : [];
    ok(marks.length === 2 && marks.indexOf('pane-header') !== -1 && marks.indexOf('select-bar') !== -1,
      'and the class list is exactly the header plus the select mark (' + (bar ? bar.className : 'no bar') + ')');
    ok(doc.querySelectorAll('#listPane .pane-header .pane-actions .icon-btn').length >= 7,
      'with all seven of its actions still in it');
    const cancel = doc.querySelector('#selectCancelBtn');
    if (cancel) cancel.click();
    await wait(140);
    const after = doc.querySelector('#listPane .pane-header');
    ok(!!after && !after.classList.contains('select-bar'),
      'and cancelling takes the mark off again');
    // The Discover tab is deliberately not switched to here: showing it starts the
    // chart fetch, which cannot resolve in jsdom and would leave an error in the
    // boot log the next section asserts is clean. The row is static markup with a
    // real click handler either way.
    const wrap = doc.querySelector('#discoverSearchWrap');
    const field = doc.querySelector('#discoverSearch');
    const clear = doc.querySelector('#discoverSearchClear');
    const go = doc.querySelector('#discoverSearchBtn');
    ok(!!wrap && !!field && !!clear && !!go && field.parentElement === wrap && clear.parentElement === wrap,
      'the Discover field and its clear button are one control');
    if (field && clear) {
      field.value = 'BK';
      clear.click();
      ok(field.value === '', 'and the X empties the field');
    }
    ok(html.indexOf('#discoverSearch:not(:placeholder-shown) + #discoverSearchClear') !== -1,
      'with the stylesheet deciding whether it is on screen at all');
  }

  console.log('[11j] the DJ Mode loop controls do not lie');
  {
    // 70.1.7. There is no Web Audio and no decoded deck buffer in jsdom, which is
    // exactly the "nothing is armed" case these controls used to lie about: a beat
    // pad lit up over silence and Loop Lock went ON with nothing looping. What is
    // driven here is that they now stay OFF and say so - and that the pads own the
    // touch, which is the half of the fix a stylesheet can be wrong about.
    ok(doc.querySelectorAll('.beat-pad').length === 6, 'the six beat-repeat pads are there');
    const pad = doc.querySelector('.beat-pad[data-beats="0.25"]');
    if (pad) {
      pad.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
      await wait(60);
      ok(!pad.classList.contains('active'),
        'a pad that could not arm a slice does not light up as if it had');
    }
    const lock = doc.querySelector('#beatRepeatLockBtn');
    if (lock) {
      lock.click();
      await wait(60);
      ok(lock.textContent.indexOf('OFF') !== -1,
        'and Loop Lock does not claim ON over an empty deck (' + lock.textContent + ')');
    }
    ok(html.indexOf('.beat-pad, .fx-pad, .drum-pad, .hotcue-btn{ touch-action:none; }') !== -1,
      'with the pads owning the touch so a hold is not cancelled by the sheet');
    ok(html.indexOf("['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {") !== -1 &&
       html.indexOf("['pointerup','pointercancel','pointerleave'].forEach(ev => btn.addEventListener(ev, () => {") === -1,
      'and a held pad ending only when the finger really comes up');
  }

  console.log('[11k] SAVE COPY says what it needs');
  {
    // 70.1.8. SAVE COPY renders through an OfflineAudioContext, which jsdom does not
    // implement and the deck has no decoded buffer for either - so what is driven
    // here is that the control is on the deck, that tapping it with nothing loaded
    // says so instead of throwing, and that the copy is named rather than overwriting
    // the song that was loaded.
    const copyBtn = doc.querySelector('#djCopyBtn');
    ok(!!copyBtn, 'the DJ deck has a SAVE COPY button');
    if (copyBtn) {
      copyBtn.click();
      await wait(120);
      const said = doc.querySelector('#toast');
      ok(!!said && /load a song|still being read|cannot render/i.test(said.textContent || ''),
        'and it says what it is waiting for instead of failing silently (' + (said ? said.textContent : '') + ')');
    }
    ok(html.indexOf(" + ' (DJ edit)';") !== -1,
      'with the copy named as an edit so the original keeps its own title');
    ok(html.indexOf('scAddConvertedToLibrary(blob, meta') !== -1,
      'and going in through the library path a finished conversion uses');
  }

  console.log('[11l] a tip from a copy that cannot bill');
  {
    // 70.1.9. A copy that cannot bill used to end every tip at a sentence. What
    // has to be true now is that a tier with its own card page opens it in the
    // browser, that the pane says which amounts those are, and that an amount
    // with no page still ends in the Play listing the way the earlier release
    // left it.
    const pages = {};
    const dlBlock = html.slice(html.indexOf('donateLinks: {'));
    const dlSeg = dlBlock.slice(0, dlBlock.indexOf('}'));
    for (const m of dlSeg.matchAll(/(\d+): '(https:\/\/[^']+)'/g)) pages[m[1]] = m[2];
    ok(Object.keys(pages).length >= 4, 'the Donate tab names a card page per amount (' + Object.keys(pages).sort((a, b) => a - b).map((n) => '$' + n).join(', ') + ')');
    const realOpen = win.open;
    const opened = [];
    Object.defineProperty(win, 'open', { value: (url) => { opened.push(String(url)); return null; }, writable: true, configurable: true });
    win.showSettingsTab('donate');
    const pane = doc.querySelector('#settingsPaneDonate');
    const promise = doc.querySelector('#donatePromise');
    ok(!!promise && promise.textContent.indexOf('secure card page') !== -1,
      'and the pane says a card page is one of the rails (' + (promise ? promise.textContent : '') + ')');
    const intro = doc.querySelector('#donateIntro');
    ok(!!intro && intro.textContent.indexOf('secure card page') !== -1,
      'and the paragraph above it says the same on a copy that can take one');
    const tier = pane && pane.querySelector('.donate-quick[data-amt="5"]');
    ok(!!tier, 'the five dollar tier is still a button in the pane');
    if (tier) {
      tier.click();
      await wait(250);
      ok(opened.length === 1 && opened[0] === pages['5'],
        'and tapping it opens the card page for that amount (' + (opened[0] || 'nothing') + ')');
      const said = doc.querySelector('#donateMsg');
      ok(!!said && /card page/i.test(said.textContent || ''),
        'with a sentence saying where it went');
    }
    opened.length = 0;
    // 71.4. "on apk/web version it should only display on donations the actual
    // ones that bring you to stripe only 2,5,10,25,50 should display and it
    // should say brings you through stripe for donations". A copy with no
    // Billing can only be paid on a card page, so a tier with no page behind it
    // is not a tier this copy can take: it is gone from the pane instead of
    // ending in a detour to the Play listing.
    const shown = Array.from(pane.querySelectorAll('.donate-quick'))
      .filter((b) => b.style.display !== 'none')
      .map((b) => b.dataset.amt);
    ok(shown.join(',') === '2,5,10,25,50',
      'a copy with no Billing shows only the amounts that really open a card page (' + shown.join(',') + ')');
    const hidden = Array.from(pane.querySelectorAll('.donate-quick'))
      .filter((b) => b.style.display === 'none')
      .map((b) => b.dataset.amt);
    ok(hidden.join(',') === '1,3,7,15,75,100',
      'and every tier with no card page behind it is hidden (' + hidden.join(',') + ')');
    const odd = pane && pane.querySelector('.donate-quick[data-amt="7"]');
    ok(!!odd && odd.style.display === 'none', 'the seven dollar tier is one of them');
    ok(/Stripe/.test(promise.textContent || ''), 'and the pane says the tip comes through Stripe');
    ok(!!intro && /Stripe/.test(intro.textContent || ''), 'in the paragraph above it as well');
    Object.defineProperty(win, 'open', { value: realOpen, writable: true, configurable: true });
  }

  console.log('[11m] the copy installed from Google Play is the app it was');
  {
    // 70.1.9. The user drew this line himself: "the play build should stay as is
    // with play billing no stripe for that". So the store build is booted AS the
    // store build and its Donate pane is compared with the sentences the release
    // before this one shipped. A card page must be unreachable from it, and no
    // sentence of it may mention one.
    const store = boot('play');
    await wait(1500);
    const swin = store.win;
    const sdoc = swin.document;
    swin.showSettingsTab('donate');
    await wait(150);
    const sPromise = sdoc.querySelector('#donatePromise');
    ok(!!sPromise && sPromise.textContent === 'Pick an amount — Google Play handles the payment.',
      'the store build still promises Google Play alone (' + (sPromise ? sPromise.textContent : '') + ')');
    const sIntro = sdoc.querySelector('#donateIntro');
    ok(!!sIntro && sIntro.textContent.indexOf('processed through Google Play') !== -1 &&
       sIntro.textContent.indexOf('secure card page') === -1,
      'and its paragraph is the one it shipped, with no card page in it');
    const sOpened = [];
    const sRealOpen = swin.open;
    Object.defineProperty(swin, 'open', { value: (url) => { sOpened.push(String(url)); return null; }, writable: true, configurable: true });
    const sTier = sdoc.querySelector('.donate-quick[data-amt="5"]');
    ok(!!sTier, 'with its tip tiers still there');
    if (sTier) {
      sTier.click();
      await wait(300);
      ok(sOpened.length === 1 && /play\.google\.com/.test(sOpened[0]),
        'and a tap on one still ends in the Play listing, never a card page (' + (sOpened[0] || 'nothing') + ')');
      const sSaid = sdoc.querySelector('#donateMsg');
      ok(!!sSaid && sSaid.textContent.indexOf('card page') === -1,
        'with nothing it says naming a card page');
    }
    // 71.4: the store build is the one copy nothing about the tier hiding
    // touches - every tier is still on the deck and every one of them is Play's.
    const sAll = Array.from(sdoc.querySelectorAll('#settingsPaneDonate .donate-quick'));
    ok(sAll.length === 11, 'the store build still lists all eleven tiers (' + sAll.length + ')');
    ok(sAll.every((b) => b.style.display !== 'none'), 'and hides none of them');
    ok(sPromise.textContent.indexOf('Stripe') === -1, 'with nothing it says naming Stripe');
    Object.defineProperty(swin, 'open', { value: sRealOpen, writable: true, configurable: true });
  }

  console.log('[11n] a tip from the sideloaded package, where Billing exists and refuses');
  {
    // 70.2.0. The user's report, driven: "the stripe is not linked on the apk
    // while on the web it is". This boot IS that package - Capacitor present,
    // NativePurchases present, Play answering with no products - and window.open
    // stubbed to answer null the way the WebView does, so the address fallback is
    // what has to carry the tap. jsdom reports the fallback as a refused
    // navigation, which is how it can be seen at all.
    const apk = boot('apk');
    await wait(1500);
    const awin = apk.win;
    const adoc = awin.document;
    const links = {};
    const dl = html.slice(html.indexOf('donateLinks: {'));
    for (const m of dl.slice(0, dl.indexOf('}')).matchAll(/(\d+): '(https:\/\/[^']+)'/g)) links[m[1]] = m[2];
    awin.showSettingsTab('donate');
    await wait(150);
    const opened = [];
    const realOpen = awin.open;
    Object.defineProperty(awin, 'open', { value: (url) => { opened.push(String(url)); return null; }, writable: true, configurable: true });
    const tier = adoc.querySelector('.donate-quick[data-amt="5"]');
    ok(!!tier, 'the five dollar tier is on the deck on the package built for sideloading');
    if (tier) {
      tier.click();
      await wait(350);
      ok(opened.length === 1 && opened[0] === links['5'],
        'and a tap on it opens the card page the browser copy already reached (' + (opened[0] || 'nothing') + ')');
      ok(apk.errors.some((e) => /Not implemented: navigation/.test(e)),
        'because the address was handed to Android, not only to window.open()');
      const said = adoc.querySelector('#donateMsg');
      ok(!!said && /card page/i.test(said.textContent || ''),
        'with a sentence saying where it went');
    }
    Object.defineProperty(awin, 'open', { value: realOpen, writable: true, configurable: true });
  }

  console.log('[11o] the widget heartbeat switch, driven on a pushed theme');
  {
    // 71.5. The user's words: "This heartbeat is way too fast in the widgit and
    // it's it necessary like is their a way to hide it like I don't see other
    // widgits have it". The bars live in the Android widget, so the only honest
    // way to check the web half is to flip the switch in the booted app and read
    // the theme it pushes - which is exactly what a placed widget is handed.
    const w = boot('apk');
    await wait(1500);
    const wwin = w.win;
    const wdoc = wwin.document;
    wwin.showSettingsTab('widget');
    await wait(150);
    const row = wdoc.querySelector('#widgetBarsRow');
    const tog = wdoc.querySelector('#widgetBarsToggle');
    ok(!!row && !!tog, 'Settings > Widget offers the Playing bars switch');
    ok(!!tog && tog.checked === true, 'and a copy that has never touched it starts with the bars on');
    ok(!!row && /Playing bars/.test(row.textContent || ''), 'the row is labelled Playing bars');
    ok(!!row && /equalizer/.test(row.textContent || ''), 'and says what the bars are');
    ok(!!row && /every widget you have placed/.test(row.textContent || ''),
      'and that off means off on every widget, not just this one');
    if (tog) {
      const before = widgetThemePushes.length;
      tog.click();
      await wait(250);
      ok(tog.checked === false, 'tapping it turns the switch off');
      ok(widgetThemePushes.length === before + 1,
        'and pushes the widget state on the spot, without waiting for a beat (' + (widgetThemePushes.length - before) + ')');
      ok((widgetThemePushes[widgetThemePushes.length - 1] || {}).eq === false,
        'the theme that reached the widget says the bars are off (eq=' + JSON.stringify((widgetThemePushes[widgetThemePushes.length - 1] || {}).eq) + ')');
      ok(String(wwin.localStorage.getItem('sidecut_widgetBars')) === '0', 'and the answer is stored on the device');
      ok(!/border-radius:2px/.test(wdoc.getElementById('widgetThemePreview').innerHTML),
        'the preview drops the bars with it');
      tog.click();
      await wait(250);
      ok(tog.checked === true, 'tapping it again turns the switch back on');
      ok((widgetThemePushes[widgetThemePushes.length - 1] || {}).eq === true,
        'all the way to the widget');
      ok(String(wwin.localStorage.getItem('sidecut_widgetBars')) === '1', 'with the stored answer following');
      ok(/border-radius:2px/.test(wdoc.getElementById('widgetThemePreview').innerHTML),
        'and the preview drawing them again');
    }
  }

  console.log('[11p] the albums the cleanup took, rebuilt from the tags on the songs');
  {
    // 71.6. The owner's words: "Why did all of my albums disappear" - answered
    // "Library > Albums tab AND Manage albums", "All my songs are still there",
    // "It's purely because of the apk because on the play version my albums are
    // still there". That is 63.1.4's sweep running for the first time on a newly
    // installed APK: it deletes album ENTRIES older builds wrote for themselves,
    // and never a tag on a file. So this case boots exactly that library - the
    // tags are on the songs, one app-created entry is still in the store - and
    // then drives the way back the release adds.
    const b = bootWithAlbumTags('apk', {
      userAlbums: { 'Album 1': { artist: 'Artist 1', trackIds: ['t1'], createdAt: 1, auto: true } },
    }, (track, index) => 'Song ' + (index + 1));
    await wait(1500);
    const bwin = b.win;
    const bdoc = bwin.document;

    ok(bwin.__scGetAllTracks().length === 12, 'the songs are all still there, as they were on the phone');
    ok(bwin.__scVisibleAlbumNames().length === 0,
      'and the launch sweep has taken the app-created album, exactly as it did on the new APK (' +
      bwin.__scVisibleAlbumNames().join(',') + ')');
    ok(bwin.__scAutoAlbumNames().length === 0, 'with nothing left for it to take a second time');
    bwin.__scGetAllTracks().forEach((t, index) => { t.album = 'Album ' + (index % 2); });
    ok(bwin.__scGetAllTracks().every((t) => String(t.album || '') === 'Album 0' || String(t.album || '') === 'Album 1'),
      'and every song still carries its album tag - which is what the way back reads');

    // The way back, where anyone whose albums disappeared looks first.
    bwin.navigate('albums');
    await wait(300);
    try { bwin.renderList(); } catch (e) {}
    await wait(250);
    const bpane = bdoc.getElementById('listPane');
    const rebuildBtn = bdoc.getElementById('albRebuildBtn');
    ok(!!rebuildBtn, 'the empty Albums tab offers Rebuild albums from my songs');
    ok(!!rebuildBtn && /Rebuild albums/.test(rebuildBtn.textContent || ''),
      'and the button says what it does (' + ((rebuildBtn && rebuildBtn.textContent) || '') + ')');
    // 71.7 put the backup restore next to it, because that is the copy that has
    // the real albums, and the note under both says which is which.
    const rbRestore = bdoc.getElementById('albRestoreBtn');
    ok(!!rbRestore && /Restore from my backup/.test(rbRestore.textContent || ''),
      'with the backup restore beside it');
    const rbNote = bpane ? bpane.lastElementChild : null;
    ok(!!rbNote && /backup/i.test(rbNote.textContent || ''),
      'and a line saying which of the two has the albums that were there');
    ok(!!bpane && bpane.querySelectorAll('[data-album-name]').length === 0, 'and there is nothing in the grid yet');

    if (rebuildBtn) {
      rebuildBtn.click();
      await wait(250);
      // 71.7 - the button opens the sheet rather than rebuilding on the spot, so
      // this taps the sheet's own primary button to get the rebuild.
      const sheet = bdoc.getElementById('albRebuildSheet');
      ok(!!sheet, 'and it opens the sheet that says what a rebuild would make');
      const multiBtn = bdoc.getElementById('albRebuildMulti');
      ok(!!multiBtn, 'whose primary button is the shared-tag albums');
      if (multiBtn) multiBtn.click();
      await wait(400);
      const names = bwin.__scVisibleAlbumNames().slice().sort();
      ok(names.join(',') === 'Album 0,Album 1',
        'tapping it makes one album per album tag on the songs (' + names.join(',') + ')');
      const albs = bwin.__scGetUserAlbums();
      ok(!!albs['Album 0'] && albs['Album 0'].trackIds.length === 6,
        'and the first one holds the six songs that carry its tag (' +
        ((albs['Album 0'] && albs['Album 0'].trackIds.length) || 0) + ')');
      ok(!!albs['Album 1'] && albs['Album 1'].trackIds.length === 6, 'and so does the other');
      ok(!!albs['Album 0'] && albs['Album 0'].manual === true && albs['Album 0'].auto === undefined,
        'each one is marked as yours, which is the mark the sweep never touches');
      ok(bwin.__scRemoveAutoAlbums() === 0 && bwin.__scVisibleAlbumNames().length === 2,
        'so the next launch sweep finds nothing to take, and they survive it');
      ok(bwin.__scGetAllTracks().every((t) => String(t.album || '') === 'Album 0' || String(t.album || '') === 'Album 1'),
        'and not one song was re-tagged by the rebuild');
      const cards = bpane.querySelectorAll('[data-album-name]');
      ok(cards.length === 2, 'the Albums tab draws them as cards (' + cards.length + ')');
      ok(Array.from(cards).map((c) => c.dataset.albumName).sort().join(',') === 'Album 0,Album 1',
        'under their own names');
      ok(!bdoc.getElementById('albRebuildBtn'), 'and the button is gone, because the screen is not empty any more');
      // And the restore half of the release: an album out of your OWN backup
      // must not arrive wearing the marker the sweep looks for. These hydrate
      // paths live in a different block of the same page, so the helper has to
      // resolve where they run - which is why this drives the hydrate for real
      // and reads the row it wrote, instead of reading the source.
      await bwin.__scSnapHydrate({
        v: 1,
        localStorage: {},
        meta: { userAlbums: { 'Backup Album': { artist: 'Someone', trackIds: ['t2'], createdAt: 2, auto: true } } },
      });
      await wait(250);
      const storedRow = await new Promise((res) => {
        const req = bwin.indexedDB.open('sidecut_local_db', 1);
        req.onsuccess = () => {
          const tx = req.result.transaction('meta');
          const q = tx.objectStore('meta').get('userAlbums');
          q.onsuccess = () => res(q.result);
        };
      });
      const backAlb = storedRow && storedRow.value && storedRow.value['Backup Album'];
      ok(!!backAlb, 'a full-state restore still writes the albums it brought');
      ok(!!backAlb && backAlb.manual === true && backAlb.auto === undefined,
        'and they arrive marked as yours, not as the app\'s own');
      ok(!!backAlb && backAlb.trackIds.join(',') === 't2', 'with their songs left exactly as the backup had them');

      // A second run is a no-op: nothing is duplicated and nothing is lost.
      const again = bwin.__scRebuildAlbumsFromTags();
      await wait(150);
      ok(again === 0, 'asking again has nothing left to rebuild');
      ok(bwin.__scVisibleAlbumNames().length === 2 &&
         bwin.__scGetUserAlbums()['Album 0'].trackIds.length === 6,
        'and the albums it made are untouched by it');
    }
  }

  console.log('[11q] a rebuild that cannot make one album per song, and the undo');
  {
    // 71.7. The owner's words after 71.6: "you made every single damn song be an
    // album of it's own fix it and I need my songs in the correct order in albums
    // and I'm missing songs inside of albums". The tag rebuild ran on one tap and
    // took EVERY tag - on files whose album field holds the song's own name, that
    // is one album per song. This case builds exactly that library and checks
    // that the default can no longer touch it, that asking for all of them still
    // works, and that one tap puts the albums back.
    const c = bootWithAlbumTags('apk', {
      userAlbums: { 'Kept Group': { artist: 'Someone', trackIds: ['t1'], createdAt: 1, manual: true } },
    }, (track, index) => 'Song ' + (index + 1));
    await wait(1500);
    const cwin = c.win;
    const cdoc = cwin.document;
    const tracks = cwin.__scGetAllTracks();
    const byId = {};
    tracks.forEach((t) => { byId[t.id] = t; });
    ['t1', 't2', 't3', 't4'].forEach((id) => { byId[id].album = 'Record A'; });
    ['t5', 't6', 't7', 't8'].forEach((id) => { byId[id].album = 'Record B'; });
    ['t9', 't10', 't11', 't12'].forEach((id) => { byId[id].album = 'Song ' + id.slice(1); });

    const plan = cwin.__scAlbumRebuildPlan();
    ok(plan.tags.length === 6, 'the songs carry six album tags (' + plan.tags.length + ')');
    ok(plan.multi === 2 && plan.single === 4,
      'two of them on several songs and four on one (' + plan.multi + ' / ' + plan.single + ')');

    // The sheet, and what it offers to make.
    cwin.__scAlbumRebuildPrompt();
    await wait(150);
    const sheet = cdoc.getElementById('albRebuildSheet');
    ok(!!sheet, 'the rebuild opens a sheet before it does anything');
    ok(!!sheet && /6<\/b> album tags/.test(sheet.innerHTML), 'which counts the tags on the songs');
    ok(!!sheet && /2<\/b> appear on more than one song/.test(sheet.innerHTML), 'and the ones on several songs');
    ok(!!sheet && /one album per song/.test(sheet.innerHTML), 'and says what the per-song tags are');
    const multiBtn = cdoc.getElementById('albRebuildMulti');
    const allBtn = cdoc.getElementById('albRebuildAll');
    ok(!!multiBtn && /Rebuild the 2 albums/.test(multiBtn.textContent || ''),
      'the primary button names the two albums it would make (' + ((multiBtn && multiBtn.textContent) || '') + ')');
    ok(!!allBtn && /Rebuild all 6/.test(allBtn.textContent || ''), 'the second offers every tag, spelled out');
    cdoc.getElementById('albRebuildCancel').click();
    await wait(150);
    ok(!cdoc.getElementById('albRebuildSheet'), 'cancelling closes the sheet');
    ok(cwin.__scVisibleAlbumNames().slice().sort().join(',') === 'Kept Group', 'and makes no album at all');

    // The default: only the shared tags.
    const added = cwin.__scRebuildAlbumsFromTags();
    await wait(400);
    ok(added === 2, 'the default rebuild makes two albums (' + added + ')');
    const names = cwin.__scVisibleAlbumNames().slice().sort();
    ok(names.join(',') === 'Kept Group,Record A,Record B', 'one per shared tag (' + names.join(',') + ')');
    ok(names.every((n) => !/^Song \d+$/.test(n)), 'and not one album per song, which is what it used to do');
    const albs = cwin.__scGetUserAlbums();
    ok(albs['Record A'].trackIds.join(',') === 't1,t2,t3,t4',
      'the rebuilt album keeps every song with its tag, including one also filed in another album (' + albs['Record A'].trackIds.join(',') + ')');
    ok(albs['Kept Group'].trackIds.join(',') === 't1', 'so the album that was there keeps its own song');
    ok(!!cwin.__scAlbumUndoAvailable(), 'and an undo point is waiting');

    // Asking for every tag still works - and is what the undo has to cover.
    cwin.__scAlbumRebuildPrompt();
    await wait(150);
    cdoc.getElementById('albRebuildAll').click();
    await wait(400);
    ok(cwin.__scVisibleAlbumNames().length === 7,
      'asking for all of them rebuilds every tag (' + cwin.__scVisibleAlbumNames().length + ')');

    // The panel's own buttons, and the undo taken through the one that is really
    // there - so this covers the markup and the wiring as well as the function.
    // A rebuild re-renders Manage albums itself (`refreshManageAlbums(true)`), so
    // the panel is already on screen; nothing here has to reach a private opener.
    await wait(200);
    const panelBody = cdoc.getElementById('discPopupBody');
    ok(!!panelBody && !!cdoc.getElementById('mgrAlbumRebuild'), 'Manage albums offers the rebuild');
    ok(!!cdoc.getElementById('mgrAlbumUndo'), 'and an undo, while a rebuild is really undoable');
    ok(!!cdoc.getElementById('mgrAlbumRestore'), 'and the backup restore beside them');
    ok(!!panelBody && /Undo the last rebuild/.test(panelBody.textContent || ''), 'with the undo spelled out');
    ok(!!panelBody && /names, songs and their order/.test(panelBody.textContent || ''),
      'and a line saying what the backup brings back that a tag cannot');

    // One tap back: the state before the FIRST rebuild, not before the second.
    ok(!!cdoc.getElementById('mgrAlbumUndo'), 'the undo button is there to tap');
    cdoc.getElementById('mgrAlbumUndo').click();
    await wait(400);
    ok(cwin.__scVisibleAlbumNames().slice().sort().join(',') === 'Kept Group',
      'and it is the list from before the first rebuild (' + cwin.__scVisibleAlbumNames().join(',') + ')');
    ok(cwin.__scGetUserAlbums()['Kept Group'].trackIds.join(',') === 't1', 'with its songs exactly as they were');
    ok(cwin.__scAlbumUndoAvailable() === null, 'the undo point is spent once it is used');

    // And with nothing but per-song tags, the default refuses instead of making
    // the library again wearing album cards.
    tracks.forEach((t) => { t.album = 'Solo ' + t.id; });
    const none = cwin.__scRebuildAlbumsFromTags();
    await wait(250);
    ok(none === 0, 'with only per-song tags the default makes nothing at all');
    ok(cwin.__scVisibleAlbumNames().slice().sort().join(',') === 'Kept Group', 'and leaves the albums alone');
    ok(cwin.__scAlbumUndoAvailable() === null, 'without arming an undo point for a rebuild it did not do');

    // And the import's third chance at a song, which is what "I'm missing songs
    // inside of albums" comes from: the content key the importer matches on is
    // name + artist + duration, so one that missed is looked up by the name the
    // backup recorded, before being dropped out of its album.
    ok(cwin.__scAlbumFindByTitle('song 1', 'ARTIST 1') === 't1',
      'a title that differs only in case still finds its song');
    ok(cwin.__scAlbumFindByTitle('Song 1', 'Nobody At All') === 't1',
      'and the artist fallback keeps a song whose artist was retagged');
    ok(cwin.__scAlbumFindByTitle('Not A Song At All', '') === null, 'while a name that is not here matches nothing');
  }

  console.log('[11r] a playlist can be deleted from the Library');
  {
    // 71.9. The owner's second ask: "add a delete playlist function in library".
    // This drives the ONE delete path through the real in-app confirmation, so it
    // covers the wiring as well as the function, and it proves the two lists that
    // are not the user's are refused rather than silently removed.
    const c = boot('apk', {
      playlists: { 'All Songs': TRACKS.map((t) => t.id), Favorites: ['t3', 't4'], 'Road Trip': ['t1', 't2', 't3'], Spare: ['t5'] },
    });
    await wait(1600);
    const cwin = c.win;
    const cdoc = cwin.document;
    const pl = cwin.__scGetPlaylists();
    ok(!!pl['Road Trip'] && !!pl.Spare, 'the library boots with playlists to delete');

    // The Library tab, so the list header (and its kebab) is on screen at all.
    const libTab = cdoc.querySelector('#libraryBtn');
    ok(!!libTab, 'the dock has a Library tab');
    if (libTab) libTab.click();
    await wait(200);

    // The kebab menu, then Manage playlists, exactly as a tap would.
    const more = cdoc.getElementById('listMoreBtn');
    ok(!!more, 'the list header carries the kebab that opens Manage playlists');
    if (more) more.click();
    await wait(80);
    const menu = cdoc.getElementById('songActionsList');
    const manage = Array.from(menu.querySelectorAll('button')).find((b) => /Manage playlists/.test(b.textContent || ''));
    ok(!!manage, 'the list menu still offers Manage playlists');
    if (manage) manage.click();
    await wait(80);
    ok(cdoc.getElementById('managePlaylistsBackdrop').style.display === 'flex', 'which opens the panel');
    const rows = Array.from(cdoc.getElementById('managePlaylistsList').querySelectorAll('button'));
    const bins = rows.filter((b) => b.title === 'Delete playlist');
    ok(bins.length === 2, 'every playlist you can delete carries a bin, and only those (' + bins.length + ')');

    // The two lists that are not the user's to delete are refused by the path.
    ok((await cwin.__scDeletePlaylist('All Songs')) === false, 'Library cannot be deleted');
    ok(!!cwin.__scGetPlaylists()['All Songs'], 'and it is still there');
    ok((await cwin.__scDeletePlaylist('Favorites')) === false, 'Favorites cannot be deleted');
    ok(!!cwin.__scGetPlaylists().Favorites, 'and it is still there too');
    // 71.9, caught by this very probe: the app stores a REAL 'Unsorted' list
    // (imports land in it) behind the virtual tab, and UNSORTED_VIEW is the
    // virtual name - so refusing only that left the stored list deletable.
    ok((await cwin.__scDeletePlaylist('Unsorted')) === false, 'and neither can the stored Unsorted list');
    ok(!!cwin.__scGetPlaylists().Unsorted, 'which is still there as well');
    ok((await cwin.__scDeletePlaylist('Not A Playlist')) === false, 'a name that is not a playlist deletes nothing');

    // Delete for real, through the confirmation the app shows.
    const del = cwin.__scDeletePlaylist('Road Trip');
    await wait(80);
    const yes = cdoc.getElementById('_modalConfirmYes');
    const msg = cdoc.getElementById('_modalConfirmMsg');
    ok(!!yes, 'deleting asks with the app\'s own confirmation, not confirm()');
    ok(!!msg && /3 songs/.test(msg.textContent || ''), 'which counts the songs that stay in the library');
    if (yes) yes.click();
    ok((await del) === true, 'confirming deletes the playlist');
    ok(!cwin.__scGetPlaylists()['Road Trip'], 'and it is gone from the library');
    ok(cwin.__scGetAllTracks().length === TRACKS.length, 'while none of its songs are touched');
    ok(!cdoc.getElementById('_modalConfirmYes'), 'and the confirmation is taken down again');

    // And cancelling keeps it - a delete that cannot be called off is not one.
    const del2 = cwin.__scDeletePlaylist('Spare');
    await wait(80);
    const no = cdoc.getElementById('_modalConfirmNo');
    ok(!!no, 'the confirmation has a way out');
    if (no) no.click();
    ok((await del2) === false, 'cancelling deletes nothing');
    ok(!!cwin.__scGetPlaylists().Spare, 'and the playlist is still there');
  }

  console.log('[12] the page still holds together');
  {
    const bad = realErrors(errors);
    ok(bad.length === 0, 'the boot log is clean' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
    ok(win.__scGetAllTracks().length === TRACKS.length, 'the library still loads');
  }

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
