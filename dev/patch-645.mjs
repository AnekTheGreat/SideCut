#!/usr/bin/env node
// SideCut — the rollback copies, done right.
//
// The storage work added a prune of the `versionSnapshot_*` rows to the settings
// pass. Two things were wrong with putting it there, and the boot probe catches
// both:
//
//   1. IT READ EVERY COPY OF THE APP AT BOOT. Deciding which copies are newest
//      was done from `savedAt`, which means deserialising each ~2.4 MB page —
//      the exact cost 63.0.7 removed (a settings read must not drag every saved
//      page through it). Measured by dev/boot-639-check.cjs: 29.9 MB of meta
//      read at boot, 13 page-sized rows handed to callers, where the target is
//      zero of both.
//
//   2. IT SILENTLY DELETED THE USER'S ROLLBACK HISTORY. The version picker lists
//      those copies; pruning them at every launch means a phone that has taken
//      twelve updates can no longer be switched back to more than six of them,
//      without the user ever asking.
//
// So: the order is read from the KEYS (a snapshot key is `versionSnapshot_<ver>`
// and versions are dotted numbers), no row is ever deserialised to decide it,
// and the trimming is the user's — Settings → More → Storage → Free up space.
// The one automatic case is a runaway guard at 24 copies (~58 MB), by key only,
// off the boot turn.
//
//   node dev/patch-645.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

const VER = '63.0.8';
const STAMP = 'September 26, 2026 · 2:12 PM EDT';

// Only item 3 changes: it claimed the app now keeps "only the newest few" as a
// matter of course. It keeps them all; Free up space is what trims them.
const OLD_ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'SideCut can now tell you what your storage is being used for — and give most of it back', items: [
    'Settings → More now opens a Storage panel that says what SideCut is using your device for: how much its own copy of your music takes, how much the covers take, how many old versions of the app it has saved, and — when the phone reports it — how much the whole app counts for. Beside it, Free up space removes only the things SideCut can build again: the saved pages from old versions, the cached song lists, and any backup files it left behind in its own folder. Your music, playlists, covers and settings are never touched.',
    'A backup was leaving a complete second copy of your library inside the app, in its own private folder, and never clearing it up — only a failed one was deleted. On a big library that alone was gigabytes, counted against SideCut by the phone and invisible inside the app. It is now removed just after the share sheet has it, and the Storage panel sweeps anything left from before.',
    'SideCut also stopped re-saving whole songs to change one number. Play counts, the last-played stamp, the loudness measured for auto volume and the lyric-check marks are what SideCut learns as you listen, and each one was writing the entire song back to storage — megabytes, every play. They now live in one small row that is written once and quietly, so listening cannot make the app grow. Alongside it, the app keeps only the newest few saved pages of its own code instead of one for every version it has ever run.',
    'SideCut now measures its own startup and shows you where the time goes. Open the bell (\\ud83d\\udd14) and the first thing in it is “Startup — 1.9s”, your own number from your own phone; tap it and every step is listed: how long the app’s own code takes to load, then the notification state, your settings, the library read, and the moment Home is on screen. It is timed on every launch and the last one is kept.',
    'The song list is no longer built while the app is starting up, and the song you last had open is no longer analysed at launch. Both were work being done for a screen you were not looking at: Library builds its list the moment you open it, exactly as fast as before, and auto volume still measures every song you actually play. 63.0.7 had already cut the settings read from about 174 MB on a phone with a dozen updates behind it to a few kilobytes.',
    'If a step is still slow, that breakdown in the bell names it — which step, and how many milliseconds. Send that list over and the next round of work starts from your phone’s real numbers rather than from mine. Nothing about your music, playlists, covers or saved versions changes in this release.',
  ] },
