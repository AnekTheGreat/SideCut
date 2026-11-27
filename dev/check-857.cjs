// 85.7 harness - the film stops at fifty-seven seconds, so the SOUND is measured too.
//
// The owner's report: "it doesn't go past 57 seconds it just stops and the regular audio
// without the music video". That is the music-video tab handing its sound over at the minute
// and then playing the ordinary song, which is what 85.5's `ended` road does when the voice
// runs out. Two things could make the voice a minute long, and this release answers both
// before they are heard:
//
//   * THE SOUND COPY IS A FILE OF ITS OWN, AND NOBODY MEASURED IT. A sharp picture is paired
//     with the same film's single-file copy (85.5), but an upload with no single-file row
//     falls back to the audio-only row - which the source cuts at its first megabyte, about
//     fifty-seven seconds. `scVideoVoiceCut` reads the copy's own duration against the
//     film's and acts at once: the whole film's single-file copy becomes the picture when
//     there is one, otherwise the song takes the sound immediately and the footer says why.
//   * A FILM THAT RUNS OUT IS A CUT, AND NOTHING LOOKED PAST IT. 85.3.21 handed the sound
//     back the moment a short film ended, so the tab stayed on the cut's last frame while
//     the ordinary song played. `scVideoCutNext` tries the next result first.
//   * And the 85.5 verdict could be lost: it ran on `loadedmetadata` only, and an element
//     whose duration is not published yet has nothing to judge. It listens for the length
//     now, and the tick asks again.
//
// This gate drives `scVideoVoiceCut`, `scVideoWholeRung`, `scVideoCutNext` and
// `scVideoShortCheck`, and reads the shipped strings for the rest. Looked at? No - nothing
// was played from this sandbox, so what is proven is the rule, not a phone's minute.
//
//   node dev/check-857.cjs
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

const BITS = ['scVideoMMSS', 'scVideoWholeRung', 'scVideoVoiceCut', 'scVideoCutNext', 'scVideoShortCheck'];

