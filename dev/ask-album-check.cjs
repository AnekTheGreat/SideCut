// 75.0 - ASK SIDECUT IS A NORMAL BUTTON, AND IT CAN MAKE AN ALBUM.
//
// The owner, two asks with one screenshot: "this is a stupid button placement for ask
// SideCut change it to a regular button ... put it below settings as a bigger button
// than settings" and "THE ASK SIDECUT SHOULD BE ABLE TO DO THIS BASIC SHIT" - the
// drawer was deflecting "create an album called MooseTape that has all sidhu moose
// wala's MooseTape songs in there" to the browse lecture "Songs are organized by
// artist and album automatically."
//
//   [1] the trigger is a 26px overlay button on the listening-stats bubble, right
//       before the resize chip, one of it on the page, and the bubbles are gone;
//   [2] the owner's sentence becomes ONE album step and creates nothing yet;
//   [3] Do it files the album under its one artist with exactly those songs, through
//       the app's own maker - no dialog, no keyboard;
//   [4] Undo takes the album away exactly;
//   [5] the maker itself: creates, merges only what is missing, names the album
//       Various Artists when the songs disagree, and the snapshot/restore round trip;
//   [6] an album name the library already has plans its own real songs (the second
//       shape of the same grammar);
//   [7] no uncaught page errors while any of this ran.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

// Sidhu's two songs carry albums the sentence does NOT name - that is the MooseTape
// case: the artist is in the sentence, the album name is nowhere in the library.
const TRACKS = [
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171 },
  { id: 't4', name: '295', artist: 'Sidhu Moose Wala', album: 'PBX1', duration: 212 },
  { id: 't5', name: 'Dope', artist: 'Sidhu Moose Wala', album: 'Never Forget', duration: 178 },
].map((t) => Object.assign(t, { blobType: 'audio/mpeg', fileName: t.id + '.mp3' }));

function fakeIDB(win) {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, Object.assign({}, t)])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [] } }],
    ]),
  };
  const tx = (store) => {
    const t = { oncomplete: null, onerror: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { data[store].set(v && v.key !== undefined ? v.key : v.id, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
      clear() { data[store].clear(); fire(); return {}; },
    });
    return t;
  };
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

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|Could not parse CSS|Could not load/i.test(m)) errors.push(m); });
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

let idb = null;
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () {
      return new Proxy({}, {
        get(t, p) {
          if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
          if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
          if (p === 'measureText') return () => ({ width: 10 });
          if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
          return undefined;
        },
        set() { return true; },
      });
    };
    win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    win.HTMLMediaElement.prototype.play = () => Promise.resolve();
    win.HTMLMediaElement.prototype.pause = () => {};
    win.HTMLMediaElement.prototype.load = () => {};
    win.URL.createObjectURL = () => 'blob:jsdom';
    win.URL.revokeObjectURL = () => {};
    TRACKS.forEach((t) => { t.blob = new win.Blob([new win.Uint8Array(64)], { type: 'audio/mpeg' }); });
    idb = fakeIDB(win);
    win.indexedDB = idb;
    win.fetch = () => Promise.reject(new Error('offline'));
    try { win.localStorage.clear(); } catch (e) {}
  },
});

const click = (win, el) => { if (el) el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, view: win })); return !!el; };
const meta = (key) => { const r = idb._data.meta.get(key); return r ? r.value : null; };
const albums = (win) => (win.__scGetUserAlbums ? win.__scGetUserAlbums() : {});

