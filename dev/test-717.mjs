#!/usr/bin/env node
/**
 * 71.7 - the rebuild stops guessing, and it can be undone.
 *
 * The owner's words, after 71.6: "I'm missing mad albums and you made every
 * single damn song be an album of it's own fix it and I need my songs in the
 * correct order in albums and I'm missing songs inside of albums".
 *
 * 71.6's rebuild took every album tag on the files. On a library whose files
 * carry one tag per song - what a converter writes - that is one album per song,
 * and the grouping the owner actually had is not derivable from a tag at all. So
 * this gate pins the three things that make that unrepeatable:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the sheet   - the counts, the multi-song default, and the refusal when
 *                     every tag covers a single song;
 *   [3] the undo    - a snapshot before the first rebuild, kept to the FIRST
 *                     one, one tap back to exactly the list that was there;
 *   [4] the backup  - the importer one tap away in both places, and the album
 *                     ORDER the backup carries now winning over the local one;
 *   [5] what did not move - the rebuild is still additive and the launch sweep
 *                     is still exactly as narrow as it was.
 *
 * dev/studio-70-check.cjs [11q] drives [2] and [3] on the real app, with a
 * library that has both shared and per-song tags.
 *
 *   node dev/test-717.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.2.1'; /* repinned by dev/repin-7321.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */
