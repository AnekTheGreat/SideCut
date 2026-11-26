// 85.3.9 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report, one release after the size was made the size that is tried: "now it
// runs at 2fps". The size was right and the rate was wrong. A sharp adaptive row is decoded
// by whatever the WebView has, and a 4K VP9 or AV1 row with no hardware decoder behind it
// is a handful of frames a second; on top of every one of those frames the upscaler asked
// for a fill, two filtered full-stage draws and a lighter pass over the whole stage. So this
// release measures the rate on the device and lets the measurement decide: the upscaler
// comes off first (it is four draws a frame and a sharp size does not need it), and a size
// above FULL HD that still cannot keep up lands on FULL HD in one move.
//
// Nothing here is a copy of the shipped code: every function is cut out of the page by its
// own name and braces, and runs against fake elements, a fake clock and a fake MediaSource.
//
//   node dev/check-8539.cjs
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
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__unit = {' + (expose || []).join(', ') + '};', sandbox, { filename: filename || 'unit.js' });
  return sandbox.__unit;
}
const settle = (ms) => new Promise((r) => setTimeout(r, ms || 5));

const fourRungs = [
  { h: 2160, label: '4K', codec: 'VP9', url: 'u2160', size: 240e6, muxed: false },
  { h: 1440, label: '1440p', codec: 'VP9', url: 'u1440', size: 122e6, muxed: false },
  { h: 1080, label: '1080p', codec: 'H.264', url: 'u1080', size: 80e6, muxed: false },
  { h: 720, label: '720p', codec: 'H.264', url: 'u720', size: 26e6, muxed: false },
  { h: 360, label: '360p', codec: 'H.264', url: 'u360', size: 8e6, muxed: true }
];

