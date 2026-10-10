// v73.7 - the Studio folds, and the APK downloads section is gone.
//
// The owner, with a screenshot of the Studio walled off by the APK download rows:
//   "Make all studio options like badges and stuff collapsible, then why is the
//    apk downloads thing here remove that don't mention that in patch notes"
//
// TWO THINGS, BOTH DRIVEN HERE.
//
//   1. THE FOLD. Every section of the Studio - the tool rack, the badges and the
//      rewards, the storage cleaner, Auto-DJ, the gestures, the two batch tools -
//      is now a fold whose header is the button that works it. The choice is
//      written down per section, so a repaint (and the Studio rebuilds itself
//      after every tool) and the next visit both leave the screen as it was left.
//      A fold that forgets is worse than no fold, so the persistence is driven
//      too: the section is folded, the tab is left and re-entered, and the
//      section has to still be folded.
//
//   2. THE REMOVAL. The section, the fetch behind it, the action that asked for
//      it and the two names the Studio published for it are all gone - a removal
//      that leaves a publishable name behind throws on the next boot, so the
//      driven half of this gate is what proves it is really out.
//
//      The notes say nothing about it, which is the owner's call and is checked
//      as such: the head entry describes the fold and never names the thing that
//      was taken out.
//
//   [1] release metadata - APP_VERSION, the head entry, the shell cache;
//   [2] the fold, read out of the shipped file;
//   [3] the fold, DRIVEN on the real Studio;
//   [4] the removal - nothing left that reaches for it, or publishes it;
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

const VER = '73.8'; /* repinned by dev/repin-738.mjs */
const PREV = '73.7'; /* repinned by dev/repin-738.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.8';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// One question typed into the real chat box and sent with the real button - the
// assistant is the only thing that deep-links INTO a Studio section.
const asked = async (win, text) => {
  const input = win.document.getElementById('aiChatInput');
  const send = win.document.getElementById('aiChatSend');
  if (!input || !send) return '';
  input.value = text;
  send.click();
  for (let i = 0; i < 40 && win.document.getElementById('aiTypingIndicator'); i++) await wait(50);
  await wait(120);
  const box = win.document.getElementById('aiChatMessages');
  const last = box && box.lastElementChild;
  return last ? (last.textContent || '') : '';
};

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
    // The owner's own instruction: the section that was removed is not mentioned.
    ok(!/\bapk\b|\bgithub\b|release asset/i.test((head.items || []).join(' ')),
       'the notes do not name the section that was taken out');
    ok(String(head.date).endsWith('EDT'), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(entries[1].version) === PREV, 'and the release it replaced is still listed next (' + entries[1].version + ')');
  }
  ok(sw.includes("const CACHE_NAME = '" + SHELL_CACHE + "'"), 'the shell cache is this release name');
}

console.log('[2] the fold, read out of the shipped file');
{
  // One helper pair and one section builder, all in the Studio block.
  ok(count('function foldState(){') === 1, 'the fold has one place that reads what was chosen');
  ok(count('function setFolded(k, on){') === 1, 'and one that writes it');
  ok(count('function foldHead(') === 1, 'the header is built in one place');
  ok(count('function foldSec(') === 1, 'and the section that wraps a body in one');
  ok(/folds: 'sidecut_studio_folds'/.test(src), 'the choice is kept under its own key, not mixed into another setting');
  ok(count('foldState()[k] === true') === 1, 'a section is folded only because a tap said so - nothing is folded by default');

  // Every section of the render goes through it: the rack, the badges and each of
  // the five that follow.
  const render = src.slice(src.indexOf('function renderStudio(){'));
  const body = render.slice(0, render.indexOf('host.innerHTML = html;'));
  const folds = (body.match(/foldSec\(/g) || []).length;
  ok(folds === 7, 'every section of the Studio is built as a fold (' + folds + ')');
  ok(body.indexOf("foldSec('', 'scFoldTools'") !== -1, 'starting with the tool rack');
  ok(body.indexOf("foldSec('', 'scFoldBadges'") !== -1, 'then the badges and the rewards');
  ok(body.indexOf("foldSec('scStudioStorage', 'scFoldStorage'") !== -1,
     'the storage cleaner keeps the id other code scrolls to');
  ok(body.indexOf("foldSec('', 'scFoldAutodj'") !== -1 && body.indexOf("foldSec('', 'scFoldGestures'") !== -1,
     'and Auto-DJ and the gestures fold too');
  ok(body.indexOf("foldSec('', 'scFoldBatchTags'") !== -1 && body.indexOf("foldSec('', 'scFoldBatchSel'") !== -1,
     'as do both batch tools');
  // Nothing is left outside: a section head that is not the fold's own button
  // would be a header that does nothing when tapped.
  const heads = (body.match(/sc-sec-head/g) || []).length;
  ok(heads === 0, 'and no section head is left outside a fold (' + heads + ')');

  // The styles: the header is the button, and a folded body is not drawn.
  ok(/\.sc-fold-head\{/.test(src) && /\.sc-fold-head span:first-child\{/.test(src),
     'the head rules carry the button and keep the head layout');
  ok(/\.sc-fold\.folded > \.sc-fold-body\{ display: none; \}/.test(src),
     'a folded body is taken out of the page, not hidden behind something');
  ok(/\.sc-fold\.folded \.sc-fold-ico\{ transform: rotate\(-90deg\)/.test(src),
     'and the chevron turns, so a folded section still reads as one you can open');

  // Reaching into a section opens it: the storage tool deep-links to its section.
  const scroll = src.slice(src.indexOf('function scrollStudioTo(id){'));
  ok(scroll.slice(0, scroll.indexOf('\n  }')).indexOf('unfoldSection(el)') !== -1,
     'a tool that scrolls to a section opens it first');
}

/* --------------------------------------------------------------- fake audio */
// The app's boot reaches for a wide slice of the Web Audio API (the deck, the
// scratch engine, the analysers), so the fake has to answer all of it or an
// uncaught TypeError in block 1 stops the app booting - and this probe needs the
// Studio, which is block 4.
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
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3'], Favorites: ['t2'] };
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

