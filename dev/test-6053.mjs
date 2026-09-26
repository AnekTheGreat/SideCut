#!/usr/bin/env node
// v60.5.3 verification — extracts the ACTUAL shipped scHealBrokenAlbums from
// index.html and runs it against stub stores, then verifies the converter
// failure diagnostics, the Play build's ripper-link gate, the flavor label,
// the CI artifact filenames and the release metadata. No regexes — script
// tags and the changelog are sliced by position, so nothing here needs a
// backslash either.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NL = String.fromCharCode(10);
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/android-build.yml'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

console.log('[1] album heal — shipped code, actually executed');

const fnStart = src.indexOf('function scHealBrokenAlbums(){');
const fnEndMark = '// ---- end scHealBrokenAlbums ----';
const fnEnd = fnStart === -1 ? -1 : src.indexOf(fnEndMark, fnStart);
ok(fnStart !== -1 && fnEnd !== -1, 'scHealBrokenAlbums locatable in index.html');
const fnSrc = (fnStart === -1 || fnEnd === -1) ? '' : src.slice(fnStart, fnEnd + fnEndMark.length);

function makeHeal(userAlbums, allTracks){
  const puts = [];
  const factory = new Function('userAlbums', 'allTracks', 'dbPut',
    fnSrc + NL + 'return scHealBrokenAlbums;');
  const heal = factory(userAlbums, allTracks, (store, row) => puts.push(row));
  return { heal, puts };
}

// A — the reported bug: album ids from the old phone, matching album tags here.
const albumsA = { 'Punjabi Hits': { trackIds: ['e1', 'e2', 'e3'], artist: 'X' } };
const tracksA = [
  { id: 'L7', album: 'Punjabi Hits' },
  { id: 'L8', album: 'Punjabi Hits' },
  { id: 'L9', album: 'Something Else' },
];
const A = makeHeal(albumsA, tracksA);
const healedA = A.heal();
ok(healedA === 1, 'dead album counted as healed (' + healedA + ')');
ok(albumsA['Punjabi Hits'].trackIds.join(',') === 'L7,L8',
  'rebuilt from the album tag on the files (' + albumsA['Punjabi Hits'].trackIds.join(',') + ')');
ok(A.puts.length === 1 && A.puts[0].key === 'userAlbums', 'rebuilt list persisted once');

// B — healthy library: nothing touched, nothing written.
const albumsB = { 'Good': { trackIds: ['L1', 'L2'] } };
const B = makeHeal(albumsB, [{ id: 'L1', album: 'Good' }, { id: 'L2', album: 'Good' }]);
const healedB = B.heal();
ok(healedB === 0 && B.puts.length === 0, 'healthy album untouched, store not written (' + healedB + ')');
ok(albumsB['Good'].trackIds.join(',') === 'L1,L2', 'healthy trackIds unchanged');

// C — dead ids that match no tag (hand-made album): left alone, no false write.
const albumsC = { 'Road Trip Mix': { trackIds: ['x1', 'x2'] } };
const C = makeHeal(albumsC, [{ id: 'L1', album: '别的' }, { id: 'L2', album: 'Other' }]);
const healedC = C.heal();
ok(healedC === 0 && C.puts.length === 0, 'unrebuildable album left as-is, no false persist');
ok(albumsC['Road Trip Mix'].trackIds.join(',') === 'x1,x2', 'unrebuildable album list unchanged');

// D — mixed live + dead: dead dropped, live kept in order, persisted.
const albumsD = { 'Mixed': { trackIds: ['L1', 'ghost', 'L2'] } };
const D = makeHeal(albumsD, [{ id: 'L1', album: 'A' }, { id: 'L2', album: 'B' }]);
const healedD = D.heal();
ok(healedD === 1 && albumsD['Mixed'].trackIds.join(',') === 'L1,L2',
  'partially-dead list drops what cannot resolve (' + albumsD['Mixed'].trackIds.join(',') + ')');
ok(D.puts.length === 1, 'partial repair persisted');

// E — degenerate entries survive.
const albumsE = { 'Empty': { trackIds: [] }, 'Null': {} };
const E = makeHeal(albumsE, []);
ok(E.heal() === 0 && E.puts.length === 0, 'empty/null entries no-op without throwing');
const F = makeHeal(null, [{ id: 'L1', album: 'Z' }]);
ok(F.heal() === 0, 'null userAlbums no-op without throwing');

console.log('[2] heal is wired at boot');
const loadPos = src.indexOf('userAlbums = metaMap.userAlbums || {};');
const callPos = src.indexOf('try{ scHealBrokenAlbums(); }catch(_eHeal){}');
ok(loadPos !== -1 && callPos !== -1 && callPos > loadPos,
  'heal called inside loadFromDB after the albums load');

console.log('[3] build flavor is visible');
ok(src.includes('Full build — all sources'), 'version line can name the full build');
ok(src.includes('Play build — licensed sources'), 'version line can name the Play build');
ok(src.includes("currentVersionLabel').textContent = `SideCut v${APP_VERSION} · ${SC_IS_PLAY"),
  'flavor appended to the same label that shows the version');

