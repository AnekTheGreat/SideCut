#!/usr/bin/env node
// dev/patch-lyrics-offset.mjs — permanent lyrics-sync fix (per-song offset
// nudge that applies to both line highlight and word-by-word) + correct the
// EDT timestamps on the last four changelog entries. Safe to re-run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

function must(needle) {
  if (!src.includes(needle)) {
    console.error('patch-lyrics-offset: anchor not found — ' + JSON.stringify(needle.slice(0, 80)));
    process.exit(1);
  }
}

// 1. Offset state variable next to the other lyrics flags.
must('  let lyricsAutoScroll = true;');
if (!src.includes('let lyricsSyncOffsetSec')) {
  src = src.replace(
    '  let lyricsAutoScroll = true;',
    '  let lyricsAutoScroll = true;\n' +
    '  // Per-song sync nudge (seconds). LRC timestamps from lyrics databases often\n' +
    '  // come from a different recording than the audio being played, which put the\n' +
    '  // highlight a couple of lines out. This corrects it once per song and sticks.\n' +
    '  let lyricsSyncOffsetSec = 0;'
  );
  changes++;
}

// 2. Offset nudge buttons in the lyrics toolbar, right after Auto-scroll.
must('          Auto-scroll: On\n        </button>');
if (!src.includes('id="lyricsSyncPlus"')) {
  src = src.replace(
    '          Auto-scroll: On\n        </button>',
    '          Auto-scroll: On\n        </button>\n' +
    '        <button id="lyricsSyncMinus" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0;">\u22120.5s</button>\n' +
    '        <button id="lyricsSyncReset" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0;"><span id="lyricsSyncVal">+0.0s</span></button>\n' +
    '        <button id="lyricsSyncPlus" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0;">+0.5s</button>'
  );
  changes++;
}

// 3. Load the saved offset when the lyrics loop starts (per track id).
must('    lyricsScrollInterval = setInterval(() => {');
if (!src.includes('lyricsSyncOff_')) {
  src = src.replace(
    '    lyricsScrollInterval = setInterval(() => {',
    '    // Load this song\u2019s saved sync nudge before the first poll.\n' +
    '    try{\n' +
    '      lyricsSyncOffsetSec = 0;\n' +
    '      var _sid = (queueIndex >= 0 && queueIndex < queue.length) ? String(queue[queueIndex]) : \'\';\n' +
    '      if(_sid){ Promise.resolve(dbGet(\'meta\', \'lyricsSyncOff_\' + _sid)).then(function(r){ if(r) lyricsSyncOffsetSec = Number(r.value) || 0; updateLyricsSyncLabel(); }).catch(function(){}); }\n' +
    '      updateLyricsSyncLabel();\n' +
    '    }catch(_eso){}\n' +
    '    lyricsScrollInterval = setInterval(() => {'
  );
  changes++;
}

// 4. Apply the offset in the highlight loop — one line fixes BOTH the line
//    highlight and the word-by-word pacing, because both compare currentTime
//    against the LRC timestamps.
must('      const LYRICS_LEAD_MS = 0.06;\n      const currentTime = audio.currentTime + LYRICS_LEAD_MS;');
if (!src.includes('lyricsSyncOffsetSec);')) {
  src = src.replace(
    '      const LYRICS_LEAD_MS = 0.06;\n      const currentTime = audio.currentTime + LYRICS_LEAD_MS;',
    '      const LYRICS_LEAD_MS = 0.06;\n' +
    '      // + the per-song nudge: shifts every comparison so a highlight that is\n' +
    '      // a couple of lines out lands back on the beat (both line + word modes).\n' +
    '      const currentTime = audio.currentTime + LYRICS_LEAD_MS + lyricsSyncOffsetSec;'
  );
  changes++;
}