(async () => {
  const win = dom.window;
  await wait(7000);
  const doc = win.document;

  console.log('[1] a small overlay button on the listening-stats bubble, before the resize chip');
  {
    const all = doc.querySelectorAll('#homeAiBtn');
    ok(all.length === 1, 'exactly one Ask SideCut button on the page', all.length);
    const hb = all[0];
    const bubble = hb && hb.closest('.home-bubble');
    ok(!!bubble && bubble.dataset.bubble === 'stats', 'and it lives inside the listening-stats bubble', bubble && bubble.dataset.bubble);
    ok(hb.classList.contains('hb-ask'), 'as a .hb-ask overlay', hb.className);
    ok(hb.getAttribute('aria-label') === 'Ask SideCut about your music', 'labelled for anyone who cannot see the sparkle', hb.getAttribute('aria-label'));
    ok(hb.textContent.trim() === '', 'icon only - the wordy pill is gone', hb.textContent);
    ok(!doc.querySelector('header #homeAiBtn'), 'the header pill is gone');
    const expand = bubble && bubble.querySelector('.hb-expand');
    ok(!!expand, 'the bubble has its resize chip');
    ok(hb.nextElementSibling === expand, 'and the Ask button sits right before it', hb.nextElementSibling && hb.nextElementSibling.className);
    const askR = parseInt(win.getComputedStyle(hb).right, 10);
    const expR = parseInt(win.getComputedStyle(expand).right, 10);
    ok(isFinite(askR) && isFinite(expR) && askR > expR, 'top right, further from the edge than the resize - before it', askR + ' vs ' + expR);
    const askW = win.getComputedStyle(hb).width;
    ok(askW === win.getComputedStyle(expand).width, 'the same size as the bubble button it sits with', askW + ' vs ' + win.getComputedStyle(expand).width);
    ok(!doc.getElementById('scAskBubbles'), 'the floating bubble cluster is gone');
    ok(doc.querySelectorAll('.sc-ask-main, .sc-ask-pop').length === 0, 'and no bubble styling is left anywhere');
    click(win, hb);
    await wait(150);
    const bd = doc.getElementById('scAiBackdrop');
    ok(!!bd && bd.classList.contains('in'), 'pressing it opens the Ask drawer');
    const panel = doc.getElementById('homeBubbleOverlay');
    const panelShown = panel && panel.style.display && panel.style.display !== 'none';
    ok(!panelShown, 'and the stats panel stays closed - the tap belongs to the button', panel && panel.style.display);
    ok(!!doc.querySelector('[data-scai-chip*="album"]'), 'and the drawer offers the make-an-album chip');
  }

  if (!doc.getElementById('scAiInput')) {
    ok(false, 'the rest of this gate needs the Ask drawer, and this page has none');
    console.log('\nask-album-check: ' + pass + ' passed, ' + fail + ' failed');
    process.exit(1);
  }

  console.log('[2] the owner\'s sentence becomes one album step - and changes nothing yet');
  {
    const input = doc.getElementById('scAiInput');
    input.value = 'create an album called MooseTape that has all sidhu moose wala\u2019s MooseTape songs in there';
    click(win, doc.getElementById('scAiPlanBtn'));
    await wait(250);
    const planEl = doc.getElementById('scAiPlan');
    ok(planEl.classList.contains('on'), 'the plan is shown');
    const steps = Array.from(planEl.querySelectorAll('.scai-step')).map((s) => s.textContent);
    ok(steps.length === 1, 'with exactly one step - the album', steps);
    ok(/Create the album "MooseTape" with 2 songs/.test(steps[0] || ''), 'named and counted as the plan promises', steps[0]);
    ok(!albums(win).MooseTape, 'NOTHING has been created yet', Object.keys(albums(win)));
    const log = doc.getElementById('scAiLog').textContent;
    ok(!/organized by artist and album/.test(log), 'and the browse lecture is nowhere in the reply', log.slice(-140));
  }

  console.log('[3] Do it files it under its one artist, through the app\'s own maker');
  {
    click(win, doc.getElementById('scAiDoBtn'));
    await wait(500);
    const a = albums(win).MooseTape;
    ok(!!a, 'the album exists after Do it', Object.keys(albums(win)));
    ok(a && a.artist === 'Sidhu Moose Wala', 'filed under the one artist the sentence named', a && a.artist);
    ok(a && a.trackIds.slice().sort().join(',') === 't4,t5', 'holding exactly the artist\'s two songs', a && a.trackIds);
    ok(a && a.manual === true, 'stamped as an album of yours', a && a.manual);
    ok(!!(meta('userAlbums') || {}).MooseTape, 'and the albums row is written down', meta('userAlbums'));
    const toastEl = doc.getElementById('toast');
    ok(/Done/.test(toastEl.textContent), 'the app says what it did', toastEl.textContent);
    ok(!!toastEl.querySelector('button'), 'and offers Undo', toastEl.textContent);
    ok(!doc.getElementById('scAiBackdrop').classList.contains('in'), 'the drawer closes behind it');
  }

  console.log('[4] Undo takes it back exactly');
  {
    click(win, doc.getElementById('toast').querySelector('button'));
    await wait(600);
    ok(!albums(win).MooseTape, 'the album this run created is gone', Object.keys(albums(win)));
    ok(!(meta('userAlbums') || {}).MooseTape, 'and the written row says so too', meta('userAlbums'));
  }

  console.log('[5] the maker: create, merge only what is missing, name, restore');
  {
    ok(win.__scAskAlbum('MooseTape', ['t4']) === 1, 'it creates an album and adds the song');
    ok(win.__scAskAlbum('MooseTape', ['t4']) === 0, 'a song the album already has adds nothing', win.__scAskAlbum('MooseTape', ['t4']));
    ok(win.__scAskAlbum('MooseTape', ['t5']) === 1, 'while a missing one lands');
    ok(win.__scAlbumExists('MooseTape'), 'and the existence check knows it');
    ok(win.__scAskAlbum('Road Trip', ['t1', 't4']) === 2, 'songs from two artists all land', win.__scAskAlbum('Road Trip', ['t1', 't4']));
    ok(albums(win)['Road Trip'].artist === 'Various Artists', 'and that album is filed under Various Artists', albums(win)['Road Trip']);
    const snap = win.__scAskAlbumSnap();
    ok(typeof snap === 'string' && snap.indexOf('MooseTape') !== -1, 'the snapshot carries the albums as they are');
    win.__scAskAlbum('Third Try', ['t2']);
    ok(!!albums(win)['Third Try'], 'an album made after the snapshot is there');
    ok(win.__scAskAlbumRestore(snap) === true, 'restore runs');
    ok(!albums(win)['Third Try'] && !!albums(win)['MooseTape'], 'and takes back exactly the ones since - the rest stays',
      Object.keys(albums(win)));
  }

  console.log('[6] an album the library already has plans its own real songs');
  {
    click(win, doc.getElementById('homeAiBtn'));
    await wait(150);
    const input = doc.getElementById('scAiInput');
    input.value = 'create an album called MoonChild Era with all Diljit Dosanjh songs';
    click(win, doc.getElementById('scAiPlanBtn'));
    await wait(250);
    const planEl = doc.getElementById('scAiPlan');
    ok(planEl.classList.contains('on'), 'the plan is shown');
    const steps = Array.from(planEl.querySelectorAll('.scai-step')).map((s) => s.textContent);
    ok(steps.length === 1, 'one step again', steps);
    ok(/Create the album "MoonChild Era" with 2 songs/.test(steps[0] || ''),
      'the named album collects its own songs under the artist it names',
      steps[0]);
    click(win, doc.getElementById('scAiCancelBtn'));
    await wait(120);
    ok(!planEl.classList.contains('on'), 'Cancel closes the plan');
    click(win, doc.getElementById('scAiClose'));
    await wait(120);
  }

  ok(errors.length === 0, 'no uncaught page errors while any of this ran', errors.slice(0, 3));

  console.log('\nask-album-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
