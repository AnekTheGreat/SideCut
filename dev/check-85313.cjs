// 85.3.13 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report, one release after the rate was limited to a single step: "now the
// music videos don't work". 85.3.12 fixed the false verdicts (a picture still fetching its
// own second is not a slow picture) by taking the whole walk away, and took the one thing
// that had been saving the picture with it: a phone that genuinely cannot show a sharp size
// stayed on it, so the tab was a slideshow or a still instead of a film.
//
// So the rate steps again - under the rules that keep 85.3.9's walk from coming back:
//
//   * bounded: SC_VQ_RATE_STEPS sizes per film, then it stays where it is;
//   * it ends when a smaller size shows FEWER frames than the one above it, because then the
//     size is not what the phone is short of and the rest of the list buys nothing;
//   * it never writes into the size list: a height the phone opens and merely cannot play
//     fast is not a height that did not play here.
//
// Nothing here is a copy of the shipped code: every function is cut out of the page by its
// own name and braces, and runs against a fake element, a fake clock and a fake landing.
//
//   node dev/check-85313.cjs
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
  { h: 2160, label: '4K', codec: 'H.264', url: 'u2160', size: 240e6, muxed: false },
  { h: 1440, label: '1440p', codec: 'H.264', url: 'u1440', size: 122e6, muxed: false },
  { h: 1080, label: '1080p', codec: 'H.264', url: 'u1080', size: 80e6, muxed: false },
  { h: 720, label: '720p', codec: 'H.264', url: 'u720', size: 26e6, muxed: false },
  { h: 480, label: '480p', codec: 'H.264', url: 'u480', size: 13e6, muxed: false },
  { h: 360, label: '360p', codec: 'H.264', url: 'u360', size: 8e6, muxed: true }
];

const perfSrc = [
  constLine('SC_VQ_MIN_FPS'), constLine('SC_VQ_MIN_CLOCK'), constLine('SC_VQ_PERF_MS'),
  constLine('SC_VQ_PERF_ROUNDS'), constLine('SC_VQ_FLOOR'), constLine('SC_VQ_RATE_STEPS'),
  grab('scVideoFrames'), grab('scVideoPerfReset'), grab('scVideoRateText'),
  grab('scVideoPerfSample'), grab('scVideoPerfVerdict'), grab('scVideoSlow'),
  grab('scVideoDead'), grab('scVideoLive'), grab('scVideoDefault'), grab('scVideoRungFor')
].join('\n');

