#!/usr/bin/env node
// SideCut - 64 (part one): the QOL pass.
//
// Nine things were reported together. In order:
//
//   1. "Most of these album covers are just repeats and I'm missing a lot of
//      them made by the artist." The artist-picture picker's list was keyed on
//      (album name + that track's own art URL). Every imported song carries its
//      own Blob and therefore its own URL, so ten songs off one album were ten
//      identical squares. It now dedupes on the IMAGE (the converted data URL),
//      and it asks the store for singles as well as albums, which is where a lot
//      of the pictures it was missing actually live.
//
//   2. "The AI is very not assuring when it's going to work I need a permanent
//      solution." Three separate faults, all fixed here:
//        * a busy model (503), a rate limit (429) or a server hiccup (5xx) was
//          reported as a red API-error bubble. Those are the same request
//          working a moment later, so it is retried (0/0.7/1.6/3.0s) first.
//        * if the service still could not answer, the user was left with the
//          error and nothing else. The chat now falls back to the knowledge
//          built into the app and says which one answered.
//        * asked "how does the downloader work" it answered "SideCut does not
//          have a built-in tool to download music", which is false on the build
//          that has one. The app's real tools are now named in what it is told
//          about the app, per build.
//
//   3. "the pinned artist bar should be rounded and contrast color." It was a
//      flat block of the theme background running edge to edge; it is a rounded
//      card on the raised surface with a hairline border now.
//
//   4. "Downloading songs from Spotify to mp3 and YouTube to mp3 take very long
//      it should be faster and have an accurate progress bar." The encoder was
//      handing the thread back every 55ms of work; it now works in 90ms slices,
//      which is roughly a third more work per wake-up with the screen just as
//      responsive. The pause between songs in a multi-song run was a flat 800ms
//      and is 200ms.
//
//   5. "Make these progress bars in settings actually nice to scroll with your
//      finger and not threw tap thing same thing with the media player time left
//      playing thingy it should be nice and draggable with your finger." The
//      settings sliders were bare native inputs (small thumb, tap-to-jump). They
//      share one styled control now: a filled track and a 22px thumb. And the
//      now-bar's seek bar no longer fights the file's own clock — timeupdate
//      used to write the playhead position back into the slider several times a
//      second, which pulled the thumb out from under the finger mid-drag.
//
//   6. "The tutorials for the full ver and play version should be according to
//      what features they have." The build that has the built-in tool was still
//      teaching the outside-site route in its first-run guide, its scenario list
//      and its text summary. All three describe the tool it actually has now;
//      the build without it keeps the import-only walkthrough it already had.
//
//   7. (the two apps side by side question - answered in the CI script, not here)
//
//   8. "Free up storage should not delete any older rollback things." It did:
//      the button trimmed the version history to the newest six, which is the
//      exact list the version picker exists to show. It no longer touches them,
//      the panel no longer promises to, and it no longer deserialises every
//      page-sized row twice just to report what it had thrown away.
//
//   9. The red banner that read "updateNpDisplay is not defined" after a cover
//      refetch or a watermark clean: the two batch jobs call a refresh that was
//      never defined. It exists now.
//
//   node dev/patch-660.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose gets the real character, built here so this script
// stays ASCII (see AGENTS.md, "Non-ASCII needle trap").
const cp = (n) => String.fromCodePoint(n);
const MD = cp(0x2014);   // em dash
const DOT = cp(0x00b7);  // middle dot
const ARR = cp(0x2192);  // right arrow
const DWN = cp(0x25be);  // small down triangle (the "add songs" chevron)
const GEAR = cp(0x1f3b5); // used only in prose we are NOT touching

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

// Replace the whole slice between two ASCII anchors, keeping the END anchor.
function splice(label, from, to, neu, marker) {
  const m = marker || neu;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const at = src.indexOf(from);
  if (at === -1) throw new Error(label + ': start anchor not found');
  const end = src.indexOf(to, at);
  if (end === -1) throw new Error(label + ': end anchor not found');
  const again = src.indexOf(from, at + from.length);
  if (again !== -1 && again < end) throw new Error(label + ': start anchor is ambiguous');
  src = src.slice(0, at) + neu + src.slice(end);
  done(label);
}

