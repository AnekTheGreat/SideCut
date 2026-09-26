// v60.5.5 verification — three reported problems, checked as BEHAVIOUR where
// cheap (the library helper and the changelog filter actually run) and as
// structure everywhere else:
//   1. download prompts open the Library (Playlists / All Songs), not Albums
//   2. every converting run can be cancelled, mid-track included
//   3. [FULL]-marked notes are full-build only — filtered out of the other
//      channel's OTA notes and out of its in-app changelog
// plus the background battery guards and the release metadata.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const nat = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const bundlerFull = fs.readFileSync(path.join(ROOT, 'dev/ota-bundle.mjs'), 'utf8');
const bundlerPlay = fs.readFileSync(path.join(ROOT, 'dev/ota-bundle-play.mjs'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (hay, needle) => { let n = 0, i = hay.indexOf(needle); while (i !== -1) { n++; i = hay.indexOf(needle, i + needle.length); } return n; };

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '63.0.8', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].date.endsWith('EDT'), 'date ends in EDT (' + entries[0].date + ')');
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version + ' (a new Play build number)');

console.log('[2] [FULL] channel discipline');
if (entries) {
  const fullOnly = entries.flatMap((e) => e.items).filter((i) => i.startsWith('[FULL] '));
  ok(fullOnly.length >= 2, 'full-only items still marked across entries: ' + fullOnly.length);
  const malformed = entries.flatMap((e) => e.items).filter((i) => i.includes('[FULL]') && !i.startsWith('[FULL] '));
  ok(malformed.length === 0, 'marker only ever appears as a clean [FULL] prefix (' + malformed.length + ' malformed)');
  const playNotes = entries[0].items.filter((i) => !i.startsWith('[FULL] '));
  const fullNotes = entries[0].items.map((i) => (i.startsWith('[FULL] ') ? i.slice(7) : i));
  ok(playNotes.length >= 1, 'shared items for the other channel: ' + playNotes.length);
  ok(fullNotes.length >= 5, 'full channel notes: ' + fullNotes.length);
  ok(!playNotes.some((i) => i.startsWith('[FULL]')), 'marker never survives into the shared view');
  ok(!/play build|play version|play install|google play build/i.test(entries[0].items.join('\n')),
    'new notes never name the play build');
}
ok(src.includes('function changelogItems(entry)'), 'in-app filter helper present');
ok(count(src, 'entry.items') === 1, 'raw entry.items only inside the helper itself (' + count(src, 'entry.items') + ')');
ok(count(src, 'latest.items') === 0, 'no raw latest.items left (' + count(src, 'latest.items') + ')');
ok(count(src, 'changelogItems(entry).map') >= 3, 'every bullet renderer uses the filter (' + count(src, 'changelogItems(entry).map') + ')');
ok(count(src, 'changelogItems(entry).length') >= 4, 'every count uses the filter (' + count(src, 'changelogItems(entry).length') + ')');
ok(count(src, 'changelogItems(latest).length') >= 2, 'bell summary uses the filter');
ok(src.includes('changelogItems(entry).slice(0, 3)'), "what's-new summary uses the filter");
ok(bundlerFull.includes("startsWith('[FULL] ')") && bundlerFull.includes('.slice(7)'), 'full OTA channel strips the marker');
ok(bundlerPlay.includes('.filter((it) => !(typeof it === \'string\' && it.startsWith(\'[FULL] \')))'),
  'other OTA channel drops marked items entirely');
ok(count(nat, '__PLAY_BUILD__') >= 4 && !/__PLAY_BUILD__\s*=\s*true/.test(nat), 'updater still channel-gated, never sets the flag');

console.log('[3] download prompts open the Library (behaviour)');
{
  const start = src.indexOf('function scOpenLibraryAfterDownload(playlistName){');
  ok(start !== -1, 'helper defined');
  const end = src.indexOf('\n  var scConvertPillState', start);
  const code = src.slice(start, end);
  ok(code.includes("libraryMode = 'playlists'") && code.includes("playlistName || 'All Songs'")
    && code.includes("navigate('library')") && code.includes("key: 'libraryMode'"),
    'helper forces Playlists, honours the playlist argument, persists and navigates');
  if (start !== -1 && end !== -1) {
    try {
      const calls = [];
      const run = new Function('calls', `
        var libraryMode = 'albums', reorderMode = true, activePlaylist = 'Favorites';
        var closeDiscoverPopup = function(){ calls.push('closePopup'); };
        var dbPut = function(t, r){ calls.push('dbPut:' + r.value); };
        var applyLibraryButtonMode = function(){ calls.push('label'); };
        var navigate = function(v){ calls.push('nav:' + v + ':' + libraryMode + ':' + activePlaylist); };
        var renderTabs = function(){ calls.push('renderTabs'); };
        var document = { getElementById: function(){ return { classList: { add: function(){}, remove: function(){} } }; } };
        ${code}
        scOpenLibraryAfterDownload();
        var a1 = activePlaylist;
        activePlaylist = 'Favorites';
        scOpenLibraryAfterDownload(null);
        var a2 = activePlaylist;
        scOpenLibraryAfterDownload('Gym');
        var a3 = activePlaylist;
        return { mode: libraryMode, pl: a1, keep: a2, named: a3 };
      `);
      const r = run(calls);
      ok(r.mode === 'playlists', 'runs: libraryMode flipped to playlists (got ' + r.mode + ')');
      ok(r.pl === 'All Songs', 'runs: no argument lands on All Songs (got ' + r.pl + ')');
      ok(r.keep === 'Favorites', 'runs: null keeps the chosen playlist (got ' + r.keep + ')');
      ok(r.named === 'Gym', 'runs: an argument selects that playlist (got ' + r.named + ')');
      ok(calls.includes('nav:library:playlists:All Songs'), 'runs: navigate("library") sees the new state (' + calls.join(' | ') + ')');
      ok(calls.includes('closePopup'), 'runs: discover popup closed');
      ok(calls.includes('dbPut:playlists'), 'runs: mode persisted');
    } catch (e) { ok(false, 'helper executed: ' + e.message); }
  }
  ok(count(src, 'scOpenLibraryAfterDownload') >= 4, 'helper wired at 4+ sites (' + count(src, 'scOpenLibraryAfterDownload') + ')');
  ok(src.includes("closeHomeBubble(); scOpenLibraryAfterDownload();"), 'home bubble Open Playlists uses it');
  ok(src.includes('        scOpenLibraryAfterDownload();'), 'batch "Open my library" uses it');
  ok(src.includes('pill.onclick = _opened ? function(){ scConvertPill(false); scOpenLibraryAfterDownload(); } : null;'),
    'finished banner is tappable to open the library');
  ok(!src.includes("closeHomeBubble(); navigate('library');"), 'raw navigate(library) prompt is gone');
}

