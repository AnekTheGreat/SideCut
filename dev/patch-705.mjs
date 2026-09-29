#!/usr/bin/env node
/**
 * SideCut 70.0.5 - the release patch.
 *
 * The user's request, in one message:
 *   "Remove the add songs tab from bottom and remove the refresh button from the
 *    top and replace that with a plus sign for add songs v70.0.5"
 *
 * Two controls move, and one of them was load-bearing:
 *
 *   1. the dock loses its fifth pill. `#addSongsWrap` (the pill AND the menu it
 *      opened) was a flex child of `.action-strip`, so deleting the pill alone
 *      would have left an invisible wrap still taking an equal share of the row -
 *      the wrap goes, and the MENU with it stays put.
 *   2. the header's refresh button becomes the + that opens that menu.
 *
 * The menu is deliberately left inside the dock's subtree even though its pill is
 * gone. It is position:fixed, so where it lives in the DOM does not move it on
 * screen, but `.action-strip.menu-open{ z-index:300 }` is what lifts it over the
 * now bar (#nowPlaying is z-index 20), and that only works from inside.
 *
 * Every edit is anchored and asserted, so a tree that does not match fails loudly
 * instead of being half-patched. Re-running it is a no-op.
 *
 *   node dev/patch-705.mjs            # apply
 *   node dev/patch-705.mjs --check    # report only, change nothing
 *   node dev/patch-705.mjs --manifest # re-seed root manifest.json from ota/
 *
 * Run order matters this late in a release: `node dev/patch-70.mjs` re-splices
 * dev/sc70-module.js first (it still looks for 70.0), then this bump, then
 * `node dev/ota-bundle.mjs`, then --manifest last, because the root manifest.json
 * is itself an input to the zip.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const CHECK = process.argv.includes('--check');

const VERSION = '70.0.5';
// The shell cache carries its own counter and must NOT contain the app version:
// it is what makes an installed service worker pull the new page instead of
// serving the old one out of its cache.
const SHELL_CACHE = 'sidecut-shell-v63.0.31';
// Eastern is UTC-4 and the DATE rolls back with it (see the rule at APP_VERSION).
const STAMP = 'September 28, 2026 · 10:06 PM EDT';

if(process.argv.includes('--manifest')){
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  if(String(upd.version) !== VERSION){
    console.error('patch-705 --manifest: ota/updates.json is v' + upd.version + ', expected v' + VERSION + ' - run `node dev/ota-bundle.mjs` first');
    process.exit(1);
  }
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-705 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let html = fs.readFileSync(IDX, 'utf8');
const start = html;
let applied = 0, already = 0;
const problems = [];

function count(hay, needle){ return hay.split(needle).length - 1; }

function sub(label, oldStr, newStr, opts = {}){
  const times = count(html, oldStr);
  if(opts.all){
    // A global rewrite: the anchor being gone IS this step having run.
    if(times === 0){ already++; return; }
  } else if(opts.key && count(html, opts.key) >= 1){
    already++;
    return;
  } else if(!opts.key && newStr && count(html, newStr) >= 1){
    already++;
    return;
  }
  if(times === 0){
    problems.push(`anchor missing (${label})`);
    return;
  }
  if(times > 1 && !opts.all && !opts.first){
    problems.push(`anchor is not unique, found ${times} (${label})`);
    return;
  }
  html = opts.all ? html.split(oldStr).join(newStr) : html.replace(oldStr, newStr);
  applied++;
}

function must(cond, what){ if(!cond) problems.push(what); }

/* ------------------------------------------------------------------ 1. version */
sub('version',
  "  const APP_VERSION = '70.0';",
  "  const APP_VERSION = '70.0.5';",
  { all: true });

/* --------------------------------------------------------------- 2. changelog */
// The key is the version line, not the notes: a step that recognises its work by
// its own prose stops recognising it the moment the prose is reworded.
sub('changelog head',
  "  const CHANGELOG = [\n  { version: '70.0', date: 'September 28, 2026 · 7:39 PM EDT'",
  "  const CHANGELOG = [\n" +
  "  { version: '70.0.5', date: '" + STAMP + "', title: 'Add songs moves to the top of the screen, and the dock drops to four tabs', items: [\n" +
  "    'Add songs is a + at the top of the screen now, beside the notifications bell, and it opens exactly the menu it always did: your files, a whole folder, importing a backup, and both exports.',\n" +
  "    'The bottom dock is four tabs - Home, Library/Albums, Discover and Studio - so every one of them gets a little more room, and the row stays even at every screen width.',\n" +
  "    'The header refresh button is gone, because the + that takes its place is the control you reach for far more often. SideCut still reloads itself the moment an update installs.',\n" +
  "    'The how-to text that pointed at the old dock pill now just names the Add songs menu, since there is no pill down there to tap any more.',\n" +
  "  ] },\n" +
  "  { version: '70.0', date: 'September 28, 2026 · 7:39 PM EDT'",
  { key: "version: '70.0.5'" });

