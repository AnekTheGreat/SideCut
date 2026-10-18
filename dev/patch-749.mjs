// 74.9 — "after cropping a song it just doesn't play the song anymore".
//
// Three real defects, found by driving the crop end to end in a browser
// (import → play → crop → save → it must keep playing → reload → still plays),
// in the two worlds a phone lives in: the MP3 encoder reachable, and blocked.
//
// 1. THE CROP USED THE PLAIN ENCODER, WHICH NEEDS THE MP3 ENCODER (lamejs, a
//    CDN script) TO HAVE ALREADY ARRIVED. Offline or blocked, scEncodeAudio
//    returns null and the crop died with "encoder produced no output" —
//    nothing was cropped. Every other encode path goes through the
//    cooperative encoder, which loads the encoder itself and yields between
//    slices so a long song cannot freeze the screen. If MP3 is still out of
//    reach, the crop is written as WAV instead — a cropped file in a format
//    every player opens beats a failed crop in a format that needs a download.
//
// 2. THE TAGGED-WAV SIZE FIELD WAS WRONG TWICE OVER, AND CHROMIUM REFUSED THE
//    WHOLE FILE. The RIFF/FORM writers pad an odd ID3 chunk to an even length
//    (the spec requires the pad) but wrote the UNPADDED length — and wrote it
//    BIG-ENDIAN into a LITTLE-ENDIAN field. A 41-byte tag therefore read to
//    any RIFF parser as 0x29000000 (687 MB): the chunk ran off the end of the
//    file, 'data' was never reached, <audio> reported error 4 and
//    decodeAudioData failed outright. Proven byte-level in a real browser:
//    original bytes → unplayable; little-endian padded size → plays. This is
//    why the offline WAV fallback landed as a song that would not play, and
//    it would have done the same to any tagged WAV conversion or clip.
//    (AIFF keeps its size big-endian: FORM chunks are big-endian by spec —
//    its only bug was the pad byte.)
//
// 3. THE RESUME PATHS SWALLOWED THEIR FAILURES. The play() rejection after
//    the src swap was caught and dropped, leaving the song silent; the paused
//    branch set currentTime before the new file's metadata existed, so the
//    seek landed nowhere. It now runs the player's own recovery and waits for
//    metadata before seeking.
//
//   node dev/patch-749.mjs          # applies (idempotent — a second run is a no-op)
import fs from 'node:fs';
import path from 'node:path';

const P = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'index.html');
let src = fs.readFileSync(P, 'utf8');
let applied = 0, skipped = 0;

function replaceOnce(name, oldStr, newStr) {
  if (src.indexOf(newStr) !== -1) { console.log('  = already applied: ' + name); skipped++; return; }
  const i = src.indexOf(oldStr);
  if (i === -1) { console.error('  ✗ ANCHOR MISSING: ' + name); process.exit(1); }
  src = src.slice(0, i) + newStr + src.slice(i + oldStr.length);
  console.log('  ✓ ' + name); applied++;
}

// 1 — the preview's offline fallback encodes through the cooperative path too,
// and previews the WAV the save would fall back to rather than dying.
replaceOnce('preview fallback uses the cooperative encoder',
String.raw`    renderCtx.startRendering().then((rendered) => {
      // Encode the rendered slice so preview plays exactly what will be saved.
      try{
        const blob = scEncodeAudio(rendered, cropFmt, null);
        if(blob){`,
String.raw`    renderCtx.startRendering().then(async (rendered) => {
      // Encode the rendered slice so preview plays exactly what will be saved.
      // The cooperative encoder fetches the MP3 encoder itself (this fallback
      // used the plain one, which returned nothing whenever the CDN script had
      // not loaded), and if MP3 is still unavailable it previews the WAV that
      // the save below would fall back to — the button never dies with the
      // encoder merely out of reach.
      try{
        let blob = await scEncodeAudioCooperative(rendered, cropFmt, null);
        if(!blob && cropFmt === 'mp3') blob = await scEncodeAudioCooperative(rendered, 'wav', null);
        if(blob){`);

