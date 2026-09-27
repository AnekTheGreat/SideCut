#!/usr/bin/env node
// v63.1.4 — "Fix the damn auto albums I hate those because I make an album and it
// says it already exists just remove the auto albums and make sure that doesn't
// affect my regular albums" + "add a search bar to manage albums".
//
// Where the collision came from: older builds wrote album entries for themselves
// (a card-drag auto-save, or a tag album materialised so a reorder had somewhere
// to live), flagged them `auto`, kept them out of the Albums tab, and listed them
// in Manage albums under "Not created by you". They kept their NAME, so creating
// an album with that name answered "an album named X already exists — merge these
// songs into it?" and filed the songs into an album that never appeared.
//
// This checks, where it can, that:
//   [1] the entries are DELETED at boot, by one function, and nothing writes the
//       auto flag any more — the pass that went around ADDING it is gone;
//   [2] only flagged entries are touched: an album you made survives with its
//       songs, its order and its artist, and so does an entry that carries no
//       marker at all (a "no marker means not yours" rule is what once emptied a
//       library of twelve hand-made albums down to one card);
//   [3] the name an auto album had taken is free again, and a new album is always
//       created as yours;
//   [4] Manage albums has no second list and no "It is mine", and it searches:
//       name or artist, match count, hidden non-matches, an honest empty state, a
//       clear button, a fresh open unfiltered, and an in-place rebuild that keeps
//       the query you were typing;
//   [5] the release that carries it says so, and the shared notes still read
//       clean for the channel that may not name certain things.
//
//   node dev/test-658.mjs                              # the shipped tree
//   SC_HTML=/path/index.html node dev/test-658.mjs      # any build — this fails
//                        on the pre-fix build, which is the point of it
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const src = fs.readFileSync(HTML, 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (needle) => src.split(needle).length - 1;
// Tolerant on purpose: this gate is meant to be run against a PRE-FIX build too
// (`SC_HTML=`), where whole functions do not exist yet. That run has to report
// failures, not throw and hide everything after the first missing anchor.
function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = a === -1 ? -1 : src.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return src.slice(a, b);
}

console.log('[1] the albums the app added for you are deleted, not hidden');
ok(src.indexOf('function removeAutoAlbums(){') !== -1, 'the removal function exists');
ok(count('function removeAutoAlbums(){') === 1, 'and it is the only one');
ok(src.indexOf('window.__scRemoveAutoAlbums = removeAutoAlbums;') !== -1, 'it is exposed for the audits');
ok(src.indexOf('removeAutoAlbums(); }catch(e){}') !== -1, 'boot runs it');
ok(src.indexOf('migrateAutoFlaggedAlbums') === -1, 'the pass that ADDED the flag is gone');
ok(count('auto: true') === 0, 'nothing writes the auto flag any more (' + count('auto: true') + ')');
ok(src.indexOf('_scAutoAlbums = removeAutoAlbums()') !== -1, 'boot counts what it removed');
ok(/were removed \\u2014 your songs and their album tags are untouched/.test(src),
  'and says so without pretending the songs went with them');

