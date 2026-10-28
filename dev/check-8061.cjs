#!/usr/bin/env node
// 80.6.1 - the icy retune, checked on the page that ships.
//
//   node dev/check-8061.cjs
//
// The same shape as check-806.cjs: parse every inline script, then drive the
// page's OWN scFrostIce()/scFrostGlass() (extracted from index.html) and assert
// the pane is cooler and milkier than 80.6's was at every dial position.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pass = 0, fail = 0;

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

ok('the page runs 80.6.1', page.includes("const APP_VERSION = '80.6.1';"));
ok('the release marker is in the script', page.includes('80.6.1 - THE GLASS IS ICE'));
ok('the changelog records 80.6.1', page.includes("{ version: '80.6.1', date: '"));

const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let parsed = 0;
scripts.forEach((src, i) => {
  if (!src.trim() || /^\s*import /.test(src)) return;
  try { new Function(src); parsed++; }
  catch (e) { fail++; console.log('  FAIL script block ' + (i + 1) + ' does not parse — ' + e.message); }
});
ok('every inline script block parses', parsed > 0 && fail === 0, parsed + ' block(s)');

const start = page.indexOf('function scFrostHexToRgb(');
const end = page.indexOf('function getWidgetTheme(){');
ok('the glass math is in the page once', start > -1 && end > start);
if (start > -1 && end > start) {
  const math = page.slice(start, end);
  const ctx = { localStorage: { getItem: () => null, setItem: () => {} } };
  vm.createContext(ctx);
  const base = { label: 'Frosted glass', glass: true, bg1: '#E4F1FF', bg2: '#A9C6E6', title: '#0A1A2E', artist: '#39557A', accent: '#46C8F5' };
  const run = (frost) => {
    vm.runInContext('var widgetFrost = ' + frost + ';\n' + math, ctx);
    return ctx.scFrostGlass(Object.assign({}, base));
  };
  const cold = run(0), mid = run(55), hot = run(100);
  const alphaOf = (argb) => parseInt(argb.slice(1, 3), 16);
  // #AARRGGBB: the channels start at 3, not 1 - index 1 is the alpha.
  const rgb = (argb) => [3, 5, 7].map(i => parseInt(argb.slice(i, i + 2), 16));

  ok('a glass theme comes back as #AARRGGBB', /^#[0-9A-F]{8}$/.test(mid.bg1), mid.bg1);
  ok('thinner at 0 than at 100', alphaOf(cold.bg1) < alphaOf(hot.bg1),
     alphaOf(cold.bg1) + ' -> ' + alphaOf(hot.bg1));
  ok('even the thinnest pane keeps its milk (80.6 was 0.44, now 0.52)', alphaOf(cold.bg1) >= 0x80,
     '0x' + alphaOf(cold.bg1).toString(16));
  ok('and the thick end is still see-through', alphaOf(hot.bg1) < 0xF2,
     '0x' + alphaOf(hot.bg1).toString(16));
  ok('more frost, more white', rgb(hot.bg2)[1] > rgb(cold.bg2)[1],
     rgb(cold.bg2).join(',') + ' -> ' + rgb(hot.bg2).join(','));
  const blueness = (t) => rgb(t.bg2)[2] - rgb(t.bg2)[0];
  ok('the pane is cool at the thin end', blueness(cold) >= 40, 'b-r ' + blueness(cold));
  ok('and icier at the thick end', blueness(hot) > blueness(cold), blueness(cold) + ' -> ' + blueness(hot));
  const hotRgb = rgb(run(100).bg2);
  ok('the ice lift leaves the thick stop almost pure blue-white', hotRgb[2] > 235, hotRgb.join(','));
  ok('the type stays dark navy at every level', [cold, mid, hot].every(t => rgb(t.title)[0] < 0x30));
  ok('the first stop is lighter than the second', rgb(hot.bg1)[1] > rgb(hot.bg2)[1]);
  ok('CSS gets rgba(), not ARGB', /^rgba\(\d+,\d+,\d+,[\d.]+\)$/.test(mid.css1), mid.css1);
  ok('the frost number rides with the theme', mid.frost === 55);
}

ok('the preset is the icy one', page.includes("bg1: '#E4F1FF', bg2: '#A9C6E6'"));
ok('the bars carry a cyan accent', page.includes("accent: '#46C8F5'"));
ok('the preset still leads the list', page.indexOf("label: 'Frosted glass'") < page.indexOf("label: 'Bubblegum'"));
ok('the preview has a rim', page.includes('const rim = (0.50 +'));
ok('the preview has a specular sheen', page.includes('rgba(255,255,255,0.58) 0%'));
ok('the preview blurs and saturates', page.includes('saturate(1.35) brightness(1.06)'));
ok('the preview sits on a shadow', page.includes('box-shadow:0 10px 26px rgba(0,0,0,0.38)'));
ok('the dial is still 0-100 and still wired', page.includes('id="widgetFrostSlider" min="0" max="100"')
   && page.includes("frostSlider.addEventListener('change')"));
ok('the shell cache is v80.6.1', fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'sidecut-shell-v80.6.1'"));

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
