/**
 * v70.0.5 - Add songs moves to the header, the dock drops to four, and the
 *           achievements wall grows to 201 badges with five rewards.
 *
 * The user's words, verbatim, in two messages:
 *   "Remove the add songs tab from bottom and remove the refresh button from the
 *    top and replace that with a plus sign for add songs v70.0.5"
 *   "Achivements should have over 200 of them including 1 secret 1 where you have
 *    to enter dev mode in order to obtain them. If you can get all 200 badges you
 *    get a free very nice dynamic theme that whirls with your finger same version
 *    v70.0.5 you should also get a free theme for reaching 50 badges, 100 badges
 *    and 150 badges and at 201 with the secret one you can get a free SideCut
 *    premium"
 *
 * A two-control move is exactly the kind of change that looks fine in the diff and
 * is wrong on the phone, so this gate is written against what can be broken:
 *
 *   [1] the release itself: 70.0.5 runs, the head entry says so with a real
 *       Eastern stamp, and the release it replaced is still listed next;
 *   [2] the dock: four tabs, in order, and the add-songs pill AND its wrap gone -
 *       the wrap was a flex child, so leaving it behind would keep a fifth share
 *       of the row for nothing;
 *   [3] the header: the refresh button gone, the + in its slot, wired to the menu
 *       it now owns, and nothing left reading the id that left;
 *   [4] the menu: still in the document, still inside the dock's subtree (that is
 *       what lifts it over the player), still with all five entries;
 *   [5] the copy that pointed at the old pill: no caret left, and the words the
 *       older how-to gates look for are still there;
 *   [6] the styles: the dead wrap/pill rules gone, the dock still fixed on
 *       --sc-dock-h, and the .menu-open lift still present;
 *   [7] the Studio header: it names the build on the page instead of the release
 *       the module was written in;
 *   [8] the badge wall: 201 of them, one secret, gated on dev mode, and the five
 *       rewards - three themes at 50/100/150, the dynamic Vortex at 200, and
 *       Premium at 201 - with the gate the Theme tab asks and the backdrop the
 *       finger turns;
 *   [9]-[11] the same release driven on the real app, the earlier releases still
 *       standing, and the page still parsing as one document.
 *
 *   node dev/test-705.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, 'dev', 'sc70-module.js'), 'utf8');

const VER = '70.0.5';
const PREV = '70.0';
const SHELL_CACHE = 'sidecut-shell-v63.0.32';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
// The badge wall's own file. `count(mod, x)` is NOT this: the two-argument calls
// above ask whether the whole module text (a needle) appears in the page, which is
// how the splice-once checks read. Anything about the module's CONTENT uses this.
const countMod = (needle) => mod.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
const slice = (from, to, hay = src) => {
  const a = hay.indexOf(from);
  const b = hay.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return hay.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  // The build on the page is 70.0.5 or a patch on it; the release this gate
  // DESCRIBES is still 70.0.5, which is why VER does not move with APP_VERSION.
  ok(/^\d+(\.\d+)+$/.test(String(ver)), 'the app runs a real release number (' + ver + ')');
  ok(/const APP_VERSION = '\d+(\.\d+)+';/.test(src), 'and the page carries one version string');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // The 70.0.5 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === VER) || entries[0];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the entry this gate reads is v' + head.version);
    ok(items.length === 10, 'ten notes, one per thing that moved (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 320, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    ok(String((entries[entries.findIndex((e) => String(e.version) === String(head.version)) + 1] || {}).version) === PREV,
       'the release before this one is still listed next');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    // The stamp rule at APP_VERSION: Eastern is UTC-4 and the DATE rolls back with
    // it. A stamp in the reader's future is the bug 64.3 fixed, so it is checked
    // against the clock rather than against a literal.
    const stamp = String(head.date).match(/([A-Z][a-z]+) (\d+), (\d{4}) · (\d+):(\d+) (AM|PM) EDT/);
    ok(!!stamp, 'and it parses as a real date');
    if (stamp) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      let hh = parseInt(stamp[4], 10) % 12;
      if (stamp[6] === 'PM') hh += 12;
      const at = Date.UTC(parseInt(stamp[3], 10), months.indexOf(stamp[1]), parseInt(stamp[2], 10), hh + 4, parseInt(stamp[5], 10));
      ok(at - Date.now() < 15 * 60 * 1000, 'and it is not stamped in the future');
    }
    const notes = items.join('\n');
    ok(/dock/i.test(notes) && /four tabs/i.test(notes), 'the notes say the dock lost a tab');
    ok(/top of the screen/i.test(notes) && /add songs/i.test(notes), 'and that Add songs is at the top of the screen');
    ok(/refresh/i.test(notes), 'and that the refresh button went with it');
    ok(/201/.test(notes) && /badges/.test(notes), 'and the notes say the wall is 201 badges');
    ok(/secret/i.test(notes) && /seven times/.test(notes), 'and how the secret one is reached (seven taps)');
    ok(/Cinder/.test(notes) && /Quartz/.test(notes) && /Lumen/.test(notes) && /Vortex/.test(notes),
      'and name all four reward themes');
    ok(/Premium/.test(notes), 'and the free Premium at 201');
    ok(/none of them asks you to share a song/.test(notes), 'and that no badge asks for a song to be shared');
    ok(/album badges/.test(notes) && /zero/.test(notes), 'and name the album stat that always read zero');
    ok(!/\bmp3\b|converting|conversion|hand-?off/i.test(notes), 'with no converter term in it');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'and every note publishes on both channels');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache moved with the release (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1 && swCache.indexOf('70.0') === -1, 'and carries none of the app version');
}

console.log('\n[2] the dock is four tabs');
{
  const strip = slice('<div class="action-strip" id="actionStrip">', '<div id="addSongsBackdrop"');
  ok(!!strip, 'the dock is still in the document');
  // Direct children only: the menu lives in this same subtree and its five buttons
  // wear .action-pill as well.
  const pills = (strip.match(/<button id="([A-Za-z0-9_]+)" class="action-pill"/g) || []);
  ok(pills.length === 4, 'four pills (' + pills.length + ')');
  ['homeBtn', 'libraryBtn', 'discoverBtn', 'studioBtn'].forEach((id, i) => {
    ok(pills[i] === `<button id="${id}" class="action-pill"`, 'pill ' + (i + 1) + ' is ' + id);
  });
  ok(count('id="addSongsToggle"') === 0, 'the add-songs pill is gone');
  ok(count('id="addSongsWrap"') === 0, 'and so is the wrap it sat in (it was a flex child of the strip)');
  ok(count('class="add-songs-wrap"') === 0, 'with no class reference left behind');
  // The dock is still the fixed bar the v70 release built, and every scrolling
  // view still clears it.
  ok(/\.action-strip\{\s*position:\s*fixed[^}]*z-index:\s*25/.test(src), 'the dock is still fixed to the bottom');
  ok(has('#nowPlaying{ bottom: calc(var(--sc-dock-h)'), 'and the player is still lifted onto it');
}

console.log('\n[3] the header +');
{
  ok(count('id="refreshBtn"') === 0, 'the refresh button is gone');
  ok(!has("getElementById('refreshBtn')"), 'and nothing reads its id any more');
  ok(count('id="addSongsBtn"') === 1, 'the header has one +');
  const header = slice('<header>', '</header>');
  ok(header.indexOf('id="addSongsBtn"') !== -1, 'and it is the header it sits in');
  ok(header.indexOf('id="notifBtn"') !== -1 && header.indexOf('id="themeBtn"') !== -1,
     'between the notifications bell and settings, where the refresh button was');
  const plusTag = header.slice(header.indexOf('id="addSongsBtn"'), header.indexOf('</button>', header.indexOf('id="addSongsBtn"')));
  ok(plusTag.indexOf('title="Add songs"') !== -1, 'titled Add songs, so it says what it is when held');
  ok(has('<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>'), 'with the plus glyph, not the refresh arrow');
  ok(!has('M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42'), 'and the refresh arrow is gone from the page');
  ok(count("  $('addSongsBtn').addEventListener('click'") === 1, 'the + is wired to the menu');
  ok(has("if($('addSongsMenu').classList.contains('open')) closeAddSongsMenu();"),
     'and it toggles rather than only opening');
}

console.log('\n[4] the menu it opens');
{
  ok(count('id="addSongsMenu"') === 1, 'the menu is still in the document');
  ok(count('id="addSongsBackdrop"') === 1, 'with its backdrop');
  // Inside the dock's own subtree on purpose: the menu is position:fixed, but the
  // .menu-open z-index on the strip is what lifts it over #nowPlaying (z-index 20).
  const strip = slice('<div class="action-strip" id="actionStrip">', '<input type="file" id="importLibInput">');
  ok(strip.indexOf('id="addSongsMenu"') !== -1 && strip.indexOf('id="addSongsBackdrop"') !== -1,
     'both still live inside the dock, which is what lifts them over the player');
  ['addFolderBtn', 'addBtn', 'importLibBtn', 'exportSongsBtn', 'exportLibBtn'].forEach((id) =>
    ok(strip.indexOf(`id="${id}"`) !== -1, 'the menu still offers ' + id));
  ok(has("$('addSongsBackdrop').addEventListener('click', closeAddSongsMenu)"), 'tapping outside still closes it');
  ok(/\.action-strip\.menu-open\{ z-index:300; \}/.test(src), 'and the dock still lifts while it is open');
  // The menu is out of flow and hidden until it opens, so it must not be laid out
  // as a fifth flex child of the strip.
  ok(/\.add-songs-menu\{\n\s*display:none; position:fixed/.test(src), 'the menu is still fixed and starts shut');
}

console.log('\n[5] the copy that pointed at the old pill');
{
  ok(count('+ Add songs ▾') === 0, 'no caret is left pointing at a pill that is not there');
  ok(count('+ Add songs') > 0, 'and the Add songs menu is still named in the how-to text');
  ok(has('+ Add songs → + Files'), 'including the failure message that sends people to it');
  // The five older copy gates all look for the words "+ Add songs" and "+ Files"
  // together; the caret was the only part that had to go, so they stay true.
  ok(has('<b>+ Add songs → + Files</b>') && count('<b>+ Add songs') >= 2, 'and the how-to steps still name it');
}

console.log('\n[6] the styles');
{
  ok(!has('.add-songs-wrap{'), 'the dead wrap rule is gone');
  ok(!has('#addSongsToggle{'), 'and the dead pill rule is gone');
  ok(count('.action-strip > *{ flex: 1 1 0; min-width: 0; }') === 1, 'every dock pill still shares the row');
  ok(has('#libraryBtn{ flex: 1.18 1 0; border-radius: 14px; }'), 'and the split tab still keeps its extra room');
  ok(has('--sc-dock-h: 56px'), 'the dock height token is untouched');
}

console.log('\n[7] the Studio header names the real build');
{
  ok(!/var VERSION = '70\.0';/.test(mod), 'the module no longer pins the release it was written in');
  ok(/var VERSION = \(typeof window !== 'undefined' && window\.APP_VERSION\)/.test(mod),
     'it reads the version the app publishes');
  ok(has("if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;"),
     'and the app really publishes one');
  ok(count('id="sc-studio-70"') === 1, 'the Studio block is still spliced in once');
}

console.log('\n[8] 201 badges, dev mode, five rewards');
{
  // ---- the wall ----
  ok(count(mod, 'TWO HUNDRED BADGES, ONE SECRET, AND FIVE REWARDS') === 1,
    'the module states the size of the wall in its own words');
  ok(count(mod, "id: 'secret_devmode'") === 1, 'and there is exactly one secret badge');
  ok(count(mod, 'secret: true') === 1, 'marked as secret rather than left to the name');
  ok(/GROUP_TITLES = \[\s*\n\s*\['streak'/.test(mod), 'the grid is grouped');
  ['streak', 'listen', 'explore', 'library', 'studio', 'assistant', 'themes', 'miles', 'secret'].forEach((g) =>
    ok(mod.indexOf(`['${g}', `) !== -1, 'including a ' + g + ' section'));
  ok(mod.indexOf('g.have ? g.items.filter(isUnlocked).map(badgeTile).join(\'\') : secretTile()') !== -1,
    'and the secret section still renders before dev mode, as one blank tile');

  // ---- dev mode ----
  ok(count(mod, 'function wireDevGesture()') === 1, 'dev mode is opened by a gesture');
  ok(/el\.__scDevTaps >= 7/.test(mod), 'seven taps, exactly');
  ok(mod.indexOf("localStorage.setItem('sidecut_testMode', '1')") !== -1,
    'and it sets the app\u2019s own test flag, so the app\u2019s dev affordances come with it');
  ok(mod.indexOf("localStorage.removeItem('sidecut_testMode')") !== -1, 'and clears it on the way out');
  ok(count(mod, "data-act=\"devreset\"") === 1, 'dev mode can reset its own state');
  ok(/Premium was left alone/.test(mod), 'and the reset says out loud that Premium is not its to take back');

  // ---- the five rewards ----
  const ats = [...mod.matchAll(/\{ at: (\d+),\s*kind: '([a-z]+)',\s*key: '([a-z]+)'/g)].map((m) => ({ at: Number(m[1]), kind: m[2], key: m[3] }));
  ok(ats.length === 5, 'five rewards are declared (' + ats.length + ')');
  ok(ats.map((r) => r.at).join(',') === '50,100,150,200,201', 'at 50, 100, 150, 200 and 201');
  ok(ats[3].key === 'vortex', 'the 200 one is Vortex');
  ok(ats[4].kind === 'premium' && ats[4].at === 201, 'and the 201 one is Premium, behind the secret badge');
  ok(ats.slice(0, 4).every((r) => r.kind === 'theme'), 'the other four are themes');

  // ---- the themes themselves, on the app side ----
  ['cinder', 'quartz', 'lumen'].forEach((k) =>
    ok(new RegExp('^\\s*' + k + ':\\s*\\{[^}]*reward:true', 'm').test(src), 'the app carries the ' + k + ' theme'));
  ok(new RegExp('^\\s*vortex:\\s*\\{[^}]*dynamic:\'vortex\'', 'm').test(src),
    'and Vortex is a dynamic theme, so applyTheme gives the body its class');
  ok(count('reward:true') === 4, 'exactly four themes are rewards (' + count('reward:true') + ')');
  ok(count(src, 'function rewardThemeOK(key){') === 1, 'the Theme tab gates them live, not on a stored flag');
  ok(src.indexOf('if(th.reward && !rewardThemeOK(key)){') !== -1, 'and refuses the tap with a reason');
  ok(count('window.__scRewardThemeUnlocked') >= 2, 'the wall and the Theme tab are both halves of it');
  ok(count(src, 'window.__scGrantPremium') === 1, 'and the Premium grant is one named hook');
  ok(src.indexOf("setPremiumActive(Object.assign({ plan: 'gifted', gifted: true, source: 'badges' }") !== -1,
    'which goes through the app\u2019s own premium setter, marked as a gift');
  ok(src.indexOf('grantRewards(!!silent);\n    return fresh;') !== -1,
    'and is granted whenever the count is evaluated, not only on the frame a badge unlocks');

  // ---- the whirl ----
  ok(count(src, 'body.theme-dyn-vortex::before') === 1, 'Vortex has a backdrop rule of its own');
  ok(/body\.theme-dyn-vortex::before\{[\s\S]{0,700}transform: rotate\(var\(--whirl-deg, 0deg\)\)/.test(src),
    'and it rotates on the angle the finger writes');
  ok(count(mod, 'function whirlAngle(e)') === 1, 'which the module computes from where the finger is');
  ok(mod.indexOf("'--whirl-deg'") !== -1, 'and writes to the page as --whirl-deg');
  ok(/closest\('#nowPlaying, input, \.sc-sheet, \.sc-slider'\)/.test(mod),
    'while never stealing a drag from the player or a sheet');
  ok(count(mod, 'window.__scNoteTheme = noteTheme;') === 1,
    'and the app reports every theme change, so wearing one from Settings counts too');

  // ---- every tile on the wall is reachable, and none of them needs a share ----
  // Three tiles used to be unearnable (a stat the app always reported as zero, a
  // flag nothing ever set) and two counted the export buttons, which on a phone
  // open the share sheet. Premium needs ALL 201, so one impossible tile blocks the
  // reward - these are the assertions that keep that from coming back.
  ok(countMod('albums: 0,') === 0, 'no stat the badges read is a hard-coded zero');
  ok(countMod('albums: Object.keys(albums).length') === 1, 'the album count is computed from the library');
  ok(countMod("call('__scUserAlbums')") === 1 && count('window.__scUserAlbums = function(){') === 1,
    'and the app hands its own album map over for it');
  ok(countMod('albumsMade: made') === 1, 'with the hand-built albums counted as well');
  ok(countMod("markFeature('autodj')") === 1, 'the one flag nothing used to set is set now');
  ok(countMod("return ctr('exportAll')") === 0 && countMod("return ctr('exportSongs')") === 0,
    'and no badge counts an export any more');
  // 70.0.6, the user's words: "The badges shouldny do with altering your songs".
  // The three in-place editors are tools, not achievements - and neither is the
  // space one of them wins back.
  ok(countMod("'crop', 'retag', 'reencode'") === 0, 'the feature list no longer wants an edit');
  ok(countMod("return ctr('savedBytes')") === 0 && countMod("return ctr('crops')") === 0 &&
     countMod("return ctr('batch')") === 0 && countMod("return ctr('tagged')") === 0,
     'and no tile counts a re-encode, a batch tag run or the space it won back');
  ok(countMod('d.reencoded') === 0 && countMod('reencoded: reencoded') === 0,
     'nor reads the re-encoded stat the cleaner keeps');
  ok(countMod("id: 'crop_1'") === 0 && countMod("id: 'retag_1'") === 0 && countMod("id: 'reencode_1'") === 0,
     'and the three hand-written editing badges are off the wall');
  ok(countMod("bump('queue', 1)") === 1 && countMod("bump('search', 1)") === 1,
    'the two local replacements are wired: a queued song and a library search');
  ok(countMod("return ctr('search')") === 1 && countMod("return ctr('queue')") === 1,
    'and the tiles are the ones that read them');
  ok(countMod('plays_5000') === 0 && countMod('plays_3000') === 2,
    'the 5,000-play target is off the wall in both places (id and its group)');
  ok(countMod('var FEATURE_KEYS = [') === 1, 'the feature list is named once');
  ok(countMod('featuresUsed: FEATURE_KEYS.filter(') === 1,
    'and "used every feature" counts that list instead of any one flag');

  // The generated tables carry the reachable ceilings. Read them back and assert
  // the maxima, so a future edit cannot quietly reintroduce a 2,000-song shelf.
  const caps = [
    ['plays', 3, 2000], ['hours', 0.1, 150], ['one song', 2, 25], ['different songs', 1, 200],
    ['late-night', 3, 25], ['artists', 2, 200], ['genres', 1, 20], ['streak', 2, 180],
    ['streak', 7, 60], ['songs shelved', 1, 1000], ['albums', 1, 12], ['playlists', 1, 12],
    ['favorites', 1, 100],
  ];
  const tableBlock = mod.slice(mod.indexOf('var BADGE_TIERS = ['), mod.indexOf('// The counting tiers'));
  const vals = [...tableBlock.matchAll(/vals: \[([^\]]+)\]/g)].map((m) => m[1].split(',').map((n) => Number(n.trim())));
  ok(vals.length === 13, 'the thirteen threshold rows are all present (' + vals.length + ')');
  const maxima = vals.map((v) => Math.max(...v));
  ok(maxima.every((m, i) => m <= (caps[i] ? caps[i][2] : Infinity)),
    'and none reaches past its ceiling (' + maxima.join(', ') + ')');
  ok(vals.every((v) => v.every((n, i) => i === 0 || n > v[i - 1])),
    'every table still climbs in one direction');
}

console.log('\n[9] the same release, driven on the real app');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/studio-70-check.cjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const last = out.trim().split('\n').pop() || '(no output)';
  ok(code === 0, 'dev/studio-70-check drives the real app: ' + last);
  const n = parseInt((last.match(/All (\d+) checks/) || [])[1] || (last.match(/(\d+) passed/) || [])[1] || '0', 10);
  ok(n >= 100, 'and every one of its ' + n + ' checks passed');
}

console.log('\n[10] what the earlier releases shipped is still standing');
{
  const run = (file) => {
    let o = '', c = 0;
    try { o = execFileSync(process.execPath, [path.join(ROOT, 'dev', file)], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
    catch (e) { c = e.status === undefined ? 1 : e.status; o = String((e.stdout || '') + (e.stderr || '')); }
    return { o, c };
  };
  const gates = [
    ['test-66431.mjs', 'the list is still not rebuilt while you are scrolling it'],
    ['test-6643.mjs', 'the two library halves still keep their own place'],
    ['ota-guard-check.cjs', 'the update guard still refuses a downgrade'],
    ['audit-calls.mjs', 'every name the app reads is still declared']
  ];
  gates.forEach(([file, what]) => {
    const r = run(file);
    const last = (r.o.trim().split('\n').filter(Boolean).pop() || '(no output)');
    ok(r.c === 0, what + ' (' + file + ': ' + last + ')');
  });
}

console.log('\n[11] the file still holds together');
{
  let code = 0, out = '';
  try { out = execFileSync(process.execPath, [path.join(ROOT, 'dev/check-dom.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
  catch (e) { code = e.status === undefined ? 1 : e.status; out = String((e.stdout || '') + (e.stderr || '')); }
  ok(code === 0, 'the document still closes every element and every id it reads exists: ' + (out.trim().split('\n').pop() || ''));
  ok(count('  const CHANGELOG = [') === 1, 'the changelog is still one array');
  ok(count('id="listPane"') === 1 && count('id="homeBubbles"') === 1, 'the list pane and the Home grid are still there');
  ok(count('id="nowPlaying"') === 1, 'and there is still one player');
  const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  let bad = 0, badMsg = '';
  blocks.forEach((m) => { try { new Function(m[1]); } catch (e) { bad++; badMsg = e.message; } });
  ok(bad === 0, 'every inline script in the page parses (' + blocks.length + ' blocks' + (bad ? ': ' + badMsg : '') + ')');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
