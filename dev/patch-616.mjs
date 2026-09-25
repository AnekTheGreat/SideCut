#!/usr/bin/env node
// SideCut v61.6 — the song lookup's "came back with nothing" path, and the
// freeze when saving a song from a video link.
//
// Three measured defects, plus the release metadata for 61.6.
//
//  1. The Innertube client list carried six clients, but only ANDROID (3) and
//     IOS (5) still hand back playable audio. Re-probed live against the
//     shipping request shape on Sep 25, 2026. Every other entry answers
//     LOGIN_REQUIRED / 404 / UNPLAYABLE, and each one costs a full
//     connect + read timeout per track when it is reached — a lookup that
//     appears to hang and then reports it found nothing.
//
//  2. `take()` kept exactly ONE stream per pool and returned. ANDROID alone
//     offers ~6 audio rows; the one that survived was the top-ranked row, which
//     is precisely the audio-only stream the service caps at its first megabyte
//     for a music upload — so the fetcher had one capped stream and at most one
//     progressive fallback to walk, and reported failure when both were refused.
//
//  3. Saving a song from a video link called the PLAIN encoder, whose whole
//     lamejs pass is one unbroken loop on the main thread. A three-minute track
//     is ~8M samples, so the app locked solid with nothing tappable until the
//     encode finished — the reported freeze. Every other conversion path
//     already used the cooperative encoder, which yields every
//     SC_ENCODE_SLICE_MS; this path was simply never switched over.
//
//  4. The New releases panel's "Mark all N as read" button sat UNDER every
//     release row, so on a phone it was off the bottom of the panel and the
//     whole list had to be scrolled past to reach it. It now lives at the top,
//     directly under the release count and its two tabs. Two places had to move:
//     the panel's own markup, and __scDiscRelTab — which re-appends the button
//     after the rows on every render, and would otherwise put it straight back.
//
//   node dev/patch-616.mjs               # code fixes + release metadata
//   node dev/patch-616.mjs --manifest     # re-seed root manifest.json from ota/updates.json
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

const VER = '61.6';
const PREV = '61.5';
const STAMP = 'September 25, 2026 · 2:27 PM EDT';

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
// 1. The player client list: keep what actually answers.
// ---------------------------------------------------------------------------
const OLD_CLIENTS = [
  "    var clients = [",
  "      { client: { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 }, num: 3, ua: UA_ANDROID },",
  "      { client: { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' }, num: 5, ua: UA_IOS },",
  "      { client: { clientName: 'ANDROID_VR', clientVersion: '1.60.19', androidSdkVersion: 32, deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12' }, num: 28, ua: UA_ANDROID },",
  "      { client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.20240812.00.00' }, num: 85, ua: UA_WEB, third: 'https://www.youtube.com/' },",
  "      { client: { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20250220.01.00' }, num: 56, ua: UA_WEB, third: 'https://www.youtube.com/' },",
  "      { client: { clientName: 'MWEB', clientVersion: '2.20250220.00.00' }, num: 2, ua: UA_ANDROID, third: 'https://www.youtube.com/' }",
  "    ];"
].join('\n');

const NEW_CLIENTS = [
  "    // Measured live against this exact request shape (Sep 25, 2026) — only",
  "    // these two clients still hand back playable audio:",
  "    //   ANDROID 3 -> OK, 29 adaptive formats + 1 muxed",
  "    //   IOS 5     -> OK, 16 adaptive formats",
  "    // and every other client this list used to carry is shut:",
  "    //   ANDROID_VR 28                     -> LOGIN_REQUIRED (bot check)",
  "    //   TVHTML5_SIMPLY_EMBEDDED_PLAYER 85 -> HTTP 404",
  "    //   WEB_EMBEDDED_PLAYER 56            -> ERROR (video unavailable)",
  "    //   MWEB 2                            -> UNPLAYABLE (needs a reload)",
  "    // as are IOS_MUSIC 26, ANDROID_MUSIC 21, ANDROID_CREATOR 14,",
  "    // IOS_CREATOR 15, WEB_CREATOR 62, TVHTML5 7, the ANDROID/IOS embedded",
  "    // players (404) and a plain WEB 1. A dead client is not a fallback: it is",
  "    // a full connect + read timeout per track on the way to the same nothing,",
  "    // which is what makes a working lookup look broken. Re-probe before",
  "    // adding one back.",
  "    var clients = [",
  "      { client: { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 }, num: 3, ua: UA_ANDROID },",
  "      { client: { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' }, num: 5, ua: UA_IOS }",
  "    ];"
].join('\n');

