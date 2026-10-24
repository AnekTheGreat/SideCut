#!/usr/bin/env node
/**
 * 80.2.2 - move every gate pin that names the build, the changelog head, the shell
 * cache or the release regex from 80.2.1 to 80.2.2.
 *
 *   80.2.2 is a patch inside the 80.2 line: one song or a whole selection can be
 *   saved to the phone from the 3-dot menu, and the now bar's 3-dot is the song's
 *   own menu instead of a second one. No gate file is added or removed beyond
 *   dev/download-menu-check.cjs, which this release adds and which pins itself.
 *
 *   VER = '80.2.1'                    -> VER = '80.2.2'
 *   version: '80.2.1'                 -> version: '80.2.2'
 *   entries[N].version === '80.2.1'   -> entries[N].version === '80.2.2'
 *   sidecut-shell-v80.2.1             -> sidecut-shell-v80.2.2
 *   /^80\.2\.1$/                     -> /^80\.2\.2$/
 *   const PREV = '80.2'               -> '80.2.1'  (the release BEFORE this one)
 *
 * The two order-sensitive steps, unchanged since 80.0.1:
 *
 *  (1) '80.2.1' is a prefix of '80.2.2' nowhere, but the ADJACENCY pin still
 *      normalizes to a placeholder before the quoted sweep and is written back
 *      once it is done, so the release 80.2.2 sits next to is 80.2.1.
 *  (2) The closing quote is part of every quoted match, and the cache sweep
 *      carries a (?!\d|\.) lookahead, so a freshly written '80.2.2' / v80.2.2
 *      cannot be rewritten again on the same pass.
 *
 * dev/revamp-check.cjs DESCRIBES 80.0 - the release the split shipped in - so its
 * OWN stays '80.0' and only its live pins move.
 *
 *   node dev/repin-8022.mjs              # apply
 *   node dev/repin-8022.mjs --check      # report only
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
                      'repin-8021.mjs', 'repin-8022.mjs',
                      'patch-7511.py', 'patch-7512.py', 'patch-800.py', 'patch-8001.py',
                      'patch-8002.py', 'patch-8004.py', 'patch-8005.py', 'patch-80010.py',
                      'patch-801.py', 'patch-802.py', 'patch-8021.py', 'patch-8022.py']);

// The release this one replaces, which is what an ADJACENCY pin names.
const PREV_RELEASE = '80.2.1';
const BUILD = '80.2.2';
const OLD_BUILD = '80.2.1';
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
  src = src.replace(/const PREV = '(80[.]0(?:[.](?:[1-9]|10))?|80[.]1|80[.]2(?:[.]1)?)';/g, "const PREV = '@@SCPREV:$1@@';");
  // OWN names the release the gate DESCRIBES, which is never the live build, so it
  // is held out of the quoted sweep and written back unchanged.
  src = src.replace(/const OWN = '80[.]0';/g, "const OWN = '@@SCOWN@@';");
  const one = (re, repl) => {
    const next = src.replace(re, repl);
    if (next !== src) { n += 1; src = next; }
  };
  // The closing quote is part of the match, so a freshly written '80.2.1' cannot
  // match again on the same pass.
  one(/'80[.]2[.]1'/g, "'80.2.2'");
  // The cache name: the lookahead keeps a second run from turning .2 into .2.1.1.
  one(/sidecut-shell-v80[.]2[.]1(?![.\d])/g, 'sidecut-shell-v80.2.2');
  // The release-regex pins, in the character-class spelling most gates carry:
  // normalize the escaped spelling first...
  one(/\/\^80\\[.]2\\[.]1\$\//g, '/^80\\.2\\.2$/');
  one(/repinned by dev\/repin-8021[.]mjs/g, 'repinned by dev/repin-8022.mjs');
  // ...then bump the escaped spelling - both of them - one release on.
  one(/\/\^80\\\.2\\.1\$\//g, '/^80\\.2\\.2$/');
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

console.log('repin-8022: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    if (/'80[.]2[.]1'/.test(live)) stale.push(name + " '80.2.1'");
    if (/sidecut-shell-v80[.]2[.]1(?![.\d])/.test(src)) stale.push(name + ' old shell cache');
    if (/\/\^80\\[.]2\\[.]1\$/.test(src)) stale.push(name + ' old release regex');
    if (new RegExp("const PREV = '" + BUILD + "';").test(src)) stale.push(name + ' PREV moved with the build');
    if (new RegExp("const OWN = '" + BUILD + "';").test(src)) stale.push(name + ' OWN moved with the build');
  }
  if (stale.length) {
    console.error('repin-8022: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-8022: no stale pin left in any gate');
}
