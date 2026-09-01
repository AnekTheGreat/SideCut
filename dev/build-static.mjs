// SideCut static build — this is a no-compile PWA, so "building" just means
// copying the shell into dist/ for the hosting builder.
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const files = ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png', '.nojekyll'];
for (const f of files) {
  try { await cp(join(root, f), join(dist, f)); } catch { /* optional asset, skip */ }
}
for (const d of ['.well-known', 'tools']) {
  try { await cp(join(root, d), join(dist, d), { recursive: true }); } catch { /* optional dir, skip */ }
}
console.log('Built static shell into dist/');