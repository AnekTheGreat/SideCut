#!/usr/bin/env node
// v60.4.6 — two bugs still reported on 60.4.4:
//
// A. Pinned artists show the empty placeholder even though the data is still
//    on the phone. Two fixes:
//    1. If the meta row is missing/empty, restore the pins ONCE from the
//       on-device snapshot file (sidecut-snapshot.json — rewritten ~1.5s
//       after every meta change), then persist. A once-flag keeps a later
//       deliberate "unpin all" from resurrecting them again.
//    2. While storage is being re-read (post-crash IDB trouble) the strip
//      says so and keeps retrying for a few beats, instead of painting the
//       "Pin artists you love" placeholder over pins that are still there.
//
// B. Sometimes the downloaded audio is the wrong song with the right tags.
//    The remaining holes:
//    1. The artist-only FALLBACK source never passed the title gate — if
//       nothing verified, any same-artist video within 60s of length saved.
//    2. A decoded clip 15–60s off the real length ("closest cut") was
//       accepted on length alone. Now it also needs an exact title match
//       (<=30s off keeps the old leniency for real album/single edits).
//
// Plus APP_VERSION 60.4.6 and a changelog entry (correct EDT timestamp).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let applied = 0, failed = 0;

function rep(name, oldStr, newStr) {
  if (src.includes(newStr)) { console.log(`  = ${name} (already applied)`); return; }
  if (!src.includes(oldStr)) { console.error(`  ✗ ${name} — anchor NOT found`); failed++; return; }
  src = src.split(oldStr).join(newStr);
  applied++;
  console.log(`  ✓ ${name}`);
}

// ---- A1. retry counter declaration --------------------------------------
rep('retry counter declared',
`  let pinnedLoadTrusted = false;`,
`  let pinnedLoadTrusted = false;
  // Timed re-reads while storage is untrusted: a mid-write crash leaves
  // IndexedDB briefly unreadable, and one immediate retry is not enough.
  let pinnedReadRetries = 0;`);

// ---- A2. untrusted branch: honest state + timed retries ------------------
rep('untrusted branch: honest render + retries',
`      pinnedLoadTrusted = false;
      console.warn('pinned artists unreadable this boot — saving is paused so the stored list cannot be overwritten');
      return;
    }
    pinnedLoadTrusted = true;`,
`      pinnedLoadTrusted = false;
      console.warn('pinned artists unreadable this boot — saving is paused so the stored list cannot be overwritten');
      // Say so on screen and keep re-reading: the "Pin artists you love"
      // placeholder over pins that are still on this phone reads as
      // "my artists were deleted", which is exactly what was reported.
      try{ renderPinnedArtists(); }catch(_eU){}
      if(pinnedReadRetries < 5){
        pinnedReadRetries++;
        setTimeout(function(){ loadPinnedArtists({ noRetry: true }); }, 2500 * pinnedReadRetries);
      }
      return;
    }
    pinnedLoadTrusted = true;
    pinnedReadRetries = 0;`);

