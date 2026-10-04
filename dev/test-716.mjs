#!/usr/bin/env node
/**
 * 71.6 - the albums come back, and a restored backup sticks.
 *
 * The owner's words: "Why did all of my albums disappear" - answered "Library >
 * Albums tab AND Manage albums", "All my songs are still there", "It's purely
 * because of the apk because on the play version my albums are still there".
 *
 * That is 63.1.4's cleanup running for the first time on a newly installed APK.
 * It deletes the album ENTRIES older builds wrote for themselves (the old
 * card-drag auto-save, a tag album materialised so a reorder had somewhere to
 * live) and never a tag on a file. So this gate pins both halves of the fix:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the rebuild      - one album per album tag, additive only, stamped as
 *                          yours so the sweep can never take it again;
 *   [3] both entry points- the empty Albums tab AND Manage albums;
 *   [4] a restore sticks - the .zip import and both on-device hydrate paths stop
 *                          carrying the app's own marker into your library;
 *   [5] what did not move- the sweep is NOT loosened, and no song, tag, playlist
 *                          or existing album is rewritten by any of it.
 *
 * dev/studio-70-check.cjs [11p] drives [2], [3] and [4] on the real app: it
 * boots the exact library this started from, taps the button, and reads the row
 * the restore wrote.
 *
 *   node dev/test-716.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.7'; /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */
