#!/usr/bin/env node
/**
 * SideCut 70.1.4 - "Export everything" now really exports everything.
 *
 * The user's words: "Make sure export includes everything all functions of the
 * app".
 *
 * WHAT WAS WRONG. The app has two full sweeps of its stored data and, until this
 * release, they were the SAME sweep. One of them is the on-device mirror: a JSON
 * file written 1.5 s after any change and deliberately capped (1 MB total, 256 KB
 * per row) so it stays a cheap safety net for settings. The other is the .zip the
 * user makes on purpose from Settings - "Export everything" - and it was reading
 * the capped sweep too, so every stored value past 256 KB was silently left out of
 * the backup. On a real library those are exactly the rows that grow with use:
 * `trackSidecar` (play counts, loudness gains and the seek waveforms the player
 * draws) and the artist/album cover maps. The backup was thinnest on the people
 * with the most to lose.
 *
 * WHAT THIS DOES. A second pair of collectors, uncapped, used only by the backup;
 * the mirror keeps its caps because that is what keeps it cheap. The backup still
 * leaves out the app's own page HTML - the rollback copies (`versionSnapshot_<v>`,
 * ~1.8 MB each) and the pinned PWA snapshot are the app, not the user's data.
 *
 * AND THE SONGS. `buildTrackRecord` writes three fields per song that the export
 * manifest listed everything BUT: `cropped`, `originalDuration` and
 * `manualOverride`. They are not in the sidecar either, so a song restored on a
 * new phone came back with its trimmed audio and no "Undo crop" left, and a
 * hand-corrected tag was forgotten. Export and import both carry them now.
 *
 *   node dev/patch-7014.mjs            # apply
 *   node dev/patch-7014.mjs --check    # report only, change nothing
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree, which is how
// a release is proven before it is cut here.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO70 = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const VERSION = '70.1.4';
const PREV = '70.1.3';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Cut at 2026-09-30 01:55 UTC = 9:55 PM EDT on the 29th. A stamp in the FUTURE is
// a gate failure (test-6643 allows the next 15 minutes), and the run must still
// read newest-first, so this has to beat 70.1.3's 7:54 PM.
const STAMP = 'September 29, 2026 \u00b7 9:55 PM EDT';
const CACHE = 'sidecut-shell-v63.0.40';
const OLDCACHE = 'sidecut-shell-v63.0.39';
const TITLE = 'Export everything now carries the whole app: the play counts, the loudness gains, the seek waveforms and the cover maps a big library had been leaving out, and a cropped song brings its undo';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), none says "download" or "convert", none uses "play build", "play
// version" or "play install" - test-662, test-6642 and test-66421 refuse those -
// and one of them names a surface the test-662 surface rule looks for (player).
const NOTES = [
  'Export everything really does export everything now. The backup used to read the same list of stored values as the on-device safety copy, and that copy is capped so it stays small - so anything past a couple of hundred kilobytes was skipped on the way into the zip. The play counts, the loudness gains and the seek waveforms the player draws all live in one row that grows past that on a real library, and the cover maps for your artists and albums did too. They ride in the backup now, at whatever size they reached.',
  'That cap is still there where it belongs. The on-device copy is rewritten a second and a half after any change and has to stay small, because it is a safety net for settings and not a file store, and it is untouched. Only the zip you make on purpose had the ceiling taken off it.',
  'A cropped song brings its undo with it. Cropping is carried as three fields on the song itself, and the backup listed every field except those three - so a song restored on a new phone came back trimmed with no Undo crop left to put the original back. The trim flag and the original length ride along now.',
  'A hand-edited field stays hand-edited. If you corrected a song by hand instead of letting the app tag it, that mark lived in the same three fields and was dropped on the way out, so the new phone saw a song nobody had touched. It is carried now, and it merges onto a song you already have without overwriting anything you changed since.',
  'Nothing else about the backup changed. The same one zip, the same Import library to put it back, and the same playlists, albums, favourites, listening stats, streaks, theme, equalizer, sandbox and Studio settings coming along with the songs and their cover art.',
  'Import is the other half of the same job, so it reads the three fields back: a song that does not exist on the new phone is created with them, and one that is already there takes them the way it takes every other piece of metadata - only where it has nothing of its own.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;
function holder(text){ return { text: text }; }

/* --------------------------------------------------------------- the helpers */
function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  // The silent-failure family this repo keeps re-learning: a replacement that
  // drops the newline the anchor had joins two lines together, and the join
  // parses. Refused here instead of being found later. (An empty replacement is
  // the one case where the newline SHOULD go: it is a whole block coming out.)
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
const studio = holder(fs.readFileSync(STUDIO70, 'utf8'));

