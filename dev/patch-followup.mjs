#!/usr/bin/env node
// Two touch-ups after patch-pins-downloader:
// 1. Node's toLocaleString emitted "September 21, 2026 at 9:19 PM EDT" for the
//    60.4.4 entry; every other entry uses "September 21, 2026 · 9:19 PM EDT".
// 2. The exactness gate in the verify loop inlined `bufDelta <= 15` — route it
//    through scDurationOk so the helper is genuinely wired in (it existed but
//    was never called, which is how "duration verification" shipped dead).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function rep(label, oldStr, newStr) {
  const first = src.indexOf(oldStr);
  if (first === -1) throw new Error(`anchor not found: ${label}`);
  if (src.indexOf(oldStr, first + 1) !== -1) throw new Error(`anchor ambiguous (>1): ${label}`);
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  n++;
  console.log(`\u2022 ${label}`);
}

rep('normalize 60.4.4 changelog date', `  { version: '60.4.4', date: 'September 21, 2026 at 9:19 PM EDT',`,
                      `  { version: '60.4.4', date: 'September 21, 2026 \u00b7 9:19 PM EDT',`);

rep('exact gate uses scDurationOk', `      if(bufDelta === -1 || bufDelta <= 15){ audio = entry.pa; dec = decTry; break; }`,
`      // scDurationOk is the single source of truth for "exact" (<=15s): it
      // existed since 60.4.0 but was never called anywhere.
      if(bufDelta === -1 || scDurationOk(expectedSec, bufSec)){ audio = entry.pa; dec = decTry; break; }`);

fs.writeFileSync(FILE, src);
console.log(`Applied ${n} change(s) to index.html`);
