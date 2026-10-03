#!/usr/bin/env node
/**
 * SideCut 72.5.2 - the widget can pause, and now it can play again.
 *
 * The owner's report, after 72.5.1 put the widget's presses back on SideCut's own
 * media session: "The widgit can pause but not play again and forward and
 * backward songs don't work".
 *
 * That is the shape of a press that STOPS working and a press that STARTS not
 * working, and there are two independent reasons for it - one on each side of the
 * bridge. Both are fixed here.
 *
 * 1. STOPPING SET A MARK, STARTING NEVER CLEARED IT.
 *    A pause (and stop) sets `userPaused`, the flag that tells the background
 *    heartbeat "this stop was deliberate - do not revive it". Nothing in the
 *    media-session transport cleared it again, so after a pause from the widget
 *    every later play / next / previous ran with that mark still set - and the
 *    ONE mechanism that restores a backgrounded WebView refuses to run while it
 *    is set: `recoverAudio` returns at `if(userPaused) return`, and the revive
 *    loop is gated on `!userPaused`. The song the phone reclaimed while the app
 *    was away could not be rebuilt, so play and skip came out silent. Pause
 *    needed none of that and kept working, which is exactly the asymmetry in the
 *    report. A transport press is you asking for sound, so it now clears the mark
 *    (and the interruption latch) before it acts.
 *
 * 2. THE PLAY/PAUSE BUTTON ASKED THE PHONE TO DECIDE.
 *    The widget sent KEYCODE_MEDIA_PLAY_PAUSE, a TOGGLE: the system resolves it
 *    against the playback state IT last saw for the session, and keeps resolving
 *    it that way until that state changes. A stale state answers "pause" for
 *    ever, which is "can pause but not play again". The widget already knows what
 *    its own icon is showing, so it now names the verb - MEDIA_PLAY or
 *    MEDIA_PAUSE - and only falls back to the toggle when it has no state to go on.
 *
 * EVERY sub is an insertion or a swap and carries a `key`, so re-running this on
 * a tree that already has it applied is a no-op instead of a second insertion.
 *
 *   node dev/patch-7252.mjs
 *   node dev/patch-7252.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const WIDGET = path.join(ROOT, '.github', 'workflows', 'patch-widget.py');

const CHECK = process.argv.includes('--check');
const VERSION = '72.5.2';
const STAMP = 'October 2, 2026 \\u00b7 8:53 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.5.1';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'The widget play button works again after a pause';
const NOTES = [
  'The play button on the home-screen widget works again after a pause. A press to stop marks playback as deliberate, and every later press to start sound was being turned away by that same mark.',
  'Next and previous on the widget really move the song along now, instead of quietly switching the track while the app stayed silent in the background.',
  'A press on the widget is treated as you asking for sound, so it clears the deliberate-stop mark and lets the player rebuild a song the phone had reclaimed while you were away.',
  'The play and pause button names the action it wants instead of asking the phone to decide, so it can never be left stuck on pause after the app has been away.',
  'The heartbeat that keeps the outside controls alive is restarted by a widget press, so a song you bring back keeps its widget and lock-screen buttons.',
  'Nothing about your songs, playlists or settings changed. Your library, your queue and your saved songs are read exactly as they were.',
  'The previous button still restarts the song that is playing once you are a few seconds in, and still moves to the song before it in the opening seconds.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

let applied = 0, already = 0;

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const widget = holder(fs.readFileSync(WIDGET, 'utf8'));

// NO TOP GUARD, on purpose - the same reasoning as 72.5.1. Every sub here is an
// insertion or a swap and carries a `key`, so re-running on a half-applied or
// fully-applied tree adds exactly what is missing and nothing else.

/* ============================================================================
   1. THE VERSION
   ========================================================================== */
sub(html, 'the app runs 72.5.2',
  "  const APP_VERSION = '72.5.1';\n",
  "  const APP_VERSION = '72.5.2';\n",
  { key: "const APP_VERSION = '72.5.2';" });

/* ============================================================================
   2. THE CHANGELOG HEAD
   ========================================================================== */
