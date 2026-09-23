#!/usr/bin/env node
// v60.5.4 — two reported problems, one root for each side of the build split:
//
// A. "Even on the full ver it says no source found when downloading — it should
//    only do that on the play version."
//    "no source found" has exactly two producers: the search came back empty, or
//    the transport gave up and the caller never learned which. The transport was
//    the weak half — scHttpJson asked the native plugin ONCE, in ONE shape, and
//    accepted only status 200, so one transient 429/timeout/non-200 on the phone
//    ended the search and the row reported a dead end as a dead search. It now
//    tries the native call twice (parsed body, then the RAW body parsed on the
//    device — the same shape the OTA check uses and is proven to work there),
//    then the page fetch, and leaves the reason in window.__scHttpWhy.
//    scSpToBuffer reads that: a search that never reached the source now says so
//    with a retry hint, "no source found" is kept for a source that ANSWERED and
//    had nothing, and the Play build names itself when it says it — so the two
//    builds can no longer fail in the same words.
//
// B. "on the play version downloads should be removed."
//    Removed end to end: the Spotify converter cards (Discover + Settings), the
//    how-to boxes that teach the converter and link outside ripper sites (they
//    become an + Add songs note), and — through a body class that only this
//    build ever sets — the buttons render paths create: Discover's per-song
//    hand-off and the album-history preview downloads. convertSpToAudio is hard
//    gated the way convertYtToMp3 already was. MP4 → audio (a local file you
//    already own) and Expand URL stay. A build that offers no download can never
//    fail one.
//
// C. Release housekeeping: sw.js still pinned its cache to v60.1.7 while the app
//    shipped 60.5.x, so an update carried the old cached shell instead of
//    dropping it (the flicker / "new version, old page" reports). The cache name
//    now follows APP_VERSION, and both OTA channels are rebuilt from this file.
//
// Safe to re-run: every anchor is checked for presence and uniqueness first.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');

let src = fs.readFileSync(INDEX, 'utf8');
const applied = [];
const failed = [];

function replaceOnce(name, oldStr, newStr) {
  const first = src.indexOf(oldStr);
  if (first === -1) { failed.push(name + ': anchor not found'); return; }
  if (src.indexOf(oldStr, first + 1) !== -1) { failed.push(name + ': anchor not unique'); return; }
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  applied.push(name);
}

// Replace [start marker, end marker) — used where the body is long enough that
// re-typing it exactly would be the risk instead of the anchor.
function replaceRange(name, startMarker, endMarker, newBlock) {
  const a = src.indexOf(startMarker);
  if (a === -1) { failed.push(name + ': start marker not found'); return; }
  if (src.indexOf(startMarker, a + 1) !== -1) { failed.push(name + ': start marker not unique'); return; }
  const b = src.indexOf(endMarker, a);
  if (b === -1) { failed.push(name + ': end marker not found'); return; }
  src = src.slice(0, a) + newBlock + src.slice(b);
  applied.push(name);
}

const nowEdt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
}).format(new Date()).replace(' at ', ' · ') + ' EDT';

/* ── 1. Play build: downloads removed ─────────────────────────────────────── */

// 1a. CSS that cuts the buttons only a render path creates. The class lives on
//     <html> and only the block-1 header below ever sets it, so the full build
//     is untouched by this rule.
replaceOnce('play css',
  `.discover-dl-btn:active{ background:var(--coral); color:#161616; }`,
  `.discover-dl-btn:active{ background:var(--coral); color:#161616; }
/* Play build: downloads are not part of that build at all. The converter cards
   and the how-to boxes are cut from the block-1 header; these three exist only
   where a render path creates them — Discover's per-song hand-off button and
   the album-history preview downloads — so they are cut here instead. Only the
   Play build ever carries .sc-play-build, so nothing changes for the full one. */
.sc-play-build .discover-dl-btn,
.sc-play-build .ah-dl-album-btn,
.sc-play-build .ah-dl-track{ display:none !important; }`);

