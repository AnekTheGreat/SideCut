#!/usr/bin/env node
// SideCut - 64.2: the follow-up to 64.1.
//
// Five things were reported about the build 64.1 shipped. In order:
//
//   1. "What the hell are these names, the polish pass, QOL pass - no, change
//      those, just state the changes." Both entries that carried an invented
//      name above the changes (v64.1's and v64's) state them instead.
//
//   2. "The glitch where the pinned artist island disappears when you scroll
//      down in Discover is still there." The 64.1 answer was too narrow: it
//      only redrew the rail when the artists were missing from it, and the
//      screenshots show the card STANDING there with nothing drawn in it, so
//      that condition was never met. Three things now:
//        - `#discoverView` is given its own stacking context (position:relative
//          + z-index:20). It is plain static flow content today, and the fixed
//          glow/edge layers are positioned with z-index:1 - so they paint OVER
//          it. That is the same fault the v63 fix found and fixed on
//          `#listPane`, which carries the note explaining it.
//        - a settled scroll of Discover now REPAINTS the card outright (hidden
//          and shown again), whether or not its artists are there, and drops
//          the drag lift from any chip still holding one without rebuilding
//          the rail (which would re-decode every cover).
//        - the rail's own horizontal scroller no longer carries
//          -webkit-overflow-scrolling:touch.
//
//   3. "Why did you reorder the settings tabs - More should be at the end and
//      Support and Donate should be where they were." The strip goes back to
//      Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More.
//
//   4. "The More tab has a weird glitch where it goes up and you can barely see
//      the other tabs, and once you go into the More tab its upness affects
//      every other tab." All nine panes share ONE scroll box, and the sheet
//      around it scrolls too: the offset a previous tab left behind was still
//      there when the next one opened, so a tab came up half-way down with the
//      strip clipped under the title - and the same offset then followed the
//      user into every other tab. The sheet is laid out so only the pane
//      scrolls (title, tab strip and Close keep their height; the pane takes
//      the leftover and has min-height:0), and `showSettingsTab()` resets both
//      the pane's and the sheet's scroll position on every tab change.
//
//   5. "Why are the options in Settings and More so square - they should be how
//      they were before and how every other tab is." The four group headings
//      64.1 added inside the More pane and the card it moved into the Playback
//      group are gone: the pane is the card list it was, and with the pane no
//      longer opening mid-scroll the first card is not cut off square at the
//      top edge either.
//
//   6. APP_VERSION 64.1 -> 64.2 (an OTA to the same version is never taken
//      over, so the follow-up has to be the next release), a new head CHANGELOG
//      entry with six shared notes, and sw.js's decoupled cache name
//      63.0.17 -> 63.0.18.
//
//   node dev/patch-6642.mjs
//   node dev/patch-6642.mjs --manifest    # re-seed root manifest.json from ota/
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
const MD = cp(0x2014);      // em dash
const DOT = cp(0x00b7);     // the middle dot the ship stamps use

const VER = '64.2';
const OLD_VER = '64.1';
const OLD_STAMP = 'September 27, 2026 ' + DOT + ' 2:15 PM EDT';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 ' + DOT + ' 4:05 PM EDT';
const SW_CACHE = '63.0.18';
const OLD_SW_CACHE = '63.0.17';

// Plain statements of the changes, which is the whole of item 1: the two
// entries that carried an invented name now say what happened instead.
const TITLE = 'The More tab stops jumping, the pinned-artists row stops going blank, and the Settings tabs are back where they were';
const OLD_TITLE_641 = 'The polish pass: crop by ear, a hello the assistant knows, and Settings that groups itself';
const NEW_TITLE_641 = 'Crop by ear, a hello the assistant answers, five animated themes free, Settings grouped, and cover picks newest first';
const OLD_TITLE_64 = 'The QOL pass: covers stop repeating, the assistant stops leaving you with an error, and your rollback history is yours again';
const NEW_TITLE_64 = 'Cover picks stop repeating, the assistant answers instead of erroring, the pinned bar is rounded, and rollback history is kept';
// The one old entry that named itself the same way, so no entry in the log
// carries an invented name any more. Its own two notes are what it says now.
const OLD_TITLE_334 = 'Small UI polish pass';
const NEW_TITLE_334 = 'Track rows and the play button get clearer press feedback';

