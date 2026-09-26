// 63.0.3 — the 📀 Album History edit button opens where you can see it, and an
// old album stops wearing a date the AI lookup invented for it.
//
// Reported: "The edit button doesn't work and I'm getting wrong dates for some
// albums" (screenshot: Diljit Dosanjh's list, "Dil" 2008-04-24 with no cover and
// no track count — the tells of an AI row — while MusicBrainz has "Dil" as 2004).
//
// Two shapes are pinned here, plus one live DOM run:
//   1. The form is a sheet fixed to the screen. It used to be inserted at the top
//      of #discPopupBody, which is the SCROLL container, so on a long list it
//      opened above the visible area — the whole of "the edit button doesn't
//      work".
//   2. Saving tells the truth, the date field only prefills a real day, the pencil
//      carries the values the row SHOWS, and the AI lookup is asked for a year
//      (never a day) and cannot add a second row for an album we already have.
//   3. Live: opening an album's edit sheet, typing a date and a count, and hitting
//      Save writes them where the renderer reads them.
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

function fakeIndexedDB() {
  const data = { tracks: new Map(), meta: new Map([['pinnedReleases', {}]]) };
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

const ARTIST = 'Diljit Dosanjh';
// Two rows as the renderer emits them: one with a real day from a store, one
// year-only as MusicBrainz files an old album.
const ROWS = [
  { cid: '423087540', album: 'Chocolate', date: '2008-02-01', tracks: '8' },
  { cid: 'mb-dil', album: 'Dil', date: '2004', tracks: '' },
];

function bodyHtml() {
  let h = '<div class="dp-ah-artist"><div class="dp-ah-artist-hdr" data-target="ahc_r_0">'
    + '<span class="dp-ah-chevron">▸</span><span style="font-size:13px;font-weight:600;flex:1;">' + ARTIST + '</span></div>'
    + '<div id="ahc_r_0" class="dp-ah-albums" style="display:block;padding:2px 0 4px 0;">';
  ROWS.forEach((a, i) => {
    h += '<div class="dp-ah-album" data-collection-id="' + a.cid + '">'
      + '<div class="dp-ah-album-hdr" data-target="ahc_trk_0_' + i + '" data-artist="' + ARTIST + '" data-album="' + a.album + '" data-collection-id="' + a.cid + '">'
      + '<span class="dp-ah-chevron">▸</span>'
      + '<div style="width:36px;height:36px;border-radius:6px;background-color:var(--bg);" data-art-url=""></div>'
      + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;">' + a.album + '</div>'
      + '<div style="font-size:11px;color:var(--ink-dim);display:flex;"><span style="flex:1;min-width:0;">' + a.date + '</span>'
      + (a.tracks ? '<span style="flex-shrink:0;margin-left:6px;color:var(--ink-dim);">' + a.tracks + ' tracks</span>' : '')
      + '</div></div>'
      + '<span class="dp-ah-edit" data-cid="' + a.cid + '" data-artist="' + ARTIST + '" data-album="' + a.album + '" data-date="' + a.date + '" data-tracks="' + a.tracks + '">✎</span>'
      + '<span class="dp-ah-rm" data-cid="' + a.cid + '" data-cname="' + a.album + '">×</span>'
      + '</div>'
      + '<div id="ahc_trk_0_' + i + '" class="dp-ah-albums" style="display:none;"><div>Tap to load tracks</div></div>'
      + '</div>';
  });
  return h + '</div></div>';
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

const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
const pencils = (win) => Array.from(win.document.querySelectorAll('#discPopupBody .dp-ah-edit'));
const edits = (win) => { try { return JSON.parse(win.localStorage.getItem('sidecut_albumEdits') || '{}'); } catch (e) { return {}; } };

(async () => {
  const win = dom.window;
  await wait(2500);
  win.navigate('discover');
  await wait(300);

  console.log('[1] the sheet cannot open off-screen');
  {
    // Anchored on the wiring comment: the select-mode hide/show calls above it
    // also mention .dp-ah-edit, so the first occurrence is not this block.
    const i = html.indexOf('// Wire up edit buttons on album headers');
    const j = html.indexOf("document.querySelectorAll('#discPopupBody .dp-ah-rm')", i);
    const blk = html.slice(i, j);
    ok('the edit wiring is reached (slice extracted)', blk.length > 400, 'len=' + blk.length);
    ok('the form is pinned to the screen, not the list', blk.includes('position:fixed;left:0;right:0;bottom:0'));
    ok('it no longer lands at the top of the popup scroller',
      !blk.includes("insertAdjacentHTML('afterbegin'"));
    ok('a backdrop dismisses it', blk.includes("editBd.id = 'ahEditBackdrop'") && blk.includes('document.body.appendChild(editBd)'));
    ok('the sheet is appended to the body, outside the scroller',
      blk.includes("document.body.insertAdjacentHTML('beforeend', formHtml)"));
    ok('the pencil is excluded from the reorder grab',
      html.includes("var NO_GRAB = '.dp-ah-edit,.dp-ah-rm,"));
  }

  console.log('[2] saving tells the truth');
  {
    const i = html.indexOf('var _closeEdit = function(){');
    const j = html.indexOf("document.querySelectorAll('#discPopupBody .dp-ah-rm')", i);
    const blk = html.slice(i, j);
    ok('cancel is wired through the same close', blk.includes("_cancelEditBtn.addEventListener('click', _closeEdit)"));
    ok('no id means it says so instead of claiming success',
      blk.includes('if(!cid){ _closeEdit(); toast(') && blk.includes('no id to save against'));
    ok('an empty form says there is nothing to save', blk.includes("if(!newDate && !newTracks){ _closeEdit(); toast('Nothing to save.'"));
    ok('a real save writes the edit and repaints', blk.includes("saveAlbumEdit(cid, 'date', newDate)") && blk.includes('window.__refetchAlbums(false)'));
    ok('the old unconditional "Album updated" is gone',
      !/if\(cid\)\{\s*\n\s*if\(newDate\) saveAlbumEdit/.test(blk));
  }

  console.log('[3] a date field only takes a real day');
  {
    ok('a day is prefilled', html.includes("var _curDay = /^\\d{4}-\\d{2}-\\d{2}$/.test(curDate) ? curDate : '';"));
    ok('a year-only date is explained instead of forced into the field',
      html.includes('pick a full day to replace it'));
    ok('the pencil carries what the row shows, not the raw catalog date',
      html.includes("data-date=\"'+escapeHtml(String(_showDate||'').slice(0,10))+'\" data-tracks=\"'+escapeHtml(String(_showTracks||''))+'\""));
    ok('the renderer still reads the saved edit before the catalog value',
      html.includes('var _ae = getAlbumEdits()[ahAlb.collectionId] || {};')
      && html.includes('var _showDate = _ae.date || (ahAlb.releaseDate||\'\').slice(0,10);'));
  }

  console.log('[4] the AI lookup cannot invent a date');
  {
    const i = html.indexOf("var _aiPrompt = 'List every album");
    const j = html.indexOf('artistAlbums[a.name].push({', i);
    const blk = html.slice(i, j);
    ok('the reply is asked for a YEAR', blk.includes('"year":2004') && blk.includes('four-digit release YEAR only'));
    ok('it is no longer asked for YYYY-MM-DD', !blk.includes('"date":"YYYY-MM-DD"'));
    ok('only a four-digit year is kept', blk.includes('if(!/^(19|20)\\d{2}$/.test(_aiY)) _aiY = \'\';'));
    ok('the invented day is never stored', !blk.includes('releaseDate: _aiA.date'));
    ok('an album we already have is never added twice, whatever year the model guessed',
      blk.includes('if(_aiSeenT[_aiTN]) continue;') && !blk.includes('_aiSeenT[_aiTN].indexOf(_aiY)'));
    ok('AI rows are keyed by the album, not by their index in the reply',
      blk.includes("'ai_' + a.name.toLowerCase().replace(/[^a-z0-9]/g,'') + '_' + String(_aiA.title).toLowerCase()") && !blk.includes("+ '_' + _aiI"));
  }

  console.log('[5] a real catalog row beats an AI row');
  {
    const i = html.indexOf('function _dedupAlbums(arr){');
    const j = html.indexOf('function _renderAhFromData', i);
    const blk = html.slice(i, j);
    ok('the swap exists', blk.includes('if(kept._ai && !a._ai){') && blk.includes('out[_realAt] = a; seen[k] = a; continue;'));
    ok('it keeps the row where it was', blk.includes('var _realAt = out.indexOf(kept);'));
    ok('the fill-ins are still there for two real rows',
      blk.includes('if(!kept.artworkUrl100 && a.artworkUrl100) kept.artworkUrl100 = a.artworkUrl100;'));
    // A day already stored on a guessed row is cut to its year as the list is
    // drawn, so an album only the lookup knows stops wearing an invented day
    // without waiting for a refetch. Guarded on `a._ai` — a real catalog date is
    // never touched.
    ok('a stored invented day is cut to its year on every render',
      blk.includes('if(a._ai && ') && blk.includes('.slice(0, 4)') && blk.includes('stops wearing a date the moment the list is drawn'));
    ok('and only ever on a guessed row',
      !blk.includes('if(!a._ai && ') || blk.indexOf('if(a._ai && ') < blk.indexOf('seen[k] = a;'));
  }

  console.log('[6] live: open the sheet, save a date and a count');
  {
    win.openDiscoverPopup('📀 Album History', bodyHtml(), '2 albums');
    win.__wireAH();
    await wait(120);
    const p = pencils(win);
    ok('a pencil per album row', p.length === 2, 'n=' + p.length);

    // A row with no date at all still opens a sheet with an empty field.
    click(win, p[0]);
    await wait(80);
    let sheet = win.document.getElementById('ahEditForm');
    ok('tapping ✏️ opens the sheet', !!sheet);
    ok('the sheet is fixed to the screen', !!sheet && /position:\s*fixed/.test(sheet.getAttribute('style') || sheet.style.cssText));
    ok('the sheet is a child of body, not of the scrolling list',
      !!sheet && sheet.parentElement === win.document.body);
    ok('the backdrop is up', !!win.document.getElementById('ahEditBackdrop'));
    let dateEl = win.document.getElementById('ahEditDate');
    ok('the store date is prefilled', !!dateEl && dateEl.value === '2008-02-01', dateEl && dateEl.value);
    let tracksEl = win.document.getElementById('ahEditTracks');
    ok('the track count is prefilled', !!tracksEl && tracksEl.value === '8', tracksEl && tracksEl.value);

    dateEl.value = '2001-05-04';
    tracksEl.value = '11';
    click(win, win.document.getElementById('ahEditSave'));
    await wait(120);
    const e = edits(win);
    ok('the date was saved against the album id', e['423087540'] && e['423087540'].date === '2001-05-04', JSON.stringify(e['423087540']));
    ok('the track count was saved too', e['423087540'] && e['423087540'].tracks === '11');
    ok('the sheet closed', !win.document.getElementById('ahEditForm'));
    ok('and so did the backdrop', !win.document.getElementById('ahEditBackdrop'));

    // A year-only date: the field must come up empty rather than holding "2004".
    click(win, pencils(win)[1]);
    await wait(80);
    dateEl = win.document.getElementById('ahEditDate');
    const sheet2 = win.document.getElementById('ahEditForm');
    ok('a year-only album opens the sheet too', !!sheet2);
    ok('its day field is left empty', !!dateEl && dateEl.value === '', dateEl && JSON.stringify(dateEl.value));
    ok('and the year is explained under the field',
      !!sheet2 && /dated 2004/.test(sheet2.textContent), sheet2 && sheet2.textContent.trim().slice(0, 80));
    // Saving nothing says so, and writes nothing.
    click(win, win.document.getElementById('ahEditSave'));
    await wait(60);
    ok('saving an untouched year-only row writes no edit', !edits(win)['mb-dil'], JSON.stringify(edits(win)['mb-dil']));
    ok('and the sheet is gone', !win.document.getElementById('ahEditForm'));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
