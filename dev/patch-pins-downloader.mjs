#!/usr/bin/env node
// Two fixes in one pass:
//
// 1. PINNED ARTISTS "DISAPPEARED"
//    - loadPinnedArtists: dbGetAll returns [] for BOTH an empty store and a
//      failed read; trusting a failed read showed an empty list, and the next
//      savePinnedArtists() wrote [] over the real data for good. Now a storage
//      trouble flag marks the read untrusted, retries once, and saves are
//      paused (with a merge of anything pinned meanwhile) until a read works.
//    - A malformed entry (no name) threw in the dedupe filter OUTSIDE the
//      try/catch, skipping every render — data safe in IndexedDB, UI empty.
//      Entries are guarded and each render is isolated.
//    - renderHome filtered the pinnedartists bubble out whenever premium was
//      inactive, so one empty Play Billing reply hid the whole feature.
//      openHomeBubble already renders a lock card for that case.
//    - syncPlayEntitlement revoked premium on a SINGLE empty purchases list;
//      now a sub runs out through its own `expires` and lifetime needs 3
//      consecutive empty syncs.
//
// 2. DOWNLOADER ("right metadata, wrong audio")
//    - scDurationOk existed but was NEVER called. It now gates: candidate
//      length vs the track's real seconds (>60s off never decodes), then the
//      decoded buffer's own duration (<=15 exact, 15-60 closest cut, >60
//      reject), and the artist-only fallback must pass the same gates.
//    - Single-song paths now carry seconds (iTunes trackTimeMillis) so the
//      checks apply there too.
//
// Version bumps to 60.4.4 (60.4.1/60.4.2 are burned legacy-map keys), adds a
// changelog entry with a real EDT timestamp, and corrects 60.4.3's date (it
// was written in UTC; the release went out 8:58 PM EDT Sep 21).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function rep(label, oldStr, newStr) {
  const first = src.indexOf(oldStr);
  if (first === -1) throw new Error(`anchor not found: ${label}`);
  if (src.indexOf(oldStr, first + 1) !== -1) throw new Error(`anchor ambiguous (>1): ${label}`);
  src = src.slice(0, first) + newStr + src.slice(first + oldStr.length);
  n++;
  console.log(`\u2022 ${label}`);
}

// ---------- 1. Boot: each load guarded so one failure can't skip the other ----------
rep('boot load guards', `      // Auto-fill missing covers/metadata in the background once the library
      // has settled (each song is only ever attempted once).
      await loadEnrichState();
      await loadPinnedArtists();`,
`      // Auto-fill missing covers/metadata in the background once the library
      // has settled (each song is only ever attempted once). Each load gets its
      // own guard: if one throws the other still runs \u2014 pinned artists must
      // never be skipped because an unrelated boot step failed.
      try{ await loadEnrichState(); }catch(e){ console.error('loadEnrichState failed', e); }
      try{ await loadPinnedArtists(); }catch(e){ console.error('loadPinnedArtists failed', e); }`);

