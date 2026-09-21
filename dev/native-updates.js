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
//   ota/update.zip          — index.html, sw.js, manifest.json, icons
//   ota/updates.json       — { "version": "56.1", "url": "update.zip",
//                             "size": 1530000, "notes": [ ... ] }
(function(){
  'use strict';
  var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  // GitHub Pages root of this repo (matches capacitor.config.json allowNavigation).
  var OTA_BASE = 'https://anekthegreat.github.io/SideCut/';
  var MANIFEST_URL = OTA_BASE + 'ota/updates.json';
  var LS_KEY = 'sidecut_ota_last';
  var SHEET_KEY = 'sidecut_ota_sheet';       // persisted sheet state { version, notes, size, stagedAt, phase }
  var INSTALL_PROMPT_SEEN = 'sidecut_ota_prompt_'; // + version — set when the user picks "later"
  var READY_TOAST_KEY = 'sidecut_ota_ready_toast_'; // + version - "update is ready" toast fires at most once per staged version
  var STAGED_SHOWN_KEY = 'sidecut_ota_staged_shown_'; // + version - play-time staged sheet surfaces at most once per staged version
  var PENDING_KEY = 'sidecut_ota_pending';     // { version, at } written when we hand over with set(), cleared once that version boots
  var BAD_KEY = 'sidecut_ota_bad_';            // + version - a bundle that failed to take over; never auto-installed again
  var AUTOHANDLED_KEY = 'sidecut_ota_autohandled_'; // + version - a version already handed over to AUTOMATICALLY once
  var BOOTAPPLY_KEY = 'sidecut_ota_bootapply_';     // + version - the boot hand-over already ran for this version
  var PIN_CLEAR_KEY = 'sidecut_ota_pin_clear';     // set before a hand-over: the page clears the version pin so the new bundle really runs
  var NEUTRAL_KEY = 'sidecut_ota_neutral_';        // + version - a refused staged bundle was already taken away from the plugin
  var DURABLE_FILE = 'sidecut-ota-ledger.json';    // native-FS copy of the attempt ledger (survives a kill)

  function log(msg){ try{ console.log('[SideCut OTA] ' + msg); }catch(e){} }
  function toast(msg, ms){
    try{ if(typeof window.toast === 'function') window.toast(msg, ms || 3500); }catch(e){}
  }
  // The main app script defines toast() early; if it crashed, the bundle is
  // broken and must NOT be confirmed healthy.
  function appBooted(){ return typeof window.toast === 'function'; }
  // 1 when a is newer, -1 when older, 0 when the same. The check below used to be
  // `man.version === running`, so an OLDER published manifest counted as an update
  // and the app would happily install a downgrade over itself.
  //
  // The releases after 60.0.1 were renumbered behind the second decimal
  // (60.1 → 60.0.2, 60.4.1 → 60.0.6, 60.4.2 → 60.0.8). A phone can still be
  // running one of those old labels — and the comparison runs in the build that
  // is INSTALLED, so the mapping has to live here too: read as-is, "60.4" is newer
  // than 60.0.6 and this client would refuse the renumbered build for ever.
  //
  // 60.1 – 60.4 are NOT legacy labels any more — 60.1 is this release's line and
  // 60.2 onwards are the numbers still to come, so none of them may be rewritten:
  // a mapping lowers the published number for every device that holds the map.
  // See index.html for the long version. The line ships as 60.1.1 because a build
  // still holding the old map refuses a bare 60.1 before it can arrive — and this
  // release is the last one that has to care.
  var LEGACY_VERSIONS = { '60.4.1':'60.0.6', '60.4.2':'60.0.8' };
  function normVersion(v){
    var s = (v === null || v === undefined) ? '' : String(v);
    return LEGACY_VERSIONS[s] || s;
  }
  function compareVersions(a, b){
    var pa = normVersion(a).split('.'), pb = normVersion(b).split('.');
    var len = Math.max(pa.length, pb.length);
    for(var i = 0; i < len; i++){
      var na = parseInt(pa[i], 10) || 0, nb = parseInt(pb[i], 10) || 0;
      if(na !== nb) return na > nb ? 1 : -1;
    }
    return 0;
  }
  // Every manifest and bundle URL carries the current time, so neither GitHub
  // Pages (max-age=600) nor raw.githubusercontent (max-age=300) can answer a
  // check with the manifest it was already serving before the release landed.
  function bust(url){
    try{
      var u = String(url);
      return u + (u.indexOf('?') < 0 ? '?' : '&') + 'scv=' + Date.now();
    }catch(e){ return url; }
  }
  function currentVersion(){
    try{ if(typeof APP_VERSION !== 'undefined') return String(APP_VERSION); }catch(e){}
    try{ if(window.APP_VERSION) return String(window.APP_VERSION); }catch(e){}
    try{ if(window.__SC_VERSION) return String(window.__SC_VERSION); }catch(e){}
    try{
      // The label is the LAST resort, and only in the form the running app writes
      // it ("SideCut v58.9.2"). The markup ships a stale placeholder — "SideCut v48"
      // — that any boot which does not finish leaves in place, and trusting it once
      // made a version comparison run against 48 and pass everything.
      var lbl = document.getElementById('currentVersionLabel');
      if(lbl){
        if(lbl.dataset && lbl.dataset.scVersion) return String(lbl.dataset.scVersion);
        var mv = String(lbl.textContent || '').match(/SideCut v(\d+\.\d+[0-9.]*)/);
        if(mv) return mv[1];
      }
    }catch(e){}
    return null;
  }

  // A version the APP itself reported — its own constant, or the dataset it
  // writes onto the version label. The label's text is deliberately NOT used:
  // the shipped markup carries a stale placeholder ("SideCut v48") that a boot
  // which never finished leaves in place.
  function appReportedVersion(){
    try{ if(typeof APP_VERSION !== 'undefined' && APP_VERSION) return String(APP_VERSION); }catch(e){}
    try{ if(window.APP_VERSION) return String(window.APP_VERSION); }catch(e){}
    try{ if(window.__SC_VERSION) return String(window.__SC_VERSION); }catch(e){}
    try{
      var lbl = document.getElementById('currentVersionLabel');
      if(lbl && lbl.dataset && lbl.dataset.scVersion) return String(lbl.dataset.scVersion);
    }catch(e){}
    return null;
  }
  // Any real version: 60, 58.9.2, 58.9.10 …
  function isRealVersion(v){ return !!v && /^\d+(\.\d+)*$/.test(String(v)); }

  // ---------------- Crash-proof ledger (native filesystem) ---------------------
  // Everything the updater remembers about a hand-over used to live only in
  // localStorage, and the WebView flushes localStorage to disk asynchronously. A
  // bundle that takes the app down (or a native process kill) can therefore lose
  // the "we already tried this one" record — and the next launch tries it again:
  // install, die, install, die, which is exactly what a phone stuck restarting
  // itself every few seconds looks like. The ledger is a real file in the app's
  // data directory, written and AWAITED before a bundle is handed over, so the
  // record is on disk before anything can die.
  var _ledger = { tried: {}, bad: {}, boots: [] };
  var _ledgerReady = false;
  function ledgerFS(){
    try{ return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem; }catch(e){ return null; }
  }
  function ledgerLoad(){
    if(_ledgerReady) return Promise.resolve(_ledger);
    var FS = ledgerFS();
    if(!IS_NATIVE || !FS || typeof FS.readFile !== 'function'){ _ledgerReady = true; return Promise.resolve(_ledger); }
    return FS.readFile({ path: DURABLE_FILE, directory: 'DATA', encoding: 'utf8' }).then(function(res){
      try{
        var d = JSON.parse((res && res.data) || '{}');
        if(d && typeof d === 'object'){
          if(d.tried && typeof d.tried === 'object') _ledger.tried = d.tried;
          if(d.bad && typeof d.bad === 'object') _ledger.bad = d.bad;
          if(Object.prototype.toString.call(d.boots) === '[object Array]') _ledger.boots = d.boots.filter(function(t){ return typeof t === 'number'; });
        }
      }catch(e){}
      _ledgerReady = true;
      return _ledger;
    }).catch(function(){ _ledgerReady = true; return _ledger; });
  }
  function ledgerSave(){
    var FS = ledgerFS();
    if(!IS_NATIVE || !FS || typeof FS.writeFile !== 'function') return Promise.resolve(false);
    try{
      var payload = JSON.stringify({ tried: _ledger.tried, bad: _ledger.bad, boots: _ledger.boots.slice(-8) });
      return FS.writeFile({ path: DURABLE_FILE, directory: 'DATA', data: payload, encoding: 'utf8' })
        .then(function(){ return true; }, function(){ return false; });
    }catch(e){ return Promise.resolve(false); }
  }
  // When the app itself opened. Three launches inside a minute is the app
  // restarting itself, and it is recorded on disk so a launch that dies before
  // it can write anything else still counts.
  function ledgerNoteBoot(){
    var now = Date.now();
    _ledger.boots = _ledger.boots.filter(function(t){ return now - t < 60000; });
    _ledger.boots.push(now);
    return ledgerSave();
  }
  function ledgerHotBoots(){ return _ledger.boots.length >= 3; }
  function ledgerTriedBefore(version){ return !!_ledger.tried[String(version || '')]; }
  function ledgerMarkTried(version, why){
    if(!version) return Promise.resolve(false);
    _ledger.tried[String(version)] = { at: Date.now(), why: String(why || '') };
    return ledgerSave();
  }
  function ledgerMarkBad(version){
    if(!version) return Promise.resolve(false);
    _ledger.bad[String(version)] = String(Date.now());
    return ledgerSave();
  }

  // Direction: only ever move forward. An installed bundle is never handed over
  // to a version that is older than the one running (see applyStagedNow), and the
  // manifest check has always refused it — this is the same rule, applied to the
  // bundle the native updater already has staged.
  function isOlderBundle(version){
    var cur = currentVersion();
    if(!cur || !version) return false;
    return compareVersions(String(version), String(cur)) < 0;
  }
  function isNewerBundle(version){
    var cur = currentVersion();
    if(!cur || !version) return false;
    return compareVersions(String(version), String(cur)) > 0;
  }
  // A staged bundle we refuse must be taken away from the NATIVE updater as well:
  // the plugin applies whatever is "next" on every background on its own, without
  // asking this script, so leaving it staged is a reload nobody chose — the phone
  // restarting the app by itself. Pointing "next" at the bundle already running
  // makes that a no-op, and readiness is re-asserted straight after, because
  // setting a next bundle marks the running one pending and a pending bundle is
  // what the plugin rolls back.
  function neutralizeStaged(Updater, nb, why){
    if(!IS_NATIVE || !Updater || !nb || !nb.version) return;
    var version = String(nb.version);
    var onceKey = NEUTRAL_KEY + version;
    try{ if(localStorage.getItem(onceKey) === '1') return; localStorage.setItem(onceKey, '1'); }catch(e){}
    if(typeof Updater.current !== 'function' || typeof Updater.next !== 'function') return;
    try{
      Updater.current().then(function(cur){
        if(!cur || !cur.id) return null;
        log('taking staged v' + version + ' out of the updater\'s hands (' + (why || 'refused') + ')');
        return Updater.next({ id: cur.id }).then(function(){ markAppReady(); }, function(){ markAppReady(); });
      }).catch(function(){});
    }catch(e){}
  }

  // An older bundle can be sitting in the native updater the moment this build
  // starts (left over from a rollback, or downloaded for "install later" and never
  // confirmed), and the plugin applies whatever is queued on its own — every time
  // you leave the app, without asking this script. The launch hand-over a few
  // seconds later would refuse it, but that is a window in which the phone can
  // swap the app back to the old version, and each swap is one more restart. So the
  // direction check runs as soon as the version of the running build is known.
  function earlyDirectionGuard(){
    if(!IS_NATIVE) return;
    var U = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
    if(!U || typeof U.getNextBundle !== 'function') return;
    var startedAt = Date.now();
    (function check(){
      var done = false;
      // The version of the BUNDLE the phone is actually running is the authority
      // here, and the native side knows it from the first moment — the page only
      // reports its own version later, and the shipped markup carries a stale
      // placeholder ("SideCut v48") that an unfinished boot leaves in place.
      var reading = (typeof U.current === 'function')
        ? U.current().then(function(cur){
            if(cur && !cur.isBuiltin && String(cur.id) !== 'builtin' && cur.version) return String(cur.version);
            return currentVersion();
          }, function(){ return currentVersion(); })
        : Promise.resolve(currentVersion());
      reading.then(function(cur){
        // "Must contain a dot" was the old stand-in for "the app really booted" —
        // that assumption died with v60, a whole number, and this guard silently
        // stopped running at all (a queued old bundle then stayed on the updater
        // for the phone to apply by itself). Ask the app which version it is now,
        // and fall back to what it reported only when the source is one the app
        // itself wrote.
        if(!isRealVersion(cur)) cur = appReportedVersion();
        if(!isRealVersion(cur)) return;
        return U.getNextBundle().then(function(nb){
          done = true;
          if(!nb || !nb.version) return;
          if(compareVersions(String(nb.version), String(cur)) >= 0) return; // not a downgrade
          log('queued v' + nb.version + ' is older than the running v' + cur + ' — taking it off the updater');
          neutralizeStaged(U, nb, 'older than the running version (on launch)');
        });
      }).catch(function(){}).then(function(){
        if(done) return;
        if(Date.now() - startedAt > 15000) return; // the app never reported its version
        setTimeout(check, 300);
      });
    })();
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
    // Painted from the app's own theme variables (the old fixed teal/orange values
    // survive only as fallbacks), so the update prompt matches whatever theme you
    // are on — including a live RGB palette — instead of looking like another app.
    card.style.cssText = 'position:fixed; left:12px; right:12px; bottom:86px; z-index:9999; display:none;' +
      'background:var(--bg-raised, #13262b); border:1px solid var(--line, #2b4450); border-radius:16px; padding:16px;' +
      'box-shadow:0 12px 34px rgba(0,0,0,0.5); color:var(--ink, #eef); font-family:inherit;';
    card.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">' +
        '<div id="scOtaTitle" style="font-weight:700; font-size:15px;"></div>' +
        '<div id="scOtaDate" style="font-size:11px; color:var(--ink-dim, #9fb3b9); flex-shrink:0;"></div>' +
      '</div>' +
      '<div id="scOtaNotes" style="margin-top:8px; font-size:12.5px; color:var(--ink, #cfe3e3); opacity:0.92; max-height:132px; overflow-y:auto;"></div>' +
      '<div id="scOtaProgressWrap" style="display:none; margin-top:12px;">' +
        '<div style="height:8px; border-radius:6px; background:var(--line, rgba(255,255,255,0.12)); overflow:hidden;">' +
          '<div id="scOtaBar" style="height:100%; width:0%; background:var(--coral, #f47a55); transition:width 0.2s linear;"></div>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; margin-top:5px; font-size:11px; color:var(--ink-dim, #9fb3b9);">' +
          '<span id="scOtaPct">0%</span><span id="scOtaEta">estimating…</span>' +
        '</div>' +
      '</div>' +
      '<div id="scOtaBtns" style="display:flex; gap:10px; margin-top:14px;">' +
        '<button id="scOtaLater" style="flex:1; padding:11px; font-size:13.5px; font-weight:600; border-radius:10px; border:1px solid var(--line, #2b4450); background:var(--bg, #0E1B1F); color:var(--ink, #cfe3e3); cursor:pointer;">Install later</button>' +
        '<button id="scOtaNow" style="flex:1; padding:11px; font-size:13.5px; font-weight:700; border-radius:10px; border:none; background:var(--coral, #f47a55); color:#161616; cursor:pointer;">Install now</button>' +
      '</div>' +
      '<div id="scOtaMsg" style="display:none; margin-top:10px; font-size:12px; color:var(--ink-dim, #9fb3b9);"></div>';
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
    // `card` used to be resolved here, but it is only ever declared inside
    // ensureSheet() — so the final `card.style.display = 'block'` below threw a
    // ReferenceError on every call. The sheet was built and populated, then never
    // shown: the update check found the update, wrote the patch notes into a
    // hidden element, and died before making it visible. Nothing appeared, which
    // is exactly why OTA looked like it had never worked at all.
    var refs = ensureSheet();
    var card = refs && refs.card;
    if(!card) return;
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
      dot.style.cssText = 'color:var(--coral, #f47a55); flex-shrink:0;';
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
      // Say which build is actually on screen. The version picker can leave an old
      // snapshot pinned over a newer installed bundle, and then every "it is still
      // broken" report is about the old page, not the update being offered.
      var cur = (typeof currentVersion === 'function') ? String(currentVersion() || '') : '';
      sheetMsg((o.phase === 'staged' && cur && cur !== String(o.version))
        ? ('You are on v' + cur + ' — installing v' + o.version + ' replaces it.')
        : '');
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
      // Build download URL — try raw.githubusercontent.com first (no CDN
      // caching, direct binary), then GitHub Pages as fallback.
      var _dlUrl = bust(String(man.url).indexOf('http') === 0 ? man.url : OTA_BASE + 'ota/' + man.url);
      var _rawUrl = bust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/update.zip');
      var dl = Updater.download({
        url: _rawUrl,
        version: String(man.version)
      }).catch(function(_rawErr){
        log('raw.githubusercontent.com download failed, trying GitHub Pages: ' + ((_rawErr && _rawErr.message) || _rawErr));
        return Updater.download({
          url: _dlUrl,
          version: String(man.version)
        });
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
  // force: the user asked for this install BY HAND (the sheet's Install now). A
  // deliberate install must not be deferred back at them — it used to run the same
  // music-playing deferral as the automatic paths, so tapping "Install now" on a
  // phone that was playing something did nothing but hide the sheet, and the update
  // could sit staged for ever on a phone that always has music on. The sheet says
  // the app is about to reopen, so stopping playback here is what was asked for.
  function applyStagedNow(Updater, nb, force){
    if(!nb || !nb.id) return false;
    if(String(nb.version || '') === String(currentVersion())){
      // The staged record points at the bundle we are ALREADY running: the plugin
      // only clears "next" once a boot confirms it, so a stale record survives a
      // reload. Applying it again reloads into the same version — the endless
      // refresh. Nothing to do but forget it (and stop the plugin applying it too).
      log('staged ' + nb.version + ' is already the running version — nothing to apply');
      clearSheet();
      neutralizeStaged(Updater, nb, 'already the running version');
      return false;
    }
    // NEVER hand the app a bundle that is not newer than the one it is running.
    // Every other path refused an older version; this one applied whatever was
    // staged — so an old bundle left staged (from a rollback, or downloaded for
    // "install later" and never confirmed) could be installed over a newer build,
    // and the app downgraded itself: "it updated and then rolled itself back".
    if(isOlderBundle(nb.version)){
      log('refusing staged v' + nb.version + ' — it is older than the running v' + currentVersion());
      clearSheet();
      neutralizeStaged(Updater, nb, 'older than the running version');
      return false;
    }
    if(!force && somethingIsPlaying()){
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
      // NO pending record is written here, deliberately. A pending record means
      // "we handed the WebView over to this version and it reloaded", and the next
      // boot uses it to confirm the bundle or mark it failed (noteBootOutcome).
      // Nothing reloaded on a deferral — the app kept running the old bundle and
      // the install only happens when the app is closed — so writing one here made
      // the very next launch mark a perfectly good staged update as "rolled back"
      // and refuse it for ever.
      return true;
    }
    log('applying staged bundle ' + nb.version + ' now (user asked)');
    // Remember what we are handing over to before the WebView reloads away: the
    // next boot compares this with what actually came up (noteBootOutcome).
    try{ localStorage.setItem(PENDING_KEY, JSON.stringify({ version: String(nb.version || ''), at: Date.now() })); }catch(e){}
    markAutoHandled(String(nb.version || ''));
    clearInstallDelay(Updater);
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
    // An update we install wins over an old version left pinned in the rollback
    // picker. Without this the freshly installed bundle boots, the pin sends the
    // page straight back to the old snapshot, and the launch after that does it
    // again — install, swap back, install, forever, while the app reports the old
    // version. The page reads this flag on its next boot and drops the pin.
    try{ localStorage.setItem(PIN_CLEAR_KEY, '1'); }catch(e){}
    // Record the attempt ON DISK before handing over (awaited), then let the
    // "Installing…" sheet paint for a moment: if the bundle takes the app down,
    // the next launch reads this and knows not to try it a second time.
    ledgerMarkTried(String(nb.version || ''), 'hand-over').then(function(){
      setTimeout(function(){
        try{ Updater.set({ id: nb.id }); }catch(e){ log('set failed: ' + ((e && e.message) || e)); }
      }, 350);
    });
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
      if(isBadVersion(String(nb.version))) return; // a failed bundle is not re-offered either
      if(String(nb.version) === String(currentVersion())) return; // already running it
      if(isOlderBundle(nb.version)){ neutralizeStaged(U, nb, 'older than the running version'); return; }
      if(!wantDeferredInstall(String(nb.version))) return; // auto-apply path already handled it
      if(sheetRefs && sheetRefs.card && sheetRefs.card.style.display === 'block') return;
      var st = readSheet();
      if(st && st.version === String(nb.version)) return; // already on screen
      var sk = STAGED_SHOWN_KEY + nb.version;
      try{ if(localStorage.getItem(sk) === '1') return; }catch(e){}
      try{ localStorage.setItem(sk, '1'); }catch(e){}
      showSheet({
        phase: 'staged', version: String(nb.version), date: (st && st.date) || '', notes: (st && st.notes) || [],
        onNow: function(){ try{ localStorage.removeItem(sk); }catch(e){} if(applyStagedNow(U, nb, true)) hideSheet(); },
        onLater: function(){ try{ localStorage.setItem(INSTALL_PROMPT_SEEN + nb.version, '1'); }catch(e){} hideSheet(); toast('Saved for later — installs when you leave the app.', 3500); }
      });
    }).catch(function(){});
  }

  function wantDeferredInstall(version){
    try{ if(localStorage.getItem(INSTALL_PROMPT_SEEN + version) === '1') return true; }catch(e){}
    return false;
  }

  // v58.8.5: an update staged while a song is playing is handed to the native
  // updater with a "when the app is killed" condition, instead of letting it swap
  // the bundle on the next background. A swap is a reload, and a reload takes the
  // song with it — then the user reopens a fresh app that is not playing and has
  // to press play. With this, "it installs when you close the app" is literally
  // what happens.
  function waitForRelaunch(Updater){
    try{
      if(!Updater || typeof Updater.setMultiDelay !== 'function') return;
      Updater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] }).catch(function(){});
    }catch(e){}
  }
  // The user asked to install now: any "wait for a kill" condition must be lifted
  // or the deliberate install would sit behind it.
  function clearInstallDelay(Updater){
    try{
      if(!Updater || typeof Updater.cancelDelay !== 'function') return;
      Updater.cancelDelay().catch(function(){});
    }catch(e){}
  }

  // Stage-only. This used to be the "installs the moment you leave the app" path,
  // and every version of it ended in a reload the user did not ask for: a bundle
  // swap mid-background shows up as "I open the app and it refreshes by itself",
  // and it lands on top of playback, so the song is gone and play has to be
  // pressed again. Nothing here calls set() any more. The bundle stays staged and
  // the native updater activates it on the next real app kill/relaunch — which is
  // exactly what "it installs when you close the app" told the user.
  //
  // Returns 'deferred' when the bundle is staged for the next launch, or false
  // when the bundle must not be staged at all (known-bad, boot loop, …).
  function applyInBackground(Updater, nb){
    if(!Updater || !nb || !nb.id) return false;
    var version = String(nb.version || '');
    // A bundle that already failed to take over is never used again — and it has to
    // be taken away from the native updater too, or the plugin swaps it in by itself
    // on the next background and the refusal means nothing.
    if(isBadVersion(version)){
      log('staged ' + version + ' failed to start before — leaving it alone');
      neutralizeStaged(Updater, nb, 'failed to start before');
      return false;
    }
    // A boot loop means the updater must not touch bundles at all this session.
    if(bootLooping()){
      log('boot loop detected — not touching ' + version);
      neutralizeStaged(Updater, nb, 'boot loop');
      return false;
    }
    // Already handed over to once without it sticking: never again automatically.
    if(autoHandledAlready(version)){
      markBadVersion(version, 'auto-handled once without taking over');
      neutralizeStaged(Updater, nb, 'already handed over to once');
      return false;
    }
    // A staged record that is the running version is stale, not an update.
    if(version === String(currentVersion())){
      log('staged ' + version + ' is already the running version — nothing to do');
      neutralizeStaged(Updater, nb, 'already the running version');
      return false;
    }
    // Only ever move forward, here too.
    if(isOlderBundle(version)){
      log('refusing staged ' + version + ' — older than the running v' + currentVersion());
      neutralizeStaged(Updater, nb, 'older than the running version');
      return false;
    }
    // ALWAYS pin the hand-over to a real app kill, never to "the app went to the
    // background and came back". That is the difference the user feels: opening the
    // app from the widget, the lock screen or a headset resumes the existing
    // WebView, and a bundle that was only waiting for a background cycle swaps
    // itself in at that moment — "every time I open the app any other way it just
    // auto refreshes". Waiting for a genuine kill means the swap happens during a
    // cold start, where it reads as the app simply opening.
    waitForRelaunch(Updater);
    log('v' + version + ' stays staged — it installs on the next app launch');
    return 'deferred';
  }

  // Installing an update on a REAL launch.
  //
  // The staged hand-over was pinned to "when the app is killed", and a phone that
  // keeps the app warm never fires that: the update sat staged forever and had to
  // be tapped in from the sheet ("so I actually get the update"). This runs from
  // the load event only — a fresh launch, never a background/foreground resume,
  // which is the thing that used to make the app look like it was refreshing
  // itself at random. Every guard still applies, and the attempt is recorded
  // BEFORE the reload: if the bundle does not take over, the next boot's
  // noteBootOutcome() marks it failed and it is never auto-installed again.
  function installStagedOnBoot(Updater, nb){
    try{
      if(!Updater || !nb || !nb.id) return false;
      var version = String(nb.version || '');
      if(!version) return false;
      if(version === String(currentVersion())) return false;  // a stale record, not an update
      if(!isNewerBundle(version)){                            // never install a downgrade
        neutralizeStaged(Updater, nb, 'older than the running version');
        return false;
      }
      if(isBadVersion(version)) return false;                 // failed to start before
      if(bootLooping()) return false;                         // the app is restarting itself
      if(autoHandledAlready(version)) return false;           // already handed over to once
      if(ledgerTriedBefore(version)){                         // ...even if the record is only on disk
        markBadVersion(version, 'already handed over to once (recorded on disk)');
        return false;
      }
      var key = BOOTAPPLY_KEY + version;
      try{ if(localStorage.getItem(key) === '1') return false; }catch(e){}
      log('installing staged v' + version + ' on launch');
      // applyStagedNow() returns true when it DEFERRED (a song is playing, so the
      // install waits for app-close); anything else means the hand-over is running
      // and the JS context is about to be replaced.
      var _deferred = applyStagedNow(Updater, nb) === true;
      // The "one automatic hand-over per version" record is written only once the
      // hand-over is really running. It used to be written BEFORE the call, so a
      // launch that deferred the install because music was playing — the normal
      // case on a phone that plays all day — burnt that version's single attempt
      // and the update was never auto-installed again: it sat staged while the app
      // kept booting the old bundle, and every later release that landed the same
      // way looked like "the fix did nothing".
      if(!_deferred){ try{ localStorage.setItem(key, '1'); }catch(e){} }
      return !_deferred;
    }catch(e){ return false; }
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
  function pendingInstall(){
    try{ var raw = localStorage.getItem(PENDING_KEY); if(raw){ var d = JSON.parse(raw); if(d && d.version) return d; } }catch(e){}
    return null;
  }
  function clearPending(){ try{ localStorage.removeItem(PENDING_KEY); }catch(e){} }
  function markBadVersion(version, why){
    if(!version) return;
    try{ localStorage.setItem(BAD_KEY + version, String(Date.now())); }catch(e){}
    ledgerMarkBad(version);
    log('v' + version + ' did not take over (' + (why || 'unknown') + ') — it will never be auto-installed again');
  }
  function isBadVersion(version){
    if(!version) return false;
    try{ if(localStorage.getItem(BAD_KEY + version)) return true; }catch(e){}
    return !!_ledger.bad[String(version)];
  }
  // One AUTOMATIC hand-over per version, shared by every automatic path (the boot
  // hand-over and the update check). If we already handed over to this exact bundle
  // and the running version still is not it, it never took over — reloading into it
  // again is the endless refresh the user sees, so it is never auto-attempted twice.
  function autoHandledAlready(version){
    if(!version) return false;
    try{ return localStorage.getItem(AUTOHANDLED_KEY + version) === '1'; }catch(e){ return false; }
  }
  function markAutoHandled(version){
    if(!version) return;
    try{ localStorage.setItem(AUTOHANDLED_KEY + version, '1'); }catch(e){}
  }
  // True while the app is stuck restarting itself (see the boot-loop breaker in
  // index.html): the updater must not touch bundles at all in that state.
  function bootLooping(){
    try{ if(window.__scBootLooping) return true; }catch(e){}
    try{ if(typeof window.__scAutoReloadAllowed === 'function' && !window.__scAutoReloadAllowed()) return true; }catch(e){}
    // ...and the version that is on DISK does not need the page to have survived
    // long enough to write anything: three launches inside a minute is the app
    // restarting itself, whatever the cause. No automatic bundle changes at all.
    if(ledgerHotBoots()) return true;
    return false;
  }
  // Runs the moment the running app is confirmed healthy. Either the version we
  // handed over to IS what is running (update confirmed — forget it), or it is
  // not: the bundle was rolled back, and putting it back on every boot is what
  // turned one bad update into an endless refresh. That version is marked failed
  // and the user is told, once.
  function noteBootOutcome(){
    var pend = pendingInstall();
    if(!pend) return;
    var cur = String(currentVersion() || '');
    if(cur && cur === String(pend.version)){
      clearPending();
      try{ localStorage.removeItem(BAD_KEY + pend.version); }catch(e){}
      log('v' + pend.version + ' is running — hand-over confirmed');
      return;
    }
    markBadVersion(String(pend.version), 'rolled back to v' + (cur || 'the previous version'));
    clearPending();
    try{
      if(localStorage.getItem('sidecut_ota_notified_' + pend.version) !== '1'){
        localStorage.setItem('sidecut_ota_notified_' + pend.version, '1');
        toast('Update ' + pend.version + ' did not start, so SideCut stayed on v' + (cur || 'your current version') + '. Nothing is broken — you can try it again from Settings.', 7000);
      }
    }catch(e){}
  }
  // Confirms a freshly installed bundle as soon as the app has REALLY booted, and
  // never reverts one just because the app was slow to start.
  //
  // This used to be a single check 4 seconds after 'load': a bundle whose app had
  // not finished booting by then stayed unconfirmed, the plugin rolled it back,
  // and the version it rolled back to offered the same update again — install,
  // reload, roll back, install… a phone stuck refreshing with nothing playing.
  // Polling from the moment this script runs, with a long deadline, confirms a
  // working bundle promptly at any boot speed, while a bundle whose app genuinely
  // never boots is still rolled back (just seconds later, instead of never).
  // A version left pinned in the rollback picker swaps the page back to that
  // version's saved snapshot on every launch, while the BUNDLE underneath keeps
  // updating. Left alone the two fight for the app: the installed bundle boots,
  // the pin swaps the page straight back to the old version, the next launch does
  // it again — restart after restart, always reporting the old version ("it
  // updated and then rolled itself back and now it restarts every few seconds").
  // The page records the pin it honoured (sidecut_pinned_snapshot), so when the
  // installed bundle is NEWER than the page we are looking at, and a pin is what
  // put us here, the pin is dropped and the newest version runs.
  function detectPinnedOlderPage(Updater){
    try{
      if(!Updater || typeof Updater.current !== 'function') return;
      var pinned = null;
      try{ pinned = localStorage.getItem('sidecut_pinned_snapshot'); }catch(e){}
      var pageV = currentVersion();
      if(!pinned || !pageV || String(pinned) !== String(pageV)) return; // not a pinned snapshot view
      Updater.current().then(function(cur){
        if(!cur || !cur.id || String(cur.id) === 'builtin') return;
        var bundleV = String(cur.version || '');
        if(!bundleV || compareVersions(bundleV, String(pageV)) <= 0) return; // nothing newer installed
        try{ localStorage.setItem(PIN_CLEAR_KEY, '1'); }catch(e){}
        neutralizeStaged(Updater, { id: cur.id, version: bundleV }, 'page is older than the installed bundle');
        log('v' + bundleV + ' is installed but v' + pageV + ' is pinned over it — returning to the newest version');
        try{ if(typeof window.toast === 'function') window.toast('SideCut v' + bundleV + ' is installed — switching back to it.', 5000); }catch(e){}
        try{
          if(typeof window.__scAutoReloadAllowed === 'function' && !window.__scAutoReloadAllowed()){ log('reload blocked by the boot-loop breaker'); return; }
        }catch(e){}
        // One reload: the next boot is the installed bundle's own page, which
        // honours the clear flag above and drops the pin.
        setTimeout(function(){ try{ location.reload(); }catch(e){} }, 1200);
      }).catch(function(){});
    }catch(e){}
  }
  function markAppReadyWhenBooted(){
    if(!IS_NATIVE) return;
    // Load the on-disk ledger first (a few ms) and stamp this launch into it, so
    // a restart loop is visible even to a launch that dies immediately after.
    var _U = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
    ledgerLoad().then(function(){ return ledgerNoteBoot(); }).then(function(){ detectPinnedOlderPage(_U); }).catch(function(){});
    var startedAt = Date.now();
    var deadline = 20000;
    (function poll(){
      if(appBooted()){
        markAppReady();
        noteBootOutcome();
        return;
      }
      if(Date.now() - startedAt > deadline){
        log('app did not finish booting within ' + deadline + 'ms — leaving the bundle unconfirmed so it rolls back');
        return;
      }
      setTimeout(poll, 250);
    })();
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
      // Try multiple URLs and CORS proxies — the native WebView (origin
      // https://localhost) often fails cross-origin fetch to GitHub Pages
      // due to Android WebView CORS restrictions. The proxy chain ensures
      // at least one path works.
      // Use CapacitorHttp first — it bypasses WebView CORS entirely by using
      // native Android HTTP. Only fall back to fetch() if CapacitorHttp isn't available.
      var _capHttp = null;
      try{ var _cap = window.Capacitor && window.Capacitor.Plugins; _capHttp = _cap && _cap.CapacitorHttp; }catch(_e){}
      var _rawManifest = bust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/updates.json');
      var resp = null;
      // 1) CapacitorHttp — native, no CORS restrictions
      if(_capHttp && typeof _capHttp.request === 'function'){
        try{
          var _r = await _capHttp.request({ url: _rawManifest, method: 'GET' });
          if(_r && _r.data){ resp = { ok: true, json: async function(){ return (typeof _r.data === 'string') ? JSON.parse(_r.data) : _r.data; } }; }
        }catch(_ce){ resp = null; }
      }
      // 2) Fallback to fetch with CORS proxy chain
      if(!resp){
        var _pagesManifest = bust(MANIFEST_URL);
        var _fetchAttempts = [
          _rawManifest,
          _pagesManifest,
          'https://corsproxy.io/?' + encodeURIComponent(_pagesManifest),
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(_pagesManifest),
          'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(_pagesManifest)
        ];
        for(var _fi = 0; _fi < _fetchAttempts.length; _fi++){
          try{
            var ctrl = new AbortController();
            var timer = setTimeout(function(){ ctrl.abort(); }, 12000);
            resp = await fetch(_fetchAttempts[_fi], { signal: ctrl.signal });
            clearTimeout(timer);
            if(resp && resp.ok) break;
            resp = null;
          }catch(_fe){ resp = null; }
        }
      }
      if(!resp){ log('manifest fetch failed on all attempts'); if(!o.silent) toast('Update check failed — could not reach the update server. Check your connection and try again.', 4500); return { failed: true }; }
      if(!resp || !resp.ok){ log('manifest fetch failed: ' + (resp ? resp.status : 'no response')); if(!o.silent) toast('Update check failed — could not reach the update server (' + (resp ? resp.status : 'no connection') + '). Check your connection and try again.', 4500); return { failed: true }; }
      var man = null;
      try{ man = await resp.json(); }catch(_j){}
      if(!man || !man.version || !man.url){ log('manifest missing version/url'); if(!o.silent) toast('Update check failed — the server update info was unreadable. Try again in a moment.', 4500); return { failed: true }; }
      var cur = currentVersion();
      log('manifest version: ' + man.version + ', running version: ' + cur);
      if(!cur){ log('cannot determine the running version — skipping update check (fail safe)'); return null; }
      // Silent (automatic) checks never re-download a version that already failed
      // on this device — that is loop fuel. A deliberate Check for updates still
      // offers it, so the user can retry.
      if(o.silent && isBadVersion(String(man.version))){
        log('v' + man.version + ' failed to start here before — not re-downloading it automatically');
        return null;
      }
      var _cmp = compareVersions(man.version, cur);
      if(_cmp <= 0){
        // Only ever move forward. A manifest that is older than what is already
        // installed means the published bundle is stale (the committed ota/ copy
        // lagging behind index.html is exactly how that happened here) — say so
        // and change nothing, instead of downloading it over the top.
        log(_cmp === 0 ? ('up to date (' + cur + ')')
                       : ('published bundle is older (v' + man.version + ') than this build (v' + cur + ') — nothing to install'));
        return null;
      }

      // A newer version than this build is published (whether it is already
      // staged, deferred, or about to be offered in the sheet): announce it once,
      // here, so every path below is covered.
      announceAvailable(man);

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

      // New update available: show the patch notesand ask before downloading.
      // Silent auto-checks SURFACE the sheet too — never hide an available update.
      // The Install now path is already playback-safe: applying while music plays
      // defers to app-close (applyInBackground), so no tune is ever cut. A
      // user who picked "Install later" for this version stays quiet on silent checks.
      if(wantDeferredInstall(String(man.version)) && o.silent){
        // The user already chose "Install later" — remember it quietly and let
        // the close-install wiring finish the job.
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
      if(isOlderBundle(st.version)){
        // A 'staged' record for a version older than the one running is history,
        // not an update — offering it would invite a downgrade.
        clearSheet();
        return;
      }
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

  // Auto-check shortly after boot, then every three hours and on app foreground.
  // Silent checks DO surface the update sheet when a newer version exists (the
  // boot one fires ~2.5s in so a fresh update is visible on every refresh).
  // Silent checks still never auto-download or auto-apply; the sheet asks.
  //
  // The periodic one now refuses to run while the app is in the background: a
  // network wake-up every half hour, all day, on a phone that is not even open is
  // exactly the sort of thing that shows up as "drains my battery even when the
  // app isn't open". Coming back to the app checks anyway (below), so nothing is
  // missed — the timer is just no longer a reason to wake the radio.
  function startAutoCheck(){
    if(!IS_NATIVE) return;
    setTimeout(function(){ if(document.visibilityState !== 'hidden') checkForUpdate({ silent: true }); }, 2500);
    setInterval(function(){
      if(document.visibilityState === 'hidden') return;
      checkForUpdate({ silent: true });
    }, 3 * 60 * 60 * 1000);
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

  // Tell the app that a newer build exists, so it can say so where the user will
  // actually see it (a toast on the boot it is found, plus a permanent entry in
  // the notification bell) instead of leaving the news inside Settings → More.
  // This costs nothing: the check itself already ran, and this only publishes the
  // result it returned. No network call, no timer, nothing in the background.
  function announceAvailable(man){
    try{
      if(!man || !man.version) return;
      var info = { version: String(man.version), date: man.date || '', size: man.size || 0, at: Date.now() };
      window.__SideCutUpdateAvailable = info;
      try{ window.dispatchEvent(new CustomEvent('sc-update-available', { detail: info })); }catch(_ev){}
    }catch(_e){}
  }

  window.__SideCutOTA = { IS_NATIVE: IS_NATIVE, checkForUpdate: checkForUpdate, markAppReady: markAppReady, startAutoCheck: startAutoCheck, restoreSheetState: restoreSheetState, staged: staged, neutralizeStaged: neutralizeStaged, isOlderBundle: isOlderBundle, OTA_BASE: OTA_BASE };
    markAppReadyWhenBooted();
  earlyDirectionGuard();
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
              // A staged bundle that IS the running version is a stale record, not an
              // update: re-applying it reloads into the same build, which is exactly
              // the endless refresh the user sees after an update.
              if(String(nb.version) === String(currentVersion())){
                log('staged ' + nb.version + ' is already the running version — ignoring it');
                neutralizeStaged(U, nb, 'already the running version');
                return;
              }
              // An older bundle must never be handed in over a newer build: it is what
              // made the app roll itself back to a previous version on its own.
              if(isOlderBundle(nb.version)){
                log('staged ' + nb.version + ' is older than the running v' + currentVersion() + ' — refusing it');
                neutralizeStaged(U, nb, 'older than the running version');
                return;
              }
              // One automatic hand-over per version. If we already auto-applied this
              // exact bundle on a boot and the version did not change, it never took
              // over: treat it as failed instead of reloading into it forever.
              var bootApplyKey = BOOTAPPLY_KEY + nb.version;
              try{
                if(localStorage.getItem(bootApplyKey) === '1'){
                  markBadVersion(String(nb.version), 'auto-applied on boot without taking over');
                  return;
                }
              }catch(e){}
              // A boot loop (the app restarting itself over and over) means the
              // updater must not touch bundles at all this session.
              if(bootLooping()){
                log('boot loop detected — not auto-applying anything');
                neutralizeStaged(U, nb, 'boot loop');
                return;
              }
              // This version was already handed over to automatically once.
              if(autoHandledAlready(String(nb.version))){
                markBadVersion(String(nb.version), 'auto-applied once without taking over');
                neutralizeStaged(U, nb, 'already handed over to once');
                return;
              }
              // v56.0.16 behavior restored (the sheet rewrite dropped it): a
              // staged bundle applies at launch — immediately for users who
              // never chose "Install later", on close for those who did —
              // instead of sitting behind the update sheet forever.
              // Auto-apply on boot if nothing is playing — instant update, no tap needed
              if(isBadVersion(String(nb.version))){
                // This exact bundle already failed to take over once. Re-applying it
                // on every boot is what turned a single bad update into an endless
                // refresh, so it is never auto-applied again — the in-app Check for
                // updates button can still try it by hand.
                log('staged ' + nb.version + ' failed to start before — not auto-applying it');
                neutralizeStaged(U, nb, 'failed to start before');
                return;
              }
              // v58.9.1: install it right here, on this launch. Waiting for a
              // kill meant phones that keep the app warm never updated at all.
              // This is the load handler, so it is a real launch — not the
              // background/foreground resume that used to read as "the app
              // refreshes itself when I open it" — and it happens at most once
              // per bundle.
              if(installStagedOnBoot(U, nb)) return;
              // Only offer it in the sheet when it is a real update that is still
              // staged: applyInBackground() refuses anything older, known-bad, or
              // arriving during a restart loop, and a refused bundle must never be
              // presented to the user as something they can install.
              if(applyInBackground(U, nb) !== 'deferred') return;
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
