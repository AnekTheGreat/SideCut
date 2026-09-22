#!/usr/bin/env node
// The 60.4.9 entry was drafted at 7:50 AM EDT but the release is actually
// shipping now (3:06 PM EDT). Patch notes must carry the real EDT ship time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const now = new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York',
  month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
}).replace(' at ', ' \u00b7 ') + ' EDT';

const old = `{ version: '60.4.9', date: 'September 22, 2026 \u00b7 7:50 AM EDT'`;
const neu = `{ version: '60.4.9', date: '${now}'`;

const count = src.split(old).length - 1;
if (count !== 1) { console.error(`anchor matched ${count} times (need 1)`); process.exit(1); }
src = src.replace(old, neu);
fs.writeFileSync(FILE, src);
console.log('60.4.9 date ->', now);
