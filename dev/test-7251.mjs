#!/usr/bin/env node
/**
 * 72.5.1 - the widget transport buttons reach the player again.
 *
 * The owner pressed play, left the app while it was still playing, and then found
 * the home-screen widget's pause, play, next and previous buttons dead. This gate
 * pins the two halves of the answer where they live, and proves the widget's Java
 * is actually emitted by the CI script rather than merely described in a comment:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the notification player is armed reliably, not once;
 *   [3] the controls are re-asserted on the way OUT, and by the while-playing beat;
 *   [4] the widget hands each press to SideCut's OWN media session, with the
 *       system-wide key kept only as a fallback and the app opened when neither
 *       can answer;
 *   [5] what did not move;
 *   [6] the repin moved every gate (no stale pin);
 *   [7] the album switch - the helpers DRIVEN, not just read;
 *   [8] the CI script really produces that Java;
 *   [9] inline script syntax.
 *
 *   node dev/test-7251.mjs
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

const VER = '73'; /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */
const PREV = '72.8.1'; /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */
const SHELL_CACHE = 'sidecut-shell-v73';
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so every check about 72.5.1 itself reads this entry rather than the
// head - the same split test-718 onward carry.
const OWN = '72.5.1';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;
const sliceOf = (hay, a, b) => { const i = hay.indexOf(a); const j = hay.indexOf(b, i); return (i === -1 || j === -1) ? '' : hay.slice(i, j); };
const slice = (a, b) => sliceOf(src, a, b);

// Lift a function declaration out of the page as a callable, with the page's
// globals it reads bound to a state object - so a check can assert what the code
// DOES instead of what its text says (the same helper test-725 uses).
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
// The needle is built, not written: this gate is itself a test file the repin
// sweeps, and a contiguous old-build pin in it would look like a stale one.
const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "';";

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
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.5 entry is still behind it');
  }
  ok(!!entries && String((entries.find((e) => String(e.version) === OWN) || {}).version) === OWN,
    'this release names its own entry (' + OWN + ')');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-7251.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.5.1';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
  // The four-part version is the new thing; the updater must read it as newer.
  const nu = fs.readFileSync(path.join(ROOT, 'dev', 'native-updates.js'), 'utf8');
  ok(/parseInt\(pa\[i\], 10\)/.test(nu), 'the updater compares version numbers segment by segment');
}

console.log('[2] the notification player is armed reliably, not once');
{
  const arms = count(src, 'function _scArmNativeMedia(){');
  ok(arms === 1, 'the arming body is a single named function (' + arms + ')');
  ok(count(src, 'let _scMediaArmDone = false;') === 1, 'with one done-flag');
  ok(count(src, '_scMediaArmDone = true;') === 1, 'set the moment the adapter is live');
  const after = slice('        capMediaSessionActive = capMediaSessionNative;', '        registerMediaSessionHandlers();');
  ok(after.indexOf('_scMediaArmDone = true;') !== -1, 'which happens right after the adapter is assigned');
  ok(count(src, 'try{ _scArmNativeMedia(); }catch(e){} }, 3000);') === 1,
    'the first attempt is still three seconds after boot, where it cannot touch startup');
  const retry = slice('      const _scArmTimer = setInterval(function(){', '    })();');
  ok(retry.indexOf('_scMediaArmDone') !== -1, 'and a retry loop stops the moment it is armed');
  ok(retry.indexOf('_scArmTries > 30') !== -1, 'but does give up after a bounded number of tries');
  ok(count(src, '}, 2000);') >= 1, 'retrying every couple of seconds');
  ok(count(src, 'setTimeout(() => {\n      try{\n        try{ if(window.__scMediaNotifOff') === 0,
    'and the old one-shot arming is gone');
}

