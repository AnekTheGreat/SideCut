#!/usr/bin/env node
// SideCut -- "SideCut takes up mad storage why does it take up 4.53 gb".
//
// WHAT IS ACTUALLY IN THERE (read out of the code, not guessed):
//
//   * The music itself. SideCut keeps its own copy of every song so it works with
//     no network and no ads, and `persistTrackMeta()` stores that copy **inside
//     the track record** as raw bytes: `normalize('blob','blobData','blobType')`
//     converts the audio File to an ArrayBuffer and nulls the blob, because the
//     Android WebView rejects generated Blobs cloned straight into IndexedDB
//     ("InvalidBlob") — the comment in the file says so.
//   * A REAL DEFECT ON TOP OF THAT: because the bytes live in the record, EVERY
//     write of a track re-serialises the whole song — and the hot paths are
//     metadata only. `recordPlay()` (every play) and `commitPlay()` (0.5 s later,
//     every play) each rewrote the audio; so did the lyrics re-check stamp, the
//     loudness gain and the waveform. Playing one song wrote its bytes twice.
//     Chromium keeps the replaced records until it compacts, so the storage the
//     device reports can sit far above the size of the actual music, and it grows
//     with listening rather than with the library.
//   * One full copy of the app's own page per version ever run (~2.4 MB each,
//     301 KB of it the changelog), deliberately never pruned.
//   * The covers, stored per track (an album's cover once per song in it).
//
// WHAT THIS PATCH DOES:
//   [1] The learned per-track fields (playCount, lastPlayedAt, lyricsCheckedAt,
//       gain, waveform) move into ONE small `trackSidecar` meta row, merged back
//       into every track as the library loads. The paths that actually change
//       audio (import, crop, convert, watermark cleaning) keep writing the
//       record; the metadata-only paths stop rewriting megabytes.
//   [2] The rollback copies are capped at the newest six (plus the pinned one and
//       the running one), at boot and on demand — bounded instead of unbounded.
//   [3] A Storage panel in Settings → More reports what is really there (music,
//       covers, rollback copies, caches, duplicates and the device's own number
//       for SideCut) and offers "Free up space".
//
// The remaining, bigger fix is NOT in this patch and should be its own release:
// moving the audio/cover bytes into their own store so startup stops deserialising
// every song (the other half of "why is it slow"). It rewrites how the whole
// library is laid out, so it needs its own careful migration.
//
//   node dev/patch-643.mjs
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
const done = (label) => { console.log('\u2022 ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The sidecar, defined next to persistTrackMeta (the function it exists to
//    stop calling on metadata-only changes).
// ---------------------------------------------------------------------------
const SIDECAR = [
  '  // ---- The sidecar: learned metadata that must not cost a song\'s bytes -----',
  '  // persistTrackMeta() stores a track\'s audio and cover as raw bytes INSIDE the',
  '  // track record (Android WebView rejects generated Blobs cloned into IndexedDB',
  '  // — see the note above), so every write of a track re-serialises megabytes.',
  '  // That is correct for the paths that change the audio (import, crop, convert,',
  '  // watermark cleaning) and ruinous for the ones that only learned something:',
  '  // recordPlay/commitPlay fire on every single play, the lyrics re-check stamps',
  '  // five songs per launch, the loudness gain and the waveform once per song. Each',
  '  // of those used to re-serialise the whole song to change one number, which is',
  '  // why storage grew with listening rather than with the library.',
  '  // They now live in one small `trackSidecar` meta row, merged back into every',
  '  // track as the library loads. It rides along in backups (it is a meta row) so',
  '  // play counts and covers survive a move to a new phone.',
  '  var SC_SIDECAR_FIELDS = [\'playCount\', \'lastPlayedAt\', \'lyricsCheckedAt\', \'gain\', \'waveform\'];',
  '  var scSidecar = {};',
  '  var scSidecarDirty = false;',
  '  var scSidecarTimer = null;',
  '  function scSidecarLoad(metaMap){',
  '    try{',
  '      var row = metaMap && metaMap.trackSidecar;',
  '      scSidecar = (row && typeof row === \'object\') ? row : {};',
  '    }catch(_e){ scSidecar = {}; }',
  '  }',
  '  function scSidecarApply(){',
  '    try{',
  '      allTracks.forEach(function(t){',
  '        var s = scSidecar[t.id];',
  '        if(!s) return;',
  '        for(var i = 0; i < SC_SIDECAR_FIELDS.length; i++){',
  '          var k = SC_SIDECAR_FIELDS[i];',
  '          if(s[k] !== undefined && s[k] !== null) t[k] = s[k];',
  '        }',
  '      });',
  '    }catch(_e){ }',
  '  }',
  '  function scSidecarSave(){',
  '    try{',
  '      scSidecarTimer = null;',
  '      if(!scSidecarDirty) return;',
  '      scSidecarDirty = false;',
  '      dbPut(\'meta\', { key: \'trackSidecar\', value: scSidecar });',
  '    }catch(_e){ }',
  '  }',
  '  function scSidecarSet(id, patch){',
  '    try{',
  '      if(!id || !patch) return;',
  '      var s = scSidecar[id] || (scSidecar[id] = {});',
  '      Object.keys(patch).forEach(function(k){ s[k] = patch[k]; });',
  '      scSidecarDirty = true;',
  '      // One write per burst, not one per event: playing a song sets a play count',
  '      // and a last-played stamp in quick succession and both belong in one row.',
  '      if(scSidecarTimer) return;',
  '      scSidecarTimer = setTimeout(scSidecarSave, 700);',
  '    }catch(_e){ }',
  '  }',
  '  function scSidecarFlush(){',
  '    try{ if(scSidecarTimer){ clearTimeout(scSidecarTimer); scSidecarSave(); } }catch(_e){ }',
  '  }',
  '  window.__scSidecar = function(){ return scSidecar; };',
  '  window.__scSidecarSet = scSidecarSet;',
  '  window.__scSidecarFlush = scSidecarFlush;',
  '',
  '  async function persistTrackMeta(t){',
].join('\n');

sub('the per-track sidecar is defined above persistTrackMeta',
  '  async function persistTrackMeta(t){',
  SIDECAR,
  undefined, 'var SC_SIDECAR_FIELDS =');

// ---------------------------------------------------------------------------
// 2. Merged back in as the library loads.
// ---------------------------------------------------------------------------
sub('the sidecar is merged onto every track at load',
  [
    '            manualOverride: r.manualOverride || false,',
    '            };',
    '        });',
  ].join('\n'),
  [
    '            manualOverride: r.manualOverride || false,',
    '            };',
    '        });',
    '    // Learned metadata (play counts, waveform, loudness, lyrics stamps) lives in',
    '    // one meta row instead of inside every track record — see the sidecar note.',
    '    scSidecarLoad(metaMap);',
    '    scSidecarApply();',
  ].join('\n'),
  undefined, 'scSidecarLoad(metaMap);');

// ---------------------------------------------------------------------------
// 3. The hot metadata paths stop writing the record.
// ---------------------------------------------------------------------------
sub('a play stamps last-played in the sidecar, not in the song record',
  [
    '    t.lastPlayedAt = Date.now();',
    '    persistTrackMeta(t);',
  ].join('\n'),
  [
    '    t.lastPlayedAt = Date.now();',
    '    // Was persistTrackMeta(t): a full re-serialisation of the song\'s audio to',
    '    // change one number, on every play. The sidecar row is a few bytes.',
    '    scSidecarSet(t.id, { lastPlayedAt: t.lastPlayedAt });',
  ].join('\n'),
  undefined, 'scSidecarSet(t.id, { lastPlayedAt: t.lastPlayedAt });');

sub('the play count is stamped in the sidecar too',
  [
    '    t.playCount = (t.playCount || 0) + 1;',
    '    totalPlays++;',
    '    persistTrackMeta(t);',
  ].join('\n'),
  [
    '    t.playCount = (t.playCount || 0) + 1;',
    '    totalPlays++;',
    '    scSidecarSet(t.id, { playCount: t.playCount });',
  ].join('\n'),
  undefined, 'scSidecarSet(t.id, { playCount: t.playCount });');

sub('the lyrics re-check stamp does not rewrite the song',
  [
    '          t.lyricsCheckedAt = Date.now();',
    '          try{ await persistTrackMeta(t); }catch(_eRecheckMiss){}',
  ].join('\n'),
  [
    '          t.lyricsCheckedAt = Date.now();',
    '          // A miss only learned "already asked" — that belongs in the sidecar,',
    '          // not in another write of the whole song.',
    '          try{ scSidecarSet(t.id, { lyricsCheckedAt: t.lyricsCheckedAt }); }catch(_eRecheckMiss){}',
  ].join('\n'),
  undefined, 'try{ scSidecarSet(t.id, { lyricsCheckedAt: t.lyricsCheckedAt }); }');

sub('the measured loudness is remembered in the sidecar',
  [
    '        t.gain = g;',
    '        persistTrackMeta(t);',
  ].join('\n'),
  [
    '        t.gain = g;',
    '        scSidecarSet(t.id, { gain: g });',
  ].join('\n'),
  undefined, 'scSidecarSet(t.id, { gain: g });');

sub('the computed waveform is remembered in the sidecar',
  [
    '      track.waveform = wf;',
    '      persistTrackMeta(track);',
  ].join('\n'),
  [
    '      track.waveform = wf;',
    '      scSidecarSet(track.id, { waveform: wf });',
  ].join('\n'),
  undefined, 'scSidecarSet(track.id, { waveform: wf });');

// ---------------------------------------------------------------------------
// 4. Rollback copies are capped instead of accumulating for ever.
// ---------------------------------------------------------------------------
const PRUNE = [
  '  // ---- Rollback copies, capped ----------------------------------------------',
  '  // Every version the app runs writes a full copy of its own page (~2.4 MB) so it',
  '  // can be rolled back to, and nothing ever removed one: a phone that has been',
  '  // through thirty updates was carrying thirty copies, for ever, invisibly. The',
  '  // newest few are kept (plus whichever version is pinned, plus the one running)',
  '  // and the rest are dropped.',
  '  var SC_SNAPSHOT_KEEP = 6;',
  '  async function scPruneVersionSnapshots(){',
  '    try{',
  '      var rows = await scMetaSnapshotRows();',
  '      if(!rows || rows.length <= SC_SNAPSHOT_KEEP) return 0;',
  '      var pinnedKey = null;',
  '      try{ var _p = await dbGet(\'meta\', \'pinnedVersion\'); if(_p && _p.value) pinnedKey = \'versionSnapshot_\' + _p.value; }catch(_e){ }',
  '      var newest = rows.slice().sort(function(a, b){',
  '        return ((b.value && b.value.savedAt) || 0) - ((a.value && a.value.savedAt) || 0);',
  '      });',
  '      var keep = newest.slice(0, SC_SNAPSHOT_KEEP).map(function(r){ return r.key; });',
  '      keep.push(\'versionSnapshot_\' + APP_VERSION);',
  '      if(pinnedKey) keep.push(pinnedKey);',
  '      var removed = 0;',
  '      for(var i = 0; i < newest.length; i++){',
  '        if(keep.indexOf(newest[i].key) !== -1) continue;',
  '        try{ await dbDelete(\'meta\', newest[i].key); removed++; }catch(_e){ }',
  '      }',
  '      return removed;',
  '    }catch(_e){ return 0; }',
  '  }',
  '  window.__scPruneVersionSnapshots = scPruneVersionSnapshots;',
  '',
  '  function saveMeta(){',
].join('\n');

sub('rollback copies are capped at the newest few',
  [
    '  function saveMeta(){',
  ].join('\n'),
  // Marker is deliberately loose: patch-645 replaced this pruner with a key-only
  // one (`scPruneVersionSnapshots(keepCount)`), so this patch must recognise BOTH
  // forms as "already applied" instead of putting the reading version back.
  PRUNE,
  undefined, 'function scPruneVersionSnapshots(');

sub('the cap runs at boot, right after this version saves its own copy',
  [
    '      if(!(await dbHas(\'meta\', versionKey))){',
    '        dbPut(\'meta\', { key: versionKey, value: { version: APP_VERSION, html: SHELL_SNAPSHOT_HTML, savedAt: Date.now() } });',
    '      }',
  ].join('\n'),
  [
    '      if(!(await dbHas(\'meta\', versionKey))){',
    '        dbPut(\'meta\', { key: versionKey, value: { version: APP_VERSION, html: SHELL_SNAPSHOT_HTML, savedAt: Date.now() } });',
    '      }',
    '      // And drop anything past the newest few, so the rollback copies cannot',
    '      // accumulate for ever (they are ~2.4 MB each, one per version ever run).',
    '      try{ await scPruneVersionSnapshots(); }catch(_ePrune){ }',
  ].join('\n'),
  // 645 moved this call off the boot turn entirely; either text means done.
  undefined, 'scRunWhenIdle(function(){ scPruneVersionSnapshots(); });');

// ---------------------------------------------------------------------------
// 5. The Storage panel.
// ---------------------------------------------------------------------------
const PANEL_HTML = [
  '      <!-- Collapsible: Storage -->',
  '      <div style="border:1px solid var(--line); border-radius:8px; margin-bottom:8px; overflow:hidden;">',
  '        <button id="collapsibleStorage" style="width:100%; padding:12px; background:var(--bg-raised); border:none; color:var(--ink); font-size:13px; font-weight:600; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">',
  '          <span>Storage</span><span id="collapseStorageIcon" style="transition:transform 0.2s;">▾</span>',
  '        </button>',
  '        <div id="collapsibleStorageContent" style="padding:12px; border-top:1px solid var(--line); display:none;">',
  '          <div style="font-size:11px; color:var(--ink-dim); margin-bottom:10px; line-height:1.55;">SideCut keeps its own copy of every song on this device — that is what makes it work with no network and no ads. Here is what that copy is made of.</div>',
  '          <div id="storagePanelBody" style="display:flex; flex-direction:column; gap:8px; font-size:12px;">Reading storage…</div>',
  '          <div style="display:flex; gap:8px; margin-top:12px;">',
  '            <button class="tab" id="storageRefreshBtn" style="flex:1; padding:10px; font-size:13px;">Recalculate</button>',
  '            <button class="tab" id="storageFreeUpBtn" style="flex:1; padding:10px; font-size:13px;">Free up space</button>',
  '          </div>',
  '        </div>',
  '      </div>',
  '',
].join('\n');

sub('the Storage block is in the More tab, above Roll back app',
  '      <!-- Collapsible: Versions -->',
  PANEL_HTML + '      <!-- Collapsible: Versions -->',
  undefined, 'id="collapsibleStorage"');

const PANEL_JS = [
  '  // ---- Storage panel --------------------------------------------------------',
  '  function scFmtBytes(n){',
  '    n = Number(n) || 0;',
  '    if(n >= 1073741824) return (n / 1073741824).toFixed(2) + \' GB\';',
  '    if(n >= 1048576) return (n / 1048576).toFixed(1) + \' MB\';',
  '    if(n >= 1024) return Math.round(n / 1024) + \' KB\';',
  '    return n + \' B\';',
  '  }',
  '  function scLocalStorageBytes(){',
  '    try{',
  '      var total = 0;',
  '      for(var i = 0; i < localStorage.length; i++){',
  '        var k = localStorage.key(i);',
  '        if(k === null) continue;',
  '        total += k.length + String(localStorage.getItem(k) || \'\').length;',
  '      }',
  '      return total;',
  '    }catch(_e){ return 0; }',
  '  }',
  '  async function renderStoragePanel(freedNote){',
  '    var body = $(\'storagePanelBody\');',
  '    if(!body) return;',
  '    var audioBytes = 0, artBytes = 0, silent = 0;',
  '    allTracks.forEach(function(t){',
  '      if(t.file && t.file.size) audioBytes += t.file.size; else silent++;',
  '      if(t.artBlob && t.artBlob.size) artBytes += t.artBlob.size;',
  '    });',
  '    var snaps = [], snapBytes = 0;',
  '    try{',
  '      snaps = await scMetaSnapshotRows();',
  '      snapBytes = snaps.reduce(function(n, r){ return n + (((r.value || {}).html || \'\').length); }, 0);',
  '    }catch(_e){ }',
  '    var dupGroups = (typeof getDuplicateGroups === \'function\') ? getDuplicateGroups() : [];',
  '    var estimate = null;',
  '    try{ if(navigator.storage && navigator.storage.estimate) estimate = await navigator.storage.estimate(); }catch(_e){ }',
  '    var rows = [];',
  '    rows.push([\'Your music\', allTracks.length + (allTracks.length === 1 ? \' song\' : \' songs\') + \' · \' + scFmtBytes(audioBytes)]);',
  '    rows.push([\'Covers\', scFmtBytes(artBytes)]);',
  '    rows.push([\'Saved rollback copies\', snaps.length + \' · \' + scFmtBytes(snapBytes) + \' (newest \' + SC_SNAPSHOT_KEEP + \' kept)\']);',
  '    rows.push([\'Saved settings & caches\', scFmtBytes(scLocalStorageBytes())]);',
  '    if(estimate && estimate.usage) rows.push([\'This device counts for SideCut\', scFmtBytes(estimate.usage) + (estimate.quota ? \' of \' + scFmtBytes(estimate.quota) + \' allowed\' : \'\')]);',
  '    var html = rows.map(function(r){',
  '      return \'<div style="display:flex; justify-content:space-between; gap:10px;"><span style="color:var(--ink-dim);">\' + escapeHtml(r[0]) + \'</span><span style="font-weight:600; text-align:right;">\' + escapeHtml(r[1]) + \'</span></div>\';',
  '    }).join(\'\');',
  '    if(silent) html += \'<div style="font-size:11px; color:var(--ink-dim); line-height:1.5;">\' + silent + \' song\' + (silent === 1 ? \'\' : \'s\') + \' reported no audio size — usually Spotify-only entries added by name.</div>\';',
  '    if(dupGroups.length){',
  '      var extra = dupGroups.reduce(function(n, g){ return n + g.length - 1; }, 0);',
  '      html += \'<div id="storageDupRow" style="cursor:pointer; color:var(--coral); font-weight:600;">\' + dupGroups.length + \' duplicate group\' + (dupGroups.length === 1 ? \'\' : \'s\') + \' — \' + extra + \' extra cop\' + (extra === 1 ? \'y\' : \'ies\') + \' · tap to review</div>\';',
  '    }',
  '    html += \'<div style="font-size:11px; color:var(--ink-dim); line-height:1.55; margin-top:2px;">\' + (freedNote ? escapeHtml(freedNote) + \' \' : \'\') + \'Songs removed from the library give their space back; a song you keep is kept, so SideCut can play it with no network.</div>\';',
  '    body.innerHTML = html;',
  '    var dupRow = document.getElementById(\'storageDupRow\');',
  '    if(dupRow) dupRow.addEventListener(\'click\', function(){ findDuplicates(); });',
  '  }',
  '  window.__scRenderStoragePanel = renderStoragePanel;',
  '  window.__scStorageBytes = function(){ return scLocalStorageBytes(); };',
  '',
  '  async function scFreeUpSpace(){',
  '    try{',
  '      var before = 0;',
  '      try{ before = (await scMetaSnapshotRows()).reduce(function(n, r){ return n + (((r.value || {}).html || \'\').length); }, 0); }catch(_e){ }',
  '      var removed = await scPruneVersionSnapshots();',
  '      var after = 0;',
  '      try{ after = (await scMetaSnapshotRows()).reduce(function(n, r){ return n + (((r.value || {}).html || \'\').length); }, 0); }catch(_e){ }',
  '      // Popup snapshots are rebuilt the moment a list is reopened; they are HTML',
  '      // caches, nothing the user made.',
  '      var cleared = 0;',
  '      try{',
  '        var dead = [];',
  '        for(var i = 0; i < localStorage.length; i++){',
  '          var k = localStorage.key(i);',
  '          if(k && k.indexOf(\'discPopupCache_\') === 0) dead.push(k);',
  '        }',
  '        dead.forEach(function(k){ try{ localStorage.removeItem(k); cleared++; }catch(_e){ } });',
  '      }catch(_e){ }',
  '      var freed = Math.max(0, before - after);',
  '      var msg = \'Freed \' + scFmtBytes(freed) + \' from \' + removed + \' old rollback cop\' + (removed === 1 ? \'y\' : \'ies\') + (cleared ? \' and cleared \' + cleared + \' saved list\' + (cleared === 1 ? \'\' : \'s\') : \'\') + \'.\';',
  '      toast(msg, 4000);',
  '      renderStoragePanel(msg);',
  '    }catch(e){ toast(\'Could not free that up — nothing was removed.\', 3500); }',
  '  }',
  '  window.__scFreeUpSpace = scFreeUpSpace;',
  '',
  '  function saveMeta(){',
].join('\n');

sub('the storage panel renderer lives next to the other panel code',
  '  function saveMeta(){',
  PANEL_JS,
  undefined, 'async function renderStoragePanel(freedNote){');

sub('the panel is wired to its two buttons and the collapsible',
  "$('settingsTabMore').addEventListener('click', () => showSettingsTab('more'));",
  [
    "$('settingsTabMore').addEventListener('click', () => showSettingsTab('more'));",
    "// ---- Storage panel: collapsible + the two buttons ----",
    "(function(){",
    "  var head = $('collapsibleStorage'), pane = $('collapsibleStorageContent'), icon = $('collapseStorageIcon');",
    "  if(head && pane){",
    "    head.addEventListener('click', function(){",
    "      var open = pane.style.display === 'none';",
    "      pane.style.display = open ? 'block' : 'none';",
    "      if(icon) icon.style.transform = open ? 'rotate(180deg)' : 'none';",
    "      if(open) renderStoragePanel();",
    "    });",
    "  }",
    "  var refresh = $('storageRefreshBtn');",
    "  if(refresh) refresh.addEventListener('click', function(){ renderStoragePanel(); toast('Storage re-read', 2000); });",
    "  var free = $('storageFreeUpBtn');",
    "  if(free) free.addEventListener('click', function(){ scFreeUpSpace(); });",
    "})();",
  ].join('\n'),
  undefined, "var head = $('collapsibleStorage')");

sub('the panel is filled in when the More tab opens',
  "    if(tab === 'more'){ renderVersionSnapshots(); renderDjPerPlaylistList(); }",
  "    if(tab === 'more'){ renderVersionSnapshots(); renderDjPerPlaylistList(); try{ renderStoragePanel(); }catch(_eSp){ } }",
  undefined, 'renderDjPerPlaylistList(); try{ renderStoragePanel(); }');

// The sidecar is flushed when the app is backgrounded so a play count cannot be
// lost to a killed process.
sub('a pending sidecar write is flushed when the app goes to the background',
  "    document.addEventListener('visibilitychange', function(){ if(document.hidden) __scNoteHidden(); else __scBeat(); });",
  [
    "    document.addEventListener('visibilitychange', function(){ if(document.hidden){ __scNoteHidden(); try{ if(window.__scSidecarFlush) window.__scSidecarFlush(); }catch(_e){ } } else { __scBeat(); } });",
  ].join('\n'),
  undefined, 'if(window.__scSidecarFlush) window.__scSidecarFlush();');

fs.writeFileSync(FILE, src);
console.log('\n' + edits + ' edit' + (edits === 1 ? '' : 's') + ' applied to index.html');