// `--check` on a tree already AT this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-7014: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ================================ A. THE BACKUP STOPS SHARING THE MIRROR CAP */
// The mirror's collectors stay exactly as they are (MAX_ITEM, MAX_SNAP_BYTES and
// all); these two are the backup's own, and the only difference is that they do
// not skip a value for being big. Page-sized APP payloads still stay out.
{
  const insert = block([
    '',
    '    // 70.1.4 - THE BACKUP IS NOT THE MIRROR. Everything above is the on-device',
    '    // safety copy: written 1.5 s after any change and capped (1 MB total, 256 KB',
    '    // per row), which is what keeps it cheap. The .zip a user makes on purpose',
    '    // has no such ceiling, and until now it read the SAME capped sweep - so every',
    '    // stored value past 256 KB was silently left out of the backup. That is',
    '    // exactly the rows that grow with use: the track sidecar (play counts,',
    '    // loudness gains and the seek waveforms the player draws) and the artist and',
    '    // album cover maps. These two take every real value at any size and still',
    '    // skip the app\'s own page HTML: the rollback copies',
    '    // (`versionSnapshot_<v>`, ~1.8 MB each - that is the app, not the user\'s',
    '    // data), the pinned PWA snapshot, and the ephemeral session beacons the',
    '    // mirror already ignores.',
    '    function collectLocalStorageForBackup(){',
    '      var out = {};',
    '      try{',
    '        for(var i = 0; i < localStorage.length; i++){',
    '          var k = localStorage.key(i);',
    '          if(!k || typeof k !== \'string\') continue;',
    '          if(k.indexOf(\'discPopupCache_\') === 0) continue;',
    '          if(k === \'sidecut_pinned_snapshot\') continue;   // a whole page of HTML',
    '          if(k === \'scLastOp\' || k === \'scLeftFgAt\' || k === \'scAliveAt\' || k === \'sidecut_ahPending\' || k === \'bgImportState\') continue;',
    '          var v = null; try{ v = localStorage.getItem(k); }catch(e){ v = null; }',
    '          if(v === null || v === undefined) continue;',
    '          out[k] = v;',
    '        }',
    '      }catch(e){}',
    '      return out;',
    '    }',
    '    async function collectMetaForBackup(){',
    '      var out = {};',
    '      try{',
    '        var rows = await scMetaSettingsRows();   // already skips the rollback rows',
    '        for(var i = 0; i < rows.length; i++){',
    '          var key = rows[i] && rows[i].key;',
    '          if(typeof key !== \'string\') continue;',
    '          if(key.indexOf(\'versionSnapshot_\') === 0) continue;',
    '          out[key] = rows[i].value;',
    '        }',
    '      }catch(e){}',
    '      return out;',
    '    }',
  ]);
  sub(html, 'the backup collectors',
    '    }\n    async function flushSnapshot(){\n',
    '    }\n' + insert + '    async function flushSnapshot(){\n',
    { key: 'function collectLocalStorageForBackup(){' });
}

