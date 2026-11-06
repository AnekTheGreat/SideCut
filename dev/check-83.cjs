#!/usr/bin/env node
/**
 * 83 - the speed is the song's, in the song's settings, and the mixes carry it.
 *
 * This drives the new code instead of grepping for it:
 *   - scStretchBuffer, lifted out of the page, is fed a 440Hz tone and must come back
 *     at 440Hz (pitch kept) at the right length, at 1.5x and at 0.5x, in stereo with
 *     the two channels in step, and 1x must be the very same object back;
 *   - the song sheet's slider must call scSpeedSet with the song's id (not the
 *     player's setPlaybackSpeed), and the now bar must carry no speed chip;
 *   - setPlaybackSpeed must apply the song's own rate through scSpeedFor;
 *   - the mix decode path must stretch each track by its own rate;
 *   - every inline script in the page must compile.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let fails = 0, checks = 0;

function ok(what) { checks++; }
function bad(what, detail) { checks++; fails++; console.log('FAIL ' + what + (detail ? ' — ' + detail : '')); }
function is(what, cond, detail) { cond ? ok(what) : bad(what, detail); }

// ---------- the function, as the page writes it ----------
const m = html.match(/  function scStretchBuffer\(ctx, buf, rate\)\{[\s\S]*?\n  \}\n/);
if (!m) { console.log('FAIL scStretchBuffer is not in the page'); process.exit(1); }
const fn = new Function(m[0] + '\nreturn scStretchBuffer;')();

// A stub AudioContext: just enough for ctx.createBuffer.
const ctx = {
  createBuffer(ch, len, sr) {
    const data = [];
    for (let i = 0; i < ch; i++) data.push(new Float32Array(len));
    return {
      numberOfChannels: ch, length: len, sampleRate: sr,
      getChannelData: (i) => data[i],
    };
  },
};

function tone(seconds, freq, sr, ch) {
  const len = Math.round(seconds * sr);
  const buf = ctx.createBuffer(ch, len, sr);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sr + (c ? 0.3 : 0));
  }
  return buf;
}

// Zero crossings per second over the middle of the signal -> the frequency it sounds at.
function freqOf(arr, sr, fromSec, toSec) {
  const a = Math.max(1, Math.floor(fromSec * sr)), b = Math.min(arr.length, Math.floor(toSec * sr));
  let cross = 0;
  for (let i = a + 1; i < b; i++) if ((arr[i - 1] < 0 && arr[i] >= 0) || (arr[i - 1] >= 0 && arr[i] < 0)) cross++;
  return (cross / 2) / ((b - a) / sr);
}

const SR = 44100;
const src = tone(2.0, 440, SR, 2);

for (const rate of [1.5, 0.5, 0.75, 2]) {
  const out = fn(ctx, src, rate);
  const wantLen = Math.round(src.length / rate);
  const lenOk = Math.abs(out.length - wantLen) <= 2;
  is(`stretch ${rate}x length`, lenOk, `got ${out.length}, want ${wantLen}`);
  const f = freqOf(out.getChannelData(0), SR, 0.4, Math.min(1.2, out.length / SR - 0.1));
  is(`stretch ${rate}x keeps 440Hz`, Math.abs(f - 440) < 8, `sounds ${f.toFixed(1)}Hz`);
  // Stereo channels must move together or the image smears.
  const L = out.getChannelData(0), R = out.getChannelData(1);
  let agree = 0, seen = 0;
  for (let i = Math.floor(out.length * 0.3); i < Math.floor(out.length * 0.6); i += 7) {
    seen++;
    if ((L[i] < 0) === (R[i] < 0)) agree++;
  }
  is(`stretch ${rate}x keeps the channels in step`, agree / seen > 0.9, `${(100 * agree / seen).toFixed(0)}% agree`);
  let peak = 0, nan = false;
  for (let i = 0; i < out.length; i++) {
    if (!Number.isFinite(L[i])) nan = true;
    peak = Math.max(peak, Math.abs(L[i]));
  }
  is(`stretch ${rate}x is finite and audible`, !nan && peak > 0.2 && peak < 1.2, `peak ${peak.toFixed(2)}`);
}

is('1x is the same buffer back', fn(ctx, src, 1) === src);
is('a garbage rate is clamped, not thrown', (() => {
  try { const o = fn(ctx, src, 'nonsense'); return o === src; } catch (e) { return false; }
})());

// ---------- the controls ----------
const sheetStart = html.indexOf('scSpeedPaintSheet');
const sheet = html.slice(sheetStart - 2600, sheetStart + 2600);
is('the song sheet slider writes this song\'s rate',
  /addEventListener\('input', \(e\) => \{\s*scSpeedSet\(t\.id, parseFloat\(e\.target\.value\)\)/.test(sheet));
is('the song sheet says it is this song only', sheet.includes('this song only'));
is('the song sheet has a Reset', sheet.includes('actionSpeedReset'));
is('the song sheet no longer calls setPlaybackSpeed', !/setPlaybackSpeed\(parseFloat/.test(sheet));

is('the now bar creates no speed chip', !/chip\.id = 'scSpeedChip'/.test(html));
is('the page still clears a stale chip', /removeChild\(stale\)/.test(html));

const sp = html.match(/function setPlaybackSpeed\(v\)\{[\s\S]*?\n  \}/);
is('setPlaybackSpeed applies the song\'s own rate', !!sp && /scSpeedFor\(scSpeedPlayingId\(\)\)/.test(sp[0]));
is('setPlaybackSpeed no longer paints the song sheet slider', !!sp && !/actionSpeedSlider/.test(sp[0]));

is('the mix decode stretches each track by its own rate',
  /const _rate = scSongSpeed\(t\.id\);[\s\S]{0,200}scStretchBuffer\(decCtx, buf, _rate\)/.test(html));
is('the mix still blends untouched songs as before',
  /Math\.abs\(_rate - 1\) < 0\.001\) \? buf : scStretchBuffer/.test(html));

// ---------- version surfaces ----------
const v = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
is('the page names 83', v === '83', 'says ' + v);
is('the changelog carries 83', /version: '83'/.test(html));
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
is('the service worker cache is named v83', /sidecut-shell-v83/.test(sw));

// ---------- every inline script compiles ----------
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/(json|ld))[^>]*>([\s\S]*?)<\/script>/g)];
is('the page has its script blocks', blocks.length >= 6, String(blocks.length));
let compiled = 0;
for (const b of blocks) {
  try { new Function(b[2]); compiled++; } catch (e) { bad('a script block does not compile', e.message); }
}
is('every inline script compiles (' + compiled + '/' + blocks.length + ')', compiled === blocks.length);

console.log((fails ? 'FAILED ' : 'PASS ') + checks + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
