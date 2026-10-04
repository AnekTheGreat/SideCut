#!/usr/bin/env node
/**
 * 72.6 - the way in is spelled out, and a hidden playlist stays hidden.
 *
 * Three owner requests in one release. This gate pins each one where it lives:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the Expand URL card really is at the BOTTOM of both tool lists;
 *   [3] both how-to boxes and the walkthrough open with the two ways in;
 *   [4] a hidden playlist can never be the one the Library opens on - the
 *       helpers are DRIVEN, and every pick site is counted;
 *   [5] the repin moved every gate (no stale pin);
 *   [6] inline script syntax.
 *
 *   node dev/test-726.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.9'; /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */
const PREV = '73.1.8'; /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7318.mjs */ /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.9';
const OWN = '72.6';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;
const sliceOf = (hay, a, b) => { const i = hay.indexOf(a); const j = hay.indexOf(b, i); return (i === -1 || j === -1) ? '' : hay.slice(i, j); };

// Lift a function declaration out of the page as a callable, with the page's
// globals it reads bound to a state object (the same helper test-725/7251/7252 use).
function bindFn(header, stateName, rebind){
  const at = src.indexOf(header);
  if (at === -1) return null;
  const end = src.indexOf('\n  }\n', at);
  if (end === -1) return null;
  const body = src.slice(at, end + 4);
  const name = header.slice(0, header.indexOf('(')).replace(/^\s*(?:async\s+)?function\s+/, '');
  let bound = body;
  for (const key of (rebind || [])) {
    bound = bound.split(new RegExp('\\b' + key + '\\b', 'g')).join(stateName + '.' + key);
  }
  try { return new Function(stateName, bound + '\nreturn ' + name + ';'); } catch (e) { return null; }
}

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
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
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
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.5.2 entry is still behind it');
    // The words the release before this one pinned on the HEAD have to be here:
    // test-7251 and test-7252 read the head for /widget/ and /player/.
    ok(/widget/i.test(notes), 'the head notes still name the widget the earlier gates look for');
    ok(/player/i.test(notes), 'and the player');
  }
  ok(!!entries && String((entries.find((e) => String(e.version) === OWN) || {}).version) === OWN,
    'this release names its own entry (' + OWN + ')');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-726.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.6';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] the Expand URL card sits at the bottom of both tool lists');
{
  // Each how-to box is followed by its Conversion Tools section; the section must
  // still hold every card (dev/test-619.mjs proves the nesting tag by tag) and the
  // Expand URL card must now come AFTER the MP4 card and the format explainer.
  const EXPL = 'Audio formats explained';
  for (const [label, box, expand, mp4] of [
    ['Discover', 'id="getSongsHowToDisc"', 'id="expandUrlInput"', 'id="mp4ToMp3File"'],
    ['Settings', 'id="getSongsHowToSettings"', 'id="expandUrlInputSettings"', 'id="mp4ToMp3FileSettings"'],
  ]) {
    const eAt = src.indexOf(expand);
    const mAt = src.indexOf(mp4);
    // The explainer that belongs to THIS list is the one after its own how-to box
    // (the words also appear in the changelog, so a bare indexOf would not do).
    const xAt = src.indexOf(EXPL, src.indexOf(box));
    ok(eAt !== -1 && mAt !== -1, label + ': the section still has both cards');
    ok(mAt < eAt, label + ': the MP4 card comes before the Expand URL one now');
    ok(xAt !== -1 && xAt < eAt, label + ': and the format explainer is above it too');
  }
  ok(count(src, '<!-- 72.6: the Expand URL card sits at the bottom of this list now -->') === 2,
    'both lists say the card was moved there deliberately');
  ok(count(src, '<!-- Expand URL card -->') === 2, 'and both cards are still in the markup, whole');
  // The section still contains everything it did before the move.
  for (const id of ['spCardDisc', 'ytCardDisc', 'mp4ToMp3File', 'spCardSettings', 'ytCardSettings', 'mp4ToMp3FileSettings']) {
    ok(src.indexOf('id="' + id + '"') !== -1, 'the ' + id + ' card is still in its section');
  }
}

