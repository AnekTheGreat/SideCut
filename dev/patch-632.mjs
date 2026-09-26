#!/usr/bin/env node
// SideCut — 63.0.4: a saved album date sticks, and the invented days stop being
// served from the list's own snapshot.
//
// The user's words: "Album editing doesn't save after I close album history, and
// why do my older albums have the wrong date".
//
// Both are one defect, and it is NOT in the save. The edit really was written
// (`sidecut_albumEdits`) and the renderer really does read it back
// (`var _ae = getAlbumEdits()[ahAlb.collectionId]`). What swallowed it is the
// popup's own HTML snapshot: `openDiscoverPopup` stores the body it drew under
// `discPopupCache_📀 Album History`, and the Album History open path
// (`window.__refetchAlbums`, non-refetch branch) renders that stored HTML
// verbatim and RETURNS — no renderer runs at all. So:
//
//   * the pencil's Save repainted the snapshot (a picture of the list as it
//     looked BEFORE the edit), and so did every close-and-reopen — exactly
//     "editing doesn't save after I close album history";
//   * and a day the AI lookup invented, which `_dedupAlbums` cuts to its year
//     (dev/patch-630.mjs), was just as invisible: the snapshot never goes near
//     `_dedupAlbums`, so an album kept wearing `2008-04-24` — a day no store or
//     catalog has — however many times the list was reopened.
//
// Reproduced before the patch with dev/ah-edit-persist-check.cjs, which drives
// the real path with a stored snapshot present: the saved day never appears, and
// the invented day survives the reopen. 5 of its checks fail pre-patch.
//
// The fix is one idea with two ends: the snapshot is stamped with the edits (and
// the app version) it was drawn from, and is never served when that stamp no
// longer agrees — so a stale list is redrawn from the data, which is the path
// that applies your edits and cuts the invented days. Saving also drops the
// snapshot outright, so the very next draw is from the data.
//
//   node dev/patch-632.mjs
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

// ---------------------------------------------------------------------------
// 1. The stamp, and the drop. Both live next to the edit store so every writer
//    and every reader goes through the same one definition.
// ---------------------------------------------------------------------------
sub('the snapshot stamp and drop',
  `function saveAlbumEdit(collectionId, field, value){ var edits = getAlbumEdits(); if(!edits[collectionId]) edits[collectionId] = {}; edits[collectionId][field] = value; localStorage.setItem('sidecut_albumEdits', JSON.stringify(edits)); }`,
  `function saveAlbumEdit(collectionId, field, value){ var edits = getAlbumEdits(); if(!edits[collectionId]) edits[collectionId] = {}; edits[collectionId][field] = value; localStorage.setItem('sidecut_albumEdits', JSON.stringify(edits)); window._ahDropPopupCache(); }
// 📀 Album History keeps a snapshot of the list it last drew, and its open path
// renders that snapshot instead of drawing from the data. An edit made after the
// snapshot was taken is therefore invisible — the row you changed comes back as
// it was, on the repaint AND on every reopen, which reads as "album editing
// doesn't save after I close album history". Two ends fix it: saving drops the
// snapshot outright, and every snapshot carries this stamp, so one drawn before
// a change (or by a build that drew it differently) is never served either.
//
// ON WINDOW rather than a local declaration, deliberately: this file is built
// from block-scoped sections, so a plain function declaration here is invisible
// where the snapshot is written and read (the popup open path and
// openDiscoverPopup), and those calls throw straight into their own try/catch.
// Measured while writing this: declared locally, the Album History snapshot
// stopped being written AT ALL, so the popup rebuilt from the data every open.
window._ahPopupCacheSig = function(){
  var _e = '{}';
  try{ _e = localStorage.getItem('sidecut_albumEdits') || '{}'; }catch(_){}
  return _e + '|' + ((typeof window !== 'undefined' && window.APP_VERSION) || '');
};
window._ahDropPopupCache = function(){
  try{ localStorage.removeItem('discPopupCache_📀 Album History'); }catch(_){}
  try{ localStorage.removeItem('discPopupCache_' + '📀 Album History'); }catch(_){}
};`);

// ---------------------------------------------------------------------------
// 2. The writer stamps it.
// ---------------------------------------------------------------------------
sub('the snapshot is stamped as it is written',
  `JSON.stringify({title:title,body:bodyHTML,subtitle:subtitle||'',ts:Date.now(),pins:_pinSig})`,
  `JSON.stringify({title:title,body:bodyHTML,subtitle:subtitle||'',ts:Date.now(),pins:_pinSig,ahSig:(title==='📀 Album History' && typeof window._ahPopupCacheSig==='function' ? window._ahPopupCacheSig() : '')})`);

// ---------------------------------------------------------------------------
// 3. The reader refuses a snapshot whose stamp no longer agrees. Falling into the
//    else below already means "remove it", and the path then continues to the
//    artist-data branch, which draws from the data: your edits, and the invented
//    days cut to their year.
// ---------------------------------------------------------------------------
sub('a snapshot that disagrees is not served',
  `ahCached.body.indexOf('background-size:contain') !== -1){
            var _ahBody2 = ahCached.body;`,
  `ahCached.body.indexOf('background-size:contain') !== -1 && typeof window._ahPopupCacheSig === 'function' && ahCached.ahSig === window._ahPopupCacheSig()){
            // The stamp says which edits and which build this list was drawn from
            // (see _ahPopupCacheSig). One that no longer agrees is dropped by the
            // else below and the list is drawn from the data instead — so a date
            // you set, and a day that no catalog ever published, both show the
            // moment the list is opened, without a refetch.
            var _ahBody2 = ahCached.body;`);

fs.writeFileSync(FILE, src);
console.log('patch-632: ' + edits + ' index.html edit(s)');
