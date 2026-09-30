#!/usr/bin/env node
/**
 * SideCut 70.1.6 - the two broken rows from the two screenshots.
 *
 * The user's words: "Fix these bugs UI bugs", with a photo of the library in
 * select mode and a photo of the Discover tab.
 *
 * 1. THE SELECT-MODE ACTION BAR STACKED ITS OWN LABEL. Selecting songs builds a
 *    header with a label and SEVEN action buttons (cancel, add to album, add to
 *    playlist, create album, edit tags, export, delete). The row is a nowrap flex
 *    row, and the label column is the only child allowed to shrink:
 *    `.pane-header > div:first-child{ flex:1 1 0; min-width:0 }`, with an h2 that
 *    wraps anywhere (`overflow-wrap:anywhere`). On a phone the buttons alone are
 *    wider than the row, so the label column collapsed to its one-character
 *    minimum and "2 selected" broke to a letter a line - ten lines, which is what
 *    made the bar as tall as the photo shows. In select mode the label now keeps
 *    its own width and the seven buttons wrap onto a second row instead of taking
 *    the width from the label. Nothing else about the header changes: the modifier
 *    class is only on this one bar, so the ordinary header is untouched.
 *
 * 2. THE DISCOVER SEARCH ROW SPLIT ITS WIDTH WITH THE SEARCH BUTTON. The row held
 *    the field, a clear button and the Search pill. `.action-pill` carries `flex:1`
 *    from the dock's pill rule, so BOTH the field and the button grew: the button
 *    took half the row and the field was cut down to "Search songs, a" with its
 *    placeholder ellipsised. The clear button was a bare bordered square wedged
 *    between them, and it was on screen even while the field was empty.
 *    The field and its X are one control now - the same relative wrapper and the
 *    same round inside-the-field X the library search box has had since 70.1.5,
 *    shown by `:placeholder-shown` so an empty field cannot display it - and the
 *    pill keeps its own width instead of growing.
 *
 * Both are layout. No song, playlist, album, listening stat, setting or storage
 * key is read or written by this release, and the two fixes are the whole of it.
 *
 *   node dev/patch-7016.mjs
 *   node dev/patch-7016.mjs --check   # report only
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

const CHECK = process.argv.includes('--check');
const VERSION = '70.1.6';
const PREV = '70.1.5';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 3:05 PM EDT';
const CACHE = 'sidecut-shell-v63.0.42';
const OLDCACHE = 'sidecut-shell-v63.0.41';
const TITLE = 'The select-mode bar keeps its label on one line and the Discover search field keeps the width the Search button was taking from it';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), none says "download" or "convert", and none uses "play build", "play
// version" or "play install" - test-662, test-6642 and test-66421 refuse those.
// One of them names a surface the 662 surface rule looks for (player, dock,
// Studio, premium, license).
const NOTES = [
  'The row of buttons you get when you select songs is one line of buttons now. The label beside them is the only part of that row that was allowed to shrink, and with seven action buttons in it on a phone there was no room left for anything else - so "2 selected" broke to one letter a line and the bar grew ten lines tall around a button strip. The buttons wrap to a second row now, and the label keeps its own width.',
  'The Discover search field is the width it should always have been. The field and the Search button beside it were both set to grow, so the button took half the row and the field was cut down to "Search songs, a" with its own placeholder ellipsised.',
  'The clear X on the Discover field is the same round one the library search box has, in the same place: inside the right edge of the field, one tap empties it, and it is only on screen while there is something to clear. Before this it was a bare square sitting between the field and the button, and it showed even when the field was empty.',
  'The field and the Search button are the same height now. The row stretches the two of them together instead of leaving the button taller than the field, which is what made the pair look misaligned.',
  'Both of these were layout only. No song, playlist, album, listening stat, setting or stored value was read or written - the player, the dock, the library list, Studio, the badge wall and Donate are exactly as the last release left them.',
  'A library saved before this release comes back the same way. Nothing about the backup, the play counts, the streaks or the album covers changed, so this is a drawing fix and not a data one.',
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

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-7016: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ================================== A. THE SELECT BAR KEEPS ITS OWN LABEL COLUMN */
// The modifier class is the whole mechanism: the script already knows it is
// building the select-mode header, and this is the one header in the app with
// seven buttons in it. Everything below is scoped to that class, so the ordinary
// header keeps its single-row, no-wrap behaviour exactly as it is.
sub(html, 'the select-bar stylesheet',
  '  .pane-actions #mixBtn{ display:none; } .pane-actions #reorderModeBtn{ display:flex; }\n',
  block([
    '  .pane-actions #mixBtn{ display:none; } .pane-actions #reorderModeBtn{ display:flex; }',
    '  /* 70.1.6 - SELECT MODE PUTS SEVEN BUTTONS WHERE THE BAR USUALLY HAS TWO OR THREE,',
    '     and on a phone that is wider than the row. The label column is the only child',
    '     that can shrink (`.pane-header > div:first-child` is flex:1 1 0 with min-width:0)',
    '     and its h2 wraps anywhere, so it collapsed to a single character and "2 selected"',
    '     stacked one letter per line - a ten-line header with the button strip under it,',
    '     which is the screenshot this release fixes. In select mode the label keeps its',
    '     own width and the buttons wrap onto the next row instead of taking it from the',
    '     label. Scoped to this class so no other header can move. */',
    '  .pane-header.select-bar{ flex-wrap:wrap; }',
    '  .pane-header.select-bar > div:first-child{ flex:0 0 auto; }',
    '  .pane-header.select-bar h2{ white-space:nowrap; overflow-wrap:normal; word-break:normal; }',
    '  .pane-header.select-bar .pane-actions{ flex:1 1 auto; flex-wrap:wrap; justify-content:flex-end; }',
    '',
  ]),
  { key: '.pane-header.select-bar{ flex-wrap:wrap; }' });

