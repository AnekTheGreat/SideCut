#!/usr/bin/env node
/**
 * SideCut 70.0 - the release patch.
 *
 * Wires the Studio release into index.html:
 *   - APP_VERSION 64.3.1 -> 70.0 and the head changelog entry
 *   - the Studio FX insert inside ensureAudioGraph (the live chain)
 *   - navigate('studio'), the Studio dock tab and the #studioView container
 *   - the Auto-DJ beat gate in onTimeUpdate and the beat align in maybeStartCrossfade
 *   - the Studio speed as a multiplier on every element playbackRate write
 *   - the assistant action hook, the grouped song sheet, the batch-tag button
 *   - the window.__sc* hooks the Studio block reaches through
 *   - dev/sc70-styles.css appended to the app stylesheet
 *   - dev/sc70-module.js spliced in as its own top-level <script> block
 *   - sw.js cache name bump
 *
 * Every edit is anchored and asserted, so a tree that does not match fails loudly
 * instead of being half-patched. Re-running it is a no-op: each step detects its
 * own output.
 *
 *   node dev/patch-70.mjs            # apply
 *   node dev/patch-70.mjs --check    # report only, change nothing
 *   node dev/patch-70.mjs --manifest # re-seed root manifest.json from ota/
 *
 * The root manifest.json is the very first OTA manifest location, kept in step so
 * no installed client left pointing at it is ever told about an older version.
 * dev/ota-bundle.mjs reads the size it just wrote and seeds ota/updates.json, so
 * this has to run AFTER the bundle, never before it.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const CSS = path.join(ROOT, 'dev', 'sc70-styles.css');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const CHECK = process.argv.includes('--check');

const VERSION = '70.0';
// The shell cache has its own counter: it must move on every release so an
// installed service worker pulls the new page, and it must NOT contain the app
// version (the old naming bug that check exists for).
const SHELL_CACHE = 'sidecut-shell-v63.0.30';

// --manifest: re-seed the root manifest.json from the bundle that was just built.
// This is the whole run - the app edits are not touched, so it is safe to run it
// on a tree that is already patched (and that is the normal case: the bundle is
// built after the patch, and the manifest is seeded after the bundle).
if(process.argv.includes('--manifest')){
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  if(String(upd.version) !== VERSION){
    console.error('patch-70 --manifest: ota/updates.json is v' + upd.version + ', expected v' + VERSION + ' - run `node dev/ota-bundle.mjs` first');
    process.exit(1);
  }
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-70 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let html = fs.readFileSync(IDX, 'utf8');
const start = html;
let applied = 0, already = 0, repaired = 0;
const problems = [];

function count(hay, needle){ return hay.split(needle).length - 1; }

// The unit this edit INSERTS - the part of newStr that is not the anchor it was
// hung on. An insert whose anchor survives it (every insert here) is placed
// adjacently, so a run that happened twice left `unit unit` behind and folding
// that back is exact rather than a guess.
function insertUnit(oldStr, newStr, opts){
  if(!newStr || opts.all) return null;
  if(newStr.startsWith(oldStr)) return newStr.slice(oldStr.length);
  if(newStr.endsWith(oldStr)) return newStr.slice(0, newStr.length - oldStr.length);
  return null;
}

function sub(label, oldStr, newStr, opts = {}){
  // Repair first: a doubled insertion from an earlier run of this script is
  // folded back to one copy before anything is decided. (64.3 shipped a patch
  // whose own output was its idempotence marker; this one is anchored, so it can
  // both detect a double and undo it.)
  const unit = insertUnit(oldStr, newStr, opts);
  if(unit && unit.length > 1 && count(html, unit + unit) > 0){
    html = html.split(unit + unit).join(unit);
    repaired++;
  }
  const times = count(html, oldStr);
  // "Has this step already run?" is answered by opts.key when the step is given
  // one, and by the whole of newStr otherwise. The key matters: a step whose
  // OUTPUT gets reworded later (the changelog's wording, the stylesheet) would
  // otherwise stop recognising itself and insert a second copy - the same trap
  // 64.3 fell into, one level up.
  const marker = opts.key || newStr;
  if(opts.all){
    // A global rewrite: the anchor going away IS this step having run.
    if(times === 0){ already++; return; }
  } else if(marker && count(html, marker) >= 1){
    already++;
    return;
  }
  if(times === 0){
    if(opts.optional){ already++; return; }
    problems.push(`anchor missing (${label})`);
    return;
  }
  if(times > 1 && !opts.all && !opts.first){
    problems.push(`anchor is not unique, found ${times} (${label})`);
    return;
  }
  html = opts.all ? html.split(oldStr).join(newStr) : html.replace(oldStr, newStr);
  applied++;
}

function must(cond, what){ if(!cond) problems.push(what); }

/* ------------------------------------------------------------------ 1. version */
sub('version',
  "  const APP_VERSION = '64.3.1';",
  "  // 70.0 opens a new release series rather than advancing 64.3. The third number\n" +
  "  // stops at nine (64.3.1 -> 64.4), and a whole new series reads 70.0 - never\n" +
  "  // 70.0.0, which the updater would treat as the same build.\n" +
  "  const APP_VERSION = '70.0';");