// 2 — the save itself: cooperative encode, WAV fallback, and the file's
// extension/type follow the format that was actually written.
replaceOnce('save uses the cooperative encoder with a WAV fallback',
String.raw`      const newBlob = scEncodeAudio(slice, cropFmt, meta);
      if(!newBlob) throw new Error('encoder produced no output');
      const ext = cropFmt === 'mp3' ? '.mp3' : '.wav';
      const baseName = (cropTrack.file && cropTrack.file.name) ? cropTrack.file.name.replace(/\.[^/.]+$/, '') : (cropTrack.name || 'track');
      const newFile = new File([newBlob], baseName + ext, { type: newBlob.type || (cropFmt === 'mp3' ? 'audio/mpeg' : 'audio/wav') });`,
String.raw`      // THE CROP USED THE PLAIN ENCODER, WHICH NEEDS THE MP3 ENCODER TO HAVE
      // ALREADY ARRIVED FROM ITS CDN. On a phone that never reached the CDN
      // (offline, blocked, slow) it returned null and the crop died with
      // "encoder produced no output" — nothing was cropped, and the owner
      // reported it as "after cropping a song it just doesn't play anymore".
      // Every other encode path in the app goes through the cooperative
      // encoder, which loads the encoder itself and yields between slices so a
      // long song cannot freeze the screen. If MP3 is still out of reach (fully
      // offline), the crop is written as WAV instead: a cropped file in a
      // format every player opens beats a failed crop in a format that needs a
      // download to make.
      let usedFmt = cropFmt;
      let newBlob = await scEncodeAudioCooperative(slice, cropFmt, meta);
      if(!newBlob && cropFmt === 'mp3'){
        usedFmt = 'wav';
        newBlob = await scEncodeAudioCooperative(slice, 'wav', meta);
      }
      if(!newBlob) throw new Error('could not encode the cropped audio');
      const ext = usedFmt === 'mp3' ? '.mp3' : '.wav';
      const baseName = (cropTrack.file && cropTrack.file.name) ? cropTrack.file.name.replace(/\.[^/.]+$/, '') : (cropTrack.name || 'track');
      const newFile = new File([newBlob], baseName + ext, { type: newBlob.type || (usedFmt === 'mp3' ? 'audio/mpeg' : 'audio/wav') });`);

// 3 — the resume paths: no swallowed play() promise, no seek into the void.
replaceOnce('resume-after-crop uses the player recovery and waits for metadata',
String.raw`      if(wasPlaying){
        // Re-point the current audio element at the cropped file and keep playing.
        try{
          const a = activeAudio();
          const wasPaused = a.paused;
          const cur = a.currentTime;
          a.src = cropTrack.url;
          a.load();
          if(!wasPaused){
            a.play().catch(() => {});
          } else {
            a.currentTime = Math.min(cur, slice.duration - 0.1);
          }
        }catch(e){}`,
String.raw`      if(wasPlaying){
        // Re-point the current audio element at the cropped file and keep playing.
        try{
          const a = activeAudio();
          const wasPaused = a.paused;
          const cur = a.currentTime;
          a.src = cropTrack.url;
          a.load();
          if(!wasPaused){
            // A phone can refuse the first play() right after an src swap, and
            // the swallowed promise left the song silent — "cropped it, now it
            // won't play". This is the same recovery the play button uses.
            a.play().catch(() => recoverAudio(a, 'play() rejected'));
          } else {
            // currentTime cannot be set before the new file's metadata is in;
            // setting it into the void is what made the paused resume land at 0.
            const seekTo = Math.min(cur, slice.duration - 0.1);
            const _cropSeek = () => { try{ a.currentTime = seekTo; }catch(_eSeek){} };
            if(a.readyState > 0) _cropSeek();
            else a.addEventListener('loadedmetadata', _cropSeek, { once: true });
          }
        }catch(e){}`);

