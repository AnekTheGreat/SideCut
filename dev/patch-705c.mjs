#!/usr/bin/env node
/**
 * SideCut 70.0.5 - "the achievements are actually possible, and nothing asks you
 * to share your songs".
 *
 * patch-705.mjs moved the dock/header controls. patch-705b.mjs added the 201-badge
 * wall, its nine groups, dev mode and the five rewards. This one is the follow-up
 * the user asked for straight after seeing the wall:
 *
 *   "Make the achivements actually possible and without sharing your songs"
 *
 * Three things in the wall could not be earned, and two of them wanted a song to
 * leave the phone:
 *
 *   1. the seven album tiers read `d.albums`, which derivedStats() hard-coded to
 *      zero - impossible for anyone, however many albums they made. The stat is
 *      real now (dev/sc70-module.js), a union of the album names your songs
 *      already carry and the albums you built by hand, and the app's own
 *      `userAlbums` object is published through the one hook added below.
 *   2. the "Blended" badge read `flags.autodj`, and nothing in the module ever
 *      set that flag - only the counter. __scAutoDjAlign now marks the feature.
 *   3. two tiers counted the two export buttons ("Exported everything as a
 *      backup" / "Exported the songs on their own"). On a phone an export opens
 *      the share sheet, so those are the badges the user means by "sharing your
 *      songs". They count a library search and a song queued to play next now -
 *      both entirely local, both wired by the module's own delegated listeners.
 *
 * The generated thresholds were also pulled down to ceilings a year of real
 * listening reaches (see BADGE_TIERS/BADGE_COUNTS), because Premium needs ALL 201
 * and one unreachable tile blocks the reward.
 *
 * Every edit is anchored and asserted, so a tree that does not match fails loudly
 * instead of being half-patched. Re-running it is a no-op.
 *
 * Run order: patch-705.mjs, then patch-705b.mjs, then this one.
 *
 *   node dev/patch-705c.mjs            # apply
 *   node dev/patch-705c.mjs --check    # report only, change nothing
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const CSS = path.join(ROOT, 'dev', 'sc70-styles.css');
const CHECK = process.argv.includes('--check');
const VERSION = '70.0.5';

let html = fs.readFileSync(IDX, 'utf8');
const htmlStart = html;
let applied = 0, already = 0;
const problems = [];

function count(hay, needle){ return hay.split(needle).length - 1; }

function sub(label, oldStr, newStr, opts = {}){
  if(opts.key && count(html, opts.key) >= 1){ already++; return; }
  const times = count(html, oldStr);
  // `optional` is for a repair whose anchor only exists on a tree an earlier run
  // already produced - a missing one there is the good case, not a problem.
  if(times === 0 && opts.optional){ already++; return; }
  if(times === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(times > 1 && !opts.all){ problems.push('anchor is not unique, found ' + times + ' (' + label + ')'); return; }
  html = html.split(oldStr).join(newStr);
  applied++;
}

/* ------------------------------------------- 1. the album stat reaches the app */
// `userAlbums` is the app's own name -> { artist, trackIds, createdAt } map. It is
// declared in the same closure as `playlists` and `allTracks`, both of which are
// already published from this exact spot, so this is one more object of the same
// kind rather than a new door.
{
  sub('__scUserAlbums hook',
    '  window.__scPlaylists = function(){ return playlists; };\n',
    '  window.__scPlaylists = function(){ return playlists; };\n' +
    '  // 70.0.5 - the badge wall counts albums, and it used to be handed a zero for\n' +
    '  // them. This is the app\'s own album map, handed over as-is; the wall unions it\n' +
    '  // with the album names the songs already carry, so the seven album badges can\n' +
    '  // be earned either way.\n' +
    '  window.__scUserAlbums = function(){ return userAlbums; };\n',
    { key: 'window.__scUserAlbums = function(){' });
}

