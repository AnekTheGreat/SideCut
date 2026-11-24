// 85.3.6 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// Five reports, one release: the lyrics did not follow the audio (and read like a
// highlight pill rather than a lyric sheet), the music video walked every size down to
// 360p, the upscaler was one number for every film, a press from the headphones did
// nothing with the film open, and the film's sound died when the app went away.
//
// Nothing here is a copy of the shipped code: every function is cut out of the page by
// its own name and braces, and runs against fake elements.
//
//   node dev/check-8536.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

// ---- slicing the page -------------------------------------------------------
function grab(name) {
  const key = 'function ' + name + '(';
  const i = page.indexOf(key);
  if (i < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', i + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(i, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}
function constLine(name) {
  const m = page.match(new RegExp('^\\s*var ' + name + ' = [^\\n]+$', 'm'));
  if (!m) throw new Error('missing constant ' + name);
  return m[0];
}
function run(src, sandbox, expose, filename) {
  sandbox.window = sandbox;
  if (sandbox.$ === undefined) sandbox.$ = function () { return { style: { display: 'none' } }; };
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__unit = {' + (expose || []).join(', ') + '};', sandbox, { filename: filename || 'unit.js' });
  return sandbox.__unit;
}
const ms = (at) => at;

// =============================================================================
console.log('\n1. FULL HD is the floor: nothing walks the picture down');
// =============================================================================
const failedSrc = [
  constLine('SC_VQ_FLOOR'),
  grab('scVideoDead'), grab('scVideoLive'), grab('scVideoRungBelow'), grab('scVideoFailed')
].join('\n');

function failureRun(opts) {
  const state = {
    rung: opts.rung, rungs: opts.rungs, alts: [], alt: 0, drops: 0, retries: 0,
    deadH: {}, rescueH: {}, via: opts.via || 'blob', swapAt: 0, srcNow: 'x'
  };
  const calls = { applied: [], foot: '', say: '', read: 0 };
  const el = { error: { code: opts.code || 4 }, src: 'x', currentSrc: 'x', currentTime: 42, pause() {} };
  const sb = {
    console, Date, Number, Math, String, Object, Array, Promise, isFinite,
    scVideoState: state,
    scVideoEl() { return el; },
    scVideoWatchStop() {}, scVideoSpin() {}, scVideoBig() {},
    scVideoRescue() { return false; },
    scVideoRead() { calls.read++; },
    scVideoApplyRung(r) { calls.applied.push(r.h); state.rung = r; },
    scVideoSay(t) { calls.say += String(t || ''); },
    scVideoFoot(t) { calls.foot = String(t || ''); },
    SC_VQ_DEFAULT: 1080, SC_VQ_READ_MAX: 64 * 1024 * 1024
  };
  const U = run(failedSrc, sb, ['scVideoFailed', 'scVideoRungBelow'], 'video-failed.js');
  U.scVideoFailed(false);
  return { state, calls };
}
const rungs = [
  { h: 1080, label: '1080p', codec: 'H.264', muxed: false, url: 'u1080', size: 24e6 },
  { h: 720, label: '720p', codec: 'H.264', muxed: false, url: 'u720', size: 12e6 },
  { h: 480, label: '480p', codec: 'H.264', muxed: true, url: 'u480', size: 8e6 },
  { h: 360, label: '360p', codec: 'H.264', muxed: true, url: 'u360', size: 5e6 }
];
{
  const r = failureRun({ rung: rungs[0], rungs });
  ok('a refused 1080p is not replaced by a smaller size', r.calls.applied.length === 0, JSON.stringify(r.calls.applied));
  ok('the picture is left on 1080p', r.state.rung.h === 1080);
  ok('1080p is not remembered as dead', !r.state.deadH[1080], JSON.stringify(r.state.deadH));
  ok('the footer says the size was not changed', /not moved to a smaller size/.test(r.calls.foot), r.calls.foot);
  ok('the footer names the size that refused', /1080p H\.264/.test(r.calls.foot), r.calls.foot);
  ok('no 720/480/360 row was applied', !r.calls.applied.some((h) => h < 1080), JSON.stringify(r.calls.applied));
}
{
  const r = failureRun({ rung: rungs[0], rungs, via: 'direct' });
  ok('a refused 1080p stream is read instead of stepped down', r.calls.read === 1 && r.state.rung.h === 1080);
  ok('nothing smaller was applied on the read path', r.calls.applied.length === 0);
}
{
  const rungs4k = [{ h: 2160, label: '4K', codec: 'VP9', muxed: false, url: 'u4k', size: 90e6 }].concat(rungs);
  const r = failureRun({ rung: rungs4k[0], rungs: rungs4k });
  ok('a hand-picked 4K steps down exactly one rung, to 1080p', r.calls.applied.length === 1 && r.calls.applied[0] === 1080, JSON.stringify(r.calls.applied));
}
ok('the page carries no "default(pool)" fallback in the failure road', !/scVideoDefault\(pool\)/.test(grab('scVideoFailed')));

// =============================================================================
console.log('\n2. The film keeps its sound when the app goes away');
// =============================================================================
const bgSrc = [grab('scVideoBackgroundOut'), grab('scVideoBackgroundIn')].join('\n');

function bgRun(opts) {
  const film = {
    paused: opts.filmPaused === true, currentTime: opts.at == null ? 61.5 : opts.at,
    src: 'blob:film', duration: 200,
    play() { this.paused = false; this.plays = (this.plays || 0) + 1; return Promise.resolve(); },
    pause() { this.paused = true; }
  };
  const song = {
    paused: true, currentTime: 0, duration: 200,
    play() { this.paused = false; this.plays = (this.plays || 0) + 1; return Promise.resolve(); },
    pause() { this.paused = true; }
  };
  const state = {
    open: true, bg: null, owns: opts.owns !== false, audioMode: opts.audioMode || 'aux',
    songKey: 'q:1', filmPlaying: opts.filmPlaying == null ? (film.paused ? 0 : 1) : opts.filmPlaying,
    blocked: false
  };
  const calls = { auxPause: 0, own: [], plays: 0, holds: 0 };
  const sb = {
    console, Date, Number, Math, String, Object, Array, Promise, isFinite,
    scVideoState: state,
    scVideoEl(id) { return id === 'scVideoEl' ? film : null; },
    scVideoAudioEl() { return song; },
    scVideoAuxPause() { calls.auxPause++; },
    scVideoAuxSet() {},
    scVideoOwnSound(on) { calls.own.push(!!on); },
    scVideoTrack() { return { key: opts.trackKey || 'q:1' }; },
    scVideoPlayAttempt() { calls.plays++; film.paused = false; },
    scVideoIdleWake() {}
  };
  const U = run(bgSrc, sb, ['scVideoBackgroundOut', 'scVideoBackgroundIn'], 'video-bg.js');
  return { U, state, film, song, calls };
}
{
  const r = bgRun({});
  r.U.scVideoBackgroundOut();
  ok('the song takes the film second before the picture stops', Math.abs(r.song.currentTime - 61.5) < 0.001, r.song.currentTime);
  ok('the song is started for the background', r.song.plays === 1 && !r.song.paused);
  ok('the picture is stopped', r.film.paused === true);
  ok('the soundtrack is stopped too', r.calls.auxPause === 1);
  ok('the film gives the sound back while away', r.calls.own.length === 1 && r.calls.own[0] === false);
  ok('the hand-off remembers the frame second', r.state.bg && Math.abs(r.state.bg.at - 61.5) < 0.001, JSON.stringify(r.state.bg));
  r.U.scVideoBackgroundOut();
  ok('a second hide does not hand over twice', r.song.plays === 1);
}
{
  const r = bgRun({ filmPaused: true, filmPlaying: 0 });
  r.U.scVideoBackgroundOut();
  ok('a paused film hands nothing over', r.state.bg === null && r.song.plays === undefined);
}
{
  const r = bgRun({ owns: false });
  r.U.scVideoBackgroundOut();
  ok('when the song is already the sound there is no hand-off', r.state.bg === null);
}
{
  const r = bgRun({});
  r.U.scVideoBackgroundOut();
  r.song.currentTime = 75;
  r.film.paused = true;
  r.U.scVideoBackgroundIn();
  ok('coming back stops the background song', r.song.paused === true);
  ok('the picture is put on the second the song reached', r.film.currentTime === 75, r.film.currentTime);
  ok('the picture is started again', r.calls.plays === 1 && r.film.paused === false);
  ok('and the film takes the sound back', r.calls.own[r.calls.own.length - 1] === true);
  ok('the hand-off is cleared', r.state.bg === null);
}
{
  const r = bgRun({ trackKey: 'q:2' });
  r.U.scVideoBackgroundOut();
  r.song.currentTime = 40;
  r.U.scVideoBackgroundIn();
  ok('a queue that moved while away is left to the tab follow', r.calls.plays === 0 && r.film.paused === true);
}

// =============================================================================
console.log('\n3. A press from the headphones is the film press');
// =============================================================================
const transportSrc = grab('scVideoTransport');
function transportRun(opts) {
  const film = {
    paused: !!opts.paused, src: 'blob:film', currentTime: 12,
    play() { this.paused = false; this.plays = (this.plays || 0) + 1; return Promise.resolve(); },
    pause() { this.paused = true; }
  };
  const state = { open: opts.open !== false, bg: opts.bg || null, audioMode: opts.audioMode || 'aux', blocked: true };
  const calls = { hold: 0, attempt: 0, aux: 0, big: [] };
  const sb = {
    console, Number, Math, String, Object, Array, Promise,
    scVideoState: state,
    scVideoEl() { return film; },
    scVideoAuxPause() { calls.aux++; },
    scVideoHoldSong() { calls.hold++; },
    scVideoPlayAttempt() { calls.attempt++; film.paused = false; },
    scVideoBig(v) { calls.big.push(!!v); },
    scVideoBarState() {}, scVideoIdleWake() {}
  };
  const U = run(transportSrc, sb, ['scVideoTransport'], 'video-transport.js');
  return { U, state, film, calls };
}
{
  const r = transportRun({ paused: true });
  ok('play on a paused film starts the picture, not the deck', r.U.scVideoTransport('play') === true && r.film.paused === false);
  ok('and the song is held underneath it', r.calls.hold === 1);
  const r2 = transportRun({ paused: false });
  ok('pause on a running film stops it', r2.U.scVideoTransport('pause') === true && r2.film.paused === true);
  const r3 = transportRun({ paused: false });
  ok('the toggle pauses a running film', r3.U.scVideoTransport('toggle') === true && r3.film.paused === true);
  const r4 = transportRun({ paused: true });
  ok('the toggle starts a paused film', r4.U.scVideoTransport('toggle') === true && r4.film.paused === false);
  const r5 = transportRun({ paused: true, audioMode: 'song' });
  ok('a size with no audio leaves the press to the song', r5.U.scVideoTransport('play') === false);
  const r6 = transportRun({ paused: true, bg: { at: 5 } });
  ok('in the background the song answers, not the film', r6.U.scVideoTransport('play') === false);
  const r7 = transportRun({ paused: true, open: false });
  ok('with the tab closed the film is not involved', r7.U.scVideoTransport('play') === false);
}
ok('the module hands the press out to the page', /window\.__scVideoTransportPress = scVideoTransport/.test(page));
{
  const door = page.indexOf("scTransportPlay('the headphones or the lock screen')");
  const filmFirst = page.lastIndexOf("__scVideoTransportPress('play')", door);
  ok('the media session play handler asks the film first', door > 0 && filmFirst > 0 && door - filmFirst < 900, door - filmFirst);
}
ok('the native key toggle asks the film first', /if\(what === 'toggle'\)\{[\s\S]{0,300}?__scVideoTransportPress\('toggle'\)/.test(page));

// =============================================================================
console.log('\n4. The lyric clock follows what is sounding');
// =============================================================================
const clockSrc = grab('scLyricsClock') + '\n' + grab('scLyricsMarkPast');
function clockRun(opts) {
  const deck = { paused: !!opts.deckPaused, currentTime: 33, duration: 210 };
  const sb = {
    console, Number, Math, String, Object, Array, isFinite,
    // run() makes window === sandbox, so the film door is planted here.
    __scVideoClock: opts.video ? function () { return opts.video; } : undefined,
    scListenAudio() { return deck; },
    activeAudio() { return deck; }
  };
  const U = run(clockSrc, sb, ['scLyricsClock', 'scLyricsMarkPast'], 'lyrics-clock.js');
  return { U, deck };
}
{
  const r = clockRun({});
  const c = r.U.scLyricsClock();
  ok('a deck song is the clock', c && c.time === 33 && c.dur === 210 && c.video === false);
  ok('a paused deck is a stopped clock', clockRun({ deckPaused: true }).U.scLyricsClock() === null);
  const v = clockRun({ video: { time: 74.5, dur: 240 } }).U.scLyricsClock();
  ok('with the film sounding the picture second is the clock', v && v.time === 74.5 && v.video === true);
  ok('the film clock keeps the duration for the plain sheet', v && v.dur === 240);
  const col = r.U.scLyricsClock() && r.U.scLyricsClock().audio === r.deck;
  ok('the deck clock still hands its element out', col === true);
}
{
  const sb = { console, Number, Math, String, Object, Array };
  const U = run(clockSrc, sb, ['scLyricsMarkPast'], 'lyrics-past.js');
  const mk = (cls) => ({ classList: { s: new Set(cls), contains(c) { return this.s.has(c); }, toggle(c, on) { if (on) this.s.add(c); else this.s.delete(c); } } });
  const lines = [mk(['current']), mk([]), mk([]), mk([])];
  U.scLyricsMarkPast(lines, 2);
  ok('the lines already sung step back', lines[0].classList.contains('past') && lines[1].classList.contains('past'));
  ok('the line being sung and the ones coming do not', !lines[2].classList.contains('past') && !lines[3].classList.contains('past'));
  U.scLyricsMarkPast(lines, 0);
  ok('a jump back clears the past marks', !lines[0].classList.contains('past') && !lines[1].classList.contains('past'));
}
{
  const style = page.slice(page.indexOf('#lyricsText .lyric-line {'), page.indexOf('#lyricsText .lyric-line {') + 900);
  ok('the current line is the bright one, with no pill', /lyric-line\.current\{[\s\S]*?color: var\(--ink\)/.test(page.replace(/\s+/g, ' ')) || /\.current \{\s*color: var\(--ink\)/.test(page.slice(page.indexOf('#lyricsText .lyric-line.current'))), style.slice(0, 120));
  ok('the sung lines dim', /\.lyric-line\.past\s*\{\s*opacity: \.32/.test(page));
}
ok('the tick no longer reads a possibly-paused deck directly', !/const audio = \(typeof scListenAudio === 'function'\)/.test(page));

// =============================================================================
console.log('\n5. A lyric sheet is read the way it was written');
// =============================================================================
const parseSrc = [constLine('SC_LRC_TAG_SRC'), grab('scLrcTagRe'), grab('scParseLrcLines')].join('\n');
const P = run(parseSrc, { console, Number, Math, String, Object, Array, RegExp }, ['scParseLrcLines'], 'lrc-parse.js');
{
  const rows = P.scParseLrcLines('[00:12.00]one\n[00:20.50]two');
  ok('a plain sheet parses in order', rows.length === 2 && rows[0].t === 12 && rows[1].t === 20.5);
  const rep = P.scParseLrcLines('[00:12.00][01:20.00]chorus\n[00:30.00]verse');
  ok('a repeated chorus keeps both takes', rep.length === 3, rep.length);
  ok('the repeat is at its own second', rep.filter((r) => r.text === 'chorus').map((r) => r.t).join(',') === '12,80');
  ok('the lines come back in time order', rep.map((r) => r.t).join(',') === '12,30,80', rep.map((r) => r.t).join(','));
  const off = P.scParseLrcLines('[offset:+500]\n[00:10.00]one\n[00:20.00]two');
  ok('the sheet offset tag moves every line', off[0].t === 10.5 && off[1].t === 20.5, JSON.stringify(off));
  const neg = P.scParseLrcLines('[offset:-250]\n[00:10.00]one');
  ok('a negative offset is applied too', Math.abs(neg[0].t - 9.75) < 1e-9, neg[0].t);
  ok('a metadata row is not a lyric', P.scParseLrcLines('[ti:Song]\n[ar:Someone]\n[00:05.00]word').length === 1);
}
ok('the renderer applies the offset as well', /times\[ti2\] \+ lrcOff/.test(page));

// =============================================================================
console.log('\n6. The upscaler can be tuned by the key the owner pasted');
// =============================================================================
const aiSrc = [constLine('SC_VFX_AI_KEY'), constLine('SC_VFX_AMOUNT'),
  grab('scVideoAiNum'), grab('scVideoAiRecipe'), grab('scVideoAiRead'), grab('scVideoAiStore')].join('\n');
function aiRun(store) {
  const mem = store || {};
  const sb = {
    console, Number, Math, String, Object, Array, JSON, isFinite,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem(k, v) { mem[k] = String(v); }
    }
  };
  const U = run(aiSrc, sb, ['scVideoAiNum', 'scVideoAiRecipe', 'scVideoAiRead', 'scVideoAiStore'], 'video-ai.js');
  return { U, mem };
}
{
  const r = aiRun();
  const rec = r.U.scVideoAiRecipe({ edge: 1.7, contrast: 2, saturate: 0.1 });
  ok('a recipe is clamped into the range the painter uses', rec.edge === 0.9 && rec.contrast === 1.4 && rec.saturate === 0.9, JSON.stringify(rec));
  ok('a recipe with no edge is refused', r.U.scVideoAiRecipe({ contrast: 1.2 }) === null);
  ok('a recipe that is not an object is refused', r.U.scVideoAiRecipe('nope') === null);
  r.U.scVideoAiStore('abc', rec);
  const back = r.U.scVideoAiRead('abc');
  ok('a recipe survives on the device', back && back.edge === 0.9 && back.saturate === 0.9);
  ok('an unknown video has no recipe', r.U.scVideoAiRead('zzz') === null);
  ok('junk in the store is not a recipe', r.U.scVideoAiRead('abc') && aiRun({ 'scVideoAiTune:bad': '{{{' }).U.scVideoAiRead('bad') === null);
}
ok('the tune asks Gemini with the film frame', /generativelanguage\.googleapis\.com[\s\S]{0,120}__scGeminiModel/.test(grab('scVideoAiTune')));
ok('the frame goes up as an inline JPEG', /inline_data: \{ mime_type: 'image\/jpeg'/.test(grab('scVideoAiTune')));
ok('the key is read from the settings key', /typeof _aiGeminiKey !== 'undefined'/.test(grab('scVideoAiTune')));
ok('the painter uses the tuned edge amount', /ctx\.globalAlpha = edgeAmt/.test(page));
ok('the switch says when the upscale is AI tuned', /b\.textContent = 'HD\+ AI'/.test(grab('scVideoAiApply')));
ok('one ask per film is scheduled after a size is seated', /scVideoAiSchedule\(\);/.test(grab('scVideoApplyRung')));

// =============================================================================
console.log('\n7. The release itself');
// =============================================================================
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
}
ok('the page is on 85.3.6', /const APP_VERSION = '85\.3\.6'/.test(page));
ok('the shell cache is on 85.3.6', /sidecut-shell-v85\.3\.6/.test(sw));
ok('the notes carry the new entry', /version: '85\.3\.6'/.test(page));
ok('the notes entry is above 85.3.5', page.indexOf("version: '85.3.6'") < page.indexOf("version: '85.3.5'"));
ok('the film clock is handed to the lyrics sheet', /window\.__scVideoClock = function/.test(page));
ok('the lyrics tick asks that clock', /scLyricsClock\(\)/.test(page));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
