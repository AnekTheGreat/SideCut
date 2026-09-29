#!/usr/bin/env node
/**
 * 70.0 - the repin sweep.
 *
 * Every gate written before this release pinned the build it was written against.
 * A release that moves APP_VERSION therefore breaks them for no reason at all,
 * and the fix is the one the repo has used since 64.3: read the release a gate
 * DESCRIBES by version, and let the build on the page be whatever it is.
 *
 * Three mechanical moves, each counted and reported:
 *
 *   A. `ver === '64.3.1'` (a literal pin on the head build) becomes a shape test,
 *      and `const VER = '64.3.1';` becomes the new head. Gates that read their own
 *      release out of the changelog already keep working.
 *   B. `const head = entries[0];` becomes the entry for the release the gate names
 *      (OWNVER), and the "the release before this one is still listed next" check
 *      counts from THAT entry rather than from the top of the array.
 *   C. the shell cache literal becomes the name this release ships.
 *
 *   node dev/repin-70.mjs            # apply
 *   node dev/repin-70.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '64.3.1';
const NEWVER = '70.0';
const OLDCACHE = 'sidecut-shell-v63.0.29';
const NEWCACHE = 'sidecut-shell-v63.0.30';

// The gates that read the head entry, and the release each one describes. The
// release is the one the gate's own notes and words belong to, which is what
// makes its "six notes" and its wording rules true again.
const OWN = {
  'test-66429.mjs': '64.2.9',
  'test-66428.mjs': '64.2.8',
  'test-66427.mjs': '64.2.7',
  'test-66426.mjs': '64.2.6',
  'test-66425.mjs': '64.2.5',
};

// 6643 and 66431 name a release of their own and were re-pointed by hand (see
// their own headers); the Studio release is the head and reads the head.
const SKIP = new Set(['test-70.mjs', 'test-6643.mjs', 'test-66431.mjs']);

let files = 0, edits = 0;
const report = [];

for (const name of fs.readdirSync(DEV).sort()) {
  if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;

  // A. the literal pins
  const pinTest = new RegExp(`ver === '${OLDVER.replace(/\./g, '\\.')}'`, 'g');
  if (pinTest.test(src)) {
    src = src.replace(pinTest, "/^\\d+(\\.\\d+)*$/.test(String(ver))");
    n++;
  }
  const pinConst = new RegExp(`const VER = '${OLDVER.replace(/\./g, '\\.')}';`, 'g');
  if (pinConst.test(src)) {
    src = src.replace(pinConst, `const VER = '${NEWVER}'; /* repinned by dev/repin-70.mjs */`);
    n++;
  }
  const pinInline = new RegExp(`ok\\(ver === '${OLDVER.replace(/\./g, '\\.')}',`, 'g');
  if (pinInline.test(src)) {
    src = src.replace(pinInline, "ok(/^\\d+(\\.\\d+)*$/.test(String(ver)),");
    n++;
  }

  // B. the head-entry gates read their own release
  if (OWN[name]) {
    const own = OWN[name];
    if (/const head = entries\[0\];/.test(src)) {
      src = src.replace('const head = entries[0];',
        `// head = the ${own} entry, read by version: the top of the array belongs to\n` +
        `    // whatever shipped last, which is no longer this gate's release.\n` +
        `    const head = entries.find((e) => String(e.version) === '${own}') || entries[0];`);
      n++;
    }
    if (/ok\(String\(head\.version\) === VER, 'the head entry is v' \+ head\.version\);/.test(src)) {
      src = src.replace("ok(String(head.version) === VER, 'the head entry is v' + head.version);",
        `ok(String(head.version) === '${own}', 'the entry this gate reads is v' + head.version);`);
      n++;
    }
    if (/String\(entries\[1\] && entries\[1\]\.version\) === PREV/.test(src)) {
      src = src.replace(/String\(entries\[1\] && entries\[1\]\.version\) === PREV/g,
        "String(entries[entries.findIndex((e) => String(e.version) === String(head.version)) + 1] || {}).version === PREV"
          .replace("String(entries[", "String((entries["));
      n++;
    }
  }

  // C. the shell cache
  if (src.indexOf(OLDCACHE) !== -1) {
    src = src.split(OLDCACHE).join(NEWCACHE);
    n++;
  }

  // D. a literal pin on the head ENTRY (a gate that reads the changelog's first
  //    line rather than the array).
  const headPin = new RegExp(`\\{ version: '${OLDVER.replace(/\./g, '\\.')}'`);
  if (headPin.test(src)) {
    src = src.replace(headPin, `{ version: '${NEWVER}'`);
    n++;
  }

  // D2. A "does the header say v64." style pin in a driven probe. The release it
  //     is looking at is whatever the page is on, so the pin is the shape of a
  //     version rather than one release's number.
  if (/\/v64\\\.\//.test(src)) {
    src = src.replace(/\/v64\\\.\//g, '/v\\d+\\./');
    n++;
  }

  // E. two checks in test-662 wrote 66.2's own release INTO the rule it enforces:
  //    it required notes past the sixth to be withheld from the store channel, and
  //    it looked for the word "rollback". Both are about one release's copy, not
  //    about a head entry, so they are re-pointed at the rule underneath them.
  if (name === 'test-662.mjs') {
    const kept = `ok((head.items || []).slice(6).every((it) => it.indexOf('[FULL] ') === 0),
      'and the rest are marked for the full build');`;
    if (src.indexOf(kept) !== -1) {
      src = src.replace(kept,
        `// 70.0 publishes every note on both channels, so the rule underneath this is
` +
        `    // "nothing is withheld without saying so", not "the rest are withheld".
` +
        `    ok((head.items || []).every((it) => it.indexOf('[FULL]') === -1),
` +
        `      'and none of them is withheld from the other channel');`);
      n++;
    }
    const word = `ok(/rollback/i.test(head.items.join('\\n')), 'and it describes what this release did');`;
    if (src.indexOf(word) !== -1) {
      src = src.replace(word,
        `ok(/studio/i.test(head.items.join('\\n')), 'and it describes what this release did');`);
      n++;
    }
  }

  if (src !== before) {
    files++;
    edits += n;
    report.push(`  ${name}: ${n} edit(s)`);
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

console.log(report.join('\n'));
console.log(`repin-70: ${edits} edit(s) across ${files} file(s)` + (CHECK ? ' (check only)' : ''));