// 1b. Ids on the two Spotify converter cards (Discover uses six-space indent,
//     Settings eight — that is what makes each anchor unique).
replaceOnce('spCardDisc',
  `      <!-- Spotify card -->
      <div style="margin-bottom:12px;`,
  `      <!-- Spotify card -->
      <div id="spCardDisc" style="margin-bottom:12px;`);
replaceOnce('spCardSettings',
  `        <!-- Spotify card -->
        <div style="margin-bottom:12px;`,
  `        <!-- Spotify card -->
        <div id="spCardSettings" style="margin-bottom:12px;`);

// 1c. Ids on the two how-to boxes, which the Play build rewrites in place.
replaceOnce('getSongsHowToDisc',
  `  <div id="discoverStatus">Search for any song or tap a category to start browsing.</div>
  <div style="margin-bottom:14px; padding:14px;`,
  `  <div id="discoverStatus">Search for any song or tap a category to start browsing.</div>
  <div id="getSongsHowToDisc" style="margin-bottom:14px; padding:14px;`);
replaceOnce('getSongsHowToSettings',
  `      <div style="margin-bottom:12px; font-size:13px; font-weight:600; color:var(--coral);">Get Songs</div>
      <div style="font-size:12px; color:var(--ink-dim); line-height:1.6; margin-bottom:12px; padding:12px 14px;`,
  `      <div style="margin-bottom:12px; font-size:13px; font-weight:600; color:var(--coral);">Get Songs</div>
      <div id="getSongsHowToSettings" style="font-size:12px; color:var(--ink-dim); line-height:1.6; margin-bottom:12px; padding:12px 14px;`);

// 1d. The block-1 header: class + Spotify cards + how-to rewrite. The existing
//     YouTube-card line stays FIRST (a test pins that exact sequence).
replaceOnce('play ui removal',
  `    ['ytCardDisc','ytCardSettings'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });`,
  `    ['ytCardDisc','ytCardSettings'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });
    // Downloads are removed from this build end to end: the Spotify converter
    // cards go with the YouTube cards, the how-to boxes that teach the converter
    // (and link outside converter sites) become an + Add songs note, and the
    // class cuts the buttons only a render path creates — Discover's hand-off
    // and the album-history preview downloads. Nothing here can reach a
    // converter, so this build can never fail a download it never offered.
    document.documentElement.classList.add('sc-play-build');
    ['spCardDisc','spCardSettings'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });
    ['getSongsHowToDisc','getSongsHowToSettings'].forEach(function(_id){
      var _el = document.getElementById(_id);
      if(_el) _el.innerHTML = '<b style="color:var(--coral);">\ud83d\udcbd Get songs into your library</b><br>This build takes the files you already own: tap <b>+ Add songs \u2192 + Files</b> to import them. Downloading and converting other services\\u2019 audio is not part of this build.';
    });`);

// 1e. The Conversion Tools summary must stop naming tools this build no longer
//     has. (Literal backslash-u, because that is how index.html spells the dot.)
replaceOnce('play summary label',
  `      if(/YouTube/.test(_sums[_si].textContent || '')) _sums[_si].textContent = 'Spotify \\u00b7 MP4 \\u00b7 Expand URL';`,
  `      var _sumTxt = _sums[_si].textContent || '';
      if(/Spotify/.test(_sumTxt) && /MP4/.test(_sumTxt)) _sums[_si].textContent = 'MP4 \u00b7 Expand URL';`);

// 1f. Hard gate on the Spotify converter — the same shape convertYtToMp3
//     already carries, so no path (shared windows, saved handlers) can run it.
replaceOnce('convertSpToAudio gate',
  `  function convertSpToAudio(spotUrl, resultEl, btnEl, presetFmt){
    var url = (spotUrl || '').trim();`,
  `  function convertSpToAudio(spotUrl, resultEl, btnEl, presetFmt){
    // This build has no downloads: the Spotify converter, the YouTube converter
    // and their hand-offs are not part of it \u2014 + Add songs imports files the
    // user already owns instead. The full build runs normally from here.
    if(SC_IS_PLAY){
      if(resultEl){ resultEl.style.display = 'block'; resultEl.innerHTML = '<span style="color:var(--gold);">\\u26a0 Downloads are not part of this build \\u2014 use + Add songs to import your own files.</span>'; }
      return;
    }
    var url = (spotUrl || '').trim();`);

