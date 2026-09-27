#!/usr/bin/env node
// SideCut - 64.2.1: the Home bubble that comes back blank.
//
// One thing was reported about the build 64.2 shipped:
//
//   "Whenever I scroll down in Home the Favorites bubble / last bubble to the
//    right is there, but I scroll up and down 2 more times and that bubble just
//    disappears."
//
//    The two screenshots show the same grid, the same row, the same scroll
//    position - one with the Notifications card alone on its row and an empty
//    cell beside it, one with 11 / Favorites drawn there. Nothing in the app
//    removes a bubble, and no scroll handler touches Home's grid, so this is the
//    rendering-side fault this app has already met twice: the WebView drops the
//    painting of content inside a scroller and keeps the space it occupied. It
//    was reported first as the library list, then as the pinned-artists row, and
//    the answer that worked there is applied here:
//
//      - `#homeView` is given its own stacking context (position:relative +
//        z-index:20). Home was the LAST scrolling page without one - `#listPane`
//        carries the note explaining why it has one, and `#discoverView` was
//        given the same at 64.2.
//      - a settled scroll of Home REPAINTS the grid: a bubble still holding the
//        inline position/box a drag gives it is put back as a plain bubble (a
//        carried bubble is drawn on its own layer, which is the shape a phone
//        discards on a long scroll), any dashed placeholder an abandoned drag
//        left behind is removed, and the grid's painted pixels are thrown away
//        and painted again - the same hide/restore the rail got.
//      - a grid that really is missing a bubble the Home layout asks for is
//        drawn from the layout again instead of waiting for the next update.
//
//   node dev/patch-66421.mjs
//   node dev/patch-66421.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose and new JS literals that need a glyph get the real
// character, built here so this script stays ASCII (see AGENTS.md, "Non-ASCII
// needle trap").
const cp = (n) => String.fromCodePoint(n);
const DOT = cp(0x00b7);     // the middle dot the ship stamps use

const VER = '64.2.1';
const OLD_VER = '64.2';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 ' + DOT + ' 6:20 PM EDT';
const OLD_STAMP = 'September 27, 2026 ' + DOT + ' 4:05 PM EDT';
const SW_CACHE = '63.0.19';
const OLD_SW_CACHE = '63.0.18';

// Plain statements of the changes, the way 64.2's entries are written.
const TITLE = 'The Favorites bubble stops coming back blank on Home when you scroll';

