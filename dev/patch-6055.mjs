// v60.5.5 — one counted, atomic patch:
//   1. Download prompts ("Open my library", the finish banner, the home bubble)
//      open the Library in Playlists/All Songs instead of the last-used view
//      (usually Albums).
//   2. A Cancel button on the converting pill stops a run in progress; the flag
//      is honoured by the batch loop, the search/verify/download pipeline and
//      both single-song converters.
//   3. [FULL]-marked changelog items only exist in the full build's notes: the
//      in-app renderers filter them for the other build and strip the marker
//      for this one; the OTA bundlers do the same per channel.
//   4. Background battery: RGB/RGB+ timers stop while hidden, the OTA resume
//      check is throttled to 30 minutes, the SW refresh skips while hidden,
//      the widget poll halves, the sleep readout and test ticker sleep hidden.
//   5. Version 60.5.5 / package 5.0.51, both OTA channels rebuilt later.
//
// Every replacement is counted: a missed or ambiguous anchor fails loudly.
import fs from 'node:fs';

let edits = 0, failed = 0;
function apply(path, oldStr, newStr, label, expected = 1) {
  const src = fs.readFileSync(path, 'utf8');
  let n = 0, i = src.indexOf(oldStr);
  while (i !== -1) { n++; i = src.indexOf(oldStr, i + oldStr.length); }
  if (n !== expected) {
    failed++;
    console.error(`MISS(${n}/${expected}) [${label}] in ${path}`);
    return;
  }
  let out = '', rest = src, replaced = 0;
  while (replaced < expected) {
    const at = rest.indexOf(oldStr);
    out += rest.slice(0, at) + newStr;
    rest = rest.slice(at + oldStr.length);
    replaced++;
  }
  out += rest;
  fs.writeFileSync(path, out);
  edits++;
  console.log(`ok  [${label}] x${n}`);
}
function assertContains(path, needle, label, expected = true) {
  const src = fs.readFileSync(path, 'utf8');
  const has = src.includes(needle);
  if (has !== expected) { failed++; console.error(`FAIL [${label}] contains=${has} want=${expected}`); }
  else console.log(`ok  [${label}]`);
}
function count(path, needle) {
  const src = fs.readFileSync(path, 'utf8');
  let n = 0, i = src.indexOf(needle);
  while (i !== -1) { n++; i = src.indexOf(needle, i + needle.length); }
  return n;
}

const HTML = 'index.html';
const DATE = 'September 23, 2026 · 1:40 AM EDT';

// ── 1. version bump ─────────────────────────────────────────────────────────
apply(HTML, "const APP_VERSION = '60.5.4';", "const APP_VERSION = '60.5.5';", 'APP_VERSION');
apply('sw.js', "const CACHE_NAME = 'sidecut-shell-v60.5.4';", "const CACHE_NAME = 'sidecut-shell-v60.5.5';", 'sw cache');
apply('package.json', '  "version": "5.0.50",', '  "version": "5.0.51",', 'package version');

// ── 2. new changelog entry (2 [FULL]-marked download items + 4 shared) ─────
apply(HTML,
`  const CHANGELOG = [
  { version: '60.5.4',`,
`  const CHANGELOG = [
  { version: '60.5.5', date: '${DATE}', title: 'Download prompts open the Library, Cancel on every run, calmer background', items: [
    '[FULL] After a download the prompts really open the Library: "Open my library" and the finish banner landed on whatever view the Library tab was last left in — usually Albums — so the song that had just been added was nowhere in sight. Both now switch to Playlists on All Songs first, so the track you just saved is on screen; tapping the finished banner does the same.',
    '[FULL] Every converting banner carries a Cancel button while it runs — one tap stops the run where it is. What already converted stays in your library, the rest is marked cancelled, and Retry still covers anything that had already failed. Cancelling also stops the search, verify and download loop on its very next step instead of finishing the whole queue.',
    'RGB and RGB+ themes now stand completely still while the app is hidden: the colour-cycle timer and the bass-glow loop stop on background and restart exactly where they left off when you come back. The hue is computed from the wall clock, so nothing freezes on a stale colour and nothing snaps back.',
    'Update checks stop waking the radio for nothing: coming back to the app only checks when the last check is at least 30 minutes old, and the service-worker refresh skips while hidden. A manual Check for updates still runs immediately.',
    'The widget playlist poll listens every 10 seconds instead of 5 — half the native bridge calls for as long as the app was open.',
    'The sleep-timer readout and the test-mode ticker now sleep while the app is hidden instead of writing to a screen nobody is looking at.',
  ] },
  { version: '60.5.4',`,
'changelog 60.5.5 entry');

