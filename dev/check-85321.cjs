// 85.3.21 harness - a minute of the song is not the song.
//
// The owner's report: "why does the lyrics keep stopping at one minute again. for the
// 12th time it should be the full 2,3,4 minutes long however long the video is", with
// two screenshots of the film's own bar reading 0:48 / 0:57 - a 57-second clip under a
// three-minute song.
//
// One fault with three faces:
//
//   * THE FILM WAS A CLIP. `scVideoLoad` compared the film's length with the song's only
//     for a catalogue hand-over (`cand.own`), and when the search came back with nothing
//     better it played the short film anyway.
//   * THE FILM TOOK THE SOUND. A film that carries its own audio pauses the song under it
//     (one sound at a time), so at the clip's last second nothing was sounding at all.
//   * THE SHEET FOLLOWED THE CLIP. The lyrics clock is the film while the film is what is
//     sounding (85.3.6), so the highlight stopped at 0:57 and never reached the last verse.
//
// The shipped functions are cut out of index.html by name and braces and run in a vm
// against fakes; the load branch is asserted where it sits.
//
//   node dev/check-85321.cjs
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
function count(src, needle) {
  let n = 0, at = 0;
  for (;;) { const i = src.indexOf(needle, at); if (i < 0) return n; n++; at = i + needle.length; }
}
function line(needle) {
  const i = page.indexOf(needle);
  if (i < 0) throw new Error('missing line ' + needle);
  return page.slice(i, page.indexOf('\n', i));
}

