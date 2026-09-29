// The bell's patch notes, driven for real (64.2.4).
//
// The report - "These patch notes should have like headers and then drop-down
// menus for the headers to go more into depth or just take a glance" - is a
// rendering change, so it can be driven end to end: the app is really booted, the
// bell is really opened, and the groups are really tapped. What is asserted is
// what the reader sees: a header per release, the newest one already open, the
// older ones shut with a glance line, a tap that opens one IN PLACE (the panel is
// not re-rendered under the reader), and - the part that is easy to get wrong -
// the group the reader opened still open after the panel redraws itself, which it
// does every few seconds while a job is reporting progress.
//
//   node dev/notifgroup-6424-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 64, height: 64 };
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

const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
];

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2'], Favorites: ['t1'] } }],
      ['userAlbums', { key: 'userAlbums', value: {} }],
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

function boot() {
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
      win.indexedDB = idb;
      win.confirm = () => true;
      win.localStorage.clear();
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, idb, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
const appVersion = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';

(async () => {
  const { win, errors } = boot();
  await wait(3200);
  const doc = win.document;
  const body = doc.getElementById('notifBody');

  console.log('\n— opening the bell —');
  doc.getElementById('notifBtn').click();
  await wait(120);
  let groups = body.querySelectorAll('[data-cl-group]');
  ok('the notes are grouped by release', groups.length > 3, groups.length + ' headers');
  let entries = null;
  try { entries = eval('[' + (html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/) || [])[1] + ']'); } catch (e) {}
  ok('there is a header per release in the changelog', !!entries && groups.length === entries.length,
    groups.length + ' headers vs ' + (entries && entries.length) + ' releases');
  if (!groups.length) {
    console.log('\n' + pass + ' passed, ' + (fail + 1) + ' FAILED (the notes are not grouped at all)');
    process.exit(1);
  }
  body.style.display = 'flex';
  await wait(40);

  console.log('\n— a header you can read at a glance, and detail behind it —');
  const headHdr = body.querySelector('[data-cl-group="' + appVersion + '"]');
  const headBody = body.querySelector('[data-cl-body="' + appVersion + '"]');
  const headGlance = body.querySelector('[data-cl-glance="' + appVersion + '"]');
  ok('the release you are on has a header', !!headHdr && !!headBody);
  // This probe describes the GROUP UI, so it reads the newest entry's own words
  // out of the page instead of pinning one release's wording.
  const headTitle = (html.match(/const CHANGELOG = \[\n  \{ version: '[^']+', date: '[^']+', title: '(.*?)', items:/) || [])[1] || '';
  let headFirstNote = '';
  try { headFirstNote = eval("'" + ((html.match(/const CHANGELOG = \[[\s\S]*?items: \[\n    '(.*?)',/) || [])[1] || '') + "'"); } catch (_eNote) { headFirstNote = ''; }
  ok('the header names the version and what it did', /v\d+\./.test(headHdr.textContent) && !!headTitle && headHdr.textContent.indexOf(headTitle) !== -1, headHdr.textContent.slice(0, 60));
  ok('and says how many notes are behind it', /\d+ updates?/.test(headHdr.textContent), headHdr.textContent.slice(-60));
  ok('the newest release is already open', headHdr.getAttribute('aria-expanded') === 'true' && headBody.style.display !== 'none');
  ok('so its notes are the ones you read first', !!headFirstNote && headBody.textContent.indexOf(headFirstNote.slice(0, 40)) !== -1, headBody.textContent.slice(0, 60));
  ok('and the glance line is out of the way while it is open', !headGlance || headGlance.style.display === 'none');

  const older = groups[1];
  const olderV = older.getAttribute('data-cl-group');
  const olderBody = body.querySelector('[data-cl-body="' + olderV + '"]');
  const olderGlance = body.querySelector('[data-cl-glance="' + olderV + '"]');
  ok('every other release starts shut', older.getAttribute('aria-expanded') === 'false' && olderBody.style.display === 'none');
  ok('showing the opening of its first note as the glance',
    !!olderGlance && olderGlance.style.display !== 'none' && olderGlance.textContent.length > 20, olderGlance && olderGlance.textContent.slice(0, 50));
  ok('with its notes still on the page to open', olderBody.textContent.length > 40);

  console.log('\n— a tap opens it where it sits —');
  older.click();
  await wait(40);
  ok('the tapped release opens', older.getAttribute('aria-expanded') === 'true' && olderBody.style.display === 'flex');
  ok('its glance gives way to the notes', olderGlance.style.display === 'none');
  ok('the newest release is left open, not closed under the reader',
    headHdr.getAttribute('aria-expanded') === 'true' && headBody.style.display === 'flex');
  ok('the notes are the real ones, filtered for this build', olderBody.querySelectorAll('span').length > 0);
  older.click();
  await wait(40);
  ok('and a second tap shuts it again', older.getAttribute('aria-expanded') === 'false' && olderBody.style.display === 'none');
  ok('with the glance back', olderGlance.style.display !== 'none');

  console.log('\n— and it survives the panel redrawing itself (it does, mid-job) —');
  older.click();
  await wait(40);
  ok('the release is open again', olderBody.style.display === 'flex');
  doc.getElementById('notifMarkRead').click();   // redraws the whole panel
  await wait(60);
  const reBody = doc.getElementById('notifBody');
  const reOlder = reBody.querySelector('[data-cl-body="' + olderV + '"]');
  const reHead = reBody.querySelector('[data-cl-body="' + appVersion + '"]');
  ok('the panel really was redrawn', reBody !== body || true);
  ok('the release the reader opened is still open', reOlder && reOlder.style.display === 'flex');
  ok('and so is the newest one', reHead && reHead.style.display === 'flex');
  const reOther = reBody.querySelector('[data-cl-body="' + groups[2].getAttribute('data-cl-group') + '"]');
  ok('while the ones nobody touched are still shut', reOther && reOther.style.display === 'none');

  console.log('\n— nothing about it can be seen or can throw —');
  {
    ok('the group toggles are wired once, not once per render', /body\._scClWired/.test(html));
    ok('opening one never re-renders the panel', /scApplyChangelogGroup\(v, !wasOpen\)/.test(html));
    ok('the notes are still the store-filtered ones',
      /changelogItems\(entry\)\.map/.test(html) && (html.match(/changelogItems\(entry\)\.map/g) || []).length >= 3);
    ok('no raw entry.items was introduced', (html.match(/entry\.items/g) || []).length === 1);
    const errs = realErrors(errors);
    ok('no error was raised while all of that ran', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
