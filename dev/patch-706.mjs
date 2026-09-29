#!/usr/bin/env node
/**
 * SideCut 70.0.6 - "the badges shouldn't have to do with altering your songs".
 *
 * The user's words, verbatim, sent with a screenshot of the Studio section of the
 * badge wall (15 songs re-encoded, 1/5 batch tag runs, 10/50 songs retagged,
 * 5.0/50.0 MB saved by re-encoding):
 *
 *   "The badges shouldny do with altering your songs"
 *
 * That section is exactly what it looks like, and it is a fair complaint: every one
 * of those tiles is paid for by permanently rewriting a song the user already has.
 * Re-encoding replaces the stored file in place, the batch tag editor rewrites the
 * tags inside the files, cropping trims the audio in place, and the megabytes won
 * back are the side effect of the first of those. A wall that pays out free Premium
 * at 201 should not need anybody to edit their own music to finish it.
 *
 * WHAT IS REMOVED (fourteen tiles, and the wall stays at 201):
 *
 *   1. BADGE_COUNTS, five rows, eleven tiers:
 *        crops  [1, 5]               "N songs cropped"
 *        reenc  [1, 5, 15]           "N songs re-encoded"
 *        batch  [1, 5]               "N batch tag runs"
 *        tagged [10, 50]             "N songs retagged"
 *        saved  [5242880, 52428800]  "X saved by re-encoding"
 *   2. BASE_ACHIEVEMENTS, the three hand-written ones that went with them:
 *        crop_1     "Trimmed"        Crop a song
 *        retag_1    "Naming things"  Edit tags in a batch
 *        reencode_1 "Space saver"    Re-encode a song smaller
 *   3. The `reencoded` stat derivedStats() computed for the re-encode tiers, and
 *      the three flags in FEATURE_KEYS - the capstone badge ("used every feature")
 *      counted crop, retag and reencode too, so it wanted an edit to complete. It
 *      is nine features now, all of them things you can use without touching a
 *      file you already have.
 *
 * WHAT REPLACES THEM (fourteen tiers, so the count never moves):
 *
 *   More rungs on things you DO, spread over the four places a badge can still be
 *   earned honestly - two each on:
 *     plays    -> 1500, 2000      (Listening)
 *     hours    -> 110, 150        (Listening)
 *     streak   -> 120, 180        (Streaks)
 *     themec   -> 40, 60          (Themes)
 *     asst     -> 100, 200        (Assistant & gestures)
 *     loops    -> 75, 150         (Studio)
 *     visits   -> 100, 250        (Studio)
 *
 *   Recording a loop and opening Studio are not edits: nothing on disk changes.
 *   The Studio section keeps its shape, only its subject moves from editing your
 *   music to using the tools.
 *
 * THE TOOLS THEMSELVES ARE UNTOUCHED. Crop, the batch tag editor and the
 * re-encoder all still work exactly as they did, each with its own Undo, and the
 * storage cleaner still offers a re-encode button. They are just no longer
 * achievements - so the wall can be finished without editing a single song.
 *
 * Two notes for whoever reads this next:
 *
 *   * Every `sub` carries a `key` - the text that exists only AFTER the edit - and
 *     every whole-line deletion carries `gone`, so a second run reports what is
 *     already in place instead of "anchor missing". That is the whole of the
 *     idempotence rule this repo asks of a patch script.
 *   * The badge table KEY names ('reenc', 'batch', 'tagged', 'saved', 'crops') are
 *     the needles the checks use, not the badges' wording: this file's own design
 *     note names those tools on purpose, because it is where the rule is written
 *     down. No tile being NAMED after one of them is asserted on the real app, in
 *     dev/studio-70-check.cjs, where the badge objects are.
 *
 *   node dev/patch-706.mjs            # apply
 *   node dev/patch-706.mjs --check    # report only, change nothing
 *   node dev/patch-706.mjs --manifest # reseed the root manifest.json only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const CSS = path.join(ROOT, 'dev', 'sc70-styles.css');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const TEST70 = path.join(ROOT, 'dev', 'test-70.mjs');
const STUDIO = path.join(ROOT, 'dev', 'studio-70-check.cjs');
const TEST66427 = path.join(ROOT, 'dev', 'test-66427.mjs');
const TEST6139 = path.join(ROOT, 'dev', 'test-6139.mjs');

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.0.6';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 10:16 UTC = 6:16 AM EDT, the same day.
const STAMP = 'September 29, 2026 \u00b7 6:16 AM EDT';
const CACHE = 'sidecut-shell-v63.0.32';
const OLDCACHE = 'sidecut-shell-v63.0.31';
const TITLE = 'The badges stop asking you to change your songs';

// Six notes, none with an apostrophe: a note is emitted into a single-quoted
// literal in the changelog, so a quote in one would have to be escaped.
const NOTES = [
  'The badges that rewarded editing your own music are gone. Nothing on the wall asks you to re-encode a song, run the batch tag editor, or trade quality for space any more.',
  'The nine tiles they occupied count what you play and how you use the app instead: more plays, more hours, a longer streak, more Studio visits, more loops, more theme changes and more done by the assistant.',
  'Trimmed, Naming things and Space saver went with them, and the badge that wants every feature touched no longer counts the three editing tools.',
  'The wall is still 201 badges with the same five rewards: Cinder at 50, Quartz at 100, Lumen at 150, the finger-whirled Vortex at 200, and SideCut Premium for all 201.',
  'Cropping, re-encoding and batch tag editing all still work, each with its own undo - they are simply no longer achievements, so finishing the wall never means touching a song.',
  'Nothing else moved: the dock is still four tabs, Add songs is still the + in the header, and the secret badge is still behind seven taps on the version line.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

/* One helper, five files: each file is handed over in a mutable holder so the same
   `sub` and `dropLines` can edit the page, the module, sw.js and the two gates. */