// ---------------------------------------------------------------------------
const { win, errors } = boot();
await wait(7000);

console.log('[3] the fold, driven on the real Studio');
{
  const doc = win.document;
  win.navigate('studio');
  await wait(600);
  const view = doc.getElementById('studioView');
  ok(!!view, 'the Studio renders');

  const heads = () => Array.from(view.querySelectorAll('.sc-fold-head'));
  const secs = heads().map((b) => b.parentNode);
  ok(heads().length === 7, 'every section on the page has a header you can tap (' + heads().length + ')');

  const keys = heads().map((b) => b.getAttribute('data-fold'));
  ok(keys.every((k) => !!k), 'each header names the section it works (' + keys.filter(Boolean).length + ')');
  ok(new Set(keys).size === keys.length, 'and no two sections share a name');
  ok(keys.indexOf('scFoldTools') !== -1 && keys.indexOf('scFoldBadges') !== -1,
     'the tool rack and the badges are among them (' + keys.join(', ') + ')');
  // The tool rack still holds the cards: a fold that ate the tools is not a fold.
  ok(view.querySelectorAll('.sc-tools [data-tool]').length >= 10,
     'the rack still holds every tool card inside its fold (' + view.querySelectorAll('.sc-tools [data-tool]').length + ')');
  ok(view.querySelector('.sc-ach-groups') !== null || view.querySelector('.sc-hero') !== null,
     'and the badge wall is still inside the badges fold');

  ok(heads().every((b) => b.getAttribute('aria-expanded') === 'true'), 'nothing is folded to start with');
  ok(secs.every((s) => !s.classList.contains('folded')), 'so every body is on the page');
  ok(secs.every((s) => !!s.querySelector('.sc-fold-body')), 'each of them with a body to fold away');

  // Fold the badges and check the body is really gone, not merely invisible.
  const badges = heads().filter((b) => b.getAttribute('data-fold') === 'scFoldBadges')[0];
  const badgesSec = badges.parentNode;
  const hero = badgesSec.querySelector('.sc-hero');
  ok(!!hero, 'the badges fold holds the streak and the reward hero');
  badges.click();
  await wait(80);
  ok(badgesSec.classList.contains('folded'), 'tapping the header folds the section');
  ok(badges.getAttribute('aria-expanded') === 'false', 'and says so to a screen reader');
  ok(badgesSec.querySelector('.sc-fold-body') !== null, 'the body is still built, so nothing had to be thrown away');

  const kept = JSON.parse(win.localStorage.getItem('sidecut_studio_folds') || '{}');
  ok(kept.scFoldBadges === true, 'and the choice is written down (' + JSON.stringify(kept) + ')');

  // Leave the tab and come back: the Studio rebuilds itself, and the fold has to
  // survive it - a fold that forgets is worse than no fold.
  win.navigate('home');
  await wait(300);
  win.navigate('studio');
  await wait(600);
  const again = Array.from(view.querySelectorAll('.sc-fold-head')).filter((b) => b.getAttribute('data-fold') === 'scFoldBadges')[0];
  ok(!!again && again.parentNode.classList.contains('folded'), 'the section is still folded after the Studio rebuilds');
  ok(again.getAttribute('aria-expanded') === 'false', 'with the header still saying so');

  // And it opens again.
  again.click();
  await wait(80);
  ok(!again.parentNode.classList.contains('folded'), 'tapping it again opens it');
  ok(JSON.parse(win.localStorage.getItem('sidecut_studio_folds') || '{}').scFoldBadges === false,
     'and the choice is written down just the same');

  // Independent sections: folding one must not fold another.
  const gestures = Array.from(view.querySelectorAll('.sc-fold-head')).filter((b) => b.getAttribute('data-fold') === 'scFoldGestures')[0];
  gestures.click();
  await wait(80);
  ok(gestures.parentNode.classList.contains('folded'), 'a second section folds on its own');
  const switches = Array.from(gestures.parentNode.querySelectorAll('.sc-switch'));
  ok(switches.length === 2, 'and it is the one with the two switches in it');
  ok(switches.every((s) => s.parentNode.parentNode.classList.contains('sc-fold-body')),
     'both of which are inside the body that folded away');
  ok(!again.parentNode.classList.contains('folded'), 'while the badges stayed open');

  // A section that is folded cannot be scrolled to, so reaching INTO one opens it
  // first. The assistant's "open the storage cleaner" is the one thing that
  // deep-links into a section, so it is driven the way a user drives it: the
  // section is folded, the question is typed into the real chat box, and the
  // section has to be open - and left open - by the time the answer arrives.
  win.localStorage.setItem('sidecut_studio_folds', JSON.stringify({ scFoldStorage: true }));
  win.navigate('home');
  await wait(200);
  win.navigate('studio');
  await wait(400);
  const preStor = doc.getElementById('scStudioStorage');
  ok(!!preStor && preStor.classList.contains('folded'), 'the storage cleaner folds like every other section');

  const tab = doc.getElementById('settingsTabSupport');
  ok(!!tab, 'Settings has its Support tab');
  if (tab) tab.click();
  await wait(120);
  const reply = await asked(win, 'open the storage cleaner');
  ok(/storage cleaner/i.test(reply), 'the assistant takes the request (' + reply.slice(0, 42) + '...)');
  await wait(500);
  const stor = doc.getElementById('scStudioStorage');
  ok(!!stor, 'the storage cleaner is on the page');
  ok(stor && !stor.classList.contains('folded'), 'and the folded section is opened to receive it, not left as a header');
  ok(JSON.parse(win.localStorage.getItem('sidecut_studio_folds') || '{}').scFoldStorage === false,
     'with the choice written down, so it does not snap shut behind you');

  ok(errors.length === 0, 'the page throws nothing through all of this' + (errors.length ? ': ' + errors[0] : ''));
}

console.log('[4] the removal - nothing left that reaches for it, or publishes it');
{
  ok(count('APK downloads') === 0, 'no section in the page announces APK downloads');
  ok(count('apkread') === 0, 'and nothing left an action that asks for the counts');
  ok(count('api.github.com/repos/') === 0, 'the fetch that read them is gone with it');
  ok(count('download_count') === 0, 'and so is the field it read');
  ok(count('apkSectionHtml') === 0 && count('loadApkDownloads') === 0 && count('GH_REPO') === 0,
     'none of the functions behind it survive as dead code');
  ok(count('sc-apk') === 0, 'and no style is left for rows that are never drawn');
  ok(count('apkRows') === 0, 'the Studio no longer publishes a reader for them either');
  // The one place that would have thrown on the next boot: a name published for
  // something that no longer exists is a ReferenceError at publish time.
  const pub = src.slice(src.indexOf('window.SC70 = {'));
  ok(pub.slice(0, pub.indexOf('\n  };')).indexOf('loadApk') === -1,
     'so the published surface still builds - every name on it exists');
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