// ---------- 2. load/save: never trust a failed read, never write over it ----------
rep('loadPinnedArtists/savePinnedArtists rewrite', `  async function loadPinnedArtists(){
    try{
      const rows = await dbGetAll('meta');
      const pa = rows.find(r => r.key === 'pinnedArtists');
      pinnedArtists = Array.isArray(pa && pa.value) ? pa.value : [];
      const pr = rows.find(r => r.key === 'pinnedReleases');
      pinnedReleases = (pr && pr.value && typeof pr.value === 'object') ? pr.value : {};
    }catch(e){ console.error('loadPinnedArtists failed', e); }
    // Deduplicate: keep the first entry per primary artist name
    const _seenPrimary = new Set();
    pinnedArtists = pinnedArtists.filter(a => {
      const p = primaryArtistName(a.name).toLowerCase().trim();
      if(_seenPrimary.has(p)) return false;
      _seenPrimary.add(p);
      return true;
    });
    renderPinnedArtists();
    renderNewReleases();
    updateNotifBadge();
    // Home's New releases bubble (its count and its mark-all-as-read chip) is
    // drawn from pinnedReleases, which only arrive here \u2014 without this the bubble
    // kept whatever it drew before the releases loaded.
    try{ renderHome(); }catch(_eHome){}
  }
  function savePinnedArtists(){
    return Promise.all([
      dbPut('meta', { key: 'pinnedArtists', value: pinnedArtists }),
      dbPut('meta', { key: 'pinnedReleases', value: pinnedReleases })
    ]);
  }`,
`  // False until a read of the meta store ACTUALLY succeeds. dbGetAll returns []
  // both for an empty store and for a failed read, so without this an IndexedDB
  // hiccup looked like deleted artists \u2014 and the next save wrote the empty list
  // back for real.
  let pinnedLoadTrusted = false;
  async function loadPinnedArtists(opts){
    const noRetry = !!(opts && opts.noRetry);
    let rows = null;
    try{ rows = await dbGetAll('meta'); }catch(e){ console.error('pinned artists read failed', e); }
    const trouble = (typeof window !== 'undefined' && window.__scStorageTrouble) ? window.__scStorageTrouble() : null;
    if(!rows || (trouble && !rows.length)){
      if(!noRetry && window.__scStorageRetry){
        try{ window.__scStorageRetry(); }catch(_e){}
        return loadPinnedArtists({ noRetry: true });
      }
      pinnedLoadTrusted = false;
      console.warn('pinned artists unreadable this boot \u2014 saving is paused so the stored list cannot be overwritten');
      return;
    }
    pinnedLoadTrusted = true;
    const pa = rows.find(r => r.key === 'pinnedArtists');
    pinnedArtists = Array.isArray(pa && pa.value) ? pa.value : [];
    const pr = rows.find(r => r.key === 'pinnedReleases');
    pinnedReleases = (pr && pr.value && typeof pr.value === 'object') ? pr.value : {};
    // Deduplicate: keep the first entry per primary artist name. Guarded per
    // entry \u2014 one malformed record used to throw HERE, outside the read's
    // try/catch, which skipped every render below and made ALL pinned artists
    // look deleted while the data was still safe in storage.
    try{
      const _seenPrimary = new Set();
      pinnedArtists = pinnedArtists.filter(a => {
        if(!a || typeof a.name !== 'string' || !a.name.trim()) return false;
        const p = primaryArtistName(a.name).toLowerCase().trim();
        if(_seenPrimary.has(p)) return false;
        _seenPrimary.add(p);
        return true;
      });
    }catch(_eDedup){ console.error('pinned artist dedupe failed', _eDedup); }
    // Each render isolated: a failure in one view can no longer hide the rest.
    try{ renderPinnedArtists(); }catch(e){ console.error('renderPinnedArtists failed', e); }
    try{ renderNewReleases(); }catch(e){ console.error('renderNewReleases failed', e); }
    try{ updateNotifBadge(); }catch(e){ console.error('updateNotifBadge failed', e); }
    // Home's New releases bubble (its count and its mark-all-as-read chip) is
    // drawn from pinnedReleases, which only arrive here \u2014 without this the bubble
    // kept whatever it drew before the releases loaded. The pinned-artists count
    // lands here too: navigate() renders Home before this load runs.
    try{ renderHome(); }catch(_eHome){}
  }
  function savePinnedArtists(){
    if(!pinnedLoadTrusted){
      // Never persist a list we could not read \u2014 a failed boot read leaves the
      // in-memory array empty, and writing that would erase the real pins for
      // good. Re-read first; only write if the read succeeds.
      const pending = pinnedArtists.slice();
      const pendingReleases = pinnedReleases;
      return loadPinnedArtists().then(function(){
        if(!pinnedLoadTrusted){ console.warn('pinned artist save skipped \u2014 storage still unreadable'); return false; }
        // Entries pinned while the list was unreadable would be lost by the
        // reload above \u2014 merge them back before writing.
        try{
          const have = new Set(pinnedArtists.map(a => primaryArtistName(a.name).toLowerCase().trim()));
          pending.forEach(a => {
            if(a && typeof a.name === 'string' && !have.has(primaryArtistName(a.name).toLowerCase().trim())) pinnedArtists.push(a);
          });
          Object.keys(pendingReleases || {}).forEach(k => { if(!(k in pinnedReleases)) pinnedReleases[k] = pendingReleases[k]; });
        }catch(_eMerge){ console.error('pinned artist merge failed', _eMerge); }
        return _savePinnedArtistsNow();
      });
    }
    return _savePinnedArtistsNow();
  }
  function _savePinnedArtistsNow(){
    return Promise.all([
      dbPut('meta', { key: 'pinnedArtists', value: pinnedArtists }),
      dbPut('meta', { key: 'pinnedReleases', value: pinnedReleases })
    ]);
  }`);