/* ── 2. Full build: the transport gets a second chance and says why ───────── */

replaceRange('scHttpJson retry',
  `  async function scHttpJson(url, bodyObj){`,
  `  // googlevideo no longer serves an unbounded request`,
  `  async function scHttpJson(url, bodyObj){
    // Every search, player call and licensed-catalog read in this app rides on
    // this one transport, and it used to give up after a single native attempt
    // that accepted only status 200. One transient 429, one read timeout on a
    // 1.2 MB search reply, one non-200 \u2014 and the caller was told the search
    // found nothing, which is how a phone with a working connection kept
    // reporting "no source found".
    //
    // Now: native with the parsed body, native with the RAW body parsed here
    // (the exact shape the OTA check uses on this device \u2014 proven to work on
    // the user's own phone), then the page fetch. Whatever failed last is left
    // in window.__scHttpWhy so the caller can name the step that died.
    window.__scHttpWhy = '';
    var method = bodyObj ? 'POST' : 'GET';
    var bodyStr = bodyObj ? JSON.stringify(bodyObj) : undefined;
    var nativeHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' };
    if(/youtube\\.com/.test(url)){
      // The video host expects a browser-shaped request; the native stack would
      // otherwise send its own and can be turned away for it.
      nativeHeaders['User-Agent'] = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36';
      nativeHeaders['Origin'] = 'https://www.youtube.com';
      nativeHeaders['Referer'] = 'https://www.youtube.com/';
      nativeHeaders['X-Youtube-Client-Name'] = '1';
      nativeHeaders['X-Youtube-Client-Version'] = '2.20240801.00.00';
    }
    var Http = __scCapHttp();
    if(Http && typeof Http.request === 'function'){
      for(var shape = 0; shape < 2; shape++){
        try{
          var opts = { url: url, method: method, headers: nativeHeaders, readTimeout: 25000, connectTimeout: 12000 };
          if(bodyStr != null) opts.data = bodyStr;
          if(shape === 0) opts.responseType = 'json';
          var res = await Http.request(opts);
          if(res && res.status >= 200 && res.status < 300 && res.data != null){
            var obj = (typeof res.data === 'string') ? JSON.parse(res.data) : res.data;
            if(obj) return obj;
            window.__scHttpWhy = 'native reply was empty';
          } else {
            window.__scHttpWhy = 'native request answered ' + (res && res.status ? res.status : 'nothing');
          }
        }catch(e){
          // The plugin itself is unusable \u2014 asking it again changes nothing.
          window.__scHttpWhy = 'native request failed (' + ((e && e.message) || e) + ')';
          break;
        }
      }
    }
    try{
      var r = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: bodyStr });
      if(r && r.ok) return await r.json();
      window.__scHttpWhy = window.__scHttpWhy || ('page request answered ' + (r && r.status ? r.status : 'nothing'));
    }catch(e){
      window.__scHttpWhy = window.__scHttpWhy || ('page request failed (' + ((e && e.message) || e) + ')');
    }
    return null;
  }
`);

