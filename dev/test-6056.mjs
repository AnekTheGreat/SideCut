// v60.5.6 verification — the three reported problems, checked as BEHAVIOUR
// where cheap (position round-trip, shade throttle, export view actually run)
// and as structure everywhere else:
//   1. the converting pill is a small floating bubble you can drag anywhere,
//      whose position survives restarts
//   2. progress shows in Android notifications (shade helper + native plugin)
//      and in the bell as a live entry
//   3. channel discipline holds for this entry too ([FULL] items, shared >= 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const wid = fs.readFileSync(path.join(ROOT, '.github/workflows/patch-widget.py'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (hay, needle) => { let n = 0, i = hay.indexOf(needle); while (i !== -1) { n++; i = hay.indexOf(needle, i + needle.length); } return n; };

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '63.0.2', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].date.endsWith('EDT'), 'date ends in EDT (' + entries[0].date + ')');
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
  const full = entries.flatMap((e) => e.items).filter((i) => i.startsWith('[FULL] '));
  const shared = entries[0].items.filter((i) => !i.startsWith('[FULL] '));
  ok(full.length >= 2, 'download-only items still marked across entries: ' + full.length);
  ok(shared.length >= 1, 'shared items for the other channel: ' + shared.length);
  ok(!/play build|play version|play install/i.test(entries[0].items.join('\n')), 'notes never name the play build');
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version + ' (a new Play build number)');

console.log('[2] small floating bubble');
ok(!src.includes('left:12px;right:12px;bottom:calc(84px'), 'the full-width bar is gone');
ok(src.includes('max-width:min(74vw,300px)'), 'bubble is compact');
ok(src.includes('touch-action:none') && src.includes('cursor:grab'), 'drag does not fight taps or scrolling');
ok(src.includes('function scPillMakeDraggable(pill){') && src.includes('scPillMakeDraggable(pill);'), 'draggable defined and wired');
ok(src.includes('class="sc-pill-cancel"'), 'Cancel button survives the redesign');
ok(src.includes("cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelling…'"), 'cancel arms the flag');
ok(src.includes('pill._scDragged'), 'tap-vs-drag guard present');

console.log('[3] position round-trip (behaviour)');
{
  const start = src.indexOf('function scPillSavePos(');
  const end = src.indexOf('  function scPillMakeDraggable(pill){', start);
  ok(start !== -1 && end !== -1, 'helpers extractable');
  if (start !== -1 && end !== -1) {
    try {
      const code = src.slice(start, end);
      const run = new Function('store', 'window', 'localStorage', `
        ${code}
        scPillSavePos(100, 200, 240, 56);
        const saved = JSON.parse(store.vals['sidecut_pillPos']);
        const pill = { offsetWidth: 240, offsetHeight: 56, style: {} };
        scPillApplyPos(pill);
        return { saved, left: pill.style.left, top: pill.style.top };
      `);
      const store = { vals: {} };
      const localStorage = {
        setItem: (k, v) => { store.vals[k] = String(v); },
        getItem: (k) => (k in store.vals ? store.vals[k] : null)
      };
      const r = run(store, { innerWidth: 1000, innerHeight: 800 }, localStorage);
      ok(Math.abs(r.saved.fx - 100 / 760) < 1e-9 && Math.abs(r.saved.fy - 200 / 744) < 1e-9, 'saved as viewport fractions (' + JSON.stringify(r.saved) + ')');
      ok(r.left === '100px' && r.top === '200px', 'restores the exact spot (' + r.left + ', ' + r.top + ')');
      // clamping: a fraction computed for a huge screen cannot land off-frame
      store.vals['sidecut_pillPos'] = JSON.stringify({ fx: 1.4, fy: -0.2 });
      const pill2 = { offsetWidth: 240, offsetHeight: 56, style: {} };
      const run2 = new Function('store', 'window', 'localStorage', `
        ${code}
        const pill = { offsetWidth: 240, offsetHeight: 56, style: {} };
        scPillApplyPos(pill);
        return pill.style;
      `);
      const s2 = run2(store, { innerWidth: 1000, innerHeight: 800 }, localStorage);
      const x = parseFloat(s2.left), y = parseFloat(s2.top);
      ok(x >= 4 && x <= 1000 - 240 - 4 && y >= 4 && y <= 800 - 56 - 4, 'off-frame fractions are clamped (' + s2.left + ', ' + s2.top + ')');
    } catch (e) { ok(false, 'helpers executed: ' + e.message); }
  }
}