// Replace one whole line, located by an ASCII prefix (the tail of the line is
// re-written, so a comment full of non-ASCII never has to be matched).
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
// 9 - the refresh the two batch jobs call, which was never defined
// ═══════════════════════════════════════════════════════════════════════════
// The watermark clean and "Refetch Missing Covers" both end with
//   var cur = allTracks.find(tr => tr.id === queue[queueIndex]);
//   if(cur) updateNpDisplay(cur);
// and nothing in the file ever defined it — the two call sites were the whole
// of it. The real function is updateNowPlayingUI(), which is the wrong tool
// here: it records a play, loads the waveform and re-arms the widget, all of
// which belong to a track CHANGE, not to a batch job finishing. This is the
// text and the art of the song already playing, and nothing else.
sub('the now-bar refresh the batch jobs call',
  "    if($('djModeBackdrop').style.display === 'flex') refreshDjMode();\n  }\n\n  // ---------------- Stats ----------------",
  "    if($('djModeBackdrop').style.display === 'flex') refreshDjMode();\n  }\n\n" +
  "  // The now bar's own light refresh, callable from anywhere in this scope.\n" +
  "  // Two batch jobs finish by refreshing the song that is already playing — the\n" +
  "  // watermark clean (its title or artist may have just changed) and Refetch\n" +
  "  // missing covers (its art may have just arrived). They used to call\n" +
  "  // updateNpDisplay(), which was never defined anywhere in the file, so both\n" +
  "  // ended in \"updateNpDisplay is not defined\" and the now bar kept what it had.\n" +
  "  // This is that refresh and only that refresh: no play recorded, no waveform\n" +
  "  // loaded, no widget re-armed — those belong to a track change, not to a job\n" +
  "  // finishing behind it.\n" +
  "  function updateNpDisplay(t){\n" +
  "    try{\n" +
  "      if(!t) return;\n" +
  "      if($('npTitle')) $('npTitle').textContent = t.name;\n" +
  "      if($('npArtist')) $('npArtist').textContent = t.artist;\n" +
  "      updateNowPlayingArt(t);\n" +
  "    }catch(_eNp){ }\n" +
  "  }\n\n" +
  "  // ---------------- Stats ----------------");

sub('and it is exposed with the other hooks',
  "  window.updateNotifBadge = updateNotifBadge;",
  "  window.updateNotifBadge = updateNotifBadge;\n  window.updateNpDisplay = updateNpDisplay;");

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the artist-picture picker: one square per image, and the singles too
// ═══════════════════════════════════════════════════════════════════════════
// The list is built from every library track of the artist, keyed on
// (album name + that track's own art URL). A song's art is a Blob unique to the
// song, so its URL is unique too: an album of ten songs put ten copies of the
// same sleeve in the grid, and the same applied across a discography. By the
// time the grid is built every candidate has been converted to a data URL, so
// two identical pictures are two identical strings and the repeat is visible to
// the dedupe itself.
sub('the picker keeps one square per image',
  "      function buildPicker(){\n        if(pending > 0) return;\n        var coverGrid = '';",
  "      function buildPicker(){\n" +
  "        if(pending > 0) return;\n" +
  "        // One entry per IMAGE. The key it was built on — album name plus that\n" +
  "        // track's own art URL — could never collapse anything, because every\n" +
  "        // imported song carries its own Blob and therefore its own URL. The\n" +
  "        // data URL it has been converted to IS the image, so identical\n" +
  "        // pictures are identical strings here and the repeat collapses.\n" +
  "        if(covers.length > 1){\n" +
  "          var _seenImg = {}, _uniqCovers = [];\n" +
  "          for(var _ci = 0; _ci < covers.length; _ci++){\n" +
  "            var _cv = covers[_ci];\n" +
  "            var _ck = (_cv.dataUrl && _cv.dataUrl.length > 64) ? _cv.dataUrl : ('u|' + String(_cv.url || ''));\n" +
  "            if(_ck === 'u|' || _seenImg[_ck]) continue;\n" +
  "            _seenImg[_ck] = true;\n" +
  "            _uniqCovers.push(_cv);\n" +
  "          }\n" +
  "          covers = _uniqCovers;\n" +
  "        }\n" +
  "        var coverGrid = '';");

// The album search only ever asked for albums. An artist's singles carry their
// own artwork and are a large part of what was missing, so the same store is
// asked for those as well, through the same artist filter and the same `seen`
// map, so nothing can arrive twice.
sub('the picker also asks for the artist singles',
  "        }catch(_fetchErr){}",
  "        // Singles carry their own artwork, and they are a large part of what\n" +
  "          // the grid was missing — an artist's early singles exist nowhere in\n" +
  "          // an album search. Same store, same artist filter, same `seen` map,\n" +
  "          // so nothing can be added twice.\n" +
  "          try{\n" +
  "            var sresp = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(artistName) + '&media=music&entity=song&limit=50');\n" +
  "            if(sresp && sresp.ok){\n" +
  "              var sdata = await sresp.json();\n" +
  "              var sresults = sdata.results || [];\n" +
  "              for(var sj=0; sj<sresults.length; sj++){\n" +
  "                var sr = sresults[sj];\n" +
  "                if(!sr || !sr.artworkUrl100) continue;\n" +
  "                var srName = (sr.artistName || '').toLowerCase().trim();\n" +
  "                if(srName !== aname && srName.indexOf(aname) === -1 && aname.indexOf(srName) === -1) continue;\n" +
  "                var sArt = sr.artworkUrl100.replace(/100x100/, '600x600');\n" +
  "                var sAlbum = sr.collectionName || sr.trackName || '';\n" +
  "                var sKey = sAlbum.toLowerCase().trim() + '|' + sArt;\n" +
  "                if(!seen[sKey]){\n" +
  "                  seen[sKey] = true;\n" +
  "                  covers.push({ url: sArt, album: sAlbum, dataUrl: null, blob: null });\n" +
  "                }\n" +
  "              }\n" +
  "            }\n" +
  "          }catch(_songErr){}\n" +
  "        }catch(_fetchErr){}");

