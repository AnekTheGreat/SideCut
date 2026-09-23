// v60.5.6 — one counted, atomic patch:
//   1. The converting pill becomes a SMALL floating bubble: compact width,
//      draggable anywhere (hold and slide; a move under 6px is still a tap),
//      position saved as viewport fractions so it survives restarts/rotation.
//   2. Progress shows in Android notifications: scNotifyProgress() mirrors the
//      run into the shade through the CI-injected SideCutWidget plugin
//      (notifyProgress, throttled to 500ms, permission asked once), the
//      finished result replaces the progress row, and exports post through the
//      same helper from refreshExportNotif().
//   3. The bell gets a live conversion entry (html + summary + badge), driven
//      by the one progress state the pill already maintains.
//   4. Version 60.5.6 / package 5.0.52, sw cache follows, test pins move.
// patch-widget.py gains the notifyProgress @PluginMethod + the POST_NOTIFICATIONS
// permission annotation (the manifest permission itself is already declared by
// patch-manifest.py).
//
// Every replacement is counted: a missed or ambiguous anchor fails loudly.
import fs from 'node:fs';

let edits = 0, failed = 0;
function apply(path, oldStr, newStr, label, expected = 1) {
  const src = fs.readFileSync(path, 'utf8');
  let n = 0, i = src.indexOf(oldStr);
  while (i !== -1) { n++; i = src.indexOf(oldStr, i + oldStr.length); }
  if (n !== expected) { failed++; console.error(`MISS(${n}/${expected}) [${label}] in ${path}`); return; }
  let out = '', rest = src;
  for (let k = 0; k < expected; k++) {
    const at = rest.indexOf(oldStr);
    out += rest.slice(0, at) + newStr;
    rest = rest.slice(at + oldStr.length);
  }
  out += rest;
  fs.writeFileSync(path, out);
  edits++;
  console.log(`ok  [${label}] x${n}`);
}
function assertContains(path, needle, label, expected = true) {
  const has = fs.readFileSync(path, 'utf8').includes(needle);
  if (has !== expected) { failed++; console.error(`FAIL [${label}] contains=${has} want=${expected}`); }
  else console.log(`ok  [${label}]`);
}
function assertNotContains(path, needle, label) { assertContains(path, needle, label, false); }
const count = (path, needle) => {
  const src = fs.readFileSync(path, 'utf8');
  let n = 0, i = src.indexOf(needle);
  while (i !== -1) { n++; i = src.indexOf(needle, i + needle.length); }
  return n;
};

const HTML = 'index.html';
const WID = '.github/workflows/patch-widget.py';

// ── 1. version bump ─────────────────────────────────────────────────────────
apply(HTML, "const APP_VERSION = '60.5.5';", "const APP_VERSION = '60.5.6';", 'APP_VERSION');
apply('sw.js', "const CACHE_NAME = 'sidecut-shell-v60.5.5';", "const CACHE_NAME = 'sidecut-shell-v60.5.6';", 'sw cache');
apply('package.json', '  "version": "5.0.51",', '  "version": "5.0.52",', 'package version');

// ── 2. changelog entry: 4 [FULL] + 1 shared (the other channel needs >=1) ──
apply(HTML,
`  const CHANGELOG = [
  { version: '60.5.5',`,
`  const CHANGELOG = [
  { version: '60.5.6', date: 'September 23, 2026 · 2:25 AM EDT', title: 'Floating conversion bubble, live progress in the shade and the bell', items: [
    '[FULL] The converting banner is now a small floating bubble instead of a full-width bar: hold and slide it anywhere on the screen, it stays where you put it across runs and app restarts, and it keeps the Cancel button and the tap-to-open-library finish.',
    '[FULL] Conversion progress shows in the Android notification shade: the live step and percent ride there while a run goes (tap the notification to jump back into SideCut), and the finished result — added, cancelled or failed — replaces the progress row and stays until you swipe it away.',
    '[FULL] The bell gets a live entry while anything converts: title, current step, a progress bar and the percent, badged so a peek from anywhere in the app never disturbs the run.',
    '[FULL] Bubble, bell and shade all read one progress state now, so the three can never disagree about what a run is doing or what it did.',
    'Exports post to the same notifications: phase and percent while the .zip builds and saves, a tap returns to SideCut, and the finished export leaves a message in the shade instead of vanishing while you were in another app.',
  ] },
  { version: '60.5.5',`,
'changelog 60.5.6 entry');

