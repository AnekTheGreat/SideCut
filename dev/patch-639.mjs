#!/usr/bin/env node
// SideCut -- "It takes way to long for the app to boot"
//
// The reported symptom is boot time, and the cause measured in the code is not
// one slow step but four things the boot path pays for on every launch, three of
// which grow with the size of the library and the number of updates installed:
//
//   [1] THE ROLLBACK ROWS. Every version that has ever run writes a
//       `versionSnapshot_<version>` row into the `meta` store holding
//       `document.documentElement.outerHTML` -- the app's whole page, ~2.4 MB --
//       and they are deliberately never pruned ("every version stays"). Nothing
//       filters them out of a read, so a plain `dbGetAll('meta')` deserialises
//       every one of them. Boot made FOUR such sweeps before the library was
//       even parsed (loadNotifReadState, loadSavedTheme, loadFromDB,
//       loadPinnedArtists) plus loadEnrichState, `checkForUpdatePopup` 900 ms
//       later, and `collectMeta` after every single storage change while the app
//       runs. With a dozen-plus versions in the store that is tens of megabytes
//       of page HTML deserialised per sweep, and it gets worse with every OTA.
//       Fixed by reading meta through key RANGES that exclude the rollback
//       block, so the storage layer never even reads those rows:
//         * scMetaSettingsRows()  -- everything except the rollback rows; this is
//           what every settings/library sweep now uses.
//         * scMetaSnapshotRows()  -- the rollback rows, and only for the one
//           caller that actually wants them (the version picker).
//         * dbHas()               -- a keyed existence test via getKey(), which
//           answers without deserialising the value.
//
//   [2] THE SNAPSHOT FILE was read and JSON.parse'd at the very top of
//       `__scSnapRestore()`, before anything had checked whether a restore was
//       needed -- and it is raced against a 4 s deadline in boot. On a healthy
//       phone that read + parse is pure waste on every launch. The wipe check
//       now runs first and the file is only opened when something really is
//       missing.
//
//   [3] TWO BLOCKING CDN SCRIPTS (JSZip, lamejs) sat in front of this file's own
//       script, so on a cold start nothing in the app ran until both third-party
//       requests had come back. They are only ever used by a user action and both
//       have runtime guards, so they are `defer`red off the critical path.
//
//   [4] PER-TRACK RESTORE WORK: loadFromDB called restoreTrackFile() three times
//       and restoreTrackArt() three times per song -- six File/blob wrappers and
//       object-URL candidates per track, before the first paint. Now once each.
//       And the list (a row plus a cover per song, the heaviest thing boot
//       builds) is rendered on the first idle slice instead of inside the boot
//       turn, so the shell and Home paint first; opening Library renders it.
//
//   node dev/patch-639.mjs
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
// 1. The two CDN dependencies leave the parser's critical path.
// ---------------------------------------------------------------------------
sub('JSZip and lamejs no longer block the app script',
  [
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js"></script>',
    '<script src="dev/native-updates.js"></script>',
  ].join('\n'),
  [
    '<!-- Both of these are only ever used by a user action -- JSZip to import or',
    '     export a .zip, lamejs to encode MP3 -- but loaded plainly they sat in',
    '     FRONT of this file\'s own script, so on a cold start nothing in the app',
    '     ran until two third-party requests had come back. On a slow connection',
    '     that wait is the whole of the slow boot. `defer` takes them off that',
    '     path: the app boots straight away and they arrive long before anything',
    '     can ask for them. Every use is already guarded (JSZip has a dynamic',
    '     loader fallback, lamejs is probed with typeof). -->',
    '<script defer src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>',
    '<script defer src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js"></script>',
    '<script src="dev/native-updates.js"></script>',
  ].join('\n'),
  undefined, '<script defer src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>');

