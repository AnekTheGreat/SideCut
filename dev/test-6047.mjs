#!/usr/bin/env node
// v60.4.7 verification:
//  1. scPaceWords / scEnsureWordSpans extracted from index.html, run against a
//     mini DOM stub — natural pacing, trailing hold, inst/child guards.
//  2. Patch presence (RGB glow CSS, ww-on toggles, 50ms poll, import-marker
//     clears on all three paths).
//  3. Changelog evaluates; newest entry matches APP_VERSION with EDT date.
//  4. Acorn-parse every inline script; only NEW failures vs HEAD count.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as acornParse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  PASS ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) return null;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}
const loadFns = (...names) => {
  const parts = names.map(n => extractFn(html, n));
  if (parts.some(p => !p)) return null;
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const body = parts.join('\n') + '\nreturn { ' + names.map(n => `${n}: ${n}`).join(', ') + ' };';
  try { return new Function('escapeHtml', body)(escapeHtml); } catch (e) { console.log(e); return null; }
};

console.log('\n[1] pacing helpers extracted and correct');
const fns = loadFns('scEnsureWordSpans', 'scPaceWords');
ok(!!fns, 'scEnsureWordSpans + scPaceWords extracted');

function wordEl(t) {
  const set = new Set();
  return { textContent: t, classes: set, classList: { toggle: (c, on) => { on ? set.add(c) : set.delete(c); }, has: c => set.has(c) } };
}
function plainLine(text) {
  return {
    dataset: {}, children: [], textContent: text, innerHTML: null, _words: null,
    querySelectorAll() {
      if (this.children.length) return [];
      if (!this._words) this._words = this.textContent.trim().split(/\s+/).filter(Boolean).map(wordEl);
      return this._words;
    },
  };
}
function markupLine() {
  return { dataset: {}, children: [{}], textContent: 'music', innerHTML: null, querySelectorAll: () => [] };
}
if (fns) {
  // Natural pacing over a long gap: 19 chars => pace ~1.76s of an 8s gap.
  const line = plainLine('hello beautiful world');
  fns.scPaceWords(line, 10, 18, 10.1);
  const lit0 = line._words.findIndex(w => w.classes.has('current'));
  fns.scPaceWords(line, 10, 18, 11.0);
  const lit1 = line._words.findIndex(w => w.classes.has('current'));
  fns.scPaceWords(line, 10, 18, 12.5); // past natural end, inside the gap
  const lit2 = line._words.findIndex(w => w.classes.has('current'));
  fns.scPaceWords(line, 10, 18, 9.0); // before the line starts
  const litBefore = [...line._words].filter(w => w.classes.has('current')).length;
  ok(lit0 === 0, `first word lit at line start (lit=${lit0})`);
  ok(lit1 === 1, `second word lit mid-pace (lit=${lit1})`);
  ok(lit2 === 2, `last word HOLDS through the instrumental gap (lit=${lit2})`);
  ok(litBefore === 0, 'nothing lit before the line starts');

  // Short gap: everything must finish inside the gap, not the natural length.
  const fast = plainLine('go go go');
  fns.scPaceWords(fast, 5, 5.4, 5.35);
  const litFast = [...fast._words].filter(w => w.classes.has('current'));
  ok(litFast.length === 1, `short gap still lights exactly one word (${litFast.length})`);

  // Instrumental / markup lines are never paced and never crash.
  const inst = markupLine();
  let threw = false;
  try { fns.scPaceWords(inst, 0, 4, 1); } catch (e) { threw = true; }
  ok(!threw && inst.dataset.wordwrap === '1', 'markup/inst line skipped safely');

  // Wrapping: plain line gains words exactly once.
  const wrap = plainLine('one two three');
  const first = fns.scEnsureWordSpans(wrap);
  const second = fns.scEnsureWordSpans(wrap);
  ok(first.length === 3 && second === wrap._words && wrap.dataset.wordwrap === '1', 'plain line wrapped once, reused after');
}

console.log('\n[2] patch presence');
const count = n => html.split(n).length - 1;
ok(html.includes('wwLitPulse') && html.includes('#lyricsText.ww-on .lyric-word.current'), 'RGB glow CSS + keyframes present');
ok(count("classList.toggle('ww-on', !!lyricsWordByWord)") === 2, 'ww-on toggled at render AND at the button');
ok(html.includes('}, 50); // ~20 polls/s'), 'poll tightened to 50ms');
ok(html.includes('scPaceWords(currentLine, lineTime, lineEnd, currentTime)'), 'synced branch uses the capped pacing');
ok(html.includes('scPaceWords(allLines[targetIdx], lineFrom, lineTo, currentTime)'), 'unsynced branch gains word pacing');
ok(count('__scMarkDone') >= 4, `import marker cleared on all paths (${count('__scMarkDone')} call sites)`);
ok(html.includes('The risky synchronous import pass is over'), 'marker cleared right after the sync pass');

console.log('\n[3] changelog + version');
const ver = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(!!ver, `APP_VERSION = ${ver}`);
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) { }
ok(!!entries, 'CHANGELOG evaluates' + (entries ? '' : ' — ' ));
if (entries) {
  ok(entries[0].version === ver, `newest entry (${entries[0].version}) matches APP_VERSION`);
  ok(entries[0].version === '60.4.8', `newest changelog is 60.4.8 (${entries[0].version})`);
  ok(entries[0].items.length === 3, `3 patch notes (${entries[0].items.length})`);
  ok(/EDT$/.test(entries[0].date || ''), 'date ends in EDT (' + entries[0].date + ')');
}
const maps = [...html.matchAll(/LEGACY_VERSIONS = (\{[^}]*\})/g)].map(m => m[1]);
ok(!maps.some(m => m.includes(`'${ver}'`)), `no LEGACY map contains ${ver}`);

console.log('\n[4] inline script syntax vs HEAD (only new failures count)');
const scripts = src => [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
function failures(list) {
  const bad = new Set();
  list.forEach((code, i) => { try { acornParse(code, { ecmaVersion: 'latest' }); } catch (e) { bad.add(i); } });
  return bad;
}
let head = '';
try { head = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { }
const nowBad = failures(scripts(html));
const headBad = head ? failures(scripts(head)) : new Set();
const newBad = [...nowBad].filter(i => !headBad.has(i));
ok(newBad.length === 0, `no NEW script failures (HEAD had ${headBad.size}, working tree has ${nowBad.size}, new: ${newBad.join(',') || 'none'})`);

console.log(`\n${fail ? 'FAILURES: ' + fail + ' — ' : ''}${pass} passed${fail ? '' : ', ALL CHECKS PASSED'}`);
if (fail) process.exitCode = 1;
