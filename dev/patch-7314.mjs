#!/usr/bin/env node
/**
 * 73.1.4 - the Important tab, assembled.
 *
 * Folding a Settings tab out of one place and into another means moving whole
 * HTML blocks, and the two blocks here are big and carry unicode. So they are
 * MOVED BY INDEX, not retyped: a short ASCII anchor finds each block and the
 * exact bytes are lifted across, which cannot drift from the page the way a
 * hand-copied block can.
 *
 *   1. The Gemini key card (field, Paste button, the "auto-saves" note and the
 *      aistudio link) leaves Support. The same field already sits in the new
 *      Important pane, so the old block is cut out - two copies of one id would
 *      make getElementById ambiguous and would fail the DOM integrity gate.
 *   2. The feature map ("What SideCut can do") leaves More and drops into the
 *      placeholder the Important pane carries for it.
 *
 *   node dev/patch-7314.mjs            # apply
 *   node dev/patch-7314.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const FILE = path.join(ROOT, 'index.html');
const CHECK = process.argv.includes('--check');
let src = fs.readFileSync(FILE, 'utf8');
const before = src;

// 1. the old key block, from its wrapper through the helper line just before the
//    Contact card that follows it in the Support pane.
const keyStart = src.indexOf('      <div id="aiGeminiKeySectionREMOVED"');
const keyEnd = src.indexOf('      <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--line);">', keyStart);
if (keyStart !== -1 && keyEnd > keyStart) {
  src = src.slice(0, keyStart) + src.slice(keyEnd);
}

// 2. the feature map block, from its comment through the closing wrapper div,
//    stopping at the "Works offline" card that follows it in the More pane.
const fmStart = src.indexOf('      <!-- Collapsible: the feature map (72.9).');
const woText = '        <div style="font-size:13px; font-weight:600; margin-bottom:8px;">Works offline</div>';
const woAt = src.indexOf(woText, fmStart);
const fmEnd = src.lastIndexOf('      <div style="margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--line);">', woAt);
const slot = '      <!-- FEATURE_MAP_HERE -->';
if (fmStart !== -1 && woAt > fmStart && fmEnd > fmStart && src.indexOf(slot) !== -1) {
  const block = src.slice(fmStart, fmEnd);
  src = src.slice(0, fmStart) + src.slice(fmEnd);
  src = src.replace(slot, block);
}

if (src === before) {
  console.log('patch-7314: already applied');
} else if (CHECK) {
  console.log('patch-7314: the Important tab would be assembled (' + (src.length - before.length) + ' bytes)');
} else {
  fs.writeFileSync(FILE, src);
  console.log('patch-7314: Important tab assembled (' + (src.length - before.length) + ' bytes)');
}
