#!/usr/bin/env node
// v64.2.3 - the pinned-artists island blinking, and the hitch after a scroll.
//
//   [1] the release itself: 64.2.3 runs, the head entry says so, and its six
//       notes are SHORT plain sentences that publish on both channels and never
//       read as a downloader on the store one.
//   [2] the rail: the repaint never hides the strip (a hidden frame IS "the
//       island sometimes doesn't show but comes back after a split second"), and
//       it no longer forces the page to lay itself out on every settled scroll.
//   [3] Home keeps the precedent this release copies: no hide, no forced layout,
//       the drag clean-up and the grid check untouched.
//   [4] what 64.2.2 shipped is still standing, because a release that dropped it
//       would be trading one report for another.
//   [5] the file still holds together: every inline script parses and every name
//       the app reads is declared.
//
//   node dev/test-66423.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '70.0.6'; /* repinned by dev/repin-706.mjs */ /* repinned by dev/repin-705.mjs */ /* repinned by dev/repin-70.mjs */
const PREV = '64.2.2';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
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
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  // The head entry belongs to whatever shipped last, so read the 64.2.3 entry by
  // version: this gate describes 64.2.3.
  const entry6423 = entries ? entries.find((x) => /^64\.2\.3$/.test(String(x.version))) : null;
  ok(!!entry6423 && String(entry6423.version) === '64.2.3', 'the 64.2.3 entry this gate describes is still here');
  if (entry6423) {
    const head = entry6423;
    const items = head.items || [];
    ok(String(head.version) === '64.2.3', 'the entry this gate describes is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    // "put the patch notes in simple terms not so long" - the length is the point
    // of these entries, so it is pinned rather than described.
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('7:40 PM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(head.items && head.items.every((it) => it.length <= 260), 'and every 64.2.3 note is still short');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    ok(/pinned artists/i.test(notes), 'while naming what was reported');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.2$/.test(String(e.version))), 'the release before this one is still listed');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the rail repaints without hiding itself and without a forced layout');
{
  const rail = sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){');
  const watch = sliceC('  (function watchPinnedRail(){', '  function ');
  ok(rail !== '', 'the rail repaint is still there');
  ok(!/visibility/.test(rail), 'it never touches visibility - a hidden frame IS the reported blink');
  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');"), 'the strip and every chip in it are asked to paint again');
  ok(!/translateZ/.test(rail) && !/offsetHeight|getBoundingClientRect/.test(rail),
    'and nothing is put on a layer of its own, or measured, on the way');
  ok(!/void strip\.offsetHeight/.test(rail), 'the layout flush that made a settled scroll hitch is gone');
  ok(!/getBoundingClientRect/.test(watch), 'and the rebuild is decided from the DOM, not by measuring the strip');
  ok(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
    'so a rail that really has no chips is still built again');
  ok(has("    var dv = $('discoverView');"), 'the watch is still attached to Discover');
  ok(has('    dv._paRailWatch = true;'), 'wired once, not once per render');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still holding what a drag gives it is still put back');
  ok(has('  function renderPinnedArtists(){'), 'the rail still has its builder');
  ok(!/void strip\.offsetHeight/.test(code), 'no settled scroll anywhere still lays the page out');
}

console.log('[3] Home keeps the precedent the rail now follows');
{
  const grid = sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){');
  ok(grid !== '', 'the Home repaint is still there');
  ok(!/visibility/.test(grid), 'it still never hides the grid');
  ok(!/offsetHeight/.test(grid), 'and it does not force a layout either');
  ok(has("    scRepaintSurface(wrap, '.home-bubble');"), 'and every bubble on it is asked to paint again');
  ok(has("      var phs = wrap.querySelectorAll('.hb-drag-placeholder');"),
    'a dashed placeholder an abandoned drag left behind is still removed');
  ok(has("        if(!b.classList.contains('hb-dragging') && !b.style.position) continue;"),
    'a bubble still holding a drag lift is still put back to a plain bubble');
  ok(has('  function homeGridIsWhole(){'), 'the grid still knows what it should contain');
  ok(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
    'and a grid really missing a bubble is still drawn again');
  ok(has('!v || v._hbPaintWatch'), 'the watch is still wired once');
  ok(has('          if(hbDrag) return; // a drag in progress owns the grid'), 'and a live drag still owns the grid');
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }'),
    'Home keeps the stacking context 64.2.1 gave it');
}

console.log('[4] what 64.2.2 shipped is still standing');
{
  ok(has('<span>Roll back app (or go forward again)</span>'), 'rolling forward is still one tap from the picker');
  ok(has('Go forward to the latest version (v${APP_VERSION})</button>`'), 'and still names the installed version');
  ok(has("      await dbDelete('meta', 'pinnedVersion');"), 'and still clears the pin when tapped');
  const kbSrc = src.slice(src.indexOf('var _aiKB = ['), src.indexOf('];', src.indexOf('var _aiKB = [')) + 2);
  let play = null;
  try { play = new Function('SC_IS_PLAY', 'window', kbSrc + '\nreturn _aiKB;')(true, { __PLAY_BUILD__: true }); }
  catch (e) { ok(false, 'the knowledge base evaluates: ' + e.message); }
  if (play) {
    const STRONG = /(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off)/i;
    ok(play.filter((e) => STRONG.test(e.a)).length === 0, 'the store build still answers without a fetch tool');
  }
  ok(has("' of the ' + scFmtBytes(estimate.quota) + ' this phone allows the app'"), 'Storage still names whose allowance it shows');
  ok(has('  let watermarkEnabled = true;'), 'Watermark Remover still starts on');
  ok(has("if(watermarkEnabledRow) watermarkEnabled = !!watermarkEnabledRow.value;"), 'and a saved choice still wins');
  ok(count('background:var(--coral); color:var(--on-coral,#fff)') >= 15,
    'every accent fill still picks its own text colour: ' + count('background:var(--coral); color:var(--on-coral,#fff)'));
}

console.log('[5] the file still holds together');
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
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