// ── 3. changelogItems helper + every renderer uses it ──────────────────────
apply(HTML,
`      'Beat repeat pads fixed using native sample-accurate looping',
    ]},
  ];
  function renderWhatsNewBody(entry){`,
`      'Beat repeat pads fixed using native sample-accurate looping',
    ]},
  ];
  // [FULL] marks an item that only belongs to the full build (anything about
  // downloads). The full build shows those items with the marker stripped; the
  // other build never sees them at all — in the what's-new popup, the update
  // log and the notification bell alike.
  function changelogItems(entry){
    var list = (entry && entry.items) || [];
    var out = [];
    for(var _ci = 0; _ci < list.length; _ci++){
      var it = list[_ci];
      if(typeof it === 'string' && it.indexOf('[FULL] ') === 0){
        var _isPlay = false;
        try{ _isPlay = !!(window.__PLAY_BUILD__ || (typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY)); }catch(_pe){}
        if(_isPlay) continue;
        it = it.slice(7);
      }
      out.push(it);
    }
    return out;
  }
  function renderWhatsNewBody(entry){`,
'changelogItems helper');

apply(HTML, 'entry.items.map', 'changelogItems(entry).map', 'renderer .map', 3);
apply(HTML, 'entry.items.length', 'changelogItems(entry).length', 'renderer .length', 4);
apply(HTML, 'entry.items.slice(0, 3)', 'changelogItems(entry).slice(0, 3)', 'whatsNew slice', 1);
apply(HTML, 'latest.items.length', 'changelogItems(latest).length', 'bell count', 2);

// ── 4. scOpenLibraryAfterDownload helper ───────────────────────────────────
apply(HTML,
`  var scConvertPillState = { el: null, timer: null };`,
`  // Open the Library in the state a finished download needs: Playlists view on
  // All Songs. The prompts used to call navigate('library') straight, which
  // landed on whatever view the tab was last left in — usually Albums, where
  // the song that was just added is not.
  function scOpenLibraryAfterDownload(){
    try{ closeDiscoverPopup(); }catch(_cp){}
    try{
      libraryMode = 'playlists';
      reorderMode = false;
      activePlaylist = 'All Songs';
      if(typeof dbPut === 'function') dbPut('meta', { key: 'libraryMode', value: libraryMode });
      var _plH = document.getElementById('playlistsHalf');
      var _alH = document.getElementById('albumsHalf');
      if(_plH) _plH.classList.add('active-half');
      if(_alH) _alH.classList.remove('active-half');
      if(typeof applyLibraryButtonMode === 'function') applyLibraryButtonMode();
    }catch(_ap){}
    navigate('library');
    try{ renderTabs(); }catch(_rt){}
  }
  var scConvertPillState = { el: null, timer: null };`,
'scOpenLibraryAfterDownload helper');

// ── 5. pill: cancel button + reusable state + tap-to-open when done ────────
apply(HTML,
`    document.body.appendChild(pill);
    scConvertPillState.el = pill;
    return pill;
  }`,
`    pill.innerHTML += '<button class="sc-pill-cancel" style="flex-shrink:0;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:10.5px;font-weight:600;cursor:pointer;">Cancel</button>';
    document.body.appendChild(pill);
    var cancelBtn = pill.querySelector('.sc-pill-cancel');
    if(cancelBtn) cancelBtn.addEventListener('click', function(){
      window.__scCancelDl = true;
      cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelling…';
      var cSub = pill.querySelector('.sc-pill-sub');
      if(cSub) cSub.textContent = 'Stopping — what already finished stays in your library';
    });
    scConvertPillState.el = pill;
    return pill;
  }`,
'pill cancel button');

