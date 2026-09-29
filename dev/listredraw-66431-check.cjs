// 64.3.1, driven for real: the list you are scrolling is not rebuilt underneath
// you, and a background pass updates the rows it changed instead of all of them.
//
// The user's report:
//
//   "The scrolling still needs to be smooth it's smooth for like 2 seconds then
//    gets clunky for the record player when you tap on it"
//
// What the app actually does, and what this probe measures on the real app:
//
//   runAutoEnrich() runs 2.5s after boot and fills in missing covers and artist
//   names. Every batch of 20 songs ended with a plain renderList() - and a
//   renderList EMPTIES #listPane and builds every row again. So a background job
//   that has nothing to do with the screen the user is on empties and rebuilds
//   the whole library list, every twenty songs, for as long as it runs. If the
//   list is being scrolled (or is gliding to the playing song after a record
//   tap) at that moment, the rows under the finger become new elements and every
//   one of them is re-rastered: that is the stutter, and it is why "smooth for a
//   moment, then clunky" is the shape of the report.
//
// Measured here: how many times the pane is emptied and filled while that pass
// runs, and whether a rebuild asked for during a glide (or during the finger)
// waits for the list to be still.
//
//   node dev/listredraw-66431-check.cjs
//   SC_HTML=/tmp/prefix-643.html node dev/listredraw-66431-check.cjs   # against 64.3
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

// Sixty songs that all need metadata, each with art already in place. With a
// cover missing, fetchCoverForTrack() walks five providers with a delay between
// each and a batch would take ten seconds to prove a point about six rows of DOM
// - so these have art and no artist, which is the same "needs enrichment" filter
// with none of the waiting. Three batches of twenty.
const TRACKS = [];
for (let i = 1; i <= 60; i++) {
  TRACKS.push({ id: 't' + i, name: 'Song ' + i, artist: 'Unknown artist', album: null,
    duration: 180 + i, artBlob: { size: 900 }, artUrl: null });
}
const PLAYLISTS = { 'All Songs': TRACKS.map((t) => t.id) };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }]]),
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

// Every rebuild is a burst of appends into the pane; a burst ends when there is a
// quiet gap. This is how many rows the app built, and how many times.
const bursts = [];
let pane = null;
let fetches = 0;

