#!/usr/bin/env node
// 80.7.8 - phones keep their own layout.
//
// The point of this release is what the stylesheet does NOT contain: no rule that
// hides the line under the title, no rule that changes a target size on a phone,
// and no query that a phone can match. So the checker enumerates every @media in
// the sheet and pins the exact five allowed, then looks for the specific rules
// 80.7.7 shipped and had to take back.
//
//   node dev/check-8078.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.7.8';

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
ok('the page is 80.7.8', html.includes("const APP_VERSION = '80.7.8';"));
ok('the viewport still asks for the display edges', /name="viewport"[^>]*viewport-fit=cover/.test(html));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.8 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(it)));
ok('the entry sits above 80.7.7, not below it',
  entries.findIndex((e) => String(e.version) === VERSION) < entries.findIndex((e) => String(e.version) === '80.7.7'));
ok('the full card publishes all three notes', fullNotes(items).length === 3);
ok('the notes survive the full channel filter', fullNotes(items).every((n) => !FULL_DROP.test(n)));
ok('the Play card publishes all three notes too', JSON.stringify(playNotes(items)) === JSON.stringify(items));

// ---- the fitting stylesheet, audited --------------------------------------
const open = html.indexOf('<style id="sc77Fit">');
ok('the fitting stylesheet is on the page', open > 0);
ok('no stylesheet follows it in the head',
  html.indexOf('<style', open + 1) === -1 || html.indexOf('<style', open + 1) > html.indexOf('</head>'));
ok('it comes after the release sheet it has to overrule', open > html.indexOf('<style id="sc80Css">'));
const close = html.indexOf('</style>', open);
const css = open < 0 ? '' : html.slice(open, close);
ok('it sits before the end of the head', open > 0 && open < html.indexOf('</head>'));
ok('it is the 80.7.8 sheet', css.includes('80.7.8 - PHONES KEEP THEIR OWN LAYOUT'));

let depth = 0, balanced = true;
for (const ch of css) {
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth < 0) balanced = false; }
}
ok('every rule in it is closed', balanced && depth === 0);

// THE PHONE IS NOT THIS SHEET'S BUSINESS.
ok('the line under the title is never hidden',
  !/\.brand span\{[^}]*display\s*:\s*none/.test(css) && !/\.brand span\s*\{[^}]*display\s*:\s*none/.test(css));
ok('no rule is keyed to a coarse pointer', !/pointer\s*:\s*coarse/.test(css));
ok('no rule is keyed to a phone-width breakpoint', !/max-width:\s*(3|4|5)[0-9]{2}px/.test(css));
ok('no rule is keyed to a short screen', !/max-height\s*:/.test(css));

