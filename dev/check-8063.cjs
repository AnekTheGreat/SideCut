#!/usr/bin/env node
// 80.6.3 - the liquid retune, checked on the page that ships.
//
//   node dev/check-8063.cjs
//
// Same shape as check-8061.cjs: parse every inline script, then drive the page's
// OWN scFrostIce()/scFrostGlass() (extracted from index.html, never a copy) and
// assert the pane is thinner and less milky than 80.6.2's was, and that the
// liquid band exists and is switched off by both Reduce-motion paths.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pass = 0, fail = 0;

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); }
}

ok('the page runs 80.6.3', page.includes("const APP_VERSION = '80.6.3';"));
ok('the release marker is in the script', page.includes('80.6.3 - THE GLASS IS LIQUID'));
ok('the changelog records 80.6.3', page.includes("{ version: '80.6.3', date: '"));

const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let parsed = 0;
scripts.forEach((src, i) => {
  if (!src.trim() || /^\s*import /.test(src)) return;
  try { new Function(src); parsed++; }
  catch (e) { fail++; console.log('  FAIL script block ' + (i + 1) + ' does not parse - ' + e.message); }
});
ok('every inline script block parses', parsed > 0 && fail === 0, parsed + ' block(s)');

// ---- the page's own glass math, extracted and driven ------------------------
const start = page.indexOf('function scFrostHexToRgb(');
const end = page.indexOf('function getWidgetTheme(){');
ok('the glass math is in the page once', start > -1 && end > start);
if (start > -1 && end > start) {
  const math = page.slice(start, end);
  const ctx = { localStorage: { getItem: () => null, setItem: () => {} } };
  vm.createContext(ctx);
  const base = { label: 'Frosted glass', glass: true, bg1: '#E4F1FF', bg2: '#96BCE2', title: '#07182C', artist: '#2F4A6E', accent: '#46C8F5' };
  const run = (frost) => {
    vm.runInContext('var widgetFrost = ' + frost + ';\n' + math, ctx);
    return ctx.scFrostGlass(Object.assign({}, base));
  };
  const cold = run(0), mid = run(55), hot = run(100);
  const alphaOf = (argb) => parseInt(argb.slice(1, 3), 16);
  const rgb = (argb) => [3, 5, 7].map(i => parseInt(argb.slice(i, i + 2), 16));

  ok('a glass theme comes back as #AARRGGBB', /^#[0-9A-F]{8}$/.test(mid.bg1), mid.bg1);
  ok('thinner at 0 than at 100', alphaOf(cold.bg1) < alphaOf(hot.bg1),
     alphaOf(cold.bg1) + ' -> ' + alphaOf(hot.bg1));
  // 80.6.2 was 0.52 -> 0.88 (0x85 -> 0xE0). Both ends must now be below that.
  ok('the thin end is thinner than 80.6.2 (was 0x85)', alphaOf(cold.bg1) <= 0x56,
     '0x' + alphaOf(cold.bg1).toString(16));
  ok('the thick end is thinner than 80.6.2 (was 0xE0)', alphaOf(hot.bg1) <= 0xA4,
     '0x' + alphaOf(hot.bg1).toString(16));
  ok('and it is still glass at the thick end, not a wall', alphaOf(hot.bg1) >= 0x90,
     '0x' + alphaOf(hot.bg1).toString(16));
  ok('both stops share the pane opacity',
     alphaOf(cold.bg1) === alphaOf(cold.bg2) && alphaOf(hot.bg1) === alphaOf(hot.bg2));
  // 80.6.2 mixed the lit stop 0.30 toward white at the thin end; 0.16 now.
  ok('less milk at the thin end than 80.6.2', rgb(cold.bg1)[0] <= 234, rgb(cold.bg1).join(','));
  ok('less milk at the thick end than 80.6.2', rgb(hot.bg1)[0] <= 241, rgb(hot.bg1).join(','));
  const blueness = (t) => rgb(t.bg2)[2] - rgb(t.bg2)[0];
  ok('the pane is cool at the thin end', blueness(cold) >= 45, 'b-r ' + blueness(cold));
  ok('and icier at the thick end', blueness(hot) > blueness(cold), blueness(cold) + ' -> ' + blueness(hot));
  ok('the lit stop is lighter than the other', rgb(hot.bg1)[0] > rgb(hot.bg2)[0]);
  ok('the type stays dark navy at every level', [cold, mid, hot].every(t => rgb(t.title)[0] < 0x30));
  ok('CSS gets rgba(), not ARGB', /^rgba\(\d+,\d+,\d+,[\d.]+\)$/.test(mid.css1), mid.css1);
  ok('the frost number rides with the theme', mid.frost === 55);
}

// ---- the preview, and the liquid band --------------------------------------
ok('the preset keeps its key and its label', page.includes("frost:  { label: 'Frosted glass', glass: true,"));
ok('the preset still leads the list',
   page.indexOf("label: 'Frosted glass'") < page.indexOf("label: 'Bubblegum'"));
ok('the preview has a two-edge rim',
   page.includes('inset 0 1px 0 rgba(255,255,255,') && page.includes('inset 0 -1px 0 rgba(255,255,255,'));
ok('the preview pushes the backdrop harder', page.includes('saturate(1.9) contrast(1.04)'));
ok('the static painted sheen is gone', !page.includes('rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.12) 30%'));
ok('the preview paints the liquid layer', page.includes('<div class="sc-glass-liquid"></div>'));
ok('the liquid layer has a rule', /\.sc-glass-liquid\{[\s\S]{0,900}?animation: scGlassLiquid 9s ease-in-out infinite/.test(page));
ok('and its keyframes travel both ways',
   page.includes('@keyframes scGlassLiquid{') && page.includes('55%{ background-position: -28% 50%; }'));
ok('the app Reduce-motion switch stops it',
   page.includes('body.sandbox-reduce-motion .sc-glass-liquid{ animation: none;'));
ok('and so does the device preference',
   page.includes('@media (prefers-reduced-motion: reduce){\n    .sc-glass-liquid{ animation: none; background-position: 60% 50%; }'));

// ---- the dial, which is unchanged except for honest words ------------------
ok('the dial is still 0-100 and still wired',
   page.includes('id="widgetFrostSlider" min="0" max="100"')
   && page.includes("frostSlider.addEventListener('change'"));
// Scoped to the dial's own row: 80.6's changelog entry still quotes the old caption
// word for word, and the note is allowed to remember it - the ROW must not promise it.
ok('the caption no longer promises a nearly solid pane', (() => {
  const row = page.indexOf('id="widgetFrostRow"');
  const pane = page.slice(row, row + 2200);
  return row > -1
    && !pane.includes('right is a soft, nearly solid pane')
    && pane.includes('right is a soft pane you can still see through');
})());
ok('the widget blurb still counts nineteen presets',
   page.includes('nineteen presets from bright to frosted glass'));
ok('the app chrome glass mode is untouched',
   page.includes('body.liquid-glass-on .modal{') && page.includes('blur(8px) saturate(140%)'));
ok('the shell cache is v80.6.3',
   fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'sidecut-shell-v80.6.3'"));

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