// ---------- 3. Home bubble never vanishes (lock card already exists) ----------
rep('home bubble always visible', `    const homeOrderNow = normalizeHomeOrder(homeOrder).filter(k => homeHidden.indexOf(k) === -1 && (k !== 'pinnedartists' || isPremiumActive()));`,
`    // The Pinned artists bubble is ALWAYS shown (unless the user hid it in the
    // Sandbox). It used to be filtered out whenever premium was inactive, which
    // made the whole feature look deleted the moment an entitlement check came
    // back empty \u2014 openHomeBubble already renders the lock card for that case.
    const homeOrderNow = normalizeHomeOrder(homeOrder).filter(k => homeHidden.indexOf(k) === -1);`);

// ---------- 4. Entitlement: one empty Play reply must not revoke ----------
rep('entitlement empty-response hardening', `      // Only revoke Play-billed unlocks we granted; never touch gifted codes.

      if(info && (info.plan === 'sub' || info.plan === 'lifetime')) clearPremiumQuietly();
      return 'inactive';`,
`      // Only Play-billed unlocks are ever revoked here \u2014 never gifted codes.
      // An empty list must be STABLE before anything is removed: Play's
      // getPurchases can answer empty while it syncs, and one empty reply used
      // to revoke premium on the spot \u2014 which silently hid pinned artists and
      // locked Discover. A sub runs out through its own \`expires\` (that is what
      // the grace period is for); lifetime needs three empty syncs in a row.
      if(info && info.plan === 'sub'){
        if(info.expires && Date.now() > info.expires) clearPremiumQuietly();
        return isPremiumActive() ? 'active' : 'inactive';
      }
      if(info && info.plan === 'lifetime'){
        var _emptyStreak = 0;
        try{ _emptyStreak = parseInt(localStorage.getItem('sidecut_play_empty_streak') || '0', 10) || 0; }catch(_est){}
        _emptyStreak++;
        try{ localStorage.setItem('sidecut_play_empty_streak', String(_emptyStreak)); }catch(_est2){}
        if(_emptyStreak >= 3) clearPremiumQuietly();
        return isPremiumActive() ? 'lifetime' : 'inactive';
      }
      return 'inactive';`);

rep('entitlement streak reset on confirmed purchase', `      const hasSub = list.some(p => p && (p.itemId === PLAY_SUBSCRIPTION_PRODUCT_ID || p.productIdentifier === PLAY_SUBSCRIPTION_PRODUCT_ID));
      if(hasLifetime){`,
`      const hasSub = list.some(p => p && (p.itemId === PLAY_SUBSCRIPTION_PRODUCT_ID || p.productIdentifier === PLAY_SUBSCRIPTION_PRODUCT_ID));
      if(hasLifetime || hasSub){ try{ localStorage.removeItem('sidecut_play_empty_streak'); }catch(_erk){} }
      if(hasLifetime){`);

// ---------- 5. Downloader: fallbackCand + duration-gated verify loop ----------
rep('fallbackCand declaration', `    var audio = null, fallback = null;`,
`    var audio = null, fallback = null, fallbackCand = null;`);

