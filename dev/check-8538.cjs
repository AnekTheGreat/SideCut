// 85.3.8 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report was the same screen for the fourth release running: "you can get 1080p
// and 2K and 4K, why does this only work at 360p". It was measured this time, not assumed:
//
//   * the ANDROID player call hands back 29 adaptive rows and one muxed row - 2160p, 1440p,
//     1080p, 720p, 480p, 360p, 240p, 144p - all with plain addresses;
//   * a two-byte range, a four-megabyte range and a 2 MiB offset probe on the 1080p and the
//     4K row all answer 206, from a browser UA, the Android app UA, an okhttp UA and no UA;
//   * a real media element in a real engine opens the 1080p row (1920x1080, readyState 4,
//     currentTime advancing) and the 4K row (3840x2160, same);
//   * the app's own ladder and pick, driven in the real page against real rows, already
//     chooses 1080p H.264 - and plays it.
//
// So the sharp rows were never the problem. The app was: 85.3.7 let a verdict about one
// range request take the size off the screen (and attached a size it had just been told was
// refused), and it would only read a refused row whole, which no 1080p film fits inside.
// This release makes the ask the size that is tried, gives it a short leash instead of a
// verdict, and plays a size the player will not open through the app's own reader into a
// media buffer - one megabyte at a time, kept only ahead of the picture.
//
// Nothing here is a copy of the shipped code: every function is cut out of the page by its
// own name and braces, and runs against fake elements, a fake reader and a fake MediaSource.
//
//   node dev/check-8538.cjs
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