// ---------------------------------------------------------------------------
// 2. dbGetAll learns a key range, and the two meta sweeps + dbHas are added.
// ---------------------------------------------------------------------------
sub('dbGetAll can read a key range instead of the whole store',
  [
    '  async function dbGetAll(storeName){',
    '    try{',
    '      const db = await openDB();',
    '      return new Promise((resolve, reject) => {',
    '        const tx = db.transaction(storeName, \'readonly\');',
    '        const req = tx.objectStore(storeName).getAll();',
  ].join('\n'),
  [
    '  async function dbGetAll(storeName, range){',
    '    try{',
    '      const db = await openDB();',
    '      return new Promise((resolve, reject) => {',
    '        const tx = db.transaction(storeName, \'readonly\');',
    '        // An optional key range is filtered by the storage layer itself, so a',
    '        // row outside it is never read or deserialised -- which is how the',
    '        // page-sized rollback rows stay out of a settings sweep entirely',
    '        // (see scMetaSettingsRows below).',
    '        const os = tx.objectStore(storeName);',
    '        const req = range ? os.getAll(range) : os.getAll();',
  ].join('\n'),
  undefined, 'const req = range ? os.getAll(range) : os.getAll();');

const HELPERS = [
  '  // ---- Meta sweeps that leave the page-sized rollback rows alone -----------',
  '  // Every version that has ever run saves a `versionSnapshot_<version>` row: a',
  '  // full copy of the app\'s own HTML (~2.4 MB), deliberately never pruned. A',
  '  // plain dbGetAll(\'meta\') therefore deserialised every one of them, and boot',
  '  // made four such sweeps before the library was parsed -- so boot got slower',
  '  // with every update installed, for rows no caller ever looked at.',
  '  // A range read is filtered at the storage layer. Keys are strings and every',
  '  // key that starts with the prefix sorts inside that one contiguous block, so',
  '  // two ranges (before it, after it) cover everything a settings read wants.',
  '  var SC_SNAP_KEY_PREFIX = \'versionSnapshot_\';',
  '  var SC_SNAP_KEY_MAX = SC_SNAP_KEY_PREFIX + \'\\uffff\';',
  '  function scHasKeyRanges(){ return typeof IDBKeyRange !== \'undefined\'; }',
  '  function scLooksLikeSnapshotKey(k){ return typeof k === \'string\' && k.indexOf(SC_SNAP_KEY_PREFIX) === 0; }',
  '  // Settings and library meta: everything EXCEPT the rollback rows.',
  '  async function scMetaSettingsRows(){',
  '    if(!scHasKeyRanges()){',
  '      var all = await dbGetAll(\'meta\');',
  '      return (all || []).filter(function(r){ return !(r && scLooksLikeSnapshotKey(r.key)); });',
  '    }',
  '    var parts = await Promise.all([',
  '      dbGetAll(\'meta\', IDBKeyRange.upperBound(SC_SNAP_KEY_PREFIX, true)),',
  '      dbGetAll(\'meta\', IDBKeyRange.lowerBound(SC_SNAP_KEY_MAX, true))',
  '    ]);',
  '    return (parts[0] || []).concat(parts[1] || []);',
  '  }',
  '  // The rollback rows themselves -- for the version picker, and nothing else.',
  '  async function scMetaSnapshotRows(){',
  '    if(!scHasKeyRanges()){',
  '      var all = await dbGetAll(\'meta\');',
  '      return (all || []).filter(function(r){ return r && scLooksLikeSnapshotKey(r.key); });',
  '    }',
  '    return await dbGetAll(\'meta\', IDBKeyRange.bound(SC_SNAP_KEY_PREFIX, SC_SNAP_KEY_MAX));',
  '  }',
  '  // Does a row exist? getKey() returns the key WITHOUT deserialising the value,',
  '  // which is the entire point when the value is a page of HTML.',
  '  async function dbHas(storeName, key){',
  '    try{',
  '      const db = await openDB();',
  '      return await new Promise((resolve, reject) => {',
  '        const tx = db.transaction(storeName, \'readonly\');',
  '        const os = tx.objectStore(storeName);',
  '        if(typeof os.getKey === \'function\'){',
  '          const req = os.getKey(key);',
  '          req.onsuccess = () => resolve(req.result !== undefined && req.result !== null);',
  '          req.onerror = () => reject(req.error);',
  '          return;',
  '        }',
  '        const req = os.get(key);',
  '        req.onsuccess = () => resolve(!!req.result);',
  '        req.onerror = () => reject(req.error);',
  '      });',
  '    }catch(e){ scNoteStorageError(e); console.error(\'Storage key check failed\', e); return false; }',
  '  }',
  '  // Run work after the first paint when the browser can tell us, so a heavy',
  '  // build never sits in the same turn as the screen the user is waiting for.',
  '  function scRunWhenIdle(fn){',
  '    try{',
  '      if(typeof requestIdleCallback === \'function\'){ requestIdleCallback(function(){ try{ fn(); }catch(e){} }, { timeout: 1200 }); return; }',
  '    }catch(e){}',
  '    setTimeout(function(){ try{ fn(); }catch(e){} }, 0);',
  '  }',
  '',
  '  function saveMeta(){',
].join('\n');

