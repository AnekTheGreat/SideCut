#!/usr/bin/env node
// dev/patch-changelog.mjs — adds the v60.3.0 changelog entry.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

// Already patched?
if (src.includes("version: '60.3.0'")) {
  console.log('changelog: 60.3.0 entry already present');
  process.exit(0);
}

// Insert new entry right after "const CHANGELOG = ["
const ANCHOR = "  const CHANGELOG = [\n";
const ENTRY = [
  "  { version: '60.3.0', date: 'September 22, 2026 · 6:00 AM EDT', title: 'Album-aware downloader, ordering & smoother RGB', items: [",
  "    'Duplicate song titles now resolve to the correct album recording \u2014 the downloader uses album context in every search.',",
  "    'Spotify track positions are preserved exactly, so an album\u0027s songs keep their real order even if a row is skipped.',",
  "    'Selected songs convert top-to-bottom matching what you see on screen.',",
  "    'RGB animation is smoother at 20 steps/sec without burning extra battery.',",
  "    'Collaboration artist credits (Artist A, Artist B) are kept intact during search.',",
  "  ]},\n"
].join('\n');

if (!src.includes(ANCHOR)) {
  console.error('changelog: could not find CHANGELOG anchor');
  process.exit(1);
}
src = src.replace(ANCHOR, ANCHOR + ENTRY);
fs.writeFileSync(FILE, src, 'utf8');
console.log('changelog: 60.3.0 entry added');
