// v61.7 — lyrics for a song that has only just come out.
//
// The report: a brand-new EP (Karan Aujla's AUJLA SZN 1, out that day) came back
// with no lyrics. Measured live: lrclib.net had no entry for any of its five
// tracks, so nothing could have been found — but the app also (a) turned a BUSY
// database (it answered 503 "ServerOverloaded" twice in a row) into "no lyrics
// found" after a single 1.3 s retry, and (b) never looked again at a song that
// came back empty. This audit pins both fixes, and RUNS the shipped code for the
// two that can be run: scLyricsJson is extracted from index.html and driven with
// a fake network, and scLyricsRecheckRun is extracted and driven with a fake
// lookup, a fake library and a fake store.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('could not extract ' + from + ' .. ' + to);
  return src.slice(a, b);
}
// Lift a whole function out of the shipped source by brace matching, so the test
// runs the code that ships rather than a copy of it.
function extractFn(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at === -1) throw new Error('no such function in index.html: ' + name);
  // Keep the `async ` prefix when there is one: the re-check pass is async, and a
  // body full of await inside a plain function is a syntax error, not a test.
  const start = (at >= 6 && src.slice(at - 6, at) === 'async ') ? at - 6 : at;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    const ch = src[k];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(start, k + 1); }
  }
  throw new Error('unterminated function: ' + name);
}
// A setTimeout that never waits: the shipped retry loop and the re-check pass are
// both paced with real timers, and a test has no business sitting through them.
const soon = (fn) => setTimeout(fn, 0);

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '63.0.1', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);
  const headText = entries[0].items.join(' ');
  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');
  ok(!/\bdownload|converter|convert\b/i.test(headText), 'notes carry no downloader term (shared channel)');
  // 61.8 heads the changelog now, so the wording this release introduced is
  // read from its own entry rather than from the head (the same repin 61.7
  // applied to 61.6).
  const rel617 = entries.find((e) => String(e.version) === '61.7');
  ok(!!rel617, 'the 61.7 entry is still in the changelog');
  const relText = (rel617 ? rel617.items : []).join(' ');
  ok(/brand-new release/.test(relText) && /re-checks/.test(relText), 'the 61.7 notes say a new release is looked up again');
  const rel616 = entries.find((e) => String(e.version) === '61.6');
  ok(!!rel616, 'the 61.6 entry is untouched below it');
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version);

console.log('[2] a busy lyrics database is retried, not reported as empty');
{
  const region = sliceBetween('var SC_LYRICS_RETRY_WAITS = [700, 1600, 3000];', 'function scLyricsRank(');
  ok(region.includes('st === 429 || st === 502 || st === 503'), 'the busy statuses are recognised');
  ok(region.includes('SC_LYRICS_RETRY_WAITS[tryIdx]'), 'and retried off the wait table');
  ok(region.includes('scLyricsOutOfTime()'), 'the retries stay inside the lookup deadline');
  ok(region.includes("scLyricsFailReason = 'busy'"), 'a busy answer is remembered as busy');
  ok(region.includes("'offline' : 'unreachable'"), 'a request that never answered is not called "nothing here"');
  ok(region.includes('if(scLyricsFailReason === \'busy\' || scLyricsFailReason === \'unreachable\') scLyricsFailReason = \'\';'),
    'a later real answer clears a stale busy note');

  // Run the shipped retry loop against a fake network.
  const fnSrc = extractFn('scLyricsJson');
  const build = (responses) => {
    let calls = 0;
    const factory = new Function('deps', [
      "var SC_LYRICS_RETRY_WAITS = [700, 1600, 3000];",
      "var scLyricsFailReason = '';",
      "var scFetchWithTimeout = deps.fetchWithTimeout;",
      "var scLyricsOutOfTime = function(){ return false; };",
      "var setTimeout = deps.setTimeout;",
      "var navigator = deps.navigator;",
      fnSrc,
      "return { json: scLyricsJson, reason: function(){ return scLyricsFailReason; }, calls: function(){ return deps.calls(); } };"
    ].join('\n'));
    return factory({
      setTimeout: soon,
      navigator: { onLine: true },
      calls: () => calls,
      fetchWithTimeout: () => {
        const r = responses[Math.min(calls, responses.length - 1)];
        calls++;
        return Promise.resolve(r === 'hang' ? { ok: false, status: 0, json: () => Promise.resolve(null) }
          : r === 'busy' ? { ok: false, status: 503, json: () => Promise.resolve(null) }
          : r === 'notfound' ? { ok: false, status: 404, json: () => Promise.resolve(null) }
          : { ok: true, status: 200, json: () => Promise.resolve(r) });
      }
    });
  };

  const flaky = build(['busy', 'busy', [{ id: 1, trackName: 'Ashke' }]]);
  const flakyOut = await flaky.json('https://lrclib.net/api/search?q=x');
  ok(Array.isArray(flakyOut) && flakyOut[0].id === 1, 'two 503s then a real answer ends in the real answer');
  ok(flaky.calls() === 3, 'it retried the busy answers (calls: ' + flaky.calls() + ')');
  ok(flaky.reason() === '', 'and the stale busy note is cleared by the answer');

  const alwaysBusy = build(['busy']);
  const busyOut = await alwaysBusy.json('https://lrclib.net/api/search?q=x');
  ok(busyOut && busyOut.__status === 503, 'a database that stays busy still reports the status');
  ok(alwaysBusy.calls() === 4, 'after the whole retry table (calls: ' + alwaysBusy.calls() + ')');
  ok(alwaysBusy.reason() === 'busy', 'and is remembered as busy, not as an empty result');

  const missing = build(['notfound']);
  await missing.json('https://lrclib.net/api/get?x=1');
  ok(missing.calls() === 1, 'a plain 404 (nothing filed under the song) is not retried');

  const offline = build(['hang']);
  const offOut = await offline.json('https://lrclib.net/api/search?q=x');
  ok(offOut && offOut.__status === 0, 'a request that never answered settles as status 0');
  ok(offline.reason() === 'unreachable', 'and is remembered as unreachable (navigator.onLine true)');
  ok(offline.calls() === 4, 'it is retried too (a dropped request is worth another try)');
}

