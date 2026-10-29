#!/usr/bin/env node
/**
 * dev/check-8068.cjs - the word pacing of 80.6.8, driven directly.
 *
 * The release says three things can now be true that were not:
 *
 *   1. a sheet that stamps its own words is paced by those stamps, not by a
 *      syllable guess;
 *   2. the light lands on the LAST start the playhead has passed, so a word with
 *      a window narrower than the poll cannot be skipped;
 *   3. a line whose first word is sung after the line's own stamp still lights a
 *      word instead of sitting dark.
 *
 * So this drives the shipped functions rather than reading them. The ones that
 * matter are sliced out of index.html by name and run against synthetic sheets,
 * stub spans and a synthetic onset envelope: no DOM, no audio, no network.
 *
 *   node dev/check-8068.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; return; }
  failures.push(msg);
}
function near(a, b, eps) { return typeof a === 'number' && Math.abs(a - b) <= (eps || 1e-6); }

/* ── slicing ─────────────────────────────────────────────────────────────── */
function sliceFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('no function ' + name + ' in the page');
  let depth = 0;
  for (let p = src.indexOf('{', start); p < src.length; p++) {
    const ch = src[p];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return src.slice(start, p + 1); }
  }
  throw new Error('unbalanced body for ' + name);
}

const tagSrc = page.match(/var SC_LRC_TAG_SRC = ('(?:[^'\\]|\\.)*');/);
ok(!!tagSrc, 'SC_LRC_TAG_SRC is in the page');

const sliced = [
  'var SC_LRC_TAG_SRC = ' + (tagSrc ? tagSrc[1] : "''") + ';',
  sliceFn(page, 'scLrcTagRe'),
  sliceFn(page, 'scPaceSegments'),
  sliceFn(page, 'scSyllableCount'),
  sliceFn(page, 'scDeGlyph'),
  sliceFn(page, 'scLrcBody'),
  sliceFn(page, 'scWordParts'),
  sliceFn(page, 'scSheetWordStarts'),
  sliceFn(page, 'scPickLitIdx'),
  sliceFn(page, 'scWordStartsForWindow'),
].join('\n\n');

const ctx = vm.createContext({ console });
vm.runInContext(sliced, ctx);

/* ── 1. the sheet's own stamps ───────────────────────────────────────────── */
const repeated = '[00:12.00][00:55.00]<00:12.00>Hello <00:12.62>world';
const body = ctx.scLrcBody(repeated);
ok(body === '<00:12.00>Hello <00:12.62>world',
  'scLrcBody leaves the inline stamps alone and takes the repeated-line stamps off (got ' + JSON.stringify(body) + ')');

const parts = ctx.scWordParts(body, 12);
const words = parts.filter(p => !p.space);
ok(words.length === 2, 'the stamped body splits into two words (got ' + words.length + ')');
ok(words[0] && words[0].w === 'Hello', 'the first word is Hello');
ok(words[1] && words[1].w === 'world', 'the second word is world');
ok(words[0] && near(words[0].at, 12), 'Hello starts on its own stamp (got ' + (words[0] && words[0].at) + ')');
ok(words[1] && near(words[1].at, 12.62), 'world starts on its own stamp (got ' + (words[1] && words[1].at) + ')');
ok(parts.map(p => p.w).join('') === 'Hello world', 'the words and spaces still spell the line exactly');
ok(!/<|<|00:12/.test(parts.map(p => p.w).join('')), 'no stamp is left in the text that is drawn');

const plain = ctx.scWordParts('Hello there friend', 5);
ok(plain.filter(p => !p.space).every(p => p.at === null),
  'a sheet with no stamps leaves every word unstamped, which is what keeps the old pacing');
ok(plain.map(p => p.w).join('') === 'Hello there friend', 'a plain line is spelled exactly as before');
ok(plain.filter(p => !p.space).length === 3, 'and counts three words');

