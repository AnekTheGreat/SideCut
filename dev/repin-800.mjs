#!/usr/bin/env node
/**
 * 80.0 - move every gate pin that names the build, the changelog head, the shell
 * cache or the release regex from 75.1.2 to 80.0.
 *
 * 80.0 is a new series, not a patch inside 75.1, so the sweep is a straight
 * literal move and the app's own rule still holds (a well-formed version, the
 * third number never reaching ten - 80.0 has no third number at all).
 *
 *   VER = '75.1.2'                 -> VER = '80.0'
 *   version: '75.1.2'              -> version: '80.0'
 *   sidecut-shell-v75.1.2          -> sidecut-shell-v80.0
 *   /^75\.1\.2$/                   -> /^80\.0$/
 *   const PREV                     -> '75.1.2'  (unchanged: it IS the release before)
 *
 * test-70 reads the live build by series, so its list gains /^80\.\d+(\.\d+)?$/
 * beside the 70..75 families it already names.
 *
 *   node dev/repin-800.mjs            # apply
 *   node dev/repin-800.mjs --check    # report only
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
                      'patch-7511.py', 'patch-7512.py', 'patch-800.py']);

const PREV_RELEASE = '75.1.2';

function pin(src) {
  let n = 0;
  // PREV is the release BEFORE this one. Normalize it to a placeholder first so
  // the literal sweep cannot turn it into the live build.
  src = src.replace(/const PREV = '75[.]1';/g, "const PREV = '@@SCPREV@@';");
  src = src.replace(/const PREV = '75[.]1[.]1';/g, "const PREV = '@@SCPREV@@';");
  src = src.replace(/const PREV = '75[.]1[.]2';/g, "const PREV = '@@SCPREV@@';");
  src = src.replace(/const PREV = '80[.]0';/g, "const PREV = '@@SCPREV@@';");
  const one = (re, repl) => {
    const next = src.replace(re, repl);
    if (next !== src) { n += 1; src = next; }
  };
  one(/'75[.]1[.]2'/g, "'80.0'");
  one(/sidecut-shell-v75[.]1[.]2(?![.\d])/g, 'sidecut-shell-v80.0');
  one(/\/\^75\\[.]1\\[.]2\$\//g, '/^80\\.0$/');
  // test-70 reads the build by series. Matched as literal text, not as a regex:
  // the source line is full of regex escapes itself.
  const seriesBare = '/^75\\.\\d+(\\.\\d+)?$/.test(ver), // repin-720';
  const seriesWith80 = '/^75\\.\\d+(\\.\\d+)?$/.test(ver) || /^80\\.\\d+(\\.\\d+)?$/.test(ver), // repin-720';
  const seriesWithPatch = '/^75\\.\\d+(\\.\\d+)?$/.test(ver) || /^75\\.1\\.\\d+$/.test(ver), // repin-720';
  if (src.indexOf('/^80\\.\\d+(\\.\\d+)?$/') === -1) {
    if (src.indexOf(seriesBare) !== -1) { src = src.replace(seriesBare, seriesWith80); n += 1; }
    else if (src.indexOf(seriesWithPatch) !== -1) { src = src.replace(seriesWithPatch, seriesWith80); n += 1; }
  }
  one(/repinned by dev\/repin-7512[.]mjs/g, 'repinned by dev/repin-800.mjs');
  src = src.split("const PREV = '@@SCPREV@@';").join("const PREV = '" + PREV_RELEASE + "';");
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

console.log('repin-800: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (SKIP.has(name) || (!TEST_RE.test(name) && !CHECK_RE.test(name))) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    // PREV is deliberately the previous release, not this one.
    const live = src.replace(/const PREV = '75[.]1[.]2';/g, '');
    if (/'75[.]1[.]2'/.test(live)) stale.push(name + " '75.1.2'");
    if (/sidecut-shell-v75[.]1[.]2(?![.\d])/.test(src)) stale.push(name + ' old shell cache');
    if (/\/\^75\\[.]1\\[.]2\$/.test(src)) stale.push(name + ' old release regex');
    if (/const PREV = '80[.]0';/.test(src)) stale.push(name + ' PREV moved with the build');
  }
  if (stale.length) {
    console.error('repin-800: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-800: no stale pin left in any gate');
}
