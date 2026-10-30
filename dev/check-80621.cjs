#!/usr/bin/env node
// 80.6.21 - the stream is fast (read-ahead + six lanes), it cannot double the
// sound (the deck is silenced as a whole, and held down), and it has backups
// (ten audio rows, four muxed, walked before anything is asked again).
//
//   node dev/check-80621.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.21';"), 'the page runs 80.6.21');
ok(page.includes("version: '80.6.21'"), 'the changelog records 80.6.21');
ok(page.includes('80.6.21 - FAST, QUIET, AND HARD TO KILL'), 'the release comment is in the script');

function sliceFn(name) {
  const at = page.indexOf('\n  function ' + name + '(');
  if (at === -1) return '';
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  return end === -1 ? '' : page.slice(start, end + 4);
}

/* ── fast ───────────────────────────────────────────────────────────── */
ok(page.includes('var SC_STREAM_CACHE_MAX = 6;'), 'six songs stay in memory');
ok(page.includes('var SC_STREAM_CACHE_MS = 45 * 60 * 1000;'), 'for forty-five minutes');
ok(page.includes('var SC_STREAM_LANES = 6;'), 'a stream read is six lanes wide');
ok(page.includes('async function scFetchBytes(url, expectedSize, onProgress, lanesWanted){'),
  'the reader takes a lane count');
ok(page.includes('(Number(lanesWanted) > 0) ? Number(lanesWanted) : scDlLanes()'),
  'and honours it');
ok(page.includes('}, SC_STREAM_LANES);'), 'the stream read asks for six');
ok(page.includes('setTimeout(function(){ scStreamPrefetch(); }, 1200);'),
  'starting a song schedules the read-ahead');
ok(page.includes('scStreamState.reading = (Number(scStreamState.reading) || 0) + 1;'),
  'a read is counted');
ok(page.includes('scStreamState.reading = Math.max(0, (Number(scStreamState.reading) || 0) - 1);'),
  'and released when it ends');

const readOnly = sliceFn('scStreamReadOnly');
ok(readOnly.includes('lanes || SC_STREAM_LANES'), 'the read-ahead reads with six lanes too');
ok(readOnly.includes("type = 'audio/mp4'"), 'a muxed read is labelled audio');
ok(readOnly.includes('URL.createObjectURL(blob)'), 'and is handed back as an object URL');

const prefetch = sliceFn('scStreamPrefetch');
ok(prefetch.includes('if(scStreamState.reading || window.__scCancelDl) return;'),
  'the read-ahead never runs while a read is in flight');
ok(prefetch.includes('if(scStreamCacheGet(nxt.videoId)) return;'), 'nor for a song already here');
ok(prefetch.includes('scStreamCachePut(vid, { url: src'), 'what it reads is kept for Next');
ok(prefetch.includes('URL.revokeObjectURL(src)'), 'and given back if that song started meanwhile');

/* ── quiet ──────────────────────────────────────────────────────────── */
const quiet = sliceFn('scStreamQuietDeck');
ok(quiet.includes('audio.pause()') && quiet.includes('audio2.pause()'),
  'the deck is silenced as a whole, both elements');
ok(quiet.includes('clearInterval(crossfadeRAF)'), 'a running crossfade is cancelled');
ok(quiet.includes('pendingNextIndex = null'), 'and its pending hand-off dropped');
ok(!page.includes('if(la && !la.paused){ try{ la.pause(); }catch(_ePz){} }'),
  'the old half-silence is gone');
ok(page.includes('      scStreamQuietDeck();\n      scStreamBarSync();'),
  'taking the bar puts the deck to bed');
ok(page.includes('scStreamState.playing = true; scStreamQuietDeck(); scStreamBarSync();'),
  'and a resumed stream does it again');
ok(page.includes('  [audio, audio2].forEach(function(el){'),
  'both deck elements are watched for a play behind the stream');
ok(page.includes('if(typeof scStreamDeckGuard === \'function\' && scStreamDeckGuard()) return; }catch(_eRg){}'),
  'and a recovery never restarts it there');
ok(page.includes('try{ if(typeof scStreamDeckGuard === \'function\' && scStreamDeckGuard()) el.pause(); }catch(_eSg){}'),
  'the guard is what the deck listens to');

/* ── ten backups ────────────────────────────────────────────────────── */
ok(page.includes('take(d.streamingData.adaptiveFormats, false, audioStreams, 10);'),
  'the player keeps ten audio rows');
ok(page.includes('take(d.streamingData.formats, true, muxedStreams, 4);'),
  'and four progressive ones');
ok(page.includes('if(scStreamState.fixes > 12){'), 'the element retries up to twelve times');
const errBlock = page.slice(page.indexOf('      var alt0 = scStreamAltUrl();') - 900);
ok(page.includes('var alt0 = scStreamAltUrl();\n      if(alt0){ retryWith(alt0); return; }'),
  'a backup is tried BEFORE the resolver is asked again');
ok(errBlock.includes('function retryWith(u){'), 'through one retry path');
ok(!page.includes('        if(!u){ u = scStreamAltUrl(); }'), 'and not the old order');

