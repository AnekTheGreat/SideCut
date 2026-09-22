#!/usr/bin/env node
// dev/patch-lyrics-sync.mjs — faster lyrics polling + lead offset so word-by-word
// and line highlight feel locked to the beat. Safe to re-run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// 1. Speed up lyrics polling from 150 ms to 80 ms.
//    At 150 ms a word (200-400 ms long) gets 1-2 polls — enough to skip it
//    entirely. 80 ms gives every word at least 2-3 polls so the highlight
//    actually lands on it.
if (src.includes('}, 150); // Slightly slower interval for better performance')) {
  src = src.replace(
    '}, 150); // Slightly slower interval for better performance',
    '}, 80); // Fast enough for word-by-word: every word gets 2-3 polls'
  );
  changes++;
}

// 2. Add a 60 ms lead so the highlight fires slightly BEFORE the timestamp,
//    compensating for the polling delay and rendering latency. Without it the
//    highlight always feels a beat behind the music.
if (!src.includes('const LYRICS_LEAD_MS')) {
  src = src.replace(
    "      const currentTime = audio.currentTime;\n      const lyricsText = $('lyricsText');",
    "      // Small lead so the highlight fires before the timestamp, not after.\n" +
    "      // Compensates for the polling interval + render latency (~60 ms).\n" +
    "      const LYRICS_LEAD_MS = 0.06;\n" +
    "      const currentTime = audio.currentTime + LYRICS_LEAD_MS;\n" +
    "      const lyricsText = $('lyricsText');"
  );
  changes++;
}

// 3. Word-by-word: use the lead-adjusted time consistently so words light up
//    smoothly instead of snapping late.
if (!src.includes('wordLeadAdj')) {
  src = src.replace(
    "                w.classList.toggle('current', currentTime >= wordStart && currentTime < wordEnd);",
    "                w.classList.toggle('current', currentTime >= wordStart && currentTime < wordEnd); // wordLeadAdj"
  );
  changes++;
}

// 4. Bump version.
if (src.includes("const APP_VERSION = '60.3.5'")) {
  src = src.replace("const APP_VERSION = '60.3.5'", "const APP_VERSION = '60.3.6'");
  changes++;
}

// 5. Changelog entry.
if (!src.includes("version: '60.3.6'")) {
  const ANCHOR = "  const CHANGELOG = [\n";
  const ENTRY = [
    "  { version: '60.3.6', date: 'September 22, 2026 · 7:30 AM EDT', title: 'Word-by-word lyrics & highlight sync fix', items: [",
    "    'Lyrics highlight now polls at 80 ms instead of 150 ms \\u2014 word-by-word no longer skips short words.',",
    "    'A 60 ms lead compensates for polling delay so the highlight lands on the beat, not a beat behind.',",
    "  ]},\n"
  ].join('\n');
  if (src.includes(ANCHOR)) {
    src = src.replace(ANCHOR, ANCHOR + ENTRY);
    changes++;
  }
}

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`patch-lyrics-sync: applied ${changes} patch(es)`);
} else {
  console.log('patch-lyrics-sync: already applied');
}
