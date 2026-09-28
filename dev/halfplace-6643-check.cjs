// 64.3, driven for real: a tap in one half of the library leaves the other half
// exactly where it was.
//
// The user's report:
//
//   "Why does me clicking the record player in playlists or albums affect the
//    other, it shouldn't do that it should stay where it is if its at the top it
//    stays at the top."
//
// 64.2.6 gave each half its own remembered position (scLibScroll) and wired the
// "put the scroll back where it was" restore to skip itself while
// renderListInner._scrollToPlaying was armed. That flag is a WISH - "land on the
// playing song" - and nothing guaranteed it was cleared: the playlist-tab click
// armed it (after renderList, and unconditionally), the Albums half read it and
// never cleared it at all, and with no track playing nothing cleared it. So it
// survived into the NEXT render - a render for the other half - and that half
// threw its own position away and then saved the stranger's offset as its own.
//
// This boots the real app, plays a real song, and drives the real paths: the
// halves through navigate(), the wish through a playlist tab, and the record tap
// through window.__scJumpToPlayingSong / window.__scOpenAlbumForCurrentSong -
// the same two entry points the now bar's turntable calls.
//
//   node dev/halfplace-6643-check.cjs
//   SC_HTML=/tmp/prefix-6429.html node dev/halfplace-6643-check.cjs   # against 64.2.9
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  + ' + name); }
  else { fail++; console.log('  X ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
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

// Two albums and three playlists, so both halves have a list worth scrolling and
// the playing song is in one playlist and not in the others.
const TRACKS = [];
for (let i = 1; i <= 14; i++) {
  TRACKS.push({ id: 't' + i, name: 'Song ' + i, artist: 'Test Artist', album: i <= 7 ? 'First Album' : 'Second Album', duration: 180 + i });
}
const PLAYLISTS = { 'All Songs': TRACKS.map((t) => t.id), Favorites: ['t3'], 'Road Trip': ['t11', 't12'] };
const ALBUMS = {
  'First Album': { trackIds: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'] },
  'Second Album': { trackIds: ['t8', 't9', 't10', 't11', 't12', 't13', 't14'] },
};

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS)) }],
      ['pinnedArtists', { key: 'pinnedArtists', value: [{ name: 'Test Artist' }] }],
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
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = fakeIndexedDB();
      win.confirm = () => true;
      win.localStorage.clear();
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);