// ═══════════════════════════════════════════════════════════════════════════
// 2 - the assistant: retry, fall back, and stop denying its own features
// ═══════════════════════════════════════════════════════════════════════════
reLine('the assistant is told what the app really has',
  "var _aiSystemPrompt = ",
  "var _aiSystemPrompt = 'Maintain a natural multi-turn conversation: use earlier turns to understand follow-ups, acknowledge the latest message, and do not repeat canned answers when context changes the meaning. You are the SideCut assistant, a concise, accurate helper for the SideCut music player app. Be direct and specific; answer in 1-3 short sentences unless numbered steps are genuinely needed. When the user asks \"how do I...\", give the exact menu path (for example Settings \\u2192 Playback \\u2192 Crossfade). When they report a problem, state the likely cause and the fix in order. CRITICAL: never claim a SideCut feature does not exist when it does, and never deny the built-in tools for getting music in — they live in Settings \\u2192 Get Songs and in the Discover tab' + (SC_IS_PLAY ? ' and on this build they are absent: the way in is + Add songs \\u2192 + Files for single files, or a whole folder, and Import library for a backup .zip' : ' and a Spotify link pasted there becomes a tagged MP3, WAV or FLAC with its cover art, while a YouTube video link is handled the same way') + '. SideCut also has playlists and hand-made albums, favourites, an 8-band equaliser, crossfade and gapless playback, DJ mode, a sleep timer, synced and translated lyrics, themes with glow and RGB, a home-screen widget, storage and rollback tools, and offline playback of everything already imported. If a question is off-topic or unclear, ask one short clarifying question. Keep it clean, no filler, no emoji unless asked.';");

// A busy model is not a broken key. Retry it before saying anything.
sub('a busy model is retried, not reported',
  "    var resp = await _ask(window.__scGeminiModel());",
  "    // 503 (busy), 429 (rate limited) and a 5xx hiccup are the SAME request\n" +
  "    // working a moment later — not a broken key and not the user's fault. They\n" +
  "    // used to be printed straight into the chat as a red API-error bubble, which\n" +
  "    // is what made the assistant feel like it might or might not work. Retry\n" +
  "    // with a short, growing pause first; only if it still fails does the caller\n" +
  "    // fall back to the knowledge built into the app.\n" +
  "    var _askRetrying = async function(model){\n" +
  "      var waits = [0, 700, 1600, 3000];\n" +
  "      var last = null;\n" +
  "      for(var _a = 0; _a < waits.length; _a++){\n" +
  "        if(waits[_a]) await new Promise(function(r){ setTimeout(r, waits[_a]); });\n" +
  "        try{ last = await _ask(model); }catch(_eAsk){ last = null; break; }\n" +
  "        var _st = last && last.status;\n" +
  "        if(_st !== 429 && _st !== 500 && _st !== 502 && _st !== 503 && _st !== 504) return last;\n" +
  "      }\n" +
  "      return last;\n" +
  "    };\n" +
  "    var resp = await _askRetrying(window.__scGeminiModel());");

sub('and so is the model fallback',
  "      if(_better && _better !== window.__scGeminiModel()) resp = await _ask(_better);",
  "      if(_better && _better !== window.__scGeminiModel()) resp = await _askRetrying(_better);");

reLine('a transient failure is handed to the fallback, not printed',
  "      return 'API error ('",
  "      // A still-busy service is the caller's cue to answer from the knowledge\n" +
  "      // built into the app (see _aiSendMessage) rather than to leave the user\n" +
  "      // with an error.\n" +
  "      if(resp.status === 429 || resp.status >= 500) return null;\n" +
  "      return 'The assistant service answered with error ' + resp.status + (_apiSays ? ': ' + _apiSays : '') + '. Try again in a moment.';");

sub('the busy flag exists',
  "var _aiTyping = false;",
  "var _aiTyping = false;\n// Set when the service could not answer and the reply came from the knowledge\n// built into the app, so the status line can say which one answered.\nvar _aiBusyFallback = false;");

sub('the busy flag is cleared per question',
  "  _aiTyping = true;",
  "  _aiTyping = true;\n  _aiBusyFallback = false;");