console.log('[3] the how-to text opens with the two ways in');
{
  const disc = sliceOf(src, 'id="getSongsHowToDisc"', '<!-- Expand URL card -->');
  const settings = sliceOf(src, 'id="getSongsHowToSettings"', '<!-- Expand URL card -->');
  ok(/New here\? There are two ways in/.test(disc), 'the Discover box says there are two ways in');
  ok(disc.indexOf('+ Add songs') !== -1 && disc.indexOf('Library') !== -1,
    'and names + Add songs and where the songs land');
  ok(/New here\? There are two ways in/.test(settings), 'the Settings box says it too');
  ok(settings.indexOf('+ Add songs') !== -1 && settings.indexOf('Library') !== -1,
    'and names + Add songs and where they land');
  ok(src.indexOf('Two ways in: let the app make the file from a Spotify or YouTube link (steps 1-4), or bring files you already have (the last step).') !== -1,
    'and the first-run walkthrough opens with the same plain line');
  // The teaching lines the Play-build gates pin are untouched.
  ok(count(src, 'Open the built-in converter below') === 1, 'the Discover teaching line is still exactly once');
  ok(count(src, 'Paste the link into the built-in') === 1, 'and so is the Settings one');
  ok(disc.indexOf('spotisaver.net') !== -1 && disc.indexOf('spotmate.online') !== -1,
    'the Discover box keeps its outside-site fallback links (the Play build wipes them)');
  ok(settings.indexOf('spotisaver.net') !== -1 && settings.indexOf('spotmate.online') !== -1,
    'and so does the Settings box');
}

console.log('[4] a hidden playlist is never the one the Library opens on');
{
  const visible = bindFn('  function scPlaylistVisible(name){', 'state', ['playlists', 'hiddenPlaylists']);
  ok(typeof visible === 'function', 'there is one rule for whether a playlist may be shown');
  const first = bindFn('  function scFirstVisiblePlaylist(){', 'state', ['playlists', 'hiddenPlaylists', 'scPlaylistVisible']);
  ok(typeof first === 'function', 'and one fallback for which playlist to land on');
  if (typeof visible === 'function' && typeof first === 'function') {
    const mk = (names, hidden) => {
      const pls = {}; names.forEach((n) => { pls[n] = []; });
      return { playlists: pls, hiddenPlaylists: new Set(hidden || []), scPlaylistVisible: null };
    };
    const t = mk(['All Songs', 'Road trip', 'Secret']);
    t.scPlaylistVisible = visible(t);
    ok(t.scPlaylistVisible('Road trip') === true, 'a normal playlist may be shown');
    ok(t.scPlaylistVisible('Secret') === true, 'and so may one that has not been hidden');
    t.hiddenPlaylists = new Set(['Secret']);
    ok(t.scPlaylistVisible('Secret') === false, 'a hidden playlist may not');
    ok(t.scPlaylistVisible('Nope') === false, 'and a name that is not a playlist may not');
    ok(t.scPlaylistVisible('') === false && t.scPlaylistVisible(undefined) === false,
      'neither may nothing at all');
    ok(first(t)() === 'All Songs', 'the fallback is All Songs while it is visible');
    const t2 = mk(['All Songs', 'Road trip', 'Secret'], ['All Songs']);
    t2.scPlaylistVisible = visible(t2);
    ok(first(t2)() === 'Road trip', 'and the first visible one once All Songs is hidden');
    const t3 = mk(['All Songs', 'Secret'], ['All Songs', 'Secret']);
    t3.scPlaylistVisible = visible(t3);
    ok(first(t3)() === 'All Songs', 'with everything hidden it still returns a usable name');
  }

  // Every place that picks the playlist to open on goes through the rule.
  ok(count(src, 'scPlaylistVisible(lastUsedPlaylist)') === 4,
    'all four last-used picks check visibility (boot, Library button, toggle, ◀ Library)');
  ok(count(src, 'scPlaylistVisible(lastPlaybackState.sourcePlaylist)') === 1,
    'the boot playback-source pick checks it too');
  ok(count(src, 'scPlaylistVisible(src)') === 1, 'and so does the Library button\'s');
  ok(count(src, 'scPlaylistVisible(n)') === 1, 'and the "first real playlist" search');
  ok(count(src, 'activePlaylist = scFirstVisiblePlaylist();') === 1,
    'the boot pick falls back to it');
  ok(count(src, ': scFirstVisiblePlaylist();') === 2,
    'and so do the Library button and the ◀ Library tab');
  ok(count(src, 'function scPlaylistVisible(name){') === 1, 'the rule is defined once, not copied');
  ok(count(src, 'function scFirstVisiblePlaylist(){') === 1, 'and so is the fallback');
  ok(src.indexOf("if(hiddenPlaylists.has(name) && name !== activePlaylist) return;") !== -1,
    'the tab strip still shows the playlist you are deliberately looking at');
}

console.log('[5] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-726.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.5.2';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.6';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-7252.mjs', ['72.5.1', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for its own gate too');
  ok(repin.indexOf("bespoke('test-7252.mjs'") !== -1, 'with the sweep corrections written for the gates it displaces');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "';";
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v73[.]1[.]8(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
  ok(cacheStale.length === 0, 'and no gate still names the old shell cache (' + cacheStale.join(',') + ')');
}

console.log('[6] inline script syntax');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
