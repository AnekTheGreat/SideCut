#!/usr/bin/env node
// v61.3.9 add-on — "one run, one source per song".
//
// The report: half the time, tracks of a SIMILAR LENGTH get mixed up while a
// batch is being saved — you cannot tell which file is which, and the two can
// even come back as the exact same song.
//
// Measured cause (in scSpToBuffer + scRunBatchConvert):
//   * nothing in a run remembered which upload had already been used, so the
//     same YouTube source could be accepted for a second track;
//   * the decode order ranked candidates by LENGTH ONLY, and two tracks of one
//     album sit seconds apart — a tie the clock cannot break, so whichever
//     upload happened to rank first won and one song's audio landed under the
//     other's tags;
//   * the only identity gate on the <=15s path was a 60% word overlap
//     (scTitleMatch), so an upload carrying ANOTHER track's title passed as
//     long as the length was close. A length is not an identity — the same rule
//     the lyrics matcher learned in 61.3.8.
//
// The fix (idempotent, count==1 asserted, written whole — hand-splicing index.html
// has corrupted it before, and str_replace no-ops on this file):
//   1. scRunBatchConvert builds a run context { used: videoId -> title key,
//      titles: every title in the run } and hands it to every track;
//   2. scSpToBuffer skips an upload a sibling already claimed, and an upload
//      whose own title answers to a sibling's title more specifically than to
//      this song's;
//   3. verified candidates now decode EXACT-title matches first and let the
//      length break only that tie;
//   4. the chosen upload is recorded as this song's before the run moves on.
//
// Run: node dev/patch-6139c.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
const startLen = src.length;
let applied = 0, skipped = 0;

function sub(oldStr, newStr, label) {
  if (src.includes(newStr)) { skipped++; console.log('  = ' + label + ' (already applied)'); return; }
  const n = src.split(oldStr).length - 1;
  if (n !== 1) { console.error('  ! ' + label + ': needle found ' + n + ' times, want 1'); process.exit(1); }
  src = src.replace(oldStr, () => newStr);
  applied++;
  console.log('  + ' + label);
}

// ── 1. the batch builds the run context ─────────────────────────────────────
sub(
  `    var okCount = 0, failCount = 0, failedNames = [], tracksDone = [];
    for(var i = 0; i < tracks.length; i++){`,
  `    var okCount = 0, failCount = 0, failedNames = [], tracksDone = [];
    // One run, many songs — and the clock cannot tell two tracks of the same
    // album apart (they routinely sit seconds from each other). So the run
    // keeps its own claims: every title it contains, and which upload each
    // song has already taken. An upload may serve ONE song, which is what
    // stops two of them coming back as the exact same file, or swapped.
    var runTitles = Object.create(null);
    for(var _ti = 0; _ti < tracks.length; _ti++){
      var _tk = scTrackTitleKey(tracks[_ti] && tracks[_ti].title);
      if(_tk) runTitles[_tk] = true;
    }
    var runCtx = { used: Object.create(null), titles: runTitles };
    for(var i = 0; i < tracks.length; i++){`,
  'batch builds { used, titles } for the run'
);

sub(
  `        out = await scConvertOneTrack(meta, fmt, rowStatus);`,
  `        out = await scConvertOneTrack(meta, fmt, rowStatus, runCtx);`,
  'each track converts with the run context'
);

// ── 2. scConvertOneTrack forwards it ────────────────────────────────────────
sub(
  `  // Runs one track end-to-end through the single-track pipeline. Returns
  // { ok: true, blob, fName } or { ok: false, reason }.
  async function scConvertOneTrack(meta, fmt, onStatus){
    window.__scSourceFail = '';`,
  `  // Runs one track end-to-end through the single-track pipeline. Returns
  // { ok: true, blob, fName } or { ok: false, reason }.
  // \`ctx\` is the run context a batch hands down: which uploads a sibling
  // track has already taken, plus every title of that run. A one-off save
  // passes nothing and behaves exactly as it always has.
  async function scConvertOneTrack(meta, fmt, onStatus, ctx){
    window.__scSourceFail = '';`,
  'scConvertOneTrack takes the run context'
);

sub(
  `    var res = await scSpToBuffer(meta, function(txt){ if(onStatus) onStatus(txt); });`,
  `    var res = await scSpToBuffer(meta, function(txt){ if(onStatus) onStatus(txt); }, ctx);`,
  'the context reaches scSpToBuffer'
);

