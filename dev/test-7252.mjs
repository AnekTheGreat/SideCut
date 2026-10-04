#!/usr/bin/env node
/**
 * 72.5.2 - the widget can pause, and now it can play again.
 *
 * The owner pressed play, left the app while it was still playing, paused from
 * the home-screen widget - and then found that play, next and previous did
 * nothing. This gate pins both halves of the answer:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] a transport press clears the deliberate-stop mark, DRIVEN against a stub
 *       (this is the half that was refusing to resume and to skip);
 *   [3] the widget names its own play/pause verb instead of asking the phone to
 *       toggle, and the emitted Java really carries it;
 *   [4] the repin moved every gate (no stale pin);
 *   [5] inline script syntax.
 *
 *   node dev/test-7252.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const widgetPy = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-widget.py'), 'utf8');

const VER = '73.1.6'; /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */
const PREV = '73.1.5'; /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.6';
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so every check about 72.5.2 itself reads this entry rather than the
// head - the same split test-718 onward carry.
const OWN = '72.5.2';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;
const sliceOf = (hay, a, b) => { const i = hay.indexOf(a); const j = hay.indexOf(b, i); return (i === -1 || j === -1) ? '' : hay.slice(i, j); };
const slice = (a, b) => sliceOf(src, a, b);

// Lift a function declaration out of the page as a callable, with the page's
// globals it reads bound to a state object - so a check can assert what the code
// DOES instead of what its text says (the same helper test-7251 uses).
function bindFn(header, stateName, rebind){
  const at = src.indexOf(header);
  if (at === -1) return null;
  const end = src.indexOf('\n  }\n', at);
  if (end === -1) return null;
  const body = src.slice(at, end + 4);
  const name = header.slice(0, header.indexOf('(')).replace(/^\s*(?:async\s+)?function\s+/, '');
  let bound = body;
  for (const key of (rebind || [])) {
    bound = bound.split(new RegExp('\\b' + key + '\\b', 'g')).join(stateName + '.' + key);
  }
  try { return new Function(stateName, bound + '\nreturn ' + name + ';'); } catch (e) { return null; }
}

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next (' + ((entries[1] || {}).version) + ')');
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    const notes = items.join('\n');
    ok(/widget/i.test(notes), 'the notes say the home-screen widget is the thing this release is about');
    ok(/player/i.test(notes), 'and they name the surface this app really has');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(!/play build|play version|play install/i.test(notes), 'nor reads as a store-channel note');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(items.every((it) => it.length <= 260), 'every note is one short sentence or two (longest ' + Math.max(...items.map((i) => i.length)) + ')');
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.5.1 entry is still behind it');
  }
  ok(!!entries && String((entries.find((e) => String(e.version) === OWN) || {}).version) === OWN,
    'this release names its own entry (' + OWN + ')');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-7252.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.5.2';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
  ok(patch.indexOf('fs.writeFileSync(WIDGET, widget.text);') !== -1,
    'and it writes the widget Java injector, not just the page');
  // The four-part version is read as newer by the updater.
  const nu = fs.readFileSync(path.join(ROOT, 'dev', 'native-updates.js'), 'utf8');
  ok(/parseInt\(pa\[i\], 10\)/.test(nu), 'the updater compares version numbers segment by segment');
}

console.log('[2] a transport press is you asking for sound');
{
  // The one place that clears the deliberate-stop mark - DRIVEN.
  const resume = bindFn('  function scTransportResume(){', 'state', ['userPaused', 'audioFocusInterrupted']);
  ok(typeof resume === 'function', 'there is one place to clear the deliberate-stop mark');
  if (typeof resume === 'function') {
    const st = { userPaused: true, audioFocusInterrupted: true };
    resume(st)();
    ok(st.userPaused === false, 'it clears the deliberate-stop mark a pause left behind');
    ok(st.audioFocusInterrupted === false, 'and the interruption latch with it');
  }

  // The registered control set - DRIVEN. This is the check that fails on the
  // 72.5.1 tree, where play / next / previous ran with `userPaused` still set and
  // the recovery path (recoverAudio, the revive loop) refused to run.
  const reg = bindFn('  function registerMediaSessionHandlers(){', 'state',
    ['mediaSetActionHandler', 'audioCtx', 'activeAudio', 'recoverAudio', 'blockSpuriousStop',
     'recordPlaybackStop', 'userPaused', 'audioFocusInterrupted', 'hardAdvance', 'scTransportResume']);
  ok(typeof reg === 'function', 'the control set can be registered against a stub');
  if (typeof reg === 'function') {
    const handlers = {};
    const calls = { recovered: 0, advanced: [] };
    const mkEl = () => ({
      paused: true, currentTime: 0,
      play: () => ({ catch: (fn) => { fn(); } }),
      pause: () => { },
    });
    const st = {
      userPaused: true, audioFocusInterrupted: true, audioCtx: null,
      mediaSetActionHandler: (a, h) => { handlers[a] = h; },
      activeAudio: mkEl,
      recoverAudio: () => { calls.recovered++; },
      blockSpuriousStop: () => false,
      recordPlaybackStop: () => { },
      hardAdvance: (d) => { calls.advanced.push(d); },
      scTransportResume: () => { st.userPaused = false; st.audioFocusInterrupted = false; },
    };
    reg(st)();
    ok(!!handlers.play && !!handlers.nexttrack && !!handlers.previoustrack,
      'play, next and previous are all registered');

    st.userPaused = true; st.audioFocusInterrupted = true;
    handlers.play();
    ok(st.userPaused === false, 'a play press clears the mark that was silencing the resume');
    ok(calls.recovered === 1, 'and a rejected play is handed to the recovery path, not dropped on the floor');

    st.userPaused = true;
    handlers.nexttrack();
    ok(st.userPaused === false, 'a next press clears it too');
    ok(calls.advanced.indexOf(1) !== -1, 'and really advances the queue');

    st.userPaused = true;
    handlers.previoustrack();
    ok(st.userPaused === false, 'a previous press clears it as well');
    ok(calls.advanced.indexOf(-1) !== -1, 'and really steps back a song');

    // The reset only means something because stopping still SETS it.
    st.userPaused = false;
    handlers.pause();
    ok(st.userPaused === true, 'while a pause still marks the stop as deliberate');
  }

  // The pinned rule the release did NOT move.
  const pre = slice("    mediaSetActionHandler('previoustrack',", "    mediaSetActionHandler('nexttrack',");
  ok(pre.indexOf('if(_a && _a.currentTime > 3){ try{ _a.currentTime = 0; }catch(e){} return; }') !== -1,
    'and previous still restarts the current song past three seconds');
  ok(count(src, 'function scTransportResume(){') === 1, 'there is one such helper, not a copy per button');
}

