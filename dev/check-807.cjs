#!/usr/bin/env node
// 80.7 - a collab is a drop, a fake release can be deleted, and the album
// sheet opens in two seconds.
//
//   node dev/check-807.cjs        (run from the repository root)
//
// The two things this release promises that a string search cannot prove are
// run, not read: the credit test is executed against real collaboration strings,
// and the delete is executed against a stored release that sits under two artist
// keys - which is the case that used to come back on the next paint.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }
function slice(from, to, what) {
  const a = page.indexOf(from);
  ok(a > 0, what + ' is on the page');
  if (a < 0) return '';
  const b = page.indexOf(to, a);
  ok(b > a, what + ' is closed');
  return b > a ? page.slice(a, b) : '';
}

/* -- the release is recorded ------------------------------------------------ */
ok(page.includes("const APP_VERSION = '80.7';"), 'the page runs 80.7');
const at = page.indexOf("version: '80.7'");
ok(at > 0, 'the changelog records 80.7');
ok(at < page.indexOf("version: '80.6.32'"), 'and 80.7 is the newest entry in it');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
ok(entry.includes("title: 'Collabs filed under the other artist, a fake release you can delete, and the reorder sheet in two seconds'"),
  'and a title that names what changed');
const items = (entry.slice(entry.indexOf('items: [')).match(/'((?:[^'\\]|\\.)*)'/g) || []).map(s => s.slice(1, -1));
ok(items.length >= 3, 'three notes (' + items.length + ')');
ok(!items.some(i => i.startsWith('[FULL] ')), 'none of them is kept back from a build');
ok(!items.some(i => /both builds|each build|catch-?up|this build|other build|release channel|play store|sideload/i.test(i)),
  'and no note talks about release channels instead of the app');

/* -- a credit is a list of names -------------------------------------------- */
const collab = slice('window.__scActWords =', '// Drop the remixes and covers already stored on the device', 'the artist-name test') +
  '\n' +
  slice('  function scCreditNames(credit){', '      return window.__scSameArtistName(n, want);', 'the credit helpers') +
  '\n      return window.__scSameArtistName(n, want);\n    });\n  }\n';
ok(page.includes('      return window.__scSameArtistName(n, want);'), 'the credit test asks the app\'s own name test');
const collabBox = { window: {} };
vm.createContext(collabBox);
vm.runInContext(collab + '\nthis.has = scCreditHas; this.names = scCreditNames;', collabBox);
const has = collabBox.has;
ok(typeof has === 'function', 'the credit test is defined');
if (typeof has === 'function') {
  ok(has('Daddy Yankee & Diljit Dosanjh', 'Diljit Dosanjh'), 'a collab credited second is the pinned artist\'s drop');
  ok(has('Daddy Yankee & Diljit Dosanjh', 'Daddy Yankee'), 'and it is the first artist\'s drop too');
  ok(has('Daddy Yankee, Diljit Dosanjh', 'Diljit Dosanjh'), 'a comma credit counts');
  ok(has('Daddy Yankee feat. Diljit Dosanjh', 'Diljit Dosanjh'), 'a featured credit counts');
  ok(has('Daddy Yankee ft. Diljit Dosanjh', 'Diljit Dosanjh'), 'an ft. credit counts');
  ok(has('Diljit Dosanjh x Daddy Yankee', 'Daddy Yankee'), 'an x credit counts');
  ok(has('diljit dosanjh', 'Diljit Dosanjh'), 'a single artist still counts');
  ok(!has('Karan Aujla Tribute Band', 'Karan Aujla'), 'a tribute band is still not the artist');
  ok(!has('Daddy Yankee', 'Diljit Dosanjh'), 'and a different artist is not a match');
  ok(!has('', 'Diljit Dosanjh'), 'an empty credit matches nobody');
  ok(collabBox.names('Daddy Yankee & Diljit Dosanjh').length === 2, 'a credit splits into both names');
}

ok(page.includes("scCreditHas(r.artistName || '', artist));"), 'the song pass asks any credited name');
ok(!page.includes("primaryArtistName(r.artistName || '').toLowerCase().trim() === primaryArtistName(artist).toLowerCase().trim()"),
  'and no longer compares only the first name');
ok(page.includes("if(!scCreditHas(r.artistName || '', artist)) return;"), 'the album pass asks any credited name too');
ok(!page.includes('if(!window.__scSameArtistName(rArtist, pArtist)) return;'), 'the album pass no longer compares only the first name');
ok(page.includes('function primaryArtistName(name){'), 'the first-name helper stays for the places that want a lead artist');

