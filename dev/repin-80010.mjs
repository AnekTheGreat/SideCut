#!/usr/bin/env node
/**
 * 80.0.10 - move every gate pin that names the build, the changelog head, the
 * shell cache or the release regex from 80.0.9 to 80.0.10.
 *
 * 80.0.10 makes the cloud dock a small icon staircase in the bottom right corner,
 * puts the mini player on the bottom edge of the screen and fixes the add-songs
 * sheet. That is a page change and a pin, so the live pin moves one step and
 * nothing else does - the gate for the flight and the bar is dev/staircase-check.cjs,
 * which this release rewrites whole.
 *
 *   VER = '80.0.9'                  -> VER = '80.0.10'
 *   version: '80.0.9'               -> version: '80.0.10'
 *   entries[N].version === '80.0.9' -> entries[N].version === '80.0.10'
 *   sidecut-shell-v80.0.9           -> sidecut-shell-v80.0.10
 *   /^80\.0\.9$/                    -> /^80\.0\.10$/
 *   const PREV = '80.0.8'           -> '80.0.9'  (the release BEFORE this one)
 *
 * The two order-sensitive steps, unchanged from 80.0.1 and each release since:
 *
 *  (1) '80.0' IS a prefix of both '80.0.9' and '80.0.10', so the adjacency PREV
 *      normalizes to a placeholder before the quoted sweep and is written back
 *      once it is done. A gate whose PREV is the release it sits next to moves
 *      from '80.0.8' to '80.0.9'.
 *  (2) The closing quote is part of every quoted match, and the cache sweep
 *      carries a (?!\d|\.) lookahead, so a freshly written '80.0.10' / v80.0.10
 *      cannot be rewritten again on the same pass.
 *
 * dev/revamp-check.cjs DESCRIBES 80.0 - the release the split shipped in - so its
 * OWN stays '80.0' and only its live pins move.
 *
 *   node dev/repin-80010.mjs            # apply
 *   node dev/repin-80010.mjs --check    # report only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const TEST_RE = /^test-.*[.]mjs$/;
const CHECK_RE = /check[.]cjs$/;
const SKIP = new Set(['repin-751.mjs', 'repin-7511.mjs', 'repin-7512.mjs', 'repin-800.mjs',
                      'repin-8001.mjs', 'repin-8003.mjs', 'repin-8005.mjs', 'repin-8007.mjs',
                      'repin-8009.mjs', 'repin-80010.mjs',
                      'patch-7511.py', 'patch-7512.py', 'patch-800.py', 'patch-8001.py',
                      'patch-8002.py', 'patch-8004.py', 'patch-8005.py', 'patch-80010.py']);

// The release this one replaces, which is what an ADJACENCY pin names.
const PREV_RELEASE = '80.0.9';
const BUILD = '80.0.10';
const OLD_BUILD = '80.0.9';
// OWN names the release a gate DESCRIBES, and it never moves when the head does.
const OWN_RELEASE = '80.0';

// A gate asserts ADJACENCY when it compares the entry under the HEAD to PREV. Those
// gates - and only those - have their PREV moved one release on, because the release
// they sit next to is this one. Every other PREV in dev/ pins the release ITS OWN
// gate describes and must never move.
function assertsAdjacency(src) {
  return /entries\[1\]/.test(src) && !/ownIdx/.test(src);
}

function pin(src) {
  let n = 0;
  const adjacency = assertsAdjacency(src);
  // Normalize PREV first, so the quoted-literal sweep below cannot touch it. The
  // original value is CARRIED in the placeholder rather than assumed: a gate that
  // pins 80.0 (the revamp) and a gate that pins 80.0.9 (the release before this
  // one) are different claims, and writing both back as the same string is how a
  // sweep stops being idempotent - the second run would move a PREV that had
  // already been moved.
  src = src.replace(/const PREV = '(80[.]0(?:[.]1|[.]2|[.]3|[.]4|[.]5|[.]6|[.]7|[.]8|[.]9)?)';/g, "const PREV = '@@SCPREV:$1@@';");
  // OWN names the release the gate DESCRIBES, which is never the live build, so it
  // is held out of the quoted sweep and written back unchanged.
  src = src.replace(/const OWN = '80[.]0';/g, "const OWN = '@@SCOWN@@';");
  const one = (re, repl) => {
    const next = src.replace(re, repl);
    if (next !== src) { n += 1; src = next; }
  };
  // The closing quote is part of the match, so a freshly written '80.0.10' cannot
  // match again on the same pass.
  one(/'80[.]0[.]9'/g, "'80.0.10'");
  // The cache name: the lookahead keeps a second run from turning .9 into .9.9.
  one(/sidecut-shell-v80[.]0[.]9(?![.\d])/g, 'sidecut-shell-v80.0.10');
  // The release-regex pins, in the character-class spelling most gates carry:
  // normalize .8 to the escaped spelling first...
  one(/\/\^80\\[.]0\\[.]9\$\//g, '/^80\\.0\\.10$/');
  one(/repinned by dev\/repin-8009[.]mjs/g, 'repinned by dev/repin-80010.mjs');
  // ...then bump the escaped spelling - both of them - one release on. 80.0.4's
  // sweep could not see the escaped form at all; every sweep since has carried it.
  one(/\/\^80\\\.0\\\.9\$\//g, '/^80\\.0\\.10$/');
  src = src.replace(/const PREV = '@@SCPREV:([^@]+)@@';/g,
    (m, held) => "const PREV = '" + (adjacency ? PREV_RELEASE : held) + "';");
  src = src.split("const OWN = '@@SCOWN@@';").join("const OWN = '" + OWN_RELEASE + "';");
  return { src, n };
}

let files = 0, edits = 0;
for (const name of fs.readdirSync(DEV).sort()) {
  if (SKIP.has(name) || (!TEST_RE.test(name) && !CHECK_RE.test(name))) continue;
  const file = path.join(DEV, name);
  const before = fs.readFileSync(file, 'utf8');
  const { src, n } = pin(before);
  if (src !== before) {
    files += 1;
    edits += n;
    if (!CHECK) fs.writeFileSync(file, src);
    console.log('  ' + name + ': ' + n + ' edit(s)');
  }
}

console.log('repin-80010: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (SKIP.has(name) || (!TEST_RE.test(name) && !CHECK_RE.test(name))) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    // PREV and OWN are deliberately release names, not the live build: PREV is the
    // release a gate sits next to, OWN is the release a gate DESCRIBES. Neither is
    // a stale pin, so both are held out of the sweep before it looks.
    const live = src.replace(/const PREV = '(?:80[.]0|80[.]0[.]1|80[.]0[.]2|80[.]0[.]3|80[.]0[.]4|80[.]0[.]5|80[.]0[.]6|80[.]0[.]7|80[.]0[.]8|80[.]0[.]9)';/g, '')
                    .replace(/const OWN = '[0-9.]+';/g, '');
    if (/'80[.]0[.]9'/.test(live)) stale.push(name + " '80.0.9'");
    if (/sidecut-shell-v80[.]0[.]9(?![.\d])/.test(src)) stale.push(name + ' old shell cache');
    if (/\/\^80\\[.]0\\[.]9\$/.test(src)) stale.push(name + ' old release regex');
    if (new RegExp("const PREV = '" + BUILD + "';").test(src)) stale.push(name + ' PREV moved with the build');
    if (new RegExp("const OWN = '" + BUILD + "';").test(src)) stale.push(name + ' OWN moved with the build');
  }
  if (stale.length) {
    console.error('repin-80010: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-80010: no stale pin left in any gate');
}
