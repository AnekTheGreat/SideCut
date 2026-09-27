#!/usr/bin/env node
// SideCut - 63.1.3, part two: the converting banner, without the glyph and without
// a made-up percentage.
//
// The report: on a YouTube -> MP3 run the "Converting" banner carried a download
// arrow in front of the word Converting, and the progress bar was "not accurate
// at all". Both were real and both came from the same place - one bar with four
// things reporting into it and no single owner:
//
//   * it OPENED at a hard-coded 15%, before any work had started;
//   * it then sat there for the download, which is the longest wait of the whole
//     run, because nothing measured it;
//   * and it slid BACKWARDS when a stream had to be retried, because the encoder
//     reported its own 0-100 into the same bar.
//
// The fix is one honest number for the run: four bands (audio lookup, download,
// decode, encode), the download measured in bytes actually received through the
// range reader, and a clamp so the bar can only ever move forwards. The glyph was
// a literal character in the banner and status strings that feed the pill, the
// bell and the card - all of them can be reached mid-run, so all of them go.
//
//   node dev/patch-655.mjs
//
// The characters this rewrites are BUILT from code points rather than typed, so
// this file stays ASCII while its old strings still match index.html byte for
// byte. Idempotent: a rerun is a no-op, and the run ends with a verification
// pass that exits non-zero if any part did not land.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

const cp = (n) => String.fromCodePoint(n);
const DD = cp(0x23ec);   // down-pointing double triangle (the reported glyph)
const HG = cp(0x23f3);   // hourglass
const DA = cp(0x2b07);   // down arrow
const MD = cp(0x2014);   // em dash
const ELL = cp(0x2026);  // ellipsis
const DOT = cp(0x00b7);  // middle dot, used by the pill titles

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('+ ' + label); edits++; };

// `marker` is for a step whose output a LATER step rewrites: the step is done
// when that later text is there, so a rerun skips both halves instead of looking
// for text that the second half has already replaced.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// Replace when the old text is there, do nothing when it never was: a tree that
// never carried an earlier draft still gets the final text.
function reword(label, oldStr, newStr) {
  const got = src.split(oldStr).length - 1;
  if (got === 0) return skip(label);
  if (got !== 1) throw new Error(label + ': found ' + got + ' occurrence(s), want 1');
  src = src.split(oldStr).join(newStr);
  done(label);
}

// For a move: take the text out here, put it back somewhere else.
function del(label, oldStr, want) {
  const got = src.split(oldStr).length - 1;
  if (got === 0) return skip(label);
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join('');
  done(label);
}

// ---- 1. the glyph, in every string the converting banner can show ------------
sub('bell body entry',
  'color:var(--coral);">' + DD + ' Converting ' + MD + ' ${escapeHtml(cv.title || \'working' + ELL + '\')}</div>',
  'color:var(--coral);">Converting ' + MD + ' ${escapeHtml(cv.title || \'working' + ELL + '\')}</div>');

sub('bell summary entry',
  'color:var(--coral);">' + DD + ' Converting ${Math.max(0, Math.min(100, Math.round(window.__scNotifConv.pct || 0)))}%' + ELL + '</div>',
  'color:var(--coral);">Converting ${Math.max(0, Math.min(100, Math.round(window.__scNotifConv.pct || 0)))}%' + ELL + '</div>');

sub('card title (escape form)',
  'margin-bottom:4px;">\\u23f3 Converting...</div>\' +',
  'margin-bottom:4px;">Converting' + ELL + '</div>\' +');

sub('card status line',
  'text-align:left;">' + HG + ' Converting...</div></div></div>\';',
  'text-align:left;">Starting' + ELL + '</div></div></div>\';');

sub('spotify status: fetching track info',
  'csLoading(\'' + HG + ' Fetching track info...\');',
  'csLoading(\'Fetching track info' + ELL + '\');');

sub('spotify status: finding audio',
  'csSetStatus(\'' + HG + ' Finding audio...\');',
  'csSetStatus(\'Finding audio' + ELL + '\');');

sub('status: music audio is bundled with the video',
  'onStatus(\'' + DA + ' Music audio comes bundled with the video ' + MD + ' downloading that instead (a bigger file)' + ELL + '\');',
  'onStatus(\'Music audio comes bundled with the video ' + MD + ' downloading that instead (a bigger file)' + ELL + '\');');

