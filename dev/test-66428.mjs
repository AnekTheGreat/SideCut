// v64.2.8 - the media player line comes out of Things to know about SideCut.
//
//   "Remove this part from things to know about SideCut"
//
// with a screenshot of the bullet that read "The phone's media player can't open
// SideCut. The notification-shade / lock-screen player can play, pause, and skip
// - but tapping it won't open the app. To get back to the song list, open SideCut
// from your launcher."
//
//   [1] the release itself: 64.2.8 runs, the head entry says so, and its six
//       notes still pass the wording rules both channels are held to;
//   [2] the list: the line and its paragraph are gone, the eleven that stay are
//       untouched and still close up the way they did, and the earlier release's
//       own note about the tip is left alone, because a changelog entry is a
//       record of what that release did;
//   [3] the two gates that pinned this shape moved with it, without losing a
//       check - dev/test-66425.mjs points the other way, and dev/test-66427.mjs
//       reads the words it was written about from its own release;
//   [4] what 64.2.7, 64.2.6, 64.2.5 and 64.2.4 shipped is still standing,
//       because a release that dropped one of them would be a regression;
//   [5] the file still holds together.
//
//   node dev/test-66428.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '71.3'; /* repinned by dev/repin-713.mjs */ /* repinned by dev/repin-712.mjs */ /* repinned by dev/repin-7021.mjs */ /* repinned by dev/repin-7020.mjs */ /* repinned by dev/repin-7019.mjs */ /* repinned by dev/repin-7018.mjs */ /* repinned by dev/repin-7017.mjs */ /* repinned by dev/repin-7016.mjs */ /* repinned by dev/repin-7015.mjs */ /* repinned by dev/repin-7014.mjs */ /* repinned by dev/repin-7013.mjs */ /* repinned by dev/repin-7012.mjs */ /* repinned by dev/repin-7011.mjs */ /* repinned by dev/repin-701.mjs */ /* repinned by dev/repin-709.mjs */ /* repinned by dev/repin-708.mjs */ /* repinned by dev/repin-707.mjs */ /* repinned by dev/repin-706.mjs */ /* repinned by dev/repin-705.mjs */ /* repinned by dev/repin-70.mjs */
const PREV = '64.2.7';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
const slice = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return src.slice(a, b);
};
// Comments describe the code the "is it gone" checks look for, so those run over
// the code only - the same strip dev/test-6058.mjs uses.
const code = src.replace(/^\s*\/\/.*$/gm, '');
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};
// The bullet marker every Things-to-know line starts with, and the list itself.
const MARK = 'style="color:var(--coral); flex-shrink:0;">\u2022</span>';
const LIST = () => slice('<!-- Collapsible: Things to know about SideCut -->', '<div id="settingsPaneSandbox"');

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // head = the 64.2.8 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === '64.2.8') || entries[0];
    const items = head.items || [];
    ok(String(head.version) === '64.2.8', 'the entry this gate reads is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('7:25 AM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    // The list this entry names is 64.2.8's, and the head entry belongs to
    // whatever shipped last: the words THIS gate was written about are read from
    // the release it describes, by version - the same rule dev/test-66423.mjs,
    // dev/test-66424.mjs and dev/test-66427.mjs already follow.
    const entry6428 = entries.find((e) => /^64\.2\.8$/.test(String(e.version))) || {};
    const notes6428 = (entry6428.items || []).join('\n');
    ok(/\bthings to know\b/i.test(notes6428), 'while naming the list it changed');
    // The two gates that read the HEAD entry are repinned to this version, so
    // what they read it for has to survive here.
    ok(/blank/i.test(notes), 'the word dev/test-66425 reads the head entry for is there (blank)');
    ok(/list/i.test(notes) && /record/i.test(notes), 'and the two dev/test-66426 reads it for (list, record)');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.7$/.test(String(e.version))), 'the release before this one is still listed');
    ok(entries.some((e) => /^64\.2\.6$/.test(String(e.version))), 'and so is the one before that');
    // The note itself carries an apostrophe, which is the one thing a
    // single-quoted CHANGELOG string has to escape. Nothing before this release
    // needed it, so it is pinned: the array above only parses because it is there.
    ok((entry6428.items || [])[0].indexOf("phone's media player") !== -1, 'the first note names the line that went');
    const raw = block[1];
    ok(raw.indexOf("phone\\'s media player") !== -1, "and its apostrophe is escaped in the source, so the array parses");
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the line is out of the list, and nothing around it went with it');
{
  const list = LIST();
  ok(list !== '', 'the list is still on the page');
  ok(list.indexOf('A few built-in behaviors worth knowing:') !== -1, 'its intro line is untouched');
  // The bullet and its paragraph, by the two things that only it said.
  ok(list.indexOf("The phone's media player can't open SideCut.") === -1, 'the bullet is gone');
  ok(list.indexOf('notification-shade / lock-screen player can play') === -1, 'and so is its paragraph');
  ok(list.indexOf('open SideCut from your launcher.') === -1, 'and the tip at the end of it');
  // The neighbours that now sit against each other.
  ok(list.indexOf('Jump to the playing song from anywhere.') !== -1, 'the bullet it sat under is untouched');
  ok(list.indexOf("Lyrics auto-scroll isn't perfect.") !== -1, 'and the one it sat above is untouched');
  const between = slice('Jump to the playing song from anywhere.', "Lyrics auto-scroll isn't perfect.");
  ok(between !== '' && between.indexOf('media player') === -1, 'with nothing of it left between them');
  ok(list.split(MARK).length - 1 === 11, 'eleven bullets are left, not twelve with a hole in them (' + (list.split(MARK).length - 1) + ')');
  // A row emptied instead of removed is the shape this is checking against: an
  // empty bullet div, or a gap where the line was.
  ok(!/<span style="color:var\(--coral\); flex-shrink:0;">\u2022<\/span><span>\s*<\/span>/.test(list),
    'no bullet was left standing empty');
  // The rows must still be one per line and against each other: a line emptied
  // instead of removed would leave a gap here even though the count looks right.
  const bulletRows = list.split('\n').map((l, i) => [l, i]).filter(([l]) => l.indexOf(MARK) !== -1).map(([, i]) => i);
  ok(bulletRows.length === 11, 'the eleven bullets are still eleven rows (' + bulletRows.length + ')');
  ok(bulletRows.every((n, k) => k === 0 || n === bulletRows[k - 1] + 1),
    'one per line and hard against each other, with no blank row opened where it stood');
  ok(list.indexOf('Back up before rolling back.') !== -1, 'the last bullet is still the last one');
  ok(list.indexOf('Back up before rolling back.') > list.indexOf("Lyrics auto-scroll isn't perfect."),
    'and is still below the one it followed');
  // One of the 47 bullets on the page went, and only one.
  ok(count(MARK) === 46, 'one of the 47 bullets on the page is gone (' + count(MARK) + ')');
  // A changelog entry is a record of what that release did, so the older release
  // that announced this tip keeps its own note.
  ok(src.indexOf('(open it from your launcher)') !== -1, "the earlier release's note about the tip is left alone");
  ok(/New "Things to know" notes: tapping the record jumps to the playing song/.test(src),
    'and the entry it lives in is otherwise untouched');
}

