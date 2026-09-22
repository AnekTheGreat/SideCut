#!/usr/bin/env node
// Correct the 60.5.2 changelog date to the actual bundle/ship time (EDT),
// checked against ICU time — the container TZ date is unreliable (no zoneinfo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'index.html');
let src = fs.readFileSync(file, 'utf8');

const want = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
}).format(new Date()).replace(' at ', ' · ') + ' EDT';

const re = /(version: '60\.5\.2', date: ')([^']+)(')/;
const m = src.match(re);
if(!m){ console.error('60.5.2 entry not found'); process.exit(1); }
if(m[2] === want){ console.log('date already exact: ' + want); process.exit(0); }
src = src.replace(re, '$1' + want + '$3');
fs.writeFileSync(file, src);
console.log('60.5.2 date: "' + m[2] + '" -> "' + want + '"');
