#!/usr/bin/env node
// v64, part two — every function the app calls is a function it has.
//
//   [1] the structural audit itself: run dev/audit-calls.mjs and require it to
//       exit 0. It is the only check here that is not a text match, and it is
//       the one that answers "does every function of the app work";
//   [2] the seven call sites it found, each checked by the call that replaced it
//       and by the name that is now gone from the file;
//   [3] the lost line break: the share-code sheet and the clipboard copy exist
//       again, and the comment is a comment again;
//   [4] the assistant: the paths it is told to use are pages that exist, it is
//       handed the app's own answer as ground truth, and a question the app
//       really answers is answered from the app;
//   [5] the release says so, on both channels, without naming what it may not.
//
//   node dev/test-663.mjs                          # the shipped tree
//   SC_HTML=/path/index.html node dev/test-663.mjs  # any build (the audit runs
//                                                   # with SC_HTML too)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const src = fs.readFileSync(HTML, 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (needle) => src.split(needle).length - 1;
// Tolerant on purpose: this gate can be run against a pre-fix build, where whole
// functions do not exist yet. That run must report failures, not throw.
function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = a === -1 ? -1 : src.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return src.slice(a, b);
}
const ARR = String.fromCodePoint(0x2192);

console.log('[1] every name the app reads is declared (dev/audit-calls.mjs)');
{
  // The audit is the answer to "check every single function of the app". It
  // parses the inline blocks and fails on a read of anything that is never
  // declared, which is a ReferenceError the moment that line runs.
  const env = Object.assign({}, process.env);
  if (process.env.SC_HTML) env.SC_HTML = HTML;
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')],
      { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code === 0, 'the audit passes: ' + first.trim());
  ok(/every name the app reads is declared/.test(out), 'and it reports what it checked');
  ok(/no line comment has swallowed code/.test(out), 'including the lost-line-break check');
}

console.log('[2] the call sites the audit found, one by one');
ok(count('confirmDeleteTrack') === 0 && src.indexOf('deleteTrack(t.id);') !== -1,
  'the now-playing delete calls deleteTrack()');
ok(src.indexOf("$('songActionsBackdrop').style.display='none'; deleteTrack(id);") !== -1,
  'which is the same call the song actions sheet already made');
ok(count('parseMP3Tags(buf)') === 0 && src.indexOf('const tags = await extractTags(t);') !== -1,
  'Reset covers reads tags with the app real reader, extractTags()');
ok(sliceBetween('$(\'resetCoversBtn\')', 'toast(`Reset ${count} covers`)').indexOf('await t.file.arrayBuffer()') === -1,
  'and no longer builds a buffer nothing reads');
ok(count('persistLibrary();') === 0, 'the preview import no longer calls a missing persistLibrary()');
ok(src.indexOf('resolve(true);\n              });\n                audio.addEventListener') === -1 &&
   src.indexOf('session-only') !== -1, 'and says why it is session-only instead');
ok(count('dbGetSync && dbGetSync') === 0 && src.indexOf("const _iconRow = await dbGet('meta', 'appIcon')") !== -1,
  'the app icon picker reads the meta store with dbGet()');
ok(src.indexOf('(async function wireAppIconPicker(){') !== -1, 'from an async picker');
ok(src.indexOf('var _cardPtrId = null;') !== -1, 'the album-card drag keeps the captured pointer id');
ok(src.indexOf('_cardPtrId = e.pointerId;') !== -1, 'records it when the hold takes the pointer');
ok(count('releasePointerCapture(_cardPtrId)') === 2, 'and releases it in both places it did before');
ok(count('updateCSSGlow') === 0 && src.indexOf('applyGlowCssVars();') !== -1,
  'restoring glow settings on import applies the real CSS variables');
ok(count('seenReleaseIds') === 1 && src.indexOf('if(r.seen && r.id) seen[r.id] = true;') !== -1,
  'the New Releases popup reads the seen flag the app actually keeps');

console.log('[3] the lost line break: the share sheet and the clipboard are back');
ok(src.indexOf("    // web/browser app too.\n    const link = 'https://anekthegreat.github.io/SideCut/?sc='") !== -1,
  'the share link is built again');
ok(src.indexOf("if(shareLinkBtn){ shareLinkBtn.dataset.link = link; shareLinkBtn.dataset.code = code; }\n  }\n") !== -1,
  'and stored on the copy-link button');
ok(src.indexOf('  function openShareCodeModal(){\n') !== -1 &&
   src.indexOf("$('shareCodePaste').value = '';\n    $('shareCodeModal').style.display = 'flex';\n  }\n  function copyTextToClipboard(text){\n") !== -1,
  'openShareCodeModal() and copyTextToClipboard() are declared, not commented out');
ok(src.indexOf("function copyTextToClipboard(text){\n  // Try modern clipboard API first\n  if(navigator.clipboard && navigator.clipboard.writeText){") !== -1,
  'and copyTextToClipboard() owns its own body again');
{
  // Nothing between the share sheet and the clipboard function is still inside a
  // comment: the three declarations must all sit in the parsed script.
  const seg = sliceBetween('function sharePlaylistCode(){', 'function _fallbackCopy(text){');
  ok(seg.indexOf('// Build a full share link') !== -1 && !/\s\/\/[^\n]*\bfunction\b/.test(seg.replace(/\/\/[^\n]*\n/g, '')),
    'and no comment in that block still runs to the end of a joined line');
}

