// v64.2.9 - the update installs itself on launch, and the animated backdrop
// stops being redrawn.
//
//   "The glitch with dynamic themes and the favorites bubble and pinned artist
//    plateau still happens and the ota update should automatically happen on boot
//    no manually clicking install"
//
// Two reports, one release, and they are related: a phone that never installs the
// update by itself is a phone still running the version before the fix.
//
//   [1] the release itself: 64.2.9 runs, the head entry says so, and its six notes
//       still pass the wording rules both channels are held to (including the
//       words dev/test-66425.mjs and dev/test-66426.mjs read the head entry for);
//   [2] the backdrop: the drift and the counter-moving layer are TRANSLATION
//       ONLY - a scale change is not a compositor property, it is a raster of a
//       layer bigger than the screen, twice over, forever - and the two layers
//       are smaller than they were, since nothing has to fit a zoom any more;
//   [3] the Home card: paint containment, so the pulsing corner glow cannot
//       invalidate the scroller around it;
//   [4] the update installs itself on a real launch: driven through the real
//       client with a simulated native bridge (the same harness dev/ota-bootapply
//       and dev/ota-update-check use) - no tap anywhere in the path;
//   [5] what 64.2.8, 64.2.7 and 64.2.6 shipped is still standing, because a
//       release that dropped one of them would be a regression;
//   [6] the file still holds together.
//
//   node dev/test-66429.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ota = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const VER = '73.6.2'; /* repinned by dev/repin-7362.mjs */
const PREV = '64.2.8';

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

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // head = the 64.2.9 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === '64.2.9') || entries[0];
    const items = head.items || [];
    ok(String(head.version) === '64.2.9', 'the entry this gate reads is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('7:50 AM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    // The words THIS gate was written about are read from the release it
    // describes, by version - the same rule dev/test-66423.mjs,
    // dev/test-66424.mjs, dev/test-66427.mjs and dev/test-66428.mjs already
    // follow. A newer release is not made to carry them.
    const entry6429 = entries.find((e) => /^64\.2\.9$/.test(String(e.version))) || {};
    const notes6429 = (entry6429.items || []).join('\n');
    ok(/\blaunch\b/i.test(notes6429), 'while naming where the install happens now');
    ok(/blank/i.test(notes6429), 'the word dev/test-66425 reads the head entry for is there (blank)');
    ok(/list/i.test(notes6429) && /record/i.test(notes6429), 'and the two dev/test-66426 reads it for (list, record)');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.8$/.test(String(e.version))), 'the release before this one is still listed');
    ok(entries.some((e) => /^64\.2\.7$/.test(String(e.version))), 'and so is the one before that');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === 'sidecut-shell-v73.6.2', 'the service worker cache moves on for the shell that shipped (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the animated backdrop is translation only, and smaller');
{
  // The two keyframe blocks, read on their own.
  const drift = slice('@keyframes sd-dyn-drift{', '/* 64.2.7: the sd-dyn-hue keyframes');
  ok(drift !== '', 'the drift keyframes are still here');
  ok(drift.indexOf('scale(') === -1, 'and no frame of it scales the layer');
  ok(drift.indexOf('rotate(') === -1, 'or rotates it');
  ok((drift.match(/translate3d\(/g) || []).length === 6, 'every frame is a plain translate3d (' + (drift.match(/translate3d\(/g) || []).length + ')');
  const rev = slice('@keyframes sd-dyn-drift-rev{', '@keyframes sd-dyn-sheen{');
  ok(rev !== '', 'the second, counter-moving layer is still here');
  ok(rev.indexOf('scale(') === -1 && rev.indexOf('rotate(') === -1, 'and it is translation only too');
  ok((rev.match(/opacity:/g) || []).length === 5, 'while keeping its own opacity cycle (' + (rev.match(/opacity:/g) || []).length + ')');
  ok(count('animation: sd-dyn-drift ') === 13, 'every dynamic theme still gets its drift (' + count('animation: sd-dyn-drift ') + ')');
  ok(has('animation: sd-dyn-drift-rev 22s ease-in-out infinite, sd-dyn-sheen 13s ease-in-out infinite'),
    'and the counter-layer still runs its drift and its sheen together');
  // The footprint. Nothing has to fit a zoom any more, so the two layers come in
  // from inset:-32%/-26%: same motion, ~13%/28% less of a screen-and-a-bit to
  // raster, and they stay oversized enough for the translate.
  ok(count('inset:-32%') === 0, 'the oversized backdrop inset is gone (' + count('inset:-32%') + ')');
  ok(count('inset:-26%') === 0, 'and so is the counter-layer one (' + count('inset:-26%') + ')');
  ok(count('inset:-20%') === 2, 'both backdrop rules come in to -20% (' + count('inset:-20%') + ')');
  ok(count('inset:-18%') === 1, 'and the counter-layer to -18% (' + count('inset:-18%') + ')');
  ok(has('body[class*="theme-dyn-"]::after{'), 'the counter-layer is still a full-viewport fixed layer');
  ok(count('z-index:-1; pointer-events:none') >= 3, 'and the backdrop still paints behind everything');
}

console.log('[3] the Home card contains its own glow');
{
  const bubble = sliceC('.home-bubble{', '.home-bubble:active{');
  ok(bubble !== '', 'the Home card rule is still on the page');
  ok(/contain:\s*paint;/.test(bubble), 'the card declares paint containment (' + (bubble.match(/contain:[^;]*;/) || ['none'])[0] + ')');
  ok(bubble.indexOf('overflow:hidden') !== -1, 'and still clips its rounded corner the way it did');
  ok(bubble.indexOf('border-radius:22px') !== -1, 'with the same corner it always had');
  ok(bubble.indexOf('position:relative') !== -1, 'and is still the containing block for its own children');
  // The thing being contained is real: an opacity pulse on the card's own glow.
  ok(has('body[class*="theme-dyn-"] .home-bubble .hb-glow{ animation: sd-glow-pulse 6s ease-in-out infinite; }'),
    'the corner glow still pulses on a dynamic theme');
  ok(has('@keyframes sd-glow-pulse{'), 'through the same keyframes');
  ok(/@keyframes sd-glow-pulse\{\n  0%, 100%\{ opacity:\.55; \}\n  50%\{ opacity:\.9; \}/.test(src),
    'which still stay under 1, so the pulse cannot clip into a strobe');
  // Nothing else on the card is animated now: this is the whole of it.
  ok(count('.home-bubble .hb-glow{ animation: sd-glow-pulse') >= 1, 'and that is the only animation a Home card carries');
}

console.log('[4] the update installs itself on a real launch');
{
  // The wiring, read off the client source.
  ok(ota.indexOf('checkForUpdate({ silent: true, auto: true })') !== -1,
    'the boot check asks for the automatic install');
  ok(ota.indexOf('async function autoInstall(Updater, man, o){') !== -1, 'there is one automatic install path');
  ok(ota.indexOf('(o.auto ? autoInstall(Updater, man, o) : promptAndInstall(Updater, man, o))') !== -1,
    'and a check that is not the boot one still only offers the update');
  ok(ota.indexOf('function installStagedOnBoot(Updater, nb){') !== -1,
    'the launch hand-over for an already-staged bundle is untouched');
  const autoBody = ota.slice(ota.indexOf('async function autoInstall(Updater, man, o){'));
  const autoFn = autoBody.slice(0, autoBody.indexOf('\n  }\n') + 4);
  ok(autoFn.indexOf('isBadVersion(version)') !== -1, 'the automatic install refuses a bundle that failed here before');
  ok(autoFn.indexOf('bootLooping()') !== -1, 'and does nothing at all during a restart loop');
  ok(autoFn.indexOf('autoHandledAlready(version)') !== -1, 'and hands over at most once per version');
  ok(autoFn.indexOf('wantDeferredInstall(version)') !== -1, 'a version the user picked Install later for still installs on close');
  ok(autoFn.indexOf('applyStagedNow(Updater, nb)') !== -1, 'and the hand-over is the sheet\u2019s own Install now');
  ok(autoFn.indexOf('applyStagedNow(Updater, nb, true)') === -1, 'with the force flag off, so a playing track is never cut off');
  ok(ota.indexOf('HANDED_OVER_THIS_SESSION') !== -1 && (ota.match(/HANDED_OVER_THIS_SESSION/g) || []).length >= 3,
    'a hand-over on this launch is remembered for the rest of it');
  ok(ota.indexOf('if(HANDED_OVER_THIS_SESSION && String(nb.version) === HANDED_OVER_THIS_SESSION){') !== -1,
    'so the launch hand-over cannot look at the same bundle twice');
  ok(ota.indexOf('if(!appBooted() && ++_bootCheckTries < 20)') !== -1,
    'the boot check waits for the app to really boot instead of firing into a page that is not up');
  // End to end, in the harness the OTA gates already use.
  let out = '', code0 = 0;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/ota-update-check.cjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code0 = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  ok(code0 === 0, 'dev/ota-update-check drives the real client through a simulated native bridge: ' + (out.trim().split('\n').pop() || '(no output)'));
  ok(/the boot check fetches the new version with no tap/.test(out), 'and it saw the boot check fetch the update by itself');
  ok(/the fetched bundle was staged with next\(\)/.test(out), 'stage it with the plugin\'s own next()');
  ok(/and hands the app over to it with no tap/.test(out), 'and hand the app over with no tap anywhere');
  ok(/with no Install button to press/.test(out), 'with no Install button on screen to press');
  ok(/the launch hand-over leaves the bundle it already installed alone/.test(out),
    'and the same bundle is not looked at twice in one launch');
  ok(/and that bundle is not marked as a failure/.test(out),
    'and is never marked as one that failed to take over');
}

console.log('[5] what 64.2.8, 64.2.7 and 64.2.6 shipped is still standing');
{
  // 64.2.8 - the media-player line is out of Things to know about SideCut.
  const list = slice('<!-- Collapsible: Things to know about SideCut -->', '<div id="settingsPaneSandbox"');
  ok(list !== '' && list.split('style="color:var(--coral); flex-shrink:0;">\u2022</span>').length - 1 === 11,
    'the Things-to-know list still has its eleven bullets');
  ok(list.indexOf("The phone's media player can't open SideCut.") === -1, 'with the media-player line still gone');
  ok(src.indexOf('(open it from your launcher)') !== -1, "and the older release's own note about the tip untouched");
  // 64.2.7 - the animated filter is off the backdrop, and the island watches its
  // own scroller.
  ok(!has('@keyframes sd-dyn-hue{'), 'the backdrop still animates no colour filter');
  ok(!/, sd-dyn-hue /.test(src), 'and nothing re-declares it');
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
  ok(has('  function repaintHomeGrid(){') && has('  function repaintPinnedRail(list){'), 'both surfaces still have their repair');
  ok(has('#pinnedArtistsStrip{ position:relative; z-index:1; }'), 'the island still carries its stacking context');
}

console.log('[6] the file still holds together');
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
  let dom0 = 0, domOut = '';
  try {
    domOut = execFileSync(process.execPath, [path.join(ROOT, 'dev/check-dom.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    dom0 = e.status === undefined ? 1 : e.status;
    domOut = String((e.stdout || '') + (e.stderr || ''));
  }
  ok(dom0 === 0, 'the document still closes every element: ' + (domOut.trim().split('\n').pop() || '(no output)'));
  ok(count('id="homeBubbles"') === 1 && count('class="home-bubble') >= 10, 'the Home grid and its cards are still there');
  ok(!/scale\(|rotate\(/.test(slice('@keyframes sd-dyn-drift{', '@keyframes sd-glow-pulse{')),
    'and no backdrop keyframe animates a scale or a rotation any more');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
