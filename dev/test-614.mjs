// v61.4 — the Upcoming tab holds its place, looks dates up, and the lyrics
// stop guessing (and stop dying in the background).
//
// Four reported faults, all asserted against the shipped source:
//   [1] picking Upcoming snapped back to All on any rebuild (both render paths
//       ended with a hard-coded 'all')
//   [2] an empty Upcoming tab never went and looked
//   [3] lyrics could be someone else's song (lyrist + textyl accepted a reply
//       they never checked; a loose LRCLIB title rode in on a coincidental length)
//   [4] the highlight froze while the app was backgrounded and never came back,
//       and ran on regardless of pause
//
// Version note: the rollout line is 61.3.x. After 61.3.9 the next release is
// 61.4 — never a rolled-over x.y.10 (first rule in AGENTS.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;

function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('could not extract ' + from + ' .. ' + to);
  return src.slice(a, b);
}

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.4', 'APP_VERSION = ' + ver);
ok(!/^61\.3\.\d{2,}$/.test(ver), 'not a rolled-over patch number');
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
  ok(!/play build|play version|play install/i.test(entries[0].items.join('\n')), 'notes never name the play build');
  ok(!/\bdownloader|convert\b/i.test(entries[0].items.join('\n')), 'new notes carry no downloader term');
}
ok(sw.includes('sidecut-shell-v' + ver), 'service worker cache follows the version');

console.log('[2] the Upcoming tab keeps its place');
{
  const relTab = sliceBetween('window.__scDiscRelTab = function(mode, root){', 'function openDiscoverPopup');
  ok(relTab.includes('window.__scRelTabMode = mode'), 'the switcher remembers the chosen mode');
  const popup = sliceBetween('function openDiscoverPopup(title, bodyHTML, subtitle){', "// Search bar for Singles & Album History");
  ok(popup.includes("window.__scDiscRelTab(window.__scRelTabMode || 'all')"), 'popup rebuild restores the chosen tab, not a hard "all"');
  const hb = sliceBetween("else if(kind === 'newreleases'){", "else if(kind === 'nowplaying'){");
  ok(hb.includes("window.__scDiscRelTab(window.__scRelTabMode || 'all', body)"), 'Home panel rebuild restores the chosen tab');
  ok(!/window\.__scDiscRelTab\('all'\s*[,)]/.test(src), 'no hard-coded "all" rebuild is left anywhere');
}

console.log('[3] an empty Upcoming tab looks the dates up itself');
{
  const relTab = sliceBetween('window.__scDiscRelTab = function(mode, root){', 'function openDiscoverPopup');
  ok(relTab.includes("if(upcoming && !up.length)"), 'autofetch fires only on an empty Upcoming tab');
  ok(relTab.includes('window.__scUpcomingAutofetch()'), 'and calls the background lookup');
  const auto = sliceBetween('window.__scUpcomingAutofetch = async function(){', 'window.__scRebuildReleaseLists = async function');
  ok(auto.includes('window.__scUpAutoBusy'), 'one run at a time');
  ok(auto.includes('sidecut_upAutoAt'), 'throttled in storage');
  ok(auto.includes('60000'), 'never more than once a minute');
  ok(auto.includes('navigator.onLine === false'), 'skips while offline');
  ok(auto.includes('!pinnedArtists || !pinnedArtists.length'), 'does nothing with no pinned artists');
  ok(auto.includes("typeof navigator !== 'undefined'"), 'guards the navigator reference');
  ok(auto.includes('scRepaintOpenReleasePanel()'), 'repaints whichever release surface is open');
  ok(auto.includes('after > before'), 'only speaks up when genuinely new drops landed');
  ok(auto.includes('updateNotifBadge()'), 'lights the bell');
  ok(auto.includes('await window.__scRebuildReleaseLists(true)'), 'runs the same check the button runs');
}

console.log('[4] lyrics only accept the song that was asked for');
{
  const rank = sliceBetween('function scLyricsRank(', 'function scScoreLyricsResult(');
  ok(rank.includes('tScore === 2 && dScore >= 2'), 'a duration-only match now also needs an exact title');
  ok(!rank.includes('acceptable: !!(aHit || dScore >= 2)'), 'the old "length is enough" accept is gone');
  ok(rank.includes('aHit ||'), 'a confirmed artist still stands alone');
  // textyl carries no title/artist at all, so it cannot be verified.
  ok(!src.includes('api.textyl.co'), 'textyl is no longer an automatic source');
  ok(src.includes('4. (removed) textyl'), 'the removal is documented in place');
  // lyrist returns title+artist, so it must check them.
  const lyr = sliceBetween("var lyr = await scFetchWithTimeout('https://lyrist.vercel.app/api/'", "catch(_lyE)");
  ok(lyr.includes('_textOk(lyd.title, lyd.artist)'), 'lyrist validates the reply before accepting it');
  ok(count('function _textOk(') === 1, 'one validator definition');
}

