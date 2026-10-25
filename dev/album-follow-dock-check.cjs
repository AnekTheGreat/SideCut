// 74.1.9 - the album follows the song, the views come in, and the dock can be one
// sliding pill.
//
// The owner, in one message:
//
//   "In albums, when you skip a song to the next album if it starts a new album, the
//    old one should automatically close and the new one should automatically show
//    un-collapsed. Also make the apps and transitions in the apps very smooth and add
//    a feature in the bottom where the tabs are to set them to a pill like shape all
//    together kind of like iOS where you can hold and hover over what you want to
//    click or like slide it nicely, that would be a cool feature."
//
// Three claims, and each is DRIVEN rather than read off the file:
//
//   [1] release metadata - the head changelog entry is this build, the shell cache is
//       this build, and the entry names what the release actually does;
//   [2] the contract in the bytes - the capsule is built by the code and is NOT in the
//       markup, the styles exist, the Studio carries one switch for it;
//   [3] the album follows the song: with two albums open, a play that moves to the
//       other one closes the card the app opened and opens the new card, with its
//       rows built and the playing row marked - while a skip INSIDE the album, and an
//       album the user opened by hand, are both left alone;
//   [4] the views come in, and do not when reduced motion has been asked for;
//   [5] the pill dock, driven with real pointer events over a dock given a real
//       geometry: the capsule spans the tabs and stops before the plus, the highlight
//       starts on the lit tab, a mouse over another tab previews it without
//       navigating, a press-and-slide across the dock opens the tab it finished on
//       and not the one it started on, the click the browser fires for that press is
//       swallowed once while a plain tap still reaches its own handler, and the plus
//       is never a landing place.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
// The condition first, the claim second: every call below reads
// ok(what must be true, 'why it must be true', extraForTheFailureMessage).
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

function makeCtx() {
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

// Two albums, and a song that sits in a saved album and in a tag-only card at once
// (t2 is in 'MoonChild Era' and in 'Mixtape'), because the card that still holds the
// playing song is the one case the collapse rule must not touch.
const TRACKS = [
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171 },
  { id: 't5', name: 'Do You Know', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 199 },
].map((t) => Object.assign(t, { blobType: 'audio/mpeg', fileName: t.id + '.mp3' }));
// The stored audio itself. It has to be a Blob built INSIDE the jsdom window - a Blob
// from this Node realm is not one as far as the page's own File/Blob checks are
// concerned - and the app's load path reads record.blob to make the playing file, so
// without it every play bails before the now bar and nothing below is driven at all.
function buildBlobs(win) {
  TRACKS.forEach((t) => { t.blob = new win.Blob([new win.Uint8Array(180000 + t.duration * 100)], { type: 'audio/mpeg' }); });
}

const ALBUMS_START = {
  'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, manual: true },
  'Aurora Sessions': { artist: 'Diljit Dosanjh', trackIds: ['t4', 't5'], createdAt: 3, manual: true },
};
const PLAYLISTS_START = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS_START)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS_START)) }],
      ['albumOrder', { key: 'albumOrder', value: ['MoonChild Era', 'Aurora Sessions'] }],
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
    open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
  };
}

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
    win.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    win.HTMLMediaElement.prototype.pause = function () {};
    win.HTMLMediaElement.prototype.load = function () {};
    win.URL.createObjectURL = () => 'blob:jsdom-' + (win.__n = (win.__n || 0) + 1);
    win.URL.revokeObjectURL = () => {};
    // BEFORE the page's own scripts run: the library load copies what it finds here.
    buildBlobs(win);
    win.indexedDB = idb;
    win.fetch = () => Promise.reject(new Error('offline'));
    try { win.localStorage.clear(); } catch (e) {}
  },
});

// A pointer event jsdom can be given: a MouseEvent wearing the two pointer fields the
// dock reads. Dispatched on the element (bubbles) or on the window for the moves the
// drag listens for there.
function pev(win, type, x, y, pointerType) {
  const e = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: win });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: pointerType || 'touch' });
  return e;
}
function click(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, view: win }));
}