/* --------------------------------------------------------------- 2. changelog */
// The key is the version line, not the notes: the notes are reworded one step
// below, and a step that recognises its work by its own prose stops recognising
// it the moment the prose changes.
sub('changelog head',
  "  const CHANGELOG = [\n",
  "  const CHANGELOG = [\n" +
  "  { version: '70.0', date: 'September 28, 2026 · 7:39 PM EDT', title: 'Studio, achievements, a batch tag editor, gestures, an assistant that acts, and the app reshaped around a bottom dock', items: [\n" +
  "    'Studio is a new tab and one home for the creative tools: crop a section and export it as its own clip, slowed + reverb, karaoke mode, eight sampler pads and a loop recorder. It behaves like a small editing app inside SideCut, and everything on it is applied to what you are hearing as you tap it.',\n" +
  "    'Crop - share as clip exports the section you pick as its own tagged MP3 file, so the same tool doubles as a ringtone maker or a story-clip cutter. Crop song in the song menu still trims the song in place; this is the one that makes a new file.',\n" +
  "    'Achievements and streaks are built on your own stats: the day streak, total hours, songs played, and the first time you use each feature. Thirty badges, a bar on every locked one showing how far along it is, and a badge you unlock is celebrated once and never again.',\n" +
  "    'The storage cleaner now finds your biggest songs and re-encodes any of them to a smaller bitrate in place, with the same Undo the crop flow gives you. Nothing is deleted that you did not pick.',\n" +
  "    'Batch tag editing: long-press a song to start selecting, tick as many as you like, and fix the artist, the album, the genre or the cover for all of them at once. The ID3 tag inside each stored file is rewritten, not just the list.',\n" +
  "    'The assistant acts instead of only answering. \"Crop this from 1:20 to 2:00\", \"make a playlist of my most played songs\", \"turn on the Ember theme\", \"start karaoke\", \"open the storage cleaner\" are done, not described, and it tells you what it did.',\n" +
  "    'Auto-DJ blends on the beat. It reads the tempo of the song that is finishing and the one that is starting, and when the next song has a readable downbeat it starts inside the crossfade on that beat instead of wherever the clock happened to be.',\n" +
  "    'Gesture controls: shake the phone to skip, and swipe the player left or right to change track - dragging on the progress bar seeks. Both can be turned off in Studio, and the shake asks for the motion permission once.',\n" +
  "    'The whole app is reshaped around a bottom dock: Home, Library/Albums, Discover and Studio in one row at the bottom of the screen, with the player sitting above them, so the top of the screen belongs to the page instead of to navigation.',\n" +
  "    'The song ⋮ menu is grouped and readable at last - Play, Edit, Organize, Share and Danger - with a label on every group and the destructive action kept apart from everything else.',\n" +
  "  ] },\n",
  { key: "version: '70.0'" });

