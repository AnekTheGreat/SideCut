// Regenerates the published OTA bundle in ota/ from the current index.html.
//
// This matters more than it looks: GitHub Pages on this repo is in LEGACY
// mode (source: branch main, path /), so it serves the files committed to the
// repo — the artifact the deploy workflow uploads is ignored. Anything that
// needs to reach an installed app over the air therefore has to be committed
// to ota/, which is exactly the step that was being missed: the committed
// bundle sat at v57.5 while the app moved on to 58.x, so every installed app
// saw a manifest that was older than itself and nothing ever installed.
//
//   node dev/ota-bundle.mjs          # regenerate ota/update.zip + manifests
//   node dev/ota-bundle.mjs --check   # verify ota/ matches index.html (CI)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

// Bundled into the zip: the app page, its service worker, the web manifest, the
// icons the manifest points at and the OTA client itself. If the client is left
// out, an installed bundle can never check for the next update.
export const OTA_FILES = ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'dev/native-updates.js'];

function readVersion(src) {
  const m = src.match(/const APP_VERSION = '([^']+)'/);
  return m ? m[1] : null;
}
function readNotes(src, version) {
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (!block) return { notes: [], date: '' };
  let entries = [];
  try {
    entries = eval('[' + block[1] + ']');
  } catch (err) {
    return { notes: [], date: '' };
  }
  const e = entries.find((x) => String(x.version) === String(version)) || entries[0];
  if (!e) return { notes: [], date: '' };
  // [FULL]-marked items are this channel's own notes: strip the marker.
  return { notes: (e.items || []).map((it) => (typeof it === 'string' && it.startsWith('[FULL] ')) ? it.slice(7) : it).slice(0, 6), date: e.date ? String(e.date) : '' };
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const version = readVersion(html);
if (!version) {
  console.error('ota-bundle: could not read APP_VERSION from index.html');
  process.exit(1);
}
const { notes, date } = readNotes(html, version);

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  } catch (e) {
    return null;
  }
}

if (CHECK) {
  const man = readManifest();
  const problems = [];
  if (!man) problems.push('ota/updates.json is missing');
  else {
    if (String(man.version) !== String(version)) {
      problems.push(`ota/updates.json is v${man.version} but index.html is v${version}`);
    }
    if (!Array.isArray(man.notes) || !man.notes.length) problems.push('ota/updates.json has no patch notes');
  }
  // The zip must actually contain what a bundle needs.
  try {
    const list = execFileSync('unzip', ['-Z1', path.join(ROOT, 'ota/update.zip')], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const missing = OTA_FILES.filter((f) => list.indexOf(f) === -1);
    if (missing.length) problems.push('ota/update.zip is missing: ' + missing.join(', '));
    const zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const zipVersion = readVersion(zipped);
    if (String(zipVersion) !== String(version)) {
      problems.push(`the index.html inside ota/update.zip is v${zipVersion} but index.html is v${version}`);
    }
  } catch (e) {
    problems.push('could not read ota/update.zip: ' + (e && e.message));
  }
  if (problems.length) {
    console.error('ota-bundle --check FAILED — the published bundle is stale:');
    problems.forEach((p) => console.error('  • ' + p));
    console.error('Fix: run `node dev/ota-bundle.mjs` and commit ota/.');
    process.exit(1);
  }
  console.log(`ota-bundle --check OK — ota/ is v${version} and complete (${notes.length} notes).`);
  process.exit(0);
}

// Build the zip in a temp dir so entries sit at the zip root (the plugin unpacked
// them relative to the bundle root before).
//
// Every staged file gets the SAME fixed timestamp before zipping: a zip records
// each entry's mtime in its header, so otherwise the bundle's bytes changed on
// every run even when nothing about the app did — which made the CI publish step
// re-commit the bundle (and start another Android build) after every single push.
const FIXED_MTIME = new Date('2020-01-01T00:00:00Z');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecut-ota-'));
for (const f of OTA_FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) throw new Error('missing OTA file: ' + f);
  const dst = path.join(stage, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  fs.utimesSync(dst, FIXED_MTIME, FIXED_MTIME);
}
fs.mkdirSync(path.join(ROOT, 'ota'), { recursive: true });
const zipPath = path.join(ROOT, 'ota/update.zip');
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zipPath, ...OTA_FILES], { cwd: stage, stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });

const size = fs.statSync(zipPath).size;
const manifest = { version, url: 'update.zip', size, notes, date };
fs.writeFileSync(path.join(ROOT, 'ota/updates.json'), JSON.stringify(manifest));
// Legacy path kept in step (older clients looked for SideCut-web.zip).
fs.copyFileSync(zipPath, path.join(ROOT, 'ota/SideCut-web.zip'));
fs.writeFileSync(path.join(ROOT, 'ota/manifest.json'), JSON.stringify({ version, url: 'SideCut-web.zip', size, notes, date }));
// The copy at the repo root was the very first manifest location; keep it current
// so no client left pointing at it is ever told about an older version.
fs.writeFileSync(path.join(ROOT, 'updates.json'), JSON.stringify(manifest));

console.log(`ota-bundle: v${version} · ${size} bytes · ${notes.length} notes`);
console.log('  ota/update.zip  (index.html, sw.js, manifest.json, icons, dev/native-updates.js)');
console.log('  ota/updates.json + ota/manifest.json + updates.json');
