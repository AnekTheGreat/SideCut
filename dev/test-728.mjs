#!/usr/bin/env node
/**
 * 72.8 - Last.fm scrobbling, and the two lyrics highlight chips.
 *
 * Two things ride in this release, so this gate pins both:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the letter wave is visible: the word drops to the trough in letter mode,
 *       and the word/letter chips carry the !important coral state that an inline
 *       style cannot outrank;
 *   [3] the scrobbler exists and is wired: settings card, connect/disconnect,
 *       now-playing on a track change, scrobble once a song has been heard;
 *   [4] THE MATH IS REAL: the MD5 is checked against vectors and against
 *       node:crypto, and a scrobble is captured and its api_sig compared with a
 *       signature this test builds independently;
 *   [5] the repin moved every gate (no stale pin);
 *   [6] inline script syntax, and the OTA tail.
 *
 *   node dev/test-728.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '72.8';
const PREV = '72.7.1';
const SHELL_CACHE = 'sidecut-shell-v72.8';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

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
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next (' + ((entries[1] || {}).version) + ')');
    ok(items.length >= 7, 'with at least seven notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    const notes = items.join('\n');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(!/play build|play version|play install/i.test(notes), 'nor reads as a store-channel note');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(items.every((it) => it.length <= 260), 'every note is one short sentence or two (longest ' + Math.max(...items.map((i) => i.length)) + ')');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.7.1 entry is still behind it');
    // The words the release before this one pinned on the HEAD have to be here:
    // test-7251 and test-7252 read the head for /widget/ and /player/.
    ok(/widget/i.test(notes), 'the head notes still name the widget the earlier gates look for');
    ok(/player/i.test(notes), 'and the player');
    ok(/last\.fm/i.test(notes), 'and this release says what it is about');
    ok(/lyrics/i.test(notes), 'including the lyrics half of it');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-728.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.8';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] the letter wave is visible and the chips look on');
{
  ok(count(src, '#lyricsText.ll-on .lyric-word.current .lyric-letter.lit{') === 1,
    'the lit-letter rule is still there exactly once (test-714 pins it)');
  ok(count(src, '#lyricsText .lyric-word .lyric-letter{') === 1,
    'and the letter transition is untouched (test-714 pins it)');
  ok(count(src, '#lyricsText.ll-on .lyric-word.current{') === 1,
    'letter mode puts the current word in the trough');
  ok(/#lyricsText\.ll-on \.lyric-word\.current\{\s*\n\s*color: var\(--ink-dim\);/.test(src),
    'which is the plain lyric tint, not the gold');
  const trough = src.slice(src.indexOf('#lyricsText.ll-on .lyric-word.current{'));
  const troughBlock = trough.slice(0, trough.indexOf('}'));
  ok(/background: none;/.test(troughBlock), 'with the word-by-word gradient taken off');
  ok(/text-shadow: none;/.test(troughBlock), 'its glow taken off');
  ok(/animation: none;/.test(troughBlock), 'and its pulse stopped, so the sweep is the only light');
  ok(count(src, '#lyricsWordBtn.active, #lyricsLetterBtn.active {') === 1,
    'both chips share one active rule');
  const activeBlock = src.slice(src.indexOf('#lyricsWordBtn.active, #lyricsLetterBtn.active {'));
  const activeRules = activeBlock.slice(0, activeBlock.indexOf('}'));
  ok(count(activeRules, '!important') === 3,
    'and every declaration beats the inline base style (!important x3)');
  ok(count(src, '#lyricsWordBtn.active {') === 0, 'the old powerless rule is gone');
  ok(/classList\.toggle\('active', !!lyricsWordByWord && !lyricsLetterByLetter\);/.test(src),
    'the word chip still lights only when it is the active mode');
  ok(/classList\.toggle\('active', !!lyricsLetterByLetter\);/.test(src),
    'and the letter chip lights whenever letter mode is on');
}

console.log('[3] the scrobbler is present and wired');
{
  ok(src.indexOf("var LF_API = 'https://ws.audioscrobbler.com/2.0/';") !== -1, 'the Last.fm endpoint is named');
  for (const id of ['lastfmCard', 'lastfmStatus', 'lastfmToggle', 'lastfmKeyInput', 'lastfmSecretInput', 'lastfmConnectBtn', 'lastfmDisconnectBtn', 'lastfmQueueHint']) {
    ok(src.indexOf('id="' + id + '"') !== -1, 'the settings card has ' + id);
  }
  ok(count(src, "var LF_K_KEY = 'sidecut_lastfm_key';") === 1, 'the key has its own storage slot');
  ok(count(src, "var LF_K_SECRET = 'sidecut_lastfm_secret';") === 1, 'so does the secret');
  ok(count(src, "var LF_K_SESSION = 'sidecut_lastfm_session';") === 1, 'and the authorized session');
  ok(src.indexOf("var LF_MIN_SECONDS = 30;") !== -1, 'a thirty-second floor is declared');
  ok(src.indexOf('if(duration > 0 && duration < LF_MIN_SECONDS) return;') !== -1,
    'and a song under it is never sent');
  ok(src.indexOf("method: 'auth.getToken'") !== -1 && src.indexOf("method: 'auth.getSession'") !== -1,
    'the connect flow asks for a token then a session');
  ok(src.indexOf("LF_AUTH + '?api_key=' + encodeURIComponent(key)") !== -1, 'and opens the Last.fm authorize page');
  ok(src.indexOf("method: 'track.updateNowPlaying'") !== -1, 'now playing is sent');
  ok(src.indexOf("method: 'track.scrobble'") !== -1, 'and the scrobble itself');
  ok(src.indexOf("'artist[0]': item.artist") !== -1 && src.indexOf("'timestamp[0]': item.timestamp") !== -1,
    'with the indexed parameters Last.fm expects');
  ok(src.indexOf('function lfSig(params, secret){') !== -1, 'the signature is computed in one place');
  ok(/keys\.sort\(\);/.test(src), 'over the sorted parameter names');
  ok(src.indexOf("return lfMd5(s + secret);") !== -1, 'followed by the shared secret');
  ok(/k !== 'format' && k !== 'callback'/.test(src), 'and neither format nor callback is signed');
  ok(src.indexOf('function lfFlushQueue(){') !== -1, 'a queue flushes what could not be sent');
  ok(src.indexOf('q.push(item); lfQueueSave(q);') !== -1, 'an offline scrobble is parked rather than lost');
  ok(src.indexOf("window.addEventListener('online', function(){ lfFlushQueue(); });") !== -1,
    'and coming back online spends it');
  ok(count(src, 'window.scLastfm.nowPlaying(t)') === 1, 'a track change tells Last.fm, from exactly one place');
  ok(count(src, 'window.scLastfm.scrobble(t)') === 1, 'and a heard song is scrobbled, from exactly one place');
  ok(/recordListeningDay\(\);\s*\n\s*try\{ if\(window\.scLastfm\) window\.scLastfm\.nowPlaying\(t\); \}/.test(src),
    'the now-playing hook rides the existing play recorder');
  ok(/scSidecarSet\(t\.id, \{ playCount: t\.playCount \}\);\s*\n\s*try\{ if\(window\.scLastfm\) window\.scLastfm\.scrobble\(t\); \}/.test(src),
    'and the scrobble hook rides the existing play counter, so the app half is where it always was');
}

console.log('[4] the signature is real (checked against node:crypto)');
{
  const start = src.indexOf('  // ---- Last.fm scrobbling (72.8)');
  const end = src.indexOf('  const PLAY_COUNTS_AFTER = 0.5;', start);
  ok(start !== -1 && end !== -1, 'the module can be isolated');
  const moduleSrc = src.slice(start, end);
  const store = new Map();
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  let captured = null;
  const fetchStub = (url, opts) => { captured = { url, opts }; return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{"ok":1}') }); };
  const win = { toast: () => {}, addEventListener: () => {}, open: () => {} };
  const factory = (fetchImpl) => new Function('window', 'document', 'localStorage', 'fetch', 'URLSearchParams', '$', 'setInterval', 'clearInterval', 'setTimeout',
    moduleSrc + '\n; return window.scLastfm;')(win, { activeElement: null }, localStorage, fetchImpl, URLSearchParams, () => null, () => 0, () => {}, () => {});
  const lf = factory(fetchStub);

  ok(lf.md5('') === 'd41d8cd98f00b204e9800998ecf8427e', 'md5("") matches the known digest');
  ok(lf.md5('abc') === '900150983cd24fb0d6963f7d28e17f72', 'md5("abc") matches');
  ok(lf.md5('The quick brown fox jumps over the lazy dog') === '9e107d9d372bb6826bd81d3542a419d6', 'and the pangram');
  ok(lf.md5('é') === crypto.createHash('md5').update('é', 'utf8').digest('hex'), 'a UTF-8 digest matches node:crypto');
  ok(lf.md5('日本語') === crypto.createHash('md5').update('日本語', 'utf8').digest('hex'), 'and a multi-byte one');

  const key = 'APIKEY', secret = 'SECRET', sk = 'SESSKEY';
  store.set('sidecut_lastfm_key', key); store.set('sidecut_lastfm_secret', secret);
  store.set('sidecut_lastfm_session', sk); store.set('sidecut_lastfm_on', '1');
  ok(lf.enabled() === true, 'the module reports itself connected');

  const track = { id: 7, name: 'Song Name', artist: 'The Artist', album: 'The Album', duration: 200 };
  captured = null;
  lf.nowPlaying(track);
  await new Promise((r) => setTimeout(r, 0));
  const np = captured && new URLSearchParams(captured.opts.body);
  ok(!!np, 'now playing was sent');
  if (np) {
    const expected = crypto.createHash('md5').update(
      'album' + 'The Album' + 'api_key' + 'APIKEY' + 'artist' + 'The Artist' + 'duration' + '200' +
      'method' + 'track.updateNowPlaying' + 'sk' + 'SESSKEY' + 'track' + 'Song Name' + 'SECRET'
    ).digest('hex');
    ok(np.get('method') === 'track.updateNowPlaying', 'with the right method');
    ok(np.get('api_sig') === expected, 'and a signature built independently: ' + expected.slice(0, 8) + '…');
  }

  captured = null;
  lf.scrobble(track);
  await new Promise((r) => setTimeout(r, 0));
  const sc = captured && new URLSearchParams(captured.opts.body);
  ok(!!sc, 'a scrobble was sent');
  if (sc) {
    const ts = sc.get('timestamp[0]');
    const expected = crypto.createHash('md5').update(
      'album[0]' + 'The Album' + 'api_key' + 'APIKEY' + 'artist[0]' + 'The Artist' + 'duration[0]' + '200' +
      'method' + 'track.scrobble' + 'sk' + 'SESSKEY' + 'timestamp[0]' + ts + 'track[0]' + 'Song Name' + 'SECRET'
    ).digest('hex');
    ok(sc.get('artist[0]') === 'The Artist' && sc.get('track[0]') === 'Song Name', 'carrying artist and track');
    ok(sc.get('format') === 'json', 'asking for json');
    ok(sc.get('api_sig') === expected, 'and signed the way Last.fm documents');
    ok(String(Number(ts)).length === 10, 'with a unix timestamp');
  }

  captured = null;
  lf.scrobble({ id: 9, name: 'Short', artist: 'X', duration: 12 });
  await new Promise((r) => setTimeout(r, 0));
  ok(captured === null, 'a song under thirty seconds is never sent');

  const offline = factory(() => Promise.reject(new Error('offline')));
  offline.scrobble({ id: 11, name: 'Kept', artist: 'Y', duration: 180 });
  await new Promise((r) => setTimeout(r, 10));
  const q = JSON.parse(store.get('sidecut_lastfm_queue') || '[]');
  ok(q.length === 1 && q[0].track === 'Kept', 'and one that cannot be sent is queued for later');
}

console.log('[5] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-728.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.7.1';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.8';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-7271.mjs', ['72.7', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for the previous gate too');
  ok(repin.indexOf("bespoke('test-7271.mjs'") !== -1, 'with the sweep corrections written for the gates it displaces');
  ok(repin.indexOf("esc(OLDCACHE) + '(?![\\\\d.])'") !== -1, 'the cache move is prefix-safe');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "'" + ';';
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs' && n !== 'test-728.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v72\.7\.1(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
  ok(cacheStale.length === 0, 'and no gate still names the old shell cache (' + cacheStale.join(',') + ')');
}

console.log('[6] inline script syntax and the OTA tail');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
  ok(/\n\n$/.test(src), 'the page ends with the two-newline OTA tail');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
