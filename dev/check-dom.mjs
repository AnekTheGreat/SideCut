#!/usr/bin/env node
// Play-store readiness: DOM integrity of index.html.
//  1. duplicate id="..." in the STATIC markup (real bug: $('x') grabs the wrong node)
//  2. $('id') / getElementById('id') call sites whose id appears NOWHERE in the
//     file (neither static markup nor any JS-generated string) -> runtime null crash
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let fail = 0;

// --- 1. duplicate ids in static markup (outside <script> blocks) ---
const noScripts = src.replace(/<script[\s\S]*?<\/script>/g, '');
const ids = [...noScripts.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const seen = new Map();
for (const id of ids) seen.set(id, (seen.get(id) || 0) + 1);
const dups = [...seen].filter(([, n]) => n > 1);
console.log(`static ids: ${ids.length}, unique: ${seen.size}, duplicated: ${dups.length}`);
if (dups.length) {
  fail++;
  for (const [id, n] of dups) console.log(`  DUP id="${id}" x${n}`);
}

// --- 2. referenced ids that exist nowhere in the file ---
const refs = new Set();
for (const m of src.matchAll(/\$\('([A-Za-z0-9_\-]+)'\)/g)) refs.add(m[1]);
for (const m of src.matchAll(/getElementById\('([A-Za-z0-9_\-]+)'\)/g)) refs.add(m[1]);
// id must appear as a quoted literal somewhere (static attr or JS template)
const reallyMissing = [...refs].filter(id => !new RegExp(`["'\`]${id}["'\`]`).test(src));
console.log(`id references: ${refs.size}, missing everywhere: ${reallyMissing.length}`);
if (reallyMissing.length) { fail++; reallyMissing.forEach(id => console.log(`  MISSING id="${id}"`)); }

// sanity: a few critical ids the boot path needs
const critical = ['app', 'toast', 'songActionsBackdrop', 'sortBtn', 'listMoreBtn', 'mixBtn'];
const critGone = critical.filter(id => !ids.includes(id));
console.log(`critical static ids present: ${critical.length - critGone.length}/${critical.length}${critGone.length ? ' missing: ' + critGone.join(',') : ''}`);

console.log(`\nDOM INTEGRITY FAILURES: ${fail}`);
process.exit(fail ? 1 : 0);
