// SideCut native OTA updater (self-hosted, manual mode — no Capgo cloud).
//
// The native app loads index.html from the APK's assets, and service workers are
// intentionally disabled in the native WebView (they hang Capacitor's local
// https://localhost origin), so NOTHING a browser user does — hard refresh,
// cache bump, SW skipWaiting — ever updates an installed native app. Only a new
// APK/AAB from the Play Store did. This module adds real over-the-air updates:
// the Android build ships @capgo/capacitor-updater and this script checks the
// manifest published next to the GitHub Pages site, downloads the matching
// bundle zip, stages it with next() (applied on background/relaunch — never
// mid-session), and confirms healthy boots with notifyAppReady() so a broken
// bundle can never brick the app (the plugin auto-reverts to the last good one).
//
// Update UX (the point of this module): instead of a lone toast, the user gets
// an in-app update sheet with the patch notes, a progress bar with %, MB and a
// live ETA during the download, and an explicit choice — INSTALL NOW (applies
// the bundle immediately) or INSTALL LATER (installs when the app next closes;
// the sheet stays dismissible and the staged bundle is applied at next launch).
//
// The zip + manifest are produced by .github/workflows/deploy.yml on every push:
//   ota/SideCut-web.zip   — index.html, sw.js, manifest.json, icons
//   ota/manifest.json     — { "version": "56.0.12", "url": "SideCut-web.zip",
//                             "size": 1530000, "notes": [ ... ] }
(function(){
  'use strict';
  var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  // GitHub Pages root of this repo (matches capacitor.config.json allowNavigation).
  var OTA_BASE = 'https://anekthegreat.github.io/SideCut/';
  var MANIFEST_URL = OTA_BASE + 'ota/manifest.json';
  var LS_KEY = 'sidecut_ota_last';
  var SHEET_KEY = 'sidecut_ota_sheet';       // persisted sheet state { version, notes, size, stagedAt, phase }
  var INSTALL_PROMPT_SEEN = 'sidecut_ota_prompt_'; // + version — set when the user picks "later"
  var READY_TOAST_KEY = 'sidecut_ota_ready_toast_'; // + version - "update is ready" toast fires at most once per staged version
  var STAGED_SHOWN_KEY = 'sidecut_ota_staged_shown_'; // + version - play-time staged sheet surfaces at most once per staged version

  function log(msg){ try{ console.log('[SideCut OTA] ' + msg); }catch(e){} }
  function toast(msg, ms){
    try{ if(typeof window.toast === 'function') window.toast(msg, ms || 3500); }catch(e){}
  }
  // The main app script defines toast() early; if it crashed, the bundle is
  // broken and must NOT be confirmed healthy.
  function appBooted(){ return typeof window.toast === 'function'; }
  function currentVersion(){
    try{ if(typeof APP_VERSION !== 'undefined') return String(APP_VERSION); }catch(e){}
    try{ if(window.__SC_VERSION) return String(window.__SC_VERSION); }catch(e){}
    try{
      var lbl = document.getElementById('currentVersionLabel');
      if(lbl){ var mv = String(lbl.textContent || '').match(/v([0-9][0-9.]*)/); if(mv) return mv[1]; }
    }catch(e){}
    return null;
  }

  function somethingIsPlaying(){
    try{
      var els = document.querySelectorAll('audio');
      for(var i = 0; i < els.length; i++){
        var a = els[i];
        if(a && !a.paused && !a.ended && (a.src || a.currentSrc)) return true;
      }
    }catch(e){}
    return false;
  }

  // ---------------- Update sheet (bottom card, above the mini player) ----------
  // A real UI instead of a toast: patch notes, progress with %/MB/ETA, and
  // explicit Install now / Install later buttons. Kept plain-HTML so it works
  // no matter what state the main app stylesheet is in.
  var sheetRefs = null;
  function fmtMB(bytes){
    var mb = (Number(bytes) || 0) / (1024 * 1024);
    return (mb >= 1 ? mb.toFixed(1) : (mb * 1024).toFixed(0) + ' KB');
  }
  function fmtEta(sec){
    if(!isFinite(sec) || sec < 0) return '—';
    if(sec < 5) return 'a few seconds';
    sec = Math.round(sec);
    if(sec < 60) return '~' + sec + 's';
    var m = Math.floor(sec / 60), s = sec % 60;
    return '~' + m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }
  function ensureSheet(){
    if(sheetRefs && document.body.contains(sheetRefs.card)) return sheetRefs;
    var card = document.createElement('div');
    card.id = 'scOtaSheet';
    card.style.cssText = 'position:fixed; left:12px; right:12px; bottom:86px; z-index:9999; display:none;' +
      'background:#13262b; border:1px solid #2b4450; border-radius:16px; padding:16px;' +
      'box-shadow:0 12px 34px rgba(0,0,0,0.5); color:#eef; font-family:inherit;';
    card.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">' +
        '<div id="scOtaTitle" style="font-weight:700; font-size:15px;"></div>' +
        '<div id="scOtaDate" style="font-size:11px; color:#9fb3b9; flex-shrink:0;"></div>' +
      '</div>' +
      '<div id="scOtaNotes" style="margin-top:8px; font-size:12.5px; color:#cfe3e3; max-height:132px; overflow-y:auto;"></div>' +
      '<div id="scOtaProgressWrap" style="display:none; margin-top:12px;">' +
        '<div style="height:8px; border-radius:6px; background:rgba(255,255,255,0.12); overflow:hidden;">' +
          '<div id="scOtaBar" style="height:100%; width:0%; background:#f47a55; transition:width 0.2s linear;"></div>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; margin-top:5px; font-size:11px; color:#9fb3b9;">' +
          '<span id="scOtaPct">0%</span><span id="scOtaEta">estimating…</span>' +
        '</div>' +
      '</div>' +
      '<div id="scOtaBtns" style="display:flex; gap:10px; margin-top:14px;">' +
        '<button id="scOtaLater" style="flex:1; padding:11px; font-size:13.5px; font-weight:600; border-radius:10px; border:1px solid #2b4450; background:#0E1B1F; color:#cfe3e3; cursor:pointer;">Install later</button>' +
        '<button id="scOtaNow" style="flex:1; padding:11px; font-size:13.5px; font-weight:700; border-radius:10px; border:none; background:#f47a55; color:#0E1B1F; cursor:pointer;">Install now</button>' +
      '</div>' +
      '<div id="scOtaMsg" style="display:none; margin-top:10px; font-size:12px; color:#9fb3b9;"></div>';
    document.body.appendChild(card);
    sheetRefs = { card: card };
    card.addEventListener('click', function(e){ e.stopPropagation(); });
    return sheetRefs;
  }
  function $(id){ return document.getElementById(id); }
  function sheetMsg(text, ms){
    var el = $('scOtaMsg'); if(!el) return;
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    if(text && ms){ setTimeout(function(){ if(el.textContent === text){ el.textContent = ''; el.style.display = 'none'; } }, ms); }
  }
  function showSheet(opts){
    var o = opts || {};
    ensureSheet();
    var title = $('scOtaTitle'), date = $('scOtaDate'), notes = $('scOtaNotes'),
        wrap = $('scOtaProgressWrap'), btns = $('scOtaBtns'), now = $('scOtaNow'), later = $('scOtaLater');
    if(!title) return;
    title.textContent = o.title || ('SideCut ' + o.version + ' is ready');
    date.textContent = o.date || '';
    // Patch notes: the real changelog items from the OTA manifest — never blank.
    var items = (o.notes && o.notes.length) ? o.notes : ['Bug fixes and improvements'];
    notes.innerHTML = '';
    for(var i = 0; i < items.length; i++){
      var row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:8px; padding:3px 0;';
      var dot = document.createElement('span'); dot.textContent = '•';
      dot.style.cssText = 'color:#f47a55; flex-shrink:0;';
      var txt = document.createElement('span'); txt.textContent = String(items[i]);
      row.appendChild(dot); row.appendChild(txt);
      notes.appendChild(row);
    }
    // Stage-specific layout:
    //  - "prompt"   (update available): Install now starts the download.
    //  - "downloading": progress bar with %/MB/ETA, no buttons (it IS installing).
    //  - "staged"   (downloaded): Install now applies it.
    //  - "installing": the WebView is about to reload — progress + buttons gone,
    //    a clear "Installing…" message is the last thing the user sees.
    //  - "done": confirmation only.
    now.textContent = (o.phase === 'staged') ? 'Install now' : 'Download & install';
    var hideBtns = (o.phase === 'done' || o.phase === 'downloading' || o.phase === 'installing');
    later.style.display = hideBtns ? 'none' : 'block';
    now.style.display = hideBtns ? 'none' : 'block';
    now.disabled = false; later.disabled = false;
    now.onclick = function(){ if(o.onNow) o.onNow(); };
    later.onclick = function(){ if(o.onLater) o.onLater(); };
    if(o.phase === 'done'){
      btns.style.display = 'none';
      sheetMsg('✓ ' + (o.doneMsg || ('Installed v' + o.version + ' — you are up to date.')));
    } else if(o.phase === 'installing'){
      btns.style.display = 'none';
      sheetMsg('Installing… the app will reopen automatically in a moment.');
    } else if(o.phase === 'downloading'){
      btns.style.display = 'none';
      sheetMsg('');
    } else {
      btns.style.display = 'flex';
      sheetMsg('');
    }
    wrap.style.display = (o.showProgress || o.phase === 'downloading') ? 'block' : 'none';
    card.style.display = 'block';
  }
  function hideSheet(){ if(sheetRefs){ sheetRefs.card.style.display = 'none'; } }
  function sheetProgress(pct, etaText){
    var bar = $('scOtaBar'), pctEl = $('scOtaPct'), eta = $('scOtaEta');
    if(bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if(pctEl) pctEl.textContent = Math.round(Math.max(0, Math.min(100, pct))) + '%';
    if(eta) eta.textContent = etaText || '';
  }

  // Download with a live progress bar + running ETA. The plugin's 'download'
  // event fires percent (0..100); time-to-completion is extrapolated from the
  // smoothed transfer rate, which is far more honest than a fake countdown.
  function downloadWithProgress(Updater, man){
    return new Promise(function(resolve, reject){
      var startedAt = Date.now();
      var lastTick = 0, smoothSec = null, lastPct = 0;
      var handle = null;
      try{
        handle = Updater.addListener('download', function(state){
          var pct = Number(state && state.percent) || 0;
          lastPct = pct;
          var now = Date.now();
          if(now - lastTick > 250){
            lastTick = now;
            var elapsed = (now - startedAt) / 1000;
            if(pct > 2 && elapsed > 1){
              var instSec = elapsed * (100 - pct) / pct;
              smoothSec = smoothSec == null ? instSec : (smoothSec * 0.7 + instSec * 0.3);
            }
            var total = (man && man.size) ? Number(man.size) : 0;
            var doneMB = total ? fmtMB(total * pct / 100) : '';
            var ofTotal = total ? ' of ' + fmtMB(total) : '';
            sheetProgress(pct, (doneMB ? doneMB + ofTotal + ' · ' : '') + fmtEta(smoothSec));
          }
        });
      }catch(e){ log('progress listener unavailable: ' + ((e && e.message) || e)); }
      var dl = Updater.download({
        url: (String(man.url).indexOf('http') === 0 ? man.url : OTA_BASE + 'ota/' + man.url),
        version: String(man.version)
      });
      function cleanup(){ try{ if(handle && handle.remove) handle.remove(); }catch(e){} }
      dl.then(function(bundle){
        // Snap the bar to 100% with a final honest number.
        sheetProgress(100, 'done in ' + fmtEta((Date.now() - startedAt) / 1000).replace('~', ''));
        setTimeout(function(){ resolve(bundle); }, 350);
      }).catch(function(err){
        cleanup();
        reject(err);
      });
      // Safety net: if the percent events stop but the promise hasn't settled,
      // nothing shows progress — mirror the promise state onto the bar at 99%.
      setTimeout(function(){ if(lastPct > 0 && lastPct < 100) sheetProgress(lastPct, 'finishing…'); }, 30000);
    });
  }

  // Applies a staged bundle in place. set() reloads the WebView into the new
  // bundle (the JS context dies — nothing after it runs), so only do this when
  // no song is playing. Returns true when the apply was DEFERRED to app-close
  // (music was playing) — callers use that to drop the staged sheet instead of
  // repainting it over the deferral message.
  function applyStagedNow(Updater, nb){
    if(!nb || !nb.id) return false;
    if(somethingIsPlaying()){
      // Defer for real instead of just talking about it: install the moment the
      // user leaves the app (music must not be killed mid-play) and remember
      // the choice so silent checks stop re-offering the same version. The
      // "ready" toast fires at most ONCE per staged version — silent re-checks
      // (every 30 min, foreground, before play) were re-running this path
      // each time and re-toasting "it installs when you close the app.".
      try{ localStorage.setItem(INSTALL_PROMPT_SEEN + nb.version, '1'); }catch(e){}
      applyInBackground(Updater, nb);
      var rtk = READY_TOAST_KEY + nb.version;
      try{ if(localStorage.getItem(rtk) === '1') return true; localStorage.setItem(rtk, '1'); }catch(e){}
      toast('Update ' + nb.version + ' is ready — it installs when you close the app.', 4500);
      return true;
    }
    log('applying staged bundle ' + nb.version + ' now');
    // Show the Installing state in the sheet (not just a toast) — the set()
    // reload below destroys the JS context, so this is the last thing the
    // user sees before the app comes back on the new version.
    showSheet({ phase: 'installing', version: nb.version, title: 'Installing SideCut ' + nb.version + '…' });
    // Clear the persisted sheet state BEFORE the reload: once set() succeeds
    // the bundle is current, and a stale 'staged' record would re-open the
    // update sheet after the new version boots.
    clearSheet();
    // Remember the applied version so the next boot can confirm it to the user
    // with a real "✓ Updated" toast instead of silence.
    try{ localStorage.setItem('sidecut_ota_applied', String(nb.version)); }catch(e){}
    // Small delay so the sheet paints before the context is destroyed.
    setTimeout(function(){
      try{ Updater.set({ id: nb.id }); }catch(e){ log('set failed: ' + ((e && e.message) || e)); }
    }, 450);
    return false;
  }

  // Did the user already pick "Install later" for this version? Every onLater
  // handler (and a music-playing deferral) sets sidecut_ota_prompt_<version>.
  function staged(){
    if(!IS_NATIVE) return;
    var U = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
    if(!U || typeof U.getNextBundle !== 'function') return;
    U.getNextBundle().then(function(nb){
      if(!nb || !nb.version) return;
      if(!wantDeferredInstall(String(nb.version))) return; // auto-apply path already handled it
      if(sheetRefs && sheetRefs.card && sheetRefs.card.style.display === 'block') return;
      var st = readSheet();
      if(st && st.version === String(nb.version)) return; // already on screen
      var sk = STAGED_SHOWN_KEY + nb.version;
      try{ if(localStorage.getItem(sk) === '1') return; }catch(e){}
      try{ localStorage.setItem(sk, '1'); }catch(e){}
      showSheet({
        phase: 'staged', version: String(nb.version), date: (st && st.date) || '', notes: (st && st.notes) || [],
        onNow: function(){ try{ localStorage.removeItem(sk); }catch(e){} if(applyStagedNow(U, nb)) hideSheet(); },
        onLater: function(){ try{ localStorage.setItem(INSTALL_PROMPT_SEEN + nb.version, '1'); }catch(e){} hideSheet(); toast('Saved for later — installs when you leave the app.', 3500); }
      });
    }).catch(function(){});
  }

  function wantDeferredInstall(version){
    try{ if(localStorage.getItem(INSTALL_PROMPT_SEEN + version) === '1') return true; }catch(e){}
    return false;
  }

  // The "Install later" contract, kept: a staged bundle installs as soon as the
  // user leaves the app — not on the relaunch AFTER that (which is what the
  // user saw as "I closed it, reopened it, still old version"). resume /
  // visibilitychange are the reliable hooks (the context may freeze mid-call on
  // 'pause', but the native side still completes an in-flight set(); if the
  // plugin's own background handler applied it first, getNextBundle() returns
  // null and this no-ops). Users who never chose "later" get the immediate
  // v56.0.16 behavior: apply right away (or at next launch).
  // Returns 'immediate' when an apply was just started (sheet now shows
  // "Installing…", app reloads within ~450ms), 'deferred' when the bundle will
  // install on app-close, or false when nothing could be done.
  function applyInBackground(Updater, nb){
    if(!Updater || !nb || !nb.id) return false;
    var version = String(nb.version || '');
    if(!wantDeferredInstall(version)){
      var r = applyStagedNow(Updater, nb); // true = deferred to close (music playing)
      return r ? 'deferred' : 'immediate';
    }
    try{ window.__scOtaDeferred = { id: nb.id, version: version }; }catch(e){}
    log('staged ' + version + ' will install when the app is closed/backgrounded');
    // Wire the transition listeners ONCE per deferred bundle (re-checks of the
    // same staged version call this repeatedly — duplicate listeners would fire
    // go() multiple times per event).
    if(window.__scOtaDeferredWired === version) return 'deferred';
    try{ window.__scOtaDeferredWired = version; }catch(e){}
    function go(){
      // The user complaint: leaving the app while music plays must NOT reload
      // the WebView. set() swaps the bundle and the JS context dies - playback
      // dies with it. If music is (still) playing, keep the staged bundle
      // around:the boot path applies it on the next clean relaunch.
      if(somethingIsPlaying()){
        // Keep the deferred marker — when the song pauses or ends (while
        // backgrounded) punchs the install then, on the quiet clean moment.

        // A foreground pause while music plays must NOT reload mid-use either:
        // only install when the app has actually been backgrounded (Home gesture /
        // close / task-mart removal), which is exactly the user complaint fix.


        if(document.visibilityState === 'visible'){
          // Playback still active, foreground: leave the staged bundle alone.

          return;
        }
        log('app backgrounded while music is playing — updating when the music pauses');
        return;
      }
      if(document.visibilityState === 'visible'){
        // Never reload the app in the middle of a foreground session — only
        // the background/close transitions (and the boot path, and the play-time
        // staged() choice) may apply the update. A stale resume event while
        // foreground (e.g. a notification shade pull) must not reload.now.

        return;
      }
      var d = window.__scOtaDeferred;

      if(!d) return;
      window.__scOtaDeferred = null;
      Updater.getNextBundle().then(function(cur){
        if(cur && cur.id === d.id){
          log('app left foreground — installing staged ' + d.version);
          try{ localStorage.setItem('sidecut_ota_applied', d.version); }catch(e){}
          try{ Updater.set({ id: d.id }); }catch(e){ log('set failed: ' + ((e && e.message) || e)); }
        }
      }).catch(function(){});
    }
    try{ document.addEventListener('pause', go, false); }catch(e){}
    try{ document.addEventListener('resume', go, false); }catch(e){}
    document.addEventListener('visibilitychange', function(){
      // Fire on BOTH transitions: 'hidden' catches a normal Home-gesture close
      // while the webview is still alive, and the 'visible' pass on reopen
      // catches every other close style (swipe-away, task-manager kill).
      go();
    }, false);
    try{ if(document.visibilityState !== 'visible') go(); }catch(e){}
    // When music was playing at background-time, defer the install until the
    // song pauses or ends — the pause/ended event then runs go() and installs
    // on the quiet clean moment ((still backgrounded), so the user never sees
    // a reload or a cut-off song. Only wire these once per deferred bundle.

    try{ document.addEventListener('ended', go, false); }catch(e){}
    return 'deferred';
  }

  // Confirms the running bundle is healthy so Capgo keeps it; a bundle that
  // never gets this call is rolled back to the previous one automatically.
  function markAppReady(){
    if(!IS_NATIVE || !appBooted()) return;
    try{
      var p = window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
      if(p && typeof p.notifyAppReady === 'function') p.notifyAppReady().catch(function(){});
    }catch(e){}
  }

  function persistSheet(state){
    try{ localStorage.setItem(SHEET_KEY, JSON.stringify(state)); }catch(e){}
  }
  function readSheet(){
    try{ var raw = localStorage.getItem(SHEET_KEY); if(raw){ var d = JSON.parse(raw); if(d && d.version) return d; } }catch(e){}
    return null;
  }
  function clearSheet(){ try{ localStorage.removeItem(SHEET_KEY); }catch(e){} }

  function checkForUpdate(opts){
    var o = opts || {};
    return new Promise(function(resolve){
      (async function(){
        var res = await checkForUpdateInner(o);
        resolve(res);
      })();
    });
  }

  async function checkForUpdateInner(opts){
    var o = opts || {};
    if(!IS_NATIVE || !appBooted()) return null;
    var Updater = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
    if(!Updater){
      // The running APK predates the updater — OTA can never work from here.
      if(!o.silent) toast('This installed build cannot self-update yet — install the newest APK/AAB once, and every update after that arrives automatically.', 6000);
      return { unavailable: true };
    }
    try{
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 10000);
      var resp = await fetch(MANIFEST_URL, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if(!resp || !resp.ok){ log('manifest fetch failed: ' + (resp ? resp.status : 'no response')); return null; }
      var man = await resp.json();
      if(!man || !man.version || !man.url){ log('manifest missing version/url'); return null; }
      var cur = currentVersion();
      if(!cur){ log('cannot determine the running version — skipping update check (fail safe)'); return null; }
      if(String(man.version) === String(cur)){ log('up to date (' + cur + ')'); return null; }

      // Already staged but not yet applied (waiting for background/relaunch)?
      // Surface the staged state in the sheet so the user can apply it now.
      try{
        var nb = await Updater.getNextBundle();
        if(nb && nb.version === String(man.version)){
          log('bundle ' + man.version + ' already staged');
          // Keep the close/reopen promise: install the staged bundle the moment
          // the user leaves the app — or immediately if they never chose
          // "Install later" (restores the v56.0.16 launch auto-apply).
          var seenKey = INSTALL_PROMPT_SEEN + man.version;
          var seen = false;
          try{ seen = !!localStorage.getItem(seenKey); }catch(e){}
          var applied = applyInBackground(Updater, nb); // 'immediate' = apply started now
          // An immediate apply repaints the sheet to "Installing…" and reloads
          // the app ~450ms later — never repaint a "staged" card over it.
          if(applied === 'immediate') return man;
          // The user already picked "Install later": stay quiet during silent
          // auto-checks (no update sheet popping up mid-song) — the background
          // apply wired above finishes the job when they leave the app.
          if(o.silent && seen) return man;
          showSheet({
            phase: 'staged', version: man.version, date: man.date || '', notes: man.notes,
            onNow: function(){ if(applyStagedNow(Updater, nb)) hideSheet(); },
            onLater: function(){ try{ localStorage.setItem(seenKey, '1'); }catch(e){} hideSheet(); toast('Saved for later — installs next time you close the app.', 3500); }
          });
          persistSheet({ version: man.version, notes: man.notes || [], size: man.size || 0, date: man.date || '', phase: 'staged', stagedAt: Date.now() });
          return man;
        }
      }catch(_ne){}

      // New update available: show the patch notes and ask before downloading.
      // Silent auto-checks (boot / 30-min / foreground) SURFACE the sheet too —
      // before this, a silent check only wrote a localStorage flag and returned,
      // so an update could sit invisible until the user opened Settings and
      // tapped Check for updates by hand. The sheet only pops when a check has
      // actually found a newer manifest version (never on 'up to date').
      var showPrompt = !o.silent;
      if(!showPrompt){
        showPrompt = true;
      }
      if(!showPrompt){
        // Silent background check: remember it so the next manual/open check
        // still surfaces it, and leave a quiet toast pointing at the sheet.
        try{ localStorage.setItem(LS_KEY, JSON.stringify({ version: String(man.version), at: Date.now(), available: true })); }catch(_e){}
        return null;
      }
      return await promptAndInstall(Updater, man, o);
    }catch(e){
      log('update check failed: ' + ((e && e.message) || e));
      if(!o.silent) toast('Update check failed — check your connection.', 3000);
      return null;
    }
  }

  async function promptAndInstall(Updater, man, o){
    var seenKey = INSTALL_PROMPT_SEEN + man.version;
    return new Promise(function(resolve){
      var settled = false;
      function finish(v){ if(!settled){ settled = true; resolve(v === undefined ? man : v); } }
      showSheet({
        phase: 'prompt', version: man.version, date: man.date || '', notes: man.notes,
        onNow: async function(){
          try{
            persistSheet({ version: man.version, notes: man.notes || [], size: man.size || 0, date: man.date || '', phase: 'downloading', startedAt: Date.now() });
            showSheet({ phase: 'downloading', version: man.version, date: man.date || '', notes: man.notes, showProgress: true,
              onNow: function(){}, onLater: function(){ try{ localStorage.setItem(seenKey, '1'); }catch(e){} hideSheet(); toast('Update will continue in the background.', 3000); } });
            sheetProgress(0, 'starting…');
            var bundle = await downloadWithProgress(Updater, man);
            if(!bundle || !bundle.id){ log('download returned no bundle'); sheetMsg('Download failed — try again.', 0); finish(man); return; }
            // Stage, don't reload: the bundle activates on background/relaunch,
            // so a playing song is never interrupted.
            await Updater.next({ id: bundle.id });
            try{ localStorage.setItem(LS_KEY, JSON.stringify({ version: String(man.version), at: Date.now() })); }catch(_e){}
            log('staged ' + man.version + ' (id ' + bundle.id + ')');
            persistSheet({ version: man.version, notes: man.notes || [], size: man.size || 0, date: man.date || '', phase: 'staged', stagedAt: Date.now() });
            showSheet({ phase: 'staged', version: man.version, date: man.date || '', notes: man.notes,
              onNow: async function(){
                try{ var nb2 = await Updater.getNextBundle(); if(applyStagedNow(Updater, nb2)) hideSheet(); }catch(e){ if(applyStagedNow(Updater, bundle)) hideSheet(); }
              },
              onLater: function(){ try{ localStorage.setItem(seenKey, '1'); }catch(e){} hideSheet(); toast('Saved for later — installs next time you close the app.', 3500); } });
            finish(man);
          }catch(e){
            log('download/stage failed: ' + ((e && e.message) || e));
            sheetMsg('Download failed — check your connection and try again.', 0);
            // Give the user a way back to the buttons after a failure.
            setTimeout(function(){
              showSheet({ phase: 'prompt', version: man.version, date: man.date || '', notes: man.notes,
                onNow: function(){ promptAndInstall(Updater, man, o); },
                onLater: function(){ try{ localStorage.setItem(seenKey, '1'); }catch(e){} hideSheet(); } });
            }, 4000);
            finish(man);
          }
        },
        onLater: function(){
          try{ localStorage.setItem(seenKey, '1'); }catch(e){}
          hideSheet();
          toast('Maybe later — auto-checks continue in the background.', 3000);
          // Distinct result so the manual Check-for-updates button doesn't
          // mistake a user "later" for "you are on the latest version".
          finish({ dismissed: true });
        }
      });
    });
  }

  // Restore a persisted sheet (e.g. a 'staged' bundle record from a previous
  // session) on launch so the UI never silently forgets it. 'downloading' can't
  // survive a reload (the JS download dies with the page) — a fresh auto-check
  // re-offers it; nothing to restore there.
  function restoreSheetState(){
    if(!IS_NATIVE || !appBooted()) return;
    if(sheetRefs && sheetRefs.card.style.display === 'block') return; // already showing
    var st = readSheet();
    if(!st) return;
    if(st.phase === 'staged'){
      // The bundle already installed (background/deferred apply)? Drop the
      // stale record instead of showing an update sheet for the OLD version.
      if(String(currentVersion()) === String(st.version)){ clearSheet(); return; }
      if(wantDeferredInstall(st.version)) return; // installs on close — wired at launch
      showSheet({
        phase: 'staged', version: st.version, date: st.date || '', notes: st.notes,
        onNow: async function(){
          try{
            var U = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
            var nb = U ? await U.getNextBundle() : null;
            if(applyStagedNow(U, nb)) hideSheet();
          }catch(e){}
        },
        onLater: function(){ hideSheet(); }
      });
    }
    // 'downloading' can't survive a reload (the JS download dies with the page) —
    // a fresh auto-check will re-offer it; nothing to restore.
  }

  // Auto-check shortly after boot, then every 30 minutes and on app foreground.
  // Silent checks DO surface the update sheet when a newer version exists (the
  // boot one fires ~2.5s in so a fresh update is visible on every refresh).
  // Silent checks still never auto-download or auto-apply; the sheet asks.
  function startAutoCheck(){
    if(!IS_NATIVE) return;
    setTimeout(function(){ if(document.visibilityState !== 'hidden') checkForUpdate({ silent: true }); }, 2500);
    setInterval(function(){ checkForUpdate({ silent: true }); }, 30 * 60 * 1000);
    // Debounced foreground check: rapid folds (visibility flicker on
    // folding phones) collapse into a single check 6s after the screen
    // settles, so checking can't spam the network or fight playback.
    let _fgTimer = null;
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState !== 'visible') return;
      if(_fgTimer) clearTimeout(_fgTimer);
      _fgTimer = setTimeout(function(){
        _fgTimer = null;
        checkForUpdate({ silent: true });
      }, 6000);
    });
  }

  window.__SideCutOTA = { IS_NATIVE: IS_NATIVE, checkForUpdate: checkForUpdate, markAppReady: markAppReady, startAutoCheck: startAutoCheck, restoreSheetState: restoreSheetState, staged: staged, OTA_BASE: OTA_BASE };
  if(IS_NATIVE){
    // Give the main app script time to finish booting; only then confirm the
    // bundle is healthy and start checking for newer ones.
    window.addEventListener('load', function(){
      setTimeout(function(){
        if(!appBooted()){ log('app did not finish booting — bundle stays unconfirmed'); return; }
        markAppReady();
        // Confirm a bundle that installed since the last session (background
        // apply or the deferred on-close apply) — the user closed the app on
        // the old version and reopened on the new one; say so out loud.
        try{
          var appliedV = localStorage.getItem('sidecut_ota_applied');
          if(appliedV){
            localStorage.removeItem('sidecut_ota_applied');
            if(String(currentVersion()) === String(appliedV)) toast('✓ SideCut updated to v' + appliedV + '.', 4000);
          }
        }catch(_ae){}
        restoreSheetState();
        // A staged bundle can survive a swipe-away kill (the plugin only applies
        // staged bundles on background events). Surface it in the sheet on launch
        // instead of leaving the update stuck behind another close/reopen cycle.
        try{
          var U = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
          if(U && typeof U.getNextBundle === 'function'){
            U.getNextBundle().then(function(nb){
              if(!nb || !nb.version) return;
              // v56.0.16 behavior restored (the sheet rewrite dropped it): a
              // staged bundle applies at launch — immediately for users who
              // never chose "Install later", on close for those who did —
              // instead of sitting behind the update sheet forever.
              applyInBackground(U, nb);
              if(wantDeferredInstall(String(nb.version))) return; // installs on close — don't nag
              if(sheetRefs && sheetRefs.card.style.display === 'block') return; // sheet already up
              var st = readSheet();
              showSheet({
                phase: 'staged', version: nb.version, date: (st && st.date) || '', notes: (st && st.notes) || [],
                onNow: function(){ if(applyStagedNow(U, nb)) hideSheet(); },
                onLater: function(){ try{ localStorage.setItem(INSTALL_PROMPT_SEEN + nb.version, '1'); }catch(e){} hideSheet(); toast('Saved for later — installs when you leave the app.', 3500); }
              });
            }).catch(function(){});
          }
        }catch(e){}
        startAutoCheck();
      }, 4000);
    });
  }
})();