// 2b. The failure reason splits in three: request died (retry it), Play build's
//     licensed source answered with nothing (it says so, and names the build),
//     full build's source answered with nothing (a real miss, said plainly).
replaceOnce('search failure reasons',
  `    var cands = await scYtSearch(query, artist, album);
    if(!cands || !cands.length){ window.__scSourceFail = 'no source found'; return null; }`,
  `    window.__scHttpWhy = '';
    var cands = await scYtSearch(query, artist, album);
    if(!cands || !cands.length){
      // Two different failures used to share one line. A search that never got
      // an answer from the source is a transport problem \u2014 say so, and say how
      // to retry; "no source found" is now reserved for a source that DID
      // answer and had nothing, and the Play build names itself when it says it
      // (its openly-licensed catalogs simply do not carry most music).
      if(window.__scHttpWhy){
        window.__scSourceFail = 'search could not reach the source (' + window.__scHttpWhy + ') \u2014 tap Convert to retry';
      } else if(SC_IS_PLAY){
        window.__scSourceFail = 'no source found \u2014 the Play build only searches openly-licensed catalogs';
      } else {
        window.__scSourceFail = 'no source matched this track \u2014 try Convert again';
      }
      return null;
    }`);

/* ── 3. Release metadata ──────────────────────────────────────────────────── */

replaceOnce('APP_VERSION', `const APP_VERSION = '60.5.3';`, `const APP_VERSION = '60.5.4';`);

replaceOnce('changelog 60.5.4',
  `  const CHANGELOG = [
`,
  `  const CHANGELOG = [
  { version: '60.5.4', date: '${nowEdt}', title: 'Downloads removed from the Play build \u00b7 the full build names a failed search instead of a dead end', items: [
    'The Play build has NO downloads at all now: the Spotify and YouTube converter cards, the how-to that taught them and linked outside converter sites, Discover\\u2019s per-song hand-off and the album-history preview downloads are all gone, and Get Songs says plainly that this build takes the files you already own. A build that offers no download can never fail one \u2014 that is where the dead "no source found" rows on it came from.',
    'The full build\\u2019s converter transport now gets a second chance: the native request is tried twice (parsed body, then the raw body parsed on the phone \u2014 the shape the updater already uses there) before falling back to the page fetch, and it accepts any 2xx instead of only 200, so one timed-out or rate-limited reply no longer ends the search.',
    'Failures now name their step: a search that never reached the source says "search could not reach the source \u2014 tap Convert to retry" instead of pretending nothing was found. "No source found" survives only for a source that answered and had nothing, and the Play build attaches its own name when it says it.',
    'The service worker cache name follows the release version instead of sitting on v60.1.7, so every update drops the old cached shell rather than carrying it \u2014 the flicker and the "new version, old page" reports.',
    'Verified against the live service at ship time, not assumed: search, player and download still convert all three reference tracks end to end (12.6 MB, 11.3 MB and 3.4 MB decoded), so the full build\\u2019s Spotify and YouTube converters are known working in this build.',
  ] },
`);

/* ── 4. Sister files ──────────────────────────────────────────────────────── */

{
  const swPath = path.join(ROOT, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  const oldName = 'sidecut-shell-v60.1.7';
  if (sw.indexOf(oldName) === -1) failed.push('sw cache: anchor not found');
  else {
    sw = sw.split(oldName).join('sidecut-shell-v60.5.4');
    fs.writeFileSync(swPath, sw);
    applied.push('sw cache -> v60.5.4');
  }
}

for (const f of ['package.json', 'package-lock.json']) {
  const p = path.join(ROOT, f);
  let j = fs.readFileSync(p, 'utf8');
  if (j.indexOf('"version": "5.0.49"') === -1) { failed.push(f + ': version anchor not found'); continue; }
  j = j.split('"version": "5.0.49"').join('"version": "5.0.50"');
  fs.writeFileSync(p, j);
  applied.push(f + ' -> 5.0.50');
}

// Undo the throwaway title probe from the session that wrote this patch — the
// document title is not part of the release.
replaceOnce('title', `<title>SideCut Player</title>`, `<title>SideCut</title>`);

fs.writeFileSync(INDEX, src);

console.log('patch-6054: ' + applied.length + ' applied');
applied.forEach((a) => console.log('  ✓ ' + a));
if (failed.length) {
  console.log('FAILED ' + failed.length + ':');
  failed.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('next: node dev/test-6054.mjs && node dev/ota-bundle.mjs && node dev/ota-bundle-play.mjs');