(async function main() {

  // =======================================================================
  console.log('1. The lyrics sheet will not be clocked by a clip');
  {
    const src = [
      line('var SC_LYRIC_FILM_SHARE'),
      grab('scLyricSongLen'),
      grab('scLyricsClock')
    ].join('\n');

    const clock = (o) => {
      const song = o.song || null;
      const sandbox = {
        scLyricSong: function () { return song; },
        activeAudio: function () { return o.audio || { paused: true, duration: 0, currentTime: 0 }; },
        console
      };
      if (o.stream) sandbox.scStreamSong = function () { return o.stream; };
      sandbox.window = {
        __scVideoClock: function () {
          return o.film ? { time: o.film.time, dur: o.film.dur } : null;
        }
      };
      vm.createContext(sandbox);
      vm.runInContext(src + '\nthis.__clock = scLyricsClock; this.__len = scLyricSongLen;', sandbox);
      return { clock: sandbox.__clock(), len: sandbox.__len() };
    };

    const song = { id: 't1', duration: 180 };
    const playing = { paused: false, duration: 180, currentTime: 42 };

    // THE REPORT: a 0:57 clip under a 3:00 song. The film used to own the sheet's clock,
    // which is why every verse after the first minute was never lit.
    let r = clock({ song: song, film: { time: 40, dur: 57 }, audio: playing });
    ok('a 0:57 clip does not clock a 3:00 song - the song does',
      r.clock && r.clock.video === false && r.clock.time === 42, JSON.stringify(r.clock));
    ok('the song length is read off the row on the sheet', r.len === 180, r.len);

    // A film of this song's own length is still the clock, exactly as it was.
    r = clock({ song: song, film: { time: 40, dur: 181 }, audio: playing });
    ok('a film of the song\'s own length still clocks the sheet',
      r.clock && r.clock.video === true && r.clock.time === 40, JSON.stringify(r.clock));

    // Half the song is the line (SC_LYRIC_FILM_SHARE): at the line it is still a film.
    r = clock({ song: song, film: { time: 40, dur: 90 }, audio: playing });
    ok('exactly half the song is not called a clip',
      r.clock && r.clock.video === true, JSON.stringify(r.clock));

    // A film whose length the player never reported cannot be judged, so it stands.
    r = clock({ song: song, film: { time: 12, dur: 0 }, audio: playing });
    ok('a film with no length of its own is still followed',
      r.clock && r.clock.video === true && r.clock.time === 12, JSON.stringify(r.clock));

    // A song whose own length is unknown cannot be judged either: nothing is taken away.
    r = clock({ song: { id: 't2' }, film: { time: 12, dur: 57 },
                audio: { paused: false, duration: 0, currentTime: 12 } });
    ok('an unknown song length takes nothing away from the film',
      r.len === 0 && r.clock && r.clock.video === true, JSON.stringify(r));

    // ...but a length the element does know is a length, even with no row carrying one.
    r = clock({ song: { id: 't2' }, film: { time: 12, dur: 57 }, audio: playing });
    ok('a row with no length still gets the playing element\'s own',
      r.len === 180 && r.clock && r.clock.video === false, JSON.stringify(r));

    // A song from the source carries its length on the source's own record.
    r = clock({ song: { id: 'scstream:1' }, stream: { duration: 200 },
                film: { time: 30, dur: 57 }, audio: playing });
    ok('a source song\'s length is read from the source\'s record',
      r.len === 200 && r.clock && r.clock.video === false, JSON.stringify(r));

    // And from the element when no row carries one.
    r = clock({ song: null, film: { time: 30, dur: 57 },
                audio: { paused: false, duration: 210, currentTime: 5 } });
    ok('with no row at all the playing element\'s length is the song\'s',
      r.len === 210 && r.clock && r.clock.video === false, JSON.stringify(r));

    // Nothing is playing and no film: no clock, exactly as before.
    r = clock({ song: song, film: null, audio: { paused: true, duration: 180, currentTime: 100 } });
    ok('a stopped song is still no clock', r.clock === null, JSON.stringify(r.clock));

    ok('one share constant, declared once',
      count(page, 'var SC_LYRIC_FILM_SHARE') === 1, count(page, 'var SC_LYRIC_FILM_SHARE'));
    const sheetClock = grab('scLyricsClock');
    ok('the sheet\'s clock asks the song its length before it trusts a film',
      sheetClock.indexOf('scLyricSongLen()') > 0 &&
      sheetClock.indexOf('scLyricSongLen()') < sheetClock.indexOf('SC_LYRIC_FILM_SHARE'));
    ok('and refuses a film under the share',
      /_filmLen >= _songLen \* SC_LYRIC_FILM_SHARE/.test(sheetClock));
  }

  // =======================================================================
  console.log('\n2. A clip that ran out hands the sound back to the song');
  {
    const src = [
      line('var SC_VQ_FULL_SHARE'),
      grab('scVideoSync'),
      // 85.7 added two verdicts the shipped scVideoSync/scVideoAttach now read: the sound
      // copy's own length and the look-past for a film that ran out. They are part of the
      // unit this harness drives; every assertion below is unchanged.
      grab('scVideoShortCheck'), grab('scVideoVoiceCut'), grab('scVideoWholeRung'),
      grab('scVideoCutNext'), grab('scVideoMMSS')
    ].join('\n');

    const sync = (o) => {
      const calls = { own: [], song: [], foot: '' };
      const v = {
        src: 'blob:film', paused: o.paused !== undefined ? o.paused : true,
        ended: !!o.ended, currentTime: o.at || 0, duration: o.dur || 0,
        readyState: 2, error: null
      };
      const state = {
        bg: null, open: true, busy: false, scrubbing: false, hold: !!o.hold,
        owns: o.owns !== false, audioMode: o.mode || 'video', audio: null,
        blocked: false, songWasPlaying: false, filmPlaying: 0, rung: null,
        perf: null, posSaved: 0
      };
      const sandbox = {
        scVideoState: state,
        scVideoEl: function (id) { return id === 'scVideoEl' ? v : null; },
        scVideoFollow: function () { return false; },
        scVideoAuxPause: function () {},
        scVideoClock: function () {},
        scVideoFoot: function (t) { calls.foot = t; },
        scVideoOwnSound: function (on) { calls.own.push(!!on); state.owns = !!on; },
        scVideoSong: function (on) { calls.song.push(!!on); },
        scVideoSongLen: function () { return o.songLen || 0; },
        scVideoMMSS: function (n) { n = Math.max(0, Math.floor(Number(n) || 0)); return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); },
        scVideoPerfSample: function () {},
        scVideoPosTick: function () {},
        scVideoAudioEl: function () { return o.audio || null; },
        scVideoAuxEl: function () { return null; },
        scVideoMuteOthers: function () {},
        scVideoAuxPlay: function () {},
        scVideoPosed: function () { return true; },
        scVideoPlayAttempt: function () {},
        console: console
      };
      vm.createContext(sandbox);
      vm.runInContext(src + '\nthis.__sync = scVideoSync;', sandbox);
      sandbox.__sync(false);
      return { calls: calls, state: state };
    };

    // THE REPORT: a 57 s clip of a 180 s song reaches its end while it owns the sound.
    let r = sync({ ended: true, dur: 57, songLen: 180, at: 57, mode: 'video' });
    ok('the film gives the sound back', r.calls.own.length === 1 && r.calls.own[0] === false,
      JSON.stringify(r.calls.own));
    ok('...the song becomes the sound', r.state.audioMode === 'song', r.state.audioMode);
    ok('...and is started again', r.calls.song.length === 1 && r.calls.song[0] === true,
      JSON.stringify(r.calls.song));
    ok('...nothing is held', r.state.hold === false);
    ok('and the footer says what happened', /0:57 clip/.test(r.calls.foot) && /carries on/.test(r.calls.foot),
      r.calls.foot);

    // The bar reading the last second without `ended` is the same thing.
    r = sync({ paused: true, dur: 57, songLen: 180, at: 56.9, mode: 'aux' });
    ok('a paired-track clip at its last second hands back too',
      r.state.audioMode === 'song' && r.calls.song[0] === true, JSON.stringify(r.calls));

    // A film of the song's own length is not a clip: nothing is taken from it.
    r = sync({ ended: true, dur: 180, songLen: 180, at: 180, mode: 'video' });
    ok('a full-length film that ends is left alone',
      r.calls.own.length === 0 && r.state.audioMode === 'video', JSON.stringify(r.calls));
    ok('...and nothing is started under it', r.calls.song.length === 0, JSON.stringify(r.calls));

    // A paused clip is the owner's pause, not the end of the film.
    r = sync({ paused: true, dur: 57, songLen: 180, at: 21, mode: 'video' });
    ok('a clip paused in the middle is not the end of it',
      r.calls.own.length === 0 && r.state.audioMode === 'video', JSON.stringify(r.calls));

    // A held film is the owner's pause as well (85.3.18).
    r = sync({ ended: true, dur: 57, songLen: 180, at: 57, hold: true, mode: 'video' });
    ok('a held film is never answered with the song',
      r.calls.song.length === 0, JSON.stringify(r.calls));

    // Where the song is already the sound there is nothing to hand back.
    r = sync({ ended: true, dur: 57, songLen: 180, at: 57, mode: 'song', owns: false });
    ok('a film that never owned the sound hands nothing back',
      r.calls.own.length === 0 && r.state.audioMode === 'song', JSON.stringify(r.calls));

    // The net reads the share line, not a number of its own.
    const syncSrc = grab('scVideoSync');
    ok('the hand-back is drawn at the same share line the load uses',
      /_clipLen < _songLen \* SC_VQ_FULL_SHARE/.test(syncSrc));
  }

  // =======================================================================
  console.log('\n3. A short film is never attached as the video');
  {
    const loadSrc = grab('scVideoLoad');
    const at = loadSrc.indexOf('var songLen = scVideoSongLen();');
    const branch = loadSrc.slice(at, loadSrc.indexOf("' - looking for the right one.'", at));
    ok('the load measures the film against the song', branch.length > 200, branch.length);
    ok('a film under the share is called a clip', /var shortFilm = .*SC_VQ_FULL_SHARE/.test(branch),
      branch.split('\n').filter(function (l) { return l.indexOf('shortFilm') >= 0; }).join(' | '));
    ok('the catalogue check keeps its own line', /var far = !!\(cand\.own &&/.test(branch));
    ok('the clip is decided before the catalogue comparison',
      branch.indexOf('if(shortFilm){') < branch.indexOf('} else if(!far || scVideoState.wrongTried){'),
      [branch.indexOf('if(shortFilm){'), branch.indexOf('} else if(!far')].join(','));
    ok('it gets one search per song', /if\(scVideoState\.clipTried\) return noFullFilm\(\);/.test(branch) &&
      /scVideoState\.clipTried = 1;/.test(branch));
    ok('and no full film means the cover and the song, not the clip',
      /scVideoNoVideo\(/.test(branch) && /scVideoSong\(true\)/.test(grab('scVideoNoVideo')));
    const empty = loadSrc.slice(loadSrc.indexOf('if(!list || !list.length){'));
    ok('a search with nothing better does not fall back to the clip',
      empty.indexOf('if(shortFilm) return noFullFilm();') > 0 &&
      empty.indexOf('if(shortFilm) return noFullFilm();') < empty.indexOf('return apply();'),
      empty.slice(0, 260));
    ok('the latch is declared on the tab\'s state', count(page, 'clipTried: 0,') === 1,
      count(page, 'clipTried: 0,'));
    ok('and cleared for each song', count(page, 'scVideoState.clipTried = 0;') === 1,
      count(page, 'scVideoState.clipTried = 0;'));
    const start = grab('scVideoStart');
    ok('a new song is a new look for a full film', start.indexOf('scVideoState.clipTried = 0;') > 0);
  }

  // =======================================================================
  console.log('\n4. The release itself');
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) {
      scripts++;
      try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
    }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
    const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
    // The work this gate proves was built under the label 85.3.21 and ships in 85.4 - the
    // version after 85.3.9, because a segment after the second only ever runs 0-9 (see the
    // numbering rule at the top of AGENTS.md). So the pin reads "85.4 or newer".
    const vNum = (s) => String(s || '').split('.').map(Number);
    const atLeast = (v, w) => {
      const a = vNum(v), b = vNum(w);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0, y = b[i] || 0;
        if (x !== y) return x > y;
      }
      return true;
    };
    ok('the page is on 85.4 or newer', atLeast(vPage, '85.4'), vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.4 entry', page.includes("version: '85.4'"));
    ok('the new entry is above 85.3.19',
      page.indexOf("version: '85.4'") < page.indexOf("version: '85.3.19'"));
    const entry = page.slice(page.indexOf("version: '85.4'"), page.indexOf("version: '85.3.19'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      entry.slice(0, 240));
    const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
    ok('the entry carries the things it describes', items >= 4, items);
    ok('and names the clip, the minute and the lyrics',
      /clip/i.test(entry) && /minute/i.test(entry) && /lyrics|verse/i.test(entry));
  }
})().catch(function (e) { console.error(e); process.exitCode = 1; }).then(function () {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
});