const PREV = '73.1.6'; /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.7';
const OWN = '71.6'; // repin-718: the release this gate describes

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
    ok(/\b(album|albums)\b/i.test(String(own.title)), 'the 71.6 title names the thing that came back');
    ok(!/\bpass\b/i.test(String(head.title)), 'and never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/stripe/i.test(items.slice(0, 6).join('\n')), 'and the first six name no card page');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    ok(/album tag/i.test(ownNotes), 'the 71.6 notes say where the albums are read from');
    ok(/rebuild/i.test(ownNotes), 'and name the way back');
    ok(/backup/i.test(ownNotes), 'and the half of it that is about a restore');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the service worker cache moves on for the shell that shipped (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the rebuild, from the album tags on the songs');
{
  // 71.7 moved the tag collection into scAlbumRebuildPlan() (so the sheet can
  // count before anything is made) and gave the rebuild a `mode`. These checks
  // follow the code as it is, which is what a gate about a LIVE function has to
  // do; the release-specific claims are the notes and the entry.
  ok(count(src, 'function scAlbumRebuildPlan(){') === 1, 'the album tags are counted in one function');
  const plan = sliceBetween('function scAlbumRebuildPlan(){', 'window.__scAlbumRebuildPlan');
  ok(plan.length > 200, 'and it has a body');
  ok(/String\(t\.album \|\| ''\)\.trim\(\)/.test(plan), 'it reads the album tag off each song, trimmed');
  ok(/if\(!tag\) return;/.test(plan), 'an empty tag is skipped');
  ok(/if\(!counts\[tag\]\)\{ counts\[tag\] = 0; tags\.push\(tag\); \}/.test(plan), 'and each tag is counted once');
  ok(/allTracks\.forEach/.test(plan), 'it walks the library, not a stored album list');
  ok(/multi\+\+/.test(plan) && /single\+\+/.test(plan), 'it reports how many tags cover more than one song');
  const body = sliceBetween('function rebuildAlbumsFromTags(mode){', 'window.__scRebuildAlbumsFromTags');
  ok(body.length > 200, 'and the rebuild has a body');
  ok(/ensureAlbumSaved\(tag\)/.test(body), 'a tag with no album gets one through the existing saver');
  ok(/markAlbumManual\(tag\)/.test(body), 'a tag that already has an album is stamped as yours instead');
  ok(/scAlbumsMarkOurs\(userAlbums\)/.test(body), 'and every album it meets is marked as yours');
  ok(/albumOrder\.push\(tag\)/.test(body), 'new albums go on the end of your order');
  ok(/dbPut\('meta', \{ key: 'albumOrder'/.test(body), 'and that order is written down');
  ok(/dbPut\('meta', \{ key: 'userAlbums'/.test(body), 'with the albums row itself');
  ok(/renderList\(\)/.test(body), 'the list is redrawn');
  ok(/refreshManageAlbums\(true\)/.test(body), 'so is Manage albums, keeping whatever was typed in its search');
  ok(/toast\(/.test(body), 'and the count is said out loud');
  // Additive, always: this is the promise the notes make.
  ok(!/delete\s+userAlbums\[/.test(body), 'it never deletes an album');
  ok(!/trackIds\s*=\s*\[\]/.test(body), 'and never empties one');
  ok(!/\.splice\(/.test(body), 'nor splices a track list');
  ok(!/persistTrackMeta|buildTrackRecord|t\.album\s*=/.test(body), 'and it writes nothing back onto a song');
  ok(!/trackIds\.pop|removeFromAlbum|deleteUserAlbum/.test(body), 'nothing in it takes a song away from anywhere');
}

console.log('[3] both places an empty Albums screen shows the way back');
{
  const emptyState = sliceBetween('pane.appendChild(empty);', '// Insert-pick mode');
  ok(emptyState.indexOf("id = 'albRebuildBtn'") !== -1, 'the empty list offers Rebuild albums from my songs');
  ok(/if\(libraryMode === 'albums'\)\{/.test(emptyState), 'only in the Albums half, not on an empty playlist');
  // 71.7: the button opens the sheet (which is the confirmation), and the backup
  // restore now stands beside it, because that is the copy with the real albums.
  ok(/rebuildAlbumsFromTagsPrompt\(\)/.test(emptyState), 'and the button opens the sheet rather than rebuilding blind');
  ok(/Restore from my backup/.test(emptyState), 'with the backup restore beside it');
  ok(/albums you actually had/.test(emptyState), 'and a line saying which of the two has the real albums');
  ok(!/confirm\(/.test(emptyState), 'no confirm() - the Android WebView can swallow it (it is additive anyway)');

  const panel = sliceBetween('function manageAlbumsHTML(){', 'function wireManageAlbums(){');
  ok(count(panel, 'id="mgrAlbumRebuild"') === 1, 'Manage albums carries the same button, built once');
  ok(/var _rebuild = /.test(panel), 'from a single block');
  ok(/No albums yet\.<\/div>' \+ _rebuild;/.test(panel), 'shown when the panel is empty');
  ok(count(panel, 'var _rebuild = ') === 1, 'the block is declared once, not once per branch');
  ok(/html \+= _rebuild;/.test(panel), 'and below the rows when it is not');
  ok(panel.indexOf('id="mgrAlbumRebuild"') < panel.indexOf("if(!names.length) return"), 'the block is defined before either branch uses it');
  ok(!/mgr-alb-row[^>]*id="mgrAlbumRebuild"/.test(panel) && panel.indexOf('class="mgr-alb-row"') !== panel.indexOf('id="mgrAlbumRebuild"'),
    'and it is not one of the searchable rows, so a typed query cannot hide it');

  const wiring = sliceBetween('var _rbWire = bEl.querySelector', 'function refreshManageAlbums');
  ok(wiring.length > 100, 'the panel button is wired');  ok(/rebuildAlbumsFromTagsPrompt\(\)/.test(wiring), 'to the rebuild, through the sheet');
  ok(/_rbWire\._rbWired/.test(wiring), 'wired once, so a re-render cannot stack listeners');
  ok(!/confirm\(/.test(wiring), 'and it does not lean on window.confirm()');
  // 71.7 replaced the blind two-tap arm here with the sheet, which is the
  // confirmation that says what it would make.
  ok(/rebuildAlbumsFromTagsPrompt\(\)/.test(wiring), 'and it now opens the sheet rather than rebuilding blind');
}

console.log('[4] a restored backup sticks - an album out of your own backup is yours');
{
  const mark = sliceBetween('function scAlbumsMarkOurs(', 'window.__scAlbumsMarkOurs = scAlbumsMarkOurs;');
  ok(mark.length > 100, 'there is one marker pass');
  ok(/e\.manual = true;/.test(mark), 'it stamps every album as yours');
  ok(/delete e\.auto;/.test(mark), 'and takes the app\'s own mark off it');
  ok(/typeof e !== 'object'/.test(mark), 'junk entries are left alone');
  ok(/window\.__scAlbumsMarkOurs = scAlbumsMarkOurs;/.test(src), 'and it is exposed, so the gates can drive it');

  const imp = sliceBetween('userAlbums = _albMerged;', "var _aoRow = await dbGet('meta', 'albumOrder');");
  ok(/scAlbumsMarkOurs\(userAlbums\)/.test(imp), 'the export .zip import marks what it brought as yours');
  ok(imp.indexOf('scAlbumsMarkOurs') < imp.indexOf("dbPut('meta', { key: 'userAlbums'"), 'before the row is written, not after');
  ok(count(src, "Whatever marker it came with, and the next boot settles it") === 0,
    'and the note that shipped the old behaviour is gone');

  const hyd = sliceBetween('if(state.meta){', 'scAdoptLiveStats');
  ok(/state\.meta\.userAlbums = scAlbumsMarkOurs\(state\.meta\.userAlbums\)/.test(hyd), 'the full-state hydrate does the same');
  ok(hyd.indexOf('scAlbumsMarkOurs') < hyd.indexOf('for(var mk in state.meta)'), 'before it writes a single row');

  const rest = sliceBetween('if(metaWiped && snap.meta){', '// Ensure the marker exists');
  ok(/snap\.meta\.userAlbums = scAlbumsMarkOurs\(snap\.meta\.userAlbums\)/.test(rest), 'and so does the on-device restore after a wipe');
  ok(rest.indexOf('scAlbumsMarkOurs') < rest.indexOf('for(var mk in snap.meta)'), 'before it writes a single row either');
  ok(count(src, 'scAlbumsMarkOurs') >= 5, 'every path that can bring an album in goes through it');
}

console.log('[5] what did not move');
{
  // The sweep itself is NOT loosened to save the day: the way back and the
  // marker are what fix this, so an entry the app made for itself is still the
  // one - and the only one - that goes.
  const isAuto = sliceBetween('function albumIsAuto(name){', 'function visibleAlbumNames');
  ok(/e\.auto === true && e\.manual !== true/.test(isAuto), 'an album is still the app\'s own only when it wears that mark and no other');
  const sweep = sliceBetween('function removeAutoAlbums(){', 'window.__scMarkAlbumManual');
  ok(/if\(!albumIsAuto\(name\)\) return;/.test(sweep), 'the launch sweep still takes nothing but those entries');
  ok(/gone\+\+/.test(sweep), 'it still counts what it removed, so the toast can say so');
  const vis = sliceBetween('function visibleAlbumNames(){', 'function autoAlbumNames');
  ok(/albumIsAuto\(n\)/.test(vis), 'and the Albums tab still reads the same list rule');

  const ensure = sliceBetween('function ensureAlbumSaved(albumName){', 'window.__scEnsureAlbumSaved');
  ok(/manual: true/.test(ensure), 'the album saver still stamps the albums it makes as yours');
  ok(/ids = ids\.filter\(function\(id\)\{ return !claimed\[id\]; \}\)/.test(ensure),
    'and still refuses to take a song another album already owns');

  // The rebuild reads tags; it must not be a re-tagger in disguise.
  ok(count(src, 'persistTrackMeta') > 0 && sliceBetween('function rebuildAlbumsFromTags(){', 'window.__scRebuildAlbumsFromTags').indexOf('persistTrackMeta') === -1,
    'the rebuild never rewrites a song record');
  ok(/ALBUM/.test('ALBUM') && count(src, "key: 'userAlbums', value: userAlbums") >= 5,
    'every album write is still the same single meta row');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