/* -- a fake release is deleted on purpose ----------------------------------- */
ok(page.includes("data-title=\"${escapeHtml(rel.title)}\" data-date=\"${escapeHtml(rel.date || '')}\""),
  'a release row carries the day it is filed under');
ok(!page.includes("}, 600);\n      });\n      row.addEventListener('pointerup'"), 'the six-hundred-millisecond hold is gone');
ok(!page.includes('_nrHoldTimers'), 'and its timer with it');
ok(page.includes('    scWireReleaseHold();'), 'the release list installs the hold');

const hold = slice('  function scWireReleaseHold(){', '    document.addEventListener(\'click\', function(e){');
ok(hold.includes('}, 2000);'), 'the hold is two seconds');
ok(page.includes("'.new-release-row[data-title], .hb-track-row[data-date][data-release-title], #discPopupBody .dp-track[data-title][data-date]'"),
  'one hold serves the list, the Home bubble and the popup');
ok(hold.includes("if(!scRelCopies(rel).length) return;"), 'a row that is not a stored release deletes nothing');
ok(hold.includes('target._scHoldAte = true;'), 'and the tap that ends the hold is swallowed');
ok(hold.includes('scRelAskDelete(rel);'), 'the sheet is what the hold opens');
ok(page.includes('function scRelAskDelete(rel){'), 'the sheet exists');
ok(page.includes("delBtn.textContent = 'Delete';"), 'and it has a Delete button');
ok(page.includes("body.textContent = String(rel.title || '') + ' leaves New Releases on this device."),
  'it says what Delete does, and what it does not');

const del = slice('  function scRelCopies(rel){', '  // The sheet the hold earns');
const normFns = slice('  function scNormRelTitle(v){', '  function findPinnedRelease', 'the title normaliser');
const keyFns = slice('  function scReleaseKey(r){', '  // The drops this check may announce', 'the release key');
// The key reads the day through window.__scDay10, which lives on the page's own
// window; the sandbox gives it the same answer (the first ten characters).
const keySrc = normFns.slice(0, normFns.lastIndexOf('}') + 1) + '\n' + keyFns.slice(0, keyFns.lastIndexOf('}') + 1);
const box = { window: {}, console, setTimeout };
box.window.__scDay10 = function(v){ return String(v == null ? '' : v).slice(0, 10); };
box.pinnedReleases = {
  'Diljit Dosanjh': [
    { title: 'Loco', date: '2026-10-20' },
    { title: 'Ghost', date: '2026-10-25' },
  ],
  'Daddy Yankee': [
    { title: 'Loco', date: '2026-10-20' },
  ],
};
let saved = 0, undone = null, msg = '', repaints = 0;
Object.assign(box, {
  savePinnedArtists() { saved++; },
  toastWithUndo(m, fn) { msg = m; undone = fn; },
  renderNewReleases() { repaints++; },
  renderHome() { repaints++; },
  scRepaintOpenReleasePanel() { repaints++; },
  updateNotifBadge() { repaints++; },
});
vm.createContext(box);
let delLoaded = true;
try { vm.runInContext(keySrc + '\n' + del + '\nthis.del = scRelDelete; this.copies = scRelCopies;', box); }
catch (_e) { delLoaded = false; }
ok(delLoaded, 'the delete loads on its own');
ok(typeof box.del === 'function', 'the delete is defined');
if (typeof box.del === 'function') {
  ok(box.copies({ title: 'Loco', date: '2026-10-20' }).length === 2, 'a fillable release is found under both keys');
  ok(box.del({ title: 'Loco', date: '2026-10-20' }) === true, 'Delete removes it');
  ok(box.pinnedReleases['Diljit Dosanjh'].length === 1 && box.pinnedReleases['Diljit Dosanjh'][0].title === 'Ghost',
    'from the artist it was painted under');
  ok(box.pinnedReleases['Daddy Yankee'].length === 0, 'and from the other artist key it was stored under');
  ok(saved === 1, 'the snapshot is written once');
  ok(repaints === 4, 'and every release surface is repainted (' + repaints + ')');
  ok(/^Deleted "Loco" from New Releases\.$/.test(msg), 'it says what it deleted');
  ok(typeof undone === 'function', 'with an Undo');
  if (typeof undone === 'function') {
    undone();
    ok(box.pinnedReleases['Daddy Yankee'].length === 1, 'Undo puts the copy under the other artist back');
    ok(box.pinnedReleases['Diljit Dosanjh'].length === 2, 'and the copy under the painted artist');
    ok(box.pinnedReleases['Diljit Dosanjh'][0].title === 'Ghost', 'in date order');
  }
  ok(box.del({ title: 'Nothing stored', date: '2026-10-20' }) === false, 'a release that is not stored deletes nothing');
}

