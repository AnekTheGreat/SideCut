// 74.1.9 - ASK SIDECUT: one button, the songs as context, a plan you approve, and an undo.
//
// The owner: "can we make an ai button that I can ask anything with like my songs and it'll do it
// like create a new playlist containing these songs that Crossfade with specific DJ mode settings".
//
//   [1] the button is on Home and on the selection bar, and it opens a drawer;
//   [2] the drawer says what it is looking at - the selection, by name;
//   [3] a sentence becomes a PLAN and NOTHING runs while it is only a plan;
//   [4] Cancel changes nothing;
//   [5] Do it creates the playlist with exactly the selected songs, sets the crossfade and turns
//       DJ mode on for that playlist;
//   [6] Undo takes all of it back - the playlist, the crossfade and the DJ flag;
//   [7] a question is answered from the knowledge base, with no plan and no Do it.
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

const TRACKS = [
  { id: 't1', name: 'Aurora', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Born To Shine', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Clash', artist: 'Diljit Dosanjh', album: 'Aurora Sessions', duration: 171 },
].map((t) => Object.assign(t, { blobType: 'audio/mpeg', fileName: t.id + '.mp3' }));

function fakeIDB(win) {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, Object.assign({}, t)])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3'], Favorites: [] } }],
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
const pls = () => meta('playlists') || {};