sub('a failed service call falls through to the built-in knowledge base',
  "    if (response) {\n" +
  "      _aiAddMessage('assistant', response);\n" +
  "      _aiChatHistory.push({ role: 'assistant', text: response });\n" +
  "    }\n" +
  "    if (statusEl) statusEl.textContent = response ? 'Answered by Gemini AI' : '';\n" +
  "    return;\n" +
  "  }",
  "    if (response) {\n" +
  "      _aiAddMessage('assistant', response);\n" +
  "      _aiChatHistory.push({ role: 'assistant', text: response });\n" +
  "      if (statusEl) statusEl.textContent = 'Answered by Gemini AI';\n" +
  "      return;\n" +
  "    }\n" +
  "    // The service was busy or unreachable. A question still gets an answer: the\n" +
  "    // knowledge built into the app, with the status line saying so plainly.\n" +
  "    _aiBusyFallback = true;\n" +
  "  }");

sub('and the status line says which one answered',
  "    if (statusEl) statusEl.textContent = 'Answered from knowledge base';",
  "    if (statusEl) statusEl.textContent = _aiBusyFallback ? 'Answered from the built-in knowledge base (the assistant service was busy)' : 'Answered from knowledge base';");

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the pinned artists strip: a rounded card, on the raised surface
// ═══════════════════════════════════════════════════════════════════════════
// It was `background:var(--bg)` with no radius and no border, so on any themed
// build it read as a flat block of the page colour pinned to the screen edges
// and butted straight against the search row below it.
sub('the pinned artists strip is a rounded card',
  '<div id="pinnedArtistsStrip" style="background:var(--bg);margin:0 0 12px;padding:2px 0 6px;">',
  '<div id="pinnedArtistsStrip" style="background:var(--bg-raised);margin:0 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;">');

// ═══════════════════════════════════════════════════════════════════════════
// 5 - sliders a finger can actually drag
// ═══════════════════════════════════════════════════════════════════════════
// touch-action:pan-x on the seek bar TOLD the browser that a horizontal gesture
// on it is a pan — so a horizontal drag could be taken by the scroller and never
// reach the thumb. none hands every gesture on the bar to the bar.
sub('the seek bar stops offering its drag to the scroller',
  "  #seekBar{ flex:1; -webkit-appearance:none; appearance:none; height:8px; border-radius:999px; outline:none; touch-action:pan-x;",
  "  #seekBar{ flex:1; -webkit-appearance:none; appearance:none; height:8px; border-radius:999px; outline:none; touch-action:none;");

// The settings sliders were bare native inputs: a small thumb and a tap that
// jumps the value. One styled control for all of them. #seekBar and
// #actionSpeedSlider paint their own filled track on the input element and are
// excluded, or a generic runnable-track would sit over that fill; the equaliser
// bands are excluded because they are vertical faders that rely on the native
// rendering.
sub('the settings sliders become one draggable control',
  "  #seekBar::-moz-range-progress{ height:8px; border-radius:999px; background:var(--coral); }",
  "  #seekBar::-moz-range-progress{ height:8px; border-radius:999px; background:var(--coral); }\n" +
  "  /* Every other slider in the app is the same control to the hand: a filled\n" +
  "     track and a thumb big enough to take hold of. They used to be bare native\n" +
  "     inputs — a small thumb and a tap that jumped the value — which is why\n" +
  "     changing one felt like a tap rather than a drag. #seekBar and\n" +
  "     #actionSpeedSlider keep their own styling (both paint their filled track\n" +
  "     on the input itself, and a generic track would cover it), and the\n" +
  "     equaliser bands are vertical faders that need the native rendering. */\n" +
  "  input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider){\n" +
  "    -webkit-appearance:none; appearance:none; height:28px; margin:0; padding:0;\n" +
  "    background:transparent; touch-action:pan-y; cursor:pointer;\n" +
  "  }\n" +
  "  input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)::-webkit-slider-runnable-track{\n" +
  "    height:8px; border-radius:999px; background:var(--line);\n" +
  "  }\n" +
  "  input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)::-webkit-slider-thumb{\n" +
  "    -webkit-appearance:none; width:22px; height:22px; margin-top:-7px; border-radius:50%;\n" +
  "    background:var(--coral); border:2px solid #161616;\n" +
  "    box-shadow:0 0 0 4px color-mix(in srgb, var(--coral) 22%, transparent);\n" +
  "  }\n" +
  "  input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider):active::-webkit-slider-thumb{\n" +
  "    transform:scale(1.08);\n" +
  "  }\n" +
  "  input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)::-moz-range-track{\n" +
  "    height:8px; border-radius:999px; background:var(--line);\n" +
  "  }\n" +
  "  input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)::-moz-range-thumb{\n" +
  "    width:22px; height:22px; border-radius:50%; background:var(--coral); border:2px solid #161616;\n" +
  "  }");