sub('status: downloading the audio on your device',
  'onStatus(\'' + DA + ' Downloading the audio on your device (a few seconds)' + ELL + '\');',
  'onStatus(\'Downloading the audio on your device (a few seconds)' + ELL + '\');',
  2);

// ---- 2. one honest number for the whole run --------------------------------
sub('progress model + setStatus',
  '    window.__scCancelDl = false; scConvertPillResetCancel();\n' +
  '    scConvertPillUpdate(\'Converting ' + DOT + ' YouTube\', \'Starting' + ELL + '\', 15);\n' +
  '    // Update the status line live so the user can see the fallback move MP3 -> WAV.\n' +
  '    function setStatus(txt){\n' +
  '      if(resultEl){\n' +
  '        var st = resultEl.querySelector(\'.dp-yt-status\');\n' +
  '        if(st) st.textContent = txt;\n' +
  '      }\n' +
  '      if(txt) scConvertPillUpdate(\'Converting ' + DOT + ' \' + (title || \'YouTube\'), txt);\n' +
  '    }\n',

  '    window.__scCancelDl = false; scConvertPillResetCancel();\n' +
  '    // One honest number for the whole run. The audio lookup, the download, the\n' +
  '    // decode and the encode are the four things that take time here, and each of\n' +
  '    // them used to report its own 0-100 into the same bar: it opened at a made-up\n' +
  '    // 15%, sat there through the download ' + MD + ' the longest wait of the four ' + MD + ' and\n' +
  '    // then jumped around as the encoder counted its own way, sliding backwards\n' +
  '    // whenever a stream had to be retried. Each phase now reports what it actually\n' +
  '    // knows, inside its own band, and the number can only ever move forwards.\n' +
  '    var YT_BANDS = { resolve: [0, 8], download: [8, 62], decode: [62, 70], encode: [70, 100] };\n' +
  '    var _ytPct = 0;\n' +
  '    function ytBandPct(band, frac){\n' +
  '      var b = YT_BANDS[band] || [0, 100];\n' +
  '      var f = Math.max(0, Math.min(1, Number(frac) || 0));\n' +
  '      return b[0] + (b[1] - b[0]) * f;\n' +
  '    }\n' +
  '    // Update the status line live so the user can see the fallback move MP3 -> WAV.\n' +
  '    // The percentage is the run\'s, never a phase\'s, so the words and the bar always\n' +
  '    // agree. Called with no pct it leaves the bar where it is.\n' +
  '    function setStatus(txt, pct){\n' +
  '      if(typeof pct === \'number\'){\n' +
  '        pct = Math.max(0, Math.min(100, Math.round(pct)));\n' +
  '        if(pct < _ytPct) pct = _ytPct;   // a retried stream must not undo the bar\n' +
  '        _ytPct = pct;\n' +
  '      }\n' +
  '      if(resultEl){\n' +
  '        var st = resultEl.querySelector(\'.dp-yt-status\');\n' +
  '        if(st) st.textContent = txt;\n' +
  '      }\n' +
  '      if(txt) scConvertPillUpdate(\'Converting ' + DOT + ' \' + (title || \'YouTube\'), txt, _ytPct);\n' +
  '    }\n' +
  '    setStatus(\'Starting' + ELL + '\', 0);\n',
  1, "if(typeof pct === 'number') ytPct(pct);");

sub('resolve band',
  '      var audio = await scYtPlayer(videoId);\n',
  '      setStatus(\'Looking for the \' + fmt.toUpperCase() + \' audio' + ELL + '\', ytBandPct(\'resolve\', 1));\n' +
  '      var audio = await scYtPlayer(videoId);\n');

sub('download + decode bands',
  '      var dec = await scFetchDecode(audio);\n',
  '      setStatus(\'Downloading the audio' + ELL + '\', ytBandPct(\'download\', 0));\n' +
  '      // scFetchDecode reports real bytes while it downloads the stream.\n' +
  '      var dec = await scFetchDecode(audio, function(txt){ setStatus(txt); }, function(frac){\n' +
  '        var _dp = ytBandPct(\'download\', frac);\n' +
  "        setStatus('Downloading the audio " + MD + " ' + Math.round(_dp) + '%', _dp);\n" +
  '      });\n' +
  '      if(dec) setStatus(\'Decoding the audio' + ELL + '\', ytBandPct(\'decode\', 1));\n',
  1, "if(frac >= 1){ setStatus(");

sub('encode band callback',
  'function(p){ if(p > 0 && p < 1) setStatus(',
  'function(p){ var _ep = ytBandPct(\'encode\', p); if(p > 0) setStatus(');