// ── 3. scSpToBuffer reads it (signature stays put for the harnesses) ────────
sub(
  `  async function scSpToBuffer(meta, onStatus){
    var title = meta.title || '', artist = meta.artist || '';`,
  `  async function scSpToBuffer(meta, onStatus){
    // Read as a trailing argument ON PURPOSE: the verification harnesses slice
    // this function out of the page by its exact declaration line, so the
    // signature itself must not move. No context means a one-off save — every
    // guard below stays off and that path behaves as it always has.
    var runCtx = (typeof arguments !== 'undefined' && arguments.length > 2) ? arguments[2] : null;
    var title = meta.title || '', artist = meta.artist || '';`,
  'scSpToBuffer reads the trailing run context'
);

// ── 4. the verify loop honours the claims ───────────────────────────────────
sub(
  `    var verified = [];
    for(var ci = 0; ci < cands.length && ci < 10; ci++){
      if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }`,
  `    var verified = [];
    // The claims are read right here so a guard can never fire for a run that
    // has none (a single save, or a test harness driving this function alone).
    var runUsed = (runCtx && runCtx.used) || null;
    var runSiblings = (runCtx && runCtx.titles) || null;
    var myTitleKey = runSiblings ? scTrackTitleKey(title) : '';
    var tried = 0;
    for(var ci = 0; ci < cands.length && tried < 10; ci++){
      if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }
      // A sibling track of this run already took this upload: handing the same
      // audio to a second song is exactly what must never happen again.
      if(runUsed && runUsed[cands[ci].videoId] && runUsed[cands[ci].videoId] !== myTitleKey) continue;
      // And an upload whose own title answers to a sibling's title belongs to
      // that sibling — it only looks like a match here when one title contains
      // the other, and "close enough" is not identity.
      if(runSiblings && scSourceClaimsSibling(cands[ci].title, title, myTitleKey, runSiblings)) continue;
      tried++;`,
  'claimed / sibling-owned uploads are skipped'
);

sub(
  `      if(onStatus) onStatus('Verifying source ' + (ci + 1) + ' is really ' + (artist || 'the artist') + `,
  `      if(onStatus) onStatus('Verifying source ' + tried + ' is really ' + (artist || 'the artist') + `,
  'status line counts real attempts'
);

sub(
  `      var pa = await scYtPlayer(cands[ci].videoId);
      if(!pa) continue;
      if(!fallback){ fallback = pa; fallbackCand = cands[ci]; }`,
  `      var pa = await scYtPlayer(cands[ci].videoId);
      if(!pa) continue;
      // The player's own title is the one that counts: a search snippet can
      // belong to a different track than the video it points at.
      if(runSiblings && pa.videoTitle && scSourceClaimsSibling(pa.videoTitle, title, myTitleKey, runSiblings)) continue;
      if(!fallback){ fallback = pa; fallbackCand = cands[ci]; }`,
  'the player title is checked against siblings too'
);

sub(
  `        verified.push({ pa: pa, delta: (expectedSec > 0 && cSec > 0) ? Math.abs(expectedSec - cSec) : -1, strong: scTitleStrong(title, pa.videoTitle, cands[ci].title) });`,
  `        verified.push({ pa: pa, vid: cands[ci].videoId, delta: (expectedSec > 0 && cSec > 0) ? Math.abs(expectedSec - cSec) : -1, strong: scTitleStrong(title, pa.videoTitle, cands[ci].title) });`,
  'verified entries carry their video id'
);

// ── 5. the exact title decides; the clock only breaks that tie ──────────────
sub(
  `    // Closest to the real length decodes first (unknown lengths go last).
    verified.sort(function(a, b){ return ((a.delta === -1) ? 1e9 : a.delta) - ((b.delta === -1) ? 1e9 : b.delta); });`,
  `    // An exact-title match decodes first; the length only breaks THAT tie.
    // Ranking by length alone put two songs of one album level — they sit
    // seconds apart — so the upload that happened to rank first was accepted
    // for whichever song asked first: one track's audio under another's tags.
    verified.sort(function(a, b){
      if(!!a.strong !== !!b.strong) return a.strong ? -1 : 1;
      return ((a.delta === -1) ? 1e9 : a.delta) - ((b.delta === -1) ? 1e9 : b.delta);
    });`,
  'exact-title sources decode first'
);

sub(
  `    var dec = null, nearCut = null, nearDec = null, durationRejected = false;`,
  `    var dec = null, nearCut = null, nearDec = null, durationRejected = false, chosenCand = null;`,
  'chosenCand declared'
);

sub(
  `      if(bufDelta === -1 || scDurationOk(expectedSec, bufSec)){ audio = entry.pa; dec = decTry; break; }`,
  `      if(bufDelta === -1 || scDurationOk(expectedSec, bufSec)){ audio = entry.pa; dec = decTry; chosenCand = entry; break; }`,
  'exact accept records its source'
);

sub(
  `    if(!audio && nearCut){ audio = nearCut.pa; dec = nearDec; }`,
  `    if(!audio && nearCut){ audio = nearCut.pa; dec = nearDec; chosenCand = nearCut; }`,
  'close-cut accept records its source'
);