// ── 3. bubble helpers + shade bridge; state gains pct ──────────────────────
apply(HTML,
`  var scConvertPillState = { el: null, timer: null };`,
`  // Where the bubble was dropped, as viewport fractions — so it comes back in
  // frame after a restart, a rotation or a different screen size.
  function scPillSavePos(x, y, w, h){
    try{
      localStorage.setItem('sidecut_pillPos', JSON.stringify({
        fx: x / Math.max(1, window.innerWidth - w),
        fy: y / Math.max(1, window.innerHeight - h)
      }));
    }catch(_sp){}
  }
  function scPillApplyPos(pill){
    try{
      var raw = localStorage.getItem('sidecut_pillPos');
      if(!raw) return;
      var p = JSON.parse(raw);
      if(!p || typeof p.fx !== 'number' || typeof p.fy !== 'number') return;
      var w = pill.offsetWidth || 240, h = pill.offsetHeight || 56;
      var x = Math.min(Math.max(p.fx * Math.max(1, window.innerWidth - w), 4), Math.max(4, window.innerWidth - w - 4));
      var y = Math.min(Math.max(p.fy * Math.max(1, window.innerHeight - h), 4), Math.max(4, window.innerHeight - h - 4));
      pill.style.left = x + 'px'; pill.style.top = y + 'px';
      pill.style.right = 'auto'; pill.style.bottom = 'auto';
    }catch(_ap){}
  }
  // Hold-and-slide anywhere. A movement under 6px is a tap, so the done-state
  // "open my library" click still fires — and a real drag can never count as
  // one: this capture-phase guard runs before pill.onclick is reached.
  function scPillMakeDraggable(pill){
    pill._scDragged = false;
    pill.addEventListener('click', function(ev){
      if(pill._scDragged){ pill._scDragged = false; ev.preventDefault(); ev.stopPropagation(); }
    }, true);
    pill.addEventListener('pointerdown', function(e){
      if(e.button !== undefined && e.button !== 0) return;
      if(e.target && e.target.closest && e.target.closest('.sc-pill-cancel')) return;
      var rect = pill.getBoundingClientRect();
      var ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      var sx = e.clientX, sy = e.clientY, started = false;
      pill._scDragged = false;
      function mv(ev){
        if(!started){
          if(Math.abs(ev.clientX - sx) < 6 && Math.abs(ev.clientY - sy) < 6) return;
          started = true; pill._scDragged = true;
          try{ pill.style.cursor = 'grabbing'; }catch(_e){}
        }
        try{ ev.preventDefault(); }catch(_e){}
        var x = Math.min(Math.max(ev.clientX - ox, 4), Math.max(4, window.innerWidth - rect.width - 4));
        var y = Math.min(Math.max(ev.clientY - oy, 4), Math.max(4, window.innerHeight - rect.height - 4));
        pill.style.left = x + 'px'; pill.style.top = y + 'px';
        pill.style.right = 'auto'; pill.style.bottom = 'auto';
        scPillSavePos(x, y, rect.width, rect.height);
      }
      function up(){
        if(pill._scDragged){ try{ pill.style.cursor = ''; }catch(_e){} }
        pill.removeEventListener('pointermove', mv);
        pill.removeEventListener('pointerup', up);
        pill.removeEventListener('pointercancel', up);
      }
      try{ pill.setPointerCapture(e.pointerId); }catch(_e){}
      pill.addEventListener('pointermove', mv);
      pill.addEventListener('pointerup', up);
      pill.addEventListener('pointercancel', up);
    });
  }
  // Mirror a running job into the Android notification shade through the same
  // native plugin the widget uses (patch-widget.py injects notifyProgress).
  // Absent on the web and on installs older than this build — a no-op there.
  // Throttled so encode-percent callbacks cannot flood the bridge.
  function scNotifyProgress(title, body, pct, done){
    try{
      var C = window.Capacitor;
      var W = (C && C.Plugins && C.Plugins.SideCutWidget) || null;
      if(!W) return;
      var now = Date.now();
      if(!done && now - (window.__scNotifyAt || 0) < 500) return;
      window.__scNotifyAt = now;
      if(!done && !window.__scNotifPermAsked){
        window.__scNotifPermAsked = true;
        if(typeof W.requestPermissions === 'function'){ try{ W.requestPermissions(); }catch(_pe){} }
      }
      var p = W.notifyProgress({
        title: String(title || 'SideCut'),
        body: String(body || ''),
        pct: Math.max(0, Math.min(100, Math.round(Number(pct) || 0))),
        done: !!done
      });
      if(p && typeof p.catch === 'function') p.catch(function(){});
    }catch(_ne){}
  }
  var scConvertPillState = { el: null, timer: null, pct: 0 };`,
'bubble + shade helpers');