/* ------------------------------------------------------- 2b. module source fixes
   The module is a real .js file, so its own edits live here rather than being
   folded into the text above: each one is anchored and asserted like the rest of
   the patch, and a run that finds its output already present is a no-op. */
{
  let mod = fs.readFileSync(MOD, 'utf8');
  const mstart = mod;
  function msub(label, oldStr, newStr){
    const n = mod.split(oldStr).length - 1;
    if(n === 0){
      if(mod.split(newStr).length - 1 >= 1){ already++; return; }
      problems.push(`module anchor missing (${label})`);
      return;
    }
    if(n > 1){ problems.push(`module anchor is not unique, found ${n} (${label})`); return; }
    mod = mod.replace(oldStr, newStr);
    applied++;
  }
  // The grouped ⋮ menu decides a row's group on the WORDS, not the glyph it leads
  // with ('▶ Play now', '🗑 Delete from library').
  msub('song menu group keys',
    "          if(buckets[i].test.test(txt)){ buckets[i].items.push(b); return; }",
    "          // Every row leads with its own glyph ('▶ Play now', '🗑 Delete from\n" +
    "          // library'), so the group a row belongs to is decided on the WORDS -\n" +
    "          // otherwise '^play' never matches a real row and everything lands in\n" +
    "          // one bucket.\n" +
    "          if(buckets[i].test.test(txt.replace(/^[^\\p{L}\\p{N}]+/u, ''))){ buckets[i].items.push(b); return; }");
  if(mod !== mstart){ fs.writeFileSync(MOD, mod); console.log('patch-70: dev/sc70-module.js updated'); }
}

// The changelog is the one text both channels publish, and the store list is held
// to a rule the wider app follows: it never names an audio format or a converter.
// The entry above is written once with the ordinary word for what the clip IS and
// this step puts the store-safe word in its place, so a re-run of the changelog
// step can never re-introduce the other one.
sub('70.0 note wording',
  "    'Crop - share as clip exports the section you pick as its own tagged MP3 file,",
  "    'Crop - share as clip exports the section you pick as its own tagged audio file,");

/* ------------------------------------------------------------------ 3. styles */
// The app has three <style> blocks; the main one is the first, and this is where
// every previous release's CSS landed too. This step REPLACES its own block rather
// than only inserting it, so the stylesheet can be edited without the whole
// release being re-derived: the page always carries the file as it is now.
{
  const cssText = fs.readFileSync(CSS, 'utf8');
  const wrapped = '\n' + cssText + '</style>';
  const cssBlockRe = /\n\/\* =+\n   SideCut 70\.0 -[\s\S]*?<\/style>/;
  if(cssBlockRe.test(html)){
    const before = html;
    html = html.replace(cssBlockRe, wrapped);
    if(html === before) already++; else applied++;
  } else {
    sub('styles', '</style>', wrapped, { first: true, key: '--sc-dock-h: 56px;' });
  }
}

/* --------------------------------------------------------------- 4. dock tab */
sub('studio pill',
  '  <button id="discoverBtn" class="action-pill">Discover</button>\n',
  '  <button id="discoverBtn" class="action-pill">Discover</button>\n' +
  '  <button id="studioBtn" class="action-pill">Studio</button>\n',
  { key: 'id="studioBtn"' });

/* ------------------------------------------------------------ 5. studio view */
sub('studio view container',
  '<div id="nowPlaying">',
  '<!-- Studio: the creative tools, achievements and the storage cleaner -->\n' +
  '<div id="studioView"></div>\n\n' +
  '<div id="nowPlaying">',
  { key: '<div id="studioView"></div>' });

/* ------------------------------------------------------------ 6. navigate() */
sub('navigate isStudio', 
  "    const isLibrary = view === 'library';",
  "    const isLibrary = view === 'library';\n" +
  "    const isStudio = view === 'studio';");

sub('navigate shows player',
  "    if(isHome || isDiscover || isLibrary){\n      $('nowPlaying').style.display = 'flex';\n    }",
  "    if(isHome || isDiscover || isLibrary || isStudio){\n      $('nowPlaying').style.display = 'flex';\n    }");

sub('navigate toggles studio view',
  "    $('discoverView').classList.toggle('active', isDiscover);\n",
  "    $('discoverView').classList.toggle('active', isDiscover);\n" +
  "    $('studioView').classList.toggle('active', isStudio);\n");

sub('navigate highlights studio pill',
  "    $('discoverBtn').classList.toggle('active', isDiscover);",
  "    $('discoverBtn').classList.toggle('active', isDiscover);\n" +
  "    $('studioBtn').classList.toggle('active', isStudio);");

sub('navigate renders studio',
  "if(!isDiscover) stopDiscoverPreview();",
  "    // Studio draws itself on arrival, from the Studio block (a later <script>).\n" +
  "    if(isStudio){ try{ if(window.SC70 && SC70.renderStudio) SC70.renderStudio(); }catch(_eS70){} }\n" +
  "    if(!isDiscover) stopDiscoverPreview();");

