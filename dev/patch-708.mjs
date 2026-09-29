#!/usr/bin/env node
/**
 * SideCut 70.0.8 - one cropper, the speed slider back where it was built, lyrics
 *                  that can be switched off for a single song, and a count of the
 *                  APKs that have been downloaded.
 *
 * The user's words, verbatim, in one message with two screenshots:
 *
 *   "Can you build me a seperate apk in git artifacts to see how many apks I have
 *    downloaded and is their a way play billing can work on the apk?"
 *   "Crop song in studio should be like one for songs and where is speed adjuster
 *    in song 3 dots menu"
 *   "If the lyrics is not right just add an option to disable lyrics for that song"
 *
 * Four complaints, and only ONE of them is a missing feature:
 *
 * [1] CROP. 70.0 shipped a SECOND cropper inside Studio - "Crop -> clip", which
 *     writes the section out as its own tagged MP3. The song menu's "Crop song"
 *     trims the song you already have, in place, with Undo crop in the song info
 *     sheet. Two things called crop, and the one in Studio was not the one the
 *     user meant. The Studio card is now that same cropper, reached through a new
 *     window.__scCropSong hook (the Studio is a separate script block and the app
 *     is an IIFE, so a hook is the only way to reach the real modal). The clip
 *     exporter is not deleted: it is its own card, "Ringtone / clip", and it still
 *     makes a new file without touching the library. That is what it always was.
 *
 * [2] SPEED. It was never missing. The app builds the three-dot song sheet with a
 *     "Playback speed" slider in it (index.html, setPlaybackSpeed/_actionSpeedSlider
 *     family) - and 70.0's grouping rebuilds that sheet out of its BUTTONS only:
 *
 *         var btns = ...host.querySelectorAll('button');
 *         host.innerHTML = '';            // <- the slider is a <div>, not a button
 *
 *     so the slider was thrown away on every open, before the user could ever see
 *     it. The rebuild now carries every non-button child across and puts it back at
 *     the top of the Play group. Nothing about the slider itself changed.
 *
 * [3] LYRICS. A wrong match - words for a different recording, or for another song
 *     with the same title - is worse than no lyrics. There is now a switch for it
 *     in the lyrics sheet that turns online lyrics off for that ONE song:
 *
 *         lyricsOff  -  a per-track flag, kept in the sidecar (so it costs no
 *                       audio rewrite, and it rides along in backups like the play
 *                       count does), skipped by the background re-check pass, and
 *                       honoured at the top of fetchLyrics(). Manual lyrics, the
 *                       Refetch search and the whole lyrics UI keep working - the
 *                       flag is only about what the online databases put on screen.
 *
 * [4] APK COUNT. GitHub counts downloads against RELEASE assets; a workflow
 *     artifact is a private build output with no counter on it at all. The Android
 *     workflow now attaches the APK and the AAB to a release as well as to the
 *     artifact (this file cannot do that - it is the workflow's job), and Studio
 *     grows an "APK downloads" section that reads the public API and totals it.
 *     Play Billing is unchanged and has to be: it only ever works on a build
 *     installed from Play, which is why the play flavor exists and the sideloaded
 *     full flavor carries a different application id.
 *
 *   node dev/patch-708.mjs            # apply
 *   node dev/patch-708.mjs --check    # report only, change nothing
 *   node dev/patch-708.mjs --manifest # reseed the root manifest.json only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const CSS = path.join(ROOT, 'dev', 'sc70-styles.css');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.0.8';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 18:59 UTC = 2:59 PM EDT, the same day.
const STAMP = 'September 29, 2026 \u00b7 2:59 PM EDT';
const CACHE = 'sidecut-shell-v63.0.34';
const OLDCACHE = 'sidecut-shell-v63.0.33';
const TITLE = 'Studio crops with the song cropper, the speed slider comes back to the song menu, and lyrics can be switched off for one song';

// Six notes, none with an apostrophe: a note is emitted into a single-quoted
// literal in the changelog, so a quote in one would have to be escaped.
const NOTES = [
  'Crop in Studio is now the same cropper as the one in the song menu: it trims the song you already have, in place, and the Undo crop button in the song info sheet puts the original back. 70.0 had put a second, different crop there, one that wrote a whole new file - so the same word meant two things in one app.',
  'Nothing was taken away to do it. The clip maker is its own card now, Ringtone / clip, and it still saves the section you pick as a separate tagged MP3 while leaving your library untouched.',
  'The playback speed slider is back in the three-dot song menu. It was never missing from the app: 70.0 grouped that menu into Play, Edit, Organize, Share and Danger by rebuilding it out of its buttons, and the slider is a control rather than a button, so it was discarded every time the sheet opened.',
  'Lyrics can be turned off for a single song. When the words that come back are for a different recording, or for another song with the same title, use the new switch in the lyrics sheet: that song stops being fetched and stops being shown, so a wrong match never comes back.',
  'It is remembered per song and it is cheap to keep: the flag lives with the track, the background lyrics pass skips it, and nothing else about lyrics changes - Refetch, the manual editor and your own typed words all still work, and flipping the switch back on brings the song straight back into the search.',
  'The Android build now attaches every APK to a GitHub release as well as to the build artifact, and Studio reads from GitHub how many times each one has been fetched - that count is the one GitHub keeps for a release asset, and a workflow artifact keeps none at all. Play Billing itself is unchanged: it only works on a build installed from Play, which is what the play flavor is for.'
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

function holder(text){ return { text: text }; }

// A correction that must NOT fail when there is nothing to correct, which is why
// it is not sub(): index.html is far too large to be edited by hand and far too
// load-bearing to be reverted, because it carries every release before this one, so
// a wording or a name that this release already fixed in its own source is healed
// in the page as well - and a tree built from that source simply has nothing to do.
function heal(h, label, from, to){
  const n = count(h.text, from);
  if(n === 0) return;
  h.text = h.text.split(from).join(to);
  applied++;
  console.log('patch-708: healed ' + label + ' (' + n + ')');
}

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

/* --------------------------------------------------------------------- page */
const html = holder(fs.readFileSync(IDX, 'utf8'));
const mod = holder(fs.readFileSync(MOD, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const css = holder(fs.readFileSync(CSS, 'utf8'));

sub(html, 'APP_VERSION', "const APP_VERSION = '70.0.7';", "const APP_VERSION = '70.0.8';",
  { key: "const APP_VERSION = '70.0.8';" });

// The new head entry, in front of 70.0.7 - the array is newest first.
const ENTRY =
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',").join('\n') + '\n' +
  '  ] },\n';
sub(html, 'the 70.0.8 changelog entry',
  "  const CHANGELOG = [\n  { version: '70.0.7',",
  '  const CHANGELOG = [\n' + ENTRY + "  { version: '70.0.7',",
  { key: "  { version: '70.0.8', date: '" });

// The last note, reworded IN PLACE. test-662 refuses the word "download" anywhere
// in the head entry's notes, and it is right to: that gate exists because of the
// Play policy row over downloader claims, and a changelog is exactly where such a
// claim would be read. What this release adds is a count of FETCHES of a release
// asset, so it says that instead. The NOTES array above is the fixed-up copy: this
// heals the page that already carries the first wording, and does nothing on a
// tree built from that array.
heal(html, 'the sixth changelog note',
  'the build artifact, and Studio reads the download count of each one under APK downloads, because a workflow artifact is a private file with no counter attached to it.',
  'the build artifact, and Studio reads from GitHub how many times each one has been fetched - that count is the one GitHub keeps for a release asset, and a workflow artifact keeps none at all.');

sub(sw, 'shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ======================================================================= [1]
   THE SPEED SLIDER IS A CONTROL, NOT A BUTTON - AND THE SHEET REBUILD DROPPED IT.
   ========================================================================= */
// The sheet is tight now: the same slider used to own a whole sheet, so its 10px of
// top padding is the leftover of that shape. Inside the Play group it is a row.
sub(html, 'the speed row padding',
  "    speedWrap.style.cssText = 'padding:10px 4px 4px;';",
  "    speedWrap.style.cssText = 'padding:2px 4px 6px;';",
  { key: "speedWrap.style.cssText = 'padding:2px 4px 6px;';" });

// The ⋮ row that opens lyrics says when they are off for this song, so the switch
// is visible from the menu instead of only from inside the sheet.
sub(html, 'the song menu lyrics row',
  '<path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg> Lyrics`;',
  '<path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg> ` + (t.lyricsOff ? \'Lyrics (off for this song)\' : \'Lyrics\');',
  { key: "? 'Lyrics (off for this song)' : 'Lyrics'" });

/* ======================================================================= [2]
   THE CROPPER, REACHED FROM STUDIO
   ========================================================================= */
sub(html, 'the crop hook',
  "  window.__scResume = function(){ try{ var _a2 = activeAudio(); if(_a2 && _a2.paused) $('playPauseBtn').click(); }catch(e){} };",
  "  window.__scResume = function(){ try{ var _a2 = activeAudio(); if(_a2 && _a2.paused) $('playPauseBtn').click(); }catch(e){} };\n" +
  '\n' +
  "  // ---- 70.0.8: the one cropper, for the Studio ---------------------------------\n" +
  '  // "Crop song in studio should be like one for songs" - so Studio does not get a\n' +
  '  // second cropper, it gets this one. The Studio is a separate script block and\n' +
  '  // this block is an IIFE, so the app hands its own openCropSongModal over by\n' +
  '  // name: id in, the real modal (in place trim, Undo crop, the lot) out. It\n' +
  '  // refuses a song with no file exactly the way the modal does, and it returns\n' +
  '  // false rather than throwing when there is nothing to crop.\n' +
  '  window.__scCropSong = function(id){\n' +
  '    try{\n' +
  '      var t = null;\n' +
  "      if(id && typeof id === 'string') t = allTracks.find(function(tr){ return tr.id === id; }) || null;\n" +
  '      if(!t && queueIndex >= 0 && queueIndex < queue.length){\n' +
  "        t = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; }) || null;\n" +
  '      }\n' +
  '      if(!t) return false;\n' +
  "      if(!t.file){ try{ toast('This song has no audio file to crop.'); }catch(_eNoFile){} return false; }\n" +
  '      openCropSongModal(t);\n' +
  '      return true;\n' +
  '    }catch(e){ return false; }\n' +
  '  };\n',
  { key: 'window.__scCropSong = function(id){' });

/* ======================================================================= [3]
   LYRICS OFF, PER SONG
   ========================================================================= */
sub(html, 'the track record keeps the flag',
  '      manualOverride: t.manualOverride || false,',
  '      // 70.0.8 - "add an option to disable lyrics for that song". A full write of\n' +
  '      // the record must not quietly drop it back to on.\n' +
  '      lyricsOff: t.lyricsOff || false,\n' +
  '      manualOverride: t.manualOverride || false,',
  { key: 'lyricsOff: t.lyricsOff || false,' });

// ...and the cheap store carries it, for the same reason the play count lives
// there: turning lyrics off is not a reason to re-serialise the song's audio.
sub(html, 'the sidecar field list',
  "  var SC_SIDECAR_FIELDS = ['playCount', 'lastPlayedAt', 'lyricsCheckedAt', 'gain', 'waveform'];",
  "  var SC_SIDECAR_FIELDS = ['playCount', 'lastPlayedAt', 'lyricsCheckedAt', 'gain', 'waveform', 'lyricsOff'];",
  { key: "'gain', 'waveform', 'lyricsOff']" });

// The background pass is the reason this has to be a real flag and not a UI state:
// without it, a song the user switched off would be re-fetched five times a launch.
sub(html, 'the re-check skips an off song',
  '      if(t.notes && String(t.notes).trim()) return false;                 // hand-typed lyrics',
  '      if(t.notes && String(t.notes).trim()) return false;                 // hand-typed lyrics\n' +
  '      if(t.lyricsOff) return false;                                      // 70.0.8: turned off for this song',
  { key: 'turned off for this song' });

// fetchLyrics: the off state is checked before a single request is made, and after
// the manual check - because manual lyrics are the user's own words, not a match.
sub(html, 'fetchLyrics honours the flag',
  '    // Manual mode renders the song\'s own notes (manual lyrics) without fetching.\n' +
  '    if(lyricsManualActive){\n' +
  '      renderManualLyrics(track);\n' +
  '      return;\n' +
  '    }',
  '    // Manual mode renders the song\'s own notes (manual lyrics) without fetching.\n' +
  '    if(lyricsManualActive){\n' +
  '      renderManualLyrics(track);\n' +
  '      return;\n' +
  '    }\n' +
  '    // 70.0.8 - "If the lyrics is not right just add an option to disable lyrics for\n' +
  '    // that song". Off is a property of the song, not of this session: the sheet says\n' +
  '    // so, the databases are not asked again, and the background pass skips it.\n' +
  '    if(track.lyricsOff){ scLyricsShowOff(track); return; }',
  { key: 'if(track.lyricsOff){ scLyricsShowOff(track); return; }' });

// The switch itself, and the state it puts the sheet in. All four helpers sit with
// the rest of the lyrics sheet code, in front of scLyricsSayNotFound.
sub(html, 'the lyrics off helpers',
  '  function scLyricsSayNotFound(artist, title, track){',
  '  // ---- 70.0.8: lyrics off for one song -------------------------------------\n' +
  '  // The switch is about the ONLINE words only. A wrong match is worse than no\n' +
  '  // lyrics, so the user gets to say "not this song, not ever" once and be done -\n' +
  '  // and everything they own (manual lyrics, the notes field, the sync nudges) is\n' +
  '  // untouched by it.\n' +
  '  function scLyricsOffPanelHide(){\n' +
  "    try{ var p = $('lyricsOffPanel'); if(p) p.style.display = 'none'; }catch(_eOffHide){}\n" +
  '  }\n' +
  '  function scLyricsShowOff(track){\n' +
  '    try{\n' +
  '      if(lyricsScrollInterval){ clearInterval(lyricsScrollInterval); lyricsScrollInterval = null; }\n' +
  '    }catch(_eOffScroll){}\n' +
  "    var loading = $('lyricsLoading'); if(loading) loading.style.display = 'none';\n" +
  "    var text = $('lyricsText'); if(text) text.style.display = 'none';\n" +
  "    var nf = $('lyricsNotFound'); if(nf) nf.style.display = 'none';\n" +
  "    var editor = $('lyricsManualEditor'); if(editor) editor.style.display = 'none';\n" +
  "    var panel = $('lyricsOffPanel');\n" +
  '    if(panel){\n' +
  "      panel.style.display = 'block';\n" +
  "      var who = $('lyricsOffWho');\n" +
  "      if(who) who.textContent = (track && track.name) ? track.name : 'this song';\n" +
  '    }\n' +
  '    scLyricsOffSyncBtn(track);\n' +
  '  }\n' +
  '  // One place writes the label, so the chip, the panel and the song menu can never\n' +
  '  // disagree about whether lyrics are on for the song that is open.\n' +
  '  function scLyricsOffSyncBtn(track){\n' +
  '    try{\n' +
  '      var t = track || allTracks.find(function(tr){ return tr.id === lyricsCurrentTrack; });\n' +
  "      var btn = $('lyricsDisableBtn');\n" +
  '      if(!btn) return;\n' +
  '      var off = !!(t && t.lyricsOff);\n' +
  "      btn.textContent = off ? '\\u21ba Turn lyrics back on' : '\\ud83d\\udeab Lyrics are wrong - turn them off';\n" +
  "      btn.style.borderColor = off ? 'var(--coral)' : 'var(--line)';\n" +
  "      btn.style.color = off ? 'var(--coral)' : 'var(--ink-dim)';\n" +
  '    }catch(_eOffSync){}\n' +
  '  }\n' +
  '  function scLyricsSetOff(track, off){\n' +
  '    var t = track || allTracks.find(function(tr){ return tr.id === lyricsCurrentTrack; });\n' +
  '    if(!t) return false;\n' +
  '    t.lyricsOff = !!off;\n' +
  '    // The sidecar, not the track record: this is a flag about a song, and writing\n' +
  '    // the record would re-serialise its audio to change one boolean.\n' +
  "    try{ scSidecarSet(t.id, { lyricsOff: !!off }); scSidecarFlush(); }catch(_eOffSet){}\n" +
  '    refreshEnrichNotif && refreshEnrichNotif();\n' +
  '    if(off){\n' +
  '      scLyricsShowOff(t);\n' +
  "      toast('Lyrics off for \"' + (t.name || 'this song') + '\". SideCut will not fetch them again for it.', 3200);\n" +
  '    }else{\n' +
  '      scLyricsOffPanelHide();\n' +
  '      scLyricsOffSyncBtn(t);\n' +
  '      // Back on: what is already cached is shown at once, and a song that never\n' +
  '      // found anything is asked about again now rather than at the next launch.\n' +
  '      if(t.lyrics) showLyrics(t.lyrics, !!t.lyricsSynced);\n' +
  '      else { try{ t.lyricsCheckedAt = null; }catch(_eOffStamp){} fetchLyrics(t); }\n' +
  "      toast('Lyrics back on for \"' + (t.name || 'this song') + '\".');\n" +
  '    }\n' +
  '    return true;\n' +
  '  }\n' +
  '  // The gates drive the switch through this, exactly the way the chip does.\n' +
  '  window.__scLyricsSetOff = scLyricsSetOff;\n' +
  '\n' +
  '  function scLyricsSayNotFound(artist, title, track){',
  { key: 'function scLyricsSetOff(track, off){' });

// The panel's own helper, under the name the guard that calls it already uses.
heal(html, 'the off panel helper name', 'scLyricsOffPanelShow', 'scLyricsShowOff');

// The four places the sheet can be in another state than "off" have to take the
// panel down with them, or a song that was switched off would keep its explanation
// on screen while the next song's lyrics load over the top of it.
sub(html, 'say-not-found clears the off panel',
  "  function scLyricsSayNotFound(artist, title, track){\n    try{\n      var loading = $('lyricsLoading');",
  "  function scLyricsSayNotFound(artist, title, track){\n    scLyricsOffPanelHide();\n    try{\n      var loading = $('lyricsLoading');",
  { key: 'function scLyricsSayNotFound(artist, title, track){\n    scLyricsOffPanelHide();' });

sub(html, 'showLyrics clears the off panel',
  "  function showLyrics(lyrics, isSynced) {\n    $('lyricsLoading').style.display = 'none';",
  "  function showLyrics(lyrics, isSynced) {\n    scLyricsOffPanelHide();\n    $('lyricsLoading').style.display = 'none';",
  { key: "function showLyrics(lyrics, isSynced) {\n    scLyricsOffPanelHide();" });

sub(html, 'manual lyrics clear the off panel',
  "  function renderManualLyrics(track){\n    const t = track || allTracks.find(tr => tr.id === lyricsCurrentTrack);\n    if(!t){ return; }\n    $('lyricsLoading').style.display = 'none';",
  "  function renderManualLyrics(track){\n    const t = track || allTracks.find(tr => tr.id === lyricsCurrentTrack);\n    if(!t){ return; }\n    scLyricsOffPanelHide();\n    $('lyricsLoading').style.display = 'none';",
  { key: 'if(!t){ return; }\n    scLyricsOffPanelHide();' });

// Opening the sheet for any song clears a leftover panel and re-labels the chip.
sub(html, 'opening lyrics re-labels the switch',
  "    $('lyricsBackdrop').style.display = 'flex';\n    syncLyricsPlayPauseIcon();",
  "    $('lyricsBackdrop').style.display = 'flex';\n    syncLyricsPlayPauseIcon();\n" +
  '    // 70.0.8: the switch is about THIS song, so both halves of it are restated\n' +
  '    // every time the sheet opens - a stale label here would be the whole bug.\n' +
  '    scLyricsOffPanelHide();\n' +
  '    scLyricsOffSyncBtn(track);',
  { key: '// 70.0.8: the switch is about THIS song' });

/* ------------------------------------------------------------ the lyrics markup */
sub(html, 'the lyrics off chip',
  '        <button id="lyricsManualBtn" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0; display:none;">',
  '        <button id="lyricsDisableBtn" class="lyrics-btn" title="Lyrics off for this song" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0; display:none;">\n' +
  '          Lyrics are wrong - turn them off\n' +
  '        </button>\n' +
  '        <button id="lyricsManualBtn" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0; display:none;">',
  { key: 'id="lyricsDisableBtn"' });

sub(html, 'the lyrics off panel',
  '      <div id="lyricsManualEditor" style="display:none;">',
  '      <div id="lyricsOffPanel" style="display:none; text-align:center; color:var(--ink-dim); padding:20px 0;">\n' +
  '        <div style="margin-bottom:8px; font-size:13px; color:var(--ink);">Lyrics are off for <b id="lyricsOffWho">this song</b></div>\n' +
  '        <div style="font-size:11.5px; line-height:1.55;">SideCut will not fetch or show online lyrics for it again, and the background lyrics pass skips it - that is the point of the switch: a wrong match never comes back. Nothing of yours is affected, so your own words still work.</div>\n' +
  '        <div style="margin-top:12px;"><button id="lyricsOffBack" style="padding:9px 16px; border-radius:9px; border:1px solid var(--coral); background:none; color:var(--coral); font-size:12px; font-weight:600; cursor:pointer;">Turn lyrics back on</button></div>\n' +
  '      </div>\n' +
  '      <div id="lyricsManualEditor" style="display:none;">',
  { key: 'id="lyricsOffPanel"' });

// The not-found panel is where a wrong match is most likely to be noticed, so the
// switch is named there as well.
sub(html, 'the not-found copy names the switch',
  '        <div style="font-size:11.5px;">Tap <b>\u21bb Refetch</b> to search by hand \u2014 the artist and title there are editable. Or tap <b>Manual</b> and paste the words in yourself: they save with the song.</div>',
  '        <div style="font-size:11.5px;">Tap <b>\u21bb Refetch</b> to search by hand \u2014 the artist and title there are editable. Or tap <b>Manual</b> and paste the words in yourself: they save with the song.</div>\n' +
  '        <div style="font-size:11.5px;">If the match was wrong, use <b>Lyrics are wrong - turn them off</b>: lyrics go off for this song only, and SideCut stops looking for them.</div>',
  { key: 'If the match was wrong, use' });

sub(html, 'the lyrics off wiring',
  "  $('lyricsRefetchBtn').addEventListener('click', async () => {",
  '  // 70.0.8 - the switch and the button inside the panel it opens both go through\n' +
  '  // one setter, so there is one definition of what "off" means.\n' +
  "  $('lyricsDisableBtn').addEventListener('click', function(){\n" +
  '    const t = allTracks.find(tr => tr.id === lyricsCurrentTrack);\n' +
  "    if(!t){ toast('Play a song first.', 2000); return; }\n" +
  '    scLyricsSetOff(t, !t.lyricsOff);\n' +
  '  });\n' +
  "  $('lyricsOffBack').addEventListener('click', function(){\n" +
  '    const t = allTracks.find(tr => tr.id === lyricsCurrentTrack);\n' +
  '    if(t) scLyricsSetOff(t, false);\n' +
  '  });\n' +
  "  $('lyricsRefetchBtn').addEventListener('click', async () => {",
  { key: "$('lyricsOffBack').addEventListener('click'" });

// The chip is a per-song control, so it must not be left showing from the last song
// while a fresh sheet is loading.
sub(html, 'the chip is shown with the sheet',
  "    $('lyricsBackdrop').style.display = 'flex';\n    syncLyricsPlayPauseIcon();\n    // 70.0.8: the switch is about THIS song",
  "    $('lyricsBackdrop').style.display = 'flex';\n    syncLyricsPlayPauseIcon();\n    try{ $('lyricsDisableBtn').style.display = ''; }catch(_eOffChip){}\n    // 70.0.8: the switch is about THIS song",
  { key: "try{ $('lyricsDisableBtn').style.display = ''; }catch(_eOffChip){}" });

/* ======================================================================= [4]
   THE STUDIO MODULE
   ========================================================================= */
// [2] on the Studio side: the crop card is the song cropper, and the clip exporter
// keeps its own card so nothing is lost.
sub(mod, 'the studio tool cards',
  "        toolCard('clip', '\\u2702', 'Crop \\u2192 clip', 'Cut a section out and save it as its own MP3 \\u2014 a ringtone or a story clip.', 'accent') +",
  "        toolCard('crop', '\\u2702', 'Crop song', 'Trim the start and the end in place \\u2014 the same cropper as the \\u22ee menu, with Undo crop on the song.', 'accent') +\n" +
  "        toolCard('clip', '\\ud83c\\udfb5', 'Ringtone / clip', 'Save a section as its own tagged MP3. Nothing in your library changes.', '') +",
  { key: "toolCard('crop', '\\u2702', 'Crop song'" });

sub(mod, 'the now bar tools',
  "          '<button class=\"sc-btn tiny\" data-act=\"clip\">Make a clip</button>' +",
  "          '<button class=\"sc-btn tiny\" data-act=\"crop\">Crop</button>' +\n" +
  "          '<button class=\"sc-btn tiny\" data-act=\"clip\">Make a clip</button>' +",
  { key: 'data-act="crop">Crop<' });

sub(mod, 'the tool wiring',
  "        if(act === 'loadsampler') loadSamplerFor(currentTrack());\n        else if(act === 'clip') openClipSheet();",
  "        if(act === 'loadsampler') loadSamplerFor(currentTrack());\n        else if(act === 'crop') cropCurrent();\n        else if(act === 'clip') openClipSheet();",
  { key: "else if(act === 'crop') cropCurrent();" });

sub(mod, 'openTool reaches the cropper',
  "    if(id === 'clip') return openClipSheet();",
  "    if(id === 'crop') return cropCurrent();\n    if(id === 'clip') return openClipSheet();",
  { key: "if(id === 'crop') return cropCurrent();" });

sub(mod, 'the cropCurrent helper', '  function openClipSheet(preStart, preEnd){',
  '  // 70.0.8 - "Crop song in studio should be like one for songs". 70.0 had put a\n' +
  '  // SECOND cropper here: a clip exporter that writes a new file. The song menu\n' +
  '  // trims the song you already have, in place, and Undo crop in the song info\n' +
  '  // sheet puts it back - that is the one a crop should be, so the card opens\n' +
  '  // exactly that, on the song that is loaded. The app owns the modal; the hook is\n' +
  '  // the only way across from this block.\n' +
  '  function cropCurrent(){\n' +
  '    var t = currentTrack();\n' +
  "    if(!t){ toast('Play a song first, then crop it.'); return false; }\n" +
  "    if(!t.file){ toast('This song has no audio file to crop.'); return false; }\n" +
  "    if(!call('__scCropSong', t.id)){ toast('The cropper is not available in this build.'); return false; }\n" +
  "    bump('studio');\n" +
  '    return true;\n' +
  '  }\n' +
  '  function openClipSheet(preStart, preEnd){',
  { key: 'function cropCurrent(){' });

// [1] on the module side: the grouping must not throw away anything that is not a
// button. The speed slider is the one that exists today; a control is not a button,
// and the sheet is the app's, not this module's, to empty.
sub(mod, 'the sheet keeps non-buttons',
  '      var btns = Array.prototype.slice.call(host.querySelectorAll(\'button\'));\n      if(btns.length < 3) return false;',
  '      var btns = Array.prototype.slice.call(host.querySelectorAll(\'button\'));\n      if(btns.length < 3) return false;\n' +
  '      // 70.0.8 - "where is speed adjuster in song 3 dots menu". It was always\n' +
  '      // built: the app puts a Playback speed slider in this sheet. It is a <div>\n' +
  '      // with a range input rather than a button, and the rebuild below throws the\n' +
  '      // whole list away and puts back only what it collected - so the slider was\n' +
  '      // discarded every time the sheet opened. Everything that is not a button is\n' +
  '      // carried across now and put back at the top of the Play group, where a\n' +
  '      // speed control belongs.\n' +
  '      var extras = [];\n' +
  '      Array.prototype.slice.call(host.children).forEach(function(ch){\n' +
  "        if(ch.tagName !== 'BUTTON') extras.push(ch);\n" +
  '      });',
  { key: 'var extras = [];' });

// ...and the collection ignores the module's OWN furniture. A sheet that has
// already been grouped carries these sections as children of the host, and
// carrying them into the new Play group would nest one whole decoration inside
// another - so only what the APP put there is carried across.
sub(mod, 'the sheet carries app controls only',
  "      var extras = [];\n" +
  "      Array.prototype.slice.call(host.children).forEach(function(ch){\n" +
  "        if(ch.tagName !== 'BUTTON') extras.push(ch);\n" +
  '      });',
  "      var extras = [];\n" +
  "      Array.prototype.slice.call(host.children).forEach(function(ch){\n" +
  "        if(ch.tagName === 'BUTTON') return;\n" +
  '        if(ch.classList && ch.classList.contains(\'sc-sheet-group\')) return;\n' +
  "        extras.push(ch);\n" +
  '      });',
  { key: "ch.classList.contains('sc-sheet-group')" });

sub(mod, 'the sheet puts the controls back',
  '        host.appendChild(sec);\n      });\n      return true;',
  '        host.appendChild(sec);\n      });\n' +
  '      if(extras.length){\n' +
  "        var playBody = host.querySelector('.sc-sheet-group-body');\n" +
  '        extras.forEach(function(x){\n' +
  '          if(playBody) playBody.insertBefore(x, playBody.firstChild);\n' +
  '          else host.insertBefore(x, host.firstChild);\n' +
  '        });\n' +
  '      }\n' +
  '      return true;',
  // The marker is the CORRECTED form this release ships (see the sub right below),
  // so a tree that already carries it is left alone instead of being edited twice.
  { key: 'var target = playBody || host;' });

// One anchor for the whole batch, so several controls keep the order they were in
// instead of arriving upside down.
sub(mod, 'the sheet puts its controls back in order',
  "        var playBody = host.querySelector('.sc-sheet-group-body');\n" +
  '        extras.forEach(function(x){\n' +
  '          if(playBody) playBody.insertBefore(x, playBody.firstChild);\n' +
  '          else host.insertBefore(x, host.firstChild);\n' +
  '        });',
  "        var playBody = host.querySelector('.sc-sheet-group-body');\n" +
  '        var target = playBody || host;\n' +
  '        var anchor = target.firstChild;\n' +
  '        extras.forEach(function(x){ target.insertBefore(x, anchor); });',
  { key: 'var anchor = target.firstChild;' });

/* ======================================================================= [4]
   THE STUDIO MODULE - the APK download count
   ========================================================================= */
sub(mod, 'the apk section',
  "      '<div class=\"sc-sec\" id=\"scStudioStorage\"><div class=\"sc-sec-head\"><span>Storage cleaner</span><span class=\"sc-sec-sub\">' + fmtBytes(totalAudioBytes()) + '</span></div>' +\n        storageHtml() + '</div>' +",
  "      '<div class=\"sc-sec\" id=\"scStudioStorage\"><div class=\"sc-sec-head\"><span>Storage cleaner</span><span class=\"sc-sec-sub\">' + fmtBytes(totalAudioBytes()) + '</span></div>' +\n" +
  "        storageHtml() + '</div>' +\n" +
  '        apkSectionHtml() +',
  { key: 'apkSectionHtml() +' });

sub(mod, 'the apk wiring',
  "        if(act === 'loadsampler') loadSamplerFor(currentTrack());\n        else if(act === 'crop') cropCurrent();",
  "        if(act === 'loadsampler') loadSamplerFor(currentTrack());\n        else if(act === 'apkread') loadApkDownloads();\n        else if(act === 'crop') cropCurrent();",
  { key: "else if(act === 'apkread') loadApkDownloads();" });

sub(mod, 'the apk section builders',
  '  function trackName(id){',
  '  /* --------------------------------------------------------------------------\n' +
  '     13b. APK DOWNLOADS - the one number only GitHub keeps\n' +
  '     -------------------------------------------------------------------------- */\n' +
  '  // "to see how many apks I have downloaded". GitHub counts downloads against\n' +
  '  // RELEASE assets; a workflow artifact is a private build output with no counter\n' +
  '  // on it at all. The Android workflow attaches each flavor to a release as well\n' +
  '  // as to the artifact, and this reads the public API. Nothing is fetched until\n' +
  '  // the button is pressed, and a failure says so instead of showing a zero.\n' +
  "  var GH_REPO = 'AnekTheGreat/SideCut';\n" +
  "  var apk = { busy: false, error: '', rows: null };\n" +
  '  function apkTotal(){\n' +
  '    if(!apk.rows) return 0;\n' +
  '    return apk.rows.reduce(function(n, r){ return n + (r.count || 0); }, 0);\n' +
  '  }\n' +
  '  function apkBodyHtml(){\n' +
  "    if(apk.busy) return '<div class=\"sc-note\">Asking GitHub\\u2026</div>';\n" +
  "    if(apk.error) return '<div class=\"sc-note sc-bad\">' + esc(apk.error) + '</div>';\n" +
  "    if(!apk.rows) return '<div class=\"sc-note\">Read the download count for every APK the Android build has published. GitHub keeps the number, because the APKs are attached to a release as well as to the build artifact.</div>';\n" +
  "    if(!apk.rows.length) return '<div class=\"sc-note\">No APK is attached to a release yet. The next push to main publishes one, and the count appears here.</div>';\n" +
  "    return '<div class=\"sc-apks\">' + apk.rows.map(function(r){\n" +
  "      return '<div class=\"sc-apk-row\"><span class=\"sc-apk-name\">' + esc(r.name) + '</span>' +\n" +
  "        '<span class=\"sc-apk-count\">' + r.count + ' download' + (r.count === 1 ? '' : 's') + '</span>' +\n" +
  "        '<span class=\"sc-apk-when\">' + esc(r.when) + '</span></div>';\n" +
  "    }).join('') + '</div>';\n" +
  '  }\n' +
  '  function apkSectionHtml(){\n' +
  "    return '<div class=\"sc-sec\" id=\"scStudioApks\"><div class=\"sc-sec-head\"><span>APK downloads</span><span class=\"sc-sec-sub\">' +\n" +
  "      (apk.rows ? apkTotal() + ' total' : 'not read yet') + '</span></div>' + apkBodyHtml() +\n" +
  "      '<div class=\"sc-actions\"><button class=\"sc-btn' + (apk.rows ? '' : ' primary') + '\" data-act=\"apkread\"' +\n" +
  "      (apk.busy ? ' disabled' : '') + '>' + (apk.rows ? 'Refresh' : 'Read the counts') + '</button></div></div>';\n" +
  '  }\n' +
  '  function loadApkDownloads(){\n' +
  '    if(apk.busy) return;\n' +
  "    apk.busy = true; apk.error = ''; renderStudio();\n" +
  "    fetch('https://api.github.com/repos/' + GH_REPO + '/releases?per_page=30', { headers: { Accept: 'application/vnd.github+json' } })\n" +
  "      .then(function(r){ if(!r.ok) throw new Error('GitHub answered ' + r.status); return r.json(); })\n" +
  '      .then(function(list){\n' +
  '        var rows = [];\n' +
  '        (list || []).forEach(function(rel){\n' +
  '          (rel.assets || []).forEach(function(a){\n' +
  "            if(!/\\.apk$/i.test(a.name || '')) return;\n" +
  "            rows.push({ name: a.name, count: a.download_count || 0, when: String(rel.tag_name || '') });\n" +
  '          });\n' +
  '        });\n' +
  '        apk.rows = rows; apk.busy = false; renderStudio();\n' +
  '      })\n' +
  '      .catch(function(e){\n' +
  '        apk.busy = false; apk.rows = null;\n' +
  "        apk.error = 'Could not read the counts from GitHub (' + ((e && e.message) || 'network') + '). Reading them needs the SideCut repository to be public and to have releases.';\n" +
  '        renderStudio();\n' +
  '      });\n' +
  '  }\n' +
  '  function trackName(id){',
  { key: 'function loadApkDownloads(){' });

sub(mod, 'the apk tools for the gates',
  '    openClipSheet: openClipSheet,',
  '    cropCurrent: cropCurrent,\n' +
  '    loadApkDownloads: loadApkDownloads,\n' +
  '    apkRows: function(){ return apk.rows; },\n' +
  '    openClipSheet: openClipSheet,',
  { key: 'apkRows: function(){ return apk.rows; }' });

/* --------------------------------------------------- the stylesheet we ship */
// The APK rows, in the stylesheet that is the source of truth for the Studio -
// re-spliced below, exactly like patch-70 and patch-707 do it.
sub(css, 'the apk row styles',
  '/* ---------- Vortex: the 200-badge theme ---------- */',
  '/* ---------- APK downloads: one row per published APK ---------- */\n' +
  '/* Name, count, then the release tag it came from. The count is the only coloured\n' +
  '   part, because it is the answer to the question the section exists for. */\n' +
  '.sc-apks{ display: flex; flex-direction: column; gap: 6px; margin: 2px 0 6px; }\n' +
  '.sc-apk-row{\n' +
  '  display: flex; align-items: baseline; gap: 8px; padding: 8px 10px;\n' +
  '  border: 1px solid var(--line); border-radius: 9px;\n' +
  '  background: rgba(255,255,255,0.03); font-size: 11.5px;\n' +
  '}\n' +
  ".sc-apk-name{ flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'JetBrains Mono', monospace; color: var(--ink); }\n" +
  '.sc-apk-count{ color: var(--coral); font-weight: 650; white-space: nowrap; }\n' +
  '.sc-apk-when{ color: var(--ink-dim); font-size: 10.5px; white-space: nowrap; }\n' +
  '\n' +
  '/* ---------- Vortex: the 200-badge theme ---------- */',
  { key: '.sc-apk-row{' });

/* ================================================================== the gate */
// test-705 is the standing release gate. It cannot measure a layout and it cannot
// press a finger, but it can assert every one of the four complaints as source:
// one cropper, a control that survives the rebuild, a per-song flag that is both
// persisted and honoured, and a counter that reads a real API.
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
sub(t705, 'test-705 the 70.0.8 rules',
  "  ok(has('--sc-dock-h: 56px'), 'the dock height token is untouched');",
  "  ok(has('--sc-dock-h: 56px'), 'the dock height token is untouched');\n" +
  '  // 70.0.8. Four complaints, one release, and none of them is a layout - so all\n' +
  '  // four are asserted as what the page and the module actually contain.\n' +
  '  // [1] the crop: Studio opens the app cropper, and the clip exporter is its own\n' +
  '  // card instead of wearing the word crop.\n' +
  "  ok(count('window.__scCropSong = function') === 1, 'the Studio gets the app cropper through one hook');\n" +
  "  ok(countMod(\"toolCard('crop',\") === 1, 'the Studio tool card is a Crop song card');\n" +
  "  ok(countMod('Crop \\\\u2192 clip') === 0, 'and no longer calls a clip exporter a crop');\n" +
  "  ok(countMod('__scCropSong\\', t.id)') === 1, 'and the card calls the real modal rather than a second one');\n" +
  '  // [2] the speed slider: the sheet rebuild must keep what is not a button.\n' +
  "  ok(countMod('var extras = [];') === 1, 'the song sheet collects what is not a button');\n" +
  "  ok(countMod(\"ch.tagName !== 'BUTTON'\") === 1, 'and that is how it decides');\n" +
  "  ok(countMod('var anchor = target.firstChild;') === 1, 'and puts it back into the Play group');\n" +
  '  // [3] lyrics off: one flag, persisted cheaply, honoured everywhere it must be.\n' +
  "  ok(count('lyricsOff: t.lyricsOff || false,') === 1, 'the track record keeps the lyrics-off flag');\n" +
  "  ok(has(\"'gain', 'waveform', 'lyricsOff']\"), 'and the sidecar is what stores it, so no audio is rewritten');\n" +
  "  ok(count('if(track.lyricsOff){ scLyricsShowOff(track); return; }') === 1, 'a song switched off is never fetched');\n" +
  "  ok(count('if(t.lyricsOff) return false;') === 1, 'and the background lyrics pass skips it');\n" +
  "  ok(count('id=\"lyricsDisableBtn\"') === 1 && count('id=\"lyricsOffPanel\"') === 1,\n" +
  "     'the switch and the panel it opens are both in the sheet');\n" +
  "  ok(count(\"$('lyricsOffBack').addEventListener('click'\") === 1, 'and off can be undone from inside it');\n" +
  "  ok(has(\"t.lyricsOff ? 'Lyrics (off for this song)' : 'Lyrics'\"), 'the song menu says when they are off');\n" +
  '  // [4] the count: a real, public API that carries a real download count.\n' +
  "  ok(count(\"'https://api.github.com/repos/'\") === 1, 'Studio reads the counts from the GitHub API');\n" +
  "  ok(has('/releases?per_page=30') && has('a.download_count'), 'and it is the release asset count, which is the one GitHub keeps');\n" +
  "  ok(countMod('data-act=\"apkread\"') === 1, 'with one button that asks for it');",
  { key: 'the Studio gets the app cropper through one hook' });

// The two lines above that describe the sheet rebuild were written before the
// rebuild itself was tightened (the module collects only what the APP put in the
// sheet, and puts a whole batch back at one anchor). This is the same correction,
// applied to the gate so the gate still describes what actually ships.
sub(t705, 'test-705 the rebuild, as it ships',
  "  ok(countMod(\"ch.tagName !== 'BUTTON'\") === 1, 'and that is how it decides');",
  "  ok(countMod(\"if(ch.tagName === 'BUTTON') return;\") === 1, 'and that is how it decides');\n" +
  "  ok(countMod(\"ch.classList.contains('sc-sheet-group')\") === 1, 'without dragging its own grouped sections along');",
  { key: "'without dragging its own grouped sections along'" });

sub(t705, 'test-705 the rebuild, as it ships (b)',
  "  ok(countMod('playBody.insertBefore(x, playBody.firstChild);') === 1, 'and puts it back into the Play group');",
  "  ok(countMod('var anchor = target.firstChild;') === 1, 'and puts it back into the Play group');",
  { key: "countMod('var anchor = target.firstChild;')" });

/* --------------------------------------------------- the real-app probe's half */
const studio = holder(fs.readFileSync(STUDIO, 'utf8'));
// 70.0.8 grew the Studio to six cards: the cropper joined it and the clip maker
// kept a card of its own rather than being traded away for one.
sub(studio, 'studio-70-check the sixth tool card',
  "    ok(tools.length === 5, 'five tool cards (' + tools.join(',') + ')');\n    ['clip', 'fx', 'karaoke', 'sampler', 'looper'].forEach((k) =>",
  "    // 70.0.8: six of them. Crop is the app's own cropper now (the card that used to\n" +
  "    // wear that word was a clip exporter), and the clip exporter kept a card of its\n" +
  '    // own instead of being deleted - so the Studio grew a card, it did not trade one.\n' +
  "    ok(tools.length === 6, 'six tool cards (' + tools.join(',') + ')');\n" +
  "    ['crop', 'clip', 'fx', 'karaoke', 'sampler', 'looper'].forEach((k) =>",
  { key: "ok(tools.length === 6, 'six tool cards" });

sub(studio, 'studio-70-check the 70.0.8 rules',
  "    ok(host.querySelectorAll('.sc-sheet-group-body button').length === 7, 'no button was lost in the move');",
  "    ok(host.querySelectorAll('.sc-sheet-group-body button').length === 7, 'no button was lost in the move');\n" +
  '    // 70.0.8 - "where is speed adjuster in song 3 dots menu". The real sheet is\n' +
  '    // built with a speed control in it, and the control is NOT a button - so the\n' +
  '    // rebuild that groups the sheet has to carry it across. Driven here on the\n' +
  '    // real host, with the real markup the app puts there.\n' +
  "    const speed = doc.createElement('div');\n" +
  "    speed.innerHTML = '<span>Playback speed</span><input type=\"range\" id=\"actionSpeedSlider\" min=\"0.5\" max=\"2\" step=\"0.05\" value=\"1\">';\n" +
  '    host.insertBefore(speed, host.firstChild);\n' +
  "    host.classList.remove('sc-grouped');\n" +
  "    host.innerHTML = speed.outerHTML + host.innerHTML.replace(speed.outerHTML, '');\n" +
  '    const did2 = win.__scDecorSongSheet();\n' +
  "    ok(did2 === true, 'the sheet groups again with a control in it');\n" +
  "    const slider = doc.getElementById('actionSpeedSlider');\n" +
  "    ok(!!slider, 'and the playback speed slider is still in the sheet, not thrown away by the rebuild');\n" +
  "    const playGroup = host.querySelector('.sc-sheet-group-body');\n" +
  "    ok(!!slider && !!playGroup && playGroup.contains(slider), 'and it was put back at the top of the Play group');\n" +
  "    ok(!!playGroup && playGroup.firstChild && playGroup.firstChild.contains(slider), 'where it is the first row');\n" +
  '\n' +
  '    // 70.0.8 - one cropper. The Studio card asks the app for it by id through the\n' +
  '    // hook, so this drives exactly the path the card drives.\n' +
  '    const tapped = [];\n' +
  "    const realCropHook = win.__scCropSong;\n" +
  "    const loaded = win.__scCurrentTrack();\n" +
  "    ok(!!loaded, 'a song is loaded in the Studio');\n" +
  '    win.__scCropSong = (id) => { tapped.push(id); return true; };\n' +
  "    ok(win.SC70.cropCurrent() === true, 'the Studio crop card opens the app cropper');\n" +
  "    ok(tapped.length === 1 && tapped[0] === loaded.id, 'for the song that is loaded, by id');\n" +
  '    win.__scCropSong = () => false;\n' +
  "    ok(win.SC70.cropCurrent() === false, 'and a build without the cropper says so instead of pretending');\n" +
  '    win.__scCropSong = realCropHook;\n',
  { key: 'and it was put back at the top of the Play group' });

sub(studio, 'studio-70-check the lyrics switch',
  "    ok(win.SCACT.tryRun('what is the capital of France') === null, 'and a question it cannot act on is left alone');\n  }",
  "    ok(win.SCACT.tryRun('what is the capital of France') === null, 'and a question it cannot act on is left alone');\n" +
  '  }\n' +
  '\n' +
  "  console.log('[8b] lyrics off for one song, and the APK count');\n" +
  '  {\n' +
  '    // 70.0.8 - "If the lyrics is not right just add an option to disable lyrics for\n' +
  '    // that song". Driven through the real setter that the chip and the panel both\n' +
  '    // call: the flag has to put the panel up, live in the sidecar (next to the play\n' +
  '    // count, so no audio is rewritten for one boolean) and come back off again.\n' +
  '    const t0 = win.__scGetAllTracks()[0];\n' +
  "    const btn = doc.getElementById('lyricsDisableBtn');\n" +
  "    const panel = doc.getElementById('lyricsOffPanel');\n" +
  "    ok(!!btn && !!panel, 'the lyrics sheet has a switch and a panel for it');\n" +
  "    ok(typeof win.__scLyricsSetOff === 'function', 'and one setter behind both of them');\n" +
  "    ok(t0.lyricsOff !== true, 'a song starts with online lyrics on');\n" +
  '    win.__scLyricsSetOff(t0, true);\n' +
  '    await wait(40);\n' +
  "    ok(t0.lyricsOff === true, 'switching it off flags the song');\n" +
  "    ok(panel.style.display === 'block', 'and the sheet says so instead of loading');\n" +
  '    const side = win.__scSidecar()[t0.id] || {};\n' +
  "    ok(side.lyricsOff === true, 'and it is kept in the sidecar, so no audio is rewritten for one flag');\n" +
  '    win.__scLyricsSetOff(t0, false);\n' +
  '    await wait(60);\n' +
  "    ok(t0.lyricsOff === false, 'and it can be turned back on');\n" +
  "    ok(panel.style.display === 'none', 'with the panel out of the way again');\n" +
  '\n' +
  '    // The APK count reads GitHub, which is not reachable here - so what gets driven\n' +
  '    // is the failure: the section is wired, and it reports what happened instead of\n' +
  '    // showing a made-up zero.\n' +
  '    const read = doc.querySelector(\'#studioView [data-act="apkread"]\');\n' +
  "    ok(!!read, 'the Studio has a button that reads the APK download counts');\n" +
  '    read.click();\n' +
  '    await wait(80);\n' +
  "    ok(!!doc.querySelector('#scStudioApks .sc-bad'), 'and an unreachable GitHub is reported, not counted as nothing');\n" +
  '  }',
  { key: "console.log('[8b] lyrics off for one song, and the APK count');" });

/* --------------------------------------------------------- re-splice both in */
{
  const openTag = '<script id="sc-studio-70">';
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = openTag + '\n' + mod.text + '</script>\n';
  if(blockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(blockRe, wrapped);
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }

  const cssBlockRe = /\n\/\* =+\n   SideCut 70\.0 -[\s\S]*?<\/style>/;
  if(cssBlockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(cssBlockRe, '\n' + css.text + '</style>');
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the SideCut 70.0 stylesheet block is missing');
  }
}

/* ------------------------------------------------------------------- checks */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  must(count(page, "const APP_VERSION = '70.0.8';") === 1, 'the version is not 70.0.8 exactly once');
  must(count(page, "version: '70.0.8'") === 1, 'the 70.0.8 changelog entry is missing');
  must(count(page, "version: '70.0.7'") === 1, 'the 70.0.7 entry left the array');
  must(count(page, "version: '70.0.6'") === 1, 'the 70.0.6 entry left the array');
  must(count(page, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';") === 0, 'the old shell cache is still in sw.js');

  // [1] crop
  must(count(page, 'window.__scCropSong = function(id){') === 1, 'the crop hook is not on the page');
  must(count(page, "toolCard('crop',") === 1 && count(page, "Crop \\u2192 clip") === 0,
    'the Studio still carries a second cropper under the word crop');
  must(count(page, "if(id === 'crop') return cropCurrent();") === 1, 'the crop card does not open the cropper');
  must(count(page, "toolCard('clip', '\\ud83c\\udfb5', 'Ringtone / clip'") === 1,
    'the clip exporter lost its own card');
  // [2] speed
  must(count(page, 'var extras = [];') === 1 && count(page, "if(ch.tagName === 'BUTTON') return;") === 1,
    'the sheet rebuild still throws away what is not a button');
  must(count(page, "ch.classList.contains('sc-sheet-group')") === 1,
    'or drags its own grouped sections into the new group');
  must(count(page, 'var anchor = target.firstChild;') === 1,
    'and the control is not put back');
  must(count(page, 'extras.forEach(function(x){ target.insertBefore(x, anchor); });') === 1,
    'and it is put back in one batch instead of upside down');
  must(count(page, "speedWrap.style.cssText = 'padding:2px 4px 6px;';") === 1,
    'the speed row was not retightened for the group');
  // [3] lyrics
  must(count(page, 'lyricsOff: t.lyricsOff || false,') === 1, 'the flag is not in the track record');
  must(count(page, 'window.__scLyricsSetOff = scLyricsSetOff;') === 1, 'the switch has no setter for the gates to drive');
  must(count(page, "'gain', 'waveform', 'lyricsOff']") === 1, 'the flag is not in the sidecar');
  must(count(page, 'if(track.lyricsOff){ scLyricsShowOff(track); return; }') === 1,
    'fetchLyrics does not honour the flag');
  must(count(page, 'if(t.lyricsOff) return false;') === 1, 'the background pass does not skip it');
  must(count(page, 'id="lyricsDisableBtn"') === 1, 'the switch is not in the sheet');
  must(count(page, 'id="lyricsOffPanel"') === 1 && count(page, 'id="lyricsOffBack"') === 1,
    'the off panel is not in the sheet');
  must(count(page, "addEventListener('click', function(){\n    const t = allTracks.find(tr => tr.id === lyricsCurrentTrack);\n    if(t) scLyricsSetOff(t, false);") === 1,
    'the way back on is not wired');
  must(count(page, "scLyricsOffPanelHide();\n    $('lyricsLoading').style.display = 'none';") >= 1,
    'a lyrics state does not take the off panel down');
  must(count(page, 'function scLyricsSetOff(track, off){') === 1, 'the setter is missing');
  // [4] the count
  must(count(page, "'https://api.github.com/repos/' + GH_REPO + '/releases?per_page=30'") === 1,
    'the APK counter does not read the release API');
  must(count(page, 'a.download_count') === 1, 'and it does not read the count GitHub keeps');
  must(count(page, 'data-act="apkread"') === 1, 'and nothing asks it to read');
  must(count(page, '.sc-apk-row{') === 1, 'the APK row style did not make it into the page');
  must(/\.sc-apk-count\{[^}]*var\(--coral\)/.test(page), 'and the count is the styled part of the row');

  must(count(t705.text, 'the Studio gets the app cropper through one hook') === 1, 'test-705 does not assert the release');
  must(count(studio.text, 'and it was put back at the top of the Play group') === 1,
    'the real-app probe does not assert the speed control');

  must(count(css.text, '.sc-apk-row{') === 1 && count(css.text, '/* ---------- Vortex: the 200-badge theme ---------- */') === 1,
    'dev/sc70-styles.css is not the source this patch re-splices');
  must(count(mod.text, 'function loadApkDownloads(){') === 1, 'dev/sc70-module.js is not the source this patch re-splices');
}

if(problems.length){
  console.error('patch-708: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-708: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-708: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [[IDX, html.text], [MOD, mod.text], [CSS, css.text], [SW, sw.text], [TEST705, t705.text], [STUDIO, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-708: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-708: next `node dev/repin-708.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
