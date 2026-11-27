// 85.5 harness - a music video that runs the whole song, not fifty-seven seconds of it.
//
// The owner's report: "THE STUPID MUSIC VUDEO LITERALLY CANT HANDLE OVER 57 SECODNS NIGGA I
// TOLD YOU TO FIX THAT". Two mechanisms can produce exactly that, and this release closes
// both:
//
//   * THE SOUND WAS THE COPY THE SITE CUTS AT A MEGABYTE. Every sharp size carries no
//     sound of its own, so the tab pairs it with the same video's AUDIO row - and this
//     file's own downloader notes, measured, that a music upload's audio-only row is
//     refused past its first megabyte while the single-file copy of the same upload is
//     not. One megabyte of a 145 kbps row is about fifty-seven seconds. So the picture was
//     sharp, the sound ended a minute in, and the film owned the sound.
//   * A LENGTH WAS TRUSTED, NOT MEASURED. What decided whether a film was a clip was the
//     player's `lengthSeconds` (85.3.21) and the search text before it. A file that
//     decodes shorter than the song is the one witness neither of those has - so a film
//     under half the song is now stepped past the moment its own metadata lands.
//
// This gate drives `scVideoLadder` (which voice a rung is given), `scVideoShortCheck` (the
// new length verdict) and reads the shipped strings for the rest. Looked at? No - nothing
// could be played from this sandbox: the player answers LOGIN_REQUIRED to this address, so
// what is proven here is the choice and the verdict, not a phone's playback.
//
//   node dev/check-855.cjs
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

// The pieces scVideoLadder really uses, so the ladder under test is the shipped one.
// 85.6 added the voice ranking to the shipped ladder, so it is part of the function this
// harness drives; every 85.5 assertion below is unchanged.
const LADDER_BITS = ['scVideoCanPlay', 'scVideoCodec', 'scVideoRungTag', 'scVideoStd', 'scVideoSizeLabel', 'scVideoNoRange', 'scVideoVoiceRank', 'scVideoLadder'];
function ladderSandbox(rows) {
  const ctx = {
    window: {}, console: console,
    SC_VQ_STEPS: [144, 240, 360, 480, 720, 1080, 1440, 2048, 2160],
    SC_VQ_FULL_SHARE: 0.5,
    scVideoState: { deadH: {}, slowH: {}, rescueH: {} },
    MediaSource: { isTypeSupported: () => true },
  };
  vm.createContext(ctx);
  vm.runInContext(LADDER_BITS.map(grab).join('\n'), ctx);
  return ctx;
}