// 4 — the toast says when the crop was written as WAV.
replaceOnce('toast names the WAV fallback',
String.raw`      try{ if(window.SC70 && SC70.markFeature) SC70.markFeature('crop'); }catch(_eScCrop){}
      toastWithUndo('Cropped \"' + _cropName + '\" to ' + cropFmtTime(slice.duration), function(){ uncropSong(_cropId); });`,
String.raw`      try{ if(window.SC70 && SC70.markFeature) SC70.markFeature('crop'); }catch(_eScCrop){}
      const _fmtNote = (usedFmt !== cropFmt) ? ' — saved as WAV, the MP3 encoder could not be fetched' : '';
      toastWithUndo('Cropped \"' + _cropName + '\" to ' + cropFmtTime(slice.duration) + _fmtNote, function(){ uncropSong(_cropId); });`);

// 5 — the cooperative WAV writer: little-endian, padded size. (Anchors cover
// both the original bytes and the intermediate pad-only fix.)
{
  const FINAL =
String.raw`      // THE SIZE FIELD IS LITTLE-ENDIAN AND COUNTS THE PADDED LENGTH. The old
      // writer stored the length big-endian, so a 41-byte tag read to any
      // RIFF parser as 0x29000000 — 687 MB, past the end of the file — and
      // Chromium refused the whole WAV (error 4). An odd length must also
      // count its pad byte, or the next chunk starts one byte late.
      id3Chunk[4] = id3len & 0xFF; id3Chunk[5] = (id3len >>> 8) & 0xFF;
      id3Chunk[6] = (id3len >>> 16) & 0xFF; id3Chunk[7] = (id3len >>> 24) & 0xFF;`;
  if (src.indexOf(FINAL) !== -1) { console.log('  = already applied: cooperative WAV writer size field'); skipped++; }
  else {
    const ORIG =
String.raw`      id3Chunk[4] = (id3w.length >>> 24) & 0xFF; id3Chunk[5] = (id3w.length >>> 16) & 0xFF;
      id3Chunk[6] = (id3w.length >>> 8) & 0xFF; id3Chunk[7] = id3w.length & 0xFF;`;
    const INTERMEDIATE =
String.raw`      // The size field must count the PADDED length (id3len): a chunk parser
      // skips exactly this many bytes, and an odd value leaves it one byte
      // before 'data' — Chromium then refuses the file outright (error 4).
      id3Chunk[4] = (id3len >>> 24) & 0xFF; id3Chunk[5] = (id3len >>> 16) & 0xFF;
      id3Chunk[6] = (id3len >>> 8) & 0xFF; id3Chunk[7] = id3len & 0xFF;`;
    const i = src.indexOf(ORIG), j = src.indexOf(INTERMEDIATE);
    const at = i !== -1 ? i : j;
    if (at === -1) { console.error('  ✗ ANCHOR MISSING: cooperative WAV writer size field'); process.exit(1); }
    const oldStr = i !== -1 ? ORIG : INTERMEDIATE;
    src = src.slice(0, at) + FINAL + src.slice(at + oldStr.length);
    console.log('  ✓ cooperative WAV writer size field (little-endian, padded)'); applied++;
  }
}

