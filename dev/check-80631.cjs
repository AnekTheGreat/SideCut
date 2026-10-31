#!/usr/bin/env node
// 80.6.31 - the rail is on every version, and the notes only mention the app.
//
//   node dev/check-80631.cjs      (run from the repository root)
//
// The release moves two things: which parts of the rail are built (the three page
// glyphs everywhere, the source switch only where there is a source), and the
// changelog. The second half of this file opens the published bundles and checks
// what each channel actually hands out, because a page that is right in the repo
// and wrong in the zip is the failure that matters.
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
ok(page.includes("const APP_VERSION = '80.6.31';"), 'the page runs 80.6.31');
const at = page.indexOf("version: '80.6.31'");
ok(at > 0, 'the changelog records 80.6.31');
ok(at < page.indexOf("version: '80.6.29'"), 'and 80.6.31 is the newest entry in it');
ok(!page.includes("version: '80.6.30'"), 'the channel catch-up entry is gone, not reworded');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
ok(entry.includes("title: 'Playlists and albums on the rail'"), 'and a title that names the new thing');
const items = (entry.slice(entry.indexOf('items: [')).match(/'[^']*'/g) || []).map((s) => s.slice(1, -1));
ok(items.length === 3, 'three notes (' + items.length + ')');
ok(!items.some((i) => i.startsWith('[FULL] ')), 'none of them is kept back from a build');
ok(!items.some((i) => /both builds|each build|catch-?up|this build|other build|channel/i.test(i)),
  'and no note talks about the release channels instead of the app');
ok(items.some((i) => /Playlists opens the playlist strip/.test(i)), 'one of them says where Playlists goes');

/* -- the rail: three glyphs everywhere, one switch where there is a source -- */
const render = page.slice(page.indexOf('function scShelfRender()'), page.indexOf('function scShelfMark()'));
ok(!/if\(!SC_STREAM_OK\)\s*return/.test(render), 'scShelfRender paints the rail without asking about the source');
ok(render.includes("var pages = [['library', 'Songs', 'list'], ['playlists', 'Playlists', 'plist'], ['albums', 'Albums', 'grid']]"),
  'and builds all three page glyphs');
const sep = page.indexOf("h += '<div class=\"scshelf-sep\"></div>';");
ok(sep > 0 && page.slice(sep - 700, sep).includes('THE SWITCH NEEDS A SOURCE'),
  'the separator and the switch are introduced by the gate comment');
ok(sep > 0 && page.slice(sep - 120, sep).includes('if(SC_STREAM_OK){'),
  'and the separator and the switch sit inside the source gate');
const boot = page.slice(page.indexOf('function scShelfBoot()'), page.indexOf('function formatSyncedLyrics'));
ok(!/if\(!SC_STREAM_OK\)\s*return/.test(boot), 'scShelfBoot builds the rail without a source');
const apply = page.slice(page.indexOf('function scShelfApply()'), page.indexOf('function scShelfBoot()'));
ok(!/^\s*if\(!SC_STREAM_OK\)\s*return/m.test(apply.slice(0, 200)), 'scShelfApply paints a device page without a source');
ok(apply.includes("if(scShelf.src === 's' && SC_STREAM_OK)"), 'and never opens the sheet where there is no source');
const openTab = page.slice(page.indexOf('function scShelfOpenTab(tab)'), page.indexOf('function scShelfSetSrc'));
ok(/if\(tab === 'streaming'\)\{\s*if\(!SC_STREAM_OK\)\s*return;/.test(openTab), 'only the streaming destination stays gated');
ok(page.slice(page.indexOf('function scShelfSetSrc'), page.indexOf('function scShelfApply'))
  .includes('if(!SC_STREAM_OK) return;'), 'the switch itself is still gated');
ok(page.slice(page.indexOf('function scStreamBoot('), page.indexOf('// 80.6.9 - the streaming block waits'))
  .includes('if(!SC_STREAM_OK) return;                 // a Play build never even builds the block'),
  'the streaming block still does not exist without a source');
ok(!page.includes("if(card && typeof SC_STREAM_OK !== 'undefined' && !SC_STREAM_OK) card.style.display = 'none';"),
  'Tools offers the rail setting on every version');

/* -- what each channel publishes ------------------------------------ */
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
const playNotes = items.filter((i) => !i.startsWith('[FULL] ') && !hidesOnPlay(i));
ok(playNotes.length === 3, 'the Play channel publishes all three notes (' + playNotes.length + ')');

const rootMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
ok(String(rootMan.version) === '80.6.31', 'ota/updates.json is 80.6.31 (' + rootMan.version + ')');
ok(Array.isArray(rootMan.notes) && rootMan.notes.length === 3, 'with three notes (' + (rootMan.notes || []).length + ')');

const playMan = path.join(ROOT, 'ota-play', 'updates.json');
const playZip = path.join(ROOT, 'ota-play', 'update.zip');
ok(fs.existsSync(playMan), 'the Play channel has a manifest');
if (fs.existsSync(playMan)) {
  const man = JSON.parse(fs.readFileSync(playMan, 'utf8'));
  ok(String(man.version) === '80.6.31', 'ota-play/updates.json is 80.6.31 (' + man.version + ')');
  ok(Array.isArray(man.notes) && man.notes.length === 3, 'with the three notes this build publishes (' + (man.notes || []).length + ')');
  ok(man.size === (fs.existsSync(playZip) ? fs.statSync(playZip).size : -1), 'and its size matches the zip beside it');
}
if (fs.existsSync(playZip)) {
  const zipped = execFileSync('unzip', ['-p', playZip, 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(zipped.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'the bundle carries the Play flag');
  ok(/const APP_VERSION = '80\.6\.31';/.test(zipped), 'and the page inside it is 80.6.31');
  ok(zipped.includes('<button id="libraryBtn" class="action-pill">Library</button>'), 'the dock is one Library pill there too');
  ok(/if\(scShelf\.src === 's' && SC_STREAM_OK\)/.test(zipped), 'and the page in the zip can paint the rail without a source');
  ok(/if\(tab === 'streaming'\)\{\s*if\(!SC_STREAM_OK\) return;/.test(zipped), 'while its streaming destination still refuses');
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
  console.log('check-80631: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80631: %d passed, 0 failed', pass);
