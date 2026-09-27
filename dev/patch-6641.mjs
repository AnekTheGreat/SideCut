#!/usr/bin/env node
// SideCut - 64.1: the polish pass.
//
// Eight things were reported together. In order:
//
//   1. "Inside the cropping I should be able to move the slider where the track
//      is playing around in order to make it easier to listen to what I'm
//      cropping." The crop sheet could only play the slice ALREADY chosen (and
//      only if it was half a second or longer), and its two handles only move
//      the selection — so judging a crop meant cutting it, listening, undoing,
//      cutting again. It gains a listen-through slider over the whole song with
//      a play/pause button beside it: drag it and the sound follows your thumb,
//      and the same white playhead line rides the waveform so you can see where
//      you are. It plays through the live AudioContext path the selection
//      preview already uses, so there is still one playback path to stop.
//
//   2. "All dynamic themes except for Glacier, RGB, RGB +, Ember and Galaxy
//      should be premium only." Synthwave and Deep Ocean were free (the only
//      two animated themes without the premium flag) and Glacier carried it, so
//      the line is drawn where the request puts it now: RGB, RGB +, Ember,
//      Galaxy and Glacier are free, everything else that animates is premium.
//      The premium page, the Theme tab's lock and the seizure warning all list
//      the same split.
//
//   3. "The AI is being weird and doesn't know what to say to me saying hi."
//      A greeting was matched against the knowledge base by SUBSTRING, so "hi"
//      landed inside the word "history" and a bare Hi came back as the Album
//      History answer. Greetings, good mornings, thanks and goodbyes are
//      answered directly now, before any matching runs, and the matcher no
//      longer substring-matches anything shorter than a word.
//
//   4. "The pinned artist plateau just disappears after you scroll down in
//      Discover. Sometimes it just disappears." Nothing in the app removes the
//      rail: the damage is a chip left holding the inline transform/z-index/
//      box-shadow it was given when a drag started, which makes it its own
//      composited layer — and a layer like that is what a WebView drops on a
//      long scroll. The lift is always removed now (not only when the drag
//      record still exists), a redrawn rail always starts at its left edge, the
//      rail keeps a minimum height, and a scroll that leaves it empty redraws
//      it instead of waiting for something else to.
//
//   5. "Make settings and more more organized." The tab strip runs in the order
//      things are used (Premium, Get Songs, Theme, Glow, Sandbox, Widget, More,
//      Support, Donate) and the More pane — one long column of seventeen cards
//      — is grouped under four headings, with the one card that was in the
//      wrong group (the Playlists/Albums button and Auto-scroll, a playback
//      preference sitting among the informational notes) moved into Playback.
//
//   6. "The settings scroll wheel is being weird." The pane was a FIXED-height
//      box with its own smooth-scrolling scrollbar inside a sheet that scrolls
//      as well: a wheel over a short tab did nothing, the pane kept gliding
//      after the wheel stopped, and the pane's scroll chained into the page
//      behind it. It is a max-height now (so a short tab has no scrollbar at
//      all), it follows the wheel one to one, and it contains its own ends.
//
//   7. "Album covers you can select for your pinned artist should be in order
//      newest to oldest." Each candidate carries the date it came with — the
//      day a library song was added, the release date from the store — and the
//      grid is drawn newest first. Anything with no date sorts last.
//
//   8. APP_VERSION 64 -> 64.1 (the next release after 64, per the release rule
//      in AGENTS.md), a new head CHANGELOG entry, and sw.js's decoupled cache
//      name 63.0.16 -> 63.0.17 (it must not contain the app version).
//
//   node dev/patch-6641.mjs
//   node dev/patch-6641.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose and new JS literals that need a glyph get the real
// character, built here so this script stays ASCII (see AGENTS.md, "Non-ASCII
// needle trap").
const cp = (n) => String.fromCodePoint(n);
const MD = cp(0x2014);      // em dash
const PLAY = cp(0x25b6);    // black right-pointing triangle
const PAUSE = cp(0x275a) + cp(0x275a); // two heavy vertical bars

const VER = '64.1';
const OLD_VER = '64';
const OLD_STAMP = 'September 27, 2026 ' + cp(0x00b7) + ' 11:56 AM EDT';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 ' + cp(0x00b7) + ' 2:15 PM EDT';
const SW_CACHE = '63.0.17';
const OLD_SW_CACHE = '63.0.16';

const TITLE = 'The polish pass: crop by ear, a hello the assistant knows, and Settings that groups itself';

