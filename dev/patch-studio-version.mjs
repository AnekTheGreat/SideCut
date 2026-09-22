#!/usr/bin/env node
// dev/patch-studio-version.mjs — strongly prefers studio recordings over live
// concert/collab versions when titles are identical. Safe to re-run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// 1. Strengthen the live/performance penalty and expand the regex.
//    The old -25 was too small: album-context (+18) and artist bonuses (+16, +12)
//    could stack above it, letting a live version win.
if (!src.includes('score -= 60; // live performance')) {
  src = src.replace(
    "        if(/live|remix|sped up|speed up|slowed|reverb|instrumental|karaoke|8d audio|nightcore|mashup|acoustic version|cover by/.test(t)) score -= 25;",
    "        // A live/collab performance must NEVER outrank the studio recording.\n" +
    "        // The old -25 was swamped by album (+18) + artist (+16 + 12) bonuses.\n" +
    "        if(/\\blive\\b|concert|festival|acoustic|unplugged|remix|sped up|speed up|slowed|reverb|instrumental|karaoke|8d audio|nightcore|mashup|cover by|\\bmedley\\b|\\bjam\\b|\\bon stage\\b|\\bperformance\\b/.test(t)) score -= 60; // live performance"
  );
  changes++;
}

// 2. Boost studio/official indicators much higher than before (+3 was negligible).
if (!src.includes('score += 15; // studio/official')) {
  src = src.replace(
    "        if(/official audio|official music|official video|audio only/.test(t)) score += 3;",
    "        if(/official audio|official music|official video|audio only|\\bsingle\\b|\\bstudio\\b/.test(t)) score += 15; // studio/official"
  );
  changes++;
}

// 3. Penalise titles that signal a group/performance context beyond 'live':
//    "with friends", "feat.", "duet", "together" in the video title often mean
//    a collab rendition rather than the album's canonical recording.
if (!src.includes('score -= 35; // collab rendition')) {
  src = src.replace(
    "        if(/lyric|karaoke|cover of|tribute|reaction|podcast|interview|spoken word/.test(t)) score -= 40;",
    "        if(/lyric|karaoke|cover of|tribute|reaction|podcast|interview|spoken word/.test(t)) score -= 40;\n" +
    "        // \"with friends\" / \"duet\" / \"together\" in the title = a rendition,\n" +
    "        // not the album's studio recording — heavy penalty, not a mild one.\n" +
    "        if(/\\bwith (?:his|her|their|the) (?:friends|band|crew|homies|mates)\\b|\\bduet\\b|\\bsing[- ]along\\b|\\baltogether\\b|\\btogether\\b/.test(t)) score -= 35; // collab rendition"
  );
  changes++;
}

// 4. When the album is known, prefer video titles that match the album name
//    (studio albums often carry it) and penalise titles that clearly do not.
//    This is already handled by the albumHit scoring above — no extra patch needed.

// 5. Bump version.
if (src.includes("const APP_VERSION = '60.3.0'")) {
  src = src.replace("const APP_VERSION = '60.3.0'", "const APP_VERSION = '60.3.5'");
  changes++;
}

// 6. Add changelog entry for 60.3.5.
if (!src.includes("version: '60.3.5'")) {
  const ANCHOR = "  const CHANGELOG = [\n";
  const ENTRY = [
    "  { version: '60.3.5', date: 'September 22, 2026 · 7:00 AM EDT', title: 'Studio version preference in downloader', items: [",
    "    'Live concert, acoustic, and collab renditions are now strongly demoted \\u2014 the studio recording always wins when titles match.',",
    "    'Titles with \"with friends\", \"duet\", or \"together\" are flagged as renditions and penalised heavily.',",
    "    'Official audio / single / studio tags get a much bigger score boost so the canonical recording ranks first.',",
    "  ]},\n"
  ].join('\n');
  if (src.includes(ANCHOR)) {
    src = src.replace(ANCHOR, ANCHOR + ENTRY);
    changes++;
  }
}

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`patch-studio-version: applied ${changes} patch(es)`);
} else {
  console.log('patch-studio-version: already applied');
}
