// 80.0 - THE MASSIVE REVAMP: milestones, the Studio/Tools split, the pinned window
// option, gliding tabs, the cloud layout and the note drop-downs.
//
// The owner asked for all of this in one release, with one rule on top: the original
// layout must always be one tap away. So both switches are tested in BOTH
// directions here, and the default is tested too.
//
//   [1] release metadata: 80.0, "Massive Revamp Update", notes are one-sentence
//       briefs with a detail under each, shell cache moved;
//   [2] Unsorted renders once, even when the playlists object holds a real key
//       called Unsorted (which it does as soon as a song has no playlist);
//   [3] pinned artists: the row is the default, the grid is a switch, both are
//       remembered, and neither caps the number of pins;
//   [4] cloud layout: circles, the dock on the right, the small now bar, the three
//       header buttons on the stats bubble - and classic puts every one back;
//   [5] the celebration: number, unit, once-per-milestone record, replay from
//       Studio, and the manual replay that does not mark anything;
//   [6] Studio is one pill split down the diagonal into Studio and Tools, with the
//       non-studio sections moved and the chosen tab remembered;
//   [7] the dock highlight exists and the tab strip keeps the active tab in view;
//   [8] Settings -> More carries both switches;
//   [9] no uncaught page errors while any of this ran.
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

