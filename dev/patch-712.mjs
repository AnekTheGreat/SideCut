#!/usr/bin/env node
/**
 * SideCut 71.2 - the refresh button comes back to the header, and the add-songs
 * plus comes down to the dock.
 *
 * The user's words: "And add an refresh button back next to the settings icon at
 * the top and move the plus icon for exporting importing add songs ect... to the
 * bottom tabs just the smaller plus icon."
 *
 * 70.0.5 made exactly the opposite trade - it took the refresh button out of the
 * header and the add-songs pill out of the dock, and left one + at the top as the
 * only way into the menu. That is what this release undoes, in the shape the user
 * asked for rather than by restoring the old markup wholesale:
 *
 *   1. THE HEADER HAS REFRESH AGAIN. The + is gone from the top and the refresh
 *      button is back where it was, immediately before the gear, so the three icon
 *      buttons are notifications / refresh / settings. It reloads the app on the
 *      spot (that is what a refresh is for: a build that just landed is running
 *      immediately instead of on the next launch), and it flushes the library
 *      state first so a reload cannot throw away something still only in memory.
 *
 *   2. THE PLUS IS ON THE DOCK, AS A COMPACT ICON. It is a child of the tab strip
 *      at the end of the row, titled "Add songs" and opened with the same menu it
 *      has always opened (your files, a folder, importing a backup, both exports).
 *      It is deliberately NOT sized like a tab: the strip hands every direct child
 *      `flex:1 1 0`, and a fifth equal-width cell is what made the old
 *      "+ Add songs" pill squeeze the four names until they ellipsised. The plus
 *      opts out of that (flex:0 0 auto, a fixed 44px square, icon only) so it is
 *      the smaller plus icon the user asked for and the tabs keep their room.
 *
 * WHY IT IS STILL `action-pill`. `reorderActionPills()` (driven by the saved
 * `actionPillOrder`) rebuilds the strip at boot: it appends the ordered tabs to a
 * fragment first, then every OTHER `.action-pill` it finds, then re-attaches the
 * fragment. A button that is not `.action-pill` would therefore be left in front
 * of the four tabs and the plus would jump to the left of the row. Carrying the
 * class puts it in that second pass, i.e. last, which is where it belongs. The
 * dock readers that enumerate tabs skip it by its own `dock-add` class.
 *
 *   node dev/patch-712.mjs
 *   node dev/patch-712.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO70 = path.join(ROOT, 'dev', 'studio-70-check.cjs');
const TEST70 = path.join(ROOT, 'dev', 'test-70.mjs');

const CHECK = process.argv.includes('--check');
const VERSION = '71.2';
const PREV = '70.2.1';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 7:14 PM EDT';
const CACHE = 'sidecut-shell-v63.0.48';
const OLDCACHE = 'sidecut-shell-v63.0.47';
const TITLE = 'Refresh comes back to the header and the plus moves down to the tab bar';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), and none may read as a music downloader on the WIDER list
// dev/test-play-copy.mjs audits the store build against - which includes the word
// mp3, download, convert, "get song", "save the file" and "hand-off". test-662,
// test-6642 and test-66421 refuse the same words, plus "play build", "play
// version" and "play install". Notes 5 and 6 name surfaces the 662 rule looks for.
const NOTES = [
  'Refresh is back beside the gear at the top of the screen. It reloads the app on the spot, which is what you want after an update lands: the new build is running straight away instead of on the next launch, and your library state is written out before the reload so nothing in memory is lost.',
  'The plus for adding music and for exporting moved down to the tab bar. It is a compact plus icon at the end of the row rather than a full tab of its own, and it opens exactly the menu it always did: your files, a whole folder, importing a backup, and both exports.',
  'The top of the screen is three icon buttons now: notifications, refresh and the gear. The plus is no longer up there, so the row is shorter and each button is easier to hit.',
  'Opening the menu again from the new plus closes it, and tapping anywhere outside it closes it too. It still dims the screen behind it and lifts the tab bar, so the menu is never hidden behind the player.',
  'The player, the dock, the library list and Studio are otherwise exactly as the release before this one left them. No song, playlist, album, badge or stored setting was read or written by this release.',
  'A library saved before this release comes back the same. Nothing about the backup, the listening stats, the themes or the home widget changed, so this is a layout release and not a data one.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  // A replacement that drops the newline the anchor had joins two lines
  // together, and the join parses. Refused here instead of found later.
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';
let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
const studio = holder(fs.readFileSync(STUDIO70, 'utf8'));
const t70 = holder(fs.readFileSync(TEST70, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-712: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============ A. THE HEADER SWAPS THE + FOR THE REFRESH BUTTON ============== */
// Same slot, same shape: only the id, the title and the glyph change, so the row
// stays three identical .icon-btn buttons.
sub(html, 'the header + becomes the refresh button',
  block([
    '    <button class="icon-btn" id="addSongsBtn" title="Add songs" style="flex-shrink:0;">',
    '      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    '    </button>',
  ]),
  block([
    '    <button class="icon-btn" id="refreshBtn" title="Refresh app" style="flex-shrink:0;">',
    '      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    '    </button>',
  ]),
  { key: 'id="refreshBtn" title="Refresh app"' });