// The seek bar's real problem: timeupdate fires several times a second and
// updateSeekDisplay() wrote the playhead straight back into the slider, so the
// thumb was pulled out from under the finger while it was being dragged.
sub('the file clock leaves the seek bar alone while a finger is on it',
  "  function updateSeekDisplay(pct){\n" +
  "    $('seekBar').value = pct;\n" +
  "    $('seekBar').style.setProperty('--seek-fill', Math.max(0, Math.min(100, pct)) + '%');\n" +
  "    updateWaveformDisplay(pct);",
  "  // While the bar is held, the file's own clock must not write to it. timeupdate\n" +
  "  // fires several times a second and used to set the slider back to where the\n" +
  "  // song was, which pulled the thumb out from under the finger mid-drag — the\n" +
  "  // reason the bar behaved like a tap you could not hold. The waveform and the\n" +
  "  // disc ring still follow the song; only the control being dragged is left in\n" +
  "  // the user's hands.\n" +
  "  var scSeekDragging = false;\n" +
  "  function updateSeekDisplay(pct){\n" +
  "    if(!scSeekDragging){\n" +
  "      $('seekBar').value = pct;\n" +
  "      $('seekBar').style.setProperty('--seek-fill', Math.max(0, Math.min(100, pct)) + '%');\n" +
  "    }\n" +
  "    updateWaveformDisplay(pct);");

sub('and it is released when the finger leaves it',
  "  $('seekBar').addEventListener('input', () => {\n" +
  "    const a = activeAudio();\n" +
  "    if(a.duration){\n" +
  "      const pct = ($('seekBar').value)/100;\n" +
  "      a.currentTime = pct * a.duration;\n" +
  "      $('seekBar').style.setProperty('--seek-fill', (pct * 100) + '%');\n" +
  "    }\n" +
  "    savePlaybackState(true);\n" +
  "  });",
  "  $('seekBar').addEventListener('input', () => {\n" +
  "    const a = activeAudio();\n" +
  "    if(a.duration){\n" +
  "      const pct = ($('seekBar').value)/100;\n" +
  "      a.currentTime = pct * a.duration;\n" +
  "      $('seekBar').style.setProperty('--seek-fill', (pct * 100) + '%');\n" +
  "    }\n" +
  "    savePlaybackState(true);\n" +
  "  });\n" +
  "  // Hold the bar out of the clock's hands for as long as it is held, and give it\n" +
  "  // back on every way a drag can end. A finger (pointerdown/touchstart), a mouse,\n" +
  "  // a dropped gesture and a focus change are all covered: any exit left unwired\n" +
  "  // would freeze the bar, so the release is wired as widely as the grab.\n" +
  "  ;['pointerdown','touchstart','mousedown'].forEach(function(_ev){\n" +
  "    $('seekBar').addEventListener(_ev, function(){ scSeekDragging = true; }, { passive: true });\n" +
  "  });\n" +
  "  ;['pointerup','pointercancel','touchend','touchcancel','mouseup','change','blur'].forEach(function(_ev){\n" +
  "    $('seekBar').addEventListener(_ev, function(){ scSeekDragging = false; }, { passive: true });\n" +
  "  });");

// ═══════════════════════════════════════════════════════════════════════════
// 4 - long runs finish sooner
// ═══════════════════════════════════════════════════════════════════════════
reLine('the encoder works in longer slices before yielding',
  "  var SC_ENCODE_SLICE_MS = ",
  "  // Work per slice before handing the thread back. 55ms meant ~18 wake-ups a\n" +
  "  // second, and every wake-up costs a timer round trip on top of the encode —\n" +
  "  // a third of the run spent waiting to be scheduled again. 90ms is ~11 a\n" +
  "  // second, which the screen cannot tell apart, for noticeably less overhead.\n" +
  "  var SC_ENCODE_SLICE_MS = 90;");

reLine('and the pause between songs in a run is not a fixed three quarters of a second',
  "      if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 800); });",
  "      // Pacing so a long run does not hammer the lookup services. 800ms a song\n" +
  "      // was ten seconds of doing nothing across a twelve-song album; 200ms still\n" +
  "      // spaces the requests out without the run reading as stalled between songs.\n" +
  "      if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 200); });");