`;

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'SideCut can now tell you what your storage is being used for — and give most of it back', items: [
    'Settings → More now opens a Storage panel that says what SideCut is using your device for: how much its own copy of your music takes, how much the covers take, how many old versions of the app it has saved, and — when the phone reports it — how much the whole app counts for. Beside it, Free up space removes only the things SideCut can build again: the saved pages from old versions, the cached song lists, and any backup files it left behind in its own folder. Your music, playlists, covers and settings are never touched.',
    'A backup was leaving a complete second copy of your library inside the app, in its own private folder, and never clearing it up — only a failed one was deleted. On a big library that alone was gigabytes, counted against SideCut by the phone and invisible inside the app. It is now removed just after the share sheet has it, and the Storage panel sweeps anything left from before.',
    'SideCut also stopped re-saving whole songs to change one number. Play counts, the last-played stamp, the loudness measured for auto volume and the lyric-check marks are what SideCut learns as you listen, and each one was writing the entire song back to storage — megabytes, every play. They now live in one small row that is written once and quietly, so listening cannot make the app grow.',
    'SideCut now measures its own startup and shows you where the time goes. Open the bell (\\ud83d\\udd14) and the first thing in it is “Startup — 1.9s”, your own number from your own phone; tap it and every step is listed: how long the app’s own code takes to load, then the notification state, your settings, the library read, and the moment Home is on screen. It is timed on every launch and the last one is kept.',
    'The song list is no longer built while the app is starting up, and the song you last had open is no longer analysed at launch. Both were work being done for a screen you were not looking at: Library builds its list the moment you open it, exactly as fast as before, and auto volume still measures every song you actually play. 63.0.7 had already cut the settings read from about 174 MB on a phone with a dozen updates behind it to a few kilobytes.',
    'If a step is still slow, that breakdown in the bell names it — which step, and how many milliseconds. Send that list over and the next round of work starts from your phone’s real numbers rather than from mine. Nothing about your music, playlists, covers or saved versions changes in this release.',
  ] },
`;

// The prune itself: key-only, and only when asked (or past a runaway guard).
const OLD_PRUNE = `  // ---- Rollback copies, capped ----------------------------------------------
  // Every version the app runs writes a full copy of its own page (~2.4 MB) so it
  // can be rolled back to, and nothing ever removed one: a phone that has been
  // through thirty updates was carrying thirty copies, for ever, invisibly. The
  // newest few are kept (plus whichever version is pinned, plus the one running)
  // and the rest are dropped.
  var SC_SNAPSHOT_KEEP = 6;
  async function scPruneVersionSnapshots(){
    try{
      var rows = await scMetaSnapshotRows();
      if(!rows || rows.length <= SC_SNAPSHOT_KEEP) return 0;
      var pinnedKey = null;
      try{ var _p = await dbGet('meta', 'pinnedVersion'); if(_p && _p.value) pinnedKey = 'versionSnapshot_' + _p.value; }catch(_e){ }
      var newest = rows.slice().sort(function(a, b){
        return ((b.value && b.value.savedAt) || 0) - ((a.value && a.value.savedAt) || 0);
      });
      var keep = newest.slice(0, SC_SNAPSHOT_KEEP).map(function(r){ return r.key; });
      keep.push('versionSnapshot_' + APP_VERSION);
      if(pinnedKey) keep.push(pinnedKey);
      var removed = 0;
      for(var i = 0; i < newest.length; i++){
        if(keep.indexOf(newest[i].key) !== -1) continue;
        try{ await dbDelete('meta', newest[i].key); removed++; }catch(_e){ }
      }
      return removed;
    }catch(_e){ return 0; }
  }
  window.__scPruneVersionSnapshots = scPruneVersionSnapshots;
`;

const NEW_PRUNE = `  // ---- Rollback copies -------------------------------------------------------
  // Every version the app has run saved a full copy of its own page (~2.4 MB) so
  // it can be switched back to, and nothing ever removed one. Two rules decide
  // what happens to them now:
  //
  //   * They are NEVER read to count them. Deciding which copies are newest from
  //     \`savedAt\` means deserialising every page — the 29.9 MB-at-boot cost this
  //     release is supposed to be removing. A key is \`versionSnapshot_<version>\`
  //     and versions are dotted numbers, so the order is readable off the keys.
  //   * They are NOT dropped behind the user's back. The version picker lists
  //     these copies; that is a feature, so trimming them is a choice —
  //     Settings → More → Storage → Free up space keeps the newest few.
  //
  // The one automatic case is a runaway guard, off the boot turn, by key only.
  var SC_SNAPSHOT_KEEP = 6;
  var SC_SNAPSHOT_HARD_CAP = 24;
  function scCompareVersions(a, b){
    var pa = String(a || '').split('.'), pb = String(b || '').split('.');
    var n = Math.max(pa.length, pb.length);
    for(var i = 0; i < n; i++){
      var na = parseInt(pa[i], 10) || 0, nb = parseInt(pb[i], 10) || 0;
      if(na !== nb) return na - nb;
    }
    return 0;
  }
  // Snapshot KEYS, newest first. No value is fetched, so nothing page-sized is
  // ever deserialised here.
  async function scSnapshotKeys(){
    if(!scHasKeyRanges()) return [];
    try{
      const db = await openDB();
      const keys = await new Promise((resolve, reject) => {
        const tx = db.transaction('meta', 'readonly');
        const os = tx.objectStore('meta');
        if(typeof os.getAllKeys !== 'function'){ resolve(null); return; }
        const req = os.getAllKeys(IDBKeyRange.bound(SC_SNAP_KEY_PREFIX, SC_SNAP_KEY_MAX));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if(!keys) return [];
      return keys.filter(scLooksLikeSnapshotKey).sort(function(a, b){
        return scCompareVersions(String(b).slice(SC_SNAP_KEY_PREFIX.length), String(a).slice(SC_SNAP_KEY_PREFIX.length));
      });
    }catch(e){ scNoteStorageError(e); return []; }
  }
  // keepCount: how many of the newest to keep. With no argument this is only the
  // runaway guard — below SC_SNAPSHOT_HARD_CAP it does nothing at all.
  async function scPruneVersionSnapshots(keepCount){
    try{
      var keys = await scSnapshotKeys();
      if(!keys.length) return 0;
      var forced = (typeof keepCount === 'number' && keepCount > 0);
      var keep = forced ? keepCount : SC_SNAPSHOT_HARD_CAP;
      if(keys.length <= keep) return 0;
      var safe = keys.slice(0, keep);
      safe.push('versionSnapshot_' + APP_VERSION);
      try{
        var _p = await dbGet('meta', 'pinnedVersion');
        if(_p && _p.value) safe.push('versionSnapshot_' + _p.value);
      }catch(_e){ }
      var removed = 0;
      for(var i = 0; i < keys.length; i++){
        if(safe.indexOf(keys[i]) !== -1) continue;
        try{ await dbDelete('meta', keys[i]); removed++; }catch(_e){ }
      }
      return removed;
    }catch(_e){ return 0; }
  }
  window.__scPruneVersionSnapshots = scPruneVersionSnapshots;
  window.__scSnapshotKeys = scSnapshotKeys;
`;

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