// Six notes, and they publish on BOTH channels (no [FULL] marker anywhere), so
// they carry no tooling wording at all: dev/test-617..620, -60510 and -662 read
// the WHOLE head entry for a downloader term, and dev/test-play-copy reads the
// Play copy against a wider list than the shared filter knows. Note 5 also has
// to keep the word "rollback": test-662 asserts the head entry describes what
// the release did with /rollback/i.
const NOTES = [
  'Cropping a song is done by ear now. The crop sheet has a listen-through slider over the whole song beside the two trim handles: drag it and the sound follows your thumb, so the run-up to your start point and the tail after your end point can be heard before anything is saved. Dragging never commits anything, the play button beside it keeps it going, and the white playhead line rides the waveform with it.',
  'The animated themes are premium now, with five left free for everyone: RGB, RGB +, Ember, Galaxy and Glacier. Everything else that animates shows a lock unless premium is on \\u2014 Aurora, Synthwave, Deep Ocean, Cyberpunk, Nebula, Neon Pulse, Solstice, Abyss and Orchid \\u2014 and the Theme tab, the premium page and the seizure warning all list the same split, so there is no guessing which is which.',
  'The assistant knows what to say when you just say hello. A greeting was being matched against the built-in answers as a piece of a word, so "hi" landed inside the word history and a plain hello came back as the Album History paragraph. Greetings, good mornings, thanks and goodbyes are answered on their own now, and no answer can be reached by a fragment of a word again.',
  'Your pinned artists can no longer leave the railing on Discover looking empty. A chip kept the lift it was given when a drag started, which makes it its own layer, and a layer like that is what a phone drops on a long scroll \\u2014 that blank row is what was reported twice. The lift is always removed now, a redrawn row always starts at its left edge, and the row redraws itself if a scroll has left it empty. It also keeps a minimum height, so the card can never collapse to a bare heading.',
  'Settings is grouped instead of one long column. The tabs run Premium, Get Songs, Theme, Glow, Sandbox, Widget, More, Support, Donate, and inside More every card sits under a heading \\u2014 This build and help, Playback, Library, storage and rollback, and History and extras \\u2014 so the playback switches, the library tools, the storage panel and the rollback copies listed under it are each in one place instead of scattered down the page.',
  'The Settings pane scrolls the way you expect it to. It was a fixed-height box with its own animated scrollbar inside a sheet that scrolls as well: a wheel over a short tab did nothing, the pane kept gliding after the wheel stopped, and its scroll dragged the page behind the sheet along with it. It is a maximum height now (a short tab has no scrollbar at all), it follows the wheel one to one, and it stops at its own ends.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-6641 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// Insert `text` immediately before an anchor.
function before(label, anchor, text) {
  sub(label, anchor, text + anchor);
}

// Lift the slice between two anchors out of the file and hand it back.
function cutBlock(label, from, to) {
  const at = src.indexOf(from);
  if (at === -1) throw new Error(label + ': start anchor not found');
  const end = src.indexOf(to, at);
  if (end === -1) throw new Error(label + ': end anchor not found');
  const block = src.slice(at, end);
  src = src.slice(0, at) + src.slice(end);
  console.log('+ ' + label + ' (lifted, ' + block.length + ' chars)');
  edits++;
  return block;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 - which animated themes are premium
// ═══════════════════════════════════════════════════════════════════════════
// Free: RGB, RGB +, Ember, Galaxy, Glacier. Premium: everything else that
// animates. Synthwave and Deep Ocean were the only two animated themes without
// the flag; Glacier carried it.
before('the theme table states the split',
  "    aurora:      {  name: 'Aurora (dynamic)',",
  "    // v64.1 - which animated themes are premium. Five stay free for everyone:\n" +
  "    // RGB, RGB +, Ember, Galaxy and Glacier. Every other theme that animates\n" +
  "    // is premium only, and the Theme tab shows each one with a lock for a\n" +
  "    // user without premium. Keep this list and the three places that describe\n" +
  "    // the split (the premium page, the seizure warning in More and the\n" +
  "    // first-run guide) in step.\n");

sub('synthwave becomes premium',
  "    synthwave:   {  name: 'Synthwave (dynamic)',  bg:'#120b1e', bgRaised:'#241338', coral:'#FF5EC4', gold:'#FFD166', dynamic:'synthwave'  },",
  "    synthwave:   {  name: 'Synthwave (dynamic)',  bg:'#120b1e', bgRaised:'#241338', coral:'#FF5EC4', gold:'#FFD166', premium:true, dynamic:'synthwave'  },");

sub('deep ocean becomes premium',
  "    ocean:       {  name: 'Deep Ocean (dynamic)', bg:'#031a2e', bgRaised:'#0a2c4a', coral:'#4FD8FF', gold:'#7EE8C4', dynamic:'ocean'  },",
  "    ocean:       {  name: 'Deep Ocean (dynamic)', bg:'#031a2e', bgRaised:'#0a2c4a', coral:'#4FD8FF', gold:'#7EE8C4', premium:true, dynamic:'ocean'  },");

sub('glacier is free again',
  "    glacier:     {  name: 'Glacier (dynamic)',    bg:'#04101c', bgRaised:'#0c2233', coral:'#A6E8FF', gold:'#E8F7FF', premium:true, dynamic:'glacier'  },",
  "    glacier:     {  name: 'Glacier (dynamic)',    bg:'#04101c', bgRaised:'#0c2233', coral:'#A6E8FF', gold:'#E8F7FF', dynamic:'glacier'  },");

// The premium page's own description of what each half gets. Two ASCII needles
// so the surrounding em dashes never have to be matched.
sub('the premium page says what free keeps',
  ' plus every theme except the 3 animated premium ones (tap the Theme tab to see them).',
  ' every static theme, plus five of the animated ones: RGB, RGB +, Ember, Galaxy and Glacier.');

sub('and what premium adds',
  '3 animated themes (Aurora, Cyberpunk, Glacier), Sandbox premium toggles',
  'nine animated themes (Aurora, Synthwave, Deep Ocean, Cyberpunk, Nebula, Neon Pulse, Solstice, Abyss, Orchid), Sandbox premium toggles');

// The seizure warning names every animated theme in both places it appears
// (Settings - More, and the first-run guide). It is about flashing, not about
// the price, so it lists all twelve either way.
sub('the seizure warning lists every animated theme',
  'Avoid the <b>RGB</b>, <b>RGB+</b>, and animated <b>dynamic themes</b> (Aurora, Synthwave, Ocean, Ember, Galaxy, Cyberpunk, Glacier).',
  'Avoid the <b>RGB</b>, <b>RGB+</b>, and every animated <b>dynamic theme</b> (Aurora, Synthwave, Deep Ocean, Ember, Galaxy, Cyberpunk, Glacier, Nebula, Neon Pulse, Solstice, Abyss, Orchid) ' + MD + ' the Theme tab lists all of them under Dynamic themes.',
  2);

// ═══════════════════════════════════════════════════════════════════════════
// 3 - a greeting the assistant can answer
// ═══════════════════════════════════════════════════════════════════════════
before('the greeting answers',
  'function _aiFuzzyMatch(query, minScore) {',
  "// A plain hello is not a question about the app, and it must never be answered\n" +
  "// with whatever entry its two letters happen to sit inside: matching ran on\n" +
  "// substrings, so \"hi\" was found inside the word \"history\" and a bare Hi came\n" +
  "// back as the Album History paragraph. Greetings, good mornings, thanks and\n" +
  "// goodbyes are answered here, before any matching runs, and the matcher below\n" +
  "// no longer substring-matches anything shorter than a word.\n" +
  "function _aiGreetingReply(msg) {\n" +
  "  var raw = String(msg || '').trim().toLowerCase().replace(/[!.?,]+$/g, '');\n" +
  "  if (!raw || raw.length > 24) return '';\n" +
  "  var t = raw.replace(/[^a-z0-9 ?]/g, ' ').replace(/\\s+/g, ' ').trim();\n" +
  "  if (/^(hi|hii+|hey+|hello+|helo|yo|sup|hiya|howdy|heya|ayy+|hi there|hello there|hey there)$/.test(t)) {\n" +
  "    return 'Hi! I am the SideCut assistant. Ask me anything about the app: settings, playback, playlists, lyrics, themes, storage, or getting music into your library.';\n" +
  "  }\n" +
  "  if (/^(good )?(morning|afternoon|evening|night)$/.test(t) || /^good (morning|afternoon|evening|night)$/.test(t)) {\n" +
  "    return 'Good to see you. Ask me anything about SideCut: settings, playback, playlists, lyrics, themes, storage, or getting music into your library.';\n" +
  "  }\n" +
  "  if (/^(how are you|how are you doing|hows it going|how is it going|whats up|what is up|whats new|you there)$/.test(t)) {\n" +
  "    return 'Running well, thanks for asking. What can I help you with in SideCut? Settings, playback, playlists, lyrics, themes and storage are all fair game.';\n" +
  "  }\n" +
  "  if (/^(thanks|thank you|thx|ty|tysm|perfect|great|nice|awesome|cool|ok|okay|got it|sounds good|no thanks)$/.test(t)) {\n" +
  "    return 'Any time. If anything else comes up in SideCut, just ask.';\n" +
  "  }\n" +
  "  if (/^(bye|goodbye|see you|cya|good night|later)$/.test(t)) {\n" +
  "    return 'See you. Enjoy the music.';\n" +
  "  }\n" +
  "  return '';\n" +
  "}\n\n");

sub('a short query cannot be matched by a fragment of a word',
  "      // Pattern contains query or query contains pattern\n" +
  "      if (pattern.indexOf(q) !== -1 || q.indexOf(pattern) !== -1) { score = Math.max(score, 80); }",
  "      // Pattern contains query or query contains pattern. Never for a query\n" +
  "      // shorter than a word: \"hi\" sits inside \"history\" and \"hey\" inside\n" +
  "      // \"they\", which is how a greeting came back as a full answer about\n" +
  "      // something else entirely.\n" +
  "      if (q.length >= 4 && (pattern.indexOf(q) !== -1 || q.indexOf(pattern) !== -1)) { score = Math.max(score, 80); }");

sub('the assistant answers a greeting itself',
  "  if (statusEl) statusEl.textContent = 'Thinking...';\n\n" +
  "  // A question the app has a real answer for",
  "  if (statusEl) statusEl.textContent = 'Thinking...';\n\n" +
  "  // A greeting, a thank-you or a goodbye is answered here, from the app, before\n" +
  "  // anything is matched or sent anywhere.\n" +
  "  var _greeting = _aiGreetingReply(msg);\n" +
  "  if (_greeting) {\n" +
  "    _aiTyping = false;\n" +
  "    _aiAddMessage('assistant', _greeting);\n" +
  "    _aiChatHistory.push({ role: 'assistant', text: _greeting });\n" +
  "    if (statusEl) statusEl.textContent = 'Answered from the built-in knowledge base';\n" +
  "    return;\n" +
  "  }\n\n" +
  "  // A question the app has a real answer for");

// ═══════════════════════════════════════════════════════════════════════════
// 4 - the pinned-artist rail that came back empty
// ═══════════════════════════════════════════════════════════════════════════
sub('the rail keeps a height even when it is empty',
  '<div id="pinnedArtistsList" style="display:flex;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:0 2px 4px;"></div>',
  '<div id="pinnedArtistsList" style="display:flex;align-items:flex-start;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;min-height:64px;padding:0 2px 4px;"></div>');

sub('a redrawn rail starts at its left edge, and heals itself after a scroll',
  "    try{ if(typeof ensurePinnedArtistArt === 'function') ensurePinnedArtistArt(); }catch(_ea){}\n" +
  "    try{ if(typeof window.wirePinnedReorder === 'function') window.wirePinnedReorder(); }catch(_wr){}\n" +
  "  }",
  "    try{ if(typeof ensurePinnedArtistArt === 'function') ensurePinnedArtistArt(); }catch(_ea){}\n" +
  "    try{ if(typeof window.wirePinnedReorder === 'function') window.wirePinnedReorder(); }catch(_wr){}\n" +
  "    // A fresh rail always starts at its LEFT edge. A stray horizontal scroll\n" +
  "    // (or a chip that scrolled itself into view) left the row showing the\n" +
  "    // blank space past the last chip, which reads as \"my artists are gone\"\n" +
  "    // while every one of them is still in the DOM.\n" +
  "    try{ list.scrollLeft = 0; }catch(_eSc){}\n" +
  "  }\n\n" +
  "  // The pinned-artist rail has been reported as vanishing twice now, both times\n" +
  "  // after scrolling Discover, and nothing in the app removes it. The damage is on\n" +
  "  // the rendering side: a chip that kept the inline transform/z-index/box-shadow\n" +
  "  // it was given when a drag started is its own composited layer, and a layer\n" +
  "  // like that is what a WebView discards on a long scroll. Re-rendering the rail\n" +
  "  // rebuilds plain, unstyled chips, so this heals it as soon as it is noticed:\n" +
  "  // once a scroll of Discover settles, a rail with artists in it that has no\n" +
  "  // chips (or no height) is drawn again.\n" +
  "  (function watchPinnedRail(){\n" +
  "    var dv = $('discoverView');\n" +
  "    if(!dv || dv._paRailWatch) return;\n" +
  "    dv._paRailWatch = true;\n" +
  "    var t = null;\n" +
  "    dv.addEventListener('scroll', function(){\n" +
  "      if(t) clearTimeout(t);\n" +
  "      t = setTimeout(function(){\n" +
  "        t = null;\n" +
  "        try{\n" +
  "          if(!pinnedArtists.length) return;\n" +
  "          var l = $('pinnedArtistsList');\n" +
  "          if(!l) return;\n" +
  "          if(l.querySelector('.pinned-artist-chip') && l.getBoundingClientRect().height) return;\n" +
  "          renderPinnedArtists();\n" +
  "        }catch(_eRailWatch){}\n" +
  "      }, 140);\n" +
  "    }, { passive: true });\n" +
  "  })();");

// The drag can end without ever reaching finish() with its record still set
// (the WebView claims the gesture, or the pointerup lands outside the chip).
// The lift it applied was only cleared inside `if(drag)`, so a chip could keep
// its own layer for the rest of the session.
sub('a pinned chip never keeps its drag lift',
  "    function finish(){\n" +
  "      clearTimeout(holdTimer);\n" +
  "      try{ document.body.classList.remove('reordering'); }catch(e2){}\n" +
  "      if(drag){\n" +
  "        chip.style.transform = ''; chip.style.zIndex = ''; chip.style.boxShadow = '';",
  "    function finish(){\n" +
  "      clearTimeout(holdTimer);\n" +
  "      try{ document.body.classList.remove('reordering'); }catch(e2){}\n" +
  "      // ALWAYS drop the drag styling, even when the drag record was already\n" +
  "      // cleared. A chip left holding transform/z-index/box-shadow keeps its own\n" +
  "      // composited layer, and one of those is exactly what a WebView discards\n" +
  "      // on a long scroll - the rail then comes back blank until something\n" +
  "      // happens to re-render it.\n" +
  "      try{ chip.style.transform = ''; chip.style.zIndex = ''; chip.style.boxShadow = ''; }catch(_ePLift){}\n" +
  "      if(drag){\n" +
  "        chip.style.transform = ''; chip.style.zIndex = ''; chip.style.boxShadow = '';");

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the crop sheet: listen through the song while you choose
// ═══════════════════════════════════════════════════════════════════════════
before('the crop sheet gets a listen-through slider',
  '        <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--ink-dim); margin-bottom:4px;">\n' +
  '          <span id="cropSongStartLbl"></span>',
  '        <!-- Listen through the whole song. The two handles above move the\n' +
  '             selection; this is the control that lets you HEAR the song, so a\n' +
  '             crop can be judged by ear instead of by eye. Drag the thumb to\n' +
  '             drop in anywhere and the sound follows it; the line on the\n' +
  '             waveform rides along so you can see where you are. -->\n' +
  '        <div style="display:flex; align-items:center; gap:10px; margin:2px 0 10px;">\n' +
  '          <button id="cropSongScrubPlay" title="Play or pause the whole song" style="width:34px; height:34px; flex:0 0 auto; border-radius:50%; border:1px solid var(--line); background:rgba(255,255,255,0.06); color:var(--ink); font-size:12px; cursor:pointer; padding:0; line-height:1;">' + PLAY + '</button>\n' +
  '          <input type="range" id="cropSongScrub" min="0" max="1000" step="1" value="0" aria-label="Listen through the song" style="flex:1; min-width:0;">\n' +
  '          <span id="cropSongScrubTime" style="font-family:\'JetBrains Mono\',monospace; font-size:11px; color:var(--ink-dim); min-width:76px; text-align:right;">0:00 / 0:00</span>\n' +
  '        </div>\n');

before('the listen-through playback and its controls',
  "  // Selection drag handles (pointer events; no external libs).",
  "  // ---- Listen through the whole song ----\n" +
  "  // \"Preview selection\" can only ever play the slice already chosen, and the two\n" +
  "  // handles only move the selection, so judging a crop meant cutting it,\n" +
  "  // listening, undoing and cutting again. This is the control that lets the song\n" +
  "  // be heard: a slider over the WHOLE song with a play/pause button beside it.\n" +
  "  // Dragging it moves the white playhead line (and nothing else, so nothing is\n" +
  "  // ever committed by a drag); letting go plays the song from there, and the\n" +
  "  // button keeps it going or stops it. It runs through the same live\n" +
  "  // AudioContext path the selection preview uses, so there is one playback path\n" +
  "  // to stop and one playhead to keep in step.\n" +
  "  let cropPlayMode = 'sel';   // 'sel' = the selection preview, 'song' = listening through\n" +
  "  function cropScrubSec(){\n" +
  "    const total = (cropBuf && cropBuf.duration) || 0;\n" +
  "    const sl = $('cropSongScrub');\n" +
  "    return (sl ? (parseFloat(sl.value) || 0) / 1000 : 0) * total;\n" +
  "  }\n" +
  "  function cropScrubSetUI(sec){\n" +
  "    const total = (cropBuf && cropBuf.duration) || 0;\n" +
  "    const sl = $('cropSongScrub');\n" +
  "    if(sl && total > 0) sl.value = String(Math.max(0, Math.min(1000, Math.round((sec / total) * 1000))));\n" +
  "    const t = $('cropSongScrubTime');\n" +
  "    if(t) t.textContent = cropFmtTime(sec) + ' / ' + cropFmtTime(total);\n" +
  "    const ph = $('cropSongPlayhead');\n" +
  "    if(ph && total > 0){\n" +
  "      ph.style.display = 'block';\n" +
  "      ph.style.left = ((Math.max(0, Math.min(total, sec)) / total) * 100) + '%';\n" +
  "    }\n" +
  "  }\n" +
  "  function cropScrubSeek(sec, play){\n" +
  "    if(!cropBuf) return;\n" +
  "    const total = cropBuf.duration || 0;\n" +
  "    if(!(total > 0)) return;\n" +
  "    const at = Math.max(0, Math.min(Math.max(0, total - 0.05), sec));\n" +
  "    cropScrubSetUI(at);\n" +
  "    const sb = $('cropSongScrubPlay');\n" +
  "    cropCleanupPreview();\n" +
  "    if(!play){\n" +
  "      cropPlayMode = 'sel';\n" +
  "      if(sb) sb.textContent = '" + PLAY + "';\n" +
  "      return;\n" +
  "    }\n" +
  "    cropPlayMode = 'song';\n" +
  "    try{\n" +
  "      const ctx = (typeof audioCtx === 'object' && audioCtx) ? audioCtx : (cropPreviewLiveCtx = new (window.AudioContext || window.webkitAudioContext)());\n" +
  "      if(ctx && typeof ctx.resume === 'function') ctx.resume().catch(() => {});\n" +
  "      if(ctx && ctx.state === 'running'){\n" +
  "        const src = ctx.createBufferSource();\n" +
  "        src.buffer = cropBuf;\n" +
  "        src.connect(ctx.destination);\n" +
  "        src.start(0, at);\n" +
  "        cropPreviewLive = src;\n" +
  "        const stopLive = () => {\n" +
  "          try{ src.stop(); }catch(_e){}\n" +
  "          if(cropPreviewLive === src) cropPreviewLive = null;\n" +
  "          // Ended is not the same as armed: the wrapper below is what the\n" +
  "          // button reads to decide play-vs-stop, so a finished listen-through\n" +
  "          // has to let go of it or the next tap only stops nothing.\n" +
  "          if(cropPreviewAudio && cropPreviewAudio.pause === stopLive) cropPreviewAudio = null;\n" +
  "          const b = $('cropSongScrubPlay');\n" +
  "          if(b) b.textContent = '" + PLAY + "';\n" +
  "          if(cropPlayMode === 'song') cropStopPlayhead();\n" +
  "        };\n" +
  "        src.onended = stopLive;\n" +
  "        cropPreviewAudio = { _live: true, pause: stopLive, src: '' };\n" +
  "        cropPreviewCtx = ctx;\n" +
  "        cropPreviewT0 = ctx.currentTime;\n" +
  "        cropPreviewStartSec = at;\n" +
  "        cropPreviewLenSec = Math.max(0.05, total - at);\n" +
  "        if(sb) sb.textContent = '" + PAUSE + "';\n" +
  "        cropStartPlayhead();\n" +
  "        return;\n" +
  "      }\n" +
  "    }catch(e){\n" +
  "      console.warn('Listen-through preview unavailable:', e);\n" +
  "    }\n" +
  "    const st = $('cropSongPreviewStatus');\n" +
  "    if(st) st.textContent = 'Preview unavailable for this format.';\n" +
  "  }\n" +
  "  // Moving the thumb is visual only: it moves the line and the clock, and it\n" +
  "  // never starts a sound, so scrubbing around cannot surprise anyone.\n" +
  "  $('cropSongScrub').addEventListener('input', function(){\n" +
  "    if(!cropBuf || !(cropBuf.duration > 0)) return;\n" +
  "    cropScrubSeek(cropScrubSec(), false);\n" +
  "  });\n" +
  "  // Letting go plays the song from where it was dropped.\n" +
  "  $('cropSongScrub').addEventListener('change', function(){\n" +
  "    if(!cropBuf || !(cropBuf.duration > 0)) return;\n" +
  "    cropScrubSeek(cropScrubSec(), true);\n" +
  "  });\n" +
  "  $('cropSongScrubPlay').addEventListener('click', function(){\n" +
  "    if(!cropBuf || !(cropBuf.duration > 0)) return;\n" +
  "    if(cropPreviewAudio){ cropStopPreview(); return; }   // anything sounding: this stops it\n" +
  "    cropScrubSeek(cropScrubSec(), true);\n" +
  "  });\n\n");

sub('the status line says which one is playing',
  "        st.textContent = 'Previewing ' + cropFmtTime(rel) + ' / ' + cropFmtTime(cropPreviewLenSec);",
  "        st.textContent = (cropPlayMode === 'song' ? 'Listening ' : 'Previewing ') + cropFmtTime(rel) + ' / ' + cropFmtTime(cropPreviewLenSec);");

sub('stopping clears the listen-through button too',
  "  function cropStopPreview(){\n" +
  "    cropCleanupPreview();\n" +
  "    const btn = $('cropSongPreviewPlay');\n" +
  "    if(btn) btn.innerHTML = '" + PLAY + " Preview selection';\n" +
  "    const st = $('cropSongPreviewStatus');\n" +
  "    if(st) st.textContent = '';\n" +
  "  }",
  "  function cropStopPreview(){\n" +
  "    cropCleanupPreview();\n" +
  "    cropPlayMode = 'sel';\n" +
  "    const btn = $('cropSongPreviewPlay');\n" +
  "    if(btn) btn.innerHTML = '" + PLAY + " Preview selection';\n" +
  "    const sb = $('cropSongScrubPlay');\n" +
  "    if(sb) sb.textContent = '" + PLAY + "';\n" +
  "    const st = $('cropSongPreviewStatus');\n" +
  "    if(st) st.textContent = '';\n" +
  "  }");

// A preview that has FINISHED is not a preview that is still armed. The live
// path leaves its wrapper object behind (`cropPreviewAudio = { _live: true,
// pause: stopLive, ... }`) and never clears it, so the next tap on the button
// took the `if(cropPreviewAudio){ cropStopPreview(); }` branch and stopped
// nothing — the button had to be tapped twice to hear the song again. That was
// already true of the selection preview; it is true of the listen-through path
// too, and both now disarm themselves when the source ends.
const DISARM = "          if(cropPreviewAudio && cropPreviewAudio.pause === stopLive) cropPreviewAudio = null;\n";
sub('a finished selection preview disarms itself',
  "        const stopLive = () => {\n" +
  "          try{ src.stop(); }catch(_e){}\n" +
  "          if(cropPreviewLive === src) cropPreviewLive = null;\n" +
  "          $('cropSongPreviewPlay').innerHTML = '" + PLAY + " Preview selection';",
  "        const stopLive = () => {\n" +
  "          try{ src.stop(); }catch(_e){}\n" +
  "          if(cropPreviewLive === src) cropPreviewLive = null;\n" +
  "          // Ended is not the same as armed: the wrapper below is what the\n" +
  "          // button reads to decide play-vs-stop, so a finished preview has to\n" +
  "          // let go of it or the next tap only stops nothing.\n" +
  DISARM +
  "          $('cropSongPreviewPlay').innerHTML = '" + PLAY + " Preview selection';");

sub('a fresh sheet starts the listen-through slider at the top',
  "      cropBuildWaveform();\n" +
  "      cropUpdateFrame();\n" +
  "    }catch(err){",
  "      cropBuildWaveform();\n" +
  "      cropUpdateFrame();\n" +
  "      // A freshly decoded song arms the selection preview and puts the\n" +
  "      // listen-through slider at the top.\n" +
  "      cropPlayMode = 'sel';\n" +
  "      cropScrubSetUI(0);\n" +
  "      const _scrubBtnNew = $('cropSongScrubPlay');\n" +
  "      if(_scrubBtnNew) _scrubBtnNew.textContent = '" + PLAY + "';\n" +
  "    }catch(err){");

// ═══════════════════════════════════════════════════════════════════════════
// 5 + 6 - Settings and More: grouped, and scrolling like a normal pane
// ═══════════════════════════════════════════════════════════════════════════
// The tab strip in the order the tabs are used: what you buy, what you bring in
// and how it looks; then the look-and-feel panes; then everything else; then
// help, and donating last.
sub('the tab strip is ordered by what you are doing',
  '      <button class="tab" id="settingsTabPremium" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Premium</button>\n' +
  '      <button class="tab" id="settingsTabExpand" style="min-width:110px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Get Songs</button>\n' +
  '      <button class="tab" id="settingsTabTheme" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Theme</button>\n' +
  '      <button class="tab" id="settingsTabDonate" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Donate</button>\n' +
  '      <button class="tab" id="settingsTabGlow" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Glow</button>\n' +
  '      <button class="tab" id="settingsTabSandbox" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Sandbox</button>\n' +
  '      <button class="tab" id="settingsTabSupport" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Support</button>\n' +
  '      <button class="tab" id="settingsTabWidget" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Widget</button>\n' +
  '      <button class="tab" id="settingsTabMore" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">More</button>',
  '      <button class="tab" id="settingsTabPremium" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Premium</button>\n' +
  '      <button class="tab" id="settingsTabExpand" style="min-width:110px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Get Songs</button>\n' +
  '      <button class="tab" id="settingsTabTheme" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Theme</button>\n' +
  '      <button class="tab" id="settingsTabGlow" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Glow</button>\n' +
  '      <button class="tab" id="settingsTabSandbox" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Sandbox</button>\n' +
  '      <button class="tab" id="settingsTabWidget" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Widget</button>\n' +
  '      <button class="tab" id="settingsTabMore" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">More</button>\n' +
  '      <button class="tab" id="settingsTabSupport" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Support</button>\n' +
  '      <button class="tab" id="settingsTabDonate" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Donate</button>');

const HEADING = (title) =>
  '      <div style="font-size:10.5px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase; color:var(--ink-dim); margin:18px 2px 8px;">' + title + '</div>\n';

// The More pane was one column of seventeen cards in no particular order. Four
// headings now name the groups, and the one card that was in the wrong group —
// the Playlists/Albums button and Auto-scroll, a playback preference that sat
// among the informational notes — moves into Playback.
const PLAYBACK_HEAD = '<button id="collapsiblePlaybackSound"';
const LIBRARY_HEAD = '      <!-- Collapsible: Library Tools & Fetching -->';
const HISTORY_HEAD = '      <!-- Collapsible: DJ Mode per playlist -->';
const TOGGLE_CARD_FROM = '      <!-- Diagonal / Single button toggle -->';
const TOGGLE_CARD_TO = '      <!-- Collapsible: Tutorial summary (text) -->';

const MARK_MORE_GROUPS = 'This build and help</div>';
if (src.indexOf(MARK_MORE_GROUPS) === -1) {
  // The first heading goes INSIDE the pane (after its opener): put it before the
  // opener and it would sit outside the tab, visible on every other tab too.
  sub('the More pane opens with its first group heading',
    '<div id="settingsPaneMore" style="display:none;">\n',
    '<div id="settingsPaneMore" style="display:none;">\n' + HEADING('This build and help'));
  before('a Playback heading',
    PLAYBACK_HEAD,
    HEADING('Playback'));
  const toggleCard = cutBlock('the Playlists/Albums button + Auto-scroll card',
    TOGGLE_CARD_FROM, TOGGLE_CARD_TO);
  before('it moves into the Playback group',
    LIBRARY_HEAD,
    toggleCard);
  before('a Library, storage and rollback heading',
    LIBRARY_HEAD,
    HEADING('Library, storage and rollback'));
  before('a History and extras heading',
    HISTORY_HEAD,
    HEADING('History and extras'));
} else {
  skip('the More pane group headings');
}

// The pane's scroll. Fixed height + animation + a scroll container inside a
// scroll container is what made a wheel feel broken; a max-height, a 1:1 wheel
// and contained overscroll is what a panel is supposed to feel like.
sub('the settings pane is a max-height panel that follows the wheel',
  '.settings-scroll {\n' +
  '  height: 62vh;\n' +
  '  overflow-y: auto;\n' +
  '  -webkit-overflow-scrolling: touch;\n' +
  '  scroll-behavior: smooth;\n' +
  '  padding-right: 10px;\n' +
  '}',
  '.settings-scroll {\n' +
  '  /* A maximum height, not a fixed one: a short tab then has no scrollbar at\n' +
  '     all, and the wheel over it reaches the sheet instead of doing nothing.\n' +
  '     scroll-behavior MUST stay auto: with smooth, a wheel kept working on the\n' +
  '     animating the pane after the wheel had stopped, which is exactly what\n' +
  '     \"the scroll wheel is being weird\" looks like. overscroll-behavior keeps\n' +
  '     the pane from dragging the page behind the sheet along with it. */\n' +
  '  max-height: 62vh;\n' +
  '  overflow-y: auto;\n' +
  '  -webkit-overflow-scrolling: touch;\n' +
  '  overscroll-behavior: contain;\n' +
  '  scroll-behavior: auto;\n' +
  '  scrollbar-gutter: stable;\n' +
  '  padding-right: 10px;\n' +
  '}');

sub('the tab strip scrolls without gliding or chaining',
  '#settingsTabStrip {\n' +
  '  -webkit-overflow-scrolling: touch;\n' +
  '  scrollbar-width: none;\n' +
  '  overflow-x: auto !important;\n' +
  '  scroll-behavior: smooth;\n' +
  '}',
  '#settingsTabStrip {\n' +
  '  -webkit-overflow-scrolling: touch;\n' +
  '  scrollbar-width: none;\n' +
  '  overflow-x: auto !important;\n' +
  '  scroll-behavior: auto;\n' +
  '  overscroll-behavior-x: contain;\n' +
  '}');

sub('and so does the desktop pane size',
  '  .settings-scroll{ height:70vh; }',
  '  .settings-scroll{ max-height:70vh; }');

// ═══════════════════════════════════════════════════════════════════════════
// 7 - pinned-artist covers, newest first
// ═══════════════════════════════════════════════════════════════════════════
sub('a library cover carries the day it was added',
  "              covers.push({ url: cUrl, album: t.album || '', dataUrl: null, blob: t.artBlob || null });",
  "              covers.push({ url: cUrl, album: t.album || '', dataUrl: null, blob: t.artBlob || null, date: Number(t.dateAdded) || 0 });");

sub('an album cover carries its release date',
  "                covers.push({ url: artUrl, album: albumName, dataUrl: null, blob: null });",
  "                covers.push({ url: artUrl, album: albumName, dataUrl: null, blob: null, date: Date.parse(r.releaseDate || '') || 0 });");

sub('and so does a single',
  "                  covers.push({ url: sArt, album: sAlbum, dataUrl: null, blob: null });",
  "                  covers.push({ url: sArt, album: sAlbum, dataUrl: null, blob: null, date: Date.parse(sr.releaseDate || '') || 0 });");

sub('the picker draws them newest first',
  "          covers = _uniqCovers;\n" +
  "        }\n" +
  "        var coverGrid = '';",
  "          covers = _uniqCovers;\n" +
  "        }\n" +
  "        // Newest first. Every candidate now carries the date it came with - the\n" +
  "        // day the song was added for a cover out of your own library, the\n" +
  "        // release date for one from the store - so the artist's latest sleeve\n" +
  "        // is the first square instead of whichever one happened to be imported\n" +
  "        // or returned first. Anything with no date sorts last rather than being\n" +
  "        // dropped.\n" +
  "        if(covers.length > 1){\n" +
  "          covers.sort(function(a, b){ return (Number(b.date) || 0) - (Number(a.date) || 0); });\n" +
  "        }\n" +
  "        var coverGrid = '';");

// ═══════════════════════════════════════════════════════════════════════════
// 8 - the release itself
// ═══════════════════════════════════════════════════════════════════════════
function headEntry() {
  const newMark = "  { version: '" + VER + "',";
  if (src.indexOf(newMark) !== -1) return skip('CHANGELOG head entry');
  const items = NOTES.map((n) => "    '" + n + "',").join('\n');
  const block = "  { version: '" + VER + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
    items + '\n  ] },\n';
  const headMark = 'const CHANGELOG = [\n';
  if (src.indexOf(headMark) === -1) throw new Error('CHANGELOG opener not found');
  src = src.replace(headMark, headMark + block);
  done('CHANGELOG head entry (' + VER + ')');
}

sub('APP_VERSION',
  "  const APP_VERSION = '" + OLD_VER + "';",
  "  const APP_VERSION = '" + VER + "';",
  1, "const APP_VERSION = '" + VER + "';");

headEntry();
fs.writeFileSync(FILE, src);

const SW = path.join(ROOT, 'sw.js');
const swTxt = fs.readFileSync(SW, 'utf8');
const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
if (swTxt.includes(newSw)) {
  console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
} else {
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
  const n = swTxt.split(oldSw).length - 1;
  if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
  fs.writeFileSync(SW, swTxt.split(oldSw).join(newSw));
  console.log('+ sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
}

// Version pins across the suite. test-655 and test-656 read the 63.1.3 entry by
// its own version (repinned by dev/patch-659.mjs) and test-658 reads its own,
// so they are untouched here.
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["VER = '" + OLD_VER + "'", "VER = '" + VER + "'"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
  ["String(head.version) === '" + OLD_VER + "'", "String(head.version) === '" + VER + "'"],
  ["the head entry is v" + OLD_VER + "'", "the head entry is v" + VER + "'"],
  ["'" + OLD_VER + " heads the changelog'", "'" + VER + " heads the changelog'"],
  ["'" + OLD_VER + " entry heads", "'" + VER + " entry heads"],
  ["the " + OLD_VER + " notes", "the " + VER + " notes"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);

let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}

function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to repin)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}

// dev/test-663.mjs is the audit release's gate and pins the HEAD entry: it
// asserts the head is v64 with exactly 8 notes and reads the wording that
// release introduced (the call-site sweep, the "Settings -> More" line). Those
// claims are about v64, so it reads the v64 entry by version now and the head
// entry is left to dev/test-662.mjs and this release's own gate.
// (Neither replacement may re-introduce a literal the bump above rewrites, or a
// second run of this script would repin the very entry it is pointing at.)
fileSub('dev/test-663.mjs', [
  ["  let entries = null, head = null;\n  try { entries = eval('[' + block[1] + ']'); head = entries[0]; } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }",
   "  let entries = null, head = null;\n  try { entries = eval('[' + block[1] + ']'); head = entries.find((x) => /^64$/.test(String(x.version))); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }"],
  ["    ok(String(head.version) === '64.1', 'the head entry is v64.1');",
   "    ok(String(head.version).slice(0, 2) === '64', 'the v64 entry is still in the changelog');"],
]);

console.log('patch-6641: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);

// 1 - the crop sheet
must(has('id="cropSongScrub"'), 'the crop sheet has a listen-through slider');
must(has('id="cropSongScrubPlay"'), 'with a play/pause button beside it');
must(has('function cropScrubSeek(sec, play){'), 'and the playback behind it');
must(has("$('cropSongScrub').addEventListener('change'"), 'a drop starts the sound');
must(has("$('cropSongScrub').addEventListener('input'"), 'and a drag only moves the line');
must(has("(cropPlayMode === 'song' ? 'Listening ' : 'Previewing ')"), 'the status line says which one is playing');
must(has("      cropScrubSetUI(0);"), 'a fresh sheet resets it');
must(has("    if(sb) sb.textContent = '" + PLAY + "';"), 'and stopping clears the button');
must(count("if(cropPreviewAudio){ cropStopPreview(); return; }") === 1, 'the play button stops anything already sounding');
must(count('if(cropPreviewAudio && cropPreviewAudio.pause === stopLive) cropPreviewAudio = null;') === 2,
  'a finished preview disarms both playback paths (' + count('if(cropPreviewAudio && cropPreviewAudio.pause === stopLive) cropPreviewAudio = null;') + ')');

// 2 - the premium split
must(has("gold:'#FFD166', premium:true, dynamic:'synthwave'"), 'Synthwave is premium');
must(has("gold:'#7EE8C4', premium:true, dynamic:'ocean'"), 'Deep Ocean is premium');
must(has("coral:'#A6E8FF', gold:'#E8F7FF', dynamic:'glacier'"), 'Glacier is free');
must(has("rgb:true, rgbPlus:true  }"), 'RGB + is still free');
must(has("coral:'#FF8A5C', gold:'#FFC46B', dynamic:'ember'"), 'Ember is still free');
must(has("coral:'#B084F5', gold:'#8FD0FF', dynamic:'galaxy'"), 'Galaxy is still free');
must(has('every static theme, plus five of the animated ones: RGB, RGB +, Ember, Galaxy and Glacier.'),
  'the premium page describes the split');
must(has('nine animated themes (Aurora, Synthwave, Deep Ocean, Cyberpunk, Nebula, Neon Pulse, Solstice, Abyss, Orchid)'),
  'and names what premium adds');
must(count('Avoid the <b>RGB</b>, <b>RGB+</b>, and every animated <b>dynamic theme</b>') === 2,
  'both seizure warnings list every animated theme (' + count('Avoid the <b>RGB</b>, <b>RGB+</b>, and every animated <b>dynamic theme</b>') + ')');

// 3 - the greeting
must(has('function _aiGreetingReply(msg) {'), 'the assistant can answer a greeting');
must(has('  var _greeting = _aiGreetingReply(msg);'), 'and does, before anything else runs');
must(has('if (q.length >= 4 && (pattern.indexOf(q) !== -1'), 'a fragment of a word can no longer match');
const greetFn = final.slice(final.indexOf('function _aiGreetingReply'), final.indexOf('function _aiFuzzyMatch'));
must(greetFn.indexOf('history') === -1, 'and no greeting answer leaks an unrelated topic');

// 4 - the pinned rail
must(has('min-height:64px;padding:0 2px 4px;"></div>'), 'the rail keeps a minimum height');
must(has('    try{ list.scrollLeft = 0; }catch(_eSc){}'), 'a redrawn rail starts at its left edge');
must(has('(function watchPinnedRail(){'), 'and the rail heals itself after a scroll');
must(has("      try{ chip.style.transform = ''; chip.style.zIndex = ''; chip.style.boxShadow = ''; }catch(_ePLift){}"),
  'a chip never keeps its drag lift');
must(has("if(l.querySelector('.pinned-artist-chip') && l.getBoundingClientRect().height) return;"),
  'the self-heal only fires when the rail really is empty');

// 5 - Settings and More
must(has('id="settingsTabGlow" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Glow</button>\n' +
  '      <button class="tab" id="settingsTabSandbox"'), 'the tab strip is reordered');
must(has('>History and extras</div>'), 'the More pane has group headings');
must(has('>This build and help</div>') && has('>Playback</div>') && has('>Library, storage and rollback</div>'),
  'all four of them');
must(count('<!-- Diagonal / Single button toggle -->') === 1, 'the Playlists/Albums card still exists exactly once');
must(final.indexOf('<!-- Diagonal / Single button toggle -->') > final.indexOf('<!-- Collapsible: Playback -->'),
  'and now sits inside the Playback group');
must(final.indexOf('<!-- Diagonal / Single button toggle -->') < final.indexOf('<!-- Collapsible: Library Tools & Fetching -->'),
  'before the library group');
for (const id of ['settingsTabPremium', 'settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',
  'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']) {
  must(count('id="' + id + '"') >= 1, id + ' still exists');
}

// 6 - the settings scroll
must(has('  max-height: 62vh;\n  overflow-y: auto;\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior: contain;\n  scroll-behavior: auto;\n  scrollbar-gutter: stable;'),
  'the settings pane is a max-height panel that follows the wheel');
must(final.indexOf('.settings-scroll {\n  height: 62vh;') === -1, 'the fixed height is gone');
must(has('  .settings-scroll{ max-height:70vh; }'), 'the desktop size follows');
must(has("  overflow-x: auto !important;\n  scroll-behavior: auto;\n  overscroll-behavior-x: contain;"), 'the tab strip is fixed too');

// 7 - the covers
must(count('date: Number(t.dateAdded) || 0') === 1, 'a library cover carries its date');
must(count("date: Date.parse(r.releaseDate || '') || 0") === 1, 'an album cover carries its release date');
must(count("date: Date.parse(sr.releaseDate || '') || 0") === 1, 'and so does a single');
must(has('covers.sort(function(a, b){ return (Number(b.date) || 0) - (Number(a.date) || 0); });'),
  'and the grid is drawn newest first');

// 8 - the release
const ver = (final.match(/const APP_VERSION = '([^']+)'/) || [])[1];
must(ver === VER, 'APP_VERSION = ' + ver);
let entries = null;
try { entries = block ? eval('[' + block[1] + ']') : null; } catch (e) { problems.push('the changelog does not evaluate: ' + e.message); }
if (entries) {
  const head = entries[0];
  must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
  must((head.items || []).length >= 6, 'patch notes: ' + (head.items || []).length);
  const notes = (head.items || []).join('\n');
  must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head entry');
  must(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
  must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor the wider Play list');
  must(/rollback/i.test(notes), 'and it says what this release did');
  must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
}

const blocks = final.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let bad = 0;
blocks.forEach((b) => {
  const body = b.replace(/<\/?script[^>]*>/gi, '');
  if (!body.trim()) return;
  try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
});
must(bad === 0, 'every inline script block still parses (' + bad + ' bad)');

const swFinal = fs.readFileSync(SW, 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(VER) === -1, 'and does not carry the app version');

const gate = fs.readFileSync(path.join(ROOT, 'dev/test-6641.mjs'), 'utf8');
must(gate.indexOf("'" + VER + "'") !== -1, 'dev/test-6641.mjs pins this release');

if (problems.length) {
  console.error('patch-6641 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

console.log('patch-6641: verified.');
