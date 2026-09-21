// v60.0.6 audit — "go to Spotify" must open the Spotify APP, never the web player.
// (Shipped as 60.4.1 before everything after 60.0.1 was renumbered behind the
// second decimal; the version assertions below were renamed with it.)
//
// Why this needed a fix at all: open.spotify.com is in the app's allowNavigation
// list (the converter reads Spotify pages) and Capacitor's WebView does not
// support multiple windows, so window.open(url, '_blank') and <a target="_blank">
// both load an allow-listed host INSIDE the app — a logged-out Spotify web player
// on top of SideCut. Capacitor's Bridge.launchIntent() (node_modules/@capacitor/
// android .../Bridge.java) starts an ACTION_VIEW intent for anything whose host
// is not allow-listed, which is the only route to the real Spotify app:
//
//   if (!(appUri host+scheme equal) && !appAllowNavigationMask.matches(url.getHost())) {
//       getContext().startActivity(new Intent(Intent.ACTION_VIEW, url)); return true;
//   }
//   return false;   // load it in the WebView
//
// So every "go to Spotify" tap must go through one handoff that uses the
// spotify: scheme on Android, and no Spotify web URL may be opened from a tap.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const count = (hay, needle) => hay.split(needle).length - 1;
// Read versions through the app's own legacy map — 60.1–60.4.1 were renumbered
// behind the second decimal and 60.4.2 is the bridge release carrying this same
// code under an old-style number — so "this build or newer" survives the number
// moving for OTA delivery.
// The map as it stands: 60.1 is the current line and 60.2 – 60.4 are the numbers
// still to come, so none of them may be rewritten. Only the two labels a live
// install can still be sitting on are mapped.
const LEGACY = { '60.4.1': '60.0.6', '60.4.2': '60.0.8' };
function versionAtLeast(v, min) {
  const a = String(LEGACY[v] || v).split('.'), b = String(min).split('.');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = parseInt(a[i] || '0', 10), y = parseInt(b[i] || '0', 10);
    if (x !== y) return x > y;
  }
  return true;
}
const region = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to);
  return (a === -1 || b === -1 || b < a) ? '' : html.slice(a, b);
};
// Comments in this file talk about the web URL that was removed — only real code
// counts, so drop whole-line comments before asserting on any of it. (A blanket
// `//` strip would also cut "https://…" in half, which hides the very thing these
// checks are looking for.)
const code = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const handoff = code(region('function scIsAndroid(){', 'function triggerDiscoverDownload'));
const cardTap = code(region("card.addEventListener('click', () =>", 'card.appendChild(art)'));
// A fixed window from the tap handler itself. The `.new-release-row` selector
// matches the long-press loop first (hold a row to remove a release), so the
// row's click handler is anchored on its own first line instead.
const nrAt = html.indexOf('if(row._suppressClick)');
const newReleaseTap = code(nrAt === -1 ? '' : html.slice(nrAt, nrAt + 700));
const ahTracks = code(region('var finishTracks = function(tracks){', "if(src.kind === 'mb')"));

console.log('\n— the renumbering is read correctly, in both comparators —');
// Exercise the real functions out of both files: the page's (rollback picker,
// browser update check) and the OTA client's (native-updates.js), because the
// decision to install runs in whichever build the phone has.
function extract(src, from, to, ret) {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a === -1 || b === -1 || b < a) return null;
  try { return new Function(src.slice(a, b) + '\nreturn ' + ret + ';')(); } catch (e) { return null; }
}
const pageCmp = extract(html, 'const LEGACY_VERSIONS', '  // 58.9.6/58.9.7 snapshots', 'compareVersions');
const otaSrc = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const otaCmp = extract(otaSrc, 'var LEGACY_VERSIONS', '  function currentVersion(){', 'compareVersions');
ok('the page comparator runs', typeof pageCmp === 'function');
ok('the OTA client comparator runs', typeof otaCmp === 'function');
[['page', pageCmp], ['OTA client', otaCmp]].forEach(([who, cmp]) => {
  if (typeof cmp !== 'function') { fail++; console.log('  ✗ ' + who + ' comparator missing'); return; }
  ok(who + ': 60.0.6 is newer than 60.0.1', cmp('60.0.6', '60.0.1') > 0);
  ok(who + ': a genuinely older build is still older', cmp('60.0.6', '59.1') > 0 && cmp('60.0.6', '60.0.7') < 0);
  // 60.1 is a live version now, not the old label for 60.0.2. Rewriting it would
  // make the running build read its own version as 60.0.2 and re-offer every
  // published release for ever.
  ok(who + ': 60.1 is its own number, never 60.0.2',
    cmp('60.1', '60.1') === 0 && cmp('60.1', '60.0.2') > 0 && cmp('60.1', '60.0.9') > 0);
  // And the numbers still to come must not be rewritten either, or the second
  // number could never advance: a release published as 60.2 has to READ as 60.2.
  ok(who + ': 60.2 – 60.4 are releases again, not old labels',
    cmp('60.2', '60.0.3') !== 0 && cmp('60.3', '60.0.4') !== 0 && cmp('60.4', '60.0.5') !== 0 && cmp('60.2', '60.1') > 0);
  // The two labels a live install can still be sitting on.
  ok(who + ': 60.4.1 still reads as the release it became', cmp('60.4.1', '60.0.6') === 0);
  ok(who + ': and a device on that label takes the newest release', cmp('60.1.1', '60.4.1') > 0);
});

