#!/usr/bin/env node
/**
 * 72.8 - the two lyrics highlight chips.
 *
 * NOTE, 72.8.1: this gate originally pinned TWO things, the scrobbler and the
 * lyrics chips. The owner removed the scrobbler in 72.8.1, so the Last.fm half of
 * this gate is gone with it - keeping assertions about code that no longer ships
 * would be the gate lying. What is left is the half that still describes the app:
 * the letter wave is visible, and the two chips look on when they are on. The
 * letter-by-letter PACING (which 72.8.1 reworked) is pinned by dev/test-7281.mjs.
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the letter wave is visible: the word drops to the trough in letter mode,
 *       and the word/letter chips carry the !important coral state that an inline
 *       style cannot outrank;
 *   [3] nothing of the removed Last.fm feature is left behind;
 *   [4] the repin moved every gate (no stale pin);
 *   [5] inline script syntax, and the OTA tail.
 *
 *   node dev/test-728.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.7'; /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */
const PREV = '73.1.6'; /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.7';

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
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.8 entry is still behind it');
    // The words the release before this one pinned on the HEAD have to be here:
    // test-7251 and test-7252 read the head for /widget/ and /player/.
    ok(/widget/i.test(notes), 'the head notes still name the widget the earlier gates look for');
    ok(/player/i.test(notes), 'and the player');
    ok(/letter/i.test(notes), 'and this release says what it is about');
    ok(/lyrics/i.test(notes), 'including the lyrics half of it');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-7281.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.8.1';") !== -1, 'the patch states the release once');
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

console.log('[3] the removed Last.fm feature leaves nothing behind');
{
  // The cover-art lookup from 63.x legitimately still names Last.fm; the scrobbler
  // is what had to go, so the checks below are on its identifiers.
  ok(src.indexOf('fetchCoverFromLastFM') !== -1, 'the cover-art lookup that predates it is untouched');
  ok(src.indexOf('lastfm') === -1, 'and no lastfm identifier of any kind');
  ok(src.indexOf('scLastfm') === -1, 'no window global for it');
  ok(src.indexOf('sidecut_lastfm') === -1, 'and none of its storage keys');
  ok(count(src, "var LF_API = 'https://ws.audioscrobbler.com/2.0/';") === 0,
    'the scrobbler is no longer wired to the Last.fm endpoint');
  ok(count(src, 'ws.audioscrobbler.com') === 1,
    'and the one pre-existing use of it - the cover-art search - is the only one left');
  ok(src.indexOf('function lfMd5(') === -1, 'the MD5 helper it needed is gone with it');
  // The two functions it hooked must read as they did before it existed.
  ok(/recordListeningDay\(\);\n/.test(src), 'the play recorder is back to its plain self');
  ok(count(src, 'recordListeningDay();') === 1, 'from exactly one place');
  ok(/scSidecarSet\(t\.id, \{ playCount: t\.playCount \}\);\n/.test(src),
    'and so is the play counter');
  ok(count(src, 'scSidecarSet(t.id, { playCount: t.playCount });') === 1, 'from exactly one place');
  // The card is out of the More pane, and the toggle it sat above is still there.
  ok(count(src, 'id="lastfmCard"') === 0, 'the settings card is gone');
  ok(count(src, 'id="lastfmKeyInput"') === 0 && count(src, 'id="lastfmConnectBtn"') === 0,
    'with its key boxes and its connect button');
  ok(count(src, '<!-- Diagonal / Single button toggle -->') === 1,
    'and the card that followed it in the More pane is untouched');
  ok(count(src, 'const PLAY_COUNTS_AFTER = 0.5;') === 1,
    'the play-counting block it was inserted in front of is intact');
}

console.log('[4] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-7281.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.8';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.8.1';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-728.mjs', ['72.7.1', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for the previous gate too');
  ok(repin.indexOf("bespoke('test-728.mjs'") !== -1, 'with the sweep corrections written for the gates it displaces');
  ok(repin.indexOf("esc(OLDCACHE) + '(?![\\\\d.])'") !== -1, 'the cache move is prefix-safe');
  ok(repin.indexOf("esc(OLDVER) + \"';\"") !== -1, 'and so is the build pin, because 72.8 is a prefix of 72.8.1');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "'" + ';';
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v73\.1\.6(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
  ok(cacheStale.length === 0, 'and no gate still names the old shell cache (' + cacheStale.join(',') + ')');
}

console.log('[5] inline script syntax and the OTA tail');
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