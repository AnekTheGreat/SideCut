#!/usr/bin/env node
// v60.4.8 verification — extracts the ACTUAL shipped __scDurBubble factory and
// wiring from index.html and exercises it with a tiny DOM stub.
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
if (m) {
  // Minimal DOM stub good enough for the real factory code.
  const mkEl = () => ({
    style: {}, classList: { add() {}, remove() {}, toggle(c, on) { this._b = on; } },
    innerHTML: '', id: '', className: '', _anchor: null, _hideTimer: null,
    offsetWidth: 200, offsetHeight: 60,
    querySelector(sel) {
      this._q = this._q || {};
      if (!this._q[sel]) this._q[sel] = { textContent: '' };
      return this._q[sel];
    }
  });
  const doc = {
    _b: null,
    getElementById(id) { return id === 'durBubble' ? this._b : null; },
    createElement() { const e = mkEl(); e.id = 'durBubble'; this._b = e; return e; },
    addEventListener() {}, body: { appendChild() {} }
  };
  const win = { innerWidth: 400, innerHeight: 800, addEventListener() {} };
  const expr = m[0].replace('window.__scDurBubble = ', '').replace(/;\s*$/, '');
  const factory = new Function('document', 'window', 'return ' + expr)(doc, win);
  bub = factory;

  console.log('[2] fmtPrecise — exact total to the second');
  ok(bub.fmtPrecise(0) === '0s', `0 -> "${bub.fmtPrecise(0)}"`);
  ok(bub.fmtPrecise(45) === '45s', `45 -> "${bub.fmtPrecise(45)}"`);
  ok(bub.fmtPrecise(125) === '2m 5s', `125 -> "${bub.fmtPrecise(125)}"`);
  ok(bub.fmtPrecise(44643) === '12h 24m 3s', `44643 (the 238-track case) -> "${bub.fmtPrecise(44643)}"`);
  ok(bub.fmtPrecise(-5) === '0s', 'negative clamps to 0s');
  ok(bub.fmtPrecise(NaN) === '0s', 'NaN clamps to 0s');

  console.log('[3] toggle — show, fill, second tap closes');
  const anchor = { getBoundingClientRect: () => ({ left: 20, top: 300, bottom: 330 }) };
  const anchor2 = { getBoundingClientRect: () => ({ left: 20, top: 500, bottom: 530 }) };
  bub.toggle(anchor, 44643, '238 tracks · Punjabi Gaane');
  const b = doc._b;
  ok(b && b.style.display === 'block', 'first tap shows the bubble');
  ok(b.querySelector('.bt').textContent === '12h 24m 3s', `title is the exact total ("${b.querySelector('.bt').textContent}")`);
  ok(b.querySelector('.ba').textContent === '238 tracks · Punjabi Gaane', 'subtitle carries track count + name');
  ok(b.style.top === (300 - 60 - 12) + 'px', 'positioned 12px above the tapped line');
  ok(b.style.visibility === 'visible', 'visible after measuring');
  bub.toggle(anchor, 44643, 'x');
  ok(b.style.display === 'none', 'second tap on the same line closes it');
  bub.toggle(anchor, 44643, 'x');
  ok(b.style.display === 'block', 'third tap reopens');
  bub.toggle(anchor2, 44643, 'y');
  ok(b.style.display === 'block' && b._anchor === anchor2, 'tapping a different line switches the bubble to it');
  bub.hide();
  ok(b.style.display === 'none', 'hide() closes it (scroll/outside tap path)');

  console.log('[4] no-room fallback — near the top it drops BELOW the line');
  const topAnchor = { getBoundingClientRect: () => ({ left: 20, top: 8, bottom: 38 }) };
  bub.toggle(topAnchor, 600, 'sub');
  ok(b.style.top === (38 + 12) + 'px', `dropped below when no room above (top=${b.style.top})`);
  bub.hide();
}

console.log('[5] wiring present in the shipped source');
ok(/_subEl\.setAttribute\('data-dur-bubble', '1'\)/.test(src), 'pane header .sub is tappable');
ok(/window\.__scDurBubble\.toggle\(_subEl, totalSeconds,/.test(src), 'pane header passes its real totalSeconds');
ok(/hdr\.querySelector\('\[data-dur-bubble\]'\)/.test(src), 'album card subtitle is tappable');
ok(/ev\.stopPropagation\(\); \/\/ tapping the time must not expand\/collapse the album/.test(src), 'album tap does not toggle the card');
ok(/position:fixed; display:none; min-width:150px/.test(src), 'bubble CSS is viewport-fixed (floats above the line)');
ok(/const APP_VERSION = '\d+\.\d+\.\d+'/.test(src), 'APP_VERSION is set');

console.log(`\nFAILURES: ${fail} — ${pass} passed`);
process.exit(fail ? 1 : 0);
