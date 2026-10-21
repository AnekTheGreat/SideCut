#!/usr/bin/env node
/**
 * 80.0.1 - move every gate pin that names the build, the changelog head, the shell
 * cache or the release regex from 80.0 to 80.0.1.
 *
 * 80.0.1 is a fix INSIDE 80.0 - a fourth number, the shape 72.5.1 used for a fix
 * shipped inside 72.5 - so the live pin moves one step and nothing else does:
 *
 *   VER = '80.0'                 -> VER = '80.0.1'
 *   version: '80.0'              -> version: '80.0.1'
 *   ver === '80.0'               -> ver === '80.0.1'
 *   entries[N].version === '80.0'-> entries[N].version === '80.0.1'
 *   sidecut-shell-v80.0          -> sidecut-shell-v80.0.1
 *   /^80\.0$/                     -> /^80\.0\.1$/
 *   const PREV = '80.0'          -> '75.1.2'   (the release BEFORE this one)
 *
 * test-70 reads the live build by series and already accepts
 * /^80\.\d+(\.\d+)?$/, so the family pin does not move - and a FOURTH number is
 * inside that family by construction.
 *
 * The two order-sensitive steps matter here. `'80.0'` is a PREFIX of `'80.0.1'`,
 * so the quoted-literal sweep would rewrite a freshly written '80.0.1' into
 * '80.0.1.1' on the same pass if the closing quote were not part of the match. The
 * cache sweep carries a (?!\.\d) lookahead for the same reason.
 *
 *   node dev/repin-8001.mjs            # apply
 *   node dev/repin-8001.mjs --check    # report only
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
                      'repin-8001.mjs', 'patch-7511.py', 'patch-7512.py', 'patch-800.py',
                      'patch-8001.py']);

// The release this one replaces, which is what an ADJACENCY pin names.
const PREV_RELEASE = '80.0';
// The release BEFORE that - the value those pins held until this sweep.
const OLD_PREV = '75.1.2';
const BUILD = '80.0';

// A gate asserts ADJACENCY when it compares the entry under the HEAD to PREV. Those
// gates - and only those - have their PREV moved one release on, because the release
// they sit next to is this one. Every other PREV in dev/ pins the release ITS OWN
// gate describes (61.3.7, 64.2.1, 70.0 ...) and must never move.
//
// A gate that reads its OWN entry by version (the OWN split) and then compares THAT
// entry's neighbour is not in this set: its PREV names the release its own release
// replaced, which does not move when the head does. dev/revamp-check.cjs is the one
// in this tree - it describes 80.0, which is no longer the head.
function assertsAdjacency(src) {
  return /entries\[1\]/.test(src) && !/ownIdx/.test(src);
}

function pin(src) {
  let n = 0;
  // Normalize PREV first so the quoted-literal sweep below cannot touch it, then
  // write the right value back once the sweep is done.
  const adjacency = assertsAdjacency(src);
  src = src.replace(/const PREV = '75[.]1[.]2';/g, "const PREV = '@@SCPREV@@';");
  src = src.replace(/const PREV = '80[.]0';/g, "const PREV = '@@SCPREV@@';");
  // OWN names the release the gate DESCRIBES, which is never the live build, so it
  // is held out of the quoted sweep and written back unchanged.
  src = src.replace(/const OWN = '80[.]0';/g, "const OWN = '@@SCOWN@@';");
  const one = (re, repl) => {
    const next = src.replace(re, repl);
    if (next !== src) { n += 1; src = next; }
  };
  // The closing quote is part of the match, so a freshly written '80.0.1' cannot
  // match again on the same pass.
  one(/'80[.]0'/g, "'80.0.1'");
  // The cache name: the lookahead keeps a second run from turning .1 into .1.1.
  one(/sidecut-shell-v80[.]0(?![.\d])/g, 'sidecut-shell-v80.0.1');
  // The release-regex pins (the album-follow probe and the revamp gate).
  one(/\/\^80\\[.]0\$\//g, '/^80\\.0\\.1$/');
  one(/repinned by dev\/repin-800[.]mjs/g, 'repinned by dev/repin-8001.mjs');
  src = src.split("const PREV = '@@SCPREV@@';").join("const PREV = '" + (adjacency ? PREV_RELEASE : OLD_PREV) + "';");
  src = src.split("const OWN = '@@SCOWN@@';").join("const OWN = '" + BUILD + "';");
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

console.log('repin-8001: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (SKIP.has(name) || (!TEST_RE.test(name) && !CHECK_RE.test(name))) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    // PREV is deliberately the previous release, not this one.
    // PREV and OWN are deliberately release names, not the live build: PREV is the
    // release a gate sits next to, and OWN is the release a gate DESCRIBES. Neither
    // is a stale pin, so both are held out of the sweep before it looks.
    const live = src.replace(/const PREV = '(?:75[.]1[.]2|80[.]0)';/g, '')
                    .replace(/const OWN = '[0-9.]+';/g, '');
    if (/'80[.]0'/.test(live)) stale.push(name + " '80.0'");
    if (/sidecut-shell-v80[.]0(?![.\d])/.test(src)) stale.push(name + ' old shell cache');
    if (/\/\^80\\[.]0\$\//.test(src)) stale.push(name + ' old release regex');
    if (/const PREV = '80[.]0';/.test(src) && !assertsAdjacency(src)) stale.push(name + ' PREV moved with the build');
  }
  if (stale.length) {
    console.error('repin-8001: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-8001: no stale pin left in any gate');
}