sub('encode band percentage',
  'Math.round(p * 100) + \'%\'); }); }',
  'Math.round(_ep) + \'%\'); }); }');

sub('scFetchDecode signature',
  '  async function scFetchDecode(stream, onStatus){',
  '  async function scFetchDecode(stream, onStatus, onProgress){');

sub('download progress callback',
  '        var ab = await scFetchBytes(s.url, s.size);\n',
  '        var ab = await scFetchBytes(s.url, s.size, function(loaded, total){\n' +
  '          // Real bytes, not a guess: the player usually hands over the stream\'s\n' +
  '          // length, which is what lets the bar follow the download itself.\n' +
  '          if(onProgress) onProgress(total > 0 ? loaded / total : 0);\n' +
  '        });\n');

sub('scFetchBytes signature',
  '  async function scFetchBytes(url, expectedSize){',
  '  async function scFetchBytes(url, expectedSize, onProgress){');

sub('byte progress inside the read loop',
  '      total += part.bytes.length;\n' +
  '      // The first reply tells us the real size even when the player didn\'t.\n' +
  '      if(!expectedSize && part.total) expectedSize = part.total;\n',
  '      total += part.bytes.length;\n' +
  '      // The first reply tells us the real size even when the player didn\'t.\n' +
  '      if(!expectedSize && part.total) expectedSize = part.total;\n' +
  '      if(onProgress){\n' +
  '        // 40 MiB is this reader\'s ceiling, so a long stream is measured against\n' +
  '        // the ceiling rather than against a length it can never reach.\n' +
  '        var _want = expectedSize ? Math.min(expectedSize, SC_AUDIO_MAX) : 0;\n' +
  '        if(_want > 0){ try{ onProgress(Math.min(total, _want), _want); }catch(_op){} }\n' +
  '      }\n');

// ---- 2b. one owner for the number, so the words match the bar --------------
// The download text is built from the same clamped figure the bar is drawn at,
// so a retry can never show "20%" next to a bar sitting at 62%, and the phase
// changes when the read ends rather than after the decode has already happened.
sub('clamp helper',
  '    var _ytPct = 0;\n' +
  '    function ytBandPct(band, frac){\n' +
  '      var b = YT_BANDS[band] || [0, 100];\n' +
  '      var f = Math.max(0, Math.min(1, Number(frac) || 0));\n' +
  '      return b[0] + (b[1] - b[0]) * f;\n' +
  '    }\n' +
  '    // Update the status line live so the user can see the fallback move MP3 -> WAV.\n' +
  '    // The percentage is the run\'s, never a phase\'s, so the words and the bar always\n' +
  '    // agree. Called with no pct it leaves the bar where it is.\n' +
  '    function setStatus(txt, pct){\n' +
  '      if(typeof pct === \'number\'){\n' +
  '        pct = Math.max(0, Math.min(100, Math.round(pct)));\n' +
  '        if(pct < _ytPct) pct = _ytPct;   // a retried stream must not undo the bar\n' +
  '        _ytPct = pct;\n' +
  '      }\n',

  '    var _ytPct = 0;\n' +
  '    function ytBandPct(band, frac){\n' +
  '      var b = YT_BANDS[band] || [0, 100];\n' +
  '      var f = Math.max(0, Math.min(1, Number(frac) || 0));\n' +
  '      return b[0] + (b[1] - b[0]) * f;\n' +
  '    }\n' +
  '    // The one place that owns the number: clamped so a retried stream cannot undo\n' +
  '    // the bar, and returned so the words can show the figure the bar is drawn at.\n' +
  '    function ytPct(p){\n' +
  '      p = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));\n' +
  '      if(p < _ytPct) p = _ytPct;\n' +
  '      _ytPct = p;\n' +
  '      return p;\n' +
  '    }\n' +
  '    // Update the status line live so the user can see the fallback move MP3 -> WAV.\n' +
  '    // Called with no pct it leaves the bar where it is.\n' +
  '    function setStatus(txt, pct){\n' +
  '      if(typeof pct === \'number\') ytPct(pct);\n');