// Six notes, and they publish on BOTH channels (no [FULL] marker anywhere), so
// they carry no tooling wording at all: dev/test-617..620, -60510 and -662 read
// the WHOLE head entry for a downloader term, and dev/test-play-copy reads the
// Play copy against a wider list than the shared filter knows. The fifth note
// keeps the word "rollback": test-662 asserts the head entry describes what the
// release did with /rollback/i.
const NOTES = [
  'These notes say what changed now. Entries used to carry an invented name above the changes - "the polish pass", "the QOL pass", "small UI polish pass" - which described nothing about the update; the three that did state the changes instead.',
  'The pinned artists row on Discover stops coming back blank. Scrolling Discover could leave the card standing there with nothing drawn inside it - its artists missing, the space still taken - until something else happened to redraw it. A scroll that settles now repaints the card itself, so it and its artists stay on screen.',
  'A chip cannot leave the row hollow either. The lift a chip is given while it is being dragged is dropped as soon as a scroll settles, whether or not that drag ever finished, and the row keeps a minimum height and always starts at its left edge - the three ways it was reported empty before.',
  'Opening More no longer drags the sheet up with it. All of Settings shares one scrolling pane, so the scroll position the previous tab left behind was still in place: the tab strip came up half off the top, the first card looked cut off, and that same offset followed you into every other tab. Each tab opens at its own top now, and the sheet is laid out so the title, the tab strip and Close keep their height while only the pane scrolls.',
  'The Settings tabs are back in the order they had: Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, and More at the end. The headings added inside More are gone with them, so its cards are the ones that were there before - the same shape as every other tab, with the storage panel and the rollback copies under it where they were.',
  'This is a fix release, so it is 64.2 rather than a second 64.1: a phone already running 64.1 is offered it and installs it, which a rebuild carrying the same version number would never be.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-6642 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
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

// Insert `text` immediately before an anchor.
function before(label, anchor, text) {
  sub(label, anchor, text + anchor);
}

// Lift the slice between two anchors out of the file and hand it back.
function cutBlock(label, from, to) {
  const at = src.indexOf(from);
  if (at === -1) throw new Error(label + ': start anchor not found');
  const end = src.indexOf(to, at);
  if (end === -1) throw new Error(label + ': end anchor not found');
  const block = src.slice(at, end);
  src = src.slice(0, at) + src.slice(end);
  console.log('+ ' + label + ' (lifted, ' + block.length + ' chars)');
  edits++;
  return block;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the settings tabs go back to the order they had
// ═══════════════════════════════════════════════════════════════════════════
// Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More. More
// is last again and Support and Donate are back where they were; 64.1 had moved
// More to seventh and pushed Support and Donate to the end.
const TAB = (id, label, minw) =>
  '      <button class="tab" id="' + id + '" style="min-width:' + minw + 'px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">' + label + '</button>';
const TAB_ORDER_641 = [
  TAB('settingsTabPremium', 'Premium', 100),
  TAB('settingsTabExpand', 'Get Songs', 110),
  TAB('settingsTabTheme', 'Theme', 100),
  TAB('settingsTabGlow', 'Glow', 100),
  TAB('settingsTabSandbox', 'Sandbox', 100),
  TAB('settingsTabWidget', 'Widget', 100),
  TAB('settingsTabMore', 'More', 100),
  TAB('settingsTabSupport', 'Support', 100),
  TAB('settingsTabDonate', 'Donate', 100),
];
const TAB_ORDER = [
  TAB('settingsTabPremium', 'Premium', 100),
  TAB('settingsTabExpand', 'Get Songs', 110),
  TAB('settingsTabTheme', 'Theme', 100),
  TAB('settingsTabDonate', 'Donate', 100),
  TAB('settingsTabGlow', 'Glow', 100),
  TAB('settingsTabSandbox', 'Sandbox', 100),
  TAB('settingsTabSupport', 'Support', 100),
  TAB('settingsTabWidget', 'Widget', 100),
  TAB('settingsTabMore', 'More', 100),
];
sub('the settings tabs are back in their old order',
  TAB_ORDER_641.join('\n'),
  TAB_ORDER.join('\n'));

// ═══════════════════════════════════════════════════════════════════════════
// 5 - the More pane is the card list it was
// ═══════════════════════════════════════════════════════════════════════════
const HEAD_DIV = (t) =>
  '      <div style="font-size:10.5px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase; color:var(--ink-dim); margin:18px 2px 8px;">' + t + '</div>\n';
for (const h of ['This build and help', 'Playback', 'Library, storage and rollback', 'History and extras']) {
  const line = HEAD_DIV(h);
  // Deleting text cannot use the usual "is the replacement already there"
  // marker, so the guard is explicit: a heading that is already gone is done.
  if (src.indexOf(line) === -1) { skip('the "' + h + '" heading'); continue; }
  sub('the "' + h + '" heading is gone', line, '', 1, '');
}

// The card 64.1 moved into the Playback group goes back to its own place, above
// the tutorial summary it sat beside before.
(function movePlaybackCard() {
  const from = '      <!-- Diagonal / Single button toggle -->';
  const home = '      <!-- Collapsible: Tutorial summary (text) -->';
  const cardAt = src.indexOf(from);
  const homeAt = src.indexOf(home);
  if (cardAt === -1 || homeAt === -1) throw new Error('the playback-preference card or its old home is missing');
  if (cardAt < homeAt) return skip('the playback-preference card');
  const block = cutBlock('the playback-preference card',
    from,
    '      <!-- Collapsible: Library Tools & Fetching -->');
  before('it sits where it did before 64.1', home, block);
})();

// ═══════════════════════════════════════════════════════════════════════════
// 4 - only the pane scrolls, and every tab opens at its own top
// ═══════════════════════════════════════════════════════════════════════════
// The sheet is already `display:flex; flex-direction:column` with
// `max-height:82vh; overflow-y:auto`. Making the pane the item that absorbs the
// leftover height is what stops the SHEET from ever scrolling - and a scrolled
// sheet is what lifted the tab strip out of sight on the More tab and carried
// that offset into every tab opened after it.
const PANE_COMMENT = '  /* The sheet around this pane is a column flex box, so the pane takes the\n' +
  '     height left over once the title, the tab strip and Close have theirs, and\n' +
  '     scrolls inside itself. That is what stops the SHEET from scrolling at all:\n' +
  '     a scrolled sheet carried the tab strip off the top of the More tab and left\n' +
  '     every tab opened after it starting half-way down. min-height:0 is what lets\n' +
  '     a flex item this tall actually shrink to the room it is given.\n' +
  '     A maximum height, not a fixed one, so a short tab has no scrollbar at all.\n' +
  '     scroll-behavior MUST stay auto: with smooth, a wheel kept working on the\n' +
  '     animating the pane after the wheel had stopped, which is exactly what\n' +
  '     "the scroll wheel is being weird" looks like. overscroll-behavior keeps the\n' +
  '     pane from dragging the page behind the sheet along with it. */\n';

// The pane's own block, as 64.1 left it and as it reads now. Three shapes are
// possible: the released one (nothing done yet), this one (done), and the shape
// one of this release's drafts left behind - the 64.1 comment above the new one
// and a second copy of the lift. All three end in the same place.
const PANE_PLAIN = '  max-height: 62vh;\n' +
  '  overflow-y: auto;\n' +
  '  -webkit-overflow-scrolling: touch;\n' +
  '  overscroll-behavior: contain;\n' +
  '  scroll-behavior: auto;\n' +
  '  scrollbar-gutter: stable;\n' +
  '  padding-right: 10px;';
const PANE_LIFT = '  flex: 1 1 auto;\n  min-height: 0;\n';
const PANE_NEW = PANE_COMMENT + PANE_LIFT + PANE_PLAIN;
const PANE_DRAFT = '  /* A maximum height, not a fixed one: a short tab then has no scrollbar at\n' +
  '     all, and the wheel over it reaches the sheet instead of doing nothing.\n' +
  '     scroll-behavior MUST stay auto: with smooth, a wheel kept working on the\n' +
  '     animating the pane after the wheel had stopped, which is exactly what\n' +
  '     "the scroll wheel is being weird" looks like. overscroll-behavior keeps\n' +
  '     the pane from dragging the page behind the sheet along with it. */\n' +
  '  /* The sheet around this pane is a column flex box, so the pane takes the\n' +
  '     height left over once the title, the tab strip and Close have theirs, and\n' +
  '     scrolls inside itself. That is what stops the SHEET from scrolling at all:\n' +
  '     a scrolled sheet carried the tab strip off the top of the More tab and\n' +
  '     left every tab opened after it starting half-way down. min-height:0 is\n' +
  '     what lets a flex item this tall actually shrink to the room it is given. */\n' +
  PANE_LIFT;
// The draft junk is above the block it belongs to, so it goes first: a tree
// carrying it already has PANE_NEW underneath, and this leaves exactly one
// comment and one lift there.
if (src.indexOf(PANE_DRAFT) !== -1) {
  sub('the draft block above it is cleaned up', PANE_DRAFT, '', 1, '');
}
if (src.indexOf(PANE_NEW) !== -1) {
  skip('the settings pane block');
} else {
  sub('the pane takes the leftover height and scrolls inside itself', PANE_PLAIN, PANE_NEW);
}

before('the title, the strip and Close keep their own height',
  '/* Settings tab buttons polish */',
  '/* The title, the tab strip and the Close row keep their own height. Flex\n' +
  '   items shrink by default, and a tab strip squeezed to part of its height is\n' +
  '   exactly what "you can barely see the other tabs" was. */\n' +
  '#themeBackdrop .modal > h3,\n' +
  '#themeBackdrop .modal > #settingsTabStrip,\n' +
  '#themeBackdrop .modal > .modal-btns{ flex: 0 0 auto; }\n\n');

// Every tab opens at its own top.
sub('every settings tab opens at its own top',
  "    if(tab === 'refresh' || tab === 'playback' || tab === 'eq') tab = 'more';\n",
  "    if(tab === 'refresh' || tab === 'playback' || tab === 'eq') tab = 'more';\n" +
  "    // Every tab opens at its own top. All nine panes share one scrolling box,\n" +
  "    // so the scroll the previous tab left behind was still in place when the\n" +
  "    // next one opened - the strip came up half off the top and the first card\n" +
  "    // looked cut off, and the same offset then followed the user into every\n" +
  "    // other tab. The sheet itself is reset too: nothing should be able to\n" +
  "    // scroll it, but a WebView that decides otherwise must not carry that\n" +
  "    // offset over either.\n" +
  "    try{\n" +
  "      var _panes = $('settingsPanesWrap'); if(_panes) _panes.scrollTop = 0;\n" +
  "      var _tbd = $('themeBackdrop');\n" +
  "      var _sheet = _tbd ? _tbd.querySelector('.modal') : null;\n" +
  "      if(_sheet) _sheet.scrollTop = 0;\n" +
  "    }catch(_eSsc){}\n");

// ═══════════════════════════════════════════════════════════════════════════
// 2 - the pinned-artist row on Discover
// ═══════════════════════════════════════════════════════════════════════════
// The Discover view is plain static flow content with no stacking of its own,
// and the theme's fixed glow/edge layers are positioned with z-index:1 - so they
// paint above it. That is the same fault the v63 fix found on #listPane, and it
// is why that container carries the note explaining it.
sub('Discover gets its own stacking context',
  '#discoverView{ display:none; flex:1; flex-direction:column; padding:14px 20px 170px; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; }',
  '/* Needs its own stacking context, for the same reason #listPane has one: this\n' +
  '   container is plain static flow content with no z-index, so the fixed glow\n' +
  '   and edge layers (position:fixed, z-index:1, pointer-events:none) paint OVER\n' +
  '   it. They are translucent washes of colour, which is how the pinned-artists\n' +
  '   card came back looking like bare page background with its border gone while\n' +
  '   the photographic covers on it still showed through. */\n' +
  '#discoverView{ display:none; flex:1; flex-direction:column; padding:14px 20px 170px; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; }');

// The card carries the same lift in the stylesheet rather than in its markup: the
// inline style is pinned (look, corners and all) by dev/test-662.mjs, and a rule
// here says the same thing without editing it.
before('the rail card is lifted out of that wash too',
  '#discoverSearchRow{ display:flex; gap:8px; padding:6px 0 12px; }',
  '/* The rail card is the one thing in Discover that is transparent to the theme\n' +
  '   behind it (every other card here uses rgba white), so it is what a glow wash\n' +
  '   over the view shows up as. It gets the same lift as its view. */\n' +
  '#pinnedArtistsStrip{ position:relative; z-index:1; }\n');

// A tree patched with this release's first draft had the lift inline instead.
// Put the markup back the way test-662 pins it: the marker is the plain style,
// so a rerun - or a fresh tree - skips this.
sub('the rail card keeps the markup it had',
  '<div id="pinnedArtistsStrip" style="position:relative;z-index:1;background:var(--bg-raised);margin:0 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;">',
  '<div id="pinnedArtistsStrip" style="background:var(--bg-raised);margin:0 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;">',
  1, '<div id="pinnedArtistsStrip" style="background:var(--bg-raised);margin:0 0 14px;');

// The rail's own horizontal scroller: -webkit-overflow-scrolling is a legacy
// property this WebView ignores, and a nested scroller is the shape of the
// rendering faults this card has produced. The chip order is pinned (nowrap) so
// nothing about the row depends on it either way.
sub('the rail scroller drops the legacy property',
  'display:flex;align-items:flex-start;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;min-height:64px;padding:0 2px 4px;',
  'display:flex;align-items:flex-start;gap:12px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;min-height:64px;padding:0 2px 4px;');

sub('a settled scroll repaints the card, not only an empty one',
  '  // The pinned-artist rail has been reported as vanishing twice now, both times\n' +
  '  // after scrolling Discover, and nothing in the app removes it. The damage is on\n' +
  '  // the rendering side: a chip that kept the inline transform/z-index/box-shadow\n' +
  '  // it was given when a drag started is its own composited layer, and a layer\n' +
  '  // like that is what a WebView discards on a long scroll. Re-rendering the rail\n' +
  '  // rebuilds plain, unstyled chips, so this heals it as soon as it is noticed:\n' +
  '  // once a scroll of Discover settles, a rail with artists in it that has no\n' +
  '  // chips (or no height) is drawn again.\n' +
  '  (function watchPinnedRail(){\n' +
  '    var dv = $(\'discoverView\');\n' +
  '    if(!dv || dv._paRailWatch) return;\n' +
  '    dv._paRailWatch = true;\n' +
  '    var t = null;\n' +
  '    dv.addEventListener(\'scroll\', function(){\n' +
  '      if(t) clearTimeout(t);\n' +
  '      t = setTimeout(function(){\n' +
  '        t = null;\n' +
  '        try{\n' +
  '          if(!pinnedArtists.length) return;\n' +
  '          var l = $(\'pinnedArtistsList\');\n' +
  '          if(!l) return;\n' +
  '          if(l.querySelector(\'.pinned-artist-chip\') && l.getBoundingClientRect().height) return;\n' +
  '          renderPinnedArtists();\n' +
  '        }catch(_eRailWatch){}\n' +
  '      }, 140);\n' +
  '    }, { passive: true });\n' +
  '  })();',
  '  // The pinned-artist rail has been reported as vanishing three times now, and\n' +
  '  // nothing in the app removes it. The damage is on the rendering side. The\n' +
  '  // 64.1 answer only redrew a rail that had lost its chips, and the screenshots\n' +
  '  // show the card still standing in the layout with nothing drawn inside it, so\n' +
  '  // that condition was never met. This one repaints the card outright:\n' +
  '  //\n' +
  '  //   - any chip still holding the inline transform/z-index/box-shadow a drag\n' +
  '  //     gave it is put back to a plain chip. That lift is what makes a chip its\n' +
  '  //     own composited layer, and a layer like that is what a WebView discards\n' +
  '  //     on a long scroll. The styles are dropped in place rather than by\n' +
  '  //     re-rendering, so no cover is decoded again;\n' +
  '  //   - the card itself is hidden and shown again, which throws its painted\n' +
  '  //     pixels away and paints them fresh, whether or not its artists are there.\n' +
  '  //\n' +
  '  // A rail that really has lost its chips is still drawn again from scratch.\n' +
  '  function repaintPinnedRail(list){\n' +
  '    try{\n' +
  '      var chips = list.querySelectorAll(\'.pinned-artist-chip\');\n' +
  '      for(var i = 0; i < chips.length; i++){\n' +
  '        var c = chips[i];\n' +
  '        if(c.style.transform){ c.style.transform = \'\'; c.style.zIndex = \'\'; c.style.boxShadow = \'\'; }\n' +
  '      }\n' +
  '    }catch(_eLift){}\n' +
  '    var strip = $(\'pinnedArtistsStrip\');\n' +
  '    if(!strip) return;\n' +
  '    strip.style.visibility = \'hidden\';\n' +
  '    void strip.offsetHeight;\n' +
  '    requestAnimationFrame(function(){ try{ strip.style.visibility = \'\'; }catch(_eRpr){} });\n' +
  '  }\n' +
  '  (function watchPinnedRail(){\n' +
  '    var dv = $(\'discoverView\');\n' +
  '    if(!dv || dv._paRailWatch) return;\n' +
  '    dv._paRailWatch = true;\n' +
  '    var t = null;\n' +
  '    dv.addEventListener(\'scroll\', function(){\n' +
  '      if(t) clearTimeout(t);\n' +
  '      t = setTimeout(function(){\n' +
  '        t = null;\n' +
  '        try{\n' +
  '          if(!pinnedArtists.length) return;\n' +
  '          var l = $(\'pinnedArtistsList\');\n' +
  '          if(!l) return;\n' +
  '          repaintPinnedRail(l);\n' +
  '          if(l.querySelector(\'.pinned-artist-chip\') && l.getBoundingClientRect().height) return;\n' +
  '          renderPinnedArtists();\n' +
  '        }catch(_eRailWatch){}\n' +
  '      }, 140);\n' +
  '    }, { passive: true });\n' +
  '  })();');

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the two invented entry names
// ═══════════════════════════════════════════════════════════════════════════
sub('the 64.1 entry states its changes', OLD_TITLE_641, NEW_TITLE_641);
sub('and so does the 64 entry', OLD_TITLE_64, NEW_TITLE_64);
sub('and the one older entry that named itself a pass too', OLD_TITLE_334, NEW_TITLE_334);
// The head entry's first note names those entries; it is written corrected in
// NOTES, so this only has to mend a tree that was patched with the first draft.
sub('the note names the entries it is talking about',
  'These notes say what changed now. The two entries above this one used to carry an invented name - "the polish pass", "the QOL pass" - which described nothing about the update; both state the changes instead.',
  NOTES[0]);

// ═══════════════════════════════════════════════════════════════════════════
// 6 - the release itself
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
// its own version (repinned by dev/patch-659.mjs) and test-658 reads its own,
// so they are untouched here - as is dev/test-663.mjs, which reads the v64 entry
// by version.
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

// dev/test-6641.mjs is 64.1's gate, and its release-metadata block reads the
// HEAD entry - which is this release's now. It reads the v64.1 entry by version
// instead, so its six-note and wording claims stay about the release they
// describe (exactly what was done for dev/test-663.mjs at 64.1). The
// replacement introduces no literal the bump above rewrites.
fileSub('dev/test-6641.mjs', [
  ["    const head = entries[0];",
   "    // The head entry belongs to whatever shipped last, so read the 64.1 entry\n" +
   "    // by version: this gate describes 64.1.\n" +
   "    const head = entries.find((x) => /^64\\.1$/.test(String(x.version))) || entries[0];"],
]);

// Its Settings block asserts what 64.1 made of Settings, and this release puts
// all of that back, so the block is repinned to the state that is true now:
// the old tab order, no group headings, the card where it always was, and a
// pane that scrolls with the sheet around it unable to scroll at all.
const OLD_SETTINGS_BLOCK_START = "console.log('[6] Settings and More are grouped, and the pane scrolls straight');";
const OLD_SETTINGS_BLOCK_END = "console.log('[7] pinned-artist covers are newest first');";
const NEW_SETTINGS_BLOCK = [
  "console.log('[6] Settings is back in the order and the shape it had');",
  '{',
  "  const order = ['settingsTabPremium', 'settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',",
  "    'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']",
  "    .map((id) => src.indexOf('id=\"' + id + '\"'));",
  "  ok(order.every((i) => i !== -1), 'all nine tabs are present');",
  "  ok(order.every((v, i) => i === 0 || order[i - 1] < v), 'and the strip runs Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More (More last)');",
  "  const heads = ['This build and help', 'Playback', 'History and extras'].map((t) => src.indexOf('>' + t + '</div>'));",
  "  ok(heads.every((i) => i === -1), 'the group headings 64.1 added inside More are gone');",
  "  const card = src.indexOf('<!-- Diagonal / Single button toggle -->');",
  "  ok(card !== -1, 'the Playlists/Albums button card is still there');",
  "  ok(card > src.indexOf('id=\"howToUseBtn\"'), 'back where it sat before, after Replay tutorial');",
  "  ok(card < src.indexOf('<!-- Collapsible: Tutorial summary (text) -->'), 'and above the tutorial summary');",
  "  ok(card < src.indexOf('<!-- Collapsible: Library Tools & Fetching -->'), 'not in the library group it was moved to');",
  "  // The sheet is a column flex box: the pane absorbs the leftover height, so",
  "  // the sheet itself can never scroll and the strip can never be squeezed.",
  "  ok(has('  flex: 1 1 auto;\\n  min-height: 0;\\n  max-height: 62vh;'), 'the pane takes the leftover height and scrolls inside itself');",
  "  ok(has('#themeBackdrop .modal > h3,\\n#themeBackdrop .modal > #settingsTabStrip,\\n#themeBackdrop .modal > .modal-btns{ flex: 0 0 auto; }'),",
  "    'and the title, the tab strip and Close keep their own height');",
  "  ok(has(\"      var _panes = $('settingsPanesWrap'); if(_panes) _panes.scrollTop = 0;\"), 'every tab opens at its own top');",
  "  ok(has(\"      if(_sheet) _sheet.scrollTop = 0;\"), 'and the sheet is never left scrolled either');",
  "  const scrollBlock = src.slice(src.indexOf('.settings-scroll {'), src.indexOf('.settings-scroll::-webkit-scrollbar'));",
  "  ok(/scroll-behavior: auto;/.test(scrollBlock) && !/scroll-behavior: smooth;/.test(scrollBlock),",
  "    'the pane still follows the wheel one to one');",
  "}",
  '',
].join('\n');
(function repinSettingsBlock() {
  const p = path.join(ROOT, 'dev/test-6641.mjs');
  let t = fs.readFileSync(p, 'utf8');
  if (t.indexOf("Settings is back in the order and the shape it had") !== -1) return console.log('= dev/test-6641.mjs settings block (already applied)');
  const a = t.indexOf(OLD_SETTINGS_BLOCK_START);
  const b = t.indexOf(OLD_SETTINGS_BLOCK_END);
  if (a === -1 || b === -1 || b < a) throw new Error('dev/test-6641.mjs: the settings block was not found');
  t = t.slice(0, a) + NEW_SETTINGS_BLOCK + t.slice(b);
  fs.writeFileSync(p, t);
  console.log('+ dev/test-6641.mjs settings block repinned');
})();

console.log('patch-6642: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);

// 3 - the tab order
const order = ['settingsTabPremium', 'settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',
  'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']
  .map((id) => final.indexOf('id="' + id + '"'));
must(order.every((i) => i !== -1), 'all nine settings tabs are present');
must(order.every((v, i) => i === 0 || order[i - 1] < v), 'the tabs run Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More');

// 5 - the More pane
must(count('text-transform:uppercase; color:var(--ink-dim); margin:18px 2px 8px;') === 0, 'the group headings are out of the More pane');
const cardAt = final.indexOf('<!-- Diagonal / Single button toggle -->');
must(cardAt !== -1 && cardAt < final.indexOf('<!-- Collapsible: Tutorial summary (text) -->'), 'the playback-preference card is back above the tutorial summary');
must(cardAt !== -1 && cardAt < final.indexOf('<!-- Collapsible: Library Tools & Fetching -->'), 'and no longer sits in the library group');
must(has('id="howToUseBtn"') && has('id="collapsibleTutorialSummary"') && has('id="collapsibleLibrary"') && has('id="collapsibleDjPerPlaylist"'),
  'the More pane still holds every card it had');

// 4 - the sheet and the pane
must(has('  flex: 1 1 auto;\n  min-height: 0;\n  max-height: 62vh;'), 'the pane absorbs the leftover height');
must(count('  flex: 1 1 auto;') === 1 && count('  min-height: 0;') === 1, 'as a single flex item, with one lift and one pair of flex lines');
must(count('/* A maximum height, not a fixed one') === 0, 'and the superseded comment is not left above the new one');
must(has('#themeBackdrop .modal > h3,\n#themeBackdrop .modal > #settingsTabStrip,\n#themeBackdrop .modal > .modal-btns{ flex: 0 0 auto; }'),
  'and the title, tab strip and Close cannot be squeezed');
must(has("      var _panes = $('settingsPanesWrap'); if(_panes) _panes.scrollTop = 0;"), 'a tab opens at its own top');
must(has("      if(_sheet) _sheet.scrollTop = 0;"), 'and the sheet is reset with it');

// 2 - the rail
must(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; }'), 'Discover has its own stacking context');
must(has('#pinnedArtistsStrip{ position:relative; z-index:1; }'), 'and the rail card is lifted out of the glow wash');
must(has('<div id="pinnedArtistsStrip" style="background:var(--bg-raised);margin:0 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;">'),
  'with its markup left exactly as it was');
must(has('display:flex;align-items:flex-start;gap:12px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;min-height:64px;'),
  'the rail keeps its chips on one line and keeps a minimum height');
must(!has('id="pinnedArtistsList" style="display:flex;align-items:flex-start;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;'),
  'and its nested scroller no longer carries the legacy property');
must(has('  function repaintPinnedRail(list){'), 'a settled scroll repaints the card');
must(has('    requestAnimationFrame(function(){ try{ strip.style.visibility = \'\'; }catch(_eRpr){} });'), 'by throwing its painted pixels away and painting them again');
must(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"), 'and any chip still holding a drag lift is put back to a plain chip');
must(has('          repaintPinnedRail(l);\n          if(l.querySelector(\'.pinned-artist-chip\')'), 'the repaint happens even when the artists are still there');
must(has('    try{ list.scrollLeft = 0; }catch(_eSc){}'), 'a redrawn rail still starts at its left edge');

// 1 - the entry names
must(!has(OLD_TITLE_641) && !has(OLD_TITLE_64) && !has(OLD_TITLE_334), 'no invented entry name is left in the changelog');
must(has(NEW_TITLE_641) && has(NEW_TITLE_64) && has(NEW_TITLE_334), 'each of them states its changes instead');
must(count('used to carry an invented name above the changes') === 1, 'and the note that mentions them is the corrected one');
const titlePass = /title: '([^']*pass[^']*)'/i.exec(final.slice(final.indexOf('const CHANGELOG = ['), final.indexOf("version: '63.1.4'")));
must(!titlePass, 'and no recent entry names itself a pass (' + (titlePass ? titlePass[1] : 'none') + ')');

// 6 - the release
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
    must(/pinned/i.test(notes) && /settings/i.test(notes), 'and describing both halves of it');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(SW, 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

if (problems.length) {
  console.error('\npatch-6642: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-6642: all ' + 'verification checks passed (' + edits + ' edit(s))');
