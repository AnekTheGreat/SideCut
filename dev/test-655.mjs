// v63.1 — the converting banner: no glyph, and a bar that means something.
//
// The report: on a YouTube -> MP3 run the "Converting" banner carried a down
// arrow in front of the word Converting, and "the progress bar isn't accurate
// at all". Both were real, and both had the same cause: one bar with four
// phases reporting into it and no owner. It opened at a hard-coded 15%, sat
// there through the download (the longest wait of the run), and slid BACKWARDS
// whenever a stream had to be retried.
//
// This checks the artifact in the parts that can be checked cheaply:
//
//   [1] every converting surface reads plainly - no glyph in the strings the
//       pill, the bell and the two converter cards can show mid-run;
//   [2] the run opens on a real zero instead of a made-up 15%;
//   [3] one number owns the bar: the bands are ordered and gapless, a band maps
//       0..1 onto its own range, and the clamp is real (behaviour, run out of
//       the file itself);
//   [4] scFetchBytes reports REAL bytes while it reads, which is what makes the
//       download half of the bar honest (behaviour, against a stub reader) -
//       including the truncated-stream guard that must survive the change;
//   [5] the release that carries it says so.
//
//   node dev/test-652.mjs                             # the shipped tree
//   SC_HTML=/path/to/index.html node dev/test-652.mjs  # any build - this fails
//                       on the pre-fix build, which is the whole point of it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const src = fs.readFileSync(HTML, 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

// Built from code points so this file stays ASCII, like the patch that made the change.
const cp = (n) => String.fromCodePoint(n);
const DD = cp(0x23ec), HG = cp(0x23f3), DA = cp(0x2b07), MD = cp(0x2014), ELL = cp(0x2026), DOT = cp(0x00b7);

console.log('[1] the converting surfaces read plainly');
ok(src.indexOf(DD) === -1, 'the double-triangle glyph is gone from the whole page');
ok(src.indexOf('\\u23f3 Converting') === -1, 'the escaped hourglass card title is gone');
ok(src.indexOf(HG + ' Converting') === -1, 'the hourglass card status is gone');
ok(src.indexOf(HG + ' Fetching track info') === -1, 'the hourglass spotify status is gone');
ok(src.indexOf(HG + ' Finding audio') === -1, 'the hourglass spotify status is gone');
ok(src.indexOf(DA + ' Music audio comes bundled') === -1, 'the arrow on the bundled-audio status is gone');
ok(src.indexOf(DA + ' Downloading the audio on your device') === -1, 'the arrow on the download status is gone');
ok(src.includes('>Converting ' + MD + ' ${escapeHtml(cv.title'), 'the bell entry reads plainly');
ok(src.includes('>Converting ${Math.max(0, Math.min(100, Math.round(window.__scNotifConv.pct'), 'the bell summary reads plainly');
ok(src.includes('>Converting' + ELL + '</div>'), 'the card title reads plainly');
ok(src.includes('text-align:left;">Starting' + ELL + '</div>'), 'the card status opens on Starting');

console.log('[2] the run opens on a real zero');
ok(!src.includes("scConvertPillUpdate('Converting " + DOT + " YouTube', 'Starting" + ELL + "', 15)"), 'the hard-coded 15% is gone');
ok(src.includes("setStatus('Starting" + ELL + "', 0);"), 'the first status is Starting at 0%');

console.log('[3] one number for the whole run (behaviour)');
{
  const start = src.indexOf('    var YT_BANDS = {');
  const end = src.indexOf("    setStatus('Starting" + ELL + "', 0);", start);
  ok(start !== -1 && end !== -1 && end > start, 'the band model is extractable');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const code = src.slice(start, end);
      const calls = [];
      const run = new Function('resultEl', 'title', 'scConvertPillUpdate', `
        ${code}
        return { ytBandPct, ytPct, setStatus, bands: YT_BANDS, now: function(){ return _ytPct; } };
      `)({ querySelector: () => null }, 'YouTube video', (t, s, p) => calls.push(p));
      const b = run.bands;
      ok(b.resolve[0] === 0 && b.encode[1] === 100, 'the bands start at 0 and end at 100');
      const order = ['resolve', 'download', 'decode', 'encode'].map((n) => b[n][0]);
      ok(order.every((v, i, a) => i === 0 || v >= a[i - 1]), 'the bands are in run order (' + order.join(' -> ') + ')');
      ok(b.download[1] === b.decode[0] && b.decode[1] === b.encode[0], 'the bands meet with no gap and no overlap');
      ok(run.ytBandPct('resolve', 0) === 0 && run.ytBandPct('encode', 1) === 100, 'a band maps 0..1 onto its own range');
      const mid = run.ytBandPct('download', 0.5);
      ok(mid > b.download[0] && mid < b.download[1], 'half a download is halfway through its band (' + Math.round(mid) + '%)');
      ok(run.ytBandPct('download', 5) === b.download[1] && run.ytBandPct('download', -5) === b.download[0], 'a fraction outside 0..1 is clamped');
      // The clamp: a retried stream starts its download again from nothing.
      run.setStatus('Downloading the audio', 96);
      ok(run.now() === 96, 'the bar follows the run');
      run.setStatus('Downloading the audio', run.ytPct(run.ytBandPct('download', 0)));
      ok(run.now() === 96, 'a retry cannot drag the bar backwards (' + run.now() + '%)');
      ok(run.ytPct(run.ytBandPct('encode', 1)) === 100, 'and the run still finishes at 100%');
      ok(calls.length >= 2 && calls.every((p) => typeof p === 'number'), 'every status call handed the pill a number (' + calls.length + ')');
      ok(calls.lastIndexOf(96) !== -1, 'the pill was given the run, not the phase');
    } catch (e) { ok(false, 'band model executed: ' + e.message); }
  }
}