function holder(text){ return { text: text }; }

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  // `key` is text that only exists once the edit has landed; `gone` is for a
  // deletion, where the proof is that the anchor is no longer there.
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  if(opts.gone && count(h.text, oldStr) === 0){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

// Whole lines only, matched by shape rather than by a literal full of \uXXXX
// escapes: a badge table row is deleted by what it declares, not by retyping it.
// Zero matches means the deletion has already happened.
function dropLines(h, label, re, expect){
  const lines = h.text.split('\n');
  const keep = lines.filter((l) => !re.test(l));
  const n = lines.length - keep.length;
  if(n === 0){ already++; return; }
  if(expect != null && n !== expect){
    problems.push('dropLines removed ' + n + ' line(s), expected ' + expect + ' (' + label + ')');
    return;
  }
  h.text = keep.join('\n');
  applied++;
}

/* ------------------------------------------------------------ 1. the module */
const mod = holder(fs.readFileSync(MOD, 'utf8'));

// 1a. The five BADGE_COUNTS rows that are paid for with an edit, and the three
// hand-written badges that are the same complaint under a nicer name.
dropLines(mod, 'the five editing tier rows', /g: 'studio', k: '(crops|reenc|batch|tagged|saved)',/, 5);
dropLines(mod, 'the three editing base badges', /^\s*\{ id: '(crop_1|retag_1|reencode_1)',/, 3);

// 1b. The fourteen replacement rungs. Anchored on the `vals` array alone, which
// is the part that moves - the row's icon and wording stay where they were.
sub(mod, 'plays rungs', 'vals: [3, 5, 10, 25, 50, 150, 250, 400, 600, 800, 1200],',
  'vals: [3, 5, 10, 25, 50, 150, 250, 400, 600, 800, 1200, 1500, 2000],',
  { key: 'vals: [3, 5, 10, 25, 50, 150, 250, 400, 600, 800, 1200, 1500, 2000],' });
sub(mod, 'hours rungs', 'vals: [0.1, 0.25, 0.5, 2, 5, 7.5, 15, 20, 25, 40, 50, 60, 75, 90],',
  'vals: [0.1, 0.25, 0.5, 2, 5, 7.5, 15, 20, 25, 40, 50, 60, 75, 90, 110, 150],',
  { key: 'vals: [0.1, 0.25, 0.5, 2, 5, 7.5, 15, 20, 25, 40, 50, 60, 75, 90, 110, 150],' });
sub(mod, 'streak rungs', 'vals: [2, 4, 5, 6, 8, 10, 14, 21, 45, 60, 75, 90],',
  'vals: [2, 4, 5, 6, 8, 10, 14, 21, 45, 60, 75, 90, 120, 180],',
  { key: 'vals: [2, 4, 5, 6, 8, 10, 14, 21, 45, 60, 75, 90, 120, 180],' });
sub(mod, 'loops rungs', 'vals: [1, 5, 25],', 'vals: [1, 5, 25, 75, 150],',
  { key: 'vals: [1, 5, 25, 75, 150],' });
sub(mod, 'visits rungs', 'vals: [10, 50],', 'vals: [10, 50, 100, 250],',
  { key: 'vals: [10, 50, 100, 250],' });
sub(mod, 'assistant rungs', 'vals: [5, 10, 25, 50],', 'vals: [5, 10, 25, 50, 100, 200],',
  { key: 'vals: [5, 10, 25, 50, 100, 200],' });
sub(mod, 'theme change rungs', 'vals: [1, 5, 10, 25],', 'vals: [1, 5, 10, 25, 40, 60],',
  { key: 'vals: [1, 5, 10, 25, 40, 60],' });

// 1c. The capstone badge no longer counts the three in-place editors.
sub(mod, 'FEATURE_KEYS',
  "var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'crop', 'retag', 'reencode', 'assistant', 'autodj', 'gestures'];",
  "var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures'];",
  { key: "var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures'];" });
sub(mod, 'FEATURE_KEYS comment',
  '  // new flag cannot be counted without joining it. Nothing here is a share or an\n' +
  '  // export - every one of these happens on the phone, to your own files.',
  '  // new flag cannot be counted without joining it. Nothing here is a share, an\n' +
  '  // export or an EDIT: 70.0.6 took the three in-place editors (crop, retag and\n' +
  '  // reencode) out, so the capstone is nine features you can use on your own\n' +
  '  // files without changing one.',
  { key: 'export or an EDIT' });

// 1d. The album union stays; the re-encoded stat it sat next to does not.
sub(mod, 'derivedStats reencoded decl',
  'var artists = {}, genres = {}, played = 0, maxPlays = 0, reencoded = 0, albums = {};',
  'var artists = {}, genres = {}, played = 0, maxPlays = 0, albums = {};',
  { key: 'var artists = {}, genres = {}, played = 0, maxPlays = 0, albums = {};' });
sub(mod, 'derivedStats reencoded count', '      if(t.reencoded) reencoded++;\n', '', { gone: true });
sub(mod, 'derivedStats reencoded return', '      reencoded: reencoded,\n', '', { gone: true });

// 1e. GROUP map: the three base badges are gone from their group.
sub(mod, 'BASE_GROUPS',
  "    clip_1: 'studio', crop_1: 'studio', retag_1: 'studio', reencode_1: 'studio', all_tools: 'studio',",
  "    clip_1: 'studio', all_tools: 'studio',",
  { key: "    clip_1: 'studio', all_tools: 'studio'," });

// 1f. The design note that is now the rule, and the section header.
sub(mod, 'section 5b header',
  '     5b. TWO HUNDRED BADGES, ONE SECRET, AND FIVE REWARDS (70.0.5)',
  '     5b. TWO HUNDRED BADGES, ONE SECRET, AND FIVE REWARDS (70.0.5, revised 70.0.6)',
  { key: '(70.0.5, revised 70.0.6)' });
sub(mod, 'section 5b the no-edits rule',
  '       * The themes are gated LIVE - the app asks whether the badge count has reached',
  '       * NOTHING ON THE WALL CHANGES A SONG YOU ALREADY HAVE (70.0.6). The wall used\n' +
  '         to reward the three in-place editors - re-encoding a song smaller, running\n' +
  '         the batch tag editor, and cropping a song - plus the nine generated tiers\n' +
  '         that counted them (songs re-encoded, batch tag runs, songs retagged, and\n' +
  '         the megabytes won back). All fourteen tiles are gone, including the three\n' +
  '         hand-written ones (Trimmed, Naming things, Space saver). The tools still\n' +
  '         exist and still work, each with its own undo; they are simply not\n' +
  '         achievements, so finishing the wall never costs anybody a file. The\n' +
  '         capstone stopped counting them too (FEATURE_KEYS is nine, not twelve). The\n' +
  '         fourteen tiles came back as more rungs on things you DO - more plays, more\n' +
  '         hours listened, a longer streak, more Studio visits, more loops, more\n' +
  '         theme changes and more things done by the assistant - so the wall is still\n' +
  '         201 and the five rewards still sit at 50, 100, 150, 200 and 201.\n' +
  '       * The themes are gated LIVE - the app asks whether the badge count has reached',
  { key: 'NOTHING ON THE WALL CHANGES A SONG YOU ALREADY HAVE' });

/* ----------------------------------------------------------------- 2. page */
const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

sub(html, 'APP_VERSION', "const APP_VERSION = '70.0.5';", "const APP_VERSION = '70.0.6';",
  { key: "const APP_VERSION = '70.0.6';" });

// The new head entry, in front of 70.0.5 - the array is newest first.
const ENTRY =
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',").join('\n') + '\n' +
  '  ] },\n';
sub(html, 'the 70.0.6 changelog entry',
  "  const CHANGELOG = [\n  { version: '70.0.5',",
  '  const CHANGELOG = [\n' + ENTRY + "  { version: '70.0.5',",
  { key: "  { version: '70.0.6', date: '" });

sub(sw, 'shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ---------------------------------------------------- 3. the two 70.0.5 gates */
// test-705 DESCRIBES 70.0.5, so it reads ITS entry by version now and the
// "which build is on the page" pins become shape tests - the same move
// dev/repin-705.mjs made for the 70.0 gate.
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
sub(t705, 'test-705 the build pin',
  "  ok(ver === VER, 'the app runs as ' + VER + ' (' + ver + ')');",
  '  // The build on the page is 70.0.5 or a patch on it; the release this gate\n' +
  '  // DESCRIBES is still 70.0.5, which is why VER does not move with APP_VERSION.\n' +
  "  ok(/^\\d+(\\.\\d+)+$/.test(String(ver)), 'the app runs a real release number (' + ver + ')');",
  { key: 'the app runs a real release number' });
sub(t705, 'test-705 the version literal',
  '  ok(count("const APP_VERSION = \'70.0.5\';") === 1, \'and the version string is exactly 70.0.5\');',
  "  ok(/const APP_VERSION = '\\d+(\\.\\d+)+';/.test(src), 'and the page carries one version string');",
  { key: 'and the page carries one version string' });
sub(t705, 'test-705 reads its own entry',
  '    const head = entries[0];',
  '    // The 70.0.5 entry, read by version: the top of the array belongs to\n' +
  "    // whatever shipped last, which is no longer this gate's release.\n" +
  "    const head = entries.find((e) => String(e.version) === VER) || entries[0];",
  { key: 'const head = entries.find((e) => String(e.version) === VER)' });
sub(t705, 'test-705 the head wording',
  "    ok(String(head.version) === VER, 'the head entry is v' + head.version);",
  "    ok(String(head.version) === VER, 'the entry this gate reads is v' + head.version);",
  { key: 'the entry this gate reads is v' });
sub(t705, 'test-705 the previous entry',
  "    ok(String(entries[1] && entries[1].version) === PREV, 'the release before this one is still listed next (' + (entries[1] && entries[1].version) + ')');",
  '    ok(String((entries[entries.findIndex((e) => String(e.version) === String(head.version)) + 1] || {}).version) === PREV,\n' +
  "       'the release before this one is still listed next');",
  { key: 'entries[entries.findIndex((e) => String(e.version) === String(head.version)) + 1]' });
// The reachable ceilings grew with the replacement rungs, so the caps move too.
sub(t705, 'test-705 listen caps',
  "    ['plays', 3, 1200], ['hours', 0.1, 90], ['one song', 2, 25], ['different songs', 1, 200],",
  "    ['plays', 3, 2000], ['hours', 0.1, 150], ['one song', 2, 25], ['different songs', 1, 200],",
  { key: "['plays', 3, 2000], ['hours', 0.1, 150]" });
sub(t705, 'test-705 streak cap',
  "    ['late-night', 3, 25], ['artists', 2, 200], ['genres', 1, 20], ['streak', 2, 90],",
  "    ['late-night', 3, 25], ['artists', 2, 200], ['genres', 1, 20], ['streak', 2, 180],",
  { key: "['streak', 2, 180]" });
// And the wall is asserted to be about the app, not about editing your music.
sub(t705, 'test-705 no-edit assertions',
  "  ok(countMod(\"return ctr('exportAll')\") === 0 && countMod(\"return ctr('exportSongs')\") === 0,\n" +
  "    'and no badge counts an export any more');",
  "  ok(countMod(\"return ctr('exportAll')\") === 0 && countMod(\"return ctr('exportSongs')\") === 0,\n" +
  "    'and no badge counts an export any more');\n" +
  '  // 70.0.6, the user\'s words: "The badges shouldny do with altering your songs".\n' +
  '  // The three in-place editors are tools, not achievements - and neither is the\n' +
  '  // space one of them wins back.\n' +
  "  ok(countMod(\"'crop', 'retag', 'reencode'\") === 0, 'the feature list no longer wants an edit');\n" +
  "  ok(countMod(\"return ctr('savedBytes')\") === 0 && countMod(\"return ctr('crops')\") === 0 &&\n" +
  "     countMod(\"return ctr('batch')\") === 0 && countMod(\"return ctr('tagged')\") === 0,\n" +
  "     'and no tile counts a re-encode, a batch tag run or the space it won back');\n" +
  "  ok(countMod('d.reencoded') === 0 && countMod('reencoded: reencoded') === 0,\n" +
  "     'nor reads the re-encoded stat the cleaner keeps');\n" +
  "  ok(countMod(\"id: 'crop_1'\") === 0 && countMod(\"id: 'retag_1'\") === 0 && countMod(\"id: 'reencode_1'\") === 0,\n" +
  "     'and the three hand-written editing badges are off the wall');",
  { key: 'the feature list no longer wants an edit' });

// The 70.0 gate names two of the badges it shipped among the ones it looks for, and
// this release takes those two OFF the wall. It keeps its check count by asking
// about them the other way round - the same move dev/test-66425.mjs made when a
// line it pinned as present was removed.
const t70 = holder(fs.readFileSync(TEST70, 'utf8'));
sub(t70, 'test-70 the edited badges',
  "  ['streak_7', 'hour_100', 'studio_first', 'clip_1', 'retag_1', 'reencode_1'].forEach((id) =>\n" +
  "    ok(ids.indexOf(id) !== -1, 'including ' + id));",
  "  ['streak_7', 'hour_100', 'studio_first', 'clip_1'].forEach((id) =>\n" +
  "    ok(ids.indexOf(id) !== -1, 'including ' + id));\n" +
  '  // 70.0.6 took the two editing badges off the wall (test-705 owns that release);\n' +
  '  // this gate keeps its six checks by asking about them the other way round.\n' +
  "  ['retag_1', 'reencode_1'].forEach((id) =>\n" +
  "    ok(ids.indexOf(id) === -1, 'and no longer including ' + id));",
  { key: "'and no longer including ' + id" });

// A gate 70.0.5 left red without noticing, found by this release's sweep. The
// Vortex reward theme added a per-theme glow rule of its own (every other dynamic
// theme shares one), so the count of that animation went 4 -> 5 and dev/test-66427
// still asked for 4. Nothing about the glow changed; the number did.
const t66427 = holder(fs.readFileSync(TEST66427, 'utf8'));
sub(t66427, 'test-66427 the glow count',
  "  ok(count('animation: sd-glow-pulse 6s ease-in-out infinite') === 4, 'and the glow still breathes on the 6s cycle (' + count('animation: sd-glow-pulse 6s ease-in-out infinite') + ')');",
  '  // Five, not four: the Vortex reward theme (70.0.5) carries a per-theme rule of\n' +
  '  // its own, where every other dynamic theme shares one. The gate was red from\n' +
  '  // that release until 70.0.6 moved the number, which is what it is counting.\n' +
  "  ok(count('animation: sd-glow-pulse 6s ease-in-out infinite') === 5, 'and the glow still breathes on the 6s cycle (' + count('animation: sd-glow-pulse 6s ease-in-out infinite') + ')');",
  { key: 'Five, not four' });

// The second gate 70.0 left red without noticing. This one describes 61.5/64.3.1
// and pinned the TOP of the changelog to 64.3.1, so 70.0 - whose entry is the head
// now - broke it. A gate that describes a release has no business pinning the head
// (test-66431 and test-6643 already read their own entry by version); what it is
// really asking is that its release is still in the array.
const t6139 = holder(fs.readFileSync(TEST6139, 'utf8'));
sub(t6139, 'test-6139 the changelog head pin',
  "  ok(entries[0].version === '64.3.1', '64.3.1 heads the changelog');",
  '  // Still LISTED, not still first: the head belongs to whatever shipped last.\n' +
  "  ok(entries.some((e) => String(e.version) === '64.3.1'), '64.3.1 is still in the changelog');",
  { key: '64.3.1 is still in the changelog' });

// The real-app probe: assert it on the badge objects, where the words live.
const studio = holder(fs.readFileSync(STUDIO, 'utf8'));
sub(studio, 'studio-70-check the no-edit assertion',
  "    ok(all.every((a) => Number.isFinite(a.need.got) && a.need.want > 0),\n" +
  "      'and every one of them has a target and a countable progress');",
  "    ok(all.every((a) => Number.isFinite(a.need.got) && a.need.want > 0),\n" +
  "      'and every one of them has a target and a countable progress');\n" +
  '\n' +
  '    // 70.0.6, the user\'s words: "The badges shouldny do with altering your songs".\n' +
  '    // Crop, the batch tag editor and the re-encoder are tools, not achievements -\n' +
  '    // no tile on the wall may name one of them or what it saves.\n' +
  '    const EDIT_WORD = /re-encod|retagg|batch tag|cropped|space won|saved by/i;\n' +
  "    ok(all.every((a) => !EDIT_WORD.test(a.name + ' ' + a.sub)),\n" +
  "      'and no badge asks you to alter a song you already have');",
  { key: 'no badge asks you to alter a song you already have' });

/* ------------------------------------------------------- 4. re-splice both */
{
  const openTag = '<script id="sc-studio-70">';
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = openTag + '\n' + mod.text + '</script>\n';
  if(blockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(blockRe, wrapped);
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }

  const cssText = fs.readFileSync(CSS, 'utf8');
  const cssBlockRe = /\n\/\* =+\n   SideCut 70\.0 -[\s\S]*?<\/style>/;
  if(cssBlockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(cssBlockRe, '\n' + cssText + '</style>');
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the SideCut 70.0 stylesheet block is missing');
  }
}

/* ------------------------------------------------------------------- checks */
{
  const page = html.text, m = mod.text, swText = sw.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  must(count(page, "const APP_VERSION = '70.0.6';") === 1, 'the version is not 70.0.6 exactly once');
  must(count(page, "version: '70.0.6'") === 1, 'the 70.0.6 changelog entry is missing');
  must(count(page, "version: '70.0.5'") === 1, 'the 70.0.5 entry left the array');
  must(count(page, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');

  // The rule of this release, asserted against the module that defines the wall.
  // The table KEY is the needle, not the wording: this file's own design note names
  // those tools on purpose, because it is where the rule is written down, and the
  // runtime probe is the half that asserts no TILE is named after one of them.
  must(count(m, "k: 'reenc'") === 0, 'a re-encode badge survived');
  must(count(m, "k: 'batch'") === 0, 'a batch tag badge survived');
  must(count(m, "k: 'tagged'") === 0, 'a retag badge survived');
  must(count(m, "k: 'saved'") === 0, 'the space-won-back badge survived');
  must(count(m, "k: 'crops'") === 0, 'a crop badge survived');
  must(count(m, "id: 'crop_1'") === 0 && count(m, "id: 'retag_1'") === 0 && count(m, "id: 'reencode_1'") === 0,
    'a hand-written editing badge survived');
  must(count(m, "'crop', 'retag', 'reencode'") === 0, 'the capstone still counts an edit');
  must(count(m, 'reencoded: reencoded') === 0, 'the re-encoded stat is still derived');

  // The replacements, and the things that must NOT have moved with them.
  must(count(m, 'vals: [3, 5, 10, 25, 50, 150, 250, 400, 600, 800, 1200, 1500, 2000],') === 1, 'the plays rungs are missing');
  must(count(m, 'vals: [1, 5, 25, 75, 150],') === 1, 'the loop rungs are missing');
  must(count(m, 'vals: [10, 50, 100, 250],') === 1, 'the Studio visit rungs are missing');
  must(count(page, "id: 'secret_devmode'") === 1, 'the secret badge is missing');
  must(count(m, "at: 201, kind: 'premium'") === 1, 'the Premium reward is missing');
  must(count(swText, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(swText, "const CACHE_NAME = '" + OLDCACHE + "';") === 0, 'the old shell cache is still in sw.js');

  must(count(t705.text, "ok(ver === VER, 'the app runs as '") === 0, 'test-705 still pins the build');
  must(count(t705.text, 'const head = entries.find((e) => String(e.version) === VER)') === 1,
    'test-705 does not read its own changelog entry');
  must(count(studio.text, 'no badge asks you to alter a song you already have') === 1,
    'the real-app probe does not assert the rule');
  must(count(t70.text, "'and no longer including ' + id") === 1,
    'the 70.0 gate still expects the two editing badges on the wall');
  must(count(t66427.text, 'Five, not four') === 1, 'the glow-cycle gate was not moved with the Vortex rule');
  must(count(t6139.text, 'is still in the changelog') === 1, 'the 61.5/64.3.1 gate still pins the head');
}

if(problems.length){
  console.error('patch-706: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  // Same hand-off the other release patches use: the root manifest.json is the
  // very first OTA location and is seeded from the built bundle's own size.
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-706: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-706: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [
  [MOD, mod.text], [IDX, html.text], [SW, sw.text],
  [TEST705, t705.text], [TEST70, t70.text], [TEST66427, t66427.text],
  [TEST6139, t6139.text], [STUDIO, studio.text],
];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-706: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-706: next `node dev/repin-706.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