const OLD_TAKE = [
  "    var take = function(list, wantMuxed, into){",
  "      var rows = (list || []).slice();",
  "      // Best first: opus 251 > m4a 141 > m4a 140, else first audio.",
  "      rows.sort(function(x, y){ return rankOf(x.itag) - rankOf(y.itag); });",
  "      for(var k = 0; k < rows.length; k++){",
  "        var f = rows[k];",
  "        if(!f || !f.mimeType) continue;",
  "        var mt = String(f.mimeType);",
  "        var isAudio = mt.toLowerCase().indexOf('audio/') === 0;",
  "        if(wantMuxed ? isAudio : !isAudio) continue;",
  "        // A progressive row has to actually carry audio, or there is nothing",
  "        // to decode out of it.",
  "        if(wantMuxed && !/mp4a|opus|vorbis/i.test(mt)) continue;",
  "        var u = f.url || deco(f);",
  "        if(!u || seenUrls[u]) continue;",
  "        seenUrls[u] = true;",
  "        into.push({ url: u, mime: mt, itag: f.itag, size: Number(f.contentLength || f.clen) || 0, muxed: !!wantMuxed });",
  "        return true;",
  "      }",
  "      return false;",
  "    };"
].join('\n');

const NEW_TAKE = [
  "    var take = function(list, wantMuxed, into, want){",
  "      var rows = (list || []).slice();",
  "      // Best first: opus 251 > m4a 141 > m4a 140, else first audio.",
  "      rows.sort(function(x, y){ return rankOf(x.itag) - rankOf(y.itag); });",
  "      // Collect more than the single best row. One stream per client left the",
  "      // fetcher almost nothing to walk: the top-ranked member of a pool is the",
  "      // audio-only stream the service caps at its first megabyte for a music",
  "      // upload, so the only candidate was the one that cannot be fetched and",
  "      // there was no second choice behind it. Returns how many it took.",
  "      var got = 0;",
  "      var limit = (typeof want === 'number' && want > 0) ? want : 1;",
  "      for(var k = 0; k < rows.length && got < limit; k++){",
  "        var f = rows[k];",
  "        if(!f || !f.mimeType) continue;",
  "        var mt = String(f.mimeType);",
  "        var isAudio = mt.toLowerCase().indexOf('audio/') === 0;",
  "        if(wantMuxed ? isAudio : !isAudio) continue;",
  "        // A progressive row has to actually carry audio, or there is nothing",
  "        // to decode out of it.",
  "        if(wantMuxed && !/mp4a|opus|vorbis/i.test(mt)) continue;",
  "        var u = f.url || deco(f);",
  "        if(!u || seenUrls[u]) continue;",
  "        seenUrls[u] = true;",
  "        into.push({ url: u, mime: mt, itag: f.itag, size: Number(f.contentLength || f.clen) || 0, muxed: !!wantMuxed });",
  "        got++;",
  "      }",
  "      return got;",
  "    };"
].join('\n');

const OLD_CALLS = [
  "        take(d.streamingData.adaptiveFormats, false, audioStreams);",
  "        take(d.streamingData.formats, true, muxedStreams);"
].join('\n');

const NEW_CALLS = [
  "        // Audio-only first (small, decodes cleanly), the progressive muxed",
  "        // copy behind it for the music-upload cap — several of each, so the",
  "        // fetcher can walk past a cut-off or refused stream instead of",
  "        // running out of candidates.",
  "        take(d.streamingData.adaptiveFormats, false, audioStreams, 3);",
  "        take(d.streamingData.formats, true, muxedStreams, 2);"
].join('\n');

