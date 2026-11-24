// 85.3.12 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report, two releases after the rate was first measured: "now the higher
// quality videos dont work". 85.3.9 let a measurement take a size away, and the measurement
// was asked the wrong question twice over:
//
//   1. it was taken while the element was still filling its buffer. An element is not
//      paused while it fetches, so the first seconds of a sharp size - the seconds a phone
//      spends getting its first megabyte - read as a rate of zero, and the size was given
//      up before it had shown a single frame;
//   2. it was allowed to fire at every rung. Two bad windows at each size walked a 4K
//      picture down to the bottom of the list in half a minute, marking the sizes above it
//      dead on the way, and on a phone whose whole page runs slowly that walk never stopped.
//
// So a window is only read while the picture is showing, and one size is given up for the
// rate per film. Nothing here is a copy of the shipped code: every function is cut out of
// the page by its own name and braces, and runs against a fake element and a fake clock.
//
//   node dev/check-85312.cjs
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
function exec(src, sandbox, expose, filename) {
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__unit = {' + (expose || []).join(', ') + '};', sandbox, { filename: filename || 'unit.js' });
  return sandbox.__unit;
}

const fourRungs = [
  { h: 2160, label: '4K', codec: 'VP9', url: 'u2160', size: 240e6, muxed: false },
  { h: 1440, label: '1440p', codec: 'VP9', url: 'u1440', size: 122e6, muxed: false },
  { h: 1080, label: '1080p', codec: 'H.264', url: 'u1080', size: 80e6, muxed: false },
  { h: 720, label: '720p', codec: 'H.264', url: 'u720', size: 26e6, muxed: false },
  { h: 360, label: '360p', codec: 'H.264', url: 'u360', size: 8e6, muxed: true }
];

const perfSrc = [
  constLine('SC_VQ_MIN_FPS'), constLine('SC_VQ_MIN_CLOCK'), constLine('SC_VQ_PERF_MS'),
  constLine('SC_VQ_PERF_ROUNDS'), constLine('SC_VQ_FLOOR'),
  grab('scVideoFrames'), grab('scVideoPerfReset'), grab('scVideoRateText'),
  grab('scVideoPerfSample'), grab('scVideoPerfVerdict'), grab('scVideoSlow'),
  grab('scVideoDead'), grab('scVideoLive'), grab('scVideoDefault'), grab('scVideoRungFor')
].join('\n');

// A run drives the shipped sampler and the shipped step back; the size it lands on is
// recorded rather than loaded, so the walk (or its absence) is what is being counted.
function perfRun(opts) {
  const o = opts || {};
  const calls = { fx: 0, foot: [], apply: [], land: 0 };
  const clock = { at: 0 };
  const state = {
    open: true, bg: null, perf: null, perfBad: 0, fps: 0, fxOn: o.fxOn !== false,
    fxBlocked: !!o.blocked, fxManual: !!o.manual, scrubbing: false,
    rung: o.rung || null, rungs: o.rungs || fourRungs, deadH: {}, slowH: {},
    slowDone: o.slowDone || 0
  };
  const el = {
    src: 'x', paused: !!o.paused, ended: false, currentTime: 0, frames: 0,
    readyState: o.readyState === undefined ? 3 : o.readyState,
    seeking: !!o.seeking,
    getVideoPlaybackQuality() { return { totalVideoFrames: el.frames, droppedVideoFrames: 0 }; }
  };
  const sandbox = {
    console, Number, Math, String, Object, Array, Promise, isFinite,
    Date: { now: () => clock.at },
    scVideoState: state,
    scVideoEl() { return o.el === false ? null : el; },
    scVideoFxApply() { calls.fx++; },
    scVideoFoot(t) { calls.foot.push(String(t || '')); },
    scVideoApplyRung(r, keep) { calls.apply.push([r && r.h, !!keep]); state.rung = r; },
    scVideoLand() { calls.land++; return !!o.land; }
  };
  const U = exec(perfSrc, sandbox, ['scVideoPerfSample', 'scVideoSlow', 'scVideoPerfReset'], 'video-perf-85312.js');
  return { U, state, el, clock, calls };
}
// One window of real time: the first call sets the baseline, the second reads it.
function window3(r, fps) {
  r.U.scVideoPerfSample();
  r.el.frames += Math.round(fps * 2.5);
  r.el.currentTime += 2.5;
  r.clock.at += 2500;
  r.U.scVideoPerfSample();
}

