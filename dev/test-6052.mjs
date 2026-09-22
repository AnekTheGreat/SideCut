#!/usr/bin/env node
// v60.5.2 verification — extracts the ACTUAL shipped album id-remap block
// from index.html (the fix for "albums didn't transfer") and executes it
// against stub stores, then statically verifies the metadata-only import
// gate, the removal of the external converter hand-off (YTMP3 / Vocal
// Remover), the two flavor gates, and the release metadata.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NL = String.fromCharCode(10);

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

console.log('[1] album id-remap block — shipped code, actually executed');

const startVar = src.indexOf('var _albMerged = userAlbums || {};');
const tryIdx = startVar === -1 ? -1 : src.lastIndexOf('try{', startVar);
const endMark = "catch(eAlbum){ console.log('Album restore failed:', eAlbum); }";
const endIdx = startVar === -1 ? -1 : src.indexOf(endMark, startVar);
const locatable = startVar !== -1 && tryIdx !== -1 && endIdx !== -1;
ok(locatable, 'album remap block locatable in index.html');
const block = locatable ? src.slice(tryIdx, endIdx + endMark.length) : '';

async function runBlock(opts){
  const liveAlbums = opts.liveAlbums ? JSON.parse(JSON.stringify(opts.liveAlbums)) : {};
  const store = { userAlbums: opts.storeAlbums || null, albumOrder: opts.storeOrder || null };
  const puts = [];
  const lsData = {};
  const localStorageMock = {
    setItem(k, v){ lsData[k] = String(v); },
    getItem(k){ return (k in lsData) ? lsData[k] : null; },
  };
  const dbGetImpl = opts.dbGetImpl || (async (s, k) => ((k in store && store[k] != null) ? { key: k, value: store[k] } : null));
  const fn = new Function(
    'userAlbums', 'idRemap', 'allTracks', 'dbGet', 'dbPut', 'localStorage', 'albumOrder',
    'return (async function(){' + NL + block + NL +
    'return { albums: userAlbums, order: albumOrder }; })();'
  );
  const res = await fn(
    liveAlbums,
    opts.idRemap || {},
    opts.allTracks || [],
    dbGetImpl,
    (s, row) => { puts.push(row); store[row.key] = row.value; },
    localStorageMock,
    opts.liveOrder || []
  );
  return { albums: res.albums, order: res.order, puts, store, lsData };
}

const A = await runBlock({
  // The reported bug: fresh device, albums restored with the OLD phone ids.
  liveAlbums: { 'Punjabi Hits': { artist: 'Varinder', trackIds: ['e1', 'e2', 'e3'], createdAt: 1 } },
  storeAlbums: null,
  storeOrder: ['Punjabi Hits'],
  idRemap: { e1: 'L1', e2: 'L2', e3: 'L3' },
  allTracks: [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }],
  liveOrder: [],
});
ok(A.albums['Punjabi Hits'].trackIds.join(',') === 'L1,L2,L3',
  'exported ids re-pointed at this library ids (' + A.albums['Punjabi Hits'].trackIds.join(',') + ')');
ok(Array.isArray(A.order) && A.order[0] === 'Punjabi Hits', 'exported album card order applied when the live list is empty');
ok(A.store.userAlbums && A.store.userAlbums['Punjabi Hits'].trackIds.join(',') === 'L1,L2,L3',
  'remapped list persisted back to the store row');
ok(A.lsData['sidecut_albums_manual_v1'] === '1',
  'one-time auto-album migration stamped — a fresh install cannot re-judge and hide imported albums');
ok(A.puts.some(p => p && p.key === 'userAlbums'), 'userAlbums row written back exactly once target reached');

const B = await runBlock({
  liveAlbums: { 'Mixed': { trackIds: ['L1', 'e9', 'ghost', 'L1', 'e9'] } },
  storeAlbums: null, storeOrder: null,
  idRemap: { e9: 'L2' },
  allTracks: [{ id: 'L1' }],
  liveOrder: ['keep'],
});
ok(B.albums['Mixed'].trackIds.join(',') === 'L1,L2',
  'local ids kept, exporter ids remapped, dead ids dropped, duplicates collapsed (' + B.albums['Mixed'].trackIds.join(',') + ')');
