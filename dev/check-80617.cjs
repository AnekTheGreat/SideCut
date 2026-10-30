#!/usr/bin/env node
// 80.6.17 - what must be true of the stream's now bar and the genre tiles.
//
//   node dev/check-80617.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.17';"), 'the page runs 80.6.17');
ok(page.includes("version: '80.6.17'"), 'the changelog records 80.6.17');
ok(page.includes('80.6.17 - THE STREAM OWNS THE BAR'), 'the release comment is in the script');

function sliceFn(name) {
  const at = page.indexOf('\n  function ' + name + '(');
  if (at === -1) return '';
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  return end === -1 ? '' : page.slice(start, end + 4);
}

/* ── the bar belongs to the stream while a stream plays ──────────────────── */
ok(page.includes('function scStreamBarOwns()'), 'one answer says who owns the bar');
const play = sliceFn('scStreamPlay');
ok(play.includes('scStreamBarOn(t);'), 'starting a stream takes the bar');
const onFn = sliceFn('scStreamBarOn');
ok(onFn.includes('who.innerHTML = pill + escapeHtml(scStreamMeta(t));'), 'the bar shows a STREAM pill and the metadata');
ok(onFn.includes("document.getElementById('npDiscLabel')"), 'and the cover on the disc');
ok(onFn.includes("classList.add('sc-stream-now')"), 'and marks the bar as streaming');
ok(onFn.includes('if(la && !la.paused){ try{ la.pause(); }'), 'one sound at a time: the local player gives way');
const sync = sliceFn('scStreamBarSync');
ok(sync.includes('if(cur) cur.textContent = scStreamTime(at);'), 'the clock is the stream\'s clock');
ok(sync.includes('if(tot) tot.textContent'), 'and the length is the song\'s length');
ok(sync.includes('if(sb && !scSeekDragging)'), 'the seek bar follows, but not out of a finger\'s grip');
ok(sync.includes('arc.style.strokeDashoffset'), 'the disc ring follows');
ok(sync.includes("document.getElementById('playIcon')"), 'the play icon follows the element');
ok(sync.includes("document.getElementById('scStreamPlay')"), 'and the card\'s own button, without redrawing it');
const ui = page.slice(page.indexOf('function updateNowPlayingUI(t){'), page.indexOf('function updateNpDisplay('));
ok(ui.includes('scStreamQuiet();'), 'a local song takes the bar back and stops the stream');
const tick = sliceFn('scStreamTick');
ok(tick.includes('scStreamBarSync();'), 'the stream\'s clock feeds the bar');

/* ── the bar's buttons drive the stream ─────────────────────────────────── */
const pp = page.slice(page.indexOf("$('playPauseBtn').addEventListener('click'"), page.indexOf("$('nextBtn').addEventListener('click'"));
ok(pp.includes('if(scStreamBarOwns()){ scStreamToggle(); return; }'), 'play/pause on the bar toggles the stream');
const sk = page.slice(page.indexOf("$('nextBtn').addEventListener('click'"), page.indexOf("$('shuffleBtn').addEventListener('click'"));
ok(sk.includes('if(scStreamBarOwns()){ scStreamNext(1); return; }'), 'next on the bar skips the stream');
ok(sk.includes('scStreamNext(-1);'), 'and previous goes back');
const seek = page.slice(page.indexOf("$('seekBar').addEventListener('input'"), page.indexOf("['pointerdown','touchstart','mousedown']"));
ok(seek.includes('if(scStreamBarOwns()){'), 'the seek bar is the stream\'s while it owns the bar');
ok(seek.includes('sa.currentTime = p * sd;'), 'and dragging it seeks the stream');
ok(!page.includes("a.addEventListener('play', function(){ scStreamState.playing = true; scStreamRender(); })"),
  'pausing no longer redraws the page');