sub(html, 'the select-bar class',
  "  header.className = 'pane-header';\n",
  block([
    '  // 70.1.6. The select-mode bar is the one header in the app with seven action',
    '  // buttons in it, and it is the only one whose label has to survive them.',
    "  header.className = 'pane-header' + (selectMode ? ' select-bar' : '');",
  ]),
  { key: "header.className = 'pane-header' + (selectMode" });

/* ============================ B. THE DISCOVER ROW: ONE FIELD AND ONE BUTTON WIDE */
sub(html, 'the Discover row stylesheet',
  block([
    '#discoverSearchRow{ display:flex; gap:8px; padding:6px 0 12px; }',
    '#discoverSearch{',
    '  flex:1; min-width:0; background:var(--bg-raised); border:1px solid var(--line); color:var(--ink);',
    '  border-radius:20px; padding:9px 14px; font-size:13.5px; font-family:var(--font-ui);',
    '}',
    '#discoverSearch::placeholder{ color:var(--ink-dim); }',
  ]),
  block([
    '/* 70.1.6 - THE ROW HAD TWO CHILDREN THAT BOTH GREW. `.action-pill` carries flex:1',
    '   from the dock pill rule, so the Search button took half the row and squeezed the',
    '   field down to "Search songs, a" with its own placeholder ellipsised, while the',
    '   clear X sat between them as a bare square that was on screen even when the field',
    '   was empty. The field and its X are one control now - the same relative wrapper and',
    '   the same round X inside the right edge that the library search box has - and the',
    '   pill keeps its own width. The row stretches its children so the field and the',
    '   button are one height instead of two. */',
    '#discoverSearchRow{ display:flex; align-items:stretch; gap:10px; padding:6px 0 12px; }',
    '#discoverSearchWrap{ position:relative; flex:1 1 auto; min-width:0; display:flex; }',
    '#discoverSearch{',
    '  flex:1 1 auto; min-width:0; background:var(--bg-raised); border:1px solid var(--line); color:var(--ink);',
    '  border-radius:20px; padding:9px 38px 9px 14px; font-size:13.5px; font-family:var(--font-ui);',
    '}',
    '#discoverSearch::placeholder{ color:var(--ink-dim); }',
    '#discoverSearchClear{',
    '  display:none; position:absolute; right:10px; top:50%; transform:translateY(-50%);',
    '  width:22px; height:22px; border-radius:50%; border:none; background:rgba(255,255,255,0.12);',
    '  color:var(--ink-dim); font-size:13px; line-height:1; cursor:pointer; padding:0;',
    '  align-items:center; justify-content:center;',
    '}',
    '#discoverSearch:not(:placeholder-shown) + #discoverSearchClear{ display:flex; }',
    '#discoverSearchRow #discoverSearchBtn{ flex:0 0 auto; }',
  ]),
  { key: '#discoverSearchWrap{ position:relative;' });

