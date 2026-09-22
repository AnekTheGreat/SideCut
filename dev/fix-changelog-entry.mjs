#!/usr/bin/env node
// Close the 60.4.5 changelog entry object (its `}` was omitted by the
// delivery patch, which broke the CHANGELOG eval in dev/ota-bundle.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const anchor = "versions were compared \u2014 never silence.',\n  ],\n  { version: '60.4.4',";
const fixed  = "versions were compared \u2014 never silence.',\n  ],\n  },\n  { version: '60.4.4',";

if (src.includes(fixed)) {
  console.log('= already closed');
} else if (!src.includes(anchor)) {
  console.error('anchor not found'); process.exit(1);
} else {
  src = src.split(anchor).join(fixed);
  fs.writeFileSync(FILE, src);
  console.log('closed the 60.4.5 changelog entry');
}

// verify the parser now evaluates
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
if (!block) { console.error('no CHANGELOG block'); process.exit(1); }
try {
  const entries = eval('[' + block[1] + ']');
  console.log('eval OK \u2014 entries:', entries.length, '| newest:', entries[0].version, '| notes:', entries[0].items.length, '| date:', entries[0].date);
} catch (e) {
  console.error('EVAL ERROR:', e.message); process.exit(1);
}