// The comment above the export hook, and the hook itself. The call site keeps the
// name `__scSnapCollect` on purpose: the export and the import both go through it,
// and it is what the play-build gate greps for.
sub(html, 'the export collector comment',
  '    // Full-state collect/hydrate for the in-app backup zip (export everything /\n' +
  '    // import everything). Same sweep the on-device snapshot uses: every\n' +
  '    // localStorage key and every meta row, minus caches, oversized values and\n' +
  '    // shell snapshots \u2014 i.e. nothing a user can see in the app is left behind\n' +
  '    // when they move to a fresh install or a different build.\n',
  block([
    '    // Full-state collect/hydrate for the in-app backup zip (export everything /',
    '    // import everything). This is the UNCAPPED sweep since 70.1.4: every',
    '    // localStorage key and every meta row, minus the caches, the session beacons',
    '    // and the app\'s own rollback page HTML - but with no size limit at all,',
    '    // because this feeds a file the user asked for and not a mirror that is',
    '    // rewritten every 1.5 s. i.e. nothing a user can see in the app is left',
    '    // behind when they move to a fresh install or a different build, however big',
    '    // it grew.',
  ]),
  { key: 'This is the UNCAPPED sweep since 70.1.4' });

sub(html, 'the export collector body',
  '      try{ return { v: 1, localStorage: collectLocalStorage(), meta: await collectMeta() }; }\n',
  '      try{ return { v: 1, localStorage: collectLocalStorageForBackup(), meta: await collectMetaForBackup() }; }\n');

/* ================================= B. THE THREE PER-SONG FIELDS IT DROPPED */
// Export: the manifest entry gains them.
sub(html, 'the exported song fields',
  '          playCount: t.playCount, lastPlayedAt: t.lastPlayedAt, dateAdded: t.dateAdded || null, releaseDate: t.releaseDate || null, path: t.file ? zipPath : null, hasCover: !!t.artBlob\n',
  block([
    '          playCount: t.playCount, lastPlayedAt: t.lastPlayedAt, dateAdded: t.dateAdded || null, releaseDate: t.releaseDate || null, path: t.file ? zipPath : null, hasCover: !!t.artBlob,',
    '          // 70.1.4 - the three per-song fields the export used to drop. They are',
    '          // not in the sidecar and they were not in this list, so a song that had',
    '          // been cropped came back on the new phone with its trimmed audio and no',
    '          // "Undo crop" left, and a hand-corrected tag was silently forgotten.',
    '          cropped: t.cropped || false, originalDuration: t.originalDuration || null, manualOverride: t.manualOverride || false',
  ]));

// Import: a song the new device does not have yet is built with them.
sub(html, 'the imported song fields',
  '          artBlob: null,\n          artUrl: null,\n          watermarkCleaned: cleaned.changed\n',
  block([
    '          artBlob: null,',
    '          artUrl: null,',
    '          watermarkCleaned: cleaned.changed,',
    '          // 70.1.4 - carried through so a cropped song still offers its undo, and',
    '          // a field you corrected by hand stays corrected, on the new phone.',
    '          cropped: m.cropped || false,',
    '          originalDuration: m.originalDuration || null,',
    '          manualOverride: m.manualOverride || false',
  ]));

// Import: a song that is already here takes them the way it takes everything else.
sub(html, 'the imported song merge',
  '            if(m.dateAdded !== undefined && !existing.dateAdded) existing.dateAdded = m.dateAdded;\n' +
  '            if(m.releaseDate !== undefined && !existing.releaseDate) existing.releaseDate = m.releaseDate;\n',
  block([
    '            if(m.dateAdded !== undefined && !existing.dateAdded) existing.dateAdded = m.dateAdded;',
    '            if(m.releaseDate !== undefined && !existing.releaseDate) existing.releaseDate = m.releaseDate;',
    '            // 70.1.4 - the three states the export carries now (see manifest.tracks),',
    '            // filled in only where this device has nothing of its own.',
    '            if(m.cropped !== undefined && !existing.cropped) existing.cropped = m.cropped;',
    '            if(m.manualOverride !== undefined && !existing.manualOverride) existing.manualOverride = m.manualOverride;',
    '            if(m.originalDuration !== undefined && !existing.originalDuration) existing.originalDuration = m.originalDuration;',
  ]));

/* ============================================== C. THE CONFIRM SHEET'S COPY */
// The phrase the play-build gate greps for ("EVERY stored preference (...)") is
// kept exactly; the new coverage is named after it.
sub(html, 'the export confirm copy',
  'manual album edits), \u2014 as a full restorable backup .zip?',
  'manual album edits), every stored value at whatever size it grew to (play counts, loudness gains, seek waveforms, the artist and album cover maps), \u2014 as a full restorable backup .zip?');