(async () => {
  const { win, errors } = boot();
  await wait(3400);
  const doc = win.document;
  const pane = doc.getElementById('listPane');
  const mem = win.__scLibScroll;

  // Every write the app makes to the list's own scroll position. jsdom lays
  // nothing out, so what has to be true is that the app ASKS for the right
  // offset rather than what a glide leaves behind - the same measurement
  // dev/libhalf-6426-check.cjs makes, for the same reason.
  let writes = [];
  let desc = null;
  for (let p = pane; p && !desc; p = Object.getPrototypeOf(p)) desc = Object.getOwnPropertyDescriptor(p, 'scrollTop');
  const watchable = !!desc && !!desc.get && !!desc.set;
  if (watchable) {
    Object.defineProperty(pane, 'scrollTop', {
      configurable: true,
      get() { return desc.get.call(pane); },
      set(v) { writes.push(v); desc.set.call(pane, v); },
    });
  }
  const setTop = (v) => { pane.scrollTop = v; };
  const row = (id) => pane.querySelector('.track[data-id="' + id + '"]');
  const tab = (name) => Array.prototype.slice.call(doc.querySelectorAll('#tabs .tab'))
    .filter((el) => el.dataset.playlistName === name)[0] || null;

  console.log('\n- the pieces the paths need are on the page -');
  ok('the list pane is there', !!pane);
  ok('the library can be opened', typeof win.navigate === 'function');
  ok('each half keeps its own remembered position', !!mem && typeof mem === 'object', JSON.stringify(mem));
  ok('and the pane scroll can be watched', watchable);
  ok('the record tap can be reached the way the turntable reaches it',
    typeof win.__scJumpToPlayingSong === 'function' && typeof win.__scOpenAlbumForCurrentSong === 'function');
  let played = null;
  try { win.playFromList(TRACKS.map((t) => t.id), 't9'); } catch (e) { played = e; }
  await wait(250);
  ok('a song is playing, so the two record paths have something to find', played === null,
    played && played.message);

  // Each half is left at a place of its own: Albums at 240, Playlists at 900.
  win.navigate('albums');
  await wait(200);
  setTop(240);
  win.navigate('playlists');
  await wait(200);
  setTop(900);
  // A half's place is taken down as that half is LEFT, so what is remembered here
  // is Albums (240, just left) and what the pane holds is Playlists (900, current).
  ok('the two halves start out with places of their own',
    mem.albums === 240 && pane.scrollTop === 900, JSON.stringify(mem) + ' pane ' + pane.scrollTop);

  console.log('\n- a half is put back where it was left -');
  writes = [];
  win.navigate('albums');
  await wait(250);
  ok('Albums comes back to its own offset, not the one Playlists was left at',
    pane.scrollTop === 240, 'scrollTop = ' + pane.scrollTop + ', wrote ' + JSON.stringify(writes.slice(0, 6)));
  ok('and Playlists was remembered on the way out', mem.playlists === 900, JSON.stringify(mem));
  writes = [];
  win.navigate('playlists');
  await wait(250);
  ok('Playlists comes back to its own offset too', pane.scrollTop === 900,
    'scrollTop = ' + pane.scrollTop + ', wrote ' + JSON.stringify(writes.slice(0, 6)));
  ok('and Albums keeps its own', mem.albums === 240, JSON.stringify(mem));

  console.log('\n- a playlist tab arms the wish; the other half is untouched -');
  // Favorites holds t3 and the song playing is t9, so this render never lands on
  // it: exactly the case that used to leave the wish standing. Road Trip is the
  // same shape and is the one that is clicked.
  const rt = tab('Road Trip');
  ok('the playlist tab is there to click', !!rt, rt ? rt.textContent : 'missing');
  if (rt) rt.click();
  await wait(300);
  ok('the tab switch itself does not move either remembered place',
    mem.albums === 240 && mem.playlists === 900, JSON.stringify(mem));
  // A plain re-render lands between the tap and the half switch (a metadata read
  // does this on a phone), which is the moment the wish used to be read by a
  // render that had no business consuming it.
  try { win.renderList(); } catch (e) { ok('the list can be re-rendered', false, e.message); }
  await wait(200);
  writes = [];
  win.navigate('albums');
  await wait(250);
  ok('entering Albums after the tap still puts Albums back at 240',
    pane.scrollTop === 240, 'scrollTop = ' + pane.scrollTop + ', wrote ' + JSON.stringify(writes.slice(0, 6)));
  ok('and the tap did not overwrite either place',
    mem.albums === 240 && mem.playlists === 900, JSON.stringify(mem));
  win.navigate('playlists');
  await wait(250);
  ok('and then Playlists still comes back to 900', pane.scrollTop === 900,
    'scrollTop = ' + pane.scrollTop);

  console.log('\n- the record tap in Playlists moves only Playlists -');
  win.navigate('playlists');
  await wait(250);
  writes = [];
  try { win.__scJumpToPlayingSong(TRACKS.find((t) => t.id === 't9')); } catch (e) { ok('the jump runs', false, e.message); }
  await wait(600);
  ok('the jump leaves the song on screen in the Playlists half', !!row('t9'),
    pane.textContent.slice(0, 40));
  ok('nothing in it asks the pane for the Albums offset', writes.indexOf(240) === -1,
    'wrote ' + JSON.stringify(writes.slice(0, 8)));
  ok('and the Albums place is exactly what it was', mem.albums === 240, JSON.stringify(mem));
  writes = [];
  win.navigate('albums');
  await wait(250);
  ok('so Albums still opens at 240 after the jump', pane.scrollTop === 240,
    'scrollTop = ' + pane.scrollTop + ', wrote ' + JSON.stringify(writes.slice(0, 6)));

  console.log('\n- and the one in Albums moves only Albums -');
  win.navigate('playlists');
  await wait(250);
  setTop(900);
  ok('Playlists is left at 900 again', pane.scrollTop === 900, 'scrollTop = ' + pane.scrollTop);
  writes = []; // our own seeding write above goes through the same setter
  win.navigate('albums');
  await wait(250);
  ok('Albums is at its own 240 before the tap', pane.scrollTop === 240, 'scrollTop = ' + pane.scrollTop);
  try { win.__scOpenAlbumForCurrentSong(); } catch (e) { ok('the album tap runs', false, e.message); }
  await wait(800);
  ok('the tap opened the album the song is in', pane.querySelectorAll('[data-album-name]').length >= 2,
    pane.querySelectorAll('[data-album-name]').length + ' album cards');
  ok('and nothing in it wrote the Playlists offset', writes.indexOf(900) === -1,
    'wrote ' + JSON.stringify(writes.slice(0, 8)));
  writes = [];
  win.navigate('playlists');
  await wait(250);
  ok('Playlists comes back to where it was, not to the album it was not in',
    pane.scrollTop === 900, 'scrollTop = ' + pane.scrollTop + ', wrote ' + JSON.stringify(writes.slice(0, 6)));
  ok('and the Albums place is the album it was left in, not the Playlists offset',
    mem.albums !== 900, 'albums = ' + mem.albums);

  console.log('\n- nothing threw while the halves were driven -');
  ok('no real runtime error', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
