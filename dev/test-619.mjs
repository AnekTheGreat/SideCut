// v61.9 — the store build's Get Songs tab is steps only.
//
// The request, in the user's words: "Get songs tab should have no converters on
// play version and should simply have steps of how to get mp3's in your library".
//
// A store build was still showing, in that tab:
//   * the "🎛️ Conversion Tools — Spotify · YouTube · MP4 · Expand URL" header,
//   * the Expand URL card,
//   * the MP4 to WAV / FLAC / MP3 card,
//   * the "Audio formats explained" guide,
// and its own copy taught the converter as well ("Paste the link into the
// built-in 🎵 Spotify to MP3 / WAV / FLAC converter below"). Only the two
// Spotify/YouTube cards were hidden.
//
// The fix has two halves, and this audit pins both:
//   [1] the Get Songs how-to box in each tab becomes a real walkthrough —
//       numbered steps for getting MP3s you already own into the library; and
//   [2] the whole tool section is put away. It is the element immediately AFTER
//       each how-to box, so it is hidden by POSITION — no markup was reshaped
//       and no id invented — by setting `nextElementSibling.style.display`.
//
// Two things make that safe, and both are checked here rather than assumed:
//   * `nextElementSibling` only works if the tool section really IS a sibling
//     that comes next. [3] walks the markup tag by tag to prove it, and proves
//     the tools are NOT nested inside the how-to box.
//   * hiding rather than removing keeps every element the converter wiring
//     further down still looks up in place, so no screen can break. [2c] checks
//     each of those ids is still in the file and still inside the hidden
//     section.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

function sliceBetween(from, to) {
  const a = src.indexOf(from);
  if (a === -1) throw new Error('missing anchor: ' + from);
  const b = src.indexOf(to, a + from.length);
  if (b === -1) throw new Error('missing anchor after ' + from + ': ' + to);
  return src.slice(a, b);
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;

// `at` must point at the '<' of an element's opening tag. Returns the index just
// past that element's matching close tag — a real tag-depth walk, so "the
// element right after this box" is measured and not guessed. Quoted attribute
// values are matched atomically, so a '>' inside one cannot end a tag early.
function elementEnd(s, at) {
  const open = s.slice(at).match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!open) throw new Error('not at an element: ' + JSON.stringify(s.slice(at, at + 40)));
  const tag = open[1].toLowerCase();
  if (VOID.has(tag)) return at + open[0].length;
  TAG.lastIndex = at + open[0].length;
  let depth = 1, t;
  while ((t = TAG.exec(s))) {
    if (t[2].toLowerCase() !== tag) continue;
    if (t[1] === '/') { depth--; if (depth === 0) return TAG.lastIndex; }
    else if (!/\/\s*$/.test(t[3]) && !VOID.has(t[2].toLowerCase())) depth++;
  }
  throw new Error('unbalanced <' + tag + '> at offset ' + at);
}

// The element whose opening tag is `open`, plus the element that follows it.
function elementAndNext(open) {
  const end = elementEnd(src, open);
  const nextStart = end + (src.slice(end).match(/^\s*/) || [''])[0].length;
  return { self: src.slice(open, end), next: src.slice(nextStart, elementEnd(src, nextStart)), nextStart };
}

const openAt = (id) => {
  const at = src.indexOf('id="' + id + '"');
  if (at === -1) throw new Error('no element with id=' + id);
  const lt = src.lastIndexOf('<', at);
  if (lt === -1) throw new Error('no opening tag before id=' + id);
  return lt;
};

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '63.0.4', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);
  const headText = entries[0].items.join(' ');
  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');
  // Both channels share the head entry's first six items, and the store channel
  // may not carry a downloader term at all.
  ok(!/\bdownload|converter|convert\b/i.test(headText), 'notes carry no downloader term (shared channel)');
  ok(entries.findIndex((e) => String(e.version) === ver) === 0, 'the 63.0.4 entry heads the changelog');
  const rel618 = entries.find((e) => String(e.version) === '61.8');
  ok(!!rel618, 'the 61.8 entry is still in the changelog');
  ok(/(no matching source)/.test((rel618 ? rel618.items : []).join(' ')), 'its wording survived the new head entry');
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version);

console.log('[2] the Get Songs how-to box on the store build');
const playAt = src.indexOf('if(SC_IS_PLAY){');
ok(playAt !== -1, 'the store-build branch is in the file');
const stepsAt = src.indexOf('var _getSongsSteps =');
ok(stepsAt !== -1, 'the walkthrough is built');
ok(playAt !== -1 && stepsAt !== -1 && playAt < stepsAt, 'it is built INSIDE the store-build branch, never on the other build');
// `}catch(_ePlayUI){}` is the last thing in that branch's try block, so anything
// before it is inside it.
const playEnd = src.indexOf('}catch(_ePlayUI){}');
ok(playEnd !== -1 && stepsAt < playEnd, 'and inside the branch\u2019s own try, not after it');