sub('download text + phase change',
  '      setStatus(\'Downloading the audio' + ELL + '\', ytBandPct(\'download\', 0));\n' +
  '      // scFetchDecode reports real bytes while it downloads the stream.\n' +
  '      var dec = await scFetchDecode(audio, function(txt){ setStatus(txt); }, function(frac){\n' +
  '        var _dp = ytBandPct(\'download\', frac);\n' +
  "        setStatus('Downloading the audio " + MD + " ' + Math.round(_dp) + '%', _dp);\n" +
  '      });\n' +
  '      if(dec) setStatus(\'Decoding the audio' + ELL + '\', ytBandPct(\'decode\', 1));\n',

  '      setStatus(\'Downloading the audio' + ELL + '\', ytBandPct(\'download\', 0));\n' +
  '      // scFetchDecode reports real bytes while it downloads the stream, and the\n' +
  '      // read is finished exactly when the fraction reaches 1: the decode that\n' +
  '      // follows has no progress of its own, so that is where the phase changes.\n' +
  '      var dec = await scFetchDecode(audio, function(txt){ setStatus(txt); }, function(frac){\n' +
  '        if(frac >= 1){ setStatus(\'Decoding the audio' + ELL + '\', ytBandPct(\'decode\', 1)); return; }\n' +
  '        var _p = ytPct(ytBandPct(\'download\', frac));\n' +
  "        setStatus('Downloading the audio " + MD + " ' + _p + '%', _p);\n" +
  '      });\n');

fs.writeFileSync(FILE, src);

// ---- 4. repin the audits that pinned the surrendered strings ---------------
function patchFile(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to repin)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== before) fs.writeFileSync(p, t);
}

patchFile('dev/test-6056.mjs', [
  ['ok(src.includes(\'' + DD + ' Converting ' + MD + ' \'), \'bell entry rendered\');',
   'ok(src.includes(\'Converting ' + MD + ' \'), \'bell entry rendered\');'],
]);

patchFile('dev/test-6053.mjs', [
  // The reason-3 assertions read a window of the helper's source. The 63.1
  // progress bands made the helper longer than the old character count allowed,
  // so the window is now the helper itself - bounded by the next top-level
  // function - rather than a number that has to be re-guessed on every edit.
  ['  const ytBody = src.slice(ytPos, ytPos + 2200);',
   '  const ytEnd = src.indexOf(\'\\n  function \', ytPos);\n' +
   '  const ytBody = src.slice(ytPos, ytEnd === -1 ? ytPos + 3400 : ytEnd);'],
]);

// ---- 5. verification pass --------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (cond, msg) => { if (!cond) problems.push(msg); };
must(final.indexOf(DD) === -1, 'the double-triangle glyph is still in index.html');
must(final.indexOf('\\u23f3 Converting') === -1, 'the escaped hourglass title is still there');
must(final.indexOf(HG + ' Converting') === -1, 'the hourglass status line is still there');
must(final.indexOf(HG + ' Fetching track info') === -1, 'the hourglass spotify status is still there');
must(final.indexOf(HG + ' Finding audio') === -1, 'the hourglass spotify status is still there');
must(final.indexOf(DA + ' Music audio comes bundled') === -1, 'the arrow on the bundled-audio status is still there');
must(final.indexOf(DA + ' Downloading the audio on your device') === -1, 'the arrow on the download status is still there');
must(final.indexOf('scConvertPillUpdate(\'Converting ' + DOT + ' YouTube\', \'Starting' + ELL + '\', 15)') === -1,
  'the YouTube run still opens at a hard-coded 15%');
must(final.indexOf('function ytBandPct(band, frac){') !== -1, 'the band helper is missing');
must(final.indexOf('setStatus(\'Starting' + ELL + '\', 0);') !== -1, 'the run does not open on a real zero');
must(final.indexOf('async function scFetchBytes(url, expectedSize, onProgress){') !== -1, 'scFetchBytes takes no progress callback');
must(final.indexOf('if(onProgress) onProgress(total > 0 ? loaded / total : 0);') !== -1, 'the download reports no bytes');
must(final.indexOf('function ytPct(p){') !== -1, 'the bar has no single owner for its number');
must(final.indexOf('if(p < _ytPct) p = _ytPct;') !== -1, 'the bar is not clamped to one direction');
must(final.indexOf('Math.round(_dp)') === -1, 'the download text can still disagree with the bar');
must(final.indexOf('var _ep = ytBandPct(\'encode\', p);') !== -1, 'the encode callback is not band-mapped');

console.log('patch-655: ' + edits + ' index.html edit(s)');
if (problems.length) {
  console.error('patch-655 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-655 verify: OK (no glyph left in the converting banner, bar driven by one number)');