console.log('[3] the empty state says which one happened');
{
  const say = extractFn('scLyricsSayNotFound');
  ok(say.includes('function scLyricsSayNotFound(artist, title, track){'), 'the sheet passes the track in');
  ok(say.includes("scLyricsFailReason === 'busy'"), 'busy reads as busy');
  ok(say.includes('The lyrics database was busy when SideCut asked'), 'and says so in words');
  ok(say.includes("scLyricsFailReason === 'offline' || scLyricsFailReason === 'unreachable'"), 'unreachable reads as unreachable');
  ok(say.includes('_addedDays >= 0 && _addedDays <= 14'), 'a song added in the last fortnight gets the release note');
  ok(say.includes('a brand-new release usually reaches the lyrics databases a day or two later'), 'and it says the databases trail a release');
  ok(say.includes('and SideCut keeps checking by itself'), 'and that the app keeps looking');
  ok(say.includes("' same-titled song'"), 'the skipped-stranger note is still there');
  ok(say.includes("why.textContent = _whyLines.join(' ')"), 'the notes are joined, not overwritten');
  ok((src.match(/scLyricsSayNotFound\(cleanArtist, cleanTitle, track\);/g) || []).length === 2, 'both sheet outcomes pass the track');
  ok(sliceBetween('async function scLookupLyrics(', 'async function scLookupLyricsInner(').includes("scLyricsFailReason = '';"),
    'each fresh lookup starts with a clean reason');
  ok(sliceBetween('async function scListLyricsCandidates(', 'window.__scLookupLyrics =').includes("scLyricsFailReason = '';"),
    'so does a manual search');
}

