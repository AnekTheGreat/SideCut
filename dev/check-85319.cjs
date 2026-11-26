// 85.3.19 harness - a tap is not a transport press, a picked size is kept, the film is its
// own film, and the upscaler sharpens a frame that is being stretched.
//
// The owner's report: "clicking on the video shouldn't auto pause it it should just open up
// the mini bar at the bottom, also the quality shit isnt working and is locked to 360p when
// the default should be 1080p and should be fully adjustable add ai upscaling to this or any
// upscaling to the video to make it look better and the mv should go the full length of the
// song not just a minute".
//
// Four behaviours, four assertions' worth of code:
//
//   * A PICTURE TAP REACHED THE TRANSPORT. The stage's click went to the picture door, but
//     nothing stopped the element's own click from being read somewhere else, and the door
//     itself only marked the controls awake. The element now answers its own click with a
//     door that cannot reach play or pause, and that door shows the bar.
//   * THE RATE WALKED THE SIZE DOWN TO 360P. `scVideoSlow` gave up a size every time the
//     measured rate was under the floor, at or under FULL HD too, and it did not care that
//     the size had been picked by hand. A picked size is now kept, and the automatic step
//     stops at FULL HD.
//   * THE FILM FOLLOWED THE SONG WHERE THE SONG WAS THE SOUND. `scVideoAttach` opened the
//     picture on the song's second in that mode, and `scVideoSync` dragged it there every
//     tick and stopped it when the song ended - the "1 minute" report, in the one mode
//     85.3.18 left alone.
//   * THE SHARPEN WAS OFF EXACTLY WHEN IT WAS NEEDED. The edge mask only ran for sources
//     under 720, so a FULL HD frame stretched to a high-density phone got the resample and
//     nothing else.
//
// Nothing here is a copy of the shipped code: the functions are cut out of index.html by
// name and braces and run in a vm against fake elements.
//
//   node dev/check-85319.cjs
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
  const start = page.indexOf(key);
  if (start < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}
function constLine(name) {
  const m = page.match(new RegExp('^\\s*var ' + name + ' = [^\\n]+$', 'm'));
  if (!m) throw new Error('missing constant ' + name);
  return m[0];
}

function media(p) {
  const o = p || {};
  return {
    src: o.src === undefined ? 'https://example.invalid/film' : o.src,
    paused: !!o.paused, ended: false, muted: false, volume: 1,
    readyState: o.readyState === undefined ? 4 : o.readyState,
    duration: o.duration === undefined ? 240 : o.duration,
    currentTime: Number(o.at) || 0,
    load: function () {}, setAttribute: function () {}, removeAttribute: function () { this.src = ''; },
    play: function () { this.paused = false; return Promise.resolve(); },
    pause: function () { this.paused = true; },
    addEventListener: function () {}
  };
}

// ── the attach / sync / tap harness -----------------------------------------
function harness(opts) {
  const o = opts || {};
  const calls = [];
  const state = Object.assign({
    open: true, audioMode: 'aux', songKey: 'q:t1', videoId: 'vid1',
    last: { key: 'q:t1' }, filmAt: 0, seeded: null, resumeAt: null, startAt: null,
    wasPlaying: true, blocked: false, scrubbing: false, bg: null, songWasPlaying: false,
    hold: false, posSaved: 0, manualH: 0
  }, o.state || {});
  const film = media(o.film);
  const song = media(Object.assign({ src: 'song', at: 300, duration: 240 }, o.song));
  const aux = media({ src: 'voice', paused: true });
  const sandbox = {
    console: console, Number: Number, Math: Math, String: String, Array: Array,
    Object: Object, JSON: JSON, Promise: Promise, isFinite: isFinite, Date: Date, RegExp: RegExp,
    scVideoState: state, film: film, song: song, aux: aux,
    scVideoEl: function (id) {
      if (id === 'scVideoEl') return film;
      if (id === 'scVideoAuxEl') return aux;
      return null;
    },
    scVideoAudioEl: function () { return song; },
    scVideoSongTime: function () { return Number(song.currentTime) || 0; },
    scVideoSong: function (on) { calls.push('song:' + (on ? 'play' : 'pause')); song.paused = !on; },
    scVideoHoldSong: function () { calls.push('holdSong'); song.paused = true; },
    scVideoAuxPause: function () { calls.push('auxPause'); aux.paused = true; },
    scVideoAuxPlay: function () { calls.push('auxPlay'); aux.paused = false; },
    scVideoAuxSet: function (at) { calls.push('auxSet:' + at); },
    scVideoOwnSound: function (on) { calls.push('owns:' + !!on); },
    scVideoMuteOthers: function () {},
    scVideoPose: function (el, at) { calls.push('pose:' + at); if (el) el.currentTime = Number(at) || 0; },
    scVideoPlayAttempt: function () { calls.push('play'); film.paused = false; },
    scVideoBig: function (on) { calls.push('big:' + !!on); },
    scVideoSpin: function (on) { calls.push('spin:' + !!on); },
    scVideoSay: function (t) { calls.push('say:' + t); },
    scVideoWatch: function () { calls.push('watch'); },
    scVideoGraphSync: function () {},
    scVideoBarState: function () { calls.push('bar'); },
    scVideoClock: function () { calls.push('clock'); },
    scVideoIdleWake: function () { calls.push('idleWake'); },
    scVideoFollow: function () { calls.push('follow'); return false; },
    scVideoPerfSample: function () { calls.push('perf'); },
    scVideoPosTick: function () { return false; },
    scVideoTickStart: function () {},
    scVideoAiSchedule: function () {},
    scVideoVoiceReset: function () {},
    scVideoQualityMark: function () {},
    scVideoTap: function () { calls.push('TAP'); },
    scVideoTransport: function () { calls.push('TRANSPORT'); }
  };
  const UNIT = [
    grab('scVideoAttach'), grab('scVideoSync'), grab('scVideoPictureTap')
  ].join('\n');
  const EXPORTS = ['scVideoAttach', 'scVideoSync', 'scVideoPictureTap'];
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UNIT + '\n;globalThis.__u = {' + EXPORTS.join(',') + '};', sandbox,
    { filename: 'video-85319-a.js' });
  return { U: sandbox.__u, s: sandbox, calls: calls, state: state, film: film, song: song, aux: aux };
}