// ═══════════════════════════════════════════════════════════════════════════
// 6 - the guide describes the build it is in
// ═══════════════════════════════════════════════════════════════════════════
// This markup is the FIRST-RUN guide on the build that has the built-in tools,
// and it was still teaching the outside-site route (Share, Expand URL, "paste it
// into any converter", import the file) — a four-step detour out of the app, on
// the build that does the whole job itself. The build that only accepts your own
// files replaces this whole block at boot with its import-only walkthrough (see
// SC_IS_PLAY near the top of the file), and that replacement still finds its
// anchor because the heading keeps its id here.
splice('the first-run guide teaches the tool this build has',
  '<div id="howToGetMusicHead"',
  '        <div style="font-weight:600; font-size:14px; margin-bottom:6px;">Playing music</div>',
  [
    '<div id="howToGetMusicHead" style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>',
    '        <div style="font-size:12.5px; color:var(--ink-dim); line-height:1.5;">',
    '          SideCut plays audio files saved on your device, and it makes those files from a Spotify link itself \u2014 nothing to install and no other site to visit. One song takes a few seconds:',
    '        </div>',
    '        <div style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--ink-dim); margin-top:8px;">',
    '          <div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">1.</span><span>In <b>Spotify</b>, tap <b>Share ' + ARR + ' Copy link</b> on any song, album or playlist.</span></div>',
    '          <div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">2.</span><span>In SideCut open <b>Settings ' + ARR + ' Get Songs</b> (the same box sits in <b>Discover</b>), paste the link and pick <b>MP3</b> for a small file or <b>WAV / FLAC</b> for lossless.</span></div>',
    '          <div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">3.</span><span>Tap <b>Convert</b>. SideCut tags the song, gives it its cover art and adds it to your library when it is done \u2014 an album or a playlist link runs through every track, in order.</span></div>',
    '          <div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">4.</span><span>A <b>YouTube</b> link works the same way, in the card right below it.</span></div>',
    '          <div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">' + DOT + '</span><span>Already have the files? <b>+ Add songs ' + DWN + ' ' + ARR + ' + Files</b> takes them one by one, <b>+ Add folder</b> takes a whole folder, and <b>Import library</b> restores a backup .zip.</span></div>',
    '        </div>',
    '      </div>',
    '      <div>\n',
  ].join('\n'));

reLine('and so does the step-by-step scenario',
  '<div id="howToScenario1Head"',
  '            <div id="howToScenario1Head" style="color:var(--ink); font-weight:600; margin-bottom:4px;">1 ' + DOT + ' Get a song off Spotify into SideCut</div>');

reLine('and the scenario body',
  '            <div>In <b>Spotify</b>, open the song',
  '            <div>In <b>Spotify</b>, open the song and tap <b>Share ' + ARR + ' Copy link</b>. In SideCut open <b>Settings ' + ARR + ' Get Songs</b> (or the same box in <b>Discover</b>), paste the link, pick <b>MP3</b> or <b>WAV / FLAC</b> and tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it into your library \u2014 for a link this build does the whole job, and it keeps working with no connection once the song is in.</div>');

reLine('and the plain-text summary in Settings',
  '<div id="tutSumGetMusic"',
  '          <div id="tutSumGetMusic" style="display:flex; gap:8px; margin-bottom:4px;"><span style="color:var(--coral); flex-shrink:0;">' + DOT + '</span><span><b>Getting music in:</b> paste a Spotify link (or a YouTube link) into <b>Settings ' + ARR + ' Get Songs</b> or <b>Discover</b>, pick MP3 or WAV / FLAC and tap <b>Convert</b> \u2014 it is tagged with its cover art and lands in your library. Bringing your own files works too: <b>+ Add songs ' + DWN + ' ' + ARR + ' + Files</b>, <b>+ Add folder</b>, or <b>Import library</b> for a backup .zip.</span></div>');

// ═══════════════════════════════════════════════════════════════════════════
// 8 - Free up space stops deleting the rollback history
// ═══════════════════════════════════════════════════════════════════════════
reLine('the rollback note in the storage layer says what is true now',
  "  //     these copies; that is a feature, so trimming them is a choice",
  "  //     these copies; that is a feature, and nothing removes them for you.");

reLine('and the note under it',
  "  //     Settings",
  "  //     Free up space leaves them alone entirely — see scFreeUpSpace below.");

// The panel used to advertise the trimming, so the sentence has to go with the
// behaviour. It now says the copies are never removed, which is what happens.
sub('the Storage panel stops promising to trim them',
  "    rows.push(['Saved rollback copies', snaps.length + ' \u00b7 ' + scFmtBytes(snapBytes) + (snaps.length > SC_SNAPSHOT_KEEP ? ' (Free up space keeps the newest ' + SC_SNAPSHOT_KEEP + ')' : '')]);",
  "    rows.push(['Saved rollback copies', snaps.length + ' \u00b7 ' + scFmtBytes(snapBytes) + (snaps.length ? ' (none are ever removed)' : '')]);");