// Six notes, and they publish on BOTH channels (no [FULL] marker anywhere), so
// they carry no tooling wording at all: dev/test-617..620, -60510 and -662 read
// the WHOLE head entry for a downloader term, and dev/test-play-copy reads the
// Play copy against a wider list than the shared filter knows. The fifth note
// keeps the word "rollback": test-662 asserts the head entry describes what the
// release did with /rollback/i.
const NOTES = [
  'The Favorites bubble stops coming back blank on Home. Scrolling Home up and down could leave the last bubble - the bottom-right one - sitting as an empty cell with its card, its heart and its count simply not drawn, until something else happened to redraw it. The bubble grid repaints itself once a scroll settles now, so it cannot stay blank on screen.',
  'A bubble can no longer stay in the state a drag leaves it in. While a bubble is being carried it is lifted out of the grid and drawn on its own, and a layer like that is exactly what a phone drops on a long scroll. A scroll that settles now puts a leftover carry back into the grid as a plain bubble, clears out any dashed placeholder a drag abandoned, and throws the grid painted pixels away so they are drawn fresh. Nothing is rebuilt, so no cover, count or order is touched.',
  'Home is given its own drawing layer, the way the library list and Discover already have one. Each of those pages was reported once with a card coming back blank and each was given the same guard; Home was the last scrolling page without it, so the animated theme behind the app can no longer come between Home and what is drawn on it.',
  'The grid also checks itself. If a settled scroll finds a bubble that the Home layout asks for missing from the page, the grid draws itself again from that layout instead of waiting for the next update to notice.',
  'This is 64.2.1 rather than a second 64.2: a phone already running 64.2 is offered it and installs it, which a rebuild carrying the same version number would never be. The songs, playlists, settings, pinned artists and the rollback copies in Storage are all exactly as they were - nothing about this update touches them.',
  'Why this keeps happening, said plainly: the app was never removing anything. The library list, the pinned-artists row and now a Home bubble all came back blank because the page asks the phone to paint scrolling content in a way the Android WebView mishandles, and the space stays while the pixels go. Each of those three surfaces carries the same guard now, so it is one pattern to watch instead of three separate mysteries.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66421 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the Home view gets the stacking context the other scrollers have
// ═══════════════════════════════════════════════════════════════════════════
// Home is plain static flow content with no stacking of its own, so anything the
// app positions resolves above it. #listPane carries the original note for this,
// #discoverView got the same treatment at 64.2, and Home was the last scrolling
// page left out.
sub('Home gets its own stacking context',
  '#homeView{ display:none; flex:1; flex-direction:column; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; padding:14px 16px 170px; }',
  '/* Needs its own stacking context, for the same reason #listPane and\n' +
  '   #discoverView have one: this container is plain static flow content with no\n' +
  '   z-index of its own, so the theme background and every positioned layer the\n' +
  '   app draws resolve without reference to it. Home was the last scrolling page\n' +
  '   left out, and the last one to be reported with a bubble coming back blank\n' +
  '   mid-scroll - the space it occupied still taken, its card and text gone. */\n' +
  '#homeView{ display:none; flex:1; flex-direction:column; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }');

// ═══════════════════════════════════════════════════════════════════════════
// 2 - a settled scroll of Home repaints the grid
// ═══════════════════════════════════════════════════════════════════════════
const WATCH = [
  '  // ---- Home grid: drawn again after a scroll settles -------------------------',
  '  // The Favorites bubble has been reported coming back blank: scroll Home up and',
  '  // down and the last bubble - the bottom-right one - is left as an empty cell,',
  '  // its card, its heart and its count not painted. Nothing in the app removes a',
  '  // bubble, and no scroll handler touches this grid, so this is the same',
  '  // rendering-side fault that was reported on the library list and on the',
  '  // pinned-artists row: the WebView drops the painting of content inside a',
  '  // scroller and keeps the space it occupied. Home gets the same three parts the',
  '  // rail got, because those are the ones that worked there:',
  '  //',
  '  //   - a bubble still holding what a drag gives it (the hb-dragging class and',
  '  //     the inline box that lifts it out of the grid) is put back as a plain',
  '  //     bubble. A carried bubble is drawn on a layer of its own, and that is the',
  '  //     shape a phone discards on a long scroll;',
  '  //   - the grid painted pixels are thrown away and painted again, which costs',
  '  //     one frame and cannot be seen;',
  '  //   - and a grid that really is missing a bubble the layout asks for is drawn',
  '  //     from the layout again instead of waiting for the next update to notice.',
  '  function repaintHomeGrid(){',
  "    var wrap = $('homeBubbles');",
  '    if(!wrap) return;',
  '    try{',
  "      var phs = wrap.querySelectorAll('.hb-drag-placeholder');",
  '      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode) phs[i].parentNode.removeChild(phs[i]); }',
  "      var bs = wrap.querySelectorAll('.home-bubble');",
  '      for(var j = 0; j < bs.length; j++){',
  '        var b = bs[j];',
  "        if(!b.classList.contains('hb-dragging') && !b.style.position) continue;",
  "        b.classList.remove('hb-dragging');",
  "        b.style.position = ''; b.style.left = ''; b.style.top = '';",
  "        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';",
  '      }',
  '    }catch(_eCarry){}',
  "    wrap.style.visibility = 'hidden';",
  '    void wrap.offsetHeight;',
  "    requestAnimationFrame(function(){ try{ wrap.style.visibility = ''; }catch(_eRpH){ } });",
  '  }',
  '  // Is every bubble the Home layout asks for actually on the page? Built through',
  '  // the same rules renderHome() uses, so a custom action that no longer exists is',
  '  // not counted as a missing bubble.',
  '  function homeGridIsWhole(){',
  "    var wrap = $('homeBubbles');",
  "    if(!wrap || wrap.classList.contains('reorder-mode')) return true;",
  '    try{',
  '      var want = normalizeHomeOrder(homeOrder).filter(function(k){ return homeHidden.indexOf(k) === -1; });',
  '      var count = 0;',
  '      for(var i = 0; i < want.length; i++){',
  '        var k = want[i];',
  "        if(k.indexOf('custom-') === 0){",
  '          var found = false;',
  "          for(var c = 0; c < customQuickActions.length; c++){ if('custom-' + customQuickActions[c].id === k) found = true; }",
  '          if(!found) continue;',
  '        } else if(HOME_BUBBLE_KINDS.indexOf(k) === -1){',
  '          continue;',
  '        }',
  '        count++;',
  "        if(!wrap.querySelector('[data-bubble=\"' + k + '\"]')) return false;",
  '      }',
  "      return wrap.querySelectorAll('.home-bubble').length === count;",
  '    }catch(_eGridChk){ return true; }',
  '  }',
  '  (function watchHomePaint(){',
  "    var v = $('homeView');",
  '    if(!v || v._hbPaintWatch) return;',
  '    v._hbPaintWatch = true;',
  '    var t = null;',
  "    v.addEventListener('scroll', function(){",
  '      if(t) clearTimeout(t);',
  '      t = setTimeout(function(){',
  '        t = null;',
  '        try{',
  '          if(hbDrag) return; // a drag in progress owns the grid',
  '          repaintHomeGrid();',
  '          if(!homeGridIsWhole()) renderHome();',
  '        }catch(_eHomeWatch){}',
  '      }, 140);',
  '    }, { passive: true });',
  '  })();',
  '',
].join('\n');
sub('a settled scroll repaints the grid',
  '  // ---- Reorder Home bubbles ----',
  WATCH + '  // ---- Reorder Home bubbles ----');

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the release itself
// ═══════════════════════════════════════════════════════════════════════════
function headEntry() {
  const newMark = "  { version: '" + VER + "',";
  if (src.indexOf(newMark) !== -1) return skip('CHANGELOG head entry');
  const items = NOTES.map((n) => "    '" + n + "',").join('\n');
  const block = "  { version: '" + VER + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
    items + '\n  ] },\n';
  const headMark = 'const CHANGELOG = [\n';
  if (src.indexOf(headMark) === -1) throw new Error('CHANGELOG opener not found');
  src = src.replace(headMark, headMark + block);
  done('CHANGELOG head entry (' + VER + ')');
}

sub('APP_VERSION',
  "  const APP_VERSION = '" + OLD_VER + "';",
  "  const APP_VERSION = '" + VER + "';",
  1, "const APP_VERSION = '" + VER + "';");

headEntry();
fs.writeFileSync(FILE, src);

const SW = path.join(ROOT, 'sw.js');
const swTxt = fs.readFileSync(SW, 'utf8');
const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
if (swTxt.includes(newSw)) {
  console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
} else {
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
  const n = swTxt.split(oldSw).length - 1;
  if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
  fs.writeFileSync(SW, swTxt.split(oldSw).join(newSw));
  console.log('+ sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
}

// Version pins across the suite. test-655 and test-656 read the 63.1.3 entry by
// its own version and test-658 reads its own, so they are untouched here - as is
// dev/test-663.mjs, which reads the v64 entry by version.
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["VER = '" + OLD_VER + "'", "VER = '" + VER + "'"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
  ["String(head.version) === '" + OLD_VER + "'", "String(head.version) === '" + VER + "'"],
  ["the head entry is v" + OLD_VER + "'", "the head entry is v" + VER + "'"],
  ["'" + OLD_VER + " heads the changelog'", "'" + VER + " heads the changelog'"],
  ["'" + OLD_VER + " entry heads", "'" + VER + " entry heads"],
  ["the " + OLD_VER + " notes", "the " + VER + " notes"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);

let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}

function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to repin)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}