// ---------------------------------------------------------------------------
// 2. The video-link path must use the yielding encoder.
// ---------------------------------------------------------------------------
const OLD_ENCODE = [
  "      // scEncodeAudio returns a Blob for MP3/WAV and a promise for FLAC, so it is",
  "      // awaited here — a promise handed to URL.createObjectURL() is the kind of",
  "      // thing that fails silently.",
  "      var blob = null;",
  "      if(fmt === 'mp3' && typeof lamejs === 'undefined'){ await window.__scEnsureLamejs(); }",
  "      try{ blob = await scEncodeAudio(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null }); }"
].join('\n');

const NEW_ENCODE = [
  "      // The COOPERATIVE encoder, the same one every other conversion path uses.",
  "      // The plain scEncodeAudio runs the whole lamejs pass in one unbroken loop",
  "      // on the main thread, so a three-minute track (~8M samples) locked the",
  "      // app solid with nothing tappable until it finished — that was the freeze.",
  "      // This one yields every SC_ENCODE_SLICE_MS and reports its progress, and",
  "      // it returns a Promise for every format, so it is awaited here: a promise",
  "      // handed to URL.createObjectURL() fails silently.",
  "      var blob = null;",
  "      if(fmt === 'mp3' && typeof lamejs === 'undefined'){ await window.__scEnsureLamejs(); }",
  "      try{ blob = await scEncodeAudioCooperative(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null }, function(p){ if(p > 0 && p < 1) setStatus('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%'); }); }"
].join('\n');

if (!MANIFEST_ONLY) {
  sub('player clients — keep the two that answer', OLD_CLIENTS, NEW_CLIENTS, 1,
    '// Measured live against this exact request shape');
  sub('take() — collect several streams, not one', OLD_TAKE, NEW_TAKE, 1,
    'var take = function(list, wantMuxed, into, want){');
  sub('player — gather several streams per client', OLD_CALLS, NEW_CALLS, 1,
    'take(d.streamingData.adaptiveFormats, false, audioStreams, 3);');
  sub('video link — encode with the yielding encoder', OLD_ENCODE, NEW_ENCODE, 1,
    'blob = await scEncodeAudioCooperative(dec.buffer, fmt,');
}

// ---------------------------------------------------------------------------
// 3b. The mark-all button moves to the top of the New releases panel.
// ---------------------------------------------------------------------------
// Its own CSS: the button used to be the last thing in the panel and carried a
// top margin to separate it from the rows above. At the top of the panel the
// gap belongs below it instead.
const OLD_MARK_CSS = "  .hb-cta.hb-markread{ display:flex; align-items:center; justify-content:center; gap:8px; margin-top:16px; }";
const NEW_MARK_CSS = [
  "  /* Mark-all-as-read for New releases. It sits at the TOP of the panel, under",
  "     the release count — at the bottom it was under every row, so on a phone it",
  "     was off-screen until the whole list had been scrolled past. Its gap is",
  "     therefore below it, not above. */",
  "  .hb-cta.hb-markread{ display:flex; align-items:center; justify-content:center; gap:8px; margin:0 0 12px; }"
].join('\n');

// The panel's markup: the button is built in the middle of the innerHTML
// concatenation, after the rows. Drop it from there...
const OLD_MARK_BOTTOM = [
  "          }).join('') +",
  "          '<button class=\"hb-cta hb-markread\" id=\"hbCtaMarkSeen\"' + (unseenCount ? '' : ' disabled') + '>'",
  "            + '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z\"/></svg>'",
  "            + (unseenCount ? 'Mark all ' + unseenCount + ' as read' : 'All caught up')",
  "            + '</button>';"
].join('\n');
const NEW_MARK_BOTTOM = "          }).join('');";