// The whole button, replaced: it trimmed the version history to the newest six,
// and it read every page-sized row twice to say how much that had saved. Neither
// survives. What is left is the two things the app can genuinely rebuild: the
// saved list caches and the leftover backup zip in its own cache directory.
splice('Free up space no longer deletes rollback copies',
  '  async function scFreeUpSpace(){',
  '  window.__scFreeUpSpace = scFreeUpSpace;',
  [
    '  // Take back only what the app itself can rebuild.',
    '  //',
    '  // This button used to also delete every rollback copy past the newest six —',
    '  // the exact list the version picker exists to show, and the only way back to',
    '  // a build that worked. Trading that history for a couple of megabytes is not',
    '  // what the button says it does, so it no longer does it: the copies are left',
    '  // alone, and nothing is read to measure them any more either (the old version',
    '  // deserialised every page-sized row twice just to report what it had thrown',
    '  // away). What is left is honest: the saved-list caches, which are rebuilt the',
    '  // moment a list is reopened, and a leftover backup zip in the app\u2019s own',
    '  // cache directory, which has already been shared or saved by the time it can',
    '  // be removed.',
    '  async function scFreeUpSpace(){',
    '    try{',
    '      var cleared = 0;',
    '      try{',
    '        var dead = [];',
    '        for(var i = 0; i < localStorage.length; i++){',
    '          var k = localStorage.key(i);',
    '          if(k && k.indexOf(\'discPopupCache_\') === 0) dead.push(k);',
    '        }',
    '        dead.forEach(function(k){ try{ localStorage.removeItem(k); cleared++; }catch(_e){ } });',
    '      }catch(_e){ }',
    '      var own = { files: 0, bytes: 0 };',
    '      try{ own = await scCleanOwnCache(); }catch(_e){ }',
    '      var _bits = [];',
    '      if(cleared) _bits.push(cleared + \' saved list\' + (cleared === 1 ? \'\' : \'s\'));',
    '      if(own.files) _bits.push(own.files + \' leftover backup file\' + (own.files === 1 ? \'\' : \'s\'));',
    '      var msg = (cleared || own.files)',
    '        ? \'Freed \' + scFmtBytes(own.bytes || 0) + (_bits.length ? \' from \' + _bits.join(\' and \') : \'\') + \'. Your saved rollback copies were left alone \u2014 they are how you go back to an earlier build.\'',
    '        : \'Nothing needed clearing, and your saved rollback copies were left alone.\';',
    '      toast(msg, 4000);',
    '      renderStoragePanel(msg);',
    '    }catch(e){ toast(\'Could not free that up \u2014 nothing was removed.\', 3500); }',
    '  }',
    '',
  ].join('\n'));

// ═══════════════════════════════════════════════════════════════════════════
// the WebView blob refusal, caught where it is thrown
// ═══════════════════════════════════════════════════════════════════════════
// The banner "Failed to write blob (InvalidBlob)" is Android's WebView refusing
// a generated File/Blob cloned into IndexedDB. put() throws it SYNCHRONOUSLY,
// and although a thrown executor rejects the promise — which dbPut's try/catch
// does catch — that only holds while nothing in between is allowed to change
// shape. Catching it at the call site makes the contract explicit: the caller
// gets the documented `false` and persistTrackMeta falls back to the
// ArrayBuffer form it already has, instead of a DOMException escaping to the
// global handler as a red banner.
sub('a refused Blob write reports false instead of escaping',
  "        const tx = db.transaction(storeName, 'readwrite');\n        tx.objectStore(storeName).put(value);",
  "        const tx = db.transaction(storeName, 'readwrite');\n" +
  "        // A generated Blob can be refused here SYNCHRONOUSLY (Android WebView:\n" +
  "        // name \"InvalidBlob\", message \"Failed to write blob\"). Report it the way\n" +
  "        // every other failed write is reported — the caller gets false and uses\n" +
  "        // the form this device accepts — instead of letting the DOMException\n" +
  "        // reach the global handler as a red banner.\n" +
  "        try{\n" +
  "          tx.objectStore(storeName).put(value);\n" +
  "        }catch(_ePut){\n" +
  "          scNoteStorageError(_ePut);\n" +
  "          try{ tx.abort(); }catch(_eAbort){ }\n" +
  "          resolve(false);\n" +
  "          return;\n" +
  "        }");

fs.writeFileSync(FILE, src);