// dev/test-6642.mjs is 64.2's gate, and its release-metadata block reads the
// HEAD entry - which is this release's now. It reads the v64.2 entry by version
// instead, so its six-note and wording claims stay about the release they
// describe (exactly what was done for dev/test-663.mjs at 64.1 and for
// dev/test-6641.mjs at 64.2). The replacement introduces no literal the bump
// above rewrites.
fileSub('dev/test-6642.mjs', [
  ["  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');\n" +
   '  if (entries) {\n' +
   '    const head = entries[0];',
   '  // The head entry belongs to whatever shipped last, so read the 64.2 entry by\n' +
   '  // version: this gate describes 64.2.\n' +
   '  const entry642 = entries ? entries.find((x) => /^64\\.2$/.test(String(x.version))) : null;\n' +
   "  ok(!!entry642 && String(entry642.version) === '64.2', 'the 64.2 entry this gate describes is still here');\n" +
   '  if (entry642) {\n' +
   '    const head = entry642;'],
]);

console.log('patch-66421: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);

// 1 - the stacking context
must(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }'),
  'Home has its own stacking context');
must(has('/* Needs its own stacking context, for the same reason #listPane and'), 'and says why, the way the other two do');
must(count("position:relative; z-index:20") >= 3, 'the library list, Discover and Home all carry one');