rep('duration-gated verify loop', `    for(var ci = 0; ci < cands.length && ci < 10; ci++){
      if(onStatus) onStatus('Verifying source ' + (ci + 1) + ' is really ' + (artist || 'the artist') + '…');
      var pa = await scYtPlayer(cands[ci].videoId);
      if(!pa) continue;
      if(!fallback) fallback = pa;
      if(scArtistMatch(artist, pa.author, pa.videoTitle, cands[ci].owner, cands[ci].title) &&
         scTitleMatch(title, pa.videoTitle, cands[ci].title)){
        audio = pa;
        break;
      }
    }
    // If nothing verified against the artist, the search results didn't match
    // this song — using a provably different artist's audio with the right
    // name is exactly the "songs come out wrong" bug, so fail loudly instead
    // (the UI offers a retry / external converters).
    if(!audio){
      if(fallback && (!artist || /^(unknown|various)/i.test(artist) || scArtistMatch(artist, fallback.author, fallback.videoTitle, fallback.owner, ''))){
        audio = fallback;
      }
    }
    if(!audio){ window.__scSourceFail = 'no matching source'; return null; }
    if(onStatus) onStatus('⬇ Downloading the audio on your device (a few seconds)…');
    var dec = await scFetchDecode(audio, onStatus);
    if(!dec){ window.__scSourceFail = 'download blocked'; return null; }
    if(onStatus) onStatus('✓ Audio ready — pick MP3, WAV or FLAC below');
    return { buffer: dec.buffer, streamUrl: dec.url, videoTitle: audio.videoTitle || '' };
  }`,
`    // Verify in three passes so the AUDIO that gets saved is this exact song:
    //   1. the player's own author/title must belong to the artist AND the track
    //      (a search snippet alone let a same-artist DIFFERENT song through);
    //   2. the clip's own length must be within a minute of the track's real
    //      seconds, so a same-titled loop, sped-up upload or compilation never
    //      even decodes;
    //   3. the DECODED buffer's duration is the final gate — within 15s is
    //      exact; 15–60s is accepted only as the closest available cut (album
    //      vs single edit); a minute+ off is never saved under the right tags.
    var verified = [];
    for(var ci = 0; ci < cands.length && ci < 10; ci++){
      if(onStatus) onStatus('Verifying source ' + (ci + 1) + ' is really ' + (artist || 'the artist') + '…');
      var pa = await scYtPlayer(cands[ci].videoId);
      if(!pa) continue;
      if(!fallback){ fallback = pa; fallbackCand = cands[ci]; }
      if(scArtistMatch(artist, pa.author, pa.videoTitle, cands[ci].owner, cands[ci].title) &&
         scTitleMatch(title, pa.videoTitle, cands[ci].title)){
        var cSec = Number(cands[ci].duration) || 0;
        if(expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) > 60) continue; // different recording
        verified.push({ pa: pa, delta: (expectedSec > 0 && cSec > 0) ? Math.abs(expectedSec - cSec) : -1 });
      }
    }
    // Closest to the real length decodes first (unknown lengths go last).
    verified.sort(function(a, b){ return ((a.delta === -1) ? 1e9 : a.delta) - ((b.delta === -1) ? 1e9 : b.delta); });
    var dec = null, nearCut = null, nearDec = null, durationRejected = false;
    for(var vi = 0; vi < verified.length && vi < 4; vi++){
      var entry = verified[vi];
      if(onStatus) onStatus('⬇ Downloading the audio on your device (a few seconds)…');
      var decTry = await scFetchDecode(entry.pa, onStatus);
      if(!decTry) continue;
      var bufSec = (decTry.buffer && decTry.buffer.duration) ? Number(decTry.buffer.duration) : 0;
      var bufDelta = (expectedSec > 0 && bufSec > 0) ? Math.abs(expectedSec - bufSec) : -1;
      if(bufDelta === -1 || bufDelta <= 15){ audio = entry.pa; dec = decTry; break; }
      if(bufDelta <= 60){ if(!nearCut){ nearCut = entry; nearDec = decTry; } continue; }
      durationRejected = true; // a minute+ off: wrong recording, never saved
    }
    // Right song, different cut: the closest within-a-minute decode is still
    // this track (album vs single edit) — nothing better exists at this point.
    if(!audio && nearCut){ audio = nearCut.pa; dec = nearDec; }
    // Nothing verified outright: the artist-only fallback (unknown/missing
    // artist metadata) still has to pass the SAME length gates before its
    // audio may be used — it is not a way around verification.
    var fallbackUsable = false;
    if(!audio && fallback && (!artist || /^(unknown|various)/i.test(artist) || scArtistMatch(artist, fallback.author, fallback.videoTitle, fallback.owner, ''))){
      var fbSec = fallbackCand ? (Number(fallbackCand.duration) || 0) : 0;
      if(expectedSec > 0 && fbSec > 0 && Math.abs(expectedSec - fbSec) > 60){
        durationRejected = true;
      } else {
        fallbackUsable = true;
        if(onStatus) onStatus('⬇ Downloading the audio on your device (a few seconds)…');
        var fbDec = await scFetchDecode(fallback, onStatus);
        var fbBuf = (fbDec && fbDec.buffer && fbDec.buffer.duration) ? Number(fbDec.buffer.duration) : 0;
        var fbDelta = (expectedSec > 0 && fbBuf > 0) ? Math.abs(expectedSec - fbBuf) : -1;
        if(fbDec && (fbDelta === -1 || fbDelta <= 60)){ audio = fallback; dec = fbDec; }
        else if(fbDec){ durationRejected = true; }
      }
    }
    if(!audio || !dec){
      if(durationRejected) window.__scSourceFail = 'the sources found are a different length than this track — not saving the wrong audio';
      else if(!fallback && !verified.length) window.__scSourceFail = 'no matching source';
      else if(fallbackUsable || verified.length) window.__scSourceFail = 'download blocked';
      else window.__scSourceFail = 'no matching source';
      return null;
    }
    if(onStatus) onStatus('✓ Audio ready — pick MP3, WAV or FLAC below');
    return { buffer: dec.buffer, streamUrl: dec.url, videoTitle: audio.videoTitle || '' };
  }`);

