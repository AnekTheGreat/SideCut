#!/usr/bin/env node
// v60.4.9 follow-up: "it shouldn't get in the way of dropdowns and stuff."
//
// Two root causes in .dur-bubble:
//   1. z-index:80 while every sheet/backdrop/menu in the app starts at
//      z-index 60 (.modal-backdrop 60, add-songs 199/200, home-bubble
//      overlay 80, confirm 90, disc popup 250) — so the popup could render
//      ON TOP of an open dropdown.
//   2. Normal pointer events — for up to 4s after tapping the clamped time
//      it swallowed taps aimed at the chips row, the sort dropdown, the
//      kebab menu and any row underneath it.
//
// Fix: pointer-events:none (presses pass straight through to the real
// control; dismissal still works — the capture-phase document click hides
// the popup for any non-anchor target, and a second tap on the line still
// toggles it off) + z-index:50, below every overlay, so an open dropdown
// always covers the popup, never the other way round.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const replacements = [
  {
    name: 'dur-bubble: pointer-events:none + z-index 50',
    old: `    box-shadow:0 8px 24px rgba(0,0,0,0.45); z-index:80;
  }`,
    neu: `    box-shadow:0 8px 24px rgba(0,0,0,0.45); z-index:50;
    /* Stays out of the way: taps pass straight through to whatever is
       underneath (sort dropdown, kebab, chips, rows), and 50 keeps it
       below every sheet/backdrop/menu (those start at z-index 60), so an
       open dropdown always covers the popup, never the other way round. */
    pointer-events:none;
  }`,
  },
  {
    name: 'changelog: note for the out-of-the-way popup',
    old: `    'Removed the random markers that appeared next to songs: the orange "No audio" warning (it could show up on songs that play perfectly) and the genre chips.',
  ] },`,
    neu: `    'Removed the random markers that appeared next to songs: the orange "No audio" warning (it could show up on songs that play perfectly) and the genre chips.',
    'The length popup now stays out of your way: it never blocks a tap \\u2014 presses pass straight through it to the sort dropdown, kebab menu, chips and rows underneath, and it always renders beneath every sheet, menu and dialog instead of on top of them.',
  ] },`,
  },
];

let failed = 0;
for (const r of replacements) {
  const count = src.split(r.old).length - 1;
  if (count !== 1) {
    console.error(`anchor "${r.name}" matched ${count} times (need exactly 1)`);
    failed++;
    continue;
  }
  src = src.replace(r.old, r.neu);
  console.log(`ok  ${r.name}`);
}
if (failed) process.exit(1);

fs.writeFileSync(FILE, src);
console.log('written:', FILE);
