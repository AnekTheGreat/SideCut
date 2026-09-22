#!/usr/bin/env node
// v60.5.3 — two reported problems:
//
// A. "Albums didn't reappear with the OTA update." The 60.5.2 album fix lives
//    in importLibrary — it only runs while IMPORTING a zip. Their albums were
//    already imported (broken, by the pre-fix build) and an OTA cannot unbreak
//    data that is already written: every album still holds the exporting
//    phone's track ids, resolves to zero local songs, and the card renderer
//    skips it. Fix: scHealBrokenAlbums() runs on every boot from loadFromDB —
//    any album whose ids are ALL dead is rebuilt from the album tag on the
//    files; partially-dead lists drop what cannot resolve. Hand-made albums
//    that are not file-tag groups still need one re-import of the zip (exact
//    restore) — the failure messages and patch notes say so.
//
// B. "Spotify converter and YouTube converter isn't working for full apk."
//    Everything that can be verified from here works (youtubei search 17 hits,
//    player ANDROID OK/29 streams, googlevideo range 206, both CDNs 200), and
//    the CI injector is gated to the play matrix job only — so the likely
//    cause is the WRONG APK: both CI artifacts contain an identically-named
//    SideCut-5.0.49.apk, and the release APK (flag set) hides the YouTube card
//    and sends Spotify to licensed-only search — exactly this symptom.
//    Fixes: the version line now names the flavor (Full/Play build), CI files
//    carry the flavor in their names (…-full.apk / …-release.apk), and the
//    converter failures now name the STEP that failed (no streams / stream
//    blocked / encoder missing, incl. a blocked-CDN lamejs, plus the last step
//    the Spotify flow reached) with an mp3-encoder mirror retry.
//
// C. Legality hole: csShowExternal still hands Spotisaver/SpotMate ripper
//    links in the PLAY build when its licensed search misses. Gated off there
//    (full build keeps its hand-off).
//
// Zero backslashes in this file — every anchor was checked unique (count 1).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'index.html');
let src = fs.readFileSync(file, 'utf8');
const NL = String.fromCharCode(10);

let applied = 0;
const failed = [];

function replaceOnce(name, oldStr, newStr){
  const first = src.indexOf(oldStr);
  if(first === -1){ failed.push(name + ': anchor not found'); return; }
  if(src.indexOf(oldStr, first + 1) !== -1){ failed.push(name + ': anchor not unique'); return; }
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  applied++;
}

const nowEdt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
}).format(new Date()).replace(' at ', ' · ') + ' EDT';

// 1 — version
replaceOnce('APP_VERSION', "const APP_VERSION = '60.5.2';", "const APP_VERSION = '60.5.3';");

// 2 — changelog entry (ship time = ICU time at patch run; bundled right after)
replaceOnce('changelog 60.5.3',
`  const CHANGELOG = [
`,
`  const CHANGELOG = [
  { version: '60.5.3', date: '${nowEdt}', title: 'Albums rebuild themselves on open · failures now name their step · build flavor on display', items: [
    'Albums rebuilt on open: an album imported by a build older than 60.5.2 still held the old phone’s song ids, so the Albums tab stayed empty even after the update carried the fix — the fix lived in the importer, but that data was already imported. Every dead album is now rebuilt at boot from the songs’ own album tags; hand-made albums that are not file-tag groups come back exactly by importing the backup zip once more.',
    'The version line now names the build — Full build or Play build — so a converter that seems dead can be checked against which APK is actually installed, and Android artifacts carry their flavor in the filename (…-full.apk / …-release.apk) so the two can no longer be swapped by mistake.',
    'Converter failures now say WHICH step failed: YouTube returned no streams, the stream would not download or decode, or the encoder produced nothing — with an explicit note when the MP3 encoder never loaded from a blocked CDN, and a mirror retry (jsdelivr, unpkg) before that verdict.',
    'The Spotify converter shows the last step it reached before failing instead of falling back silently.',
    'The Play build no longer offers outside converter sites when its licensed catalog misses a track — it says so and points at + Add songs. The full build keeps its hand-off.',
  ] },
`);

