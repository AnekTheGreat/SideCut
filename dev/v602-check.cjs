// v60.2 audit — the record-player tap follows the tab you are in:
//   • in Playlists it scrolls to the playing song in the list you have open
//   • in Albums it opens that song's album, scrolled and highlighted
//   • the highlight survives a list re-render (it is a record, not a one-shot class)
//   • and NEITHER path scrolls the page itself (the "whole app lifted up" glitch)
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (hay, needle) => hay.split(needle).length - 1;

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

const TRACKS = [
  { id: 't1', blob: 'blob-a', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 200 },
  { id: 't2', blob: 'blob-b', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 200 },
  { id: 't3', blob: 'blob-c', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 200 },
];
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3'], 'Punjabi Gaane': ['t1', 't2'], 'Empty-ish': ['t3'] };
const ALBUMS = {
  // a hand-made album holding the playing song, and one the app created by itself
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2'], createdAt: 1, manual: true },
  'Auto Album': { artist: 'Sidhu Moose Wala', trackIds: ['t3'], createdAt: 2, auto: true },
};

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS)) }],
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
    _data: data,
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
  const idb = fakeIndexedDB();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = idb;
      win.confirm = () => true;
      win.localStorage.clear();
      win.fetch = () => Promise.reject(new Error('offline'));
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
    },
  });
  const win = dom.window;
  // jsdom has no layout: synthesize enough geometry that the scroll engine has a
  // real distance to travel (a 0px target would read as "already centered").
  win.Element.prototype.getBoundingClientRect = function () {
    try {
      if (this.id === 'listPane') return { top: 0, bottom: 600, height: 600, left: 0, right: 360, width: 360, x: 0, y: 0 };
      if (this.classList && this.classList.contains('track')) {
        const paneEl = win.document.getElementById('listPane');
        const idx = Array.prototype.indexOf.call(paneEl ? paneEl.querySelectorAll('.track') : [], this);
        const top = 500 + Math.max(0, idx) * 80;
        return { top, bottom: top + 70, height: 70, left: 0, right: 360, width: 360, x: 0, y: top };
      }
    } catch (e) {}
    return { top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0, x: 0, y: 0 };
  };
  return { dom, idb, errors, win };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);

function stubAudio(win) {
  ['audioEl', 'audioEl2'].forEach((id) => {
    const el = win.document.getElementById(id);
    if (!el) return;
    let pos = 0;
    try {
      Object.defineProperty(el, 'paused', { get: () => el.__paused !== false, configurable: true });
      Object.defineProperty(el, 'ended', { get: () => false, configurable: true });
      Object.defineProperty(el, 'duration', { get: () => el.__dur || 0, configurable: true });
      Object.defineProperty(el, 'currentTime', { get: () => pos, set: (v) => { pos = v; }, configurable: true });
      Object.defineProperty(el, 'src', { get: () => el.__src || 'blob:fake', set: (v) => { el.__src = v; }, configurable: true });
    } catch (e) {}
    el.load = () => {};
    el.play = () => { el.__paused = false; return Promise.resolve(); };
    el.pause = () => { el.__paused = true; };
  });
}

// ── the page-scroll spy ────────────────────────────────────────────────────────
// The glitch was `scrollIntoView` bubbling out of #listPane and moving the whole
// page (the header and nav pills ride up with it). Count every route a scroll has
// to leave the pane.
function watchPageScroll(win) {
  const seen = { scrollIntoView: 0, scrollTo: 0, scrollBy: 0, docTop: 0, bodyTop: 0, details: [] };
  win.Element.prototype.scrollIntoView = function () {
    seen.scrollIntoView++;
    seen.details.push('scrollIntoView on ' + (this.id || this.className || this.tagName));
  };
  win.scrollTo = function () { seen.scrollTo++; seen.details.push('window.scrollTo'); };
  win.scrollBy = function () { seen.scrollBy++; seen.details.push('window.scrollBy'); };
  ['documentElement', 'body'].forEach((which) => {
    const el = win.document[which];
    if (!el) return;
    let v = 0;
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => v,
      set: (nv) => { if (nv !== v) { v = nv; if (which === 'documentElement') seen.docTop++; else seen.bodyTop++; seen.details.push('page scrollTop=' + nv); } },
    });
  });
  seen.reset = () => { seen.scrollIntoView = 0; seen.scrollTo = 0; seen.scrollBy = 0; seen.docTop = 0; seen.bodyTop = 0; seen.details.length = 0; };
  seen.clean = () => seen.scrollIntoView + seen.scrollTo + seen.scrollBy + seen.docTop + seen.bodyTop;
  return seen;
}

// Count writes to the pane's own scrollTop — that IS the app's engine working.
function watchPaneScroll(pane) {
  const seen = { writes: 0, last: 0 };
  let v = 0;
  Object.defineProperty(pane, 'scrollTop', {
    configurable: true,
    get: () => v,
    set: (nv) => { v = nv; seen.writes++; seen.last = nv; },
  });
  Object.defineProperty(pane, 'clientHeight', { configurable: true, get: () => 600 });
  Object.defineProperty(pane, 'scrollHeight', { configurable: true, get: () => 4000 });
  return seen;
}