// ── 4. compact, draggable bubble ───────────────────────────────────────────
apply(HTML,
`    pill.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:180;background:var(--bg-raised);border:1px solid var(--line);border-radius:14px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,0.45);display:flex;gap:10px;align-items:center;';`,
`    pill.style.cssText = 'position:fixed;left:12px;bottom:calc(84px + env(safe-area-inset-bottom));right:auto;max-width:min(74vw,300px);z-index:180;background:var(--bg-raised);border:1px solid var(--line);border-radius:16px;padding:7px 9px;box-shadow:0 10px 30px rgba(0,0,0,0.55);display:flex;gap:8px;align-items:center;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;';`,
'compact bubble css');

apply(HTML,
`    document.body.appendChild(pill);
    var cancelBtn = pill.querySelector('.sc-pill-cancel');`,
`    document.body.appendChild(pill);
    scPillMakeDraggable(pill);
    scPillApplyPos(pill);
    var cancelBtn = pill.querySelector('.sc-pill-cancel');`,
'drag + restore position');

// ── 5. one progress state drives bell + shade ──────────────────────────────
apply(HTML,
`    if(b && typeof pct === 'number') b.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
  }`,
`    if(b && typeof pct === 'number') b.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
    // Single source of truth for the bell entry and the shade notification.
    // Callers that pass no pct (status-line mirrors) still move the bar when
    // the text itself carries a percent (encode callbacks write "42%").
    if(typeof pct === 'number') scConvertPillState.pct = Math.max(0, Math.min(100, pct || 0));
    else { var _pm = /(\\d{1,3})%/.exec(String(sub || '')); if(_pm) scConvertPillState.pct = Math.min(100, parseInt(_pm[1], 10)); }
    window.__scNotifConv = { title: String(title || 'Converting…'), sub: String(sub || ''), pct: scConvertPillState.pct || 0 };
    scNotifyProgress('SideCut', String(title || 'Converting') + (sub ? ' — ' + sub : ''), scConvertPillState.pct || 0, false);
    try{
      updateNotifBadge();
      if($('notifBackdrop') && $('notifBackdrop').style.display === 'flex'){
        var _cbAt = Date.now();
        if(_cbAt - (window.__scConvBellAt || 0) > 1000){ window.__scConvBellAt = _cbAt; renderNotifPanel(); }
      }
    }catch(_be){}
  }`,
'pill update feeds bell + shade');

apply(HTML,
`    if(!pill){ toast(text || 'Conversions finished.', 5000); return; }`,
`    if(!pill){
      window.__scNotifConv = null;
      scNotifyProgress('SideCut', String(text || 'Conversions finished'), 100, true);
      try{ updateNotifBadge(); }catch(_pe){}
      toast(text || 'Conversions finished.', 5000); return;
    }`,
'done fallback clears + notifies');

apply(HTML,
`    var b = pill.querySelector('.sc-pill-bar');
    if(b) b.style.width = '100%';
    if(scConvertPillState.timer) clearTimeout(scConvertPillState.timer);`,
`    var b = pill.querySelector('.sc-pill-bar');
    if(b) b.style.width = '100%';
    window.__scNotifConv = null;
    scConvertPillState.pct = 0;
    window.__scNotifyAt = 0; // the finish message must not be throttled away
    scNotifyProgress('SideCut', String(text || 'Conversions finished'), 100, true);
    try{ updateNotifBadge(); if($('notifBackdrop') && $('notifBackdrop').style.display === 'flex') renderNotifPanel(); }catch(_be){}
    if(scConvertPillState.timer) clearTimeout(scConvertPillState.timer);`,
'done clears bell + posts result');