sub('the meta sweep helpers are defined next to dbGetAll',
  [
    '    }catch(e){ scNoteStorageError(e); console.error(\'Storage read failed\', e); return []; }',
    '  }',
    '',
    '  function saveMeta(){',
  ].join('\n'),
  [
    '    }catch(e){ scNoteStorageError(e); console.error(\'Storage read failed\', e); return []; }',
    '  }',
    '',
    HELPERS,
  ].join('\n'),
  undefined, 'async function scMetaSettingsRows(){');

// ---------------------------------------------------------------------------
// 3. Every meta sweep in the app stops carrying the rollback rows.
// ---------------------------------------------------------------------------
sub('the boot settings read skips the rollback rows',
  [
    '      const metaRows = await dbGetAll(\'meta\');',
    '      // Save a rollback point for this version, first time it\'s ever run \u2014 every version stays, none get pruned.',
    '      const versionKey = \'versionSnapshot_\' + APP_VERSION;',
    '      const snaps = metaRows.filter(r => r.key.indexOf(\'versionSnapshot_\') === 0);',
    '      if(!snaps.find(r => r.key === versionKey)){',
  ].join('\n'),
  [
    '      // Settings only. The rollback rows are page-sized and this sweep never',
    '      // looked at one -- its own check is the keyed existence test below.',
    '      const metaRows = await scMetaSettingsRows();',
    '      // Save a rollback point for this version, first time it\'s ever run \u2014 every version stays, none get pruned.',
    '      const versionKey = \'versionSnapshot_\' + APP_VERSION;',
    '      // A keyed test, not a sweep of every version\'s page HTML: getKey()',
    '      // answers without deserialising the ~2.4 MB value it is asking about.',
    '      if(!(await dbHas(\'meta\', versionKey))){',
  ].join('\n'),
  undefined, 'const metaRows = await scMetaSettingsRows();');

sub('the on-device snapshot writer sweeps settings without the rollback rows',
  '        var rows = await dbGetAll(\'meta\');',
  '        var rows = await scMetaSettingsRows();',
  undefined, 'var rows = await scMetaSettingsRows();');

sub('the version picker reads only the rollback rows',
  [
    '    const rows = (await dbGetAll(\'meta\')).filter(r => r.key.indexOf(\'versionSnapshot_\') === 0)',
    '      .sort((a,b) => b.value.savedAt - a.value.savedAt);',
  ].join('\n'),
  [
    '    // Only the rollback rows, and only when the picker is actually opened:',
    '    // this is the one caller that wants them.',
    '    const rows = (await scMetaSnapshotRows())',
    '      .filter(r => r && r.value)',
    '      .sort((a,b) => b.value.savedAt - a.value.savedAt);',
  ].join('\n'),
  undefined, 'const rows = (await scMetaSnapshotRows())');

sub('the update-popup check skips the rollback rows',
  [
    '      const metaRows = await dbGetAll(\'meta\');',
    '      const lastPopupRow = metaRows.find(r => r.key === \'lastSeenVersion\');',
  ].join('\n'),
  [
    '      const metaRows = await scMetaSettingsRows();',
    '      const lastPopupRow = metaRows.find(r => r.key === \'lastSeenVersion\');',
  ].join('\n'),
  undefined, 'const metaRows = await scMetaSettingsRows();\n      const lastPopupRow = metaRows.find(r => r.key === \'lastSeenVersion\');');

