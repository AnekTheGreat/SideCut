#!/usr/bin/env node
// 80.6.19 - the faster start, the genre that carries, and the rail that stays put.
//
//   node dev/check-80619.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.19';"), 'the page runs 80.6.19');
ok(page.includes("version: '80.6.19'"), 'the changelog records 80.6.19');
ok(page.includes('80.6.19 - THE NEXT SONG KEEPS THE GENRE'), 'the release comment is in the script');

function sliceFn(name) {
  const at = page.indexOf('\n  function ' + name + '(');
  if (at === -1) return '';
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  return end === -1 ? '' : page.slice(start, end + 4);
}

/* ── the start is not spent waiting ─────────────────────────────────────── */
const play = sliceFn('scStreamPlay');
ok(play.includes('scStreamCacheGet(t.videoId)'), 'a song already read is taken from memory');
ok(play.includes("scStreamState.via = 'cache'"), 'and says so');
ok(play.includes('scStreamPlayFresh(t);'), 'anything else takes the fresh path');
const fresh = sliceFn('scStreamPlayFresh');
ok(fresh.includes('beginRead(u);'), 'the read starts in the same tap as the link');
ok(fresh.indexOf('beginRead(u);') < fresh.indexOf('return scStreamStart(u)'), 'and before the link is awaited');
ok(fresh.includes('scStreamCachePut(t.videoId'), 'what is read is kept');
ok(fresh.includes('scStreamWarmNext();'), 'and the next song is warmed');
ok(fresh.includes('scStreamResolveCached(t.videoId)'), 'the resolver is asked once per song');
ok(fresh.includes('if(String(scStreamState.curId) !== wanted) return;'), 'a song that was replaced is not played over the new one');
ok(sliceFn('scStreamCacheGet').includes('SC_STREAM_CACHE_MS'), 'a cached song does not live forever');
ok(sliceFn('scStreamCachePut').includes('SC_STREAM_CACHE_MAX'), 'and only a few are kept');
ok(sliceFn('scStreamCachePut').includes("scStreamState.blobUrl = ''"), 'the cache keeps the URL it owns');
ok(page.includes('}, 2400);'), 'a silent link is given 2.4 seconds, not six');
ok(page.includes('var hit = scStreamCacheGet((scStreamById(scStreamState.curId) || {}).videoId);'),
  'the quiet-link fallback takes the read copy if it exists');
const restart = sliceFn('scStreamRestart');
ok(restart.includes('scStreamCacheDrop(was.videoId)'), 'Restart drops the copy it could not play');
ok(page.includes('function scStreamResolveCached(videoId)'), 'the resolver answer is kept for the song');

/* ── next keeps the genre ──────────────────────────────────────────────── */
const next = sliceFn('scStreamNext');
ok(next.includes('scStreamGenreOf()'), 'next reads the genre it should keep');
ok(next.includes("String(cand.genre || '').toLowerCase() === want"), 'and takes a song of that genre');
ok(next.includes('if(pick < 0) pick = i === -1 ? 0 : (i + dir + n) % n;'), 'falling back to the plain next only when there is none');
const upNext = sliceFn('scStreamUpNext');
ok(upNext.includes('function scStreamUpNext'), 'there is one answer for what is next');
ok(upNext.includes('|| scStreamState.genre'), 'a song found by a genre search still counts');
ok(page.includes('id="scStreamUpNext"'), 'the card offers it');
ok(page.includes("on('scStreamUpNext', 'click'"), 'and the offer plays it');
ok(page.includes('id="scStreamMoreGenre"'), 'with no more of that genre, the card offers more of it');
ok(page.includes("on('scStreamMoreGenre', 'click'"), 'and that offer searches the genre');
ok(page.includes('scStreamState.queue = (ctxIds && ctxIds.length)'), 'the queue still carries the list it was started from');

