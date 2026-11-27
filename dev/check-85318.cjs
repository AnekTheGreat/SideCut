// 85.3.18 harness - the film's own second, and a pause that stays paused.
//
// The owner's report: "if you stop a mv, and exit it should resume automatically from the
// place you stopped if you enter the same mv again, also it should be the full friken
// length of the video not 1 minute when I pause the music video it should pause not resume
// automatically". Three symptoms, two causes:
//
//   * THE PICTURE WAS SEATED ON THE SONG'S CLOCK, IN EVERY MODE. `scVideoAttach` opened on
//     `scVideoSongTime()` whenever it had no other position, so a film entered three
//     minutes into a song opened three minutes into a film that may only be four - the
//     last minute of it, which is the report word for word - and nothing anywhere wrote
//     down where the film had got to, so a second visit started wherever the song was
//     instead of where the video was stopped.
//   * A PAUSED FILM COULD BE STARTED BY SOMETHING ELSE. `scVideoSync` exists to keep the
//     picture and its sound on one second, and two of its paths play the film - the song's
//     own clock where the song is the soundtrack, and the background hand-back. A pause
//     was therefore undone by whatever started the song underneath it.
//
// Nothing here is a copy of the shipped code: the functions are cut out of index.html by
// name and braces and run in a vm against a fake element, a fake song, a fake store and
// recorders. The promises the player returns are not part of this gate.
//
//   node dev/check-85318.cjs
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

const UNIT = [
  constLine('SC_VIDEO_POS_KEY'),
  constLine('SC_VIDEO_POS_MAX'),
  constLine('SC_VIDEO_POS_EVERY'),
  grab('scVideoPosKey'), grab('scVideoPosMap'), grab('scVideoPosRead'), grab('scVideoPosWrite'),
  grab('scVideoPosSave'), grab('scVideoPosClear'), grab('scVideoPosTick'),
  grab('scVideoAttach'), grab('scVideoTap'), grab('scVideoTransport'),
  grab('scVideoSync'), grab('scVideoParkSong'),
  // 85.7 added two verdicts the shipped scVideoSync/scVideoAttach now read: the sound
  // copy's own length and the look-past for a film that ran out. They are part of the
  // unit this harness drives; every assertion below is unchanged.
  grab('scVideoShortCheck'), grab('scVideoVoiceCut'), grab('scVideoWholeRung'),
  grab('scVideoCutNext'), grab('scVideoMMSS')
].join('\n');

const EXPORTS = ['scVideoPosKey', 'scVideoPosMap', 'scVideoPosRead', 'scVideoPosSave',
  'scVideoPosClear', 'scVideoPosTick', 'scVideoAttach', 'scVideoTap', 'scVideoTransport',
  'scVideoSync', 'scVideoParkSong'];