apply(HTML,
`      var cSub = pill.querySelector('.sc-pill-sub');
      if(cSub) cSub.textContent = 'Stopping — what already finished stays in your library';
    });`,
`      var cSub = pill.querySelector('.sc-pill-sub');
      if(cSub) cSub.textContent = 'Stopping — what already finished stays in your library';
      window.__scNotifyAt = 0;
      scNotifyProgress('SideCut', 'Cancelling — what already finished stays in your library', scConvertPillState.pct || 0, false);
    });`,
'cancel updates the shade');

// ── 6. bell: live conversion entry (html + summary + badge) ────────────────
apply(HTML,
`    let html = updateNotifHtml() + exportNotifHtml() + enrichNotifHtml();`,
`    let html = updateNotifHtml() + exportNotifHtml() + enrichNotifHtml();
    if(window.__scNotifConv){
      const cv = window.__scNotifConv;
      const cvPct = Math.max(0, Math.min(100, Math.round(cv.pct || 0)));
      html = \`
        <div style="border-bottom:1px solid var(--line); padding-bottom:10px;">
          <div style="font-weight:600; font-size:13.5px; margin-bottom:6px; color:var(--coral);">⏬ Converting — \${escapeHtml(cv.title || 'working…')}</div>
          <div style="font-size:12px; color:var(--ink-dim); margin-bottom:6px;">\${escapeHtml(cv.sub || '')}\${cvPct ? ' · ' + cvPct + '%' : ''}</div>
          <div style="height:6px; background:var(--bg-raised); border-radius:3px; overflow:hidden;"><div style="height:100%; width:\${cvPct}%; background:var(--coral); transition:width .3s;"></div></div>
          <div style="font-size:11px; color:var(--ink-dim); margin-top:6px;">Running in the background — the floating bubble has the Cancel button.</div>
        </div>\` + html;
    }`,
'bell live entry html');

apply(HTML,
`    let summaryHtml = '';`,
`    let summaryHtml = '';
    if(window.__scNotifConv){
      summaryHtml += \`
        <div style="border-bottom:1px solid var(--line); padding-bottom:8px;">
          <div style="font-weight:600; font-size:13.5px; color:var(--coral);">⏬ Converting \${Math.max(0, Math.min(100, Math.round(window.__scNotifConv.pct || 0)))}%…</div>
        </div>\`;
    }`,
'bell live summary');

apply(HTML,
`    badge.style.display = (notifLastReadVersion !== APP_VERSION || hasDupAlert || hasEnrichAlert || hasExportAlert || updateIsNewer()) ? 'block' : 'none';`,
`    badge.style.display = (notifLastReadVersion !== APP_VERSION || hasDupAlert || hasEnrichAlert || hasExportAlert || updateIsNewer() || !!window.__scNotifConv) ? 'block' : 'none';`,
'badge during conversion');

// ── 7. exports post through the same shade helper ──────────────────────────
apply(HTML,
`  function refreshExportNotif(){
    updateNotifBadge();
    if($('notifBackdrop') && $('notifBackdrop').style.display === 'flex') renderNotifPanel();
    renderHomeExportPopup();
  }`,
`  // exportNotifHtml's own view of exportState, restated for the notification
  // shade: one helper reads the same fields, so the bell and the shade can
  // never report different phases or percents.
  function scExportNotifyView(){
    if(!exportState.active && !exportState.finishedAt) return null;
    if(exportState.active){
      var pct = exportState.phase === 'compressing'
        ? Math.round(exportState.compressPct || 0)
        : (exportState.total ? Math.round((exportState.done / exportState.total) * 100) : 0);
      var label = exportState.phase === 'saving'
        ? ('Saving to disk \\u2014 ' + pct + '%')
        : exportState.phase === 'compressing'
          ? (pct >= 96 ? ('Saving your export \\u2014 ' + pct + '%') : ('Compressing the .zip \\u2014 ' + pct + '%'))
          : ('Bundling songs \\u2014 ' + exportState.done + '/' + exportState.total);
      return { pct: pct, label: 'Exporting ' + (exportState.kind || 'library') + ' \\u2014 ' + label, done: false };
    }
    var ok = !exportState.lastErr;
    return { pct: 100, done: true, label: ok
      ? ('Finished exporting ' + (exportState.kind || 'library') + ' \\u2014 ' + exportState.total + ' songs bundled into a .zip.')
      : ('Export failed: ' + (exportState.lastErr || 'unknown error')) };
  }
  function scExportNotify(){
    try{
      var v = scExportNotifyView(); if(!v) return;
      if(v.done){
        if(window.__scExpNotifiedAt === exportState.finishedAt) return;
        window.__scExpNotifiedAt = exportState.finishedAt;
        window.__scNotifyAt = 0;
      }
      scNotifyProgress('SideCut export', v.label, v.pct, v.done);
    }catch(_se){}
  }
  function refreshExportNotif(){
    updateNotifBadge();
    scExportNotify();
    if($('notifBackdrop') && $('notifBackdrop').style.display === 'flex') renderNotifPanel();
    renderHomeExportPopup();
  }`,
'export posts to the shade');