console.log('[5] the lyric highlight survives a pause and a trip to the background');
{
  const poller = sliceBetween('lyricsScrollInterval = setInterval(() => {', '}, 50); // ~20 polls/s');
  ok(poller.includes('if (audio.paused) return;'), 'the poller holds while the song is paused');
  ok(poller.indexOf('if (audio.paused) return;') < poller.indexOf('const currentTime'), 'the pause guard sits before any time math');
  ok(poller.includes('if (!backdrop || backdrop.style.display !== \'flex\')'), 'only a closed sheet stops the poller');
  ok(poller.includes('if (document.hidden) return;'), 'hidden skips the work but keeps the interval');
  ok(!/display !== 'flex' \|\| document\.hidden/.test(poller), 'the old hide-kills-the-poller condition is gone');
  ok(poller.indexOf('if (document.hidden) return;') < poller.indexOf('const currentTime'), 'the hidden guard sits before any time math');
  // And it must be re-armed when the app comes back.
  ok(src.includes('startLyricsAutoScroll(true)'), 'returning to the app re-arms the poller in place');
  const vis = sliceBetween("document.addEventListener('visibilitychange', function(){", '// Sync nudge');
  ok(vis.includes('if(document.hidden) return;'), 'only the return-to-foreground path re-arms');
  ok(vis.includes("!lyricsScrollInterval"), 're-arms only when it is actually stopped');
  const startFn = sliceBetween('function startLyricsAutoScroll(keepPos, noReset) {', 'lyricsScrollInterval = setInterval');
  ok(startFn.includes('if(!keepPos){'), 'the position reset is skipped on a re-arm');
  ok(startFn.includes('container.scrollTop = 0;'), 'a fresh open still starts at the top');
}

console.log('[6] no account, nothing to verify in the release path');
{
  const check = sliceBetween('async function checkPinnedArtistReleases', '\n  }\n');
  ok(!/spotify/i.test(check), 'the drop check never mentions Spotify');
  ok(count('scSpotifyInteractiveToken()') <= 2, 'the interactive token has no new call sites');
  ok(!src.includes("textContent = 'Connect Spotify'"), 'no Connect Spotify button is built anywhere');
  ok(src.includes('no account, nothing to connect'), 'the hint still promises nothing to connect');
}

console.log('[6b] a second open dated-drop catalog (Wikidata)');
{
  const wd = sliceBetween('async function scFetchWdUpcoming(artist){', 'window.__scWdUpcoming = scFetchWdUpcoming;');
  ok(!!wd, 'the Wikidata pass is defined');
  ok(wd.includes("query.wikidata.org/sparql"), 'reads the open SPARQL endpoint');
  ok(wd.includes('SC_RELEASE_FETCH'), 'shares the release-fetch budget (no wedging the run)');
  ok(wd.includes('catch(_e){ return []; }'), 'a failure returns empty, never throws');
  ok(wd.includes("window.__scDay10(b.date.value)"), 'day-precision only');
  ok(wd.includes('window.__scUpcomingDay(d)'), 'future-only, and inside the 400-day horizon');
  ok(!/accounts\.spotify|api\.spotify/.test(wd), 'no Spotify anywhere in it');
  ok(wd.includes('primaryArtistName(artist)'), 'the pinned artist is the match key');
  ok(wd.includes('/^Q\\d+$/.test(title)'), 'an unlabeled stub item is refused, not listed by Q-id');

  const check = sliceBetween('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
  ok(check.includes('window.__scWdUpcoming(artist)'), 'the check runs the Wikidata pass');
  ok(check.includes("'wdt:' + nt + '|' + x.date"), 'its entries carry their own source key');
  ok(check.includes('window.__scMbUpcoming(artist)'), 'and the MusicBrainz pass still runs beside it');
  ok(count('SC_RELEASE_FETCH') === 7, 'six catalog reads share the release options (' + count('SC_RELEASE_FETCH') + ')');
}

console.log('[7] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