// The header line above the block marks it, so the big replacement is idempotent
// even if only part of the text ever changes.
if (src.indexOf('---- Rollback copies -------------------------------------------------------') !== -1 && src.indexOf('function scSnapshotKeys()') !== -1) {
  skip('prune rewrite');
} else {
  sub('prune rewrite', OLD_PRUNE, NEW_PRUNE, 1, '');
}

sub('boot: no page-sized read, no silent delete',
  `      // And drop anything past the newest few, so the rollback copies cannot
      // accumulate for ever (they are ~2.4 MB each, one per version ever run).
      try{ await scPruneVersionSnapshots(); }catch(_ePrune){ }`,
  `      // A guard against a runaway, and nothing more: past SC_SNAPSHOT_HARD_CAP
      // copies (~58 MB) the oldest are dropped, BY KEY, off the boot turn. No
      // row is read to decide it (a page-sized read here is exactly what this
      // release removes) and the ordinary history stays listed in the version
      // picker — trimming that is the user's call, in Storage → Free up space.
      scRunWhenIdle(function(){ scPruneVersionSnapshots(); });`,
  1, 'A guard against a runaway, and nothing more');

// "(newest 6 kept)" read as if the app had already thrown the rest away. It has
// not: that is what Free up space does.
sub('panel: honest label',
  `    rows.push(['Saved rollback copies', snaps.length + ' · ' + scFmtBytes(snapBytes) + ' (newest ' + SC_SNAPSHOT_KEEP + ' kept)']);`,
  `    rows.push(['Saved rollback copies', snaps.length + ' · ' + scFmtBytes(snapBytes) + (snaps.length > SC_SNAPSHOT_KEEP ? ' (Free up space keeps the newest ' + SC_SNAPSHOT_KEEP + ')' : '')]);`,
  1, "scFmtBytes(snapBytes) + (snaps.length > SC_SNAPSHOT_KEEP");

sub('free up: keep the newest six',
  `      var removed = await scPruneVersionSnapshots();`,
  `      var removed = await scPruneVersionSnapshots(SC_SNAPSHOT_KEEP);`,
  1, 'scPruneVersionSnapshots(SC_SNAPSHOT_KEEP)');

{
  const at = src.indexOf("  { version: '" + VER + "',");
  const endMark = '\n  ] },\n';
  if(at === -1) throw new Error('CHANGELOG: no ' + VER + ' entry');
  const end = src.indexOf(endMark, at);
  if(end === -1) throw new Error('CHANGELOG: no end for the ' + VER + ' entry');
  const existing = src.slice(at, end + endMark.length);
  if(existing === ENTRY || existing === OLD_ENTRY) {
    if(existing === ENTRY) skip('CHANGELOG head entry');
    else { src = src.slice(0, at) + ENTRY + src.slice(end + endMark.length); done('CHANGELOG head entry (rollback wording)'); }
  } else {
    throw new Error('CHANGELOG: the ' + VER + ' entry is not the one this patch expects');
  }
}

fs.writeFileSync(FILE, src);
console.log('patch-645: ' + edits + ' index.html edit(s)');
