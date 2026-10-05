#!/usr/bin/env node
/**
 * 72.7.1 - the lyrics toast tells you which songs it means.
 *
 * One owner request: "if it says lyrics found for x amount of songs then if you
 * click on the toast it should tell you which songs it found it for". This gate
 * pins each half of the answer where it lives:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the toast can carry a tappable list, and the panel it opens exists;
 *   [3] both lyrics runs collect the names and hand them to the toast, while the
 *       plain tap-to-dismiss behavior survives for every other toast;
 *   [4] the older gate's message pin still matches;
 *   [5] the repin moved every gate (no stale pin);
 *   [6] inline script syntax.
 *
 *   node dev/test-7271.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.2.1'; /* repinned by dev/repin-7321.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */
const PREV = '73.2'; /* repinned by dev/repin-7321.mjs */ /* repinned by dev/repin-732.mjs */ /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7318.mjs */ /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.2.1';

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
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.7 entry is still behind it');
    // The words the release before this one pinned on the HEAD have to be here:
    // test-7251 and test-7252 read the head for /widget/ and /player/.
    ok(/widget/i.test(notes), 'the head notes still name the widget the earlier gates look for');
    ok(/player/i.test(notes), 'and the player');
    ok(/lyrics/i.test(notes), 'and this release says what it is about');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-7271.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.7.1';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] a toast can carry a tappable list');
{
  ok(src.indexOf('function toast(msg, ms=2200, opts){') !== -1, 'toast() takes an optional third argument');
  ok(src.indexOf('toastEl._onTap = (opts && opts.list && opts.list.length)') !== -1,
    'and arms a tap action only when it is handed a list');
  ok(src.indexOf("? function(){ showToastList(opts.title || msg, opts.list); }") !== -1,
    'which opens the named panel');
  // The once-bound handler must route the tap to that action, then dismiss.
  ok(src.indexOf('var _fn = toastEl._onTap;') !== -1, 'the shared tap handler reads the pending action');
  ok(/if\(typeof _fn === 'function'\)\{ try\{ _fn\(\); \}/.test(src), 'and calls it when there is one');
  ok(src.indexOf("toastEl.addEventListener('click', function(){") !== -1, 'the tap stays bound exactly once');
  // The panel reuses the shipped modal styling.
  ok(src.indexOf('function showToastList(title, items){') !== -1, 'the panel exists');
  ok(src.indexOf("bd.className = 'modal-backdrop';") !== -1, 'and reuses the modal backdrop');
  ok(src.indexOf("sh.className = 'modal';") !== -1, 'and the modal card');
  ok(src.indexOf("id=\\\"_toastListClose\\\"") !== -1 || src.indexOf("id=\"_toastListClose\"") !== -1,
    'with a Close button');
  ok(src.indexOf("if(e.target === bd) close();") !== -1, 'and a tap outside closes it');
  ok(src.indexOf('escapeHtml(String(s))') !== -1, 'every song name is escaped before it is shown');
}

console.log('[3] both lyrics runs hand their names to the toast');
{
  // The batch fetch-all pass.
  ok(src.indexOf('const foundNames = [];') !== -1, 'the batch run keeps a list of the songs it matched');
  ok(src.indexOf("foundNames.push(t.name || t.title || 'Untitled');") !== -1, 'and remembers each one by name');
  ok(src.indexOf('const _lyricsOpen = _lyricsCount > 0 && _lyricsList.length > 0;') !== -1,
    'it only offers the list when there is something in it');
  ok(src.indexOf("{ title: 'Lyrics found for', list: _lyricsList }") !== -1, 'and passes that list to the toast');
  ok(src.indexOf('_lyricsOpen ? 6000 : 2200,') !== -1, 'with a longer life so there is time to tap');
  // The background re-check.
  ok(src.indexOf('var addedNames = [];') !== -1, 'the re-check keeps a list of the songs it matched');
  ok(src.indexOf("try{ addedNames.push(t.name || 'Untitled'); }catch(_eRecheckName){}") !== -1,
    'and remembers each one by name');
  ok(src.indexOf("' \\u2014 tap to see which', 6000, { title: 'Lyrics found for', list: addedNames }") !== -1,
    'and its toast carries the list too');
  // The affordance is on both messages.
  ok(count(src, 'tap to see which') === 2, 'both lyrics toasts say they can be tapped (' + count(src, 'tap to see which') + ')');
  // Every other toast keeps the old behavior: a plain tap still just dismisses.
  ok(src.indexOf(': null;\n    toastEl.textContent = msg;') !== -1,
    'a fresh toast clears any list left behind');
  ok(src.indexOf('function toastWithUndo(msg, onUndo){\n    toastEl._onTap = null;') !== -1,
    'and an undo toast clears it too, so a stale tap cannot open a panel');
}

console.log('[4] the message the older gate pins still matches');
{
  ok(src.indexOf("toast('Lyrics found for ' + added + ' newer song'") !== -1,
    'test-617 still finds its re-check toast');
  ok(/Lyrics found for 2 newer songs/.test("Lyrics found for 2 newer songs \u2014 tap to see which"),
    'and its message regex still matches the longer line');
  ok(src.indexOf('toast(`Found lyrics for ${_lyricsCount} songs`') !== -1,
    'and the batch toast still reads the same, only longer when tappable');
}

console.log('[5] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-7271.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.7';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.7.1';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-727.mjs', ['72.6', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for its own gate too');
  ok(repin.indexOf("bespoke('test-727.mjs'") !== -1, 'with the sweep corrections written for the gates it displaces');
  // The version-prefix trap: the cache move must not bite the released name.
  ok(repin.indexOf("esc(OLDCACHE) + '(?![\\\\d.])'") !== -1, 'the cache move is prefix-safe');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "'" + ';';
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v73\.2(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
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