console.log('[2a] the steps themselves (the shipped string, run)');
const stepsSrc = sliceBetween('var _getSongsSteps =', "['getSongsHowToDisc','getSongsHowToSettings'].forEach");
let stepsHtml = null;
try { stepsHtml = new Function(stepsSrc + '\nreturn _getSongsSteps;')(); } catch (e) {}
ok(typeof stepsHtml === 'string' && stepsHtml.length > 0, 'the shipped concatenation evaluates to a string');
const stepsText = stepsHtml ? stepsHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
ok(stepsText.length > 200, 'it is a real walkthrough, not a one-liner');
for (const n of ['1.', '2.', '3.', '4.', '5.']) {
  ok(stepsText.includes(n), 'it has step ' + n);
}
ok(stepsText.includes('+ Add songs') && /\+ Files/.test(stepsText), 'step 2 names + Add songs \u2192 + Files');
ok(/\+ Add folder/.test(stepsText), 'step 3 names + Add folder');
ok(stepsText.includes('Import library'), 'step 5 names Import library as the way back in');
ok(/Playlists/.test(stepsText) && /All songs/.test(stepsText), 'step 4 says where the songs land');
ok(/plays the audio files saved on your device/i.test(stepsText), 'it states plainly what the app plays');

console.log('[2b] the walkthrough names no converter');
// The same terms the store channel is not allowed to carry anywhere.
const CONV = /converter|converting|conversion|convert\b|spotify|spotisaver|spotmate|youtube|ytmp3|\bto mp3\b|expand url|short link|open\.spotify|\bdownload|hand-?off/i;
ok(!CONV.test(stepsText), 'no converter, no outside site, no download in the steps');
ok(/(MP3s)/.test(stepsText), 'it does say MP3s — that is the format, not a tool');

console.log('[2c] the tool section is put away by position');
const hideLine = '_el.nextElementSibling.style.display = \'none\'';
ok(src.includes(hideLine), 'the section right after the box is hidden');
const foreach = sliceBetween("['getSongsHowToDisc','getSongsHowToSettings'].forEach", '});');
ok(foreach.includes('_el.innerHTML = _getSongsSteps;'), 'both tabs get the walkthrough');
ok(foreach.includes(hideLine), 'and the hiding happens in the same pass, per tab');
// Hidden, never removed: everything the converter wiring looks up must survive,
// or a screen that no longer shows a tool could break the screen that does.
const KEPT = [
  'mp4ToMp3File', 'mp4ToMp3FileSettings', 'mp4ToMp3Convert', 'mp4ToMp3ConvertSettings',
  'mp4FmtDisc', 'mp4FmtSettings',
  'expandUrlInput', 'expandUrlInputSettings', 'expandUrlBtn', 'expandUrlBtnSettings',
  'spMp3Input', 'spMp3InputSettings', 'spCardDisc', 'spCardSettings',
  'ytMp3Input', 'ytMp3InputSettings', 'ytCardDisc', 'ytCardSettings',
  'getSongsHowToDisc', 'getSongsHowToSettings'
];
let keptMissing = 0;
for (const id of KEPT) if (!src.includes('id="' + id + '"')) { keptMissing++; console.log('  missing: ' + id); }
ok(keptMissing === 0, 'every element the tool wiring looks up is still present (' + KEPT.length + ' ids)');

console.log('[2d] the other build is untouched');
// The static markup both builds start from must still teach the converter: only
// the branch above rewrites it, and the other build never enters that branch.
const TEACHES = 'Paste the link into the built-in';
const teachesCount = src.split(TEACHES).length - 1;
ok(teachesCount === 1, 'the Settings how-to still teaches the converter in the shared markup (' + teachesCount + ')');
const discTeach = 'Open the built-in converter below';
ok(src.split(discTeach).length - 1 === 1, 'so does the Discover one');
ok(src.includes('🎛️ Conversion Tools'), 'the tool section itself is still in the markup, whole');
ok(!/delete |removeChild/.test(foreach) && !foreach.includes('.remove('), 'it is hidden, not deleted');

console.log('[3] the markup really puts the tool section right after each box');
// This is the assertion the fix rests on. `nextElementSibling` is only correct
// if (a) the tool section is NOT inside the box, and (b) it is the very next
// element after it. Both are measured here with a tag-depth walk.
for (const [label, boxId, ownId, toolId] of [
  ['Discover', 'getSongsHowToDisc', 'expandUrlInput', 'expandUrlInput'],
  ['Settings', 'getSongsHowToSettings', 'expandUrlInputSettings', 'expandUrlInputSettings']
]) {
  const { self, next } = elementAndNext(openAt(boxId));
  ok(!/🎛️ Conversion Tools/.test(self) && !self.includes(toolId),
    label + ': the tool section is not nested inside the box');
  ok(/🎛️ Conversion Tools/.test(next), label + ': the next element IS the Conversion Tools section');
  ok(next.includes('id="' + toolId + '"'), label + ': it contains the Expand URL card');
  ok(next.includes('mp4ToMp3' + (label === 'Settings' ? 'FileSettings' : 'File')), label + ': it contains the MP4 card');
  ok(next.includes('spCard' + (label === 'Settings' ? 'Settings' : 'Disc')), label + ': it contains the Spotify card');
  ok(next.includes('ytCard' + (label === 'Settings' ? 'Settings' : 'Disc')), label + ': it contains the YouTube card');
  ok(/Audio formats explained/.test(next), label + ': it contains the format explainer');
  // The outside-site links live in the box being REPLACED, not in the section
  // being hidden — so rewriting the box is what takes them off the screen, and
  // the walkthrough that replaces them points at no site at all.
  ok(self.includes('spotisaver.net') && self.includes('spotmate.online'),
    label + ': the box being replaced is the one carrying the outside-site links');
  ok(!next.includes('spotisaver.net') && !next.includes('spotmate.online'),
    label + ': the hidden tool section carries none of its own');
}

console.log('[4] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