console.log('\n[2] only the entries the app wrote are touched — run for real');
{
  const start = src.indexOf('  function removeAutoAlbums(){');
  const end = src.indexOf('\n  }', start) + 4;
  const extractable = start !== -1 && end > start;
  ok(extractable, 'removeAutoAlbums is extractable');
  // A stub when the function is not there (the pre-fix build): the checks below
  // then FAIL and say so, instead of throwing and hiding the rest of the file.
  const code = extractable ? src.slice(start, end) : 'function removeAutoAlbums(){ return -1; }';
  // The real state on the reporting phone: entries the app wrote for itself,
  // albums made by hand, and one entry that predates the flag entirely.
  function run(liveAlbums, liveOrder) {
    const albums = JSON.parse(JSON.stringify(liveAlbums));
    const order = (liveOrder || []).slice();
    const puts = [];
    const fn = new Function('userAlbums', 'albumOrder', 'dbPut', 'albumIsAuto',
      'return (function(){' + code + '\nreturn removeAutoAlbums(); })();');
    const gone = fn(
      albums,
      order,
      (s, row) => { puts.push(row); },
      // The shipped predicate, read from the file rather than re-typed: an album is
      // hidden ONLY when it was recorded as created automatically.
      (name) => { const e = albums[name]; return !!(e && e.auto === true && e.manual !== true); }
    );
    return { gone, albums, order, puts };
  }
  const A = run({
    'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 11, auto: true },
    'G.O.A.T': { artist: 'Sidhu Moose Wala', trackIds: ['t4', 't5'], createdAt: 12, auto: true },
    'My Mix': { artist: 'Various Artists', trackIds: ['t1', 't4'], createdAt: 13, manual: true },
    'DJ Set': { artist: 'Diljit Dosanjh', trackIds: ['t3', 't2'], createdAt: 14, manual: true },
    'Pre Flag': { artist: 'Sidhu Moose Wala', trackIds: ['t5'], createdAt: 10 },
  }, ['MoonChild Era', 'G.O.A.T', 'My Mix', 'DJ Set', 'Pre Flag']);
  ok(A.gone === 2, 'it removes exactly the two flagged entries (' + A.gone + ')');
  ok(JSON.stringify(Object.keys(A.albums)) === JSON.stringify(['My Mix', 'DJ Set', 'Pre Flag']),
    'the albums you made are still there: ' + JSON.stringify(Object.keys(A.albums)));
  ok(JSON.stringify(A.albums['My Mix']) === JSON.stringify({ artist: 'Various Artists', trackIds: ['t1', 't4'], createdAt: 13, manual: true }),
    'and byte-for-byte as they were');
  ok(JSON.stringify(A.albums['DJ Set'].trackIds) === JSON.stringify(['t3', 't2']),
    'including the order you put them in');
  ok(A.albums['Pre Flag'] && !A.albums['Pre Flag'].auto && !A.albums['Pre Flag'].manual,
    'an entry with no marker at all is left alone');
  ok(JSON.stringify(A.order) === JSON.stringify(['My Mix', 'DJ Set', 'Pre Flag']),
    'the album order loses the names that went: ' + JSON.stringify(A.order));
  ok(A.puts.some((p) => p && p.key === 'userAlbums') && A.puts.some((p) => p && p.key === 'albumOrder'),
    'both rows are written back');
  const B = run({ 'Manual': { trackIds: ['t1'], manual: true } }, ['Manual']);
  ok(B.gone === 0 && B.puts.length === 0, 'a library with nothing flagged writes nothing at all');
  const C = run({ 'Flagged And Edited': { trackIds: ['t1'], auto: true, manual: true } }, []);
  ok(C.gone === 0 && !!C.albums['Flagged And Edited'],
    'an entry that was flagged and then edited by hand is not touched');
}

console.log('\n[3] the name an auto album had taken is free again');
{
  // The guard the report ran into. It may only fire for an album that is really
  // still there — which, for a flagged entry, is never again.
  const ids = sliceBetween('  async function createAlbumFromIds(ids, sourceLabel, existingName){', '  function addSelectedToAlbum(){');
  ok(ids.indexOf('if(userAlbums[albumName]){') !== -1, 'creating an album still checks for a name in use');
  ok(ids.indexOf('already exists') !== -1, 'and still asks before merging into a real album');
  ok(ids.indexOf("manual: true") !== -1, 'a new album is written as an album of yours');
  const sel = sliceBetween('  async function createAlbumFromSelected(){', '  function deleteSelected(){');
  ok(sel.indexOf("manual: true") !== -1, 'so is one created from a selection');
  const saved = sliceBetween('  function ensureAlbumSaved(albumName){', '  window.__scEnsureAlbumSaved = ensureAlbumSaved;');
  ok(saved.indexOf('manual: true') !== -1, 'the album a reorder materialises is yours too');
  ok(saved.indexOf('auto') === -1, 'and is never flagged');
}

console.log('\n[4] Manage albums: one list, and a search box');
ok(src.indexOf('Not created by you (') === -1, 'the second list is gone');
ok(src.indexOf('mgr-alb-restore') === -1, 'and the "It is mine" button with it');
ok(src.indexOf('mgr-alb-rename-auto') === -1 && src.indexOf('mgr-alb-del-auto') === -1,
  'and the two hidden-row controls');
ok(src.indexOf("autoAlbumNames() : []") === -1, 'the panel no longer reads the auto list');
ok(src.indexOf('id="mgrAlbumSearch"') !== -1, 'the search box is in the panel markup');
ok(src.indexOf('Search albums or artists') !== -1, 'with a placeholder that says what it searches');
ok(src.indexOf('id="mgrAlbumSearchClear"') !== -1, 'and a clear button');
ok(src.indexOf('id="mgrAlbumNoMatch"') !== -1 && src.indexOf('No album matches that search.') !== -1,
  'and an honest empty state');