console.log('[3] the widget names its own verb');
{
  const java = sliceOf(widgetPy, '        int code = 0;\n        if (action.endsWith("_prev"))', '    }\n}\n""" % APP_ID');
  ok(java.length > 0, 'the transport block is still in the provider');
  ok(java.indexOf('st.optBoolean("playing"') !== -1, 'the play/pause press reads the state the widget is showing');
  ok(/KEYCODE_MEDIA_PLAY\b/.test(java), 'and names PLAY outright');
  ok(/KEYCODE_MEDIA_PAUSE\b/.test(java), 'and PAUSE outright');
  ok(java.indexOf('KEYCODE_MEDIA_PLAY_PAUSE') !== -1,
    'keeping the toggle only as the fallback when there is no state to go on');
  ok(java.indexOf('Intent.ACTION_MEDIA_BUTTON') !== -1, 'and the direct hand-off is untouched');
  ok(count(widgetPy, 'io.github.jofr.capacitor.mediasessionplugin.MediaSessionService') === 1,
    'the service name is still written once into the emitted provider');

  // Emit the provider Java the way CI does and look at the real text.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-widget-'));
  const scrScript = path.join(scratch, '.github', 'workflows', 'patch-widget.py');
  fs.mkdirSync(path.dirname(scrScript), { recursive: true });
  fs.writeFileSync(scrScript, widgetPy);
  fs.mkdirSync(path.join(scratch, 'android', 'app', 'src', 'main', 'java'), { recursive: true });
  fs.mkdirSync(path.join(scratch, 'android', 'app', 'src', 'main', 'res'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'capacitor.config.json'), '{"appId":"com.SideCut.myapp"}');
  const mainDir = path.join(scratch, 'android', 'app', 'src', 'main', 'java', 'com', 'SideCut', 'myapp');
  fs.mkdirSync(mainDir, { recursive: true });
  fs.writeFileSync(path.join(mainDir, 'MainActivity.java'), 'package com.SideCut.myapp;\npublic class MainActivity extends BridgeActivity {\n}\n');
  fs.writeFileSync(path.join(scratch, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application></application></manifest>');
  let emitted = '';
  try {
    execFileSync('python3', [scrScript], { cwd: scratch, stdio: 'pipe' });
    emitted = fs.readFileSync(path.join(mainDir, 'SideCutWidgetProvider.java'), 'utf8');
  } catch (e) {
    emitted = '';
    if (process.env.SC_DEBUG) console.log(String(e.stderr || e.message));
  }
  if (emitted) {
    ok(emitted.indexOf('st.optBoolean("playing"') !== -1, 'the generated Java really carries the named verb');
    ok(/KeyEvent\.KEYCODE_MEDIA_PLAY\b/.test(emitted) && /KeyEvent\.KEYCODE_MEDIA_PAUSE\b/.test(emitted),
      'with explicit PLAY and PAUSE key codes');
    const braces = (emitted.match(/\{/g) || []).length - (emitted.match(/\}/g) || []).length;
    ok(braces === 0, 'and the generated Java is brace-balanced (' + braces + ')');
  } else {
    ok(false, 'the CI script emitted a provider to inspect');
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) {}
}

console.log('[4] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-7252.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.5.1';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.5.2';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-7251.mjs', ['72.5', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for its own gate too');
  ok(repin.indexOf("bespoke('test-7251.mjs'") !== -1, 'with the sweep correction written for the gate it displaces');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "';";
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v73[.]1[.]5(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
  ok(cacheStale.length === 0, 'and no gate still names the old shell cache (' + cacheStale.join(',') + ')');
}

console.log('[5] inline script syntax');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
