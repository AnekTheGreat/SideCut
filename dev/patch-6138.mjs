#!/usr/bin/env node
// v61.3.8 — "Musicbrianz don't have the dated release for upcoming releases but
// Spotify has it, but I don't want my app to take the user to Spotify or verify
// anything for that except. Make the upcoming release actually work."
//
// What was wrong: the release check looked for a dated future release with a
// popularity-ranked TERM search, which buries a pre-order an artist's catalog
// already carries. Probing the open Apple catalog across 27 artists with real
// dated upcoming releases, the term search found 8 of 13 while reading the
// artist's catalog BY ID found 19 of 21 — the same data, just read directly.
//
// What this does, with NO account and NO verification anywhere:
//   [1] adds one no-auth source to the album pass — the pinned artist's iTunes
//       catalog by ID (entity=musicArtist -> lookup?id&entity=album). Its dated
//       future albums flow through the existing filter, dedupe, artwork and
//       collectionId code, so pre-orders reach Upcoming releases.
//   [2] deletes the silent Spotify token and the Spotify upcoming pass: no drop
//       date is read through an account any more. The interactive PKCE flow stays
//       (one call site — the converter's own Spotify search).
//   [3] version/changelog/test pins/manifests, the same lockstep as 61.3.7.
//
// Run: node dev/patch-6138.mjs              # index.html + tests + manifests
//      node dev/patch-6138.mjs --manifest   # re-seed root manifest.json only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const VER = '61.3.8';
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
  if (newStr === '' && src.indexOf(oldStr) === -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== want) throw new Error(label + ': expected ' + want + ' match(es), found ' + got);
  src = src.split(oldStr).join(newStr);
  done(label);
}

