#!/usr/bin/env node
// Patch notes must not mention the Play build / play version.
//
// The CHANGELOG is the single source of the patch notes: deploy.yml extracts
// them into ota/manifest.json + updates.json, ota-bundle-play.mjs into
// ota-play/updates.json, and the in-app changelog reads the same array. Only
// the NOTE STRINGS change — versions, dates, item counts and every code/UI
// string outside the changelog are untouched (tests pin versions, dates and
// counts, and pin the UI label 'Play build — licensed sources' which stays).
//
// Rewrites name the flavor by what it DOES (only takes files you own / only
// openly-licensed catalogs / one of the two builds) instead of saying "Play".
// Google Play references that mean the STORE (Play Console, Play Billing,
// Play Store popups) are deliberately left alone — they are not the play
// version of the app.
//
// Safe to re-run: every anchor is checked for presence and uniqueness first.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
let src = fs.readFileSync(INDEX, 'utf8');

const applied = [], failed = [];
function replaceOnce(name, oldStr, newStr) {
  const first = src.indexOf(oldStr);
  if (first === -1) { failed.push(name + ': anchor not found'); return; }
  if (src.indexOf(oldStr, first + 1) !== -1) { failed.push(name + ': anchor not unique'); return; }
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  applied.push(name);
}

// --- 60.5.4 (current release: title + 2 items) ---
replaceOnce('60.5.4 title',
  `title: 'Downloads removed from the Play build · the full build names a failed search instead of a dead end'`,
  `title: 'Downloads cleanup · a failed search names the step instead of a dead end'`);

replaceOnce('60.5.4 item 1 lead',
  `'The Play build has NO downloads at all now: the Spotify and YouTube converter cards`,
  `'The build that only takes the files you own has NO downloads at all now: the Spotify and YouTube converter cards`);

replaceOnce('60.5.4 item 3 tail',
  `had nothing, and the Play build attaches its own name when it says it.`,
  `had nothing.`);

// --- 60.5.3 (item 2 version line, item 5 hand-off) ---
replaceOnce('60.5.3 version-line item',
  `The version line now names the build — Full build or Play build — so a converter that seems dead can be checked against which APK is actually installed,`,
  `The version line now names the build you have installed so a converter that seems dead can be checked against which APK it is,`);

replaceOnce('60.5.3 hand-off item lead',
  `The Play build no longer offers outside converter sites when its licensed catalog misses a track`,
  `A build whose licensed catalog misses a track no longer offers outside converter sites`);

// --- 60.5.1 (CI flavors item) ---
replaceOnce('60.5.1 CI item',
  `the Play AAB/APK (flag-injected, licensed sources)`,
  `the store AAB/APK (flag-injected, licensed sources)`);

// --- 60.5.0 (title + 3 items) ---
replaceOnce('60.5.0 title',
  `title: 'Play-ready build mode: licensed sources on Play, sideload untouched'`,
  `title: 'Build mode: openly-licensed sources, sideload untouched'`);

replaceOnce('60.5.0 item 1',
  `the Google Play build takes audio only from openly-licensed catalogs`,
  `one build takes audio only from openly-licensed catalogs`);

replaceOnce('60.5.0 item 2',
  `In the Play build the YouTube converter card is hidden`,
  `In one build the YouTube converter card is hidden`);

replaceOnce('60.5.0 item 3',
  `Each build checks its own update channel (ota-play/ for Play, ota/ for sideload), so a Play install can never receive a sideload bundle.`,
  `Each build checks its own update channel (ota/ or ota-play/), so one install can never receive the other build’s bundle.`);

// --- 56.0.6-era version-numbering item ---
replaceOnce('56.x version-numbering item',
  `are tracked separately from the Play build number again (5.0.43)`,
  `are tracked separately from the store release number again (5.0.43)`);

fs.writeFileSync(INDEX, src);

console.log('patch-notes-noplay: ' + applied.length + ' applied');
applied.forEach((a) => console.log('  \u2713 ' + a));
if (failed.length) {
  failed.forEach((f) => console.log('  \u2717 ' + f));
  process.exit(1);
}

// Prove the changelog itself no longer says it (case-insensitive "play build",
// "play version", "play-ready", "play aab", "google play build", "play install").
const clStart = src.indexOf('const CHANGELOG = [');
const clEnd = src.indexOf('\n  ];', clStart);
const cl = src.slice(clStart, clEnd);
const banned = [/play build/ig, /play version/ig, /play-ready/ig, /play aab/ig, /google play build/ig, /play install/ig];
const hits = [];
banned.forEach((re) => { const m = cl.match(re); if (m) hits.push(...m); });
if (hits.length) { console.error('  \u2717 changelog still says: ' + hits.join(', ')); process.exit(1); }
console.log('  \u2713 changelog patch notes contain no Play-build / play-version mention');
console.log('next: syntax check + test battery + node dev/ota-bundle.mjs && node dev/ota-bundle-play.mjs');
