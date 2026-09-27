#!/usr/bin/env node
// SideCut - 64 (part two): every function the app calls is a function it has.
//
// Reported: "the inbuilt AI when I ask it about specific features it says that
// they don't exist when they do it keeps hallucinating. And check every single
// function of the app and make sure it works with 0 errors."
//
// "Check every single function" is a question a text search cannot answer, so
// dev/audit-calls.mjs was written to answer it structurally: it parses every
// inline <script> block with acorn and reports each identifier that is READ but
// never DECLARED and is not a platform global. That is exactly a ReferenceError
// waiting for the line to run — the same fault that produced the red
// "updateNpDisplay is not defined" banner this release already fixed.
//
// It found nine. Two were the auditor's own blind spot (openShareCodeModal and
// copyTextToClipboard ARE declared — see the lost line break below). The other
// seven were real, and this script fixes all of them:
//
//   1. confirmDeleteTrack(t.id) - the "Delete from library" item in the
//      now-playing menu. The function is deleteTrack(id, skipConfirm); the
//      name it called exists nowhere, so that menu item threw every time.
//   2. parseMP3Tags(buf) - "Reset covers" built its own tag reader that was
//      never written. The app already has one: extractTags(track), which is
//      what the import path uses to lift the embedded APIC cover.
//   3. persistLibrary() - the Spotify-CSV import path pushed a 30-second
//      preview into the library and then saved it with a function that does
//      not exist. A preview is a remote clip with no bytes on the device, so
//      there is nothing to write; the comment there now says so instead.
//   4. dbGetSync('meta','appIcon') - a synchronous read of an async store. It
//      threw inside a try/catch, so the app-icon picker silently never
//      restored the choice it had saved.
//   5. _cardPtrId - the album-card hold-to-reorder released a pointer id that
//      was never captured. The id HAD been captured (as origPointerId, inside
//      the hold timer, where the cancel handler could not see it), which is
//      why nothing caught it: the whole release was inside a try/catch.
//   6. updateCSSGlow() - the import path restoring glow settings called a
//      function that does not exist. The real one is applyGlowCssVars().
//   7. seenReleaseIds - the New Releases popup tested a name that is declared
//      nowhere, so "seen" was always empty and every release carried a NEW
//      badge forever. The app's own per-release flag is r.seen.
//
// And one that is worse than all seven, because it deleted code instead of
// calling missing code:
//
//   8. A LOST LINE BREAK at line 17311. One physical line held the end of
//      sharePlaylistCode, a "// Build a full share link" comment, the rest of
//      sharePlaylistCode, openShareCodeModal() and the opening line of
//      copyTextToClipboard() — all joined by spaces. A "//" comment runs to the
//      end of the line, so every one of them became part of the comment: the
//      share link was never built, openShareCodeModal() did not exist (which
//      is why the auditor reported it), copyTextToClipboard() did not exist
//      (so every Copy button in the app threw), and its body was left dangling
//      as statements inside sharePlaylistCode, where it threw "text is not
//      defined" the moment the share sheet opened. The newlines are restored.
//
// The hallucinating assistant is four separate faults, all about the app being
// described to the model by someone who has not seen it:
//
//   9. The knowledge built into the app had NOTHING for cropping or trimming,
//      so "how to crop a song" fell through to Gemini, which answered that
//      SideCut does not support it — while the app has a Crop song button and
//      an Undo crop. Entries added for crop/trim, the watermark remover, the
//      rollback copies, the Home layout editor and a song that will not play.
//  10. Its answers sent people to "Settings -> Playback", "Settings -> EQ" and
//      "Settings -> Equalizer" - three tabs that have never existed. (Playback,
//      the equalizer and the refresh rate were folded INTO the More tab; see
//      showSettingsTab's first line.) Eleven occurrences corrected.
//  11. Its own text had lost spaces from an older patch: "a name,andthe songs",
//      "Pinned-artist coversare", "it no longer clutter"... repaired.
//  12. The system prompt listed a handful of features and asked the model not to
//      contradict them, which is not enough to stop a model answering from its
//      idea of a music player. It now carries the real tab list, the real
//      features with the page each one lives on, and a rule against inventing a
//      screen. On top of that the model is handed the app's own entry for the
//      question as GROUND TRUTH, and a question the app has a real answer for
//      (a strong match, score >= 80) is answered from the app itself without
//      asking a model at all. A model cannot deny a feature it has been handed.
//
//   node dev/patch-663.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. These build the real character so this script stays ASCII (see
// AGENTS.md, "Non-ASCII needle trap").
const cp = (n) => String.fromCodePoint(n);
const ARR = cp(0x2192);   // right arrow, as used in the knowledge base
const MD = cp(0x2014);    // em dash
const VERT = cp(0x22ee);  // vertical ellipsis (the song menu)

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