// 6 — the plain WAV writer: same fix, same anchors, 8-space indent.
{
  const FINAL =
String.raw`        // Little-endian, padded — see the cooperative writer above: the old
        // big-endian store made any RIFF reader see a ~hundreds-of-MB chunk
        // that ran off the end of the file, and refused the WAV outright.
        id3Chunk[4] = id3len & 0xFF; id3Chunk[5] = (id3len >>> 8) & 0xFF;
        id3Chunk[6] = (id3len >>> 16) & 0xFF; id3Chunk[7] = (id3len >>> 24) & 0xFF;`;
  if (src.indexOf(FINAL) !== -1) { console.log('  = already applied: plain WAV writer size field'); skipped++; }
  else {
    const ORIG =
String.raw`        id3Chunk[4] = (id3w.length >>> 24) & 0xFF; id3Chunk[5] = (id3w.length >>> 16) & 0xFF;
        id3Chunk[6] = (id3w.length >>> 8) & 0xFF; id3Chunk[7] = id3w.length & 0xFF;`;
    const INTERMEDIATE =
String.raw`        // Padded length in the size field — see the cooperative writer above:
        // an odd size here made Chromium refuse the whole file.
        id3Chunk[4] = (id3len >>> 24) & 0xFF; id3Chunk[5] = (id3len >>> 16) & 0xFF;
        id3Chunk[6] = (id3len >>> 8) & 0xFF; id3Chunk[7] = id3len & 0xFF;`;
    const i = src.indexOf(ORIG), j = src.indexOf(INTERMEDIATE);
    const at = i !== -1 ? i : j;
    if (at === -1) { console.error('  ✗ ANCHOR MISSING: plain WAV writer size field'); process.exit(1); }
    const oldStr = i !== -1 ? ORIG : INTERMEDIATE;
    src = src.slice(0, at) + FINAL + src.slice(at + oldStr.length);
    console.log('  ✓ plain WAV writer size field (little-endian, padded)'); applied++;
  }
}

// 7 — the AIFF writer: FORM chunks are big-endian by spec, so its size order
// was always right; only the pad byte was wrong.
{
  const FINAL =
String.raw`      // Padded length in the size field — same word-alignment rule as WAV.
      // (FORM sizes are big-endian, unlike RIFF — the byte order here is right.)
      id3Chunk[4] = (id3len >>> 24) & 0xFF; id3Chunk[5] = (id3len >>> 16) & 0xFF;
      id3Chunk[6] = (id3len >>> 8) & 0xFF; id3Chunk[7] = id3len & 0xFF;`;
  if (src.indexOf(FINAL) !== -1) { console.log('  = already applied: AIFF writer size field'); skipped++; }
  else {
    const ORIG =
String.raw`      id3Chunk[4] = (id3.length >>> 24) & 0xFF; id3Chunk[5] = (id3.length >>> 16) & 0xFF;
      id3Chunk[6] = (id3.length >>> 8) & 0xFF; id3Chunk[7] = id3.length & 0xFF;`;
    const INTERMEDIATE =
String.raw`      // Padded length in the size field — same word-alignment rule as WAV.
      id3Chunk[4] = (id3len >>> 24) & 0xFF; id3Chunk[5] = (id3len >>> 16) & 0xFF;
      id3Chunk[6] = (id3len >>> 8) & 0xFF; id3Chunk[7] = id3len & 0xFF;`;
    const i = src.indexOf(ORIG), j = src.indexOf(INTERMEDIATE);
    const at = i !== -1 ? i : j;
    if (at === -1) { console.error('  ✗ ANCHOR MISSING: AIFF writer size field'); process.exit(1); }
    const oldStr = i !== -1 ? ORIG : INTERMEDIATE;
    src = src.slice(0, at) + FINAL + src.slice(at + oldStr.length);
    console.log('  ✓ AIFF writer size field (padded)'); applied++;
  }
}