/* ------------------------------------------------------- 7. studio tab click */
sub('studio click handler',
  "    navigate($('discoverView').classList.contains('active') ? 'home' : 'discover');\n  });",
  "    navigate($('discoverView').classList.contains('active') ? 'home' : 'discover');\n  });\n" +
  "  $('studioBtn').addEventListener('click', () => {\n" +
  "    navigate($('studioView').classList.contains('active') ? 'home' : 'studio');\n" +
  "  });");

/* ------------------------------------------------- 8. the live Studio FX chain */
sub('audio graph fx insert',
  "        src.connect(bandNodes[0]);\n" +
  "        bandNodes[bandNodes.length - 1].connect(gain).connect(deckGain).connect(limiter).connect(audioCtx.destination);",
  "        src.connect(bandNodes[0]);\n" +
  "        bandNodes[bandNodes.length - 1].connect(gain).connect(deckGain);\n" +
  "        // 70.0 - the Studio insert. The deck now lands in a small chain that has a\n" +
  "        // dry path, a reverb send and a vocal-cancel path, so slowed + reverb and\n" +
  "        // karaoke colour what is ACTUALLY playing instead of a copy of it. The chain\n" +
  "        // is built by the Studio block (a later <script>); when it is not there, or\n" +
  "        // refuses, the deck is wired straight to the limiter exactly as before.\n" +
  "        var scStudioFx = null;\n" +
  "        try{ scStudioFx = (typeof window.scStudioBuildChain === 'function') ? window.scStudioBuildChain(audioCtx, idx, deckGain, limiter) : null; }catch(_eScFx){ scStudioFx = null; }\n" +
  "        if(!scStudioFx) deckGain.connect(limiter);\n" +
  "        limiter.connect(audioCtx.destination);");

/* ---------------------------------------------- 9. studio speed on every deck */
sub('playbackRate sites',
  '.playbackRate = playbackSpeed;',
  '.playbackRate = playbackSpeed * (typeof window.__scStudioRate === \'function\' ? window.__scStudioRate() : 1);',
  { all: true });

/* ------------------------------------------------------- 10. Auto-DJ beat gate */
sub('crossfade beat gate',
  "      if(crossfadeSeconds > 0 && remaining <= crossfadeSeconds && remaining > 0){\n" +
  "        // Crossfade wins when it's enabled (crossfadeSeconds > 0) — it's the\n" +
  "        // audible blend. Gapless only applies when crossfade is off.\n" +
  "        maybeStartCrossfade();",
  "      if(crossfadeSeconds > 0 && remaining <= crossfadeSeconds && remaining > 0){\n" +
  "        // Crossfade wins when it's enabled (crossfadeSeconds > 0) — it's the\n" +
  "        // audible blend. Gapless only applies when crossfade is off.\n" +
  "        //\n" +
  "        // 70.0 Auto-DJ: the blend is held back until the OUTGOING song is on a\n" +
  "        // beat, so the two tracks hand over on the grid instead of mid-bar.\n" +
  "        // __scAutoDjGate answers 'yes' when Auto-DJ is off or the tempo is not\n" +
  "        // known yet, and it gives up on its own with less than a beat to go.\n" +
  "        var scBeatOk = true;\n" +
  "        try{ scBeatOk = (typeof window.__scAutoDjGate !== 'function') || window.__scAutoDjGate(a, remaining); }catch(_eScBeat){ scBeatOk = true; }\n" +
  "        if(scBeatOk) maybeStartCrossfade();");

/* ------------------------------------------- 11. Auto-DJ align the incoming song */
sub('crossfade beat align',
  "    nxt.currentTime = 0;\n    nxt.volume = 0;",
  "    nxt.currentTime = 0;\n" +
  "    // 70.0 Auto-DJ: start the incoming song on its own first downbeat, so the\n" +
  "    // blend lands on a beat from both sides rather than only the outgoing one.\n" +
  "    try{\n" +
  "      if(typeof window.__scAutoDjAlign === 'function'){\n" +
  "        var scAlign = window.__scAutoDjAlign(activeAudio(), nextTrack);\n" +
  "        if(scAlign > 0 && isFinite(scAlign) && scAlign < (nextTrack.duration || 1e9)) nxt.currentTime = scAlign;\n" +
  "      }\n" +
  "    }catch(_eScAlign){}\n" +
  "    nxt.volume = 0;");