// Replace every occurrence of a needle that is expected to DISAPPEAR, so the
// guard is the needle itself. Needed where the replacement text is something
// that already exists elsewhere in the file (a marker would skip the edit on
// the first run, see sub()).
function subGone(label, oldStr, newStr) {
  if (src.indexOf(oldStr) === -1) return skip(label);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// Replace one whole line, located by an ASCII prefix. The replacement may
// contain newlines, which is how a declaration is inserted above a line.
function reLine(label, prefix, newLine) {
  if (src.indexOf(newLine) !== -1) return skip(label);
  const at = src.indexOf(prefix);
  if (at === -1) throw new Error(label + ': line not found');
  if (src.indexOf(prefix, at + 1) !== -1) throw new Error(label + ': line prefix is ambiguous');
  const eol = src.indexOf('\n', at);
  src = src.slice(0, at) + newLine + src.slice(eol);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 - the lost line break that deleted the share sheet and the clipboard
// ═══════════════════════════════════════════════════════════════════════════
// The whole of the needle below is ONE physical line in index.html. It is
// reproduced exactly, so restoring the newlines puts back the source that was
// obviously intended: the end of sharePlaylistCode, its link-building tail, the
// definition of openShareCodeModal(), and the opening line of
// copyTextToClipboard().
{
  const oldLine = "window._lastSharePlaylist = activePlaylist;    // Build a full share link (?sc=<code>) so the recipient can open it in the    // web/browser app too.    const link = 'https://anekthegreat.github.io/SideCut/?sc=' + encodeURIComponent(code) ;    const shareLinkBtn = $('shareCodeCopyLink') ;    if(shareLinkBtn){ shareLinkBtn.dataset.link = link; shareLinkBtn.dataset.code = code; }  }  function openShareCodeModal(){    $('shareCodeTitle').textContent = 'Open a shared playlist code';    $('shareCodeOut').value = '';    $('shareCodePaste').value = '';    $('shareCodeModal').style.display = 'flex';  }  function copyTextToClipboard(text){";
  const newLines = "window._lastSharePlaylist = activePlaylist;\n" +
    "    // Build a full share link (?sc=<code>) so the recipient can open it in the\n" +
    "    // web/browser app too.\n" +
    "    const link = 'https://anekthegreat.github.io/SideCut/?sc=' + encodeURIComponent(code) ;\n" +
    "    const shareLinkBtn = $('shareCodeCopyLink') ;\n" +
    "    if(shareLinkBtn){ shareLinkBtn.dataset.link = link; shareLinkBtn.dataset.code = code; }\n" +
    "  }\n" +
    "  function openShareCodeModal(){\n" +
    "    $('shareCodeTitle').textContent = 'Open a shared playlist code';\n" +
    "    $('shareCodeOut').value = '';\n" +
    "    $('shareCodePaste').value = '';\n" +
    "    $('shareCodeModal').style.display = 'flex';\n" +
    "  }\n" +
    "  function copyTextToClipboard(text){";
  sub('the lost line break that commented out openShareCodeModal + copyTextToClipboard',
    oldLine, newLines, 1,
    'window._lastSharePlaylist = activePlaylist;\n    // Build a full share link');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1-7 - the rest of the missing names
// ═══════════════════════════════════════════════════════════════════════════

// 1. The now-playing menu's delete. deleteTrack(id, skipConfirm) is called with
//    the same shape from the song actions sheet (line ~19997), so this is the
//    call the item always meant to make: it confirms, stops playback, removes
//    the song from every playlist and the tracks store, and repaints.
sub('the now-playing menu delete calls the real deleteTrack',
  "confirmDeleteTrack(t.id);", "deleteTrack(t.id);", 1, "deleteTrack(t.id); } },");

// 2. Reset covers: the app's own tag reader, which is what the import path uses.
sub('Reset covers reads tags through extractTags()',
  "            const buf = await t.file.arrayBuffer();\n" +
  "            const tags = parseMP3Tags(buf);\n" +
  "            if(tags.artBlob){",
  "            // The app has one tag reader - extractTags() - and the import\n" +
  "            // path uses it to lift the embedded APIC cover. This button had\n" +
  "            // its own call to a parseMP3Tags() that was never written, so the\n" +
  "            // reset threw on the first song that still had a file and left\n" +
  "            // every cover in place.\n" +
  "            const tags = await extractTags(t);\n" +
  "            if(tags && tags.artBlob){");

// 3. A 30-second preview has no bytes on this device, so there is nothing to
//    persist - and a record written without one loads back as a silent entry.
sub('a preview added by the playlist import is honestly session-only',
  "                  allTracks.push(newTrack);\n" +
  "                  queue.push(newTrack.id);\n" +
  "                  persistLibrary();\n" +
  "                  resolve(true);",
  "                  allTracks.push(newTrack);\n" +
  "                  queue.push(newTrack.id);\n" +
  "                  // A preview is a remote 30-second clip: there are no bytes\n" +
  "                  // on this device to store, and buildTrackRecord() saves the\n" +
  "                  // audio as a blob, so a record written here would come back\n" +
  "                  // as a silent entry in the library. This is intentionally\n" +
  "                  // session-only. The call that used to be made here --\n" +
  "                  // persistLibrary() -- is not defined anywhere in the app,\n" +
  "                  // so adding a preview always threw a ReferenceError.\n" +
  "                  resolve(true);");

// 4. The app icon is in the meta store, which is asynchronous. dbGetSync() was
//    never written; the value was already read from localStorage one line
//    above, and the database copy is what restores it after a cache clear.
sub('the app icon picker reads its saved choice with dbGet()',
  "        try{ saved = (dbGetSync && dbGetSync('meta', 'appIcon')) || null; }catch(_e){}",
  "        // The meta store is asynchronous and has no synchronous getter, so\n" +
  "        // this used to read a dbGetSync() that does not exist. It threw\n" +
  "        // inside the try/catch, which is why the picker silently never\n" +
  "        // restored a choice that is not in localStorage.\n" +
  "        try{ const _iconRow = await dbGet('meta', 'appIcon'); saved = (_iconRow && _iconRow.value) || null; }catch(_e){}");
sub('and the picker that reads it is async',
  "  (function wireAppIconPicker(){", "  (async function wireAppIconPicker(){");

// 5. Hold-to-reorder on an album card. The capture happens inside the hold
//    timer and the release happens in cancelHold(), which is outside it, so the
//    id has to be declared in the scope they share.
sub('the album-card drag keeps the captured pointer id where cancelHold can see it',
  "          var ALBUM_HOLD_MS = 3000;",
  "          var ALBUM_HOLD_MS = 3000;\n" +
  "          // The pointer the drag captured. card.setPointerCapture() is called\n" +
  "          // from inside the hold timer and cancelHold() lives outside it, so\n" +
  "          // the id has to be held in the scope the two of them share -- which\n" +
  "          // is why releasing a pointer id that only existed inside the timer\n" +
  "          // (as the unused origPointerId did) could never work.\n" +
  "          var _cardPtrId = null;");
sub('and records it when it takes the pointer',
  "              var origPointerId = e.pointerId;", "              _cardPtrId = e.pointerId;");
// The end of the drag released the pointer by that same local name, in two
// places: the one the auditor found (which threw, because it named a variable
// that did not exist) and the one at the end of the drag (which worked, because
// it named the one that did). Both now use the id the shared scope holds.
subGone('and both places that release the pointer use it',
  "releasePointerCapture(origPointerId)", "releasePointerCapture(_cardPtrId)");

// 6. The import path restoring glow settings.
sub('restoring glow settings applies the real CSS variables',
  "          updateCSSGlow();", "          applyGlowCssVars();");

// 7. The New Releases popup's NEW badge.
sub('the New Releases popup reads the seen flag the app actually keeps',
  "        var seen = (typeof seenReleaseIds === 'object') ? seenReleaseIds : {};",
  "        // Which of these the user has already been shown as new. It tested a\n" +
  "        // seenReleaseIds that is declared nowhere, so the test was always\n" +
  "        // false and every release in the list carried a NEW badge forever.\n" +
  "        // The flag the app keeps per release is r.seen (markReleasesSeen).\n" +
  "        var seen = {};\n" +
  "        releases.forEach(function(r){ if(r.seen && r.id) seen[r.id] = true; });");

// ═══════════════════════════════════════════════════════════════════════════
// 11 - the knowledge base's own text, which had lost its spaces
// ═══════════════════════════════════════════════════════════════════════════
// Same lost-space fault as the lost line break above, caught before it deleted
// code: a patch joined lines with spaces and took the space after a comma with
// it, so the assistant answered with "give it a name,andthe songs group under
// it" and "Pinned-artist coversare manual-only". A comma inside English prose is
// always followed by a space, and every such comma in this region is inside a
// string (a quoted query list puts a quote after the comma, and the object's own
// ",a:" is preceded by "]" or "'"), so the guard is "a letter on both sides".
{
  const start = src.indexOf('var _aiKB = [');
  if (start === -1) throw new Error('knowledge base not found');
  const end = src.indexOf('];', start) + 2;
  const before = src.slice(start, end);
  let kb = before.replace(/([A-Za-z]),([A-Za-z])/g, '$1, $2');
  const GLUE = [
    ['andthe', 'and the'], ['coversare', 'covers are'], ['themand', 'them and'],
    ['failingthe', 'failing the'], ['versionand', 'version and'],
    ['wheneverthe', 'whenever the'], ['allthe', 'all the'],
    ['orderand', 'order and'], ['itand', 'it and'],
  ];
  for (const [a, b] of GLUE) kb = kb.split(a).join(b);
  if (kb === before) {
    skip('knowledge base text (no glued words left)');
  } else {
    src = src.slice(0, start) + kb + src.slice(end);
    done('knowledge base text: ' + (kb.length - before.length) + ' lost space(s) restored');
  }
}

// The assistant entry lost a closing bracket as well as its spaces.
sub('the assistant entry closes its bracket',
  "all the v56 stuff, then falls back to your Gemini key when set. Settings ",
  "all the v56 stuff, then falls back to your Gemini key when set), and Settings ");

// ═══════════════════════════════════════════════════════════════════════════
// 10 - the settings pages the answers sent people to, which do not exist
// ═══════════════════════════════════════════════════════════════════════════
// showSettingsTab() opens with "Refresh / Playback / Equalizer were folded into
// the More tab", and the tab strip's buttons are Premium, Get Songs, Theme,
// Donate, Glow, Sandbox, Support, Widget and More. There is no Playback tab, no
// EQ tab and no Equalizer tab, so eleven answers (and two tips in the guide)
// were pointing at screens the user cannot open.
sub('crossfade, gapless and normalization live under Settings -> More -> Playback',
  'Settings ' + ARR + ' Playback', 'Settings ' + ARR + ' More ' + ARR + ' Playback', 7,
  'Settings ' + ARR + ' More ' + ARR + ' Playback');
sub('and the equalizer is described the same way',
  '**Equalizer** (Settings ' + ARR + ' EQ)', '**Equalizer** (Settings ' + ARR + ' More)', 2,
  '**Equalizer** (Settings ' + ARR + ' More)');
sub('the equalizer answer names the real page',
  'Go to **Settings ' + ARR + ' Equalizer** for the 8-band EQ',
  'Go to **Settings ' + ARR + ' More** for the 8-band EQ',
  1, 'Go to **Settings ' + ARR + ' More** for the 8-band EQ');
sub('and so does the guide tip',
  'Settings ' + ARR + ' Equalizer has 8 adjustable bands',
  'Settings ' + ARR + ' More has 8 adjustable bands',
  1, 'Settings ' + ARR + ' More has 8 adjustable bands');

// ═══════════════════════════════════════════════════════════════════════════
// 9 - the questions the knowledge base had no answer for at all
// ═══════════════════════════════════════════════════════════════════════════
// A question with no entry falls through to the model, which answered "how to
// crop a song" with "SideCut does not currently support cropping or trimming
// audio files" - while the app has a Crop song button, a waveform scrubber and
// an Undo crop. These are the five the screenshots were asking about.
{
  const Q = (qs, a) => "  {q:" + qs + ",a:" + a + "},";
  const entries = [
    '  // ---- the questions the assistant used to get wrong (v64) ----',
    Q("['how to crop a song','crop a song','crop song','trim a song','trim song','trim a track','cut a song','crop a track','trim audio','how do i trim a song']",
      "'Yes " + MD + " open the song " + VERT + " menu and tap **Crop song**. It draws the waveform, you drag the two handles around the part you want to keep, it previews the cut, and saving writes the trimmed file into your library. To put the original back, open the song info sheet (" + VERT + " " + ARR + " **Song info**) and tap **Undo crop**.'"),
    Q("['watermark remover','remove watermark','watermark','strip radio edit','remove feat from title','clean up song titles']",
      "'It has a **Watermark Remover**, in **Settings " + ARR + " More** (its own section there). Switch **Enabled** on and list the patterns to strip, one per line, for example `Radio Edit`, `(feat. X)` or `- Remix`. It cleans titles as songs arrive as well as songs you already have.'"),
    Q("['rollback','go back to an earlier version','previous version','undo an update','version history','downgrade the app']",
      "'**Settings " + ARR + " More** holds the storage panel and the version picker. Every version the app has run is kept there as a saved copy and **Restore** takes you back to one, and **Free up space** deliberately never deletes those copies " + MD + " they are the way back to a build that worked.'"),
    Q("['home layout','reorder home','customize home','reorder sections','hide home sections','customize the home screen']",
      "'The Home screen has its own layout editor: **Settings " + ARR + " Sandbox " + ARR + " Home layout**. There you can reorder or hide Now Playing, Shortcuts, Pinned Artists, New Releases, Playlists, Stats and Library. There is no **Customization** tab in SideCut " + MD + " Home layout is the real name.'"),
    Q("['my song is not loading','song will not play','no audio','audio missing','file moved','song is silent','track not playing']",
      "'A song plays from the copy SideCut took when it was imported, so this is one file the app can no longer read. Try **Settings " + ARR + " More** " + ARR + " **Re-fetch all metadata** to re-read the tags and the cover, and hand the file to the app again with **+ Add songs " + ARR + " + Files**. There is no **Rescan library** button and no **Library** tab in Settings.'"),
  ];
  sub('five entries: crop, the watermark remover, rollbacks, Home layout, a song that will not play',
    "];\n\n// Fuzzy match: find the best matching KB entry for a query",
    "\n" + entries.join("\n") + "\n];\n\n// Fuzzy match: find the best matching KB entry for a query",
    1, 'the questions the assistant used to get wrong (v64)');
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 - the model is told the truth, and handed the app's own answer
// ═══════════════════════════════════════════════════════════════════════════
// A request is answered by the app itself when the app has a real answer for
// it, and by the model with that answer attached as ground truth otherwise.
{
  const ground = [
    '// The app describes itself to the model, per build. Every path in here was',
    '// checked against the tab strip and the panes: Playback, the equalizer and the',
    '// library tools are all inside More, and there is no Library tab at all.',
    '// When the knowledge base has an entry for the question it rides along as',
    '// GROUND TRUTH, because the app describing itself outranks any idea a model',
    '// has about what a music player usually offers.',
    "var _aiGroundNote = '\\n\\nThe app has its own entry for this question. This is that entry, and it is authoritative: answer from it, keep it to 1-3 short sentences, and never contradict it or claim the feature is missing.\\n';",
  ].join('\n');

  const prompt = [
    "var _aiSystemPrompt = 'Maintain a natural multi-turn conversation: use earlier turns to understand follow-ups, acknowledge the latest message, and do not repeat canned answers when context changes the meaning. You are the SideCut assistant, a concise, accurate helper for the SideCut music player app. Be direct and specific; answer in 1-3 short sentences unless numbered steps are genuinely needed. ",
    "When the user asks how to do something, give the exact menu path inside this app, and only a path that exists: the Settings tabs are Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget and More, and the playback options (crossfade, gapless, auto volume), the 8-band equalizer, the refresh-rate cap, the library tools and the storage panel all live INSIDE Settings \\u2192 More \\u2014 never send anyone to a Settings \\u2192 Playback tab, a Settings \\u2192 Eq tab, a Settings \\u2192 Library tab or a Rescan library button, because none of those exist. ",
    "Features this app really has: cropping or trimming a song (the song \\u22ee menu \\u2192 Crop song, with Undo crop in the song info sheet); the Watermark Remover that strips Radio Edit and (feat. X) from titles (Settings \\u2192 More); the Home layout editor that reorders or hides the Home sections (Settings \\u2192 Sandbox \\u2192 Home layout); the storage panel and the rollback copies that take you back to an earlier build (Settings \\u2192 More); share codes for playlists (the playlist \\u22ee menu); exporting and importing the whole library as a .zip; playlists and hand-made albums; favourites; crossfade and gapless playback; DJ mode; a sleep timer; synced and translated lyrics; themes with glow and RGB; a home-screen widget; and offline playback of everything already imported. ",
    "CRITICAL: never claim a SideCut feature does not exist when it does, and never invent a screen or a menu path - if you are not certain something exists, say so plainly and point the user at Settings \\u2192 Support. ",
    "Never deny the built-in tools for getting music in \\u2014 they live in Settings \\u2192 Get Songs' + (SC_IS_PLAY ? ' and on this build they are absent: the way in is + Add songs \\u2192 + Files for single files, or a whole folder, and Import library for a backup .zip' : ' and a Spotify link pasted there becomes a tagged MP3, WAV or FLAC with its cover art, while a YouTube video link is handled the same way') + '. ",
    "If a question is off-topic or unclear, ask one short clarifying question. Keep it clean, no filler, no emoji unless asked.';",
  ].join('');

  reLine('the assistant is told what the app really has, and what does not exist',
    "var _aiSystemPrompt = 'Maintain a natural multi-turn conversation",
    ground + '\n' + prompt);
}

sub('the model is handed the app entry as ground truth',
  "      system_instruction: { parts: [{ text: _aiSystemPrompt }] },",
  "      system_instruction: { parts: [{ text: _aiSystemPrompt + (kbGround ? _aiGroundNote + kbGround : '') }] },");
sub('and _aiGeminiQuery takes it',
  "async function _aiGeminiQuery(userMessage) {",
  "async function _aiGeminiQuery(userMessage, kbGround) {");

sub('the fuzzy matcher can be asked for a strong match only',
  "function _aiFuzzyMatch(query) {", "function _aiFuzzyMatch(query, minScore) {");
sub('with the threshold passed in',
  "  if (bestScore >= 35) return bestEntry;", "  if (bestScore >= (minScore || 35)) return bestEntry;");

sub('a question the app really answers is answered from the app, before the model is asked',
  "  // Use Gemini first when configured so the assistant can maintain a real conversation.\n" +
  "  if (_aiGeminiKey) {\n" +
  "    _aiShowTyping();\n" +
  "    var response = await _aiGeminiQuery(msg);",
  "  // A question the app has a real answer for is answered from the app itself,\n" +
  "  // without asking a model at all. A model cannot deny a feature that is in\n" +
  "  // front of it, and this is the only answer guaranteed to describe THIS build.\n" +
  "  var _kbStrong = _aiFuzzyMatch(msg, 80);\n" +
  "  if (_kbStrong) {\n" +
  "    _aiTyping = false;\n" +
  "    _aiAddMessage('assistant', _kbStrong.a);\n" +
  "    _aiChatHistory.push({ role: 'assistant', text: _kbStrong.a });\n" +
  "    if (statusEl) statusEl.textContent = 'Answered from the built-in knowledge base';\n" +
  "    return;\n" +
  "  }\n" +
  "  // Everything else goes to the model, with the app entry for the question (if\n" +
  "  // there is one) attached as ground truth it is told not to contradict.\n" +
  "  var _aiGroundForModel = (_aiFuzzyMatch(msg) || {}).a || '';\n" +
  "\n" +
  "  // Use Gemini first when configured so the assistant can maintain a real conversation.\n" +
  "  if (_aiGeminiKey) {\n" +
  "    _aiShowTyping();\n" +
  "    var response = await _aiGeminiQuery(msg, _aiGroundForModel);");

// ═══════════════════════════════════════════════════════════════════════════
// the release notes
// ═══════════════════════════════════════════════════════════════════════════
// The two notes that already described this class of fault are extended rather
// than renumbered: the first six items are the shared channel and everything
// from index 6 on is marked [FULL], which dev/ota-bundle.mjs and
// dev/test-662.mjs both assert.
sub('the assistant note says it is now grounded in the app',
  "so it no longer tells you a feature is not there when it is.',",
  "so it no longer tells you a feature is not there when it is. It is also given the answer the app documents for itself, so a question about a feature is answered from SideCut instead of from a general idea of what a music player usually has, and it is told which pages really exist \\u2014 playback, the equalizer, the library tools and the storage panel are all inside Settings \\u2192 More, which is a page that exists, and it no longer sends anyone to a Settings tab that does not.',");
sub('the missing-function note now covers all of them',
  "and that refresh no longer counts as a play.',",
  "and that refresh no longer counts as a play. The same sweep \\u2014 every name the app reads, checked against everything it declares \\u2014 found seven more call sites reaching for something that was never there: the delete action in the now-playing menu, the reset-covers button, the album-card hold-to-reorder release, the glow restore on an import, the app icon picker, a 30-second preview added while importing, and the New badge in the New Releases popup. It also found a lost line break, where a comment had swallowed the rest of its own line and silently deleted the share-code sheet and the clipboard copy the whole app uses. All of them are fixed, and the check that found them now runs as part of the release.',");

fs.writeFileSync(FILE, src);
console.log('patch-663: ' + edits + ' index.html edit(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;

// The names the auditor reported must now be gone from the "read but never
// declared" set, and the two it could not see must be declared.
// The call sites are gone. (The names survive in the comments that record what
// they used to be, which is why this looks at the calls rather than the words.)
const GONE = [
  ['dbGetSync && dbGetSync', 'the app icon picker no longer reads a synchronous store'],
  ['parseMP3Tags(buf)', 'Reset covers no longer calls a tag reader that was never written'],
  ['persistLibrary();', 'adding a preview no longer saves through a missing function'],
  ['updateCSSGlow();', 'the glow restore no longer calls the wrong name'],
  ['var origPointerId', 'the pointer id that was captured nowhere is gone'],
];
for (const [needle, label] of GONE) must(count(needle) === 0, label + ' (' + count(needle) + ')');
must(has('var _cardPtrId = null;') && count('releasePointerCapture(_cardPtrId)') === 2,
  'and the album drag keeps and releases one real pointer id (' + count('releasePointerCapture(_cardPtrId)') + ')');
must(count('origPointerId') === 1, 'the old local name survives only in the comment (' + count('origPointerId') + ')');
// seenReleaseIds survives only as the comment that records what it used to be.
must(count('seenReleaseIds') === 1, 'seenReleaseIds only remains in the comment (' + count('seenReleaseIds') + ')');
must(has('// seenReleaseIds that is declared nowhere'), 'explaining what it used to be');

must(has('deleteTrack(t.id);'), 'the now-playing delete calls deleteTrack()');
must(has('const tags = await extractTags(t);'), 'Reset covers uses the real tag reader');
must(has('const _iconRow = await dbGet(\'meta\', \'appIcon\')'), 'the app icon picker reads the meta store');
must(has('(async function wireAppIconPicker(){'), 'in an async picker');
must(has('var _cardPtrId = null;'), 'the album drag keeps the captured pointer id');
must(has('_cardPtrId = e.pointerId;'), 'and records it');
must(has('card.releasePointerCapture(_cardPtrId)'), 'so the release works');
must(has('applyGlowCssVars();'), 'the glow restore applies the real CSS variables');
must(has("releases.forEach(function(r){ if(r.seen && r.id) seen[r.id] = true; });"),
  'the New Releases popup reads the seen flag the app keeps');

// The lost line break: the three declarations are on their own lines again, and
// the comment terminator is back at the end of the comment.
must(has("    // web/browser app too.\n    const link = 'https://anekthegreat.github.io/SideCut/?sc='"),
  'the lost line break is restored');
must(has("  function openShareCodeModal(){\n"), 'openShareCodeModal is a function again');
must(has("  function copyTextToClipboard(text){\n"), 'and so is copyTextToClipboard');
must(has("if(shareLinkBtn){ shareLinkBtn.dataset.link = link; shareLinkBtn.dataset.code = code; }\n  }\n"),
  'and the share link is built again');

// The knowledge base: the paths, the repairs, the new answers.
must(count('Settings ' + ARR + ' Playback') === 0, 'no answer sends anyone to a Playback tab');
must(count('Settings ' + ARR + ' EQ') === 0 && count('Settings ' + ARR + ' Equalizer') === 0,
  'nor to an EQ or Equalizer tab');
must(has('Settings ' + ARR + ' More ' + ARR + ' Playback'), 'they name Settings -> More -> Playback instead');
must(count('Crop song') >= 2, 'the knowledge base now knows about Crop song');
must(has('Undo crop'), 'and about Undo crop');
must(has('**Watermark Remover**'), 'and about the watermark remover');
must(has('Settings ' + ARR + ' Sandbox ' + ARR + ' Home layout'), 'and about the Home layout editor');
must(has('they are the way back to a build that worked'), 'and about the rollback copies');

// No comma in the knowledge base is still glued to the next word, and the whole
// array still evaluates (test-6058 runs it through new Function).
{
  const s = final.indexOf('var _aiKB = [');
  const e = final.indexOf('];', s) + 2;
  const kb = final.slice(s, e);
  const glued = kb.match(/[A-Za-z],[A-Za-z]/g) || [];
  must(glued.length === 0, 'no comma in the knowledge base is glued to a word (' + glued.length + ')');
  const WORDS = ['andthe', 'coversare', 'themand', 'failingthe', 'versionand', 'wheneverthe', 'allthe', 'orderand'];
  const left = WORDS.filter((w) => kb.indexOf(w) !== -1);
  must(left.length === 0, 'and no words are still run together' + (left.length ? ': ' + left.join(', ') : ''));
  try {
    const kbArr = new Function('SC_IS_PLAY', 'window', kb + '\nreturn _aiKB;')(false, {});
    must(kbArr.length >= 60, 'the knowledge base still builds (' + kbArr.length + ' answers)');
    must(kbArr.every((x) => x && Array.isArray(x.q) && typeof x.a === 'string' && x.a.length > 20),
      'and every entry is a question list and an answer');
    const crop = kbArr.find((x) => x.q.indexOf('how to crop a song') !== -1);
    must(!!crop && /Crop song/.test(crop.a), 'and the crop entry answers with the real path');
  } catch (err) {
    problems.push('the knowledge base no longer evaluates: ' + err.message);
  }
}

// The grounding.
must(has('var _aiGroundNote ='), 'the model can be handed the app entry as ground truth');
must(has("_aiSystemPrompt + (kbGround ? _aiGroundNote + kbGround : '')"), 'and it is attached to the request');
must(has('async function _aiGeminiQuery(userMessage, kbGround) {'), 'which the query takes');
must(has('var _kbStrong = _aiFuzzyMatch(msg, 80);'), 'a strong match is answered from the app');
must(has('if (bestScore >= (minScore || 35)) return bestEntry;'), 'with the score asked for');
must(has('never invent a screen or a menu path'), 'and the prompt forbids inventing one');
must(has('a Settings \\u2192 Playback tab'), 'and names the tabs that do not exist');
must(has('Settings \\u2192 Sandbox \\u2192 Home layout'), 'with the real path for the Home layout');

// The release notes keep the channel contract.
{
  const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let head = null;
  try { head = eval('[' + block[1] + ']')[0]; } catch (e) { problems.push('changelog no longer evaluates'); }
  if (head) {
    must((head.items || []).length === 8, 'the release still has 8 notes (' + (head.items || []).length + ')');
    must((head.items || []).slice(0, 6).every((it) => it.indexOf('[FULL]') === -1), 'the first six are the shared channel');
    must((head.items || []).slice(6).every((it) => it.indexOf('[FULL] ') === 0), 'and the rest are marked [FULL]');
    must(!/\bdownload|converter|convert\b/i.test((head.items || []).join('\n')), 'and name no downloader');
  }
}

// Every inline script block still parses, with the real parser when it is there.
{
  const blocks = final.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  must(bad === 0, 'every inline script block still parses (' + bad + ' bad)');
}

if (problems.length) {
  console.error('patch-663 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-663 verify: OK (eight missing names, the lost line break, and an assistant that is told the truth)');
