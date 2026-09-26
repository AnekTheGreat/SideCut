#!/usr/bin/env node
// SideCut — "Boot takes 4 seconds and storage bro".
//
// Those are the same defect, and the panel data proves it: 454 songs · 2.99 GB
// inside a 4.12 GB app data directory.
//
// `loadFromDB()` does `dbGetAll('tracks')`, and every track record carries its
// song as a raw ArrayBuffer INSIDE it (`blobData`). So the library read does not
// read 454 names — it deserialises 2.99 GB of audio before the first paint. That
// is the 4 seconds. It is also why a play count or a lyric stamp used to cost
// megabytes, and why the database file (4.12 GB) is bigger than the music.
//
// The fix is to store the audio as a Blob HANDLE instead of inline bytes.
// IndexedDB keeps blobs by reference: the record becomes a few hundred bytes, the
// bytes are written once and read only when a song is actually played, and a
// metadata write never touches audio again. `restoreTrackFile()` already accepts
// both forms.
//
// Two things make it safe to ship:
//   * The ArrayBuffer form is kept as a FALLBACK. Some Android WebView builds
//     refuse a generated Blob cloned into IndexedDB ("InvalidBlob") — that is why
//     the app moved to raw ArrayBuffers in the first place — so every audio write
//     tries the cheap form and falls back rather than losing the write.
//   * Existing libraries are converted by a resumable one-record-at-a-time job
//     (`scCompactLibraryStep`), so the launch path only ever gets cheaper, a
//     crash mid-way leaves the song intact (one transaction per record), and a
//     device that refuses the cheap form changes nothing at all.
//
//   node dev/patch-647.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ── 1. Write the audio as a Blob handle, with the ArrayBuffer form as fallback ─
sub('persistTrackMeta: blob-first',
  `    await normalize('blob', 'blobData', 'blobType');
    await normalize('art', 'artData', 'artType');
    return dbPut('tracks', record);
  }`,
  `    // THE CHEAP FORM FIRST. IndexedDB stores a Blob by reference, so a record
    // whose audio is a Blob/File handle is a few hundred bytes: the song's bytes
    // are written once (not on every play count, lyric stamp, tag edit or tempo
    // scan) and they are not read again every time the library is opened.
    //
    // Measured before this: opening the library deserialised every song's audio
    // (2.99 GB for 454 songs — a four-second startup) and a single metadata write
    // on a 6 MB song re-serialised all 6 MB.
    //
    // The ArrayBuffer form below stays as the fallback, and it is not optional:
    // some Android WebView builds refuse a generated Blob cloned into IndexedDB
    // ("InvalidBlob"), which is why this app used raw ArrayBuffers in the first
    // place. Try the cheap form; on ANY failure fall back rather than lose it.
    if(record.blob && typeof record.blob.arrayBuffer === 'function' && !scAudioInlineOnly){
      try{
        await dbPut('tracks', record);
        scAudioFormOk = true;
        return true;
      }catch(_eBlob){
        scAudioInlineOnly = true;   // this device will not take it — stop asking
        scNoteAudioForm(_eBlob);
      }
    }
    await normalize('blob', 'blobData', 'blobType');
    await normalize('art', 'artData', 'artType');
    return dbPut('tracks', record);
  }`,
  1, 'THE CHEAP FORM FIRST');

sub('audio form flags',
  `  function restoreTrackFile(record){`,
  `  // Which form this device accepts for the audio inside a track record. A Blob
  // handle is what makes the library read cheap; an inline ArrayBuffer is the
  // fallback some WebView builds force. The reason is kept for the Storage panel
  // and for the probes, so "why is my startup still slow" has an answer.
  var scAudioInlineOnly = false;
  var scAudioFormOk = null;
  var scAudioFormNote = '';
  function scNoteAudioForm(e){
    try{
      scAudioFormOk = false;
      scAudioFormNote = String((e && (e.name || e.message)) || e || 'unknown');
    }catch(_e){ scAudioFormNote = 'unknown'; }
  }
  function restoreTrackFile(record){`,
  1, 'var scAudioInlineOnly = false;');

