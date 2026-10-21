#!/usr/bin/env node
/**
 * 80.0.2 - move every gate pin that names the build, the changelog head, the shell
 * cache or the release regex from 80.0.1 to 80.0.2.
 *
 * 80.0.2 is a fix INSIDE 80.0 - the second fourth-number release, the same shape
 * 80.0.1 used - so the live pin moves one step and nothing else does:
 *
 *   VER = '80.0.1'                  -> VER = '80.0.2'
 *   version: '80.0.1'               -> version: '80.0.2'
 *   entries[N].version === '80.0.1' -> entries[N].version === '80.0.2'
 *   sidecut-shell-v80.0.1           -> sidecut-shell-v80.0.2
 *   /^80\.0\.1$/                    -> /^80\.0\.2$/
 *   const PREV = '80.0.1'           -> '80.0'  (the release BEFORE this one)
 *
 * Two order-sensitive steps, both learned in 80.0.1:
 *
 *  (1) '80.0.1' is a PREFIX of '80.0.2' only in the sense that they share text, but
 *      '80.0' IS a prefix of both, so the adjacency PREV normalizes to a placeholder
 *      before the quoted sweep and is written back once it is done. A gate whose
 *      PREV is the release it sits next to moves from '80.0' to '80.0.1'.
 *  (2) The closing quote is part of every quoted match, and the cache sweep carries
 *      a (?!\.\d) lookahead, so a freshly written '80.0.2' / v80.0.2 cannot be
 *      rewritten again on the same pass.
 *
 * test-70 reads the live build by series (/^80\.\d+(\.\d+)?$/) and a third number is
 * inside that family by construction, so its family pin does not move.
 *
 *   node dev/repin-8002.mjs            # apply
 *   node dev/repin-8002.mjs --check    # report only
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
                      'repin-8001.mjs', 'repin-8002.mjs', 'patch-7511.py', 'patch-7512.py',
                      'patch-800.py', 'patch-8001.py', 'patch-8002.py']);

// The release this one replaces, which is what an ADJACENCY pin names.
const PREV_RELEASE = '80.0.1';
// The release BEFORE that - the value those pins held until this sweep.
const OLD_PREV = '80.0';
const BUILD = '80.0.2';
// OWN is a release name like PREV: it names the release a gate DESCRIBES, and it
// never moves when the head does. dev/revamp-check.cjs describes 80.0 (the revamp),
// so a sweep that wrote BUILD here would make that gate describe the release it is
// reading history for - the exact mistake 80.0.1's memory warns about.
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
  // Normalize PREV first, so the quoted-literal sweep below cannot touch it.
  src = src.replace(/const PREV = '80[.]0[.]1';/g, "const PREV = '@@SCPREV@@';");
  src = src.replace(/const PREV = '80[.]0';/g, "const PREV = '@@SCPREV@@';");
  // OWN names the release the gate DESCRIBES, which is never the live build, so it
  // is held out of the quoted sweep and written back unchanged.
  src = src.replace(/const OWN = '80[.]0';/g, "const OWN = '@@SCOWN@@';");
  const one = (re, repl) => {
    const next = src.replace(re, repl);
    if (next !== src) { n += 1; src = next; }
  };
  // The closing quote is part of the match, so a freshly written '80.0.2' cannot
  // match again on the same pass.
  one(/'80[.]0[.]1'/g, "'80.0.2'");
  // The cache name: the lookahead keeps a second run from turning .2 into .2.2.
  one(/sidecut-shell-v80[.]0[.]1(?![.\d])/g, 'sidecut-shell-v80.0.2');
  // The release-regex pins (the album-follow probe and the revamp gate).
  one(/\/\^80\\[.]0\\[.]1\$\//g, '/^80\\.0\\.2$/');
  one(/repinned by dev\/repin-8001[.]mjs/g, 'repinned by dev/repin-8002.mjs');
  src = src.split("const PREV = '@@SCPREV@@';").join("const PREV = '" + (adjacency ? PREV_RELEASE : OLD_PREV) + "';");
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

console.log('repin-8002: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (SKIP.has(name) || (!TEST_RE.test(name) && !CHECK_RE.test(name))) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    // PREV and OWN are deliberately release names, not the live build: PREV is the
    // release a gate sits next to, OWN is the release a gate DESCRIBES. Neither is
    // a stale pin, so both are held out of the sweep before it looks.
    const live = src.replace(/const PREV = '(?:80[.]0|80[.]0[.]1)';/g, '')
                    .replace(/const OWN = '[0-9.]+';/g, '');
    if (/'80[.]0[.]1'/.test(live)) stale.push(name + " '80.0.1'");
    if (/sidecut-shell-v80[.]0[.]1(?![.\d])/.test(src)) stale.push(name + ' old shell cache');
    if (/\/\^80\\[.]0\\[.]1\$/.test(src)) stale.push(name + ' old release regex');
    if (/const PREV = '80[.]0[.]2';/.test(src)) stale.push(name + ' PREV moved with the build');
    if (/const OWN = '80[.]0[.]2';/.test(src)) stale.push(name + ' OWN moved with the build');
  }
  if (stale.length) {
    console.error('repin-8002: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-8002: no stale pin left in any gate');
}