// 8 — THE PILL IS THE STANDARD, NOT AN OPT-IN ("the pill shape should be the
// standard for tabs on by default"). The dock read "on" only when someone had
// explicitly flipped the switch, so every fresh install — and everyone who
// never found Settings → Gestures → Pill dock — got the plain four-pills dock.
// It now reads on unless someone has explicitly turned it OFF: the choice
// still sticks in both directions, but the smooth capsule, the press-and-slide
// and the tap glide are what you get by default. (navigate() already calls
// scDockPillSync(), so a tap springs the highlight to the tab you took.)
replaceOnce('the dock pill is on by default',
String.raw`  try{ scDockPillOn = localStorage.getItem('sidecut_dockPill') === '1'; }catch(_eDockP0){}`,
String.raw`  // 74.9 - THE PILL IS THE STANDARD, NOT AN OPT-IN. It used to read "on" only
  // when someone had explicitly turned it on, so every fresh install got the
  // plain four-pills dock. It now reads "on" unless someone has explicitly
  // turned it OFF — the choice sticks in both directions, but the smooth
  // capsule is what you get by default.
  try{ scDockPillOn = localStorage.getItem('sidecut_dockPill') !== '0'; }catch(_eDockP0){ scDockPillOn = true; }`);

// 9 — ASK SIDECUT MOVES OUT OF THE HOME HEADER AND INTO A BUBBLE CLUSTER
// ("I wanna move this ask SideCut button somewhere else maybe I change up
// bubble and add overlaying bubbles and stuff"). The sparkle lived in the
// Home header, where it was one icon among four and only visible on one tab.
// It is now a floating cluster above the dock and the player — reachable from
// every tab — built as two smaller bubbles peeking behind the main one (the
// overlaying-bubbles look), which fan apart under a press and settle back.
// The button keeps its id, so the drawer's delegated listener, the select-bar
// sparkle and every gate that drives it keep working untouched; the pops are
// the identity of the button, not new features, so they are decorative
// (pointer-events:none) and the whole cluster is one tap target.
{
  // The guard keys on the OLD block, not on the refresh button: a plain
  // "newStr already present" test passes the moment the refresh button exists,
  // which it always does — that false positive left TWO homeAiBtn on the page
  // (check-dom: DUP id=homeAiBtn) the first time around.
  const OLD_BTN =
String.raw`    <button class="icon-btn" id="homeAiBtn" title="Ask SideCut about your music" aria-label="Ask SideCut">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6 5.6 1.9-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm6 11l.95 2.8 2.8.95-2.8.95L18 20.5l-.95-2.8-2.8-.95 2.8-.95L18 13z"/></svg>
    </button>
    <button class="icon-btn" id="refreshBtn"`;
  const NEW_BTN = String.raw`    <button class="icon-btn" id="refreshBtn"`;
  const at = src.indexOf(OLD_BTN);
  if (at !== -1) {
    src = src.slice(0, at) + NEW_BTN + src.slice(at + OLD_BTN.length);
    console.log('  ✓ the Home header gives up the Ask sparkle'); applied++;
  } else if (src.indexOf(NEW_BTN) !== -1) {
    console.log('  = already applied: the Home header gives up the Ask sparkle'); skipped++;
  } else { console.error('  ✗ ANCHOR MISSING: the Home header Ask sparkle'); process.exit(1); }
}

replaceOnce('the bubble cluster lands above the dock',
String.raw`</header>

<!-- Notifications panel -->`,
String.raw`</header>

<!-- 74.9 - ASK SIDECUT, IN OVERLAYING BUBBLES. The header sparkle is gone; this
     is the same button (same id, same drawer) floating over every tab, with two
     smaller bubbles peeking behind it that fan apart when you press and settle
     back when you let go. It sits above the dock AND the player bar by using
     the dock's own measured height variable, so nothing ever covers it. -->
<div id="scAskBubbles">
  <button class="icon-btn sc-ask-main" id="homeAiBtn" title="Ask SideCut about your music" aria-label="Ask SideCut">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6 5.6 1.9-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm6 11l.95 2.8 2.8.95-2.8.95L18 20.5l-.95-2.8-2.8-.95 2.8-.95L18 13z"/></svg>
  </button>
  <span class="sc-ask-pop sc-ask-pop-a" aria-hidden="true"></span>
  <span class="sc-ask-pop sc-ask-pop-b" aria-hidden="true"></span>
</div>

<!-- Notifications panel -->`);