// ── 2. The records written the old way, converted one at a time ───────────────
sub('compaction job',
  `  async function scFreeUpSpace(){`,
  `  // ─── Compacting the library: the audio out of the metadata record ───────────
  // Track records written before this release carry their song as an ArrayBuffer
  // inside the record, so the library read reads every song. This converts them to
  // the Blob form one record at a time.
  //
  // It is safe by construction:
  //   * one transaction per record — a crash or a kill mid-way leaves that song
  //     exactly as it was, and the job simply continues next time;
  //   * idempotent and resumable — it only ever looks at records that still hold
  //     \`blobData\`, so there is no progress state to lose;
  //   * non-destructive — if the device refuses a Blob in IndexedDB the record is
  //     left untouched and the job stops for good (see scAudioInlineOnly);
  //   * off the launch path — a few records per idle slice, and the whole thing
  //     from the Storage panel.
  // The song's bytes are identical either way: restoreTrackFile() builds the same
  // File from a Blob handle as it does from the ArrayBuffer.
  var scCompacting = false;
  var scCompactStats = { converted: 0, left: null, refused: false, runs: 0 };
  async function scCompactLibraryStep(maxRecords, onProgress){
    if(scCompacting) return scCompactStats;
    if(scAudioInlineOnly){ scCompactStats.left = 0; return scCompactStats; }
    scCompacting = true;
    var converted = 0, scanned = 0, full = !(maxRecords > 0);
    var budget = full ? Infinity : maxRecords;
    try{
      var db = await openDB();
      var keys = await new Promise(function(resolve, reject){
        var tx = db.transaction('tracks', 'readonly');
        var os = tx.objectStore('tracks');
        if(typeof os.getAllKeys !== 'function'){ resolve(null); return; }
        var req = os.getAllKeys();
        req.onsuccess = function(){ resolve(req.result || []); };
        req.onerror = function(){ reject(req.error); };
      });
      for(var i = 0; keys && i < keys.length && converted < budget; i++){
        var rec = null;
        try{ rec = await dbGet('tracks', keys[i]); }catch(_eRead){ continue; }
        // Already compact (or a Spotify-only entry with no bytes at all).
        if(!rec || !rec.blobData) continue;
        scanned++;
        var blob = null;
        try{ blob = new Blob([rec.blobData], { type: rec.blobType || 'audio/mpeg' }); }catch(_eBlobMake){ blob = null; }
        if(!blob) continue;
        try{
          await dbPut('tracks', Object.assign({}, rec, { blob: blob, blobData: null }));
          converted++;
          scCompactStats.converted++;
        }catch(_eWrite){
          scAudioInlineOnly = true;
          scCompactStats.refused = true;
          scNoteAudioForm(_eWrite);
          break;
        }
        if(onProgress && converted % 20 === 0){ try{ onProgress(converted); }catch(_eProg){} }
        // Stay responsive: the app is usable while this runs.
        if(converted % 4 === 0) await new Promise(function(r){ setTimeout(r, 0); });
      }
      scCompactStats.runs++;
      if(full) scCompactStats.left = Math.max(0, scanned - converted);
    }catch(_eAll){ }
    scCompacting = false;
    return scCompactStats;
  }
  window.__scCompactLibraryStep = scCompactLibraryStep;
  window.__scCompactStats = function(){ return scCompactStats; };
  window.__scAudioForm = function(){ return { inlineOnly: scAudioInlineOnly, ok: scAudioFormOk, note: scAudioFormNote }; };

  async function scFreeUpSpace(){`,
  1, 'Compacting the library: the audio out of the metadata record');

// ── 3. A few records per launch, off the boot path ────────────────────────────
sub('idle compaction',
  `      scRunWhenIdle(function(){ scPruneVersionSnapshots(); });`,
  `      scRunWhenIdle(function(){ scPruneVersionSnapshots(); });
      // And a few songs get their audio moved out of the metadata record, so the
      // library read stops pulling the whole collection through memory at launch
      // (454 songs · 2.99 GB on a real phone — that is what a four-second startup
      // is made of). Storage → Compact library does the rest in one go; this makes
      // progress on its own without the user lifting a finger.
      scRunWhenIdle(function(){ try{ scCompactLibraryStep(12); }catch(_eCompact){} });`,
  1, 'Compact library does the rest in one go');

// ── 4. The panel: a row, and the button that finishes the job ────────────────
sub('panel: compact row',
  `    rows.push(['Saved settings & caches', scFmtBytes(scLocalStorageBytes())]);`,
  `    // How much of the library is still stored the old way — i.e. how much audio
    // is read again every single launch. This is the number behind a slow start.
    if(scAudioInlineOnly){
      rows.push(['Songs read at every launch', 'this device needs the old storage form']);
    } else if(scCompactStats.left === null){
      rows.push(['Songs read at every launch', 'not counted yet \\u2014 tap Compact library']);
    } else if(scCompactStats.left > 0){
      rows.push(['Songs read at every launch', scCompactStats.left + ' of ' + allTracks.length + ' \\u2014 tap Compact library']);
    } else {
      rows.push(['Songs read at every launch', 'none \\u2014 all compacted']);
    }
    rows.push(['Saved settings & caches', scFmtBytes(scLocalStorageBytes())]);`,
  1, 'Songs read at every launch');

sub('panel: compact button',
  `            <button class="tab" id="storageFreeUpBtn" style="flex:1; padding:10px; font-size:13px;">Free up space</button>
          </div>`,
  `            <button class="tab" id="storageFreeUpBtn" style="flex:1; padding:10px; font-size:13px;">Free up space</button>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="tab" id="storageCompactBtn" style="flex:1; padding:10px; font-size:13px;">Compact library</button>
          </div>
          <div style="font-size:11px; color:var(--ink-dim); margin-top:8px; line-height:1.55;">Compacting moves each song's audio out of the record the app reads when it starts. It runs on its own a few songs at a time; this does the whole library at once, and it is safe to interrupt.</div>`,
  1, 'storageCompactBtn');

