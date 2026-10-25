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
//   [3] the Sandbox H stepper moves in quarter steps: 1.25x is 148px (1.25 x 118), persisted;
//   [4] it cannot go below 1x, and Reset puts every bubble back to automatic.
//   [5] the full-width stats card is the one bubble that does not centre: its words sit on
//       the card floor at every size, and its two lines grow where the card has the height.
//   [6] 80.2.7: the sizes arrive in order - every tap is a taller card, automatic and the
//       wide banner sit at their own heights on the way up, Roomy and Grand fill the two
//       long jumps, no step between neighbours is bigger than 30px, and the stepper moves
//       in quarter steps.
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
    ok(/HB_SIZE_CYCLE = \['mini', 'small', 'wide', null, 'medium', 'tall', 'roomy', 'full', 'grand', 'xl'\]/.test(html),
      'the expand chip walks the ladder in order');
    ok(/HB_EXACT_STEP = 0\.25/.test(html), 'and the height stepper moves in quarter steps');
    ok(/H<\/b> is how tall it is \(1–4×, in quarter steps/.test(html), 'the Sandbox editor says so');
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
    ok(Number(ex.h) === 1.25, 'one tap is a quarter step, not a whole one', ex);
    const b = bubbleFor(win, kind);
    ok(b && /calc\(148px \* var\(--hb-s, 1\)\)/.test(b.style.minHeight || ''), 'and the bubble is 148px (1.25 x 118)', b && b.style.minHeight);
    click(win, plus);
    await wait(60);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 1.5, 'a second tap reaches 1.5x, which used to be the first step', (meta('homeBubbleExact') || {})[kind]);
    const minus = doc.querySelector('#sandboxBubbleSizes [data-hbex="' + kind + '"][data-axis="h"][data-dir="-1"]');
    click(win, minus); await wait(40);
    click(win, minus); await wait(40);
    ok(Number(((meta('homeBubbleExact') || {})[kind] || {}).h) === 1, 'and two taps back stop at 1x rather than shrinking past it', (meta('homeBubbleExact') || {})[kind]);
  }

  console.log('[4] Reset puts every bubble back to automatic');
  {
    click(win, doc.getElementById('sandboxBubbleSizesReset'));
    await wait(100);
    ok(JSON.stringify(meta('homeBubbleExact')) === '{}', 'the exact sizes are cleared', meta('homeBubbleExact'));
    const stillSized = [...doc.querySelectorAll('#homeBubbles .home-bubble')]
      .filter((b) => /hb-size-(mini|small|wide|medium|tall|roomy|full|grand|xl)/.test(b.className) || b.style.minHeight);
    ok(stillSized.length === 0, 'and no bubble is left wearing a size', stillSized.map((b) => b.dataset.bubble).join(','));
  }

  console.log('[5] 80.2.6: the full-width stats card keeps its words on the floor');
  {
    // THE RULE, read out of the shipped bytes. The middle size centres its lines so its
    // extra height is shared above and below them, which is right for a card with an
    // icon in the middle and wrong for this one: the stats icon is pinned top-left, so
    // the sharing showed up as a hole under the words.
    const floor = (html.match(/body:not\([.]sc80-cloud\) #homeBubbles [.]home-bubble\[data-bubble="stats"\]\{[^}]*\}/) || [''])[0];
    ok(/justify-content:flex-end/.test(floor), 'the stats card anchors its words to the floor', floor);
    ok(/^body:not\([.]sc80-cloud\)/.test(floor), 'and the circle wall is held out of it', floor);
    ok((html.match(/body:not\([.]sc80-cloud\) #homeBubbles [.]home-bubble\{/g) || []).length === 0,
      'no blanket rule floors every other bubble with it');
    ok(/\.home-bubble\.hb-size-medium\{[^}]*justify-content:center/.test(html),
      'the middle size itself still centres, so the other cards are unchanged');
    // THE TYPE. It grows only where the card has the height to hold it.
    const grown = (html.match(/\[data-bubble="stats"\]:is\(([^)]*)\) [.]hb-value/) || [])[1] || '';
    ok(/hb-size-medium/.test(grown) && /hb-size-tall/.test(grown) &&
       /hb-size-full/.test(grown) && /hb-size-xl/.test(grown),
      'the value grows on the four sizes with room for it', grown);
    ok(grown.indexOf('hb-size-wide') === -1 && grown.indexOf('hb-size-mini') === -1 &&
       grown.indexOf('hb-size-small') === -1,
      'and not on the cards whose words already fill them', grown);
    const valueRule = (html.match(/\.hb-size-xl\) [.]hb-value\{[^}]*\}/) || [''])[0];
    ok(/font-size:calc\(26px \* var\(--hb-s, 1\)\)/.test(valueRule), 'the value is 26px, up from 20', valueRule);
    const labelRule = (html.match(/\.hb-size-xl\) [.]hb-label\{[^}]*\}/) || [''])[0];
    ok(/font-size:calc\(12\.5px \* var\(--hb-s, 1\)\)/.test(labelRule), 'the label is 12.5px, up from 11.5', labelRule);
    ok(/padding-right:26px/.test(labelRule), 'and it stops short of the expand hint', labelRule);
    // DRIVEN. The floor belongs to this one card, not to whatever is wearing the size:
    // the stats bubble is put at Medium and the card beside it at Medium too.
    const stats = bubbleFor(win, 'stats');
    ok(!!stats && stats.dataset.bubble === 'stats', 'the stats bubble is the card the rule names', stats && stats.dataset.bubble);
    const chip = stats && stats.querySelector('.hb-expand');
    let reached = false;
    for (let i = 0; i < 8 && chip; i++) {
      click(win, chip);
      if (stats.classList.contains('hb-size-medium')) { reached = true; break; }
    }
    ok(reached, 'it can still wear the middle size', stats && stats.className);
    const other = bubbleFor(win, 'topsong');
    ok(other && other.dataset.bubble !== 'stats', 'and the card beside it is not covered by the rule', other && other.dataset.bubble);
    click(win, doc.getElementById('sandboxBubbleSizesReset'));
    await wait(100);
  }

  console.log('[6] 80.2.7: the sizes come in order, with the long jumps filled');
  {
    // THE LADDER, read out of the shipped bytes: every rung and the height the
    // stylesheet draws it at. The walk is checked against this table, so the chip cannot
    // promise an order the page does not draw.
    const table = (html.match(/const HB_SIZE_HEIGHTS = \{([^}]*)\}/) || [])[1] || '';
    const heights = {};
    for (const m of table.matchAll(/([a-z]+): (\d+)/g)) heights[m[1]] = Number(m[2]);
    const auto = Number((html.match(/\.home-bubble\{\n[\s\S]{0,400}?min-height:calc\((\d+)px \* var\(--hb-s, 1\)\)/) || [])[1]);
    ok(auto === 118, 'automatic is 118px, the size a normal card starts at', auto);
    const order = ((html.match(/const HB_SIZE_CYCLE = \[([^\]]*)\]/) || [])[1] || '')
      .split(',').map((s) => s.trim().replace(/'/g, '')).map((s) => (s === 'null' ? null : s));
    ok(order.length === 10, 'the chip walks ten rungs, automatic included', order.join(','));
    ok(Object.keys(heights).length === 9, 'and the ladder names nine sizes besides automatic', Object.keys(heights).sort().join(','));
    const hOf = (name) => (name === null ? auto : heights[name]);
    const walked = order.map(hOf);
    const steps = walked.slice(1).map((v, i) => v - walked[i]);
    ok(steps.every((d) => d > 0), 'every tap is a taller card than the one before it', walked.join(' > '));
    // THE TWO STEPS THAT WENT BACKWARDS, named: automatic after the middle size, and the
    // 96px wide banner after tall. Automatic now sits at 118, where 118 belongs.
    ok(hOf(null) > hOf('wide') && hOf(null) < hOf('medium'),
      'automatic sits between wide and medium, at its own height', order.join(','));
    ok(order[order.length - 1] === 'xl', 'and the walk still ends at XL', order[order.length - 1]);
    // THE TWO NEW SPOTS, and the size of the steps around them.
    ok(heights.roomy === 179, 'Roomy is 179px, between tall and full', heights.roomy);
    ok(heights.grand === 230, 'and Grand is 230px, between full and XL', heights.grand);
    ok(order.indexOf('roomy') === order.indexOf('tall') + 1 &&
       order.indexOf('full') === order.indexOf('roomy') + 1 &&
       order.indexOf('grand') === order.indexOf('full') + 1 &&
       order.indexOf('xl') === order.indexOf('grand') + 1,
      'both sit in the walk where their heights say they do', order.join(','));
    ok(Math.max(...steps) <= 30, 'no step in the walk is bigger than 30px', steps.join(','));
    // THE STYLESHEET DRAWS WHAT THE LADDER PROMISES. A rung the CSS did not size would be
    // walked at the automatic height while the ladder claimed otherwise.
    const cssHeight = (name) => Number((html.match(new RegExp('\\.home-bubble\\.hb-size-' + name + '\\{ [^}]*min-height:calc\\((\\d+)px')) || [])[1] || 0);
    const undrawn = Object.keys(heights).filter((n) => cssHeight(n) !== heights[n]);
    ok(undrawn.length === 0, 'the stylesheet draws every rung at the height the ladder names', undrawn.join(','));
    ok(/\.home-bubble\.hb-size-grand\{ grid-column:1 \/ -1;/.test(html), 'Grand spans the row, like full and XL do');
    ok(/\.home-bubble\.hb-size-roomy\{ min-height:calc\(179px \* var\(--hb-s, 1\)\); \}/.test(html),
      'and Roomy is a plain one-column rung');
    // DRIVEN, the whole walk: from automatic, ten taps must be exactly the ladder in
    // order, and the eleventh puts the card back to automatic.
    const kind = 'topsong';
    const bubble = bubbleFor(win, kind);
    const chip = bubble && bubble.querySelector('.hb-expand');
    const seen = [];
    for (let i = 0; i < 10 && chip; i++) {
      click(win, chip);
      await wait(25);
      const at = order.find((n) => (n === null ? !/hb-size-/.test(bubble.className) : bubble.classList.contains('hb-size-' + n)));
      seen.push(at === undefined ? 'none' : at);
    }
    const want = order.slice(order.indexOf(null) + 1).concat(order.slice(0, order.indexOf(null) + 1));
    ok(JSON.stringify(seen) === JSON.stringify(want),
      'the chip lands on every rung in turn, in the order the ladder names', seen.join(','));
    ok(want[want.length - 1] === null && seen[seen.length - 1] === null,
      'and the tap past the top of the ladder is the one that puts the card back to automatic', String(seen[seen.length - 1]));
    ok(!(meta('homeBubbleSizes') || {})[kind], 'which clears the saved size instead of storing automatic', JSON.stringify((meta('homeBubbleSizes') || {})[kind]));
    // THE STATS CARD follows the ladder: the bigger two lines from 80.2.6 apply on the new
    // sizes too, so a taller card is not a taller empty one.
    const grown = (html.match(/\[data-bubble="stats"\]:is\(([^)]*)\) [.]hb-value/) || [])[1] || '';
    ok(/hb-size-roomy/.test(grown) && /hb-size-grand/.test(grown),
      'the stats card grows its words on Roomy and Grand as well', grown);
    ok(/mini, small, wide, automatic, <b>medium<\/b>, tall, roomy, full, grand and XL\./.test(html),
      'the Sandbox paragraph lists the presets in that same order');
    // DRIVEN, the other end of the same request: four taps on H are four quarter steps,
    // each drawn at its own height - 148, 177, 207, 236.
    const other = 'artists';
    const hplus = doc.querySelector('#sandboxBubbleSizes [data-hbex="' + other + '"][data-axis="h"][data-dir="1"]');
    ok(!!hplus, 'the Sandbox stepper is there to drive');
    const marks = [];
    for (let i = 0; i < 4 && hplus; i++) {
      click(win, hplus);
      await wait(40);
      const hv = Number(((meta('homeBubbleExact') || {})[other] || {}).h);
      const drawn = bubbleFor(win, other);
      marks.push(hv + 'x=' + Math.round(118 * hv) + 'px:' + /calc\((\d+)px/.test(drawn && drawn.style.minHeight || ''));
    }
    ok(marks.join(',') === '1.25x=148px:true,1.5x=177px:true,1.75x=207px:true,2x=236px:true',
      'four taps are four quarter steps, each drawn at its own height', marks.join(','));
    click(win, doc.getElementById('sandboxBubbleSizesReset'));
    await wait(100);
  }

  ok(errors.length === 0, 'no uncaught page errors while any of this ran', errors.slice(0, 3));

  console.log('\nhome-bubble-size-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