apply(HTML,
`  function scConvertPillUpdate(title, sub, pct){
    var pill = scConvertPill(true);
    if(!pill) return;`,
`  function scConvertPillUpdate(title, sub, pct){
    var pill = scConvertPill(true);
    if(!pill) return;
    // A reused pill may still carry a previous run's done-state: drop the
    // tap-to-open handler, bring the Cancel button back, and cancel the
    // auto-hide timer so it cannot vanish mid-run.
    pill.onclick = null; pill.style.cursor = '';
    var _rpc = pill.querySelector('.sc-pill-cancel');
    if(_rpc){ _rpc.style.display = ''; _rpc.disabled = false; _rpc.textContent = 'Cancel'; }
    if(scConvertPillState.timer){ clearTimeout(scConvertPillState.timer); scConvertPillState.timer = null; }`,
'pill update reset');

apply(HTML,
`    if(b) b.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';`,
`    if(b && typeof pct === 'number') b.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';`,
'pill pct optional');

apply(HTML,
`    var s = pill.querySelector('.sc-pill-sub');
    if(s) s.textContent = 'Tap the bell or open your library to see them';
    var b = pill.querySelector('.sc-pill-bar');
    if(b) b.style.width = '100%';`,
`    var s = pill.querySelector('.sc-pill-sub');
    var pc = pill.querySelector('.sc-pill-cancel');
    if(pc){ pc.style.display = 'none'; }
    var _dtxt = String(text || '');
    var _opened = /library|added/i.test(_dtxt) && !/could not/i.test(_dtxt);
    if(s) s.textContent = _opened ? 'Tap here to open your library — All Songs' : 'See the \\uD83D\\uDD14 bell for details';
    pill.style.cursor = _opened ? 'pointer' : '';
    pill.onclick = _opened ? function(){ scConvertPill(false); scOpenLibraryAfterDownload(); } : null;
    var b = pill.querySelector('.sc-pill-bar');
    if(b) b.style.width = '100%';`,
'pill done tap-to-open');

// ── 6. batch run: reset flag, honour it, report it ─────────────────────────
apply(HTML,
`    var tracks = (chosenTracks && chosenTracks.length) ? chosenTracks.slice() : ((plan && plan.tracks) || []);
    if(!tracks.length) return false;`,
`    var tracks = (chosenTracks && chosenTracks.length) ? chosenTracks.slice() : ((plan && plan.tracks) || []);
    if(!tracks.length) return false;
    window.__scCancelDl = false;`,
'batch reset flag');

apply(HTML,
`      function rowStatus(txt){ if(stateEl) stateEl.textContent = txt; }
      var out = null;`,
`      function rowStatus(txt){ if(stateEl) stateEl.textContent = txt; }
      if(window.__scCancelDl){
        if(stateEl){ stateEl.textContent = '— cancelled'; stateEl.style.color = 'var(--ink-dim)'; }
        tracksDone[i] = false;
        continue;
      }
      var out = null;`,
'batch loop cancel check');

apply(HTML,
`      } else {
        failCount++;
        failedNames.push((meta.title || 'Untitled') + ((out && out.reason) ? ' (' + out.reason + ')' : ''));
        if(stateEl){ stateEl.textContent = '✗ ' + ((out && out.reason) ? out.reason : 'failed'); stateEl.style.color = '#f87171'; }
      }`,
`      } else if(out && out.reason === 'cancelled'){
        tracksDone[i] = false;
        if(stateEl){ stateEl.textContent = '— cancelled'; stateEl.style.color = 'var(--ink-dim)'; }
      } else {
        failCount++;
        failedNames.push((meta.title || 'Untitled') + ((out && out.reason) ? ' (' + out.reason + ')' : ''));
        if(stateEl){ stateEl.textContent = '✗ ' + ((out && out.reason) ? out.reason : 'failed'); stateEl.style.color = '#f87171'; }
      }`,
'batch cancelled not failed');

apply(HTML,
`      await new Promise(function(r){ setTimeout(r, 800); });  // pacing: never hammer the search APIs`,
`      if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 800); });  // pacing: never hammer the search APIs`,
'batch pacing skipped after cancel');

apply(HTML,
`    if(wantZip && zip && okCount > 0){`,
`    var _cancelledRun = !!window.__scCancelDl;
    if(wantZip && zip && okCount > 0){`,
'batch cancelled flag captured');

apply(HTML,
`    } else {
      if(subEl) subEl.textContent = 'Done — ' + okCount + ' in your library' + (failCount ? ' · ' + failCount + ' failed' : '');
    }`,
`    } else {
      if(subEl) subEl.textContent = (_cancelledRun ? 'Stopped — ' : 'Done — ') + okCount + ' in your library' + (failCount ? ' · ' + failCount + ' failed' : '');
    }`,
'batch sub says Stopped');