(async () => {
  const win = dom.window;
  await wait(7000);
  const doc = win.document;

  console.log('[1] one button, where the music is');
  {
    const hb = doc.getElementById('homeAiBtn');
    ok(!!hb, 'the Home header has an Ask button');
    ok(typeof win.SCAI === 'object' && typeof win.SCAI.open === 'function', 'the drawer is published (window.SCAI)');
    click(win, hb);
    await wait(120);
    const bd = doc.getElementById('scAiBackdrop');
    ok(!!bd && bd.classList.contains('in'), 'tapping it opens the drawer');
    ok(!!doc.getElementById('scAiInput'), 'with an input to ask in');
  }

  // The rest of the gate drives the drawer. On a page without the button there is
  // nothing to drive, and saying so is the red - not a stack trace.
  if (!doc.getElementById('scAiInput')) {
    ok(false, 'the rest of this gate needs the Ask drawer, and this page has none');
    console.log('\nai-button-check: ' + pass + ' passed, ' + fail + ' failed');
    process.exit(1);
  }

  console.log('[2] the drawer knows what "these songs" means');
  {
    win.__scEnterSelect(['t1', 't2']);
    await wait(200);
    ok(!!doc.getElementById('selectAskBtn'), 'and the multi-select bar gets one for the songs you ticked');
    click(win, doc.getElementById('scAiClose'));
    await wait(120);
    ok(!doc.getElementById('scAiBackdrop').classList.contains('in'), 'the close button closes it');
    // THE BAR'S BUTTON HAS TO BE PRESSED, NOT JUST FOUND. The bar is rebuilt from
    // innerHTML whenever the selection changes, so a listener attached to the button
    // that existed at startup is gone by the first redraw - which is exactly how the
    // 74.5 bundle shipped a sparkle on the bar that did nothing. Driven here, twice,
    // either side of a redraw: the second tap is the one a per-element listener can
    // never pass.
    click(win, doc.getElementById('selectAskBtn'));
    await wait(150);
    ok(doc.getElementById('scAiBackdrop').classList.contains('in'), 'tapping the bar\'s button opens the drawer');
    ok(/2 songs selected/.test(doc.getElementById('scAiCtx').textContent), 'with the two ticked songs as its context');
    click(win, doc.getElementById('scAiClose'));
    await wait(120);
    click(win, doc.getElementById('selectCancelBtn'));
    await wait(150);
    win.__scEnterSelect(['t1', 't2', 't3']);
    await wait(200);
    ok(!!doc.getElementById('selectAskBtn'), 'a redrawn bar has its Ask button again');
    click(win, doc.getElementById('selectAskBtn'));
    await wait(150);
    ok(doc.getElementById('scAiBackdrop').classList.contains('in'), 'and that one opens the drawer too, after the redraw');
    ok(/3 songs selected/.test(doc.getElementById('scAiCtx').textContent), 'counting the new selection');
    click(win, doc.getElementById('scAiClose'));
    await wait(120);
    win.__scEnterSelect(['t1', 't2']);
    await wait(200);
    click(win, doc.getElementById('homeAiBtn'));
    await wait(120);
    const ctx = doc.getElementById('scAiCtx').textContent;
    ok(/2 songs selected/.test(ctx), 'the context chip counts the selection', ctx);
    ok(/Aurora/.test(ctx) && /Born To Shine/.test(ctx), 'and names them while there are few enough to name', ctx);
  }

  console.log('[3] a sentence becomes a plan, and nothing runs yet');
  {
    const input = doc.getElementById('scAiInput');
    input.value = 'make a playlist called Night Drive from these songs with a 9 second crossfade and dj mode on';
    click(win, doc.getElementById('scAiPlanBtn'));
    await wait(200);
    const planEl = doc.getElementById('scAiPlan');
    ok(planEl.classList.contains('on'), 'the plan is shown');
    const steps = Array.from(planEl.querySelectorAll('.scai-step')).map((s) => s.textContent);
    ok(steps.length === 3, 'with three steps', steps);
    const stepBy = (re) => steps.filter((s) => re.test(s))[0] || '';
    ok(/Create the playlist "Night Drive"/.test(steps[0] || ''), 'the playlist, named as typed', steps[0]);
    ok(/2 selected songs/.test(steps[0] || ''), 'with the two selected songs', steps[0]);
    ok(/crossfade to 9s/.test(stepBy(/crossfade/)), 'the crossfade', steps);
    ok(/DJ mode on for "Night Drive"/.test(stepBy(/DJ mode/)), 'and DJ mode for that playlist', steps);
    ok(!pls()['Night Drive'], 'NOTHING has been created yet');
    ok(meta('crossfadeSeconds') == null, 'and the crossfade has not moved');
  }

  console.log('[4] Cancel changes nothing');
  {
    click(win, doc.getElementById('scAiCancelBtn'));
    await wait(120);
    ok(!doc.getElementById('scAiPlan').classList.contains('on'), 'the plan closes');
    ok(!pls()['Night Drive'], 'still no playlist');
    ok(meta('crossfadeSeconds') == null, 'still no crossfade change');
  }

  console.log('[5] Do it does all three, through the app\'s own functions');
  {
    // Start from DJ mode OFF for that name, so both directions of the switch are proven:
    // the plan turns it on, and Undo puts the opt-out back.
    win.__scSetDjDisabled('Night Drive', false);
    await wait(150);
    ok((meta('djDisabledPlaylists') || []).indexOf('Night Drive') !== -1, 'the playlist starts with DJ mode off', meta('djDisabledPlaylists'));
    const input = doc.getElementById('scAiInput');
    input.value = 'make a playlist called Night Drive from these songs with a 9 second crossfade and dj mode on';
    click(win, doc.getElementById('scAiPlanBtn'));
    await wait(150);
    click(win, doc.getElementById('scAiDoBtn'));
    await wait(400);
    ok(pls()['Night Drive'] && pls()['Night Drive'].join(',') === 't1,t2', 'the playlist holds exactly the selected songs', pls()['Night Drive']);
    ok(Number(meta('crossfadeSeconds')) === 9, 'the crossfade is 9 seconds', meta('crossfadeSeconds'));
    ok((meta('djDisabledPlaylists') || []).indexOf('Night Drive') === -1, 'DJ mode is ON for that playlist (no opt-out)', meta('djDisabledPlaylists'));
    ok(!doc.getElementById('scAiBackdrop').classList.contains('in'), 'and the drawer closes behind it');
    const toastEl = doc.getElementById('toast');
    ok(/Done/.test(toastEl.textContent), 'the app says what it did', toastEl.textContent);
    ok(!!toastEl.querySelector('button'), 'and offers Undo');
  }

  console.log('[6] Undo takes all three back');
  {
    const undo = doc.getElementById('toast').querySelector('button');
    click(win, undo);
    await wait(600);
    ok(!pls()['Night Drive'], 'the playlist is gone', Object.keys(pls()));
    ok(Number(meta('crossfadeSeconds')) === 6, 'the crossfade is back to what it was', meta('crossfadeSeconds'));
    ok((meta('djDisabledPlaylists') || []).indexOf('Night Drive') !== -1, 'and DJ mode is back off, as it was before the plan', meta('djDisabledPlaylists'));
  }

  console.log('[7] a question is answered, not executed');
  {
    click(win, doc.getElementById('homeAiBtn'));
    await wait(120);
    const input = doc.getElementById('scAiInput');
    input.value = 'how do i add songs';
    click(win, doc.getElementById('scAiPlanBtn'));
    await wait(200);
    const log = doc.getElementById('scAiLog').textContent;
    ok(/Add songs/i.test(log), 'the reply comes from the app\'s own knowledge base', log.slice(-120));
    ok(!doc.getElementById('scAiDoBtn'), 'and there is nothing to run');
    ok(!doc.getElementById('scAiPlan').classList.contains('on'), 'so no plan card is shown');
  }

  ok(errors.length === 0, 'no uncaught page errors while any of this ran', errors.slice(0, 3));

  console.log('\nai-button-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
