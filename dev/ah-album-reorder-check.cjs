// v63 — albums under an artist in the 📀 Album History popup can be reordered.
//
// Opens a real Album History popup (the same markup the renderer emits), runs the
// app's own __wireAH over it, then holds an album row and drags it. Checks that
// the new order persists, that orderAlbumList re-applies it, that a cached body
// is reordered, that a plain tap still opens the tracks and a reorder drag does
// NOT toggle them, and that the cover long-press now only fires from the artwork.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return { width: 300, height: 150 };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'createPattern') return () => ({});
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop === 'measureText') return () => ({ width: 10 });
      if (typeof prop === 'string' && /^[a-z]/.test(prop)) return () => undefined;
      return undefined;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

const ARTIST = 'Diljit Dosanjh';
const ALBUMS = [
  { id: 'a1', name: 'Album One' },
  { id: 'a2', name: 'Album Two' },
  { id: 'a3', name: 'Album Three' },
];

// The body the renderer produces, trimmed to the parts this gesture touches.
function bodyHtml() {
  let h = '<div class="dp-ah-artist"><div class="dp-ah-artist-hdr" data-target="ahc_r_0">'
    + '<span class="dp-ah-chevron">▸</span><span style="font-size:13px;font-weight:600;flex:1;">' + ARTIST + '</span>'
    + '<span class="dp-ah-artist-refetch" data-artist="' + ARTIST + '">↻</span></div>'
    + '<div id="ahc_r_0" class="dp-ah-albums" style="display:none;padding:2px 0 4px 0;">';
  ALBUMS.forEach((a, i) => {
    h += '<div class="dp-ah-album" data-collection-id="' + a.id + '">'
      + '<div class="dp-ah-album-hdr" data-target="ahc_trk_0_' + i + '" data-artist="' + ARTIST + '" data-album="' + a.name + '" data-collection-id="' + a.id + '">'
      + '<span class="dp-ah-chevron">▸</span>'
      + '<div style="width:36px;height:36px;border-radius:6px;background-color:var(--bg);" data-art-url=""></div>'
      + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;">' + a.name + '</div>'
      + '<div style="font-size:11px;color:var(--ink-dim);display:flex;"><span style="flex:1;min-width:0;">2015-01-01</span></div></div>'
      + '</div>'
      + '<div id="ahc_trk_0_' + i + '" class="dp-ah-albums" style="display:none;padding:2px 8px 4px 36px;"><div>Tap to load tracks</div></div>'
      + '</div>';
  });
  return h + '</div></div>';
}

function fakeIndexedDB() {
  const data = { tracks: new Map(), meta: new Map([['pinnedReleases', {}]]) };
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
  return { open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
}

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
    win.fetch = () => Promise.reject(new Error('offline'));
    win.navigator.vibrate = () => true;
  },
});

function pev(win, el, type, opts) {
  const o = Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 300, pointerId: 7, pointerType: 'touch', button: 0, isPrimary: true }, opts || {});
  let ev;
  try { ev = new win.PointerEvent(type, o); } catch (e) { ev = new win.MouseEvent(type, o); }
  try { if (ev.pointerId !== 7) Object.defineProperty(ev, 'pointerId', { value: 7 }); } catch (e) {}
  try { if (!ev.pointerType) Object.defineProperty(ev, 'pointerType', { value: 'touch' }); } catch (e) {}
  el.dispatchEvent(ev);
  return ev;
}
function click(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 120, clientY: 300 }));
}

function albumRows(win) { return Array.from(win.document.querySelectorAll('#discPopupBody .dp-ah-album')); }
function rowKeys(win) {
  return albumRows(win).map((el) => el.querySelector('.dp-ah-album-hdr').getAttribute('data-collection-id'));
}
function savedOrder(win) {
  try { return (JSON.parse(win.localStorage.getItem('sidecut_ahAlbumOrder') || '{}') || {})[ARTIST] || []; }
  catch (e) { return []; }
}

