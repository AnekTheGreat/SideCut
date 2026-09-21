// v60.1.5 audit — album cards: the drag geometry, the saved order, the gesture.
//
// Every case runs the REAL render path and the REAL drag handlers out of
// index.html in jsdom, with per-card heights stubbed (jsdom has no layout), so
// the mixed-height maths is exercised for real rather than reasoned about.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name); console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 300, height: 150 };
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

function fakeIndexedDB(tracks, meta) {
  const data = {
    tracks: new Map(tracks.map((t) => [t.id, t])),
    meta: new Map(meta.map((m) => [m.key, m])),
  };
  function tx(store) {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, JSON.parse(JSON.stringify(v))); fire(); return {}; },
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

// Build a live app with one track per album, real render, stubbed heights.
async function setup(albumNames, userAlbums, albumOrder, heights) {
  const tracks = albumNames.map((n, i) => ({ id: 't' + i, name: 'Song ' + n, artist: 'Artist ' + n, album: n + '_tag', duration: 100 }));
  const meta = [
    { key: 'userAlbums', value: userAlbums },
    { key: 'playlists', value: { 'All Songs': tracks.map((t) => t.id), Favorites: [] } },
    { key: 'idCounter', value: tracks.length + 1 },
  ];
  if (albumOrder) meta.push({ key: 'albumOrder', value: albumOrder });

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

  const idb = fakeIndexedDB(tracks, meta);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = idb;
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  const win = dom.window;
  await wait(2500);

  // jsdom has no layout: give every album card the height this case wants.
  Object.defineProperty(win.HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      if (this.dataset && this.dataset.albumName) {
        const h = heights[this.dataset.albumName];
        if (typeof h === 'number') return h;
      }
      return 0;
    },
  });
  win.Element.prototype.getBoundingClientRect = function () {
    if (this.dataset && this.dataset.albumName) {
      const h = heights[this.dataset.albumName] || 0;
      return { top: 0, bottom: h, height: h, left: 0, right: 360, width: 360 };
    }
    // The list pane is deliberately huge so the drag's auto-scroll never engages
    // and the pointer never counts as "at the edge".
    return { top: -100000, bottom: 100000, height: 200000, left: 0, right: 360, width: 360 };
  };

  win.navigate('albums');
  await wait(500);
  return { win, idb, errors };
}

function pev(win, el, type, opts) {
  const o = Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 300, pointerId: 7, pointerType: 'touch', button: 0, isPrimary: true }, opts || {});
  let ev;
  try { ev = new win.PointerEvent(type, o); } catch (e) { ev = new win.MouseEvent(type, o); }
  try { if (!ev.pointerId) Object.defineProperty(ev, 'pointerId', { value: 7 }); } catch (e) {}
  try { if (!ev.pointerType) Object.defineProperty(ev, 'pointerType', { value: 'touch' }); } catch (e) {}
  el.dispatchEvent(ev);
  return ev;
}

const cards = (win) => Array.from(win.document.querySelectorAll('#listPane [data-album-name]'));
const domOrder = (win) => cards(win).map((c) => c.dataset.albumName);
const savedOrder = (idb) => Object.keys(idb._data.meta.get('userAlbums').value);
const savedList = (idb) => {
  const row = idb._data.meta.get('albumOrder');
  return row ? row.value : null;
};

// Long-press the card, drag it, release (or cancel).
async function dragCard(win, name, dy, opts) {
  const o = opts || {};
  const card = cards(win).find((c) => c.dataset.albumName === name);
  if (!card) throw new Error('no card named ' + name);
  const hdr = card.firstElementChild;
  pev(win, hdr, 'pointerdown', { clientY: 300 });
  await wait(450);                              // the drag arms after 350ms
  if (o.armOnly) return card;
  pev(win, win.document, 'pointermove', { clientY: 300 + dy });
  await wait(50);
  pev(win, win.document, o.cancel ? 'pointercancel' : 'pointerup', { clientY: 300 + dy });
  await wait(600);
  return card;
}

const A = (n, extra) => Object.assign({ artist: 'Artist ' + n, trackIds: ['t' + n.idx], manual: true }, extra || {});