sub(
  `        if(fbDec && (fbDelta === -1 || fbDelta <= 60)){ audio = fallback; dec = fbDec; }`,
  `        if(fbDec && (fbDelta === -1 || fbDelta <= 60)){ audio = fallback; dec = fbDec; chosenCand = fallbackCand; }`,
  'fallback accept records its source'
);

sub(
  `      else window.__scSourceFail = 'no matching source';
      return null;
    }`,
  `      else window.__scSourceFail = 'no matching source';
      return null;
    }
    // This upload now belongs to this song for the rest of the run, so no
    // sibling can be handed the same audio later in the same batch.
    if(runUsed && chosenCand && chosenCand.videoId && myTitleKey) runUsed[chosenCand.videoId] = myTitleKey;`,
  'the chosen upload is claimed for this song'
);

// ── 6. the two helpers, next to the other identity checks ───────────────────
sub(
  `  // Duration check: the Spotify plan carries the real track length in seconds.`,
  `  // Normalized identity of a track TITLE: lower-cased, every bracket and
  // punctuation folded to spaces and the gaps collapsed. This is how one track
  // of a batch is told from the next, because the length can never do it — two
  // tracks of one album routinely sit seconds apart, and "close enough on the
  // clock" is what let one song's upload answer for another's.
  function scTrackTitleKey(s){
    var t = String(s || '').toLowerCase(), out = '';
    for(var i = 0; i < t.length; i++){
      var c = t.charCodeAt(i);
      out += ((c >= 97 && c <= 122) || (c >= 48 && c <= 57)) ? t[i] : ' ';
    }
    var res = '', gap = false;
    for(var j = 0; j < out.length; j++){
      if(out[j] === ' '){ if(gap) continue; gap = true; res += ' '; }
      else { gap = false; res += out[j]; }
    }
    return res.trim();
  }
  // Does this candidate title answer to a DIFFERENT track of the same run?
  // Yes when it is an exact-title match for a sibling and not for this track,
  // or when the sibling claims it MORE specifically (this title is only a
  // fragment of theirs — "Pind" sitting inside "Pind Waliyan"). Either way the
  // upload belongs to that track: similar titles plus a similar length is still
  // two guesses, not one song.
  function scSourceClaimsSibling(candTitle, myTitle, myKey, siblingKeys){
    if(!candTitle || !siblingKeys) return false;
    var mine = String(myKey || scTrackTitleKey(myTitle) || '');
    if(!mine) return false;
    var mineStrong = scTitleStrong(mine, '', candTitle);
    for(var k in siblingKeys){
      if(!k || k === mine) continue;
      if(!scTitleStrong(k, '', candTitle)) continue;   // not that sibling's upload either
      if(!mineStrong) return true;                     // plainly the sibling's, not ours
      if(k.length > mine.length) return true;          // they claim it more specifically
    }
    return false;
  }
  // Duration check: the Spotify plan carries the real track length in seconds.`,
  'scTrackTitleKey + scSourceClaimsSibling helpers'
);

// ── 7. the changelog note for this fix (shared channel, no banned terms) ────
sub(
  `title: 'Spotify and YouTube links resolve again, and the drop check runs every source', items: [
    'Spotify link lookups stopped resolving:`,
  `title: 'Spotify and YouTube links resolve again, and the drop check runs every source', items: [
    'Two songs of the same album that run to almost the same length could come back as the SAME file, or as each other: the clock cannot tell them apart, so the upload that ranked first was accepted for whichever song was being saved at that moment. During one run an upload now belongs to one song only, an upload whose own title answers to another track of that run belongs to that track, and a source whose title matches exactly is tried before anything the clock merely approves — each song comes out as its own song',
    'Spotify link lookups stopped resolving:`,
  'changelog note for the fix'
);

if (src === startLen) {
  console.error('! nothing changed');
  process.exit(1);
}
fs.writeFileSync(FILE, src);
console.log('\\n' + applied + ' applied, ' + skipped + ' already there; ' + startLen + ' -> ' + src.length + ' bytes');

// Prove the markers landed exactly once, straight against the written file.
const written = fs.readFileSync(FILE, 'utf8');
const marks = [
  'scTrackTitleKey', 'scSourceClaimsSibling', 'runCtx', 'chosenCand',
  'arguments.length > 2', 'each song comes out as its own song'
];
let bad = 0;
for (const m of marks) {
  const c = written.split(m).length - 1;
  console.log('  ' + (c > 0 ? 'ok  ' : 'MISS') + ' ' + m + ' x' + c);
  if (!c) bad++;
}
process.exit(bad ? 1 : 0);