/* ---------------------------------------------------- 12. the assistant acts */
sub('assistant action hook',
  "  // A question the app has a real answer for is answered from the app itself,",
  "  // 70.0 - a request the app can CARRY OUT is carried out. This runs before the\n" +
  "  // knowledge base and before the model: the app either did it and says so, or it\n" +
  "  // answers the question the old way. window.SCACT lives in the Studio block.\n" +
  "  try{\n" +
  "    if(window.SCACT && typeof window.SCACT.tryRun === 'function'){\n" +
  "      var _scAction = window.SCACT.tryRun(msg);\n" +
  "      if(_scAction){\n" +
  "        _aiTyping = false;\n" +
  "        _aiAddMessage('assistant', _scAction);\n" +
  "        _aiChatHistory.push({ role: 'assistant', text: _scAction });\n" +
  "        if(statusEl) statusEl.textContent = 'Done in SideCut';\n" +
  "        return;\n" +
  "      }\n" +
  "    }\n" +
  "  }catch(_eScAct){}\n\n" +
  "  // A question the app has a real answer for is answered from the app itself,");

/* ----------------------------------------------------- 13. the grouped ⋮ menu */
sub('song sheet decorator',
  "    $('songActionsBackdrop').style.display = 'flex';\n  }\n  $('songActionsCancel').addEventListener('click', () => { $('songActionsBackdrop').style.display = 'none'; });",
  "    // 70.0 - group the sheet (Play / Edit / Organize / Share / Danger) and give\n" +
  "    // each row an icon. The buttons and their listeners are the ones built above;\n" +
  "    // they are only moved and labelled, so nothing this sheet does changes.\n" +
  "    try{ if(typeof window.__scDecorSongSheet === 'function') window.__scDecorSongSheet(); }catch(_eScSheet){}\n" +
  "    $('songActionsBackdrop').style.display = 'flex';\n  }\n  $('songActionsCancel').addEventListener('click', () => { $('songActionsBackdrop').style.display = 'none'; });");

/* ------------------------------------------------------------ 14. crop flag */
// NOTE the literal backslashes: the app's own source carries \" here (the crop
// toast is inside a template that needed the escape), and the anchor has to be
// the bytes on disk, not the bytes a reader sees.
sub('crop feature flag',
  "      toastWithUndo('Cropped \\\"' + _cropName + '\\\" to ' + cropFmtTime(slice.duration), function(){ uncropSong(_cropId); });",
  "      try{ if(window.SC70 && SC70.markFeature) SC70.markFeature('crop'); }catch(_eScCrop){}\n" +
  "      toastWithUndo('Cropped \\\"' + _cropName + '\\\" to ' + cropFmtTime(slice.duration), function(){ uncropSong(_cropId); });");

/* --------------------------------------------------- 15. batch tag in the bar */
sub('select bar tag button',
  '          <button class="icon-btn" id="selectExportBtn" title="Export selected to .zip">',
  '          <button class="icon-btn" id="selectTagBtn" title="Edit the tags of the selected songs"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>\n' +
  '          <button class="icon-btn" id="selectExportBtn" title="Export selected to .zip">');

sub('select bar tag handler',
  "      $('selectExportBtn').addEventListener('click', exportSelected);",
  "      $('selectTagBtn').addEventListener('click', function(){\n" +
  "        try{ if(window.SC70 && SC70.openBatchTags) SC70.openBatchTags(Array.from(selectedIds)); }catch(_eScTag){}\n" +
  "      });\n" +
  "      $('selectExportBtn').addEventListener('click', exportSelected);");

/* --------------------------------------- 16. mp3 encoder takes a target bitrate */
sub('mp3 encoder kbps',
  "  async function scEncodeMp3Cooperative(buf, meta, onSlice){\n" +
  "    if(typeof lamejs === 'undefined') return null;\n" +
  "    var chCount = Math.max(1, Math.min(2, buf.numberOfChannels || 1));\n" +
  "    var sr = Math.max(8000, Math.min(48000, Math.round(buf.sampleRate || 44100)));\n" +
  "    var enc = new lamejs.Mp3Encoder(chCount, sr, 192);",
  "  // kbps defaults to 192 (every existing caller) and is passed by the Studio's\n" +
  "  // re-encoder, which is the one caller that WANTS a different bitrate.\n" +
  "  async function scEncodeMp3Cooperative(buf, meta, onSlice, kbps){\n" +
  "    if(typeof lamejs === 'undefined') return null;\n" +
  "    var chCount = Math.max(1, Math.min(2, buf.numberOfChannels || 1));\n" +
  "    var sr = Math.max(8000, Math.min(48000, Math.round(buf.sampleRate || 44100)));\n" +
  "    var enc = new lamejs.Mp3Encoder(chCount, sr, Math.max(32, Math.min(320, parseInt(kbps, 10) || 192)));");