function stage(opts) {
  opts = opts || {};
  const calls = { apply: [], fallBack: [], next: 0, noVideo: 0, foot: [], song: 0, pause: 0 };
  const ctx = {
    console: console,
    SC_VQ_FULL_SHARE: 0.5,
    scVideoState: {
      audioMode: opts.mode === undefined ? 'aux' : opts.mode,
      coverOn: false, voiceCutSeen: opts.seen || 0, shortSeen: opts.shortSeen || 0,
      songKey: 'song-A', shortFor: 'song-A', shortSteps: opts.steps || 0,
      cands: opts.cands || [], rungs: opts.rungs || [], last: { title: 'Song' },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(BITS.map(grab).join('\n'), ctx);
  ctx.scVideoEl = (id) => (id === 'scVideoEl' ? { duration: opts.film === undefined ? 180 : opts.film, currentTime: 12 } : null);
  ctx.scVideoFoot = (t) => calls.foot.push(String(t || ''));
  ctx.scVideoApplyRung = (r, keep) => { calls.apply.push([r && r.h, !!keep]); return true; };
  ctx.scVideoAuxFallBack = (why) => calls.fallBack.push(String(why || ''));
  ctx.scVideoNext = () => { calls.next++; };
  ctx.scVideoNoVideo = () => { calls.noVideo++; };
  ctx.scVideoSong = () => { calls.song++; };
  ctx.scVideoOwnSound = () => {};
  ctx.scVideoAuxPause = () => {};
  ctx.scVideoSongLen = () => (opts.song === undefined ? 180 : opts.song);
  ctx.scVideoTrack = () => ({ title: 'Song' });
  ctx.scVideoClock = () => {};
  return { ctx: ctx, calls: calls };
}

(async function main() {

  // =======================================================================
  console.log('1. The sound copy is judged by its own length before it is heard');
  {
    let s = stage({ film: 180 });
    let a = { duration: 57 };
    ok('a fifty-seven second sound under a three minute film is not trusted',
      s.ctx.scVideoVoiceCut(a) === true);
    ok('...and the tab says how long it really is', /0:57/.test(s.calls.foot.join(' ')), s.calls.foot.join(' '));
    ok('...with no single-file copy the song takes the sound at once, not a minute later',
      s.calls.fallBack.length === 1 && s.ctx.scVideoState.audioMode === 'aux', s.calls.fallBack.join(','));
    ok('...and the verdict is remembered, so it is answered once per attach', s.ctx.scVideoState.voiceCutSeen === 1);

    // The answer HAS the whole film as a single file: that becomes the picture, one file, one
    // sound, from the second it had reached.
    const rungs = [
      { h: 1080, muxed: false, no: false },
      { h: 720, muxed: true, no: false },
      { h: 360, muxed: true, no: false },
    ];
    s = stage({ film: 180, rungs: rungs });
    ok('with a single-file copy of the whole film, that copy is what plays',
      s.ctx.scVideoVoiceCut({ duration: 57 }) === true && s.calls.apply.length === 1 && s.calls.apply[0][0] === 720 && s.calls.apply[0][1] === true,
      JSON.stringify(s.calls.apply));
    ok('...and the footer says which copy and why', /single-file copy/.test(s.calls.foot.join(' ')), s.calls.foot.join(' '));
    ok('...and the song is not handed the sound on top of it', s.calls.fallBack.length === 0);

    s = stage({ film: 180 });
    ok('a sound as long as the film is left alone', s.ctx.scVideoVoiceCut({ duration: 179 }) === false && s.ctx.scVideoState.voiceCutSeen === 1);
    s = stage({ film: 180 });
    ok('exactly half the film is still a sound', s.ctx.scVideoVoiceCut({ duration: 90 }) === false);
    s = stage({ film: 180 });
    ok('two seconds short of the film is not a cut', s.ctx.scVideoVoiceCut({ duration: 178.5 }) === false);

    s = stage({ film: 0 });
    ok('a film that has not said its length takes nothing away', s.ctx.scVideoVoiceCut({ duration: 57 }) === false && s.ctx.scVideoState.voiceCutSeen === 0);
    s = stage({ film: 180 });
    ok('a sound that has not said its length takes nothing away either', s.ctx.scVideoVoiceCut({ duration: NaN }) === false && s.ctx.scVideoState.voiceCutSeen === 0);
    s = stage({ film: 180 });
    ok('nothing is judged twice on one attach', (function () {
      s.ctx.scVideoVoiceCut({ duration: 57 });
      const foots = s.calls.foot.length;
      return s.ctx.scVideoVoiceCut({ duration: 57 }) === false && s.calls.foot.length === foots;
    })());
    s = stage({ film: 180, mode: 'video' });
    ok('a size that carries its own sound has no voice to judge', s.ctx.scVideoVoiceCut({ duration: 57 }) === false);
    s = stage({ film: 180 });
    ok('no element at all is not a verdict', s.ctx.scVideoVoiceCut(null) === false);

    // Which single-file copy becomes the picture: the tallest one the element accepted.
    s = stage({ film: 180, rungs: [{ h: 1080, muxed: false }, { h: 720, muxed: true }, { h: 480, muxed: true }, { h: 360, muxed: true, no: true }] });
    ok('the whole film is played at the tallest single-file size that opens', s.ctx.scVideoWholeRung().h === 720);
    s = stage({ film: 180, rungs: [{ h: 1080, muxed: false }, { h: 360, muxed: true, no: true }] });
    ok('a size the element refused is not the one chosen', s.ctx.scVideoWholeRung() === null);
  }

  // =======================================================================
  console.log('\n2. A film that runs out is looked past before the song takes the tab');
  {
    let s = stage({ cands: [{ title: 'a' }, { title: 'b' }], steps: 0 });
    ok('a cut film with another result tries the next one', s.ctx.scVideoCutNext(57, 180) === true && s.calls.next === 1);
    ok('...and says what it saw', /0:57/.test(s.calls.foot.join(' ')) && /3:00/.test(s.calls.foot.join(' ')), s.calls.foot.join(' '));
    ok('...and counts the step against the song', s.ctx.scVideoState.shortSteps === 1);
    ok('...and marks the film as judged, so the still is not played again', s.ctx.scVideoState.shortSeen === 1);

    s = stage({ cands: [{ title: 'a' }] });
    ok('a lone film has nothing to try, so the hand-over stands', s.ctx.scVideoCutNext(57, 180) === false && s.calls.next === 0);
    s = stage({ cands: [{ title: 'a' }, { title: 'b' }], steps: 4 });
    ok('four cuts is a verdict, not a walk round the list for ever', s.ctx.scVideoCutNext(57, 180) === false && s.calls.next === 0);
    s = stage({ cands: [{ title: 'a' }, { title: 'b' }], steps: 4 });
    s.ctx.scVideoState.shortFor = 'another-song';
    ok('a new song starts its own count', s.ctx.scVideoCutNext(57, 180) === true && s.calls.next === 1);

    const sync = grab('scVideoSync');
    const cutAt = sync.indexOf('if(scVideoCutNext(_clipLen, _songLen))');
    const ownAt = sync.indexOf('scVideoOwnSound(false)', sync.indexOf('_clipOver'));
    ok('the search for the real video comes before the sound is handed back', cutAt > 0 && ownAt > cutAt, cutAt + '/' + ownAt);
  }

  // =======================================================================
  console.log('\n3. A length that arrives late is still a length');
  {
    const vListeners = page.slice(page.indexOf("v.addEventListener('playing'"), page.indexOf("aux.addEventListener('loadedmetadata'") + 2000);
    ok('the picture judges itself when its duration is published', /v\.addEventListener\('durationchange', function\(\)\{ scVideoShortCheck\(v\); \}\)/.test(vListeners));
    ok('...and still on its own metadata, as 85.5 wrote it',
      /addEventListener\('loadedmetadata', function\(\)\{[\s\S]{0,200}scVideoShortCheck\(v\);/.test(vListeners));
    const auxBlock = page.slice(page.indexOf("aux.addEventListener('loadedmetadata'"), page.indexOf("aux.addEventListener('ended'"));
    ok('the sound is judged on its metadata', /scVideoVoiceCut\(aux\)/.test(auxBlock));
    ok('...and when its duration is published or changes',
      /aux\.addEventListener\('durationchange', function\(\)\{ scVideoPoseTry\(aux\); scVideoVoiceCut\(aux\); \}\)/.test(auxBlock));
    ok('the tick asks about the sound too, so a slow start cannot lose it',
      /if\(scVideoVoiceCut\(s\)\)\{ scVideoClock\(\); return; \}/.test(grab('scVideoSync')));
    ok('a new source gets its own sound verdict', /scVideoState\.voiceCutSeen = 0;/.test(grab('scVideoAttach')));
    ok('the hand-back keeps its 85.3.21 ending when there is nothing else to try',
      /scVideoOwnSound\(false\);[\s\S]{0,400}scVideoSong\(true\);/.test(grab('scVideoSync')));
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
    ok('the page is on 85.7 or newer', atLeast(vPage, '85.7'), vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.7 entry', page.includes("version: '85.7'"));
    ok('the new entry is above 85.6', page.indexOf("version: '85.7'") < page.indexOf("version: '85.6'"));
    const entry = page.slice(page.indexOf("version: '85.7'"), page.indexOf("version: '85.6'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      (entry.match(/(downloader|downloading|converter|converts|converting|conversion|convert\b|streams?\b|from the source|\bdownload)/i) || [])[0]);
    const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
    ok('the entry carries the things it describes', items >= 4, items);
    ok('and names the minute, the sound and the film that runs out',
      /minute|fifty-seven/i.test(entry) && /sound/i.test(entry) && /film/i.test(entry));
    ok('the version is two-part or one digit after the second (the numbering rule)',
      /^\d+\.\d+(\.\d)?$/.test(String(vPage)), vPage);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
})().catch(function (e) { console.error(e); process.exitCode = 1; });
