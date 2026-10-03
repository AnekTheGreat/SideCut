#!/usr/bin/env node
/**
 * 71.8 - the shell cache is the release number.
 *
 * The owner's rule: "The cache should be whatever the patch notes number is" and
 * "Every release bumps it".
 *
 * 63.1.4 decoupled the service worker cache from APP_VERSION on purpose, and every
 * gate written since then asserts the OLD rule - "the shell cache carries none of
 * the app version". 71.8 reverses that, so this gate pins the new one AND pins that
 * the reversal is complete: the machinery derives the name (nobody types it twice),
 * and no gate anywhere still carries the old assertion, which would otherwise fail
 * one file at a time.
 *
 * Why the old rule existed at all, and why this does not repeat its bug: the first
 * scheme built the name out of the version's leading line (`sidecut-shell-v70.0`),
 * so two releases in the same line shared one cache name and the later one served
 * the earlier one's shell. One name per RELEASE cannot do that - APP_VERSION moves
 * every release, and the cache name moves with it.
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the name is the release number, and the scripts derive it;
 *   [3] the old rule is gone from every gate;
 *   [4] the published channel carries the release;
 *   [5] what did not move;
 *   [6] inline script syntax.
 *
 *   node dev/test-718.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '72.6'; /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */
const PREV = '72.5.2'; /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */
const SHELL_CACHE = 'sidecut-shell-v72.6';
const OWN = '71.8'; // repin-719: the release this gate describes

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const items = head.items || [];
    const own = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (own.items || []).join('\n');
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next');
    const notes = items.join('\n');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/stripe/i.test(items.slice(0, 6).join('\n')), 'and the first six name no card page');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    ok(/cache/i.test(ownNotes), 'the 71.8 notes name the cache');
    ok(/release/i.test(ownNotes), 'and the release it is named after');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
}

console.log('[2] the name is derived, not typed twice');
{
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(SHELL_CACHE), 'the name is versioned (' + SHELL_CACHE + ')');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-718.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '71.8';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-718.mjs'), 'utf8');
  // Deliberately regexes rather than the literals: the old name must not survive in
  // any gate, and these must keep holding after the next release moves it on again.
  ok(/const OLDCACHE = 'sidecut-shell-v[^']+';/.test(repin), 'the repin sweep knows the name it is moving from');
  ok(/const NEWCACHE = 'sidecut-shell-v' \+ NEWVER;/.test(repin),
    'and derives the new one from the version it moves to');
  // The flip is in the sweep, so a release that moved the rule without moving the
  // gates would fail there rather than in some other file.
  ok(repin.indexOf('const CACHE_RULE =') !== -1, 'the sweep owns the cache-rule flip');
  ok(repin.indexOf('BESPOKE_CACHE_RULE') !== -1, 'with the two gates whose version is their own release named');
}

console.log('[3] the old rule is gone from every gate');
{
  const dev = path.join(ROOT, 'dev');
  // This file is excluded on purpose: it NAMES the old rule and the old cache in
  // the assertions below, so it is the one gate that is allowed to carry them.
  const files = fs.readdirSync(dev)
    .filter((n) => /^test-.*\.mjs$/.test(n) || n === 'ota-update-check.cjs')
    .filter((n) => n !== 'test-718.mjs');
  ok(files.length > 20, 'there are the gates to check (' + files.length + ')');
  let oldRule = 0, oldCache = 0, pinnedWrongly = 0;
  for (const name of files) {
    const t = fs.readFileSync(path.join(dev, name), 'utf8');
    if (t.indexOf('and carries none of the app version') !== -1) oldRule++;
    if (t.indexOf('and is not the app version') !== -1) oldRule++;
    if (t.indexOf('sidecut-shell-v63.') !== -1) oldCache++;
    // A gate that pins a shell-cache literal at all must pin THIS release's name.
    if (/SHELL_CACHE = 'sidecut-shell-v[^']+'/.test(t) && t.indexOf(SHELL_CACHE) === -1) pinnedWrongly++;
  }
  ok(oldRule === 0, 'no gate still asserts the cache is not the app version (' + oldRule + ')');
  ok(oldCache === 0, 'and none names the old decoupled cache (' + oldCache + ')');
  ok(pinnedWrongly === 0, 'and every shell-cache pin names this release (' + pinnedWrongly + ')');
  const ota = fs.readFileSync(path.join(dev, 'ota-update-check.cjs'), 'utf8');
  ok(ota.indexOf("swCache === ('sidecut-shell-v' + APP_VERSION)") !== -1,
    'the published-bundle probe asserts the new rule');
}

console.log('[4] the published channel carries the release');
{
  const man = path.join(ROOT, 'ota', 'updates.json');
  ok(fs.existsSync(man), 'ota/updates.json exists');
  if (fs.existsSync(man)) {
    const m = JSON.parse(fs.readFileSync(man, 'utf8'));
    ok(String(m.version) === VER, 'and it is on ' + VER + ' (' + m.version + ')');
    ok((m.notes || []).length >= 6, 'with the patch notes (' + (m.notes || []).length + ')');
    const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
    let entries = null;
    try { entries = eval('[' + block[1] + ']'); } catch (e) {}
    if (entries) {
      const first6 = (entries[0].items || []).slice(0, 6);
      ok(JSON.stringify(m.notes) === JSON.stringify(first6),
        'and they are the head entries first six, verbatim');
    }
  }
  const play = path.join(ROOT, 'ota-play', 'updates.json');
  ok(fs.existsSync(play), 'ota-play/updates.json exists');
  if (fs.existsSync(play)) {
    const m = JSON.parse(fs.readFileSync(play, 'utf8'));
    ok(String(m.version) === VER, 'and the store channel is on ' + VER + ' too (' + m.version + ')');
  }
  // The zip is what the installed app actually downloads, so the cache name it
  // would install is the one that matters, not the one on disk here.
  const zip = path.join(ROOT, 'ota', 'update.zip');
  ok(fs.existsSync(zip), 'ota/update.zip exists');
}

console.log('[5] the release itself is unchanged where it should be');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries, 'the changelog still parses');
  if (entries) {
    const prev = entries.find((e) => String(e.version) === PREV);
    ok(!!prev, 'the ' + PREV + ' entry is still there');
    ok(!!prev && (prev.items || []).length >= 6, 'and still carries its notes (' + (prev ? prev.items.length : 0) + ')');
    ok(!!entries.find((e) => String(e.version) === '71.6'), 'and the 71.6 entry behind it');
  }
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
}

console.log('[6] inline script syntax');
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

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
