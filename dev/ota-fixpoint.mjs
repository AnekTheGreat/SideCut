#!/usr/bin/env node
/**
 * Put the OTA bundle and the root manifest at a fixed point.
 *
 * ota/update.zip and ota-play/update.zip both carry the ROOT manifest.json inside
 * them (it is on OTA_FILES - an installed bundle has to be able to read a manifest
 * even before it reaches the network). But the root manifest.json also carries the
 * `size` of the bundle it lives inside, and ota-bundle.mjs deliberately does NOT
 * rewrite it (root updates.json is the one it writes), because the root manifest
 * is the very first OTA location and is seeded from the built bundle.
 *
 * That is a chicken-and-egg: seed it with the size of a bundle that has not been
 * built with that seed yet. The way out is iteration, and it converges in one or
 * two passes in practice (the manifest is 1.6KB of text and the size field only
 * moves the compressed length by a byte or two):
 *
 *   seed root manifest.json with the size in ota/updates.json -> rebuild -> repeat
 *   until a rebuild produces the size it was seeded with.
 *
 * When that is true, the manifest inside the zip is the manifest that describes
 * the zip, and `dev/ota-update-check.cjs`'s "a second generation produces the same
 * bytes" holds instead of re-committing the bundle after every push.
 *
 *   node dev/ota-fixpoint.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPDS = path.join(ROOT, 'ota', 'updates.json');
const MAN = path.join(ROOT, 'manifest.json');

const read = () => JSON.parse(fs.readFileSync(UPDS, 'utf8'));
const run = (script) => execFileSync(process.execPath, [path.join(ROOT, 'dev', script)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });

let settled = false;
for (let i = 1; i <= 8; i++) {
  const seeded = read().size;
  fs.writeFileSync(MAN, JSON.stringify(read()));
  run('ota-bundle.mjs');
  run('ota-bundle-play.mjs');
  const now = read().size;
  console.log(`ota-fixpoint: pass ${i}: seeded ${seeded} -> built ${now}` + (seeded === now ? '  (fixed point)' : ''));
  if (seeded === now) { settled = true; break; }
}
if (!settled) {
  console.error('ota-fixpoint: the size did not settle after 8 passes - do not commit this bundle');
  process.exit(1);
}

// Report the finished state so a stale manifest cannot slip through unnoticed.
const zip = fs.statSync(path.join(ROOT, 'ota', 'update.zip')).size;
const play = fs.statSync(path.join(ROOT, 'ota-play', 'update.zip')).size;
for (const [file, want] of [
  ['manifest.json', zip], ['updates.json', zip], ['ota/manifest.json', zip],
  ['ota/updates.json', zip], ['ota-play/updates.json', play],
]) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const ok = j.size === want;
  console.log(`  ${ok ? 'OK ' : 'BAD'} ${file.padEnd(22)} v${j.version} size=${j.size} (file ${want})`);
  if (!ok) process.exit(1);
}
