// Regenerates the Play update channel in ota-play/ from the current index.html.
//
// The Play build reads this channel (its manifest URLs are switched by
// window.__PLAY_BUILD__), so two guarantees matter:
//   1. the index.html INSIDE ota-play/update.zip carries the Play flag — a Play
//      install that updates over the air stays a Play build forever and can
//      never receive the sideload bundle (that would be a post-review
//      functionality swap, which gets developer accounts banned);
//   2. it versions off the same APP_VERSION as index.html, so both channels
//      always describe the same release.
//
// The flag marker and anchor MUST match .github/workflows/patch-playbuild.py.
//
//   node dev/ota-bundle-play.mjs          # regenerate ota-play/
//   node dev/ota-bundle-play.mjs --check  # verify ota-play/ matches index.html
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const OTA_FILES = ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'dev/native-updates.js'];
const MARK = '<script>window.__PLAY_BUILD__=true;</script>\n';
const ANCHOR = '<script src="dev/native-updates.js"></script>';

function readVersion(src) {
  const m = src.match(/const APP_VERSION = '([^']+)'/);
  return m ? m[1] : null;
}
function readNotes(src, version) {
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (!block) return { notes: [], date: '' };
  let entries = [];
  try { entries = eval('[' + block[1] + ']'); } catch (err) { return { notes: [], date: '' }; }
  const e = entries.find((x) => String(x.version) === String(version)) || entries[0];
  if (!e) return { notes: [], date: '' };
  return { notes: (e.items || []).slice(0, 6), date: e.date ? String(e.date) : '' };
}
function withFlag(html) {
  if (html.includes(MARK)) return html;
  if (!html.includes(ANCHOR)) throw new Error('flag anchor missing from index.html');
  return html.replace(ANCHOR, MARK + ANCHOR);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const version = readVersion(html);
if (!version) { console.error('ota-bundle-play: could not read APP_VERSION'); process.exit(1); }
const { notes, date } = readNotes(html, version);
const OUT = path.join(ROOT, 'ota-play');

if (CHECK) {
  const problems = [];
  let man = null;
  try { man = JSON.parse(fs.readFileSync(path.join(OUT, 'updates.json'), 'utf8')); } catch (e) { problems.push('ota-play/updates.json is missing'); }
  if (man) {
    if (String(man.version) !== String(version)) problems.push(`ota-play/updates.json is v${man.version} but index.html is v${version}`);
    if (!Array.isArray(man.notes) || !man.notes.length) problems.push('ota-play/updates.json has no patch notes');
    if (man.size !== fs.statSync(path.join(OUT, 'update.zip')).size) problems.push('ota-play/updates.json size does not match update.zip');
  }
  try {
    const zipped = execFileSync('unzip', ['-p', path.join(OUT, 'update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (!zipped.includes(MARK)) problems.push('index.html inside ota-play/update.zip has NO Play flag');
    if (String(readVersion(zipped)) !== String(version)) problems.push('index.html inside ota-play/update.zip has the wrong version');
  } catch (e) { problems.push('could not read ota-play/update.zip: ' + (e && e.message)); }
  if (problems.length) {
    console.error('ota-bundle-play --check FAILED:');
    problems.forEach((p) => console.error('  \u2022 ' + p));
    console.error('Fix: run `node dev/ota-bundle-play.mjs` and commit ota-play/.');
    process.exit(1);
  }
  console.log(`ota-bundle-play --check OK — ota-play/ is v${version}, flag-baked (${notes.length} notes).`);
  process.exit(0);
}

const FIXED_MTIME = new Date('2020-01-01T00:00:00Z');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecut-ota-play-'));
for (const f of OTA_FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) throw new Error('missing OTA file: ' + f);
  const dst = path.join(stage, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (f === 'index.html') fs.writeFileSync(dst, withFlag(fs.readFileSync(src, 'utf8')));
  else fs.copyFileSync(src, dst);
  fs.utimesSync(dst, FIXED_MTIME, FIXED_MTIME);
}
fs.mkdirSync(OUT, { recursive: true });
const zipPath = path.join(OUT, 'update.zip');
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zipPath, ...OTA_FILES], { cwd: stage, stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });

const size = fs.statSync(zipPath).size;
fs.writeFileSync(path.join(OUT, 'updates.json'), JSON.stringify({ version, url: 'update.zip', size, notes, date }));
console.log(`ota-bundle-play: v${version} \u00b7 ${size} bytes \u00b7 ${notes.length} notes -> ota-play/ (flag baked into zip)`);
