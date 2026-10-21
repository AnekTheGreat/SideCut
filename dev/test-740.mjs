// v74.0 - the skip button rolls into the next album too, not only the song that
// ends by itself.
//
// The owner's words: "The albums should go to the next album with the skip
// button too not just airing in to the next one". 73.5 had shipped the roll for
// a song that reached its own end and had deliberately kept the Next button
// inside the album you were in ("Only a song that really ends rolls on. The Next
// button stays inside the album you are in"), so the one control a listener
// reaches for at the end of a record did the opposite of what happens by itself
// a moment later. This release makes both forward steps ask the same question.
//
//   [1] release metadata - APP_VERSION, the head entry, the shell cache, and the
//       note rules every release is held to (length, no apostrophe, the last note
//       naming the surfaces the earlier gates read the head for);
//   [2] the rules read out of the shipped file - the natural-end argument is GONE
//       from hardAdvance and from every call site, the roll is asked on any
//       forward step, all three ways a listener skips (the player button, the
//       lock screen / headset, the lyrics panel) go through it, and the option's
//       own guards are untouched;
//   [3] DRIVEN on the real page: an album is played from the Albums tab and Next
//       on its LAST song really lands on the next album's first song (the queue
//       becomes that album, the index is 0, the now bar shows its first song and
//       the focus rule follows it), a mid-album Next still walks the album,
//       Previous still wraps inside it, the last album still comes back round to
//       the first, turning the option OFF in Settings - More - Playback makes
//       Next wrap inside the album exactly as before (and back ON makes it roll
//       again, without a restart), and a playlist or a library-wide queue keeps
//       its own order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// 74.0: THE RELEASE THIS GATE DESCRIBES, so the ask below reads 74.0's OWN
// entry by version. It read the head until 74.1.5, which held only while the head was
// still about the player - see the retarget at the ask.
const OWN = '74.0';
const VER = '80.0.2'; /* repinned by dev/repin-8002.mjs */
const PREV = '80.0.1'; /* repinned by dev/repin-8002.mjs */
const SHELL_CACHE = 'sidecut-shell-v80.0.2';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
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
    ok((head.items || []).every((it) => it.length <= 260), 'and every note is one short sentence or two');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test(notes),
      'and no downloader or converter term');
    ok(!/\bapk\b|\bgithub\b|release asset/i.test(notes), 'and nothing about release files');
    ok(String(head.date).endsWith('EDT'), 'the ship stamp is Eastern (' + head.date + ')');
    // 74.1.5 RETARGETED THIS LINE. It asked the HEAD entry for 74.0's words, which
    // held only while the head was still about the player; at 74.1.5 the head is the
    // artist bubble and the storage cleaner. The question moved to the release this
    // gate describes - the same fix 71.8 gave test-705. The bar is unchanged: 74.0's
    // notes still have to name the skip and the album.
    const own = entries.find((e) => String(e.version) === OWN);
    const ownNotes = ((own && own.items) || []).join('\n');
    ok(!!own, 'the entry this gate describes is still in the changelog (' + OWN + ')');
    ok(/skip/i.test(ownNotes) && /next album/i.test(ownNotes), 'and the notes say what the owner asked for');
    const last = String((head.items || [])[(head.items || []).length - 1] || '');
    for (const w of ['widget', 'player', 'letter', 'lyrics', 'album']) {
      ok(new RegExp('\\b' + w, 'i').test(last), 'the last note names /' + w + '/');
    }
  }
  ok(sw.includes("const CACHE_NAME = '" + SHELL_CACHE + "'"), 'the shell cache is this release name');
}