// ...and put it directly under the release count, above the rows.
const OLD_MARK_COUNT = "        body.innerHTML = '<div id=\"hbRelCount\" style=\"font-size:12px; color:var(--ink-dim); margin-bottom:8px;\">' + all.length + ' recent release' + (all.length>1?'s':'') + (unseenCount ? ' \u00b7 ' + unseenCount + ' new' : '') + '</div>' +";
const NEW_MARK_COUNT = [
  "        // Mark-all is rendered with the count, ABOVE the rows: it acts on the",
  "        // whole list, and at the bottom of the panel it was unreachable without",
  "        // scrolling past every release first.",
  OLD_MARK_COUNT,
  "          '<button class=\"hb-cta hb-markread\" id=\"hbCtaMarkSeen\"' + (unseenCount ? '' : ' disabled') + '>'",
  "            + '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z\"/></svg>'",
  "            + (unseenCount ? 'Mark all ' + unseenCount + ' as read' : 'All caught up')",
  "            + '</button>' +"
].join('\n');

// And __scDiscRelTab, which re-appends the button after the rows on EVERY render
// (the panel calls it right after building its HTML), so it has to insert it at
// the top too — otherwise the button would snap back to the bottom on open.
const OLD_MARK_TAB = [
  "  // The Home bubble's Mark-all chip acts on the whole list, so it rides after",
  "  // the rows and only shows while the whole list is showing.",
  "  var mr = root.querySelector('#hbCtaMarkSeen');",
  "  if(mr){ root.appendChild(mr); mr.style.display = upcoming ? 'none' : ''; }"
].join('\n');
const NEW_MARK_TAB = [
  "  // The Home bubble's Mark-all button acts on the whole list, so it only shows",
  "  // while the whole list is showing — but it belongs at the TOP of the panel,",
  "  // right under the release count. It used to be appended after the rows, which",
  "  // left it under the entire list and off-screen on a phone until you scrolled",
  "  // past everything to reach it.",
  "  var mr = root.querySelector('#hbCtaMarkSeen');",
  "  if(mr){",
  "    var _markAfter = root.querySelector('#hbRelCount');",
  "    if(_markAfter && _markAfter.parentNode === root) root.insertBefore(mr, _markAfter.nextSibling);",
  "    else root.insertBefore(mr, root.firstChild);",
  "    mr.style.display = upcoming ? 'none' : '';",
  "  }"
].join('\n');

if (!MANIFEST_ONLY) {
  // Order matters: pull the button out of the trailing markup first, then add it
  // to the count line. (Both needles are unambiguous either way — the removal one
  // only matches the block preceded by `.join('') +` — but a rerun after a partial
  // run then always converges.)
  sub('mark-all — drop it from under the rows', OLD_MARK_BOTTOM, NEW_MARK_BOTTOM, 1,
    "          }).join('');\n        body.querySelectorAll('.hb-track-row')");
  sub('mark-all — add it under the release count', OLD_MARK_COUNT, NEW_MARK_COUNT, 1,
    '// Mark-all is rendered with the count, ABOVE the rows');
  sub('mark-all — the tab renderer inserts it at the top', OLD_MARK_TAB, NEW_MARK_TAB, 1,
    'var _markAfter = root.querySelector(\'#hbRelCount\');');
  sub('mark-all — its gap moves below it', OLD_MARK_CSS, NEW_MARK_CSS, 1,
    '.hb-cta.hb-markread{ display:flex; align-items:center; justify-content:center; gap:8px; margin:0 0 12px; }');
}