/* --------------------------------------------------------- 17. the hooks */
sub('studio hooks',
  "\n})();\n</script>\n<script>\n",
  "\n" +
  "  // ---- 70.0 Studio hooks ----------------------------------------------------\n" +
  "  // The Studio block is a separate top-level <script> with its own closure, so it\n" +
  "  // sees globals only. Everything it needs is published here, next to the rest of\n" +
  "  // the exposure list, and every one of them is a plain read or a named call.\n" +
  "  window.__scAllTracks = function(){ return allTracks; };\n" +
  "  window.__scTrack = function(id){ for(var _i = 0; _i < allTracks.length; _i++){ if(allTracks[_i] && allTracks[_i].id === id) return allTracks[_i]; } return null; };\n" +
  "  window.__scCurrentTrack = function(){ return (queueIndex >= 0 && queue[queueIndex]) ? (window.__scTrack(queue[queueIndex])) : null; };\n" +
  "  window.__scQueue = function(){ return queue; };\n" +
  "  window.__scQueueIndex = function(){ return queueIndex; };\n" +
  "  window.__scPlaylists = function(){ return playlists; };\n" +
  "  window.__scSetPlaylist = function(name, ids){\n" +
  "    if(!name) return false;\n" +
  "    playlists[name] = (ids || []).slice();\n" +
  "    saveMeta();\n" +
  "    renderTabs();\n" +
  "    renderList();\n" +
  "    return true;\n" +
  "  };\n" +
  "  window.__scActiveAudio = activeAudio;\n" +
  "  window.__scAudios = function(){ return audios; };\n" +
  "  window.__scPlaybackSpeed = function(){ return playbackSpeed; };\n" +
  "  window.__scSelectedIds = function(){ return Array.from(selectedIds); };\n" +
  "  window.__scEnterSelect = function(ids){ selectMode = true; selectedIds = new Set(ids || []); renderList(); };\n" +
  "  window.__scPersistTrack = function(t){ return persistTrackMeta(t); };\n" +
  "  window.__scRenderList = function(){ renderList(); };\n" +
  "  window.__scFmtBytes = scFmtBytes;\n" +
  "  window.__scId3 = scId3v23Bytes;\n" +
  "  window.__scStats = function(){\n" +
  "    var _plays = totalPlays || 0, _secs = totalListenSeconds || 0;\n" +
  "    // \"after 1 AM\" is counted from what the app already records per song, so the\n" +
  "    // night-owl badge needs no new counter of its own.\n" +
  "    var _night = 0;\n" +
  "    try{ allTracks.forEach(function(t){ if(t && t.lastPlayedAt){ var h = new Date(t.lastPlayedAt).getHours(); if(h >= 1 && h < 5) _night++; } }); }catch(_eNight){}\n" +
  "    return { plays: _plays, listenSeconds: _secs, library: allTracks.length, streak: computeStreak(), longest: longestStreak || 0, nightPlays: _night };\n" +
  "  };\n" +
  "  window.__scEncodeMp3 = function(buf, kbps, meta){ return scEncodeMp3Cooperative(buf, meta, null, kbps); };\n" +
  "  window.__scEncodeWav = function(buf, meta){ return scEncodeWavCooperative(buf, meta, null); };\n" +
  "  window.__scSaveClip = async function(blob, fName){\n" +
  "    try{ if(await scNativeSaveBlob(blob, fName)) return true; }catch(_eNative){}\n" +
  "    return scDownloadBlob(blob, fName);\n" +
  "  };\n" +
  "  window.__scNext = function(){ try{ $('nextBtn').click(); }catch(e){} };\n" +
  "  window.__scPrev = function(){ try{ $('prevBtn').click(); }catch(e){} };\n" +
  "  window.__scPause = function(){ try{ var _a = activeAudio(); if(_a && !_a.paused) $('playPauseBtn').click(); }catch(e){} };\n" +
  "  window.__scResume = function(){ try{ var _a2 = activeAudio(); if(_a2 && _a2.paused) $('playPauseBtn').click(); }catch(e){} };\n" +
  "\n})();\n</script>\n<script>\n");

