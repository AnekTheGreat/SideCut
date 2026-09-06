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
// The zip + manifest are produced by .github/workflows/deploy.yml on every push:
//   ota/SideCut-web.zip   — index.html, sw.js, manifest.json, icons
//   ota/manifest.json     — { "version": "56.0.11", "url": "SideCut-web.zip" }
(function(){
  'use strict';
  var IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  // GitHub Pages root of this repo (matches capacitor.config.json allowNavigation).
  var OTA_BASE = 'https://anekthegreat.github.io/SideCut/';
  var MANIFEST_URL = OTA_BASE + 'ota/manifest.json';
  var LS_KEY = 'sidecut_ota_last';

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

  // Confirms the running bundle is healthy so Capgo keeps it; a bundle that
  // never gets this call is rolled back to the previous one automatically.
  function markAppReady(){
    if(!IS_NATIVE || !appBooted()) return;
    try{
      var p = window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
      if(p && typeof p.notifyAppReady === 'function') p.notifyAppReady().catch(function(){});
    }catch(e){}
  }

  async function checkForUpdate(opts){
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
      try{
        var nb = await Updater.getNextBundle();
        if(nb && nb.version === String(man.version)){
          log('bundle ' + man.version + ' already staged, applying on next relaunch');
          toast('Update ' + man.version + ' is ready — restart the app to finish installing it.', 4000);
          return man;
        }
      }catch(_ne){}
      if(!o.silent) toast('Downloading update ' + man.version + '…');
      var bundle = await Updater.download({
        url: (String(man.url).indexOf('http') === 0 ? man.url : OTA_BASE + 'ota/' + man.url),
        version: String(man.version)
      });
      if(!bundle || !bundle.id){ log('download returned no bundle'); return man; }
      // Stage, don't reload: the bundle activates on background/relaunch, so a
      // playing song is never interrupted.
      await Updater.next({ id: bundle.id });
      try{ localStorage.setItem(LS_KEY, JSON.stringify({ version: String(man.version), at: Date.now() })); }catch(_e){}
      log('staged ' + man.version + ' (id ' + bundle.id + ')');
      toast('Update ' + man.version + ' downloaded — it installs when you close the app.', 4500);
      return man;
    }catch(e){
      log('update check failed: ' + ((e && e.message) || e));
      if(!o.silent) toast('Update check failed — check your connection.', 3000);
      return null;
    }
  }

  // Auto-check shortly after boot, then every 30 minutes and on app foreground.
  function startAutoCheck(){
    if(!IS_NATIVE) return;
    setTimeout(function(){ checkForUpdate({ silent: true }); }, 8000);
    setInterval(function(){ checkForUpdate({ silent: true }); }, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState === 'visible') checkForUpdate({ silent: true });
    });
  }

  window.__SideCutOTA = { IS_NATIVE: IS_NATIVE, checkForUpdate: checkForUpdate, markAppReady: markAppReady, startAutoCheck: startAutoCheck, OTA_BASE: OTA_BASE };
  if(IS_NATIVE){
    // Give the main app script time to finish booting; only then confirm the
    // bundle is healthy and start checking for newer ones.
    window.addEventListener('load', function(){
      setTimeout(function(){
        if(!appBooted()){ log('app did not finish booting — bundle stays unconfirmed'); return; }
        markAppReady();
        startAutoCheck();
      }, 4000);
    });
  }
})();
