// v73.8 - DJ Mode always works in Albums.
//
// The owner, verbatim: "If your in albums dj mode should always be enabled".
//
// WHAT WAS WRONG. The block that steps DJ Mode aside for playlists meant to be
// listened to as-is was being read for the wrong thing. `playFromList` stores
// `activePlaylist` as the queue source, and on the Albums tab that is whatever
// playlist was last open - an album is not a playlist at all. So an album played
// while "Paath" happened to be the active playlist inherited Paath's block: the
// deck refused to open with a sentence about a playlist nobody was listening to,
// and the DJ MODE chip under the player went dim.
//
// THE RULE, now stated once (`djContextName` / `djBlockedName`) and read by all
// three surfaces: if the queue came from an album there is nothing to step aside
// for; otherwise it is the playlist the queue came from, exactly as it was. The
// deck also browses the ALBUM when it was opened from one (`djBrowseIds`), so
// removing the block did not quietly hand it the songs of a devotional playlist
// the album was played over.
//
//   [1] release metadata - APP_VERSION, the head entry, the shell cache;
//   [2] the rule, read out of the shipped file;
//   [3] the rule, DRIVEN: an album played over a devotional playlist;
//   [4] the playlist block still holds (the regression this must not cause);
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

const VER = '73.8';
const PREV = '73.7';
const SHELL_CACHE = 'sidecut-shell-v73.8';

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
    ok((head.items || []).length >= 7, 'with at least seven notes (' + (head.items || []).length + ')');
    ok(!/['\u2019]/.test((head.items || []).join(' ')), 'and no apostrophe anywhere in them');
    ok((head.items || []).every((it) => it.length <= 260), 'and every note is one short sentence or two');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test((head.items || []).join(' ')),
       'and no downloader or converter term');
    ok(String(head.date).endsWith('EDT'), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(entries[1].version) === PREV, 'and the release it replaced is still listed next (' + entries[1].version + ')');
  }
  ok(sw.includes("const CACHE_NAME = '" + SHELL_CACHE + "'"), 'the shell cache is this release name');
}

console.log('[2] the rule, read out of the shipped file');
{
  ok(count('function djContextName(){') === 1, 'the context the deck would play is answered in one place');
  ok(count('function djBlockedName(){') === 1, 'and the block is one question asked of it');
  // The album is the whole point: an album context is never a blocked playlist.
  const ctx = src.slice(src.indexOf('function djContextName(){'));
  ok(/if\(queueAlbumName\) return '';/.test(ctx.slice(0, ctx.indexOf('\n  }'))),
     'an album context answers with no playlist at all, which cannot be blocked');
  // Every surface that used to ask the wrong question now asks this one.
  // Three call sites - the deck, the chip and the Studio card - plus the line
  // that defines it.
  ok(count('djBlockedName()') === 4, 'the deck, the chip and the Studio card all ask it (' + count('djBlockedName()') + ')');
  ok(count('isDjModeDisabledPlaylist(activePlaylist)') === 0, 'and none of them reads the playlist that happens to be open');
  const enter = src.slice(src.indexOf('async function enterDjMode(){'));
  ok(enter.slice(0, enter.indexOf('cancelCrossfade()')).indexOf('const blockedFor = djBlockedName();') !== -1,
     'the deck refuses to open only for what the block names');
  const chip = src.slice(src.indexOf('// Update DJ MODE button to show red X'));
  ok(chip.slice(0, chip.indexOf("djBtn.innerHTML = 'DJ MODE'")).indexOf('!!djBlockedName()') !== -1,
     'and the DJ MODE button follows it too');
  // The deck browses the album it was opened from, not a playlist it was played over.
  ok(count('function djBrowseIds(){') === 1 && count('djBrowseIds()') === 6,
     'one reader decides the songs the deck browses, and every reader uses it (' + count('djBrowseIds()') + ')');
  ok(count('playlists[djSourcePlaylist] || []') === 1,
     'with the raw playlist read left only inside that one reader');
  ok(/djSourceIds = queueAlbumName \? \(scAlbumQueueIds\(queueAlbumName, null\)/.test(src),
     'an album play hands the deck the album own track list');
  ok(/djSourceIds = null; \/\/ a playlist picked by hand/.test(src),
     'and picking a playlist by hand leaves the album behind');
}

/* --------------------------------------------------------------- fake audio */
// The app's boot reaches for a wide slice of the Web Audio API (the deck is the
// point of this gate), so the fake has to answer all of it or an uncaught
// TypeError in block 1 stops the app booting.
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
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186, playCount: 12, dateAdded: 1001, blobType: 'audio/mpeg', fileName: 'aurora.mp3' },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155, playCount: 8, dateAdded: 1002, blobType: 'audio/mpeg', fileName: 'shine.mp3' },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182, playCount: 5, dateAdded: 1003, blobType: 'audio/mpeg', fileName: 'champagne.mp3' },
  { id: 't4', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171, playCount: 3, dateAdded: 1004, blobType: 'audio/mpeg', fileName: 'clash.mp3' },
];
// Paath holds TWO of the four songs: the deck browsing the album (3 songs) and
// the deck browsing the playlist (2) cannot be confused for each other.
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3', 't4'], Favorites: ['t2'], Paath: ['t1', 't3'] };
const ALBUMS = {
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, manual: true },
};
function buildTracks(win) {
  return TRACK_META.map((m) => Object.assign({}, m, { blob: new win.Blob([new win.Uint8Array(4096)], { type: 'audio/mpeg' }) }));
}
function fakeIndexedDB(win) {
  const data = {
    tracks: new Map(buildTracks(win).map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS)) }],
      ['albumOrder', { key: 'albumOrder', value: ['MoonChild Era'] }],
    ]),
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
const doc = win.document;

