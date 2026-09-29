#!/usr/bin/env node
// v64.1 — the eight things reported in one pass, each checked by what it does
// rather than by what it says it does where that is possible.
//
//   [1] the release itself: v64.1 is what runs, the head entry says so, and the
//       notes obey both channels' rules (six shared notes, no downloader term,
//       nothing that names the store build) while still describing the release;
//   [2] the crop sheet's listen-through control: the slider and its button are
//       in the markup, the playback runs through the live path the selection
//       preview already uses, a DRAG only moves the line (it never starts a
//       sound) and letting go starts the sound from where it was dropped;
//   [3] the premium split: RGB, RGB +, Ember, Galaxy and Glacier are free, every
//       other animated theme carries the flag, and the three places that
//       describe the split agree;
//   [4] the assistant's greeting — the shipped matcher is RUN here, so a bare
//       "hi" is answered as a greeting and can no longer be reached through the
//       word "history";
//   [5] the pinned-artist rail: the styles that could leave a chip on its own
//       layer are always dropped, the rail cannot collapse, and a scroll that
//       leaves it empty redraws it;
//   [6] Settings and More: the tab order, the four group headings, and a scroll
//       pane that follows the wheel instead of gliding past it;
//   [7] the pinned-artist cover grid: the shipped sort comparator is RUN, so
//       newest really is first and anything undated really does sort last;
//   [8] the whole file still parses, and every name it reads is declared.
//
//   node dev/test-6641.mjs                           # the shipped tree
//   SC_HTML=/path/index.html node dev/test-6641.mjs   # any build
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
const VER = '70.0.5'; /* repinned by dev/repin-705.mjs */ /* repinned by dev/repin-70.mjs */

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
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // The head entry belongs to whatever shipped last, so read the 64.1 entry
    // by version: this gate describes 64.1.
    const head = entries.find((x) => /^64\.1$/.test(String(x.version))) || entries[0];
    const items = head.items || [];
    ok(items.length >= 6, 'patch notes: ' + items.length);
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release did');
    ok(/crop/i.test(notes) && /greeting|hello/i.test(notes), 'starting with the crop sheet and the greeting');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the crop sheet can be listened through');
{
  ok(has('id="cropSongScrub"'), 'the listen-through slider is in the sheet');
  ok(has('id="cropSongScrubPlay"'), 'with a play/pause button beside it');
  ok(has('aria-label="Listen through the song"'), 'and it is labelled for what it is');
  ok(has('function cropScrubSeek(sec, play){'), 'the playback behind it is defined');
  ok(has('function cropScrubSetUI(sec){'), 'and so is the line and the clock it moves');
  ok(has("(cropPlayMode === 'song' ? 'Listening ' : 'Previewing ')"), 'the status line says which one is playing');
  // A drag must not make a sound; letting go must.
  const inputH = src.slice(src.indexOf("$('cropSongScrub').addEventListener('input'"), src.indexOf("$('cropSongScrub').addEventListener('change'"));
  const changeH = src.slice(src.indexOf("$('cropSongScrub').addEventListener('change'"), src.indexOf("$('cropSongScrubPlay').addEventListener('click'"));
  ok(/cropScrubSeek\(cropScrubSec\(\), false\)/.test(inputH), 'dragging the thumb only moves the line');
  ok(/cropScrubSeek\(cropScrubSec\(\), true\)/.test(changeH), 'and letting go plays the song from there');
  ok(has("if(cropPreviewAudio){ cropStopPreview(); return; }"), 'the button stops anything already sounding');
  ok(count('if(cropPreviewAudio && cropPreviewAudio.pause === stopLive) cropPreviewAudio = null;') === 2,
    'and a preview that reaches the end disarms itself, so the next tap plays instead of stopping nothing');
  // It plays through the same live context as the selection preview, so there is
  // one path to stop — and it starts the source at the dropped position.
  const seek = src.slice(src.indexOf('function cropScrubSeek(sec, play){'), src.indexOf("$('cropSongScrub').addEventListener('input'"));
  ok(seek.indexOf('src.start(0, at);') !== -1, 'the sound starts at the dropped position');
  ok(seek.indexOf('cropPreviewLive = src;') !== -1, 'through the live AudioContext path');
  ok(seek.indexOf('cropCleanupPreview();') !== -1, 'after stopping whatever ran before');
  ok(has('cropPreviewLenSec = Math.max(0.05, total - at);'), 'and it runs to the end of the song');
  ok(has("      cropPlayMode = 'sel';\n      cropScrubSetUI(0);"), 'a fresh sheet resets it to the top of the song');
  ok(has("    const sb = $('cropSongScrubPlay');\n    if(sb) sb.textContent = "), 'and stopping clears the button');
  ok(count('cropScrubSetUI(') >= 3, 'the clock and the playhead are kept in step in one place');
}