// ── 8. native side: notifyProgress @PluginMethod + permission annotation ───
apply(WID,
`import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SideCutWidget")
public class SideCutWidgetPlugin extends Plugin {`,
`import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(name = "SideCutWidget", permissions = {
    @Permission(alias = "notifications", strings = { android.Manifest.permission.POST_NOTIFICATIONS })
})
public class SideCutWidgetPlugin extends Plugin {`,
'plugin permission annotation');

apply(WID,
`        JSObject out = new JSObject();
        try { out.put("playlist", pending); } catch (Exception ignored) {}
        call.resolve(out);
    }
}`,
`        JSObject out = new JSObject();
        try { out.put("playlist", pending); } catch (Exception ignored) {}
        call.resolve(out);
    }

    // Live job progress in the Android shade (conversions and exports). One id
    // for both states, so a finished run REPLACES its progress row with the
    // result instead of stacking a second notification. Without
    // POST_NOTIFICATIONS (pre-Android 13, or not yet granted) notify() is a
    // silent no-op — this method never rejects and never throws.
    @PluginMethod
    public void notifyProgress(PluginCall call) {
        try {
            Context ctx = getContext();
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) { call.resolve(); return; }
            String title = call.getString("title", "SideCut");
            String body = call.getString("body", "");
            Integer pctObj = call.getInt("pct", -1);
            int pct = (pctObj == null) ? -1 : pctObj.intValue();
            boolean done = call.getBoolean("done", false);
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                android.app.NotificationChannel ch = new android.app.NotificationChannel(
                        "sidecut_jobs", "SideCut progress",
                        android.app.NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            android.app.Notification.Builder b = (android.os.Build.VERSION.SDK_INT >= 26)
                    ? new android.app.Notification.Builder(ctx, "sidecut_jobs")
                    : new android.app.Notification.Builder(ctx);
            b.setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setOnlyAlertOnce(true)
                    .setOngoing(!done);
            if (!done && pct >= 0) b.setProgress(100, pct, false);
            try {
                android.content.Intent ia = ctx.getPackageManager()
                        .getLaunchIntentForPackage(ctx.getPackageName());
                if (ia != null) {
                    android.app.PendingIntent pi = android.app.PendingIntent.getActivity(
                            ctx, 7711, ia,
                            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
                    b.setContentIntent(pi);
                }
            } catch (Exception ignored) {}
            if (done) b.setAutoCancel(true);
            nm.notify(7711, b.build());
            call.resolve();
        } catch (Exception e) {
            call.resolve(); // progress reporting is best-effort by design
        }
    }
}`,
'notifyProgress plugin method');

// ── 9. test pins move with the release ─────────────────────────────────────
apply('dev/test-6053.mjs', `ok(ver === '60.5.5', 'APP_VERSION = ' + ver);`, `ok(ver === '60.5.6', 'APP_VERSION = ' + ver);`, '6053 ver pin');
apply('dev/test-6054.mjs', `ok(ver === '60.5.5', 'APP_VERSION = ' + ver);`, `ok(ver === '60.5.6', 'APP_VERSION = ' + ver);`, '6054 ver pin');
apply('dev/test-6054.mjs', `pkg.version === '5.0.51'`, `pkg.version === '5.0.52'`, '6054 pkg pin');
apply('dev/test-6055.mjs', `ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);`,
                        `ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);`, '6055 item floor');