// 5. Nudge buttons wiring, just before the Word-by-word toggle handler.
must('  // Lyrics controls - always keep interval running for highlight');
if (!src.includes('nudgeLyricsSync')) {
  src = src.replace(
    '  // Lyrics controls - always keep interval running for highlight',
    '  // Sync nudge: \u00b10.5s steps, clamped to \u00b115s, saved per song so the\n' +
    '  // correction is one tap per track and stays for every replay.\n' +
    '  function updateLyricsSyncLabel(){\n' +
    '    try{ var el = $(\'lyricsSyncVal\'); if(el) el.textContent = (lyricsSyncOffsetSec >= 0 ? \'+\' : \'\') + lyricsSyncOffsetSec.toFixed(1) + \'s\'; }catch(e){}\n' +
    '  }\n' +
    '  function nudgeLyricsSync(delta){\n' +
    '    lyricsSyncOffsetSec = Math.max(-15, Math.min(15, Math.round((lyricsSyncOffsetSec + delta) * 10) / 10));\n' +
    '    try{\n' +
    '      var tid = (queueIndex >= 0 && queueIndex < queue.length) ? String(queue[queueIndex]) : \'\';\n' +
    '      if(tid) dbPut(\'meta\', { key: \'lyricsSyncOff_\' + tid, value: lyricsSyncOffsetSec });\n' +
    '    }catch(e){}\n' +
    '    lastLyricsIdx = -1;          // force the next poll to re-pick the line\n' +
    '    lastLyricsScrollTarget = -1;\n' +
    '    updateLyricsSyncLabel();\n' +
    '    toast(\'Lyrics sync: \' + (lyricsSyncOffsetSec >= 0 ? \'+\' : \'\') + lyricsSyncOffsetSec.toFixed(1) + \'s\', 1500);\n' +
    '  }\n' +
    '  try{\n' +
    '    $(\'lyricsSyncMinus\').addEventListener(\'click\', function(){ nudgeLyricsSync(-0.5); });\n' +
    '    $(\'lyricsSyncPlus\').addEventListener(\'click\', function(){ nudgeLyricsSync(0.5); });\n' +
    '    $(\'lyricsSyncReset\').addEventListener(\'click\', function(){ nudgeLyricsSync(-lyricsSyncOffsetSec); });\n' +
    '  }catch(_synBtns){}\n' +
    '\n' +
    '  // Lyrics controls - always keep interval running for highlight'
  );
  changes++;
}

// 6. Correct the last four changelog timestamps. The commits landed the evening
//    of Sep 21 EDT (23:50\u201300:46 UTC = 7:50\u20138:46 PM EDT), not the morning of
//    Sep 22. (Comment: EDT is UTC\u22124 in September.)
const dateFixes = [
  ["date: 'September 22, 2026 \u00b7 8:00 AM EDT'", "date: 'September 21, 2026 \u00b7 8:45 PM EDT'"],  // 60.4.0
  ["date: 'September 22, 2026 \u00b7 7:30 AM EDT'", "date: 'September 21, 2026 \u00b7 8:35 PM EDT'"],  // 60.3.6
  ["date: 'September 22, 2026 \u00b7 7:00 AM EDT'", "date: 'September 21, 2026 \u00b7 8:25 PM EDT'"],  // 60.3.5
  ["date: 'September 22, 2026 \u00b7 6:00 AM EDT'", "date: 'September 21, 2026 \u00b7 8:00 PM EDT'"],  // 60.3.0
];
for (const [bad, good] of dateFixes) {
  if (src.includes(bad)) { src = src.replace(bad, good); changes++; }
}

// 7. Bump version.
if (src.includes("const APP_VERSION = '60.4.0'")) {
  src = src.replace("const APP_VERSION = '60.4.0'", "const APP_VERSION = '60.4.1'");
  changes++;
}

// 8. Changelog entry for 60.4.1.
if (!src.includes("version: '60.4.1'")) {
  const ANCHOR = '  const CHANGELOG = [\n';
  must(ANCHOR);
  const ENTRY = [
    "  { version: '60.4.1', date: 'September 21, 2026 \u00b7 9:00 PM EDT', title: 'Lyrics sync nudge \u2014 permanent fix for any song', items: [",
    "    'New \u00b10.5s sync buttons in the lyrics view shift BOTH the line highlight and word-by-word timing together \u2014 tap once or twice and the lyrics land on the beat for that song, saved per track so it sticks on every replay.',",
    "    'Corrected the patch-note timestamps on 60.3.0 through 60.4.0 \u2014 they were written in the wrong hours; the releases actually went out the evening of Sep 21 EDT.',",
    "  ]},\n"
  ].join('\n');
  src = src.replace(ANCHOR, ANCHOR + ENTRY);
  changes++;
}

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`patch-lyrics-offset: applied ${changes} change(s)`);
} else {
  console.log('patch-lyrics-offset: already applied');
}