console.log('[3] which animated themes are premium');
{
  const free = [
    ["rgb:true  },", 'RGB'],
    ["rgb:true, rgbPlus:true  },", 'RGB +'],
    ["coral:'#FF8A5C', gold:'#FFC46B', dynamic:'ember'", 'Ember'],
    ["coral:'#B084F5', gold:'#8FD0FF', dynamic:'galaxy'", 'Galaxy'],
    ["coral:'#A6E8FF', gold:'#E8F7FF', dynamic:'glacier'", 'Glacier'],
  ];
  const paid = [
    ["premium:true, dynamic:'aurora'", 'Aurora'],
    ["premium:true, dynamic:'synthwave'", 'Synthwave'],
    ["premium:true, dynamic:'ocean'", 'Deep Ocean'],
    ["premium:true, dynamic:'cyberpunk'", 'Cyberpunk'],
    ["premium:true, dynamic:'nebula'", 'Nebula'],
    ["premium:true, dynamic:'neonpulse'", 'Neon Pulse'],
    ["premium:true, dynamic:'solstice'", 'Solstice'],
    ["premium:true, dynamic:'abyss'", 'Abyss'],
    ["premium:true, dynamic:'orchid'", 'Orchid'],
  ];
  for (const [needle, name] of free) ok(has(needle), name + ' is free');
  for (const [needle, name] of paid) ok(has(needle), name + ' is premium only');
  // No free theme may carry the flag, and no premium one may have lost it: the
  // five free entries are the only animated entries without `premium:true`.
  for (const [needle, name] of free) {
    const line = src.slice(src.indexOf(needle) - 10, src.indexOf(needle));
    ok(line.indexOf('premium') === -1, name + ' carries no premium flag (' + line.trim().slice(-24) + ')');
  }
  ok(has('every static theme, plus five of the animated ones: RGB, RGB +, Ember, Galaxy and Glacier.'),
    'the premium page says what free keeps');
  ok(has('nine animated themes (Aurora, Synthwave, Deep Ocean, Cyberpunk, Nebula, Neon Pulse, Solstice, Abyss, Orchid)'),
    'and names the nine premium adds');
  ok(count('Avoid the <b>RGB</b>, <b>RGB+</b>, and every animated <b>dynamic theme</b>') === 2,
    'both seizure warnings name every animated theme');
  ok(has('Orchid) ' + String.fromCodePoint(0x2014) + ' the Theme tab lists all of them under Dynamic themes.'),
    'including the ones a photosensitive user must not open by accident');
  // The lock is what enforces it, and it reads the flag.
  ok(has('if(th.premium && !isPremiumActive()){'), 'the Theme tab still locks a premium theme');
}