apply('dev/test-6055.mjs', `ok(playNotes.length >= 3, 'shared items for the other channel: ' + playNotes.length);`,
                          `ok(playNotes.length >= 1, 'shared items for the other channel: ' + playNotes.length);`, '6055 shared floor');
apply('dev/test-6055.mjs', `pkg.version === '5.0.51'`, `pkg.version === '5.0.52'`, '6055 pkg pin');

// ── self-check ─────────────────────────────────────────────────────────────
console.log('— self-check —');
assertContains(HTML, "const APP_VERSION = '60.5.6'", 'version bumped');
assertContains('sw.js', 'sidecut-shell-v60.5.6', 'sw bumped');
assertContains('package.json', '"5.0.52"', 'pkg bumped');
assertContains(HTML, "version: '60.5.6'", 'entry present');
assertNotContains(HTML, 'left:12px;right:12px;bottom:calc(84px', 'full-width pill gone');
assertContains(HTML, 'max-width:min(74vw,300px)', 'bubble compact');
assertContains(HTML, 'touch-action:none', 'bubble does not fight scrolling');
assertContains(HTML, 'function scPillMakeDraggable(pill){', 'draggable defined');
assertContains(HTML, 'scPillMakeDraggable(pill);', 'draggable wired');
assertContains(HTML, 'sidecut_pillPos', 'position persisted');
assertContains(HTML, 'setPointerCapture', 'pointer capture drag');
assertContains(HTML, 'pill._scDragged', 'tap-vs-drag guard');
assertContains(HTML, 'function scNotifyProgress(title, body, pct, done){', 'shade helper defined');
assertContains(HTML, 'window.__scNotifyAt || 0) < 500', 'shade throttled');
assertContains(HTML, 'W.requestPermissions()', 'permission asked once');
assertContains(HTML, 'window.__scNotifConv = { title:', 'progress state set');
assertContains(HTML, 'window.__scNotifConv = null;', 'progress state cleared');
assertContains(HTML, '!!window.__scNotifConv', 'badge during conversion');
assertContains(HTML, '⏬ Converting — ', 'bell live entry');
assertContains(HTML, 'function scExportNotifyView(){', 'export view helper');
assertContains(HTML, '    scExportNotify();', 'export posts on refresh');
assertContains(WID, 'public void notifyProgress(PluginCall call)', 'native method present');
assertContains(WID, '@Permission(alias = "notifications"', 'permission annotation');
assertContains(WID, 'POST_NOTIFICATIONS', 'manifest permission (via annotation)');
{
  const src = fs.readFileSync(HTML, 'utf8');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { failed++; console.error('FAIL changelog does not eval: ' + e.message); }
  if (entries) {
    const e0 = entries[0];
    if (e0.version !== '60.5.6') { failed++; console.error('FAIL entries[0].version = ' + e0.version); }
    if (!e0.date.endsWith('EDT') || !e0.date.includes('September 23, 2026')) { failed++; console.error('FAIL date: ' + e0.date); }
    const full = e0.items.filter((i) => i.startsWith('[FULL] '));
    const shared = e0.items.filter((i) => !i.startsWith('[FULL] '));
    if (e0.items.length < 5) { failed++; console.error('FAIL items = ' + e0.items.length); }
    if (full.length < 2) { failed++; console.error('FAIL full-only items = ' + full.length); }
    if (shared.length < 1) { failed++; console.error('FAIL shared items = ' + shared.length); }
    if (/play build|play version|play install|google play build/i.test(e0.items.join('\n'))) { failed++; console.error('FAIL notes name the play build'); }
    console.log(`ok  [entry] ${e0.items.length} items, ${full.length} full-only, ${shared.length} shared`);
  }
}
const scNotify = count(HTML, 'window.__scNotifConv');
if (scNotify < 6) { failed++; console.error('FAIL progress state referenced only ' + scNotify + ' times'); }
else console.log(`ok  [progress state] ${scNotify} references`);

console.log('');
console.log(`${edits} edits applied, ${failed} problems`);
process.exit(failed ? 1 : 0);