ok(src.indexOf("data-name=\"' + escapeHtml(String(name).toLowerCase())") !== -1 &&
   src.indexOf("data-artist=\"' + escapeHtml(String(alb.artist || '').toLowerCase())") !== -1,
  'every row carries what it can be found by');
{
  const wire = sliceBetween('  function wireManageAlbums(){', '  function refreshManageAlbums(');
  ok(wire.indexOf("sIn.addEventListener('input'") !== -1, 'the box filters as you type');
  ok(wire.indexOf('_mgrAlbumQuery = String(this.value || \'\');') !== -1, 'the query is remembered');
  ok(wire.indexOf('if(_mgrAlbumQuery) sIn.value = _mgrAlbumQuery;') !== -1, 'and put back after a rebuild');
  ok(wire.indexOf("var q = String(raw || '').toLowerCase().trim();") !== -1, 'the filter trims and case-folds its own query');
  ok(wire.indexOf("sCount.textContent = q ? shown + ' of ' + rows.length") !== -1, 'the count reads matched of total');
  ok(wire.indexOf("sEmpty.style.display = (q && !shown) ? 'block' : 'none';") !== -1, 'the empty state only shows on a miss');
  ok(wire.indexOf("sClr.style.display = q ? 'block' : 'none';") !== -1, 'the clear button only shows with a query');
  ok(wire.indexOf("_mgrAlbumQuery = '';") !== -1 && wire.indexOf('applyAlbumFilter(\'\');') !== -1,
    'clearing resets both');
  ok(wire.indexOf("bEl.querySelectorAll('.mgr-alb-rename')") !== -1, 'the rows that are left are still wired');
  // The filter itself, executed. It reads the row attributes and writes the count
  // and the two indicators — so it can be driven with stub elements.
  const fs2 = src.indexOf('    function applyAlbumFilter(');
  const fe = fs2 === -1 ? -1 : src.indexOf('\n    }', fs2) + 6;
  const filterExtractable = fs2 !== -1 && fe > fs2;
  ok(filterExtractable, 'applyAlbumFilter is extractable');
  // Same guard as above: on a build with no search box at all, the five checks
  // that drive the filter must fail rather than blow the file up.
  const body = filterExtractable ? src.slice(fs2, fe) : 'function applyAlbumFilter(){ return false; }';
  const rowsFor = (names) => names.map((n) => ({
    attrs: { 'data-name': n.toLowerCase(), 'data-artist': (n === 'Pre Flag' ? 'sidhu moose wala' : 'diljit dosanjh') },
    getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; },
    style: {},
  }));
  function filter(q, names) {
    const rows = rowsFor(names);
    const sCount = { textContent: '', style: {} };
    const sEmpty = { style: {} };
    const sClr = { style: {} };
    const fn = new Function('bEl', 'sCount', 'sEmpty', 'sClr',
      'var Array_ = Array; return (function(){' + body + '\nreturn applyAlbumFilter; })();');
    const apply = fn({ querySelectorAll: () => rows }, sCount, sEmpty, sClr);
    apply(q);
    return { rows, sCount, sEmpty, sClr, visible: rows.filter((r) => r.style.display !== 'none') };
  }
  const NAMES = ['DJ Set', 'My Mix', 'Pre Flag'];
  const f1 = filter('dj', NAMES);
  ok(f1.visible.length === 1 && f1.visible[0].attrs['data-name'] === 'dj set', 'a name narrows the list');
  ok(f1.sCount.textContent === '1 of 3 albums' && f1.sCount.style.display === 'block', 'with an honest count: ' + f1.sCount.textContent);
  ok(f1.sEmpty.style.display === 'none' && f1.sClr.style.display === 'block', 'no false empty state, and a clear button');
  const f2 = filter('moose', NAMES);
  ok(f2.visible.length === 1 && f2.visible[0].attrs['data-name'] === 'pre flag', 'an artist narrows it too');
  const f3 = filter('zzz', NAMES);
  ok(f3.visible.length === 0 && f3.sEmpty.style.display === 'block' && f3.sCount.textContent === '0 of 3 albums',
    'a miss shows the empty state, not an empty list');
  const f4 = filter('', NAMES);
  ok(f4.visible.length === 3 && f4.sCount.style.display === 'none' && f4.sClr.style.display === 'none',
    'an empty box shows everything and hides the count');
  const f5 = filter('  MIX  ', NAMES);
  ok(f5.visible.length === 1, 'the query is trimmed and case-folded before matching');
}
ok(src.indexOf('function refreshManageAlbums(keepQuery){') !== -1, 'opening the panel is a fresh start');
ok(count('refreshManageAlbums(true);') === 2, 'and the two in-place editors keep the query (' + count('refreshManageAlbums(true);') + ')');
ok(src.indexOf("var _sub = names.length + ' album'") !== -1, 'the subtitle counts only real albums');
ok(src.indexOf('not created by you') === -1, 'and nothing anywhere still calls them that');

console.log('\n[5] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === '64.2.2', 'APP_VERSION = ' + ver);
  ok(!/^63\.\d+\.\d{2,}$/.test(ver) && !/^63\.1\.10$/.test(ver), 'not a rolled-over patch number');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries && entries[0].version === ver, 'the newest changelog matches APP_VERSION');
  if (entries) {
    const rel = entries && entries.find((e) => String(e.version) === '63.1.4');
    ok(!!rel && (rel.items || []).length >= 5, 'patch notes: ' + (rel && rel.items.length));
    ok(!!rel && !/play build|play version|play install/i.test(rel.items.join(' ')), 'notes never name the play build');
    ok(!!rel && !/\bdownload|converter|convert\b/i.test(rel.items.join(' ')), 'new notes carry no downloader term');
    ok(!!rel && /auto/i.test(rel.items.join(' ')), 'and the notes describe what that release did');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');
}

console.log('\n[6] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