(async () => {
  const win = dom.window;
  await wait(6000);
  const doc = win.document;
  const VER = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';

  console.log('[1] release metadata');
  {
    ok(/^80\.2\.5$/.test(VER), 'the page is the release this probe is for (' + VER + ')');
    ok(sw.indexOf("const CACHE_NAME = 'sidecut-shell-v" + VER + "'") !== -1,
      'the shell cache moved with it');
    const head = (html.match(/const CHANGELOG = \[\n  \{ version: '([^']+)'/) || [])[1];
    ok(head === VER, 'the changelog head is this build (' + head + ')');
    const entry = html.slice(html.indexOf("version: '" + VER + "'"), html.indexOf("version: '" + VER + "'") + 4000);
    ok(/album/i.test(entry) && /pill dock/i.test(entry), 'and its notes name what the release does');
    ok(!/\bdownloader\b|\[FULL\]/i.test(entry), 'with no downloader term and no [FULL] marker in it');
  }

  console.log('\n[2] the contract in the bytes');
  {
    const strip = html.slice(html.indexOf('<div class="action-strip" id="actionStrip">'), html.indexOf('<div id="addSongsBackdrop"'));
    ok((strip.match(/<button id="[A-Za-z0-9_]+" class="action-pill"/g) || []).length === 4,
      'the dock markup still holds the four tabs and nothing else');
    ok(strip.indexOf('scDockPillTrack') === -1 && strip.indexOf('scDockPillThumb') === -1,
      'the capsule and the highlight are built by the code, not written into the markup');
    ok(html.indexOf('#scDockPillTrack, #scDockPillThumb{') !== -1,
      'the capsule and the highlight are styled');
    ok(html.indexOf('z-index: -1; pointer-events: none;') !== -1,
      'and drawn behind the labels, so no name is covered by them');
    ok(html.indexOf('.sc-view-in{ animation: scViewIn') !== -1, 'the view entrance is a real keyframe animation');
    ok(/@media \(prefers-reduced-motion: reduce\)\{ \.sc-view-in\{ animation: none; \} \}/.test(html),
      'which the device can switch off');
    ok(html.indexOf('body.sandbox-reduce-motion .sc-view-in{ animation: none; }') !== -1,
      'and so can the Sandbox switch');
    ok((html.match(/data-act="dockpill"/g) || []).length === 1, 'the Studio carries exactly one switch for it');
    ok((html.match(/function dockPillOn\(\)\{/g) || []).length === 1, 'asked for through one published name');
  }

  console.log('\n[3] the album follows the song');
  {
    // ONE queue that crosses both albums, started the way a tap starts one. Nothing
    // below calls playFromList again, so the leave-rule (which closes every album but
    // the playing one on the way OUT of the Albums tab) is out of the picture: a card
    // that closes below closed because the SONG left it, and nothing else.
    win.playFromList(['t1', 't2', 't3', 't4', 't5'], 't1', null);
    await wait(600);
    win.navigate('albums');
    await wait(900);
    const pane = doc.getElementById('listPane');
    const cardOf = (n) => pane.querySelector('[data-album-name="' + n + '"]');
    const bodyOf = (n) => { const c = cardOf(n); return c ? c.querySelector('[id^="alb_card_"]') : null; };
    // Cards are read live, never held: a re-render replaces them, and a held node
    // would answer for a card that is not on the screen any more.
    const openCard = async (n) => { if (bodyOf(n).style.display === 'none') { click(win, cardOf(n).firstElementChild); await wait(300); } };
    const closeCard = async (n) => { if (bodyOf(n).style.display !== 'none') { click(win, cardOf(n).firstElementChild); await wait(300); } };

    ok(!!cardOf('MoonChild Era') && !!cardOf('Aurora Sessions'), 'both album cards are on the Albums tab');
    await openCard('MoonChild Era');
    await closeCard('Aurora Sessions');
    ok(bodyOf('MoonChild Era').style.display === 'block' && bodyOf('Aurora Sessions').style.display === 'none',
      'album A is open and album B is shut, to start with');
    ok(bodyOf('MoonChild Era').querySelectorAll('.track').length === 3, 'with A\'s three rows built');

    // The probe's own footing first: the Next button has to actually advance, or
    // everything below is a claim about a skip that never happened.
    const s0 = win.__scPlaybackSnapshot();
    win.__scNext();
    await wait(500);
    const s1 = win.__scPlaybackSnapshot();
    ok(s1 && s1.queueIndex === s0.queueIndex + 1,
      'the skip button moves the queue on (' + s0.queueIndex + ' -> ' + (s1 && s1.queueIndex) + ')', s1);
    ok(!!win.document.querySelector('.track.playing') &&
      win.document.querySelector('.track.playing').dataset.id === 't2',
      'and the row it moved to is the row marked playing',
      win.document.querySelector('.track.playing') && win.document.querySelector('.track.playing').dataset.id);

    // t2 -> t3: another skip INSIDE the album. Nothing may move.
    win.__scNext();
    await wait(500);
    ok(bodyOf('MoonChild Era').style.display === 'block', 'a skip inside the album leaves it open');
    ok(!!bodyOf('MoonChild Era').querySelector('.track.playing') &&
      bodyOf('MoonChild Era').querySelector('.track.playing').dataset.id === 't3',
      'and the row that is playing is the row that is marked',
      bodyOf('MoonChild Era').querySelector('.track.playing') &&
        bodyOf('MoonChild Era').querySelector('.track.playing').dataset.id);

    // t3 -> t4: the skip OUT of A and into B, with nothing else in the way.
    win.__scNext();
    await wait(800);
    ok(bodyOf('Aurora Sessions').style.display === 'block',
      'skipping into the next album opens it', bodyOf('Aurora Sessions').style.display);
    ok(bodyOf('Aurora Sessions').querySelectorAll('.track').length === 2,
      'with its rows built', bodyOf('Aurora Sessions').querySelectorAll('.track').length);
    ok(!!bodyOf('Aurora Sessions').querySelector('.track.playing') &&
      bodyOf('Aurora Sessions').querySelector('.track.playing').dataset.id === 't4',
      'and the row that is playing is the row that is marked');
    ok(bodyOf('MoonChild Era').style.display === 'none',
      'while the album the song just left closes', bodyOf('MoonChild Era').style.display);
    ok(win.localStorage.getItem('sidecut_albColl_MoonChild Era') === '1',
      'and is written down as closed, so the next render agrees',
      win.localStorage.getItem('sidecut_albColl_MoonChild Era'));
    ok(bodyOf('MoonChild Era').children.length === 0,
      'its rows go with it, so no stale .playing row is left behind');

    // A card the user opened by hand is not the app's to close: open A again and skip
    // inside the album that is playing.
    await openCard('MoonChild Era');
    ok(bodyOf('MoonChild Era').style.display === 'block', 'the user opens album A by hand');
    win.__scNext();
    await wait(500);
    ok(bodyOf('MoonChild Era').style.display === 'block', 'and a skip inside another album does not close it');
    ok(bodyOf('Aurora Sessions').style.display === 'block', 'with the album that is playing still open');
  }

  console.log('\n[4] the views come in');
  {
    win.navigate('home');
    await wait(80);
    win.navigate('studio');
    await wait(40);
    ok(doc.getElementById('studioView').classList.contains('sc-view-in'),
      'the view that just arrived carries the entrance');
    await wait(420);
    ok(!doc.getElementById('studioView').classList.contains('sc-view-in'),
      'and it is taken off when the animation has played');

    doc.body.classList.add('sandbox-reduce-motion');
    win.navigate('home');
    await wait(80);
    win.navigate('studio');
    await wait(40);
    ok(!doc.getElementById('studioView').classList.contains('sc-view-in'),
      'with reduced motion on, a view does not animate at all');
    doc.body.classList.remove('sandbox-reduce-motion');
  }

  console.log('\n[5] the pill dock');
  {
    const strip = doc.getElementById('actionStrip');
    const homeBtn = doc.getElementById('homeBtn');
    const libraryBtn = doc.getElementById('libraryBtn');
    const plHalf = doc.getElementById('playlistsHalf');
    const alHalf = doc.getElementById('albumsHalf');
    const discoverBtn = doc.getElementById('discoverBtn');
    const studioBtn = doc.getElementById('studioBtn');
    const addBtn = doc.getElementById('dockAddBtn');
    const homeView = doc.getElementById('homeView');
    const studioView = doc.getElementById('studioView');
    // jsdom lays nothing out, so the dock is given a geometry: a 400px bar at the
    // bottom of the screen with four pills in it and the plus at the end.
    const R = {
      strip: { left: 0, top: 700, width: 400, height: 56 },
      homeBtn: { left: 10, top: 708, width: 90, height: 42 },
      libraryBtn: { left: 104, top: 708, width: 96, height: 42 },
      discoverBtn: { left: 204, top: 708, width: 90, height: 42 },
      studioBtn: { left: 298, top: 708, width: 90, height: 42 },
    };
    const give = (el, r) => Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: r.left, y: r.top, left: r.left, top: r.top, right: r.left + r.width,
        bottom: r.top + r.height, width: r.width, height: r.height }),
    });
    give(strip, R.strip);
    give(homeBtn, R.homeBtn);
    give(libraryBtn, R.libraryBtn);
    give(discoverBtn, R.discoverBtn);
    give(studioBtn, R.studioBtn);

    // Every read below goes through these two, because on a page WITHOUT this release
    // there is no capsule, no highlight and no way to ask for one - and a probe that
    // throws there costs the reader every check after it. A red has to be a report.
    const ty = (el, p) => (el && el.style ? el.style[p] : '(missing)');
    const th = (p) => ty(thumb, p);

    // 74.9 — THE PILL IS ON BY DEFAULT. These two used to pin the old opt-in
    // world (dock starts separate, capsule appears only when asked). The owner
    // made the capsule the standard, so boot now arrives joined and the switch
    // is what takes it apart; the checks below follow the new truth and the
    // rest of the flow (toggle off / on, the writes, the geometry) is unchanged.
    ok(doc.body.classList.contains('sc-dock-pill'), 'the dock arrives joined — the pill is the standard now');
    ok(!!doc.getElementById('scDockPillTrack'), 'the capsule is built at boot, not on request');
    ok(typeof win.__scSetDockPill === 'function', 'the app publishes the way to join it');
    if (typeof win.__scSetDockPill === 'function') win.__scSetDockPill(true);
    await wait(60);
    const track = doc.getElementById('scDockPillTrack');
    const thumb = doc.getElementById('scDockPillThumb');
    ok(doc.body.classList.contains('sc-dock-pill'), 'turning it on joins the dock');
    ok(win.localStorage.getItem('sidecut_dockPill') === '1', 'and writes the setting down');
    ok(!!track && !!thumb, 'the capsule and the highlight are built');
    ok(ty(track, 'left') === '6px' && ty(track, 'width') === '386px',
      'the capsule spans the tabs (' + ty(track, 'left') + ' + ' + ty(track, 'width') + ')');
    ok(ty(track, 'width') !== '398px', 'and stops before the plus, which is not part of it');
    ok(!!thumb && thumb.parentNode === strip, 'the highlight lives in the dock');

    win.navigate('home');
    await wait(80);
    ok(th('transform') === 'translateX(14px)', 'the highlight starts on the lit tab', th('transform'));
    ok(th('width') === '82px', 'with the width of the pill it is on', th('width'));

    strip.dispatchEvent(pev(win, 'pointermove', 250, 729, 'mouse'));
    await wait(40);
    ok(th('transform') === 'translateX(208px)', 'a mouse over Discover previews it', th('transform'));
    ok(!doc.getElementById('discoverView').classList.contains('active'), 'without navigating to it');
    strip.dispatchEvent(new win.Event('pointerleave'));
    await wait(40);
    ok(th('transform') === 'translateX(14px)', 'and leaving the dock puts the highlight back on the lit tab');

    // Press on Home, slide to Studio, release there.
    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
    await wait(30);
    ok(th('transform') === 'translateX(14px)', 'a press sets the highlight on what was pressed', th('transform'));
    win.dispatchEvent(pev(win, 'pointermove', 260, 729));
    await wait(30);
    ok(th('transform') === 'translateX(208px)', 'and it slides with the finger', th('transform'));
    win.dispatchEvent(pev(win, 'pointermove', 340, 729));
    await wait(30);
    ok(th('transform') === 'translateX(302px)', 'across the next pill as the finger keeps going');
    win.dispatchEvent(pev(win, 'pointerup', 340, 729));
    await wait(150);
    ok(studioView.classList.contains('active'), 'releasing on Studio opens Studio');
    ok(!homeView.classList.contains('active'), 'and Home, which the press started on, did not open as well');
    ok(th('transform') === 'translateX(302px)', 'the highlight settles on the tab that was chosen', th('transform'));
    ok(!homeBtn.classList.contains('sc-dock-hot'), 'with nothing left marked hot');

    // A slide inside the split Library tab. NOTE that no click was dispatched for the
    // Studio slide above, which is exactly the case the page has to survive: a slide
    // whose click never arrives must not arm anything that eats the NEXT press.
    // Counted as the click the BROWSER would fire: down and up inside the two halves
    // of one button share libraryBtn as their nearest common ancestor, so that is
    // where the click lands - and it must be the one the dock swallows.
    let anc = 0;
    libraryBtn.addEventListener('click', (ev) => { if (ev.target === libraryBtn) anc++; });
    plHalf.dispatchEvent(pev(win, 'pointerdown', 110, 715));
    win.dispatchEvent(pev(win, 'pointermove', 190, 745));
    win.dispatchEvent(pev(win, 'pointerup', 190, 745));
    await wait(150);
    ok(alHalf.classList.contains('active-half'),
      'a slide from the Library half to the Albums half lands on Albums, after a slide whose click never came');
    ok(th('transform') === 'translateX(156px)', 'with the highlight over the half that was chosen', th('transform'));
    ok(th('width') === '40px', 'and the half\'s own width', th('width'));
    click(win, libraryBtn);
    await wait(40);
    ok(anc === 0, 'the ancestor click the browser fires for that slide is swallowed, so the tab it began on cannot answer too');
    click(win, libraryBtn);
    await wait(40);
    ok(anc === 1, 'while a plain tap on the split tab still reaches its own handler');

    // ---- THE FEEL THE OWNER ASKED FOR, DRIVEN ---------------------------------
    // After a day with the joined dock: "make the pill like drag and move nicer it
    // should feel really smooth and nice and easy to use especially the diagonal
    // slant that especially and when I'm dragging it and releasing the pill it should
    // be nice". Three of those are answered below, and each one is driven with real
    // pointer events over the same geometry rather than read off the file.

    // (1) THE HIGHLIGHT IS THE FINGER'S while the finger is down. The thumb's spring
    // is what makes a hover preview and a settle feel like something, and it ran under
    // a live drag as well - so the highlight set off after the thumb and arrived a
    // quarter of a second later, which is the lag a slide was felt to have. The class
    // that takes it off is on for the length of a slide and off again on release.
    win.navigate('home');
    await wait(80);
    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
    await wait(20);
    ok(!doc.body.classList.contains('sc-dock-dragging'),
      'a press on its own takes nothing off the highlight');
    win.dispatchEvent(pev(win, 'pointermove', 90, 729));
    await wait(20);
    ok(doc.body.classList.contains('sc-dock-dragging'),
      'while it is sliding the highlight has no transition, so it tracks the thumb');
    ok(th('transform') === 'translateX(14px)', 'and it is still the pill the press was made on', th('transform'));
    win.dispatchEvent(pev(win, 'pointerup', 90, 729));
    await wait(120);
    ok(!doc.body.classList.contains('sc-dock-dragging'),
      'and the spring is back for the settle the moment the finger is off');

    // (2) THE DEAD ZONE, which is what the diagonal slant needed. A press used to be
    // a choice the moment it landed: down on Playlists, a thumb that wobbled a few
    // pixels across the divider lit Albums, and releasing there opened Albums. Nothing
    // is chosen until the finger has travelled SC_DOCK_SLIDE_MIN, and a press that
    // never gets there answers the half it landed on.
    let plClicks = 0, alClicks = 0;
    plHalf.addEventListener('click', () => { plClicks++; });
    alHalf.addEventListener('click', () => { alClicks++; });
    // On the library tab, with Albums on screen, so the half the library is really
    // showing is a HALF the highlight has to come back to - not the tab of a view
    // this press never opened.
    win.navigate('library');
    await wait(120);
    ok(libraryBtn.classList.contains('active') && alHalf.classList.contains('active-half'),
      'the library tab is lit and the library is showing Albums');
    plHalf.dispatchEvent(pev(win, 'pointerdown', 150, 725));   // Playlists, just above the divider
    await wait(20);
    ok(th('transform') === 'translateX(108px)', 'a press lights the half of the split tab it landed on', th('transform'));
    ok(th('width') === '40px', 'with that half\'s own width', th('width'));
    win.dispatchEvent(pev(win, 'pointermove', 156, 731));      // 6px, and across the divider
    await wait(20);
    ok(th('transform') === 'translateX(108px)',
      'a wobble of a few pixels over the divider does not move the highlight', th('transform'));
    win.dispatchEvent(pev(win, 'pointerup', 156, 731));
    await wait(120);
    ok(plClicks === 0 && alClicks === 0,
      'and releasing there chooses neither half: the press answers the one it was made on',
      { pl: plClicks, al: alClicks });
    ok(th('transform') === 'translateX(156px)',
      'while the highlight goes back to the half the library is really showing', th('transform'));

    // (3) A REAL SLIDE STILL LANDS, and the highlight wears the DIVIDER rather than
    // half of a rounded rectangle. The polygon is read back off the page and a point
    // each side of the drawn line is tested against it, so "the diagonal slant" is
    // answered by geometry and not by a picture of it.
    const polyOf = (s) => {
      const m = /^polygon\(([^)]*)\)$/.exec(String(s || ''));
      if (!m) return null;
      return m[1].split(',').map((p) => p.trim().split(/\s+/).map((v) => parseFloat(v)));
    };
    const inPoly = (pts, x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    };
    // The highlight's own box, the half inset 4px the way the capsule insets it.
    const AL_BOX = { left: 156, top: 712, right: 196, bottom: 746 };
    const PL_BOX = { left: 108, top: 712, right: 148, bottom: 746 };
    const pct = (b, x, y) => [((x - b.left) / (b.right - b.left)) * 100, ((y - b.top) / (b.bottom - b.top)) * 100];
    plHalf.dispatchEvent(pev(win, 'pointerdown', 110, 715));   // Playlists
    win.dispatchEvent(pev(win, 'pointermove', 190, 745));      // a real slide: Albums
    await wait(20);
    const apoly = polyOf(ty(thumb, 'clipPath') || thumb.style.getPropertyValue('clip-path'));
    ok(!!apoly && apoly.length >= 3,
      'the highlight over the Albums half is clipped to the region that half owns', ty(thumb, 'clipPath'));
    ok(!!apoly && !inPoly(apoly, ...pct(AL_BOX, 160, 716)),
      'so the corner above the divider is not in it');
    ok(!!apoly && inPoly(apoly, ...pct(AL_BOX, 170, 730)),
      'while the region below it is');
    win.dispatchEvent(pev(win, 'pointerup', 190, 745));
    await wait(150);
    ok(alClicks === 1, 'a real slide over the divider still lands on the half it finished in', alClicks);
    ok(alHalf.classList.contains('active-half'), 'and the library follows it');
    // It is the same line from the other side: a press on the Playlists half wears the
    // half that half owns, with the corner the divider cuts away left out.
    plHalf.dispatchEvent(pev(win, 'pointerdown', 120, 720));
    await wait(20);
    const ppoly = polyOf(ty(thumb, 'clipPath') || thumb.style.getPropertyValue('clip-path'));
    ok(!!ppoly && inPoly(ppoly, ...pct(PL_BOX, 145, 725)),
      'the Playlists half wears its own side of the same line', ty(thumb, 'clipPath'));
    ok(!!ppoly && !inPoly(ppoly, ...pct(PL_BOX, 145, 738)),
      'and the corner the divider cuts away is not in it');
    win.dispatchEvent(pev(win, 'pointercancel', 120, 720));
    await wait(80);
    win.navigate('home');
    await wait(80);
    ok((ty(thumb, 'clipPath') || '') === '', 'and a whole pill carries no clip at all', ty(thumb, 'clipPath'));

    // (4) A DRAG THAT OPENS NOTHING SAYS SO. Off the dock, or over the plus, there is
    // nothing to choose: the highlight goes back to the lit tab while the finger is
    // still down, the release opens nothing, and the dragging class is never left on
    // the page for the next press to inherit.
    win.navigate('home');
    await wait(80);
    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
    win.dispatchEvent(pev(win, 'pointermove', 60, 400));
    await wait(20);
    ok(th('transform') === 'translateX(14px)',
      'dragged off the dock, the highlight goes back to the tab that is lit', th('transform'));
    ok(doc.body.classList.contains('sc-dock-dragging'), 'with the slide still live');
    win.dispatchEvent(pev(win, 'pointerup', 60, 400));
    await wait(150);
    ok(homeView.classList.contains('active') && !studioView.classList.contains('active'),
      'and releasing there opens nothing');
    ok(!doc.body.classList.contains('sc-dock-dragging'), 'and leaves no dragging class behind');
    ok(th('clipPath') === '' , 'with the highlight back to a whole pill: no clip', th('clipPath'));

    // The plus is never a landing place.
    win.navigate('home');
    await wait(80);
    addBtn.dispatchEvent(pev(win, 'pointerdown', 397, 729));
    win.dispatchEvent(pev(win, 'pointermove', 340, 729));
    win.dispatchEvent(pev(win, 'pointerup', 340, 729));
    await wait(120);
    ok(!studioView.classList.contains('active'), 'a press that starts on the add-songs plus never slides into a tab');
    ok(th('transform') === 'translateX(14px)', 'and the highlight stays where it was', th('transform'));

    // (5) THE SEAMS BETWEEN THE PILLS ARE PART OF THE CAPSULE. The tabs sit six
    // pixels apart, so a finger dragged across the dock passes over six pixels of
    // nothing several times a second - and "nothing" used to throw the highlight
    // back to the lit tab and forward again on every seam, a flicker at exactly the
    // moment the dock was being slid. A point in a seam answers for the nearer pill.
    win.navigate('home');
    await wait(80);
    ok(R.homeBtn.left + R.homeBtn.width === 100 && R.libraryBtn.left === 104,
      'the probe\'s own geometry has a four-pixel seam between Home and Library');
    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
    win.dispatchEvent(pev(win, 'pointermove', 101, 729));
    await wait(20);
    ok(th('transform') === 'translateX(14px)',
      'a point in the seam nearer Home keeps the highlight on Home', th('transform'));
    win.dispatchEvent(pev(win, 'pointermove', 103, 729));
    await wait(20);
    ok(th('transform') === 'translateX(108px)',
      'and the same seam, nearer Library, carries it across without going blank', th('transform'));
    ok(th('width') === '40px', 'on the half of the split tab the finger is in', th('width'));
    win.dispatchEvent(pev(win, 'pointerup', 103, 729));
    await wait(150);
    ok(libraryBtn.classList.contains('active') && plHalf.classList.contains('active-half'),
      'and releasing in it opens the tab the seam was nearer to');

    // (6) THE RELEASE TAKES WHAT THE HIGHLIGHT IS SHOWING. A slide that ends a few
    // pixels below the dock used to open nothing, while the highlight was still
    // sitting on the tab it looked like it was going to take.
    win.navigate('home');
    await wait(80);
    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
    win.dispatchEvent(pev(win, 'pointermove', 340, 754));   // 4px past the dock's edge
    await wait(20);
    // The Studio tab is cut corner to corner - top LEFT to bottom RIGHT - so the two
    // halves are the LOWER triangle (Studio) and the UPPER one (Tools). Which half a
    // point is over is that line and nothing else: below it Studio, above it Tools.
    const studioBox = (name) => name === 'tools'
      ? R.studioBtn.left + R.studioBtn.width * 0.5 + 4      // the Tools half's box
      : R.studioBtn.left + 4;                               // the Studio half's box
    const over = (x, y) => ((x - R.studioBtn.left) / R.studioBtn.width)
                         - ((y - R.studioBtn.top) / R.studioBtn.height) > 0;
    const litName = () => {
      const sh = doc.getElementById('studioHalf'), tl = doc.getElementById('toolsHalf');
      return tl && tl.classList.contains('active-half') ? 'tools'
           : sh && sh.classList.contains('active-half') ? 'studio' : 'none';
    };
    // The style round-trips through a string, so the number is what is compared, not
    // its spelling: 338px and 338.0px are the same place on the dock.
    const movedTo = parseFloat(String(th('transform')).replace(/[^0-9.]/g, ''));
    const halfHere = over(340, 754) ? 'tools' : 'studio';
    ok(Math.abs(movedTo - studioBox(halfHere)) < 0.6,
      'a slide that drifts just past the edge still points at Studio - at the half the seam puts it in',
      th('transform') + ' vs ' + studioBox(halfHere).toFixed(1) + ' (' + halfHere + ')');
    win.dispatchEvent(pev(win, 'pointerup', 340, 754));
    await wait(150);
    ok(studioView.classList.contains('active'), 'and releasing there takes it');
    ok(litName() === halfHere, 'onto the half the seam put the finger in (' + litName() + ')');
    ok(!homeView.classList.contains('active'), 'without Home answering too');

    // ...and the other side of that same seam is reachable too: a drift over the pill's
    // top right is above the cut, which is Tools.
    win.navigate('home');
    await wait(80);
    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
    win.dispatchEvent(pev(win, 'pointermove', 370, 712));
    await wait(20);
    ok(over(370, 712) && Math.abs(parseFloat(String(th('transform')).replace(/[^0-9.]/g, '')) - studioBox('tools')) < 0.6,
      'and a drift over the top right of the pill lights the Tools half (' + th('transform') + ')');
    win.dispatchEvent(pev(win, 'pointerup', 370, 712));
    await wait(150);
    ok(litName() === 'tools' && studioView.classList.contains('active'),
      'which opens Studio on Tools (' + litName() + ')');

    // (7) A TICK PER CROSSING. One short buzz when the finger moves into another
    // tab - not one per pointermove, and not a burst per seam crossing.
    win.navigate('home');
    await wait(80);
    let ticks = 0;
    try { Object.defineProperty(win.navigator, 'vibrate', { configurable: true, value: () => { ticks++; return true; } }); } catch (e) {}
    homeBtn.dispatchEvent(pev(win, 'pointerdown', 50, 729));
    win.dispatchEvent(pev(win, 'pointermove', 110, 729));   // Home -> Library
    await wait(15);
    win.dispatchEvent(pev(win, 'pointermove', 112, 729));   // still Library
    win.dispatchEvent(pev(win, 'pointermove', 240, 729));   // Library -> Discover
    await wait(15);
    win.dispatchEvent(pev(win, 'pointerup', 240, 729));
    await wait(120);
    ok(ticks === 2, 'two crossings, two ticks - three moves do not make three', ticks);
    ok(!doc.querySelector('#scDockSeam'), 'and no second divider is drawn over the tab');

    // (8) THE CUT IS DRAWN BY THE TAB ITSELF, and only by the tab. Each split tab
    // carries one SVG line inside the button - corner to corner of that button's own
    // box, which is the box its clip paths are written in - so the slant that is drawn
    // and the region that is lit are the same line by construction. The dock used to
    // draw a second, dock-wide divider from a cached rectangle as well; the two drifted
    // a few pixels and a degree or two apart whenever the pills resized, which is what
    // two parallel diagonals on one tab looks like.
    win.navigate('library');
    await wait(150);
    const cutLine = (btnId) => {
      const svg = doc.querySelector('#' + btnId + ' > svg line');
      return svg ? [svg.getAttribute('x1'), svg.getAttribute('y1'),
                    svg.getAttribute('x2'), svg.getAttribute('y2')].join(' ') : '(missing)';
    };
    ok(cutLine('libraryBtn') === '100% 0 0 100%',
      'the Library tab draws its cut corner to corner, top right to bottom left (' + cutLine('libraryBtn') + ')');
    ok(cutLine('studioBtn') === '0 0 100% 100%',
      'and the Studio tab draws the other diagonal (' + cutLine('studioBtn') + ')');
    ok(!doc.getElementById('scDockSeam'), 'and neither of them has a second line beside it');

    // The Studio's own switch, end to end, through the published name.
    win.navigate('studio');
    await wait(600);
    const sw1 = doc.querySelector('#studioView [data-act="dockpill"]');
    ok(!!sw1, 'the Studio carries the switch');
    ok(!!sw1 && sw1.classList.contains('on'), 'and it reads the setting the page is on');
    if (sw1) click(win, sw1);
    await wait(300);
    ok(!doc.body.classList.contains('sc-dock-pill'), 'tapping it turns the joined dock off');
    ok(win.localStorage.getItem('sidecut_dockPill') === '0', 'and writes that down too');
    const sw2 = doc.querySelector('#studioView [data-act="dockpill"]');
    ok(!!sw2 && !sw2.classList.contains('on'), 'and the switch redraws saying so');
    if (sw2) click(win, sw2);
    await wait(300);
    ok(doc.body.classList.contains('sc-dock-pill'), 'and tapping it again brings the joined dock back');
  }

  const realErrors = errors.filter((e) =>
    e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1 &&
    e.indexOf('Could not parse CSS') === -1 && e.indexOf('offline') === -1 &&
    // The chart fetch is the same offline network as 'offline', reported by the
    // Discover loader under its own wording. This page has no chart to fetch.
    e.indexOf('chart unreachable') === -1);
  ok(realErrors.length === 0, 'no unexpected page errors', realErrors.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('the probe itself threw: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