/* ── the rail stays put ───────────────────────────────────────────────── */
ok(page.includes('id="scStreamGenreRail"'), 'the rail has a name');
ok(page.includes('scroll-snap-type:x proximity'), 'and snaps gently as it is swiped');
ok(page.includes('scroll-snap-align:start'), 'tile by tile');
const render = page.slice(page.indexOf('function scStreamRender(){'), page.indexOf('function scStreamWire(){'));
ok(render.includes('scStreamState.railLeft = Number(_railNow.scrollLeft) || 0'), 'the scroll is read before the rebuild');
const wire = page.slice(page.indexOf('function scStreamWire(){'), page.indexOf('function scStreamBoot()'));
ok(wire.includes('_rail.scrollLeft = scStreamState.railLeft'), 'and handed back after it');
ok(wire.includes("_rail.addEventListener('scroll'"), 'so a swipe is remembered as it happens');
ok(page.includes('railLeft: 0'), 'with a place to keep it');

/* ── more genres ──────────────────────────────────────────────────────── */
const list = page.slice(page.indexOf('var SC_STREAM_GENRES = ['), page.indexOf('function scStreamGenreStrip('));
const count = (list.match(/n: '/g) || []).length;
ok(count >= 27, 'the rail carries the twelve more (found ' + count + ')');
['Amapiano', 'Reggaeton', 'Bollywood', 'Trap', 'Lo-fi', 'Soul', 'Funk', 'Metal', 'Blues', 'Disco', 'House', 'Workout']
  .forEach((g) => ok(list.includes("n: '" + g + "'"), 'including ' + g));
ok(!/gospel/i.test(list), 'and still not the one that was removed');

/* ── driven: the cache's rules, and the genre that carries ────────────── */
const made = [];
const revoked = [];
const ctx = {
  Date,
  Object,
  Number,
  String,
  Array,
  Promise,
  Math,
  URL: { createObjectURL: () => 'blob:' + (made.length + 1), revokeObjectURL: (u) => revoked.push(u) },
  scStreamState: { blobUrl: 'blob:live', curId: 's_1', queue: [], genre: '' },
  scStreamStale: () => false,
  scStreamResolve: async () => 'url',
  scStreamById: () => null,
  scStreamUpNext: () => null
};
vm.createContext(ctx);
const prelude = 'var scStreamCache = {}; var SC_STREAM_CACHE_MAX = 3; var SC_STREAM_CACHE_MS = 12 * 60 * 1000;';
vm.runInContext(prelude + '\n' + ['scStreamCacheDrop', 'scStreamCacheGet', 'scStreamCachePut', 'scStreamGenreOf', 'scStreamNext']
  .map(sliceFn).join('\n') + '\nthis.__put = scStreamCachePut; this.__get = scStreamCacheGet; this.__next = scStreamNext;', ctx);

vm.runInContext("this.__put('v1', { url: 'blob:1', mime: 'audio/mp4', size: 100 })", ctx);
ok(vm.runInContext("String(this.__get('v1').url)", ctx) === 'blob:1', 'driven: a read song is remembered');
ok(ctx.scStreamState.blobUrl === '', 'driven: and the cache owns its URL');

vm.runInContext("this.__put('v2', { url: 'blob:2' }); this.__put('v3', { url: 'blob:3' }); this.__put('v4', { url: 'blob:4' })", ctx);
ok(vm.runInContext("String(this.__get('v1'))", ctx) === 'null', 'driven: only three are kept');
ok(revoked.length === 1, 'driven: the oldest is released, not leaked');
ok(vm.runInContext("String(this.__get('v4').url)", ctx) === 'blob:4', 'driven: and the newest is there');

const played = [];
ctx.scStreamById = (id) => ({ 's_1': { id: 's_1', genre: 'Punjabi' }, 's_2': { id: 's_2', genre: 'Pop' },
  's_3': { id: 's_3', genre: 'Punjabi' } })[id] || null;
ctx.scStreamState.queue = ['s_1', 's_2', 's_3'];
ctx.scStreamPlay = (id) => played.push(id);
vm.runInContext('this.__next(1)', ctx);
ok(played[0] === 's_3', 'driven: next skips the song of another genre and takes the one that matches');

played.length = 0;
ctx.scStreamState.queue = ['s_1', 's_2'];
vm.runInContext('this.__next(1)', ctx);
ok(played[0] === 's_2', 'driven: with nothing of that genre left, it falls back to the plain next');

if (bad.length) {
  console.log('check-80619: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80619: %d passed, 0 failed', pass);