console.log('[2] the rules, read out of the shipped file');
{
  // THE ARGUMENT THAT USED TO KEEP NEXT INSIDE THE ALBUM IS GONE - from the
  // function and from every caller, so no path can be left asking the old
  // question by accident.
  ok(count('function hardAdvance(dir, wrap){') === 1, 'hardAdvance takes the direction and the wrap, and nothing else');
  ok(count('hardAdvance(1, true, true)') === 0, 'and no call site still passes a natural-end flag');
  ok(!/function hardAdvance\([^)]*natural/.test(src), 'there is no natural parameter left on it');
  ok(count('if(natural && dir > 0 && scAlbumRollQueue() >= 0)') === 0,
    'nor the old condition that only rolled on a natural end');
  // 74.1 retarget: the roll takes the direction it is walking now, because 74.1
  // gave the back button the same answer, so the forward line reads
  // scAlbumRollQueue(1) and a back line reads scAlbumRollQueue(-1). The claim -
  // a forward step off the last song of the album rolls - is unchanged.
  ok(count('if(dir > 0 && scAlbumRollQueue(1) >= 0){ gaplessPreloadedFor = null; playCurrent(true); return; }') === 1,
    'a forward step off the last song of the album rolls');

  // Every way a listener moves on goes through hardAdvance, and each of them
  // ends up at that same line.
  ok(src.indexOf("$('nextBtn').addEventListener('click', () => hardAdvance(1, true));") !== -1,
    'the player Next button rolls');
  ok(/mediaSetActionHandler\('nexttrack', \(\) => \{\n(?:.*\n)*?\s+hardAdvance\(1, true\);/.test(src),
    'and so does the lock screen / headset skip');
  ok(/hardAdvance\(1, true\);\n    \/\/ Re-fetch lyrics for new track/.test(src),
    'and the Next button in the lyrics panel');
  ok(src.indexOf('hardAdvance(1, true); // the album ends (or Next is pressed)') !== -1,
    'the end of the song asks the same question, with no separate path');
  ok(count('scAlbumRollQueue(') >= 4, 'the roll is asked from the end of the song, the crossfade and the gapless cut');

  // What the roll refuses is untouched: only a queue that IS one album rolls, the
  // option still switches it off, and it is still on by default.
  ok(count('if(typeof autoNextAlbum !== \'undefined\' && !autoNextAlbum) return null;') === 1,
    'the option still answers the roll first');
  // 74.1 retarget: the old guard demanded the queue be the album ids in that
  // EXACT ORDER ("if(!queue || queue.length !== ids.length) return null;" plus a
  // position-by-position loop). 74.1 compares the SONGS instead - a shuffled
  // album, or a tag group listed in library order, is still that album - so the
  // guard that ships is the same-songs check below.
  ok(count("ids.map(String).sort().join('\\u0001') === want") === 1,
    'and only a queue whose songs are exactly one album is rolled');
  ok(src.indexOf('let autoNextAlbum = true;') !== -1, 'the option is still on by default');
  ok(src.indexOf('and the skip button does the same on the last song') !== -1,
    'Playback says so on its face now, where the toggle is');
}

// ---------------------------------------------------------------------------
// The real page, on a stub library: three albums in a chosen order, five songs
// with real (fake) files so playback really moves.
const TRACKS = [
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171 },
  { id: 't5', name: 'Do You Know', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 199 },
].map((t) => Object.assign(t, { blobData: new Uint8Array([1, 2, 3, 4]), blobType: 'audio/mpeg', fileName: t.id + '.mp3' }));
// The card order is what the roll walks, so it is set by hand and then read back
// out of the DOM: Mixtape first, MoonChild Era in the middle, Aurora Sessions
// last - and Aurora Sessions sorts FIRST by name, so a name sort would roll the
// other way.
const ALBUMS_START = {
  'Mixtape': { artist: 'Diljit Dosanjh', trackIds: ['t2', 't1'], manual: true },
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], manual: true },
  'Aurora Sessions': { artist: 'Diljit Dosanjh', trackIds: ['t4', 't5'], manual: true },
};
const ALBUM_ORDER = ['Mixtape', 'MoonChild Era', 'Aurora Sessions'];
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
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

