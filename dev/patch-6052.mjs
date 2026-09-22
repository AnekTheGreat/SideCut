#!/usr/bin/env node
// v60.5.2 — two reported problems, one patch. Zero backslashes in this file
// on purpose: every marker is matched literally, and the fallback block is
// spliced by position between two backslash-free prefix markers.
//
// A. "MY ALBUMS DIDNT TRANSFER OVER." Two independent bugs in importLibrary:
//    1. Album cards are built from userAlbums[].trackIds filtered against
//       THIS device's track ids, while import re-mints every id (idRemap)
//       and only remapped PLAYLIST membership. Every restored album kept the
//       exporting phone's ids, resolved to zero local songs, and the card
//       renderer's "no visible tracks -> skip" silently dropped every card —
//       an intact backup arrived with an empty Albums tab. Fix: after all
//       other restore paths, re-point each album's trackIds through idRemap
//       (local ids kept, exporter ids remapped, dead ids dropped), merge in
//       albums that only exist in the store row the full-state hydrate
//       wrote, dbPut once, take the exported card order when the live list
//       is empty, and stamp the one-time auto-album migration flag so a
//       fresh install cannot re-judge (and hide) albums the exporting
//       device showed as cards.
//    2. Metadata-only tracks (manifest path null — no audio file on the
//       exporting device) were skipped by "if(!entry) continue;", so albums
//       and playlists lost exactly those rows. They now import without audio.
//
// B. "youtube fallback option vocal remover — remove that." The YouTube
//    converter's failed-conversion hand-off to outside sites (YTMP3 and
//    Vocal Remover links) is replaced by a plain failure message pointing at
//    + Add songs -> Files, and the dead ytmp3Url leftover goes with it.
//    Full/sideload artifact keeps working YouTube + Spotify converters
//    (SC_IS_PLAY unset); the release/Play artifact keeps them removed
//    (SC_IS_PLAY set by the CI injector) — unchanged, suite re-verifies.
//
// Bumps APP_VERSION to 60.5.2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'index.html');
let src = fs.readFileSync(file, 'utf8');
const NL = String.fromCharCode(10);

let applied = 0;
const failed = [];

function replaceOnce(name, oldStr, newStr){
  const first = src.indexOf(oldStr);
  if(first === -1){ failed.push(name + ': anchor not found'); return; }
  if(src.indexOf(oldStr, first + 1) !== -1){ failed.push(name + ': anchor not unique'); return; }
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  applied++;
}

// 1/7 — version
replaceOnce('APP_VERSION', "const APP_VERSION = '60.5.1';", "const APP_VERSION = '60.5.2';");

// 2/7 — changelog entry
replaceOnce('changelog 60.5.2',
`  const CHANGELOG = [
`,
`  const CHANGELOG = [
  { version: '60.5.2', date: 'September 22, 2026 · 5:04 PM EDT', title: 'Albums survive the restore — and the outside-site converter hand-off is gone', items: [
    'Restoring a backup now brings your albums over. Each album song list still held the OLD phone track ids while import re-mints every id, so every card resolved to zero songs and the Albums tab came up empty from an otherwise intact backup — album lists now re-point at the ids this library actually has.',
    'Metadata-only songs (no audio file) import too, so albums and playlists that reference them stay whole, and your album card order rides along with the restore.',
    'An album imported from another device is no longer re-judged by the one-time auto-album pass on the new phone — whatever showed as a card on the exporting device shows as a card here.',
    'The YouTube converter no longer hands a failed conversion off to outside sites (YTMP3, Vocal Remover) — a failed try now just says so and points at importing audio you already have.',
  ] },
`);

// 3/7 — metadata-only tracks import instead of being skipped
replaceOnce('metadata-only gate',
`        const entry = zipApi.file(m.path);
        if(!entry) continue;`,
`        const entry = m.path ? zipApi.file(m.path) : null;
        // Metadata-only tracks (path null — the exporting device had the song
        // info but no audio file) import too, without audio: albums and
        // playlists reference them, and skipping them silently dropped exactly
        // the rows an album needed to resolve on the new device.
        if(m.path && !entry) continue;`);

// 4/7 — blob/url null-guard so the fileless branch above can run
replaceOnce('blob null-guard',
`        const blob = await entry.async('blob');
        const url = URL.createObjectURL(blob);
        // Always mint a fresh local id rather than reusing the manifest's id,`,
`        const blob = entry ? await entry.async('blob') : null;
        const url = blob ? URL.createObjectURL(blob) : null;
        // Always mint a fresh local id rather than reusing the manifest's id,`);

// 5/7 — dead ytmp3 fallback leftover
replaceOnce('ytmp3Url removal',
`    var ytmp3Url = 'https://ytmp3.cc/en13/?url=' + encodeURIComponent(url);
    // (Audio stream is resolved and re-encoded on-device — see tryYtAudioFormat.)`,
`    // (Audio stream is resolved and re-encoded on-device — see tryYtAudioFormat.)`);