console.log('[3] the controls come back when the app leaves, and while it plays');
{
  // The page has an earlier visibilitychange listener (the DJ-mode pause), so the
  // media one is anchored by the 72.5.1 comment it carries.
  const vis = slice("  document.addEventListener('visibilitychange', function(){\n    if(document.hidden){\n      // 72.5.1", '  let wakeLockHandle = null;');
  const hidden = vis.slice(vis.indexOf('if(document.hidden){'), vis.indexOf('} else {'));
  ok(hidden.indexOf('mediaHandlersNeedArm();') !== -1, 'leaving the app marks the controls for re-assertion');
  ok(hidden.indexOf('refreshMediaControls();') !== -1, 'and re-asserts them there and then');
  const back = vis.slice(vis.indexOf('} else {'));
  ok(back.indexOf('refreshMediaControls();') !== -1, 'coming back still re-asserts them, exactly as before');
  const beat = slice('  function startMediaSessionHeartbeat(){', '  function stopMediaSessionHeartbeat(){');
  ok(beat.indexOf('if(mediaHandlersDirty){ try{ refreshMediaControls(); }catch(e){} }') !== -1,
    'and the while-playing heartbeat puts them back if the session was rebuilt with none');
  ok(count(src, 'function refreshMediaControls(){') === 1, 'there is still one re-assert path, not a second copy');
}