// ---- A3. restore pins from the on-device snapshot once -------------------
rep('snapshot restore when the meta row is empty',
`    pinnedLoadTrusted = true;
    pinnedReadRetries = 0;
    const pa = rows.find(r => r.key === 'pinnedArtists');
    pinnedArtists = Array.isArray(pa && pa.value) ? pa.value : [];
    const pr = rows.find(r => r.key === 'pinnedReleases');
    pinnedReleases = (pr && pr.value && typeof pr.value === 'object') ? pr.value : {};`,
`    pinnedLoadTrusted = true;
    pinnedReadRetries = 0;
    const pa = rows.find(r => r.key === 'pinnedArtists');
    pinnedArtists = Array.isArray(pa && pa.value) ? pa.value : [];
    const pr = rows.find(r => r.key === 'pinnedReleases');
    pinnedReleases = (pr && pr.value && typeof pr.value === 'object') ? pr.value : {};
    // Empty or missing row, but the on-device snapshot (written ~1.5s after
    // every meta change) can still hold the real list — an older build's
    // failed-read wipe or a crash mid-write drops the row without touching
    // the file. Restore ONCE and persist; the flag means a later deliberate
    // "unpin all" stays unpinned instead of being resurrected every boot.
    if(!pinnedArtists.length){
      try{
        var _pinsEverRestored = localStorage.getItem('sidecut_pins_restored') === '1';
        if(!_pinsEverRestored && window.__scSnapMeta){
          var _snapMeta = await window.__scSnapMeta();
          var _snapPins = (_snapMeta && Array.isArray(_snapMeta.pinnedArtists))
            ? _snapMeta.pinnedArtists.filter(function(a){ return a && typeof a.name === 'string' && a.name.trim(); })
            : [];
          if(_snapPins.length){
            pinnedArtists = _snapPins;
            if(!Object.keys(pinnedReleases).length && _snapMeta.pinnedReleases && typeof _snapMeta.pinnedReleases === 'object'){
              pinnedReleases = _snapMeta.pinnedReleases;
            }
            try{ localStorage.setItem('sidecut_pins_restored', '1'); }catch(_eFlag){}
            console.warn('[SideCut] pinned artists restored from the on-device snapshot (' + pinnedArtists.length + ')');
            dbPut('meta', { key: 'pinnedArtists', value: pinnedArtists });
            if(Object.keys(pinnedReleases).length) dbPut('meta', { key: 'pinnedReleases', value: pinnedReleases });
          }
        }
      }catch(_eSnapPins){ console.warn('pinned artist snapshot restore skipped', _eSnapPins); }
    }`);

// ---- A4. render: untrusted shows a re-reading state ----------------------
rep('render: honest untrusted state',
`    if(!pinnedArtists.length){
      list.innerHTML = \`<div style="width:100%;font-size:11.5px;color:var(--ink-dim);padding:8px 10px;background:rgba(255,255,255,0.03);border:1px dashed var(--line);border-radius:10px;">Pin artists you love \\u2014 search above, tap a card, and hit <b>Pin</b>. They'll show here, scrollable sideways.</div>\`;
      return;
    }`,
`    if(!pinnedArtists.length){
      if(!pinnedLoadTrusted){
        // Storage is mid-re-read after a crash — the pins are still on this
        // phone. Never paint the "add some artists" placeholder over that.
        list.innerHTML = \`<div style="width:100%;font-size:11.5px;color:var(--ink-dim);padding:8px 10px;background:rgba(255,255,255,0.03);border:1px dashed var(--line);border-radius:10px;">Your pinned artists are still on this phone — re-reading them…</div>\`;
        return;
      }
      list.innerHTML = \`<div style="width:100%;font-size:11.5px;color:var(--ink-dim);padding:8px 10px;background:rgba(255,255,255,0.03);border:1px dashed var(--line);border-radius:10px;">Pin artists you love \\u2014 search above, tap a card, and hit <b>Pin</b>. They'll show here, scrollable sideways.</div>\`;
      return;
    }`);

// ---- A5. expose snapshot-meta reader ------------------------------------
rep('expose __scSnapMeta',
`    window.__scSnapDirty = markDirty;
    window.__scSnapFlush = flushSnapshot;`,
`    window.__scSnapDirty = markDirty;
    window.__scSnapFlush = flushSnapshot;
    // Read-only view of the mirrored meta (pins, settings, playlists) so
    // loadPinnedArtists can recover a row the WebView store lost.
    window.__scSnapMeta = async function(){
      try{
        if(!isNative()) return null;
        var FS = window.Capacitor.Plugins.Filesystem;
        var res = await FS.readFile({ path: SNAP_NAME, directory: 'DATA', encoding: 'utf8' });
        var snap = null;
        try{ snap = JSON.parse(res.data || ''); }catch(e){ return null; }
        return (snap && snap.v === 1 && snap.meta) ? snap.meta : null;
      }catch(e){ return null; }
    };`);