apply(HTML,
`    scConvertPillDone(okCount + ' song' + (okCount === 1 ? '' : 's') + ' added to your library'
      + (wantZip ? ' · ZIP saved' : (alsoSaveFiles ? ' · files saved' : ''))
      + (failCount ? ' · ' + failCount + ' failed' : ''));
    toast(okCount + '/' + tracks.length + ' songs are in your library (All songs)'`,
`    scConvertPillDone((_cancelledRun ? 'Cancelled — ' : '') + okCount + ' song' + (okCount === 1 ? '' : 's') + ' added to your library'
      + (wantZip ? ' · ZIP saved' : (alsoSaveFiles ? ' · files saved' : ''))
      + (failCount ? ' · ' + failCount + ' failed' : ''));
    toast((_cancelledRun ? 'Cancelled — ' : '') + okCount + '/' + tracks.length + ' songs are in your library (All songs)'`,
'batch done/toast say Cancelled');

// ── 7. every "open my library" prompt uses the helper ──────────────────────
apply(HTML,
`      if(libBtn) libBtn.addEventListener('click', function(){
        resultEl.innerHTML = ''; resultEl.style.display = 'none';
        try{ closeDiscoverPopup(); }catch(_cp){}
        try{ if(activePlaylist !== 'All Songs'){ activePlaylist = 'All Songs'; renderTabs(); } }catch(_ap){}
        navigate('library');
      });`,
`      if(libBtn) libBtn.addEventListener('click', function(){
        resultEl.innerHTML = ''; resultEl.style.display = 'none';
        scOpenLibraryAfterDownload();
      });`,
'batch Open my library');

apply(HTML,
`$('hbCtaLibrary').addEventListener('click', () => { closeHomeBubble(); navigate('library'); });`,
`$('hbCtaLibrary').addEventListener('click', () => { closeHomeBubble(); scOpenLibraryAfterDownload(); });`,
'home bubble Open Playlists');

// ── 8. single YouTube converter: pill + cancel ─────────────────────────────
apply(HTML,
`    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
    // Update the status line live so the user can see the fallback move MP3 -> WAV.
    function setStatus(txt){
      if(resultEl){
        var st = resultEl.querySelector('.dp-yt-status');
        if(st) st.textContent = txt;
      }
    }`,
`    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
    window.__scCancelDl = false;
    scConvertPillUpdate('Converting · YouTube', 'Starting…', 15);
    // Update the status line live so the user can see the fallback move MP3 -> WAV.
    function setStatus(txt){
      if(resultEl){
        var st = resultEl.querySelector('.dp-yt-status');
        if(st) st.textContent = txt;
      }
      if(txt) scConvertPillUpdate('Converting · ' + (title || 'YouTube'), txt);
    }`,
'yt converter pill + reset');

apply(HTML,
`      return chain.then(function(done){
        if(done) return true;
          // Conversion failed for this video. The old version handed the link`,
`      return chain.then(function(done){
        if(done) return true;
          if(window.__scCancelDl){
            if(resultEl){
              resultEl.style.display = 'block';
              resultEl.innerHTML = '<div style="font-size:11px;color:var(--ink-dim);">Cancelled — nothing was added.</div>';
            }
            scConvertPillDone('Conversion cancelled');
            return false;
          }
          // Conversion failed for this video. The old version handed the link`,
'yt cancelled branch');

// ── 9. single Spotify converter: pill + cancel ─────────────────────────────
apply(HTML,
`    var csMeta = { title: '', artist: '', album: '', thumb: '', year: '', genre: '', track: '', seconds: 0, _aiUsed: false };
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }`,
`    var csMeta = { title: '', artist: '', album: '', thumb: '', year: '', genre: '', track: '', seconds: 0, _aiUsed: false };
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
    window.__scCancelDl = false;
    scConvertPillUpdate('Converting · Spotify', 'Fetching track info…', 15);`,
'sp converter pill + reset');

apply(HTML,
`    function csSetStatus(txt){
      if(resultEl){ var st = resultEl.querySelector('.dp-cs-status'); if(st) st.textContent = txt; }
    }`,
`    function csSetStatus(txt){
      if(resultEl){ var st = resultEl.querySelector('.dp-cs-status'); if(st) st.textContent = txt; }
      if(txt) scConvertPillUpdate('Converting · ' + (csMeta.title || 'Spotify'), txt);
    }`,
'sp status mirrors pill');