/* ============ B. AND THE REFRESH IS ACTUALLY WIRED ========================== */
// 70.0.5 deleted both the button and its handler. The handler is back, and it
// asks for the state to be written out first: a reload throws the session away,
// and anything still only in memory would go with it.
sub(html, 'the refresh handler',
  block([
    '// Header refresh button: full app reload so any new build changes take effect immediately.',
    '/* 70.0.5: the header refresh button is gone - the + that replaced it opens Add songs. */',
  ]),
  block([
    '// Header refresh button: full app reload so any new build changes take effect',
    '// immediately. 70.0.5 traded this button away for the + in the header; 71.2 puts',
    '// the refresh back beside the gear and the + down on the dock, so both are one',
    '// tap away again. The library is written out first - a reload throws the session',
    '// away, and anything still only in memory would go with it.',
    'try{',
    "  var _rb = document.getElementById('refreshBtn');",
    '  if(_rb && !_rb._scRefreshWired){',
    '    _rb._scRefreshWired = true;',
    "    _rb.addEventListener('click', function(){",
    "      try{ if(typeof saveMeta === 'function') saveMeta(); }catch(_e){ }",
    '      try{ window.location.reload(); }catch(e){ document.location.reload(); }',
    '    });',
    '  }',
    '}catch(e){}',
  ]),
  { key: "if(_rb && !_rb._scRefreshWired){" });

/* ================= C. THE PLUS LANDS ON THE DOCK, COMPACT ================== */
// Last in the row, after Studio - the slot the old "+ Add songs" pill had. Icon
// only, and it keeps the .action-pill class so reorderActionPills() puts it after
// the four tabs rather than in front of them (see the header comment).
sub(html, 'the plus lands on the dock',
  '  <button id="studioBtn" class="action-pill">Studio</button>\n',
  block([
    '  <button id="studioBtn" class="action-pill">Studio</button>',
    '  <button id="dockAddBtn" class="action-pill dock-add" title="Add songs" aria-label="Add songs">',
    '    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    '  </button>',
  ]),
  { key: 'id="dockAddBtn"' });