// =============================================================================
console.log('\n1. The size that was asked for is the size that is tried');
// =============================================================================
const pickSrc = [
  constLine('SC_VQ_DEFAULT'), constLine('SC_VQ_PROBE_MS'),
  grab('scVideoDead'), grab('scVideoLive'), grab('scVideoDefault'),
  grab('scVideoRungFor'), grab('scVideoProbe'), grab('scVideoProbes'), grab('scVideoPick')
].join('\n');
const fourRungs = [
  { h: 2160, label: '4K', codec: 'VP9', url: 'u2160', size: 240e6, muxed: false },
  { h: 1440, label: '1440p', codec: 'VP9', url: 'u1440', size: 122e6, muxed: false },
  { h: 1080, label: '1080p', codec: 'H.264', url: 'u1080', size: 80e6, muxed: false },
  { h: 720, label: '720p', codec: 'H.264', url: 'u720', size: 26e6, muxed: false },
  { h: 360, label: '360p', codec: 'H.264', url: 'u360', size: 8e6, muxed: true }
];
function pickRun(opts) {
  const asked = [];
  const sb = {
    console, Number, Math, String, Object, Array, Promise, isFinite, setTimeout, clearTimeout,
    scVideoState: { deadH: opts.deadH || {}, rungs: opts.rungs },
    scNativeHttpAvailable() { return opts.native !== false; },
    scStreamUsable(url) {
      asked.push(url);
      return Promise.resolve(!(opts.refuse || []).some((h) => url === 'u' + h));
    }
  };
  const U = run(pickSrc, sb, ['scVideoPick'], 'video-pick.js');
  return { U, asked, sb };
}
(async () => {
  {
    const r = pickRun({ rungs: fourRungs });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('a 1080p row that answers is the size that plays', picked.rung.h === 1080 && picked.suspect === false, picked.rung.h + ' suspect=' + picked.suspect);
    ok('nothing was refused, so nothing is named', picked.refused.length === 0, JSON.stringify(picked.refused));
  }
  {
    // THE REPORT, IN ONE CASE. The reader refuses every sharp size (a range request that a
    // phone answers with 403 says nothing about the picture behind it) and 85.3.7 answered
    // that by playing the one-stream row. The ask is played now, and it is the ask.
    const r = pickRun({ rungs: fourRungs, refuse: [1080, 720] });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('a refused ask is still the size that is tried', picked.rung.h === 1080, picked.rung.h);
    ok('it is on the short leash, not the long one', picked.suspect === true);
    ok('the refused heights are named for the list', picked.refused.sort().join(',') === '1080,720', picked.refused.join(','));
    ok('the picture is never quietly moved to 360p by a verdict', picked.rung.h !== 360, picked.rung.h);
  }
  {
    const r = pickRun({ rungs: fourRungs, refuse: [2160] });
    const picked = await r.U.scVideoPick(fourRungs, 2160);
    ok('a hand-picked 4K row is tried even when the reader refused it', picked.rung.h === 2160 && picked.suspect === true, picked.rung.h);
  }
  {
    const r = pickRun({ rungs: fourRungs, deadH: { 1080: 1 } });
    const picked = await r.U.scVideoPick(fourRungs, 1080);
    ok('a height the element already refused is still skipped', picked.rung.h === 720, picked.rung.h);
  }
  {
    const load = grab('scVideoLoad');
    ok('the load path never writes a reader verdict into the dead list', !/pick\.refused \|\| \[\]\)\.forEach/.test(load));
    ok('it keeps the refused heights as a leash instead', /scVideoState\.refusedH = \(pick\.refused \|\| \[\]\)\.slice\(\)/.test(load));
    ok('and hands the leash to the size that is applied', /scVideoApplyRung\(rung, false, pick\.suspect\)/.test(load));
  }
  ok('the leash is a third argument of the size that is applied', /function scVideoApplyRung\(rung, keep, suspect\)/.test(page));

  // =============================================================================
  console.log('\n2. A size the player will not open is read by the app and played from memory');
  // =============================================================================
  const streamSrc = [
    constLine('SC_VQ_STREAM_AHEAD'), constLine('SC_VQ_STREAM_MAX_AHEAD'),
    grab('scVideoStreamOk'), grab('scVideoStreamDrop'), grab('scVideoStreamDown'), grab('scVideoStream')
  ].join('\n');
  function fakeMse(bufferedEnd) {
    const made = [];
    class MS {
      constructor() { this.listeners = {}; this.readyState = 'closed'; this.ended = false; made.push(this); }
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
    const sb = {
      console, Number, Math, String, Object, Array, Promise, isFinite, setTimeout, clearTimeout,
      scVideoState: state,
      MediaSource: o.noMse ? undefined : mse.MS,
      URL: { createObjectURL() { return 'blob:appstream'; }, revokeObjectURL() { calls.revoked = (calls.revoked || 0) + 1; } },
      scVideoEl() { return { currentTime: o.currentTime || 0 }; },
      scVideoAttach(url, via, keep) { calls.attach.push([url, via, keep]); state.rung = state.rung || o.rung; },
      scVideoFoot(t) { calls.foot = String(t || ''); },
      scVideoFailed(dead) { calls.failed.push(dead); },
      scFetchRange(url, start, end) {
        calls.fetch.push([start, end]);
        if (o.alwaysNull) return Promise.resolve(null);
        if (o.stopAfter != null && calls.fetch.length > o.stopAfter) return Promise.resolve(null);
        const size = o.size || 0;
        const len = size ? Math.min(1048576, size - start) : 1048576;
        if (len <= 0) return Promise.resolve({ bytes: null, status: 416 });
        return Promise.resolve({ bytes: new Uint8Array(len), partial: true, status: 206 });
      }
    };
    const U = run(streamSrc, sb, ['scVideoStream', 'scVideoStreamDown', 'scVideoStreamDrop', 'scVideoStreamOk'], 'video-stream.js');
    return { U, sb, state, calls, mse };
  }
  async function fireOpen(r, times) {
    for (let i = 0; i < (times || 40); i++) {
      await settle(2);
    }
  }
  {
    const row = { h: 1080, label: '1080p', codec: 'H.264', url: 'https://rr.googlevideo.com/videoplayback?itag=137',
                  mime: 'video/mp4; codecs="avc1.640028"', size: 3 * 1048576, muxed: false };
    const r = streamRun({ rung: row, size: row.size });
    const started = r.U.scVideoStream(row);
    ok('a sharp row the player refused is taken by the app', started === true);
    ok('the picture is pointed at this app\'s own buffer', r.calls.attach.length === 1 && r.calls.attach[0][0] === 'blob:appstream', JSON.stringify(r.calls.attach));
    ok('the source is marked as the app\'s, not the player\'s', r.calls.attach[0][1] === 'stream');
    ok('the footer says the picture is being read by the app', /Read|read/.test(r.calls.foot), r.calls.foot);
    r.mse.made[0].readyState = 'open';
    r.mse.made[0].fire('sourceopen');
    await fireOpen(r);
    ok('the buffer takes the row\'s own codec', r.mse.made[0].mime === row.mime, r.mse.made[0].mime);
    ok('the row is read in one-megabyte ranges from the start', JSON.stringify(r.calls.fetch.map((f) => f[0])) === '[0,1048576,2097152]', JSON.stringify(r.calls.fetch.map((f) => f[0])));
    ok('a range never asks for more than a megabyte', r.calls.fetch.every((f) => f[1] - f[0] + 1 <= 1048576), JSON.stringify(r.calls.fetch));
    ok('every megabyte reaches the buffer', r.mse.made[0].sb.appended.join(',') === '1048576,1048576,1048576', r.mse.made[0].sb.appended.join(','));
    ok('the whole row is the whole film: the buffer is closed at its end', r.mse.made[0].ended === true);
    ok('nothing failed along the way', r.calls.failed.length === 0, JSON.stringify(r.calls.failed));
  }
  {
    // A 100 MB row is not a 100 MB allocation: the reader stops once the film is far enough
    // in front of the picture, and the picture asks again as it plays.
    const row = { h: 2160, label: '4K', codec: 'VP9', url: 'https://rr.googlevideo.com/videoplayback?itag=313',
                  mime: 'video/webm; codecs="vp9"', size: 100 * 1048576, muxed: false };
    const r = streamRun({ rung: row, size: row.size, vidLen: 100, bufferedEnd: 400 });
    r.U.scVideoStream(row);
    r.mse.made[0].readyState = 'open';
    r.mse.made[0].fire('sourceopen');
    await fireOpen(r);
    ok('a 4K size is not read whole into memory', r.calls.fetch.length === 1, JSON.stringify(r.calls.fetch));
    ok('the reader waits instead of giving up', /4K|read/.test(r.calls.foot) && r.calls.failed.length === 0, r.calls.foot);
  }
  {
    const row = { h: 1080, label: '1080p', codec: 'H.264', url: 'https://rr.googlevideo.com/x', mime: 'video/mp4', size: 4 * 1048576, muxed: false };
    const r = streamRun({ rung: row, size: row.size, stopAfter: 1 });
    r.U.scVideoStream(row);
    r.mse.made[0].readyState = 'open';
    r.mse.made[0].fire('sourceopen');
    await fireOpen(r);
    ok('a read that stops early ends the buffer instead of hanging', r.mse.made[0].ended === true);
  }
  {
    const row = { h: 1080, label: '1080p', url: 'https://rr.googlevideo.com/x', mime: 'video/mp4', size: 3e6, muxed: false };
    const r = streamRun({ rung: row, size: row.size, alwaysNull: true });
    r.U.scVideoStream(row);
    r.mse.made[0].readyState = 'open';
    r.mse.made[0].fire('sourceopen');
    await fireOpen(r, 6);
    ok('a read that never comes back gives the size up', r.calls.failed.length === 1, JSON.stringify(r.calls.failed));
    ok('and it says so plainly', /played from memory here|could not/.test(r.calls.foot), r.calls.foot);
  }
  {
    const mux = { h: 360, label: '360p', url: 'https://rr.googlevideo.com/x', mime: 'video/mp4', muxed: true };
    ok('a one-stream row is never read: it is the row that already plays', streamRun({}).U.scVideoStream(mux) === false);
    const blob = { h: 1080, label: '1080p', url: 'blob:abc', mime: 'video/mp4', muxed: false };
    ok('a row the app already holds is not read again', streamRun({}).U.scVideoStream(blob) === false);
    const row = { h: 1080, label: '1080p', url: 'https://rr.googlevideo.com/x', mime: 'video/mp4', size: 3e6, muxed: false };
    ok('a phone with no media buffer is not told a lie', streamRun({ noMse: true }).U.scVideoStream(row) === false);
    const r = streamRun({ rung: row, size: row.size });
    r.U.scVideoStream(row);
    ok('one attempt per size, never a loop', r.U.scVideoStream(row) === false);
  }
  ok('the buffer is kept in front of the picture, not the whole film', /SC_VQ_STREAM_AHEAD/.test(streamSrc) && /held\(\) > \(\(Number\(v && v\.currentTime\) \|\| 0\) \+ aheadS\)/.test(streamSrc));
  ok('and the window is capped by weight as well as by seconds', /SC_VQ_STREAM_MAX_AHEAD \/ bps/.test(streamSrc), streamSrc.match(/aheadS = [^\n]+/));
  ok('the app\'s own buffer is released when a new film starts', /scVideoStreamDrop\(\);/.test(grab('scVideoLoad')));

  // =============================================================================
  console.log('\n3. A size on the leash gets a short window, then one more');
  // =============================================================================
  const watchSrc = [
    constLine('SC_VQ_WATCH_MS'), constLine('SC_VQ_WATCH_PER_MB'), constLine('SC_VQ_SUSPECT_MS'),
    grab('scVideoWatchStop'), grab('scVideoWatchMs'), grab('scVideoWatch')
  ].join('\n');
  function watchRun(opts) {
    const o = opts || {};
    const timers = [], calls = { failed: [], watches: 0 };
    const state = { suspect: !!o.suspect, watchMore: 0, watch: null, watchToken: 0, blocked: false, streamBusy: !!o.busy };
    const el = { src: 'x', paused: false, readyState: 0, currentTime: 0, networkState: o.networkState == null ? 1 : o.networkState,
                 buffered: { length: 0, end() { return 0; } } };
    const sandbox = {
      console, Number, Math, String, Object, Array, Promise, isFinite, clearTimeout,
      setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
      scVideoState: state,
      scVideoEl() { return el; },
      scVideoFailed(dead) { calls.failed.push(dead); },
      scVideoWatchRef() { calls.watches++; }
    };
    const U = run(watchSrc, sandbox, ['scVideoWatch'], 'video-watch.js');
    return { U, state, timers, calls, el };
  }
  {
    const r = watchRun({ suspect: true });
    r.state.rung = { h: 1080, size: 80 * 1048576 };
    r.U.scVideoWatch();
    ok('a size the reader refused waits seconds, not half a minute', r.timers[0].ms === 6000, r.timers[0].ms);
  }
  {
    const r = watchRun({ suspect: false });
    r.state.rung = { h: 1080, size: 80 * 1048576 };
    r.U.scVideoWatch();
    ok('a size nobody doubted keeps the window its weight earns', r.timers[0].ms > 6000, r.timers[0].ms);
  }
  {
    const r = watchRun({ networkState: 2 });
    r.state.rung = { h: 1080, size: 20 * 1048576 };
    r.U.scVideoWatch();
    const first = r.timers[0];
    first.fn();
    ok('a size still fetching is given one more window', r.timers.length === 2, r.timers.length);
    ok('nothing is judged dead at the first deadline', r.calls.failed.length === 0, JSON.stringify(r.calls.failed));
    r.timers[1].fn();
    ok('a second window with nothing buffered is a dead size', r.calls.failed.length === 1 && r.calls.failed[0] === true, JSON.stringify(r.calls.failed));
  }
  {
    const r = watchRun({ networkState: 1 });
    r.state.rung = { h: 720, size: 12 * 1048576 };
    r.U.scVideoWatch();
    r.timers[0].fn();
    ok('a size that is not even fetching is judged at its deadline', r.calls.failed.length === 1, JSON.stringify(r.calls.failed));
  }
  {
    const r = watchRun({ networkState: 1 });
    r.state.rung = { h: 720, size: 12 * 1048576 };
    r.el.readyState = 2;
    r.U.scVideoWatch();
    r.timers[0].fn();
    ok('a size with a picture is never judged', r.calls.failed.length === 0);
  }
  ok('a new source gets its own two windows', /scVideoState\.watchMore = 0;/.test(grab('scVideoAttach')));

  // =============================================================================
  console.log('\n4. The failure road reads the row before it gives the size up');
  // =============================================================================
  const failedSrc = [
    constLine('SC_VQ_FLOOR'), constLine('SC_VQ_DEFAULT'),
    grab('scVideoDead'), grab('scVideoLive'), grab('scVideoRungBelow'), grab('scVideoFailed')
  ].join('\n');
  function failureRun(opts) {
    const o = opts || {};
    const state = {
      rung: o.rung, rungs: o.rungs || fourRungs, alts: [], alt: 0, drops: 0, retries: 0,
      deadH: {}, rescueH: {}, via: o.via || 'direct', swapAt: 0, srcNow: 'x'
    };
    const calls = { land: [], read: 0, stream: 0, foot: '', say: '' };
    const el = { error: { code: o.code || 4 }, src: 'x', currentSrc: 'x', currentTime: 42, pause() {} };
    const sb = {
      console, Date, Number, Math, String, Object, Array, Promise, isFinite,
      scVideoState: state,
      scVideoEl() { return el; },
      scVideoWatchStop() {}, scVideoSpin() {}, scVideoBig() {},
      scVideoRescue() { return false; },
      scVideoStream(r) { calls.stream++; return !!o.stream; },
      scVideoReadCap() { return 40 * 1024 * 1024; },
      scVideoLand(why) { calls.land.push(why); return false; },
      scVideoRead() { calls.read++; },
      scVideoSay(t) { calls.say += String(t || ''); },
      scVideoFoot(t) { calls.foot = String(t || ''); },
      SC_VQ_DEFAULT: 1080, SC_VQ_READ_MAX: 64 * 1024 * 1024
    };
    const U = run(failedSrc, sb, ['scVideoFailed'], 'video-failed.js');
    U.scVideoFailed(false);
    return { state, calls };
  }
  {
    const big = Object.assign({}, fourRungs[2], { size: 80 * 1048576 });
    const r = failureRun({ rung: big, stream: true, code: 3 });
    ok('a 1080p row the player refused is read by the app first', r.calls.stream === 1, r.calls.stream);
    ok('the reader is not spent on holding the whole film', r.calls.read === 0, r.calls.read);
    ok('and the picture is not moved while that is tried', r.calls.land.length === 0, JSON.stringify(r.calls.land));
  }
  {
    const big = Object.assign({}, fourRungs[2], { size: 80 * 1048576 });
    const r = failureRun({ rung: big, stream: false, code: 4 });
    ok('when the app cannot read it either, the size is given up in one jump', r.calls.land.length === 1, JSON.stringify(r.calls.land));
    ok('a film the reader cannot hold is not read whole', r.calls.read === 0);
  }
  {
    const mux = Object.assign({}, fourRungs[4]);
    const r = failureRun({ rung: mux, stream: true, code: 4 });
    ok('a one-stream row is never read - the bytes are already in the picture', r.calls.stream === 0, r.calls.stream);
  }
  ok('the read by the app comes before the read of the whole file', (() => {
    const f = grab('scVideoFailed');
    const a = f.indexOf('scVideoStream(from)');
    const b = f.indexOf('scVideoRead()');
    return a > 0 && b > 0 && a < b;
  })());

  // =============================================================================
  console.log('\n5. The release itself');
  // =============================================================================
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  }
  const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok('the page is on 85.3.8 or newer', /^85\.3\.\d+$/.test(vPage) && Number(vPage.split('.')[2]) >= 8, vPage);
  ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
  ok('the notes carry the 85.3.8 entry', page.includes("version: '85.3.8'"));
  ok('the new entry is above 85.3.7', page.indexOf("version: '85.3.8'") < page.indexOf("version: '85.3.7'"));
  {
    const entry = page.slice(page.indexOf("version: '85.3.8'"), page.indexOf("version: '85.3.7'"));
    ok('the new entry avoids the words the Play channel filters', !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry));
  }
  ok('the state knows the leash, the refusals and the buffer', /suspect: false, refusedH: \[\], streamFor: null, streamUrl: ''/.test(page));
  ok('the reader ceiling did not change - it is the file read that has one', /function scVideoReadCap\(\)/.test(page));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
