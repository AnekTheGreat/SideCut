#!/usr/bin/env node
// v61: the user's ruling — 60.5.10 "doesn't fucking exist"; after 60.5.9 the
// release is v61. Renames the version in APP_VERSION and the CHANGELOG head.
// (AGENTS.md now carries this as its first mandatory note.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function mustCount(hay, needle, want, label) {
  const got = hay.split(needle).length - 1;
  if (got !== want) throw new Error(`${label}: expected ${want} of "${needle}", found ${got}`);
}
function replaceOnce(oldStr, newStr, label) {
  mustCount(src, oldStr, 1, label);
  src = src.replace(oldStr, newStr);
  n++;
  console.log('• ' + label);
}

if (src.includes("const APP_VERSION = '61'")) {
  console.log('patch-61: already applied');
  process.exit(0);
}

replaceOnce(`  const APP_VERSION = '60.5.10';`, `  const APP_VERSION = '61';`, 'APP_VERSION → 61');
replaceOnce(
  `  { version: '60.5.10', date: 'September 23, 2026 · 7:25 PM EDT', title: 'Fetch latest grows an "Upcoming releases" tab', items: [`,
  `  { version: '61', date: 'September 23, 2026 · 7:25 PM EDT', title: 'Fetch latest grows an "Upcoming releases" tab', items: [`,
  'changelog head → 61'
);

if (src.includes('60.5.10')) throw new Error('60.5.10 still present in index.html');
fs.writeFileSync(FILE, src);
console.log(`patch-61: ${n} replacements applied — no 60.5.10 anywhere in index.html`);