const VER = '80.0';
const PREV = '75.1.2';

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
      // 'Unsorted' is a REAL key here on purpose: that is the state the duplicate
      // bug needed, and the strip must render the virtual tab only.
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], Unsorted: [] } }],
      // Seven consecutive listening days ending today, so the app boots on a
      // 7-day streak and the boot celebration has something real to read.
      ['listenedDates', { key: 'listenedDates', value: (() => {
        const out = [], d = new Date();
        for (let i = 0; i < 7; i++) {
          out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          d.setDate(d.getDate() - 1);
        }
        return out;
      })() }],
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
    const head = entries && entries[0];
    ok(!!head && /Massive Revamp Update/.test(head.title), 'and it is called Massive Revamp Update (' + (head && head.title) + ')');
    const items = (head && head.items) || [];
    ok(items.length >= 10, 'with the revamp listed (' + items.length + ' notes)');
    const allStrings = items.every((it) => typeof it === 'string');
    ok(allStrings, 'items is still an array of plain strings, so every older reader and gate keeps working');
    const details = (head && head.details) || [];
    ok(details.length === items.length, 'with a parallel details array, one per note (' + details.length + '/' + items.length + ')');
    const briefsAreSentences = items.every((it) => /[.!]$/.test(String(it)) && String(it).length <= 200);
    ok(briefsAreSentences, 'each brief is a single short sentence (' + Math.max(...items.map((it) => String(it).length)) + ' chars max)');
    const detailsLonger = details.every((d, i) => String(d).length > String(items[i]).length);
    ok(detailsLonger, 'and the detail is the longer half');
    ok(details.every((d) => /[.]$/.test(String(d))), 'every detail is written as prose');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String((entries[1] || {}).version) === PREV, 'the release before it is still listed next (' + (entries[1] || {}).version + ')');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const cache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1];
    ok(cache === 'sidecut-shell-v' + VER, 'the shell cache moved with the release (' + cache + ')');
    // The renderer really draws the drop-down, not just the sentence.
    ok(/function changelogRich\(/.test(html), 'the notes have a rich reader (brief + detail)');
    ok(/sc-cl-item/.test(html) && /sc-cl-detail/.test(html), 'and a detail element to open');
    ok(/function changelogItems\(entry\)\{[\s\S]{0,120}changelogRich\(entry\)\.map\(scClBrief\)/.test(html.replace(/\s+/g, ' ')),
      'while changelogItems still hands plain strings to every older caller');
  }

  console.log('[2] Unsorted renders once');
  {
    click(win, doc.getElementById('libraryBtn'));
    await wait(400);
    const tabs = Array.from(doc.querySelectorAll('#tabs .tab')).map((t) => (t.textContent || '').trim());
    const unsorted = tabs.filter((t) => /^Unsorted$/.test(t));
    ok(unsorted.length === 1, 'exactly one Unsorted tab with a real Unsorted key in playlists (' + unsorted.length + ')');
    // The first tab is labelled "Library" when durations-on-tabs is on and
    // "All Songs" when it is off - both are the same tab, so accept either.
    const first = tabs.filter((t) => /^(Library|All Songs)$/.test(t));
    ok(first.length === 1, 'and one Library tab (' + first.join(',') + ')');
    ok(tabs.indexOf('Unsorted') === tabs.indexOf(first[0]) + 1, 'the virtual one still sits right after Library (' + tabs.join(' | ') + ')');
  }

  console.log('[3] pinned artists: row is the default, grid is the switch');
  {
    const S = win.SC80;
    ok(!!S && S.version === VER, 'the revamp block is on the page (' + (S && S.version) + ')');
    ok(S.pinnedLayout() === 'row', 'the four-in-a-row rail is the default (' + S.pinnedLayout() + ')');
    ok(!doc.body.classList.contains('sc80-pa-grid'), 'and the page carries no grid class out of the box');
    const css = html.replace(/\s+/g, ' ');
    ok(/body\.sc80-pa-grid #pinnedArtistsList\{[^}]*grid-template-columns: repeat\(4/.test(css),
      'the grid rule is four columns');
    ok(/body\.sc80-pa-grid #pinnedArtistsList\{[^}]*max-height: 236px/.test(css), 'with a two-row window (max-height)');
    ok(/body\.sc80-pa-grid #pinnedArtistsList\{[^}]*overflow-y: auto/.test(css), 'that scrolls for the ninth pin');
    S.setPinnedLayout('grid');
    await wait(50);
    ok(doc.body.classList.contains('sc80-pa-grid'), 'choosing eight squares turns the grid on');
    ok(win.localStorage.getItem('sc80PinnedLayout') === '"grid"', 'and the choice is remembered (' + win.localStorage.getItem('sc80PinnedLayout') + ')');
    S.setPinnedLayout('row');
    await wait(50);
    ok(!doc.body.classList.contains('sc80-pa-grid'), 'and four in a row turns it back off');
    // Ten pins still render ten chips in either layout - the window moves, the list does not shrink.
    const pins = win.__scPinnedArtists();
    for (let i = 1; i <= 10; i++) pins.push({ name: 'Artist ' + i, art: '', photo: '' });
    win.__scRenderPinnedArtists();
    await wait(150);
    ok(doc.querySelectorAll('#pinnedArtistsList .pinned-artist-chip').length >= 10, 'ten pins render ten chips');
    S.setPinnedLayout('grid');
    await wait(80);
    ok(doc.querySelectorAll('#pinnedArtistsList .pinned-artist-chip').length >= 10, 'and the grid does not cap them either');
    ok(/scroll-behavior: smooth/.test(css) && /wheel/.test(html), 'the rail glides and takes a mouse wheel');
    S.setPinnedLayout('row');
  }

  console.log('[4] cloud layout, and the way back');
  {
    const S = win.SC80;
    ok(S.layout() === 'classic', 'classic tabs are the default (' + S.layout() + ')');
    ok(!doc.body.classList.contains('sc80-cloud'), 'no cloud class out of the box');
    ok(!doc.getElementById('sc80CloudCtl'), 'and no extra bubbles on the stats card');
    S.setLayout('cloud');
    await wait(120);
    ok(doc.body.classList.contains('sc80-cloud'), 'the cloud layout turns on');
    ok(!!doc.getElementById('sc80Now'), 'the small now bar exists');
    const ctl = doc.getElementById('sc80CloudCtl');
    ok(!!ctl, 'the three header buttons moved onto a Home bubble');
    ok(ctl && ctl.querySelectorAll('button').length === 3, 'all three of them (' + (ctl && ctl.querySelectorAll('button').length) + ')');
    ok(ctl && !!doc.getElementById('homeAiBtn') && ctl.parentElement === doc.getElementById('homeAiBtn').parentElement,
      'on the listening-stats card, beside Ask SideCut');
    ok(!!doc.getElementById('notifBtn') && !!doc.getElementById('refreshBtn') && !!doc.getElementById('themeBtn'),
      'the real header buttons are still on the page (hidden, not deleted)');
    const css = html.replace(/\s+/g, ' ');
    ok(/body\.sc80-cloud \.action-strip\{[^}]*right: 10px/.test(css), 'the dock floats on the right');
    ok(/body\.sc80-cloud \.action-strip\{[^}]*flex-direction: column/.test(css), 'as a column');
    ok(/body\.sc80-cloud \.home-bubble\{[^}]*border-radius: 50%/.test(css), 'and the bubbles are round');
    ok(/body\.sc80-cloud \.brand span\{ display: none/.test(css), 'the your files no ads line is gone in this layout');
    ok(win.localStorage.getItem('sc80Layout') === '"cloud"', 'the layout choice is remembered');
    S.setLayout('classic');
    await wait(120);
    ok(!doc.body.classList.contains('sc80-cloud'), 'classic turns the cloud layout off');
    ok(!doc.getElementById('sc80CloudCtl'), 'the extra bubbles are removed from the stats card');
    ok(win.localStorage.getItem('sc80Layout') === '"classic"', 'and the original is what is remembered (' + win.localStorage.getItem('sc80Layout') + ')');
  }

  console.log('[5] the milestone celebration');
  {
    const S = win.SC80;
    // The streak above is a real 7-day streak, so the boot itself had to open the
    // 7-day card without being asked. This is the "on boot" half of the ask.
    ok(S.reached() === 7, 'the app reads a 7-day streak on boot (' + S.reached() + ')');
    const boot = doc.getElementById('sc80Milestone');
    ok(!!boot && boot.classList.contains('show'), 'and the boot celebration opened by itself');
    ok(boot && boot.querySelector('.sc80-ms-num').textContent.trim() === '7', 'showing the streak it actually reached (' + (boot && boot.querySelector('.sc80-ms-num').textContent) + ')');
    ok(!!JSON.parse(win.localStorage.getItem('sc80Milestones') || '{}')['7'], 'and the 7-day celebration is recorded, so it plays once');
    if (boot) click(win, boot.querySelector('[data-sc80-close]:not([data-sc80-replay])'));
    await wait(80);
    ok(Array.isArray(S.milestones) && S.milestones.indexOf(50) !== -1 && S.milestones.indexOf(100) !== -1,
      '50 and 100 day streaks are milestones (' + S.milestones.join(',') + ')');
    S.celebrate(50);
    await wait(120);
    const host = doc.getElementById('sc80Milestone');
    ok(!!host && host.classList.contains('show'), 'the celebration opens');
    ok(host && host.querySelector('.sc80-ms-num').textContent.trim() === '50', 'with the number (' + (host && host.querySelector('.sc80-ms-num').textContent) + ')');
    ok(host && /DAY STREAK/.test(host.querySelector('.sc80-ms-unit').textContent), 'and what it counts');
    ok(host && host.querySelectorAll('.sc80-ms-bits i').length >= 20, 'confetti is there');
    const rec = JSON.parse(win.localStorage.getItem('sc80Milestones') || '{}');
    ok(!!rec['50'], 'and the milestone is recorded as celebrated');
    click(win, host.querySelector('[data-sc80-close]:not([data-sc80-replay])'));
    await wait(80);
    ok(!doc.getElementById('sc80Milestone').classList.contains('show'), 'Keep it going closes it');
    S.celebrate(100, { manual: true });
    await wait(80);
    const rec2 = JSON.parse(win.localStorage.getItem('sc80Milestones') || '{}');
    ok(!rec2['100'], 'a replay does not mark an unearned milestone as celebrated');
    click(win, doc.getElementById('sc80Milestone').querySelector('[data-sc80-close]:not([data-sc80-replay])'));
  }

  console.log('[6] Studio: one pill, split down the diagonal');
  {
    click(win, doc.getElementById('studioBtn'));
    await wait(600);
    const host = doc.getElementById('studioView');
    const bar = host.querySelector('.sc80-tabs');
    ok(!!bar, 'the Studio tab bar is on the page');
    ok(bar && bar.querySelectorAll('.sc80-tab').length === 2, 'two halves');
    const names = bar ? Array.from(bar.querySelectorAll('.sc80-tab')).map((b) => b.getAttribute('data-tab')) : [];
    ok(names.join('|') === 'studio|tools', 'called Studio and Tools (' + names.join('|') + ')');
    const labels = bar ? Array.from(bar.querySelectorAll('.sc80-tab')).map((b) => (b.firstChild && b.firstChild.textContent || '').trim()) : [];
    ok(labels.join('|') === 'Studio|Tools', 'and both halves are labelled (' + labels.join('|') + ')');
    const line = bar && bar.querySelector('line');
    ok(!!line && line.getAttribute('x1') === '100%' && line.getAttribute('y1') === '100%' &&
       line.getAttribute('x2') === '0' && line.getAttribute('y2') === '0',
       'the diagonal runs bottom right to top left (' + (line && [line.getAttribute('x1'), line.getAttribute('y1'), line.getAttribute('x2'), line.getAttribute('y2')].join(' ')) + ')');
    const paneStudio = host.querySelector('.sc80-pane[data-pane="studio"]');
    const paneTools = host.querySelector('.sc80-pane[data-pane="tools"]');
    ok(!!paneStudio && !!paneTools, 'both panes exist');
    ok(paneStudio && !!paneStudio.querySelector('.sc-tools'), 'Studio keeps the creative tool cards');
    const folds = paneTools ? Array.from(paneTools.querySelectorAll('[data-fold]')).map((b) => b.getAttribute('data-fold')) : [];
    ['scFoldBadges', 'scFoldStorage', 'scFoldAutodj', 'scFoldGestures', 'scFoldBatchTags', 'scFoldBatchSel']
      .forEach((k) => ok(folds.indexOf(k) !== -1, 'Tools holds ' + k));
    ok(paneStudio && !paneStudio.querySelector('[data-fold="scFoldBadges"]'), 'and Studio no longer holds the badges wall');
    ok(!!paneTools && !!paneTools.querySelector('#sc80Milestones'), 'Tools carries the Milestones card');
    const replayBtns = paneTools ? paneTools.querySelectorAll('[data-sc80-ms]') : [];
    ok(replayBtns.length >= 2, 'with replay buttons on it (' + replayBtns.length + ')');
    ok(!!paneTools.querySelector('#sc80Look'), 'and the Look and feel switches');
    ok(paneTools.classList.contains('active') === false, 'Studio is the tab it opens on');
    click(win, bar.querySelector('[data-tab="tools"]'));
    await wait(80);
    ok(paneTools.classList.contains('active') && !paneStudio.classList.contains('active'), 'tapping Tools switches the pane');
    ok(win.localStorage.getItem('sc80StudioTab') === '"tools"', 'and the choice is remembered');
    click(win, bar.querySelector('[data-tab="studio"]'));
    await wait(80);
    ok(paneStudio.classList.contains('active'), 'and back to Studio');
  }

  console.log('[7] the tabs glide');
  {
    const g = doc.getElementById('sc80DockGlide');
    ok(!!g, 'the dock has one highlight layer');
    const css = html.replace(/\s+/g, ' ');
    ok(/#sc80DockGlide\{[^}]*transition: transform 0\.34s/.test(css), 'that moves by transform, not by repaint');
    ok(/\.action-pill\{[\s\S]{0,400}transition: transform 0\.18s/.test(html), 'and the pills cross-fade their colour');
    ok(/\.tab\{[\s\S]{0,300}transition: background 0\.28s/.test(html), 'the library tabs do the same');
    ok(/scrollTo\(\{ left: Math\.max\(0, left\), behavior: 'smooth' \}\)/.test(html), 'the active tab is scrolled into the middle');
  }

  console.log('[8] Settings -> More carries the switches');
  {
    const pane = doc.getElementById('settingsPaneMore');
    const card = doc.getElementById('sc80Look');
    ok(!!pane && !!card, 'the new-look card is in the More pane');
    ok(card && !!card.querySelector('[data-sc80-layout="classic"]') && !!card.querySelector('[data-sc80-layout="cloud"]'),
      'both layouts are offered');
    ok(card && !!card.querySelector('[data-sc80-pinned="row"]') && !!card.querySelector('[data-sc80-pinned="grid"]'),
      'both pinned windows are offered');
    click(win, card.querySelector('[data-sc80-layout="cloud"]'));
    await wait(80);
    ok(win.SC80.isCloud(), 'the card really switches the layout');
    click(win, card.querySelector('[data-sc80-layout="classic"]'));
    await wait(80);
    ok(!win.SC80.isCloud(), 'and switches it back');
  }

  console.log('[9] no page errors');
  {
    const real = errors.filter((e) => !/Not implemented|Could not parse CSS|Could not load|ResizeObserver/i.test(e));
    ok(real.length === 0, 'nothing threw while all of that ran', real.slice(0, 3));
  }

  console.log('\nrevamp-check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