console.log('[3] the two gates that pinned this shape moved with it');
{
  const t25 = fs.readFileSync(path.join(ROOT, 'dev/test-66425.mjs'), 'utf8');
  ok(t25.indexOf("=== -1, 'and the media-player line has been taken out of the list');") !== -1,
    'dev/test-66425 asserts the line is gone now');
  ok(t25.indexOf("'and the media-player limitation is still stated'") === -1,
    'and no longer asserts the opposite of the request');
  ok(t25.indexOf("count('style=\"color:var(--coral); flex-shrink:0;\">\\u2022</span>') >= 13") !== -1,
    'its bullet counter is untouched, because one of 47 cannot change what it means');
  const t27 = fs.readFileSync(path.join(ROOT, 'dev/test-66427.mjs'), 'utf8');
  ok(t27.indexOf('/^64\\.2\\.7$/.test(String(e.version))') !== -1,
    'dev/test-66427 reads the release it describes by version');
  ok(t27.indexOf('/flicker/i.test(notes6427)') !== -1, 'for the words it was written about');
  ok(t27.indexOf('/flicker/i.test(notes)') === -1, 'rather than demanding them of the head entry');
  const checksIn = (p) => (fs.readFileSync(path.join(ROOT, p), 'utf8').match(/(^|\n)\s+ok\(/g) || []).length;
  ok(checksIn('dev/test-66425.mjs') === 101, 'dev/test-66425 still declares its 101 checks (' + checksIn('dev/test-66425.mjs') + ')');
  ok(checksIn('dev/test-66427.mjs') === 82, 'and dev/test-66427 its 82 (' + checksIn('dev/test-66427.mjs') + ')');
  // The one probe that reads the newest note out of the SOURCE rather than
  // evaluating the changelog block. This release's first note is the first note
  // in the app's history to carry an apostrophe, so the raw `phone\'s` stopped
  // matching the drawn `phone's` and the probe went red over an escape rather
  // than over the app. It evaluates what it extracted now.
  const tNg = fs.readFileSync(path.join(ROOT, 'dev/notifgroup-6424-check.cjs'), 'utf8');
  ok(tNg.indexOf('try { headFirstNote = eval(') !== -1, 'dev/notifgroup-6424 decodes the note it pulls out of the source');
  ok(tNg.indexOf('const headFirstNote = (html.match(') === -1, 'rather than comparing the raw, escaped form of it');
  ok(checksIn('dev/notifgroup-6424-check.cjs') === 27, 'and still declares its 27 checks (' + checksIn('dev/notifgroup-6424-check.cjs') + ')');
}

console.log('[4] what 64.2.7, 64.2.6, 64.2.5 and 64.2.4 shipped is still standing');
{
  // 64.2.7 - the animated filter is off the dynamic-theme backdrop.
  ok(!has('@keyframes sd-dyn-hue{'), 'the backdrop still animates no colour filter');
  ok(!/, sd-dyn-hue /.test(src), 'and nothing re-declares it');
  ok(count('animation: sd-dyn-drift ') === 13, 'every dynamic theme still gets its drift (' + count('animation: sd-dyn-drift ') + ')');
  ok(has('    var onRailScroll = function(){'), 'the rail settle is still named once');
  ok(has("    if(rl) rl.addEventListener('scroll', onRailScroll, { passive: true });"),
    'and the island still asks for a repair on its own scroller');
  // 64.2.6 - the repair that outlives its frame, and the two library halves.
  ok(has('  function scRepaint(el){'), 'the paint request is still one helper');
  ok(has(`      requestAnimationFrame(function(){\n        requestAnimationFrame(function(){`),
    'still taken back a frame later, not inside the same one');
  const scBody = sliceC('  function scRepaint(el){', '  function scRepaintSurface(root, sel){');
  ok(scBody !== '' && !/visibility|translateZ|offsetHeight|getBoundingClientRect/.test(scBody),
    'and still hiding nothing, promoting nothing and measuring nothing');
  ok(has('if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){'), 'an unchanged Home grid is still left alone');
  // 64.3 gave each half its own restore: Playlists skips it only when it really
  // landed on the song, and Albums always puts its own offset back.
  ok(count('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1 &&
    count('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,
    'each half restores its own position');
  // 64.2.5 - the dismissable finished card.
  ok(count('data-dismiss=') === 3 && count('title="Tap to dismiss"') === 3,
    'a finished card on Home can still be tapped away (' + count('data-dismiss=') + ')');
  // 64.2.4 - the launch, the playing row, the short title key.
  ok(has('  function scPrepaintTheme(){') || has('(function scPrepaintTheme(){'), 'the launch still opens in the saved theme');
  ok(has('  .track.playing::after{'), 'the playing row still glows on a layer of its own');
  ok(has('  function scTitleKeyIsStrong(k){'), 'a short title key is still too weak to reject on');
  ok(has('  function repaintHomeGrid(){') && has('  function repaintPinnedRail(list){'), 'both surfaces still have their repair');
  ok(has('#pinnedArtistsStrip{ position:relative; z-index:1; }'), 'the island still carries its stacking context');
  ok(has('  function scApplyChangelogGroup(v, open){'), 'the bell\\u2019s notes are still a header per release');
  ok(has('  function scNow(){'), 'and the whole-file shape is unchanged');
}

console.log('[5] the file still holds together');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'every inline script block parses (' + bad + ' bad)');
  let code0 = 0, out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code0 = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code0 === 0, 'every name the app reads is declared: ' + first.trim());
  ok(count('<span>Things to know about SideCut</span>') === 1, 'the list has one heading');
  ok(count('id="collapsibleThingsToKnow"') === 1, 'and one opener wired to it');
  ok(!/media-player|mediaPlayer/.test(code), 'and no code was left reading the line that went');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
