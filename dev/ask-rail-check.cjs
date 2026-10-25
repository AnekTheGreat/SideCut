// 75.1.2 - FOUR PINNED ARTISTS AT A TIME, AND ASK SIDECUT READS THE WHOLE SENTENCE.
//
// The owner, two asks: "ask SideCut should be smarter, pinned artists plateu should
// have 4 displayed at one time with scrolling potential unlimited".
//
//   [1] release metadata: the page is 75.1.2, the newest changelog entry is 75.1.2, the
//       shell cache moved with it, and the stamp is not in the reader's future;
//   [2] the rail is a quarter of its own width per chip - four in the card and the
//       fifth starting at the edge - with no cap on how many pins render;
//   [3] "play ..." reaches a song, an artist and a playlist, and Do it really starts
//       the music;
//   [4] shuffle and repeat move the same switch the player's buttons move, and
//       Undo puts them back;
//   [5] the drawer answers a question about the library with the library's numbers;
//   [6] a sentence it cannot carry out gets an honest reply, not a Do it button;
//   [7] "add these to X" and the follow-up "undo that" work off the selection;
//   [8] no uncaught page errors while any of this ran.
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

const VER = '80.2.7';
const PREV = '80.2.6';

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

(async () => {
  const win = dom.window;
  await wait(7000);
  const doc = win.document;

  console.log('[1] release metadata');
  {
    const ver = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
    ok(ver === VER, 'the page runs as ' + VER + ' (' + ver + ')');
    const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
    let entries = null;
    try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
    ok(!!entries && String(entries[0].version) === VER, 'the newest changelog entry is ' + VER + ' (' + (entries && entries[0].version) + ')');
    if (entries) {
      const items = entries[0].items || [];
      ok(items.length >= 5, 'with the things this release changed listed (' + items.length + ')');
      const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
      ok(longest <= 320, 'each note one short sentence or two (longest ' + longest + ')');
      ok(/EDT$/.test(String(entries[0].date)), 'the ship stamp is Eastern (' + entries[0].date + ')');
      const stamp = String(entries[0].date).match(/([A-Z][a-z]+) (\d+), (\d{4}) · (\d+):(\d+) (AM|PM) EDT/);
      ok(!!stamp, 'and it parses as a real date');
      if (stamp) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        let hh = parseInt(stamp[4], 10) % 12;
        if (stamp[6] === 'PM') hh += 12;
        const at = Date.UTC(parseInt(stamp[3], 10), months.indexOf(stamp[1]), parseInt(stamp[2], 10), hh + 4, parseInt(stamp[5], 10));
        ok(at - Date.now() < 15 * 60 * 1000, 'and it is not stamped in the future');
      }
      ok(String((entries[1] || {}).version) === PREV, 'the release before it is still listed next (' + (entries[1] || {}).version + ')');
    }
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const cache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1];
    ok(cache === 'sidecut-shell-v' + VER, 'the shell cache moved with the release (' + cache + ')');
  }

  console.log('[2] the pinned-artists rail: four at a time, and it keeps going');
  {
    const css = html.replace(/\s+/g, ' ');
    ok(/--pa-gap: 10px/.test(css), 'the rail states the gap its quarter is measured against');
    ok(/flex: 0 0 calc\(\(100% - 3 \* var\(--pa-gap\)\) \/ 4\)/.test(css),
      'and a chip is a quarter of the rail minus the three gaps between four');
    ok(/width: calc\(\(100% - 3 \* var\(--pa-gap\)\) \/ 4\)/.test(css), 'the same width, so the fourth cannot be sliced');
    ok(/#pinnedArtistsList\{[^}]*scroll-snap-type: x proximity/.test(css), 'a swipe settles on a chip edge');
    const listStyle = (html.match(/<div id="pinnedArtistsList" style="([^"]*)"/) || [])[1] || '';
    ok(/overflow-x:auto/.test(listStyle), 'the rail scrolls sideways', listStyle);
    ok(/flex-wrap:nowrap/.test(listStyle), 'and never wraps to a second row', listStyle);
    ok(!/width:72px/.test(html.match(/pinned-artist-chip[\s\S]{0,1200}/)[0] || ''), 'no fixed 72px chip is left in the template');
    ok(!/pinnedArtists\.slice\(0, ?4\)/.test(html), 'nothing caps the number of pins at four');

    // Ten pins render as ten chips - the rail holds however many the phone has.
    const pins = win.__scPinnedArtists();
    for (let i = 1; i <= 10; i++) pins.push({ name: 'Artist ' + i, art: '', photo: '' });
    win.__scRenderPinnedArtists();
    await wait(120);
    const chips = doc.querySelectorAll('#pinnedArtistsList .pinned-artist-chip');
    ok(chips.length === 10, 'all ten pins are in the rail (' + chips.length + ')');
    ok(doc.querySelectorAll('#pinnedArtistsList .pa-tile').length === 10, 'each with its square artwork tile');
    const count = doc.getElementById('pinnedArtistsCount');
    ok(!!count && count.textContent === '10', 'the header says how many are pinned (' + (count && count.textContent) + ')');
    ok(count && count.parentElement && count.parentElement.textContent.indexOf('Pinned artists') !== -1, 'and it sits beside the title');
    ok(chips[0] && /Artist 1/.test(chips[0].textContent), 'in the order they were pinned (' + (chips[0] && chips[0].textContent) + ')');
  }

  click(win, doc.getElementById('homeAiBtn'));
  await wait(250);
  if (!doc.getElementById('scAiInput')) {
    ok(false, 'the rest of this gate needs the Ask drawer, and this page has none');
    console.log('\nask-rail-check: ' + pass + ' passed, ' + fail + ' failed');
    process.exit(1);
  }

  const ask = async (sentence) => {
    const input = doc.getElementById('scAiInput');
    input.value = sentence;
    click(win, doc.getElementById('scAiPlanBtn'));
    await wait(250);
    const planEl = doc.getElementById('scAiPlan');
    const steps = Array.from(planEl.querySelectorAll('.scai-step')).map((s) => s.textContent);
    return { on: planEl.classList.contains('on'), steps, log: doc.getElementById('scAiLog').textContent };
  };
  const doIt = async () => { click(win, doc.getElementById('scAiDoBtn')); await wait(450); };

  win.__scSetPlaylist('Night Drive', ['t4', 't5']);
  win.__scEnterSelect([]);
  await wait(60);

  console.log('[3] "play ..." reaches a song, an artist and a playlist');
  {
    const r = await ask('play Aurora');
    ok(r.on && r.steps.length === 1 && /Play "Aurora"/.test(r.steps[0]), 'a song becomes one play step', r.steps);
    ok(!/Nothing in your library/.test(r.log), 'and it is not the old "nothing matches" reply');
    await doIt();
    const cur = win.__scCurrentTrack();
    ok(cur && cur.name === 'Aurora', 'Do it starts the song (' + (cur && cur.name) + ')');

    const a = await ask('play Diljit Dosanjh');
    ok(a.on && a.steps.length === 1 && /Play Diljit Dosanjh \(3 songs\)/.test(a.steps[0]), 'an artist becomes the artist\'s songs', a.steps);
    await doIt();
    const curA = win.__scCurrentTrack();
    ok(curA && curA.artist === 'Diljit Dosanjh', 'and Do it starts one of them (' + (curA && curA.name) + ')');

    const p = await ask('play Night Drive');
    ok(p.on && p.steps.length === 1 && /Play the playlist "Night Drive" \(2 songs\)/.test(p.steps[0]), 'a playlist becomes the playlist', p.steps);
    await doIt();
    ok(win.__scActivePlaylist() === 'Night Drive', 'and Do it opens it as itself (' + win.__scActivePlaylist() + ')');
    const pl = win.__scPlaylists()['Night Drive'] || [];
    const curP = win.__scCurrentTrack();
    ok(curP && pl.indexOf(curP.id) !== -1, 'with the first song from that playlist playing (' + (curP && curP.name) + ')');

    const m = await ask('play a song that does not exist');
    ok(!/Do it/.test(m.log) || m.steps.length === 0, 'a name the library does not have is not offered as a Do it');
    ok(/Nothing in your library matches/.test(m.log), 'it says so plainly (' + m.log.slice(-90) + ')');
  }

  console.log('[4] shuffle and repeat move the player\'s own switches, and Undo puts them back');
  {
    const before = win.__scShuffleOn();
    const r = await ask('shuffle Night Drive');
    ok(r.on && r.steps.length === 2, 'shuffle + play is two steps', r.steps);
    ok(/Turn shuffle on/.test(r.steps[0] || ''), 'the switch first', r.steps[0]);
    await doIt();
    ok(win.__scShuffleOn() === true, 'Do it turned the same shuffle state the button toggles on');
    ok(/Done/.test(doc.getElementById('toast').textContent), 'and the toast says what happened');
    const undoBtn = doc.getElementById('toast').querySelector('button');
    ok(!!undoBtn, 'with an Undo');
    click(win, undoBtn);
    await wait(450);
    ok(win.__scShuffleOn() === before, 'Undo puts shuffle back to ' + before + ' (' + win.__scShuffleOn() + ')');

    const rep = await ask('repeat this song');
    ok(rep.on && rep.steps.length === 1 && /this song/.test(rep.steps[0]), 'repeat is one step, one mode named', rep.steps);
    await doIt();
    ok(win.__scRepeatMode() === 'one', 'Do it sets repeat to one (' + win.__scRepeatMode() + ')');
    click(win, doc.getElementById('toast').querySelector('button'));
    await wait(450);
    ok(win.__scRepeatMode() === 'off', 'and Undo sets it back (' + win.__scRepeatMode() + ')');
  }

  console.log('[5] the drawer answers a question with the library\'s own numbers');
  {
    const r = await ask('how many songs do I have');
    ok(!r.on || r.steps.length === 0, 'a question is not a plan', r.steps);
    ok(/You have 5 songs/.test(r.log), 'it counts the library (' + r.log.slice(-70) + ')');
    const a = await ask('how many pinned artists');
    ok(/10 pinned artists/.test(a.log), 'and the pins (' + a.log.slice(-60) + ')');
    const playing = await ask('what is playing');
    ok(/".+"/.test(playing.log), 'and what is playing (' + playing.log.slice(-60) + ')');
  }

  console.log('[6] a sentence it cannot carry out gets an honest reply');
  {
    const r = await ask('flibbertigibbet the garden hose');
    ok(r.steps.length === 0, 'no Do it step for work nothing does', r.steps);
    ok(/do not have a command for that sentence/.test(r.log), 'it says it does not know (' + r.log.slice(-110) + ')');
    ok(/play a song, an artist or a playlist/.test(r.log), 'and lists what it can do instead');
  }

  console.log('[7] "add these to X", and the follow-up "undo that"');
  {
    win.__scEnterSelect(['t3']);
    await wait(60);
    const r = await ask('add these to Night Drive');
    ok(r.on && r.steps.length === 1 && /Add 1 song to "Night Drive"/.test(r.steps[0]), 'the sentence names the playlist and the count', r.steps);
    await doIt();
    ok((win.__scPlaylists()['Night Drive'] || []).indexOf('t3') !== -1, 'Do it adds the selected song', win.__scPlaylists()['Night Drive']);

    win.__scEnterSelect(['t2']);
    await wait(60);
    const again = await ask('add these too');
    ok(again.on && /Add 1 song to "Night Drive"/.test(again.steps[0] || ''), '"add these too" points at the playlist just touched', again.steps);
    await doIt();
    ok((win.__scPlaylists()['Night Drive'] || []).indexOf('t2') !== -1, 'and adds the new selection', win.__scPlaylists()['Night Drive']);

    const undo = await ask('undo that');
    ok(undo.on && undo.steps.length === 1 && /Undo/.test(undo.steps[0] || ''), '"undo that" is a plan with one Undo step', undo.steps);
    await doIt();
    const after = win.__scPlaylists()['Night Drive'] || [];
    ok(after.indexOf('t2') === -1, 'and it takes the last plan back', after);
    ok(after.indexOf('t3') !== -1, 'leaving the plan before it alone', after);
  }

  console.log('[8] no uncaught page errors');
  {
    const real = errors.filter((m) => !/offline|NetworkError|Failed to fetch/i.test(m));
    ok(real.length === 0, 'the page ran clean', real.slice(0, 3));
  }

  console.log('\nask-rail-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('\nask-rail-check: the gate itself threw - ' + (e && e.stack || e));
  process.exit(1);
});