(async () => {
  const win = dom.window;
  await wait(2500);
  // __wireAH is installed while the Discover tab is prepared.
  win.navigate('discover');
  await wait(300);

  ok('album reorder helpers exist', typeof win.__wireAHAlbumReorder === 'function'
    && typeof win.orderAlbumList === 'function'
    && typeof win.__scSaveAHAlbumOrder === 'function'
    && typeof win.__scApplyAHAlbumOrder === 'function');
  ok('__wireAH is available in the Discover context', typeof win.__wireAH === 'function');
  ok('__wireAH calls the album-reorder wiring', html.includes('if(typeof window.__wireAHAlbumReorder === \'function\') window.__wireAHAlbumReorder();'));
  ok('the renderer orders albums by the saved list', html.includes('ahAlbums = window.orderAlbumList(ahAlbums, ahArtist, \'sidecut_ahAlbumOrder\')'));

  // ---- open the popup and wire it -----------------------------------------
  win.openDiscoverPopup('📀 Album History', bodyHtml(), '3 albums');
  win.__wireAH();
  await wait(120);
  ok('three albums rendered under the artist', albumRows(win).length === 3, 'n=' + albumRows(win).length);
  ok('initial DOM order is the render order', rowKeys(win).join(',') === 'a1,a2,a3', rowKeys(win).join(','));
  ok('every album is wired for the reorder hold', albumRows(win).every((el) => el._ahAlbReorderWired === true));

  // ---- a plain tap still opens the album's tracks --------------------------
  let first = albumRows(win)[0];
  let firstHdr = first.querySelector('.dp-ah-album-hdr');
  pev(win, firstHdr, 'pointerdown');
  await wait(60);
  pev(win, firstHdr, 'pointerup');
  click(win, firstHdr);
  await wait(140);
  const trackWrap = first.querySelector('.dp-ah-albums');
  ok('a plain tap still opens the track list', trackWrap && trackWrap.style.display === 'block', trackWrap ? trackWrap.style.display : 'no wrap');
  click(win, firstHdr);
  await wait(60);

  // ---- hold + drag reorders the albums ------------------------------------
  first = albumRows(win)[0];
  firstHdr = first.querySelector('.dp-ah-album-hdr');
  pev(win, firstHdr, 'pointerdown', { clientY: 100 });
  await wait(180);
  ok('a short press does not start a drag yet', !first.classList.contains('dragging'));
  await wait(400); // past the 420 ms hold
  pev(win, firstHdr, 'pointermove', { clientY: 500 });
  await wait(60);
  pev(win, firstHdr, 'pointerup', { clientY: 500 });
  await wait(160);
  const afterDrag = rowKeys(win).join(',');
  ok('dragging an album changes the DOM order', afterDrag !== 'a1,a2,a3', afterDrag);
  ok('the new album order is persisted', savedOrder(win).join(',') === afterDrag, 'saved=' + savedOrder(win).join(',') + ' dom=' + afterDrag);

  // ---- the reorder drag must not also toggle the tracks -------------------
  click(win, firstHdr);
  await wait(80);
  ok('a reorder drag did not also open the tracks', trackWrap.style.display === 'none', trackWrap.style.display);

  // ---- orderAlbumList re-applies the saved order -------------------------
  {
    const ordered = win.orderAlbumList(ALBUMS.map((a) => ({ collectionId: a.id, collectionName: a.name })), ARTIST, 'sidecut_ahAlbumOrder');
    ok('orderAlbumList returns the saved order', ordered.map((a) => a.collectionId).join(',') === afterDrag, ordered.map((a) => a.collectionId).join(','));
  }

  // ---- the saved order is applied to a cached body too --------------------
  {
    const cont = win.document.createElement('div');
    cont.className = 'dp-ah-albums';
    ALBUMS.forEach((a) => {
      const el = win.document.createElement('div');
      el.className = 'dp-ah-album';
      el.innerHTML = '<div class="dp-ah-album-hdr" data-artist="' + ARTIST + '" data-collection-id="' + a.id + '"></div>';
      cont.appendChild(el);
    });
    win.__scApplyAHAlbumOrder(cont, ARTIST);
    const applied = Array.from(cont.children).map((el) => el.querySelector('.dp-ah-album-hdr').getAttribute('data-collection-id'));
    ok('a cached body is reordered to the saved order', applied.join(',') === afterDrag, applied.join(','));
  }

  // ---- the artist hold must not fire from an album row --------------------
  {
    const src = html;
    ok('the artist-group hold bails on an album row', src.includes("e.target.closest('.dp-ah-album,.dp-ah-x,"));
  }

  // ---- the cover long-press only fires from the artwork -------------------
  {
    ok('the cover hold is scoped to the artwork in the source',
      html.includes("if(!(e.target && e.target.closest && e.target.closest('[data-art-url],img'))) return;") &&
      (html.split("e.target.closest('[data-art-url],img')").length - 1) === 2);
    const row = albumRows(win)[0];
    const hdr = row.querySelector('.dp-ah-album-hdr');
    const titleArea = hdr.querySelector('div[style*="flex:1"]') || hdr;
    const art = hdr.querySelector('[data-art-url]') || hdr.querySelector('img');
    pev(win, titleArea, 'pointerdown', { clientY: 100 });
    await wait(650);
    pev(win, titleArea, 'pointerup', { clientY: 100 });
    ok('holding the album row does not open the cover form', !win.document.getElementById('ahCoverForm'));
    if (art) {
      pev(win, art, 'pointerdown', { clientY: 100 });
      await wait(650);
      pev(win, art, 'pointerup', { clientY: 100 });
      ok('holding the artwork still opens the cover form', !!win.document.getElementById('ahCoverForm'));
      const f = win.document.getElementById('ahCoverForm'); if (f) f.remove();
    } else {
      ok('holding the artwork still opens the cover form', false, 'no artwork node found');
    }
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  const realErrors = errors.filter((e) => !/dbPromise|offline|no network|Not implemented|chart unreachable/i.test(e));
  if (realErrors.length) { console.log('page errors:'); realErrors.slice(0, 8).forEach((e) => console.log('  ' + e)); }
  process.exit(fail ? 1 : 0);
})();
