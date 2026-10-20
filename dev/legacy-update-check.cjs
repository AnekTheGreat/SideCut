// 75.1.1 - the legacy update path must name a bundle that exists.
//
// The repository root still carries updates.json and manifest.json for older
// clients. Both used to say url: "update.zip", which resolves to /update.zip at
// the repository root - and no such file is published (GitHub Pages served a
// 404; the real bundle is ota/update.zip). This gate reads the shipped files,
// resolves the URL the way a client resolves it, and proves the target is there
// and is the size the manifest promises.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { passed += 1; console.log('  PASS ' + label); }
  else { failures.push(label); console.log('  FAIL ' + label); }
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
  catch (e) { return { __error: e.message }; }
}

const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const version = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(!!version, 'the page declares APP_VERSION (' + version + ')');

for (const file of ['updates.json', 'manifest.json']) {
  const man = readJson(file);
  ok(!man.__error, file + ' parses (' + (man.__error || 'ok') + ')');
  ok(String(man.version) === String(version), file + ' is on this release (' + man.version + ')');
  ok(man.url === 'ota/update.zip', file + ' names the published bundle (' + man.url + ')');

  const target = path.resolve(ROOT, man.url || '');
  const exists = !!man.url && fs.existsSync(target) && fs.statSync(target).isFile();
  ok(exists, file + ' resolves to a real file (' + (man.url || 'no url') + ')');
  if (exists) {
    const size = fs.statSync(target).size;
    ok(man.size === size, file + ' records the bundle size (' + man.size + ' = ' + size + ')');
    const head = fs.readFileSync(target).subarray(0, 2).toString('latin1');
    ok(head === 'PK', file + ' target is a zip (PK header)');
  }
}

const ota = readJson('ota/updates.json');
kok(String(ota.version) === String(version), 'ota/updates.json is on this release (' + ota.version + ')');
ok(ota.url === 'update.zip', 'ota/updates.json still names its sibling bundle (' + ota.url + ')');
const otaTarget = path.join(ROOT, 'ota', ota.url || '');
ok(fs.existsSync(otaTarget) && fs.statSync(otaTarget).isFile(), 'ota/' + ota.url + ' exists');
if (fs.existsSync(otaTarget)) {
  ok(ota.size === fs.statSync(otaTarget).size, 'ota/updates.json records the bundle size (' + ota.size + ')');
}

console.log('');
if (failures.length) {
  console.log('legacy-update-check: ' + passed + ' passed, ' + failures.length + ' FAILED');
  process.exit(1);
}
console.log('legacy-update-check: ' + passed + ' passed, 0 failed');
