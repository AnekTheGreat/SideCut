#!/usr/bin/env node
// The 60.1.3 stamp lost its minutes ("12 AM") — the format call's separator is a
// narrow no-break space, so the minute-stripping replace fired for some times and
// not others. Every entry keeps the full time.
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(HTML, 'utf8');

const stamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true
}).format(new Date()).replace(/\u202f/g, ' ').replace(' at ', ' · ') + ' EDT';

const from = `{ version: '60.1.3', date: 'September 21, 2026 · 12 AM EDT',`;
const to = `{ version: '60.1.3', date: '${stamp}',`;
const n = html.split(from).length - 1;
if (n !== 1) throw new Error('expected 1, found ' + n);
html = html.split(from).join(to);
fs.writeFileSync(HTML, html);
console.log('  ✓ 60.1.3 stamp -> ' + stamp);
