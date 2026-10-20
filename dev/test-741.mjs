// v74.1 - both buttons walk the albums, and they know which record is playing.
//
// The owner's words: "The next buttons and back buttons still dont bring you to
// the next album or previous album". 74.0 had made the SKIP button roll forward,
// so the report was about what that left out, and it named two causes:
//
//   1. BACK HAD NO ROLL AT ALL. hardAdvance only asked at the top of the queue,
//      so the back button could only ever wrap inside the album you were in.
//   2. THE ROLL COULD NOT TELL WHICH ALBUM IT WAS IN. It trusted queueAlbumName
//      and then demanded the queue be that album's ids in that exact order. A
//      play RESTORED after a relaunch, an OTA reload or a widget resume had its
//      queue back and no album with it (nothing saved one), and the grouped album
//      header in All Songs played an album without saying it was one - so in both
//      of those the buttons wrapped inside the record, which is exactly what was
//      reported.
//
//   [1] release metadata - APP_VERSION, the head entry, the shell cache, and the
//       note rules every release is held to;
//   [2] the rules read out of the shipped file - the album is read off the queue
//       (scAlbumForQueue), one step serves both directions, hardAdvance asks at
//       BOTH ends, the album is saved and restored with the play, the grouped
//       header says which album it is playing, and the option still guards it;
//   [3] DRIVEN on the real page, across THREE boots that share one store: back
//       lands on the previous album's LAST song, back mid-album walks back, the
//       first album wraps to the last, forward still rolls, a RELAUNCH comes back
//       knowing its album and both buttons roll from there, a PRE-74.1 SAVE (with
//       no album written down) rolls too because the album is read off the songs,
//       the grouped All Songs header rolls both ways, and a playlist plus the
//       option switched off still wrap inside themselves.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// 74.1: THE RELEASE THIS GATE DESCRIBES, so the ask below reads 74.1's OWN
// entry by version. It read the head until 74.1.5, which held only while the head was
// still about the button roll - see the retarget at the ask.
const OWN = '74.1';
const VER = '75.1.1'; /* repinned by dev/repin-7511.mjs */
const PREV = '75.1'; /* repinned by dev/repin-7511.mjs */
const SHELL_CACHE = 'sidecut-shell-v75.1.1';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
// The page hook this release added. Guarded, so running this gate against a tree
// from before 74.1 reports failing checks instead of throwing at the first one.
const albumOfQueue = (win) => (typeof win.__scAlbumForQueue === 'function' ? win.__scAlbumForQueue() : '<none>');
const count = (n) => src.split(n).length - 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
    const notes = (head.items || []).join('\n');
    ok(String(head.version) === VER, 'the newest entry is this release (' + head.version + ')');
    ok((head.items || []).length >= 7, 'with at least seven notes (' + (head.items || []).length + ')');
    ok(String(entries[1].version) === PREV, 'and the release it replaced is still listed next (' + entries[1].version + ')');
    ok(!/['\u2019]/.test(notes), 'no apostrophe anywhere in the notes');
    ok((head.items || []).every((it) => it.length <= 260), 'and every note is one short sentence or two (' +
      Math.max.apply(null, (head.items || []).map((i) => i.length)) + ')');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test(notes),
      'and no downloader or converter term');
    ok(!/\bapk\b|\bgithub\b|release asset/i.test(notes), 'and nothing about release files');
    ok(String(head.date).endsWith('EDT'), 'the ship stamp is Eastern (' + head.date + ')');
    // 74.1.5 RETARGETED THESE TWO. They asked the HEAD entry for 74.1's words, which
    // held only until a later release took the head; at 74.1.5 the head is the artist
    // bubble and the storage cleaner. They read the entry for the release this gate
    // describes now - the same fix 71.8 gave test-705. Both bars are unchanged: 74.1's
    // notes still have to name the back roll and the play that came back.
    const own = entries.find((e) => String(e.version) === OWN);
    const ownNotes = ((own && own.items) || []).join('\n');
    ok(!!own, 'the entry this gate describes is still in the changelog (' + OWN + ')');
    ok(/back/i.test(ownNotes), 'the notes say back rolls');
    ok(/restored|reopened/i.test(ownNotes), 'and name the play that came back without its album');
    const last = String((head.items || [])[(head.items || []).length - 1] || '');
    for (const w of ['widget', 'player', 'letter', 'lyrics', 'album']) {
      ok(new RegExp('\\b' + w, 'i').test(last), 'the last note names /' + w + '/');
    }
  }
  ok(sw.includes("const CACHE_NAME = '" + SHELL_CACHE + "'"), 'the shell cache is this release name');
}

