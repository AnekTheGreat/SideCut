#!/usr/bin/env node
// SideCut — the service worker's cache name advances to 63.0.2.
//
// The user's words: "Just make the sw.js v63.0.2 you are not allowed to make full
// jumps from v63 to v64 without my consent".
//
// So this is the same move as dev/patch-623.mjs, one step on: the app stays at
// **62.1** (dev/patch-624.mjs) and only sw.js's CACHE_NAME moves. The name is a pure
// cache-buster — nothing in index.html compares it to APP_VERSION and there is no
// `SW_UPDATED` consumer — so it carries its own number and the two never have to
// agree. The sw.js script bytes now differ from the last release, which is the point:
// a changed service-worker script is what makes the browser install the new worker
// and delete the old shell cache under a name nobody serves any more.
//
// `version: 63.0.2` is NOT an app version and must never be substituted into
// APP_VERSION or the CHANGELOG; the 63 line belongs to the cache-buster alone, and
// a jump past it (v64) needs the user's explicit consent.
//
//   node dev/patch-625.mjs              # sw.js + the five pinned literals
//   node dev/patch-625.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const SW_CACHE = '63.0.2';       // the new cache-name version
const PREV_SW_CACHE = '63.0.1';  // what it was

if (!MANIFEST_ONLY) {
  // -------------------------------------------------------------------------
  // 1. sw.js — the only file that carries the cache name.
  // -------------------------------------------------------------------------
  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';";
  if (sw.includes(newSw)) {
    console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
  } else {
    const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + PREV_SW_CACHE + "';";
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
  }

  // -------------------------------------------------------------------------
  // 2. Repin the five files that pin the literal cache name. The twelve that
  //    assert the naming convention are already decoupled and need nothing.
  // -------------------------------------------------------------------------
  const OLD_LITERAL = "const CACHE_NAME = 'sidecut-shell-v" + PREV_SW_CACHE + "';";
  const NEW_LITERAL = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';";

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    const t = fs.readFileSync(p, 'utf8');
    if (t.indexOf(OLD_LITERAL) === -1) continue;
    repinned += t.split(OLD_LITERAL).length - 1;
    fs.writeFileSync(p, t.split(OLD_LITERAL).join(NEW_LITERAL));
    console.log('  ' + name + ' — literal cache name -> sidecut-shell-v' + SW_CACHE);
  }
  console.log('patch-625: sw.js -> sidecut-shell-v' + SW_CACHE + ', ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-625 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
