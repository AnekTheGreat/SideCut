#!/usr/bin/env node
// SideCut — the service worker's cache name is 63.0.1, not the app version.
//
// The user's words: "The sw.js can be 63.0.1".
//
// The app itself stays at 62.0.5 (that was their earlier correction: "It should
// be v62.0.5 not v63"). What moves is only sw.js's CACHE_NAME, which is a pure
// cache-buster — nothing in the app compares it to APP_VERSION (there is no
// `SW_UPDATED` consumer anywhere in index.html; the cache name only decides
// which old caches `activate` deletes). So it is free to be its own number.
//
// This changes the test contract that tied the two together: dev/test-*.mjs
// used to assert `sw.includes('sidecut-shell-v' + ver)` and, in five places,
// the exact literal `sidecut-shell-v62.0.5`. Both are repinned here to the
// decoupled name.
//
//   node dev/patch-623.mjs              # sw.js + the release assertions
//   node dev/patch-623.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const SW_CACHE = '63.0.1';       // the new cache-name version
const PREV_SW_CACHE = '62.0.5';  // what it was (== APP_VERSION until now)

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
  // 2. Repin the release assertions. The SW cache name no longer follows
  //    APP_VERSION, so what is asserted is the naming convention here and the
  //    exact name in the five files that already pinned a literal.
  // -------------------------------------------------------------------------
  const OLD_FOLLOWS = "sw.includes('sidecut-shell-v' + ver), 'service worker cache follows the version'";
  const NEW_FOLLOWS = 'sw.includes("const CACHE_NAME = \'sidecut-shell-v"), \'service worker has a versioned cache name\'';
  const OLD_LITERAL = "const CACHE_NAME = 'sidecut-shell-v" + PREV_SW_CACHE + "';";
  const NEW_LITERAL = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';";

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    if (t.indexOf(OLD_FOLLOWS) !== -1) {
      repinned += t.split(OLD_FOLLOWS).length - 1;
      t = t.split(OLD_FOLLOWS).join(NEW_FOLLOWS);
      console.log('• ' + name + ' — SW cache follows APP_VERSION -> versioned-name convention');
    }
    if (t.indexOf(OLD_LITERAL) !== -1) {
      repinned += t.split(OLD_LITERAL).length - 1;
      t = t.split(OLD_LITERAL).join(NEW_LITERAL);
      console.log('• ' + name + ' — literal cache name -> sidecut-shell-v' + SW_CACHE);
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-623: sw.js -> sidecut-shell-v' + SW_CACHE + ', ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-623 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
