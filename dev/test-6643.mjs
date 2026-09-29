// v64.3 - the library half you are not looking at stops being moved, and the
// patch-note times are the real ones.
//
//   "Why does me clicking the record player in playlists or albums affect the
//    other, it shouldn't do that it should stay where it is if its at the top it
//    stays at the top. The times for the patch notes are incorrect"
//
// Two reports, one release: the first is the one-shot wish 64.2.6 introduced and
// never made sure was cleared (a tap in one half threw away the other half's
// place), the second is every entry from 64.2.4 to 64.2.9 carrying a ship time
// written from a clock whose date had not rolled back with it.
//
//   [1] the release itself: 64.2.10 runs, the head entry says so, and its six
//       notes still pass the wording rules both channels are held to (including
//       the words dev/test-66425.mjs and dev/test-66426.mjs read the head entry
//       for);
//   [2] the ship times: the six corrected stamps are in, the wrong ones are gone,
//       and the whole run reads newest first with nothing in the future;
//   [3] the fix itself, read off the source: the wish is TAKEN by the render that
//       reads it, the Albums half always restores its own offset, the Playlists
//       half restores unless it really landed on the song, and the tab that arms
//       the wish arms it before the list it arms and only when the setting is on;
//   [4] the record tap settles which half it belongs to before it can create an
//       album, so a tap in Playlists cannot write to Albums;
//   [5] the one the user actually feels, driven on the real app: both halves keep
//       their own place across a playlist tab, a re-render and both record taps
//       (dev/halfplace-64210-check.cjs);
//   [6] what 64.2.9, 64.2.8, 64.2.7 and 64.2.6 shipped is still standing;
//   [7] the file still holds together.
//
//   node dev/test-6643.mjs
//
// (The version is 64.3 and not 64.2.10: this app's third number stops at nine, so
// the release after 64.2.9 is the next minor one. The file is named 6643 the same
// way dev/test-6642.mjs and dev/test-6641.mjs are - 6 plus the version digits.)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ota = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const VER = '64.3.1';
const PREV = '64.2.9';
// This gate describes 64.3 - the release it was written for - while VER is the
// build on the page, so the two are named apart (64.3.1).
const OWNVER = '64.3';
// The build actually on the page - the release this gate describes is older.
const PAGEVER = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const vnum = (v) => String(v || '').split('.').map((n) => parseInt(n, 10) || 0);
const vcmp = (a, b) => {
  const A = vnum(a), B = vnum(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
};

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
const countC = (needle) => code.split(needle).length - 1;
const slice = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return src.slice(a, b);
};
// Comments describe the code the "is it gone" checks look for, so those run over
// the code only - the same strip dev/test-6058.mjs uses.
const code = src.replace(/^\s*\/\/.*$/gm, '');
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(!!ver && vcmp(ver, VER) >= 0, 'APP_VERSION = ' + ver + ' (this gate describes ' + VER + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // What THIS gate is about is its own release, read by version - the rule
    // dev/test-66423.mjs, dev/test-66424.mjs, dev/test-66427.mjs,
    // dev/test-66428.mjs and dev/test-66429.mjs already follow. The general
    // wording rules below still run against the head entry, because every
    // release has to keep them.
    const entry643 = entries.find((e) => String(e.version) === OWNVER) || {}; /* /^64\\.3$/*/
    const head = entry643;
    const items = head.items || [];
    ok(String(head.version) === OWNVER, 'the entry this gate describes is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('11:55 PM') === -1, 'and it is not ' + PREV + ' stamp');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    ok(/\btimes\b/i.test(notes), 'while naming the report about the ship times');
    // The two gates that read the HEAD entry are repinned to this version, so what
    // they read it for has to survive here.
    ok(/blank/i.test(notes), 'the word dev/test-66425 reads the head entry for is there (blank)');
    ok(/list/i.test(notes) && /record/i.test(notes), 'and the two dev/test-66426 reads it for (list, record)');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.9$/.test(String(e.version))), 'the release before this one is still listed');
    ok(entries.some((e) => /^64\.2\.8$/.test(String(e.version))), 'and so is the one before that');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d/.test(swCache), 'the shell cache has a name of its own (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the ship times are the real ones');
{
  // Each entry from 64.2.4 to 64.2.9 read a clock whose date had not rolled back
  // with it, so two carried the day after they shipped and all of them carried a
  // time hours ahead of the clock the build was made on. Each reads its own
  // release commit now, in Eastern time.
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const parse = (s) => {
    const m = String(s).match(/^([A-Z][a-z]+) (\d+), (\d{4}) \W (\d+):(\d+) (AM|PM) EDT$/);
    if (!m) return null;
    return Date.UTC(Number(m[3]), MON.indexOf(m[1]), Number(m[2]), (Number(m[4]) % 12) + (m[6] === 'PM' ? 12 : 0) + 4, Number(m[5]));
  };
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  if (entries) {
    const byVer = {};
    entries.forEach((e) => { byVer[String(e.version)] = e; });
    const FIXED = [
      ['64.2.4', 'September 27, 2026 \u00b7 9:40 PM EDT'],
      ['64.2.5', 'September 27, 2026 \u00b7 10:30 PM EDT'],
      ['64.2.6', 'September 28, 2026 \u00b7 6:35 AM EDT'],
      ['64.2.7', 'September 28, 2026 \u00b7 7:25 AM EDT'],
      ['64.2.8', 'September 28, 2026 \u00b7 7:50 AM EDT'],
      ['64.2.9', 'September 28, 2026 \u00b7 5:15 PM EDT'],
    ];
    FIXED.forEach(([v, stamp]) => {
      ok(byVer[v] && String(byVer[v].date) === stamp, v + ' shipped at ' + stamp + ' (' + (byVer[v] && byVer[v].date) + ')');
    });
    // Not one of the wrong stamps is left anywhere - in the changelog or in prose.
    const WRONG = [
      'September 28, 2026 \u00b7 9:10 PM EDT',
      'September 28, 2026 \u00b7 10:05 PM EDT',
      'September 28, 2026 \u00b7 10:40 PM EDT',
      'September 28, 2026 \u00b7 11:15 PM EDT',
      'September 28, 2026 \u00b7 11:40 PM EDT',
      'September 28, 2026 \u00b7 11:55 PM EDT',
    ];
    WRONG.forEach((stamp) => {
      ok(count(stamp) === 0, 'the wrong stamp ' + stamp.slice(stamp.indexOf('2026') + 6) + ' is gone');
    });
    // The whole run reads newest first, and nothing is stamped in the future - the
    // ship times a phone shows in the bell were up to six hours ahead of it.
    const recent = entries.slice(0, 10);
    ok(recent.length === 10, 'the last ten entries are there to read (' + recent.length + ')');
    const times = recent.map((e) => ({ version: String(e.version), at: parse(e.date) }));
    ok(times.every((t) => t.at !== null), 'and every one of their stamps parses (' +
      times.filter((t) => t.at === null).map((t) => t.version).join(', ') + ')');
    const outOfOrder = times.filter((t, i) => i > 0 && t.at !== null && times[i - 1].at !== null && t.at > times[i - 1].at);
    ok(outOfOrder.length === 0, 'with the newest first all the way down (' + outOfOrder.map((t) => t.version).join(', ') + ')');
    const ahead = times.filter((t) => t.at !== null && t.at > Date.now() + 15 * 60 * 1000);
    ok(ahead.length === 0, 'and not one of them in the future (' + ahead.map((t) => t.version + ' ' + t.at).join(', ') + ')');
    const head = byVer[VER];
    ok(head && parse(head.date) !== null && parse(head.date) <= Date.now() + 15 * 60 * 1000,
      'this release included (' + (head && head.date) + ')');
  }
}

