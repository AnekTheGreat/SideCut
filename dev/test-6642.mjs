#!/usr/bin/env node
// v64.2 - the follow-up to 64.1, one check per thing that was reported.
//
//   [1] the release itself: 64.2 is what runs, the head entry says so, its six
//       notes obey both channels' rules (no downloader term, nothing that names
//       the store build, and no term the wider store list knows), and it still
//       says what the release did;
//   [2] the entry NAMES: neither "the polish pass" nor "the QOL pass" is left
//       anywhere in the changelog, no recent entry names itself a pass, and the
//       two entries that did state their changes now;
//   [3] the settings tabs are back in the order they had - More last, Donate
//       fourth, Support seventh;
//   [4] the More pane is the card list it was: the four group headings and the
//       regrouping 64.1 did are gone, the playback-preference card is back in
//       its own place, and every card is still in the pane;
//   [5] only the pane scrolls: the sheet cannot scroll (the pane absorbs the
//       leftover height, the title / strip / Close keep theirs), and every tab
//       resets both scroll positions, so no tab can open "gone up" and carry
//       that offset into the next one;
//   [6] the pinned-artist row: Discover has its own stacking context, the card
//       is lifted out of the glow wash, a settled scroll repaints the card and
//       drops any leftover drag lift without re-rendering, and the rail still
//       keeps a minimum height and still starts at its left edge;
//   [7] the whole file still parses, and every name it reads is declared.
//
//   node dev/test-6642.mjs                            # the shipped tree
//   SC_HTML=/path/index.html node dev/test-6642.mjs     # any build
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
const VER = '64.2.1';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  // The head entry belongs to whatever shipped last, so read the 64.2 entry by
  // version: this gate describes 64.2.
  const entry642 = entries ? entries.find((x) => /^64\.2$/.test(String(x.version))) : null;
  ok(!!entry642 && String(entry642.version) === '64.2', 'the 64.2 entry this gate describes is still here');
  if (entry642) {
    const head = entry642;
    const items = head.items || [];
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release did');
    ok(/pinned/i.test(notes), 'the first half of it is the pinned-artist row');
    ok(/settings/i.test(notes), 'and the second is Settings');
    ok(/EDT$/.test(head.date || ''), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('64.1') === -1, 'and it is not 64.1\'s stamp');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the entry names state the changes');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = [];
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  const newest = entries.slice(0, 3);
  ok(newest.length === 3, 'the three newest entries are readable');
  for (const e of newest) {
    ok(!/\bpass\b/i.test(String(e.title)), 'v' + e.version + ' does not name itself a pass (' + e.title + ')');
  }
  ok(entries.every((e) => String(e.title).indexOf('polish pass') === -1 && String(e.title).indexOf('QOL pass') === -1),
    'no entry carries an invented pass name');
  // Scoped to the releases this log is actually read for: one entry from the
  // 33.x era still calls itself a "Small UI polish pass", and rewriting a
  // footnote from ten releases ago is not what was asked for.
  const recent = entries.filter((e) => parseFloat(String(e.version)) >= 60);
  ok(recent.length > 5, 'the recent entries are readable (' + recent.length + ')');
  ok(recent.every((e) => !/\bpass\b/i.test(String(e.title))), 'and none of them names itself a pass');
  // The two that were renamed still describe the releases they belong to.
  // Read by version through a regex, never a quoted literal: the release bump
  // rewrites quoted version literals across dev/test-*.mjs, and one of those
  // repins must not be able to point a check at the wrong entry.
  const e641 = entries.find((x) => /^64\.1$/.test(String(x.version)));
  const e64 = entries.find((x) => /^64$/.test(String(x.version)));
  ok(!!e641 && /crop/i.test(String(e641.title)) && /settings/i.test(String(e641.title)),
    'the 64.1 entry still states what 64.1 changed (' + (e641 && e641.title) + ')');
  ok(!!e64 && /cover/i.test(String(e64.title)) && /rollback/i.test(String(e64.title)),
    'and the 64 entry still states what 64 changed (' + (e64 && e64.title) + ')');
  // Same reasoning: the stamp is built from two halves so no repin can rewrite
  // the version it belongs to.
  const stamp641 = "  { version: '64" + ".1', date: 'September 27, 2026 " + String.fromCodePoint(0x00b7) + " 2:15 PM EDT'";
  ok(has(stamp641), 'their dates are untouched');
}

console.log('[3] the settings tabs are back in the order they had');
{
  const order = ['settingsTabPremium', 'settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',
    'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']
    .map((id) => src.indexOf('id="' + id + '"'));
  ok(order.every((i) => i !== -1), 'all nine tabs are present');
  ok(order.every((v, i) => i === 0 || order[i - 1] < v),
    'and the strip runs Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More');
  ok(order[8] > order[7] && order[8] > order[6], 'More is the last tab');
  ok(order[3] < order[4], 'Donate is where it was (fourth)');
  ok(order[6] < order[7], 'and Support is seventh, before Widget');
  // The labels must still be the ones a reader expects against those ids.
  ok(has('id="settingsTabMore" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">More</button>'),
    'the last button really is More');
  ok(has('id="settingsTabDonate" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Donate</button>'),
    'and the fourth really is Donate');
}