// ---------------------------------------------------------------------------
// 3. Release metadata: APP_VERSION + the 61.6 changelog head.
//
// NOTE on wording: the head entry's first six items become the OTA patch notes
// for BOTH channels, and dev/test-60510 + dev/test-6058 forbid a
// converter/downloader term there. Keep every note free of download*, convert*,
// "to mp3", "get song", "no source found" and "play build".
//
// The entry is CONTENT-COMPARED rather than insert-only: a release gets written
// more than once while it is being put together, and a later wording has to be
// able to replace an earlier one (patch-615 did the same for its entry).
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '61.5';", "  const APP_VERSION = '61.6';", 1,
    "const APP_VERSION = '61.6';");

  const ENTRY = [
    "  { version: '61.6', date: '" + STAMP + "', title: 'The song lookup stops waiting on dead sources, and saving a video no longer freezes the app', items: [",
    "    'The song lookup used to hang for a long while and then report that it came back with nothing: most of the sources it was willing to ask had already been retired, and each one cost a full connection wait before it was given up on. It asks only the two that still answer now, so a lookup settles in a couple of seconds.',",
    "    'A lookup that came back empty had nothing behind it: only one audio variant was being kept per source, and that variant is the one the service cuts off partway through a music upload, so there was no second option to try. Several variants are kept from each source now, so a cut-off or refused one is walked past instead of ending the whole attempt.',",
    "    'Saving a song off a video link froze the whole app: the audio was encoded the old way, a single unbroken pass over every sample on the thread that draws the screen, so a three-minute song locked the app solid until it finished and nothing could be tapped. Encoding now runs in slices with the thread handed back between them, so the app stays responsive and the status line shows how far along it is.',",
    "    'What counts as a match is unchanged: the credit and the title still have to agree before any audio is used, so keeping more variants widens what can be tried without loosening what is accepted.',",
    "    'When nothing works the app now says which part failed — a lookup that never got an answer reads differently from one that answered with nothing usable — so a retry is an informed choice instead of a guess.',",
    "    'The Mark all as read button in the New releases panel moved to the top of the panel, directly under the release count and its two tabs: it used to sit below every release row, so on a phone the whole list had to be scrolled past to reach it.',",
    "    'Nothing else moved — playback, playlists, lyrics, covers, the drop check and the exports behave exactly as they did.',",
    "  ] },"
  ].join('\n');

  const start = src.indexOf("  { version: '61.6',");
  if (start !== -1) {
    const end = src.indexOf('\n  ] },', start);
    if (end === -1) throw new Error('CHANGELOG: could not find the end of the 61.6 entry');
    const tail = '\n  ] },'.length;
    const cur = src.slice(start, end + tail);
    const norm = (s) => s.replace(/\s+/g, ' ');
    if (norm(cur) === norm(ENTRY)) skip('CHANGELOG 61.6 entry');
    else { src = src.slice(0, start) + ENTRY + src.slice(end + tail); done('CHANGELOG 61.6 entry rewritten'); }
  } else {
    sub('CHANGELOG head — 61.6 entry',
      "const CHANGELOG = [\n  { version: '" + PREV + "',",
      "const CHANGELOG = [\n" + ENTRY + "\n  { version: '" + PREV + "',", 1,
      "  { version: '61.6', date: '");
  }
}

if (!MANIFEST_ONLY) fs.writeFileSync(FILE, src);

// ---------------------------------------------------------------------------
// 4. sw.js cache name.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const SW = path.join(ROOT, 'sw.js');
  let sw = fs.readFileSync(SW, 'utf8');
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
// 5. Repin the repo-wide release assertions.
//
// `version: '61.5'` mentions are deliberately NOT touched: they name the
// historical changelog entry that the ordering assertions compare against.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const REPINS = [
    ["ver === '" + PREV + "'", "ver === '" + VER + "'"],
    ["const CACHE_NAME = 'sidecut-shell-v" + PREV + "';", "const CACHE_NAME = 'sidecut-shell-v" + VER + "';"],
    ["entries[0].version === '" + PREV + "', '" + PREV + " heads the changelog'",
     "entries[0].version === '" + VER + "', '" + VER + " heads the changelog'"],
    ["entries[0].date === 'September 25, 2026 · 5:00 AM EDT'", "entries[0].date === '" + STAMP + "'"],
    ["entries[0].date === 'September 25, 2026 · 2:23 PM EDT'", "entries[0].date === '" + STAMP + "'"]
  ];
  // test-6137/test-6138 pin the head entry with a REGEX literal, where the dot
  // is escaped (version: '61\\.5'). A plain string repin never sees that form.
  // The backslash is built from a char code so no layer in between can eat it.
  const BS = String.fromCharCode(92);
  REPINS.push(["version: '61" + BS + ".5'", "version: '61" + BS + ".6'"]);
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
      console.log('• ' + name + ' — ' + a.slice(0, 46));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-616: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel so
// the two never disagree about the version. Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-616 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
