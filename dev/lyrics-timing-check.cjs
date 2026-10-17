// 74.1.9, from the phone:
//
//   "the lyrics for multi language songs is crazy it like doesn't play for 50 seconds
//    while the audio is already playing and then starts really late and the lyrics
//    needs to be accurate"
//
// WHY IT DID IT. A lyric sheet that carries its own timestamps - LRCLIB's synced entry,
// or a sheet the model timed - was trusted to be in sync with the file on the phone. It
// often is not: LRCLIB is community-uploaded and skews to official videos, full-length
// cuts and regional releases, so an entry can sit tens of seconds away from the
// recording in the library. Nothing measured it, and the only correction offered was the
// per-song sync nudge, clamped to +-15s - narrower than the error it exists to fix, so a
// sheet fifty seconds out could not be lined up by hand either.
//
// WHAT THIS DRIVES. `scLyricsSheetOffset` is sliced out of the shipped page together
// with the envelope helpers it reads (scQuietFloor, scFindQuietGaps) and run for real
// over synthetic recordings whose singing starts where the test says it does:
//
//   - a sheet fifty seconds late comes back as ~+50 (the report);
//   - a song whose singing starts late is NOT touched, because its own start says so;
//   - a sheet that is right, or a second out, is left alone - and so is one only a few
//     seconds out, which is the nudge's job rather than the app's;
//   - a sheet for a different cut, whose words would land in a measured break, or run
//     past the singing, or huddle in one corner of it, is refused;
//   - nothing at all is concluded from silence, from a missing half of the question, or
//     from three lines.
//
// A FIRST VERSION OF THIS MEASUREMENT MATCHED EACH STAMP TO ITS NEAREST ONSET, and this
// probe is why it no longer does: a sheet fifty seconds late is late into a different
// part of the singing, where every line still has an onset a second away, so every
// per-line difference came back ~0 and the sheet measured as perfect. The offsets below
// are the ones that caught it.
//
//   node dev/lyrics-timing-check.cjs
//   SC_HTML=/tmp/old7419.html node dev/lyrics-timing-check.cjs    # the red direction
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SC_ROOT || path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  + ' + name); }
  else { fail++; console.log('  X ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function slice(from, to) {
  const a = html.indexOf(from);
  if (a === -1) return '';
  const b = html.indexOf(to, a + from.length);
  return b === -1 ? '' : html.slice(a, b);
}
function num(name) {
  const m = html.match(new RegExp('var ' + name + ' = (\\d+(?:\\.\\d+)?)'));
  return m ? Number(m[1]) : NaN;
}

console.log('[1] the wiring: a stamped sheet is measured, and the answer reaches the tick');
{
  const cnt = (n) => html.split(n).length - 1;
  ok(html.indexOf('function scLyricsSheetOffset(rows, env, hopSec, duration){') !== -1 &&
     cnt('function scLyricsSheetOffset(') === 1,
    'the measurement is one function of the sheet and the recording');
  ok(cnt('function scAutoAlignLyricsToAudio(') === 1 && cnt('try{ scAutoAlignLyricsToAudio(); }catch(_eAlignCall){}') === 1,
    'and it is called from exactly one place - where a sheet goes on screen');
  const call = slice('    var _aligned = false;', '    // Stop any existing scroll interval');
  ok(call.indexOf('scLyricsLookEvenlySpaced(lyrics)') !== -1 && call.indexOf('} else {') !== -1 &&
     call.indexOf('scAutoAlignLyricsToAudio();') !== -1,
    'a sheet WITH stamps takes the alignment branch, an untimed one takes the timing branch');
  ok(call.indexOf('if(!_aligned && lyrics && lyrics.trim())') !== -1,
    'and nothing runs for a sheet the owner has pinned by hand');
  ok(slice('  async function scAutoAlignLyricsToAudio(){', '\n  // The fingerprint of the old guess')
      .indexOf('if(scLyricsAlignedNow()) return false;') !== -1,
    'the measurement itself refuses a pinned sheet too');
  ok(html.indexOf("dbPut('meta', { key: 'lyricsSyncOff_' + String(tid), value: off })") !== -1 &&
     html.indexOf("dbGet('meta', 'lyricsSyncOff_' + _sid)") !== -1,
    'the answer is stored under the same key the tick loads the nudge from');
  ok(html.indexOf('audio.currentTime + LYRICS_LEAD_MS + lyricsSyncOffsetSec') !== -1,
    'which the highlight adds to the playhead, for lines and words both');
  ok(html.indexOf("$('lyricsSyncReset').addEventListener") !== -1,
    'and the reset button that takes it back off is still wired');
  ok(html.indexOf('Math.max(-SC_LYRICS_OFF_MAX, Math.min(SC_LYRICS_OFF_MAX,') !== -1 &&
     html.indexOf('Math.max(-15, Math.min(15,') === -1,
    'the nudge buttons clamp to the ceiling, not to the old 15s');
  ok(num('SC_LYRICS_OFF_MAX') >= 60,
    'and that ceiling reaches a sheet tens of seconds out (' + num('SC_LYRICS_OFF_MAX') + 's)');
  ok(html.indexOf('var SC_LYRICS_SHEET_SUSPECT = 12;') !== -1 &&
     html.indexOf('firstStamp > SC_LYRICS_SHEET_SUSPECT') !== -1 &&
     html.indexOf('lastStamp > dur0 + SC_LYRICS_SHEET_MIN') !== -1,
    'and only a sheet that starts late, or runs past this file, is worth decoding the song for');
}

console.log('[2] the measurement, driven over synthetic recordings with known singing');
let fn = null;
{
  // Two slices, because the page keeps them apart: the measurement, and the envelope
  // helpers it reads further down. Both are the page's own bytes, nothing repeated.
  const measure = slice('  function scLyricsSheetOffset(rows, env, hopSec, duration){',
    '  async function scAutoAlignLyricsToAudio(){');
  const helpers = slice('  function scQuietFloor(env){', '  function scSingingWindow(');
  ok(measure.length > 1200 && helpers.indexOf('function scFindQuietGaps(') !== -1,
    'the measurement and the envelope helpers it reads slice out of the page ('
    + measure.length + ' + ' + helpers.length + ' chars)');
  const consts = ['SC_LYRICS_SHEET_MIN', 'SC_LYRICS_SHEET_LEN', 'SC_LYRICS_OFF_MAX',
    'SC_BREAK_SILENCE', 'SC_BREAK_NOISE']
    .map((n) => 'var ' + n + ' = ' + num(n) + ';').join('\n');
  ok(!/NaN/.test(consts), 'every threshold it reads was found on the page');
  try {
    fn = new Function(consts + '\n' + helpers + '\n' + measure + '\nreturn scLyricsSheetOffset;')();
  } catch (e) { ok(false, 'the sliced block runs', e.message); }
}
if (fn) {
  // A page without the fix has no such function and no such constants: every call below
  // is guarded so the probe reports a failure instead of a stack trace.
  const raw = fn;
  fn = function () { try { return raw.apply(null, arguments); } catch (e) { return 'THREW: ' + e.message; } };

  const HOP = 0.02, DUR = 240;
  // A recording that sings from `from` to 236s, with a ten-second break at 100-110s.
  const recording = (from) => {
    const env = new Float32Array(Math.round(DUR / HOP));
    for (let f = 0; f < env.length; f += 1) {
      const s = f * HOP;
      const live = (s >= from && s < 100) || (s >= 110 && s < 236);
      if (live && Math.abs(s * 4 - Math.round(s * 4)) < 1e-6) env[f] = 1;
    }
    return env;
  };
  const env = recording(8);
  const rows = [];
  for (let s = 8.5; s < 99; s += 4) rows.push({ t: s, text: 'l' });
  for (let s = 110.5; s < 235; s += 4) rows.push({ t: s, text: 'l' });
  const shift = (list, d) => list.map((r) => ({ t: r.t + d, text: r.text }));
  const near = (v, want, tol) => Math.abs(v - want) <= tol;

  const late = fn(shift(rows, 50), env, HOP, DUR);
  ok(late !== null && near(late, 50, 1.5), 'a sheet fifty seconds late comes back as +50 (' + late + ')');
  ok(fn(rows, env, HOP, DUR) === null, 'a sheet that is already right is left alone');
  ok(fn(shift(rows, 1), env, HOP, DUR) === null, 'and so is one a second out');
  ok(fn(shift(rows, 4), env, HOP, DUR) === null,
    'and one four seconds out, which is the nudge\'s job (' + fn(shift(rows, 4), env, HOP, DUR) + ')');
  // The case the whole design turns on: a song whose SINGING starts late must not be
  // moved, because its own start is the reference the sheet is measured against.
  const longIntro = recording(50);
  const introRows = [];
  for (let s = 50.5; s < 99; s += 4) introRows.push({ t: s, text: 'l' });
  for (let s = 110.5; s < 235; s += 4) introRows.push({ t: s, text: 'l' });
  ok(fn(introRows, longIntro, HOP, DUR) === null,
    'a fifty-second instrumental opening is not mistaken for a late sheet (' + fn(introRows, longIntro, HOP, DUR) + ')');
  // ...and the same recording with the sheet written for a version that starts there.
  const earlyRows = [];
  for (let s = 8.5; s < 99; s += 4) earlyRows.push({ t: s, text: 'l' });
  for (let s = 110.5; s < 235; s += 4) earlyRows.push({ t: s, text: 'l' });
  // The other direction is REFUSED rather than measured, and deliberately: a sheet
  // written for a version that starts forty seconds earlier has forty seconds of lines
  // this file simply does not contain, so shifting it would file words onto a part of
  // the song they were never written for. Another cut is not an offset.
  const early = fn(earlyRows, longIntro, HOP, DUR);
  ok(early === null,
    'a sheet written for a version that starts much earlier is refused, not shifted (' + early + ')');
  // A different cut, in the three shapes the recording can prove.
  const ragged = rows.map((r, i) => ({ t: r.t + (i % 2 ? 4 : -4), text: r.text }));
  ok(fn(ragged, env, HOP, DUR) === null, 'a sheet whose lines each disagree is never shifted');
  const inBreak = shift(rows, 50).concat([{ t: 150.5, text: 'l' }, { t: 151.5, text: 'l' }, { t: 152.5, text: 'l' },
    { t: 153.5, text: 'l' }, { t: 154.5, text: 'l' }, { t: 155.5, text: 'l' }, { t: 156.5, text: 'l' },
    { t: 157.5, text: 'l' }, { t: 158.5, text: 'l' }, { t: 159.5, text: 'l' }]);
  ok(fn(inBreak, env, HOP, DUR) === null,
    'a sheet whose words land in a measured break is refused, not shifted into it (' + fn(inBreak, env, HOP, DUR) + ')');
  const huddle = [];
  for (let s = 58.5; s < 70; s += 4) huddle.push({ t: s, text: 'l' });
  ok(fn(huddle, env, HOP, DUR) === null,
    'and so is a handful of lines that cannot cover the singing (' + fn(huddle, env, HOP, DUR) + ')');
  // Nothing to conclude from.
  ok(fn(shift(rows, 300), env, HOP, DUR) === null, 'a sheet entirely past the end of the file is not measured');
  ok(fn(shift(rows, 200), env, HOP, DUR) === null,
    'and one beyond the ceiling is refused, never clamped into a lie (' + fn(shift(rows, 200), env, HOP, DUR) + ')');
  ok(fn(shift(rows, 50).slice(0, 3), env, HOP, DUR) === null, 'three lines are not enough to conclude anything');
  ok(fn(rows, new Float32Array(env.length), HOP, DUR) === null, 'silence measures nothing');
  ok(fn(null, env, HOP, DUR) === null && fn(rows, null, HOP, DUR) === null,
    'and neither does a missing half of the question');
  ok(num('SC_LYRICS_SHEET_MIN') >= 4 && num('SC_LYRICS_SHEET_LEN') <= 0.25,
    'the two thresholds are the ones this drove (' + num('SC_LYRICS_SHEET_MIN') + 's / '
    + num('SC_LYRICS_SHEET_LEN') + ')');
}

console.log('[3] the release these rules ship in');
{
  const ver = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/^\d+(\.\d+)*$/.test(String(ver)), 'APP_VERSION = ' + ver);
  ok(sw.indexOf('sidecut-shell-v' + ver) !== -1, 'and the shell cache is that version too');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
