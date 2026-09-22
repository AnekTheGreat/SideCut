#!/usr/bin/env node
// The published OTA version 60.4.1 is a KEY in the legacy-version map
// ({ '60.4.1':'60.0.6', '60.4.2':'60.0.8' }). Every installed phone normalizes
// the manifest version through that map before comparing, so 60.4.1 reads as
// 60.0.6 — OLDER than any current build — and is refused as a downgrade. That is
// why no OTA ever arrived. Fix: ship 60.4.3, a number no build maps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

const OLD_V = "const APP_VERSION = '60.4.1';";
const NEW_V = "const APP_VERSION = '60.4.3';";
if (src.includes(NEW_V)) {
  console.log('• APP_VERSION already 60.4.3');
} else if (src.includes(OLD_V)) {
  src = src.replace(OLD_V, NEW_V); n++;
  console.log('• APP_VERSION 60.4.1 → 60.4.3');
} else {
  const m = src.match(/const APP_VERSION = '([^']+)'/);
  throw new Error('APP_VERSION anchor not found; current = ' + (m && m[1]));
}

// Guard: 60.4.3 must NOT be in the legacy map, or we'd repeat the bug.
if (/LEGACY_VERSIONS[^;]*'60\.4\.3'/.test(src)) throw new Error('60.4.3 must not be a legacy-map key');

const ENTRY = `  { version: '60.4.3', date: 'September 22, 2026 · 12:56 AM EDT', title: 'OTA delivery fix — updates finally reach your phone', items: [
    'Fixed why no update ever appeared: this release line\\u2019s number collided with an old legacy-version mapping, so every installed app read the published update as OLDER than itself and silently refused it.',
    'Re-versioned past that burned number, so the update check now sees it as newer and the \\ud83d\\udd14 notification bell finally offers the install.',
    'Bundle includes everything from 60.4.1 — the lyrics \\u00b10.5s per-song sync nudge and corrected patch-note times.',
  ]},
`;
const ANCHOR = 'const CHANGELOG = [\n';
if (src.includes("version: '60.4.3'")) {
  console.log('• CHANGELOG 60.4.3 entry already present');
} else if (src.includes(ANCHOR)) {
  src = src.replace(ANCHOR, ANCHOR + ENTRY); n++;
  console.log('• Added CHANGELOG 60.4.3 entry');
} else {
  throw new Error('CHANGELOG anchor not found');
}

fs.writeFileSync(FILE, src);
console.log(n ? `Applied ${n} change(s) to index.html` : 'No changes needed');