sub('the notification read skips the rollback rows',
  [
    '    const metaRows = await dbGetAll(\'meta\');',
    '    const row = metaRows.find(r => r.key === \'notifLastReadVersion\');',
  ].join('\n'),
  [
    '    const metaRows = await scMetaSettingsRows();',
    '    const row = metaRows.find(r => r.key === \'notifLastReadVersion\');',
  ].join('\n'),
  undefined, 'const metaRows = await scMetaSettingsRows();\n    const row = metaRows.find(r => r.key === \'notifLastReadVersion\');');

sub('the enrich state is a keyed read, not a sweep',
  [
    '      const rows = await dbGetAll(\'meta\');',
    '      const row = rows.find(r => r.key === \'enrichAttemptedIds\');',
    '      enrichAttemptedIds = new Set(Array.isArray(row && row.value) ? row.value : []);',
  ].join('\n'),
  [
    '      const row = await dbGet(\'meta\', \'enrichAttemptedIds\');',
    '      enrichAttemptedIds = new Set(Array.isArray(row && row.value) ? row.value : []);',
  ].join('\n'),
  undefined, 'const row = await dbGet(\'meta\', \'enrichAttemptedIds\');');

sub('the library load skips the rollback rows',
  [
    '    const [trackRows, metaRows] = await Promise.all([',
    '        dbGetAll(\'tracks\'),',
    '        dbGetAll(\'meta\')',
    '    ]);',
  ].join('\n'),
  [
    '    const [trackRows, metaRows] = await Promise.all([',
    '        dbGetAll(\'tracks\'),',
    '        scMetaSettingsRows()',
    '    ]);',
  ].join('\n'),
  undefined, '        scMetaSettingsRows()');

sub('the pinned-artists read skips the rollback rows',
  '    try{ rows = await dbGetAll(\'meta\'); }catch(e){ console.error(\'pinned artists read failed\', e); }',
  '    try{ rows = await scMetaSettingsRows(); }catch(e){ console.error(\'pinned artists read failed\', e); }',
  undefined, 'try{ rows = await scMetaSettingsRows(); }catch');

// ---------------------------------------------------------------------------
// 4. The on-device snapshot is only opened when something is really missing.
// ---------------------------------------------------------------------------
sub('the snapshot file is only read after the wipe check',
  [
    '        var FS = window.Capacitor.Plugins.Filesystem;',
    '        var res = null;',
    '        try{ res = await FS.readFile({ path: SNAP_NAME, directory: \'DATA\', encoding: \'utf8\' }); }catch(e){ return false; }',
    '        var snap = null;',
    '        try{ snap = JSON.parse(res.data || \'\'); }catch(e){ return false; }',
    '        if(!snap || snap.v !== 1) return false;',
    '        var lsWiped = false, metaWiped = false, readOk = false;',
  ].join('\n'),
  [
    '        var FS = window.Capacitor.Plugins.Filesystem;',
    '        // NOTE: the file is NOT read here any more. This used to open and',
    '        // JSON.parse the whole snapshot -- every stored setting, megabytes of',
    '        // it -- at the top of a restore hook that boot races against a 4 s',
    '        // deadline, and only afterwards discover that nothing was missing.',
    '        // The wipe check below runs first and the file is opened only when a',
    '        // store really does look empty (see the read further down).',
    '        var lsWiped = false, metaWiped = false, readOk = false;',
  ].join('\n'),
  undefined, '// The wipe check below runs first and the file is opened only when a');

