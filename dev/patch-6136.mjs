#!/usr/bin/env node
// v61.3.6 — "I told you no connect Spotify — just make the app look it up."
//
// Same mechanics as patch-611 / patch-612 / patch-6135: str_replace cannot
// reach inside the 2.2 MB index.html (confirmed again in this environment —
// even the unique 36-char line `cbtn.textContent = 'Connect Spotify';`
// reports "not found" while sw.js edits fine), so every index.html and test
// edit goes through this idempotent pass with count==1 assertions:
//   1. scFetchMbUpcoming — the open MusicBrainz dated-drop pass, inserted
//      after the Spotify export
//   2. the merge in fetchArtistReleases: mbFresh.concat(spFresh), source-
//      prefixed dedupe key, best-effort contract untouched
//   3. the empty-state CTA: Connect Spotify → Check for drops, hint without
//      any connection wording, connection-state sniff dropped
//   4. __scUpcomingConnectTap: runs the check directly, no authorization
//      window anywhere in the flow
//   5. the stale "only catalog" comment over the interactive token
//   6. APP_VERSION 61.3.5 → 61.3.6 + a new CHANGELOG head entry
//   7. every dev/test-*.mjs `ver === '61.3.5'` pin repinned (test-612 is
//      excluded here and gets its assertion blocks swapped by hand below),
//      plus test-6052's exact ship-date pin
//   8. root manifest.json regenerated from the new head entry (size seeded
//      from ota/updates.json, exactly like patch-6135)
//   9. sw.js is only ASSERTED at sidecut-shell-v61.3.6 — the file editor did
//      that one, because it can reach small files
// Verify after running: grep the markers, the mandatory new Function block
// check, the full dev/test-*.mjs suite, then rebuild both OTA bundles.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function replaceOnce(oldStr, newStr, label) {
  const got = src.split(oldStr).length - 1;
  if (got !== 1) throw new Error(`${label}: expected 1 occurrence, found ${got}`);
  src = src.replace(oldStr, newStr);
  n++;
  console.log('• ' + label);
}

if (src.includes(`const APP_VERSION = '61.3.6'`)) {
  console.log('patch-6136: already applied');
  process.exit(0);
}