// ---------- 6. Seconds plumbing for the single-song paths ----------
rep('csMeta seconds field', `    var csMeta = { title: '', artist: '', album: '', thumb: '', year: '', genre: '', track: '', _aiUsed: false };`,
`    var csMeta = { title: '', artist: '', album: '', thumb: '', year: '', genre: '', track: '', seconds: 0, _aiUsed: false };`);

rep('csMeta iTunes duration', `              if(hit.trackNumber) csMeta.track = String(hit.trackNumber);`,
`              if(hit.trackNumber) csMeta.track = String(hit.trackNumber);
              if(hit.trackTimeMillis) csMeta.seconds = Math.round(hit.trackTimeMillis / 1000);`);

rep('quick-download seconds', `        genre: r.primaryGenreName || '', track: '', position: 0
      };
      var out = await scConvertOneTrack(meta, fmt, function(){});`,
`        genre: r.primaryGenreName || '', track: '', position: 0,
        seconds: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : 0
      };
      var out = await scConvertOneTrack(meta, fmt, function(){});`);

// ---------- 7. Version + changelog ----------
rep('APP_VERSION 60.4.4', `  const APP_VERSION = '60.4.3';`,
`  const APP_VERSION = '60.4.4';`);
if (/LEGACY_VERSIONS[^;]*'60\.4\.4'/.test(src)) throw new Error('60.4.4 must not be a legacy-map key');

rep('fix 60.4.3 changelog date (was UTC mislabeled)', `  { version: '60.4.3', date: 'September 22, 2026 · 12:56 AM EDT',`,
`  { version: '60.4.3', date: 'September 21, 2026 · 8:58 PM EDT',`);

// Correct EDT timestamp for the new entry (the old helper printed UTC with a
// literal "EDT" label — the exact mistake the user called out).
const edt = new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true
}); // e.g. "September 21, 2026, 9:15 PM"
const edtClean = edt.replace(/,(?=\s\d{1,2}:\d{2})/, ' · ') + ' EDT';

const ENTRY = `  { version: '60.4.4', date: '${edtClean}', title: 'Pinned artists restored · downloads verify the real audio', items: [
    'Pinned artists can no longer disappear: a failed storage read at startup now pauses saving instead of writing an empty list over your artists, bad entries are skipped instead of killing the render, and each view refreshes independently.',
    'The Pinned artists bubble stays on Home even when premium needs attention — tapping it shows the unlock card instead of the whole feature vanishing.',
    'A single empty Google Play reply no longer revokes premium: a subscription runs out through its own expiry date and lifetime needs three empty checks in a row, so Discover and pinned artists survive a Play hiccup.',
    'Downloads now verify the REAL audio length: a source more than a minute away from the track length never even decodes, the decoded buffer is checked too (15s exact, up to 60s only as the closest album/single cut), and nothing a minute+ off is ever saved under the right tags.',
    'Single-song conversions now carry the track length into that same check.',
    'Corrected the 60.4.3 patch-note timestamp — it had been written in UTC; the release went out 8:58 PM EDT, Sep 21.',
  ]},
`;
if (src.includes("version: '60.4.4'")) {
  console.log('\u2022 changelog 60.4.4 already present');
} else {
  rep('changelog 60.4.4 entry', 'const CHANGELOG = [\n', 'const CHANGELOG = [\n' + ENTRY);
}

fs.writeFileSync(FILE, src);
console.log(`\nApplied ${n} change(s) to index.html (EDT date used: ${edtClean})`);
