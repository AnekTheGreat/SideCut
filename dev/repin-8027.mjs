#!/usr/bin/env node
/**
 * 80.2.7 - move every gate pin that names the build, the changelog head, the shell
 * cache or the release regex from 80.2.6 to 80.2.7.
 *
 *   80.2.7 is a patch inside the 80.2 line: the Home bubble sizes are one ascending
 *   ladder with two new rungs in the long jumps (Roomy 179, Grand 230), and the
 *   Sandbox height stepper moves in quarter steps. No gate file is added or removed
 *   by the repin itself - the release's own section [6] goes into
 *   dev/home-bubble-size-check.cjs through dev/patch-gate-8027.py, and sections [1]
 *   and [3] of that same gate are repinned to the new walk and the new step.
 *
 *   VER = '80.2.6'                    -> VER = '80.2.7'
 *   version: '80.2.6'                 -> version: '80.2.7'
 *   entries[N].version === '80.2.6'   -> entries[N].version === '80.2.7'
 *   sidecut-shell-v80.2.6             -> sidecut-shell-v80.2.7
 *   /^80\.2\.6$/                      -> /^80\.2\.7$/
 *   const PREV = '80.2.5'             -> '80.2.6'  (the release BEFORE this one)
 *
 * The two order-sensitive steps, unchanged since 80.0.1:
 *
 *  (1) '80.2.6' is not a prefix of '80.2.7' at the quotes, but the ADJACENCY pin
 *      still normalizes to a placeholder before the quoted sweep and is written
 *      back once it is done, so the release 80.2.7 sits next to is 80.2.6.
 *  (2) The closing quote is part of every quoted match, and the cache sweep
 *      carries a (?!\d|\.) lookahead, so a freshly written '80.2.7' / v80.2.7
 *      cannot be rewritten again on the same pass.
 *
 * dev/revamp-check.cjs DESCRIBES 80.0 - the release the split shipped in - so its
 * OWN stays '80.0' and only its live pins move.
 *
 *   node dev/repin-8027.mjs              # apply
 *   node dev/repin-8027.mjs --check      # report only
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
                      'repin-8009.mjs', 'repin-80010.mjs', 'repin-801.mjs', 'repin-802.mjs',
                      'repin-8021.mjs', 'repin-8022.mjs', 'repin-8023.mjs', 'repin-8024.mjs',
                      'repin-8025.mjs', 'repin-8027.mjs',
                      'patch-7511.py', 'patch-7512.py', 'patch-800.py', 'patch-8001.py',
                      'patch-8002.py', 'patch-8004.py', 'patch-8005.py', 'patch-80010.py',
                      'patch-801.py', 'patch-802.py', 'patch-8021.py', 'patch-8022.py',
                      'patch-8023.py', 'patch-8023-text.py', 'patch-8023-text-c.py',
                      'patch-8024.py', 'patch-8024-text.py', 'patch-8025.py', 'patch-8025-text.py',
                      'patch-8027.py', 'patch-8027-text.py']);

// The release this one replaces, which is what an ADJACENCY pin names.
const PREV_RELEASE = '80.2.6';
const BUILD = '80.2.7';
const OLD_BUILD = '80.2.6';
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
  // pins 80.0 (the revamp), one that pins 80.1 (an older release) and one that
  // pins 80.2 (the release before this one) are three different claims.
  src = src.replace(/const PREV = '(80[.]0(?:[.](?:[1-9]|10))?|80[.]1|80[.]2(?:[.](?:[1-9]|10))?)?';/g, "const PREV = '@@SCPREV:$1@@';");
  // OWN names the release the gate DESCRIBES, which is never the live build, so it
  // is held out of the quoted sweep and written back unchanged.
  src = src.replace(/const OWN = '80[.]0';/g, "const OWN = '@@SCOWN@@';");
  const one = (re, repl) => {
    const next = src.replace(re, repl);
    if (next !== src) { n += 1; src = next; }
  };
  // The closing quote is part of the match, so a freshly written '80.2.7' cannot
  // match again on the same pass.
  one(/'80[.]2[.]6'/g, "'80.2.7'");
  // The cache name: the lookahead keeps a second run from turning .6 into .6.1.1.
  one(/sidecut-shell-v80[.]2[.]6(?![.\d])/g, 'sidecut-shell-v80.2.7');
  // The release-regex pins, in the character-class spelling most gates carry:
  // normalize the escaped spelling first...
  one(/\/\^80\\[.]2\\[.]6\$\//g, '/^80\\.2\\.7$/');
  one(/repinned by dev\/repin-8026[.]mjs/g, 'repinned by dev/repin-8027.mjs');
  // THE ESCAPED QUOTED PIN. dev/album-auto-delete-check.cjs writes the page's own
  // version as a regex - /const APP_VERSION = '80\.2\.6';/ - which no quoted sweep
  // reaches, so a release that only sweeps quotes leaves a gate behind that fails on
  // the next build and says so ("the page runs 80.2.6"). Swept with its escaping kept.
  one(/'80\\[.]2\\[.]6'/g, "'80\\.2\\.7'");
  // ...and the SENTENCE that pin is reported as, so the report cannot go on saying
  // "the page runs <the release before this one>" while it tests the new one.
  one(new RegExp('the page runs ' + OLD_BUILD.replace(/[.]/g, '[.]'), 'g'), 'the page runs ' + BUILD);
  // ...then the double-backslash spelling, if a gate carries one.
  one(/\/\^80\\\\.2\\\\.6\$\//g, '/^80\\\\.2\\\\.7$/');
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

console.log('repin-8027: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (SKIP.has(name) || (!TEST_RE.test(name) && !CHECK_RE.test(name))) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    // PREV and OWN are deliberately release names, not the live build: PREV is the
    // release a gate sits next to, OWN is the release a gate DESCRIBES. Neither is
    // a stale pin, so both are held out of the sweep before it looks.
    const live = src.replace(/const PREV = '(?:80[.]0(?:[.]\d+)?|80[.]1|80[.]2(?:[.]\d+)?)';/g, '')
                    .replace(/const OWN = '[0-9.]+';/g, '');
    if (/'80[.]2[.]6'/.test(live)) stale.push(name + " '80.2.6'");
    if (/sidecut-shell-v80[.]2[.]6(?![.\d])/.test(src)) stale.push(name + ' old shell cache');
    if (/'80\\[.]2\\[.]6'/.test(src)) stale.push(name + ' old escaped version pin');
    if (/\/\^80\\[.]2\\[.]6\$/.test(src)) stale.push(name + ' old release regex');
    if (new RegExp("const PREV = '" + BUILD + "';").test(src)) stale.push(name + ' PREV moved with the build');
    if (new RegExp("const OWN = '" + BUILD + "';").test(src)) stale.push(name + ' OWN moved with the build');
  }
  if (stale.length) {
    console.error('repin-8027: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-8027: no stale pin left in any gate');
}
