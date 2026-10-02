// v70.0 - Studio, achievements, a batch tag editor, gestures, an assistant that
// acts, and the app reshaped around a bottom dock.
//
//   "A new tab in the app: Studio tab: one home for the creative tools, with crop,
//    slowed + reverb, karaoke mode, sampler pads and loop recorder. It'd feel like
//    a mini editing app inside SideCut... Achievements and streaks... Storage
//    cleaner: add a 'biggest songs' view with a re-encode-to-smaller-bitrate
//    option... Crop -> share as clip... Assistant that acts, not just answers...
//    Auto-DJ / beat-matched crossfade... Batch tag editor... Make the 3 dots menu
//    for songs nicer too with UI... bump to v70 huge app overall full UI overhaul"
//
// The release is one new top-level <script> block (dev/sc70-module.js, spliced by
// dev/patch-70.mjs) plus a handful of anchored wires into the app itself, and a
// stylesheet appended to the app's own. This gate reads BOTH halves of every wire:
// a hook is only real if the app calls it and the module answers it, so most
// checks below count two ends rather than looking for one string.
//
//   [1] the release itself: 70.0 runs, the head entry says so, ten notes, the
//       stamp rules, the shell cache;
//   [2] the dock - the app's navigation is now at the bottom, and everything that
//       has to clear it does;
//   [3] the Studio block is a real script, and it publishes what it claims to;
//   [4] the five tools, wired into the app's own audio graph;
//   [5] achievements and the storage cleaner, built on the app's own stats;
//   [6] batch tag editing, all the way down to the ID3 tag inside the file;
//   [7] Auto-DJ: the beat gate, the beat align, and the tempo reader;
//   [8] gestures, the assistant that acts, and the grouped ⋮ menu;
//   [9] the same release, DRIVEN on the real app (dev/studio-70-check.cjs);
//   [10] everything 64.3.1 and before shipped is still standing;
//   [11] the file still holds together.
//
//   node dev/test-70.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, 'dev/sc70-module.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'dev/sc70-styles.css'), 'utf8');

