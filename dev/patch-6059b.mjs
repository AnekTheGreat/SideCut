#!/usr/bin/env node
// v60.5.9 follow-up: the release metadata check wants at least five notes on
// the newest changelog entry, and the release page has two more things worth
// saying — the NEW badge clears the moment you open a release, and the
// countdown timer is torn down when the page closes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const ANCHOR = "the moment the drop happens.',";
const hits = src.split(ANCHOR).length - 1;
if (hits !== 1) throw new Error(`anchor: expected 1, found ${hits}`);
if (src.includes('clears its NEW badge on the spot')) {
  console.log('patch-6059b: already applied');
  process.exit(0);
}

const ITEMS = [
  'Opening a release clears its NEW badge on the spot \\u2014 the row in the list and the bell\\u2019s unseen count both drop as soon as you have looked at it.',
  'The countdown keeps ticking while the page is open, Esc or the back arrow leaves from anywhere on it, and the timer is cleared the moment you go \\u2014 nothing keeps running behind the scenes.',
];
src = src.replace(ANCHOR, ANCHOR + '\n' + ITEMS.map((t) => "    '" + t + "',").join('\n'));

// The entry must now carry five notes and still parse.
const s = src.indexOf("{ version: '60.5.9'");
const e = src.indexOf('\n  ] }', s);
if (s === -1 || e === -1) throw new Error('60.5.9 entry not found');
const items = src.slice(s, e).split('\n').filter((l) => l.trim().startsWith("'"));
if (items.length < 5) throw new Error('entry has only ' + items.length + ' notes');

fs.writeFileSync(FILE, src);
console.log('patch-6059b: entry now has ' + items.length + ' notes');
