#!/usr/bin/env node
/**
 * SideCut 71.8 - the shell cache is named after the release.
 *
 * The owner's words: "The cache should be whatever the patch notes number is" and
 * "Every release bumps it".
 *
 * 63.1.4 decided the opposite on purpose (dev/patch-623.mjs, AGENTS.md "sw.js cache
 * name"): the service worker cache carried its own counter - `sidecut-shell-v63.0.53`
 * - and every gate since then asserts that the name must NOT contain the app
 * version. The reason was real once: an early naming scheme built the cache out of
 * the app version's leading line (`sidecut-shell-v70.0`), so two releases in the
 * same line shared one cache name and the second one was served the first one's
 * shell. That is the bug, and one number per release does not have it.
 *
 * So the rule is now the simple one the owner asked for: the cache name IS the
 * release number, and it moves every release because APP_VERSION moves every
 * release. `sidecut-shell-v71.8` today, `sidecut-shell-v71.9` next time - distinct
 * for every build that has ever shipped, which is exactly what the old scheme could
 * not guarantee.
 *
 * This script carries the three app-side edits. The ~21 gates that assert the OLD
 * rule are flipped by dev/repin-718.mjs (step F) - one place for every gate change,
 * so a release that moves the rule cannot half-move it.
 *
 *   node dev/patch-718.mjs
 *   node dev/patch-718.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-718.mjs --check   # and name every sub it skips
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '71.8';
const STAMP = 'October 1, 2026 \\u00b7 3:14 PM EDT';
// The whole point: the cache name is DERIVED from the release number, so it cannot
// drift away from the patch notes again.
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDCACHE = 'sidecut-shell-v63.0.53';
const TITLE = 'The page kept offline is named after the release now, so an update always opens the build that was installed and never the one before it';

// Seven notes, none carrying an apostrophe (they are emitted inside single
// quotes). The first six ride to the store channel and are clean of
// dev/test-play-copy.mjs's wider word list; the seventh is past that cut.
const NOTES = [
  'The copy of the page your device keeps for offline use is now named after the release, so every update starts from the build you just installed instead of the one before it.',
  'That closes the last case of a new version opening onto the previous page. The cache name and the version the app reports are the same number now, and they change together.',
  'The update check itself is unchanged: it still runs when the app opens, when you come back to it and when you ask it to, and it still asks before it installs anything.',
  'The look of the app is unchanged. The player, the dock, the queue, your playlists and every saved song behave exactly as they did before this release.',
  'Your library is untouched: no song, no album, no playlist, no cover and no setting is read or rewritten by this release.',
  'Nothing is added to the app by this change: there is no new screen, no new setting and no new permission to grant.',
  'And it costs nothing to keep: the cache holds one release of the page, so a new one replaces the old copy rather than piling up beside it.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-718: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ===================== THE RELEASE ITSELF ================================== */
sub(html, 'the app version',
  "  const APP_VERSION = '71.7';\n",
  "  const APP_VERSION = '" + VERSION + "';\n",
  { key: "const APP_VERSION = '" + VERSION + "';" });

const ENTRY = "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',\n").join('') +
  "  ] },\n";
sub(html, 'the changelog head entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + ENTRY,
  { key: "{ version: '" + VERSION + "'" });

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

if(!CHECK){
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-718: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-718: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

// ---- verification ----------------------------------------------------------
if(!CHECK){
  const final = fs.readFileSync(IDX, 'utf8');
  const swFinal = fs.readFileSync(SW, 'utf8');
  const trouble = [];
  const must = (c, m) => { if(!c) trouble.push(m); };
  const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try{ entries = eval('[' + block[1] + ']'); }catch(e){}
  must(!!entries, 'the CHANGELOG array parses');
  if(entries){
    const head = entries[0];
    must(String(head.version) === VERSION, 'the head entry is v' + VERSION + ' (got ' + (head && head.version) + ')');
    must((head.items || []).length === NOTES.length, 'the head entry carries this release notes (' + (head.items || []).length + ')');
    must((head.items || []).every((it, i) => it === NOTES[i]), 'and they are the notes this script wrote');
    must(String(head.title || '') === TITLE, 'with its own title');
    must(!/\bpass\b/i.test(String(head.title)), 'and the title does not call itself a pass');
    must(!/\bdownload|converter|convert\b/i.test([head.title].concat(head.items || []).join('\n')),
      'the head entry carries no downloader wording');
    must(/(studio|player|dock|premium|license)/i.test((head.items || []).join('\n')),
      'and it names a surface this app really has');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'nothing here is full-build-only');
    must((head.items || []).every((it) => it.indexOf("'") === -1), 'and no note carries an apostrophe');
    const old = entries.find((e) => String(e.version) === '71.7');
    must(!!old, 'the 71.7 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  must(CACHE === 'sidecut-shell-v' + VERSION, 'and it is derived from the release number');
  if(trouble.length){
    console.error('\npatch-718: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-718: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