sub(html, 'the Discover row markup',
  block([
    '  <div id="discoverSearchRow">',
    '    <input type="text" id="discoverSearch" placeholder="Search songs, artists, albums\u2026">',
    '    <button id="discoverSearchClear" title="Clear" style="padding:8px 10px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:12px; cursor:pointer;">x</button>',
    '    <button class="action-pill primary" id="discoverSearchBtn" style="padding:9px 16px;">Search</button>',
    '  </div>',
  ]),
  block([
    '  <div id="discoverSearchRow">',
    '    <div id="discoverSearchWrap">',
    '      <input type="text" id="discoverSearch" placeholder="Search songs, artists, albums\u2026">',
    '      <button id="discoverSearchClear" type="button" aria-label="Clear search" title="Clear">&#215;</button>',
    '    </div>',
    '    <button class="action-pill primary" id="discoverSearchBtn" style="padding:9px 16px;">Search</button>',
    '  </div>',
  ]),
  { key: 'id="discoverSearchWrap"' });

/* ===================================================== C. THE RELEASE METADATA */
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

/* ==================================================================== D. THE GATES */
// test-705 is the standing 70.x gate and it reads index.html as text, so the two
// rows are asserted the way the stylesheet states them.
sub(t705, 'test-705 the two rows',
  "console.log('\\n[11] the file still holds together');\n",
  block([
    "console.log('\\n[10c] the select bar and the Discover search row');",
    '{',
    '  // 70.1.6. Both are layout, and jsdom measures every element as 0, so what is',
    '  // asserted here is the stylesheet and the class the script has to emit. The',
    '  // real-app probe drives both rows; this is the static half of the same claim.',
    "  ok(count('pane-header.select-bar') === 4 &&",
    "     count(\"header.className = 'pane-header' + (selectMode ? ' select-bar' : '')\") === 1,",
    "     'the select bar keeps its label on one line and wraps its seven buttons');",
    "  ok(count('id=\"discoverSearchWrap\"') === 1 &&",
    "     count('#discoverSearch:not(:placeholder-shown) + #discoverSearchClear') === 1,",
    "     'the Discover field and its clear button are one control');",
    "  ok(count('#discoverSearchRow #discoverSearchBtn{ flex:0 0 auto; }') === 1,",
    "     'and the Search button no longer takes the field width');",
    '}',
    '',
    "console.log('\\n[11] the file still holds together');",
  ]),
  { key: '[10c] the select bar and the Discover search row' });

// The real-app probe drives both rows: entering select mode has to put the
// modifier class on the bar the app actually builds (that is the only thing a
// stylesheet can be right or wrong about), and the Discover field and its X have
// to be one control that clears.
sub(studio, 'studio-70 the two rows',
  "  console.log('[12] the page still holds together');\n",
  block([
    "  console.log('[11i] the select bar and the Discover search row');",
    '  {',
    '    // 70.1.6. Driven, not read: select mode really builds a new header, and the',
    '    // class on that header is what the stylesheet keys off. jsdom has no layout,',
    '    // so what is claimed is the class and the wiring, not the pixel widths.',
    "    doc.querySelector('#libraryBtn').click();",
    '    await wait(120);',
    '    const pick = win.__scGetAllTracks().slice(0, 2).map((t) => t.id);',
    '    win.__scEnterSelect(pick);',
    '    await wait(140);',
    "    const bar = doc.querySelector('#listPane .pane-header');",
    "    ok(!!bar && bar.classList.contains('select-bar'),",
    "      'entering select mode marks the bar the stylesheet keeps one line tall');",
    "    const marks = bar ? bar.className.split(' ').filter(Boolean) : [];",
    "    ok(marks.length === 2 && marks.indexOf('pane-header') !== -1 && marks.indexOf('select-bar') !== -1,",
    "      'and the class list is exactly the header plus the select mark (' + (bar ? bar.className : 'no bar') + ')');",
    "    ok(doc.querySelectorAll('#listPane .pane-header .pane-actions .icon-btn').length >= 7,",
    "      'with all seven of its actions still in it');",
    "    const cancel = doc.querySelector('#selectCancelBtn');",
    '    if (cancel) cancel.click();',
    '    await wait(140);',
    "    const after = doc.querySelector('#listPane .pane-header');",
    "    ok(!!after && !after.classList.contains('select-bar'),",
    "      'and cancelling takes the mark off again');",
    "    // The Discover tab is deliberately not switched to here: showing it starts the",
    "    // chart fetch, which cannot resolve in jsdom and would leave an error in the",
    "    // boot log the next section asserts is clean. The row is static markup with a",
    "    // real click handler either way.",
    "    const wrap = doc.querySelector('#discoverSearchWrap');",
    "    const field = doc.querySelector('#discoverSearch');",
    "    const clear = doc.querySelector('#discoverSearchClear');",
    "    const go = doc.querySelector('#discoverSearchBtn');",
    "    ok(!!wrap && !!field && !!clear && !!go && field.parentElement === wrap && clear.parentElement === wrap,",
    "      'the Discover field and its clear button are one control');",
    '    if (field && clear) {',
    "      field.value = 'BK';",
    '      clear.click();',
    "      ok(field.value === '', 'and the X empties the field');",
    '    }',
    "    ok(html.indexOf('#discoverSearch:not(:placeholder-shown) + #discoverSearchClear') !== -1,",
    "      'with the stylesheet deciding whether it is on screen at all');",
    '  }',
    '',
    "  console.log('[12] the page still holds together');",
  ]),
  { key: '[11i] the select bar and the Discover search row' });

