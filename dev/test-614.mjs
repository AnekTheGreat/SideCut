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
  ok(count('SC_RELEASE_FETCH') === 7, 'the catalog reads share one release-fetch budget (' + count('SC_RELEASE_FETCH') + ')');
}

console.log('[6b2] MusicBrainz is asked both ways');
{
  const mb = sliceBetween('async function scFetchMbUpcoming(artist){', 'window.__scMbUpcoming = scFetchMbUpcoming;');
  ok(!!mb, 'the MusicBrainz pass is defined');
  // release-group misses announced drops that the concrete `release` endpoint
  // already has; asking only one is why the check kept finding nothing dated.
  ok(mb.includes("path: 'release-group'") && mb.includes("path: 'release'"), 'both the release-group and release endpoints are asked');
  ok(mb.includes("dateKey: 'first-release-date'") && mb.includes("dateKey: 'date'"), 'each endpoint reads its own date field');
  ok(mb.includes("range: 'firstreleasedate'") && mb.includes("range: 'date'"), 'and its own range field name');
  ok(mb.includes("ps.path + '/?query='"), 'the path builds both URLs');
  ok(mb.includes('if(seenMb[key]) return;'), 'one drop seen on both endpoints is merged, not listed twice');
  ok(mb.includes("String(rg.title).toLowerCase().replace(/\\s+/g, ' ').trim() + '|' + d"), 'merged on normalized title + day');
  ok(mb.includes("if(pt && pt !== 'Album' && pt !== 'Single' && pt !== 'EP') return;"), 'the type filter still applies where a type exists');
  ok(mb.includes('catch(_ePass){}'), 'one endpoint failing never aborts the pass');
  ok(mb.includes('return (rs && rs.ok) ? rs.json() : null;'), 'a non-200 endpoint is skipped, not thrown');
  ok(mb.includes('var _rp = await Promise.all(_reads);'), 'both endpoints are read at once (one budget, not two)');
  ok(mb.includes('SC_RELEASE_FETCH'), 'both reads share the release-fetch budget (no wedging the run)');
}

console.log('[6c] a timed lyric copy wins, and every script is paced');
{
  const inner = sliceBetween('async function scLookupLyricsInner(artistRaw, titleRaw, duration){', '// Every title-matching candidate');
  ok(inner.includes('var best = null, bestSynced = null;'), 'a timed copy is tracked separately from the plain fallback');
  ok(inner.includes('if(sc.isSynced && (!bestSynced || sc.score > bestSynced.score)) bestSynced = sc;'), 'the best timed copy is kept');
  ok(inner.includes('if(bestSynced) return bestSynced;'), 'a timed copy is returned ahead of a plain one');
  ok(inner.indexOf('if(bestSynced) return bestSynced;') < inner.indexOf('if(best) return best;'), 'plain text is the fallback, not the default');
  ok(!/Math\.min\(artistVars\.length, 3\) && !best &&/.test(inner), 'no pass stops early just because SOME copy matched');
  ok(count('!bestSynced && !scLyricsOutOfTime()') === 2, 'the /api/get and search passes look for a timed copy (' + count('!bestSynced && !scLyricsOutOfTime()') + ')');
  ok(inner.includes('if(bestSynced && bestSynced.score >= 5.5) break;'), 'a good timed match still ends the search');

  // The shipped splitter, run directly: a script with no spaces must not be one
  // giant token (that is what lit a whole line at once and then jumped).
  const extract = (name) => {
    const st = src.indexOf('function ' + name + '(');
    if (st < 0) return null;
    let d = 0;
    for (let i = src.indexOf('{', st); i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (!d) return src.slice(st, i + 1); }
    }
    return null;
  };
  const bodies = ['scPaceSegments', 'scEnsureWordSpans', 'scPaceWords'].map(extract);
  ok(bodies.every(Boolean), 'scPaceSegments / scEnsureWordSpans / scPaceWords extracted');
  const F = new Function('escapeHtml', bodies.join('\n') + '\nreturn { scPaceSegments, scEnsureWordSpans, scPaceWords };')((x) => String(x));
  const units = (t) => F.scPaceSegments(t).filter((x) => !/^\s+$/.test(x));
  ok(units('오빤 강남스타일').length === 4, 'a Korean line paces as 4 units, not 2 (' + units('오빤 강남스타일').length + ')');
  ok(units('君の名前を呼んでいる').length === 5, 'a Japanese line paces as 5 units, not 1 (' + units('君の名前を呼んでいる').length + ')');
  ok(units('我喜欢你 你知道吗').length === 4, 'a Chinese line paces as 4 units');
  ok(units('Desi Crew, Desi Crew').length === 4, 'Latin lines are unchanged (4 units)');

  // Pacing must actually advance through those units over time.
  const mk = (w) => { const c = new Set(); return { textContent: w, _c: c, classList: { toggle: (k, on) => { on ? c.add(k) : c.delete(k); }, has: (k) => c.has(k) } }; };
  const line = (text) => {
    const o = { dataset: {}, children: [], textContent: text, _words: null, querySelectorAll() { if (!this._words) this._words = units(text).map(mk); return this._words; } };
    o._words = o.querySelectorAll();
    return o;
  };
  const el = line('오빤 강남스타일');
  const seen = new Set();
  for (let t = 0; t <= 3; t += 0.25) { F.scPaceWords(el, 0, 3, t); el._words.forEach((w, i) => { if (w._c.has('current')) seen.add(i); }); }
  ok(seen.size >= 3, 'the Korean line advances through its units over time (' + seen.size + ' of ' + el._words.length + ')');

  // The pacing rate is the line's own, not one fixed constant — that constant
  // was ~3x a slow ballad's real delivery and lit a line long before it is sung.
  const paceFn = bodies[2];
  ok(!/totalWeight \/ 14/.test(paceFn), 'the pacing rate is no longer the fixed 14 chars/s');
  ok(/const rate = Math\.max\(6, Math\.min\(14, lineRate \* 1\.15\)\);/.test(paceFn), 'the rate follows the line, clamped to [6,14]');
  // A ballad line (measured: Kesariya 4.1 chars/s, Someone Like You 4.9) must
  // now pace across most of its window. The fixed 14 chars/s finished a line
  // like this in about half of it — the "words don't match on slower songs" bug.
  const toLastWord = (text, from, to) => {
    const e2 = line(text), n2 = e2._words.length;
    for (let t = from; t <= to + 0.05; t += 0.05) {
      F.scPaceWords(e2, from, to, t);
      if (e2._words[n2 - 1]._c.has('current')) return +(t - from).toFixed(2);
    }
    return Infinity;
  };
  const ballad = toLastWord('इश्क़ है पिया इश्क़ है', 0, 3);   // ~15 chars in a 3s window
  ok(ballad > 2.2, 'a ballad line now paces across most of its window (' + ballad + 's of 3s, was 1.5s)');
  // The old guarantee still holds: words are NEVER walked across a long
  // instrumental gap — a short line finishes early and holds its last word.
  const gapCase = toLastWord('आ आ', 0, 20);
  ok(gapCase < 6, 'a short line still finishes early instead of crawling over a 20s gap (' + gapCase + 's)');

  ok(count('text.split(/(\\s+)/)') === 0, 'no pacing path still splits on whitespace alone');
}

