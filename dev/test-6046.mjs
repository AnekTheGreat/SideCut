#!/usr/bin/env node
// v60.4.6 verification:
//  1. Extract the real gate functions from index.html and assert behavior.
//  2. Assert the pins patches are present.
//  3. Changelog evaluates; newest entry is 60.4.6 with 3 notes + EDT date.
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
const loadFn = (name) => {
  const s = extractFn(html, name);
  if (!s) return null;
  try { return new Function('return (' + s + ')')(); } catch (e) { return null; }
};

console.log('\n[1] audio gates extracted from index.html');
const strong = loadFn('scTitleStrong');
const tmatch = loadFn('scTitleMatch');
const amatch = loadFn('scArtistMatch');
const dok = loadFn('scDurationOk');
ok(!!strong, 'scTitleStrong extracted');
ok(!!tmatch && !!amatch && !!dok, 'scTitleMatch / scArtistMatch / scDurationOk extracted');
if (strong) {
  ok(strong('Shape of You', 'Shape of You (Official Video)', '') === true, 'exact title (suffix stripped) is strong');
  ok(strong('Stay With Me', 'Sam Smith - I am Not the Only One', '') === false, 'same artist, different song is NOT strong');
  ok(strong('Blinding Lights', 'The Weeknd - Blinding Lights (Official Audio)', '') === true, 'containment is strong');
  ok(strong('', 'anything', '') === true, 'empty expected title passes');
  ok(strong('Levitating', 'Dua Lipa - Levitating feat. DaBaby', 'Levitating (Official)') === true, 'strong via candidate title');
}
if (tmatch) {
  ok(tmatch('As It Was', 'Harry Styles - As It Was (Live)', '') === true, 'scTitleMatch still passes live suffix (60%/containment)');
  ok(tmatch('Golden Hour', 'Someone Else - Cover Medley', '') === false, 'scTitleMatch still rejects unrelated');
}
if (dok) {
  ok(dok(200, 214) === true && dok(200, 216) === false && dok(0, 999) === true, 'scDurationOk 15s/unknown behavior unchanged');
}
const srcCount = (needle) => (html.split(needle).length - 1);
ok(srcCount('scTitleStrong(') >= 2, 'scTitleStrong is defined AND used in the verify loop');
ok(html.includes('entry.strong || bufDelta <= 30'), 'near-cut needs strong title beyond 30s');
ok(html.includes("scTitleMatch(title, fallback.videoTitle, fallbackCand ? fallbackCand.title : '')"), 'fallback source must pass the title gate');

console.log('\n[2] pinned-artist recovery patches present');
ok(srcCount('sidecut_pins_restored') >= 2, 'once-flag written and read');
ok(html.includes('window.__scSnapMeta = async function'), '__scSnapMeta snapshot reader exposed');
ok(html.includes('restored from the on-device snapshot'), 'restore path logs recovery');
ok(html.includes('pinnedReadRetries') && html.includes('re-reading them'), 'untrusted reads retry and say so');
ok(html.includes('if(!pinnedLoadTrusted){'), 'render branches on trust before the placeholder');

console.log('\n[3] changelog + version');
const APPV = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(!!APPV, `APP_VERSION read (${APPV})`);
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) { }
ok(!!entries, 'CHANGELOG evaluates' + (entries ? '' : ''));
if (entries) {
  ok(entries[0].version === APPV, `newest entry (${entries[0].version}) matches APP_VERSION`);
  ok(entries[0].items.length >= 3, `at least 3 patch notes (${entries[0].items.length})`);
  ok(/EDT$/.test(entries[0].date || ''), 'date ends in EDT (' + entries[0].date + ')');
}
ok(!html.includes("'60.4.6'") || true, 'version not burned in a legacy map (checked below)');
const maps = [...html.matchAll(/LEGACY_VERSIONS = (\{[^}]*\})/g)].map(m => m[1]);
ok(!maps.some(m => APPV && m.includes(`'${APPV}'`)), `no LEGACY map contains ${APPV}`);

console.log('\n[4] inline script syntax vs HEAD (only new failures count)');
function scripts(src) {
  return [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
}
function failures(list) {
  const bad = new Set();
  list.forEach((code, i) => {
    try { acornParse(code, { ecmaVersion: 'latest' }); } catch (e) { bad.add(i); }
  });
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
