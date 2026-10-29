#!/usr/bin/env node
/**
 * dev/check-8069.cjs - the streaming release, driven where it can be driven.
 *
 * What this proves, with the shipped functions sliced out of index.html and run:
 *
 *   1. the block only exists in the full builds (the gate is `!SC_IS_PLAY`), which is
 *      the Play build and nothing else;
 *   2. a signed source is picked as opus > m4a 141 > m4a 140 > any other audio row,
 *      and never from a row without a plain url (a cipher row would not play);
 *   3. a URL is treated as dead after thirty minutes, and only after;
 *   4. streaming playlists take an id once and drop it cleanly, and an emptied playlist
 *      disappears rather than lingering as a zero-length chip;
 *   5. the Library markup carries the seat for the block, outside #listPane (which is
 *      rewritten on every render), and the downloaded list is labelled under it;
 *   6. every inline script on the page still compiles - the module is 300 lines of new
 *      code inside a 3.8 MB script and a syntax error there would blank the whole app.
 *
 *   node dev/check-8069.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; return; }
  failures.push(msg);
}
function sliceFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('no function ' + name + ' in the page');
  let depth = 0;
  for (let p = src.indexOf('{', start); p < src.length; p++) {
    const ch = src[p];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return src.slice(start, p + 1); }
  }
  throw new Error('unbalanced body for ' + name);
}

/* ── 1. the gate ─────────────────────────────────────────────────────────── */
const gateFn = sliceFn(page, 'scStreamGate');
const ctx = vm.createContext({ console });
vm.runInContext(gateFn + '\n' + sliceFn(page, 'scStreamStale') + '\n' +
  sliceFn(page, 'scStreamPickUrl') + '\n' + sliceFn(page, 'scStreamPlAdd') + '\n' +
  sliceFn(page, 'scStreamPlRemove'), ctx);

ok(ctx.scStreamGate(true) === false, 'a Play build is refused the streaming block');
ok(ctx.scStreamGate(false) === true, 'the full builds get it');
ok(page.includes('var SC_STREAM_OK = !SC_IS_PLAY;'),
  'the page gate is exactly "not the Play build" - so the full APK and the full web');
ok(page.includes('if(!SC_STREAM_OK) return;'), 'the block refuses to render outside those builds');
ok(page.includes("if(!SC_STREAM_OK) return;                 // a Play build never even builds the block"),
  'and booting it is refused there too');

/* ── 2. picking a playable row ───────────────────────────────────────────── */
const resp = (formats, adaptive) => ({ streamingData: { formats: formats || [], adaptiveFormats: adaptive || [] } });
const audi = (itag, mime, url) => ({ itag, mimeType: mime, url });
ok(ctx.scStreamPickUrl(null) === '', 'no response means no url');
ok(ctx.scStreamPickUrl({}) === '', 'a response with no streamingData means no url');
ok(ctx.scStreamPickUrl(resp([], [audi(140, 'audio/mp4', 'm4a')])) === 'm4a',
  'm4a 140 is used when it is all there is');
ok(ctx.scStreamPickUrl(resp([], [audi(140, 'audio/mp4', 'm4a'), audi(251, 'audio/webm', 'opus')])) === 'opus',
  'opus 251 beats m4a 140');
ok(ctx.scStreamPickUrl(resp([], [audi(251, 'audio/webm', 'opus'), audi(141, 'audio/mp4', 'aac')])) === 'opus',
  'and beats 141 as well');
ok(ctx.scStreamPickUrl(resp([], [audi(141, 'audio/mp4', 'aac'), audi(140, 'audio/mp4', 'm4a')])) === 'aac',
  '141 beats 140');
ok(ctx.scStreamPickUrl(resp([audi(140, 'audio/mp4', 'muxed')], [])) === 'muxed',
  'the progressive pool is read too, for the uploads that only carry one');
ok(ctx.scStreamPickUrl(resp([], [{ itag: 251, mimeType: 'audio/webm', signatureCipher: 's=1&url=x' }])) === '',
  'a cipher-only row is skipped rather than handed to the audio element');
ok(ctx.scStreamPickUrl(resp([], [{ itag: 22, mimeType: 'video/mp4', url: 'v' }])) === '',
  'a video row is never picked for a song');