apply(HTML,
`      return scSpToBuffer(csMeta, function(txt){ if(txt) _spLastStatus = txt; csSetStatus(txt); }).then(function(res){
        if(!res || !res.buffer){ csShowExternal(_spLastStatus); return; }
        if(useFmt){ csRenderSinglePicked(res.buffer, res.streamUrl, useFmt); return; }
        csRenderFormats(res.buffer, res.streamUrl);
      });
    }).catch(function(){ csShowExternal(_spLastStatus); }).finally(function(){`,
`      return scSpToBuffer(csMeta, function(txt){ if(txt) _spLastStatus = txt; csSetStatus(txt); }).then(function(res){
        if(window.__scCancelDl && (!res || !res.buffer)){
          if(resultEl){ resultEl.style.display = 'block'; resultEl.innerHTML = '<div style="font-size:11px;color:var(--ink-dim);">Cancelled — nothing was added.</div>'; }
          scConvertPillDone('Conversion cancelled');
          return;
        }
        if(!res || !res.buffer){ csShowExternal(_spLastStatus); return; }
        if(useFmt){ csRenderSinglePicked(res.buffer, res.streamUrl, useFmt); return; }
        csRenderFormats(res.buffer, res.streamUrl);
      });
    }).catch(function(){ if(window.__scCancelDl){ scConvertPillDone('Conversion cancelled'); return; } csShowExternal(_spLastStatus); }).finally(function(){`,
'sp cancelled branches');

// ── 10. Discover "Save/Get song" flow: pill + cancel + open-library done ───
apply(HTML,
`      var out = await scConvertOneTrack(meta, fmt, function(){});
      if(!out || !out.ok) return false;   // caller falls back to the Spotify handoff`,
`      window.__scCancelDl = false;
      scConvertPillUpdate('Saving · ' + (r.trackName || 'song'), 'Finding the audio…', 15);
      var out = await scConvertOneTrack(meta, fmt, function(txt){ if(txt) scConvertPillUpdate('Saving · ' + (r.trackName || 'song'), txt); });
      if(!out || !out.ok){
        if((out && out.reason === 'cancelled') || window.__scCancelDl){ scConvertPillDone('Cancelled — nothing was added'); return false; }
        return false;   // caller falls back to the Spotify handoff
      }`,
'get-song pill + cancel');

apply(HTML,
`      return true;
    }catch(e){
      toast('Get song failed — ' + ((e && e.message) || 'try again.'), 3500);`,
`      scConvertPillDone((r.trackName || 'The song') + ' is in your library');
      return true;
    }catch(e){
      toast('Get song failed — ' + ((e && e.message) || 'try again.'), 3500);`,
'get-song success pill');

// ── 11. pipeline cancel checks ─────────────────────────────────────────────
apply(HTML,
`  async function scConvertOneTrack(meta, fmt, onStatus){
    window.__scSourceFail = '';`,
`  async function scConvertOneTrack(meta, fmt, onStatus){
    window.__scSourceFail = '';
    if(window.__scCancelDl) return { ok: false, reason: 'cancelled' };`,
'scConvertOneTrack guard');

apply(HTML,
`    if(!query) return null;`,
`    if(!query) return null;
    if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }`,
'scSpToBuffer top check');

apply(HTML,
`    for(var ci = 0; ci < cands.length && ci < 10; ci++){`,
`    for(var ci = 0; ci < cands.length && ci < 10; ci++){
      if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }`,
'scSpToBuffer verify-loop check');

apply(HTML,
`    for(var vi = 0; vi < verified.length && vi < 4; vi++){`,
`    for(var vi = 0; vi < verified.length && vi < 4; vi++){
      if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }`,
'scSpToBuffer decode-loop check');

apply(HTML,
`    var list = [{ url: stream.url, size: stream.size, muxed: stream.muxed }].concat(stream.alts || []);
    for(var i = 0; i < list.length; i++){`,
`    var list = [{ url: stream.url, size: stream.size, muxed: stream.muxed }].concat(stream.alts || []);
    for(var i = 0; i < list.length; i++){
      if(window.__scCancelDl) return null;`,
'scFetchDecode check');

apply(HTML,
`    while(off < SC_AUDIO_MAX){`,
`    while(off < SC_AUDIO_MAX){
      if(window.__scCancelDl) break;`,
'scFetchBytes check');