/* ============================================================ E. WHAT MUST STILL HOLD */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // The ordinary header must be exactly as it was: the modifier is scoped, and
  // the no-wrap default is what every other bar relies on.
  must(count(page, '  .pane-header{\n') === 1 && count(page, '  .pane-header-spacer{ display:none; }') === 1,
    'the ordinary pane header is not the one this release shipped');
  must(count(page, '  .pane-header.select-bar{ flex-wrap:wrap; }') === 1 &&
    count(page, '  .pane-header.select-bar > div:first-child{ flex:0 0 auto; }') === 1 &&
    count(page, '  .pane-header.select-bar h2{ white-space:nowrap; overflow-wrap:normal; word-break:normal; }') === 1 &&
    count(page, '  .pane-header.select-bar .pane-actions{ flex:1 1 auto; flex-wrap:wrap; justify-content:flex-end; }') === 1,
    'the select-bar rules are not all in place');
  must(count(page, 'pane-header.select-bar') === 4,
    'the select-bar rules leaked somewhere else in the stylesheet');
  // The Discover row.
  must(count(page, '#discoverSearchRow{ display:flex; align-items:stretch; gap:10px; padding:6px 0 12px; }') === 1,
    'the Discover row does not stretch its children');
  must(count(page, '#discoverSearchRow{ display:flex; gap:8px; padding:6px 0 12px; }') === 0,
    'the old Discover row rule survived');
  must(count(page, 'id="discoverSearchWrap"') === 1 && count(page, 'id="discoverSearch"') === 1 &&
    count(page, 'id="discoverSearchClear"') === 1 && count(page, 'id="discoverSearchBtn"') === 1,
    'the Discover row lost one of its four ids');
  must(count(page, "  <div id=\"discoverSearchWrap\">") === 1 &&
    count(page, '#discoverSearchRow #discoverSearchBtn{ flex:0 0 auto; }') === 1,
    'the Discover field is not wrapped, or the pill still grows');
  must(count(page, '#discoverSearch:not(:placeholder-shown) + #discoverSearchClear{ display:flex; }') === 1,
    'the Discover clear button is not gated on the field being empty');
  must(count(page, 'id="discoverSearchClear" type="button"') === 1 &&
    count(page, 'id="discoverSearchClear" title="Clear"') === 0,
    'the Discover clear button still carries the old square markup');
  // The 70.1.5 clear button on the library box must still be exactly as it was.
  must(count(page, '#searchInput:not(:placeholder-shown) + #searchClearBtn{ display:flex; }') === 1,
    'the library clear button moved with this release');
  // The release.
  must(count(page, "const APP_VERSION = '70.1.6';") === 1, 'the version is not 70.1.6');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '70.1.6',") === 1 && count(page, "  { version: '70.1.5',") === 1 &&
    count(page, "  { version: '70.1.4',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, '[10c] the select bar and the Discover search row') === 1,
    'the new gate rule did not land');
  must(count(studio.text, '[11i] the select bar and the Discover search row') === 1,
    'the real-app probe does not drive the two rows');
  // The 70.1.5 gates must still be there, one release behind.
  must(count(t705.text, 'the Add songs sheet is wide enough for its five buttons') === 1,
    'the 70.1.5 gate rule left with this release');
  must(count(studio.text, "[11h] the search box clears, and the sheet and the cover are real") === 1,
    'the 70.1.5 probe section left with this release');
}

if(problems.length){
  console.error('patch-7016: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7016: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7016: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7016: next `node dev/repin-7016.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