console.log('[2] the rules, read out of the shipped file');
{
  // WHICH ALBUM IS THIS QUEUE - one reader, read off the songs.
  ok(count('function scAlbumForQueue(){') === 1, 'one function answers which album the queue is');
  ok(count('window.__scAlbumForQueue = scAlbumForQueue;') === 1, 'and it is published for the gates');
  ok(count("ids.map(String).sort().join('\\u0001') === want") === 1,
    'the queue is matched to an album by its SONGS, not by the order they were queued in');
  ok(src.indexOf('if(only !== null) return null;   // two albums carry these exact songs - refuse') !== -1,
    'and a queue two albums both claim is refused rather than guessed at');
  ok(src.indexOf('return !strict || (ids.map(String).join(') !== -1,
    'with no album named anywhere the queue has to be the album in its own saved order too');
  ok(/if\(playing && fits\(playing\.album, false\)\) return String\(playing\.album\)\.trim\(\);/.test(src),
    'the playing song own album tag is one of the answers, which is what a restored play has');

  // ONE STEP, BOTH DIRECTIONS.
  ok(count('function scAlbumRollStep(dir){') === 1, 'one step serves both directions');
  ok(src.indexOf('function scAlbumRollNext(){ return scAlbumRollStep(1); }') !== -1, 'forward asks for +1');
  ok(src.indexOf('function scAlbumRollPrev(){ return scAlbumRollStep(-1); }') !== -1, 'back asks for -1');
  ok(src.indexOf('queueIndex = back ? (queue.length - 1) : 0;') !== -1,
    'and back lands on the LAST song of that album, forward on its first');
  ok(count('function scAlbumRollOrder(){') === 1, 'the albums are walked in the order the cards are in');

  // BOTH ENDS OF THE QUEUE ASK IT.
  ok(count('if(dir > 0 && scAlbumRollQueue(1) >= 0){ gaplessPreloadedFor = null; playCurrent(true); return; }') === 1,
    'a forward step off the last song rolls');
  ok(count('if(dir < 0 && scAlbumRollQueue(-1) >= 0){ gaplessPreloadedFor = null; playCurrent(true); return; }') === 1,
    'and a back step off the first song rolls the other way');
  ok(src.indexOf("$('prevBtn').addEventListener('click', () => {\n    if(activeAudio().currentTime > 3){ activeAudio().currentTime = 0; return; }\n    hardAdvance(-1, true);") !== -1,
    'the player back button goes through it, still restarting a song that is more than three seconds in');
  ok(/mediaSetActionHandler\('previoustrack'/.test(src) && /hardAdvance\(-1, true\);\n    \}\);/.test(src),
    'and so does the lock screen / headset back');

  // THE ALBUM IS SAVED WITH THE PLAY AND RESTORED WITH IT.
  const saveFn = src.slice(src.indexOf('  function savePlaybackState('), src.indexOf('async function loadFromDB('));
  ok(saveFn.indexOf('album: queueAlbumName || null,') !== -1, 'the album is written with the play state');
  ok(count("queueAlbumName = (state.album && userAlbums && userAlbums[state.album]) ? state.album : null;") === 1,
    'and read back on the next launch, dropped when that album is gone');
  // The grouped album header in All Songs says which album it is playing.
  ok(/const _gaAlbum = \(g\.album && typeof userAlbums !== 'undefined' && userAlbums\[g\.album\]\) \? g\.album : null;/.test(src) &&
     /if\(albumIds\.length\) playFromList\(albumIds, albumIds\[0\], _gaAlbum\);/.test(src),
    'the grouped album header plays an album as an album when the tag names one');
  ok(count('if(typeof autoNextAlbum !== \'undefined\' && !autoNextAlbum) return null;') === 1,
    'the Playback option still refuses the whole roll, both directions');
  ok(src.indexOf('Back does it the other way: on the first song it goes to the last song of the album before it.') !== -1,
    'and Playback says what back does now');
}