console.log('[4] cancel a conversion');
ok(src.includes('class="sc-pill-cancel"'), 'pill carries a Cancel button');
ok(src.includes("cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelling…'"), 'cancel click arms the flag and says so');
ok(src.includes("if(pc){ pc.style.display = 'none'; }"), 'done state hides Cancel');
ok(count(src, 'window.__scCancelDl') >= 15, 'flag referenced across the pipeline (' + count(src, 'window.__scCancelDl') + ')');
ok(/if\(!tracks\.length\) return false;\n    window\.__scCancelDl = false;/.test(src), 'batch resets the flag on every run');
ok(src.includes("stateEl.textContent = '— cancelled'"), 'cancelled rows are marked, not failed');
ok(src.includes('if(!window.__scCancelDl) await new Promise'), 'pacing delay skipped after cancel');
ok(src.includes('var _cancelledRun = !!window.__scCancelDl;'), 'run outcome recorded');
ok(src.includes("scConvertPillDone((_cancelledRun ? 'Cancelled — ' : '')"), 'pill reports the cancellation');
ok(src.includes("if(window.__scCancelDl) return { ok: false, reason: 'cancelled' };"), 'single-track converter refuses when cancelled');
ok(count(src, "window.__scSourceFail = 'cancelled'") >= 3, 'search/verify/decode loops bail out (' + count(src, "window.__scSourceFail = 'cancelled'") + ')');
ok(src.includes('      if(window.__scCancelDl) return null;'), 'stream download loop bails out');
ok(src.includes('      if(window.__scCancelDl) break;'), 'byte-range fetch bails out');
ok(src.includes("scConvertPillDone('Conversion cancelled')"), 'both single converters end on a cancelled pill');
ok(count(src, 'window.__scCancelDl = false;') >= 4, 'every entry point resets the flag (' + count(src, 'window.__scCancelDl = false;') + ')');

console.log('[5] background battery');
ok(/if\(document\.hidden\)\{\s*stopRgbAnimation\(\);\s*stopGlowSync\(\);\s*\} else \{/.test(src),
  'RGB/RGB+ stop while hidden and restart on return');
ok(src.includes('if(thRGB.rgb) startRgbAnimation();') && src.includes('if(thRGB.rgbPlus){ var aRGB = activeAudio(); if(aRGB && !aRGB.paused) startGlowSync(); }'),
  'restart mirrors the theme switch');
ok(src.includes("document.visibilityState === 'hidden') return; reg.update()"), 'service-worker refresh skips while hidden');
ok(src.includes('}, 10000);  // was 5s'), 'widget bridge poll halved to 10s');
ok(/function updateSleepTimerReadout\(\)\{\n    if\(document\.hidden\) return;/.test(src), 'sleep-timer readout sleeps while hidden');
ok(src.includes('if(document.hidden) return; if(window.__scTestMode'), 'test ticker sleeps while hidden');
ok(count(nat, '_lastAutoCheck') >= 3, 'updater stamps every check (' + count(nat, '_lastAutoCheck') + ')');
ok(nat.includes('if(Date.now() - _lastAutoCheck < 30 * 60 * 1000) return;'), 'resume check throttled to 30 minutes');
ok(nat.includes("if(document.visibilityState === 'hidden') return;"), '3-hour interval still refuses to run hidden');
ok(nat.match(/__PLAY_BUILD__ \? 'ota-play/g)?.length === 4, 'still 4 gated channel sites');

console.log('[6] inline script syntax');
let scriptIdx = 0, syntaxBad = 0, blocks = 0;
{
  let i = 0;
  while (true) {
    const open = src.indexOf('<script', i);
    if (open === -1) break;
    const gt = src.indexOf('>', open);
    const attrs = src.slice(open, gt);
    if (/src\s*=/.test(attrs)) { i = gt + 1; continue; }
    const end = src.indexOf('</script>', gt);
    const code = src.slice(gt + 1, end);
    blocks++;
    try { new Function(code); } catch (e) { syntaxBad++; console.log('  syntax bad block ' + blocks + ': ' + e.message); }
    i = end + 1;
    scriptIdx++;
  }
}
ok(syntaxBad === 0, blocks + ' inline blocks compile');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