/* ======================================================== D. THE RELEASE */
sub(html, 'the version',
  "  const APP_VERSION = '" + PREV + "';\n",
  "  const APP_VERSION = '" + VERSION + "';\n");

{
  const entry = block([
    "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
    ...NOTES.map((n) => "    '" + n + "',"),
    '  ] },',
  ]);
  sub(html, 'the changelog head',
    "  const CHANGELOG = [\n  { version: '" + PREV + "',",
    "  const CHANGELOG = [\n" + entry + "  { version: '" + PREV + "',");
}

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n");

/* ============================================ E. THE GATES THAT WATCH IT */
{
  const rules = block([
    '  // 70.1.4. "Make sure export includes everything all functions of the app". The',
    '  // backup used to read the same size-capped sweep as the on-device mirror, so',
    '  // every value past 256 KB was left out of the zip - and the rows that grow with',
    '  // use (the sidecar with the play counts, gains and waveforms, and the cover',
    '  // maps) are exactly the ones that pass it. The two sweeps are separate now.',
    '  ok(count(\'function collectLocalStorageForBackup(){\') === 1 && count(\'function collectMetaForBackup(){\') === 1,',
    '     \'the export still reads the same size-capped sweep as the on-device mirror\');',
    '  ok(count(\'collectLocalStorageForBackup(), meta: await collectMetaForBackup()\') === 1,',
    '     \'or the backup is not the one built from the uncapped sweep\');',
    '  ok(count(\'if(v === null || v === undefined || v.length > MAX_ITEM) continue;\') === 1 &&',
    '     count(\'if(valSize > MAX_ITEM) continue;\') === 1,',
    '     \'and the on-device mirror stopped skipping oversized rows\');',
    '  ok(count("if(k === \'sidecut_pinned_snapshot\') continue;") === 1,',
    '     \'or a whole pinned shell page is riding into every backup\');',
    '  ok(count(\'cropped: t.cropped || false, originalDuration: t.originalDuration || null, manualOverride: t.manualOverride || false\') === 1,',
    '     \'the backup still drops the crop undo and the manual tag mark\');',
    '  ok(count(\'existing.cropped = m.cropped\') === 1 && count(\'existing.originalDuration = m.originalDuration\') === 1 &&',
    '     count(\'existing.manualOverride = m.manualOverride\') === 1,',
    '     \'or a song that is already here does not get them back\');',
  ]);
  sub(t705, 'the 70.1.4 rules',
    "     'while the position that lifts the bar onto the dock still counts it');\n",
    "     'while the position that lifts the bar onto the dock still counts it');\n\n" + rules,
    { key: "the export still reads the same size-capped sweep" });
}

{
  const drive = block([
    "  console.log('[11g] a backup carries everything, at any size');",
    '  {',
    '    // 70.1.4 - "Make sure export includes everything all functions of the app".',
    '    // The backup used to read the same size-capped sweep as the on-device',
    '    // mirror, so any stored value past 256 KB was dropped from the zip. This',
    '    // writes two of those - one localStorage key and one meta row - and asks the',
    '    // collector the export actually calls for them back.',
    '    const big = \'x\'.repeat(300000);',
    '    ok(typeof win.__scSnapCollect === \'function\' && typeof win.__scSnapHydrate === \'function\',',
    '      \'the backup collector and its hydrate are on the window\');',
    '    win.localStorage.setItem(\'sidecut_probe_big\', big);',
    '    await win.__scSnapHydrate({ v: 1, meta: { probeBigRow: big } });',
    '    const state = await win.__scSnapCollect();',
    '    ok(!!state && state.v === 1, \'the collector answers with a v1 state\');',
    '    ok(!!state && !!state.localStorage && state.localStorage.sidecut_probe_big === big,',
    '      \'a stored value past the snapshot cap rides in the backup\');',
    '    ok(!!state && !!state.meta && state.meta.probeBigRow === big,',
    '      \'and so does a meta row of the same size\');',
    '    ok(!!state && !!state.localStorage && state.localStorage.sidecut_pinned_snapshot === undefined,',
    '      \'while a pinned shell page is still kept out of it\');',
    '    // The mirror must NOT follow the backup up: it is rewritten every 1.5 s and',
    '    // its own cap is the whole reason that stays cheap.',
    '    ok(html.indexOf(\'var MAX_ITEM = 262144;\') !== -1 && html.indexOf(\'if(valSize > MAX_ITEM) continue;\') !== -1,',
    '      \'and the on-device mirror still skips oversized rows\');',
    '    win.localStorage.removeItem(\'sidecut_probe_big\');',
    '  }',
    '',
  ]);
  sub(studio, 'the real-app backup drive',
    "  console.log('[12] the page still holds together');\n",
    drive + "  console.log('[12] the page still holds together');\n",
    { key: '[11g] a backup carries everything, at any size' });
}