// The strip makes every direct child `flex:1 1 0`. The plus opts out of that, or
// it becomes a fifth equal cell and squeezes the four tab names.
sub(html, 'and it is sized as an icon, not a tab',
  '#libraryBtn #playlistsHalf span, #libraryBtn #albumsHalf span{ font-size: 9.5px; }\n',
  block([
    '#libraryBtn #playlistsHalf span, #libraryBtn #albumsHalf span{ font-size: 9.5px; }',
    '/* 71.2. The add-songs plus is back on the dock, as a compact icon rather than a',
    '   fifth full-width tab: it opts out of the flex:1 every direct child of the strip',
    '   gets (sharing the row equally is what made the old "+ Add songs" pill squeeze',
    '   the four names), and it carries no label - just the glyph. */',
    '.action-strip .action-pill.dock-add{',
    '  flex: 0 0 auto; width: 44px; min-width: 44px; padding: 0;',
    '  display: flex; align-items: center; justify-content: center; border-radius: 13px;',
    '}',
    '/* The large-touch sandbox mode pads every pill 12px/18px, which would stretch the',
    '   square back into a tab. It stays a square there too. */',
    'body.sandbox-large-touch .action-pill.dock-add{ padding: 0 !important; }',
    '/* A 360px phone has the least room: give the plus back a little of it. */',
    '@media (max-width: 380px){ .action-strip .action-pill.dock-add{ width: 38px; min-width: 38px; } }',
  ]),
  { key: '.action-strip .action-pill.dock-add{' });

// The one place the menu is toggled. The element id is the only thing that moved.
sub(html, 'the dock plus is the menu toggle',
  "  $('addSongsBtn').addEventListener('click', (e) => {\n",
  "  $('dockAddBtn').addEventListener('click', (e) => {\n",
  { key: "$('dockAddBtn').addEventListener('click'" });

/* ==================== D. THE RELEASE ======================================= */
sub(html, 'APP_VERSION',
  "  const APP_VERSION = '" + PREV + "';",
  "  const APP_VERSION = '" + VERSION + "';",
  { key: "const APP_VERSION = '" + VERSION + "';" });