// =============================================================================
console.log('\n1. The rate the picture is really showing is measured, not guessed');
// =============================================================================
const perfSrc = [
  constLine('SC_VQ_MIN_FPS'), constLine('SC_VQ_MIN_CLOCK'), constLine('SC_VQ_PERF_MS'),
  constLine('SC_VQ_PERF_ROUNDS'), constLine('SC_VQ_FLOOR'), constLine('SC_VQ_RATE_STEPS'),
  grab('scVideoFrames'), grab('scVideoPerfReset'), grab('scVideoRateText'),
  grab('scVideoPerfSample'), grab('scVideoPerfVerdict'),   grab('scVideoDead'), grab('scVideoLive'),
  grab('scVideoDefault'), grab('scVideoRungFor')
].join('\n');
function perfRun(opts) {
  const o = opts || {};
  const calls = { fx: 0, slow: 0, foot: [], apply: [] };
  const clock = { at: 0 };
  const state = {
    open: true, bg: null, perf: null, perfBad: 0, fps: 0, fxOn: o.fxOn !== false,
    fxBlocked: !!o.blocked, fxManual: !!o.manual, scrubbing: false,
    rung: o.rung || null, rungs: o.rungs || fourRungs, deadH: {}, slowH: {}
  };
  const el = {
    src: 'x', paused: !!o.paused, ended: false, currentTime: 0,
    getVideoPlaybackQuality: o.noMeter ? undefined : () => ({ totalVideoFrames: el.frames, droppedVideoFrames: 0 }),
    frames: 0
  };
  const sandbox = {
    console, Number, Math, String, Object, Array, Promise, isFinite,
    Date: { now: () => clock.at },
    scVideoState: state,
    scVideoEl() { return o.el === false ? null : el; },
    scVideoFxApply() { calls.fx++; },
    scVideoFoot(t) { calls.foot.push(String(t || '')); },
    scVideoApplyRung(r, keep) { calls.apply.push([r && r.h, keep]); },
    scVideoLand(why) { calls.land = why; return !!o.land; }
  };
  // A run about the sample itself watches the step back, and a run about the step back runs
  // the function that ships - cut out of the page like every other one here.
  const src = perfSrc + (o.realSlow ? '\n' + grab('scVideoSlow') : '');
  if (!o.realSlow) sandbox.scVideoSlow = function () { calls.slow++; return true; };
  const U = run(src, sandbox, ['scVideoPerfSample', 'scVideoPerfReset', 'scVideoRateText', 'scVideoSlow'], 'video-perf.js');
  return { U, state, el, clock, calls, sandbox };
}
function window3(r, fps) {
  // One window: the first call sets the baseline, the second reads it.
  r.U.scVideoPerfSample();
  r.el.frames += Math.round(fps * 2.5);
  r.el.currentTime += 2.5;
  r.clock.at += 2500;
  r.U.scVideoPerfSample();
}
{
  const r = perfRun({ fxOn: true });
  window3(r, 30);
  ok('a picture at thirty frames a second is left alone', r.state.perfBad === 0 && r.calls.fx === 0 && r.calls.slow === 0,
    'bad=' + r.state.perfBad + ' fx=' + r.calls.fx + ' slow=' + r.calls.slow);
}
{
  // THE REPORT: five frames in two and a half seconds is two frames a second.
  const r = perfRun({ fxOn: true });
  window3(r, 2);
  ok('one bad window is not yet a verdict', r.state.perfBad === 1 && r.calls.fx === 0 && r.calls.slow === 0,
    'bad=' + r.state.perfBad);
  window3(r, 2);
  ok('two bad windows take the upscaler off first', r.calls.fx === 1 && r.state.fxBlocked === true, 'fx=' + r.calls.fx + ' blocked=' + r.state.fxBlocked);
  ok('it says the rate it measured', /2 frames a second/.test(r.calls.foot[r.calls.foot.length - 1]), r.calls.foot[r.calls.foot.length - 1]);
  ok('and the size is not moved on that first answer', r.calls.slow === 0, r.calls.slow);
}
{
  const r = perfRun({ fxOn: true, blocked: true });
  window3(r, 2);
  window3(r, 2);
  ok('with the upscaler already off, a slow size is given up', r.calls.slow === 1, r.calls.slow);
  ok('and the switch was not touched again', r.calls.fx === 0, r.calls.fx);
}
{
  const r = perfRun({ fxOn: true, manual: true });
  window3(r, 2);
  window3(r, 2);
  ok('a tap on HD+ by hand is not argued with: the upscaler stays', r.calls.fx === 0 && r.state.fxBlocked === false, 'fx=' + r.calls.fx);
  ok('the size is still allowed to step back', r.calls.slow === 1, r.calls.slow);
}
{
  // No frame counter on this phone: its own clock is the witness.
  const r = perfRun({ noMeter: true, fxOn: false });
  window3(r, 30);
  ok('a film advancing with real time is playing, not stalling', r.calls.slow === 0, r.calls.slow);
  const r2 = perfRun({ noMeter: true, fxOn: false });
  r2.U.scVideoPerfSample();
  r2.el.currentTime += 0.4;
  r2.clock.at += 2500;
  r2.U.scVideoPerfSample();
  r2.el.currentTime += 0.4;
  r2.clock.at += 2500;
  r2.U.scVideoPerfSample();
  ok('a film that has stopped advancing is acted on', r2.calls.slow === 1, r2.calls.slow);
  ok('and with no frame count it does not claim one', r2.state.fps === 0, r2.state.fps);
}
{
  const r = perfRun({ paused: true });
  r.U.scVideoPerfSample();
  ok('a paused film is not measured at all', r.state.perf === null);
  const r2 = perfRun({ el: false });
  r2.U.scVideoPerfSample();
  ok('a tab with no element is not measured either', r2.state.perf === null);
}
ok('the sampler runs from the tick that already drives the picture', /scVideoPerfSample\(\);/.test(grab('scVideoSync')));
ok('a new source is measured from its own first frame', /scVideoPerfReset\(\);/.test(grab('scVideoApplyRung')));
ok('and a new film forgets what was too slow for the last one', /scVideoState\.slowH = \{\};/.test(grab('scVideoLoad')));