// 6/7 — THE album fix: re-point every restored album at this library's ids
replaceOnce('album trackIds remap',
`      // Clear all cached popups so restored data shows up fresh`,
`      // ALBUMS — the restore that never made it over. Album cards are built
      // from userAlbums[].trackIds filtered against THIS device's track ids,
      // and import re-mints every id while albums were restored with the
      // exporting device's ids still inside. Every card then resolved to zero
      // songs and the Albums tab came over empty from an otherwise intact
      // backup. Re-point each album at ids this library actually has — the
      // store row too, for albums only the full-state hydrate wrote — take
      // the exported card order, and stamp the one-time auto-album pass as
      // already done so a fresh install cannot re-judge (and hide) albums
      // that the exporting device showed as cards.
      try{
        var _albMerged = userAlbums || {};
        try{
          var _albRow = await dbGet('meta', 'userAlbums');
          if(_albRow && _albRow.value && typeof _albRow.value === 'object'){
            Object.keys(_albRow.value).forEach(function(n){ if(!_albMerged[n]) _albMerged[n] = _albRow.value[n]; });
          }
        }catch(_eAlbRow){}
        var _localIds = new Set(allTracks.map(function(t){ return t.id; }));
        Object.keys(_albMerged).forEach(function(n){
          var e = _albMerged[n];
          if(!e || !Array.isArray(e.trackIds) || !e.trackIds.length) return;
          var mapped = [], touched = false;
          e.trackIds.forEach(function(oid){
            // An id that already exists locally IS this device's — keep it.
            // Otherwise it is the exporter's id space: re-point it through the
            // map the track loop just built, or drop it — that track never
            // made it into this import.
            if(_localIds.has(oid)){ if(mapped.indexOf(oid) === -1) mapped.push(oid); return; }
            var nid = idRemap[oid];
            if(nid){ if(mapped.indexOf(nid) === -1) mapped.push(nid); }
            touched = true;
          });
          if(touched) e.trackIds = mapped;
        });
        userAlbums = _albMerged;
        dbPut('meta', { key: 'userAlbums', value: userAlbums });
        try{ localStorage.setItem('sidecut_albums_manual_v1', '1'); }catch(_eAlbFlag){}
        try{
          var _aoRow = await dbGet('meta', 'albumOrder');
          if(_aoRow && Array.isArray(_aoRow.value) && _aoRow.value.length && (!Array.isArray(albumOrder) || !albumOrder.length)) albumOrder = _aoRow.value;
        }catch(_eAo){}
      }catch(eAlbum){ console.log('Album restore failed:', eAlbum); }
      // Clear all cached popups so restored data shows up fresh`);

// 7/7 — splice out the external-converter hand-off (YTMP3 / Vocal Remover).
// Matched by backslash-free prefixes: from the start comment through the end
// of the failure toast line, inclusive.
const fbStartMark = '          // Conversion failed — hand off to external converters with URL prefilled';
const fbToastMark = "          toast('In-app conversion failed";
const fbStart = src.indexOf(fbStartMark);
const fbToast = fbStart === -1 ? -1 : src.indexOf(fbToastMark, fbStart);
const fbLineEnd = fbToast === -1 ? -1 : src.indexOf(NL, fbToast);
if(fbStart === -1 || fbToast === -1 || fbLineEnd === -1){
  failed.push('fallback splice: anchor not found');
} else if(src.indexOf(fbStartMark, fbStart + 1) !== -1 || src.indexOf(fbToastMark, fbToast + 1) !== -1){
  failed.push('fallback splice: anchor not unique');
} else {
  const newFb = `          // Conversion failed for this video. The old version handed the link
          // off to outside converter sites (YTMP3, Vocal Remover) — those
          // hand-offs are gone. Say what happened and point at the import
          // path that always works.
          if(resultEl){
            resultEl.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;">' +
              '<img src="https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg" style="width:80px; height:60px; border-radius:6px; object-fit:cover; flex-shrink:0;" onerror="this.style.display=none">' +
              '<div style="flex:1;"><div style="font-weight:600; color:var(--ink); margin-bottom:4px; font-size:12px;">' + title.replace(/</g,'&lt;') + '</div>' +
              '<div style="font-size:10px; color:var(--gold); margin-bottom:4px;">⚠ Couldn’t convert this video in-app.</div>' +
              '<div style="font-size:10px; color:var(--ink-dim); margin-top:4px;">Try another link, or import audio you already have with <b>+ Add songs → + Files</b>.</div>' +
              '</div></div>';
          }
          toast('Couldn’t convert that video — try another link.', 4000);`;
  src = src.slice(0, fbStart) + newFb + src.slice(fbLineEnd);
  applied++;
}

if(failed.length){
  console.error('ABORT — nothing written. ' + failed.length + ' problem(s):');
  failed.forEach(f => console.error('  X ' + f));
  process.exit(1);
}
fs.writeFileSync(file, src);
console.log('60.5.2 patch: ' + applied + '/7 applied');

const checks = [
  ['APP_VERSION is 60.5.2', src.includes("const APP_VERSION = '60.5.2';")],
  ['changelog 60.5.2 present', src.includes("version: '60.5.2'")],
  ['vocalremover.org gone', !src.includes('vocalremover.org')],
  ['ytmp3.cc gone', !src.includes('ytmp3.cc')],
  ['album remap block present', src.includes('_albMerged') && src.includes('idRemap[oid]')],
  ['auto-album migration stamped on import', src.includes("localStorage.setItem('sidecut_albums_manual_v1', '1')")],
  ['metadata-only gate present', src.includes('if(m.path && !entry) continue;')],
  ['blob null-guard present', src.includes('entry ? await entry.async')],
  ['new failure message present', src.includes('Couldn’t convert this video in-app')],
  ['Play gate intact', src.includes('if(SC_IS_PLAY){')],
];
let bad = 0;
checks.forEach(([n, c]) => { console.log((c ? '  PASS ' : '  FAIL ') + n); if(!c) bad++; });
process.exit(bad ? 1 : 0);
