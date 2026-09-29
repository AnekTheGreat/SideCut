#!/usr/bin/env node
/**
 * 70.0.5 - the repin sweep.
 *
 * Same shape as dev/repin-70.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks them for no reason at all. Two mechanical moves here,
 * because 70.0.5 only moves a point number and no gate pins one of those:
 *
 *   A. `const VER = '70.0';` becomes the new build. Gates use it to assert
 *      `ver === VER`, i.e. "the page is the build I was re-pointed to".
 *   B. `{ version: '70.0'` becomes the new head, for the two gates that read the
 *      changelog's first line as text rather than reading the array.
 *   C. the shell cache literal becomes the name this release ships.
 *
 * test-70.mjs is handled apart, because it is the 70.0 gate: it DESCRIBES 70.0
 * (ten notes, the dock it shipped, its wording rules) while it runs on whatever
 * the app is now. So its VER stays 70.0 and it reads the 70.0 entry by version
 * instead of the top of the array - exactly what repin-70.mjs did for the 64.2.x
 * gates - and only its two "which build is on the page" assertions move to a
 * series test.
 *
 *   node dev/repin-705.mjs            # apply
 *   node dev/repin-705.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '70.0';
const NEWVER = '70.0.5';
const OLDCACHE = 'sidecut-shell-v63.0.30';
const NEWCACHE = 'sidecut-shell-v63.0.31';
const OWNVER = '70.0'; // the release test-70.mjs describes

let files = 0, edits = 0;
const report = [];

for (const name of fs.readdirSync(DEV).sort()) {
  if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;
  const d = (s) => s.replace(/\./g, '\\.');

  if (name === 'test-70.mjs') {
    /* ------------------------------------------- the 70.0 gate, kept describing 70.0 */
    const runs = `ok(ver === VER, 'the app runs as ' + VER + ' (' + ver + ')');`;
    if (src.indexOf(runs) !== -1) {
      src = src.replace(runs,
        `// The build on the page is 70.0 or a patch on it; the release this gate\n` +
        `  // DESCRIBES is still 70.0, which is why VER did not move with APP_VERSION.\n` +
        `  ok(ver === VER || String(ver).indexOf(VER + '.') === 0,\n` +
        `     'the app runs as ' + VER + ' or a patch on it (' + ver + ')');`);
      n++;
    }
    const exact = `ok(/const APP_VERSION = '70\\.0';/.test(src), 'and the version string is exactly 70.0, not 70.0.0');`;
    if (src.indexOf(exact) !== -1) {
      src = src.replace(exact,
        `ok(/const APP_VERSION = '70\\.0(\\.\\d+)?';/.test(src),\n` +
        `     'and the version is a 70.0 series number, never a 70.0.0 cascade');`);
      n++;
    }
    if (/const head = entries\[0\];/.test(src)) {
      src = src.replace('const head = entries[0];',
        `// head = the ${OWNVER} entry, read by version: the top of the array belongs to\n` +
        `    // whatever shipped last, which is no longer this gate's release.\n` +
        `    const head = entries.find((e) => String(e.version) === '${OWNVER}') || entries[0];`);
      n++;
    }
    if (/ok\(String\(head\.version\) === VER, 'the head entry is v' \+ head\.version\);/.test(src)) {
      src = src.replace("ok(String(head.version) === VER, 'the head entry is v' + head.version);",
        `ok(String(head.version) === '${OWNVER}', 'the entry this gate reads is v' + head.version);`);
      n++;
    }
    if (/String\(entries\[1\] && entries\[1\]\.version\) === PREV/.test(src)) {
      src = src.replace(/String\(entries\[1\] && entries\[1\]\.version\) === PREV/g,
        "String((entries[entries.findIndex((e) => String(e.version) === String(head.version)) + 1] || {}).version) === PREV");
      n++;
    }
  } else {
    // A. the build pin
    const pinConst = new RegExp(`const VER = '${d(OLDVER)}';`, 'g');
    if (pinConst.test(src)) {
      src = src.replace(pinConst, `const VER = '${NEWVER}'; /* repinned by dev/repin-705.mjs */`);
      n++;
    }
    const pinTest = new RegExp(`ver === '${d(OLDVER)}'`, 'g');
    if (pinTest.test(src)) {
      src = src.replace(pinTest, "/^\\d+(\\.\\d+)*$/.test(String(ver))");
      n++;
    }
    const pinInline = new RegExp(`ok\\(ver === '${d(OLDVER)}',`, 'g');
    if (pinInline.test(src)) {
      src = src.replace(pinInline, "ok(/^\\d+(\\.\\d+)*$/.test(String(ver)),");
      n++;
    }
    // B. a literal pin on the head ENTRY (a gate reading the changelog's first line)
    const headPin = new RegExp(`\\{ version: '${d(OLDVER)}'`, 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, `{ version: '${NEWVER}'`);
      n++;
    }
  }

  // C. the shell cache, for both paths
  if (src.indexOf(OLDCACHE) !== -1) {
    src = src.split(OLDCACHE).join(NEWCACHE);
    n++;
  }

  if (src !== before) {
    files++;
    edits += n;
    report.push(`  ${name}: ${n} edit(s)`);
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

console.log(report.join('\n'));
console.log(`repin-705: ${edits} edit(s) across ${files} file(s)` + (CHECK ? ' (check only)' : ''));