ok(B.order.length === 1 && B.order[0] === 'keep', 'existing live album order left alone');

const C = await runBlock({
  liveAlbums: {},
  storeAlbums: { 'Old Album': { trackIds: ['e5'] } },
  storeOrder: null,
  idRemap: { e5: 'L5' },
  allTracks: [{ id: 'L5' }],
  liveOrder: [],
});
ok(!!C.albums['Old Album'] && C.albums['Old Album'].trackIds.join(',') === 'L5',
  'album present ONLY in the hydrate store row is merged and remapped');

const D = await runBlock({
  liveAlbums: { 'Untouched': { trackIds: ['L1', 'L2'] }, 'Empty': { trackIds: [] } },
  storeAlbums: null, storeOrder: null,
  idRemap: {},
  allTracks: [{ id: 'L1' }, { id: 'L2' }],
  liveOrder: [],
});
ok(D.albums['Untouched'].trackIds.join(',') === 'L1,L2', 'album whose ids are all local passes through unchanged');
ok(Array.isArray(D.albums['Empty'].trackIds) && D.albums['Empty'].trackIds.length === 0, 'empty album entry survives untouched');

const E = await runBlock({
  liveAlbums: { 'Kept': { trackIds: ['L1'] } },
  idRemap: {}, allTracks: [{ id: 'L1' }],
  liveOrder: [],
  dbGetImpl: async () => { throw new Error('store read failed'); },
});
ok(E.albums['Kept'] && E.albums['Kept'].trackIds.join(',') === 'L1',
  'a failing store read does not break the import (block self-catches)');

console.log('[2] metadata-only import gate');
ok(src.includes('if(m.path && !entry) continue;'), 'fileless manifest rows are imported instead of skipped');
const oldSkip = `        const entry = zipApi.file(m.path);
        if(!entry) continue;`;
ok(!src.includes(oldSkip), 'old skip-when-no-file path is gone');
ok(src.includes('entry ? await entry.async'), 'blob read null-guarded for the fileless branch');
ok(src.includes('const url = blob ? URL.createObjectURL(blob) : null;'), 'object URL only created when there is a blob');

console.log('[3] external converter hand-off removed');
ok(!src.includes('vocalremover.org'), 'no Vocal Remover link anywhere');
ok(!src.includes('ytmp3.cc'), 'no ytmp3.cc link anywhere');
ok(!src.includes('var ytmp3Url'), 'dead ytmp3Url leftover gone');
ok(src.includes('Couldn’t convert this video in-app'), 'plain in-app failure message present');
ok(src.includes('+ Add songs → + Files'), 'failure message points at the first-party import path');

console.log('[4] flavor gates — full keeps converters, release keeps them out');
ok(src.includes('if(SC_IS_PLAY){'), 'Play gate present at the converter entry (full build: flag unset -> runs)');
ok(src.includes('This converter is not part of this build'), 'release build refusal message intact');
ok(src.includes('scYtSearch') && src.includes('scYtPlayer'), 'shared search/player seams still present for both flavors');

console.log('[5] release metadata');
const verMatch = src.match(/const APP_VERSION = '([^']+)'/);
const ver = verMatch ? verMatch[1] : '';
ok(/^\d+\.\d+\.\d+$/.test(ver), 'APP_VERSION is a release version (' + ver + ') — newest changelog below must match it');
const blockCl = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + blockCl[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(/EDT$/.test(entries[0].date || ''), 'date ends in EDT (' + entries[0].date + ')');
  ok(entries[0].date.includes('September 22, 2026'), 'ship date correct (' + entries[0].date + ')');
  ok(entries[0].items.length >= 3, 'patch notes: ' + entries[0].items.length);
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
