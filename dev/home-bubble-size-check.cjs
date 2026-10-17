// 74.1.9 - the in-between Home bubble size.
//
// The owner, looking at Home: "there should be like an inbetween settings for the bubble size like
// in the middle but without all that gap but not too little".
//
// What was on offer before: the expand chip walked mini (60) -> small (84) -> automatic (118) -> tall
// (158) -> wide -> full -> xl, with nothing in the middle, and the Sandbox height stepper moved in
// whole steps of 118px - so 118 or 236, and 236 is the card with a stretch of empty middle that the
// owner is describing.
//
//   [1] the bytes: Medium is a real size between automatic and tall, it is in the chip's cycle, and
//       the height stepper has a half step;
//   [2] the chip reaches it, and the bubble wears the class;
//   [3] the Sandbox H stepper lands on 1.5 and the bubble is 177px (1.5 x 118), persisted;
//   [4] it cannot go below 1x, and Reset puts every bubble back to automatic.
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

function fakeIDB() {
  const data = {
    tracks: new Map([['t1', { id: 't1', name: 'Aurora', artist: 'X', duration: 180, blobType: 'audio/mpeg', fileName: 't1.mp3' }]]),
    meta: new Map([['playlists', { key: 'playlists', value: { 'All Songs': ['t1'] } }]]),
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
    idb = fakeIDB();
    win.indexedDB = idb;
    win.fetch = () => Promise.reject(new Error('offline'));
    try { win.localStorage.clear(); } catch (e) {}
  },
});

const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, view: win }));
const meta = (key) => { const r = idb._data.meta.get(key); return r ? r.value : null; };
const bubbleFor = (win, kind) => win.document.querySelector('#homeBubbles .home-bubble[data-bubble="' + kind + '"]');

(async () => {
  const win = dom.window;
  await wait(7000);
  const doc = win.document;

  console.log('[1] a real middle size exists in the bytes');
  {
    const css = (html.match(/\.home-bubble\.hb-size-medium\{[^}]*\}/) || [''])[0];
    ok(/min-height:calc\(146px \* var\(--hb-s, 1\)\)/.test(css), 'Medium is a real size at 146px', css);
    const auto = Number((html.match(/\.home-bubble\{\n[\s\S]{0,400}?min-height:calc\((\d+)px \* var\(--hb-s, 1\)\)/) || [])[1]);
    const tall = Number((html.match(/\.home-bubble\.hb-size-tall\{ min-height:calc\((\d+)px \* var\(--hb-s, 1\)\); \}/) || [])[1]);
    ok(auto === 118, 'automatic is 118px', auto);
    ok(tall === 158, 'tall is 158px', tall);
    ok(auto < 146 && 146 < tall, 'and Medium sits between them, not at either end');
    ok(/justify-content:center/.test(css), 'its extra height is shared above and below the words, not one hole under the icon', css);
    ok(/HB_SIZE_CYCLE = \['mini', 'small', 'medium', null, 'tall', 'wide', 'full', 'xl'\]/.test(html),
      'the expand chip walks through it');
    ok(/HB_EXACT_STEP = 0\.5/.test(html), 'and the height stepper has a half step');
    ok(/H<\/b> is how tall it is \(1–4×, in half steps/.test(html), 'the Sandbox editor says so');
  }

  console.log('[2] the chip reaches the middle size');
  {
    const kind = 'stats';
    const bubble = bubbleFor(win, kind);
    ok(!!bubble, 'the Home grid is drawn', !!bubble);
    const chip = bubble && bubble.querySelector('.hb-expand');
    ok(!!chip, 'the bubble has its expand chip');
    let reached = false, hops = 0;
    for (let i = 0; i < 8 && chip; i++) {
      click(win, chip);
      hops++;
      if (bubble.classList.contains('hb-size-medium')) { reached = true; break; }
    }
    ok(reached, 'tapping it walks to Medium (' + hops + ' taps)', bubble && bubble.className);
    await wait(250);
    ok(meta('homeBubbleSizes') && meta('homeBubbleSizes')[kind] === 'medium', 'and Medium is what was saved', meta('homeBubbleSizes'));
    ok(chip.classList.contains('sized'), 'the chip shows the bubble is no longer automatic');
    const other = bubbleFor(win, 'topsong');
    ok(other && !other.classList.contains('hb-size-medium'), 'and a bubble nobody touched is still automatic');
  }

  console.log('[3] the height stepper lands between the whole steps');
  {
    const kinds = [...doc.querySelectorAll('#sandboxBubbleSizes [data-hbex][data-axis="h"][data-dir="1"]')].map((b) => b.dataset.hbex);
    ok(kinds.length > 0, 'the Sandbox editor is populated', kinds.slice(0, 4).join(','));
    const kind = 'topsong';
    const plus = doc.querySelector('#sandboxBubbleSizes [data-hbex="' + kind + '"][data-axis="h"][data-dir="1"]');
    ok(!!plus, 'a bubble has its H + button');
    click(win, plus);
    await wait(60);
    const ex = (meta('homeBubbleExact') || {})[kind] || {};
    ok(Number(ex.h) === 1.5, 'one tap is a half step, not a whole one', ex);
    const b = bubbleFor(win, kind);
    ok(b && /calc\(177px \* var\(--hb-s, 1\)\)/.test(b.style.minHeight || ''), 'and the bubble is 177px (1.5 x 118)', b && b.style.minHeight);
    click(win, plus);
    await wait(60);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 2, 'a second tap reaches 2x', (meta('homeBubbleExact') || {})[kind]);
    const minus = doc.querySelector('#sandboxBubbleSizes [data-hbex="' + kind + '"][data-axis="h"][data-dir="-1"]');
    click(win, minus); await wait(40);
    click(win, minus); await wait(40);
    click(win, minus); await wait(40);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 1, 'and it stops at 1x rather than shrinking past it', (meta('homeBubbleExact') || {})[kind]);
  }

  console.log('[4] Reset puts every bubble back to automatic');
  {
    click(win, doc.getElementById('sandboxBubbleSizesReset'));
    await wait(100);
    ok(JSON.stringify(meta('homeBubbleExact')) === '{}', 'the exact sizes are cleared', meta('homeBubbleExact'));
    const stillSized = [...doc.querySelectorAll('#homeBubbles .home-bubble')]
      .filter((b) => /hb-size-(mini|small|medium|tall|wide|full|xl)/.test(b.className) || b.style.minHeight);
    ok(stillSized.length === 0, 'and no bubble is left wearing a size', stillSized.map((b) => b.dataset.bubble).join(','));
  }

  ok(errors.length === 0, 'no uncaught page errors while any of this ran', errors.slice(0, 3));

  console.log('\nhome-bubble-size-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
