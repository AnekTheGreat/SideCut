// 85.6 harness - the word that lights is the one being sung, and the film's sound is
// neither stretched nor switched off under it.
//
// The owner's report: "now the lines are correct for the lyrics but the word it's on isn't
// and it keeps randomly stopping and speeding up and slowing down". Two faults, and both
// are in where a number comes from:
//
//   * THE WORD WAS TIMED AGAINST THE OLD LINE. The word-by-word timing is measured inside
//     each line's window and stored with the stamp it was measured against. A sheet that is
//     timed again - the model's own pass (85.4), the nudge, a film's clock - keeps its words
//     and changes its stamps, so the record joined nothing, every line fell through to an
//     even share of its window, and the line was right with the wrong word inside it. It is
//     now joined by the line's own words, and a record whose stamps have all left the sheet
//     is measured again instead of being trusted because the character count matched.
//   * THE SOUND WAS STRETCHED AND STOPPED. The voice under a sharp picture was rate-trimmed
//     by up to eight percent (audible on music) and silenced by every buffer dip of the
//     picture - a film that stops, restarts, speeds up and slows down. The trim is two
//     percent at most now and the sound outlasts a dip, and the copy it plays is the
//     lightest one the answer has instead of the first, so it stops taking the connection
//     the picture needs.
//
// This gate drives `scVideoLadder` (which copy is the voice), `scLineWordsKey`,
// `scMeasuredWordStarts` and `scWordTimingMoved`, and reads the shipped strings for the
// rest. Looked at? No - nothing was played from this sandbox: what is proven is the choice,
// the join and the rules, not a phone's playback.
//
//   node dev/check-856.cjs
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

const LADDER_BITS = ['scVideoCanPlay', 'scVideoCodec', 'scVideoRungTag', 'scVideoStd', 'scVideoSizeLabel',
                     'scVideoNoRange', 'scVideoVoiceRank', 'scVideoLadder'];
function ladderSandbox(refuse) {
  const ctx = {
    window: {}, console: console,
    SC_VQ_STEPS: [144, 240, 360, 480, 720, 1080, 1440, 2048, 2160],
    SC_VQ_FULL_SHARE: 0.5,
    scVideoState: { deadH: {}, slowH: {}, rescueH: {} },
    MediaSource: { isTypeSupported: () => true },
    // The element's own answer, so "the lightest copy this phone can open" is a real choice.
    scVideoEl: () => ({ canPlayType: (m) => (refuse && refuse.test(String(m)) ? '' : 'maybe') }),
  };
  vm.createContext(ctx);
  vm.runInContext(LADDER_BITS.map(grab).join('\n'), ctx);
  return ctx;
}

const AVC = 'video/mp4; codecs="avc1.42001E, mp4a.40.2"';
const HEV = 'video/mp4; codecs="hev1.1.6.L93.B0, mp4a.40.2"';

