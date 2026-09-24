#!/usr/bin/env node
// v61.1 — the widget animation/freeze fixes plus the upcoming-releases day gate.
// Bumps APP_VERSION, prepends the CHANGELOG entry (patch notes for BOTH OTA
// channels), moves the service worker cache to sidecut-shell-v61.1 and repins
// every dev/test-*.mjs `ver === '…'` assertion.
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

// Eastern time = UTC minus 4 (this sandbox has no tzdate — see the versioning note).
function easternStamp() {
  const d = new Date(Date.now() - 4 * 3600 * 1000);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${h}:${mm} ${ampm} EDT`;
}

if (src.includes("const APP_VERSION = '61.1'")) {
  console.log('patch-611: already applied');
  process.exit(0);
}

replaceOnce(`  const APP_VERSION = '61';`, `  const APP_VERSION = '61.1';`, 'APP_VERSION → 61.1');

const HEAD = `  { version: '61', date: 'September 23, 2026 · 7:25 PM EDT', title: 'Fetch latest grows an "Upcoming releases" tab', items: [`;
mustCount(src, HEAD, 1, 'changelog head');
const entry = `  { version: '61.1', date: '${easternStamp()}', title: 'The home widget moves again, and Upcoming releases stops counting the past', items: [
    'The home-screen widget animates again while a song plays: the equalizer bars cycle on their own from inside the app, so the motion keeps going whether or not SideCut is on screen. Before, the bars only stepped when the app was awake — which is exactly when you are not looking at the widget.',
    'That loop repaints about twice a second and caches the cover art across those repaints, so the picture is decoded once instead of on every frame, and it hands the widget back to the paused renderer the moment playback stops.',
    'The widget can no longer freeze mid-song: the battery-saving idle dim is blocked while music is playing — it used to push a fake paused state ("Tap to show", bars gone, a play icon that lied) and then stop pushing entirely. A stationary player still dims, and the first tap anywhere in the app wakes a dimmed widget on the spot instead of waiting out the rest of the beat.',
    'If the app dies while a song is playing, the watchdog now stops the shimmer and paints the real paused state instead of leaving bars marching for music that is no longer running.',
    'Upcoming releases only counts genuinely dated drops: an album whose date has already passed no longer shows up there, and placeholder dates far out in the future are treated as catalog junk instead of a release someone actually dated.',
    'The same day gate runs everywhere the tab is built — Fetch latest and the Home New releases panel — so both lists agree about what is really on the way.',
  ] },
`;
src = src.replace(HEAD, entry + HEAD);
n++;
console.log('• changelog head entry → 61.1');

// sw.js: str_replace is reliable outside index.html, but keep it in this atomic pass.
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
if (sw.includes(`const CACHE_NAME = 'sidecut-shell-v61';`)) {
  sw = sw.replace(`const CACHE_NAME = 'sidecut-shell-v61';`, `const CACHE_NAME = 'sidecut-shell-v61.1';`);
  fs.writeFileSync(SW, sw);
  console.log('• sw.js cache → sidecut-shell-v61.1');
} else if (!sw.includes(`sidecut-shell-v61.1`)) {
  throw new Error('sw.js: unexpected CACHE_NAME');
}

mustCount(src, `const APP_VERSION = '61'`, 0, 'stale bare 61 APP_VERSION');
fs.writeFileSync(FILE, src);

// Repin the test suite.
const pins = fs.readdirSync(path.join(ROOT, 'dev'))
  .filter((f) => /^test-.*\.mjs$/.test(f));
let pinned = 0;
for (const f of pins) {
  const p = path.join(ROOT, 'dev', f);
  const t = fs.readFileSync(p, 'utf8');
  if (t.includes(`ver === '61'`)) {
    fs.writeFileSync(p, t.split(`ver === '61'`).join(`ver === '61.1'`));
    pinned++;
    console.log('• repinned dev/' + f);
  }
}

console.log(`patch-611: index.html ${n} replacements, ${pinned} test pins`);