/* ------------------------------------------------------------------- checks */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };
  const mustNot = (hay, needle, msg) => {
    const n = count(hay, needle);
    if(n) problems.push(msg + ' (' + n + 'x)');
  };

  must(count(page, "const APP_VERSION = '" + VERSION + "';") === 1, 'the version is not ' + VERSION);
  must(count(page, "version: '" + VERSION + "'") === 1 && count(page, "version: '" + PREV + "'") === 1,
    'the changelog head did not move, or the release it replaced was overwritten');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the stamp is not the one this release ships');
  must(count(page, "title: '" + TITLE + "'") === 1, 'the title is not the one this release ships');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  mustNot(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';", 'the old shell cache is still in sw.js');

  // The sweep split.
  must(count(page, 'function collectLocalStorageForBackup(){') === 1, 'the uncapped localStorage sweep is missing');
  must(count(page, 'function collectMetaForBackup(){') === 1, 'the uncapped meta sweep is missing');
  must(count(page, 'localStorage: collectLocalStorageForBackup(), meta: await collectMetaForBackup()') === 1,
    'the export does not use the uncapped sweeps');
  must(count(page, 'localStorage: collectLocalStorage(), meta: await collectMeta()') === 0,
    'the export still uses the mirror sweep');
  must(count(page, 'if(v === null || v === undefined || v.length > MAX_ITEM) continue;') === 1 &&
    count(page, 'if(valSize > MAX_ITEM) continue;') === 1,
    'the on-device mirror lost its size cap');
  must(count(page, 'var MAX_SNAP_BYTES = 1000000;') === 1, 'the mirror lost its file cap');
  must(count(page, "if(k === 'sidecut_pinned_snapshot') continue;") === 1,
    'the pinned shell page is not kept out of the backup');

  // The songs.
  must(count(page, 'cropped: t.cropped || false, originalDuration: t.originalDuration || null, manualOverride: t.manualOverride || false') === 1,
    'the export does not carry the three per-song fields');
  must(count(page, 'cropped: m.cropped || false,') === 1 && count(page, 'originalDuration: m.originalDuration || null,') === 1 &&
    count(page, 'manualOverride: m.manualOverride || false') === 1,
    'the import does not build a restored song with them');
  must(count(page, 'existing.cropped = m.cropped') === 1 && count(page, 'existing.originalDuration = m.originalDuration') === 1 &&
    count(page, 'existing.manualOverride = m.manualOverride') === 1,
    'the import does not merge them onto a song that is already here');

  // The copy the play-build gate greps for is still there.
  must(count(page, 'EVERY stored preference (lyrics sync nudges, album order, widget theme, API bases, manual album edits)') === 1,
    'the export confirm copy lost the phrase the play-build gate reads');

  // The gates.
  must(count(t705.text, 'the export still reads the same size-capped sweep as the on-device mirror') === 1,
    'the new test-705 rules did not land');
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(studio.text, '[11g] a backup carries everything, at any size') === 1,
    'the real-app probe does not drive the backup');
}

if(problems.length){
  console.error('patch-7014: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7014: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7014: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7014: next `node dev/repin-7014.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
