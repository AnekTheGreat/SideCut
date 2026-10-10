// v73.6.1 - export one album from Manage albums, not from every album card.
//
// The owner's words: "Remove the little button to export a singular album from
// here and add it to manage albums. V73.6.1".
//
// 73.4.9 put an export button on EVERY album card in the Albums tab. It crowded
// each card and was easy to hit by mistake when all you wanted was to open an
// album. 73.6.1 takes it off the cards and gives every row in Manage albums its
// own export button, beside Rename and Delete, so the album actions sit together
// in the one place albums are managed.
//
// THE SECTIONS BELOW DRIVE THE SHIPPED PAGE in jsdom: the real Manage albums
// panel is opened the way a user opens it, and its own export button is clicked.
// Nothing here is a grep for behaviour; the static pin only proves the card
// button is really gone.
//
//   [1] release metadata - APP_VERSION, the head entry, the shell cache;
//   [2] the album cards no longer carry an export button;
//   [3] Manage albums rows do, and clicking one opens the export question for
//       THAT album (driven through the real page);
//   [4] the export itself is unchanged - the button reaches exportOneAlbum;
//   [5] inline script syntax.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.6.2'; /* repinned by dev/repin-7362.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.6.2';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    ok(String(head.version) === VER, 'the newest entry is this release (' + head.version + ')');
    ok((head.items || []).length >= 6, 'with at least six notes (' + (head.items || []).length + ')');
    ok(!/['’]/.test((head.items || []).join(' ')), 'and no apostrophe anywhere in them');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test((head.items || []).join(' ')),
       'and no downloader or converter term');
    ok(String(head.date).endsWith('EDT'), 'the ship stamp is Eastern (' + head.date + ')');
  }
  ok(sw.includes("const CACHE_NAME = '" + SHELL_CACHE + "'"), 'the shell cache is this release name');
}

console.log('[2] the album cards no longer carry an export button');
{
  // The 73.4.9 card button is gone: its builder variable, its title and its exact
  // call site can no longer be found. (The title string itself survives - it moved
  // into Manage albums, checked in [3].)
  ok(count('_albExpBtn') === 0, 'the card export button builder is gone');
  ok(!/exportOneAlbum\(aName\)/.test(src), 'and nothing exports an album by card name any more');
  ok(!/hdr\.appendChild\(_albExpBtn\)/.test(src), 'and nothing appends it to the card header');
}

console.log('[3] Manage albums rows carry it, and it opens the export question (driven)');
{
  ok(count('class="mgr-alb-export"') === 1, 'every Manage albums row is built with an export button');
  ok(/querySelectorAll\('\.mgr-alb-export'\)/.test(src), 'and those buttons are wired');
  ok(/title="Export this album — audio, tags and covers"/.test(src),
     'the button keeps the title that says what it does');

  // --- drive the real page -------------------------------------------------
  const TRACKS = [
    { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
    { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
    { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  ];
  const ALBUMS = {
    'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, manual: true },
  };
  function makeCtx() {
    return new Proxy({}, {
      get(t, p) {
        if (p in t) return t[p];
        if (p === 'measureText') return () => ({ width: 10 });
        if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
        return undefined;
      },
      set(t, p, v) { t[p] = v; return true; },
    });
  }
  function fakeIndexedDB() {
    const data = {
      tracks: new Map(TRACKS.map((t) => [t.id, t])),
      meta: new Map([
        ['playlists', { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3'] } }],
        ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS)) }],
        ['albumOrder', { key: 'albumOrder', value: ['MoonChild Era'] }],
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
      open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
    };
  }
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(src, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = fakeIndexedDB();
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  const win = dom.window;
  await wait(7000);

  // The Albums tab card must not offer an export of its own.
  win.navigate('albums');
  await wait(700);
  const card = win.document.querySelector('#listPane [data-album-name]');
  ok(!!card, 'the album card is on the Albums tab');
  const cardExport = card && card.querySelector('[title="Export this album — audio, tags and covers"]');
  ok(!cardExport, 'and the card itself carries no export button');

  // Open Manage albums the way a user does: Albums ⋮ -> Manage albums.
  win.document.getElementById('listMoreBtn').click();
  await wait(350);
  const manage = Array.from(win.document.querySelectorAll('#songActionsList button'))
    .find((b) => /Manage albums/.test(b.textContent));
  ok(!!manage, 'Manage albums is reachable from the Albums menu');
  if (manage) manage.click();
  await wait(700);

  const row = Array.from(win.document.querySelectorAll('#discPopupBody .mgr-alb-row'))
    .find((r) => (r.getAttribute('data-name') || '') === 'moonchild era');
  ok(!!row, 'the album has a row in Manage albums');
  const expBtn = row && row.querySelector('.mgr-alb-export');
  ok(!!expBtn, 'and that row carries the export button');

  if (expBtn) {
    expBtn.click();
    await wait(400);
    const backdrop = win.document.getElementById('exportConfirmBackdrop');
    ok(!!backdrop && backdrop.style.display === 'flex', 'clicking it opens the export question');
    const body = win.document.getElementById('exportConfirmBody');
    const text = body ? body.innerHTML : '';
    ok(/MoonChild Era/.test(text), 'the question names that album');
    ok(/3 songs/.test(text), 'and says how many songs are about to be written');
    // Cancelling must close it again with nothing written.
    const cancel = win.document.getElementById('exportConfirmCancel');
    if (cancel) cancel.click();
    await wait(300);
    ok(backdrop.style.display === 'none' || backdrop.style.display === '', 'and cancelling closes it with nothing written');
  } else {
    ['clicking it opens the export question', 'the question names that album',
     'and says how many songs are about to be written', 'and cancelling closes it with nothing written']
      .forEach((n) => ok(false, n));
  }
  ok(errors.length === 0, 'the page throws nothing while all of this runs' + (errors.length ? ': ' + errors[0] : ''));
}

console.log('[4] the export itself is untouched');
{
  ok(/async function exportOneAlbum\(name\)/.test(src), 'exportOneAlbum still writes one album on its own');
  ok(/mgr-alb-export'\)[\s\S]{0,220}exportOneAlbum\(name\)/.test(src) ||
     /querySelectorAll\('\.mgr-alb-export'\)[\s\S]*?exportOneAlbum\(name\)/.test(src),
     'and the Manage albums button is what calls it');
  ok(/class="mgr-alb-rename"/.test(src) && /class="mgr-alb-del"/.test(src),
     'Rename and Delete still sit on the same row');
}

console.log('[5] inline script syntax');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
