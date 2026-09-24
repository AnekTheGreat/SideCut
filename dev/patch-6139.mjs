#!/usr/bin/env node
// v61.3.9 — "the pinned-artist drop check never finishes / doesn't work".
//
// What was wrong (all reproduced in headless Chromium before this patch):
//   [a] STALL. `checkPinnedArtistReleases` walked the pinned artists strictly
//       one after another, ~5 sequential network hops each. With 12+ pins and a
//       slow relay that is a minute of "Checking…" — the 35 s tap ceiling then
//       reset the BUTTON while the run kept going, so it looked unfinished.
//   [b] SILENT NO-OP. The ceiling did not cancel the run, so `active` stayed
//       true; every later tap hit `if(pinnedCheckState.active) return;` and
//       resolved in ~3 ms doing nothing at all.
//   [c] BLANK ON A BAD NETWORK. Each hop walked the whole 4-relay chain with an
//       8 s abort each, and the artist's own 8 s clock then dropped the artist
//       with zero results — a phone behind a restrictive network found nothing.
//   [d] SHARED CANCEL. `fetchWithProxy` bailed on `window.__ahCancelled` (the
//       Album History cancel switch), so cancelling an album fetch silently
//       blanked the release check.
//   [e] DUPLICATES. The MusicBrainz pass keyed entries `mbt:title|date`, which
//       is absent from `prevKeys`, so the same drop the Apple catalog had just
//       added was pushed a second time.
//   [f] NO VISIBLE PROGRESS. Results were persisted and painted only after the
//       last artist finished, so a working check looked like a dead button.
//
// What this does, with NO account, NO connection and NO verification anywhere:
//   [1] a 3-way worker pool over the pinned artists;
//   [2] incremental save + repaint per artist (and the open panel repainted in
//       place), so the list fills in while the rest are still being read;
//   [3] an in-flight run is SHARED — a second tap joins it instead of no-oping;
//   [4] `fetchWithProxy(url, { noCancel, budgetMs })`: the release path opts out
//       of the Album History cancel flag and caps each URL's relay walk;
//   [5] cross-source dedupe via a `freshTitles` set, so Apple + MusicBrainz
//       naming the same drop yields one row;
//   [6] the button reports real progress ("Checking… 4/12") and always restores.
//
// Run: node dev/patch-6139.mjs              # index.html + tests + manifests
//      node dev/patch-6139.mjs --manifest   # re-seed root manifest.json only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const VER = '61.3.9';
const PREV = '61.3.8';
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Release stamp: this sandbox runs UTC with no tzdata, so Eastern is UTC-4 (EDT).
function easternStamp(d) {
  const t = new Date(d.getTime() - 4 * 3600000);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h = t.getUTCHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (!h) h = 12;
  const mi = String(t.getUTCMinutes()).padStart(2, '0');
  return months[t.getUTCMonth()] + ' ' + t.getUTCDate() + ', ' + t.getUTCFullYear() + ' · ' + h + ':' + mi + ' ' + ap + ' EDT';
}
const STAMP = easternStamp(new Date());

const devDir = path.join(ROOT, 'dev');
let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
let pinned = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want = 1) {
  if (newStr !== '' && src.indexOf(newStr) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== want) throw new Error(label + ': expected ' + want + ' match(es), found ' + got);
  src = src.split(oldStr).join(newStr);
  done(label);
}