// =============================================================================
console.log('\n1. A picture that is waiting for its data has not been slow');
// =============================================================================
{
  // THE REPORT. A sharp size's first seconds: the element is playing, the clock is not
  // moving, no frame has arrived - because the bytes have not. Six windows of that used to
  // be six verdicts, and the size was gone before it ever showed a frame.
  const r = perfRun({ readyState: 1, fxOn: false, rung: fourRungs[2] });
  for (let i = 0; i < 6; i++) window3(r, 0);
  ok('a picture with no data for its own second is not measured', r.state.perf === null, JSON.stringify(r.state.perf));
  ok('so it is never a bad window', r.state.perfBad === 0, r.state.perfBad);
  ok('and nothing is said or taken away while it fetches', r.calls.foot.length === 0 && r.calls.apply.length === 0,
    JSON.stringify(r.calls));
}
{
  const r = perfRun({ readyState: 0, fxOn: false, rung: fourRungs[0] });
  for (let i = 0; i < 6; i++) window3(r, 0);
  ok('the same for a source that has not loaded at all', r.calls.apply.length === 0 && r.state.perfBad === 0, r.calls.apply.length);
}
{
  const r = perfRun({ seeking: true, fxOn: false, rung: fourRungs[2] });
  for (let i = 0; i < 4; i++) window3(r, 0);
  ok('a seek is not a rate either', r.state.perf === null && r.calls.foot.length === 0, JSON.stringify(r.state.perf));
}
{
  // The gate has to come before the frame math, or a window that straddles a fetch is still
  // read against a baseline taken before it.
  const src = grab('scVideoPerfSample');
  const gate = src.indexOf('readyState) < 2');
  const math = src.indexOf('scVideoFrames(');
  ok('the gate is read before the frames are counted', gate > 0 && math > gate, gate + ' / ' + math);
}
{
  // And the measurement itself still has to work: 2 fps on a picture that IS showing.
  const r = perfRun({ readyState: 4, fxOn: true, rung: fourRungs[0] });
  window3(r, 2);
  window3(r, 2);
  ok('a picture that is showing at two frames a second is still measured', r.calls.fx === 1 && r.state.fxBlocked === true,
    'fx=' + r.calls.fx);
  ok('and it still names the rate it measured', /2 frames a second/.test(r.calls.foot[0] || ''), r.calls.foot[0]);
}
{
  const r = perfRun({ readyState: 4, fxOn: false });
  window3(r, 30);
  ok('a sharp picture at thirty frames a second is left entirely alone', r.calls.foot.length === 0 && r.state.perfBad === 0);
}

