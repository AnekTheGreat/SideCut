#!/usr/bin/env node
// 81.2 - the album sheet offers your albums, not the tags on your files.
//
// Static: the version, the three notes through the updater's own filter, the two labels
// that were renumbered, and the shape of the chooser.
// Driven: the two functions this release is about are lifted out of the page by counting
// braces from their own headers and run in a sandbox. scStreamDownloadPick is handed a
// library full of album TAGS - the exact names from the owner's photograph - plus two
// real albums, and what it puts in the sheet is inspected: the albums, in card order,
// with their counts, and not one tag. scStreamDeviceAlbums is handed a store holding an
// empty album and an auto album, and it must offer neither. So this proves the list is
// built from userAlbums rather than grepping for a variable name.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
const failed = [];
function ok(cond, msg) {
  if (cond) { passed++; return; }
  failed.push(msg);
}
function between(a, b, from) {
  const i = html.indexOf(a, from || 0);
  if (i < 0) throw new Error('missing anchor: ' + a);
  const j = html.indexOf(b, i + a.length);
  if (j < 0) throw new Error('missing end anchor: ' + b);
  return html.slice(i, j);
}
const count = (s, needle) => s.split(needle).length - 1;

function fnText(name) {
  const at = html.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('missing function: ' + name);
  const open = html.indexOf('{', at);
  let depth = 1;
  let i = open + 1;
  while (i < html.length && depth > 0) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') depth--;
    i++;
  }
  return html.slice(at, i);
}

// ── the version, and the two labels that should never have shipped ──────────
ok(count(html, "const APP_VERSION = '81.2';") === 1, 'the page says 81.2, once');
ok(count(html, "'80.11'") === 0, 'no label in the page still says 80.11');
ok(count(html, "'80.10'") === 0, 'and none says 80.10');
ok(/80\.9 is followed by 81, then 81\.1 and 81\.2/.test(html), 'the notes state the rule the numbers now follow');
ok(/AND THE SECOND NUMBER STOPS AT NINE TOO/.test(html), 'and the version comment in the page says it for the future');

