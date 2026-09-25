#!/usr/bin/env node
// SideCut v61.9 — the store build's Get Songs tab is steps only.
//
// The request, in the user's words: "Get songs tab should have no converters on
// play version and should simply have steps of how to get mp3's in your library".
//
// What a Play build was actually still showing in that tab:
//   * the "🎛️ Conversion Tools — Spotify · YouTube · MP4 · Expand URL" header,
//   * the Expand URL card,
//   * the MP4 to WAV / FLAC / MP3 card,
//   * the "Audio formats explained" guide,
// and only the two Spotify/YouTube cards were hidden. The tab's own copy also
// taught the converter ("Paste the link into the built-in Spotify to MP3…").
//
// The fix, both halves:
//   [1] the Get Songs how-to box in each tab (Get Songs in Settings, and the one
//       on Discover) becomes a real walkthrough — numbered steps for getting
//       MP3s you own into the library; and
//   [2] the whole tool section is put away. It is the element immediately AFTER
//       each how-to box in the markup, so it is hidden by position: no markup
//       was reshaped and no id invented, and hiding (rather than removing)
//       leaves every element the converter wiring below still looks up present,
//       so nothing downstream can turn into a null.
//
//   node dev/patch-619.mjs               # code fix + release metadata
//   node dev/patch-619.mjs --manifest     # re-seed root manifest.json from ota/updates.json
//
// Every index.html edit is count==1 asserted and idempotent, and the write
// happens once at the end, so a bad needle can never half-apply and a rerun is
// a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '61.9';
const PREV = '61.8';
const STAMP = 'September 25, 2026 · 6:05 PM EDT';
const PREV_STAMP = 'September 25, 2026 · 4:15 PM EDT';

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

// `marker` is a short, stable string that exists ONLY after the edit, so
// reworded prose (or an already-applied pass) can never make a rerun throw.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) {
    throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  }
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The Get Songs tab: steps, and the tool section put away.
// ---------------------------------------------------------------------------
const OLD_GET_SONGS = [
  "    ['getSongsHowToDisc','getSongsHowToSettings'].forEach(function(_id){",
  '      var _el = document.getElementById(_id);',
  "      if(_el) _el.innerHTML = '<b style=\"color:var(--coral);\">\ud83d\udcbd Get songs into your library</b><br>This build takes the files you already own: tap <b>+ Add songs \u2192 + Files</b> to import them.';",
  '    });'
].join('\n');

const NEW_GET_SONGS = [
  '    // ---- The Get Songs tab is a HOW-TO on this build ------------------------',
  '    // A build that takes only the files you already own has nothing to hand off',
  '    // to a converter, so that tab is a plain walkthrough instead, and the audio',
  '    // tools that used to sit under it — the link expander, the three cards and',
  '    // the format explainer — are put away with the section that holds them.',
  '    //',
  '    // That section is the element immediately AFTER each how-to box, so it is',
  '    // hidden by POSITION: no markup was reshaped and no new id invented. Hiding',
  '    // it (rather than removing it) also leaves every element the converter',
  '    // wiring further down still looks up in place, so nothing downstream has to',
  '    // become null-safe. The other build never enters this branch at all.',
  '    var _getSongsSteps =',
  "      '<b style=\"color:var(--coral);\">\ud83d\udcbf How to get MP3s into your library</b>'",
  '      + \'<div style="margin-top:4px;">SideCut plays the audio files saved on your device \u2014 it does not stream or fetch anything itself.</div>\'',
  '      + \'<div style="display:flex; flex-direction:column; gap:5px; margin-top:8px;">\'',
  '      + \'<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">1.</span><span>Put the songs on your phone \u2014 copy them from a computer over USB, from a cloud drive, or from an SD card. Any folder will do.</span></div>\'',
  '      + \'<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">2.</span><span>Tap <b style="color:var(--ink);">+ Add songs \u25be \u2192 + Files</b>, pick the songs and confirm to import them.</span></div>\'',
  '      + \'<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">3.</span><span>A whole album in one go: <b style="color:var(--ink);">+ Add songs \u25be \u2192 + Add folder</b>.</span></div>\'',
  '      + \'<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">4.</span><span>Each file keeps its own title, artist, album and cover art, and lands in <b style="color:var(--ink);">Playlists \u2192 All songs</b>.</span></div>\'',
  '      + \'<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">5.</span><span>Moving phones or restoring a backup: <b style="color:var(--ink);">Import library</b> brings back the whole .zip \u2014 playlists, albums and tags included.</span></div>\'',
  "      + '</div>';",
  "    ['getSongsHowToDisc','getSongsHowToSettings'].forEach(function(_id){",
  '      var _el = document.getElementById(_id);',
  '      if(!_el) return;',
  '      _el.innerHTML = _getSongsSteps;',
  '      // The tool section is this box\u2019s next element, in both tabs.',
  "      if(_el.nextElementSibling) _el.nextElementSibling.style.display = 'none';",
  '    });'
].join('\n');

if (!MANIFEST_ONLY) {
  sub('Get Songs — steps instead of a converter pointer, and the tool section put away',
    OLD_GET_SONGS, NEW_GET_SONGS, 1, 'var _getSongsSteps =');

  // The comment that sits above that code still described the old wording ("an
  // + Add songs note"). A comment that describes a build it no longer describes
  // is how the next reader gets misled, so it is brought in line here.
  sub('Get Songs — the block comment describes the walkthrough',
    '    // (and link outside converter sites) become an + Add songs note, and the',
    '    // (and link outside converter sites) become a plain import walkthrough, the\n' +
    '    // tool section beneath them is put away, and the',
    1, 'tool section beneath them is put away');
}