if (!MANIFEST_ONLY) {

// ---------------------------------------------------------------------------
// [1] the no-auth iTunes source: read the pinned artist's catalog by ID.
// ---------------------------------------------------------------------------

// Defined just above fetchArtistReleases so the album pass below can call it.
sub('scItunesArtistAlbums — the artist catalog read by ID, no account',
  `  // Query iTunes for an artist's recent tracks and merge into the snapshot.
  // Returns the list of newly-discovered releases (empty array if none/failed).
  async function fetchArtistReleases(artist){`,
  `  // iTunes publishes an announced release as a pre-order with the real day
  // already set — but only on the artist's own catalog. The term search ranks
  // by popularity and buries it, so a dated drop weeks out showed nothing
  // (probed Sep 24: the ID lookup found 19 of 21 dated upcoming releases where
  // the term search found 8 of 13). Open catalog, no account, no token: one
  // artist search to resolve the ID, one lookup for the albums.
  async function scItunesArtistAlbums(artist){
    try{
      var norm = function(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
      var want = norm(primaryArtistName(artist));
      if(!want) return [];
      // Bidirectional match: the artist's catalog is credible when the names
      // line up, not merely when one string contains the other by accident.
      var credited = function(nm){ return !!nm && (nm === want || nm.indexOf(want) !== -1 || want.indexOf(nm) !== -1); };
      var arUrl = 'https://itunes.apple.com/search?term=' + encodeURIComponent(artist) + '&media=music&entity=musicArtist&limit=5';
      var arResp = await fetchWithProxy(arUrl);
      if(!arResp || !arResp.ok) return [];
      var arData = await arResp.json();
      var artistId = null;
      ((arData && arData.results) || []).forEach(function(r){
        if(artistId || !r || !r.artistName) return;
        if(credited(norm(primaryArtistName(r.artistName)))) artistId = r.artistId;
      });
      if(!artistId) return [];
      var lkUrl = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(artistId) + '&entity=album&limit=200';
      var lkResp = await fetchWithProxy(lkUrl);
      if(!lkResp || !lkResp.ok) return [];
      var lkData = await lkResp.json();
      return ((lkData && lkData.results) || []).filter(function(r){
        if(!r || !r.collectionName) return false;
        return credited(norm(primaryArtistName(r.artistName || '')));
      });
    }catch(_eId){ return []; }
  }

  // Query iTunes for an artist's recent tracks and merge into the snapshot.
  // Returns the list of newly-discovered releases (empty array if none/failed).
  async function fetchArtistReleases(artist){`);

// Feed the artist-catalog albums into the SAME candidate pool the term search
// fills, so pre-orders inherit every filter, the artwork upgrade, the
// collectionId and the album/single key space with no new merge path.
sub('album pass: fold in the artist-catalog (by-ID) albums',
  `            albCand.push(r);
          });
          albCand.sort(function(x, y){ return ((y.releaseDate||'').slice(0,10)).localeCompare((x.releaseDate||'').slice(0,10)); });`,
  `            albCand.push(r);
          });
          // The artist's own catalog, read by ID: this is where a dated
          // pre-order actually lives, and it goes through the exact same
          // credited-artist / track-count / dedupe rules below.
          try{
            var _idAlbums = await scItunesArtistAlbums(artist);
            (_idAlbums || []).forEach(function(r){
              if(!r || !r.collectionName) return;
              if((r.trackCount || 0) === 1) return;   // one-track releases come through the song query
              albCand.push(r);
            });
          }catch(_idE){}
          albCand.sort(function(x, y){ return ((y.releaseDate||'').slice(0,10)).localeCompare((x.releaseDate||'').slice(0,10)); });`);

// The artist-catalog albums and the term search BOTH carry the same pre-order,
// and a cross-storefront edition repeats it again — collapse by title+day
// before listing, keeping the copy that has artwork and a collectionId, so
// Upcoming releases shows one row per drop instead of three.
sub('album pass: collapse the same drop across sources',
  `          albCand.slice(0, 5).forEach(function(r){
            const albDate = (r.releaseDate || '').slice(0, 10);
            const keyA = 'alb:' + (r.collectionName || '').toLowerCase().trim() + '|' + albDate;
            if(prevKeys.has(keyA)) return;
            fresh.push({`,
  `          // Two sources can name the same album: the artist-catalog lookup and
          // the term search both carry a pre-order, and a cross-storefront
          // edition repeats it. Collapse by title+day before listing, keeping
          // the copy that has artwork and a collectionId.
          const albSeen = new Set();
          const albPick = [];
          albCand.forEach(function(r){
            const albDate = (r.releaseDate || '').slice(0, 10);
            const keyA = 'alb:' + (r.collectionName || '').toLowerCase().trim() + '|' + albDate;
            if(prevKeys.has(keyA)) return;
            if(albSeen.has(keyA)){
              for(let ai = 0; ai < albPick.length; ai++){
                const pk = 'alb:' + (albPick[ai].collectionName || '').toLowerCase().trim() + '|' + (albPick[ai].releaseDate || '').slice(0, 10);
                if(pk !== keyA) continue;
                if(!albPick[ai].artworkUrl100 && r.artworkUrl100) albPick[ai] = r;
                else if(!albPick[ai].collectionId && r.collectionId) albPick[ai] = r;
                break;
              }
              return;
            }
            albSeen.add(keyA); albPick.push(r);
          });
          albPick.slice(0, 5).forEach(function(r){
            const albDate = (r.releaseDate || '').slice(0, 10);
            const keyA = 'alb:' + (r.collectionName || '').toLowerCase().trim() + '|' + albDate;
            if(prevKeys.has(keyA)) return;
            fresh.push({`);

// ---------------------------------------------------------------------------
// [2] the Spotify upcoming pass and its silent token are gone.
// ---------------------------------------------------------------------------

// Drop the silent token + the Spotify upcoming fetcher in one cut — the whole
// span from the silent-token comment down to the Spotify export line. Nothing
// else calls either one; the interactive PKCE path is untouched.
{
  const a = src.indexOf('  // Silent token for the release check:');
  const bMark = '  window.__scSpotifyUpcoming = scFetchSpotifyUpcoming;\n';
  const b = src.indexOf(bMark);
  if (a === -1 && b === -1) {
    skip('silent Spotify token + upcoming pass removed');
  } else {
    if (a === -1 || b === -1) throw new Error('silent Spotify block: only one end found — a half-applied file');
    src = src.slice(0, a) + src.slice(b + bMark.length);
    done('silent Spotify token + upcoming pass removed (no account reads a drop date)');
  }
}

// The release check no longer concatenates a Spotify result set.
sub('release check: merge only the open sources',
  `        var mbFresh = (typeof window.__scMbUpcoming === 'function') ? await window.__scMbUpcoming(artist) : [];
        var spFresh = (typeof window.__scSpotifyUpcoming === 'function') ? await window.__scSpotifyUpcoming(artist) : [];
        (mbFresh || []).concat(spFresh || []).forEach(function(x){`,
  `        var mbFresh = (typeof window.__scMbUpcoming === 'function') ? await window.__scMbUpcoming(artist) : [];
        (mbFresh || []).forEach(function(x){`);

sub('release check: the dedupe key names MusicBrainz only',
  `          var k = (x._mb ? 'mbt:' : 'spt:') + nt + '|' + x.date;`,
  `          var k = 'mbt:' + nt + '|' + x.date;`);

// The stale comment still promised a silent Spotify pass.
sub('release check: comment no longer promises a Spotify pass',
  `      // ---- Dated drops with nothing to connect -----------------------------
      // MusicBrainz carries announced releases with the day already set, and
      // reading it needs no account at all — which is what a public app has to
      // work like. The silent Spotify pass still runs on top in case a token
      // from an old connection is lying on the device, but it is never asked
      // for and never opens a window. Best effort: no network, no matches —
      // the sources above still decide alone about this one.`,
  `      // ---- Dated drops with nothing to connect -----------------------------
      // MusicBrainz carries announced releases with the day already set, and
      // reading it needs no account at all — which is what a public app has to
      // work like. Nothing here opens a window or reads a token: the artist's
      // Apple catalog above and this open search are the whole source of truth.
      // Best effort: no network, no matches — the sources above still decide
      // alone about this one.`);

// ---------------------------------------------------------------------------
// [3] version + changelog head
// ---------------------------------------------------------------------------

sub('APP_VERSION -> ' + VER,
  `  const APP_VERSION = '61.3.7';`,
  `  const APP_VERSION = '${VER}';`);

const NOTES = [
  'Upcoming releases finally fills in: SideCut reads the announced dates straight from the artist\u2019s own open catalog, where a pre-order carries its real day weeks before it lands \u2014 that catalog is read by the artist\u2019s ID, not by the popularity-ranked search that was burying a dated drop.',
  'Nothing to connect and nothing to verify anywhere: the Spotify pass and its silent token are gone from the release check, so no drop date is ever read through an account. The artist\u2019s open catalog and MusicBrainz do all the finding.',
  'A pinned artist\u2019s upcoming release is looked up directly: one artist search for the ID, one album pass for the catalog, and every dated future release it lists flows through the same artwork, track-count and duplicate rules as everything else.',
  'The release check reads a wider net of the same open sources, so a drop listed weeks out shows under Upcoming releases instead of only appearing on the day it lands.',
  'This release changes nothing about how a drop you add by hand is stored \u2014 manual drops still carry their day and time.',
];

// The changelog head is stamped with the run time, so the generic idempotence
// check (exact newStr present) can never match on a re-run — guard on the
// version marker instead.
if (src.includes(`const CHANGELOG = [\n  { version: '${VER}'`)) {
  skip('changelog head entry');
} else {
  sub('changelog head entry',
    `  const CHANGELOG = [
  { version: '61.3.7', date: `,
    `  const CHANGELOG = [
  { version: '${VER}', date: '${STAMP}', title: 'Upcoming releases reads the dates it was missing', items: [
${NOTES.map((n) => `    '${n}',`).join('\n')}
  ] },
  { version: '61.3.7', date: `);
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
// test-6138 is authored AT the new version and must not be touched by the
// blanket repin — its own "heads the changelog" anchor names the previous
// release on purpose.
for (const f of fs.readdirSync(devDir)) {
  if (!/^test-.*\.mjs$/.test(f) || f === 'test-6138.mjs') continue;
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ver === '61.3.7'`).join(`ver === '${VER}'`)
    .split(`sidecut-shell-v61.3.7`).join(`sidecut-shell-v${VER}`)
    .split(`"version: '61.3.7'"`).join(`"version: '${VER}'"`)
    .split(`CHANGELOG head entry is 61.3.7`).join(`CHANGELOG head entry is ${VER}`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); pinned++; console.log('• repinned dev/' + f); }
}
const stale = fs.readdirSync(devDir)
  .filter((f) => /^test-.*\.mjs$/.test(f) && f !== 'test-6138.mjs')
  .filter((f) => fs.readFileSync(path.join(devDir, f), 'utf8').includes(`ver === '61.3.7'`));
if (stale.length) throw new Error('test files still pinned to 61.3.7: ' + stale.join(', '));

// test-6137 anchors the newest CHANGELOG entry inside a regex literal — the
// generic repin above can't reach it (the dots are escaped), so fix it here.
{
  const p = path.join(devDir, 'test-6137.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0.replace(/ok\(\/const CHANGELOG = \\\[\\n  \\\{ version: '61\\\.3\\\.7'\/\.test\(src\)/,
    `ok(/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.8'/.test(src)`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); console.log('• dev/test-6137.mjs changelog-head regex → ' + VER); }
  else skip('dev/test-6137.mjs changelog-head regex');
}

// test-6136 pinned the old source-prefixed dedupe key; the key names only its
// remaining open source now.
{
  const p = path.join(devDir, 'test-6136.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0.split(`"(x._mb ? 'mbt:' : 'spt:') + nt + '|' + x.date"`).join(`"'mbt:' + nt + '|' + x.date"`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); console.log('• dev/test-6136.mjs dedupe-key needle updated'); }
  else skip('dev/test-6136.mjs dedupe-key needle');
}

// test-612 was written for the Spotify upcoming pass, which is gone: its whole
// subject is now the open artist-catalog lookup and the removal. Written whole
// (no regex surgery on a test whose premise changed).
{
  const p = path.join(devDir, 'test-612.mjs');
  const body = `// v61.3.8 — repinned from v61.2. Its old subject, a silent Spotify pass that
// read a drop date through an account token, is gone: no drop date is read
// through a connection any more. What replaced it is the pinned artist's OWN
// open Apple catalog, read by artist ID. The interactive PKCE flow still
// exists for the one place it has always belonged (the converter's Spotify
// search), which is what section [2] pins.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };
const count = (needle) => src.split(needle).length - 1;
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a + from.length);
  if (b === -1) return null;
  return src.slice(a, b);
}

console.log('[1] no silent token — nothing in the check reads a connection');
ok(count('scSpotifySilentToken') === 0, 'the silent token is gone');
ok(count('scFetchSpotifyUpcoming') === 0, 'the Spotify upcoming pass is gone');
ok(count('_spt:') === 0, 'no Spotify-sourced entry key survives');
ok(count('spFresh') === 0, 'the check merges no Spotify result set');

console.log('[2] the interactive flow survives, only where it belongs');
const inter = slice('async function scSpotifyInteractiveToken(){', 'window.__scSpotifyConnect = scSpotifyInteractiveToken;');
ok(!!inter, 'scSpotifyInteractiveToken defined');
ok(inter && inter.includes("window.open(auth, 'sidecut-spotify-auth'"), 'the PKCE popup lives here');
ok(count('await scSpotifyInteractiveToken()') === 1, 'exactly one call site (the converter search)');
ok(src.includes('async function scSpotifySearch(q, type){'), 'scSpotifySearch still exists');

console.log('[3] upcoming pass: the open artist catalog, read by ID');
const idFn = slice('async function scItunesArtistAlbums(artist){', '  // Query iTunes for an artist');
ok(!!idFn, 'scItunesArtistAlbums defined');
ok(idFn && idFn.includes('entity=musicArtist&limit=5'), 'one artist search resolves the ID');
ok(idFn && idFn.includes('entity=album&limit=200'), 'the catalog is read by artist id');
ok(idFn && !/spotify|token/i.test(idFn), 'no Spotify, no token in the pass');
ok(idFn && idFn.includes('credited('), 'the pinned artist must be credited');
ok(idFn && idFn.includes('await fetchWithProxy('), 'goes through the shared proxy fetch');

console.log('[4] merge inside fetchArtistReleases');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('scItunesArtistAlbums(artist)'), 'the artist-catalog pass runs in the album loop');
ok(check && !check.includes('__scSpotifyUpcoming'), 'no Spotify pass in the release check');
ok(check && check.includes('window.__scMbUpcoming(artist)'), 'the open MusicBrainz pass still runs');
ok(check && check.includes("'mbt:' + nt + '|' + x.date"), 'dedupe key names its open source');
ok(check && check.includes('pe.date = x.date'), 'an undated entry gets the date in place instead of duplicating');
ok(check && check.includes('_idE'), 'best-effort: a catalog failure cannot break the check');

console.log('[5] the empty state asks you to connect nothing');
ok(count('window.__scWireUpcomingCta = function') === 1, 'wiring helper defined once');
const ctaSlice = slice('window.__scWireUpcomingCta = function', 'window.__scRebuildReleaseLists = async function');
ok(!!ctaSlice && ctaSlice.includes("cbtn.textContent = 'Check for drops'"), 'the button runs the check');
ok(!!ctaSlice && !ctaSlice.includes('Connect Spotify'), 'the Connect Spotify button is gone');
ok(!!ctaSlice && ctaSlice.includes('Add a drop manually'), 'the manual sheet is still offered');

console.log('[6] manual drop sheet');
ok(count('window.__scAddUpcomingDrop = function') === 1, 'sheet builder defined once');
ok(src.includes('id="scAddDropArtist"') && src.includes('id="scAddDropTitle"') && src.includes('id="scAddDropDate"'),
  'artist + title + date fields present');
ok(src.includes("_manual: true"), 'manual drops stored with the fetched shape');

console.log('[7] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.3.8', 'APP_VERSION = ' + ver);

if (failures) { console.log('\\n' + failures + ' failure(s)'); process.exit(1); }
console.log('\\nall passed');
`;
  const t0 = fs.readFileSync(p, 'utf8');
  if (t0.startsWith('// v61.3.8 — repinned from v61.2.')) { skip('dev/test-612.mjs rewritten'); }
  else { fs.writeFileSync(p, body); console.log('• dev/test-612.mjs rewritten whole for the open artist-catalog pass'); }
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

console.log('patch-6138: ' + edits + ' index.html edit(s), ' + pinned + ' test file(s) repinned');
console.log('stamp: ' + STAMP);