// 2 - the paint guard
must(has('  function repaintHomeGrid(){'), 'a settled scroll repaints the grid');
must(has("    wrap.style.visibility = 'hidden';"), 'by throwing its painted pixels away');
must(has("    void wrap.offsetHeight;"), 'flushing the layout before they come back');
must(has("    requestAnimationFrame(function(){ try{ wrap.style.visibility = ''; }catch(_eRpH){ } });"), 'and painting them again on the next frame');
must(has("      var phs = wrap.querySelectorAll('.hb-drag-placeholder');"), 'a placeholder an abandoned drag left behind is cleared out');
must(has("        if(!b.classList.contains('hb-dragging') && !b.style.position) continue;"), 'a bubble still carrying a drag lift is put back to a plain bubble');
must(has("        b.style.position = ''; b.style.left = ''; b.style.top = '';"), 'including the box that lifted it out of the grid');
must(has('  function homeGridIsWhole(){'), 'the grid knows what it should contain');
must(has("        if(!wrap.querySelector('[data-bubble=\"' + k + '\"]')) return false;"), 'and reports a bubble that is missing');
must(has("      return wrap.querySelectorAll('.home-bubble').length === count;"), 'or a grid that is short one');
must(has('          if(hbDrag) return; // a drag in progress owns the grid'), 'a live drag is left alone');
must(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'), 'and a grid that really lost a bubble is drawn again');
must(has('!v || v._hbPaintWatch'), 'the watcher is wired once, not once per render');
must(has("      }, 140);"), 'after the 140ms the rail uses');
const watchOn = final.indexOf('(function watchHomePaint(){');
must(watchOn !== -1 && watchOn < final.indexOf('  // ---- Reorder Home bubbles ----'), 'and it sits with the rest of Home');

// 3 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
if (block) {
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
  if (entries) {
    const head = entries[0];
    must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
    must(head.date === STAMP, 'stamped ' + STAMP + ' (' + head.date + ')');
    must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
    const notes = (head.items || []).join('\n');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
    must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
    must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor carry a term the wider store list knows');
    must(/rollback/i.test(notes), 'while still saying what the release did');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    must(/favorites/i.test(notes), 'and names what was reported');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(SW, 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

if (problems.length) {
  console.error('\npatch-66421: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66421: all verification checks passed (' + edits + ' edit(s))');