// =============================================================================
console.log('\n2. A size this phone cannot keep up with is not the size you are stuck with');
// =============================================================================
{
  const r = perfRun({ rung: fourRungs[0], fxOn: false, realSlow: true });
  r.state.fps = 2;
  const moved = r.U.scVideoSlow();
  ok('a 4K size that runs at two frames a second is given up', moved === true);
  ok('it lands on FULL HD in one move, not one height at a time', JSON.stringify(r.calls.apply) === '[[1080,true]]', JSON.stringify(r.calls.apply));
  ok('the height that could not keep up is NOT written into the size list', JSON.stringify(r.state.deadH) === '{}', JSON.stringify(r.state.deadH));
  ok('1440p is not marked - it was never tried', !r.state.deadH[1440]);
  ok('the footer names the size and the rate', /4K was showing 2 frames a second/.test(r.calls.foot[0]) && /1080p/.test(r.calls.foot[0]), r.calls.foot[0]);
}
{
  const r = perfRun({ rung: fourRungs[0], fxOn: false, realSlow: true });
  r.state.fps = 2;
  r.U.scVideoSlow();
  const again = r.U.scVideoSlow();
  ok('the same height is not taken away twice', again === false && r.calls.apply.length === 1, JSON.stringify(r.calls.apply));
}
{
  const r = perfRun({ rung: fourRungs[2], fxOn: false, land: true, realSlow: true });
  r.state.fps = 4;
  const moved = r.U.scVideoSlow();
  // 85.3.19 changed this contract on purpose: the automatic step stops at FULL HD, so a 1080p
  // picture this phone cannot keep up with is left where it is and the size list is the way
  // down. The assertions are rewritten to that contract; 85.3.19's own gate proves it.
  ok('85.3.19: at FULL HD the picture is left on FULL HD', moved === false && !r.calls.land, r.calls.land);
  ok('and the footer says it is staying, with the size list as the way down',
    /stays on 1080p/.test(r.calls.foot[0] || '') && /list/.test(r.calls.foot[0] || ''), r.calls.foot[0]);
}
{
  const r = perfRun({ rung: null, fxOn: false, realSlow: true });
  ok('a size that is not there is not stepped back from', r.U.scVideoSlow() === false);
}

// =============================================================================
console.log('\n3. The upscaler costs what it costs, and a sharp frame does not pay it');
// =============================================================================
const paintSrc = [constLine('SC_VFX_EDGE_H'), constLine('SC_VFX_BLUR'), constLine('SC_VFX_AMOUNT'), grab('scVideoFxPaint')].join('\n');
function paintRun(vw, vh) {
  const log = [];
  const bufOps = [];
  const mk = (into) => ({
    globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none', fillStyle: '',
    imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
    fillRect() { into.push('fill'); },
    drawImage() { into.push('draw:' + this.globalCompositeOperation + ':' + String(this.filter)); }
  });
  const fxCtx = mk(log);
  const buffCtx = mk(bufOps);
  const sandbox = {
    console, Number, Math, String, Object, Array, isFinite,
    SC_VFX_EDGE_H: 720, SC_VFX_BLUR: 'blur(1px)', SC_VFX_AMOUNT: 0.6,
    window: { devicePixelRatio: 1 },
    scVideoState: { aiEdge: 0, aiContrast: 0, aiSaturate: 0 },
    scVideoFxCv: { id: 'scVideoFx', width: 0, height: 0 },
    scVideoFxCtx: fxCtx,
    scVideoFxBuff() { return { cv: { id: 'buf', width: 0, height: 0 }, ctx: buffCtx }; },
    scVideoEl(id) {
      if (id === 'scVideoEl') return { videoWidth: vw, videoHeight: vh };
      if (id === 'scVideoStage') return { getBoundingClientRect: () => ({ width: 400, height: 300 }) };
      return null;
    }
  };
  const U = run(paintSrc, sandbox, ['scVideoFxPaint'], 'video-paint.js');
  U.scVideoFxPaint();
  return { log, bufOps, fxCtx };
}
{
  const sharp = paintRun(1920, 1080);
  ok('a FULL HD frame is resampled and nothing else', sharp.bufOps.length === 0, JSON.stringify(sharp.bufOps));
  ok('no outline pass is drawn over a sharp frame', !sharp.log.some((l) => l.indexOf('lighter') !== -1), JSON.stringify(sharp.log));
  ok('the frame is still painted', sharp.log.some((l) => l.indexOf('draw:source-over') === 0), JSON.stringify(sharp.log));
  ok('and the context is left clean for the next frame', sharp.fxCtx.filter === 'none' && sharp.fxCtx.globalCompositeOperation === 'source-over' && sharp.fxCtx.globalAlpha === 1,
    sharp.fxCtx.filter + ' ' + sharp.fxCtx.globalCompositeOperation + ' ' + sharp.fxCtx.globalAlpha);
}
{
  const soft = paintRun(854, 480);
  ok('a 480p frame still gets its edges invented', soft.bufOps.length > 0, JSON.stringify(soft.bufOps));
  ok('the mask is a blurred copy taken out of the frame', soft.bufOps.some((l) => l.indexOf('difference') !== -1), JSON.stringify(soft.bufOps));
  ok('and those outlines are laid back over it', soft.log.some((l) => l.indexOf('lighter') !== -1), JSON.stringify(soft.log));
}