/* -- the album sheet opens in two seconds, on the song held ----------------- */
ok(page.includes('  var HOLD_MS = 2000;         // press length that opens the Reorder Songs sheet'), 'the delegated hold is two seconds');
ok(page.includes('  var RELEASE_MIN_MS = 1800;  // a press this long still counts if Android cancels it early'),
  'and a two-second press still counts when the browser cancels it');
ok(!page.includes('var HOLD_MS = 3000;'), 'nothing is still three seconds');
ok(page.includes('      if(wasMoved || held < 1800) return;'), 'the per-row hold counts a two-second press');
ok(page.includes('      }, 2000);\n      addTracking();'), 'and fires at two seconds');
ok(!page.includes('      }, 3000);\n      addTracking();'), 'no three-second row hold is left');
ok(page.includes('window.showAlbumReorderPopup = function(albumName, focusTrackId){'), 'the sheet takes the song it was opened for');
ok(page.includes("showAlbumReorderPopup(albumName, (row.dataset && row.dataset.id) || '');"),
  'the per-row hold hands its song to the sheet');
ok(page.includes("showAlbumReorderPopup(album, (row && row.dataset && row.dataset.id) || '');"),
  'and so does the delegated hold');
ok(page.includes('if(focusTrackId && !_focusDone && String(tt.id) === String(focusTrackId)){'),
  'the sheet finds that row');
ok(page.includes('listEl.scrollTop = Math.max(0, want);'), 'scrolls it into the middle');
ok(page.includes("_focusRow.style.background = 'rgba(227,178,60,0.20)';"), 'and lights it');
ok(page.includes('    var _focusDone = false;'), 'once per open');
ok(!page.includes('Hold a song for 3 seconds inside an album'), 'the help text says two seconds (1)');
ok(!page.includes('Hold a song 3 seconds inside an album'), 'the help text says two seconds (2)');
ok(!page.includes('Hold a row <b>3 seconds</b> inside an album'), 'the help text says two seconds (3)');
ok(page.includes('Hold a song for 2 seconds inside an album to reorder it.'), 'and says it plainly');

/* -- what each channel publishes ------------------------------------------- */
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converters|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfade|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
const playNotes = items.filter(i => !i.startsWith('[FULL] ') && !hidesOnPlay(i));
ok(playNotes.length === 3, 'the Play channel publishes all three notes (' + playNotes.length + ')');

const rootMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
ok(String(rootMan.version) === '80.7', 'ota/updates.json is 80.7 (' + rootMan.version + ')');
ok(Array.isArray(rootMan.notes) && rootMan.notes.length === 3, 'with three notes (' + (rootMan.notes || []).length + ')');

const playMan = path.join(ROOT, 'ota-play', 'updates.json');
const playZip = path.join(ROOT, 'ota-play', 'update.zip');
ok(fs.existsSync(playMan), 'the Play channel has a manifest');
if (fs.existsSync(playMan)) {
  const man = JSON.parse(fs.readFileSync(playMan, 'utf8'));
  ok(String(man.version) === '80.7', 'ota-play/updates.json is 80.7 (' + man.version + ')');
  ok(Array.isArray(man.notes) && man.notes.length === 3, 'with the three notes this build publishes (' + (man.notes || []).length + ')');
  ok(man.size === (fs.existsSync(playZip) ? fs.statSync(playZip).size : -1), 'and its size matches the zip beside it');
}
if (fs.existsSync(playZip)) {
  const zipped = execFileSync('unzip', ['-p', playZip, 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(zipped.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'the bundle carries the Play flag');
  ok(/const APP_VERSION = '80\.7';/.test(zipped), 'and the page inside it is 80.7');
  ok(zipped.includes('function scCreditHas(credit, artist){'), 'the page in the zip reads a credit as a list');
  ok(zipped.includes('function scWireReleaseHold(){'), 'and has the two-second delete');
  ok(zipped.includes('var HOLD_MS = 2000;'), 'and the two-second album sheet');
}

/* -- the page still parses -------------------------------------------------- */
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
  console.log('check-807: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-807: %d passed, 0 failed', pass);