// ---------------------------------------------------------------------------
// The real page, on a stub library. ONE store is shared by every boot, because
// half of this release is about what survives a restart.
const TRACKS = [
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171 },
  { id: 't5', name: 'Do You Know', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 199 },
].map((t) => Object.assign(t, { blobData: new Uint8Array([1, 2, 3, 4]), blobType: 'audio/mpeg', fileName: t.id + '.mp3' }));
const ALBUMS_START = {
  'Mixtape': { artist: 'Diljit Dosanjh', trackIds: ['t2', 't1'], manual: true },
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], manual: true },
  'Aurora Sessions': { artist: 'Diljit Dosanjh', trackIds: ['t4', 't5'], manual: true },
};
// The card order the roll walks. Aurora Sessions sorts FIRST by name, so a name
// sort would walk the albums the other way round.
const ALBUM_ORDER = ['Mixtape', 'MoonChild Era', 'Aurora Sessions'];

function makeStore() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [] } }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_START)) }],
      ['albumOrder', { key: 'albumOrder', value: ALBUM_ORDER.slice() }],
    ]),
  };
  function tx(store) {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { data[store].set(v && v.key !== undefined ? v.key : v.id, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
    });
    return t;
  }
  return {
    _data: data,
    open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n), close() {} }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
  };
}

function make2dCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 64, height: 64 };
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

function stubAudio(win) {
  ['audioEl', 'audioEl2'].forEach((id) => {
    const el = win.document.getElementById(id);
    if (!el) return;
    let pos = 0;
    try {
      Object.defineProperty(el, 'paused', { get: () => el.__paused !== false, configurable: true });
      Object.defineProperty(el, 'ended', { get: () => false, configurable: true });
      Object.defineProperty(el, 'duration', { get: () => el.__dur || 180, configurable: true });
      Object.defineProperty(el, 'currentTime', { get: () => pos, set: (v) => { pos = v; }, configurable: true });
      Object.defineProperty(el, 'src', { get: () => el.__src || 'blob:fake', set: (v) => { el.__src = v; }, configurable: true });
    } catch (e) {}
    el.load = () => {};
    el.play = () => { el.__paused = false; return Promise.resolve(); };
    el.pause = () => { el.__paused = true; };
  });
}

async function boot(store) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not load/i.test(m)) errors.push(m); });
  vc.on('warn', () => {});
  vc.on('error', (...a) => errors.push(a.map(String).join(' ').split('\n')[0]));
  const dom = new JSDOM(src, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return make2dCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = store;
      win.URL.createObjectURL = () => 'blob:jsdom';
      win.URL.revokeObjectURL = () => {};
      try { win.localStorage.clear(); } catch (e) {}
      win.fetch = () => Promise.reject(new Error('offline'));
      win.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web', nativePromise: () => Promise.resolve({}), nativeCallback: () => Promise.resolve({}), Plugins: {} };
    },
  });
  await wait(6000);
  return { dom, win: dom.window, errors };
}

