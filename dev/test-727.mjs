#!/usr/bin/env node
/**
 * 72.7 - the way in is tap-by-tap, and the tools bar says it opens.
 *
 * One owner request: "Make the instructions more clearer of to like click on
 * conversion tools and stuff and a drop-down will appear stuff like that to make
 * it more clearer". This gate pins each half of the answer where it lives:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the tools bar reads as a control ("tap to open") in BOTH lists;
 *   [3] every step that teaches the converter now names the tap and the
 *       drop-down, and still carries the teaching line the older gates pin;
 *   [4] the Play-only build was not given converter language it must not have;
 *   [5] the repin moved every gate (no stale pin);
 *   [6] inline script syntax.
 *
 *   node dev/test-727.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.4'; /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */
const PREV = '73.1.3'; /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.4';
const OWN = '72.7';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;
const sliceOf = (hay, a, b) => { const i = hay.indexOf(a); const j = hay.indexOf(b, i); return (i === -1 || j === -1) ? '' : hay.slice(i, j); };

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
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.6 entry is still behind it');
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
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-727.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.7';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] the tools bar reads as a control you tap');
{
  // The identical summary line is in both lists, so the count is exactly two.
  ok(count(src, '🎛️ Conversion Tools') >= 2, 'the tool sections are still in the markup');
  const hint = 'Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL \u2014 tap to open \u25be';
  ok(count(src, hint) === 2, 'both tool bars end with the tap hint (' + count(src, hint) + ')');
  // And the old, non-actionable hint is gone.
  ok(count(src, 'Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL</span></summary>') === 0,
    'the old heading-only hint is gone');
  ok(count(src, 'tap to open') >= 2, 'and the words a reader needs are there in both lists');
}

console.log('[3] every step names the tap and the drop-down');
{
  const disc = sliceOf(src, 'id="getSongsHowToDisc"', '<!-- Expand URL card -->');
  const settings = sliceOf(src, 'id="getSongsHowToSettings"', '<!-- Expand URL card -->');
  for (const [label, box] of [['Discover', disc], ['Settings', settings]]) {
    ok(box.indexOf('a drop-down opens') !== -1, label + ': the step says a drop-down opens');
    ok(/Tap <b style="color:var\(--ink\);">🎛️ Conversion Tools<\/b>/.test(box),
      label + ': and names the bar to tap, with its own glyph');
    ok(/tap the (link )?box to paste/.test(box), label + ': and says to tap the box to paste');
    ok(box.indexOf('Spotify to MP3') !== -1, label + ': and still names the card to open');
    ok(box.indexOf('Convert') !== -1, label + ': and still ends at the Convert button');
  }
  // The teaching lines the older gates pin survive verbatim inside the new text.
  ok(count(src, 'Open the built-in converter below') === 1, 'the Discover teaching line is still exactly once');
  ok(count(src, 'Paste the link into the built-in') === 1, 'and so is the Settings one');
  ok(count(src, '<b>Getting music in:</b> paste a Spotify link') === 1, 'and so is the tutorial summary opener');
  ok(count(src, 'tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it into your library') === 1,
    'and the scenario still teaches the tag-and-file outcome');
  // The modal's own walkthrough and the scenario both carry the tap wording.
  const modal = sliceOf(src, 'id="howToGetMusicHead"', '<div style="font-weight:600; font-size:14px; margin-bottom:6px;">Playing music</div>');
  ok(modal.indexOf('a drop-down opens') !== -1, 'the how-to modal walkthrough says a drop-down opens');
  const tutsum = sliceOf(src, 'id="tutSumGetMusic"', '</div>');
  ok(tutsum.indexOf('a drop-down opens') !== -1, 'and the tutorial summary says it too');
  // Nothing that was there before was taken away.
  ok(disc.indexOf('spotisaver.net') !== -1 && disc.indexOf('spotmate.online') !== -1,
    'the Discover box keeps its outside-site fallback links');
  ok(settings.indexOf('spotisaver.net') !== -1 && settings.indexOf('spotmate.online') !== -1,
    'and so does the Settings box');
}

console.log('[4] the Play-only build was given no converter language');
{
  // The strings that build substitutes describe bringing your own files in, and
  // this release must not have touched them. The Play header is the whole story.
  const header = sliceOf(src, 'if(SC_IS_PLAY){', '// ---- Frame-rate independent drag auto-scroll');
  ok(header.indexOf('var _getSongsSteps =') !== -1, 'the Play walkthrough is still built from _getSongsSteps');
  ok(!/a drop-down opens/i.test(header), 'the Play substitution names no drop-down');
  ok(!/Conversion Tools/.test(header), 'and no Conversion Tools bar');
  ok(!/spotisaver|spotmate/i.test(header), 'and no outside converter site');
  ok(count(src, "nextElementSibling.style.display = 'none'") === 1,
    'the tool section is still put away on Play by position');
}

console.log('[5] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-727.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.6';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.7';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-726.mjs', ['72.5.2', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for its own gate too');
  ok(repin.indexOf("bespoke('test-726.mjs'") !== -1, 'with the sweep corrections written for the gates it displaces');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "'" + ';';
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v73[.]1[.]3(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
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
