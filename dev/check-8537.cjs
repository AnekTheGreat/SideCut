// 85.3.7 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// One report, one release: above the one-stream row every size of the music video came up
// empty - the picture only ever arrived at 360p, and 85.3.6 had removed the road down, so
// the empty frame stayed there. A size is now asked before it is shown: the sharpest size
// this source will actually serve is the one that is attached, and a size that will not
// serve is never put on the screen and never walked to in front of the viewer.
//
// Nothing here is a copy of the shipped code: every function is cut out of the page by its
// own name and braces, and runs against fake elements and a fake reader.
//
//   node dev/check-8537.cjs
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
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__unit = {' + (expose || []).join(', ') + '};', sandbox, { filename: filename || 'unit.js' });
  return sandbox.__unit;
}
const settle = () => new Promise((r) => setImmediate(r));

// =============================================================================
console.log('\n1. A size is asked before it is shown');
// =============================================================================
const pickSrc = [
  constLine('SC_VQ_DEFAULT'), constLine('SC_VQ_PROBE_MS'),
  grab('scVideoDead'), grab('scVideoLive'), grab('scVideoDefault'),
  grab('scVideoRungFor'), grab('scVideoProbe'), grab('scVideoProbes'), grab('scVideoPick')
].join('\n');

function pickRun(opts) {
  const asked = [];
  const rungs = opts.rungs;
  const warns = (opts.refuse || []);
  const sb = {
    console, Number, Math, String, Object, Array, Promise, isFinite, setTimeout, clearTimeout,
    scVideoState: { deadH: opts.deadH || {}, rungs },
    scNativeHttpAvailable() { return opts.native !== false; },
    scStreamUsable(url, size) {
      asked.push(url);
      if (opts.hang) return new Promise(() => {});
      if (opts.unknown) return Promise.resolve(true);
      return Promise.resolve(!warns.some((h) => url === 'u' + h));
    }
  };
  const U = run(pickSrc, sb, ['scVideoPick', 'scVideoProbe'], 'video-pick.js');
  if (opts.probeMs) sb.SC_VQ_PROBE_MS = opts.probeMs;
  return { U, asked, sb };
}
const fourRungs = [
  { h: 1080, label: '1080p', codec: 'H.264', url: 'u1080', size: 24e6, muxed: false },
  { h: 720, label: '720p', codec: 'H.264', url: 'u720', size: 12e6, muxed: false },
  { h: 480, label: '480p', codec: 'H.264', url: 'u480', size: 8e6, muxed: true },
  { h: 360, label: '360p', codec: 'H.264', url: 'u360', size: 5e6, muxed: true }
];
// A ladder with no one-stream row at all, for the case where nothing answers.
const adaptiveOnly = [
  { h: 1080, label: '1080p', codec: 'H.264', url: 'u1080', size: 24e6, muxed: false },
  { h: 720, label: '720p', codec: 'H.264', url: 'u720', size: 12e6, muxed: false },
  { h: 360, label: '360p', codec: 'H.264', url: 'u360', size: 5e6, muxed: false }
];
(async () => {
  {
    const r = pickRun({ rungs: fourRungs });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('a 1080p row that answers is the size that plays', picked.rung && picked.rung.h === 1080, picked.rung && picked.rung.h);
    ok('the ask is the first thing asked', r.asked[0] === 'u1080', JSON.stringify(r.asked));
    ok('nothing that answered refused it', picked.refused.length === 0, JSON.stringify(picked.refused));
    ok('the ask is reported back to the caller', picked.asked && picked.asked.h === 1080);
  }
  {
    // 85.3.8 - the contract this assertion used to state changed: a verdict from the reader
    // no longer takes the size off the screen. The ask is played, on a short leash.
    const r = pickRun({ rungs: fourRungs, refuse: [1080] });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('a size the reader refused is still the size that is tried', picked.rung.h === 1080, picked.rung.h);
    ok('the size that refused is named in the answer', picked.refused.join(',') === '1080', picked.refused.join(','));
    ok('the size that was asked for is still reported', picked.asked.h === 1080);
    ok('and that picture is put on a short leash', picked.suspect === true, picked.suspect);
    ok('the size under it is asked in the same round, so the landing has somewhere to go', r.asked.slice(0, 2).join(',') === 'u1080,u720', r.asked.join(','));
  }
  {
    const r = pickRun({ rungs: fourRungs, refuse: [1080, 720] });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('two refusals do not silence the size that was asked for', picked.rung.h === 1080, picked.rung.h);
    ok('both refused heights are named', picked.refused.sort().join(',') === '1080,720', picked.refused.join(','));
    ok('the one-stream row is never asked - it is the row that always plays', !r.asked.includes('u480'), r.asked.join(','));
  }
  {
    const r = pickRun({ rungs: adaptiveOnly, refuse: [1080, 720, 360] });
    const picked = await r.U.scVideoPick(adaptiveOnly, 1080);
    ok('when nothing answers the ask is still the size that is tried', picked.rung.h === 1080);
    ok('and every refused size is named', picked.refused.sort().join(',') === '1080,360,720', picked.refused.join(','));
  }
  {
    const r = pickRun({ rungs: fourRungs, native: false });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('in a browser nothing is asked (a cross-origin answer says nothing)', r.asked.length === 0 && picked.rung.h === 1080);
  }
  {
    const r = pickRun({ rungs: fourRungs });
    const picked = await r.U.scVideoPick(fourRungs, 720);
    ok('a size picked below the top never lands on a size above it', picked.rung.h === 720, picked.rung.h);
    ok('and the 1080p row is not even asked', !r.asked.includes('u1080'), r.asked.join(','));
  }
  {
    const dead = { 1080: 1 };
    const r = pickRun({ rungs: fourRungs, deadH: dead });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('a height already marked dead is not landed on again', picked.rung.h === 720, picked.rung.h);
  }
  {
    // A reader that never answers must not hold the film: the ask is taken as unknown and
    // the element is the judge, exactly the way a browser behaves.
    const r = pickRun({ rungs: fourRungs, hang: true, probeMs: 25 });
    const started = Date.now();
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('a probe that never answers does not hold the picture', picked.rung.h === 1080 && Date.now() - started < 1500, Date.now() - started);
  }
  ok('the probe asks the reader the downloader trusts', /scStreamUsable\(u, Number\(rung\.size\) \|\| 0\)/.test(grab('scVideoProbe')));
  ok('the asks share one deadline', /function scVideoProbes\(list\)/.test(page) && /setTimeout\(function\(\)\{ if\(!done\)/.test(grab('scVideoProbes')));
  ok('the probe is not made without the native reader', /scNativeHttpAvailable\(\)/.test(grab('scVideoProbe')));
  ok('the probe never asks for a one-stream row', /if\(rung\.muxed\) return Promise\.resolve\(true\)/.test(grab('scVideoProbe')));

  // =============================================================================
  console.log('\n2. A size that dies mid-film goes to the sharpest one that still answers');
  // =============================================================================
  const landSrc = [constLine('SC_VQ_PROBE_MS'), grab('scVideoProbes'), grab('scVideoLand')].join('\n');
  function landRun(opts) {
    const calls = { applied: [], foot: '', say: '', spin: [], big: [] };
    const state = {
      open: true, rung: opts.from, rungs: opts.rungs, deadH: opts.deadH || {},
      landSeq: 0
    };
    const sb = {
      console, Number, Math, String, Object, Array, Promise, isFinite, setTimeout, clearTimeout,
      scVideoState: state,
      scVideoProbe(rung) { return Promise.resolve(!(opts.refuse || []).includes(rung.h)); },
      scVideoApplyRung(r) { calls.applied.push(r.h); state.rung = r; },
      scVideoFoot(t) { calls.foot = String(t || ''); },
      scVideoSay(t) { calls.say = String(t || ''); },
      scVideoSpin(v) { calls.spin.push(!!v); },
      scVideoBig(v) { calls.big.push(!!v); }
    };
    const U = run(landSrc, sb, ['scVideoLand'], 'video-land.js');
    return { U, state, calls };
  }
  {
    const r = landRun({ from: fourRungs[0], rungs: fourRungs, refuse: [720] });
    const took = r.U.scVideoLand('1080p H.264 did not play here (a refusal).', 'Nothing smaller answered here either.');
    await settle();
    ok('a dead size is left for the sharpest size under it that answers', took === true && r.calls.applied[0] === 480, JSON.stringify(r.calls.applied));
    ok('the sizes that refused on the way are marked in the list', r.state.deadH[1080] === 1 && r.state.deadH[720] === 1, JSON.stringify(r.state.deadH));
    ok('the footer names the landed size', /480p, the sharpest size that opens here/.test(r.calls.foot), r.calls.foot);
    ok('the footer keeps the reason the size died', /did not play here/.test(r.calls.foot), r.calls.foot);
  }
  {
    const r = landRun({ from: fourRungs[0], rungs: fourRungs, refuse: [720, 480, 360] });
    r.U.scVideoLand('1080p H.264 did not play here (a refusal).', 'Nothing smaller answered here either.');
    await settle();
    ok('when nothing under it answers no other size is applied', r.calls.applied.length === 0, JSON.stringify(r.calls.applied));
    ok('and the screen says nothing smaller answered', /Nothing smaller answered here either/.test(r.calls.say), r.calls.say);
    ok('the footer keeps that sentence too', /Nothing smaller answered here either/.test(r.calls.foot), r.calls.foot);
  }
  {
    const r = landRun({ from: fourRungs[3], rungs: fourRungs });
    ok('the smallest size has nowhere to land', r.U.scVideoLand('360p did not play here.', 'none') === false);
  }
  ok('the landing is abandoned when a hand picks another size', /scVideoState\.rung !== from/.test(landSrc));
  ok('the landing is abandoned when the tab closes', /!scVideoState\.open/.test(landSrc));

  // =============================================================================
  console.log('\n3. The failure road is one move, and never a lie about the stream');
  // =============================================================================
  const failedSrc = [
    constLine('SC_VQ_FLOOR'), constLine('SC_VQ_DEFAULT'),
    grab('scVideoDead'), grab('scVideoLive'), grab('scVideoRungBelow'), grab('scVideoFailed')
  ].join('\n');
  function failureRun(opts) {
    const state = {
      rung: opts.rung, rungs: opts.rungs, alts: [], alt: 0, drops: 0, retries: 0,
      deadH: {}, rescueH: {}, via: opts.via || 'blob', swapAt: 0, srcNow: 'x'
    };
    const calls = { land: [], read: 0, foot: '', say: '', applied: [] };
    const el = { error: { code: opts.code || 4 }, src: 'x', currentSrc: 'x', currentTime: 42, pause() {} };
    const sb = {
      console, Date, Number, Math, String, Object, Array, Promise, isFinite,
      scVideoState: state,
      scVideoEl() { return el; },
      scVideoWatchStop() {}, scVideoSpin() {}, scVideoBig() {},
      scVideoRescue() { return false; },
      scVideoStream() { return false; },      // 85.3.8 reads the row itself first; see check-8538
      scVideoReadCap() { return 40 * 1024 * 1024; },
      scVideoLand(why, none) { calls.land.push(why); calls.none = none; return false; },
      scVideoRead() { calls.read++; },
      scVideoApplyRung(r) { calls.applied.push(r.h); state.rung = r; },
      scVideoSay(t) { calls.say += String(t || ''); },
      scVideoFoot(t) { calls.foot = String(t || ''); },
      SC_VQ_DEFAULT: 1080, SC_VQ_READ_MAX: 64 * 1024 * 1024
    };
    const U = run(failedSrc, sb, ['scVideoFailed'], 'video-failed.js');
    U.scVideoFailed(false);
    return { state, calls };
  }
  {
    const r = failureRun({ rung: fourRungs[0], rungs: fourRungs, via: 'blob', code: 4 });
    ok('a refused size is handed to the landing instead of an empty frame', r.calls.land.length === 1, JSON.stringify(r.calls.land));
    ok('the landing is told which size died and why', /1080p H\.264 did not play here/.test(r.calls.land[0] || ''), r.calls.land[0]);
    ok('the landing is told the sentence for "nothing answered"', /Nothing smaller answered here either/.test(r.calls.none || ''), r.calls.none);
    ok('the dead height is marked in the list', r.state.deadH[1080] === 1);
    ok('nothing was attached by the road itself - the landing decides', r.calls.applied.length === 0);
    ok('a size already read is not read again', r.calls.read === 0);
  }
  {
    const r = failureRun({ rung: fourRungs[0], rungs: fourRungs, via: 'direct', code: 4 });
    ok('a sharp size the reader can hold is read once before it is given up', r.calls.read === 1);
    ok('the height is remembered so the read cannot repeat', r.state.rescueH[1080] === 1);
    ok('and the landing is not reached while the read is running', r.calls.land.length === 0);
  }
  {
    const big = Object.assign({}, fourRungs[0], { size: 58 * 1024 * 1024 });
    const r = failureRun({ rung: big, rungs: [big].concat(fourRungs.slice(1)), via: 'direct', code: 4 });
    ok('a film past the reader ceiling is not read and thrown away', r.calls.read === 0);
    ok('it goes to the landing instead', r.calls.land.length === 1);
  }
  {
    const r = failureRun({ rung: { h: 720, label: '720p', codec: 'H.264', url: 'u720', size: 12e6, muxed: false }, rungs: fourRungs, via: 'direct', code: 3 });
    ok('below FULL HD the reader is not spent on a size worth little', r.calls.read === 0);
    ok('and the landing still runs', r.calls.land.length === 1);
  }
  {
    // The sentence the owner was reading is gone from the tab's own lines (the comments
    // that explain why it was wrong are allowed to quote it).
    const said = (grab('scVideoRead') + grab('scVideoRescueDown') + grab('scVideoLand') + grab('scVideoFailed'))
      .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    ok('the video tab no longer says a stream "came back empty"', !/came back empty/.test(said));
  }
  ok('the failure road no longer walks one rung down on its own', !/scVideoRungBelow\(pool, fromH\)/.test(page));

  // =============================================================================
  console.log('\n4. The reader is asked for what it can hold');
  // =============================================================================
  const readSrc = [grab('scVideoRead')].join('\n');
  function readRun(opts) {
    const calls = { fetch: [], say: '', land: [], spin: [], big: [] };
    const state = { pick: { url: 'v1080', mime: 'video/mp4', size: opts.size } };
    const sb = {
      console, Number, Math, String, Object, Array, Promise, JSON,
      scVideoState: state,
      scVideoReadCap() { return 40 * 1024 * 1024; },
      scVideoLand(why, none) { calls.land.push(why); calls.none = none; return opts.land !== false; },
      scFetchBytes(url) { calls.fetch.push(url); return Promise.resolve(opts.buf); },
      scVideoSay(t) { calls.say += String(t || ''); },
      scVideoSpin(v) { calls.spin.push(!!v); },
      scVideoBig(v) { calls.big.push(!!v); },
      URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
      Blob: function () {}
    };
    const U = run(readSrc, sb, ['scVideoRead'], 'video-read.js');
    return { U, state, calls };
  }
  {
    const r = readRun({ size: 58 * 1024 * 1024 });
    r.U.scVideoRead();
    await settle();
    ok('a film larger than the reader is not fetched', r.calls.fetch.length === 0);
    ok('it is named as too large to hold, not as empty', /too large to hold in memory/.test(r.calls.land[0] || ''), r.calls.land[0]);
    ok('and the picture is sent to a size that streams', r.calls.land.length === 1);
  }
  {
    const r = readRun({ size: 20 * 1024 * 1024, buf: null });
    r.U.scVideoRead();
    await settle(); await settle();
    ok('a film the reader can hold is read', r.calls.fetch.length === 1);
    ok('a read that comes back with nothing lands on a smaller size', r.calls.land.length === 1, JSON.stringify(r.calls.land));
    ok('the old false message is gone from the screen', !/came back empty/.test(r.calls.say), r.calls.say);
  }
  ok('the read cap is the reader cap, not a bigger number', /Number\(c\.size\) > scVideoReadCap\(\)/.test(readSrc));

  // =============================================================================
  console.log('\n5. A size picked by hand is asked the same question');
  // =============================================================================
  const chooseSrc = grab('scVideoQualityChoose');
  ok('the hand pick asks before it attaches', /scVideoPick\(scVideoState\.rungs, h\)/.test(chooseSrc));
  ok('a hand pick that is not served says so and lands on the one that is', /is not served here for this video/.test(chooseSrc));
  ok('a stale hand pick cannot attach after another one', /token !== scVideoState\.pickSeq/.test(chooseSrc));

  // =============================================================================
  console.log('\n6. The load path uses the ask, and the list says what refused');
  // =============================================================================
  ok('the film opens only through the ask', /return scVideoPick\(r\.rungs, scVideoState\.want\)/.test(page));
  ok('a landed-lower picture names the size that did not answer', /is not served here for this video/.test(grab('scVideoLoad')));
  ok('the quality list explains the "did not play here" mark', /A size marked did not play here is one this source would not serve/.test(page));

  // =============================================================================
  console.log('\n7. The release itself');
  // =============================================================================
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  }
  const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok('the page is on a version at or above 85.3.7', /^85\.3\.[7-9]$/.test(vPage), vPage);
  ok('the shell cache is on the same version', sw.includes("sidecut-shell-v" + vPage), vPage);
  ok('the notes carry the 85.3.7 entry', page.includes("version: '85.3.7'"));
  ok('the 85.3.7 entry is above 85.3.6', page.indexOf("version: '85.3.7'") < page.indexOf("version: '85.3.6'"));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