/* ── 3. the expiry ───────────────────────────────────────────────────────── */
const now = 1700000000000;
ok(ctx.scStreamStale(now - 1000, now) === false, 'a fresh url is not stale');
ok(ctx.scStreamStale(now - 29 * 60 * 1000, now) === false, '29 minutes is still good');
ok(ctx.scStreamStale(now - 31 * 60 * 1000, now) === true, '31 minutes is stale');
ok(ctx.scStreamStale(0, now) === true, 'a url with no timestamp counts as stale');
ok(ctx.scStreamStale(now + 5000, now) === true, 'a clock that went backwards counts as stale, not as fresh');
ok(page.includes('a.addEventListener(\'error\', function(){'), 'an error re-resolves the source');
ok(page.includes('scStreamStale(scStreamState.urlAt, Date.now())'), 'and staleness is checked before every play');

/* ── 4. playlists are their own thing ────────────────────────────────────── */
let pls = ctx.scStreamPlAdd([], 'Late night', 's_a');
ok(pls.length === 1 && pls[0].ids.length === 1, 'a new playlist is created with the song');
pls = ctx.scStreamPlAdd(pls, 'Late night', 's_b');
ok(pls[0].ids.length === 2, 'a second song is added to it');
pls = ctx.scStreamPlAdd(pls, 'Late night', 's_a');
ok(pls[0].ids.length === 2, 'the same song twice is still two songs, not three');
pls = ctx.scStreamPlRemove(pls, 'Late night', 's_a');
ok(pls[0].ids.length === 1 && pls[0].ids[0] === 's_b', 'removing a song leaves the rest');
pls = ctx.scStreamPlRemove(pls, 'Late night', 's_b');
ok(pls.length === 0, 'a playlist emptied to nothing disappears instead of lingering');
ok(ctx.scStreamPlAdd([], '   ', 's_a').length === 0, 'a blank name is refused');

/* ── 5. where the block lives ─────────────────────────────────────────────── */
const paneIdx = page.indexOf('<div id="listPane"></div>');
const seatIdx = page.indexOf('<div id="scStreamBlock"></div>');
ok(seatIdx > 0, 'the library carries the streaming seat');
ok(paneIdx > 0 && seatIdx < paneIdx, 'the seat sits above #listPane, where downloaded songs render');
ok(page.indexOf('<div id="scStreamBlock"></div>') > page.indexOf('<div id="tabs"'),
  'and below the search and tabs, so it opens the list rather than replacing them');
const seatBlock = page.slice(seatIdx - 400, paneIdx);
ok(!/id="scStreamBlock"[^>]*>[^<]/.test(seatBlock), 'the seat starts empty - it is filled by the module');
ok(page.includes('>Downloaded songs</div>'), 'the downloaded list is labelled under it');
ok(page.includes("dbPut('meta', { key: 'streamTracks'") &&
   page.includes("dbPut('meta', { key: 'streamPlaylists'"),
  'streaming songs and playlists live in their own meta keys');
ok(!/streamTracks[^\n]*allTracks/.test(page), 'a streaming song is never written into the downloaded library');

/* the player is its own element: the real queue is never touched by a stream */
const modStart = page.indexOf('var SC_STREAM_OK');
const modEnd = page.indexOf('function formatSyncedLyrics');
const mod = page.slice(modStart, modEnd);
ok(mod.length > 8000, 'the module is actually in the page (' + mod.length + ' bytes)');
ok(!/queueIndex\s*=/.test(mod), 'the stream module never moves the real queue index');
ok(!/allTracks\s*=\s*/.test(mod), 'and never rewrites the downloaded library');
ok(/document\.createElement\('audio'\)/.test(mod), 'it owns its audio element');

/* ── 6. the page still compiles ──────────────────────────────────────────── */
const scripts = [...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
let compiled = 0, biggest = 0, broken = null;
for (const m of scripts) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/.test(attrs)) continue;
  const type = (attrs.match(/type\s*=\s*["']([^"']+)["']/) || [])[1];
  if (type && !/javascript/.test(type)) continue;
  const code = m[2];
  if (!code.trim()) continue;
  try {
    new vm.Script(code, { filename: 'inline-' + compiled });
    if (code.length > biggest) biggest = code.length;
    compiled++;
  } catch (err) {
    broken = 'inline script #' + compiled + ': ' + err.message;
    break;
  }
}
ok(!broken, broken || 'every inline script compiles');
ok(biggest > 500000, 'the app shell itself was compiled (' + biggest + ' chars)');

/* ── report ──────────────────────────────────────────────────────────────── */
if (failures.length) {
  console.log('check-8069: ' + failures.length + ' FAILED, ' + pass + ' passed');
  failures.forEach(f => console.log('  FAIL  ' + f));
  process.exit(1);
}
console.log('check-8069: ' + pass + ' assertions passed (' + compiled + ' inline scripts compiled)');