console.log('[4] shade notification bridge (behaviour)');
ok(src.includes('function scNotifyProgress(title, body, pct, done){'), 'helper defined');
ok(src.includes('window.__scNotifyAt || 0) < 500'), 'throttled to 500ms');
ok(src.includes('window.__scNotifPermAsked') && src.includes('W.requestPermissions()'), 'permission asked once');
{
  const start = src.indexOf('function scNotifyProgress(title, body, pct, done){');
  const end = src.indexOf('\n  var scConvertPillState', start);
  ok(start !== -1 && end !== -1, 'helper extractable');
  if (start !== -1 && end !== -1) {
    try {
      const code = src.slice(start, end);
      const calls = [], state = { perms: 0 };
      const run = new Function('calls', 'state', 'window', `
        ${code}
        scNotifyProgress('SideCut', 'step one', 10, false);
        scNotifyProgress('SideCut', 'flooded', 20, false);   // throttled away
        state.permsSeen = state.perms;
        scNotifyProgress('SideCut', 'finished', 100, true);  // done bypasses throttle
        return calls.length;
      `);
      const windowObj = {
        Capacitor: {
          Plugins: {
            SideCutWidget: {
              notifyProgress: (o) => { calls.push(o); return Promise.resolve(); },
              requestPermissions: () => { state.perms++; return Promise.resolve(); }
            }
          }
        }
      };
      run(calls, state, windowObj);
      ok(calls.length === 2, 'first post, flood throttled, done posts (' + calls.length + ' bridge calls)');
      ok(calls[0] && calls[0].pct === 10 && calls[0].done === false, 'progress payload correct');
      ok(calls[1] && calls[1].done === true && calls[1].pct === 100, 'finish payload correct');
      ok(state.perms === 1, 'permission requested exactly once (' + state.perms + ')');
      // a build without the plugin must be a silent no-op
      const runNo = new Function('window', `
        ${code}
        scNotifyProgress('SideCut', 'x', 50, false);
        return true;
      `);
      ok(runNo({}) === true, 'web/old install is a silent no-op');
    } catch (e) { ok(false, 'helper executed: ' + e.message); }
  }
}

console.log('[5] bell live entry + export mirror (behaviour)');
ok(count(src, 'window.__scNotifConv') >= 6, 'progress state referenced everywhere (' + count(src, 'window.__scNotifConv') + ')');
ok(src.includes('window.__scNotifConv = { title:'), 'state set from the pill');
ok(src.includes('window.__scNotifConv = null;'), 'state cleared when done');
ok(src.includes('!!window.__scNotifConv'), 'bell badges during a run');
ok(src.includes('⏬ Converting — '), 'bell entry rendered');
ok(src.includes('    scExportNotify();'), 'exports post from refreshExportNotif');
{
  const start = src.indexOf('function scExportNotifyView(){');
  const end = src.indexOf('  function scExportNotify(){', start);
  ok(start !== -1 && end !== -1, 'export view extractable');
  if (start !== -1 && end !== -1) {
    try {
      const code = src.slice(start, end);
      const st1 = { active: true, phase: 'compressing', compressPct: 42, total: 10, done: 4, kind: 'library', finishedAt: 0, lastErr: '' };
      const r1 = new Function('exportState', `${code}\nreturn scExportNotifyView();`)(st1);
      ok(r1 && r1.done === false && r1.pct === 42 && r1.label.indexOf('42%') !== -1, 'active view: ' + (r1 && r1.label));
      const st2 = { active: false, phase: 'done', kind: 'library', total: 12, finishedAt: 123, lastErr: '' };
      const r2 = new Function('exportState', `${code}\nreturn scExportNotifyView();`)(st2);
      ok(r2 && r2.done === true && r2.label.indexOf('Finished exporting library') === 0, 'finished view: ' + (r2 && r2.label));
      const st3 = { active: false, phase: 'error', kind: 'library', total: 0, finishedAt: 456, lastErr: 'library-too-big' };
      const r3 = new Function('exportState', `${code}\nreturn scExportNotifyView();`)(st3);
      ok(r3 && r3.done === true && r3.label.indexOf('library-too-big') !== -1, 'error view: ' + (r3 && r3.label));
    } catch (e) { ok(false, 'export view executed: ' + e.message); }
  }
}

console.log('[6] native plugin');
ok(wid.includes('public void notifyProgress(PluginCall call)'), 'notifyProgress @PluginMethod present');
ok(wid.includes('@CapacitorPlugin(name = "SideCutWidget", permissions = {'), 'plugin declares permissions');
ok(wid.includes('@Permission(alias = "notifications"') && wid.includes('POST_NOTIFICATIONS'), 'POST_NOTIFICATIONS requested');
ok(wid.includes('"sidecut_jobs"'), 'notification channel created');
ok(wid.includes('nm.notify(7711, b.build());'), 'one id for progress and result');
ok(wid.includes('setOngoing(!done)') && wid.includes('setAutoCancel(true)'), 'progress ongoing, result dismissible');
ok(!/call\.reject/.test(wid.slice(wid.indexOf('notifyProgress'))), 'never rejects — best effort by design');
// no stray python-format percent in the %-formatted plugin string
{
  const pluginStr = wid.slice(wid.indexOf('PLUGIN_JAVA ='), wid.indexOf('PROVIDER_JAVA ='))
    .replace(/%%/g, '').replace(/%\s*APP_ID/g, ''); // keep the intended %s and the format operator
  const barePct = pluginStr.match(/%(?!s)/g);
  ok(!barePct, 'PLUGIN_JAVA has no unescaped python format percent');
}

console.log('[7] inline script syntax');
let syntaxBad = 0, blocks = 0;
{
  let i = 0;
  while (true) {
    const open = src.indexOf('<script', i);
    if (open === -1) break;
    const gt = src.indexOf('>', open);
    if (/src\s*=/.test(src.slice(open, gt))) { i = gt + 1; continue; }
    const end = src.indexOf('</script>', gt);
    blocks++;
    try { new Function(src.slice(gt + 1, end)); } catch (e) { syntaxBad++; console.log('  syntax bad block ' + blocks + ': ' + e.message); }
    i = end + 1;
  }
}
ok(syntaxBad === 0, blocks + ' inline blocks compile');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