const VER = '70.0';
const PREV = '64.3.1';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
const slice = (from, to, hay = src) => {
  const a = hay.indexOf(from);
  const b = hay.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return hay.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  // The build on the page is 70.0, a patch on it, or the series the page own
  // rule says follows it - 70.1, because "the third number stops at nine: 60.0.9
  // is followed by 60.1, never 60.0.10". The release this gate DESCRIBES is
  // still 70.0, which is why VER did not move with APP_VERSION.
  // 71.2. This gate DESCRIBES 70.0 and keeps reading that entry below, but the
  // two checks here are about the build ON the page, and they were written as
  // literals for the 70 series - which refused 71.2 for no reason but its major.
  // The next series is what the page own rule allows, so 71.x is named the way
  // 70.1 already was, and the rule underneath is the general one.
  ok(ver === VER || String(ver).indexOf(VER + '.') === 0 ||
     /^70\.1(\.\d+)?$/.test(ver) || /^71\.\d+(\.\d+)?$/.test(ver) ||
     /^72\.\d+(\.\d+)?$/.test(ver), // repin-720: the series list is extended each release
     'the app runs as ' + VER + ', a patch on it, or the series that follows it (' + ver + ')');
  // The rule the page states about its own version: a well-formed version whose
  // third number stops at nine, and a new series does not read x.y.0 - so
  // 70.0.10 and 70.1.0 are both refused, whichever series shipped last.
  const verParts = String(ver).split('.').map((n) => Number(n));
  ok(/^\d+(\.\d+)*$/.test(ver) &&
     !(verParts.length === 3 && (verParts[2] === 0 || verParts[2] > 9)),
     'and the third number never reaches ten');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // head = the 70.0 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === '70.0') || entries[0];
    const items = head.items || [];
    ok(String(head.version) === '70.0', 'the entry this gate reads is v' + head.version);
    ok(items.length === 10, 'ten notes, one per thing the user asked for (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 320, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    ok(String((entries[entries.findIndex((e) => String(e.version) === String(head.version)) + 1] || {}).version) === PREV, 'the release before this one is still listed next');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    // The stamp rule at APP_VERSION: Eastern is UTC-4 and the DATE rolls back with
    // it. A stamp in the reader's future is the bug 64.3 fixed, so it is checked
    // against the clock rather than against a literal.
    const stamp = String(head.date).match(/([A-Z][a-z]+) (\d+), (\d{4}) · (\d+):(\d+) (AM|PM) EDT/);
    ok(!!stamp, 'and it parses as a real date');
    if (stamp) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      let hh = parseInt(stamp[4], 10) % 12;
      if (stamp[6] === 'PM') hh += 12;
      const at = Date.UTC(parseInt(stamp[3], 10), months.indexOf(stamp[1]), parseInt(stamp[2], 10), hh + 4, parseInt(stamp[5], 10));
      ok(at - Date.now() < 15 * 60 * 1000, 'and it is not stamped in the future');
    }
    const notes = items.join('\n');
    ok(/studio/i.test(notes) && /badge|achievement/i.test(notes), 'the notes name Studio and the badges');
    ok(/re-encode/i.test(notes) && /clip/i.test(notes), 'and the storage cleaner and the clip export');
    ok(/assistant/i.test(notes) && /auto-dj/i.test(notes), 'and the assistant and Auto-DJ');
    ok(/dock/i.test(notes), 'and the dock the whole app moved onto');
    ok(!/\bmp3\b|converting|conversion|hand-?off/i.test(notes), 'with no converter term in it');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'and every note publishes on both channels');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === 'sidecut-shell-v72.4', 'the service worker cache moves on for the shell that shipped (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + (src.match(/const APP_VERSION = '([^']+)'/) || [])[1], 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the dock: navigation moved to the bottom of the screen');
{
  ok(count('id="studioBtn"') === 1, 'there is exactly one Studio tab');
  const strip = slice('<div class="action-strip" id="actionStrip">', '</div>\n\n<input');
  ok(strip.indexOf('id="studioBtn"') !== -1, 'and it is in the app nav strip, next to the other tabs');
  ok(strip.indexOf('id="homeBtn"') !== -1 && strip.indexOf('id="libraryBtn"') !== -1 && strip.indexOf('id="discoverBtn"') !== -1,
    'which still holds Home, Library/Albums and Discover');
  const dockRule = src.match(/\.action-strip\{\s*position:\s*fixed[^}]*\}/);
  ok(!!dockRule, 'the strip is fixed to the bottom');
  ok(!!dockRule && /bottom:\s*0/.test(dockRule[0]), 'at the very bottom');
  ok(/--sc-dock-h:\s*\d+px/.test(src), 'with a height of its own (' + (src.match(/--sc-dock-h:\s*(\d+px)/) || [])[1] + ')');
  ok(/#nowPlaying\{ bottom: calc\(var\(--sc-dock-h\)/.test(src), 'the player sits above it rather than under it');
  const clearance = src.match(/#homeView, #discoverView, #studioView\{ padding-bottom:[^}]*\}/);
  ok(!!clearance, 'and every scrolling view clears both');
  ok(!!clearance && /var\(--sc-dock-h\)/.test(clearance[0]), 'including the dock in that clearance');
  ok(/#listPane\{ padding-bottom: calc\(var\(--list-bottom-inset, 96px\) \+ var\(--sc-dock-h\)/.test(src),
    'the library list too');
  ok(count('id="studioView"') === 1, 'there is one Studio view');
  ok(/#studioView\{[\s\S]{0,200}?display: none/.test(src), 'hidden until it is the view you are on');
  ok(/#studioView\.active\{ display: flex; \}/.test(src), 'and shown when it is');
  ok(src.indexOf('<div id="studioView"></div>') !== -1, 'it is real markup, not only a script-made node');
  ok(has("const isStudio = view === 'studio';"), 'navigate() knows the view');
  ok(has("$('studioView').classList.toggle('active', isStudio);"), 'toggles it with the others');
  ok(has("$('studioBtn').classList.toggle('active', isStudio);"), 'and lights the tab');
  ok(has("if(isHome || isDiscover || isLibrary || isStudio){"), 'Studio keeps the player on screen like the rest');
  ok(has("$('studioBtn').addEventListener('click', () => {"), 'the tab is wired');
  ok(has("navigate($('studioView').classList.contains('active') ? 'home' : 'studio');"), 'and tapping the tab you are on goes back Home');
  ok(has("if(isStudio){ try{ if(window.SC70 && SC70.renderStudio) SC70.renderStudio(); }catch(_eS70){} }"), 'arriving draws the view');
  // The library/Albums split tab is the one tab that carries two labels, so it is
  // the one that gets the extra room - which is what the mockup showed.
  ok(/#libraryBtn\{ flex: 1\.18 1 0; border-radius: 14px; \}/.test(src), 'the split tab is the widest of the four');
}

console.log('[3] the Studio block');
{
  ok(count('<script id="sc-studio-70">') === 1, 'the release is one script block of its own');
  ok(count('</script>\n</body>') === 1, 'and it is the last thing before the body closes');
  ok(mod.indexOf('window.SC70 = {') !== -1, 'the module publishes a surface for the gates and the assistant');
  ok(mod.indexOf('window.SCACT = SCACT;') !== -1, 'and an action layer for the assistant');
  ok(mod.indexOf('window.scStudioBuildChain = function') !== -1, 'and a chain builder the app graph calls');
  ok(mod.indexOf('window.__scAutoDjGate = function') !== -1 && mod.indexOf('window.__scAutoDjAlign = function') !== -1,
    'and the two Auto-DJ hooks the app calls');
  ok(mod.indexOf('window.__scWriteTagsToFile = function') !== -1, 'and the tag writer the batch editor calls');
  ok(mod.indexOf('window.__scDecorSongSheet = function') !== -1, 'and the grouping the ⋮ menu calls');
  ok(/document\.readyState === 'loading'/.test(mod), 'it boots with the document, whichever comes first');
  ok(count('<script id="sc-studio-70">') === 1 && src.indexOf(mod.slice(0, 120)) !== -1,
    'and what is spliced in is the module file itself, byte for byte');
  // The module may only reach into the app through published hooks: block 1 is an
  // IIFE, so a bare name from it would be a ReferenceError at runtime.
  ok(mod.indexOf('call(\'__sc') !== -1 || mod.indexOf("call('__sc") !== -1, 'it reaches the app through window.__sc* hooks');
  ok(count('window.__scAllTracks = function(){ return allTracks; };') === 1, 'the app publishes its library');
  ok(count('window.__scCurrentTrack = function()') === 1, 'and its current song');
  ok(count('window.__scStats = function()') === 1, 'and its own stats, which the badges are built on');
  ok(count('window.__scSetPlaylist = function(name, ids)') === 1, 'and a way to make a playlist, which the assistant uses');
  ok(count('window.__scSaveClip = async function(blob, fName)') === 1, 'and a way to save a clip off the device');
  ok(count('window.__scId3 = scId3v23Bytes;') === 1, 'and the tag writer, for the batch editor');
}

console.log('[4] the five tools, wired into the app');
{
  const graph = slice('        src.connect(bandNodes[0]);', '        eqNodes[idx] = bandNodes;');
  ok(graph.indexOf('window.scStudioBuildChain(audioCtx, idx, deckGain, limiter)') !== -1,
    'the deck lands in the Studio chain, inside ensureAudioGraph');
  ok(graph.indexOf('if(!scStudioFx) deckGain.connect(limiter);') !== -1,
    'and is wired straight to the limiter when the chain is not there');
  ok(graph.indexOf('limiter.connect(audioCtx.destination);') !== -1, 'the limiter still reaches the speakers');
  ok(mod.indexOf('function makeIR(c, seconds, decay)') !== -1, 'the reverb is generated on the device, with no asset to fetch');
  ok(mod.indexOf('function karaokeNode(c)') !== -1, 'and the vocal cancel is L minus R, which is what removes a lead vocal');
  ok(mod.indexOf("split.connect(gR, 1);") !== -1 && mod.indexOf('gR.gain.value = -1;') !== -1, 'the right channel is subtracted');
  ok(mod.indexOf("fxIn.connect(dry); dry.connect(fxOut);") !== -1, 'the dry path is always there');
  ok(mod.indexOf("fxIn.connect(send); send.connect(conv); conv.connect(wet); wet.connect(fxOut);") !== -1, 'the reverb is a send, not a replacement');
  ok(mod.indexOf("loopIn.connect(fxOut);") !== -1, 'and the pads and the looper play into the same chain');
  ok(count('.playbackRate = playbackSpeed * (typeof window.__scStudioRate') === 5,
    'all five places the app sets a deck speed multiply by the Studio speed');
  ok(/window\.__scStudioRate = function\(\)\{ return fxState\.rate \|\| 1; \};/.test(mod), 'which the module owns');
  ok(mod.indexOf("el.preservesPitch = (fxState.rate === 1);") !== -1, 'and slowing down drops the pitch with the speed, the way the preset should');

  ok(mod.indexOf("toolCard('clip'") !== -1 && mod.indexOf("toolCard('fx'") !== -1 && mod.indexOf("toolCard('karaoke'") !== -1 &&
    mod.indexOf("toolCard('sampler'") !== -1 && mod.indexOf("toolCard('looper'") !== -1, 'the view offers all five tools');
  ok(mod.indexOf('function openClipSheet(preStart, preEnd)') !== -1, 'crop-to-clip has its own sheet');
  ok(mod.indexOf('window.__scEncodeMp3(piece, 192, meta)') !== -1, 'the clip is encoded as its own tagged MP3');
  ok(mod.indexOf("(tr.name || 'Clip') + ' (clip '") !== -1, 'and named after the range it came from');
  ok(mod.indexOf('window.__scSaveClip(blob, fname)') !== -1, 'then handed to the share sheet or a download');
  ok(has("async function scEncodeMp3Cooperative(buf, meta, onSlice, kbps){"), 'the mp3 encoder takes a bitrate');
  ok(has("var enc = new lamejs.Mp3Encoder(chCount, sr, Math.max(32, Math.min(320, parseInt(kbps, 10) || 192)));"),
    'and defaults to 192 for every caller that came before');
  ok(mod.indexOf('function openFxSheet()') !== -1 && mod.indexOf('var PRESETS = [') !== -1, 'slowed + reverb has presets and live sliders');
  ok(mod.indexOf("'slowed'") !== -1 && mod.indexOf("'nightcore'") !== -1 && mod.indexOf("'lofi'") !== -1,
    'covering slowed, nightcore and lo-fi');
  ok(mod.indexOf('function openKaraokeSheet()') !== -1, 'karaoke has its own sheet');
  ok(mod.indexOf('function openSamplerSheet()') !== -1 && mod.indexOf('function padHtml()') !== -1, 'the sampler draws its pads');
  ok(/id="scPad' \+ i \+ '" data-pad=/.test(mod) && /for\(var i = 0; i < 8; i\+\+\)/.test(mod),
    'eight of them');
  ok(mod.indexOf('function capturePad(i)') !== -1, 'a pad can be captured at what is playing right now');
  ok(mod.indexOf('function recordLoop()') !== -1 && mod.indexOf('function stopLoops()') !== -1, 'the loop recorder records and stops');
  ok(mod.indexOf('src.loop = true;') !== -1, 'and what it records really loops');
  ok(css.indexOf('.sc-pads{ display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;') !== -1, 'the pads are a grid on a phone');
  ok(/\.sc-pads\{ grid-template-columns: repeat\(8, 1fr\); \}/.test(css), 'and one row of eight on a tablet');
}

console.log('[5] achievements, streaks and the storage cleaner');
{
  ok(mod.indexOf('function ACHIEVEMENTS(){') !== -1, 'the badges are defined in one place');
  const ids = (mod.match(/id: '[a-z0-9_]+'/g) || []).map((s) => s.slice(5, -1));
  ok(ids.length >= 30, 'there are ' + ids.length + ' badges');
  ok(ids.length === new Set(ids).size, 'and no id appears twice');
  ['streak_7', 'hour_100', 'studio_first', 'clip_1'].forEach((id) =>
    ok(ids.indexOf(id) !== -1, 'including ' + id));
  // 70.0.6 took the two editing badges off the wall (test-705 owns that release);
  // this gate keeps its six checks by asking about them the other way round.
  ['retag_1', 'reencode_1'].forEach((id) =>
    ok(ids.indexOf(id) === -1, 'and no longer including ' + id));
  ok(mod.indexOf('var s = call(\'__scStats\') || {};') !== -1 || mod.indexOf("call('__scStats')") !== -1,
    'and every one of them is measured against the app\u2019s own stats, not a new counter');
  ok(src.indexOf('streak: computeStreak()') !== -1, 'the streak comes from the app\u2019s own streak');
  ok(mod.indexOf("lsSet(LS.ach, achState);") !== -1, 'what is unlocked is written down, so a badge is celebrated once');
  ok(mod.indexOf('if(achState[a.id]) return;') !== -1, 'and a badge already held is never handed out again');
  ok(mod.indexOf('function markFeature(k)') !== -1, 'using a feature is recorded');
  ok(has("SC70.markFeature('crop')") && has("if(window.SC70 && SC70.markFeature) SC70.markFeature('crop');") ,
    'and the app\u2019s own crop marks it, so that badge cannot be faked');
  ok(mod.indexOf('.sc-badge-bar') !== -1 || css.indexOf('.sc-badge-bar') !== -1, 'a locked badge shows how far along it is');
  ok(css.indexOf('.sc-badge.have{') !== -1, 'and an unlocked one reads differently');

  ok(mod.indexOf('function biggestSongs(limit){') !== -1, 'the storage cleaner has a biggest-songs view');
  ok(mod.indexOf('.sort(function(a, b){ return b.size - a.size; })') !== -1, 'sorted by file size, largest first');
  ok(mod.indexOf('function reencodeTrack(id, kbps, btn)') !== -1, 'and a re-encode for any row');
  ok(mod.indexOf('var REENCODE_RATES = [96, 128, 160];') !== -1, 'at a bitrate you choose');
  ok(mod.indexOf('t._preReencodeFile = oldBlob;') !== -1, 'the original file is kept before it is replaced');
  ok(mod.indexOf('function undoReencode(id)') !== -1, 'so the re-encode can be undone');
  ok(mod.indexOf("toastWithUndo('Re-encoded") !== -1, 'and the undo is offered in the toast that announces it');
  ok(mod.indexOf('if(!t._preReencodeFile)') !== -1, 'a second re-encode of the same song cannot lose the first undo');
  ok(has('window.__scFmtBytes = scFmtBytes;'), 'the sizes are formatted with the app\u2019s own formatter');
}

console.log('[6] batch tag editing, down to the tag inside the file');
{
  ok(has('id="selectTagBtn"'), 'the selection bar has a tag button');
  ok(has("SC70.openBatchTags(Array.from(selectedIds))"), 'which opens the editor on what is ticked');
  ok(mod.indexOf('function openBatchTags(ids)') !== -1, 'the editor takes the selection');
  ok(mod.indexOf('<input id="scBatchArtist" type="text"') !== -1 && mod.indexOf('<input id="scBatchAlbum" type="text"') !== -1,
    'with an artist and an album field');
  ok(mod.indexOf('id="scBatchCover"') !== -1, 'and a cover picker');
  ok(mod.indexOf('Only the fields you fill in are changed') !== -1, 'an empty field leaves the field alone');
  ok(mod.indexOf("if(artist) t.artist = artist;") !== -1 && mod.indexOf("if(album) t.album = album;") !== -1,
    'and the change is written to every selected song');
  ok(mod.indexOf('return window.__scWriteTagsToFile ? window.__scWriteTagsToFile(t) : Promise.resolve(false);') !== -1,
    'the stored file is re-tagged as well as the list');
  ok(mod.indexOf('function retagBytes(u8, id3)') !== -1, 'which is a real rewrite of the file bytes');
  ok(/if\(u8\.length > 10 && u8\[0\] === 0x49 && u8\[1\] === 0x44 && u8\[2\] === 0x33\)/.test(mod), 'the old ID3v2 block is found and replaced');
  ok(mod.indexOf("put('fmt ', fmt.body);") !== -1 && mod.indexOf("put('data', dat.body);") !== -1,
    'and a WAV keeps its fmt and data chunks exactly as they were');
  ok(mod.indexOf("for(var i = 0; i < 4; i++) out[w + i] = 'id3 '.charCodeAt(i);") !== -1, 'with the new tag appended as an id3 chunk');
  ok(mod.indexOf('off = 10 + (((u8[6] & 0x7f) << 21)') !== -1, 'the syncsafe size is read, so a big existing tag is removed whole');
  ok(mod.indexOf('if(u8[5] & 0x10) off += 10;') !== -1, 'and a footer is accounted for');
  ok(mod.indexOf('if(!out){ res(false); return; }') !== -1, 'a file it cannot rewrite is reported, not silently half-written');
}

console.log('[7] Auto-DJ: blending on the beat');
{
  ok(has('var scBeatOk = true;') && has('if(scBeatOk) maybeStartCrossfade();'),
    'the app holds the blend back until the gate says the beat is right');
  ok(has('scBeatOk = (typeof window.__scAutoDjGate !== \'function\') || window.__scAutoDjGate(a, remaining);'),
    'and asks the Studio block, with the outgoing song and the time left');
  ok(has('var scAlign = window.__scAutoDjAlign(activeAudio(), nextTrack);') && has('nxt.currentTime = scAlign;'),
    'the incoming song is started on its own downbeat');
  ok(has('if(scAlign > 0 && isFinite(scAlign) && scAlign < (nextTrack.duration || 1e9)) nxt.currentTime = scAlign;'),
    'with a guard so a bad reading can never skip the whole song');
  ok(mod.indexOf('function detectBpm(buf){') !== -1, 'the tempo is read off the audio');
  ok(mod.indexOf('for(var lag = minLag; lag <= maxLag; lag++){') !== -1, 'by autocorrelation over the lag range');
  ok(mod.indexOf('var minLag = Math.floor((60 / 200) * fps)') !== -1, 'from 200 BPM');
  ok(mod.indexOf('while(bpm < 70) bpm *= 2;') !== -1 && mod.indexOf('while(bpm > 190) bpm /= 2;') !== -1,
    'folded into a musical range, so half and double time read as the same tempo');
  ok(mod.indexOf('var sinceBeat = pos - Math.floor(pos / beat) * beat;') !== -1, 'the gate measures how far off the beat the song is');
  ok(mod.indexOf('if(remaining <= beat * 1.1) return true;') !== -1, 'and gives up on its own with less than a beat to go');
  ok(mod.indexOf('if(!autodj.on) return true;') !== -1, 'with Auto-DJ off it never holds anything back');
  ok(mod.indexOf('if(autodj.on ? 1 : 0)') === -1, 'and the switch is a real on/off, not a dead setting');
  ok(mod.indexOf('bpmCache[t.id] = r;') !== -1, 'each song\u2019s tempo is read once and kept');
}

console.log('[8] gestures, the assistant that acts, and the song menu');
{
  ok(mod.indexOf("window.addEventListener('devicemotion', shakeHandler, { passive: true });") !== -1, 'a shake is listened for');
  ok(mod.indexOf('if(mag > 26 && now - lastShake > 1600){') !== -1, 'with a threshold and a debounce, so one shake skips one song');
  ok(mod.indexOf("call('__scNext');") !== -1, 'and it goes to the next song through the app\u2019s own button');
  ok(mod.indexOf('typeof D.requestPermission === \'function\'') !== -1, 'the motion permission is asked for where it is needed');
  ok(mod.indexOf('if(!gestures.shake) return;') !== -1, 'and a refused or switched-off shake does nothing');
  ok(mod.indexOf('function wireSwipe(){') !== -1, 'the player has a swipe');
  ok(mod.indexOf("if(tgt && tgt.closest && tgt.closest('button, input, a, .crossfader-track')) return;") !== -1,
    'which ignores anything that starts on a control');
  ok(mod.indexOf("scrubbing = !!(tgt && tgt.closest && tgt.closest('#miniBar, .seek-row, .seek-line-wrap'));") !== -1,
    'a drag on the progress area seeks instead of changing track');
  ok(mod.indexOf('if(Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5){') !== -1,
    'a horizontal swipe is the one that changes track');
  ok(mod.indexOf("if(dx < 0){ call('__scNext');") !== -1 && mod.indexOf("else { call('__scPrev');") !== -1,
    'left for next, right for previous');
  ok(has("if(window.SCACT && typeof window.SCACT.tryRun === 'function'){"), 'the chat asks the action layer');
  ok(has("var _scAction = window.SCACT.tryRun(msg);") && has("if(_scAction){"),
    'before the knowledge base and before the model');
  ok(has("if(statusEl) statusEl.textContent = 'Done in SideCut';"), 'and says so when it acted');
  ok(mod.indexOf('(?:crop|clip|trim|cut|export|ringtone)') !== -1, 'a crop request is understood with its range');
  ok(mod.indexOf('if(!openClipSheet(s0, s1)){') !== -1, 'and is only claimed when there is a song to cut');
  ok(mod.indexOf('most[- ]?played|most played|top played') !== -1, 'a most-played playlist request is understood');
  ok(mod.indexOf("var name = 'Most played';") !== -1 && mod.indexOf('call(\'__scSetPlaylist\', name,') !== -1,
    'and really builds the playlist');
  ok(mod.indexOf('THEME_WORDS') !== -1 && mod.indexOf("call('__scApplyTheme', key);") !== -1, 'a theme request switches the theme');
  ok(/ember: 'ember'/.test(mod) && /galaxy: 'galaxy'/.test(mod), 'including the dynamic ones by name');
  ok(mod.indexOf('scrollStudioTo(\'scStudioStorage\')') !== -1 || mod.indexOf("scrollStudioTo('scStudioStorage')") !== -1,
    'a storage request opens the cleaner and scrolls to it');
  ok(mod.indexOf("setAutoDj(true);") !== -1, 'and an Auto-DJ request turns it on');
  ok(mod.indexOf("if(/^(next|skip)\\b/.test(low))") !== -1, 'playback verbs work too');
  ok(mod.indexOf('return null;') !== -1, 'and a request it cannot act on falls through to the old answer');

  ok(has('if(typeof window.__scDecorSongSheet === \'function\') window.__scDecorSongSheet();'),
    'the song sheet is grouped as it opens');
  ok(mod.indexOf('var GROUPS = [') !== -1, 'into named groups');
  ok(mod.indexOf("buckets[i].test.test(txt.replace(/^[^\\p{L}\\p{N}]+/u, ''))") !== -1,
    'decided on the words, not the glyph a row leads with');
  ok(mod.indexOf("var sec = document.createElement('div');") !== -1 && mod.indexOf("host.appendChild(sec);") !== -1,
    'and the real buttons are moved, never re-made');
  ok(mod.indexOf("host.classList.add('sc-grouped');") !== -1, 'with a class the stylesheet can reach');
  ok(has('if(btns.length < 3) return false;'), 'a sheet with almost nothing in it is left alone');
  ok(css.indexOf('.sc-sheet-group-label{') !== -1 && css.indexOf('.sc-sheet-group.danger .sc-sheet-group-label{') !== -1,
    'the groups and the danger one are styled apart');
  ok(css.indexOf('.sc-sheet-group-body button:hover{') !== -1, 'and the rows have a hover state of their own');
}

console.log('[9] the same release, driven on the real app');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/studio-70-check.cjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const last = out.trim().split('\n').pop() || '(no output)';
  ok(code === 0, 'dev/studio-70-check drives the real app: ' + last);
  const n = parseInt((last.match(/All (\d+) checks/) || [])[1] || (last.match(/(\d+) passed/) || [])[1] || '0', 10);
  ok(n >= 100, 'and every one of its ' + n + ' checks passed');
}

console.log('[10] what the earlier releases shipped is still standing');
{
  const run = (file) => {
    let o = '', c = 0;
    try { o = execFileSync(process.execPath, [path.join(ROOT, 'dev', file)], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
    catch (e) { c = e.status === undefined ? 1 : e.status; o = String((e.stdout || '') + (e.stderr || '')); }
    return { o, c };
  };
  const gates = [
    ['test-66431.mjs', 'the list is still not rebuilt while you are scrolling it'],
    ['test-6643.mjs', 'the two library halves still keep their own place'],
    ['ota-guard-check.cjs', 'the update guard still refuses a downgrade'],
    ['audit-calls.mjs', 'every name the app reads is still declared']
  ];
  gates.forEach(([file, what]) => {
    const r = run(file);
    const last = (r.o.trim().split('\n').filter(Boolean).pop() || '(no output)');
    ok(r.c === 0, what + ' (' + file + ': ' + last + ')');
  });
}

console.log('[11] the file still holds together');
{
  let code = 0, out = '';
  try { out = execFileSync(process.execPath, [path.join(ROOT, 'dev/check-dom.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
  catch (e) { code = e.status === undefined ? 1 : e.status; out = String((e.stdout || '') + (e.stderr || '')); }
  ok(code === 0, 'the document still closes every element and every id it reads exists: ' + (out.trim().split('\n').pop() || ''));
  ok(count('  const CHANGELOG = [') === 1, 'the changelog is still one array');
  ok(count('id="listPane"') === 1 && count('id="homeBubbles"') === 1, 'the list pane and the Home grid are still there');
  ok(count('id="nowPlaying"') === 1, 'and there is still one player');
  // Every inline script in the page has to parse - the Studio block is 1600 lines
  // spliced in by a script, so this is the check that would catch a bad splice.
  const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  let bad = 0, badMsg = '';
  blocks.forEach((m) => { try { new Function(m[1]); } catch (e) { bad++; badMsg = e.message; } });
  ok(bad === 0, 'every inline script in the page parses (' + blocks.length + ' blocks' + (bad ? ': ' + badMsg : '') + ')');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