// =============================================================================
console.log('\n2. One size for the rate, not a walk down the list');
// =============================================================================
{
  // 4K is too heavy for this phone: one step to FULL HD, and that is the film's answer.
  const r = perfRun({ readyState: 4, fxOn: false, rung: fourRungs[0] });
  window3(r, 2);
  window3(r, 2);
  ok('a 4K picture at two frames a second lands on FULL HD', JSON.stringify(r.calls.apply) === '[[1080,true]]', JSON.stringify(r.calls.apply));
  ok('the step is the film\'s one step', r.state.slowDone === 1, r.state.slowDone);
  ok('and the footer names the size and the rate', /4K was showing 2 frames a second/.test(r.calls.foot[0] || ''), r.calls.foot[0]);
  const footAfterStep = r.calls.foot.length;
  // THE WALK. FULL HD on this phone is still short of frames - 85.3.9 would have taken it
  // away too, then 720p, then 480p, and the sizes would be marked dead behind it.
  window3(r, 2);
  window3(r, 2);
  window3(r, 2);
  window3(r, 2);
  ok('a second size is never taken away by the rate', r.calls.apply.length === 1, JSON.stringify(r.calls.apply));
  ok('nothing is landed on either', r.calls.land === 0, r.calls.land);
  ok('and it does not keep saying so', r.calls.foot.length === footAfterStep, r.calls.foot.length + ' / ' + footAfterStep);
  ok('the list only marks the height that was really too heavy', JSON.stringify(r.state.deadH) === '{"2160":1}', JSON.stringify(r.state.deadH));
}
{
  // The same phone on a 1080p film: one step down to 720p, then the picture stays there.
  const r = perfRun({ readyState: 4, fxOn: false, rung: fourRungs[2], land: true });
  window3(r, 3);
  window3(r, 3);
  ok('a FULL HD picture that cannot keep up is landed once', r.calls.land === 1, r.calls.land);
  window3(r, 3);
  window3(r, 3);
  window3(r, 3);
  ok('and not landed again at the size it landed on', r.calls.land === 1, r.calls.land);
  ok('the step back is refused once the film has spent it', r.U.scVideoSlow() === false);
}
{
  // A tap on HD+ by hand is still not argued with, and the size may still step back once.
  const r = perfRun({ readyState: 4, fxOn: true, manual: true, rung: fourRungs[0] });
  window3(r, 2);
  window3(r, 2);
  ok('a tap on HD+ keeps the upscaler', r.calls.fx === 0 && r.state.fxBlocked === false, r.calls.fx);
  ok('and the size still gets its one step', r.calls.apply.length === 1, JSON.stringify(r.calls.apply));
}
{
  // Already spent, and the upscaler happens to still be on: it may come off - that costs the
  // picture nothing - but no size moves.
  const r = perfRun({ readyState: 4, fxOn: true, slowDone: 1, rung: fourRungs[2] });
  window3(r, 2);
  window3(r, 2);
  window3(r, 2);
  window3(r, 2);
  ok('a film that has spent its step still loses the upscaler', r.calls.fx === 1 && r.state.fxBlocked === true, r.calls.fx);
  ok('and takes no second size away', r.calls.apply.length === 0 && r.calls.land === 0, JSON.stringify(r.calls.apply));
}
{
  const r = perfRun({ readyState: 4, fxOn: false, slowDone: 1, rung: fourRungs[2] });
  ok('the step back is a latch, not a per-height rule', r.U.scVideoSlow() === false, r.state.slowDone);
  ok('the function says so before it touches anything', /if\(st\.slowDone\) return false;/.test(grab('scVideoSlow')));
}
ok('a new film gives the rate its one step again', /scVideoState\.slowDone = 0;/.test(grab('scVideoLoad')));
ok('the state carries the latch', /slowDone: 0/.test(page));
ok('the latch is cleared with the rest of the per-film memory', /scVideoState\.slowH = \{\};\n\s*scVideoState\.slowDone = 0;/.test(grab('scVideoLoad')));

// =============================================================================
console.log('\n3. The release itself');
// =============================================================================
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
}
const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok('the page is on 85.3.12 or newer', /^85\.3\.\d+$/.test(vPage) && Number(vPage.split('.')[2]) >= 12, vPage);
ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
ok('the notes carry the 85.3.12 entry', page.includes("version: '85.3.12'"));
ok('the new entry is above 85.3.11', page.indexOf("version: '85.3.12'") < page.indexOf("version: '85.3.11'"));
{
  const entry = page.slice(page.indexOf("version: '85.3.12'"), page.indexOf("version: '85.3.11'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 120));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