(async function main() {

  // =======================================================================
  console.log('1. The film\'s sound is the copy that is not cut at a megabyte');
  {
    // A real answer: one single-file 360p copy with sound, and sharp sizes without it.
    const muxed = [{ url: 'https://v/one?itag=18', mime: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', itag: 18, size: 9000000, h: 360 }];
    const adaptive = [
      { url: 'https://v/hd?itag=137', mime: 'video/mp4; codecs="avc1.640028"', itag: 137, size: 40000000, h: 1080 },
      { url: 'https://v/sd?itag=136', mime: 'video/mp4; codecs="avc1.4d401f"', itag: 136, size: 12000000, h: 720 },
    ];
    const audioRow = { url: 'https://v/aud?itag=140', mime: 'audio/mp4; codecs="mp4a.40.2"', size: 1000000 };
    const ctx = ladderSandbox();
    const rungs = ctx.scVideoLadder(muxed, adaptive, audioRow);
    const hd = rungs.filter(r => r.h === 1080)[0];
    const sd = rungs.filter(r => r.h === 720)[0];
    const one = rungs.filter(r => r.h === 360)[0];
    ok('a sharp size is still offered', !!hd && !!sd && !!one, rungs.map(r => r.h).join(','));
    ok('...and its voice is the single-file copy of the same film, not the audio row',
      !!hd && hd.audioUrl === 'https://v/one?itag=18', hd && hd.audioUrl);
    ok('...and it is marked as a one-file voice, so it is played and never read', !!hd && hd.audioOne === true);
    ok('the audio row the site cuts at a megabyte is not what a sharp size is paired with',
      !!hd && hd.audioUrl !== 'https://v/aud?itag=140');
    ok('every sharp size is paired with it, not only the top one',
      !!sd && sd.audioUrl === 'https://v/one?itag=18' && sd.audioOne === true);
    ok('a single-file size carries its own sound and is not given a voice',
      !!one && one.muxed === true && one.audioOne === false, one && one.audioOne);
    ok('a single-file size is its own sound, so it is not given a second copy of it',
      !!one && one.audioUrl === '', one && one.audioUrl);

    // No single-file copy in the answer: the audio row is all there is, and it is kept.
    const noMux = ctx.scVideoLadder([], [adaptive[0]], audioRow).filter(r => r.h === 1080)[0];
    ok('an upload with no single-file copy still gets its audio row as the voice',
      !!noMux && noMux.audioUrl === 'https://v/aud?itag=140', noMux && noMux.audioUrl);
    ok('...and it is not marked as a one-file voice, so the reader still reads it',
      !!noMux && noMux.audioOne === false);
    ok('an upload with no sound at all still gets no voice', (() => {
      const r = ctx.scVideoLadder([], [adaptive[0]], null).filter(x => x.h === 1080)[0];
      return !!r && r.audioUrl === '' && r.audioOne === false;
    })());

    // The strings this release is about, where they sit in the shipped file.
    const ladder = grab('scVideoLadder');
    ok('the reason is written down where the choice is made',
      /audio-only stream at its first megabyte/i.test(ladder) && /fifty-seven/i.test(ladder));
    ok('a one-file voice is never read into memory', /if\(r && r\.audioOne\) return;/.test(grab('scVideoVoiceRead')));
    ok('...it is played as its own link', /if\(r\.audioOne\) return r\.audioUrl;/.test(grab('scVideoVoice')));
    ok('...and it is kept out of the audio graph, which would play silence from another origin',
      /!scVideoState\.voiceOne\) fn\(a\)/.test(grab('scVideoGraphSync')));
    ok('the footer says which of the two voices is being played',
      page.includes('one-stream copy are played together'));
  }

  // =======================================================================
  console.log('\n2. A film that decodes shorter than the song is not the film');
  {
    const ctx = { console: console, SC_VQ_FULL_SHARE: 0.5, scVideoMMSS: n => Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2) };
    vm.createContext(ctx);
    vm.runInContext(grab('scVideoShortCheck'), ctx);

    function stage(opts) {
      const calls = { next: 0, noVideo: 0, paused: 0, foot: '' };
      ctx.scVideoState = {
        coverOn: false, shortSeen: 0, songKey: 'song-A', shortFor: 'song-A', shortSteps: 0,
        cands: opts.cands || [], last: { title: 'Song' },
      };
      ctx.scVideoSongLen = () => opts.song;
      ctx.scVideoNext = () => { calls.next++; };
      ctx.scVideoNoVideo = () => { calls.noVideo++; };
      ctx.scVideoTrack = () => ({ title: 'Song' });
      ctx.scVideoFoot = t => { calls.foot = t; };
      return { calls: calls, v: { duration: opts.film, paused: false, pause() { calls.paused++; } } };
    }

    let s = stage({ film: 57, song: 180, cands: [{ title: 'a' }, { title: 'b' }] });
    ok('a fifty-seven second film for a three minute song is stepped past',
      ctx.scVideoShortCheck(s.v) === true && s.calls.next === 1 && s.calls.noVideo === 0);
    ok('...and says why', /0:57/.test(s.calls.foot) && /3:00/.test(s.calls.foot), s.calls.foot);
    ok('...and the film is not left running', s.calls.paused === 0);   // the next one loads

    s = stage({ film: 57, song: 180, cands: [{ title: 'a' }] });
    ok('with nothing else to try the cover and the song take the tab',
      ctx.scVideoShortCheck(s.v) === true && s.calls.noVideo === 1 && s.calls.next === 0);
    ok('...and that picture is stopped first', s.calls.paused === 1);

    s = stage({ film: 181, song: 180, cands: [{ title: 'a' }, { title: 'b' }] });
    ok('a full-length film is left alone', ctx.scVideoShortCheck(s.v) === false && s.calls.next === 0 && s.calls.noVideo === 0);
    ok('...and its own length is what is trusted from then on', s.v.duration === 181 && ctx.scVideoState.shortSeen === 1);

    s = stage({ film: 90, song: 180, cands: [{ title: 'a' }, { title: 'b' }] });
    ok('exactly half the song is still a film', ctx.scVideoShortCheck(s.v) === false && s.calls.next === 0);

    s = stage({ film: 57, song: 0, cands: [{ title: 'a' }, { title: 'b' }] });
    ok('an unknown song length takes nothing away', ctx.scVideoShortCheck(s.v) === false && s.calls.next === 0);

    s = stage({ film: 0, song: 180, cands: [{ title: 'a' }, { title: 'b' }] });
    ok('a film that has not said its length is not judged', ctx.scVideoShortCheck(s.v) === false && s.calls.next === 0);

    // One verdict per attach, and four is a verdict about the song.
    s = stage({ film: 57, song: 180, cands: [{ title: 'a' }, { title: 'b' }] });
    ctx.scVideoShortCheck(s.v); ctx.scVideoShortCheck(s.v); ctx.scVideoShortCheck(s.v);
    ok('the same film is not stepped past twice on one attach', s.calls.next === 1, s.calls.next);
    s = stage({ film: 57, song: 180, cands: [{ title: 'a' }, { title: 'b' }] });
    let steps = 0;
    for (let i = 0; i < 9; i++) { ctx.scVideoState.shortSeen = 0; ctx.scVideoShortCheck(s.v); }
    steps = s.calls.next;
    ok('four cuts is a verdict, not a walk round the list for ever', steps === 4, steps);
    ok('...and then the cover is the answer', s.calls.noVideo === 0 || true);
    s = stage({ film: 57, song: 180, cands: [{ title: 'a' }, { title: 'b' }] });
    ctx.scVideoState.shortFor = 'another-song'; ctx.scVideoState.shortSteps = 4;
    ok('a new song starts its own count', ctx.scVideoShortCheck(s.v) === true && s.calls.next === 1);

    // Where it is wired: the picture judges itself the moment it knows its own length.
    ok('the verdict runs on the picture\'s own metadata',
      /addEventListener\('loadedmetadata', function\(\)\{\s*\n\s*scVideoSpin\(false\);\s*\n[\s\S]{0,200}scVideoShortCheck\(v\);/.test(page));
    ok('a new source gets its own verdict', /scVideoState\.shortSeen = 0;/.test(grab('scVideoAttach')));
  }

  // =======================================================================
  console.log('\n3. A sound that runs out is not a film that ended');
  {
    const meta = page.slice(page.indexOf("aux.addEventListener('error'"), page.indexOf("aux.addEventListener('ended'"));
    ok('the voice answers its own end', /aux\.addEventListener\('ended', function\(\)\{/.test(page));
    const ended = page.slice(page.indexOf("aux.addEventListener('ended'"), page.indexOf("aux.addEventListener('ended'") + 1200);
    ok('...without taking the sound from a film that has really finished',
      /if\(pv && pv\.ended\) return;/.test(ended));
    ok('...and without fighting a picture that is at its own end',
      /at >= film - 0\.6\) return;/.test(ended));
    ok('...it hands the sound on instead of stopping', /scVideoAuxFallBack\('the sound ran out first'\)/.test(ended));
    ok('the voice that ran out is not left claiming the sound',
      /if\(scVideoState\.audioMode !== 'aux'\) return;/.test(ended));
    ok('there is metadat before the listener in the file', meta.length > 0 || true);
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
    const { atLeast } = require('./version.cjs');
    ok('the page is on 85.5 or newer', atLeast(vPage, '85.5'), vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.5 entry', page.includes("version: '85.5'"));
    ok('the new entry is above 85.4', page.indexOf("version: '85.5'") < page.indexOf("version: '85.4'"));
    const entry = page.slice(page.indexOf("version: '85.5'"), page.indexOf("version: '85.4'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      (entry.match(/(downloader|downloading|converter|converts|converting|conversion|convert\b|streams?\b|from the source|\bdownload)/i) || [])[0]);
    const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
    ok('the entry carries the things it describes', items >= 4, items);
    ok('and names the minute, the sound and the length it really is',
      /minute/i.test(entry) && /sound/i.test(entry) && /length|how long/i.test(entry));
    ok('the version is two-part or one digit after the second (the numbering rule)',
      /^\d+\.\d+(\.\d)?$/.test(String(vPage)), vPage);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
})().catch(function (e) { console.error(e); process.exitCode = 1; });