const japanese = ctx.scWordParts('\u3053\u3093\u306b\u3061\u306f', 3);
ok(japanese.filter(p => !p.space).length >= 2, 'a run with no spaces is still split into pacing units');

/* ── 2. the starts a stamped sheet gives ─────────────────────────────────── */
function stubNode(at, text) {
  return { dataset: at == null ? {} : { wordAt: String(at) }, textContent: text };
}
const mixed = ctx.scSheetWordStarts(
  [stubNode(12, 'Hello'), stubNode(null, 'there'), stubNode(null, 'friend'), stubNode(15, 'now')],
  12, 16);
ok(Array.isArray(mixed) && mixed.length === 4, 'a mixed sheet gives four starts');
ok(near(mixed[0], 12), 'a stamped word keeps its own start');
ok(near(mixed[3], 15), 'the second stamped word keeps its own start');
ok(mixed[1] > mixed[0] && mixed[2] > mixed[1], 'the words between two stamps are in order');
ok(mixed[1] > 12 && mixed[2] < 15, 'and they sit inside the gap they are shared across');

const unstamped = ctx.scSheetWordStarts([stubNode(null, 'a'), stubNode(null, 'b')], 1, 2);
ok(unstamped === null, 'a sheet with no stamps hands the line back to the recording, not to a fake list');

const backwards = ctx.scSheetWordStarts(
  [stubNode(12.5, 'Hello'), stubNode(12.1, 'there')], 12, 16);
ok(backwards[1] > backwards[0], 'a stamp that would rewind the line is pulled forward');

const long = ctx.scSheetWordStarts(
  [stubNode(10, 'a'), stubNode(null, 'b'), stubNode(null, 'c'), stubNode(null, 'd')], 10, 14);
ok(long[3] > long[2] && long[2] > long[1], 'an unstamped tail keeps moving after its last stamp');

/* ── 3. the pick cannot skip a word ──────────────────────────────────────── */
const starts = [0, 0.05, 0.10, 0.15];
ok(ctx.scPickLitIdx(starts, 0.11) === 2, 'the word lit at 0.11s is the third, not a window match');
ok(ctx.scPickLitIdx(starts, 0.051) === 1, 'a start 10ms behind the playhead is still reached');
ok(ctx.scPickLitIdx(starts, 0.049) === 0, 'and nothing ahead of the playhead is lit');
ok(ctx.scPickLitIdx(starts, -1) === -1, 'before the first start nothing is picked');
let prev = -1;
let monotone = true;
for (let t = 0; t <= 0.2; t += 0.005) {
  const idx = ctx.scPickLitIdx(starts, t);
  if (idx < prev) monotone = false;
  prev = idx;
}
ok(monotone, 'the pick never goes backwards as the playhead advances');
let seen = {};
for (let t = 0; t <= 0.2; t += 0.05) seen[ctx.scPickLitIdx(starts, t)] = 1;
ok(seen[1] && seen[2], 'words with a 50ms window are still picked at the 50ms poll');

/* ── 4. the window's tail no longer collapses ────────────────────────────── */
function envelope(peaks, frames) {
  const env = new Array(frames).fill(0);
  peaks.forEach(p => {
    env[p] = 1;
    if (p - 1 >= 0) env[p - 1] = 0.62;
    if (p - 2 >= 0) env[p - 2] = 0.34;
    if (p + 1 < frames) env[p + 1] = 0.48;
  });
  return env;
}
const hop = 0.05;
const env = envelope([100, 140, 180, 220], 400);

const four = ctx.scWordStartsForWindow(4, 5, 12, env, hop);
ok(Array.isArray(four) && four.length === 4, 'four words against four rises gives four starts');
let ordered = true;
for (let i = 1; i < four.length; i++) if (!(four[i] > four[i - 1])) ordered = false;
ok(ordered, 'one rise per word: the starts are strictly increasing');
ok(four[four.length - 1] <= 12, 'and the last start is inside the window');