// Sandbox runs on UTC with no tzdata: Eastern = UTC minus 4 hours (EDT).
function easternStamp() {
  const d = new Date(Date.now() - 4 * 3600 * 1000);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${h}:${mm} ${ampm} EDT`;
}

// ------------------------------------------------ [1] MusicBrainz open pass
replaceOnce(
  `  window.__scSpotifyUpcoming = scFetchSpotifyUpcoming;
  async function scSpotifySearch(q, type){`,
  `  window.__scSpotifyUpcoming = scFetchSpotifyUpcoming;
  // ---- No account, no window: the announced drop, dated on MusicBrainz -----
  // Spotify only lists a release date before release day — but reading it used
  // to need a connection, which a public app cannot ask for. MusicBrainz
  // carries announced releases with the DAY already set, and its search is
  // open: one query per pinned artist, kept only when the date is a real
  // YYYY-MM-DD in the future and the pinned artist is credited. Best effort:
  // no network / no matches / a rate-limited reply and the other sources
  // simply carry on — nothing here may break the release check.
  async function scFetchMbUpcoming(artist){
    try{
      if(!artist) return [];
      if(typeof fetchWithProxy !== 'function') return [];
      var today = new Date().toISOString().slice(0, 10);
      var horizon = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10);
      // Lucene specials (quotes/backslashes) would 400 the whole query.
      var q = 'artist:"' + String(artist).replace(/["\\\\]/g, ' ').trim() + '"';
      q += ' AND firstreleasedate:[' + today + ' TO ' + horizon + ']';
      var url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
      var rs = await fetchWithProxy(url);
      if(!rs || !rs.ok) return [];
      var md = await rs.json();
      var want = primaryArtistName(artist).toLowerCase().trim();
      var out = [];
      ((md && md['release-groups']) || []).forEach(function(rg){
        if(!rg || !rg.title) return;
        // The range above can still hand back year/month-precision entries
        // that merely overlap it — only a real day counts as a drop.
        var d = window.__scDay10(rg['first-release-date']);
        if(!d || !window.__scUpcomingDay(d)) return;
        var pt = String(rg['primary-type'] || '');
        if(pt && pt !== 'Album' && pt !== 'Single' && pt !== 'EP') return;
        var credits = (rg['artist-credit'] || []).map(function(c){
          return primaryArtistName((c && (c.name || (c.artist && c.artist.name))) || '').toLowerCase().trim();
        });
        var hit = credits.some(function(nm){ return !!nm && (nm === want || nm.indexOf(want) !== -1 || want.indexOf(nm) !== -1); });
        if(!hit) return; // collabs count only when the pinned artist is credited
        out.push({
          title: rg.title, date: d, art: null,
          url: 'https://musicbrainz.org/release-group/' + rg.id,
          previewUrl: null, kind: 'album', cid: null, seen: false, _mb: rg.id
        });
      });
      return out;
    }catch(_e){ return []; }
  }
  window.__scMbUpcoming = scFetchMbUpcoming;
  async function scSpotifySearch(q, type){`,
  'scFetchMbUpcoming inserted after the Spotify export'
);

// -------------------------------------------- [2] merge inside the release check
replaceOnce(
  `      // ---- Spotify: drop dates the other catalogs do not have yet ----------
      // Apple's search API, Deezer and MusicBrainz carry nothing for a release
      // that has not landed, so without this pass a real dated drop never
      // reached Upcoming releases. Best effort: no token, no network, no
      // matches — the other sources above still decide nothing about this one.
      try{
        var spFresh = (typeof window.__scSpotifyUpcoming === 'function') ? await window.__scSpotifyUpcoming(artist) : [];
        (spFresh || []).forEach(function(x){
          if(!x || !x.title || !x.date) return;
          var nt = String(x.title).toLowerCase().trim();
          var k = 'spt:' + nt + '|' + x.date;`,
  `      // ---- Dated drops with nothing to connect -----------------------------
      // MusicBrainz carries announced releases with the day already set, and
      // reading it needs no account at all — which is what a public app has to
      // work like. The silent Spotify pass still runs on top in case a token
      // from an old connection is lying on the device, but it is never asked
      // for and never opens a window. Best effort: no network, no matches —
      // the sources above still decide alone about this one.
      try{
        var mbFresh = (typeof window.__scMbUpcoming === 'function') ? await window.__scMbUpcoming(artist) : [];
        var spFresh = (typeof window.__scSpotifyUpcoming === 'function') ? await window.__scSpotifyUpcoming(artist) : [];
        (mbFresh || []).concat(spFresh || []).forEach(function(x){
          if(!x || !x.title || !x.date) return;
          var nt = String(x.title).toLowerCase().trim();
          var k = (x._mb ? 'mbt:' : 'spt:') + nt + '|' + x.date;`,
  'merge: mbFresh.concat(spFresh), source-prefixed key'
);

// --------------------------------------------------------- [3] the empty-state CTA
replaceOnce(
  `      var cbtn = document.createElement('button');
      cbtn.className = 'sc-up-cta sc-up-cta-connect';
      cbtn.style.cssText = 'padding:10px 16px;border-radius:999px;border:1px solid var(--gold);background:rgba(227,178,60,0.12);color:var(--gold);font-size:12.5px;font-weight:700;cursor:pointer;';
      cbtn.textContent = 'Connect Spotify';
      var abtn = document.createElement('button');
      abtn.className = 'sc-up-cta sc-up-cta-add';
      abtn.style.cssText = 'padding:10px 16px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink);font-size:12.5px;font-weight:700;cursor:pointer;';
      abtn.textContent = 'Add a drop manually';
      wrap.appendChild(cbtn); wrap.appendChild(abtn);
      el.appendChild(wrap);
      var hint = document.createElement('div');
      hint.style.cssText = 'font-size:11.5px;color:var(--ink-dim);margin-top:10px;line-height:1.45;max-width:46ch;margin-left:auto;margin-right:auto;';
      hint.textContent = 'A drop is often only listed on Spotify before release day — connect once and SideCut reads the date from there too.';
      el.appendChild(hint);
      cbtn.addEventListener('click', function(){ window.__scUpcomingConnectTap(cbtn); });
      abtn.addEventListener('click', function(){ window.__scAddUpcomingDrop(); });
      try{
        var st = JSON.parse(localStorage.getItem(SC_SPOTIFY_TOKEN_KEY) || 'null');
        if(st && st.access_token && Number(st.expires_at) > Date.now()) cbtn.textContent = 'Re-check for drops';
      }catch(_eLbl){}`,
  `      var cbtn = document.createElement('button');
      cbtn.className = 'sc-up-cta sc-up-cta-connect';
      cbtn.style.cssText = 'padding:10px 16px;border-radius:999px;border:1px solid var(--gold);background:rgba(227,178,60,0.12);color:var(--gold);font-size:12.5px;font-weight:700;cursor:pointer;';
      cbtn.textContent = 'Check for drops';
      var abtn = document.createElement('button');
      abtn.className = 'sc-up-cta sc-up-cta-add';
      abtn.style.cssText = 'padding:10px 16px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink);font-size:12.5px;font-weight:700;cursor:pointer;';
      abtn.textContent = 'Add a drop manually';
      wrap.appendChild(cbtn); wrap.appendChild(abtn);
      el.appendChild(wrap);
      var hint = document.createElement('div');
      hint.style.cssText = 'font-size:11.5px;color:var(--ink-dim);margin-top:10px;line-height:1.45;max-width:46ch;margin-left:auto;margin-right:auto;';
      hint.textContent = 'SideCut checks open release catalogs for every pinned artist — no account, nothing to connect. If no store has listed the date yet, add the drop by hand.';
      el.appendChild(hint);
      cbtn.addEventListener('click', function(){ window.__scUpcomingConnectTap(cbtn); });
      abtn.addEventListener('click', function(){ window.__scAddUpcomingDrop(); });`,
  'CTA: Connect Spotify → Check for drops, no token sniff'
);

// ------------------------------------------------ [4] the tap runs the check itself
replaceOnce(
  `  // Explicit tap only: this is the ONE place the authorization window may open.
  window.__scUpcomingConnectTap = async function(btn){
    try{ if(btn){ btn.textContent = 'Connecting\\u2026'; btn.disabled = true; } }catch(_eB0){}
    var ok = false;
    try{ await scSpotifyInteractiveToken(); ok = true; }
    catch(_eConn){ toast('Spotify connection was cancelled \\u2014 you can still add the drop by hand.', 3600); }
    try{ if(btn){ btn.textContent = ok ? 'Checking\\u2026' : 'Add a drop manually'; btn.disabled = false; } }catch(_eB1){}
    if(ok){ try{ await window.__scRebuildReleaseLists(true); }catch(_eRb){} }
    try{ if(btn) btn.textContent = 'Re-check for drops'; }catch(_eB2){}
  };`,
  `  // The button runs the check on the spot. It needs no account, so there is no
  // authorization window anywhere in this flow — the only one left belongs to
  // the converter's Spotify search, on its own explicit tap.
  window.__scUpcomingConnectTap = async function(btn){
    try{ if(btn){ btn.textContent = 'Checking\\u2026'; btn.disabled = true; } }catch(_eB0){}
    try{ await window.__scRebuildReleaseLists(true); }
    catch(_eChk){ toast('The release check could not finish \\u2014 try again.', 3600); }
    try{ if(btn){ btn.textContent = 'Check for drops'; btn.disabled = false; } }catch(_eB1){}
  };`,
  'tap: check directly, no authorization window'
);

// --------------------------------------- [5] the stale "only catalog" comment
replaceOnce(
  `  // ---- Spotify: the only catalog that knows a drop date before release day --
  // Interactive connection (the authorization window) — called ONLY from an
  // explicit tap, never from a background release check.`,
  `  // ---- Spotify: interactive connection (the authorization window) -----------
  // Still called ONLY from an explicit tap (the converter's Spotify search),
  // never from a background release check.`,
  'interactive-token comment no longer claims to be the only dated catalog'
);

// ------------------------------------------------------------- [6] the release
replaceOnce(
  `  const APP_VERSION = '61.3.5';`,
  `  const APP_VERSION = '61.3.6';`,
  'APP_VERSION → 61.3.6'
);

const DATE = easternStamp();
const ITEMS = [
  'Upcoming releases now looks the date up itself: every pinned artist is checked against MusicBrainz’s open catalog of announced releases, where a drop someone has already dated sits with its day set weeks before it lands — no account, no sign-in, no window.',
  'The empty tab no longer offers a Connect Spotify button: it now says "Check for drops" and runs the same check on the spot, beside the "Add a drop manually" sheet — nothing in Upcoming releases asks you to connect anything anymore.',
  'What counts as a drop has not moved: only a real day (YYYY-MM-DD) that is genuinely in the future is listed — placeholder dates and catalog junk stay out — and the pinned artist has to be credited on the release, so collaborations count only when your artist is on it.',
  'A token left on the device by a connection from an older version is still read quietly in the background to add its dates; nobody is ever prompted for one, and nobody needs one.',
  'The check runs exactly where it did before — Fetch latest, the Upcoming tab, the Home bubble, the bell and the automatic pass all read the same stored dates — and one query per artist keeps the whole thing quick.',
  'A failed, offline or rate-limited lookup changes nothing: the other sources simply carry on, so the release check can never be taken down by a catalog being down.',
];
{
  const HEAD = `  { version: '61.3.5', date: 'September 23, 2026 · 10:27 PM EDT', title: 'One version number everywhere', items: [`;
  const got = src.split(HEAD).length - 1;
  if (got !== 1) throw new Error(`changelog head: expected 1 occurrence, found ${got}`);
  const entry = `  { version: '61.3.6', date: '${DATE}', title: 'Upcoming releases stops asking you to connect anything', items: [\n`
    + ITEMS.map((it) => `    '${it}',`).join('\n')
    + `\n  ] },\n`;
  src = src.replace(HEAD, entry + HEAD);
  n++;
  console.log('• changelog head entry → 61.3.6 (' + DATE + ')');
}

fs.writeFileSync(FILE, src);
console.log('• index.html: ' + n + ' replacements written');

// ------------------------------------------------------------------- sw.js
{
  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  if (sw.includes(`const CACHE_NAME = 'sidecut-shell-v61.3.6';`)) {
    console.log('• sw.js cache already sidecut-shell-v61.3.6 (file editor did it)');
  } else if (sw.includes(`const CACHE_NAME = 'sidecut-shell-v61.3.5';`)) {
    fs.writeFileSync(SW, sw.replace(`const CACHE_NAME = 'sidecut-shell-v61.3.5';`, `const CACHE_NAME = 'sidecut-shell-v61.3.6';`));
    console.log('• sw.js cache → sidecut-shell-v61.3.6');
  } else {
    throw new Error('sw.js: unexpected CACHE_NAME');
  }
}

// --------------------------------------------------------------- test pins
let pinned = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(f)) continue;
  if (f === 'test-612.mjs') continue; // assertion swaps handled below
  const p = path.join(ROOT, 'dev', f);
  const t = fs.readFileSync(p, 'utf8');
  if (t.includes(`ver === '61.3.5'`)) {
    fs.writeFileSync(p, t.split(`ver === '61.3.5'`).join(`ver === '61.3.6'`));
    pinned++;
    console.log('• repinned dev/' + f);
  }
}
if (pinned < 7) throw new Error(`expected to repin at least 7 test files, got ${pinned}`);

function swapIn(file, pairs) {
  const p = path.join(ROOT, 'dev', file);
  let t = fs.readFileSync(p, 'utf8');
  for (const [a, b, want] of pairs) {
    const got = t.split(a).length - 1;
    if (got !== want) throw new Error(`${file} "${a.slice(0, 60)}...": expected ${want}, found ${got}`);
    t = t.split(a).join(b);
  }
  fs.writeFileSync(p, t);
  console.log('• dev/' + file + ': ' + pairs.length + ' swap(s)');
}

// test-612 also pins the connect-era behavior this release deletes.
swapIn('test-612.mjs', [
  [`// the three ways SideCut now gets a date: the silent Spotify pass, the Connect
// CTA on both empty states, and the manual drop sheet — plus the rule that a
// background check must NEVER open an authorization window.`,
   `// the ways SideCut gets a date (repinned at 61.3.6: the open MusicBrainz pass
// first, the silent Spotify pass only when a token is already on the device,
// and the manual drop sheet) — plus the rule that a check must NEVER open an
// authorization window, and that the empty state asks you to connect nothing.`, 1],
  [`ok(count('await scSpotifyInteractiveToken()') === 2,
  'exactly two interactive call sites (Spotify search + the Connect CTA tap)');`,
   `ok(count('await scSpotifyInteractiveToken()') === 1,
  'exactly one interactive call site left (the Spotify search flow — the upcoming check never opens a window)');`, 1],
  [`ok(check && check.includes("'spt:' + nt + '|' + x.date"), 'dedupe key names its source');`,
   `ok(check && check.includes('window.__scMbUpcoming(artist)'), 'the no-account MusicBrainz pass runs first');
ok(check && check.includes("(x._mb ? 'mbt:' : 'spt:') + nt + '|' + x.date"), 'dedupe key names its source');`, 1],
  [`ok(src.includes("cbtn.textContent = 'Connect Spotify'") && src.includes("cbtn.textContent = 'Re-check for drops'"),
  'button relabels to a plain re-check once connected');`,
   `const ctaSlice = slice('window.__scWireUpcomingCta = function', 'window.__scRebuildReleaseLists = async function');
ok(!!ctaSlice && ctaSlice.includes("cbtn.textContent = 'Check for drops'"), 'the button runs the check — nothing to connect');
ok(!!ctaSlice && !ctaSlice.includes('Connect Spotify'), 'the Connect Spotify button is gone from the empty state');
ok(!!ctaSlice && ctaSlice.includes('Add a drop manually'), 'the manual sheet is still offered beside it');`, 1],
  [`ok(ver === '61.3.5', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3.5';"), 'sw.js cache = sidecut-shell-v61.3.5');
const head = src.indexOf("version: '61.3.5'");
ok(src.indexOf("version: '61.3.5'") < src.indexOf("version: '61.2'"), 'CHANGELOG head entry is 61.3.5');
ok(src.indexOf("version: '61.3.5'") < src.indexOf("version: '61.2'"), '61.3.5 is ahead of 61.2');`,
   `ok(ver === '61.3.6', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3.6';"), 'sw.js cache = sidecut-shell-v61.3.6');
const head = src.indexOf("version: '61.3.6'");
ok(src.indexOf("version: '61.3.6'") < src.indexOf("version: '61.2'"), 'CHANGELOG head entry is 61.3.6');
ok(src.indexOf("version: '61.3.6'") < src.indexOf("version: '61.3.5'"), '61.3.6 is ahead of 61.3.5');`, 1],
]);

// test-6052 pins entries[0].date by exact string equality (the lesson from 61.3.5).
swapIn('test-6052.mjs', [
  [`ok(entries[0].date === 'September 23, 2026 · 10:27 PM EDT', 'ship date correct (' + entries[0].date + ')');`,
   `ok(entries[0].date === '${DATE}', 'ship date correct (' + entries[0].date + ')');`, 1],
]);

// ------------------------------------------------- root manifest.json (seeded)
// Same shape as updates.json. size is seeded from the current bundle figure;
// ota-bundle writes the exact size into updates.json when it rebuilds.
const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
const rootMan = { version: '61.3.6', url: 'update.zip', size: upd.size, notes: ITEMS, date: DATE };
fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(rootMan, null, 2) + '\n');
console.log('• root manifest.json → 61.3.6');

console.log(`patch-6136: index.html ${n} replacements, ${pinned} test files repinned, test-612 + test-6052 swapped`);