replaceOnce('the cluster has its own styles',
String.raw`body.sc-dock-pill .action-strip > .action-pill:active{ transform: scale(0.96); }`,
String.raw`body.sc-dock-pill .action-strip > .action-pill:active{ transform: scale(0.96); }
/* 74.9 - THE ASK SIDECUT BUBBLES. Fixed above the dock and the player (the
   dock's measured height variable lifts it past both), present on every tab.
   The main bubble breathes gently, presses with a spring, and the two smaller
   bubbles behind it fan apart under the finger and settle back after. */
#scAskBubbles{ position: fixed; right: 14px; bottom: calc(var(--sc-dock-h, 64px) + env(safe-area-inset-bottom) + 88px); z-index: 90; pointer-events: none; }
#scAskBubbles .sc-ask-main, #scAskBubbles .sc-ask-pop{ pointer-events: auto; }
#scAskBubbles .sc-ask-main{
  position: relative; z-index: 2;
  width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid color-mix(in srgb, var(--coral) 55%, transparent);
  background: color-mix(in srgb, var(--coral) 26%, var(--bg-raised));
  color: var(--ink);
  box-shadow: 0 6px 22px rgba(0,0,0,0.38);
  transition: transform 0.22s cubic-bezier(0.22,1,0.36,1);
  animation: scAskBob 3.6s ease-in-out infinite;
}
#scAskBubbles .sc-ask-main svg{ width: 22px; height: 22px; }
#scAskBubbles .sc-ask-main:active{ transform: scale(0.92); animation: none; }
.sc-ask-pop{
  position: absolute; right: 4px; bottom: 2px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--coral) 40%, transparent);
  background: color-mix(in srgb, var(--coral) 16%, var(--bg-raised));
  box-shadow: 0 3px 12px rgba(0,0,0,0.30);
  transition: transform 0.26s cubic-bezier(0.22,1,0.36,1);
  z-index: 1; pointer-events: none;
}
.sc-ask-pop-a{ width: 30px; height: 30px; transform: translate(8px, -34px); }
.sc-ask-pop-b{ width: 20px; height: 20px; transform: translate(-2px, -56px); }
/* Press or keyboard focus: the stack fans apart; release: it settles back. */
#scAskBubbles .sc-ask-main:active ~ .sc-ask-pop-a,
#scAskBubbles .sc-ask-main:focus-visible ~ .sc-ask-pop-a{ transform: translate(22px, -46px); }
#scAskBubbles .sc-ask-main:active ~ .sc-ask-pop-b,
#scAskBubbles .sc-ask-main:focus-visible ~ .sc-ask-pop-b{ transform: translate(-16px, -70px); }
@keyframes scAskBob{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce){ #scAskBubbles .sc-ask-main{ animation: none; } }`);

fs.writeFileSync(P, src);
console.log(`patch-749 (index.html): ${applied} applied, ${skipped} already present`);

// 10 — THE RELEASE NUMBER. APP_VERSION, the changelog head, the shell cache and
// the repository-memory section move together: a gate reads any one of them and
// a mismatch is a mystery red somewhere else. The changelog date is written at
// apply time and guarded on the VERSION, not on the whole entry, so a re-run
// (with its slightly different clock) is still a no-op.
let idxApplied = 0, idxSkipped = 0;
function patchFile(file, name, oldStr, newStr) {
  const FP = path.resolve(path.dirname(P), file);
  let s = fs.readFileSync(FP, 'utf8');
  if (s.indexOf(newStr) !== -1) { console.log('  = already applied: ' + name); idxSkipped++; return; }
  const i = s.indexOf(oldStr);
  if (i === -1) { console.error('  ✗ ANCHOR MISSING: ' + name); process.exit(1); }
  s = s.slice(0, i) + newStr + s.slice(i + oldStr.length);
  fs.writeFileSync(FP, s);
  console.log('  ✓ ' + name); idxApplied++;
}