console.log('[4] converter failure diagnostics');
const ytPos = src.indexOf('async function tryYtAudioFormat');
ok(ytPos !== -1, 'YouTube format helper located');
if (ytPos !== -1) {
  const ytBody = src.slice(ytPos, ytPos + 2200);
  ok(ytBody.includes('YouTube returned no streams'), 'reason 1: player returned nothing');
  ok(ytBody.includes('would not download or decode'), 'reason 2: stream blocked/undecodable');
  ok(ytBody.includes('the encoder produced nothing'), 'reason 3: encoder failed');
  ok(ytBody.includes('blocked CDN'), 'reason 3 names a blocked CDN when lamejs is missing');
  ok(ytBody.includes('await window.__scEnsureLamejs(); }'), 'mp3 attempt retries encoder mirrors first');
}
ok(src.includes('_ytFails[_ytFails.length - 1]'), 'panel and toast surface the reason');
ok(src.includes('window.__scEnsureLamejs = (function(){'), 'mirror loader defined');
const loaderSlice = src.slice(src.indexOf('window.__scEnsureLamejs = (function(){'), src.indexOf('window.__scEnsureLamejs = (function(){') + 900);
ok(loaderSlice.includes('jsdelivr') && loaderSlice.includes('unpkg') && loaderSlice.includes('cdnjs'),
  'loader tries jsdelivr, unpkg, cdnjs');
const coopPos = src.indexOf('async function scEncodeAudioCooperative');
ok(coopPos !== -1 && src.indexOf('await window.__scEnsureLamejs(); }', coopPos) !== -1,
  'every cooperative mp3 encode ensures the encoder first (both Spotify paths)');
ok(src.includes('csShowExternal(_spLastStatus)') && src.includes('if(txt) _spLastStatus = txt'),
  'Spotify flow captures and passes the last step it reached');
ok(src.includes('Last step: '), 'Spotify fallback panel shows the last step');

console.log('[5] Play build never hands out ripper links');
const extPos = src.indexOf('function csShowExternal(why){');
const ripPos = src.indexOf('spotisaver.net', extPos);
ok(extPos !== -1 && ripPos !== -1, 'csShowExternal located with its hand-off links');
if (extPos !== -1 && ripPos !== -1) {
  const head = src.slice(extPos, ripPos);
  ok(head.includes('if(SC_IS_PLAY){') && head.includes('return;'),
    'Play build returns before any hand-off link is rendered');
  ok(src.indexOf('if(SC_IS_PLAY){', extPos) !== -1 && src.indexOf('if(SC_IS_PLAY){', extPos) < ripPos,
    'gate sits before the links');
}
ok(src.includes('function csShowExternal(why){'), 'fallback takes the reason parameter');

console.log('[6] CI artifacts cannot be swapped');
ok(workflow.includes('SideCut-$V-$S.apk'), 'APK filename carries the flavor');
ok(workflow.includes('SideCut-$V-$S.aab'), 'AAB filename carries the flavor');
ok(workflow.includes('SideCut-${{ steps.ver.outputs.version }}-${{ steps.ver.outputs.suffix }}.apk'),
  'uploaded artifact paths use the flavored names');
ok(workflow.includes("if: matrix.flavor == 'play'"), 'Play flag injector still gated to the play job');

console.log('[7] release metadata');
const vKey = "const APP_VERSION = '";
const vi = src.indexOf(vKey);
const ver = vi === -1 ? '' : src.slice(vi + vKey.length, src.indexOf("'", vi + vKey.length));
ok(ver === '63.0.1', 'APP_VERSION = ' + ver);
const cStart = src.indexOf('const CHANGELOG = [');
const cEnd = src.indexOf(NL + '  ];', cStart);
let entries = null;
if (cStart !== -1 && cEnd !== -1) {
  try { entries = eval('[' + src.slice(cStart + 'const CHANGELOG = ['.length, cEnd) + ']'); } catch (e) {}
}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].date.endsWith('EDT'), 'date ends in EDT (' + entries[0].date + ')');
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
}

console.log('[8] inline script syntax');
let scriptIdx = 0, syntaxBad = 0;
{
  let i = 0;
  while (true) {
    const open = src.indexOf('<script', i);
    if (open === -1) break;
    const gt = src.indexOf('>', open);
    if (gt === -1) break;
    if (src.slice(open, gt).includes('src=')) { i = gt + 1; continue; }
    const close = src.indexOf('</script>', gt);
    if (close === -1) break;
    scriptIdx++;
    try { acorn.parse(src.slice(gt + 1, close), { ecmaVersion: 2022, sourceType: 'script' }); }
    catch (e) { syntaxBad++; console.log('  FAIL script#' + scriptIdx + ': ' + e.message); }
    i = close + 9;
  }
}
ok(scriptIdx >= 2, 'inline scripts found: ' + scriptIdx);
ok(syntaxBad === 0, 'inline script syntax failures: ' + syntaxBad);

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