// ---- B1. scTitleStrong helper -------------------------------------------
rep('add scTitleStrong',
`  // Duration check: the Spotify plan carries the real track length in seconds.`,
`  // Exact-title bar: full containment of the expected title (either
  // direction) or every one of its words. This is what a "different cut"
  // (decoded 15–60s off the real length) must clear before its audio may
  // stand in for the real track — 60% word overlap is not enough when the
  // price of being wrong is saving the wrong song under the right tags.
  function scTitleStrong(expectedTitle, videoTitle, candTitle){
    function norm(s){
      return String(s || '').toLowerCase()
        .replace(/\\([^)]*\\)|\\[[^\\]]*\\]/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\\s+/g, ' ').trim();
    }
    var want = norm(expectedTitle);
    if(!want) return true;
    var vt = norm(videoTitle);
    var ct = norm(candTitle);
    if(vt.indexOf(want) !== -1 || ct.indexOf(want) !== -1) return true;
    var wantWords = want.split(' ').filter(function(w){ return w.length > 1; });
    if(!wantWords.length) return true;
    var blob = (vt + ' ' + ct);
    var bWords = blob.split(' ');
    for(var i = 0; i < wantWords.length; i++){
      var hit = false;
      for(var j = 0; j < bWords.length; j++){
        if(bWords[j] === wantWords[i]){ hit = true; break; }
      }
      if(!hit) return false;
    }
    return true;
  }

  // Duration check: the Spotify plan carries the real track length in seconds.`);

// ---- B2. verified entries carry the strong-title flag --------------------
rep('verified entries carry strong-title flag',
`        verified.push({ pa: pa, delta: (expectedSec > 0 && cSec > 0) ? Math.abs(expectedSec - cSec) : -1 });`,
`        verified.push({ pa: pa, delta: (expectedSec > 0 && cSec > 0) ? Math.abs(expectedSec - cSec) : -1, strong: scTitleStrong(title, pa.videoTitle, cands[ci].title) });`);

// ---- B3. nearCut needs strong title beyond 30s ---------------------------
rep('nearCut needs strong title beyond 30s',
`      if(bufDelta <= 60){ if(!nearCut){ nearCut = entry; nearDec = decTry; } continue; }`,
`      // 15–60s off: usable only as the closest cut of the SAME track, and
      // only when the title matches exactly (<=30s off keeps the old
      // leniency for real album/single edits). Length alone never chose it.
      if(bufDelta <= 60){
        if(!nearCut && (entry.strong || bufDelta <= 30)){ nearCut = entry; nearDec = decTry; }
        continue;
      }`);

// ---- B4. fallback source must pass the title gate too -------------------
rep('fallback must pass title gate',
`    if(!audio && fallback && (!artist || /^(unknown|various)/i.test(artist) || scArtistMatch(artist, fallback.author, fallback.videoTitle, fallback.owner, ''))){`,
`    if(!audio && fallback && (!artist || /^(unknown|various)/i.test(artist) || scArtistMatch(artist, fallback.author, fallback.videoTitle, fallback.owner, '')) && scTitleMatch(title, fallback.videoTitle, fallbackCand ? fallbackCand.title : '')){`);

// ---- version + changelog -------------------------------------------------
const now = new Date();
let edt;
try{
  edt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(now).replace(' at ', ' \u00b7 ');
}catch(e){ edt = '(date)'; }
const dateStr = `${edt} EDT`;
console.log(`  changelog date: ${dateStr}`);

rep('APP_VERSION bump', `const APP_VERSION = '60.4.5';`, `const APP_VERSION = '60.4.6';`);

rep('changelog entry',
`  const CHANGELOG = [
  { version: '60.4.5',`,
`  const CHANGELOG = [
  { version: '60.4.6', date: '${dateStr}', title: 'Pinned artists recovered · downloads verify the exact song', items: [
    'If your pinned artists vanished, SideCut now restores them from the on-device backup copy that is written right after every change \u2014 once, so a deliberate unpin-all stays unpinned. The restored pins are saved back to the library immediately.',
    'While storage is being re-read after a crash, the pinned strip now says your artists are still on this phone and keeps retrying \u2014 it no longer paints the empty "add some artists" placeholder over data that was never deleted.',
    'Downloads got stricter about the actual audio: the fallback source must pass the same song-title check as verified sources, and a clip 15\u201360 seconds off the real length is only used when the video title exactly matches the track \u2014 the last two ways a same-artist different song could land with the right tags.',
  ],
  },
  { version: '60.4.5',`);

fs.writeFileSync(FILE, src);
console.log(failed ? `PATCH FAILED (${failed})` : `ALL PATCHES APPLIED (${applied})`);
if (failed) process.exitCode = 1;