function boot() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      // Real Blobs: songNeedsMetadata() only asks for a cover when artBlob is
      // missing, and a cover walk is five providers with a delay between each - a
      // ten-second batch that proves nothing this probe is about.
      const art = new win.Blob([new Uint8Array(900)], { type: 'image/png' });
      TRACKS.forEach((t) => { t.artBlob = art; });
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = fakeIndexedDB();
      win.confirm = () => true;
      win.localStorage.clear();
      // The metadata endpoint answers, so the pass completes in a few frames
      // instead of waiting on a dead network.
      win.fetch = () => { fetches++; return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results: [{ found: true, artist: 'Real Artist', title: 'Real Title', album: 'Real Album' }] }),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve({ size: 0 }),
      }); };
      const origAppend = win.Element.prototype.appendChild;
      win.Element.prototype.appendChild = function (n) {
        if (this.id === 'listPane') {
          const now = Date.now();
          const last = bursts[bursts.length - 1];
          if (last && now - last.lastMs <= 30) { last.n++; last.lastMs = now; }
          else bursts.push({ n: 1, at: now, lastMs: now });
        }
        return origAppend.call(this, n);
      };
    },
  });
  return { dom, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
const rowsBuilt = () => bursts.reduce((n, b) => n + b.n, 0);
// Against an older build (SC_HTML=...) there is no guard to read, so the probe
// reports that instead of throwing - the comparison run has to reach its summary.
const isMoving = (win) => (typeof win.__scListMoving === 'function' ? win.__scListMoving() === true : 'no hook in this build');

(async () => {
  const { win, errors } = boot();
  await wait(1200);
  const doc = win.document;
  pane = doc.getElementById('listPane');

  console.log('\n- the pieces the report needs are on the page -');
  ok('the list pane is there', !!pane);
  ok('the library can be opened', typeof win.navigate === 'function');
  ok('the pane says whether the list is moving', typeof win.__scListMoving === 'function',
    typeof win.__scListMoving);
  ok('a rebuild can be asked for the way a metadata read asks', typeof win.renderList === 'function',
    typeof win.renderList);
  ok('and a row can be updated where it stands', typeof win.__scPatchListRows === 'function',
    typeof win.__scPatchListRows);

  // The library has to be on screen before the pass starts (2.5s after boot) for
  // the rebuilds a scrolling user would feel to happen at all.
  win.navigate('library');
  await wait(600);
  const openingBursts = bursts.length;
  const rowsAtOpen = rowsBuilt();
  ok('opening the library builds the list once', openingBursts === 1,
    openingBursts + ' burst(s), ' + rowsAtOpen + ' rows');
  ok('and the rows are the whole library', pane.children.length >= TRACKS.length,
    pane.children.length + ' rows for ' + TRACKS.length + ' songs');

  console.log('\n- the background pass only touches the rows it changed -');
  // The pass starts 2.5s after boot. Wait until it has nothing left to ask for
  // (no new API call for a second), which is the end of it - then look at what it
  // did to the list while it ran.
  {
    let last = -1, quiet = 0;
    for (let i = 0; i < 120 && quiet < 10; i++) {
      await wait(100);
      if (fetches === last) quiet++; else { quiet = 0; last = fetches; }
    }
  }
  // A rebuild is unmissable from the outside: the pane is emptied and every row
  // is built again, so the number of rows APPENDED to it during the pass is the
  // whole measure - it does not depend on when a batch happens to land.
  const rebuilt = rowsBuilt() - rowsAtOpen;
  const artistRow = pane.querySelector('.track[data-id="t1"] .track-info .a');
  const artistText = artistRow ? artistRow.textContent : '(no row)';
  let modelArtist = '(no model)';
  try { const m = win.__scGetAllTracks(); modelArtist = (m && m.find((t) => t.id === 't1') || {}).artist; } catch (e) {}
  ok('the pass ran and filled the songs in', artistText === 'Real Artist',
    'row ' + artistText + ' / model ' + modelArtist + ' (' + fetches + ' api call(s))');
  ok('and it built no rows at all to do it', rebuilt === 0,
    rebuilt + ' row(s) built again while the pass ran');
  ok('so the rows the user was looking at were never re-made',
    pane.children.length >= TRACKS.length, pane.children.length + ' rows');
  const stillThere = pane.querySelector('.track[data-id="t40"]');
  ok('a row the pass did not change is still the same element the list made', !!stillThere);
  ok('and the change went into the row that was already on screen',
    !!artistRow && artistRow.closest('.track').dataset.id === 't1');

  console.log('\n- a rebuild asked for during a glide waits for it -');
  // jsdom lays nothing out, so the pane is given a scroll range and the app's own
  // engine (window.__scAnimateScroll is the real one) is started on it.
  Object.defineProperty(pane, 'scrollHeight', { configurable: true, value: 6000 });
  Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 600 });
  let writes = 0;
  let desc = null;
  for (let p = pane; p && !desc; p = Object.getPrototypeOf(p)) desc = Object.getOwnPropertyDescriptor(p, 'scrollTop');
  if (desc && desc.set) {
    Object.defineProperty(pane, 'scrollTop', {
      configurable: true,
      get() { return desc.get.call(pane); },
      set(v) { writes++; desc.set.call(pane, v); },
    });
  }
  await wait(400);                       // let any pending rebuild land first
  const before = rowsBuilt();
  win.__scAnimateScroll(pane, 4000, 900);
  await wait(60);
  ok('the pane reports that it is moving while the glide is in flight', isMoving(win) === true,
    'writes so far ' + writes);
  ok('the glide is really running', writes >= 2, writes + ' scroll writes');
  win.renderList();                      // the call a metadata read makes
  await wait(260);
  ok('and the list is not rebuilt while it is still gliding', rowsBuilt() === before,
    (rowsBuilt() - before) + ' rows built mid-glide');
  await wait(1100);
  ok('the rebuild lands once the list is still', rowsBuilt() > before,
    'rows built after the glide: ' + (rowsBuilt() - before));
  ok('and nothing was lost by waiting', pane.children.length >= TRACKS.length,
    pane.children.length + ' rows');

  console.log('\n- and a rebuild asked for during the finger waits too -');
  const beforeFinger = rowsBuilt();
  pane.dispatchEvent(new win.Event('scroll'));   // the pane's own scroll handler stamps this
  ok('a scroll event says the list is moving', isMoving(win) === true);
  win.renderList();
  await wait(50);
  ok('the rebuild is held while the list is moving under the finger',
    rowsBuilt() === beforeFinger, (rowsBuilt() - beforeFinger) + ' rows built');
  await wait(300);
  ok('and lands as soon as it stops', rowsBuilt() > beforeFinger,
    'rows built: ' + (rowsBuilt() - beforeFinger));

  console.log('\n- the record tap is never made to wait -');
  const beforeTap = rowsBuilt();
  pane.dispatchEvent(new win.Event('scroll'));   // the list is still moving when the tap arrives
  try { win.__scJumpToPlayingSong(TRACKS.find((t) => t.id === 't40')); } catch (e) { ok('the jump runs', false, e.message); }
  await wait(200);
  ok('the tap draws its own list at once, even with the list still moving',
    rowsBuilt() > beforeTap, (rowsBuilt() - beforeTap) + ' rows built');
  ok('and the song it jumped to is on screen', !!pane.querySelector('.track[data-id="t40"]'),
    pane.children.length + ' rows');

  console.log('\n- nothing threw while all of that ran -');
  ok('no real runtime error', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