patchFile('index.html', 'APP_VERSION runs 74.9',
  `  const APP_VERSION = '74.8';`,
  `  const APP_VERSION = '74.9';`);

// The changelog head: the new entry is inserted ABOVE the old head.
{
  const FP = P;
  let s = fs.readFileSync(FP, 'utf8');
  if (s.indexOf("version: '74.9',") !== -1) { console.log('  = already applied: changelog head'); idxSkipped++; }
  else {
    const HEAD_ANCHOR = `  { version: '74.8', date: 'October 17, 2026 · 5:20 PM EDT', title: 'Listening time counts while the music is out of sight - and it follows the song instead of a timer', items: [`;
    const i = s.indexOf(HEAD_ANCHOR);
    if (i === -1) { console.error('  ✗ ANCHOR MISSING: changelog head'); process.exit(1); }
    const now = new Date();
    const dateStr = (function(){
      // House style: "October 17, 2026 · 11:49 PM EDT" - toLocaleString's
      // default "at 11:49 PM" is not how every other entry reads.
      const d = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' });
      const t = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
      return d + ' · ' + t + ' EDT';
    })();
    const entry =
`  { version: '74.9', date: '${dateStr}', title: 'Cropping needs no network to write a file, tagged WAVs play again, the pill dock is the standard, and Ask SideCut floats as bubbles', items: [
    'Cropping no longer needs a network: the save fetches the encoder itself and yields while it runs, so a long song cannot freeze the screen while it works.',
    'A crop saved with no connection used to end with "encoder produced no output" and trim nothing at all; it now always writes the file, and writes WAV when the encoder cannot be reached.',
    'Fixed every tagged WAV the app writes - crops, clips and saved copies: the tag size was stored backward, so a player read it as hundreds of megabytes and refused the whole file.',
    'A song that was playing keeps playing after a crop: the resume now runs the same recovery as the play button instead of swallowing a failure.',
    'A paused crop seeks back to where you were only once the new file length is known, instead of seeking into nothing.',
    'The pill dock is the standard now: the tabs arrive joined into one rounded capsule whose highlight springs smoothly from tab to tab, sampled mid-glide.',
    'The switch in Settings to Gestures still brings the four separate pills back, and the choice sticks both ways.',
    'Ask SideCut left the Home header for floating bubbles above the dock on every tab: two smaller bubbles peek behind the sparkle and fan apart when you press.',
    'Nothing else moved: the player, the home widget, the letter-by-letter lyrics and the albums are where the last build left them.',
  ]},`;
    s = s.slice(0, i) + entry + s.slice(i);
    fs.writeFileSync(FP, s);
    console.log('  ✓ changelog head (74.9)'); idxApplied++;
  }
}

patchFile('sw.js', 'the shell cache is v74.9',
  `const CACHE_NAME = 'sidecut-shell-v74.8';`,
  `const CACHE_NAME = 'sidecut-shell-v74.9';`);