// 3 — build flavor on the version line
replaceOnce('flavor label',
"      $('currentVersionLabel').textContent = `SideCut v${APP_VERSION}`;",
"      $('currentVersionLabel').textContent = `SideCut v${APP_VERSION} · ${SC_IS_PLAY ? 'Play build — licensed sources' : 'Full build — all sources'}`;");

// 4 — album heal function (before the album helpers)
replaceOnce('heal function',
`  function albumIsAuto(name){`,
`  // ---------------- Album heal: ids from another device ----------------
  // A backup imported by a build older than 60.5.2 left albums holding the
  // EXPORTING phone's track ids. Those resolve to nothing here, the card
  // renderer skips an album whose tracks do not resolve, and the Albums tab
  // stayed empty even after the OTA carried the importer fix — this data was
  // already imported. So on every boot: an album whose ids are ALL dead is
  // rebuilt from the album tag on the files (the same source the automatic
  // album paths use), and a partially-dead list drops what cannot resolve.
  // A hand-made album whose name is not a file tag cannot be rebuilt without
  // its zip — importing the backup again on 60.5.2 or newer restores those
  // exactly. No-op on a healthy library.
  function scHealBrokenAlbums(){
    var healed = 0;
    var byTag = null;
    Object.keys(userAlbums || {}).forEach(function(n){
      var e = userAlbums[n];
      if(!e || !Array.isArray(e.trackIds) || !e.trackIds.length) return;
      var live = e.trackIds.filter(function(id){
        return allTracks.some(function(t){ return t.id === id; });
      });
      if(live.length){
        if(live.length !== e.trackIds.length){ e.trackIds = live; healed++; }
        return;
      }
      if(!byTag){
        byTag = {};
        allTracks.forEach(function(t){
          var tag = String(t.album || '').trim();
          if(!tag) return;
          if(!byTag[tag]) byTag[tag] = [];
          byTag[tag].push(t.id);
        });
      }
      var rebuilt = byTag[n];
      if(rebuilt && rebuilt.length){ e.trackIds = rebuilt.slice(); healed++; }
    });
    if(healed){ dbPut('meta', { key: 'userAlbums', value: userAlbums }); }
    return healed;
  }
  // ---- end scHealBrokenAlbums ----
  function albumIsAuto(name){`);

// 5 — heal call at boot, right after the albums load
replaceOnce('heal call site',
`    userAlbums = metaMap.userAlbums || {};
    albumOrder = Array.isArray(metaMap.albumOrder)
      ? metaMap.albumOrder.filter(function(n){ return typeof n === 'string'; })
      : [];`,
`    userAlbums = metaMap.userAlbums || {};
    albumOrder = Array.isArray(metaMap.albumOrder)
      ? metaMap.albumOrder.filter(function(n){ return typeof n === 'string'; })
      : [];
    // Rebuild albums left holding a previous device's track ids (imports from
    // before 60.5.2) so the Albums tab reappears after the OTA with no zip.
    try{ scHealBrokenAlbums(); }catch(_eHeal){}`);

// 6 — lamejs mirror loader, in front of the YouTube converter
replaceOnce('lamejs loader',
`  // ─── YouTube to MP3 converter ───`,
`  // The MP3 encoder (lamejs) rides in from a CDN. If that script never
  // loaded — blocked CDN, flaky network — MP3, the DEFAULT format of both
  // converters, fails AFTER a perfectly good download with no clue why.
  // Retry the usual mirrors once before declaring the encoder gone.
  window.__scEnsureLamejs = (function(){
    var pending = null;
    return function(){
      try{ if(typeof lamejs !== 'undefined') return Promise.resolve(true); }catch(_e0){}
      if(pending) return pending;
      var mirrors = [
        'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
        'https://unpkg.com/lamejs@1.2.1/lame.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
      ];
      pending = new Promise(function(resolve){
        var i = 0;
        (function next(){
          try{ if(typeof lamejs !== 'undefined'){ resolve(true); return; } }catch(_e1){}
          if(i >= mirrors.length){ resolve(false); return; }
          var s = document.createElement('script');
          s.src = mirrors[i++];
          s.onload = function(){
            try{ if(typeof lamejs !== 'undefined'){ resolve(true); return; } }catch(_e2){}
            next();
          };
          s.onerror = next;
          document.head.appendChild(s);
        })();
      }).then(function(ok){ if(!ok) pending = null; return ok; });
      return pending;
    };
  })();
  // ─── YouTube to MP3 converter ───`);

