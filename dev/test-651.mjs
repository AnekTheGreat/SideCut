#!/usr/bin/env node
// v63.1.2 verification — "Upcoming releases / Check for drops keeps reopening the
// popup, and it does not look like it is checking anything".
//
// Two defects, both pinned here against the shipped source:
//
// 1. `__scRebuildReleaseLists` read the popup's open/closed state BEFORE the
//    check, and whenever the release popup was open it called the popup's own
//    handler — which ends in `openDiscoverPopup(...)`, a function that sets
//    `display:flex` unconditionally. A run that finished after the user closed
//    the popup therefore put it back on screen. The state must be read AFTER the
//    check, and the handler must be told this is only a repaint (otherwise it
//    asks for a second full check, so one tap ran the whole thing twice).
//
// 2. The empty-state sentence was written once, at panel build time. Updating it
//    afterwards was deliberately skipped (`!emptyEl._scUpWired`) because writing
//    textContent onto the container would have taken the CTA buttons with it — so
//    a finished check left the same frozen line, with nothing to show it ran.
//    The sentence has to live in its own child, and be refreshed in place.
//
// The catalogs themselves are not touched: live probes show the MusicBrainz
// browse and the Wikidata pass leaving for every pinned artist, and the artists
// in the report genuinely have no dated future release in any open catalog. What
// changes is that the app now says so.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ok   ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (needle) => src.split(needle).length - 1;
const slice = (from, to) => {
  const i = src.indexOf(from);
  if (i === -1) throw new Error('could not find start: ' + from);
  const j = src.indexOf(to, i);
  if (j === -1) throw new Error('could not find end: ' + to);
  return src.slice(i, j);
};
const sliceBetween = slice;

const VER = '64.3';

console.log('[1] a check that finishes after you close the popup leaves it closed');
{
  const rb = slice('window.__scRebuildReleaseLists = async function(doFetch){', '  // The button runs the check on the spot');
  ok(!!rb, '__scRebuildReleaseLists slice extracted');
  // The check must run BEFORE the popup state is sampled.
  ok(rb.indexOf('await checkPinnedArtistReleases()') < rb.indexOf('getComputedStyle(ov).display'),
    'the check runs before the popup is sampled (so a closed popup is seen as closed)');
  ok(rb.includes('window.__scReleaseRepaintOnly = true'), 'the handler is told this is a repaint');
  ok(rb.includes('finally{ window.__scReleaseRepaintOnly = false; }'), 'and the flag is always cleared');
  ok(!/popupOpen = !!(ov && getComputedStyle\(ov\)\.display !== 'none');\s*\n\s*\}catch\(_eOv\)\{\}\s*\n\s*var tEl/.test(rb),
    'the old "sample first, then check" order is gone');
  // The handler must NOT re-run a full check when asked to repaint.
  const fl = sliceBetween('const flBtn = $(\'discoverFetchLatest\');', '// Old songs: tracks from each pinned artist');
  ok(fl && fl.includes('var _repaintOnly = !!window.__scReleaseRepaintOnly;'), 'the Fetch latest handler reads the repaint flag');
  ok(fl && fl.includes('if(!_repaintOnly){'), 'and skips the whole check + button dance when repainting');
  ok(fl && fl.split('await checkPinnedArtistReleases()').length - 1 === 1,
    'exactly one check call in the handler (' + (fl ? fl.split('await checkPinnedArtistReleases()').length - 1 : 0) + ')');
}

console.log('[2] one tap on Check for drops runs one check and repaints');
{
  const tap = slice('window.__scUpcomingConnectTap = async function', 'window.__scAddUpcomingDrop = function');
  ok(tap && tap.includes('window.__scRebuildReleaseLists(true)'), 'the tap still runs the rebuild');
  ok(tap && tap.includes('window.__scUpRefreshState()'), 'and refreshes the open panel when it ends');
}

console.log('[3] the tab only looks the dates up when you tap it');
{
  const relTab = slice('window.__scDiscRelTab = function(mode, root){', 'function openDiscoverPopup');
  ok(relTab.includes('if(upcoming && !up.length && window.__scUserTabTap'), 'autofetch needs a genuine tab tap');
  ok(relTab.includes('!window.__scReleaseRepaintOnly'), 'a repaint mid-check never re-arms it');
  ok(relTab.includes("pinnedCheckState && pinnedCheckState.active"), 'nor does a run already in flight');
  ok(relTab.includes('window.__scUpcomingAutofetch(root)'), 'the lookup is still wired to the tab');
  // Both tab strips must mark a real tap.
  ok(count('window.__scUserTabTap = true;') === 2, 'both tab strips mark a real tap (' + count('window.__scUserTabTap = true;') + ')');
  const auto = sliceBetween('window.__scUpcomingAutofetch = async function(){', 'window.__scRebuildReleaseLists = async function');
  ok(auto.includes("if(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState.active) return;"),
    'the autofetch never starts on top of a running check');
}

console.log('[4] the empty state says what the check found, from its own node');
{
  ok(src.includes('window.__scUpRefreshState = function(root){'), '__scUpRefreshState is defined');
  const fn = slice('window.__scUpRefreshState = function(root){', 'window.__scWireUpcomingCta = function(el){');
  ok(fn.includes("el.querySelector('.sc-up-msg')"), 'it finds the message node');
  ok(fn.includes('msg.textContent = want'), 'and rewrites it');
  ok(fn.includes('sc-up-run'), 'a live progress line is created on demand');
  ok(fn.includes('st.active') && fn.includes('st.done'), 'the progress line reads the running check');
  ok(fn.includes('bar.style.display'), 'and is hidden again when the run ends');
  // The message must be its own child, so the buttons survive.
  const wire = slice('window.__scWireUpcomingCta = function(el){', 'window.__scRebuildReleaseLists = async function');
  ok(wire.includes("_msg.className = 'sc-up-msg';"), 'the CTA helper moves the sentence into its own node');
  ok(wire.indexOf("_msg.className = 'sc-up-msg';") < wire.indexOf('el.appendChild(wrap);'),
    'before the buttons are appended (so an update cannot take them)');
  // The tab refresh must call the helper instead of writing textContent.
  ok(!src.includes('if(upcoming && !up.length && !emptyEl._scUpWired){'), 'the old frozen-line guard is gone');
  ok(src.includes('window.__scUpRefreshState(root);'), 'the tab refresh updates the line in place');
  // And the progress ticker keeps it live while the run goes.
  ok(count('window.__scUpRefreshState()') >= 3, 'the ticker, the rebuild and the tap all refresh it (' + count('window.__scUpRefreshState()') + ')');
}

console.log('[5] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === VER, 'APP_VERSION = ' + ver);
ok(!/^63\.\d+\.\d{2,}$/.test(ver) && !/^63\.1\.10$/.test(ver), 'not a rolled-over patch number');
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
  ok(!/play build|play version|play install/i.test(entries[0].items.join('\n')), 'notes never name the play build');
  ok(!/\bdownloader|converter|convert\b/i.test(entries[0].items.join('\n')), 'new notes carry no downloader term');
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');

console.log('[6] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
