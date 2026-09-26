// 63.0.4 — "Album editing doesn't save after I close album history, and why do
// my older albums have the wrong date".
//
// Both are one defect, and it is not in the save. The edit really is written
// (`sidecut_albumEdits`) and the renderer really does read it back
// (`var _ae = getAlbumEdits()[ahAlb.collectionId]`). What swallows it is the
// popup's own snapshot: `openDiscoverPopup` stores the body it drew under
// `discPopupCache_📀 Album History`, and the Album History open path
// (`window.__refetchAlbums`, non-refetch branch) renders that stored HTML
// verbatim and RETURNS — no renderer runs. So the pencil's Save repainted the
// snapshot (a picture of the list as it looked BEFORE the edit), and every
// close-and-reopen served it again. A day the AI lookup invented — which
// `_dedupAlbums` cuts to its year (dev/patch-630.mjs) — was just as invisible,
// because the snapshot never goes near `_dedupAlbums`.
//
// This drives the real path. It first lets the app draw and store a snapshot of
// its own (so the pin signature it stamped in is the real one), then replaces
// that snapshot's body with the pre-edit picture an older build would have left
// behind — no `ahSig` stamp at all — and asks for the list again.
//
// Fails on the pre-patch build (5 checks): the stale picture is served, the
// invented day survives, and a saved date never reaches the row.
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

function fakeIndexedDB() {
  const data = {
    tracks: new Map(),
    meta: new Map([
      ['pinnedReleases', { key: 'pinnedReleases', value: {} }],
      ['pinnedArtists', { key: 'pinnedArtists', value: [{ name: ARTIST }] }],
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
  return { open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
}

// A store row with a real day, and a guessed row wearing a day the AI lookup
// invented — `_ai` with no track count is the tell (index.html pushes exactly
// that shape).
const ROWS = [
  { collectionId: '1565388359', collectionName: 'Chocolate', artworkUrl100: null, releaseDate: '2008-02-01', trackCount: 8 },
  { collectionId: 'ai_diljitdosanjh_dil', collectionName: 'Dil', artworkUrl100: null, releaseDate: '2008-04-24', trackCount: null, _ai: true },
];

// The list as it was DRAWN, with the values of the moment. Used to stand in for
// the snapshot an older build left on the phone.
function listBody(rows) {
  let h = '<div class="dp-ah-artist"><div class="dp-ah-artist-hdr" data-target="ahc_r_0">'
    + '<span class="dp-ah-chevron">▸</span><span style="font-size:13px;font-weight:600;flex:1;">' + ARTIST + '</span>'
    + '<span class="dp-ah-artist-refetch" data-artist="' + ARTIST + '">↻</span></div>'
    + '<div id="ahc_r_0" class="dp-ah-albums" style="display:block;">';
  rows.forEach((a, i) => {
    h += '<div class="dp-ah-album" data-collection-id="' + a.collectionId + '">'
      + '<div class="dp-ah-album-hdr" data-target="ahc_trk_0_' + i + '" data-artist="' + ARTIST + '" data-album="' + a.collectionName + '" data-collection-id="' + a.collectionId + '">'
      + '<span class="dp-ah-chevron">▸</span>'
      + '<div style="width:36px;height:36px;background-size:contain;" data-art-url=""></div>'
      + '<div style="flex:1;min-width:0;"><div>' + a.collectionName + '</div>'
      + '<div style="font-size:11px;"><span>' + a.releaseDate + '</span>'
      + (a.trackCount ? '<span>' + a.trackCount + ' tracks</span>' : '') + '</div></div>'
      + '<span class="dp-ah-edit" data-cid="' + a.collectionId + '" data-artist="' + ARTIST + '" data-album="' + a.collectionName + '" data-date="' + a.releaseDate + '" data-tracks="' + (a.trackCount || '') + '">✎</span>'
      + '<span class="dp-ah-rm" data-cid="' + a.collectionId + '" data-cname="' + a.collectionName + '">×</span>'
      + '</div>'
      + '<div id="ahc_trk_0_' + i + '" class="dp-ah-albums" style="display:none;"><div>Tap to load tracks</div></div>'
      + '</div>';
  });
  return h + '</div></div>';
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));

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
    // Premium is on (Discover is a premium surface) and the album list is
    // already on the phone, exactly as it is for a user opening the popup a
    // second time. `pins` is deliberately absent: the app's own signature is
    // read back from the snapshot it draws below, rather than guessed here.
    win.localStorage.setItem('sidecut_premium', JSON.stringify({ active: true, granted: Date.now() }));
    win.localStorage.setItem('sidecut_ahArtistData', JSON.stringify({ artists: { [ARTIST]: ROWS }, total: 2, ts: Date.now() }));
  },
});