(async function main() {

  // =======================================================================
  console.log('1. The voice is the lightest copy of the film, not the first one listed');
  {
    // The answer lists its progressive copies heaviest first, which is the order that made
    // the tab pull thirty megabytes of picture it never showed.
    const heavy = { url: 'https://v/720?itag=22', mime: AVC, itag: 22, h: 720, size: 30000000 };
    const middle = { url: 'https://v/360?itag=18', mime: AVC, itag: 18, h: 360, size: 9000000 };
    const light = { url: 'https://v/144?itag=17', mime: AVC, itag: 17, h: 144, size: 2000000 };
    const adaptive = [{ url: 'https://v/hd?itag=137', mime: 'video/mp4; codecs="avc1.640028"', itag: 137, size: 40000000, h: 1080 }];
    const ctx = ladderSandbox(null);
    const rungs = ctx.scVideoLadder([heavy, middle, light], adaptive, null);
    const hd = rungs.filter(r => r.h === 1080)[0];
    ok('a sharp size is still offered', !!hd, rungs.map(r => r.h).join(','));
    ok('...and its voice is the LIGHTEST copy, not the first one in the answer',
      !!hd && hd.audioUrl === 'https://v/144?itag=17', hd && hd.audioUrl);
    ok('...still marked as a one-file voice, so it is played and never read', !!hd && hd.audioOne === true);
    const one = rungs.filter(r => r.h === 360)[0];
    ok('a single-file size is still its own sound (nothing of 85.5 is taken away)',
      !!one && one.muxed === true && one.audioUrl === '' && one.audioOne === false, one && one.audioUrl);

    // The lightest copy cannot be opened here, so the next lightest one is the voice.
    const ctx2 = ladderSandbox(/hev1/);
    const lightHev = { url: 'https://v/144hev?itag=17', mime: HEV, itag: 17, h: 144, size: 1500000 };
    const rungs2 = ctx2.scVideoLadder([heavy, middle, lightHev], adaptive, null);
    const hd2 = rungs2.filter(r => r.h === 1080)[0];
    ok('the lightest copy is only the voice if this element can open it',
      !!hd2 && hd2.audioUrl === 'https://v/360?itag=18', hd2 && hd2.audioUrl);

    // A copy that does not say its weight is not preferred over two gigabytes' worth...
    // it is simply ranked after every copy whose weight IS known: the answer is not guessed.
    const ctx3 = ladderSandbox(null);
    const noSize = { url: 'https://v/144b?itag=17', mime: AVC, itag: 17, h: 144, bits: 500000 };
    const rungs3 = ctx3.scVideoLadder([heavy, noSize], adaptive, null);
    const hd3 = rungs3.filter(r => r.h === 1080)[0];
    ok('a copy whose weight is not stated is ranked after every copy whose weight is',
      !!hd3 && hd3.audioUrl === 'https://v/720?itag=22', hd3 && hd3.audioUrl);

    // No single-file copy at all: the audio row is still the voice (85.5's fallback).
    const audioRow = { url: 'https://v/aud?itag=140', mime: 'audio/mp4; codecs="mp4a.40.2"', size: 1000000 };
    const ctx4 = ladderSandbox(null);
    const hd4 = ctx4.scVideoLadder([], adaptive, audioRow).filter(r => r.h === 1080)[0];
    ok('an answer with no single-file copy keeps its audio row as the voice',
      !!hd4 && hd4.audioUrl === 'https://v/aud?itag=140' && hd4.audioOne === false, hd4 && hd4.audioUrl);

    const ladder = grab('scVideoLadder');
    ok('the reason is written down where the choice is made',
      /THE LIGHTEST SINGLE-FILE COPY IS THE VOICE/.test(ladder), 'no note');
    ok('...and the ranking is its own named function, so it can be read', /function scVideoVoiceRank\(r\)\{/.test(page));
  }

  // =======================================================================
  console.log('\n2. The sound is never stretched, and it outlasts a buffer dip');
  {
    ok('the grace is a constant with a name', /var SC_VQ_VOICE_GRACE = 1\.2;/.test(page));
    const sync = grab('scVideoSync');
    ok('a picture that is waiting no longer silences the sound by itself',
      /if\(v\.readyState < 2\)\{/.test(sync) && /if\(d < SC_VQ_VOICE_GRACE\)\{/.test(sync));
    ok('...and the sound is only held once it has run that far ahead',
      /else if\(!s\.paused\)\{\s*\n\s*scVideoAuxPause\(\);/.test(sync));
    ok('a paused picture and a seek still silence it',
      /if\(v\.paused \|\| v\.seeking\)\{/.test(sync));
    ok('the trim is two percent, not eight', /Math\.max\(0\.98, Math\.min\(1\.02, 1 - d \* 0\.5\)\)/.test(sync));
    ok('the eight percent bend is gone from the page', page.indexOf('0.92, Math.min(1.08') === -1);
    ok('a real gap is still jumped to the frame', /Math\.abs\(d\) > 0\.6/.test(sync));

    const waitingLine = (page.match(/v\.addEventListener\('waiting',[^\n]*/) || [''])[0];
    const stalledLine = (page.match(/v\.addEventListener\('stalled',[^\n]*/) || [''])[0];
    ok('the waiting event no longer silences the voice', waitingLine.length > 0 && waitingLine.indexOf('scVideoAuxPause') === -1, waitingLine);
    ok('the stalled event no longer silences it either', stalledLine.length > 0 && stalledLine.indexOf('scVideoAuxPause') === -1, stalledLine);
    ok('...but a paused picture still does', /v\.addEventListener\('pause', function\(\)\{[\s\S]{0,400}?scVideoAuxPause\(\);/.test(page));
  }

  // =======================================================================
  console.log('\n3. The word that lights belongs to the line it was measured on');
  {
    const tagLine = (page.match(/var SC_LRC_TAG_SRC = ('[^']*');/) || [])[1];
    ok('the tag pattern is where the sandbox can read it', !!tagLine);
    const ctx = {
      console: console,
      SC_LRC_TAG_SRC: vm.runInNewContext(tagLine),
      scWordTimes: {},
      scWordEnv: null,
      scWordTrackId: () => 's1',
    };
    vm.createContext(ctx);
    vm.runInContext(['scPaceSegments', 'scLrcTagRe', 'scHasLrcStamps', 'scParseLrcLines',
                     'scLineWordsKey', 'scMeasuredWordStarts', 'scWordTimingMoved'].map(grab).join('\n'), ctx);
    let envAsked = 0;
    ctx.scWordStartsForWindow = () => { envAsked++; return [5, 6]; };

    const line = { textContent: 'Hello big world', dataset: { time: '42' } };
    ok('a line is named by the words sung in it', ctx.scLineWordsKey(line) === 'hello big world', ctx.scLineWordsKey(line));
    ok('...however the whitespace falls', ctx.scLineWordsKey({ textContent: '  Hello   big\tworld ' }) === 'hello big world');
    ok('...and a Han run is split the way the pacer splits it',
      ctx.scLineWordsKey({ textContent: '你好世界' }) === ctx.scPaceSegments('你好世界').join(' ').toLowerCase());

    // THE FAULT: the sheet was retimed, so the stamp the words were measured against is not
    // the stamp on the screen - and the same words are still the same words.
    ctx.scWordTimes.s1 = { len: 40, hop: 0.02, lines: [{ t: 12, w: [12.1, 12.62, 13.2], x: 'hello big world' }] };
    const moved = ctx.scMeasuredWordStarts(line, 42, 46, 3);
    ok('a line whose stamp moved is still paced by its own measured starts',
      Array.isArray(moved) && moved.length === 3 && moved[0] === 12.1, JSON.stringify(moved));
    ok('...and the recording is not asked for a window it already answered', envAsked === 0);
    ok('a word count that no longer matches the measurement is still refused',
      ctx.scMeasuredWordStarts(line, 42, 46, 2) === null);

    // A record from before this release has no words in it. Nothing is taken away.
    ctx.scWordTimes.s1 = { len: 40, hop: 0.02, lines: [{ t: 42, w: [42.2, 42.9, 43.4] }] };
    const byStamp = ctx.scMeasuredWordStarts(line, 42, 46, 3);
    ok('an older record still joins by its stamp, exactly as it did', Array.isArray(byStamp) && byStamp[0] === 42.2, JSON.stringify(byStamp));
    const oldMoved = ctx.scMeasuredWordStarts({ textContent: 'Hello big world', dataset: { time: '99' } }, 99, 103, 3);
    ok('...and one whose stamp is gone and whose words were never kept joins nothing, rather than guessing',
      oldMoved === null, JSON.stringify(oldMoved));

    // The window measured off the recording this session is still the fallback.
    ctx.scWordTimes.s1 = { len: 40, hop: 0.02, lines: [] };
    ctx.scWordEnv = { id: 's1', hop: 0.02, env: [0.1, 0.2] };
    const fromEnv = ctx.scMeasuredWordStarts({ textContent: 'other words', dataset: { time: '42' } }, 42, 46, 2);
    ok('a line nothing matches is still measured off the recording in memory',
      Array.isArray(fromEnv) && fromEnv[0] === 5 && envAsked === 1, JSON.stringify(fromEnv));
    ctx.scWordEnv = null;
    ok('...and with no recording and no record the pacer keeps its syllable shape',
      ctx.scMeasuredWordStarts({ textContent: 'other words', dataset: { time: '42' } }, 42, 46, 2) === null);

    // IS THE RECORD ABOUT THE TIMING THE SHEET HAS NOW?
    const rec = { len: 60, hop: 0.02, lines: [{ t: 12, w: [12.1] }, { t: 30, w: [30.2] }] };
    ok('the same sheet is the same timing', ctx.scWordTimingMoved(rec, '[00:12.00]a\n[00:30.00]b') === false);
    ok('a stamp moved inside the tolerance is still the same line',
      ctx.scWordTimingMoved(rec, '[00:12.20]a\n[00:30.00]b') === false);
    ok('a line the model moved by more than a third of a second is a new timing',
      ctx.scWordTimingMoved(rec, '[00:13.60]a\n[00:30.00]b') === true);
    ok('a sheet with no stamps has no timing to have moved',
      ctx.scWordTimingMoved(rec, 'just words, no stamps at all') === false);
    ok('an empty record is never "moved"', ctx.scWordTimingMoved({ lines: [] }, '[00:12.00]a\n[00:30.00]b') === false);

    const kick = grab('scWordMeasureKick');
    ok('the measurement is taken again when the timing moved',
      kick.indexOf('if(!scWordTimingMoved(known, sheetText)) return;') > 0 &&
      kick.indexOf('delete scWordTimes[tid];') > kick.indexOf('if(!scWordTimingMoved(known, sheetText)) return;'));
    ok('...and a verdict ("nothing to measure here") is not re-decoded for ever',
      /if\(!Number\(known\.hop\)\) return;/.test(kick));
    ok('...and the old test that only counted characters is gone',
      kick.indexOf('if(known && known.len === len) return;') === -1);

    const ai = grab('aiSyncLyrics');
    ok('a new timing is dropped under every name the words can be stored by',
      /var _wordIds = \[_aiSid\];/.test(ai) && /scWordTrackId\(\)/.test(ai) && /for\(var _wi = 0; _wi < _wordIds\.length; _wi\+\+\)\{/.test(ai));
    ok('...and the store is cleared for each of them',
      /key: 'lyricWords_' \+ _wordIds\[_wi\]/.test(ai));
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
    ok('the page is on 85.6 or newer', atLeast(vPage, '85.6'), vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.6 entry', page.includes("version: '85.6'"));
    ok('the new entry is above 85.5', page.indexOf("version: '85.6'") < page.indexOf("version: '85.5'"));
    const entry = page.slice(page.indexOf("version: '85.6'"), page.indexOf("version: '85.5'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      (entry.match(/(downloader|downloading|converter|converts|converting|conversion|convert\b|streams?\b|from the source|\bdownload)/i) || [])[0]);
    const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
    ok('the entry carries the things it describes', items >= 4, items);
    ok('and names the word, the word inside the line and the sound', /word/i.test(entry) && /sound/i.test(entry));
    ok('the version is two-part or one digit after the second (the numbering rule)',
      /^\d+\.\d+(\.\d)?$/.test(String(vPage)), vPage);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
})().catch(function (e) { console.error(e); process.exitCode = 1; });
