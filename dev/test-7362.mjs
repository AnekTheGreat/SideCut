// v73.6.2 - DJ Mode joins Studio, and the built-in assistant stops answering the
// wrong question.
//
// The owner, with a screenshot of the chat answering "Can I compact my library"
// with the playlist share-code paragraph: "This AI is just complete wrong and the
// dj mode should also be like shown in studio because that makes sense update old
// things not updates v73.6.2".
//
// TWO THINGS, BOTH DRIVEN HERE.
//
//   1. THE ASSISTANT. Compressing the library shipped in 73.4.9 and never got an
//      entry in the built-in knowledge base, so the question about it was matched
//      against whatever paragraph the matcher landed on - a playlist share code.
//      The matcher was the other half of it: short fragments of an entry counted
//      as hits, so the letters inside "can" and "compact" scored that entry on
//      every word. Both halves are checked here: the ANSWER through the real chat
//      box, and the MATCHER itself, lifted out of the shipped file and asked the
//      reported question.
//
//   2. THE DECK. DJ Mode could only be reached from the DJ MODE chip under the
//      player. It is a Studio tool card now, first in the rack, and this drives
//      that card: it opens the app's own rig, the rig gets the song, closing it
//      hands the song back, and a playlist that has opted out says so instead of
//      opening nothing.
//
//   [1] release metadata - APP_VERSION, the head entry, the shell cache;
//   [2] the assistant, through the chat box (driven);
//   [3] the matcher behind it, lifted out of the page (driven);
//   [4] the Studio DJ Mode card (driven);
//   [5] inline script syntax, and the two-newline OTA tail.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.6.2';
const SHELL_CACHE = 'sidecut-shell-v73.6.2';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    ok(String(head.version) === VER, 'the newest entry is this release (' + head.version + ')');
    ok((head.items || []).length >= 6, 'with at least six notes (' + (head.items || []).length + ')');
    ok(!/['\u2019]/.test((head.items || []).join(' ')), 'and no apostrophe anywhere in them');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test((head.items || []).join(' ')),
       'and no downloader or converter term');
    ok(String(head.date).endsWith('EDT'), 'the ship stamp is Eastern (' + head.date + ')');
  }
  ok(sw.includes("const CACHE_NAME = '" + SHELL_CACHE + "'"), 'the shell cache is this release name');
}