async function boot() {
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
      win.indexedDB = fakeIndexedDB();
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

console.log('[3] the skip button, driven on the real page');
(async () => {
  const { win, errors } = await boot();
  stubAudio(win);
  const doc = win.document;
  const snap = () => win.__scPlaybackSnapshot();
  const store = () => win.__scGetUserAlbums();

  // The card order, read off the tab - that is the order the roll walks.
  win.navigate('albums');
  await wait(900);
  const pane = doc.getElementById('listPane');
  const cardNames = Array.from(pane.querySelectorAll('[data-album-name]')).map((c) => c.dataset.albumName);
  ok(eq(cardNames, ALBUM_ORDER), 'the Albums tab lists the three albums in their own order (' + cardNames.join(' > ') + ')');
  const nextOf = (name) => cardNames[(cardNames.indexOf(name) + 1) % cardNames.length];

  // Open a card and tap its LAST row, the way a listener starts an album.
  async function playLastSong(name) {
    win.navigate('albums');
    await wait(700);
    const card = pane.querySelector('[data-album-name="' + name + '"]');
    if (!card) return null;
    let body = card.querySelector('[id^="alb_card_"]');
    if (body && body.style.display === 'none') { card.firstElementChild.click(); await wait(300); body = card.querySelector('[id^="alb_card_"]'); }
    const rows = body ? body.querySelectorAll('.track[data-id]') : [];
    if (!rows.length) return null;
    rows[rows.length - 1].click();
    await wait(400);
    return body;
  }

  // 1. NEXT ON THE LAST SONG OF AN ALBUM ROLLS INTO THE NEXT ALBUM.
  await playLastSong('MoonChild Era');
  let s = snap();
  ok(eq(s.queue, ['t1', 't2', 't3']) && s.queueIndex === 2, 'an album plays from its own last song (' + s.queue.join(',') + ' @' + s.queueIndex + ')');
  ok(s.album === 'MoonChild Era', 'tagged with the album it came from (' + s.album + ')');
  doc.getElementById('nextBtn').click();
  await wait(500);
  s = snap();
  const want = store()[nextOf('MoonChild Era')].trackIds;
  ok(eq(s.queue, want), 'Next lands on the NEXT album in card order (' + s.queue.join(',') + ')');
  ok(s.album === nextOf('MoonChild Era'), 'and the play belongs to that album now (' + s.album + ')');
  ok(s.queueIndex === 0, 'with its first song ready (' + s.queueIndex + ')');
  ok(doc.getElementById('npTitle').textContent === 'Clash', 'the now bar shows it (' + doc.getElementById('npTitle').textContent + ')');
  ok(win.__scAlbumForPlayingTrack() === nextOf('MoonChild Era'), 'and the card that stays open follows the album that took over');

  // 2. A SKIP IN THE MIDDLE OF AN ALBUM IS UNCHANGED. Started fresh, so this
  // claim stands on its own instead of riding on the roll above.
  await playLastSong('MoonChild Era');
  pane.querySelector('[data-album-name="MoonChild Era"] .track[data-id="t1"]').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 0 && s.album === 'MoonChild Era', 'the album plays from its first song (' + s.queueIndex + ')');
  doc.getElementById('nextBtn').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 1 && s.album === 'MoonChild Era', 'Next mid-album walks to the next song of that album (' + s.queueIndex + ')');
  ok(doc.getElementById('npTitle').textContent === 'Born To Shine', 'and plays it (' + doc.getElementById('npTitle').textContent + ')');

  // 3. PREVIOUS IS UNTOUCHED - it still wraps inside the album you are in.
  doc.getElementById('prevBtn').click();
  await wait(400);
  s = snap();
  ok(s.queueIndex === 0 && s.album === 'MoonChild Era', 'Previous walks back inside the album (' + s.queueIndex + ')');
  doc.getElementById('prevBtn').click();
  await wait(400);
  s = snap();
  // 74.1 RETARGETED THIS LINE. 74.0 pinned "at its first song it wraps inside
  // the album, not backwards into another one" - and the owner then reported that
  // the back button "still dont bring you to the ... previous album", so 74.1
  // gave back the same roll forward has, the other way. The claim it used to make
  // is now the refusal, and the refusal has its own gate (dev/test-741.mjs); what
  // is pinned here is what the button really does: it lands on the LAST song of
  // the album before this one, in the same card order.
  const backName = cardNames[(cardNames.indexOf('MoonChild Era') - 1 + cardNames.length) % cardNames.length];
  ok(s.album === backName && s.queueIndex === store()[backName].trackIds.length - 1,
    'and at its first song it goes back to the previous album, on its last song (' + s.album + ' @' + s.queueIndex + ')');

  // 4. THE LAST ALBUM COMES BACK ROUND TO THE FIRST - Next does not stop the music.
  await playLastSong(cardNames[cardNames.length - 1]);
  doc.getElementById('nextBtn').click();
  await wait(500);
  s = snap();
  ok(eq(s.queue, store()[cardNames[0]].trackIds) && s.album === cardNames[0],
    'the last album rolls back round to the first (' + s.album + ')');

  // 5. THE OPTION STILL COVERS IT, TURNED OFF FROM THE SETTINGS SCREEN.
  win.navigate('settings');
  await wait(500);
  win.showSettingsTab('more');
  await wait(500);
  const toggle = doc.getElementById('autoNextAlbumToggle');
  ok(!!toggle, 'Settings - More carries the Playback toggle');
  const before = toggle.textContent;
  toggle.click();
  await wait(300);
  ok(before === 'On' && toggle.textContent === 'Off', 'and turning it off reads Off (' + before + ' -> ' + toggle.textContent + ')');
  await playLastSong('MoonChild Era');
  doc.getElementById('nextBtn').click();
  await wait(500);
  s = snap();
  ok(eq(s.queue, ['t1', 't2', 't3']) && s.queueIndex === 0 && s.album === 'MoonChild Era',
    'with the option off, Next wraps inside the album you started (' + s.queue.join(',') + ' @' + s.queueIndex + ')');

  // 6. AND BACK ON, WITH NO RESTART - the setting is read as it stands.
  toggle.click();
  await wait(300);
  ok(toggle.textContent === 'On', 'turning it back on reads On');
  await playLastSong('MoonChild Era');
  doc.getElementById('nextBtn').click();
  await wait(500);
  s = snap();
  ok(s.album === nextOf('MoonChild Era') && s.queueIndex === 0,
    'and Next rolls into the next album again (' + s.album + ' @' + s.queueIndex + ')');

  // 7. A PLAYLIST IS SOMEBODY ELSE'S ORDER - its end still wraps inside itself.
  win.playFromList(['t1', 't2'], 't2');
  await wait(400);
  doc.getElementById('nextBtn').click();
  await wait(400);
  s = snap();
  ok(eq(s.queue, ['t1', 't2']) && s.queueIndex === 0 && s.album === null,
    'a playlist wraps at its end rather than jumping into an album (' + s.queue.join(',') + ' @' + s.queueIndex + ')');

  // 8. AND SO IS A QUEUE THAT IS NOT EXACTLY ONE ALBUM, even when it is tagged
  // with an album name (an Albums-tab play-all of the whole library).
  win.playFromList(['t1', 't2', 't3', 't4', 't5'], 't5', 'MoonChild Era');
  await wait(400);
  doc.getElementById('nextBtn').click();
  await wait(400);
  s = snap();
  ok(eq(s.queue, ['t1', 't2', 't3', 't4', 't5']) && s.queueIndex === 0,
    'a library-wide queue keeps its own order and wraps inside it (' + s.queue.length + ' songs @' + s.queueIndex + ')');

  const real = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('offline') === -1 && e.indexOf('Not implemented') === -1);
  ok(real.length === 0, 'no unexpected page errors' + (real.length ? ': ' + real.slice(0, 2).join(' | ') : ''));

  console.log('');
  console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