sub(html, 'changelog head',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + block([
    "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ]) + NOTES.map((n) => "    '" + n + "',").join('\n') + '\n  ] },\n',
  { key: "const CHANGELOG = [\n  { version: '" + VERSION + "'" });

sub(sw, 'shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';",
  "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ================================ E. THE GATES ============================== */
// test-705 [2]: the dock is still four TABS, and now carries the compact plus.
sub(t705, 'test-705 the dock keeps the plus compact',
  block([
    "  ok(count('id=\"addSongsToggle\"') === 0, 'the add-songs pill is gone');",
    "  ok(count('id=\"addSongsWrap\"') === 0, 'and so is the wrap it sat in (it was a flex child of the strip)');",
    "  ok(count('class=\"add-songs-wrap\"') === 0, 'with no class reference left behind');",
  ]),
  block([
    "  ok(count('id=\"addSongsToggle\"') === 0, 'the old add-songs pill is still gone');",
    "  ok(count('id=\"addSongsWrap\"') === 0, 'and so is the wrap it sat in (it was a flex child of the strip)');",
    "  ok(count('class=\"add-songs-wrap\"') === 0, 'with no class reference left behind');",
    "  // 71.2. The plus came back to the dock as a COMPACT icon at the end of the row,",
    "  // not a fifth tab: it is a direct child of the strip after Studio, it carries its",
    "  // own dock-add class, and a rule stops it sharing the row equally with the tabs.",
    "  ok(count('id=\"dockAddBtn\"') === 1 && strip.indexOf('id=\"dockAddBtn\"') !== -1,",
    "     'the dock carries the add-songs plus');",
    "  ok(strip.indexOf('id=\"studioBtn\"') < strip.indexOf('id=\"dockAddBtn\"'),",
    "     'and it sits after Studio, at the end of the row');",
    "  ok(count('class=\"action-pill dock-add\"') === 1,",
    "     'as a compact icon rather than a fifth full-width tab');",
    "  ok(/\\.action-strip \\.action-pill\\.dock-add\\{[^}]*flex: 0 0 auto/.test(src),",
    "     'with a rule that keeps it out of the tabs equal-width share');",
  ]),
  { key: 'the dock carries the add-songs plus' });

// test-705 [3]: the header is refresh again, and the + is the dock's.
sub(t705, 'test-705 the header refresh is back',
  block([
    "console.log('\\n[3] the header +');",
    '{',
    "  ok(count('id=\"refreshBtn\"') === 0, 'the refresh button is gone');",
    "  ok(!has(\"getElementById('refreshBtn')\"), 'and nothing reads its id any more');",
    "  ok(count('id=\"addSongsBtn\"') === 1, 'the header has one +');",
    "  const header = slice('<header>', '</header>');",
    "  ok(header.indexOf('id=\"addSongsBtn\"') !== -1, 'and it is the header it sits in');",
    "  ok(header.indexOf('id=\"notifBtn\"') !== -1 && header.indexOf('id=\"themeBtn\"') !== -1,",
    "     'between the notifications bell and settings, where the refresh button was');",
    "  const plusTag = header.slice(header.indexOf('id=\"addSongsBtn\"'), header.indexOf('</button>', header.indexOf('id=\"addSongsBtn\"')));",
    "  ok(plusTag.indexOf('title=\"Add songs\"') !== -1, 'titled Add songs, so it says what it is when held');",
    "  ok(has('<path d=\"M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z\"/>'), 'with the plus glyph, not the refresh arrow');",
    "  ok(!has('M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42'), 'and the refresh arrow is gone from the page');",
    "  ok(count(\"  $('addSongsBtn').addEventListener('click'\") === 1, 'the + is wired to the menu');",
    "  ok(has(\"if($('addSongsMenu').classList.contains('open')) closeAddSongsMenu();\"),",
    "     'and it toggles rather than only opening');",
    '}',
  ]),
  block([
    "console.log('\\n[3] the header refresh button');",
    '{',
    "  // 71.2 reverses 70.0.5 here: the refresh is back beside the gear and the + is",
    "  // gone from the header. Both halves are asserted, because half of this move",
    "  // would leave the menu reachable only from the dock or the button dead.",
    "  ok(count('id=\"refreshBtn\"') === 1, 'the refresh button is back');",
    "  ok(has(\"getElementById('refreshBtn')\"), 'and something reads its id again');",
    "  ok(count('id=\"addSongsBtn\"') === 0, 'and the header + is gone');",
    "  const header = slice('<header>', '</header>');",
    "  ok(header.indexOf('id=\"refreshBtn\"') !== -1, 'the refresh sits in the header');",
    "  ok(header.indexOf('id=\"notifBtn\"') !== -1 && header.indexOf('id=\"themeBtn\"') !== -1,",
    "     'beside the notifications bell and settings');",
    "  const refreshTag = header.slice(header.indexOf('id=\"refreshBtn\"'), header.indexOf('</button>', header.indexOf('id=\"refreshBtn\"')));",
    "  ok(refreshTag.indexOf('title=\"Refresh app\"') !== -1, 'titled Refresh app, so it says what it does when held');",
    "  ok(refreshTag.indexOf('M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42') !== -1, 'with the refresh arrow');",
    "  ok(refreshTag.indexOf('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z') === -1, 'and no plus glyph left in the header');",
    "  ok(has(\"_rb.addEventListener('click'\") && has('_scRefreshWired = true;') &&",
    "     has('window.location.reload()'), 'and the refresh really reloads the app');",
    "  ok(count(\"  $('dockAddBtn').addEventListener('click'\") === 1, 'the dock + is wired to the menu');",
    "  ok(has(\"if($('addSongsMenu').classList.contains('open')) closeAddSongsMenu();\"),",
    "     'and it toggles rather than only opening');",
    '}',
  ]),
  { key: 'the header refresh button' });

// studio-70 drives the same two claims on the real app.
sub(studio, 'studio-70 the header refresh and the dock plus',
  block([
    "    // 70.0.5, the user's words: \"Remove the add songs tab from bottom and remove",
    '    // the refresh button from the top and replace that with a plus sign for add',
    '    // songs". The dock is four tabs, the + is the only way into the menu, and it',
    '    // has to actually open it from up there.',
    "    // Only the dock's OWN children are tabs - the menu lives inside this subtree",
    '    // and its five buttons wear .action-pill as well.',
    "    const tabs = Array.from(strip.children).filter((el) => el.classList.contains('action-pill'));",
    "    ok(tabs.length === 4, 'the dock is four tabs (' + tabs.map((b) => b.id).join(',') + ')');",
    "    ok(tabs.map((b) => b.id).join(',') === 'homeBtn,libraryBtn,discoverBtn,studioBtn',",
    "       'and they are Home, Library/Albums, Discover and Studio');",
    "    ok(!doc.getElementById('addSongsToggle'), 'the add-songs pill is gone from the dock');",
    "    ok(!doc.getElementById('addSongsWrap'), 'and so is the wrap it sat in - it was a flex child, so it would still take a share of the row');",
    '',
    "    const plus = doc.getElementById('addSongsBtn');",
    "    ok(!!plus, 'the header has a + where the refresh button was');",
    "    ok(!doc.getElementById('refreshBtn'), 'and the refresh button is really gone');",
    "    ok(!!plus && plus.getAttribute('title') === 'Add songs', 'the + is titled Add songs');",
    "    ok(!!plus && doc.querySelector('header').contains(plus), 'and it sits in the header with the other icon buttons');",
    "    ok(!!doc.getElementById('addSongsMenu') && !!doc.getElementById('addSongsBackdrop'),",
    "       'the menu and its backdrop are still on the page after the move');",
  ]),
  block([
    "    // 71.2 reverses 70.0.5's trade. The user asked for the refresh button back",
    '    // beside the gear at the top, and for the add-songs plus to come down to the',
    '    // tab bar as just the smaller plus icon. The dock therefore carries a COMPACT',
    '    // plus at the end of the row - not a fifth tab, so it is filtered out of the',
    '    // tab list by its own dock-add class - and the header carries refresh again.',
    "    // Only the dock's OWN children are tabs - the menu lives inside this subtree",
    '    // and its five buttons wear .action-pill as well.',
    '    const tabs = Array.from(strip.children)',
    "      .filter((el) => el.classList.contains('action-pill') && !el.classList.contains('dock-add'));",
    "    ok(tabs.length === 4, 'the dock is still four tabs (' + tabs.map((b) => b.id).join(',') + ')');",
    "    ok(tabs.map((b) => b.id).join(',') === 'homeBtn,libraryBtn,discoverBtn,studioBtn',",
    "       'and they are Home, Library/Albums, Discover and Studio');",
    "    ok(!doc.getElementById('addSongsToggle'), 'the old add-songs pill is still gone from the dock');",
    "    ok(!doc.getElementById('addSongsWrap'), 'and so is the wrap it sat in - it was a flex child, so it would still take a share of the row');",
    '',
    "    const plus = doc.getElementById('dockAddBtn');",
    "    ok(!!plus, 'the dock has the add-songs plus');",
    "    ok(!!plus && plus.parentNode === strip, 'and it is a child of the dock itself');",
    "    ok(!!plus && plus.getAttribute('title') === 'Add songs', 'titled Add songs, so it says what it is when held');",
    "    ok(!!plus && stripsLastId(strip) === 'dockAddBtn', 'last in the row, after Studio and the four tabs');",
    "    ok(!!doc.getElementById('refreshBtn') && !doc.getElementById('addSongsBtn'),",
    "       'and the header has refresh back with no + left in it');",
    "    ok(!!doc.getElementById('addSongsMenu') && !!doc.getElementById('addSongsBackdrop'),",
    "       'the menu and its backdrop are still on the page after the move');",
  ]),
  { key: 'the dock has the add-songs plus' });

// The probe asks for the dock's last id twice; one helper keeps it honest and says
// what it means (the reorder pass at boot is what decides that position).
sub(studio, 'studio-70 the last-child helper',
  'function boot(mode) {\n',
  block([
    "// 71.2. The last id in the dock. reorderActionPills() runs at boot and rebuilds",
    '// the strip from the saved order, so "after Studio" is a claim about what that',
    '// pass leaves behind rather than about the written markup.',
    'function stripsLastId(strip) {',
    '  const kids = Array.from(strip.children).filter((el) => el.tagName === "BUTTON");',
    '  return kids.length ? kids[kids.length - 1].id : "";',
    '}',
    '',
    'function boot(mode) {',
  ]),
  { key: 'function stripsLastId(strip) {' });

// test-70 DESCRIBES 70.0 (its VER does not move), but two of its checks are about
// the build actually on the page and were written as literals for the 70 series:
// with APP_VERSION at 71.2 they failed. A move to the next series is exactly what
// the page's own version rule allows, so the series arms name 71.x the way they
// already named 70.1, and the check underneath asserts the general rule (a
// well-formed version, third number under ten, a new series not reading x.y.0)
// instead of the major it happened to ship under.
sub(t70, 'test-70 the series moves with the release',
  block([
    "  ok(ver === VER || String(ver).indexOf(VER + '.') === 0 || /^70\\.1(\\.\\d+)?$/.test(ver),",
    "     'the app runs as ' + VER + ', a patch on it, or the series that follows it (' + ver + ')');",
    "  // The rule the page states about its own version rather than a literal: the",
    "  // series is 70.x, the third number stops at nine, and a new series does not",
    "  // read 70.1.0 - so 70.0.10 and 70.1.0 are both refused.",
    '  const verParts = String(ver).split(\'.\').map((n) => Number(n));',
    '  ok(/^70\\.\\d+(\\.\\d+)?$/.test(ver) &&',
    '     !(verParts.length === 3 && (verParts[2] === 0 || verParts[2] > 9)),',
    "     'and the version is a 70.x number whose third number never reaches ten');",
  ]),
  block([
    '  // 71.2. This gate DESCRIBES 70.0 and keeps reading that entry below, but the',
    '  // two checks here are about the build ON the page, and they were written as',
    '  // literals for the 70 series - which refused 71.2 for no reason but its major.',
    '  // The next series is what the page own rule allows, so 71.x is named the way',
    '  // 70.1 already was, and the rule underneath is the general one.',
    "  ok(ver === VER || String(ver).indexOf(VER + '.') === 0 ||",
    '     /^70\\.1(\\.\\d+)?$/.test(ver) || /^71\\.\\d+(\\.\\d+)?$/.test(ver),',
    "     'the app runs as ' + VER + ', a patch on it, or the series that follows it (' + ver + ')');",
    '  // The rule the page states about its own version: a well-formed version whose',
    '  // third number stops at nine, and a new series does not read x.y.0 - so',
    '  // 70.0.10 and 70.1.0 are both refused, whichever series shipped last.',
    "  const verParts = String(ver).split('.').map((n) => Number(n));",
    '  ok(/^\\d+(\\.\\d+)*$/.test(ver) &&',
    '     !(verParts.length === 3 && (verParts[2] === 0 || verParts[2] > 9)),',
    "     'and the third number never reaches ten');",
  ]),
  { key: 'and the third number never reaches ten' });

/* ================================= F. WHAT MUST STILL HOLD ================== */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // The header swap.
  must(count(page, 'id="refreshBtn"') === 1 && count(page, 'id="addSongsBtn"') === 0,
    'the header does not have exactly one refresh button and no +');
  // `window.location.reload()` is the app's general escape hatch and appears ten
  // times over, so the wiring is pinned by its own guard flag instead.
  must(count(page, 'if(_rb && !_rb._scRefreshWired){') === 1 &&
    count(page, '_scRefreshWired = true;') === 1,
    'the refresh button is not wired');
  must(count(page, 'id="themeBtn"') === 1 && count(page, 'id="notifBtn"') === 1,
    'the other two header buttons left with this release');
  // The dock plus.
  must(count(page, 'id="dockAddBtn"') === 1 && count(page, 'class="action-pill dock-add"') === 1,
    'the dock does not carry the compact add-songs plus');
  must(page.indexOf('id="studioBtn"') < page.indexOf('id="dockAddBtn"'),
    'the plus is not after Studio in the row');
  // The class name appears twice on purpose (the rule and its narrow-phone
  // override), so the sizing is pinned on the declaration itself.
  must(count(page, 'flex: 0 0 auto; width: 44px; min-width: 44px; padding: 0;') === 1,
    'nothing stops the plus from sharing the row equally with the tabs');
  must(count(page, "  $('dockAddBtn').addEventListener('click'") === 1 &&
    count(page, "  $('addSongsBtn').addEventListener('click'") === 0,
    'the menu toggle did not move to the dock, or the header handler survived');
  must(count(page, "if($('addSongsMenu').classList.contains('open')) closeAddSongsMenu();") === 1,
    'the dock plus no longer toggles the menu');
  // The menu itself is untouched.
  must(count(page, 'id="addSongsMenu"') === 1 && count(page, 'id="addSongsBackdrop"') === 1 &&
    count(page, 'id="addFolderBtn"') === 1 && count(page, 'id="addBtn"') === 1 &&
    count(page, 'id="importLibBtn"') === 1 && count(page, 'id="exportSongsBtn"') === 1 &&
    count(page, 'id="exportLibBtn"') === 1,
    'the Add songs menu lost one of its ways in');
  must(count(page, '.action-strip.menu-open{ z-index:300; }') === 1,
    'the dock no longer lifts over the player while the menu is open');
  must(count(page, "let actionPillOrder = ['homeBtn', 'libraryBtn', 'discoverBtn', 'studioBtn'];") === 1,
    'the saved tab order no longer names the four tabs');
  // The release.
  must(count(page, "const APP_VERSION = '71.2';") === 1, 'the version is not 71.2');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '71.2',") === 1 && count(page, "  { version: '70.2.1',") === 1 &&
    count(page, "  { version: '70.2.0',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(!/\bmp3\b|\bdownload|converter|\bconvert\b/i.test(NOTES.join('\n')),
    'a note reads as a music downloader on the wider store list');
  must(!/play build|play version|play install/i.test(NOTES.join('\n')), 'a note names the other build');
  must(/(studio|player|dock|premium|license)/i.test(NOTES.join('\n')),
    'and none of them names a surface this app has');
  must(!/\bpass\b/i.test(TITLE), 'the title reads as a test result');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  // The gates.
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, 'the dock carries the add-songs plus') === 1 &&
    count(t705.text, 'the header refresh button') === 1,
    'the new gate rules did not land');
  must(count(t705.text, "count('id=\"refreshBtn\"') === 0") === 0 &&
    count(t705.text, "count('id=\"addSongsBtn\"') === 1") === 0,
    'a 70.0.5 rule that this release reverses survived in test-705');
  must(count(studio.text, 'the dock has the add-songs plus') === 1 &&
    count(studio.text, 'function stripsLastId(strip) {') === 1,
    'the real-app probe was not repointed');
  must(count(studio.text, "'the header has a + where the refresh button was'") === 0 &&
    count(studio.text, "'and the refresh button is really gone'") === 0,
    'a 70.0.5 rule that this release reverses survived in the probe');
  must(count(t70.text, "const VER = '70.0';") === 1, 'test-70 stopped describing 70.0');
  must(count(t70.text, 'and the third number never reaches ten') === 1 &&
    count(t70.text, '/^71\\.\\d+(\\.\\d+)?$/.test(ver)') === 1,
    'test-70 still refuses the 71 series on the major alone');
}

if(problems.length){
  console.error('patch-712: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-712: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text], [TEST70, t70.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-712: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-712: next `node dev/repin-712.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