// ── 12. battery: RGB/RGB+ stand down while hidden ──────────────────────────
apply(HTML,
`    rgbAnimHandle = setInterval(rgbTick, RGB_TICK_MS);
  }`,
`    rgbAnimHandle = setInterval(rgbTick, RGB_TICK_MS);
  }
  // Background stand-down: with the app hidden the colour-cycle timer and the
  // bass-glow loop have nothing to paint, so they stop instead of running all
  // night; coming back restarts them exactly as the theme switch would (the
  // hue comes from the wall clock, so no stale colour and no snap-back).
  document.addEventListener('visibilitychange', function(){
    try{
      var thRGB = THEMES[currentTheme] || {};
      if(document.hidden){
        stopRgbAnimation();
        stopGlowSync();
      } else {
        if(thRGB.rgb) startRgbAnimation();
        if(thRGB.rgbPlus){ var aRGB = activeAudio(); if(aRGB && !aRGB.paused) startGlowSync(); }
      }
    }catch(_ve){}
  });`,
'rgb/glow hidden stand-down');

apply(HTML,
`        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);`,
`        setInterval(() => { if(document.visibilityState === 'hidden') return; reg.update().catch(() => {}); }, 30 * 60 * 1000);`,
'SW refresh skips while hidden');

apply(HTML,
`    }, 5000);  // was 2s: a native bridge call every two seconds for as long as the app was open`,
`    }, 10000);  // was 5s (and before that 2s): a native bridge call for as long as the app was open`,
'widget poll halved');

apply(HTML,
`  function updateSleepTimerReadout(){
    const el = $('sleepTimerReadout');`,
`  function updateSleepTimerReadout(){
    if(document.hidden) return; // nothing on screen to update
    const el = $('sleepTimerReadout');`,
'sleep readout hidden guard');

apply(HTML,
`    setInterval(function(){ try{ if(window.__scTestMode && window.__scTestMode()) window.__scShowWidgetDebug(); }catch(_){} }, 1500);`,
`    setInterval(function(){ try{ if(document.hidden) return; if(window.__scTestMode && window.__scTestMode()) window.__scShowWidgetDebug(); }catch(_){} }, 1500);`,
'test ticker hidden guard');

// ── 13. OTA resume check throttled to 30 minutes (native-updates.js) ───────
const NAT = 'dev/native-updates.js';
apply(NAT,
`  function checkForUpdate(opts){
    var o = opts || {};`,
`  var _lastAutoCheck = 0;
  function checkForUpdate(opts){
    _lastAutoCheck = Date.now();
    var o = opts || {};`,
'OTA last-check stamp');

apply(NAT,
`      _fgTimer = setTimeout(function(){
        _fgTimer = null;
        checkForUpdate({ silent: true });
      }, 6000);`,
`      _fgTimer = setTimeout(function(){
        _fgTimer = null;
        // Battery: a resume only checks when the last check is 30+ minutes old.
        // The boot check and a manual Check for updates both stamp the time, and
        // the 3-hour timer still covers long sessions — a phone being folded and
        // unfolded all day no longer starts a network check every single time.
        if(Date.now() - _lastAutoCheck < 30 * 60 * 1000) return;
        checkForUpdate({ silent: true });
      }, 6000);`,
'OTA resume throttle');

// ── 14. OTA channels: [FULL] items are full-build only ─────────────────────
apply('dev/ota-bundle.mjs',
`  return { notes: (e.items || []).slice(0, 6), date: e.date ? String(e.date) : '' };`,
`  // [FULL]-marked items are this channel's own notes: strip the marker.
  return { notes: (e.items || []).map((it) => (typeof it === 'string' && it.startsWith('[FULL] ')) ? it.slice(7) : it).slice(0, 6), date: e.date ? String(e.date) : '' };`,
'full channel strips marker');

apply('dev/ota-bundle-play.mjs',
`  return { notes: (e.items || []).slice(0, 6), date: e.date ? String(e.date) : '' };`,
`  // [FULL]-marked items never belong to this channel.
  return { notes: (e.items || []).filter((it) => !(typeof it === 'string' && it.startsWith('[FULL] '))).slice(0, 6), date: e.date ? String(e.date) : '' };`,
'play channel drops marked items');

