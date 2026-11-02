#!/usr/bin/env node
// 80.7.7 - every screen has a right size.
//
// Release pins, then the fitting stylesheet AUDITED as text, because a stylesheet
// cannot be driven here: braces balanced, every rung present, no bare side padding
// that could put a song title under a hinge, no transform on the fixed dock, and no
// !important anywhere in a sheet that is supposed to be the last word by position.
// Both channels are pinned because this release lifts the Play hold.
//
//   node dev/check-8077.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.7.7';

let pass = 0;
const failures = [];
function ok(name, cond) {
  if (cond) { pass++; } else { failures.push(name); }
}

// ---- the two channel filters, copied from the bundlers ---------------------
const FULL_DROP = /(streaming|streams?\b|from the source|pinned artist)/i;
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
function fullNotes(items) {
  const shown = (items || [])
    .map((it) => (typeof it === 'string' && it.startsWith('[FULL] ')) ? it.slice(7) : it)
    .filter((it) => typeof it !== 'string' || !FULL_DROP.test(it));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}
function playNotes(items) {
  const shown = (items || [])
    .filter((it) => typeof it !== 'string' || (!it.startsWith('[FULL] ') && !hidesOnPlay(it)));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}

// ---- the release -----------------------------------------------------------
ok('the page is 80.7.7', html.includes("const APP_VERSION = '80.7.7';"));
ok('the viewport still asks for the display edges', /name="viewport"[^>]*viewport-fit=cover/.test(html));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.7 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(String(it))));
ok('the full card publishes all three notes', fullNotes(items).length === 3);
ok('the notes survive the full channel filter', fullNotes(items).every((n) => !FULL_DROP.test(n)));
ok('the Play card publishes all three notes too, because the hold is lifted',
  JSON.stringify(playNotes(items)) === JSON.stringify(items));

// ---- the fitting stylesheet, audited --------------------------------------
const open = html.indexOf('<style id="sc77Fit">');
ok('the fitting stylesheet is on the page', open > 0);
// The page keeps one <style> of its own inside the body (the lyrics backdrop), so
// the property worth pinning is that nothing else in the HEAD comes after this one.
ok('no stylesheet follows it in the head',
  html.indexOf('<style', open + 1) === -1 || html.indexOf('<style', open + 1) > html.indexOf('</head>'));
ok('it comes after the release sheet it has to overrule', open > html.indexOf('<style id="sc80Css">'));
const close = html.indexOf('</style>', open);
const css = open < 0 ? '' : html.slice(open, close);
ok('it sits before the end of the head', open > 0 && open < html.indexOf('</head>'));

let depth = 0, balanced = true;
for (const ch of css) {
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth < 0) balanced = false; }
}
ok('every rule in it is closed', balanced && depth === 0);
ok('it is a real sheet, not a stub', css.length > 3000);

const rungs = [
  ['the outer fold and the split window', '@media (max-width:380px)'],
  ['fluid side padding', '@media (min-width:561px)'],
  ['the inner fold', '@media (min-width:568px) and (max-width:1023px)'],
  ['the desktop window', '@media (min-width:1024px)'],
  ['the big monitor', '@media (min-width:1440px)'],
  ['the television', '@media (min-width:1800px) and (min-height:900px), (min-width:2400px)'],
  ['short landscape', '@media (orientation:landscape) and (max-height:520px)'],
  ['thumbs rather than cursors', '@media (pointer:coarse)']
];
rungs.forEach(([name, query]) => ok('the sheet has the rung for ' + name, css.includes(query)));

// A hinge, a notch and a rounded corner are display edges. Any side padding this
// sheet sets must be max()ed against the display inset, or it would push content
// under the hinge on the very device the rule was written for.
const paddingLines = css.split('\n').filter((l) => /padding-(left|right)\s*:/.test(l));
ok('the sheet sets side padding at all', paddingLines.length >= 5);
ok('every side padding is measured against the display inset',
  paddingLines.every((l) => /env\(safe-area-inset-(left|right)\)/.test(l)));
ok('no side padding is written as a bare shorthand that would dodge the check',
  !/padding-inline\s*:/.test(css));

// #actionStrip holds fixed children; a transform on it would make it their
// containing block and move #addSongsMenu and its backdrop with it.
ok('the dock is never transformed', !/transform\s*:/.test(css));
ok('the dock keeps its full width and clusters its buttons instead',
  /body:not\(\.sc80-cloud\) #actionStrip\{ justify-content:center/.test(css));
ok('the sheet never shouts, so every theme keeps its seat', !/!important/.test(css));
ok('the player sizes are held off the cloud theme, which scales its own',
  css.includes('body:not(.sc80-cloud) #npPlayerStage') && !/\n  #npPlayerStage\{/.test(css));
ok('the home bubble grid is held off the cloud theme too',
  !/\n  #homeBubbles\{/.test(css));
ok('text is not resized by the platform on top of the sheet',
  css.includes('-webkit-text-size-adjust:100%'));

// ---- survivors -------------------------------------------------------------
ok('80.7.6 still records what played last', html.includes('  function scLastPlayedSet(kind, id){'));
ok('80.7.6 still asks it before the bar comes back', html.includes('scLastPlayedWasStream(v,'));
ok('80.7.5 still puts the album cover on every row', html.includes('  function scAlbumRowArt(t){'));
ok('80.7.4 still judges a copy against the song', html.includes('function scStreamWhole(want, got){'));

// ---- every inline script compiles -----------------------------------------
let scripts = 0;
const rx = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = rx.exec(html))) {
  const attrs = m[1] || '';
  if (/\bsrc=/.test(attrs) || /type=["']module["']/.test(attrs)) continue;
  scripts++;
  try { new vm.Script(m[2], { filename: 'index.html#script' + scripts }); }
  catch (err) { ok('inline script ' + scripts + ' compiles: ' + err.message, false); }
}
ok('the page has inline scripts to compile', scripts > 0);
ok('every inline script compiles', failures.filter((f) => /^inline script \d+ compiles/.test(f)).length === 0);

// ---- both channels --------------------------------------------------------
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const size = (p) => fs.statSync(path.join(ROOT, p)).size;
let full = null, play = null, hold = null;
try { full = read('ota/updates.json'); } catch (e) { full = null; }
try { play = read('ota-play/updates.json'); } catch (e) { play = null; }
try { hold = read('dev/channel-hold.json'); } catch (e) { hold = null; }
ok('the full channel is v80.7.7', !!full && String(full.version) === VERSION);
ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
ok('the Play channel is NOT held any more', !!hold && hold.play === false);
ok('the Play channel is v80.7.7', !!play && String(play.version) === VERSION);
ok('the Play channel publishes the same three notes', !!play && JSON.stringify(play.notes) === JSON.stringify(playNotes(items)));
ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
let zipped = '', playZipped = '';
try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
ok('the shipped full page is 80.7.7 with the fitting sheet',
  /const APP_VERSION = '80\.7\.7';/.test(zipped) && zipped.includes('<style id="sc77Fit">'));
ok('the shipped Play page carries the same sheet and its flag',
  /const APP_VERSION = '80\.7\.7';/.test(playZipped) && playZipped.includes('<style id="sc77Fit">') && playZipped.includes('window.__PLAY_BUILD__=true'));

if (failures.length) {
  console.log('check-8077: ' + pass + ' passed, ' + failures.length + ' failed');
  failures.forEach((f) => console.log('  x ' + f));
  process.exit(1);
}
console.log('check-8077: ' + pass + ' passed, 0 failed');