console.log('[4] a greeting is answered as a greeting');
{
  const s = src.indexOf('function _aiGreetingReply(msg) {');
  const e = s === -1 ? -1 : src.indexOf('\n}\n', s);
  const kbS = src.indexOf('var _aiKB = [');
  const kbE = kbS === -1 ? -1 : src.indexOf('];', kbS) + 2;
  const matchS = src.indexOf('function _aiFuzzyMatch(query, minScore) {');
  const matchE = matchS === -1 ? -1 : src.indexOf('\n}\n', matchS);
  ok(s !== -1 && e !== -1, 'the greeting answer is in the file');
  ok(matchS !== -1 && matchE !== -1, 'and the matcher is too');
  let F = null;
  try {
    F = new Function('SC_IS_PLAY', 'window',
      (s === -1 ? '' : src.slice(s, e + 3)) +
      (matchS === -1 ? '' : src.slice(matchS, matchE + 3)) +
      (kbS === -1 ? '' : src.slice(kbS, kbE)) +
      '\nreturn { greet: _aiGreetingReply, match: _aiFuzzyMatch, kb: _aiKB };')(false, {});
  } catch (err) { ok(false, 'the assistant pieces evaluate: ' + err.message); }
  if (F) {
    ok(F.kb.length >= 60, 'the knowledge base still builds (' + F.kb.length + ' answers)');
    for (const g of ['Hi', 'hi!', 'hey', 'Hey there', 'hello', 'yo', 'Good morning', 'good evening', 'Thanks', 'thank you', 'bye']) {
      const r = F.greet(g);
      ok(typeof r === 'string' && r.length > 20, '"' + g + '" is answered (' + r.slice(0, 42) + '...)');
      ok(/SideCut|music|help|Any time/i.test(r), 'and the answer is about SideCut or an acknowledgement');
    }
    ok(F.greet('how are you').length > 20, '"how are you" is answered');
    ok(F.greet('') === '' && F.greet('   ') === '', 'an empty message is not a greeting');
    ok(F.greet('how do I crop a song').length === 0, 'and a real question is left to the matcher');
    ok(F.greet('hippopotamus').length === 0, 'nor is a word that merely starts with one');
    // The reported failure: "Hi" came back as the Album History paragraph,
    // because "hi" is a substring of "history".
    ok(F.match('hi', 80) === null, 'a bare "Hi" no longer strong-matches an answer');
    ok(F.match('hi') === null, 'not even a weak one');
    ok(F.greet('Hi').indexOf('Album History') === -1, 'and the greeting itself never mentions a feature');
    const found = F.match('album history');
    ok(!!found && /album history/i.test(found.a), 'while "album history" still finds its own answer');
    const crop = F.match('how do I crop a song');
    ok(!!crop && /Crop song/.test(crop.a), 'and the crop answer is still reachable');
  }
  ok(has('  var _greeting = _aiGreetingReply(msg);'), 'a greeting is answered before the model or the base is asked');
  ok(src.indexOf('_aiGreetingReply(msg);') < src.indexOf("var _kbStrong = _aiFuzzyMatch(msg, 80);"),
    'and before the strong match can run');
}

console.log('[5] the pinned-artist rail cannot come back empty');
{
  ok(has('min-height:64px;'), 'the rail keeps a minimum height, so the card cannot collapse');
  ok(has('align-items:flex-start;gap:12px;overflow-x:auto'), 'and its chips sit at the top');
  ok(has('    try{ list.scrollLeft = 0; }catch(_eSc){}'), 'a redrawn rail always starts at its left edge');
  ok(has('(function watchPinnedRail(){'), 'a scroll of Discover watches the rail');
  ok(has("if(l.querySelector('.pinned-artist-chip')) return;"),
    'and redraws it only when it is really empty');
  ok(has('renderPinnedArtists();\n        }catch(_eRailWatch){}'), 'the redraw is the real render');
  ok(src.indexOf('dv._paRailWatch = true;') !== -1, 'and it is wired once, not once per render');
  // The lift: it used to be cleared only inside `if(drag)`.
  const wire = src.slice(src.indexOf('window.wirePinnedReorder = function(){'), src.indexOf('window.toastWithCancel'));
  const guard = wire.indexOf("try{ chip.style.transform = ''; chip.style.zIndex = ''; chip.style.boxShadow = ''; }catch(_ePLift){}");
  const inner = wire.indexOf('if(drag){');
  ok(guard !== -1, 'a chip never keeps its drag lift');
  ok(guard !== -1 && inner !== -1 && guard < inner, 'and that happens whether or not the drag record survived');
  ok(count("body.classList.add('reordering')") >= 1, 'the drag still marks the body while it is really dragging');
}

