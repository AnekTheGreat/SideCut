#!/usr/bin/env node
// v60.5.0 Play-ready build verification.
//
// Extracts the ACTUAL shipped functions from index.html and exercises both
// build modes with a stubbed transport, then verifies the channel split, the
// Play OTA bundle, the CI injector and the release metadata.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const nat = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

console.log('[1] source hygiene');
// Strip // and /* */ comments first: the block-1 header legitimately EXPLAINS
// the CI marker in prose, and that must not count as the source setting it.
const srcNoComments = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/window\.__PLAY_BUILD__\s*=\s*true/.test(srcNoComments), 'index.html source never sets the flag itself');
ok(!/window\.__PLAY_BUILD__\s*=\s*true/.test(nat), 'native-updates.js source never sets the flag itself');
ok(/var SC_IS_PLAY = !!\(typeof window !== 'undefined' && window\.__PLAY_BUILD__\);/.test(src), 'SC_IS_PLAY switch present');
ok((src.match(/id="ytCardDisc"/g) || []).length === 1, 'Discover YouTube card has an id');
ok((src.match(/id="ytCardSettings"/g) || []).length === 1, 'Settings YouTube card has an id');
ok(/if\(SC_IS_PLAY\)\{\s*try\{\s*\['ytCardDisc','ytCardSettings'\]/.test(src), 'Play UI hides both YouTube cards');
ok(/\/\/ Play build: the card is hidden and the converter must never run[\s\S]{0,200}?if\(SC_IS_PLAY\)\{\s*if\(resultEl\)/.test(src), 'convertYtToMp3 hard gate present');
ok(/async function scYtSearch\(query, artistHint, albumHint\)\{\s*if\(SC_IS_PLAY\) return scLegalSearch/.test(src), 'scYtSearch gated as first statement');
ok(/async function scYtPlayer\(videoId\)\{\s*if\(SC_IS_PLAY\) return scLegalPlayer/.test(src), 'scYtPlayer gated as first statement');
ok(/async function scLegalSearch\(/.test(src) && /async function scLegalPlayer\(/.test(src), 'licensed-source layer defined');

console.log('[2] channel split — no ungated ota URL survives');
const ungated = [];
src.split('\n').forEach((l, i) => { if (/SideCut\/ota\/|main\/ota\//.test(l)) ungated.push('index.html:' + (i + 1)); });
nat.split('\n').forEach((l, i) => { if (/SideCut\/ota\/|main\/ota\//.test(l)) ungated.push('native-updates.js:' + (i + 1)); });
ok(ungated.length === 0, 'zero ungated channel URLs' + (ungated.length ? ' -> ' + ungated.join(', ') : ''));
ok((src.match(/SC_IS_PLAY \? 'ota-play' : 'ota'/g) || []).length === 3, 'index.html: 3 gated channel sites');
ok((nat.match(/__PLAY_BUILD__ \? 'ota-play/g) || []).length === 4, 'native-updates.js: 4 gated channel sites');

console.log('[3] functional — shipped functions in both build modes');
function grab(text, sig) {
  const s = text.indexOf(sig); if (s < 0) return null;
  let d = 0, started = false;
  for (let j = s; j < text.length; j++) {
    const c = text[j];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return text.slice(s, j + 1); }
  }
  return null;
}
const sigs = ['async function scLegalSearch(', 'async function scLegalPlayer(',
  'async function scYtSearch(', 'async function scYtPlayer(', 'function convertYtToMp3('];
const pieces = sigs.map(s => grab(src, s));
ok(pieces.every(Boolean), 'all five functions extracted' + (pieces.every(Boolean) ? '' : ' (missing: ' + sigs.filter((s, i) => !pieces[i]) + ')'));

function build(flag, handler) {
  const urls = [];
  const scHttpJson = async (u) => { urls.push(u); return handler ? handler(u) : null; };
  const toast = () => {};
  const body = pieces.join('\n') + '\nreturn { scYtSearch, scYtPlayer, convertYtToMp3 };';
  const api = new Function('scHttpJson', 'toast', 'SC_IS_PLAY', body)(scHttpJson, toast, flag);
  return { api, urls };
}

const archiveDocs = { response: { docs: [
  { identifier: 'a1', title: 'Demo Song', creator: 'Demo Artist', length: '3:00', downloads: 500 },
  { identifier: 'a2', title: 'Demo Song (Live at Home)', creator: 'Demo Artist', length: '190', downloads: 900 },
  { identifier: 'a3', title: 'Demo Song', creator: 'Demo Artist', length: '10', downloads: 10 },
] } };
const archiveMeta = { identifier: 'a1', title: 'Demo Song', creator: 'Demo Artist',
  licenseurl: 'https://creativecommons.org/licenses/by/4.0/',
  files: [
    { name: '01 - Demo Song.mp3', format: 'VBR MP3', size: '123456' },
    { name: 'cover.jpg', format: 'JPEG', size: '9' },
    { name: 'alt.ogg', format: 'Ogg Vorbis', size: '222' },
  ] };

// A) sideload: untouched video-host path
{
  const { api, urls } = build(false, () => null);
  const r = await api.scYtSearch('demo song', 'Demo Artist', 'Demo Album');
  ok(r === null, 'A sideload: search returns null on stubbed miss');
  ok(!!urls[0] && urls[0].includes('youtubei/v1/search'), 'A sideload: still requests youtubei search');
}
{
  const { api, urls } = build(false, () => null);
  const s = await api.scYtPlayer('dQw4w9WgXcQ');
  ok(s === null && !!urls[0] && urls[0].includes('youtubei/v1/player'), 'A sideload: still requests youtubei player');
}
// B) Play: licensed catalog search
{
  const { api, urls } = build(true, () => archiveDocs);
  const r = await api.scYtSearch('demo song', 'Demo Artist');
  ok(!!urls[0] && urls[0].includes('archive.org/advancedsearch.php'), 'B play: licensed catalog searched');
  ok(!urls.some(u => u.includes('youtubei')), 'B play: zero youtubei requests');
  ok(Array.isArray(r) && r.length === 2, 'B play: 2 candidates (10s track filtered out)');
  ok(!!r && r.every(c => c.videoId.startsWith('ia:') && c.title && typeof c.score === 'number'), 'B play: candidate shape matches contract');
  ok(!!r && r[0].videoId === 'ia:a1', 'B play: studio cut outranks the live cut');
}
// C) Play: licensed file resolution
{
  const { api, urls } = build(true, () => archiveMeta);
  const s = await api.scYtPlayer('ia:a1');
  ok(!!urls[0] && urls[0].includes('archive.org/metadata/a1'), 'C play: item metadata fetched');
  ok(!urls.some(u => u.includes('youtubei')), 'C play: zero youtubei requests');
  ok(!!s && s.url.includes('archive.org/download/a1/01%20-%20Demo%20Song.mp3'), 'C play: direct licensed mp3 URL');
  ok(!!s && s.mime === 'audio/mpeg' && s.size === 123456, 'C play: mime + size carried for the duration gate');
  ok(!!s && s.videoTitle === 'Demo Song' && s.author === 'Demo Artist' && s.license.includes('creativecommons'), 'C play: title/author/license feed the verification gates');
  ok(!!s && Array.isArray(s.alts) && s.alts.some(a => a.url.includes('alt.ogg')) && !s.alts.some(a => a.url.includes('cover')), 'C play: mp3 lead, ogg alt, image skipped');
}
// D) Play: refuses foreign ids outright
{
  const { api, urls } = build(true, () => archiveMeta);
  const s = await api.scYtPlayer('dQw4w9WgXcQ');
  ok(s === null && urls.length === 0, 'D play: non-ia id refused with zero network');
}
// E) Play: converter hard gate
{
  const { api, urls } = build(true, () => null);
  const el = { style: {}, innerHTML: '' };
  let threw = false;
  try { api.convertYtToMp3('https://youtu.be/abc', el, null, 'mp3'); } catch (e) { threw = true; }
  ok(!threw && urls.length === 0 && /not part of this build/.test(el.innerHTML), 'E play: converter gated before any work');
}

console.log('[4] Play OTA bundle');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
try {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota-play/updates.json'), 'utf8'));
  ok(man.version === ver, `ota-play manifest v${man.version} matches APP_VERSION ${ver}`);
  // >= 1 is the channel's real contract (ota-bundle-play --check fails below it):
  // a release with no shared notes legitimately ships a single shared item.
  ok(Array.isArray(man.notes) && man.notes.length >= 1, `ota-play notes: ${man.notes.length}`);
  const zipSize = fs.statSync(path.join(ROOT, 'ota-play/update.zip')).size;
  ok(man.size === zipSize, `ota-play size matches zip (${zipSize})`);
  const zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(zipped.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'Play flag baked into play zip');
  ok((zipped.match(/const APP_VERSION = '([^']+)'/) || [])[1] === ver, 'play zip index.html at current version');
} catch (e) { ok(false, 'ota-play bundle readable: ' + e.message); }
try {
  const side = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(!side.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'sideload zip carries NO play flag');
} catch (e) { ok(false, 'sideload zip readable: ' + e.message); }

console.log('[5] release metadata');
ok(/^\d+\.\d+\.\d+$/.test(ver), `APP_VERSION is a release version (${ver}) — compared against the changelog below, never hard-pinned`);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, `newest changelog (${entries && entries[0].version}) matches APP_VERSION`);
if (entries) {
  ok(/EDT$/.test(entries[0].date || ''), 'date ends in EDT (' + entries[0].date + ')');
  ok(entries[0].items.length >= 3, `patch notes: ${entries[0].items.length}`);
}
const maps = [...src.matchAll(/LEGACY_VERSIONS = (\{[^}]*\})/g)].map(x => x[1]);
ok(!maps.some(x => x.includes(`'${ver}'`)), `no LEGACY map contains ${ver}`);

console.log('[6] CI wiring');
try {
  execFileSync('python3', ['-c', `compile(open(${JSON.stringify(path.join(ROOT, '.github/workflows/patch-playbuild.py'))}).read(), 'p', 'exec')`], { stdio: 'pipe' });
  ok(true, 'patch-playbuild.py compiles');
} catch (e) { ok(false, 'patch-playbuild.py compiles'); }
try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pbi-'));
  fs.mkdirSync(path.join(tmp, 'www'));
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(tmp, 'www', 'index.html'));
  const script = path.join(ROOT, '.github/workflows/patch-playbuild.py');
  execFileSync('python3', [script], { cwd: tmp, stdio: 'pipe' });
  execFileSync('python3', [script], { cwd: tmp, stdio: 'pipe' });
  const injected = fs.readFileSync(path.join(tmp, 'www', 'index.html'), 'utf8');
  ok((injected.match(/<script>window\.__PLAY_BUILD__=true;<\/script>/g) || []).length === 1, 'injector idempotent — flag exactly once');
  fs.rmSync(tmp, { recursive: true, force: true });
} catch (e) { ok(false, 'injector run: ' + e.message); }
const abi = fs.readFileSync(path.join(ROOT, '.github/workflows/android-build.yml'), 'utf8');
ok(abi.includes('patch-playbuild.py'), 'android-build.yml invokes the injector');
ok(abi.includes('flavor: [play, full]') && abi.includes("if: matrix.flavor == 'play'"), 'CI builds play + full flavors; injector only on play');
ok(abi.includes('${{ steps.ver.outputs.suffix }}'), 'artifact names distinct per flavor (release/full)');
const dep = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
ok(dep.includes('node dev/ota-bundle-play.mjs') && dep.includes('ota-bundle-play.mjs --check'), 'deploy.yml builds + verifies ota-play/');
ok(dep.includes('git add ota ota-play updates.json'), 'deploy.yml commits ota-play/');

console.log('[7] export/import carries the complete state');
ok(/window\.__scSnapCollect = async function/.test(src) && /window\.__scSnapHydrate = async function/.test(src), 'collect + hydrate exposed by the snapshot module');
ok(/manifest\.state = await window\.__scSnapCollect\(\)/.test(src), 'export embeds manifest.state (whole-store sweep)');
ok(/await window\.__scSnapHydrate\(manifest\.state\)/.test(src), 'import hydrates manifest.state first');
ok(/_expIdc > _liveIdc\)\) idCounter = _expIdc/.test(src), 'idCounter jumps to restored high-water mark');
ok(/dbPut\('meta', \{ key: 'idCounter', value: idCounter \}\)/.test(src), 'idCounter persisted after minting');
ok(/EVERY stored preference \(lyrics sync nudges, album order, widget theme, API bases, manual album edits\)/.test(src), 'export confirm copy names the new coverage');
// Functional: run the SHIPPED hydrate against stub stores.
const hydSrc = grab(src, 'window.__scSnapHydrate = async function');
ok(!!hydSrc, 'hydrate function extracted');
if (hydSrc) {
  const lsCalls = [], dbCalls = [];
  const localStorageStub = { setItem: (k, v) => lsCalls.push([k, v]) };
  const dbPutStub = async (store, row) => { if (store === 'meta') dbCalls.push(row); };
  const fn = new Function('localStorage', 'dbPut', 'return (' + hydSrc.replace(/^window\.__scSnapHydrate = /, '') + ')')(localStorageStub, dbPutStub);
  const r1 = await fn({ v: 1, localStorage: { theme: 'dark' }, meta: { lyricsSyncOff_t3: -0.4, idCounter: 370 } });
  ok(r1 === true, 'hydrate applies v1 state');
  ok(lsCalls.length === 1 && lsCalls[0][0] === 'theme', 'localStorage keys written back');
  ok(dbCalls.length === 2 && dbCalls.some(r => r.key === 'lyricsSyncOff_t3' && r.value === -0.4) && dbCalls.some(r => r.key === 'idCounter' && r.value === 370), 'meta rows written: lyrics nudge + idCounter');
  const r2 = await fn({ v: 99 });
  ok(r2 === false, 'wrong state version refused');
}

console.log(`\nFAILURES: ${fail} — ${pass} passed`);
process.exit(fail ? 1 : 0);