/* ------------------------------------------------------------ 18. the module */
// The Studio block is spliced from dev/sc70-module.js. It is RE-spliced (the old
// block is replaced in place) rather than only inserted, so a change to the
// module can be carried over without the whole release being re-derived - and
// index.html is too large for the editor tools to reach into, which is why the
// module is kept as its own file in the first place.
{
  const mod = fs.readFileSync(MOD, 'utf8');
  const openTag = '<script id="sc-studio-70">';
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = openTag + '\n' + mod + '</script>\n';
  if(blockRe.test(html)){
    const before = html;
    html = html.replace(blockRe, wrapped);
    if(html === before) already++; else applied++;
  } else {
    sub('studio module block', '</body>', wrapped + '</body>');
  }
}

/* ------------------------------------------------------------------- checks */
must(count(html, "const APP_VERSION = '70.0';") === 1, 'version is not 70.0 exactly once');
must(count(html, "version: '70.0'") === 1, 'the 70.0 changelog entry is missing');
must(count(html, 'id="studioBtn"') === 1, 'the Studio dock tab is missing');
must(count(html, 'id="studioView"') === 1, 'the Studio view container is missing');
// Each of these counts the wire in index.html PLUS its definition in the Studio
// block, which is the point: the hook is only real if both halves are there.
must(count(html, 'scStudioBuildChain') === 4, 'the FX chain is not inserted and built (' + count(html, 'scStudioBuildChain') + ')');
must(count(html, '__scStudioRate') >= 6, 'the Studio speed is not a multiplier on every deck (' + count(html, '__scStudioRate') + ')');
must(count(html, '__scAutoDjGate') === 4, 'the Auto-DJ beat gate is not wired (' + count(html, '__scAutoDjGate') + ')');
must(count(html, '__scAutoDjAlign') === 3, 'the Auto-DJ align is not wired (' + count(html, '__scAutoDjAlign') + ')');
must(count(html, 'window.SCACT') === 6, 'the assistant action hook is missing (' + count(html, 'window.SCACT') + ')');
must(count(html, '__scDecorSongSheet') === 3, 'the grouped song sheet is not wired (' + count(html, '__scDecorSongSheet') + ')');
must(count(html, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');
must(count(html, "const APP_VERSION = '64.3.1'") === 0, 'the old version string is still there');
must(count(html, "const CHANGELOG") === 1, 'the changelog head is wrong');
must(count(html, '.sc-tools{') === 2, 'the Studio stylesheet is not in the page (' + count(html, '.sc-tools{') + ')');
must(count(html, '#studioView.active') === 1, 'the Studio view has no display rule (' + count(html, '#studioView.active') + ')');

if(problems.length){
  console.error('patch-70: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

const note = (already ? ', ' + already + ' already in place' : '') + (repaired ? ', ' + repaired + ' doubled insertion(s) folded back' : '');
if(CHECK){
  console.log('patch-70: ' + (applied ? applied + ' edit(s) would be applied' : 'tree is already at 70.0') + note);
  process.exit(0);
}

if(html === start){
  console.log('patch-70: nothing to do, index.html is already patched' + note);
} else {
  fs.writeFileSync(IDX, html);
  console.log('patch-70: index.html patched (' + applied + ' edit(s)' + note + ')');
}

/* --------------------------------------------------------------------- sw.js */
try{
  const sw = fs.readFileSync(SW, 'utf8');
  const m = sw.match(/const CACHE_NAME = '([^']+)';/);
  if(m && m[1] !== SHELL_CACHE){
    // The shell cache name is monotonic on purpose - it is what makes an installed
    // service worker pull the new index.html instead of serving the old one. It
    // runs on its OWN counter (the app version deliberately does not appear in it,
    // and dev/test-66431 asserts that), so it steps v63.0.29 -> v63.0.30 here.
    fs.writeFileSync(SW, sw.replace(m[0], "const CACHE_NAME = '" + SHELL_CACHE + "';"));
    console.log('patch-70: sw.js cache ' + m[1] + ' -> ' + SHELL_CACHE);
  } else if(m){
    console.log('patch-70: sw.js cache already ' + SHELL_CACHE);
  } else {
    console.error('patch-70: could not find CACHE_NAME in sw.js');
  }
}catch(e){
  console.error('patch-70: sw.js not updated (' + e.message + ')');
}