// ---------------------------------------------------------------------------
// 2. Release metadata: APP_VERSION + the 61.9 changelog head.
//
// NOTE on wording: the head entry's first six items become the OTA patch notes
// for BOTH channels, and dev/test-60510 + dev/test-6058 forbid a
// converter/downloader term there. Keep every note free of download*, convert*,
// "to mp3", "get song", "no source found" and "play build".
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '" + PREV + "';", "  const APP_VERSION = '" + VER + "';", 1,
    "const APP_VERSION = '" + VER + "';");

  const ENTRY = [
    "  { version: '" + VER + "', date: '" + STAMP + "', title: 'The store build\\'s Get Songs tab is steps only', items: [",
    "    'The Get Songs tab on the build that takes only your own files is a walkthrough now: five numbered steps covering putting your MP3s on the phone, pulling them in with + Add songs, adding a whole folder at once, and restoring a backup .zip.',",
    "    'The audio tool section that used to sit under that guide is put away on that build — the link expander, the three tool cards and the format explainer are all gone from the tab, so what is left is the steps.',",
    "    'Nothing was taken from the other build: it keeps the whole tool section, every card and the format explainer exactly as they were.',",
    "    'It is put away rather than deleted, which matters: the tool wiring further down the app still finds every element it looks up, so a screen that no longer shows a tool can never break the screen that does.',",
    "    'The guide still says plainly that the app plays the audio files already saved on your device, on both builds.',",
    "    'Nothing else moved — playback, playlists, lyrics, covers, the drop check, the exports and the search behave exactly as they did.',",
    '  ] },'
  ].join('\n');

  const start = src.indexOf("  { version: '" + VER + "',");
  if (start !== -1) {
    const end = src.indexOf('\n  ] },', start);
    if (end === -1) throw new Error('CHANGELOG: could not find the end of the ' + VER + ' entry');
    const tail = '\n  ] },'.length;
    const cur = src.slice(start, end + tail);
    const norm = (s) => s.replace(/\s+/g, ' ');
    if (norm(cur) === norm(ENTRY)) skip('CHANGELOG ' + VER + ' entry');
    else { src = src.slice(0, start) + ENTRY + src.slice(end + tail); done('CHANGELOG ' + VER + ' entry rewritten'); }
  } else {
    sub('CHANGELOG head — ' + VER + ' entry',
      "const CHANGELOG = [\n  { version: '" + PREV + "',",
      "const CHANGELOG = [\n" + ENTRY + "\n  { version: '" + PREV + "',", 1,
      "  { version: '" + VER + "', date: '");
  }
}

if (!MANIFEST_ONLY) fs.writeFileSync(FILE, src);

// ---------------------------------------------------------------------------
// 3. sw.js cache name.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + PREV + "';";
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + VER + "';";
  if (sw.includes(newSw)) console.log('= sw.js CACHE_NAME (already ' + VER + ')');
  else {
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> v' + VER);
  }
}

// ---------------------------------------------------------------------------
// 4. Repin the repo-wide release assertions.
//
// `version: '61.8'` mentions in the CHANGELOG are deliberately NOT touched: they
// name the historical entry the ordering assertions compare against.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const REPINS = [
    ["ver === '" + PREV + "'", "ver === '" + VER + "'"],
    ["const CACHE_NAME = 'sidecut-shell-v" + PREV + "';", "const CACHE_NAME = 'sidecut-shell-v" + VER + "';"],
    ["entries[0].version === '" + PREV + "', '" + PREV + " heads the changelog'",
     "entries[0].version === '" + VER + "', '" + VER + " heads the changelog'"],
    ["entries[0].date === '" + PREV_STAMP + "'", "entries[0].date === '" + STAMP + "'"]
  ];
  // test-6137/test-6138 pin the head entry with a REGEX literal, where the dot is
  // escaped (version: '61\\.8'). A plain string repin never sees that form.
  const BS = String.fromCharCode(92);
  REPINS.push(["version: '61" + BS + ".8'", "version: '61" + BS + ".9'"]);

  // test-618 pinned the HEAD entry's own wording ("no matching source"), which is
  // 61.8's prose and is about to be displaced by 61.9. The same repin 61.8 gave
  // to 61.7: read the release's OWN entry instead of the head.
  REPINS.push([
    "  ok(/no matching source/.test(headText), 'the notes name the failure the user saw');",
    [
      "  // 61.9 heads the changelog now, so the wording this release introduced is",
      "  // read from its own entry rather than from the head.",
      "  const rel618 = entries.find((e) => String(e.version) === '" + PREV + "');",
      "  ok(!!rel618, 'the " + PREV + " entry is still in the changelog');",
      "  ok(/no matching source/.test((rel618 ? rel618.items : []).join(' ')), 'the " + PREV + " notes name the failure the user saw');"
    ].join('\n')
  ]);

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (t.indexOf(a) === -1) continue;
      t = t.split(a).join(b);
      repinned++;
      console.log('• ' + name + ' — ' + a.split('\n')[0].slice(0, 46));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-619: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel so
// the two never disagree about the version. Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-619 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