(async () => {
  const store = makeStore();
  const nextOf = (name) => ALBUM_ORDER[(ALBUM_ORDER.indexOf(name) + 1) % ALBUM_ORDER.length];
  const prevOf = (name) => ALBUM_ORDER[(ALBUM_ORDER.indexOf(name) - 1 + ALBUM_ORDER.length) % ALBUM_ORDER.length];
  const idsOf = (name) => ALBUMS_START[name].trackIds;

  console.log('[3] both buttons, driven on the real page');
  const A = await boot(store);
  const win = A.win, doc = win.document;
  stubAudio(win);
  const snap = () => win.__scPlaybackSnapshot();

  async function playAlbumRow(name, which) {
    win.navigate('albums');
    await wait(700);
    const pane = doc.getElementById('listPane');
    const card = pane.querySelector('[data-album-name="' + name + '"]');
    if (!card) return false;
    let body = card.querySelector('[id^="alb_card_"]');
    if (body && body.style.display === 'none') { card.firstElementChild.click(); await wait(300); body = card.querySelector('[id^="alb_card_"]'); }
    const rows = body ? body.querySelectorAll('.track[data-id]') : [];
    if (!rows.length) return false;
    rows[which === 'last' ? rows.length - 1 : 0].click();
    await wait(400);
    return true;
  }

  // 1. BACK ON THE FIRST SONG GOES TO THE PREVIOUS ALBUM, ON ITS LAST SONG.
  ok(await playAlbumRow('MoonChild Era', 'first'), 'an album plays from its first song');
  let s = snap();
  ok(eq(s.queue, ['t1', 't2', 't3']) && s.queueIndex === 0 && s.album === 'MoonChild Era',
    'the queue is the album and the play knows it (' + s.queue.join(',') + ' @' + s.queueIndex + ')');
  doc.getElementById('prevBtn').click();
  await wait(500);
  s = snap();
  ok(s.album === prevOf('MoonChild Era'), 'back lands on the PREVIOUS album (' + s.album + ')');
  ok(eq(s.queue, idsOf(prevOf('MoonChild Era'))), 'with that album queued (' + s.queue.join(',') + ')');
  ok(s.queueIndex === idsOf(prevOf('MoonChild Era')).length - 1, 'at its LAST song (' + s.queueIndex + ')');
  const lastOfPrev = idsOf(prevOf('MoonChild Era'))[idsOf(prevOf('MoonChild Era')).length - 1];
  ok(doc.getElementById('npTitle').textContent === TRACKS.find((t) => t.id === lastOfPrev).name,
    'and the now bar shows that last song (' + doc.getElementById('npTitle').textContent + ')');
  ok(albumOfQueue(win) === prevOf('MoonChild Era'), 'the album of the new queue is answered (' + albumOfQueue(win) + ')');

  // 2. BACK AND FORWARD MID-ALBUM ARE SONG STEPS, AND LATE SONGS STILL RESTART.
  ok(await playAlbumRow('MoonChild Era', 'first'), 'the album plays again from its first song');
  doc.getElementById('nextBtn').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 1 && s.album === 'MoonChild Era', 'forward inside the album is a song step (' + s.queueIndex + ')');
  doc.getElementById('prevBtn').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 0 && s.album === 'MoonChild Era', 'and back inside it is a song step too (' + s.queueIndex + ')');
  activeAudioTime(win, 12);
  doc.getElementById('prevBtn').click();
  await wait(300);
  s = snap();
  ok(s.queueIndex === 0 && s.album === 'MoonChild Era',
    'while a song more than three seconds in is restarted instead of stepped past (' + s.queueIndex + ')');
  activeAudioTime(win, 0);

  // 3. THE FIRST ALBUM COMES BACK ROUND TO THE LAST, AND FORWARD STILL ROLLS.
  ok(await playAlbumRow(ALBUM_ORDER[0], 'first'), 'the first album plays from its first song');
  doc.getElementById('prevBtn').click();
  await wait(500);
  s = snap();
  ok(s.album === ALBUM_ORDER[ALBUM_ORDER.length - 1], 'back from the first album wraps round to the last (' + s.album + ')');
  ok(s.queueIndex === idsOf(ALBUM_ORDER[ALBUM_ORDER.length - 1]).length - 1, 'on its last song (' + s.queueIndex + ')');
  doc.getElementById('nextBtn').click();
  await wait(500);
  s = snap();
  ok(s.album === ALBUM_ORDER[0] && s.queueIndex === 0, 'and forward from there comes back to the first (' + s.album + ')');

  // 4. THE GROUPED ALBUM HEADER IN ALL SONG PLAYS AN ALBUM, SO BOTH BUTTONS ROLL.
  win.navigate('playlists');
  await wait(600);
  doc.getElementById('sortBtn').click();
  await wait(400);
  const sheet = doc.getElementById('sortSheet');
  ok(!!sheet, 'the sort sheet opens');
  const opt = sheet && Array.from(sheet.querySelectorAll('button')).find((b) => /Artist \+ album/.test(b.textContent));
  ok(!!opt, 'and it offers Artist + album');
  if (opt) opt.click();
  await wait(700);
  const pane2 = doc.getElementById('listPane');
  const hdr = Array.from(pane2.querySelectorAll('.track-ga-sum')).find((el) => /MoonChild Era/.test(el.textContent));
  ok(!!hdr, 'the list is grouped, with an album header to play');
  const hdrPlay = hdr && hdr.querySelector('.track-ga-play');
  if (hdrPlay) hdrPlay.click();
  await wait(500);
  s = snap();
  ok(eq(s.queue, ['t1', 't2', 't3']) && s.album === 'MoonChild Era',
    'the header plays the album and says which one it is (' + s.queue.join(',') + ' / ' + s.album + ')');
  doc.getElementById('prevBtn').click();
  await wait(500);
  s = snap();
  ok(s.album === prevOf('MoonChild Era') && s.queueIndex === idsOf(prevOf('MoonChild Era')).length - 1,
    'back from the header goes to the previous album on its last song (' + s.album + ' @' + s.queueIndex + ')');
  doc.getElementById('nextBtn').click();
  await wait(500);
  s = snap();
  ok(s.album === 'MoonChild Era' && s.queueIndex === 0, 'and forward comes back onto the album (' + s.album + ')');

  // 5. A PLAYLIST IS NOT AN ALBUM - IT WRAPS INSIDE ITSELF EITHER WAY.
  win.playFromList(['t1', 't2'], 't1');
  await wait(400);
  doc.getElementById('nextBtn').click();
  await wait(400);
  s = snap();
  ok(eq(s.queue, ['t1', 't2']) && s.queueIndex === 1 && s.album === null, 'a playlist steps forward inside itself (' + s.queueIndex + ')');
  doc.getElementById('prevBtn').click();
  await wait(400);
  doc.getElementById('prevBtn').click();
  await wait(400);
  s = snap();
  ok(eq(s.queue, ['t1', 't2']) && s.queueIndex === 1 && s.album === null,
    'and back at its first song wraps inside it rather than into an album (' + s.queueIndex + ')');

  // 6. THE OPTION OFF SWITCHES BOTH DIRECTIONS OFF.
  win.navigate('settings');
  await wait(500);
  win.showSettingsTab('more');
  await wait(500);
  const toggle = doc.getElementById('autoNextAlbumToggle');
  if (toggle && toggle.textContent === 'On') { toggle.click(); await wait(300); }
  ok(toggle && toggle.textContent === 'Off', 'the Playback option is off (' + (toggle && toggle.textContent) + ')');
  ok(await playAlbumRow('MoonChild Era', 'first'), 'an album plays from its first song again');
  s = snap();
  ok(s.queueIndex === 0 && s.album === 'MoonChild Era', 'on its first song (' + s.queueIndex + ')');
  doc.getElementById('prevBtn').click();
  await wait(500);
  s = snap();
  ok(eq(s.queue, ['t1', 't2', 't3']) && s.queueIndex === 2 && s.album === 'MoonChild Era',
    'with the option off, back wraps inside the album you started (@' + s.queueIndex + ')');
  doc.getElementById('prevBtn').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 1 && s.album === 'MoonChild Era', 'and walks back inside it (' + s.queueIndex + ')');
  doc.getElementById('prevBtn').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 0 && s.album === 'MoonChild Era', 'down to its first song again, never leaving it (' + s.queueIndex + ')');
  // Back on through the UI, and the app is left on the album SECOND song, so the
  // relaunch below has somewhere real to be restored to.
  toggle.click();
  await wait(300);
  ok(toggle.textContent === 'On', 'and the option goes back on');
  ok(await playAlbumRow('MoonChild Era', 'first'), 'the album plays once more');
  doc.getElementById('nextBtn').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 1 && s.album === 'MoonChild Era', 'leaving off on its second song (' + s.queueIndex + ')');
  A.dom.window.close();

  // 7. THE RELAUNCH: the queue comes back AND the album with it, so both buttons
  // roll on a play that was picked back up rather than started again.
  const B = await boot(store);
  const bwin = B.win, bdoc = bwin.document;
  stubAudio(bwin);
  const bsnap = () => bwin.__scPlaybackSnapshot();
  const saved = store._data.meta.get('playback');
  ok(!!saved && saved.value && saved.value.album === 'MoonChild Era',
    'the album of the play was written down (' + (saved && saved.value && saved.value.album) + ')');
  let bs = bsnap();
  ok(eq(bs.queue, ['t1', 't2', 't3']) && bs.queueIndex === 1, 'the relaunched app restores the queue and where it was (' + bs.queueIndex + ')');
  ok(bs.queueIndex === (saved.value && saved.value.queueIndex), 'which is the index the play was saved on');
  ok(bs.album === 'MoonChild Era', 'and the album it came from comes back with it (' + bs.album + ')');
  ok(albumOfQueue(bwin) === 'MoonChild Era', 'which is what the roll asks (' + albumOfQueue(bwin) + ')');
  // Back from the second song walks the album; from the FIRST song it rolls back
  // out of it - the shape of the report.
  bdoc.getElementById('prevBtn').click();
  await wait(400);
  bs = bsnap();
  ok(bs.queueIndex === 0 && bs.album === 'MoonChild Era', 'back inside the restored album is a song step (' + bs.queueIndex + ')');
  bdoc.getElementById('prevBtn').click();
  await wait(500);
  bs = bsnap();
  ok(bs.album === prevOf('MoonChild Era') && bs.queueIndex === idsOf(prevOf('MoonChild Era')).length - 1,
    'and from its first song it rolls to the previous album, on its last song (' + bs.album + ' @' + bs.queueIndex + ')');
  ok(bdoc.getElementById('npTitle').textContent === TRACKS.find((t) => t.id === lastOfPrev).name,
    'with the now bar showing that last song (' + bdoc.getElementById('npTitle').textContent + ')');
  bdoc.getElementById('nextBtn').click();
  await wait(500);
  bs = bsnap();
  ok(bs.album === 'MoonChild Era' && bs.queueIndex === 0,
    'and forward from there rolls back onto the album (' + bs.album + ' @' + bs.queueIndex + ')');
  B.dom.window.close();

  // 8. AN OLD SAVE - one written before this release, with no album in it - rolls
  // anyway, because the album is read off the songs.
  const row = store._data.meta.get('playback');
  delete row.value.album;
  store._data.meta.set('playback', row);
  const C = await boot(store);
  const cwin = C.win, cdoc = cwin.document;
  stubAudio(cwin);
  const csnap = () => cwin.__scPlaybackSnapshot();
  let cs = csnap();
  ok(cs.album === null, 'a pre-74.1 save restores with no album written down (' + cs.album + ')');
  ok(albumOfQueue(cwin) === 'MoonChild Era',
    'and the album is worked out from the songs instead (' + albumOfQueue(cwin) + ')');
  cdoc.getElementById('nextBtn').click();
  await wait(400);
  cdoc.getElementById('nextBtn').click();
  await wait(400);
  cs = csnap();
  ok(cs.queueIndex === 2 && cs.album === null,
    'forward through the restored queue is a song step (' + cs.queueIndex + ')');
  cdoc.getElementById('nextBtn').click();
  await wait(500);
  cs = csnap();
  ok(cs.album === nextOf('MoonChild Era') && cs.queueIndex === 0,
    'so forward off its last song still rolls into the next album (' + cs.album + ' @' + cs.queueIndex + ')');
  cdoc.getElementById('prevBtn').click();
  await wait(500);
  cs = csnap();
  ok(cs.album === 'MoonChild Era' && cs.queueIndex === idsOf('MoonChild Era').length - 1,
    'and back returns to the last song of the album it came from (' + cs.album + ' @' + cs.queueIndex + ')');

  const real = [].concat(A.errors, B.errors, C.errors)
    .filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('offline') === -1 && e.indexOf('Not implemented') === -1);
  ok(real.length === 0, 'no unexpected page errors across the three boots' + (real.length ? ': ' + real.slice(0, 2).join(' | ') : ''));
  C.dom.window.close();

  console.log('');
  console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// The back button restarts a song that is more than three seconds in - that rule
// is part of what this release left alone, so it is driven rather than skipped.
function activeAudioTime(win, seconds) {
  ['audioEl', 'audioEl2'].forEach((id) => {
    const el = win.document.getElementById(id);
    if (!el) return;
    try { el.currentTime = seconds; } catch (e) {}
  });
}