/* ------------------------------------------------------ 3. the header plus (+)*/
// The refresh button's own slot, its own class and its own flex-shrink: only the
// id, the tooltip and the glyph change, so the header cannot drift apart.
sub('header plus button',
  '    <button class="icon-btn" id="refreshBtn" title="Refresh app" style="flex-shrink:0;">',
  '    <button class="icon-btn" id="addSongsBtn" title="Add songs" style="flex-shrink:0;">',
  { all: true });

sub('header plus glyph',
  '<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>',
  '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>',
  { all: true });

/* --------------------------------------------- 4. the dock loses its fifth pill */
// The pill AND its wrap: the wrap is a flex child of the strip, so leaving it
// behind would keep an equal share of the row for nothing.
sub('dock drops the add-songs pill',
  '  <div id="addSongsWrap" class="add-songs-wrap">\n' +
  '    <button id="addSongsToggle" class="action-pill">+ Add songs ▾</button>\n',
  '',
  { all: true });

// ...and the wrap's own closing tag, which would otherwise close the strip early.
sub('dock tag balance',
  '    </div>\n  </div>\n</div>\n\n<input type="file" id="importLibInput">',
  '    </div>\n</div>\n\n<input type="file" id="importLibInput">',
  { all: true });

/* --------------------------------------------------------- 5. the dock's styles */
sub('dock styles',
  '.add-songs-wrap{ position:relative; flex-shrink:0; }\n' +
  '  /* Foldables / tablets: the other action-strip pills stretch with flex:1 while\n' +
  '     this wrap was content-width, so + Add songs looked tiny next to them.\n' +
  '     Grow it exactly like its siblings, and let the pill fill it. */\n' +
  '  .add-songs-wrap{ position:relative; flex:1 1 0; min-width:0; }\n' +
  '  #addSongsToggle{ width:100%; }',
  '  /* 70.0.5: the pill left the dock for the header +, so the wrap and its\n' +
  '     sizing rules are gone with it. The menu stays where it was (inside the\n' +
  '     strip) because it is position:fixed and gets its height over the now bar\n' +
  '     from .action-strip.menu-open, not from its old parent. */',
  { all: true });

/* ------------------------------------------------------------------- 6. wiring */
sub('open from the header',
  "  $('addSongsToggle').addEventListener('click', (e) => {",
  "  $('addSongsBtn').addEventListener('click', (e) => {",
  { all: true });

// The refresh button is gone, so its reload wiring is dead code that reads an id
// that no longer exists - exactly what dev/check-dom.mjs exists to catch.
sub('drop the refresh wiring',
  "try{ if(document.getElementById('refreshBtn') && !document.getElementById('refreshBtn')._scRefreshWired){ var _rb = document.getElementById('refreshBtn'); _rb._scRefreshWired = true; _rb.addEventListener('click', function(){ try{ window.location.reload(); }catch(e){ document.location.reload(); } }); } }catch(e){}",
  "/* 70.0.5: the header refresh button is gone - the + that replaced it opens Add songs. */",
  { all: true });

// Neither name is a dock item any more. The reorder path only ever moves an
// element whose parent is the strip, so a saved order that still lists the old
// pill is inert - but a default order that names one is a lie to the next reader.
sub('default strip order',
  "  let actionPillOrder = ['homeBtn', 'libraryBtn', 'discoverBtn', 'addSongsToggle']; // strip items in default order",
  "  // 70.0.5: four items - the add-songs pill left the dock for the header +.\n" +
  "  let actionPillOrder = ['homeBtn', 'libraryBtn', 'discoverBtn', 'studioBtn']; // strip items in default order",
  { all: true });

sub('reset strip order',
  "    actionPillOrder = ['homeBtn', 'libraryBtn', 'discoverBtn', 'addSongsToggle'];",
  "    actionPillOrder = ['homeBtn', 'libraryBtn', 'discoverBtn', 'studioBtn'];",
  { all: true });