/* ── driven: the deck is actually silenced ─────────────────────────── */
{
  const calls = [];
  const ctx = {
    audio: { paused: false, pause() { calls.push('audio'); } },
    audio2: { paused: false, pause() { calls.push('audio2'); } },
    crossfadeRAF: 42,
    crossfadeTriggered: true,
    pendingNextIndex: 3,
    clearInterval: (id) => calls.push('clear:' + id),
    scStreamState: { barOn: true, curId: 's_1' }
  };
  vm.createContext(ctx);
  vm.runInContext(sliceFn('scStreamQuietDeck') +
    '\nthis.__q = scStreamQuietDeck; this.__g = function(){' +
    ' if(typeof scStreamPhoneOwns !== "function" || !scStreamPhoneOwns()) return false; return true; };', ctx);
  vm.runInContext('scStreamPhoneOwns = function(){ return !!(scStreamState.barOn && scStreamState.curId); };', ctx);
  vm.runInContext('this.__q()', ctx);
  ok(calls.includes('audio') && calls.includes('audio2'), 'driven: both deck elements are paused');
  ok(calls.includes('clear:42') && ctx.crossfadeRAF === null, 'driven: the crossfade is cancelled');
  ok(ctx.crossfadeTriggered === false && ctx.pendingNextIndex === null, 'driven: the hand-off is dropped');
  ok(ctx.scStreamState.barOn === true, 'driven: the stream keeps its bar');
  ok(vm.runInContext('this.__g()', ctx) === true, 'driven: the deck guard holds while the stream owns the bar');
  ctx.scStreamState.curId = '';
  ok(vm.runInContext('this.__g()', ctx) === false, 'driven: and lets go when it does not');

  // The deck's own listener, executed for real.
  const seed = page.slice(page.indexOf("  [audio, audio2].forEach(function(el){"));
  const snippet = seed.slice(0, seed.indexOf('\n  });') + 5);
  const played = [];
  function deckEl(tag) {
    return {
      paused: true, tag,
      _play: null,
      addEventListener(ev, fn) { if (ev === 'play') this._play = fn; },
      pause() { played.push('pause:' + tag); }
    };
  }
  const ctx2 = { audio: deckEl('a'), audio2: deckEl('b'), scStreamDeckGuard: () => true };
  vm.createContext(ctx2);
  vm.runInContext(snippet, ctx2);
  ok(typeof ctx2.audio._play === 'function' && typeof ctx2.audio2._play === 'function',
    'driven: both deck elements are listening');
  ctx2.audio._play();
  ctx2.audio2._play();
  ok(played.includes('pause:a') && played.includes('pause:b'),
    'driven: a deck play behind the stream is stopped at once');
  played.length = 0;
  ctx2.scStreamDeckGuard = () => false;
  ctx2.audio._play();
  ok(played.length === 0, 'driven: and left alone when the stream does not own the bar');
}

/* ── driven: the read-ahead ────────────────────────────────────────── */
(async () => {
  const calls = [];
  const ctx = {
    Date, Object, Number, String, Array, Promise, Math, isFinite, JSON,
    setTimeout: () => 0,
    scFetchBytes: (u, size, cb, lanes) => { calls.push('read:' + u + ':' + lanes); return Promise.resolve(new Uint8Array(16).buffer); },
    scStreamState: { reading: 0, curId: 's_1', mime: 'audio/webm; codecs=opus' },
    scStreamUpNext: () => ({ id: 's_2', videoId: 'vid2', genre: 'Pop' }),
    scStreamResolveCached: (v) => { calls.push('resolve:' + v); return Promise.resolve('https://rr1/' + v); },
    scStreamCacheGet: () => null,
    scStreamCachePut: (k, e) => calls.push('put:' + k + ':' + e.url),
    URL: { createObjectURL: (b) => 'blob:' + (b.size || 0) + ':' + (b.type || ''), revokeObjectURL: (u) => calls.push('revoke:' + u) },
    Blob: function (parts, opts) { this.size = parts[0] ? parts[0].byteLength : 0; this.type = (opts && opts.type) || ''; },
    window: { __scCancelDl: false }
  };
  vm.createContext(ctx);
  const names = ['scStreamReadOnly', 'scStreamPrefetch'];
  vm.runInContext(names.map(sliceFn).join('\n') + '\nvar SC_STREAM_LANES = 6;' +
    '\nthis.__ro = scStreamReadOnly; this.__pf = scStreamPrefetch;', ctx);

  const direct = await vm.runInContext("this.__ro('https://rr1/x', 'video/mp4', 0, 6)", ctx);
  ok(direct === 'blob:16:audio/mp4', 'driven: a muxed read comes back labelled audio');
  ok(calls.includes('read:https://rr1/x:6'), 'driven: the read asked for six lanes');

  calls.length = 0;
  await vm.runInContext('this.__pf()', ctx);
  ok(calls.includes('resolve:vid2'), 'driven: the read-ahead resolves the next song');
  ok(calls.some((c) => c.startsWith('read:https://rr1/vid2:6')), 'driven: reads it, six lanes wide');
  ok(calls.includes('put:vid2:blob:16:audio/webm'), 'driven: and keeps it in the stream cache');
  ok(ctx.scStreamState.reading === 0, 'driven: without marking a read in flight');

  calls.length = 0;
  ctx.scStreamState.reading = 1;
  await vm.runInContext('this.__pf()', ctx);
  ok(calls.length === 0, 'driven: a read in flight cancels the read-ahead');

  calls.length = 0;
  ctx.scStreamState.reading = 0;
  ctx.scStreamUpNext = () => null;
  await vm.runInContext('this.__pf()', ctx);
  ok(calls.length === 0, 'driven: and a song with nothing next is left alone');

  if (bad.length) {
    console.log('check-80621: %d passed, %d FAILED', pass, bad.length);
    for (const b of bad) console.log('  x ' + b);
    process.exit(1);
  }
  console.log('check-80621: %d passed, 0 failed', pass);
})();