console.log('[6d] Cancel really dismisses the conversion bubble');
{
  const pill = sliceBetween('function scConvertPill(show){', 'function scConvertPillUpdate(');
  ok(/scConvertPillState = \{[^}]*cancelRequested: false/.test(src), 'the pill state carries a cancel flag');
  ok(pill.includes('scConvertPillState.cancelRequested = true;'), 'Cancel flips the flag');
  ok(pill.includes('scConvertPill(false);'), 'Cancel dismisses the pill itself, not only the run');
  const upd = sliceBetween('function scConvertPillUpdate(title, sub, pct){', 'function scConvertPillDone(');
  ok(upd.includes('if(scConvertPillState.cancelRequested) return;'), 'a late status line cannot bring a cancelled pill back');
  ok(count('scConvertPillResetCancel()') >= 4, 'every run start clears the flag (' + count('scConvertPillResetCancel()') + ')');
}

console.log('[6e] one audio revive at a time');
{
  ok(count('let scReviveLockUntil = 0;') === 1, 'the revive lock exists');
  ok(count('scReviveAllowed()') >= 3, 'the pause handler, heartbeat and return-to-app check all consult it (' + count('scReviveAllowed()') + ')');
  ok(count('scNoteRevive()') >= 3, 'each revive that starts claims it');
  const hb = sliceBetween('if(a.paused && !userPaused && !document.hidden', 'queueIndex >= 0');
  ok(hb.includes('scReviveAllowed()'), 'the heartbeat revive is gated');
}

console.log('[6f] the song fetch declares the client it asks as');
{
  ok(/async function scHttpJson\(url, bodyObj, ytClient\)\{/.test(src), 'the transport takes the client as an argument');
  ok(!/X-Youtube-Client-Name'\] = '1';/.test(src), 'the headers are no longer pinned to the web client');
  ok(src.includes("nativeHeaders['X-Youtube-Client-Name'] = String((_yc && _yc.name) || 1);"), 'the header follows the body, web as the default');
  ok(src.includes("var _yc = ytClient || null;"), 'and reads the client it was handed');
  const player = sliceBetween('async function scYtPlayer(', 'async function scFetchDecode(');
  ok(/num: 3[^}]*ANDROID/.test(player) || /ANDROID[^}]*num: 3/.test(player), 'the ANDROID client carries its own id');
  ok(player.includes('{ name: clients[c].num, version: clients[c].client.clientVersion, ua: clients[c].ua }'), 'each player call hands its client to the transport');
  ok(!/window\.__scYtReqClient/.test(src), 'nothing routes this through window (the transport stays testable)');
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