// ── the rate harness --------------------------------------------------------
function rateHarness(opts) {
  const o = opts || {};
  const calls = [];
  const state = Object.assign({
    open: true, rung: { h: 1080, label: 'FULL HD' }, manualH: 0,
    rateSteps: 0, rateNow: 3, rateBest: 0, slowH: {},
    rungs: [{ h: 2160, label: '4K' }, { h: 1080, label: 'FULL HD' }, { h: 720, label: 'HD' }]
  }, o.state || {});
  const land = o.land === undefined ? true : o.land;
  const sandbox = {
    console: console, Number: Number, Math: Math, String: String, Array: Array,
    Object: Object, JSON: JSON, Promise: Promise, isFinite: isFinite,
    scVideoState: state,
    scVideoFoot: function (t) { calls.push('foot:' + t); },
    scVideoRateText: function () { return '3 frames a second'; },
    scVideoRungFor: function (rungs, h) {
      calls.push('rungFor:' + h);
      let best = null;
      (rungs || []).forEach(function (r) { if (!best || Math.abs(r.h - h) < Math.abs(best.h - h)) best = r; });
      return best;
    },
    scVideoLive: function (rungs) { return rungs || []; },
    scVideoApplyRung: function (r) { calls.push('apply:' + r.h); state.rung = r; },
    scVideoLand: function () { calls.push('land'); return land; }
  };
  const UNIT = [constLine('SC_VQ_FLOOR'), constLine('SC_VQ_RATE_STEPS'), grab('scVideoSlow')].join('\n');
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UNIT + '\n;globalThis.__u = {scVideoSlow: scVideoSlow};', sandbox,
    { filename: 'video-85319-b.js' });
  return { U: sandbox.__u, calls: calls, state: state };
}

// ── the preference harness --------------------------------------------------
function prefHarness(init) {
  const data = Object.assign({}, init || {});
  const sandbox = {
    console: console, Number: Number, String: String, Object: Object, JSON: JSON,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    }
  };
  const UNIT = [
    constLine('SC_VQ_KEY'), constLine('SC_VQ_DEFAULT'), grab('scVideoPref'), grab('scVideoWant')
  ].join('\n');
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UNIT + '\n;globalThis.__u = {scVideoWant: scVideoWant, scVideoPref: scVideoPref};', sandbox,
    { filename: 'video-85319-c.js' });
  return { U: sandbox.__u, data: data };
}