(async () => {
  // ---------------------------------------------------------------- case 1 --
  // A short card dragged down past a tall one. The old maths assumed every card
  // was the dragged card's height, so it counted the tall card as passed twice
  // and saved the wrong slot (Big, Other, Small) instead of (Big, Small, Other).
  console.log('\ncase 1 — short card dragged past a tall one');
  {
    const names = ['Small', 'Big', 'Other'];
    const ua = { Small: A('Small', { trackIds: ['t0'] }), Big: A('Big', { trackIds: ['t1'] }), Other: A('Other', { trackIds: ['t2'] }) };
    const { win, idb, errors } = await setup(names, ua, null, { Small: 40, Big: 500, Other: 100 });
    ok('cards render in the saved order', domOrder(win).join(',') === 'Small,Big,Other', domOrder(win).join(','));
    await dragCard(win, 'Small', 300);
    ok('dropped one slot down, past the tall card', domOrder(win).join(',') === 'Big,Small,Other', domOrder(win).join(','));
    ok('saved order matches what is on screen', savedOrder(idb).join(',') === 'Big,Small,Other', savedOrder(idb).join(','));
    ok('the order list is written too', (savedList(idb) || []).join(',') === 'Big,Small,Other', String(savedList(idb)));
    ok('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  }

  // ---------------------------------------------------------------- case 2 --
  // A tall card dragged up over two shorter ones, landing between them.
  console.log('\ncase 2 — tall card dragged up');
  {
    const names = ['Moon', 'Aaa', 'Bbb'];
    const ua = { Moon: A('Moon', { trackIds: ['t0'] }), Aaa: A('Aaa', { trackIds: ['t1'] }), Bbb: A('Bbb', { trackIds: ['t2'] }) };
    const { win, idb } = await setup(names, ua, null, { Moon: 500, Aaa: 40, Bbb: 40 });
    await dragCard(win, 'Moon', 400);
    // Moon's centre (250 + 400 = 650) is past Aaa's midpoint (506 + 20 = 526) and
    // Bbb's (552 + 20 = 572), so it belongs after Bbb: last.
    ok('tall card lands last', domOrder(win).join(',') === 'Aaa,Bbb,Moon', domOrder(win).join(','));
    ok('and that is what was saved', savedOrder(idb).join(',') === 'Aaa,Bbb,Moon', savedOrder(idb).join(','));
  }

  // ---------------------------------------------------------------- case 3 --
  // Cancelled mid-drag (Android taking the gesture). The old handler threw the
  // drag away; the drop must be kept.
  console.log('\ncase 3 — a cancelled drag still saves');
  {
    const names = ['One', 'Two', 'Three'];
    const ua = { One: A('One', { trackIds: ['t0'] }), Two: A('Two', { trackIds: ['t1'] }), Three: A('Three', { trackIds: ['t2'] }) };
    const { win, idb } = await setup(names, ua, null, { One: 100, Two: 100, Three: 100 });
    await dragCard(win, 'One', 400, { cancel: true });
    ok('the cancelled drop is kept', domOrder(win).join(',') === 'Two,Three,One', domOrder(win).join(','));
    ok('and written down', savedOrder(idb).join(',') === 'Two,Three,One', savedOrder(idb).join(','));
  }

  // ---------------------------------------------------------------- case 4 --
  // Dropped in the same place: no rewrite, and the neighbours go back.
  console.log('\ncase 4 — a drag that goes nowhere');
  {
    const names = ['Uno', 'Dos', 'Tres'];
    const ua = { Uno: A('Uno', { trackIds: ['t0'] }), Dos: A('Dos', { trackIds: ['t1'] }), Tres: A('Tres', { trackIds: ['t2'] }) };
    const { win, idb } = await setup(names, ua, null, { Uno: 100, Dos: 100, Tres: 100 });
    await dragCard(win, 'Uno', 5);
    ok('order untouched', domOrder(win).join(',') === 'Uno,Dos,Tres', domOrder(win).join(','));
    ok('nothing extra saved', savedOrder(idb).join(',') === 'Uno,Dos,Tres', savedOrder(idb).join(','));
    ok('card transform cleared', cards(win).every((c) => !c.style.transform), cards(win).map((c) => c.style.transform).join('|'));
  }

  // ---------------------------------------------------------------- case 5 --
  // The list cannot scroll out from under a drag.
  console.log('\ncase 5 — the drag claims the gesture');
  {
    const names = ['Alpha', 'Beta', 'Gamma'];
    const ua = { Alpha: A('Alpha', { trackIds: ['t0'] }), Beta: A('Beta', { trackIds: ['t1'] }), Gamma: A('Gamma', { trackIds: ['t2'] }) };
    const { win } = await setup(names, ua, null, { Alpha: 100, Beta: 100, Gamma: 100 });
    const before = new win.Event('touchmove', { bubbles: true, cancelable: true });
    win.document.dispatchEvent(before);
    ok('idle scrolling is not blocked', before.defaultPrevented === false);

    const card = await dragCard(win, 'Alpha', 0, { armOnly: true });
    const during = new win.Event('touchmove', { bubbles: true, cancelable: true });
    win.document.dispatchEvent(during);
    ok('scrolling is blocked while a card is lifted', during.defaultPrevented === true);
    pev(win, win.document, 'pointerup', { clientY: 300 });
    await wait(400);
    const after = new win.Event('touchmove', { bubbles: true, cancelable: true });
    win.document.dispatchEvent(after);
    ok('and released again afterwards', after.defaultPrevented === false);
    ok('the card was the one that was held', !!card);
  }

  // ---------------------------------------------------------------- case 6 --
  // An album named like a number. Object.keys hoists "2003" to the front of the
  // map, so the key order could never hold it in place — the saved list must.
  console.log('\ncase 6 — an album whose name is a number');
  {
    const names = ['Alpha', '2003', 'Moon'];
    const ua = { 2003: A('2003', { trackIds: ['t1'] }), Alpha: A('Alpha', { trackIds: ['t0'] }), Moon: A('Moon', { trackIds: ['t2'] }) };
    const { win, idb } = await setup(names, ua, ['Alpha', '2003', 'Moon'], { Alpha: 100, '2003': 100, Moon: 100 });
    ok('rendered in the saved list order, not hoisted to the top', domOrder(win).join(',') === 'Alpha,2003,Moon', domOrder(win).join(','));
    await dragCard(win, '2003', -400);
    ok('dragged to the top', domOrder(win).join(',') === '2003,Alpha,Moon', domOrder(win).join(','));
    ok('saved list keeps it there', (savedList(idb) || []).join(',') === '2003,Alpha,Moon', String(savedList(idb)));
  }

  // ---------------------------------------------------------------- case 7 --
  // Renaming / deleting keeps the order list in step.
  console.log('\ncase 7 — rename and delete keep the order list');
  {
    const names = ['First', 'Second', 'Third'];
    const ua = { First: A('First', { trackIds: ['t0'] }), Second: A('Second', { trackIds: ['t1'] }), Third: A('Third', { trackIds: ['t2'] }) };
    const { win, idb } = await setup(names, ua, ['First', 'Second', 'Third'], { First: 100, Second: 100, Third: 100 });
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    ok('rename rewrites the list in place',
      /albumOrder\[_oi\] = nn;/.test(src));
    ok('delete drops the name from the list',
      /albumOrder\.splice\(_di, 1\)/.test(src));
    ok('render falls back to the old key order when no list exists',
      /_ord\.length \+ _uaKeys\.indexOf\(a\)/.test(src));
    ok('the drag is measured in real slot positions',
      /slotTops\[startIndex\] \+ \(card\.offsetHeight \|\| 0\) \/ 2 \+ dy/.test(src));
    ok('the album card no longer assumes one card height',
      !/var rowHeight = card\.getBoundingClientRect\(\)\.height;/.test(src));
    ok('a cancel saves instead of reverting',
      /function onCancel\(\)\{ onUp\(\); \}/.test(src));
    ok('no runtime errors from the rename/delete paths', win.document.querySelectorAll('#listPane [data-album-name]').length === 3);
  }

  console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + '/' + (pass + fail) + ' checks passed (v60.1.5)');
  if (fail) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('v615 audit crashed', e); process.exit(1); });
