#!/usr/bin/env node
// v60.4.9 verification — extracts the ACTUAL shipped __scDurBubble factory and
// wiring from index.html: the clamp gate, the badge/chip removal, and the release metadata.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

console.log('[1] shipped factory extracted from index.html');
const m = src.match(/window\.__scDurBubble = \(function\(\)\{[\s\S]*?\n  \}\)\(\);/);
ok(!!m, 'factory block present');
let bub = null;
const winListeners = [];
if (m) {
  const doc = {
    _b: null,
    getElementById() { return null; },
    createElement() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}, body: { appendChild() {} }
  };
  const win = { innerWidth: 400, innerHeight: 800, addEventListener(t) { winListeners.push(t); } };
  const expr = m[0].replace('window.__scDurBubble = ', '').replace(/;\s*$/, '');
  bub = new Function('document', 'window', 'return ' + expr)(doc, win);

  console.log('[2] isClamped — the popup gate');
  ok(typeof bub.isClamped === 'function', 'isClamped exported');
  ok(bub.isClamped({ scrollWidth: 300, clientWidth: 200 }) === true, 'clipped line -> clamped');
  ok(bub.isClamped({ scrollWidth: 200, clientWidth: 200 }) === false, 'fully visible -> not clamped');
  ok(bub.isClamped({ scrollWidth: 201, clientWidth: 200 }) === false, '1px sub-pixel slack ignored');
  ok(bub.isClamped({ scrollWidth: 202, clientWidth: 200 }) === true, 'real 2px overflow counts');
  ok(bub.isClamped(null) === false, 'null element -> not clamped');

  console.log('[3] syncCursor — pointer only while clamped');
  const elA = { scrollWidth: 300, clientWidth: 200, style: {} };
  const elB = { scrollWidth: 100, clientWidth: 200, style: {} };
  bub.syncCursor(elA); bub.syncCursor(elB);
  ok(elA.style.cursor === 'pointer', 'clamped line gets pointer cursor');
  ok(elB.style.cursor === '', 'visible line gets no pointer cursor');
  ok(typeof bub.syncAll === 'function' && winListeners.includes('resize'), 're-syncs on resize');
  bub.hide(); // must be safe with no bubble in the DOM
  ok(true, 'hide() safe when bubble never created');
}

console.log('[4] the album card line is clamp-gated; the playlist header answers every tap');
// The header runtime line was gated on the same clamp measurement. On a phone
// that reads "233 tracks · 12h …" and the tap came back empty — the clamp a
// person cannot measure is not a gate a tap should have to pass. It answers
// always now, and says so with a pointer cursor.
ok(!/if\(!window\.__scDurBubble\.isClamped\(_subEl\)\)/.test(src),
  'the playlist header line no longer waits on a clamp measurement');
ok(src.includes("_subEl.addEventListener('pointerup', _openDurBubble);"),
  'and answers a pointer gesture, not only a click');
ok(/_subEl\.style\.cursor = 'pointer'/.test(src), 'the header runtime line shows it is tappable');
ok(/if\(!window\.__scDurBubble\.isClamped\(_albDurEl\)\)\{ window\.__scDurBubble\.hide\(\); return; \}/.test(src),
  'album card line gated');
ok(!/"cursor:pointer;'\)/.test(src), 'no forced inline pointer cursor on album subtitle');

console.log('[5] stray markers removed from song rows');
ok(!/No audio<\/span>/.test(src), '"⚠ No audio" badge span is gone');
ok(!/_noAudio \?/.test(src), 'row template no longer branches on _noAudio');
ok(!/class="genre-tag/.test(src) && !/class=\\"genre-tag/.test(src), 'genre chip no longer rendered');
ok(/class="dur">\$\{\(t\.duration \? fmtTime\(t\.duration\) : '--:--'\)\}/.test(src),
  'row duration column shows plain time');

console.log('[6] popup stays out of the way of dropdowns and controls');
const bubCss = (src.match(/\.dur-bubble\{[\s\S]*?\n  \}/) || [])[0];
ok(!!bubCss, '.dur-bubble CSS block present');
ok(/pointer-events:\s*none/.test(bubCss || ''), 'bubble ignores taps (pointer-events:none)');
const bubZ = bubCss && Number((bubCss.match(/z-index:\s*(\d+)/) || [])[1]);
const sheetZ = Number(((src.match(/\.modal-backdrop\{[\s\S]*?z-index:(\d+)/) || [])[1]));
ok(Number.isFinite(bubZ) && bubZ === 50, `bubble z-index is 50 (got ${bubZ})`);
ok(Number.isFinite(sheetZ) && bubZ < sheetZ,
  `bubble sits below every sheet/backdrop (${bubZ} < ${sheetZ})`);
ok(!/z-index:80;\s*\n\s*\/\*/.test(bubCss || ''), 'old z-index:80 removed from bubble');

console.log('[7] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(/^\d+(\.\d+)*$/.test(ver || ''), `APP_VERSION = ${ver}`);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, `newest changelog (${entries && entries[0].version}) matches APP_VERSION`);
if (entries) {
  ok(/EDT$/.test(entries[0].date || ''), 'date ends in EDT (' + entries[0].date + ')');
  ok(entries[0].items.length >= 3, `patch notes: ${entries[0].items.length}`);
  ok(entries.some(e => e.version === '60.4.9' && (e.items || []).some(t => /out of your way/.test(t))), '60.4.9 out-of-the-way note present');
}
const maps = [...src.matchAll(/LEGACY_VERSIONS = (\{[^}]*\})/g)].map(x => x[1]);
ok(!maps.some(x => x.includes(`'${ver}'`)), `no LEGACY map contains ${ver}`);

console.log(`\nFAILURES: ${fail} — ${pass} passed`);
process.exit(fail ? 1 : 0);