function store(init) {
  const data = Object.assign({}, init || {});
  return {
    data: data,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
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

// The shipped functions, a fake picture, a fake song, a fake voice track and a fake store.
function harness(opts) {
  const o = opts || {};
  const calls = [];
  const state = Object.assign({
    open: true, audioMode: 'aux', songKey: 'q:t1', videoId: 'vid1',
    last: { key: 'q:t1', title: 'One' }, filmAt: 0, seeded: null, posSaved: 0,
    hold: false, resumeAt: null, startAt: null, wasPlaying: true, blocked: false,
    scrubbing: false, bg: null, songWasPlaying: false, auxAudio: null
  }, o.state || {});
  const film = media(o.film);
  const song = media(Object.assign({ src: 'song', at: 300 }, o.song));
  const aux = media(Object.assign({ src: 'voice' }, o.aux));
  const dataStore = o.store || store();
  const sandbox = {
    console: console, Number: Number, Math: Math, String: String, Array: Array,
    Object: Object, JSON: JSON, Promise: Promise, isFinite: isFinite, Date: Date,
    RegExp: RegExp, localStorage: dataStore, scVideoState: state,
    film: film, song: song, aux: aux,
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
    scVideoAuxAlign: function () { calls.push('auxAlign'); },
    scVideoOwnSound: function (on) { calls.push('owns:' + !!on); },
    scVideoMuteOthers: function () { calls.push('mute'); },
    scVideoPose: function (el, at) { calls.push('pose:' + at); if (el) el.currentTime = Number(at) || 0; },
    scVideoPoseTry: function () { return true; },
    scVideoPosed: function () { return true; },
    scVideoPlayAttempt: function () { calls.push('play'); film.paused = false; },
    scVideoBig: function (on) { calls.push('big:' + !!on); },
    scVideoSpin: function (on) { calls.push('spin:' + !!on); },
    scVideoSay: function (t) { calls.push('say:' + t); },
    scVideoWatch: function () { calls.push('watch'); },
    scVideoWatchStop: function () { calls.push('watchStop'); },
    scVideoGraphSync: function () {},
    scVideoBarState: function () { calls.push('bar'); },
    scVideoClock: function () { calls.push('clock'); },
    scVideoIdleWake: function () { calls.push('idleWake'); },
    scVideoFollow: function () { calls.push('follow'); return false; },
    scVideoPerfSample: function () { calls.push('perf'); },
    scVideoStart: function () { calls.push('start'); },
    scVideoQualityMark: function () {},
    scVideoVoiceReset: function () {},
    scVideoAiSchedule: function () {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UNIT + '\n;globalThis.__u = {' + EXPORTS.join(',') + '};', sandbox,
    { filename: 'video-85318.js' });
  return { U: sandbox.__u, s: sandbox, calls: calls, state: state, film: film, song: song, aux: aux, store: dataStore };
}

function saved(h, key) {
  const m = h.U.scVideoPosMap();
  return m[key || h.state.songKey];
}

async function main() {
  // ===========================================================================
  console.log('1. The film remembers its own second');
  {
    const h = harness({});
    ok('nothing is remembered before anything is stopped', h.U.scVideoPosRead() === 0);
    ok('the second a film is stopped on is written down for that song',
      h.U.scVideoPosSave(84.5) === true && h.U.scVideoPosRead() === 84.5,
      JSON.stringify(h.store.data));
    ok('the record is the time it was written', !!saved(h) && saved(h).at === 84.5 && saved(h).ts > 0);
    ok('the write is remembered on the state, for the tick to pace itself',
      h.state.posSaved === saved(h).ts);
    ok('another song does not read it',
      (function () { h.state.songKey = 'q:t2'; const v = h.U.scVideoPosRead(); h.state.songKey = 'q:t1'; return v === 0; })());
    ok('a film stopped at the top clears the record instead',
      h.U.scVideoPosSave(0) === true && h.U.scVideoPosRead() === 0 && !saved(h));
    ok('clearing a song with no record is not an error',
      h.U.scVideoPosClear() === false);
  }
  {
    const h = harness({ state: { songKey: '' } });
    h.state.last = { key: 'q:fromlast' };
    ok('with no song key the track the tab was opened on is the key', h.U.scVideoPosKey() === 'q:fromlast');
    h.state.last = null; h.state.videoId = 'abc';
    ok('and with neither, the film itself is', h.U.scVideoPosKey() === 'v:abc');
    h.state.videoId = '';
    ok('no song and no film is no key at all', h.U.scVideoPosKey() === '');
  }
  {
    const h = harness({});
    for (let i = 0; i < 70; i++) { h.state.songKey = 'q:s' + i; h.U.scVideoPosSave(30 + i); }
    const m = h.U.scVideoPosMap();
    ok('the store is capped, so it cannot grow for ever', Object.keys(m).length === 60,
      Object.keys(m).length);
    ok('and it is the OLDEST entries that go', !m['q:s0'] && !!m['q:s69']);
  }
  {
    const h = harness({});
    h.state.posSaved = 0;
    h.film.paused = true;
    ok('a paused film is not written down by the tick', h.U.scVideoPosTick() === false && !saved(h));
    h.film.paused = false; h.film.currentTime = 61.5;
    ok('a playing film is', h.U.scVideoPosTick() === true && saved(h).at === 61.5);
    h.film.currentTime = 62.5;
    ok('and not twice inside five seconds', h.U.scVideoPosTick() === false && saved(h).at === 61.5);
    h.state.posSaved = Date.now() - 6000;
    ok('but it is after five seconds', h.U.scVideoPosTick() === true && saved(h).at === 62.5);
    h.state.hold = true;
    h.state.posSaved = 0; h.film.currentTime = 90;
    ok('a film the owner paused is not written down by the tick either',
      h.U.scVideoPosTick() === false && saved(h).at === 62.5);
  }
  {
    const bad = store({ sidecut_videoPos: '{not json' });
    const h = harness({ store: bad });
    ok('a corrupt store reads as no positions', h.U.scVideoPosRead() === 0);
    ok('and is replaced by a real record on the next write',
      h.U.scVideoPosSave(12) === true && h.U.scVideoPosRead() === 12);
    const broken = { getItem: function () { throw new Error('no'); }, setItem: function () { throw new Error('no'); } };
    const h2 = harness({ store: broken });
    ok('a store that refuses does not throw', h2.U.scVideoPosRead() === 0 && h2.U.scVideoPosSave(9) === false);
  }

  // ===========================================================================
  console.log('\n2. The film opens on its own second, not the song\'s');
  {
    const h = harness({ state: { audioMode: 'aux', filmAt: 0 } });
    h.U.scVideoAttach('u1', 'direct', false);
    ok('a film with no remembered second opens at its first frame, not at the song\'s 5:00',
      h.state.startAt === 0, h.state.startAt);
    ok('and is not a seeded second', h.state.seeded === null);
    ok('the song underneath is not the clock it was posed on', h.calls.indexOf('pose:300') === -1);
  }
  {
    const h = harness({ state: { audioMode: 'aux', filmAt: 84 } });
    h.U.scVideoAttach('u1', 'direct', false);
    ok('a remembered second is where the picture opens', h.state.startAt === 84, h.state.startAt);
    ok('and it is remembered as seeded, for the length check', h.state.seeded === 84);
  }
  {
    const h = harness({ state: { audioMode: 'video', filmAt: 42 } });
    h.U.scVideoAttach('u1', 'direct', false);
    ok('a size that carries its own sound does the same', h.state.startAt === 42);
  }
  {
    // 85.3.19 changed this contract on purpose: the film is its own film in every mode, so a
    // size with no sound of its own opens on the film's second too instead of the song's. The
    // assertions here are rewritten to that contract; 85.3.19's own gate proves it.
    const h = harness({ state: { audioMode: 'song', filmAt: 84 } });
    h.U.scVideoAttach('u1', 'direct', false);
    ok('85.3.19: where the SONG is the soundtrack the picture opens on the film\'s own second',
      h.state.startAt === 84, h.state.startAt);
    ok('and that second is seeded for the length check', h.state.seeded === 84);
  }
  {
    const h = harness({ state: { audioMode: 'aux', filmAt: 84, resumeAt: 120 } });
    h.U.scVideoAttach('u1', 'stream', true);
    ok('a size change keeps the second the picture was on, not the remembered one',
      h.state.startAt === 120 && h.state.seeded === null, h.state.startAt);
    ok('and the resume is used once', h.state.resumeAt === null);
  }

  // ===========================================================================
  console.log('\n3. A pause is a pause');
  {
    const h = harness({ film: { paused: false, at: 37 } });
    h.state.audioMode = 'song';
    h.U.scVideoTap();
    ok('the round button pauses the picture', h.film.paused === true);
    ok('and latches the pause', h.state.hold === true);
    ok('and writes the second down', saved(h) && saved(h).at === 37, JSON.stringify(saved(h)));
    ok('and silences the song it was riding on', h.calls.indexOf('song:pause') >= 0);
  }
  {
    // A pause at the very top of a film must not throw away the second it was left on.
    const h = harness({ film: { paused: false, at: 0.2 } });
    h.U.scVideoPosSave(84);
    h.U.scVideoTap();
    ok('a pause before the picture has played keeps the remembered second',
      h.U.scVideoPosRead() === 84, h.U.scVideoPosRead());
  }
  {
    const h = harness({ film: { paused: true, at: 37 } });
    h.state.hold = true;
    h.U.scVideoTap();
    ok('the round button plays a paused picture', h.film.paused === false && h.calls.indexOf('play') >= 0);
    ok('and lets go of the pause latch', h.state.hold === false);
  }
  {
    const h = harness({ film: { paused: false, at: 51 } });
    h.U.scVideoTransport('pause');
    ok('a press from outside pauses and latches too',
      h.film.paused === true && h.state.hold === true && saved(h).at === 51);
    h.U.scVideoTransport('play');
    ok('and a play press lets go of it', h.state.hold === false && h.film.paused === false);
  }
  {
    // The song is playing and the picture was paused: the tick may not start it again.
    const h = harness({ film: { paused: true, at: 40 }, state: { hold: true, audioMode: 'song' }, song: { paused: false, at: 40 } });
    h.U.scVideoSync(false);
    ok('the tick does not start a paused film', h.calls.indexOf('play') === -1, h.calls.join(','));
    ok('and quiets the song that would have dragged it forward',
      h.song.paused === true && h.calls.indexOf('song:pause') >= 0);
    ok('and leaves the voice track paused', h.aux.paused === true);
    ok('and still paints the clock', h.calls.indexOf('clock') >= 0);
    ok('and does not measure a rate for a still', h.calls.indexOf('perf') === -1);
  }
  {
    // Without the latch the old contract stands: a song that is playing is a film that runs.
    const h = harness({ film: { paused: true, at: 40 }, state: { hold: false, audioMode: 'song' }, song: { paused: false, at: 40 } });
    h.U.scVideoSync(false);
    ok('a film that was never paused still follows the song', h.calls.indexOf('play') >= 0);
  }
  {
    const h = harness({ film: { paused: false, at: 40 }, state: { hold: false, audioMode: 'aux' } });
    h.U.scVideoSync(false);
    ok('a running film still has its second written down while it plays',
      saved(h) && saved(h).at === 40, JSON.stringify(saved(h)));
  }

  // ===========================================================================
  console.log('\n4. Leaving the tab, and the song it was holding');
  {
    const h = harness({ state: { songWasPlaying: true, audioMode: 'aux' }, song: { at: 210 } });
    h.U.scVideoParkSong(30, true);
    ok('where the film had its own sound the song is left on its own second', h.song.currentTime === 210);
    ok('and is stopped', h.song.paused === true);
  }
  {
    const h = harness({ state: { songWasPlaying: true, audioMode: 'song' }, song: { at: 210 } });
    h.U.scVideoParkSong(30);
    ok('where the song was the soundtrack it is seated on the picture\'s second', h.song.currentTime === 30);
  }
  {
    const close = grab('scVideoClose');
    const atSave = close.indexOf('scVideoPosSave(stopAt)');
    const atOpen = close.indexOf('scVideoState.open = false');
    ok('the tab writes the second down before it clears anything',
      atSave >= 0 && atOpen > atSave, atSave + '/' + atOpen);
    ok('and a tab with nothing in it is not a request to forget it',
      /if\(stopAt > 0\.5\) scVideoPosSave\(stopAt\);/.test(close), close.slice(0, 80));
    // 85.3.19: the song is parked where it is whatever was the sound, because the picture is
    // its own film now in every mode. Rewritten to the contract this release shipped.
    ok('and parks the song without moving it',
      /scVideoParkSong\(stopAt, true\)/.test(close));
  }
  {
    const load = grab('scVideoLoad');
    ok('a load starts from this song\'s remembered second',
      /scVideoState\.filmAt = scVideoPosRead\(\);/.test(load));
    ok('and entering the tab is a request to play, so the latch starts clear',
      /scVideoState\.hold = false;/.test(load) && /scVideoState\.posSaved = 0;/.test(load));
    ok('a new film forgets the seeded second it did not use', !/scVideoState\.seeded = [^n]/.test(load));
  }

  // ===========================================================================
  console.log('\n5. The hand-back and the end of the film');
  {
    const bgIn = grab('scVideoBackgroundIn');
    const holdAt = bgIn.indexOf('if(scVideoState.hold){');
    const playAt = bgIn.indexOf('scVideoPlayAttempt();');
    ok('coming back to the app does not play a film that was paused',
      holdAt >= 0 && playAt > holdAt, holdAt + '/' + playAt);
  }
  {
    const build = page.slice(page.indexOf("v.addEventListener('ended'"), page.indexOf("v.addEventListener('error', scVideoFailed);"));
    ok('a finished film latches itself and forgets its second',
      /scVideoState\.hold = true;/.test(build) && /scVideoPosClear\(\);/.test(build), build.slice(0, 120));
  }
  {
    const meta = page.slice(page.indexOf("scVideoState.startAt != null){ scVideoPose(v, scVideoState.startAt)"), page.indexOf("v.addEventListener('ended'"));
    ok('a remembered second past the end of a shorter upload is refused',
      /seededAt > \(v\.duration - 1\.5\)/.test(meta) && /scVideoPose\(v, 0\);/.test(meta));
  }

  // ===========================================================================
  console.log('\n6. The release itself');
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) {
      scripts++;
      try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
    }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
    const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
    // 85.3.19 kept every behaviour this gate proves, so the version assertion is "85.3.18 or
    // newer" rather than an exact string (the convention this file’s neighbours already use).
    const vNum = String(vPage || '').split('.').map(Number);
    const vFresh = vNum[0] > 85 || (vNum[0] === 85 && (vNum[1] > 3 || (vNum[1] === 3 && vNum[2] >= 18)));
    ok('the page is 85.3.18 or newer', vFresh, vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.3.18 entry', page.includes("version: '85.3.18'"));
    ok('the new entry is above 85.3.17',
      page.indexOf("version: '85.3.18'") < page.indexOf("version: '85.3.17'"));
    const entry = page.slice(page.indexOf("version: '85.3.18'"), page.indexOf("version: '85.3.17'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      entry.slice(0, 160));
    ok('the new entry carries the three lines it describes', (entry.match(/: '/g) || []).length >= 3);
    ok('and names the film', /music video/i.test(entry));
  }
}

main().then(function () {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
}, function (e) {
  console.error(e && e.stack || e);
  process.exitCode = 1;
});