// 7 — YouTube: failure reasons (player / decode)
replaceOnce('yt reasons head',
`    async function tryYtAudioFormat(fmt){
      var audio = await scYtPlayer(videoId);
      if(!audio) return null;
      var dec = await scFetchDecode(audio);
      if(!dec) return null;`,
`    async function tryYtAudioFormat(fmt){
      var audio = await scYtPlayer(videoId);
      if(!audio){ _ytFails.push(fmt.toUpperCase() + ': YouTube returned no streams — the video is unavailable or this network is blocking YouTube'); return null; }
      var dec = await scFetchDecode(audio);
      if(!dec){ _ytFails.push(fmt.toUpperCase() + ': the audio stream would not download or decode (blocked or capped network)'); return null; }`);

// 8 — YouTube: encoder reason + lamejs ensure before the mp3 attempt
replaceOnce('yt encoder reason',
`      var blob = null;
      try{ blob = await scEncodeAudio(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null }); }
      catch(_encErr){ blob = null; }
      if(!blob) return null;`,
`      var blob = null;
      if(fmt === 'mp3' && typeof lamejs === 'undefined'){ await window.__scEnsureLamejs(); }
      try{ blob = await scEncodeAudio(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null }); }
      catch(_encErr){ blob = null; }
      if(!blob){ _ytFails.push(fmt.toUpperCase() + ': the encoder produced nothing' + ((fmt === 'mp3' && typeof lamejs === 'undefined') ? ' — the MP3 encoder (lamejs) never loaded, which means a blocked CDN' : '')); return null; }`);

// 9 — YouTube: reason collector variable
replaceOnce('yt fails var',
`    var ytAuthor = '';`,
`    var ytAuthor = '';
    var _ytFails = [];`);

// 10 — YouTube: panel shows the real reason
replaceOnce('yt panel reason',
`              '<div style="font-size:10px; color:var(--gold); margin-bottom:4px;">⚠ Couldn’t convert this video in-app.</div>' +`,
`              '<div style="font-size:10px; color:var(--gold); margin-bottom:4px;">⚠ ' + (_ytFails.length ? _ytFails[_ytFails.length - 1] : 'Couldn’t convert this video in-app.') + '</div>' +`);

// 11 — YouTube: toast carries it too
replaceOnce('yt toast reason',
`          toast('Couldn’t convert that video — try another link.', 4000);`,
`          toast(_ytFails.length ? ('Conversion failed — ' + _ytFails[_ytFails.length - 1]) : 'Couldn’t convert that video — try another link.', 4000);`);

// 12 — shared cooperative encoder: ensure lamejs once for every mp3 path
replaceOnce('cooperative ensure',
`  async function scEncodeAudioCooperative(buf, fmt, meta, onSlice){
    try{
      if(fmt === 'mp3') return await scEncodeMp3Cooperative(buf, meta, onSlice);`,
`  async function scEncodeAudioCooperative(buf, fmt, meta, onSlice){
    try{
      if(fmt === 'mp3' && typeof lamejs === 'undefined'){ await window.__scEnsureLamejs(); }
      if(fmt === 'mp3') return await scEncodeMp3Cooperative(buf, meta, onSlice);`);

// 13 — Spotify: status collector declared in the flow scope
replaceOnce('sp status decl',
`    csFetchMeta().catch(function(){}).then(function(){`,
`    var _spLastStatus = '';
    csFetchMeta().catch(function(){}).then(function(){`);

// 14 — Spotify: capture the last status and pass it to the fallback
replaceOnce('sp status capture',
`      return scSpToBuffer(csMeta, function(txt){ csSetStatus(txt); }).then(function(res){
        if(!res || !res.buffer){ csShowExternal(); return; }`,
`      return scSpToBuffer(csMeta, function(txt){ if(txt) _spLastStatus = txt; csSetStatus(txt); }).then(function(res){
        if(!res || !res.buffer){ csShowExternal(_spLastStatus); return; }`);