console.log('[6] Settings is back in the order and the shape it had');
{
  const order = ['settingsTabPremium', 'settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',
    'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']
    .map((id) => src.indexOf('id="' + id + '"'));
  ok(order.every((i) => i !== -1), 'all nine tabs are present');
  ok(order.every((v, i) => i === 0 || order[i - 1] < v), 'and the strip runs Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More (More last)');
  const heads = ['This build and help', 'Playback', 'History and extras'].map((t) => src.indexOf('>' + t + '</div>'));
  ok(heads.every((i) => i === -1), 'the group headings 64.1 added inside More are gone');
  const card = src.indexOf('<!-- Diagonal / Single button toggle -->');
  ok(card !== -1, 'the Playlists/Albums button card is still there');
  ok(card > src.indexOf('id="howToUseBtn"'), 'back where it sat before, after Replay tutorial');
  ok(card < src.indexOf('<!-- Collapsible: Tutorial summary (text) -->'), 'and above the tutorial summary');
  ok(card < src.indexOf('<!-- Collapsible: Library Tools & Fetching -->'), 'not in the library group it was moved to');
  // The sheet is a column flex box: the pane absorbs the leftover height, so
  // the sheet itself can never scroll and the strip can never be squeezed.
  ok(has('  flex: 1 1 auto;\n  min-height: 0;\n  max-height: 62vh;'), 'the pane takes the leftover height and scrolls inside itself');
  ok(has('#themeBackdrop .modal > h3,\n#themeBackdrop .modal > #settingsTabStrip,\n#themeBackdrop .modal > .modal-btns{ flex: 0 0 auto; }'),
    'and the title, the tab strip and Close keep their own height');
  ok(has("      var _panes = $('settingsPanesWrap'); if(_panes) _panes.scrollTop = 0;"), 'every tab opens at its own top');
  ok(has("      if(_sheet) _sheet.scrollTop = 0;"), 'and the sheet is never left scrolled either');
  const scrollBlock = src.slice(src.indexOf('.settings-scroll {'), src.indexOf('.settings-scroll::-webkit-scrollbar'));
  ok(/scroll-behavior: auto;/.test(scrollBlock) && !/scroll-behavior: smooth;/.test(scrollBlock),
    'the pane still follows the wheel one to one');
}
console.log('[7] pinned-artist covers are newest first');
{
  ok(count('date: Number(t.dateAdded) || 0') === 1, 'a library cover carries the day it was added');
  ok(count("date: Date.parse(r.releaseDate || '') || 0") === 1, 'an album cover carries its release date');
  ok(count("date: Date.parse(sr.releaseDate || '') || 0") === 1, 'and so does a single');
  const m = src.match(/covers\.sort\(function\(a, b\)\{ (return [^;]+;) \}\);/);
  ok(!!m, 'the grid sorts the candidates');
  if (m) {
    let cmp = null;
    try { cmp = new Function('a', 'b', m[1]); } catch (e) { ok(false, 'the comparator evaluates: ' + e.message); }
    if (cmp) {
      const sorted = [{ date: 1 }, { date: 5 }, { date: 3 }].sort(cmp).map((c) => c.date);
      ok(sorted.join(',') === '5,3,1', 'newest first, run for real (' + sorted.join(',') + ')');
      const withUnknown = [{ date: 5 }, {}, { date: 9 }].sort(cmp).map((c) => c.date || 0);
      ok(withUnknown[0] === 9 && withUnknown[2] === 0, 'and anything undated sorts last (' + withUnknown.join(',') + ')');
    }
  }
  ok(src.indexOf('covers.sort(') < src.indexOf("        var coverGrid = '';"), 'the order is fixed before the grid is drawn');
}

console.log('[8] the file still holds together');
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
