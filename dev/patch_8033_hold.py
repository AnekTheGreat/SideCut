"""80.3.3, section 6 - a run is not a window.

The hold: a Web Lock for the whole run, the progress mirrored into the system
notification, the native SideCutJob hold on Android, nested-run depth, and a no-op
everywhere the plugin is absent.

Imported by dev/patch-8033.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 6. A run is not a window: the hold, and the notification
# ---------------------------------------------------------------------------
HOLD_FN = r"""  // ---- A RUN IS NOT A WINDOW ------------------------------------------------------
  // A batch reports into a floating pill, and the pill is not the run: the run has to
  // outlive the window it was started from, the app going behind something else, and -
  // on a phone - the screen going off. Three things make that true, and none of them is
  // the page being visible:
  //
  //   * a Web Lock held for the whole run. This is the one signal every platform
  //     honours about work that must not be frozen or shed while a page is hidden, and
  //     the re-encode job has held one since 74.1.7 for the same reason.
  //   * a native hold when the Android build provides one (SideCutJob, injected by
  //     patch-joblock.py: a partial wake lock plus a dataSync foreground service).
  //     Android suspends an app whose screen is off unless something holds a wake lock,
  //     and a suspended app does not read a range. In a browser, and on any APK older
  //     than this release, the call is a no-op and the run is exactly as it was.
  //   * the system notification, which the pill already mirrors (scNotifyProgress) - the
  //     native hold carries the same numbers so the progress is readable with the app
  //     closed.
  var scRunJob = { depth: 0, release: null, native: false, title: '', notedAt: 0 };
  function scJobPlugin(){
    try{
      var C = (typeof window !== 'undefined' && window.Capacitor) || null;
      return (C && C.Plugins && C.Plugins.SideCutJob) || null;
    }catch(_jp){ return null; }
  }
  function scJobCall(method, data){
    var P = scJobPlugin();
    if(!P || typeof P[method] !== 'function') return null;
    try{
      var out = P[method](data || {});
      if(out && typeof out.catch === 'function') out.catch(function(){});
      return out;
    }catch(_jc){ return null; }
  }
  function scRunJobStart(title, sub){
    scRunJob.depth++;
    if(scRunJob.depth > 1) return;
    scRunJob.title = title || 'Conversion';
    try{
      if(typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request){
        scRunJob.release = null;
        // Held until release() resolves the promise the callback returned: the lock is
        // the run's own lifetime, not this function's.
        var held = navigator.locks.request('sidecut-download', { mode: 'shared' }, function(){
          return new Promise(function(res){ scRunJob.release = res; });
        });
        if(held && typeof held.catch === 'function') held.catch(function(){});
      }
    }catch(_le){}
    scRunJob.native = !!scJobCall('hold', { title: scRunJob.title, sub: sub || '' });
    scRunJob.notedAt = Date.now();
  }
  // Throttled: the notification is a shade entry, not a progress bar to repaint 40
  // times a song, and a bridge call per percent would cost more than it shows.
  function scRunJobNote(sub, pct){
    if(scRunJob.depth <= 0 || !scRunJob.native) return;
    var now = Date.now();
    if(now - scRunJob.notedAt < 1200) return;
    scRunJob.notedAt = now;
    scJobCall('update', { title: scRunJob.title, sub: sub || '', pct: Math.round(pct || 0) });
  }
  function scRunJobEnd(){
    if(scRunJob.depth > 0) scRunJob.depth--;
    if(scRunJob.depth > 0) return;
    var release = scRunJob.release;
    scRunJob.release = null;
    if(release){ try{ release(); }catch(_re){} }
    if(scRunJob.native){ scRunJob.native = false; scJobCall('release', {}); }
  }
"""