console.log('[3] the rule, driven: an album played over a devotional playlist');
{
  // The playlist that would have blocked it, opened the way a user opens it.
  win.navigate('playlists');
  await wait(400);
  const paathTab = doc.querySelector('#tabs [data-playlist-name="Paath"]');
  ok(!!paathTab, 'the devotional playlist is in the dock');
  if (paathTab) paathTab.click();
  await wait(400);

  // Now Albums: this is the whole report - playing a record from the Albums tab
  // while that playlist is the active one.
  win.navigate('albums');
  await wait(500);
  const card = doc.querySelector('[data-album-name="MoonChild Era"]');
  ok(!!card, 'the album card is on the Albums tab');
  if (card) { card.firstElementChild.click(); await wait(400); }  // open the card
  const body = card && card.querySelector('[id^="alb_card_"]');
  ok(!!body && !!body.querySelector('.track[data-id]'), 'and it opens onto its songs');
  const row = body && body.querySelector('.track[data-id]');
  if (row) { row.click(); await wait(700); }
  else {
    // Nothing rendered in this fake library: drive the call an album row makes.
    win.playFromList(['t1', 't2', 't3'], 't1', 'MoonChild Era');
    await wait(600);
  }
  const st = win.__scDjModeState();
  ok(st.album === 'MoonChild Era', 'the app reports the play came from the album (' + st.album + ')');
  ok(st.playlist === 'All Songs', 'and reports no playlist for it, rather than the one that was open (' + st.playlist + ')');
  ok(st.blocked === false, 'so DJ Mode is not blocked while an album plays');

  // The chip under the player: lit, with no red X.
  const chip = doc.getElementById('djModeBtn');
  ok(chip.innerHTML.indexOf('\u2715') === -1, 'the DJ MODE button shows no red X for an album');
  ok(chip.style.opacity === '1', 'and it is not dimmed');

  // The Studio card agrees, and opens the deck.
  win.navigate('studio');
  await wait(600);
  const djCard = doc.querySelector('#studioView [data-tool="djmode"]');
  ok(!!djCard, 'the Studio has the DJ Mode card');
  ok(!/Switched off for/.test(djCard ? djCard.textContent : ''), 'and it does not claim DJ Mode is switched off');
  ok(/turntable rig/i.test(djCard ? djCard.textContent : ''), 'it offers the rig (' + (djCard ? djCard.textContent.slice(0, 40) : '') + '...)');

  const backdrop = doc.getElementById('djModeBackdrop');
  ok(backdrop.style.display !== 'flex', 'the deck is closed to start with');
  if (djCard) djCard.click();
  await wait(900);
  ok(backdrop.style.display === 'flex', 'and clicking the card opens the deck on an album');

  // The deck browses the ALBUM, not the playlist the album was played over.
  const strip = Array.from(doc.querySelectorAll('#djTrackStrip .dj-strip-item'));
  ok(strip.length === 3, 'the deck strip holds the album own three songs (' + strip.length + ')');
  const names = strip.map((el) => (el.querySelector('.stn') || {}).textContent || '');
  ok(names.join(',') === 'Aurora,Born To Shine,Champagne', 'in the album own saved order (' + names.join(',') + ')');
  const title = doc.getElementById('djTrackTitle').textContent;
  ok(/Aurora/.test(title), 'with the album song that is playing on the deck (' + title + ')');
  ok(win.__scDjModeState().open === true, 'and the state hook reports the rig open');
  doc.getElementById('djModeClose').click();
  await wait(500);
  ok(backdrop.style.display === 'none', 'closing it hands the song back to the player');
}

console.log('[4] the playlist block still holds');
{
  // Same library, same tab, but the queue now comes from Paath itself - which is
  // the thing the block exists for and must keep refusing.
  win.navigate('playlists');
  await wait(300);
  const paathTab = doc.querySelector('#tabs [data-playlist-name="Paath"]');
  if (paathTab) paathTab.click();
  await wait(400);
  win.playFromList(['t1', 't3'], 't1');
  await wait(500);
  const st = win.__scDjModeState();
  ok(st.blocked === true && st.playlist === 'Paath', 'playing FROM the playlist is still blocked (' + JSON.stringify(st) + ')');
  ok(st.album === null, 'and it reports no album behind it');
  win.navigate('studio');
  await wait(500);
  const djCard = doc.querySelector('#studioView [data-tool="djmode"]');
  ok(/Switched off for/.test(djCard ? djCard.textContent : ''), 'the Studio card still says so on its face');
  ok(/Paath/.test(djCard ? djCard.textContent : ''), 'naming the playlist');
  const backdrop = doc.getElementById('djModeBackdrop');
  if (djCard) djCard.click();
  await wait(600);
  ok(backdrop.style.display !== 'flex', 'and clicking it does not open the deck for that playlist');
  ok(/DJ Mode is disabled/i.test(doc.getElementById('toast').textContent || ''),
     'with the app saying why instead of doing nothing');
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