console.log('[4] the download reports real bytes (behaviour)');
{
  const start = src.indexOf('  async function scFetchBytes(url, expectedSize, onProgress){');
  const end = src.indexOf('  // ---- Play build acquisition layer', start);
  ok(start !== -1 && end !== -1, 'scFetchBytes is extractable');
  if (start !== -1 && end !== -1) {
    const code = src.slice(start, end);
    const MiB = 1024 * 1024;
    // The reader walks 1 MiB ranges; the stub serves `served` bytes of a `want`
    // byte file and reports the size the way the real server does.
    const attempt = async (want, served, expected, withCallback) => {
      const seen = [];
      const scFetchRange = async (url, off, end2) => {
        const ask = end2 - off + 1;
        const left = Math.max(0, Math.min(served, want) - off);
        if (left <= 0) return null;
        const len = Math.min(ask, left);
        return { bytes: new Uint8Array(len), partial: len === ask, total: expected === undefined ? served : expected };
      };
      const fn = new Function('scFetchRange', 'SC_AUDIO_CHUNK', 'SC_AUDIO_MAX', 'window', `
        ${code}
        return scFetchBytes;
      `)(scFetchRange, MiB, 40 * MiB, {});
      const cb = withCallback === false ? undefined : (loaded, total) => seen.push(loaded / total);
      const buf = await fn('u', expected === undefined ? 0 : expected, cb);
      return { seen, len: buf ? buf.byteLength : 0 };
    };

    const r1 = await attempt(3 * MiB, 3 * MiB, 3 * MiB);
    ok(r1.seen.length === 3, 'one report per chunk read (' + r1.seen.length + ')');
    ok(r1.seen[0] > 0 && r1.seen[0] < r1.seen[1] && r1.seen[1] < r1.seen[2], 'the reports climb (' + r1.seen.map((f) => Math.round(f * 100) + '%').join(' ') + ')');
    ok(r1.seen[2] === 1, 'the last read finishes the bar (100%)');
    ok(r1.len === 3 * MiB, 'and the whole stream still comes back (' + r1.len + ' bytes)');

    const r2 = await attempt(3 * MiB, 3 * MiB, undefined);
    ok(r2.seen.length && r2.seen[r2.seen.length - 1] === 1, 'the size the first reply reports is used when the player gives none');

    // A stream that stops at its first megabyte is NOT the file: the guard that
    // stops a truncated preview being saved as a song has to survive this change.
    const r3 = await attempt(8 * MiB, 1 * MiB, 8 * MiB);
    ok(r3.len === 0, 'a truncated stream is still refused, not saved');

    // 40 MiB is the read ceiling, so a longer stream is measured against it.
    const r4 = await attempt(100 * MiB, MiB, 100 * MiB);
    ok(r4.seen.length === 1 && Math.abs(r4.seen[0] - 1 / 40) < 1e-9, 'a stream past the ceiling is measured against the ceiling');

    // ... and no callback at all must still work: the reader keeps its old contract.
    const r5 = await attempt(2 * MiB, 2 * MiB, 2 * MiB, false);
    ok(r5.len === 2 * MiB, 'a caller that passes no callback is unaffected');

    ok(src.includes('if(onProgress) onProgress(total > 0 ? loaded / total : 0);'), 'scFetchDecode forwards those bytes to the caller');
    ok(/scFetchBytes\(s\.url, s\.size, function\(loaded, total\)\{/.test(src), 'and it is the YouTube path that passes them');
  }
}

console.log('[5] the release carries both claims');
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
const head = entries && entries[0];
ok(!!head && head.version === (src.match(/const APP_VERSION = '([^']+)'/) || [])[1], 'the head entry matches APP_VERSION');
const note = head ? (head.items || []).find((i) => /progress bar on a YouTube conversion was guessing/.test(i)) : null;
ok(!!note, 'the release notes say what changed');
ok(!!note && note.startsWith('[FULL] '), 'and are marked download-only, so the Play notes never name a converter');
// The head entry is the release both channels describe, so nothing in it - [FULL]
// items included - may read as a downloader (dev/test-619 and friends).
ok(!/\bdownload|converter|convert\b/i.test((head ? head.items : []).join('\n')), 'the head entry carries no downloader wording');
ok(!!note && head.items.indexOf(note) >= 6, 'and the note sits outside the six items both channels publish');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed  (' + path.basename(HTML) + ')');
process.exit(fail ? 1 : 0);