// Every query must be one of the five wide-screen rungs, and every one of them
// except the television must be at least 561 wide and 521 tall - so a phone held
// sideways cannot match it.
const queries = (css.match(/@media[^{]+/g) || []).map((q) => q.replace(/^@media\s*/, '').trim());
const WIDE = [
  '(min-width:561px) and (min-height:521px)',
  '(min-width:568px) and (max-width:1023px) and (min-height:521px)',
  '(min-width:1024px)',
  '(min-width:1440px)',
  '(min-width:1800px) and (min-height:900px), (min-width:2400px)'
];
ok('the sheet has exactly five queries', queries.length === 5);
WIDE.forEach((q) => ok('the sheet keeps the rung ' + q, queries.includes(q)));
ok('no query is anything other than those five', queries.every((q) => WIDE.includes(q)));
// A sideways phone is 561-1023 wide and under 521 tall, so it is exactly those two
// rungs that have to carry the floor. The desktop rungs start above any phone.
ok('the two rungs a sideways phone could match carry the height floor',
  queries.filter((q) => /min-width:(561|568)px/.test(q)).every((q) => /min-height:521px/.test(q)));

// The sizes 80.7.7 changed on a phone, and where they are allowed to live now.
const tvAt = css.indexOf('@media (min-width:1800px) and (min-height:900px)');
const playerButtonAt = css.indexOf('#npControls button');
ok('the player buttons are resized for a television only', playerButtonAt > tvAt && tvAt > 0);
ok('the player stage is resized for a television only',
  css.split('#npPlayerStage').length - 1 === 1 && css.indexOf('#npPlayerStage') > tvAt);
ok('the dock only becomes a cluster on a desktop',
  css.indexOf('#actionStrip{ justify-content:center') > css.indexOf('@media (min-width:1024px)'));

// What the sheet must still do, because it is the reason it exists at all.
const paddingLines = css.split('\n').filter((l) => /padding-(left|right)\s*:/.test(l));
ok('the sheet sets side padding at all', paddingLines.length >= 5);
ok('every side padding is measured against the display inset',
  paddingLines.every((l) => /env\(safe-area-inset-(left|right)\)/.test(l)));
ok('no side padding is written as a bare shorthand that would dodge that',
  !/padding-inline\s*:/.test(css));
ok('the dock is never transformed', !/transform\s*:/.test(css));
ok('the sheet never shouts, so every theme keeps its seat', !/!important/.test(css));
ok('the bubble grid is held off the cloud theme, which scales its own', !/\n  #homeBubbles\{/.test(css));
ok('text is not resized by the platform on top of the sheet', css.includes('-webkit-text-size-adjust:100%'));

// ---- survivors -------------------------------------------------------------
ok('80.7.7 still has its entry', entries.some((e) => String(e.version) === '80.7.7'));
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

// ---- both channels ---------------------------------------------------------
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const size = (p) => fs.statSync(path.join(ROOT, p)).size;
let full = null, play = null, hold = null;
try { full = read('ota/updates.json'); } catch (e) { full = null; }
try { play = read('ota-play/updates.json'); } catch (e) { play = null; }
try { hold = read('dev/channel-hold.json'); } catch (e) { hold = null; }
ok('the full channel is v80.7.8', !!full && String(full.version) === VERSION);
ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
ok('the Play channel is not held', !!hold && hold.play === false);
ok('the Play channel is v80.7.8', !!play && String(play.version) === VERSION);
ok('the Play channel publishes the same three notes', !!play && JSON.stringify(play.notes) === JSON.stringify(playNotes(items)));
ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
let zipped = '', playZipped = '';
try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
// The page has always carried a (pointer:coarse) rule of its own, so the audit of the
// shipped bytes is scoped to this sheet - the question is what THIS sheet does to a
// phone, not what the app already did before this release.
function sheetOf(page) {
  const s = page.indexOf('<style id="sc77Fit">');
  if (s < 0) return '';
  return page.slice(s, page.indexOf('</style>', s));
}
const fullSheet = sheetOf(zipped), playSheet = sheetOf(playZipped);
function phoneFree(sheet) {
  return sheet.length > 1000 &&
    !/pointer\s*:\s*coarse/.test(sheet) &&
    !/brand span\s*\{[^}]*display\s*:\s*none/.test(sheet) &&
    !/max-width:\s*(3|4|5)[0-9]{2}px/.test(sheet) &&
    !/max-height\s*:/.test(sheet);
}
ok('the shipped full page is 80.7.8 with a sheet that leaves phones alone',
  /const APP_VERSION = '80\.7\.8';/.test(zipped) && phoneFree(fullSheet));
ok('the shipped Play page is the same page with its flag, and the same sheet',
  /const APP_VERSION = '80\.7\.8';/.test(playZipped) &&
  playZipped.includes('window.__PLAY_BUILD__=true') && phoneFree(playSheet) &&
  playSheet === fullSheet);

if (failures.length) {
  console.log('check-8078: ' + pass + ' passed, ' + failures.length + ' failed');
  failures.forEach((f) => console.log('  x ' + f));
  process.exit(1);
}
console.log('check-8078: ' + pass + ' passed, 0 failed');