const PREV = '73.2'; /* repinned by dev/repin-7321.mjs */ /* repinned by dev/repin-732.mjs */ /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7318.mjs */ /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.2.1';
const OWN = '71.7'; // repin-718: the release this gate describes

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;
const sliceBetween = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  return (a === -1 || b === -1) ? '' : src.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const items = head.items || [];
    const own = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (own.items || []).join('\n');
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next');
    const notes = items.join('\n');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/stripe/i.test(items.slice(0, 6).join('\n')), 'and the first six name no card page');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    ok(/undo/i.test(ownNotes), 'the 71.7 notes promise the undo');
    ok(/backup/i.test(ownNotes), 'and the backup as the copy with the real albums');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the service worker cache moves on for the shell that shipped (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the sheet - what it would make, before it makes it');
{
  const plan = sliceBetween('function scAlbumRebuildPlan(){', 'window.__scAlbumRebuildPlan');
  ok(plan.length > 200, 'the plan counts the tags first');
  ok(/counts\[tag\]\+\+/.test(plan), 'one count per tag');
  ok(/multi\+\+/.test(plan) && /single\+\+/.test(plan), 'and splits them into shared and single-song');
  ok(/return \{ tags: tags, counts: counts, multi: multi, single: single \};/.test(plan), 'all four are handed back');

  const body = sliceBetween('function rebuildAlbumsFromTags(mode){', 'window.__scRebuildAlbumsFromTags');
  ok(/var plan = scAlbumRebuildPlan\(\);/.test(body), 'the rebuild works from that plan');
  ok(/mode === 'all'[\s\S]{0,120}plan\.tags\.slice\(\)/.test(body), 'all means every tag');
  ok(/plan\.tags\.filter\(function\(t\)\{ return plan\.counts\[t\] > 1; \}\)/.test(body),
    'and anything else means only the tags shared by more than one song');
  ok(body.indexOf('plan.counts[t] > 1') < body.indexOf('scAlbumUndoArm()'), 'so the default cannot make one album per song');
  ok(/if\(!tags\.length\)\{/.test(body), 'and with no shared tag at all it refuses outright');
  ok(/one album per song/.test(body), 'saying exactly why');
  ok(/Import a backup instead/.test(body), 'and pointing at the copy that has the real albums');

  const sheet = sliceBetween('function rebuildAlbumsFromTagsPrompt(){', 'window.__scAlbumRebuildPrompt');
  ok(sheet.indexOf("bd.id = 'albRebuildSheet'") !== -1, 'the sheet is one element with its own id');
  ok(/zIndex = '250'/.test(sheet), 'and sits above a Discover popup, which is where Manage albums opens from');
  ok(/albRebuildMulti/.test(sheet) && /albRebuildAll/.test(sheet) && /albRebuildCancel/.test(sheet), 'with three answers');
  ok(/\(plan\.multi \? '<button id="albRebuildMulti"/.test(sheet), 'the primary button exists only when there is a shared tag');
  ok(/Rebuild the ' \+ plan\.multi/.test(sheet), 'and it names the number of albums it would make');
  ok(/Rebuild all ' \+ total/.test(sheet), 'the second names the number of tags');
  ok(/rebuildAlbumsFromTags\('multi'\)/.test(sheet), 'the primary runs the shared tags');
  ok(/rebuildAlbumsFromTags\('all'\)/.test(sheet), 'the second runs every tag, and only when asked');
  ok(/if\(e\.target === bd\) close\(\)/.test(sheet), 'tapping outside closes it');
  ok(!/confirm\(/.test(sheet), 'and no window.confirm() - the WebView can swallow it');
  ok(/A tag that appears on one song is usually the song name/.test(sheet), 'the sheet explains what a one-song tag is');
}

console.log('[3] the undo - the albums as they were, one tap back');
{
  const arm = sliceBetween('function scAlbumUndoArm(){', 'function scAlbumUndoAvailable(){');
  ok(/SC_ALBUM_UNDO_KEY/.test(src), 'the undo point has its own key');
  ok(/JSON\.stringify\(\{ at: Date\.now\(\), albums: userAlbums, order: albumOrder \}\)/.test(arm),
    'it copies the albums AND their order');
  ok(/if\(localStorage\.getItem\(SC_ALBUM_UNDO_KEY\)\) return false;/.test(arm),
    'the FIRST snapshot is the one kept, so a second rebuild cannot bury it');
  ok(/SC_ALBUM_UNDO_MAX/.test(arm) && /payload\.length > SC_ALBUM_UNDO_MAX/.test(arm),
    'and an oversized album list is refused rather than half-saved');
  ok(/catch\(_eArm\)\{ return false; \}/.test(arm), 'a storage failure never breaks the rebuild');

  const undo = sliceBetween('function undoAlbumRebuild(){', 'window.__scUndoAlbumRebuild');
  ok(/userAlbums = o\.albums;/.test(undo), 'undo puts the albums back');
  ok(/albumOrder = Array\.isArray\(o\.order\) \? o\.order\.slice\(\) : \[\];/.test(undo), 'with the order they had');
  ok(/albumOrder\.indexOf\(k\) === -1\) albumOrder\.push\(k\)/.test(undo), 'and any name the order did not know');
  ok(/scAlbumsMarkOurs\(userAlbums\)/.test(undo), 'they are marked as yours, so the next sweep cannot take them');
  ok(/localStorage\.removeItem\(SC_ALBUM_UNDO_KEY\)/.test(undo), 'the undo point is spent when it is used');
  ok(/refreshManageAlbums\(true\)/.test(undo), 'and the panel is redrawn without it');
  ok(/if\(!o\)\{ toast\('There is no rebuild to undo\.'\); return false; \}/.test(undo), 'with nothing to undo it says so');
  ok(/window\.__scUndoAlbumRebuild = undoAlbumRebuild;/.test(src), 'and the gates can drive it');
  ok(/window\.__scAlbumUndoAvailable = scAlbumUndoAvailable;/.test(src), 'as well as read whether one is waiting');
  // The snapshot has to happen BEFORE the first album is made, or it would be a
  // copy of the mess it is supposed to undo.
  const body = sliceBetween('function rebuildAlbumsFromTags(mode){', 'window.__scRebuildAlbumsFromTags');
  ok(/scAlbumUndoArm\(\);/.test(body), 'the rebuild arms the undo point itself');
  ok(body.indexOf('scAlbumUndoArm();') < body.indexOf('ensureAlbumSaved(tag)'),
    'before it has made a single album');
}

console.log('[4] the copy that has the real albums, and the order it brings');
{
  const open = sliceBetween('function scOpenBackupImport(){', 'window.__scOpenBackupImport');
  ok(/\$\('importLibInput'\)/.test(open), 'the backup button opens the same importer Settings uses');
  ok(/inp\.click\(\)/.test(open), 'so there is one import path and one set of restore rules');
  ok(/Settings > Backup/.test(open), 'with a spoken fallback if the input is missing');

  const panel = sliceBetween('function manageAlbumsHTML(){', 'function wireManageAlbums(){');
  ok(/id="mgrAlbumUndo"/.test(panel), 'Manage albums offers the undo');
  ok(/\(_undo \? /.test(panel), 'only while a rebuild is really undoable');
  ok(/id="mgrAlbumRestore"/.test(panel), 'and the backup restore is there too');
  ok(/scAlbumUndoAvailable\(\)/.test(panel), 'which is decided by the undo point itself');

  const wiring = sliceBetween('var _rbWire = bEl.querySelector', 'function refreshManageAlbums');
  ok(/rebuildAlbumsFromTagsPrompt\(\)/.test(wiring), 'the panel button opens the sheet');
  ok(/undoAlbumRebuild\(\)/.test(wiring), 'the undo button runs the undo');
  ok(/scOpenBackupImport\(\)/.test(wiring), 'the restore button opens the importer');
  ok(/_undoWire\._undoWired/.test(wiring) && /_restoreWire\._restoreWired/.test(wiring),
    'both are wired once, so a re-render cannot stack listeners');

  const empty = sliceBetween('pane.appendChild(empty);', '// Insert-pick mode');
  ok(/id = 'albRestoreBtn'/.test(empty), 'the empty Albums screen offers the restore as well');
  ok(/albums you actually had/.test(empty), 'and says which of the two is the real album list');

  // The third chance: a song the exact content key missed is matched by the name
  // the backup recorded for it, so it stays in its album instead of vanishing.
  ok(/function scAlbumFindByTitle\(name, artist\)\{/.test(src), 'a song the id remap could not place is looked up by title');
  ok(/replace\(\/\\s\+\/g, ' '\)/.test(src), 'with the whitespace normalised, so a doubled space is not a miss');
  ok(/if\(a && scAlbumLooseNorm\((?:t|_t)\.artist\) === a\) return (?:t|_t)\.id;/.test(src), 'the artist is tried first');
  ok(/if\(!first\) first = (?:t|_t)\.id;/.test(src), 'and a title match stands in when the artist does not');
  ok(/var _guess = _rec \? scAlbumFindByTitle\(_rec\.name, _rec\.artist\) : null;/.test(src),
    'and titles are tried before the song is dropped');
  ok(/if\(_guess && mapped\.indexOf\(_guess\) === -1\) mapped\.push\(_guess\);/.test(src),
    'so it joins its album rather than disappearing from it');

  ok(/the backup's album ORDER wins/.test(src), 'the import adopts the order the backup carries');
  ok(/var _mergedOrder = \[\];/.test(src), 'by merging it instead of replacing it');
  ok(/_aoRows?\.value\) \? _aoRow\.value : \[\]/.test(' ' + src.replace(/\s+/g, ' ')) || /var _ao = \(_aoRow && Array\.isArray\(_aoRow\.value\)\) \? _aoRow\.value : \[\];/.test(src),
    'starting from the order the backup / the store row holds');
  ok(/_ao\.forEach\(function\(n\)\{ if\(userAlbums\[n\] && _mergedOrder\.indexOf\(n\) === -1\) _mergedOrder\.push\(n\); \}\);/.test(src),
    'every album the backup knew, in the backup order');
  ok(/Object\.keys\(userAlbums\)\.forEach\(function\(n\)\{ if\(_mergedOrder\.indexOf\(n\) === -1\) _mergedOrder\.push\(n\); \}\);/.test(src),
    'then anything the backup did not know, so nothing is dropped');
  ok(/albumOrder = _mergedOrder;/.test(src), 'and that is the order the cards use');
  ok(/dbPut\(\{ key: 'albumOrder'/.test(src) || /key: 'albumOrder', value: albumOrder/.test(src), 'written back, so a relaunch keeps it');
}

console.log('[5] what did not move');
{
  const body = sliceBetween('function rebuildAlbumsFromTags(mode){', 'window.__scRebuildAlbumsFromTags');
  ok(!/delete\s+userAlbums\[/.test(body), 'the rebuild still never deletes an album');
  ok(!/\.splice\(/.test(body), 'nor splices a track list');
  ok(!/persistTrackMeta|buildTrackRecord/.test(body), 'and never writes anything back onto a song');
  ok(/ensureAlbumSaved\(tag\)/.test(body), 'a tag with no album still goes through the existing saver');
  ok(/markAlbumManual\(tag\)/.test(body), 'and a tag that has one is still only stamped as yours');
  ok(/scAlbumsMarkOurs\(userAlbums\)/.test(body), 'with the marker pass still covering everything it met');

  const sweep = sliceBetween('function removeAutoAlbums(){', 'window.__scMarkAlbumManual');
  ok(/if\(!albumIsAuto\(name\)\) return;/.test(sweep), 'the launch sweep is exactly as narrow as it was');
  const isAuto = sliceBetween('function albumIsAuto(name){', 'function visibleAlbumNames');
  ok(/e\.auto === true && e\.manual !== true/.test(isAuto), 'and its rule was not loosened to cover for this');
  ok(count(src, 'var _rebuild = ') === 1, 'Manage albums still builds its block once');
  ok(count(src, 'id="mgrAlbumRebuild"') === 1, 'with one rebuild button');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
