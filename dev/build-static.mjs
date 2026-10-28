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
// Native OTA updater script — needed by the Capacitor app after an OTA bundle install.
try { await cp(join(root, 'dev', 'native-updates.js'), join(dist, 'dev', 'native-updates.js')); } catch { /* optional */ }
// 80.5 - full/ is the door to the web app with the converters (/full/ -> ../?full=1),
// so a static build that copies the shell but not the door would ship a page with
// no way back to the tools.
for (const d of ['.well-known', 'tools', 'full']) {
  try { await cp(join(root, d), join(dist, d), { recursive: true }); } catch { /* optional dir, skip */ }
}
console.log('Built static shell into dist/');