// the changelog reads downwards in the new scheme
const labels = (html.match(/\{ version: '([^']+)',/g) || []).slice(0, 5)
  .map((s) => s.replace(/^\{ version: '/, '').replace(/',$/, ''));
ok(JSON.stringify(labels) === JSON.stringify(['81.2', '81.1', '81', '80.9', '80.8']),
  'the changelog now reads 81.2, 81.1, 81, 80.9, 80.8: ' + JSON.stringify(labels));

// ── the notes, through the updater's own filter ─────────────────────────────
const entry = between("{ version: '81.2',", "{ version: '81.1',");
const notes = entry.match(/'\[FULL\] ([^']*)'/g) || [];
ok(notes.length === 3, 'three notes ship with this release, not ' + notes.length);
const DROP = /streaming|streams?\b|from the source|pinned artist/i;
const texts = notes.map((n) => n.replace(/^'\[FULL\] /, '').replace(/'$/, ''));
texts.forEach((text, i) => {
  ok(!DROP.test(text), 'note ' + (i + 1) + ' survives the updater filter');
  ok(text.indexOf("'") === -1, 'note ' + (i + 1) + ' carries no apostrophe');
});
ok(/albums you actually made/.test(texts[0]) && /tags on your files/.test(texts[0]),
  'the first note names the bug: your albums, not the tags on the files');
ok(/tag is not an album/.test(texts[1]), 'the second note says a tag is not an album');
ok(/80\.9 is followed by 81/.test(texts[2]), 'the third note is the numbering');
ok(/title: 'Your albums, not the tags on your files'/.test(entry), 'the title says it too');

// ── the chooser, as written ────────────────────────────────────────────────
const pick = fnText('scStreamDownloadPick');
ok(!/allTracks/.test(pick), 'the chooser no longer walks the tracks');
ok(!/t\.album|\.album\b/.test(pick), 'and reads no album tag off a file');
ok(/scStreamDeviceAlbums\(\)/.test(pick), 'it reads the albums the Add to an album sheet reads');
ok(/counts\[n\]/.test(pick) && /song' \+ \(c === 1 \? '' : 's'\)/.test(pick), 'each row carries a count, singular or plural');
ok(/names\.slice\(0, 40\)/.test(pick), 'the 40 row cap is unchanged');
ok(/No albums yet - make the first one/.test(pick), 'with no albums the one choice names itself');

// ── driven: the real function, a library of tags, two real albums ──────────
function drivePick(sheet) {
  const sheets = [];
  const calls = [];
  const ctx = {
    scStreamSheet: (title, acts) => { sheets.push({ title, acts }); },
    scStreamDownload: (id, dest) => { calls.push(dest); },
    playlists: sheet.playlists || {},
    allTracks: sheet.tags || [],
    prompt: () => sheet.typed || '',
  };
  if (sheet.albums !== undefined) ctx.scStreamDeviceAlbums = () => sheet.albums;
  vm.createContext(ctx);
  vm.runInContext(fnText('scStreamDownloadPick'), ctx);
  ctx.__kind = sheet.kind || 'al';
  vm.runInContext('scStreamDownloadPick("s1", __kind)', ctx);
  return { sheets, calls };
}

// The names in the owner's photograph are tags on files. They are in allTracks and
// must not reach the sheet.
const TAGS = ['Bambiha Bole (feat. Sidhu Moose Wala)', 'BATIDAO FUNK', 'Beeper Funk (Super Slowed)',
  'Bermuda Triangle', 'Best Of Arijit Singh - Revisited', 'BK Songs', 'BLACK NIGGA', 'Blue Eyes',
  'Bobby', 'BOUNCE FUNK (Slowed)', 'Brown Munde'];

const a = drivePick({ albums: [{ name: 'Road Trip', n: 12 }, { name: 'Late Night', n: 1 }], tags: TAGS });
ok(a.sheets.length === 1, 'the album chooser opens one sheet');
ok(a.sheets[0].title === 'All Songs and an album', 'and it is still the album sheet: ' + a.sheets[0].title);
const alabels = a.sheets[0].acts.map((x) => x.label);
ok(JSON.stringify(alabels) === JSON.stringify(['New album\u2026', 'Road Trip \u00b7 12 songs', 'Late Night \u00b7 1 song']),
  'driven: the rows are the albums, with counts, and not one tag: ' + JSON.stringify(alabels));
TAGS.forEach((tag) => {
  ok(alabels.indexOf(tag) === -1, 'driven: the tag "' + tag + '" is not offered as an album');
});

// card order is the order the sheet keeps - it is not re-sorted alphabetically
const b = drivePick({ albums: [{ name: 'Zeta', n: 2 }, { name: 'Alpha', n: 5 }], tags: TAGS });
const blabels = b.sheets[0].acts.slice(1).map((x) => x.label);
ok(blabels[0].indexOf('Zeta') === 0 && blabels[1].indexOf('Alpha') === 0,
  'driven: the albums keep the order the Albums page keeps: ' + JSON.stringify(blabels));

// a new album typed into the sheet is still a real album destination
const c = drivePick({ albums: [], tags: TAGS, typed: 'Made Here' });
ok(c.sheets[0].acts.length === 1, 'driven: with no albums there is one choice');
ok(c.sheets[0].acts[0].label === 'No albums yet - make the first one',
  'driven: and it says so: ' + c.sheets[0].acts[0].label);
c.sheets[0].acts[0].run();
ok(c.calls.length === 1 && c.calls[0].kind === 'al' && c.calls[0].name === 'Made Here',
  'driven: making one sends the song to an album of that name');

// a missing helper is not a crash, and it does not fall back to tags
const d = drivePick({ tags: TAGS });
ok(d.sheets.length === 1 && d.sheets[0].acts.length === 1,
  'driven: if the album helper is not there the sheet still opens, with no tags in it');

// choosing an album sends the song to that album
const e = drivePick({ albums: [{ name: 'Road Trip', n: 12 }], tags: TAGS });
e.sheets[0].acts[1].run();
ok(e.calls.length === 1 && e.calls[0].kind === 'al' && e.calls[0].name === 'Road Trip',
  'driven: a row sends the song to that album by name');

// the playlist branch keeps its rules and gains counts
const f = drivePick({
  kind: 'pl',
  playlists: { 'Road Trip': ['a', 'b'], 'All Songs': ['a'], 'Unsorted': ['b'], 'Solo': ['a'] },
  tags: TAGS,
});
const flabels = f.sheets[0].acts.map((x) => x.label);
ok(f.sheets[0].title === 'All Songs and a playlist', 'driven: the playlist sheet is unchanged in name');
ok(flabels.indexOf('All Songs') === -1 && flabels.indexOf('Unsorted') === -1,
  'driven: All Songs and Unsorted are still not offered as playlists');
ok(flabels.indexOf('Road Trip \u00b7 2 songs') !== -1, 'driven: a playlist shows its count');
ok(flabels.indexOf('Solo \u00b7 1 song') !== -1, 'driven: and a one song playlist reads in the singular');

// ── driven: albums that exist, and only those ──────────────────────────────
function driveDeviceAlbums(store) {
  const ctx = {
    userAlbums: store,
    visibleAlbumNames: () => Object.keys(store).filter((n) => !(store[n].auto === true && store[n].manual !== true)),
    scAlbumCardOrder: (names) => names.slice(),
  };
  vm.createContext(ctx);
  vm.runInContext(fnText('scStreamDeviceAlbums'), ctx);
  return vm.runInContext('scStreamDeviceAlbums()', ctx);
}
const dev = driveDeviceAlbums({
  'Road Trip': { trackIds: ['1', '2', '3'] },
  'Empty One': { trackIds: [] },
  'Auto Made': { trackIds: ['9'], auto: true },
});
ok(dev.length === 1 && dev[0].name === 'Road Trip' && dev[0].n === 3,
  'driven: only albums that exist and hold songs are offered: ' + JSON.stringify(dev));

// ── every inline script still compiles ─────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc812-'));
const scripts = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html)) !== null) {
  if (/\bsrc\s*=/.test(m[1])) continue;
  if (!m[2].trim()) continue;
  scripts.push(m[2]);
}
ok(scripts.length >= 5, 'the page carries its inline scripts (' + scripts.length + ')');
scripts.forEach((src, i) => {
  const f2 = path.join(tmp, 'script-' + i + '.js');
  fs.writeFileSync(f2, src);
  try {
    execFileSync(process.execPath, ['--check', f2], { stdio: 'pipe' });
  } catch (err) {
    ok(false, 'inline script ' + i + ' compiles: ' + String(err.stderr || err.message).split('\n').slice(0, 3).join(' '));
  }
});
ok(true, 'all ' + scripts.length + ' inline scripts compile');

// ── both bundles ────────────────────────────────────────────────────────────
function zipEntry(zip, name) {
  return execFileSync('unzip', ['-p', zip, name], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
}
['ota', 'ota-play'].forEach((dir) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'updates.json'), 'utf8'));
  const zip = path.join(ROOT, dir, 'update.zip');
  ok(manifest.version === '81.2', dir + ': the bundle is 81.2');
  ok(manifest.size === fs.statSync(zip).size, dir + ': its recorded size is the zip');
  const inner = zipEntry(zip, 'index.html');
  ok(inner.includes("const APP_VERSION = '81.2';"), dir + ': the zip carries the 81.2 page');
  ok(inner.includes('81.2 - THE NAME ON THE ROW IS AN ALBUM OF YOURS'), dir + ': with the album sheet fixed in it');
  ok(!/allTracks \|\| \[\]\)\.forEach\(function\(t\)\{\s*var a = String\(\(t && t\.album\)/.test(inner),
    dir + ': and the tag scan is not in the page it ships');
});

console.log('check-812: ' + passed + ' passed, ' + failed.length + ' failed');
failed.forEach((f) => console.log('  x ' + f));
process.exit(failed.length ? 1 : 0);