function main() {
  // =========================================================================
  console.log('1. A tap on the film only opens the mini bar');
  {
    const h = harness({});
    h.U.scVideoPictureTap();
    ok('the bar is woken', h.calls.indexOf('idleWake') >= 0, h.calls.join(','));
    ok('and repainted where the finger is', h.calls.indexOf('bar') >= 0, h.calls.join(','));
    ok('a tap on the picture never reaches the play/pause door', h.calls.indexOf('TAP') === -1, h.calls.join(','));
    ok('and never reaches an outside transport press', h.calls.indexOf('TRANSPORT') === -1, h.calls.join(','));
    const src = grab('scVideoPictureTap');
    ok('the picture door calls no transport function at all',
      !/scVideoTap\s*\(/.test(src) && !/\.pause\s*\(/.test(src) && !/\.play\s*\(/.test(src), src.slice(0, 160));
    const build = page.slice(page.indexOf("v.addEventListener('playing'") - 700, page.indexOf("v.addEventListener('playing'"));
    ok('the film element answers its own click', /v\.addEventListener\('click'/.test(build), build.slice(0, 200));
    ok('and stops it before anything above can act on it',
      /addEventListener\('click', function\(e\)\{[^}]*stopPropagation/.test(page));
    ok('both the click and the stage lead to the picture door',
      /stopPropagation\(\);(\s|\n)*scVideoPictureTap\(\);/.test(page) && /scVideoPictureTap\(\);/.test(page));
  }

  // =========================================================================
  console.log('\n2. The music video is its own film, in every mode');
  {
    const h = harness({ state: { audioMode: 'song', filmAt: 84 } });
    h.U.scVideoAttach('u1', 'direct', false);
    ok('a size with no sound of its own also opens on the film\'s own second',
      h.state.startAt === 84, h.state.startAt);
    ok('and that second is remembered as seeded, for the length check', h.state.seeded === 84);
    ok('the picture is posed on its own second', h.film.currentTime === 84, h.film.currentTime);
    ok('the song is NOT rewound onto the picture', h.song.currentTime === 300, h.song.currentTime);
    ok('and it is not started or stopped by the attach', !/song:(play|pause)/.test(h.calls.join(',')), h.calls.join(','));
  }
  {
    const h = harness({ state: { audioMode: 'song', filmAt: 0 } });
    h.U.scVideoAttach('u1', 'direct', false);
    ok('a fresh film opens at its first frame, not at the song\'s 5:00',
      h.state.startAt === 0 && h.film.currentTime === 0, h.state.startAt + '/' + h.film.currentTime);
  }
  {
    const h = harness({ state: { audioMode: 'song', filmAt: 84, resumeAt: 120 } });
    h.U.scVideoAttach('u1', 'stream', true);
    ok('a size change still keeps the second the picture was on',
      h.state.startAt === 120 && h.state.seeded === null, h.state.startAt);
  }
  {
    // The song ended: the film it was playing under must not stop with it.
    const h = harness({ state: { audioMode: 'song', hold: false }, film: { paused: false, at: 200 },
      song: { paused: true, at: 240, duration: 240 } });
    h.U.scVideoSync(false);
    ok('a song that has reached its end does not pause the film', h.film.paused === false, h.calls.join(','));
    ok('and the picture is not seeked to the end of the song', h.film.currentTime === 200, h.film.currentTime);
  }
  {
    // Somebody paused the song in the middle of it: one sound, so the picture stops too.
    const h = harness({ state: { audioMode: 'song', hold: false }, film: { paused: false, at: 60 },
      song: { paused: true, at: 60, duration: 240 } });
    h.U.scVideoSync(false);
    ok('a song paused in the middle pauses the picture with it', h.film.paused === true);
    ok('and the picture is still not moved onto the song', h.film.currentTime === 60, h.film.currentTime);
  }
  {
    const h = harness({ state: { audioMode: 'song', hold: false }, film: { paused: true, at: 40 },
      song: { paused: false, at: 40, duration: 240 } });
    h.U.scVideoSync(false);
    ok('a film that was never paused still runs with the song', h.calls.indexOf('play') >= 0);
    ok('without being seeked onto it', h.calls.indexOf('pose:40') === -1, h.calls.join(','));
  }

  // =========================================================================
  console.log('\n3. The size you pick is the size you keep');
  {
    const h = rateHarness({ state: { rung: { h: 1080, label: 'FULL HD' }, manualH: 1080 } });
    ok('a size picked by hand is not given up by the rate', h.U.scVideoSlow() === false, h.calls.join(','));
    ok('and nothing is landed on or applied', h.calls.indexOf('land') === -1 && !h.calls.some(c => /^apply:/.test(c)));
    ok('and the footer is not rewritten about a size it is keeping', !h.calls.some(c => /^foot:/.test(c)));
  }
  {
    const h = rateHarness({ state: { rung: { h: 1080, label: 'FULL HD' }, manualH: 0 } });
    ok('at FULL HD the automatic step does not walk below the floor', h.U.scVideoSlow() === false, h.calls.join(','));
    ok('it lands nowhere and applies nothing', h.calls.indexOf('land') === -1 && !h.calls.some(c => /^apply:/.test(c)));
    ok('and it says the picture stays where it is, with the list as the way down',
      h.calls.some(c => /^foot:.*stays on FULL HD/.test(c)), h.calls.join(' | '));
  }
  {
    const h = rateHarness({ state: { rung: { h: 2160, label: '4K' }, manualH: 0 } });
    ok('above the floor a size that cannot keep up still steps back', h.U.scVideoSlow() === true, h.calls.join(','));
    ok('and it steps to FULL HD, not further', h.calls.some(c => c === 'apply:1080'), h.calls.join(','));
  }
  {
    const h = rateHarness({ state: { rung: { h: 2160, label: '4K' }, manualH: 0, rateSteps: 4 } });
    ok('a film that has spent its steps stops stepping', h.U.scVideoSlow() === false && h.calls.indexOf('land') === -1);
  }
  {
    const h = prefHarness({});
    ok('a viewer who has never chosen opens on FULL HD', h.U.scVideoWant() === 1080, h.U.scVideoWant());
    const auto = prefHarness({ scVideoQuality: 'auto' });
    ok('AUTO is still a choice, and is kept as one', auto.U.scVideoWant() === 0, auto.U.scVideoWant());
    const pick = prefHarness({ scVideoQuality: '720' });
    ok('and a chosen size is what the next film asks for', pick.U.scVideoWant() === 720, pick.U.scVideoWant());
    const choose = grab('scVideoQualityChoose');
    ok('a hand pick is recorded on the state', /scVideoState\.manualH = Number\(h\) \? Number\(r\.h\) : 0;/.test(choose), choose.slice(0, 300));
    ok('and AUTO hands the size back to the ladder', /manualH = Number\(h\) \? Number\(r\.h\) : 0;/.test(choose) && /: 0;/.test(choose));
    const load = grab('scVideoLoad');
    ok('a new film starts with no hand-picked size', /scVideoState\.manualH = 0;/.test(load));
    const watch = grab('scVideoWatch');
    ok('a picked size gets the normal window, not the reader\'s six-second leash',
      /if\(scVideoState\.suspect && !scVideoState\.manualH\)/.test(watch), watch.slice(0, 200));
  }

  // =========================================================================
  console.log('\n4. The upscaler sharpens a frame that is being stretched');
  {
    const paint = grab('scVideoFxPaint');
    ok('the drawn frame is compared with the source it came from',
      /var upscaled = \(dw > vw \* 1\.02\) \|\| \(dh > vh \* 1\.02\);/.test(paint), paint.slice(0, 160));
    ok('and the edge mask runs for an upscaled frame at any height',
      /var wantEdges = vh < SC_VFX_EDGE_H \|\| upscaled;/.test(paint), paint.slice(0, 160));
    const tune = grab('scVideoAiTune');
    ok('the AI recipe waits for a real frame instead of losing its one ask',
      /Number\(pv\.readyState\) < 2/.test(tune) && /scVideoAiSchedule\(\);/.test(tune), tune.slice(0, 240));
    ok('and gives up after a bounded number of asks', /scVideoState\.aiTries = \(Number\(scVideoState\.aiTries\) \|\| 0\) \+ 1;/.test(tune));
  }

  // =========================================================================
  console.log('\n5. The release itself');
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) {
      scripts++;
      try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
    }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
    // The version pin reads "this release or newer" through dev/version.cjs, because a version
// here is two numbers and a third that only runs 0-9 (85.3.9 -> 85.4), never 85.3.10.
const { atLeast } = require('./version.cjs');
const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
    // 85.3.20 kept every behaviour this gate proves, so the version pin reads "85.3.19 or
    // newer" now (the note is here because the assertion was changed after it shipped).
    ok('the page is on 85.3.19 or newer', atLeast(vPage, '85.3.19'), vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.3.19 entry', page.includes("version: '85.3.19'"));
    ok('the new entry is above 85.3.18',
      page.indexOf("version: '85.3.19'") < page.indexOf("version: '85.3.18'"));
    const entry = page.slice(page.indexOf("version: '85.3.19'"), page.indexOf("version: '85.3.18'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      entry.slice(0, 200));
    const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
    ok('the entry carries the five things it describes', items >= 5, items);
    ok('and names the film, the mini bar and the size list',
      /music video/i.test(entry) && /mini bar/i.test(entry) && /size/i.test(entry));
  }
}

main();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
