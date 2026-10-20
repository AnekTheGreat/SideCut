#!/usr/bin/env node
/**
 * 75.1.1 - move every gate pin that names the build, the changelog head or the
 * shell cache from 75.1 to 75.1.1.
 *
 * The release number is 75.1.1, a fourth-number-style patch inside 75.1. The
 * gates that describe their own historical release (test-70, test-736 and the
 * suite files for older releases) keep their own literals unless they pin the
 * live build; the mechanical sweep below only touches the shapes that name the
 * release on the page:
 *
 *   VER = '75.1'                      -> VER = '75.1.1'
 *   version: '75.1'                   -> version: '75.1.1'
 *   ver === '75.1'                    -> ver === '75.1.1'
 *   entries[N].version === '75.1'     -> entries[N].version === '75.1.1'
 *   sidecut-shell-v75.1               -> sidecut-shell-v75.1.1
 *   /^75\.1$/                          -> /^75\.1\.1$/
 *
 * test-70's series list already accepts /^75\.\d+(\.\d+)?$/, so the family pin
 * does not move.
 *
 *   node dev/repin-7511.mjs            # apply
 *   node dev/repin-7511.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const TEST_RE = /^test-.*[.]mjs$/;
const CHECK_RE = /check[.]cjs$/;
const SKIP = new Set(['repin-751.mjs', 'repin-7511.mjs', 'patch-7511.py']);

function pin(src) {
  let n = 0;
  // PREV is the release BEFORE this one: it was 75.0 (the second entry under
  // 75.1) and becomes 75.1 (the second entry under 75.1.1). Normalize either
  // value to a placeholder first so the quoted-literal sweep cannot touch it,
  // then write the new value back.
  src = src.replace(/const PREV = '75[.]0';/g, "const PREV = '@@SCPREV@@';");
  src = src.replace(/const PREV = '75[.]1';/g, "const PREV = '@@SCPREV@@';");
  const one = (re, repl) => {
    const next = src.replace(re, repl);
    if (next !== src) { n += 1; src = next; }
  };
  // Quoted literals for the live build. The closing quote is part of the match,
  // so an already-repinned '75.1.1' cannot match again.
  one(/'75[.]1'/g, "'75.1.1'");
  // The cache name; the lookahead keeps a second run from turning .1 into .1.1.1
  one(/sidecut-shell-v75[.]1(?![\d.])/g, 'sidecut-shell-v75.1.1');
  // The album-follow probe pins the release number as a regex literal.
  one(/\/\^75\\[.]1\$\//g, '/^75\\.1\\.1$/');
  // The repin note itself belongs to the release that moved the pin.
  one(/repinned by dev\/repin-751[.]mjs/g, 'repinned by dev/repin-7511.mjs');
  // The carried 6139 red: the tree has 25 __scJunkTitle references (one
  // definition and 24 call sites); the gate still expects the 23 it was given in
  // 73.9. Repin the exact count, not the rule.
  one(/count\('__scJunkTitle'\) === 23/g, "count('__scJunkTitle') === 25");
  src = src.split("const PREV = '@@SCPREV@@';").join("const PREV = '75.1';");
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

console.log('repin-7511: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (SKIP.has(name) || (!TEST_RE.test(name) && !CHECK_RE.test(name))) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    // PREV is deliberately the previous release, not this one.
    const live = src.replace(/const PREV = '75[.]1';/g, '');
    if (/'75[.]1'/.test(live)) stale.push(name + " '75.1'");
    if (/const PREV = '75[.]0';/.test(src)) stale.push(name + ' old PREV');
    if (/sidecut-shell-v75[.]1(?![\d.])/.test(src)) stale.push(name + ' shell cache');
    if (/\/\^75\\[.]1\$/.test(src)) stale.push(name + ' release regex');
  }
  if (stale.length) {
    console.error('repin-7511: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7511: no stale pin left in any gate');
}