/* --------------------------------------------------------------- fake audio */
// The app's boot reaches for a wide slice of the Web Audio API (the deck, the
// scratch engine, the analysers), so the fake has to answer all of it or an
// uncaught TypeError in block 1 stops the app booting - which is what this probe
// needs, because the DJ card opens the real deck.
function fakeBuffer(ch, len, sr) {
  const data = [];
  for (let i = 0; i < ch; i++) data.push(new Float32Array(len));
  return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr,
           getChannelData: (i) => data[Math.min(i, data.length - 1)] };
}
function anode(extra) {
  const n = {
    connect() { return n; }, disconnect() {}, start() {}, stop() {},
    gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
    frequency: { value: 0 }, Q: { value: 0 },
    threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
    delayTime: { value: 0 }, pan: { value: 0 }, offset: { value: 0 }, playbackRate: { value: 1 },
    type: '', value: 0, buffer: null, loop: false, stream: {}, fftSize: 1024, frequencyBinCount: 512,
    getByteFrequencyData() {}, getByteTimeDomainData() {}, getFloatFrequencyData() {},
    createPeriodicWave() { return {}; }, setPeriodicWave() {}, curve: null, oversample: 'none',
    reduction: 0, normalRange: {}, getFrequencyResponse() {},
  };
  return Object.assign(n, extra || {});
}
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
const TRACK_META = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186, playCount: 12, dateAdded: 1001, blobType: 'audio/mpeg', fileName: 'luna.mp3' },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155, playCount: 8, dateAdded: 1002, blobType: 'audio/mpeg', fileName: 'vibe.mp3' },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182, playCount: 5, dateAdded: 1003, blobType: 'audio/mpeg', fileName: 'champagne.mp3' },
];
// A devotional playlist: DJ Mode steps aside for these by name, and the Studio
// card has to say so rather than opening nothing.
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3'], Favorites: ['t2'], Paath: ['t1', 't3'] };
function buildTracks(win) {
  return TRACK_META.map((m) => Object.assign({}, m, { blob: new win.Blob([new win.Uint8Array(4096)], { type: 'audio/mpeg' }) }));
}
function fakeIndexedDB(win) {
  const data = {
    tracks: new Map(buildTracks(win).map((t) => [t.id, t])),
    meta: new Map([['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }]]),
  };
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

function boot() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(src, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return make2dCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      win.HTMLMediaElement.prototype.pause = function () {};
      win.HTMLMediaElement.prototype.load = function () {};
      win.indexedDB = fakeIndexedDB(win);
      win.AudioContext = FakeAudioContext;
      win.webkitAudioContext = FakeAudioContext;
      win.URL.createObjectURL = () => 'blob:jsdom-' + (win.__scObjN = (win.__scObjN || 0) + 1);
      win.URL.revokeObjectURL = () => {};
      win.confirm = () => true;
      win.localStorage.clear();
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, errors, win: dom.window };
}

const asked = async (win, text) => {
  const input = win.document.getElementById('aiChatInput');
  const send = win.document.getElementById('aiChatSend');
  input.value = text;
  send.click();
  for (let i = 0; i < 40 && win.document.getElementById('aiTypingIndicator'); i++) await wait(50);
  await wait(60);
  const box = win.document.getElementById('aiChatMessages');
  const last = box && box.lastElementChild;
  return last ? (last.textContent || '') : '';
};

const strip = (win) => win.document.querySelectorAll('#studioView [data-tool]');

// ---------------------------------------------------------------------------
const { win, errors } = boot();
await wait(7000);

console.log('[2] the built-in assistant, through the chat box (driven)');
{
  // The chat is wired when the Support pane is opened, so it is opened the way a
  // user opens it - Settings, then the Support tab - and the question is typed
  // into the real box and sent with the real button.
  const tab = win.document.getElementById('settingsTabSupport');
  ok(!!tab, 'Settings has a Support tab');
  if (tab) tab.click();
  await wait(120);
  ok(win.document.getElementById('settingsPaneSupport').style.display !== 'none', 'and opening it shows the chat');
  ok(!!win.document.getElementById('aiChatMessages').lastElementChild, 'with the assistant welcome already in it');

  const reply = await asked(win, 'Can I compact my library');
  ok(!!reply, 'the chat answers (' + reply.slice(0, 46) + '...)');
  ok(/Compress library/i.test(reply), 'a question about compacting the library is answered about Compress library');
  ok(/Settings/.test(reply) && /More/.test(reply), 'and says where it is (Settings - More)');
  ok(!/Share by code|share a playlist/i.test(reply), 'and never mentions sharing a playlist');
  const status = win.document.getElementById('aiChatStatus').textContent || '';
  ok(/knowledge base/i.test(status), 'the status line says the app answered it (' + status + ')');

  const dj = await asked(win, 'how do I open dj mode');
  ok(/DJ Mode/.test(dj), 'the DJ Mode question is answered about DJ Mode (' + dj.slice(0, 46) + '...)');
  ok(/turntable|deck/i.test(dj), 'and describes the deck');
  ok(!/automatically plays related songs/i.test(dj), 'the autoplay paragraph that described nothing is gone');
  ok(/Studio/.test(dj), 'and it names Studio as one of the two ways in');

  const crop = await asked(win, 'how do I crop a song');
  ok(/Crop song/.test(crop), 'while a question that always worked still finds its own answer');

  const hello = await asked(win, 'hi');
  ok(/SideCut/i.test(hello) && !/Album History/.test(hello), 'a bare greeting is still answered as a greeting');
  ok(errors.length === 0, 'the page throws nothing while the chat runs' + (errors.length ? ': ' + errors[0] : ''));
}

console.log('[3] the matcher behind it (driven)');
{
  // The shipped matcher and the shipped knowledge base, lifted out of the page
  // and asked directly - this is the half that was wrong, so it is the half that
  // has to be asked, not a grep for the shape of the fix.
  const s = src.indexOf('function _aiGreetingReply(msg) {');
  const e = src.indexOf('\n}\n', s);
  const kbS = src.indexOf('var _aiKB = [');
  const kbE = src.indexOf('];', kbS) + 2;
  const matchS = src.indexOf('function _aiFuzzyMatch(query, minScore) {');
  const matchE = src.indexOf('\n}\n', matchS);
  ok(s !== -1 && e !== -1 && kbS !== -1 && matchS !== -1 && matchE !== -1, 'the assistant pieces are in the file');
  let F = null;
  try {
    F = new Function('SC_IS_PLAY', 'window',
      src.slice(s, e + 3) + src.slice(matchS, matchE + 3) + src.slice(kbS, kbE) +
      '\nreturn { greet: _aiGreetingReply, match: _aiFuzzyMatch, kb: _aiKB };')(false, {});
  } catch (err) { ok(false, 'the assistant pieces evaluate: ' + err.message); }
  if (F) {
    ok(F.kb.length >= 110, 'the knowledge base builds (' + F.kb.length + ' answers)');
    const reported = F.match('Can I compact my library');
    ok(!!reported && /Compress library/i.test(reported.a), 'the reported question now finds the library compression answer');
    ok(!!reported && reported.q.indexOf('share code') === -1, 'and not the share-code entry it used to return');
    const strong = F.match('Can I compact my library', 80);
    ok(!!strong && /Compress library/i.test(strong.a), 'strongly enough that the app answers it without asking a model');
    // The cause: a two or three letter fragment of an entry can no longer carry a
    // match. "can" contains the share-code entry's own "a"; that is one hit of
    // three words, which used to be enough to answer the whole question.
    ok(F.match('can i compact my library').q.indexOf('share code') === -1, 'and the same question in lower case agrees');
    ok(F.match('hi') === null && F.match('hi', 80) === null, 'a bare Hi still matches nothing');
    ok(/album history/i.test((F.match('album history') || {}).a || ''), 'album history still finds its own answer');
    ok(/Crop song/.test((F.match('how do I crop a song') || {}).a || ''), 'and so does the cropper');
    ok(/storage/i.test((F.match('free up space') || {}).a || ''), 'free up space still lands on the storage answer');
    const deck = F.match('what is dj mode');
    ok(!!deck && /turntable/i.test(deck.a), 'and dj mode lands on the deck, not on autoplay');
  }
}

console.log('[4] the Studio DJ Mode card (driven)');
{
  win.playFromList(['t1', 't2', 't3'], 't1');
  await wait(400);
  win.navigate('studio');
  await wait(500);

  const tools = Array.from(strip(win)).map((b) => b.getAttribute('data-tool'));
  ok(tools.indexOf('djmode') !== -1, 'the Studio rack has a DJ Mode card (' + tools.join(',') + ')');
  ok(tools[0] === 'djmode', 'and it leads the rack (' + tools[0] + ')');
  const card = win.document.querySelector('#studioView [data-tool="djmode"]');
  ok(!!card, 'the card is on the page');
  ok(/turntable rig/i.test(card ? card.textContent : ''), 'and says what it opens: the turntable rig');
  ok(/scratch|pitch|EQ|hot cues/i.test(card ? card.textContent : ''), 'naming what is on the deck');

  const backdrop = win.document.getElementById('djModeBackdrop');
  ok(backdrop.style.display !== 'flex', 'the deck is closed to start with');

  card.click();
  await wait(900);
  ok(backdrop.style.display === 'flex', 'clicking the card opens the deck');
  const title = win.document.getElementById('djTrackTitle').textContent;
  ok(/Luna/.test(title), 'and the deck is on the song that was playing (' + title + ')');
  ok(win.__scDjModeState && win.__scDjModeState().open === true, 'while the card reports the deck as open');
  win.document.getElementById('djModeClose').click();
  await wait(500);
  ok(backdrop.style.display === 'none', 'and exiting hands the song back to the player');
  ok(win.__scDjModeState().open === false, 'with the card reporting it closed again');

  // A playlist that opts out: the deck must not open, and the card has to say why.
  // Play FROM it (the deck works on the playlist the queue came from), then try
  // the card - which is what someone listening to Paath would actually do.
  win.navigate('playlists');
  await wait(300);
  const paathTab = win.document.querySelector('#tabs [data-playlist-name="Paath"]');
  ok(!!paathTab, 'the devotional playlist is in the dock');
  if (paathTab) paathTab.click();
  await wait(400);
  win.playFromList(['t1', 't3'], 't1');
  await wait(400);
  win.navigate('studio');
  await wait(400);
  const state = win.__scDjModeState();
  ok(state.blocked === true && state.playlist === 'Paath', 'the app reports DJ Mode switched off for Paath');
  const card2 = win.document.querySelector('#studioView [data-tool="djmode"]');
  ok(/Switched off for/.test(card2 ? card2.textContent : ''), 'and the Studio card says so on its face');
  ok(/Paath/.test(card2 ? card2.textContent : ''), 'naming the playlist');
  if (card2) card2.click();
  await wait(600);
  ok(backdrop.style.display !== 'flex', 'clicking it does not open the deck for that playlist');
  ok(/DJ Mode is disabled/i.test(win.document.getElementById('toast').textContent || ''),
     'and the app says why instead of doing nothing');
  ok(errors.length === 0, 'the page throws nothing through all of this' + (errors.length ? ': ' + errors[0] : ''));
}

console.log('[5] inline script syntax and the OTA tail');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
  ok(/\n\n$/.test(src), 'the page ends with the two-newline OTA tail');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