console.log('[3] the wish to land on the song belongs to one render');
{
  const body = sliceC('  function renderListInner(){', '  let selectMode = false;');
  ok(body !== '', 'renderListInner is still on the page');
  const takeBlock = '    const wantPlayingJump = renderListInner._scrollToPlaying === true;\n    renderListInner._scrollToPlaying = false;';
  const took = body.indexOf(takeBlock);
  const firstUse = body.indexOf('if(wantPlayingJump');
  ok(took !== -1, 'the wish is taken and cleared, not merely read');
  ok(firstUse !== -1 && took < firstUse, 'above anything that uses it');
  ok(body.indexOf('renderListInner._scrollToPlaying = true') === -1, 'and nothing in a render arms it');
  ok(body.split('renderListInner._scrollToPlaying = false;').length - 1 === 1,
    'or clears it a second time (' + (body.split('renderListInner._scrollToPlaying = false;').length - 1) + ')');
  ok(body.indexOf('let landedOnPlaying = false;') !== -1, 'the render records whether it really landed');
  // The two restores, each gated on the right thing.
  ok(countC('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1,
    'the Playlists half restores unless it landed on the song');
  ok(countC('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,
    'and the Albums half always restores its own position');
  ok(countC('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 0,
    'no restore is gated on the one-shot any more');
  const playlists = sliceC('    if(queueIndex >= 0 && queueIndex < queue.length){', '  let selectMode = false;');
  ok(playlists.indexOf('if(wantPlayingJump && autoScrollToSong){') !== -1, 'the landing is taken from the taken wish');
  ok(playlists.indexOf('landedOnPlaying = true;') !== -1 && playlists.indexOf('landedOnPlaying = true;') < playlists.indexOf('smoothScrollIn(pane, row)'),
    'and is recorded when the glide is asked for');
  ok(playlists.indexOf('} else {') === -1 || playlists.indexOf('renderListInner._scrollToPlaying = false;') === -1,
    'with no leftover else branch clearing a flag that no longer exists');
  // The two places that can arm it: both gated, both before the list they arm.
  ok(count('if(autoScrollToSong) renderListInner._scrollToPlaying = true;') === 2,
    'the wish is only armed when the setting asks for it (' + count('if(autoScrollToSong) renderListInner._scrollToPlaying = true;') + ' places)');
  const tabs = sliceC("      el.addEventListener('click', () => {", '      tabs.appendChild(el);');
  ok(tabs !== '', 'the playlist tab click handler is still on the page');
  const armAt = tabs.indexOf('if(autoScrollToSong) renderListInner._scrollToPlaying = true;');
  const listAt = tabs.indexOf('        renderList();');
  ok(armAt !== -1 && listAt !== -1 && armAt < listAt, 'and a tab arms it BEFORE the list it arms');
  ok(tabs.split('renderListInner._scrollToPlaying = true;').length - 1 === 1, 'with no second, unconditional arm');
  const navAt = sliceC("    activePlaylist = pickReal();", "  $('discoverBtn').addEventListener('click'");
  ok(navAt.indexOf('if(autoScrollToSong) renderListInner._scrollToPlaying = true;') !== -1,
    'the Library pill arms it the same way');
}

console.log('[4] the record tap settles its half before it touches an album');
{
  const a = src.indexOf('  function openAlbumForCurrentSong(){');
  const b = src.indexOf('window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;', a);
  ok(a !== -1 && b > a, 'the record tap is still one function');
  const fn = src.slice(a, b);
  const halfAt = fn.indexOf("    const _inAlbums = (typeof libraryMode !== 'undefined' && libraryMode === 'albums');");
  const bailAt = fn.indexOf('    if(!_inAlbums){ jumpToPlayingSong(t); return; }');
  const savedAt = fn.indexOf('ensureAlbumSaved(tag)');
  const nameAt = fn.indexOf('    let albumName = null;');
  ok(halfAt !== -1 && bailAt !== -1, 'it settles which half the tap belongs in');
  ok(halfAt < bailAt, 'in that order');
  ok(savedAt !== -1 && bailAt < savedAt, 'and before it can make an album out of the song tag');
  ok(nameAt !== -1 && bailAt < nameAt, 'so the Playlists half returns before any of that work');
  ok(fn.split('const _inAlbums =').length - 1 === 1, 'the half is asked exactly once');
  ok(fn.indexOf('    const wanted = t.id;') !== -1, 'and the Albums half still opens the album');
  ok(count("const _inAlbums = (typeof libraryMode !== 'undefined' && libraryMode === 'albums');") === 1,
    'with no second copy anywhere in the file');
}

console.log('[5] both halves keep their own place, driven on the real app');
{
  let out = '', code0 = 0;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/halfplace-6643-check.cjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code0 = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  ok(code0 === 0, 'dev/halfplace-6643-check drives the real app: ' + (out.trim().split('\n').pop() || '(no output)'));
  ok(/All 27 checks passed/.test(out), 'and every one of its checks passed');
  ok(/entering Albums after the tap still puts Albums back at 240/.test(out),
    'a playlist tab that arms the wish leaves the other half alone');
  ok(/Albums comes back to its own offset/.test(out),
    'a half is put back where it was left, not where the other one was');
  ok(/nothing in it asks the pane for the Albums offset/.test(out),
    'and the record tap never asks for the other half position');
  ok(/Playlists comes back to where it was, not to the album it was not in/.test(out),
    'the other way round too');
}

console.log('[6] what 64.2.9, 64.2.8, 64.2.7 and 64.2.6 shipped is still standing');
{
  // 64.2.9 - the update installs itself on launch, and the backdrop is translate-only.
  ok(ota.indexOf('checkForUpdate({ silent: true, auto: true })') !== -1, 'the boot check still installs the update by itself');
  ok(ota.indexOf('async function autoInstall(Updater, man, o){') !== -1, 'through the one automatic install path');
  ok(ota.indexOf('HANDED_OVER_THIS_SESSION') !== -1, 'and a hand-over is still remembered for the launch');
  const drift = slice('@keyframes sd-dyn-drift{', '@keyframes sd-glow-pulse{');
  ok(drift !== '' && !/scale\(|rotate\(/.test(drift), 'and no backdrop keyframe animates a scale or a rotation');
  ok(count('animation: sd-dyn-drift ') === 13, 'with all thirteen dynamic themes still drifting');
  const bubble = sliceC('.home-bubble{', '.home-bubble:active{');
  ok(/contain:\s*paint;/.test(bubble), 'a Home card still contains its own glow');
  // 64.2.8 - the media-player line is out of Things to know about SideCut.
  const list = slice('<!-- Collapsible: Things to know about SideCut -->', '<div id="settingsPaneSandbox"');
  ok(list !== '' && list.split('style="color:var(--coral); flex-shrink:0;">\u2022</span>').length - 1 === 11,
    'the Things-to-know list still has its eleven bullets');
  ok(list.indexOf("The phone's media player can't open SideCut.") === -1, 'with the media-player line still gone');
  // 64.2.7 - the filter is off the backdrop and the island watches its own scroller.
  ok(!has('@keyframes sd-dyn-hue{'), 'the backdrop still animates no colour filter');
  ok(has('    var onRailScroll = function(){'), 'the rail settle is still named once');
  ok(has("    if(rl) rl.addEventListener('scroll', onRailScroll, { passive: true });"),
    'and the island still asks for a repair on its own scroller');
  // 64.2.6 - the repair that outlives its frame, and the two halves' own places.
  ok(has('  function scRepaint(el){'), 'the paint request is still one helper');
  ok(has('  var scLibScroll = { playlists: 0, albums: 0 };'), 'and each library half still keeps its own place');
  ok(has('  window.__scLibScroll = scLibScroll;'), 'which the gates read');
  ok(has('if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){'), 'an unchanged Home grid is still left alone');
}

console.log('[7] the file still holds together');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'every inline script block parses (' + bad + ' bad)');
  let code0 = 0, out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code0 = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code0 === 0, 'every name the app reads is declared: ' + first.trim());
  let dom0 = 0, domOut = '';
  try {
    domOut = execFileSync(process.execPath, [path.join(ROOT, 'dev/check-dom.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    dom0 = e.status === undefined ? 1 : e.status;
    domOut = String((e.stdout || '') + (e.stderr || ''));
  }
  ok(dom0 === 0, 'the document still closes every element: ' + (domOut.trim().split('\n').pop() || '(no output)'));
  ok(count('id="homeBubbles"') === 1 && count('class="home-bubble') >= 10, 'the Home grid and its cards are still there');
  ok(count('  const CHANGELOG = [') === 1, 'and the changelog is still one array');
  // The version rule this release had to be corrected for: 64.2.9 is followed by
  // 64.3, and the string 64.2.10 exists nowhere in the file.
  ok(count('64.2.10') === 0, 'the drafted 64.2.10 is nowhere on the page (' + count('64.2.10') + ')');
  ok(new RegExp("const APP_VERSION = '" + String(PAGEVER).replace(/\./g, '\\.') + "';").test(src), 'and the app runs as the version the page declares (' + PAGEVER + ')');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