/* ---------------------------------------------------- 2. the release's own note */
// Same version, so the entry 70.0.5 already has GROWS its notes instead of a
// second 70.0.5 entry appearing. The reader sees one release, told once. Two short
// notes rather than one long one: this release's notes are meant to be one or two
// sentences each, and a single paragraph of the whole change reads as a wall.
const LAST_NOTE = "    'All 201, the secret one included, grants SideCut Premium for free. It is a real unlock down the same path a purchase takes, and putting the badges back does not take it away.',\n";
const NOTE_A = "    'Every badge on the wall can now be earned, and none of them asks you to share a song. The seven album badges were counting something the app always reported as zero, and one badge waited on a flag that was never set.',\n";
const NOTE_B = "    'Two badges counted the export buttons, and on a phone an export opens the share sheet - they count a library search and a song queued to play next instead, both entirely local. The tallest targets came down to what a year of listening reaches, so the wall, and the free Premium at the end of it, is finishable.',\n";
// The key has to be a phrase ONLY the short pair carries, or the long note would
// look like the finished state and never get split.
const NOTE_KEY = 'instead, both entirely local. The tallest targets came down to';
const NOTE_LONG = "    'Every badge on the wall can actually be earned, and none of them asks you to share a song. The seven album badges were counting something the app always reported as zero, one waited on a flag nothing ever set, and two counted the export buttons - those count a library search and a song queued to play next instead. The tallest targets (two thousand songs, four thousand plays, a 365-day streak, two hundred hours, five hundred artists) came down to what a year of listening reaches, so the whole wall, and the free Premium at the end of it, is finishable.',\n";
{
  // A first pass wrote the two notes as one long paragraph; split it.
  sub('70.0.5 long note split', NOTE_LONG, NOTE_A + NOTE_B, { optional: true, key: NOTE_KEY });
  sub('70.0.5 attainability notes', LAST_NOTE + '  ] },', LAST_NOTE + NOTE_A + NOTE_B + '  ] },',
    { key: NOTE_KEY });
}

/* -------------------------------------------------------- 3. re-splice the files */
// The module is the source of truth for the badges and the stylesheet for their
// look; both live in their own files and are copied in here, because index.html is
// far too large for the editor tools to reach into.
{
  const mod = fs.readFileSync(MOD, 'utf8');
  const openTag = '<script id="sc-studio-70">';
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  if(blockRe.test(html)){
    const before = html;
    html = html.replace(blockRe, openTag + '\n' + mod + '</script>\n');
    if(html === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }

  const cssText = fs.readFileSync(CSS, 'utf8');
  const cssBlockRe = /\n\/\* =+\n   SideCut 70\.0 -[\s\S]*?<\/style>/;
  if(cssBlockRe.test(html)){
    const before = html;
    html = html.replace(cssBlockRe, '\n' + cssText + '</style>');
    if(html === before) already++; else applied++;
  } else {
    problems.push('the SideCut 70.0 stylesheet block is missing');
  }
}

/* ------------------------------------------------------------------- checks */
const must = (cond, msg) => { if(!cond) problems.push(msg); };
must(count(html, "const APP_VERSION = '70.0.5';") === 1, 'the version is not 70.0.5 exactly once');
must(count(html, 'window.__scUserAlbums = function(){') === 1, 'the album hook is missing from index.html');
must(count(html, 'var FEATURE_KEYS = [') === 1, 'the module does not define the feature list');
must(count(html, 'var BADGE_TIERS = [') === 1, 'the threshold tables are missing');
must(count(html, 'var BADGE_COUNTS = [') === 1, 'the counting table is missing');
must(count(html, 'albums: Object.keys(albums).length') === 1, 'the album stat is still a constant');
must(count(html, 'albums: 0,') === 0, 'a hard-coded zero album stat is still in the module');
must(count(html, "bump('queue', 1)") === 1, 'the queued-song counter is not wired');
must(count(html, "bump('search', 1)") === 1, 'the search counter is not wired');
must(count(html, "markFeature('autodj')") === 1, 'the Auto-DJ feature flag is still never set');
must(count(html, "name: function(){ return 'Searched your library'; }") === 1, 'the search badge is missing');
must(count(html, "name: function(){ return 'Queued a song to play next'; }") === 1, 'the queue badge is missing');
must(count(html, 'exportAll') >= 1 && count(html, "return ctr('exportAll')") === 0, 'a badge still counts the export buttons');
must(count(html, "return ctr('exportSongs')") === 0, 'a badge still counts the export buttons');
must(count(html, 'plays_5000') === 0, 'the 5,000-play badge is still on the wall');
must(count(html, "id: 'plays_3000'") === 1, 'the 3,000-play badge is missing');
must(count(html, 'none of them asks you to share a song') === 1, 'the 70.0.5 entry does not explain the attainability work');
    must(count(html, 'came down to what a year of listening reaches') === 1, 'the 70.0.5 entry does not explain the new targets');
must(count(html, "title: 'Add songs moves to the top of the screen, the dock drops to four tabs") === 1, 'the 70.0.5 head entry title is wrong');
must(count(html, "version: '70.0.5'") === 1, 'there is more than one 70.0.5 changelog entry');
must(count(html, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');
must(count(html, 'body.theme-dyn-vortex::before') === 1, 'the Vortex backdrop is missing from the stylesheet');
must(count(html, '.sc-rewards{') === 1, 'the reward row styles are missing');

if(problems.length){
  console.error('patch-705c: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-705c: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}
if(html === htmlStart && applied === 0){
  console.log('patch-705c: nothing to change, tree is already at ' + VERSION + ' (' + already + ' in place)');
  process.exit(0);
}
fs.writeFileSync(IDX, html);
console.log('patch-705c: index.html written - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-705c: run `node dev/test-705.mjs` then the OTA rebuild');