if (!MANIFEST_ONLY) {

// ---------------------------------------------------------------------------
// [4] fetchWithProxy gains a noCancel / time-budget option.
// ---------------------------------------------------------------------------
sub('fetchWithProxy — per-call cancel + relay time budget',
  `async function fetchWithProxy(url){
    // If Album History fetch was cancelled, abort immediately
    if(window.__ahCancelled) return null;
    const attempts = [
      (opts) => fetch(url, opts),
      (opts) => fetch('https://corsproxy.io/?' + encodeURIComponent(url), opts),
      (opts) => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), opts),
      (opts) => fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url), opts)
    ];
    for(const a of attempts){
      // Check cancel between each proxy attempt
      if(window.__ahCancelled) return null;
      try{
        const ctrl = new AbortController();
        const timer = setTimeout(function(){ ctrl.abort(); }, 8000);
        const resp = await a({ signal: ctrl.signal });
        clearTimeout(timer);
        if(resp.ok) return resp;
      }catch(e){}
    }
    return null;
  }`,
  `async function fetchWithProxy(url, fopts){
    fopts = fopts || {};
    // The release check is not Album History, so it opts out of that cancel
    // switch, and it gets its own time budget so one dead relay cannot eat the
    // whole run. Defaults preserve the old behaviour for every other caller.
    var _noCancel = !!fopts.noCancel;
    var _budget = (typeof fopts.budgetMs === 'number' && fopts.budgetMs > 0) ? fopts.budgetMs : 8000;
    var _deadline = Date.now() + _budget;
    // If Album History fetch was cancelled, abort immediately
    if(!_noCancel && window.__ahCancelled) return null;
    const attempts = [
      (opts) => fetch(url, opts),
      (opts) => fetch('https://corsproxy.io/?' + encodeURIComponent(url), opts),
      (opts) => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), opts),
      (opts) => fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url), opts)
    ];
    for(const a of attempts){
      // Check cancel between each proxy attempt
      if(!_noCancel && window.__ahCancelled) return null;
      const _left = _deadline - Date.now();
      if(_left <= 0) return null;   // budget spent — stop walking the relays
      try{
        const ctrl = new AbortController();
        const timer = setTimeout(function(){ ctrl.abort(); }, Math.max(800, Math.min(8000, _left)));
        const resp = await a({ signal: ctrl.signal });
        clearTimeout(timer);
        if(resp.ok) return resp;
      }catch(e){}
    }
    return null;
  }`);

// ---------------------------------------------------------------------------
// [4b] the release path's fetch options, defined beside the catalog reader.
// ---------------------------------------------------------------------------
sub('SC_RELEASE_FETCH — the release path opts out of the cancel flag',
  `  async function scItunesArtistAlbums(artist){`,
  `  // The release check reads public catalogs only: it opts out of the Album
  // History cancel flag and caps each URL so a dead relay cannot stall it.
  var SC_RELEASE_FETCH = { noCancel: true, budgetMs: 4000 };
  async function scItunesArtistAlbums(artist){`);

// ---------------------------------------------------------------------------
// [4c] the five catalog reads in the release path use it.
// ---------------------------------------------------------------------------
sub('release path / artist id search — budgeted, not cancel-coupled',
  `      var arUrl = 'https://itunes.apple.com/search?term=' + encodeURIComponent(artist) + '&media=music&entity=musicArtist&limit=5';
      var arResp = await fetchWithProxy(arUrl);`,
  `      var arUrl = 'https://itunes.apple.com/search?term=' + encodeURIComponent(artist) + '&media=music&entity=musicArtist&limit=5';
      var arResp = await fetchWithProxy(arUrl, SC_RELEASE_FETCH);`);

sub('release path / artist catalog by id — budgeted, not cancel-coupled',
  `      var lkUrl = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(artistId) + '&entity=album&limit=200';
      var lkResp = await fetchWithProxy(lkUrl);`,
  `      var lkUrl = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(artistId) + '&entity=album&limit=200';
      var lkResp = await fetchWithProxy(lkUrl, SC_RELEASE_FETCH);`);

sub('release path / song query — budgeted, not cancel-coupled',
  `      const url = \`https://itunes.apple.com/search?term=\${encodeURIComponent(artist)}&media=music&entity=song&limit=200\`;
      const resp = await fetchWithProxy(url);`,
  `      const url = \`https://itunes.apple.com/search?term=\${encodeURIComponent(artist)}&media=music&entity=song&limit=200\`;
      const resp = await fetchWithProxy(url, SC_RELEASE_FETCH);`);

sub('release path / album query — budgeted, not cancel-coupled',
  `        const aUrl = \`https://itunes.apple.com/search?term=\${encodeURIComponent(artist)}&media=music&entity=album&limit=200\`;
        const aResp = await fetchWithProxy(aUrl);`,
  `        const aUrl = \`https://itunes.apple.com/search?term=\${encodeURIComponent(artist)}&media=music&entity=album&limit=200\`;
        const aResp = await fetchWithProxy(aUrl, SC_RELEASE_FETCH);`);

sub('release path / MusicBrainz search — budgeted, not cancel-coupled',
  `      var url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
      var rs = await fetchWithProxy(url);`,
  `      var url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
      var rs = await fetchWithProxy(url, SC_RELEASE_FETCH);`);

// ---------------------------------------------------------------------------
// [5] cross-source dedupe: one row per title+day, whichever source named it.
// ---------------------------------------------------------------------------
sub('freshTitles — songs recorded so a second source cannot repeat them',
  `      const fresh = [];
      results.forEach(r => {
        const key = (r.trackName||'').toLowerCase().trim() + '|' + (r.releaseDate||'').slice(0,10);
        if(!prevKeys.has(key)){`,
  `      const fresh = [];
      // Title+day of everything this run has already listed (any source), so
      // Apple and MusicBrainz naming the same drop yields one row, not two.
      const freshTitles = new Set();
      results.forEach(r => {
        const key = (r.trackName||'').toLowerCase().trim() + '|' + (r.releaseDate||'').slice(0,10);
        if(!prevKeys.has(key) && !freshTitles.has(key)){`);

sub('freshTitles — a listed song is recorded',
  `          fresh.push({
            title: r.trackName,
            date: (r.releaseDate||'').slice(0,10),
            art: r.artworkUrl100 ? r.artworkUrl100.replace('/100x100bb.jpg','/200x200bb.jpg') : null,
            url: r.trackViewUrl || null,
            previewUrl: r.previewUrl || null,
            seen: false,
          });`,
  `          fresh.push({
            title: r.trackName,
            date: (r.releaseDate||'').slice(0,10),
            art: r.artworkUrl100 ? r.artworkUrl100.replace('/100x100bb.jpg','/200x200bb.jpg') : null,
            url: r.trackViewUrl || null,
            previewUrl: r.previewUrl || null,
            seen: false,
          });
          freshTitles.add(key);`);

sub('freshTitles — a listed album is recorded',
  `            const keyA = 'alb:' + (r.collectionName || '').toLowerCase().trim() + '|' + albDate;
            if(prevKeys.has(keyA)) return;
            fresh.push({
              title: r.collectionName,
              date: albDate,
              art: r.artworkUrl100 ? r.artworkUrl100.replace('/100x100bb.jpg','/600x600bb.jpg') : null,
              url: r.collectionViewUrl || null,
              previewUrl: null,
              kind: 'album',
              cid: r.collectionId || null,
              seen: false
            });`,
  `            const keyA = 'alb:' + (r.collectionName || '').toLowerCase().trim() + '|' + albDate;
            if(prevKeys.has(keyA)) return;
            fresh.push({
              title: r.collectionName,
              date: albDate,
              art: r.artworkUrl100 ? r.artworkUrl100.replace('/100x100bb.jpg','/600x600bb.jpg') : null,
              url: r.collectionViewUrl || null,
              previewUrl: null,
              kind: 'album',
              cid: r.collectionId || null,
              seen: false
            });
            freshTitles.add((r.collectionName || '').toLowerCase().trim() + '|' + albDate);`);

sub('freshTitles — the MusicBrainz pass respects it too',
  `          var k = 'mbt:' + nt + '|' + x.date;
          if(prevKeys.has(k)) return;`,
  `          var k = 'mbt:' + nt + '|' + x.date;
          if(prevKeys.has(k)) return;
          if(freshTitles.has(nt + '|' + x.date)) return;   // Apple already listed this drop`);

// ---------------------------------------------------------------------------
// [1][2][3] the check itself: a worker pool, incremental saves, a shared run.
// ---------------------------------------------------------------------------
sub('checkPinnedArtistReleases — pool, incremental persist, shared in-flight run',
  `  async function checkPinnedArtistReleases(){
    if(pinnedCheckState.active) return;
    if(!pinnedArtists.length) return;
    if(typeof navigator !== 'undefined' && navigator.onLine === false) return;
    pinnedCheckState = { active:true, total:pinnedArtists.length, done:0, newCount:0, finishedAt:0, seen:false };
    try{
    renderHomeExportPopup();
    let totalNew = 0;
    for(const a of pinnedArtists){
      // Clock every artist: a stalled, offline or rate-limited catalog reply
      // moves the check on instead of parking it half-finished.
      const fresh = await Promise.race([
        fetchArtistReleases(a.name),
        new Promise(function(res){ setTimeout(function(){ res(null); }, 8000); })   // 8s per artist
      ]).catch(function(){ return null; });                                        // never wedges the run
      totalNew += (fresh ? fresh.length : 0);
      pinnedCheckState.done++;
      renderHomeExportPopup();
    }
    }finally{
      pinnedCheckState.active = false;
    }
    pinnedCheckState.finishedAt = Date.now();
    pinnedCheckState.newCount = totalNew;
    savePinnedArtists();
    renderNewReleases();
    if(totalNew > 0){
      renderHome(); // Updates the new releases bubble count
    }
    renderHomeExportPopup();
    updateNotifBadge();
  }`,
  `  // A running check is shared, never re-entered: a second tap awaits the run
  // already in progress instead of resolving instantly and doing nothing.
  let pinnedCheckPromise = null;
  async function checkPinnedArtistReleases(){
    if(pinnedCheckPromise) return pinnedCheckPromise;
    if(!pinnedArtists.length) return;
    if(typeof navigator !== 'undefined' && navigator.onLine === false) return;
    pinnedCheckPromise = (async function(){
    pinnedCheckState = { active:true, total:pinnedArtists.length, done:0, newCount:0, finishedAt:0, seen:false };
    let totalNew = 0;
    try{
    renderHomeExportPopup();
    // A few artists at a time: the catalogs are independent, so one stalled
    // host can no longer hold the whole list behind it, and a big pin list
    // finishes in a fraction of the serial time.
    const _queue = pinnedArtists.slice();
    const _worker = async function(){
      while(_queue.length){
        const a = _queue.shift();
        if(!a) continue;
        // Clock every artist: a stalled, offline or rate-limited catalog reply
        // moves the check on instead of parking it half-finished.
        const fresh = await Promise.race([
          fetchArtistReleases(a.name),
          new Promise(function(res){ setTimeout(function(){ res(null); }, 8000); })   // 8s per artist
        ]).catch(function(){ return null; });                                        // never wedges the run
        totalNew += (fresh ? fresh.length : 0);
        pinnedCheckState.done++;
        // Persist and repaint as each artist lands, so the list fills in while
        // the rest are still being read instead of appearing all at once —
        // and a partly-finished run still keeps what it found.
        try{ const _sp = savePinnedArtists(); if(_sp && _sp.catch) _sp.catch(function(){}); }catch(_eSv){}
        try{ renderNewReleases(); }catch(_eRn){}
        try{ scRepaintOpenReleasePanel(); }catch(_eRp){}
        renderHomeExportPopup();
      }
    };
    const _pool = [];
    for(let _wi = 0; _wi < 3; _wi++) _pool.push(_worker());
    await Promise.all(_pool);
    }finally{
      pinnedCheckState.active = false;
    }
    pinnedCheckState.finishedAt = Date.now();
    pinnedCheckState.newCount = totalNew;
    try{ await savePinnedArtists(); }catch(_eSv2){}
    renderNewReleases();
    if(totalNew > 0){
      renderHome(); // Updates the new releases bubble count
    }
    renderHomeExportPopup();
    updateNotifBadge();
    })();
    try{ return await pinnedCheckPromise; }
    finally{ pinnedCheckPromise = null; }
  }`);

// ---------------------------------------------------------------------------
// [6] the button shows real progress and always puts itself back.
// ---------------------------------------------------------------------------
sub('release-check tap — live progress, never parks',
  `  window.__scUpcomingConnectTap = async function(btn){
    try{ if(btn){ btn.textContent = 'Checking\\u2026'; btn.disabled = true; } }catch(_eB0){}
    try{
      await Promise.race([
        window.__scRebuildReleaseLists(true),
        new Promise(function(res){ setTimeout(res, 35000); })   // cannot park the button
      ]);
    }catch(_eChk){ toast('The release check could not finish \\u2014 try again.', 3600); }
    try{ if(btn){ btn.textContent = 'Check for drops'; btn.disabled = false; } }catch(_eB1){}
  };`,
  `  window.__scUpcomingConnectTap = async function(btn){
    try{ if(btn){ btn.textContent = 'Checking\\u2026'; btn.disabled = true; } }catch(_eB0){}
    // Show the run's real progress on the button that was tapped.
    let _tick = null;
    try{
      _tick = setInterval(function(){
        try{
          if(!btn || !pinnedCheckState || !pinnedCheckState.active) return;
          btn.textContent = 'Checking\\u2026 ' + pinnedCheckState.done + '/' + pinnedCheckState.total;
        }catch(_eTk){}
      }, 900);
    }catch(_eT0){}
    try{
      await Promise.race([
        window.__scRebuildReleaseLists(true),
        new Promise(function(res){ setTimeout(res, 60000); })   // last resort — the run clears itself
      ]);
    }catch(_eChk){ toast('The release check could not finish \\u2014 try again.', 3600); }
    finally{ try{ if(_tick) clearInterval(_tick); }catch(_eTc){} }
    try{ if(btn){ btn.textContent = 'Check for drops'; btn.disabled = false; } }catch(_eB1){}
  };`);

// ---------------------------------------------------------------------------
// [7] version + changelog head
// ---------------------------------------------------------------------------
sub('APP_VERSION -> ' + VER,
  `  const APP_VERSION = '${PREV}';`,
  `  const APP_VERSION = '${VER}';`);

const NOTES = [
  'The drop check reads your pinned artists a few at a time instead of one after another, so a longer list finishes in a fraction of the time it used to.',
  'Every artist\u2019s finds are saved and shown the moment they land \u2014 the list fills in while the rest are still being read, instead of everything appearing only at the very end.',
  'The button reports the run\u2019s real progress (Checking\u2026 4/12) and always puts itself back; tapping it again while a check is running joins the run already under way instead of quietly doing nothing.',
  'A slow or unreachable lookup can no longer stall the whole check: every artist is clocked, the fallback relays are time-budgeted, and the run always settles and clears.',
  'The check no longer shares a switch with Album History cancellation, so cancelling an album fetch can no longer silently blank your upcoming releases.',
  'Nothing about the sources changed \u2014 still the artist\u2019s own open catalog and MusicBrainz, with no account to connect and nothing to verify.',
];

// The changelog head is stamped with the run time, so the generic idempotence
// check (exact newStr present) can never match on a re-run — guard on the
// version marker instead.
if (src.includes(`const CHANGELOG = [\n  { version: '${VER}'`)) {
  skip('changelog head entry');
} else {
  sub('changelog head entry',
    `  const CHANGELOG = [
  { version: '${PREV}', date: `,
    `  const CHANGELOG = [
  { version: '${VER}', date: '${STAMP}', title: 'The drop check finishes, and fills in as it goes', items: [
${NOTES.map((n) => `    '${n}',`).join('\n')}
  ] },
  { version: '${PREV}', date: `);
}

fs.writeFileSync(FILE, src);
console.log('• index.html written — ' + edits + ' edit(s)');

// ------------------------------------------------------------- sw.js cache
{
  const p = path.join(ROOT, 'sw.js');
  const w = fs.readFileSync(p, 'utf8');
  const next = w.replace(/const CACHE_NAME = 'sidecut-shell-v[^']+';/, `const CACHE_NAME = 'sidecut-shell-v${VER}';`);
  if (next !== w) { fs.writeFileSync(p, next); console.log('• sw.js cache → sidecut-shell-v' + VER); }
  else skip('sw.js cache is already sidecut-shell-v' + VER);
}

// --------------------------------------------------------------- test pins
// test-6139 is authored AT the new version and must not be touched by the
// blanket repin — its own "heads the changelog" anchor names the previous
// release on purpose.
for (const f of fs.readdirSync(devDir)) {
  if (!/^test-.*\.mjs$/.test(f) || f === 'test-6139.mjs') continue;
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ver === '${PREV}'`).join(`ver === '${VER}'`)
    .split(`sidecut-shell-v${PREV}`).join(`sidecut-shell-v${VER}`)
    .split(`"version: '${PREV}'"`).join(`"version: '${VER}'"`)
    .split(`CHANGELOG head entry is ${PREV}`).join(`CHANGELOG head entry is ${VER}`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); pinned++; console.log('• repinned dev/' + f); }
}
const stale = fs.readdirSync(devDir)
  .filter((f) => /^test-.*\.mjs$/.test(f) && f !== 'test-6139.mjs')
  .filter((f) => fs.readFileSync(path.join(devDir, f), 'utf8').includes(`ver === '${PREV}'`));
if (stale.length) throw new Error('test files still pinned to ' + PREV + ': ' + stale.join(', '));

// test-6137 and test-6138 anchor the newest CHANGELOG entry inside a regex
// literal — the generic repin above can't reach it (the dots are escaped).
for (const f of ['test-6137.mjs', 'test-6138.mjs']) {
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0.replace(
    /ok\(\/const CHANGELOG = \\\[\\n  \\\{ version: '61\\\.3\\\.8'\/\.test\(src\)/,
    `ok(/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.9'/.test(src)`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); console.log('• dev/' + f + ' changelog-head regex → ' + VER); }
  else skip('dev/' + f + ' changelog-head regex');
}

// test-6137 pinned the old 35 s tap ceiling; the ceiling is now a 60 s last
// resort (the run clears itself, so a hard ceiling should never be hit).
{
  const p = path.join(devDir, 'test-6137.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ok(tap && tap.includes('setTimeout(res, 35000)'), '35 s ceiling — the button cannot sit there');`)
    .join(`ok(tap && tap.includes('setTimeout(res, 60000)'), '60 s last resort — the run clears itself first');`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); console.log('• dev/test-6137.mjs tap ceiling → 60 s'); }
  else skip('dev/test-6137.mjs tap ceiling');
}

// test-6136 pinned the MusicBrainz call without the new options argument.
{
  const p = path.join(devDir, 'test-6136.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ok(mb && mb.includes('await fetchWithProxy(url)'), 'goes through the shared proxy fetch');`)
    .join(`ok(mb && mb.includes('await fetchWithProxy(url, SC_RELEASE_FETCH)'), 'goes through the shared proxy fetch, budgeted');`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); console.log('• dev/test-6136.mjs MB fetch needle updated'); }
  else skip('dev/test-6136.mjs MB fetch needle');
}

} else {
  console.log('= manifest-only run — index.html untouched');
}

// ------------------------------------------------- changelog head (read back)
function changelogHead() {
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (!block) throw new Error('could not read the CHANGELOG block');
  const entries = eval('[' + block[1] + ']');
  const e = entries.find((x) => String(x.version) === VER);
  if (!e) throw new Error('no ' + VER + ' changelog entry found');
  return e;
}
const head = changelogHead();

{
  const p = path.join(devDir, 'test-6052.mjs');
  const t = fs.readFileSync(p, 'utf8');
  const re = /ok\(entries\[0\]\.date === '[^']*', 'ship date correct \(' \+ entries\[0\]\.date \+ '\)'\);/;
  const m = t.match(re);
  if (!m) throw new Error('test-6052.mjs: date pin not found');
  if (m[0].indexOf(head.date) === -1) {
    fs.writeFileSync(p, t.replace(re, `ok(entries[0].date === '${head.date}', 'ship date correct (' + entries[0].date + ')');`));
    console.log('• dev/test-6052.mjs ship date → ' + head.date);
  } else {
    skip('dev/test-6052.mjs ship date is ' + head.date);
  }
}

// ------------------------------------------------------ root manifest.json
{
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  const notes = (head.items || [])
    .map((it) => (typeof it === 'string' && it.indexOf('[FULL] ') === 0) ? it.slice(7) : it)
    .slice(0, 6);
  const man = { version: VER, url: 'update.zip', size: upd.size, notes, date: String(head.date || '') };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  console.log('• root manifest.json → ' + VER + ' · ' + upd.size + ' bytes · ' + notes.length + ' notes');
}

console.log('patch-6139: ' + edits + ' index.html edit(s), ' + pinned + ' test file(s) repinned');
console.log('stamp: ' + STAMP);