const rowIn = (pane, id) => pane.querySelector('.track[data-id="' + id + '"]');
const focused = (pane) => Array.prototype.map.call(pane.querySelectorAll('.sc-album-focus'), (r) => r.dataset.id);

(async () => {
  // ── A. Playlists: the jump stays in the list you are looking at ──
  {
    console.log('\n— In Playlists, the record player scrolls to the song in the list —');
    const { win, errors } = boot();
    await wait(3200);
    stubAudio(win);
    win.navigate('playlists');
    await wait(250);
    const tab = win.document.querySelector('#tabs .tab[data-playlist-name="Punjabi Gaane"]');
    ok('the Punjabi Gaane playlist tab is there to open', !!tab);
    if (tab) tab.click();
    await wait(300);
    ok('the playlist is the one on screen', win.__scGetActivePlaylist() === 'Punjabi Gaane', win.__scGetActivePlaylist());

    win.playFromList(['t1', 't2'], 't1');
    await wait(350);
    ok('a song is playing', win.document.getElementById('nowPlaying').style.display !== 'none');

    const spy = watchPageScroll(win);
    const pane = win.document.getElementById('listPane');
    const paneScroll = watchPaneScroll(pane);
    spy.reset();
    win.__scOpenAlbumForCurrentSong();
    await wait(800);

    ok('the tap does not throw the app over to Albums', win.__scGetLibraryMode() === 'playlists', win.__scGetLibraryMode());
    ok('the playlist you had open is still the one open', win.__scGetActivePlaylist() === 'Punjabi Gaane', win.__scGetActivePlaylist());
    const row = rowIn(pane, 't1');
    ok('the playing song is still in the list', !!row);
    ok('and its row is highlighted', !!row && row.classList.contains('sc-album-focus'), row ? row.className : 'no row');
    ok('the scroll was written on the list pane itself', paneScroll.writes > 0, paneScroll.writes + ' writes');
    ok('nothing scrolls the page itself', spy.clean() === 0, spy.details.slice(0, 3).join(' | '));

    // A re-render rebuilds every row — the highlight has to come back with it.
    if (tab) tab.click();
    await wait(250);
    const after = rowIn(pane, 't1');
    ok('the highlight survives the list being re-rendered',
       !!after && after.classList.contains('sc-album-focus'),
       after ? after.className : 'no row');
    ok('and it is still the playing song that is highlighted', focused(pane).join(',') === 't1', JSON.stringify(focused(pane)));
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
    win.close();
  }

  // ── B. Albums: the jump opens that song's album ──
  {
    console.log('\n— In Albums, the record player opens the album the song is in —');
    const { win, errors } = boot();
    await wait(3200);
    stubAudio(win);
    win.navigate('albums');
    await wait(350);
    ok('the library is on Albums', win.__scGetLibraryMode() === 'albums', win.__scGetLibraryMode());
    win.playFromList(['t1', 't2'], 't1');
    await wait(350);

    const spy = watchPageScroll(win);
    const pane = win.document.getElementById('listPane');
    const paneScroll = watchPaneScroll(pane);
    spy.reset();
    win.__scOpenAlbumForCurrentSong();
    await wait(800);

    ok('it stays in Albums', win.__scGetLibraryMode() === 'albums', win.__scGetLibraryMode());
    const card = pane.querySelector('[data-album-name="MoonChild Era"]');
    ok('the album the song is in is on screen', !!card, card ? 'found' : pane.innerHTML.slice(0, 120));
    ok('the app-created album is not the one being opened',
       pane.querySelector('[data-album-name="Auto Album"]') === null || !win.__scAutoAlbumNames().includes('MoonChild Era'));
    const row = rowIn(pane, 't1');
    ok('the song row is there', !!row);
    ok('and it is highlighted', !!row && row.classList.contains('sc-album-focus'), row ? row.className : 'no row');
    ok('the scroll was written on the list pane itself', paneScroll.writes > 0, paneScroll.writes + ' writes');
    ok('nothing scrolls the page itself', spy.clean() === 0, spy.details.slice(0, 3).join(' | '));
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
    win.close();
  }

  // ── B2. Albums: a CLOSED album card — its rows are only built when a card is
  // expanded, and a re-render rebuilds every card closed. This is the state the
  // user's tap actually arrives in (v60.1.3: the jump opens the card itself).
  {
    console.log('\n— In Albums, tapping the record player opens a closed album —');
    const { win, errors } = boot();
    await wait(3200);
    stubAudio(win);
    win.navigate('albums');
    await wait(300);
    win.playFromList(['t1', 't2'], 't1');
    await wait(350);
    win.localStorage.setItem('sidecut_albColl_MoonChild Era', '1');
    win.navigate('albums');
    await wait(500);
    const pane = win.document.getElementById('listPane');
    const card = pane.querySelector('[data-album-name="MoonChild Era"]');
    ok('the album is on screen with its songs still unbuilt',
       !!card && card.querySelectorAll('.track').length === 0,
       card ? card.querySelectorAll('.track').length + ' rows' : 'no card');

    const spy = watchPageScroll(win);
    const paneScroll = watchPaneScroll(pane);
    spy.reset();
    win.__scOpenAlbumForCurrentSong();
    await wait(900);

    const row = rowIn(pane, 't1');
    // Re-query: a redraw can replace the card element while the tap is in flight,
    // so the reference held before the jump may be a detached node.
    const cardAfter = pane.querySelector('[data-album-name="MoonChild Era"]');
    ok('the tap opens that album card', !!cardAfter && cardAfter.querySelectorAll('.track').length === 2,
       cardAfter ? cardAfter.querySelectorAll('.track').length + ' rows' : 'no card');
    ok('the playing song is in the opened card', !!row && !!cardAfter && !!cardAfter.querySelector('.track[data-id="t1"]'));
    ok('and it is highlighted', !!row && row.classList.contains('sc-album-focus'), row ? row.className : 'no row');
    ok('the list scrolled to it', paneScroll.writes > 0, paneScroll.writes + ' writes');
    ok('nothing scrolls the page itself', spy.clean() === 0, spy.details.slice(0, 3).join(' | '));
    const toastEl = win.document.getElementById('toast');
    const toastText = toastEl ? String(toastEl.textContent || '') : '';
    ok('no toast is raised on the way', !/Opened/.test(toastText), JSON.stringify(toastText.slice(0, 60)));
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
    win.close();
  }

  // ── C. the song is not in the playlist you have open ──
  {
    console.log('\n— If the open playlist does not hold the song, it opens All Songs —');
    const { win, errors } = boot();
    await wait(3200);
    stubAudio(win);
    win.navigate('playlists');
    await wait(250);
    win.playFromList(['t1'], 't1');
    await wait(300);
    const tab = win.document.querySelector('#tabs .tab[data-playlist-name="Empty-ish"]');
    if (tab) tab.click();
    await wait(300);
    ok('playlist Empty-ish (which does not hold the playing song) is open',
       win.__scGetActivePlaylist() === 'Empty-ish', win.__scGetActivePlaylist());

    const spy = watchPageScroll(win);
    const pane = win.document.getElementById('listPane');
    const paneScroll = watchPaneScroll(pane);
    spy.reset();
    win.__scOpenAlbumForCurrentSong();
    await wait(800);

    ok('it falls back to All Songs instead of dead-ending', win.__scGetActivePlaylist() === 'All Songs', win.__scGetActivePlaylist());
    ok('still in Playlists', win.__scGetLibraryMode() === 'playlists', win.__scGetLibraryMode());
    const row = rowIn(pane, 't1');
    ok('and the playing song is scrolled to and highlighted', !!row && row.classList.contains('sc-album-focus'),
       row ? row.className : 'no row');
    ok('the scroll was written on the list pane itself', paneScroll.writes > 0, paneScroll.writes + ' writes');
    ok('nothing scrolls the page itself', spy.clean() === 0, spy.details.slice(0, 3).join(' | '));
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
    win.close();
  }

  // ── D. the source never reaches for a page-level scroll again ──
  {
    console.log('\n— Neither jump may use scrollIntoView as its path to the row —');
    const bodyOf = (decl) => {
      const i = html.indexOf(decl);
      if (i === -1) return '';
      const j = html.indexOf('\n  }\n', i);
      return html.slice(i, j === -1 ? i + 5000 : j);
    };
    const jump = bodyOf('function jumpToPlayingSong(t){');
    const album = bodyOf('function openAlbumForCurrentSong(){');
    ok('the playlist jump exists', jump.length > 0);
    ok('it scrolls through the app engine', count(jump, 'smoothScrollIn(') > 0);
    ok('and never with scrollIntoView', count(jump, 'scrollIntoView(') === 0,
       count(jump, 'scrollIntoView(') + ' calls');
    ok('the album jump exists', album.length > 0);
    ok('it scrolls through the app engine', count(album, 'smoothScrollIn(') > 0);
    // v60.1.3 removed the last one: the album jump now expands the album card
    // itself and scrolls through the app engine, and its fallback writes
    // scrollTop on the pane — nothing in either jump can lift the whole app.
    ok('and never uses scrollIntoView at all', count(album, 'scrollIntoView(') === 0,
       count(album, 'scrollIntoView(') + ' calls');
    ok('the tab you are in is what picks the path',
       album.indexOf('libraryMode') !== -1 && album.indexOf('jumpToPlayingSong(t)') !== -1);
    ok('the highlight is a record the row builders apply',
       html.indexOf('function scFocusRow(') !== -1 && count(html, 'scFocusClassFor(') >= 5,
       count(html, 'scFocusClassFor(') + ' row builders');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