sub('the snapshot file is opened once a wipe is confirmed',
  [
    '        if(!lsWiped && !metaWiped){',
    '          // The stores are healthy \u2014 forget the attempt count so a future wipe',
    '          // (a reinstall, a phone transfer) is still allowed to restore once.',
    '          try{ localStorage.removeItem(RESTORE_TRIES); }catch(e){}',
    '          return false;',
    '        }',
  ].join('\n'),
  [
    '        if(!lsWiped && !metaWiped){',
    '          // The stores are healthy \u2014 forget the attempt count so a future wipe',
    '          // (a reinstall, a phone transfer) is still allowed to restore once.',
    '          try{ localStorage.removeItem(RESTORE_TRIES); }catch(e){}',
    '          return false;',
    '        }',
    '        // Something really is missing, so now the snapshot is worth opening.',
    '        var res = null;',
    '        try{ res = await FS.readFile({ path: SNAP_NAME, directory: \'DATA\', encoding: \'utf8\' }); }catch(e){ return false; }',
    '        var snap = null;',
    '        try{ snap = JSON.parse(res.data || \'\'); }catch(e){ return false; }',
    '        if(!snap || snap.v !== 1) return false;',
  ].join('\n'),
  undefined, '// Something really is missing, so now the snapshot is worth opening.');

// ---------------------------------------------------------------------------
// 5. Restore each track's file and art once, not three times each.
// ---------------------------------------------------------------------------
sub('each track restores its file and cover once per load',
  [
    '    allTracks = trackRows',
    '        .map(r => ({',
    '            id: r.id,',
    '            file: restoreTrackFile(r),',
  ].join('\n'),
  [
    '    allTracks = trackRows',
    '        .map(r => {',
    '            // Restored once and re-used. This used to call restoreTrackFile()',
    '            // three times and restoreTrackArt() three times per song -- six',
    '            // File/blob wrappers for every track in the library, built before',
    '            // the first paint, along with two throwaway object URLs.',
    '            const _file = restoreTrackFile(r);',
    '            const _art = restoreTrackArt(r);',
    '            return {',
    '            id: r.id,',
    '            file: _file,',
  ].join('\n'),
  undefined, 'const _file = restoreTrackFile(r);');

sub('the object URL uses the restored file',
  '            url: restoreTrackFile(r) ? URL.createObjectURL(restoreTrackFile(r)) : null,',
  '            url: _file ? URL.createObjectURL(_file) : null,',
  undefined, 'url: _file ? URL.createObjectURL(_file) : null,');

sub('the cover uses the restored art',
  [
    '            artBlob: restoreTrackArt(r),',
    '            artUrl: restoreTrackArt(r) ? URL.createObjectURL(restoreTrackArt(r)) : null,',
  ].join('\n'),
  [
    '            artBlob: _art,',
    '            artUrl: _art ? URL.createObjectURL(_art) : null,',
  ].join('\n'),
  undefined, 'artUrl: _art ? URL.createObjectURL(_art) : null,');

sub('the track record closes the new block body',
  [
    '            manualOverride: r.manualOverride || false,',
    '        }));',
  ].join('\n'),
  [
    '            manualOverride: r.manualOverride || false,',
    '            };',
    '        });',
  ].join('\n'),
  undefined, '            };\n        });');

// ---------------------------------------------------------------------------
// 6. The list is built on the first idle slice, not inside the boot turn.
// ---------------------------------------------------------------------------
sub('the boot list render waits for the first idle slice',
  [
    '        renderTabs();',
    '        renderList();',
    '        // Watermark cleaning runs only when a new song is imported (cleanOnImport',
  ].join('\n'),
  [
    '        renderTabs();',
    '        // The list is the heaviest thing boot builds -- a row and a cover per',
    '        // song -- and it is not the screen the app lands on (Home is). Building',
    '        // it on the first idle slice lets the shell and Home paint first;',
    '        // opening Library renders it for real anyway, because',
    '        // navigate(\'library\') calls renderList() itself.',
    '        scRunWhenIdle(function(){ renderList(); });',
    '        // Watermark cleaning runs only when a new song is imported (cleanOnImport',
  ].join('\n'),
  undefined, 'scRunWhenIdle(function(){ renderList(); });');

fs.writeFileSync(FILE, src);
console.log('\n' + edits + ' edit' + (edits === 1 ? '' : 's') + ' applied to index.html');
