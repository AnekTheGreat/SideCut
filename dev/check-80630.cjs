#!/usr/bin/env node
// 80.6.30 - the Play build catches up.
//
//   node dev/check-80630.cjs      (run from the repository root)
//
// The release changes no behaviour, so this checks the three things it does change:
// the version, the changelog entry (and what the Play channel publishes from it),
// and the hold whose deletion is the point of the release. It also opens the
// published Play bundle and proves it carries this version and its own flag.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

/* -- the release is recorded ---------------------------------------- */
ok(page.includes("const APP_VERSION = '80.6.30';"), 'the page runs 80.6.30');
const at = page.indexOf("version: '80.6.30'");
ok(at > 0, 'the changelog records 80.6.30');
ok(at < page.indexOf("version: '80.6.29'"), 'and 80.6.30 is the newest entry in it');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
ok(entry.includes("title: 'The Play build catches up'"), 'and a title that says what it does');
const items = (entry.slice(entry.indexOf('items: [')).match(/'[^']*'/g) || []).map((s) => s.slice(1, -1));
ok(items.length === 4, 'four notes (' + items.length + ')');
ok(items.filter((i) => i.startsWith('[FULL] ')).length === 1, 'one of them belongs to the full build alone');
ok(!/80\.6\.(?:1[3-9]|2[0-8])\b/.test(items.join(' ')), 'no note names a build number');

/* -- what this channel publishes is filtered the way the page filters it -- */
// A port of hidesOnPlay from dev/ota-bundle-play.mjs and of changelogItems from
// index.html: a [FULL] note belongs to the other build, and a note about the
// downloader or the source is not a note the Play build can publish.
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
const playNotes = items.filter((i) => !i.startsWith('[FULL] ') && !hidesOnPlay(i));
ok(playNotes.length === 3, 'the Play channel publishes three of the four notes (' + playNotes.length + ')');
ok(!playNotes.some((i) => /rail|Tools/i.test(i)), 'and the note about the rail is not one of them');
ok(playNotes.some((i) => /Both builds publish/.test(i)), 'the catch-up itself is published on both channels');

/* -- the hold is lifted --------------------------------------------- */
const holdPath = path.join(ROOT, 'dev', 'channel-hold.json');
let hold = null;
if (fs.existsSync(holdPath)) {
  try { hold = JSON.parse(fs.readFileSync(holdPath, 'utf8')); } catch (_e) { hold = { unreadable: true }; }
}
ok(!hold || !hold.play, 'dev/channel-hold.json no longer holds the Play channel');
ok(!/80\.6\.30/.test(fs.readFileSync(path.join(ROOT, 'dev', 'ota-bundle-play.mjs'), 'utf8')) ||
  fs.readFileSync(path.join(ROOT, 'dev', 'ota-bundle-play.mjs'), 'utf8').includes('HOLD_FILE'),
  'dev/ota-bundle-play.mjs still reads the hold file, so a future hold is data again');

/* -- the Play channel actually published this release ---------------- */
const playMan = path.join(ROOT, 'ota-play', 'updates.json');
const playZip = path.join(ROOT, 'ota-play', 'update.zip');
ok(fs.existsSync(playMan), 'the Play channel has a manifest');
if (fs.existsSync(playMan)) {
  const man = JSON.parse(fs.readFileSync(playMan, 'utf8'));
  ok(String(man.version) === '80.6.30', 'ota-play/updates.json is 80.6.30 (' + man.version + ')');
  ok(Array.isArray(man.notes) && man.notes.length === 3, 'with the three notes this build publishes (' + (man.notes || []).length + ')');
  ok(man.size === (fs.existsSync(playZip) ? fs.statSync(playZip).size : -1), 'and its size matches the zip beside it');
}
if (fs.existsSync(playZip)) {
  const zipped = execFileSync('unzip', ['-p', playZip, 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(zipped.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'the bundle carries the Play flag');
  ok(/const APP_VERSION = '80\.6\.30';/.test(zipped), 'and the page inside it is 80.6.30');
  ok(zipped.includes('<button id="libraryBtn" class="action-pill">Library</button>'), 'the dock is one Library pill there too');
  ok(zipped.indexOf("if(!SC_STREAM_OK) return;") > 0, 'and the rail is still gated off in it');
}

/* -- the page still parses ----------------------------------------- */
{
  const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1]));
  let failing = 0;
  for (const s of scripts) {
    try { new vm.Script(s[2]); } catch (_e) { failing++; }
  }
  ok(scripts.length === 7, 'seven inline scripts (' + scripts.length + ')');
  ok(failing === 0, 'all seven inline scripts compile (' + failing + ' fail)');
}

if (bad.length) {
  console.log('check-80630: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80630: %d passed, 0 failed', pass);