console.log('[4] the More pane is the card list it was');
{
  ok(count('text-transform:uppercase; color:var(--ink-dim); margin:18px 2px 8px;') === 0,
    'the four group headings 64.1 added are gone');
  for (const t of ['This build and help', 'Library, storage and rollback', 'History and extras']) {
    ok(src.indexOf('>' + t + '</div>') === -1, 'no "' + t + '" heading is left');
  }
  const card = src.indexOf('<!-- Diagonal / Single button toggle -->');
  ok(card !== -1, 'the Playlists/Albums button card is still there');
  ok(card > src.indexOf('id="howToUseBtn"'), 'and sits after the Replay tutorial card, where it always did');
  ok(card < src.indexOf('<!-- Collapsible: Tutorial summary (text) -->'), 'above the tutorial summary');
  ok(card < src.indexOf('<!-- Collapsible: Library Tools & Fetching -->'), 'not in the library group 64.1 moved it to');
  ok(has('id="diagonalSplitToggle"') && has('id="autoScrollToggle"'), 'both of its switches are still wired');
  // Nothing else about the pane moved.
  for (const id of ['howToUseBtn', 'collapsibleTutorialSummary', 'collapsibleSeizureWarn', 'collapsiblePlaybackSound',
    'collapsibleLibrary', 'collapsibleDjPerPlaylist', 'settingsPaneRefresh']) {
    ok(has('id="' + id + '"'), 'the ' + id + ' card is still in the pane');
  }
}

console.log('[5] only the pane scrolls, and every tab opens at its own top');
{
  ok(has('  flex: 1 1 auto;\n  min-height: 0;\n  max-height: 62vh;'),
    'the pane absorbs the height the sheet has left');
  ok(has('#themeBackdrop .modal > h3,\n#themeBackdrop .modal > #settingsTabStrip,\n#themeBackdrop .modal > .modal-btns{ flex: 0 0 auto; }'),
    'and the title, the tab strip and Close can never be squeezed');
  const scrollBlock = src.slice(src.indexOf('.settings-scroll {'), src.indexOf('.settings-scroll::-webkit-scrollbar'));
  ok(/scroll-behavior: auto;/.test(scrollBlock) && !/scroll-behavior: smooth;/.test(scrollBlock),
    'the pane still follows the wheel one to one');
  ok(/overscroll-behavior: contain;/.test(scrollBlock), 'and contains its own ends');
  const fn = src.slice(src.indexOf('function showSettingsTab(tab){'), src.indexOf("$('settingsTabPremium').addEventListener"));
  ok(/var _panes = \$\('settingsPanesWrap'\); if\(_panes\) _panes\.scrollTop = 0;/.test(fn),
    'switching tab resets the shared pane scroll');
  ok(/var _sheet = _tbd \? _tbd\.querySelector\('\.modal'\) : null;\n\s*if\(_sheet\) _sheet\.scrollTop = 0;/.test(fn),
    'and the sheet itself, so nothing can start half-way down');
  ok(fn.indexOf('_panes') < fn.indexOf("$('settingsPanePremium')"),
    'both resets run before any pane is shown');
}

console.log('[6] the pinned-artist row');
{
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; }'),
    'Discover has its own stacking context, so the fixed glow layers cannot paint over it');
  ok(src.indexOf('/* Needs its own stacking context, for the same reason #listPane has one:') !== -1,
    'and says why, the way #listPane does');
  ok(has('#pinnedArtistsStrip{ position:relative; z-index:1; }'),
    'the rail card is lifted out of that wash too');
  ok(has('<div id="pinnedArtistsStrip" style="background:var(--bg-raised);margin:0 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;">'),
    'and keeps the raised-card markup it had');
  ok(has('display:flex;align-items:flex-start;gap:12px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;min-height:64px;padding:0 2px 4px;'),
    'the rail keeps its chips on one line and keeps a minimum height');
  ok(!has('-webkit-overflow-scrolling:touch;scrollbar-width:none;min-height:64px'),
    'and its nested scroller no longer carries the legacy property');
  ok(has('  function repaintPinnedRail(list){'), 'a settled scroll repaints the card');
  ok(has('    var strip = $(\'pinnedArtistsStrip\');'), 'the repaint is aimed at the card itself');
  ok(has('    strip.style.visibility = \'hidden\';\n    void strip.offsetHeight;'),
    'by throwing its painted pixels away');
  ok(has('    requestAnimationFrame(function(){ try{ strip.style.visibility = \'\'; }catch(_eRpr){} });'),
    'and painting them again on the next frame');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'any chip still holding a drag lift is put back to a plain chip');
  ok(has("    try{ list.scrollLeft = 0; }catch(_eSc){}"), 'a redrawn rail still starts at its left edge');
  const watch = src.slice(src.indexOf('(function watchPinnedRail(){'), src.indexOf('// ---------------- Release page for pinned-artist releases'));
  ok(watch.indexOf('repaintPinnedRail(l);') !== -1, 'the watch calls the repaint');
  ok(watch.indexOf('repaintPinnedRail(l);') < watch.indexOf("l.querySelector('.pinned-artist-chip')"),
    'before it decides whether the rail is empty, so a rail that still has its artists is repainted too');
  ok(/if\(!pinnedArtists\.length\) return;/.test(watch), 'nothing runs when there are no pinned artists');
  ok(src.indexOf('dv._paRailWatch = true;') !== -1, 'and it is wired once, not once per render');
  // The lift is still dropped when a drag finishes, and the render path is intact.
  const wire = src.slice(src.indexOf('window.wirePinnedReorder = function(){'), src.indexOf('window.toastWithCancel'));
  ok(wire.indexOf("try{ chip.style.transform = ''; chip.style.zIndex = ''; chip.style.boxShadow = ''; }catch(_ePLift){}") !== -1,
    'a finished drag still drops the lift');
  ok(!/covers\.sort/.test(watch), 'and the repaint never rebuilds the rail, so no cover is decoded again');
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
  let code = 0, out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code === 0, 'every name the app reads is declared: ' + first.trim());
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