sub('panel: compact wiring',
  `  var free = $('storageFreeUpBtn');
  if(free) free.addEventListener('click', function(){ scFreeUpSpace(); });`,
  `  var free = $('storageFreeUpBtn');
  if(free) free.addEventListener('click', function(){ scFreeUpSpace(); });
  var compact = $('storageCompactBtn');
  if(compact) compact.addEventListener('click', async function(){
    if(compact.disabled) return;
    compact.disabled = true;
    var wasLabel = compact.textContent;
    toast('Compacting your library — keep using the app, this runs in the background.', 4000);
    var res = await scCompactLibraryStep(0, function(n){
      try{ compact.textContent = 'Compacting… ' + n; }catch(_eL){}
    });
    compact.disabled = false;
    try{ compact.textContent = wasLabel; }catch(_eL2){}
    renderStoragePanel();
    if(res.refused) toast('This device would not take the compacted storage form — nothing was changed.', 5500);
    else if(res.left === 0) toast('Library compacted — startup no longer reads your songs.', 5500);
    else toast('Compacted ' + res.converted + ' songs so far.', 4000);
  });`,
  1, "compact.textContent = 'Compacting… '");

// ── 4b. dbPut() reports a refused write by resolving FALSE, never by rejecting ─
// (its outer try/catch swallows a synchronous DataCloneError from put() and
// returns false). Both audio writes have to treat that as the failure it is —
// otherwise a refused Blob looks like a saved song.
sub('blob write: false means refused',
  `      try{
        await dbPut('tracks', record);
        scAudioFormOk = true;
        return true;
      }catch(_eBlob){`,
  `      try{
        // dbPut() reports a refused write by resolving FALSE, not by rejecting:
        // a synchronous DataCloneError/InvalidBlob from put() is caught inside it
        // and turned into false. Treat that as the failure it is, or a song that
        // was never written would look saved.
        const _ok = await dbPut('tracks', record);
        if(_ok === false) throw new Error('IndexedDB refused the Blob form');
        scAudioFormOk = true;
        return true;
      }catch(_eBlob){`,
  1, "if(_ok === false) throw new Error('IndexedDB refused the Blob form');");

sub('compaction: false means refused',
  `        try{
          await dbPut('tracks', Object.assign({}, rec, { blob: blob, blobData: null }));
          converted++;`,
  `        try{
          const _ok = await dbPut('tracks', Object.assign({}, rec, { blob: blob, blobData: null }));
          if(_ok === false) throw new Error('IndexedDB refused the Blob form');
          converted++;`,
  1, 'const _ok = await dbPut(\'tracks\', Object.assign');

// ── 4c. "left" has to be knowable from a partial pass, or the panel lies ─────
// A budgeted pass stops early: it cannot say the library is clean, and the panel
// must not claim it. When a pass does see every key (because there were no more
// old records to find), the remainder is exact — for any size of pass.
sub('compaction: count seen and pending',
  `    var converted = 0, scanned = 0, full = !(maxRecords > 0);`,
  `    var converted = 0, seen = 0, pending = 0, full = !(maxRecords > 0);`,
  1, 'var converted = 0, seen = 0, pending = 0, full');

sub('compaction: seen++',
  `      for(var i = 0; keys && i < keys.length && converted < budget; i++){
        var rec = null;`,
  `      for(var i = 0; keys && i < keys.length && converted < budget; i++){
        seen++;`,
  1, '        seen++;');

sub('compaction: pending++',
  `        scanned++;
        var blob = null;`,
  `        pending++;
        var blob = null;`,
  1, '        pending++;');

sub('compaction: exact remainder',
  `      scCompactStats.runs++;
      if(full) scCompactStats.left = Math.max(0, scanned - converted);`,
  `      scCompactStats.runs++;
      // A pass that saw every key (there were no more old records left to find,
      // whatever the budget) knows the remainder exactly; one that stopped early
      // leaves it unknown and the panel says so instead of claiming it is clean.
      if(seen >= ((keys || []).length) && keys && keys.length) scCompactStats.left = Math.max(0, pending - converted);`,
  1, 'knows the remainder exactly');

// ── 4d. The note should say what happened, not "Error" ────────────────────────
sub('audio form note',
  `      scAudioFormNote = String((e && (e.name || e.message)) || e || 'unknown');`,
  `      scAudioFormNote = String((e && (e.message || e.name)) || e || 'unknown');`,
  1, 'scAudioFormNote = String((e && (e.message || e.name))');

// ── 4e. A few more songs per launch, so it finishes without a button press ────
sub('idle compaction per launch',
  `      scRunWhenIdle(function(){ try{ scCompactLibraryStep(12); }catch(_eCompact){} });`,
  `      scRunWhenIdle(function(){ try{ scCompactLibraryStep(25); }catch(_eCompact){} });`,
  1, 'scCompactLibraryStep(25);');

// ── 5. `_noAudio` told the truth about nothing ────────────────────────────────
sub('_noAudio covers both forms',
  `            _noAudio: !r.blob,`,
  `            _noAudio: !r.blob && !r.blobData,`,
  1, '_noAudio: !r.blob && !r.blobData,');

fs.writeFileSync(FILE, src);
console.log('patch-647: ' + edits + ' index.html edit(s)');