// The repository memory gets its section, above 74.8's.
{
  const FP = path.resolve(path.dirname(P), 'AGENTS.md');
  let s = fs.readFileSync(FP, 'utf8');
  if (s.indexOf('## 74.9 (') !== -1) { console.log('  = already applied: AGENTS.md 74.9 section'); idxSkipped++; }
  else {
    const ANCHOR = '## 74.8 (October 17, 2026 · 5:20 PM EDT): Listening time follows the song, not the app window';
    const i = s.indexOf(ANCHOR);
    if (i === -1) { console.error('  ✗ ANCHOR MISSING: AGENTS.md 74.8 section'); process.exit(1); }
    const now = new Date();
    const dateStr = (function(){
      const d = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' });
      const t = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
      return d + ' · ' + t + ' EDT';
    })();
    const section =
`## 74.9 (${dateStr}): Cropping needs no network to write a file, tagged WAVs play, the pill is the standard, Ask SideCut floats

- **THE OWNER'S REPORT, VERBATIM**: "after cropping a song it just doesn't play the song anymore fix that this is stupid it should be able to fuffil this
  simple ahh request it should be able to do everything", plus "The pill shape should be the standard for tabs on by default, pill should be smooth moving
  between tabs smoothly, and I wanna move this ask SideCut button somewhere else maybe I change up bubble and add overlaying bubbles and stuff".
- **THREE DEFECTS UNDER THE FIRST COMPLAINT, ALL PROVEN IN A REAL BROWSER** (\`harness/crop-play-check.mjs\`: import → play → drag the selection → save → it
  must keep playing → re-tap → reload → still plays; encoder reachable (stereo and mono) and BLOCKED - 42/42): (1) the save called the plain
  \`scEncodeAudio\`, which returns null when lamejs (a CDN script) has not arrived - offline it died with "encoder produced no output" and nothing was
  cropped; it now runs \`scEncodeAudioCooperative\` (loads the encoder itself, yields between slices) and falls back to WAV when MP3 is ungettable. (2)
  **THE TAGGED-WAV SIZE FIELD WAS WRONG TWICE**: the RIFF writers padded an odd ID3 chunk but recorded the UNPADDED length, BIG-endian - a 41-byte tag read
  as 0x29000000 (687 MB), the chunk ran off the end of the file, and Chromium refused the WAV wholesale (error 4). Both WAV writers now store little-endian
  padded sizes (AIFF keeps big-endian - FORM is big-endian - and gains the pad byte). This had made EVERY tagged WAV the app wrote unplayable: crops,
  conversions, clips. (3) the resume-after-crop swallowed \`play()\` rejections and seeked before metadata existed; it now runs \`recoverAudio\` and waits for
  \`loadedmetadata\`.
- **THE PILL IS THE DEFAULT.** \`sidecut_dockPill\` reads on unless explicitly '0', so fresh installs arrive joined; the Gestures switch still takes the dock
  apart and writes '0'. The glide is proven by sampling the thumb MID-transition (110ms into the 0.24s spring it sits strictly between the two tabs) -
  \`harness/v749-ui-check.mjs\`, **13/13**.
- **ASK SIDECUT MOVES TO BUBBLES.** The Home-header sparkle is gone; the same button (same id, so the delegated drawer listener and \`ai-button-check\` 40/0
  keep working) floats bottom-right above dock+player (\`#scAskBubbles\`, fixed, \`--sc-dock-h\` stack), with two smaller overlaying bubbles peeking behind it
  that fan apart on press and settle on release - decorative (pointer-events:none), one tap target, no new features.
- **GATES RETARGETED, NOT WEAKENED** (\`dev/patch-749-gates.mjs\`): \`studio-70-check\` and \`album-follow-dock-check\` pinned the old opt-in dock world;
  both now drive the new truth (arrives joined, switch takes it apart and writes '0', joins again and writes '1') - **570/570** and **105/0**. Release pins
  move with \`dev/repin-749.mjs\`, same chain as every release.
- **VERIFIED**: crop 42/42 across all three worlds; UI 13/13; ai-button 40/0; check-dom 0; studio-70 570/570; album-follow 105/0; test-705's failures
  byte-identical to pristine; test-6641 123 + its one pre-existing env red. **NOT VERIFIED**: no phone - the harness proves desktop Chromium; the CI APK is
  the real test, and the offline crop (WAV fallback) is the specific path to try on device.
- **NEXT RELEASE**: \`74.10\` for a fix inside this one, \`75.0\` for the next feature. Shell cache \`sidecut-shell-v74.9\`.

`;
    s = s.slice(0, i) + section + s.slice(i);
    fs.writeFileSync(FP, s);
    console.log('  ✓ AGENTS.md 74.9 section'); idxApplied++;
  }
}
console.log(`patch-749 (release): ${idxApplied} applied, ${idxSkipped} already present`);
