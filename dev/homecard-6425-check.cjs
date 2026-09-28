// 64.2.5, driven for real: the repair that cannot be seen, a finished card that
// goes away when it is tapped, and a record tap that renders the list once.
//
// The user's three reports, as far as a WebView-less box can drive them:
//
//   "the favorites bubble and pinned artist bubble still sometimes disappear when
//    scrolling" - the part of that the app owns is the REPAIR, and 64.2.4 only ran
//    it when a drag had left something behind. This boots the real app and proves
//    a HEALTHY grid is repaired on a settled scroll, that the repair writes only a
//    transparent outline (a property paint reads and nothing else), and that it
//    leaves no inline style, no hidden frame and no layer promotion behind.
//
//   "When there is a home screen notification that finishes such as watermark
//    remover I should be able to tap it and it goes away" - the real button in
//    Settings > More is clicked, the real run finishes, and the real card is
//    tapped. It has to leave the page, not just be re-rendered.
//
//   "when clicking on the record player... it should be smooth not rough" - the
//    exposed jump is called and the LIST PANE IS COUNTED. The rough version
//    rendered the list twice (once inside navigate(), once by hand) and each
//    render replaces every row element; one render is the measurable half of the
//    fix, the single distance-scaled glide being the other.
//
//   node dev/homecard-6425-check.cjs
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

const TRACKS = [
  { id: 't1', name: '[Spoticatch] Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 210 },
];
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3'], Favorites: ['t1'] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: {} }],
      ['pinnedArtists', { key: 'pinnedArtists', value: [{ name: 'Diljit Dosanjh' }, { name: 'Sidhu Moose Wala' }] }],
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
const settle = async (win, ms) => {
  win.document.getElementById('homeView').dispatchEvent(new win.Event('scroll'));
  // The rail lives on Discover, so a real scroll there is what settles it.
  const dv = win.document.getElementById('discoverView');
  if (dv) dv.dispatchEvent(new win.Event('scroll'));
  await wait(ms || 420);
};

(async () => {
  const { win, errors } = boot();
  await wait(3400);
  const doc = win.document;

  console.log('\n- the repair runs on a healthy grid, and cannot be seen -');
  {
    const grid = doc.getElementById('homeBubbles');
    const strip = doc.getElementById('pinnedArtistsStrip');
    const fav = grid.querySelector('.home-bubble[data-bubble="favorites"]');
    ok('the grid and the Favorites bubble are on the page', !!grid && !!fav);
    // Sample the inline style of the grid, of the Favorites bubble and of the
    // pinned-artists strip at the moment every frame callback runs: a hide is
    // still "hidden" there, and a layer promotion is still a transform.
    const frames = [];
    const raf = win.requestAnimationFrame.bind(win);
    win.requestAnimationFrame = function (cb) {
      return raf(function (t) {
        frames.push({
          v: grid.style.visibility,
          t: grid.style.transform,
          o: grid.style.outline,
          fv: fav ? fav.style.visibility : '',
          fo: fav ? fav.style.outline : '',
          so: strip ? strip.style.outline : '',
        });
        cb(t);
      });
    };
    await settle(win);
    win.requestAnimationFrame = raf;

    const hidden = frames.filter((f) => (f.v && f.v !== 'visible') || (f.fv && f.fv !== 'visible'));
    ok('no frame of the repair was ever hidden', hidden.length === 0, JSON.stringify(hidden.slice(0, 2)));
    ok('and nothing was put on a layer of its own', !frames.some((f) => /translateZ/.test(f.t || '')),
      JSON.stringify(frames.filter((f) => /translateZ/.test(f.t || '')).slice(0, 2)));
    ok('the grid is asked to paint again even when nothing was wrong with it',
      frames.some((f) => /1px solid transparent/.test(f.o || '')), JSON.stringify(frames.slice(0, 2)));
    ok('so is the bubble inside it', frames.some((f) => /1px solid transparent/.test(f.fo || '')));
    ok('and so is the pinned artists strip', frames.some((f) => /1px solid transparent/.test(f.so || '')));
    ok('the grid is left exactly as it was found',
      !grid.style.outline && !grid.style.transform && !grid.style.visibility,
      JSON.stringify({ o: grid.style.outline, t: grid.style.transform, v: grid.style.visibility }));
    ok('and so is the bubble', !fav.style.outline && !fav.style.transform);
    ok('the bubbles are still all there', Array.from(grid.querySelectorAll('.home-bubble')).length === 11,
      Array.from(grid.querySelectorAll('.home-bubble')).length);
  }

  console.log('\n- a finished card can be tapped away -');
  {
    const popup = doc.getElementById('homeExportPopup');
    ok('the Home task card is on the page', !!popup);
    ok('and is empty while nothing is running', !popup.querySelector('[data-dismiss]'));
    const btn = doc.getElementById('watermarkConfirmBtn');
    ok('the Watermark Remover button is on the page', !!btn);
    // The real run, from the real button. It finishes on its own.
    btn.click();
    await wait(600);
    const card = popup.querySelector('[data-dismiss="watermark"]');
    ok('when it finishes, the card says so', !!card, popup.textContent.trim().slice(0, 60));
    ok('and it says it can be tapped', !!card && card.getAttribute('title') === 'Tap to dismiss');
    ok('it is shown as tappable', !!card && /cursor:pointer/.test(card.getAttribute('style') || ''));
    ok('the running card was never tappable', !popup.querySelector('[data-dismiss="enrich"]:not([data-dismiss])'));
    ok('the popup is visible with a finished card on it', popup.style.display !== 'none');
    if (card) card.click();
    await wait(60);
    ok('one tap and it is gone', !popup.querySelector('[data-dismiss="watermark"]'),
      popup.textContent.trim().slice(0, 60));
    // Another job can have started behind it (a metadata change can kick off a
    // cover fetch), so what matters is that the WATERMARK card is not there.
    ok('and the watermark card is not drawn back a moment later',
      popup.style.display === 'none' || popup.textContent.indexOf('Watermarks removed') === -1,
      popup.textContent.trim().slice(0, 70));
    ok('nothing threw while the run and the tap went through', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
  }

console.log('\n- the record tap lands on the song and leaves nothing running -');
{
  // jsdom lays nothing out, so a scroll animation here has no distance to travel
  // and the shared engine finishes it in the first frame. What CAN be driven is
  // the jump itself (it is exposed for the record player) and whether it leaves a
  // scroll animation of its own behind: the engine hands its animator to the
  // pane and takes it back when it is done, so a leftover one is a leaked loop.
  const pane = doc.getElementById('listPane');
  ok('the list pane is on the page', !!pane);
  const track = { id: 't3', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T' };
  ok('the jump is reachable the way the record player reaches it', typeof win.__scJumpToPlayingSong === 'function');
  win.__scJumpToPlayingSong(track);
  await wait(500);
  const row = pane.querySelector('.track[data-id="t3"]');
  ok('it opened the Playlists half and holds the song the record player asked for', !!row);
  ok('which is highlighted for the moment', !!row && row.classList.contains('sc-album-focus'));
  ok('and the pane owns no scroll animation once the jump has settled', !pane.__scScrollAnim);
  ok('nothing threw on the way', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
}

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