// =============================================================================
console.log('\n4. The app\'s own buffer is a window, and it knows how long the film is');
// =============================================================================
const streamSrc = [
  constLine('SC_VQ_STREAM_AHEAD'), constLine('SC_VQ_STREAM_MAX_AHEAD'),
  grab('scVideoStreamOk'), grab('scVideoStreamDrop'), grab('scVideoStreamDown'), grab('scVideoStream')
].join('\n');
function fakeMse(bufferedEnd) {
  const made = [];
  class MS {
    constructor() { this.listeners = {}; this.readyState = 'closed'; this.ended = false; this.duration = NaN; made.push(this); }
    addEventListener(k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); }
    fire(k) { (this.listeners[k] || []).forEach((f) => f()); }
    addSourceBuffer(mime) {
      this.mime = mime;
      const sb = {
        updating: false, appended: [], listeners: {},
        buffered: { length: 0, end() { return bufferedEnd == null ? 0 : bufferedEnd; } },
        addEventListener(k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); },
        removeEventListener(k, f) { this.listeners[k] = (this.listeners[k] || []).filter((x) => x !== f); },
        fire(k) { (this.listeners[k] || []).forEach((f) => f()); },
        appendBuffer(b) {
          this.appended.push(b.length);
          this.buffered.length = 1;
          setTimeout(() => this.fire('updateend'), 0);
        }
      };
      this.sb = sb;
      return sb;
    }
    endOfStream() { this.ended = true; this.readyState = 'ended'; }
  }
  MS.isTypeSupported = (m) => /mp4|webm/.test(String(m));
  return { MS, made };
}
function streamRun(opts) {
  const o = opts || {};
  const calls = { fetch: [], attach: [], foot: '', failed: [] };
  const mse = fakeMse(o.bufferedEnd);
  const state = {
    open: true, rung: o.rung || null, vidLen: o.vidLen || 0,
    streamFor: null, streamUrl: '', streamBusy: false
  };
  const sandbox = {
    console, Number, Math, String, Object, Array, Promise, isFinite, setTimeout, clearTimeout,
    scVideoState: state,
    MediaSource: mse.MS,
    URL: { createObjectURL() { return 'blob:appstream'; }, revokeObjectURL() {} },
    scVideoEl() { return { currentTime: o.currentTime || 0 }; },
    scVideoAttach(url, via, keep) { calls.attach.push([url, via, keep]); state.rung = state.rung || o.rung; },
    scVideoFoot(t) { calls.foot = String(t || ''); },
    scVideoFailed(dead) { calls.failed.push(dead); },
    scFetchRange(url, start, end) {
      calls.fetch.push([start, end]);
      const size = o.size || 0;
      const len = size ? Math.min(1048576, size - start) : 1048576;
      if (len <= 0) return Promise.resolve({ bytes: null, status: 416 });
      return Promise.resolve({ bytes: new Uint8Array(len), partial: true, status: 206 });
    }
  };
  const U = run(streamSrc, sandbox, ['scVideoStream'], 'video-stream-8539.js');
  return { U, state, calls, mse };
}
async function fireOpen(r, times) { for (let i = 0; i < (times || 40); i++) await settle(2); }
(async () => {
  {
    // A 4K copy at about three megabytes a second: sixteen megabytes is five seconds of
    // film, so the window is six seconds and the reader stops as soon as it is that far
    // in front - where forty-five seconds would have been a hundred megabytes in a phone.
    const row = { h: 2160, label: '4K', codec: 'VP9', url: 'https://rr.googlevideo.com/x?itag=313',
                  mime: 'video/webm; codecs="vp9"', size: 300 * 1048576, muxed: false };
    const r = streamRun({ rung: row, size: row.size, vidLen: 100, bufferedEnd: 10 });
    r.U.scVideoStream(row);
    r.mse.made[0].readyState = 'open';
    r.mse.made[0].fire('sourceopen');
    await fireOpen(r);
    ok('a heavy row is not read forty-five seconds ahead', r.calls.fetch.length === 1, r.calls.fetch.length);
    ok('the buffer knows how long the film is', r.mse.made[0].duration === 100, r.mse.made[0].duration);
  }
  {
    // A light row: the same sixteen megabytes is minutes of film, so the seconds win.
    const row = { h: 360, label: '360p', codec: 'H.264', url: 'https://rr.googlevideo.com/x?itag=18',
                  mime: 'video/mp4', size: 8 * 1048576, muxed: false };
    const r = streamRun({ rung: row, size: row.size, vidLen: 100, bufferedEnd: 10 });
    r.U.scVideoStream(row);
    r.mse.made[0].readyState = 'open';
    r.mse.made[0].fire('sourceopen');
    await fireOpen(r);
    ok('a light row still gets the whole window', r.calls.fetch.length > 1, r.calls.fetch.length);
  }

  // =============================================================================
  console.log('\n5. The release itself');
  // =============================================================================
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  }
  // The version pin reads "this release or newer" through dev/version.cjs, because a version
// here is two numbers and a third that only runs 0-9 (85.3.9 -> 85.4), never 85.3.10.
const { atLeast } = require('./version.cjs');
const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok('the page is on 85.3.9 or newer', atLeast(vPage, '85.3.9'), vPage);
  ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
  ok('the notes carry the 85.3.9 entry', page.includes("version: '85.3.9'"));
  ok('the new entry is above 85.3.8', page.indexOf("version: '85.3.9'") < page.indexOf("version: '85.3.8'"));
  {
    const entry = page.slice(page.indexOf("version: '85.3.9'"), page.indexOf("version: '85.3.8'"));
    ok('the new entry avoids the words the Play channel filters', !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 120));
  }
  ok('the state knows the rate, the heights and the blocked upscaler', /fps: 0, perf: null, perfBad: 0, slowH: \{\}, fxBlocked: false/.test(page));
  ok('the upscaler is gated on the block as well as the switch', /!scVideoState\.fxBlocked && scVideoFxCv/.test(grab('scVideoFxApply')));
  ok('a tap by hand clears the block', /if\(scVideoState\.fxBlocked\)\{ scVideoState\.fxBlocked = false; scVideoState\.fxOn = true; \}/.test(grab('scVideoFxToggle')));
  ok('the floor is where a too-heavy size lands', /Number\(from\.h\) > Number\(SC_VQ_FLOOR\)/.test(grab('scVideoSlow')));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