const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const bodyText = (win) => (win.document.getElementById('discPopupBody') || { textContent: '' }).textContent || '';
const rowText = (win) => bodyText(win).replace(/\s+/g, ' ');
const edits = (win) => { try { return JSON.parse(win.localStorage.getItem('sidecut_albumEdits') || '{}'); } catch (e) { return {}; } };
const snap = (win) => { try { return JSON.parse(win.localStorage.getItem('discPopupCache_📀 Album History') || 'null'); } catch (e) { return null; } };
const pencilFor = (win, cid) => Array.from(win.document.querySelectorAll('#discPopupBody .dp-ah-edit')).find((el) => el.dataset.cid === cid);

(async () => {
  const win = dom.window;
  await wait(2500);
  win.navigate('discover');
  await wait(300);

  console.log('[0] the list is drawn from the data and the snapshot records its own pin signature');
  let pins = null;
  {
    await win.__refetchAlbums(false);
    await wait(250);
    ok('the list opened with both albums', rowText(win).includes('Chocolate') && rowText(win).includes('Dil'), rowText(win).slice(0, 120));
    ok('the day the AI lookup invented is cut to its year', !rowText(win).includes('2008-04-24') && /Dil\s*2008(?![\d-])/.test(rowText(win)), rowText(win).slice(0, 160));
    ok('the store row keeps its real day', rowText(win).includes('2008-02-01'), rowText(win).slice(0, 160));
    const s = snap(win);
    ok('a snapshot was stored with the pin signature it was drawn under', !!s && !!s.pins, JSON.stringify(s && s.pins));
    pins = s && s.pins;
  }

  console.log('[1] an old snapshot is not served when it disagrees with the data');
  {
    // An older build's snapshot: the same body it drew then, the same pin
    // signature, and no stamp. It is a picture of the list BEFORE either fix.
    const stale = { title: '📀 Album History', body: listBody(ROWS), subtitle: '2 albums', ts: Date.now(), pins: pins };
    win.localStorage.setItem('discPopupCache_📀 Album History', JSON.stringify(stale));
    ok('the old snapshot is in place', (snap(win) || {}).body === stale.body);
    await win.__refetchAlbums(false);
    await wait(250);
    ok('the old picture was not served', rowText(win).includes('Chocolate'), rowText(win).slice(0, 90));
    ok('the invented day is gone from what is on screen', !rowText(win).includes('2008-04-24'), rowText(win).slice(0, 160));
    ok('and the album shows the year the catalogs agree on', /Dil\s*2008(?![\d-])/.test(rowText(win)), rowText(win).slice(0, 160));
  }

  console.log('[2] a saved date is on screen right after Save');
  {
    const pencil = pencilFor(win, '1565388359');
    ok('the Chocolate pencil is there', !!pencil);
    click(win, pencil);
    await wait(120);
    const dateEl = win.document.getElementById('ahEditDate');
    ok('the sheet opened with the stored day', !!dateEl && dateEl.value === '2008-02-01', dateEl && dateEl.value);
    dateEl.value = '2001-05-04';
    win.document.getElementById('ahEditTracks').value = '9';
    click(win, win.document.getElementById('ahEditSave'));
    await wait(300);
    ok('the edit was written', edits(win)['1565388359'] && edits(win)['1565388359'].date === '2001-05-04', JSON.stringify(edits(win)));
    ok('the row shows the saved day at once', rowText(win).includes('2001-05-04'), rowText(win).slice(0, 160));
    ok('and the saved track count', /9 tracks/.test(rowText(win)), rowText(win).slice(0, 160));
  }

  console.log('[3] and it is still there after closing and reopening Album History');
  {
    win.closeDiscoverPopup();
    await wait(150);
    await win.__refetchAlbums(false);
    await wait(300);
    ok('the popup reopened with the list', rowText(win).includes('Chocolate'), rowText(win).slice(0, 90));
    ok('the saved day is still on the row', rowText(win).includes('2001-05-04'), rowText(win).slice(0, 160));
    ok('the invented day is still gone', !rowText(win).includes('2008-04-24'), rowText(win).slice(0, 160));
    // The repaint must not have thrown the snapshot away for good: a later open
    // still has a stamped one to draw from.
    const s = snap(win);
    ok('and a stamped snapshot was stored for the next open', !!s && !!s.ahSig, JSON.stringify(s && s.ahSig));
  }

  if (errors.length) console.log('\njsdom errors:\n  ' + errors.slice(0, 5).join('\n  '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