/* ── genres ─────────────────────────────────────────────────────────────── */
ok(page.includes('var SC_STREAM_GENRES = ['), 'there is a genre list');
const genreBlock = page.slice(page.indexOf('var SC_STREAM_GENRES = ['), page.indexOf('function scStreamGenreStrip('));
const names = (genreBlock.match(/n: '/g) || []).length;
ok(names >= 12, 'with a dozen genres or more (found ' + names + ')');
['Pop', 'Hip-Hop', 'Afrobeats', 'Punjabi', 'Latin', 'Rock', 'Electronic', 'Chill']
  .forEach((g) => ok(genreBlock.includes("n: '" + g + "'"), 'the list carries ' + g));
const strip = sliceFn('scStreamGenreStrip');
ok(strip.includes('linear-gradient(135deg,'), 'a tile is a gradient, not a plain chip');
ok(strip.includes('class="scs-genre"'), 'and carries its genre for the tap');
ok(page.includes('h += scStreamGenreStrip();'), 'the streaming page shows the strip');
const wire = page.slice(page.indexOf('function scStreamWire()'), page.indexOf('function scStreamBoot()'));
ok(wire.includes("querySelectorAll('.scs-genre')"), 'the tiles are wired');
ok(wire.includes("scStreamGenre(this.getAttribute('data-g'))"), 'a tap runs that genre');
ok(wire.includes("on('scStreamGenreClear'"), 'and the genre can be cleared');
const gfn = sliceFn('scStreamGenre');
ok(gfn.includes('scStreamSearchRun(g.q);'), 'a genre is a search of the source');
ok(page.includes("var who = String(it.owner || it.author || it.channel || '');"), 'results read the artist field the search sends');
ok(page.includes("if(len > 0) who += ' \u00b7 ' + scStreamTime(len);"), 'and show the length');
ok(page.includes("genre: String(it.genre || scStreamState.genre || '')"), 'an added song keeps its genre');
ok(page.includes("if(!it.genre) it.genre = String(t.genre || '');"), 'and an old playlist copy fills it in');
ok(sliceFn('scStreamRowMeta').includes("if(t.genre) out += ' \u00b7 ' + String(t.genre);"), 'the row line carries the genre');
ok(page.includes("body.sc-stream-now #nowPlaying{ border-top:1px solid"), 'the bar answers in colour while streaming');

/* ── driven: the bar's sync, and the genre lookup ───────────────────────── */
function el(store, key) {
  return {
    textContent: '', innerHTML: '', value: 0,
    style: { setProperty: (k, v) => { store[key + '.' + k] = v; }, width: '', strokeDashoffset: '' },
    classList: { toggle: (c, on) => { store[key + '.class.' + c] = !!on; } }
  };
}
const store = {};
const nodes = {};
['curTime', 'totalTime', 'seekBar', 'discProgressArc', 'miniFill', 'playIcon', 'npDisc', 'scStreamPlay']
  .forEach((id) => { nodes[id] = el(store, id); });
const ctx = {
  document: { getElementById: (id) => nodes[id] || null },
  scStreamState: { barOn: true, playing: true, curId: 's_1' },
  scStreamAudio: () => ({ duration: 240, currentTime: 60 }),
  scStreamById: () => ({ dur: 240 }),
  scStreamTime: (s) => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.floor(Math.max(0, s)) % 60).padStart(2, '0'),
  scIcon: (n) => '<i data-icon="' + n + '"></i>',
  scSeekDragging: false,
  isFinite, Math, Number, String, RegExp, JSON
};
vm.createContext(ctx);
vm.runInContext(sliceFn('scStreamBarSync') + '\n' + sliceFn('scStreamRowMeta') + '\nthis.__sync = scStreamBarSync; this.__row = scStreamRowMeta;', ctx);
vm.runInContext('this.__sync()', ctx);
ok(nodes.curTime.textContent === '1:00', 'driven: the bar shows the stream\'s place in the song');
ok(nodes.totalTime.textContent === '4:00', 'driven: and its length');
ok(nodes.seekBar.value === 25, 'driven: the bar is a quarter of the way along');
ok(store['seekBar.--seek-fill'] === '25%', 'driven: and its fill matches');
ok(String(nodes.discProgressArc.style.strokeDashoffset) === String(157 - 0.25 * 157), 'driven: the disc ring matches');
ok(nodes.playIcon.innerHTML.includes('M6 5h4v14'), 'driven: a playing stream shows a pause glyph');
ok(nodes.scStreamPlay.innerHTML.includes('pause'), 'driven: and so does the card\'s button');
ok(store['npDisc.class.spinning'] === true, 'driven: the disc is spinning');

ctx.scStreamState.playing = false;
nodes.playIcon.innerHTML = '';
vm.runInContext('this.__sync()', ctx);
ok(nodes.playIcon.innerHTML.includes('M8 5v14l11-7z'), 'driven: a paused stream shows a play glyph');
ok(store['npDisc.class.spinning'] === false, 'driven: and the disc stops');

ctx.scStreamState.barOn = false;
nodes.curTime.textContent = 'untouched';
vm.runInContext('this.__sync()', ctx);
ok(nodes.curTime.textContent === 'untouched', 'driven: a local song\'s bar is never written by the stream');

ok(vm.runInContext('this.__row({artist:"Diljit",dur:95,genre:"Punjabi"})', ctx) === 'Diljit \u00b7 1:35 \u00b7 Punjabi',
  'driven: a row reads artist, length and genre');
ok(vm.runInContext('this.__row({artist:"",dur:0,genre:""})', ctx) === 'Streaming',
  'driven: and still falls back to the old word');

if (bad.length) {
  console.log('check-80617: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80617: %d passed, 0 failed', pass);