// 15 — Spotify: the rejection path carries it too
replaceOnce('sp catch status',
`.catch(function(){ csShowExternal(); })`,
`.catch(function(){ csShowExternal(_spLastStatus); })`);

// 16 — Spotify: play build loses the ripper hand-off; signature takes why
replaceOnce('sp external play gate',
`    function csShowExternal(){`,
`    function csShowExternal(why){
      // The Play build must never hand a user ripper sites — its licensed
      // search missing a track is a catalog limit, not a failure to paper
      // over with outside converters. The full build keeps its hand-off.
      if(SC_IS_PLAY){
        if(resultEl){
          resultEl.style.display = 'block';
          resultEl.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;">' + csThumb() + '<div style="flex:1; min-width:0;"><div style="font-weight:600; color:var(--ink); margin-bottom:2px; font-size:12px;">' + csTitle() + '</div>' + csMetaLine() + '<div style="font-size:10px; color:var(--gold); margin-bottom:4px;">⚠ Not in the openly-licensed catalogs ' + (why ? '(' + why + ')' : '') + ' — use + Add songs to import a file you have.</div></div></div>';
        }
        toast('Not in the licensed catalogs — import a file you have.', 4000);
        return;
      }`);

// 17 — Spotify: show the last step in the full build's fallback panel
replaceOnce('sp why line',
`          '<div style="margin-top:6px;"><button class="sp-retry-conv" style="padding:5px 12px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;">↻ Try again</button></div>' +`,
`          (why ? '<div style="font-size:10px; color:var(--coral); margin-bottom:4px;">Last step: ' + why + '</div>' : '') +
          '<div style="margin-top:6px;"><button class="sp-retry-conv" style="padding:5px 12px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;">↻ Try again</button></div>' +`);

// 18 — Spotify: toast carries the reason
replaceOnce('sp toast reason',
`      toast('In-app conversion unavailable — opened external options.', 4000);`,
`      toast(why ? ('In-app conversion unavailable — ' + why) : 'In-app conversion unavailable.', 4000);`);

if(failed.length){
  console.error('ABORT — nothing written. ' + failed.length + ' problem(s):');
  failed.forEach(f => console.error('  X ' + f));
  process.exit(1);
}
fs.writeFileSync(file, src);
console.log('60.5.3 patch: ' + applied + '/18 applied  (changelog date: ' + nowEdt + ')');

const checks = [
  ['APP_VERSION is 60.5.3', src.includes("const APP_VERSION = '60.5.3';")],
  ['changelog 60.5.3 present', src.includes("version: '60.5.3'")],
  ['heal function present', src.includes('function scHealBrokenAlbums(){') && src.includes('end scHealBrokenAlbums')],
  ['heal called at boot', src.includes('try{ scHealBrokenAlbums(); }catch(_eHeal){}')],
  ['flavor label on version line', src.includes('Play build — licensed sources')],
  ['lamejs mirror loader defined', src.includes('window.__scEnsureLamejs = (function(){')],
  ['lamejs ensured in YouTube path', (() => {
    const f = src.indexOf('async function tryYtAudioFormat');
    return f !== -1 && src.indexOf('await window.__scEnsureLamejs(); }', f) !== -1;
  })()],
  ['lamejs ensured in cooperative encoder', (() => {
    const f = src.indexOf('async function scEncodeAudioCooperative');
    return f !== -1 && src.indexOf('await window.__scEnsureLamejs(); }', f) !== -1;
  })()],
  ['yt failure reasons present', src.includes('_ytFails.push') && src.includes('_ytFails.length - 1')],
  ['spotify status wiring', src.includes('csShowExternal(_spLastStatus)') && src.includes('Last step: ')],
  ['play gate inside csShowExternal', (() => {
    const f = src.indexOf('function csShowExternal(why){');
    const rip = src.indexOf('spotisaver.net', f);
    return f !== -1 && rip !== -1 && src.slice(f, rip).includes('SC_IS_PLAY');
  })()],
];
let bad = 0;
checks.forEach(([n, c]) => { console.log((c ? '  PASS ' : '  FAIL ') + n); if(!c) bad++; });
process.exit(bad ? 1 : 0);