console.log('[4] a song that came back empty is looked up again later');
{
  const run = extractFn('scLyricsRecheckRun');
  ok(src.includes('var SC_LYRICS_RECHECK_MS = 6 * 60 * 60 * 1000;'), 'a song is re-asked at most every 6 h');
  ok(src.includes('var SC_LYRICS_RECHECK_MAX = 5;'), 'a pass asks about at most five songs');
  ok(run.includes('if(window.lyricsFetchState && window.lyricsFetchState.active) return 0;'), 'never while the manual batch is running');
  ok(run.includes("navigator.onLine === false"), 'never while offline');
  ok(run.includes('if(!t || t.lyrics) return false;'), 'a song that already has lyrics is not asked about');
  ok(run.includes("if(t.notes && String(t.notes).trim()) return false;"), 'nor one whose words were typed in by hand');
  ok(run.includes('t.lyricsCheckedAt = Date.now();') && run.includes('persistTrackMeta(t)'), 'a hit and a miss are both stamped and saved');
  ok(run.includes("toast('Lyrics found for '"), 'a hit tells the user');
  ok(run.includes('scLyricsRecheckRun') && src.includes('window.__scLyricsRecheckRun = scLyricsRecheckRun;'), 'the pass is reachable for the boot path');
  ok(src.includes("if(loaded) setTimeout(() => { try{ scLyricsRecheckRun(); }catch(e){ console.error('lyrics re-check failed', e); } }, 20000);"),
    'it runs on launch, well after the first paint');
  ok((src.match(/setTimeout\(\(\) => \{ try\{ scLyricsRecheckRun\(\); \}catch\(e\)\{\} \}, 45000\);/g) || []).length === 2,
    'and after an import, from both import paths');

  // Drive the shipped pass with a fake library, a fake lookup and a fake store.
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const mk = (o) => Object.assign({ id: o.name, name: '', artist: 'Karan Aujla', duration: 180, lyrics: null, lyricsCheckedAt: null, notes: '', dateAdded: now }, o);
  const tracks = [
    mk({ name: 'Ashke', dateAdded: now }),                             // the new EP: never checked, must be asked
    mk({ name: 'Rap Killa', dateAdded: now - 2 * HOUR }),              // also never checked
    mk({ name: 'Typed By Hand', notes: 'my own words' }),              // hand-typed lyrics -> untouched
    mk({ name: 'Has Lyrics', lyrics: 'already here' }),                // already saved -> untouched
    mk({ name: 'Checked An Hour Ago', lyricsCheckedAt: now - HOUR }),  // inside the 6 h window -> not yet
    mk({ name: 'Unknown Artist', artist: 'Unknown artist' }),          // nothing to match on
    mk({ name: 'Waiting Longest', lyricsCheckedAt: now - 30 * HOUR }),
    mk({ name: 'Waiting Longer', lyricsCheckedAt: now - 40 * HOUR }),
    mk({ name: 'Waiting Longestly', lyricsCheckedAt: now - 50 * HOUR })
  ];
  for (const t of tracks) t.id = t.name;
  const asked = [];
  const saved = [];
  const factory = new Function('deps', [
    'var SC_LYRICS_RECHECK_MS = deps.SC_LYRICS_RECHECK_MS;',
    'var SC_LYRICS_RECHECK_MAX = deps.SC_LYRICS_RECHECK_MAX;',
    'var scLyricsRecheckRunning = false;',
    'var allTracks = deps.allTracks;',
    'var navigator = deps.navigator;',
    'var document = deps.document;',
    'var window = deps.window;',
    'var scPrimaryArtist = function(a){ return String(a).split(/[,&]/)[0].trim(); };',
    'var applyWatermarkPatterns = function(t){ return t; };',
    'var scLookupLyrics = deps.scLookupLyrics;',
    'var persistTrackMeta = deps.persistTrackMeta;',
    'var toast = deps.toast;',
    'var refreshEnrichNotif = deps.refreshEnrichNotif;',
    'var setTimeout = deps.setTimeout;',
    run,
    'return { run: scLyricsRecheckRun };'
  ].join('\n'));
  const api = factory({
    SC_LYRICS_RECHECK_MS: 6 * HOUR,
    SC_LYRICS_RECHECK_MAX: 5,
    allTracks: tracks,
    navigator: { onLine: true },
    document: { visibilityState: 'visible' },
    window: {},
    setTimeout: soon,
    persistTrackMeta: (t) => { saved.push(t.name); return Promise.resolve(); },
    toast: (m) => { api.toasts.push(m); },
    refreshEnrichNotif: () => {},
    scLookupLyrics: (artist, title) => {
      asked.push(title);
      // The new EP is filed now; the long-waiting old ones still are not.
      return Promise.resolve(/Ashke|Rap Killa/.test(title) ? { lyrics: 'the words', isSynced: true } : null);
    }
  });
  api.toasts = [];
  const added = await api.run();
  ok(asked.length === 5, 'five songs asked about, not nine (' + asked.length + ')');
  ok(asked.slice(0, 2).join(',') === 'Ashke,Rap Killa', 'never-checked first: ' + asked.join(', '));
  ok(asked.indexOf('Typed By Hand') === -1, 'a hand-typed song is never asked about');
  ok(asked.indexOf('Has Lyrics') === -1, 'nor one that already has lyrics');
  ok(asked.indexOf('Checked An Hour Ago') === -1, 'nor one checked inside the 6 h window');
  ok(asked.indexOf('Unknown Artist') === -1, 'nor one with no artist to match on');
  ok(added === 2, 'the two hits are counted (' + added + ')');
  const ashke = tracks.find((t) => t.name === 'Ashke');
  ok(ashke.lyrics === 'the words' && ashke.lyricsSynced === true, 'the found lyrics land on the song');
  ok(ashke.lyricsCheckedAt >= now, 'and the check time is stamped');
  ok(saved.indexOf('Ashke') !== -1 && saved.indexOf('Waiting Longest') !== -1, 'hits and misses are both persisted');
  const missed = tracks.find((t) => t.name === 'Waiting Longest');
  ok(missed.lyrics === null && missed.lyricsCheckedAt >= now, 'a miss is stamped too, so it waits another 6 h');
  ok(api.toasts.length === 1 && /Lyrics found for 2 newer songs/.test(api.toasts[0]), 'the user is told: "' + api.toasts[0] + '"');

  // Asked again straight away, the pass must not re-ask what it just checked: the
  // stamps it wrote are what hold the whole library to one question per 6 h.
  asked.length = 0;
  const second = await api.run();
  ok(asked.indexOf('Ashke') === -1 && asked.indexOf('Waiting Longest') === -1,
    'a second pass does not re-ask the songs it just checked');
  ok(asked.length === 0 && second === 0, 'nothing is due yet, so nothing is asked and nothing is reported');

  // Six hours later they are due again — that is the whole point of the window.
  for (const t of tracks) if (t.lyricsCheckedAt) t.lyricsCheckedAt -= 7 * HOUR;
  asked.length = 0;
  const third = await api.run();
  ok(asked.length > 0, 'once the window has passed they are asked again (' + asked.length + ')');
}

console.log('[5] the check time survives a restart');
{
  ok(src.includes('lyricsCheckedAt: t.lyricsCheckedAt || null,'), 'it is written with the song record');
  ok(src.includes('lyricsCheckedAt: r.lyricsCheckedAt || null,'), 'and restored when the library loads');
}

console.log('[6] inline script syntax');
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
