#!/usr/bin/env node
// v61.3's changelog date was stamped as the UTC clock time with an "EDT" label
// ("September 24, 2026 · 1:42 AM EDT") — a timestamp that was in the FUTURE
// when it was written (the release actually landed Sep 23, 9:42 PM EDT; see
// git show f097cbd, committed 2026-09-24T01:50Z). That made the changelog read
// backwards once v61.3.5 — correctly stamped as Sep 23, 10:27 PM EDT — went in
// above it, and dev/test-6052.mjs (which pins entries[0].date) failed.
//
// Fixes the date on the 61.3 entry only. The 61.3.5 head entry keeps its
// correct Eastern stamp. str_replace cannot write index.html (it no-ops on the
// 2.2 MB file), so this runs the atomic count==1 replace pass instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const OLD = `  { version: '61.3', date: 'September 24, 2026 · 1:42 AM EDT', title: 'Homing in on the nothing button', items: [`;
const NEW = `  { version: '61.3', date: 'September 23, 2026 · 9:42 PM EDT', title: 'Homing in on the nothing button', items: [`;

function count(hay, needle, label) {
  const got = hay.split(needle).length - 1;
  return { got, label };
}

const headDate = `  { version: '61.3.5', date: 'September 23, 2026 · 10:27 PM EDT', title: 'One version number everywhere', items: [`;
const checks = [
  count(src, headDate, '61.3.5 head entry'),
  count(src, OLD, '61.3 entry with the mislabeled date'),
];
for (const c of checks) {
  if (c.got !== 1) throw new Error(`${c.label}: expected 1 occurrence, found ${c.got}`);
}
if (src.includes(NEW)) {
  console.log('fix-613-date: already applied');
  process.exit(0);
}

src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src);

// Re-verify: both entries present exactly once, in the right order, and no
// leftover future-dated stamp anywhere in the changelog head region.
const after = fs.readFileSync(FILE, 'utf8');
for (const [needle, label] of [[headDate, '61.3.5 head'], [NEW, '61.3 corrected date']]) {
  const got = after.split(needle).length - 1;
  if (got !== 1) throw new Error(`${label}: expected 1 occurrence after write, found ${got}`);
}
if (after.includes('September 24, 2026 · 1:42 AM EDT')) {
  throw new Error('old mislabeled date still present');
}
const iNew = after.indexOf(headDate);
const i613 = after.indexOf(NEW);
if (iNew < 0 || i613 < 0 || iNew > i613) throw new Error('61.3.5 head must come before 61.3');

console.log('fix-613-date: 61.3 changelog date corrected to September 23, 2026 · 9:42 PM EDT');