// ── 15. test pins move with the release ────────────────────────────────────
apply('dev/test-6052.mjs', `entries[0].date.includes('September 22, 2026')`, `entries[0].date.includes('September 23, 2026')`, '6052 date pin');
apply('dev/test-6053.mjs', `ok(ver === '60.5.4', 'APP_VERSION = ' + ver);`, `ok(ver === '60.5.5', 'APP_VERSION = ' + ver);`, '6053 ver pin');
apply('dev/test-6053.mjs', `entries[0].date.includes('September 22, 2026')`, `entries[0].date.includes('September 23, 2026')`, '6053 date pin');
apply('dev/test-6054.mjs', `ok(ver === '60.5.4', 'APP_VERSION = ' + ver);`, `ok(ver === '60.5.5', 'APP_VERSION = ' + ver);`, '6054 ver pin');
apply('dev/test-6054.mjs', `entries[0].date.includes('September 22, 2026')`, `entries[0].date.includes('September 23, 2026')`, '6054 date pin');
apply('dev/test-6054.mjs', `pkg.version === '5.0.50'`, `pkg.version === '5.0.51'`, '6054 pkg pin');

// ── self-check ─────────────────────────────────────────────────────────────
console.log('— self-check —');
assertContains(HTML, "const APP_VERSION = '60.5.5'", 'version bumped');
assertContains('sw.js', 'sidecut-shell-v60.5.5', 'sw bumped');
assertContains('package.json', '"5.0.51"', 'pkg bumped');
assertContains(HTML, "version: '60.5.5'", 'entry present');
assertContains(HTML, 'function scOpenLibraryAfterDownload()', 'library helper present');
assertContains(HTML, 'sc-pill-cancel', 'cancel button present');
if (count(HTML, 'scOpenLibraryAfterDownload') < 4) { failed++; console.error('FAIL helper wired fewer than 4 sites'); }
if (count(HTML, 'window.__scCancelDl') < 15) { failed++; console.error('FAIL cancel flag only ' + count(HTML, 'window.__scCancelDl') + ' sites'); }
if (count(HTML, 'entry.items') !== 1) { failed++; console.error('FAIL raw entry.items occurrences = ' + count(HTML, 'entry.items') + ' (want 1: the helper itself)'); }
if (count(HTML, 'latest.items') !== 0) { failed++; console.error('FAIL raw latest.items remains'); }
// the new entry: >=2 [FULL] items, >=6 items total, no "play build/version" wording
{
  const src = fs.readFileSync(HTML, 'utf8');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { failed++; console.error('FAIL changelog does not eval: ' + e.message); }
  if (entries) {
    const e0 = entries[0];
    if (e0.version !== '60.5.5') { failed++; console.error('FAIL entries[0].version = ' + e0.version); }
    if (!e0.date.endsWith('EDT') || !e0.date.includes('September 23, 2026')) { failed++; console.error('FAIL date: ' + e0.date); }
    const full = e0.items.filter((i) => i.startsWith('[FULL] '));
    if (full.length < 2) { failed++; console.error('FAIL [FULL] items = ' + full.length); }
    if (e0.items.length < 6) { failed++; console.error('FAIL items = ' + e0.items.length); }
    if (/play build|play version|google play build|play install/i.test(e0.items.join('\n'))) { failed++; console.error('FAIL new notes mention the play build'); }
    // play channel view of this entry must still have >= 3 notes
    const playNotes = e0.items.filter((i) => !i.startsWith('[FULL] '));
    if (playNotes.length < 3) { failed++; console.error('FAIL play-channel notes = ' + playNotes.length); }
    if (playNotes.some((i) => i.startsWith('[FULL]'))) { failed++; console.error('FAIL marker leaked into play notes'); }
    console.log(`ok  [entry] ${e0.items.length} items, ${full.length} full-only, ${playNotes.length} shared`);
  }
}
assertContains(NAT, '_lastAutoCheck', 'OTA stamp present');
assertContains(NAT, '30 * 60 * 1000', 'OTA throttle present');
assertContains('dev/ota-bundle.mjs', "[FULL] ", 'full bundler aware of marker');
assertContains('dev/ota-bundle-play.mjs', 'filter((it) => !(typeof it === \'string\' && it.startsWith(\'[FULL] \')))', 'play bundler filters marker');

console.log('');
console.log(`${edits} edits applied, ${failed} problems`);
process.exit(failed ? 1 : 0);