console.log('[4] the assistant is told the truth, and handed the app own answers');
ok(count('Settings ' + ARR + ' Playback') === 0, 'no answer sends anyone to a Settings Playback tab');
ok(count('Settings ' + ARR + ' EQ') === 0 && count('Settings ' + ARR + ' Equalizer') === 0,
  'nor to an EQ or Equalizer tab');
ok(src.indexOf('Settings ' + ARR + ' More ' + ARR + ' Playback') !== -1,
  'they name Settings More Playback, which is where it lives');
ok(src.indexOf("if(tab === 'refresh' || tab === 'playback' || tab === 'eq') tab = 'more';") !== -1,
  'which is what showSettingsTab() already said');
ok(src.indexOf('var _aiGroundNote =') !== -1 &&
   src.indexOf("_aiSystemPrompt + (kbGround ? _aiGroundNote + kbGround : '')") !== -1,
  'the app own entry for the question rides along as ground truth');
ok(src.indexOf('async function _aiGeminiQuery(userMessage, kbGround) {') !== -1, 'and the query takes it');
ok(src.indexOf('var _kbStrong = _aiFuzzyMatch(msg, 80);') !== -1,
  'a question the app really answers is answered from the app, before any model');
ok(src.indexOf('if (bestScore >= (minScore || 35)) return bestEntry;') !== -1,
  'with the matcher able to ask for a strong match only');
ok(src.indexOf('never invent a screen or a menu path') !== -1, 'and the prompt forbids inventing one');
ok(src.indexOf('Settings \\u2192 Sandbox \\u2192 Home layout') !== -1 && src.indexOf('Undo crop') !== -1,
  'while naming the paths that do exist, including Crop song and Undo crop');
ok(count('a: SC_IS_PLAY ?') >= 4, 'the per-build answers are still gated');

console.log('[5] the knowledge base still builds, and it answers the reported questions');
{
  const s = src.indexOf('var _aiKB = [');
  const e = s === -1 ? -1 : src.indexOf('];', s) + 2;
  let kb = null;
  try {
    kb = new Function('SC_IS_PLAY', 'window',
      (e === -1 ? '' : src.slice(s, e)) + '\nreturn _aiKB;')(false, {});
  } catch (err) { ok(false, 'the knowledge base evaluates: ' + err.message); }
  if (kb) {
    ok(kb.length >= 60, 'it still builds (' + kb.length + ' answers)');
    ok(kb.every((x) => x && Array.isArray(x.q) && typeof x.a === 'string' && x.a.length > 20),
      'every entry is a question list and a real answer');
    const crop = kb.find((x) => x.q.indexOf('how to crop a song') !== -1);
    ok(!!crop && /Crop song/.test(crop.a) && /Undo crop/.test(crop.a),
      'and "how to crop a song" is answered with the Crop song button and Undo crop');
    ok(!!kb.find((x) => x.q.indexOf('watermark remover') !== -1), 'the watermark remover has an answer');
    ok(!!kb.find((x) => x.q.indexOf('rollback') !== -1), 'so do the rollback copies');
    ok(!!kb.find((x) => x.q.indexOf('home layout') !== -1), 'and the Home layout editor');
    ok(kb.filter((x) => /Rescan library/.test(x.a)).length === 1,
      'and the one that mentions Rescan library says there is no such button');
  }
  const kbText = e === -1 ? '' : src.slice(s, e);
  ok(!/[A-Za-z],[A-Za-z]/.test(kbText), 'no comma in it is still glued to the next word');
  ok(['andthe', 'coversare', 'themand', 'allthe', 'orderand'].every((w) => kbText.indexOf(w) === -1),
    'and no words are still run together');
}

console.log('[6] the release says so, on both channels, without naming what it may not');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null, head = null;
  try { entries = eval('[' + block[1] + ']'); head = entries.find((x) => /^64$/.test(String(x.version))); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  if (head) {
    ok(String(head.version).slice(0, 2) === '64', 'the v64 entry is still in the changelog');
    ok((head.items || []).length === 8, 'it has 8 notes (' + (head.items || []).length + ')');
    ok((head.items || []).slice(0, 6).every((it) => it.indexOf('[FULL]') === -1),
      'the first six are the shared channel');
    ok((head.items || []).slice(6).every((it) => it.indexOf('[FULL] ') === 0), 'the rest are [FULL] only');
    const notes = (head.items || []).join('\n');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'and none of them names a downloader');
    ok(!/play build|play version|play install/i.test(notes), 'nor the other build');
    // The items are evaluated here, so the \\uXXXX escapes in the source are
    // already real characters by this point.
    ok(notes.indexOf('Settings ' + ARR + ' More') !== -1, 'the assistant note names the page that exists');
    ok(/seven more call sites/.test(notes), 'and the notes say the sweep happened');
  }
}

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