const many = ctx.scWordStartsForWindow(10, 5, 12, env, hop);
ok(many.length === 10, 'ten words in a window with four rises still places ten');
let spread = true;
for (let i = 1; i < many.length; i++) if (!(many[i] > many[i - 1])) spread = false;
ok(spread, 'fewer rises than words: the starts are still strictly increasing');
ok(many[many.length - 1] <= 12, 'and the tail stays inside the window instead of running past it');
const dupes = new Set(many.map(v => v.toFixed(3)));
ok(dupes.size === many.length, 'no two words share a start, which is what used to make one skippable');

const tight = ctx.scWordStartsForWindow(24, 30, 30.5, envelope([600, 605, 609], 700), hop);
ok(tight.length === 24, 'a very short window still returns a start per word');
ok(tight.every(v => isFinite(v)), 'and none of them is NaN');

/* ── 5. the release is in the page ───────────────────────────────────────── */
ok(page.includes("const APP_VERSION = '80.6.8';"), 'the page runs 80.6.8');
ok(page.includes('{ version: \'80.6.8\', date:'), 'the changelog records the release');
ok(page.includes('80.6.8 - THE LIGHT WALKS WORD TO WORD'), 'the release comment is in the script');
ok(page.includes("' data-word-at=\"' + p.at + '\"'"), 'the render stamps each timed word');
ok(page.includes('const starts = scSheetWordStarts(words, fromSec, toSec) ||'),
  'the sheet stamps are asked for before the recording is');
ok(page.includes("var words = scPaceSegments(String(rows[i].text || '').replace(scLrcTagRe(), ' ')"),
  'the words the measurement counts carry no stamps');
ok(page.includes('      out.push({ t: sec, text: m[4] });'),
  'scParseLrcLines still hands the raw row text on, so line-up keeps a sheet\'s stamps');
ok(!page.includes('if(starts[i] > to) starts[i] = to;'), 'the tail clamp that collapsed words is gone');
ok(!page.includes('if(nowSec >= wFrom && nowSec < wTo){ litIdx = si;'),
  'the contains-a-window pick is gone');
ok(!page.includes('Synthetic word timestamps evenly distributed'), 'the old render comment is gone');
ok(page.includes("'sidecut-shell-v80.6.8'") || fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'sidecut-shell-v80.6.8'"),
  'the shell cache is on 80.6.8');
ok(page.includes('var SC_WORD_TAIL = 0.45;'), 'the last-word hold is untouched');
ok(!page.includes('amberdusk'), 'the removed theme is still gone');

/* ── 6. every inline script still compiles ───────────────────────────────── */
const scripts = [...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
let compiled = 0, skipped = 0, broken = null, biggest = 0;
for (const m of scripts) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/.test(attrs)) { skipped++; continue; }
  const type = (attrs.match(/type\s*=\s*["']([^"']+)["']/) || [])[1];
  // A module is not a classic script: vm.Script cannot compile import/export, and
  // the page's own bundle is the classic one this release edits.
  if (type && !/javascript/.test(type)) { skipped++; continue; }
  const code = m[2];
  if (!code.trim()) continue;
  try {
    new vm.Script(code, { filename: 'inline-' + compiled });
    if (code.length > biggest) biggest = code.length;
    compiled++;
  } catch (err) {
    broken = 'inline script #' + compiled + ': ' + err.message;
    break;
  }
}
ok(!broken, broken || 'every inline script compiles');
ok(compiled >= 5, 'the inline scripts were actually found and compiled (got ' + compiled + ')');
ok(biggest > 500000, 'the app shell script itself was among them (largest compiled: ' + biggest + ' chars)');

/* ── report ──────────────────────────────────────────────────────────────── */
if (failures.length) {
  console.log('check-8068: ' + failures.length + ' FAILED, ' + pass + ' passed');
  failures.forEach(f => console.log('  FAIL  ' + f));
  process.exit(1);
}
console.log('check-8068: ' + pass + ' assertions passed (' + compiled + ' inline scripts compiled, '
  + skipped + ' script tags skipped)');