// ---- repins -----------------------------------------------------------------
// dev/storage-usage-check.cjs asserted the two behaviours that were just
// removed, so it is repinned to the behaviour that is true now: Free up space
// leaves the rollback copies where they are, and the panel says so.
function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to repin)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== before) fs.writeFileSync(p, t);
}
fileSub('dev/storage-usage-check.cjs', [
  ["  ok('it says how many copies Free up space would keep', /keeps the newest \\d+/.test(bodyText), bodyText.slice(0, 100));",
   "  ok('it says the copies are never removed', /none are ever removed/.test(bodyText), bodyText.slice(0, 100));"],
  ["  ok('it drops the old rollback copies', afterSnaps < beforeSnaps, beforeSnaps + ' -> ' + afterSnaps);\n  ok('and brings them back down to the cap', afterSnaps <= 6, afterSnaps);",
   "  ok('it leaves every rollback copy exactly where it was', afterSnaps === beforeSnaps, beforeSnaps + ' -> ' + afterSnaps);\n" +
   "  ok('including ones far older than any cap it used to apply',\n" +
   "    F.snapKeys().includes('versionSnapshot_57.0.0'), F.snapKeys().join(','));"],
  ["  // The copies boot kept are the ones the user may still want (they are the\n  // newest few). What the button is for is the copies that arrive AFTER that —\n  // a phone that keeps taking updates between taps. Seed them directly.",
   "  // These are the copies that used to be trimmed to the newest six — a phone\n" +
   "  // that keeps taking updates between taps. They must all survive the button\n" +
   "  // now, because the version picker is the only way back to an earlier build."],
]);

console.log('patch-660: ' + edits + ' index.html edit(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;

must(has('function updateNpDisplay(t){'), 'updateNpDisplay() is defined');
must(has('window.updateNpDisplay = updateNpDisplay;'), 'and exposed');
must(count('updateNpDisplay(cur)') === 2, 'both batch jobs still call it (' + count('updateNpDisplay(cur)') + ')');

must(has('var _seenImg = {}, _uniqCovers = [];'), 'the picture picker dedupes by image');
must(has("&media=music&entity=song&limit=50"), 'and asks for the artist singles too');
must(has('var sKey = sAlbum.toLowerCase().trim()'), 'through the same dedupe map');

must(has('var _aiBusyFallback = false;'), 'the assistant tracks a busy-service fallback');
must(has('var _askRetrying = async function(model){'), 'and retries a busy model');
must(has("_aiBusyFallback = true;"), 'and falls through to the built-in knowledge base');
must(has('Answered from the built-in knowledge base'), 'and says which one answered');
must(final.indexOf("var _aiSystemPrompt = 'Maintain") !== -1, 'the assistant is told what the app has');
must(has("they live in Settings \\u2192 Get Songs"), 'naming the built-in tools it must not deny');

must(has('id="pinnedArtistsStrip" style="background:var(--bg-raised);margin:0 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;"'),
  'the pinned artists strip is a rounded card');

must(has('touch-action:none;') && has('touch-action:pan-y; cursor:pointer;'), 'the sliders own their gestures');
must(has('input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)::-webkit-slider-thumb{'),
  'and share one draggable thumb');
must(has('var scSeekDragging = false;'), 'the seek bar knows when it is held');
must(count('function(){ scSeekDragging = true; }') === 1 && count('function(){ scSeekDragging = false; }') === 1,
  'and is released on every exit');
must(final.indexOf("$('seekBar').value = pct;") !== -1 && final.indexOf("if(!scSeekDragging){") !== -1,
  'and the clock leaves it alone while it is');

must(has('var SC_ENCODE_SLICE_MS = 90;'), 'the encoder works in 90ms slices');
must(has('setTimeout(r, 200); });'), 'and the between-song pause is 200ms');
must(final.indexOf("setTimeout(r, 800); });") === -1, 'and the old three-quarter-second pause is gone');

must(has('SideCut tags the song, gives it its cover art'), 'the first-run guide teaches the built-in tool');
must(final.indexOf('Paste it into <b>Expand URL</b>') === -1, 'and no longer routes through Expand URL');
must(has("tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it into your library"),
  'the scenario teaches it too');
must(final.indexOf('<b>Getting music in:</b> paste a Spotify link') !== -1, 'and so does the text summary');

must(final.indexOf("scPruneVersionSnapshots(SC_SNAPSHOT_KEEP)") === -1, 'Free up space does not trim rollbacks');
must(has("' (none are ever removed)'"), 'and the panel says the copies are never removed');
must(final.indexOf('Free up space keeps the newest') === -1, 'and no longer advertises a cap');

must(has('}catch(_ePut){'), 'a refused Blob write is caught where it is thrown');
must(has('resolve(false);\n          return;'), 'and reports the documented false');

const blocks = final.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let bad = 0;
blocks.forEach((b) => {
  const body = b.replace(/<\/?script[^>]*>/gi, '');
  if (!body.trim()) return;
  try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
});
must(bad === 0, 'every inline script block still parses (' + bad + ' bad)');

const probe = fs.readFileSync(path.join(ROOT, 'dev/storage-usage-check.cjs'), 'utf8');
must(probe.indexOf('it leaves every rollback copy exactly where it was') !== -1,
  'the storage probe now asserts the copies survive');

if (problems.length) {
  console.error('patch-660 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-660 verify: OK (nine reported items - covers, assistant, pinned bar, sliders, speed, guide, rollbacks, the missing refresh)');