console.log('\n— the version this fix ships as —');
const otaMap = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
ok('the labels a live install can be on are read as the release they became',
  html.indexOf(`'60.4.1':'60.0.6'`) !== -1 && otaMap.indexOf(`'60.4.1':'60.0.6'`) !== -1 &&
  html.indexOf(`'60.4.2':'60.0.8'`) !== -1 && otaMap.indexOf(`'60.4.2':'60.0.8'`) !== -1);
ok('and the labels that are release numbers again are gone from both maps',
  !/'60\.2':'60\.0\.3'/.test(html) && !/'60\.2':'60\.0\.3'/.test(otaMap) &&
  !/'60\.3':'60\.0\.4'/.test(html) && !/'60\.4':'60\.0\.5'/.test(html) &&
  !/'60\.1':'60\.0\.2'/.test(html) && !/'60\.1':'60\.0\.2'/.test(otaMap));
// This build shipped as 60.0.6; later releases only move the number.
ok('index.html is v60.0.6 or newer', versionAtLeast(version, '60.0.6'), version);
ok('sw.js cache matches the version', sw.indexOf(`sidecut-shell-v${version}`) !== -1);

console.log('\n— one handoff, and it goes to the app —');
ok('the handoff uses the spotify: scheme', handoff.indexOf("'spotify:search:'") !== -1);
ok('it decides Android-ness (native platform or Android UA)', handoff.indexOf('scIsAndroid') !== -1 && handoff.indexOf('/Android/i') !== -1);
ok('the search web URL is built in exactly one place', count(code(html), "'https://open.spotify.com/search/'") === 1,
  String(count(code(html), "'https://open.spotify.com/search/'")));
ok('non-Android gets a new tab', /if\(!scIsAndroid\(\)\)\{[\s\S]{0,120}window\.open\(web, '_blank'/.test(handoff));
ok('the Android path only ever sets the spotify: scheme location',
  count(handoff, 'window.location.href') === 1 && count(handoff, 'window.open') === 1);
ok('the fallback copies the link instead of opening it',
  handoff.indexOf('navigator.clipboard.writeText(web)') !== -1 && count(handoff, 'window.open') === 1);
ok('the handoff is exposed for any other caller', html.indexOf('window.__scOpenSpotifySearch = scOpenSpotifySearch;') !== -1);

console.log('\n— every "go to Spotify" tap uses it —');
ok('the Discover card tap hands off', cardTap.indexOf('scOpenSpotifySearch(q)') !== -1);
ok('the Discover card tap has no window.open left', cardTap.indexOf('window.open') === -1);
ok('the New releases row hands off', newReleaseTap.indexOf('scOpenSpotifySearch(q)') !== -1);
ok('the New releases row has no window.open left', newReleaseTap.indexOf('window.open') === -1);
ok('Get song still hands off', code(region('function triggerDiscoverDownload', 'window.playDiscoverTrack')).indexOf('scOpenSpotifySearch(q)') !== -1);

console.log('\n— Album History "Find on Spotify" —');
ok('it is a button, not an <a target="_blank">', count(ahTracks, 'ah-find-spotify-btn') >= 1 && ahTracks.indexOf('Find on Spotify</a>') === -1);
ok('both render paths use it', count(code(html), 'class="ah-find-spotify-btn"') === 2,
  String(count(code(html), 'class="ah-find-spotify-btn"')));
ok('a delegated listener covers it', html.indexOf("closest('.ah-find-spotify-btn')") !== -1);
ok('the anchor that loaded the web player is gone', html.indexOf('✨ Find on Spotify</a>') === -1);
ok('the old dlLink web URL is gone', count(code(html), 'dlLink') === 0);
ok('the delegated listener stops the row tap behind the button',
  /closest\('\.ah-find-spotify-btn'\)[\s\S]{0,200}stopPropagation\(\)/.test(code(html)));

console.log('\n— the published bundle carries it —');
let man = null;
try { man = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8')); } catch (e) {}
ok('ota/updates.json parses', !!man);
ok('it names this version', man && String(man.version) === version, man && man.version);
ok('it carries patch notes', man && Array.isArray(man.notes) && man.notes.length > 0);
// The live manifest only carries the NEWEST entry's notes, so the handoff's own
// notes are read from this build's changelog entry instead.
const ownEntry = (html.match(/\{ version: '60\.0\.6'[\s\S]*?\n  \]\}/) || [''])[0];
ok('the notes explain the app handoff', ownEntry.indexOf('allow-listed') !== -1);
// The OTA can only fix something that is a typo if the real code is inside the zip.
let zipHtml = '';
try {
  zipHtml = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (e) { zipHtml = ''; }
ok('the zip index.html has the handoff', zipHtml.indexOf('function scIsAndroid(){') !== -1);
ok('the zip has no Spotify web open left', count(code(zipHtml), 'window.open(spotifyUrl') === 0);
ok('the zip version matches', (zipHtml.match(/const APP_VERSION = '([^']+)'/) || [])[1] === version);
let zipSize = 0;
try { zipSize = Number(execFileSync('stat', ['-c%s', path.join(ROOT, 'ota/update.zip')], { encoding: 'utf8' }).trim()); } catch (e) {}
ok('the manifest size matches the bundle', man && Number(man.size) === zipSize, `${man && man.size} vs ${zipSize}`);
const rootMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'updates.json'), 'utf8'));
ok('the root manifest is in step', String(rootMan.version) === version);

console.log('\n— it still parses —');
const blocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let bad = null;
blocks.forEach((b, i) => {
  try { new Function(b.replace(/<\/?script[^>]*>/gi, '')); }
  catch (e) { if (!(i === 3 && String(e.message).includes('await'))) bad = `block ${i + 1}: ${e.message}`; }
});
ok('every inline script block parses', !bad, bad);
ok('there are still 5 blocks', blocks.length === 5, String(blocks.length));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