console.log('[4] the widget hands each press to SideCut\'s own media session');
{
  const java = sliceOf(widgetPy, '        int code = 0;\n        if (action.endsWith("_prev"))', '    }\n}\n""" % APP_ID');
  ok(java.length > 0, 'the transport block is in the provider');
  ok(java.indexOf('Intent.ACTION_MEDIA_BUTTON') !== -1, 'the press is built as a MEDIA_BUTTON intent');
  ok(java.indexOf('"io.github.jofr.capacitor.mediasessionplugin.MediaSessionService"') !== -1,
    'addressed to the service that owns the media session');
  ok(java.indexOf('Intent.EXTRA_KEY_EVENT') !== -1, 'carrying the key event the session knows how to read');
  ok(java.indexOf('context.startService(mb);') !== -1, 'and delivered with startService');
  const explicitAt = java.indexOf('context.startService(mb);');
  const globalAt = java.indexOf('am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));');
  ok(explicitAt !== -1 && globalAt !== -1 && explicitAt < globalAt,
    'the direct hand-off is tried first and the system-wide key only after it');
  ok(/if \(!sent \|\| !music\) \{/.test(java), 'the system-wide key is also sent whenever nothing is audibly playing yet, so a paused app resumes instead of opening');
  ok(/if \(!sent && !music\) \{/.test(java), 'and with nothing playing and no session to move, the app is opened');
  ok(java.indexOf('isMusicActive()') !== -1, 'which is decided by whether music is really playing');
  ok(java.indexOf('FLAG_ACTIVITY_NEW_TASK') !== -1, 'opening it from a broadcast needs the new-task flag');
  ok(count(java, 'dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code))') === 1,
    'and the old press is not sent twice');
}

console.log('[5] what did not move');
{
  const reg = slice('  function registerMediaSessionHandlers(){', '  let mediaHandlersArmedAt');
  for (const a of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'stop', 'seekto']) {
    ok(reg.indexOf("mediaSetActionHandler('" + a + "'") !== -1, 'the lock-screen still has ' + a);
  }
  ok(reg.indexOf('if(_a && _a.currentTime > 3){ try{ _a.currentTime = 0; }catch(e){} return; }') !== -1,
    'and previous still restarts the current song past three seconds');
  ok(count(src, 'function mediaSetActionHandler(action, handler){') === 1, 'the dual-session registration is untouched');
  ok(count(src, 'if(now - lastMediaRefreshAt < 4000) return;') === 1, 'the skip-storm throttle is untouched');
  ok(count(src, 'const MEDIA_BG_GRACE_MS = 10 * 60 * 1000;') === 1, 'the ten-minute background release is untouched');
  ok(count(src, "mediaSetPlaybackState('none');") === 1, 'and nothing new can take the session down');
}

console.log('[6] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-7251.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.5';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.5.1';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-725.mjs', ['72.4', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for its own gate too');
  ok(repin.indexOf("bespoke('test-725.mjs'") !== -1, 'with the OWN split written for the gate it displaces');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v72\.9(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
  ok(cacheStale.length === 0, 'and no gate still names the old shell cache (' + cacheStale.join(',') + ')');
}

console.log('[7] the album switch: leaving the tab keeps only the playing album open');
{
  // OFF by default is the whole point: the list has always let you keep several
  // albums open, and nothing at boot may change that.
  const focus = bindFn('  function scAlbumFocusOn(){', 'state', ['localStorage']);
  ok(typeof focus === 'function', 'the switch is read from one stored flag');
  if (typeof focus === 'function') {
    ok(focus({ localStorage: { getItem: () => null } })() === false, 'unset means OFF - the default');
    ok(focus({ localStorage: { getItem: () => '0' } })() === false, 'a stored 0 is off');
    ok(focus({ localStorage: { getItem: () => '1' } })() === true, 'only a stored 1 turns it on');
  }

  // Which album the playing song is in - DRIVEN.
  const albumOf = bindFn('  function scAlbumForPlayingTrack(){', 'state',
    ['$', 'djModeBackdrop', 'djCurrentTrackId', 'queue', 'queueIndex', 'allTracks', 'userAlbums', 'albumIsAuto']);
  ok(typeof albumOf === 'function', 'the playing song can be traced to its album');
  if (typeof albumOf === 'function') {
    const base = () => ({
      $: () => null, djModeBackdrop: null, djCurrentTrackId: undefined,
      queue: ['t1'], queueIndex: 0,
      allTracks: [{ id: 't1', name: 'Luna', album: 'Moonshine' }],
      albumIsAuto: () => false,
      userAlbums: {},
    });
    let st = base(); st.userAlbums = { MoonChild: { trackIds: ['t9', 't1'] } };
    ok(albumOf(st)() === 'MoonChild', 'a song sitting in an album you made resolves to it');
    st = base(); st.albumIsAuto = (n) => n === 'Autoish'; st.userAlbums = { Autoish: { trackIds: ['t1'] } };
    ok(albumOf(st)() !== 'Autoish', 'an album the app made on its own is not somewhere it can live');
    st = base(); st.userAlbums = { Moonshine: { trackIds: ['t7'] } };
    ok(albumOf(st)() === 'Moonshine', 'otherwise the album tag on the file is used, when that album exists');
    st = base();
    ok(albumOf(st)() === null, 'and a song in no album resolves to null - nothing is invented');
    st = base(); st.queue = []; st.queueIndex = -1; st.userAlbums = { MoonChild: { trackIds: ['t1'] } };
    ok(albumOf(st)() === null, 'with nothing playing there is no album to keep open');
  }

  // The leaving behaviour - DRIVEN against a fake card list.
  const remember = bindFn('  function scAlbumsRememberOnLeave(){', 'state',
    ['scAlbumFocusOn', 'libraryMode', 'document', 'localStorage', 'scAlbumForPlayingTrack']);
  ok(typeof remember === 'function', 'leaving the tab is a real step');
  if (typeof remember === 'function') {
    const mkPane = (names) => {
      const cards = names.map((n) => {
        const body = { style: {} };
        const chev = { style: {} };
        return { dataset: { albumName: n }, querySelector: () => body, firstElementChild: { querySelector: () => chev }, _body: body, _chev: chev };
      });
      return { _cards: cards, querySelectorAll: () => cards };
    };
    const mkState = (names, keep, opts) => {
      opts = opts || {};
      const pane = mkPane(names);
      const store = {};
      return {
        _pane: pane, _store: store,
        scAlbumFocusOn: () => (opts.on === undefined ? true : opts.on),
        libraryMode: opts.mode === undefined ? 'albums' : opts.mode,
        document: { getElementById: () => pane },
        localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        scAlbumForPlayingTrack: () => keep,
      };
    };

    let st = mkState(['A', 'B', 'C'], 'A');
    let closed = remember(st)();
    ok(closed === 2, 'every album other than the playing one is closed (' + closed + ')');
    ok(st._store['sidecut_albColl_A'] === '0', 'the playing song\'s album is remembered OPEN');
    ok(st._store['sidecut_albColl_B'] === '1' && st._store['sidecut_albColl_C'] === '1',
      'and the rest are remembered closed, so the next render agrees');
    ok(st._pane._cards[0]._body.style.display === 'block' && st._pane._cards[1]._body.style.display === 'none',
      'and the cards are painted to match');
    ok(st._pane._cards[0]._chev.style.transform === 'rotate(90deg)' && st._pane._cards[1]._chev.style.transform === '',
      'with the chevrons turned the same way');

    st = mkState(['A', 'B'], null, { on: false });
    ok(remember(st)() === 0, 'with the switch off nothing is touched');
    ok(Object.keys(st._store).length === 0, 'and nothing is written');

    st = mkState(['A', 'B'], 'A', { mode: 'playlists' });
    ok(remember(st)() === 0, 'and it does nothing unless the Albums half is the one showing');

    st = mkState(['A', 'B'], null);
    ok(remember(st)() === 2, 'a song in no album leaves every album shut');
    ok(st._store['sidecut_albColl_A'] === '1' && st._store['sidecut_albColl_B'] === '1', 'still remembered, not just painted');

    st = mkState([], 'A');
    ok(remember(st)() === 0, 'an empty list is not an error (it returns 0)');
    st = mkState(['A', 'B'], 'A', { on: true });
    st.document.getElementById = () => null;
    ok(remember(st)() === 0, 'a pane that is not there is not an error either');
  }

  // The hook points. Leaving means leaving - a redraw of the half is not a leave.
  const nav = sliceOf(src, '  function navigate(view){', '    const isHome = view === \'home\';');
  ok(nav.indexOf('scAlbumsRememberOnLeave();') !== -1, 'navigating away runs the switch');
  ok(nav.indexOf('view !== "albums" && view !== "library"') !== -1,
    'but re-entering the library half is excluded, so the switch cannot fire on a redraw');
  ok(count(src, "if(libraryMode === 'albums') scAlbumsRememberOnLeave();") === 1,
    'flipping the single library button away from Albums is a leave too');
  ok(count(src, 'scAlbumsRememberOnLeave()') === 3, 'the definition and the two callers are all of it');
  ok(count(src, "document.getElementById('albumFocusPlayingToggle')") === 1, 'the Settings > More switch exists once');
  ok(count(src, "id=\"mgrAlbumFocusPlayingToggle\"") === 1, 'and so does the one in Manage albums');
  ok(count(src, "bEl.querySelector('#mgrAlbumFocusPlayingToggle')") === 1, 'which is wired where its sibling buttons are');
  ok(count(src, 'scSyncAlbumFocusToggles();') === 3, 'and both switches are re-labelled from one place, not two');
  ok(src.indexOf('      scSyncAlbumFocusToggles();\n      renderRefreshRateOptions();') !== -1,
    'the More tab label is synced when the tab opens');
  ok(src.indexOf('    applyLibraryButtonMode();\n    scSyncAlbumFocusToggles();') !== -1,
    'and on boot, so the label is never blank');
}

console.log('[8] the CI script really produces that Java');
{
  ok(count(widgetPy, 'io.github.jofr.capacitor.mediasessionplugin.MediaSessionService') === 1,
    'the service name is written once into the emitted provider');
  try {
    execFileSync('python3', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1]).read())', path.join(ROOT, '.github', 'workflows', 'patch-widget.py')],
      { stdio: 'pipe' });
    ok(true, 'the CI script is valid Python');
  } catch (e) {
    ok(false, 'the CI script is valid Python: ' + (e.stderr || e.message));
  }
  // Emit the provider Java the way CI does and look at the real text.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-widget-'));
  // The script resolves its project root from its own FILE location, so it has to
  // be copied into the scratch tree - running the real one would write into the
  // real repository.
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
    ok(emitted.indexOf('io.github.jofr.capacitor.mediasessionplugin.MediaSessionService') !== -1,
      'and the generated SideCutWidgetProvider.java carries the direct hand-off');
    ok(emitted.indexOf('context.startService(mb);') !== -1, 'with a real startService call inside it');
    const braces = (emitted.match(/\{/g) || []).length - (emitted.match(/\}/g) || []).length;
    ok(braces === 0, 'and the generated Java is brace-balanced (' + braces + ')');
  } else {
    ok(false, 'the CI script emitted a provider to inspect');
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) {}
}

console.log('[9] inline script syntax');
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