const headEntry = [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...NOTES.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');

sub(html, 'the changelog carries the 72.5.2 entry at its head',
  "  const CHANGELOG = [\n" +
  "  { version: '" + OLDVER + "', date:",
  "  const CHANGELOG = [\n" +
  headEntry + "\n" +
  "  { version: '" + OLDVER + "', date:",
  { key: "{ version: '" + VERSION + "', date: '" + STAMP + "'" });

/* ============================================================================
   3. THE SHELL CACHE
   ========================================================================== */
sub(sw, 'the shell cache is the release name',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ============================================================================
   4. A TRANSPORT PRESS IS YOU ASKING FOR SOUND
   --------------------------------------------------------------------------
   Stopping sets `userPaused` so the background heartbeat will not revive a
   deliberate pause. Nothing cleared it when a press STARTED playback, so play,
   next and previous from the widget ran with the mark set - and both recovery
   paths refuse to run while it is set. Clear it, and give the play handler one
   retry for the reclaimed-blob case it exists for.
   ========================================================================== */
sub(html, 'a transport press clears the deliberate-stop mark, and play retries',
  "  function registerMediaSessionHandlers(){\n" +
  "    mediaSetActionHandler('play', () => {\n" +
  "      if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});\n" +
  "      activeAudio().play().catch(() => recoverAudio(activeAudio(), 'media session play failed'));\n" +
  "    });\n",
  "  // 72.5.2 - A TRANSPORT PRESS IS YOU ASKING FOR SOUND.\n" +
  "  // Stopping (pause, stop) sets `userPaused`, which is what tells the background\n" +
  "  // heartbeat \"this was deliberate, do not revive it\". But nothing that STARTS\n" +
  "  // playback ever cleared it, so after a pause from the home-screen widget every\n" +
  "  // later play / next / previous ran with the mark still set - and the one thing\n" +
  "  // that puts a backgrounded WebView back together refuses to run while it is\n" +
  "  // set: recoverAudio returns at `if(userPaused) return`, and the revive loop is\n" +
  "  // gated on `!userPaused`. A song the phone reclaimed while the app was away\n" +
  "  // could not be rebuilt, so the resume and the skips came out silent while pause\n" +
  "  // - which needs none of that - kept working. A press that asks for sound is not\n" +
  "  // an interruption to be left alone, so it clears the mark first.\n" +
  "  function scTransportResume(){\n" +
  "    userPaused = false;\n" +
  "    audioFocusInterrupted = false;\n" +
  "  }\n" +
  "  function registerMediaSessionHandlers(){\n" +
  "    mediaSetActionHandler('play', () => {\n" +
  "      try{ scTransportResume(); }catch(e){}\n" +
  "      if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});\n" +
  "      const _pa = activeAudio();\n" +
  "      if(!_pa) return;\n" +
  "      // The blob URL can have gone dead while the app was away - a rejected\n" +
  "      // play() is exactly the case recoverAudio exists for. Retry once so a\n" +
  "      // platform that refuses the first attempt is not the end of the song.\n" +
  "      _pa.play().catch(() => {\n" +
  "        try{ recoverAudio(_pa, 'media session play failed'); }catch(e){}\n" +
  "        setTimeout(function(){ if(_pa.paused && !userPaused) _pa.play().catch(function(){}); }, 400);\n" +
  "      });\n" +
  "    });\n",
  { key: 'function scTransportResume(){' });

sub(html, 'a skip from the widget is a request to hear the song, not a silent move',
  "    mediaSetActionHandler('previoustrack', () => {\n" +
  "      const _a = activeAudio();\n" +
  "      if(_a && _a.currentTime > 3){ try{ _a.currentTime = 0; }catch(e){} return; }\n" +
  "      hardAdvance(-1, true);\n" +
  "    });\n" +
  "    mediaSetActionHandler('nexttrack', () => hardAdvance(1, true));\n",
  "    mediaSetActionHandler('previoustrack', () => {\n" +
  "      try{ scTransportResume(); }catch(e){}\n" +
  "      const _a = activeAudio();\n" +
  "      // A press here that lands on a paused song starts it again rather than\n" +
  "      // moving the playhead on a player nobody can hear.\n" +
  "      if(_a && _a.paused){ try{ _a.play().catch(function(){}); }catch(e){} }\n" +
  "      if(_a && _a.currentTime > 3){ try{ _a.currentTime = 0; }catch(e){} return; }\n" +
  "      hardAdvance(-1, true);\n" +
  "    });\n" +
  "    mediaSetActionHandler('nexttrack', () => {\n" +
  "      // 72.5.2 - a skip is a request to HEAR the next song: the deliberate-stop\n" +
  "      // mark an earlier pause left behind must not silence it in the background.\n" +
  "      try{ scTransportResume(); }catch(e){}\n" +
  "      hardAdvance(1, true);\n" +
  "    });\n",
  { key: 'if(_a && _a.paused){ try{ _a.play().catch(function(){}); }catch(e){} }' });

/* ============================================================================
   5. THE WIDGET NAMES ITS OWN VERB
   --------------------------------------------------------------------------
   KEYCODE_MEDIA_PLAY_PAUSE is a toggle resolved against the session's playback
   state; a stale state keeps it on "pause". The widget draws its own icon from
   the state it was pushed, so it may as well send that verb outright. The exact
   `int code = 0;` / `_prev` / `_next` lines are left alone - dev/test-7251.mjs
   slices the provider from that anchor.
   ========================================================================== */
sub(widget, 'the play/pause press names the verb the widget is showing',
  "        else if (action.endsWith(\"_playpause\")) code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;\n",
  "        else if (action.endsWith(\"_playpause\")) {\n" +
  "            // 72.5.2 - NAME THE ACTION. KEYCODE_MEDIA_PLAY_PAUSE is a TOGGLE the\n" +
  "            // system resolves against the playback state IT last saw for the\n" +
  "            // session, and a stale state kept answering pause - which is why the\n" +
  "            // widget could pause but never play again. The widget already knows\n" +
  "            // what its own icon says, so it sends that verb directly, and falls\n" +
  "            // back to the toggle only when it has no state to go on.\n" +
  "            boolean known = false, playing = false;\n" +
  "            try {\n" +
  "                android.content.SharedPreferences sp =\n" +
  "                        context.getSharedPreferences(\"sidecut_widget\", Context.MODE_PRIVATE);\n" +
  "                org.json.JSONObject st = new org.json.JSONObject(sp.getString(\"state\", \"{}\"));\n" +
  "                if (st.has(\"playing\")) { known = true; playing = st.optBoolean(\"playing\", false); }\n" +
  "            } catch (Exception ignored) {\n" +
  "            }\n" +
  "            code = !known ? KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE\n" +
  "                    : (playing ? KeyEvent.KEYCODE_MEDIA_PAUSE : KeyEvent.KEYCODE_MEDIA_PLAY);\n" +
  "        }\n",
  { key: 'KEYCODE_MEDIA_PLAY_PAUSE\n                    : (playing ? KeyEvent.KEYCODE_MEDIA_PAUSE' });

/* ============================================================================
   6. THE OTA TAIL
   --------------------------------------------------------------------------
   ota-fixpoint.mjs iterates the bundle size against the manifest's own `size`
   field, and at this page's size the loop can two-cycle. One trailing newline
   after </html> is the lever 72.5.1 settled on. It is done with code rather than
   a `sub` because it is a REMOVAL, and a key can only ever mean "the text I add
   is already here". Trimming to exactly one newline is idempotent.
   ========================================================================== */
{
  const trimmed = html.text.replace(/\s*$/, '');
  const want = trimmed.endsWith('</html>') ? trimmed + '\n' : trimmed;
  if (html.text !== want) {
    if (process.env.SC_DEBUG) console.log('  normalising the OTA tail to one newline');
    html.text = want;
    applied++;
  } else {
    already++;
  }
}

if (problems.length) {
  console.error('patch-7252: ' + problems.join('\n             '));
  process.exit(1);
}

if (!CHECK) {
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
  fs.writeFileSync(WIDGET, widget.text);
}

console.log('patch-7252: ' + applied + ' applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