sub('strip item list',
  "    return Array.from(strip.children).filter(el => el.classList.contains('action-pill') || el.id === 'addSongsWrap');",
  "    return Array.from(strip.children).filter(el => el.classList.contains('action-pill'));",
  { all: true });

/* --------------------------------------------- 7. the copy that pointed at it */
// The pill said "+ Add songs ▾". The caret is the glyph for "this opens a menu",
// and there is no longer anything on screen wearing it; the words keep working
// because the + it moved to is titled Add songs and the menu is still titled it.
sub('copy drops the caret',
  '+ Add songs ▾',
  '+ Add songs',
  { all: true });

/* ------------------------------------------------------------------- 8. checks */
must(count(html, "const APP_VERSION = '70.0.5';") === 1, 'the version is not 70.0.5');
must(count(html, "version: '70.0.5'") === 1, 'the changelog has no 70.0.5 entry (' + count(html, "version: '70.0.5'") + ')');
must(count(html, "  { version: '70.0', date: 'September 28, 2026 · 7:39 PM EDT'") === 1, 'the 70.0 entry did not survive');
must(count(html, 'id="addSongsBtn"') === 1, 'there is no header + (' + count(html, 'id="addSongsBtn"') + ')');
must(count(html, 'id="refreshBtn"') === 0, 'the refresh button is still there');
must(count(html, 'id="addSongsToggle"') === 0, 'the dock still has the add-songs pill');
must(count(html, 'id="addSongsWrap"') === 0, 'the dock still has the add-songs wrap');
must(count(html, 'id="addSongsMenu"') === 1, 'the menu did not survive the move');
must(count(html, 'id="addSongsBackdrop"') === 1, 'the backdrop did not survive the move');
must(count(html, '+ Add songs ▾') === 0, 'a caret survived (' + count(html, '+ Add songs ▾') + ')');
must(count(html, "  $('addSongsBtn').addEventListener('click'") === 1, 'the + is not wired to the menu');
must(count(html, "getElementById('refreshBtn')") === 0, 'something still reads the refresh button');
must(count(html, 'id="sc-studio-70"') === 1, 'the Studio block is missing');

// The dock itself: four pills, in order. The slice stops at the backdrop on
// purpose - the menu that sits inside the dock's own subtree has five buttons
// that wear .action-pill as well, and they are not dock tabs.
const strip = html.slice(html.indexOf('<div class="action-strip" id="actionStrip">'), html.indexOf('<div id="addSongsBackdrop"'));
const pills = (strip.match(/<button id="([A-Za-z0-9_]+)" class="action-pill"/g) || []);
must(pills.length === 4, 'the dock has ' + pills.length + ' pill(s), not 4');
['homeBtn', 'libraryBtn', 'discoverBtn', 'studioBtn'].forEach((id, i) => {
  must(pills[i] === `<button id="${id}" class="action-pill"`, 'dock pill ' + (i + 1) + ' is not ' + id + ' (' + pills[i] + ')');
});

if(problems.length){
  console.error('patch-705: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

const note = already ? ', ' + already + ' already in place' : '';
if(CHECK){
  console.log('patch-705: ' + (applied ? applied + ' edit(s) would be applied' : 'tree is already at 70.0.5') + note);
  process.exit(0);
}

if(html === start){
  console.log('patch-705: nothing to do, index.html is already patched' + note);
} else {
  fs.writeFileSync(IDX, html);
  console.log('patch-705: index.html patched (' + applied + ' edit(s)' + note + ')');
}

/* --------------------------------------------------------------------- sw.js */
try{
  const sw = fs.readFileSync(SW, 'utf8');
  const m = sw.match(/const CACHE_NAME = '([^']+)';/);
  if(m && m[1] !== SHELL_CACHE){
    fs.writeFileSync(SW, sw.replace(m[0], "const CACHE_NAME = '" + SHELL_CACHE + "';"));
    console.log('patch-705: sw.js cache ' + m[1] + ' -> ' + SHELL_CACHE);
  } else if(m){
    console.log('patch-705: sw.js cache already ' + SHELL_CACHE);
  } else {
    console.error('patch-705: could not find CACHE_NAME in sw.js');
  }
}catch(e){
  console.error('patch-705: sw.js not updated (' + e.message + ')');
}