// The shipped sampler, the shipped verdict and the shipped step back; the size that is landed
// on is recorded rather than loaded, so what is counted is how far the walk goes.
function perfRun(opts) {
  const o = opts || {};
  const calls = { fx: 0, foot: [], apply: [], land: [] };
  const clock = { at: 0 };
  const state = {
    open: true, bg: null, perf: null, perfBad: 0, fps: 0, fxOn: o.fxOn !== false,
    fxBlocked: !!o.blocked, fxManual: !!o.manual, scrubbing: false,
    rung: o.rung || null, rungs: o.rungs || fourRungs, deadH: {}, slowH: {},
    rateSteps: o.rateSteps || 0, rateNow: o.rateNow || 0, rateBest: o.rateBest || 0
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
    scVideoLand(why, none, rateOnly) { calls.land.push([why, none, rateOnly]); return !!o.land; }
  };
  const U = exec(perfSrc, sandbox, ['scVideoPerfSample', 'scVideoSlow', 'scVideoPerfReset'], 'video-perf-85313.js');
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
console.log('\n1. A picture that is still fetching is still not a verdict (85.3.12, kept)');
// =============================================================================
{
  const r = perfRun({ readyState: 1, fxOn: false, rung: fourRungs[2] });
  for (let i = 0; i < 6; i++) window3(r, 0);
  ok('a picture with no data for its own second is not measured', r.state.perf === null && r.state.perfBad === 0, JSON.stringify(r.state.perf));
  ok('and nothing is taken away while it fetches', r.calls.apply.length === 0 && r.calls.land.length === 0, JSON.stringify(r.calls));
  const r2 = perfRun({ seeking: true, fxOn: false, rung: fourRungs[2] });
  for (let i = 0; i < 4; i++) window3(r2, 0);
  ok('a seek is not a rate either', r2.calls.apply.length === 0 && r2.state.perf === null);
  const src = grab('scVideoPerfSample');
  ok('the gate is still read before the frames are counted',
    src.indexOf('readyState) < 2') > 0 && src.indexOf('readyState) < 2') < src.indexOf('scVideoFrames('));
}

// =============================================================================
console.log('\n2. A size that cannot keep up steps back until one does');
// =============================================================================
{
  // THE REPORT. 4K at two frames a second: one move to FULL HD, and the walk is not over -
  // the size it lands on is measured from its own first frame.
  const r = perfRun({ readyState: 4, fxOn: false, rung: fourRungs[0] });
  window3(r, 2);
  window3(r, 2);
  ok('a 4K picture at two frames a second lands on FULL HD', JSON.stringify(r.calls.apply) === '[[1080,true]]', JSON.stringify(r.calls.apply));
  ok('the film has spent one step of its budget', r.state.rateSteps === 1, r.state.rateSteps);
  ok('and the footer names the size and the rate', /4K was showing 2 frames a second/.test(r.calls.foot[0] || ''), r.calls.foot[0]);
  ok('the size list is not touched by the rate', JSON.stringify(r.state.deadH) === '{}', JSON.stringify(r.state.deadH));
  const footAfter = r.calls.foot.length;
  // 85.3.19 changed this contract on purpose: the walk stops at FULL HD, so the size the
  // picture landed on is measured in its own right and then LEFT there - the list is the way
  // down. The assertions are rewritten to that contract; 85.3.19's own gate proves it.
  window3(r, 2);
  window3(r, 2);
  ok('85.3.19: a FULL HD picture that cannot keep up is measured, and stays there',
    r.calls.land.length === 0 && r.calls.apply.length === 1, JSON.stringify(r.calls.land) + ' / steps ' + r.state.rateSteps);
  ok('so the size list stays honest', JSON.stringify(r.state.deadH) === '{}', JSON.stringify(r.state.deadH));
  ok('and it says so once more', r.calls.foot.length > footAfter && /stays on 1080p/.test(r.calls.foot[r.calls.foot.length - 1] || ''), r.calls.foot[r.calls.foot.length - 1]);
}
{
  // 85.3.19 - A FASTER SIZE BELOW FULL HD NO LONGER BUYS A STEP: the walk stops at FULL HD,
  // so the size the picture is on is kept and the list is the way down. Rewritten to that
  // contract; 85.3.19's own gate proves it.
  const r = perfRun({ readyState: 4, fxOn: false, rung: fourRungs[2], land: true, rateSteps: 1, rateBest: 2, rateNow: 9 });
  const moved = r.U.scVideoSlow();
  ok('85.3.19: a size under FULL HD that shows more frames does not buy a step below it',
    moved === false && r.state.rateSteps === 2, r.state.rateSteps);
  ok('and the picture is left where it is', r.calls.apply.length === 0 && r.calls.land.length === 0, JSON.stringify(r.calls.apply));
}
{
  // NO GAIN, NO FURTHER STEP: the size under this one shows fewer frames than this one did,
  // so the phone is at its limit and reloading the rest of the list would only lose sharpness.
  const r = perfRun({ readyState: 4, fxOn: false, rung: fourRungs[3], land: true, rateSteps: 2, rateBest: 9, rateNow: 4 });
  const moved = r.U.scVideoSlow();
  ok('a smaller size that is slower ends the walk', moved === false, moved);
  ok('nothing is applied and nothing is landed on', r.calls.apply.length === 0 && r.calls.land.length === 0, JSON.stringify(r.calls));
  ok('the budget is spent, so the next window does not try again', r.state.rateSteps === 4, r.state.rateSteps);
  ok('and the footer says which size it is staying on', /most it will show/.test(r.calls.foot[0] || '') && /720p/.test(r.calls.foot[0] || ''), r.calls.foot[0]);
}
{
  // AND IT IS BOUNDED. A phone that reads every size as slow is not walked forever.
  const r = perfRun({ readyState: 4, fxOn: false, rung: fourRungs[3], land: true, rateSteps: 4, rateBest: 2, rateNow: 2 });
  ok('a film that has given up its sizes stays where it is', r.U.scVideoSlow() === false && r.calls.apply.length === 0 && r.calls.land.length === 0,
    JSON.stringify(r.calls));
}
{
  const r = perfRun({ readyState: 4, fxOn: false, rung: fourRungs[0], rateNow: 2 });
  ok('the function reads the budget before it touches anything', /if\(steps >= SC_VQ_RATE_STEPS\) return false;/.test(grab('scVideoSlow')));
  ok('the budget is a constant, not a number in the body', /var SC_VQ_RATE_STEPS = \d+;/.test(page));
  ok('no size list is written by the rate', !/deadH/.test(grab('scVideoSlow')));
  // 85.3.19: the rate no longer lands the picture below FULL HD at all, so the landing it
  // used to tell is not in this function. Rewritten to the contract this release ships.
  ok('and the rate never lands the picture below FULL HD at all', !/scVideoLand\(/.test(grab('scVideoSlow')));
  const land = grab('scVideoLand');
  ok('a landing for the rate does not mark the height it left', /if\(!rateOnly\) scVideoState\.deadH\[from\.h\] = 1;/.test(land), land.slice(0, 80));
}
{
  // The upscaler still goes first: it is the cheapest thing to give up.
  const r = perfRun({ readyState: 4, fxOn: true, rung: fourRungs[0] });
  window3(r, 2);
  window3(r, 2);
  ok('a slow picture loses the upscaler before it loses a size', r.calls.fx === 1 && r.state.fxBlocked === true && r.calls.apply.length === 0, 'fx=' + r.calls.fx);
  window3(r, 2);
  window3(r, 2);
  ok('and the size follows on the next verdict', r.calls.apply.length === 1, JSON.stringify(r.calls.apply));
}

// =============================================================================
console.log('\n3. Per film, not per session');
// =============================================================================
ok('a new film gives the rate its sizes again', /scVideoState\.rateSteps = 0;/.test(grab('scVideoLoad')));
ok('a new film forgets the rate it compared against', /scVideoState\.rateNow = 0;/.test(grab('scVideoLoad')) && /scVideoState\.rateBest = 0;/.test(grab('scVideoLoad')));
ok('the state carries the step budget and the two rates', /rateSteps: 0, rateNow: 0, rateBest: 0/.test(page));
ok('the per-film memory is cleared together',
  /scVideoState\.slowH = \{\};\n\s*scVideoState\.rateSteps = 0;/.test(grab('scVideoLoad')));
ok('the verdict keeps the raw rate as well as the rounded one', /st\.rateNow = Math\.round\(Number\(fps\) \* 100\) \/ 100;/.test(grab('scVideoPerfVerdict')));
ok('the latch that stopped the walk in 85.3.12 is gone', !/slowDone/.test(page));

// =============================================================================
console.log('\n4. The release itself');
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
ok('the page is on 85.3.13 or newer', atLeast(vPage, '85.3.13'), vPage);
ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
ok('the notes carry the 85.3.13 entry', page.includes("version: '85.3.13'"));
ok('the new entry is above 85.3.12', page.indexOf("version: '85.3.13'") < page.indexOf("version: '85.3.12'"));
{
  const entry = page.slice(page.indexOf("version: '85.3.13'"), page.indexOf("version: '85.3.12'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 120));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
