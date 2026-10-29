#!/usr/bin/env node
// 80.6.6 - the amber theme and the liquid name, checked on the page that ships.
//
//   node dev/check-8066.cjs
//
// Both tables are sliced out of index.html (never copied) and evaluated, then read
// the way the app reads them: THEMES for the wall (group membership, the fresh
// ordering, the contrast the accent has to survive) and the app's own
// renderThemeOptions() rules for which group a theme lands in. The widget table is
// read for the rename - and for the thing a rename can break: the KEY, which is
// what a phone's saved pick and every pushed payload actually carry.
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

ok('the page runs 80.6.6', page.includes("const APP_VERSION = '80.6.6';"));
ok('the release marker is in the script', page.includes('80.6.6 - AMBER DUSK IS A THEME, AND THE GLASS IS NAMED LIQUID'));
ok('the changelog records 80.6.6', page.includes("{ version: '80.6.6', date: '"));

// ---- every inline script block still parses --------------------------------
const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let parsed = 0;
scripts.forEach((src, i) => {
  if (!src.trim() || /^\s*import /.test(src)) return;
  try { new Function(src); parsed++; }
  catch (e) { fail++; console.log('  FAIL script block ' + (i + 1) + ' does not parse — ' + e.message); }
});
ok('every inline script block parses', parsed > 0 && fail === 0, parsed + ' block(s)');

// ---- helpers ---------------------------------------------------------------
const slice = (open, close) => {
  const start = page.indexOf(open);
  const end = start > -1 ? page.indexOf(close, start) : -1;
  // start + open.length - 1 is the object's own '{'; end + close.length - 1 is its '}'.
  return start > -1 && end > start ? page.slice(start + open.length - 1, end + close.length - 1) : null;
};
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (hex) => {
  const h = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (x, y) => {
  const [hi, lo] = lum(x) > lum(y) ? [lum(x), lum(y)] : [lum(y), lum(x)];
  return (hi + 0.05) / (lo + 0.05);
};

// ---- the theme wall --------------------------------------------------------
const themeSrc = slice('  const THEMES = {', '\n  };');
ok('the theme table is in the page', !!themeSrc);
let THEMES = null;
try { THEMES = vm.runInNewContext('(' + themeSrc + ')'); } catch (e) { console.log('  FAIL theme table: ' + e.message); }
ok('the theme table evaluates', !!THEMES);

if (THEMES) {
  const keys = Object.keys(THEMES);
  const a = THEMES.amberdusk;
  ok('Amber dusk is on the wall', !!a && a.name === 'Amber dusk', a && a.name);
  ok('with the four colours a theme needs, as plain hex',
     !!a && ['bg', 'bgRaised', 'coral', 'gold'].every(k => /^#[0-9a-fA-F]{6}$/.test(String(a[k]))));
  ok('it is a plain STATIC theme (no rgb, no dynamic, no reward)',
     !!a && !a.rgb && !a.dynamic && !a.reward);
  ok('the wall is dark enough for the app\'s light ink', lum(a.bg) < 0.05, 'L ' + lum(a.bg).toFixed(4));
  ok('white ink on it clears 7:1', ratio('#FFFFFF', a.bg) >= 7, ratio('#FFFFFF', a.bg).toFixed(1) + ':1');
  ok('the gold accent on the wall clears 3:1', ratio(a.coral, a.bg) >= 3, ratio(a.coral, a.bg).toFixed(1) + ':1');
  ok('dark type on that gold clears 4.5:1 (what scOnAccent picks)', ratio('#0A0A0A', a.coral) >= 4.5,
     ratio('#0A0A0A', a.coral).toFixed(1) + ':1');
  ok('the raised panel is lighter than the wall', lum(a.bgRaised) > lum(a.bg));
  ok('it is the only fresh STATIC theme this release',
     keys.filter(k => THEMES[k].fresh && !THEMES[k].rgb && !THEMES[k].dynamic && !THEMES[k].reward)
       .join(',') === 'amberdusk');
  // renderThemeOptions' own rule: reward -> reward group, rgb/dynamic -> dynamic.
  const groupOf = (k) => THEMES[k].reward ? 'reward' : ((THEMES[k].rgb || THEMES[k].dynamic) ? 'dynamic' : 'static');
  ok('so it prints in Static themes, with every reward still last',
     groupOf('amberdusk') === 'static'
     && keys.filter(k => groupOf(k) === 'reward').every(k => THEMES[k].reward));
  ok('the badges still gate the same four themes',
     keys.filter(k => THEMES[k].reward).length === 4,
     keys.filter(k => THEMES[k].reward).join(','));
  ok('Liquid Glass the theme is untouched', !!THEMES.liquidglass && THEMES.liquidglass.liquidGlass === true);
}

// ---- the widget shelf: the rename, and the key that must not move ----------
const wSrc = slice('  const WIDGET_THEMES = {', '\n  };');
ok('the widget table is in the page', !!wSrc);
let W = null;
try { W = vm.runInNewContext('(' + wSrc + ')'); } catch (e) { console.log('  FAIL widget table: ' + e.message); }
ok('the widget table evaluates', !!W);

if (W) {
  const keys = Object.keys(W);
  ok('there are still twenty presets', keys.length === 20, String(keys.length));
  ok('the glass preset keeps its KEY, so a saved pick still resolves', !!W.frost);
  ok('and it is called Liquid glass now', W.frost && W.frost.label === 'Liquid glass', W.frost && W.frost.label);
  ok('it still leads the shelf', keys[0] === 'frost', keys[0]);
  ok('no preset says Frosted glass any more', !keys.some(k => W[k].label === 'Frosted glass'));
  ok('Amber dusk is still there and still opaque',
     !!W.amberdusk && W.amberdusk.label === 'Amber dusk' && W.amberdusk.glass === undefined);
  ok('Frost is still the only glass preset', keys.filter(k => W[k].glass === true).join(',') === 'frost');
}

ok('the blurbs name the liquid glass', page.includes('twenty presets from bright to liquid glass'));

// ---- the liquid cue, which is sheen and not milk ---------------------------
ok('the band is brighter than 80.6.5 (0.34 -> 0.52)', page.includes('rgba(255,255,255,0.52) 38%'));
ok('the top rim is stronger (0.55 -> 0.72)', page.includes('const rim = (0.72 + (t.frost || 0) * 0.0032)'));
ok('the edge is stronger (0.20 -> 0.26)', page.includes('const edge = (0.26 + (t.frost || 0) * 0.0034)'));
ok('the backdrop is pushed less (1.9 -> 1.45)', page.includes('saturate(1.45) contrast(1.05)')
  && !page.includes('saturate(1.9)'));
ok('the PANE TRANSPARENCY is untouched: 0.32 -> 0.62', page.includes('var alpha = (0.32 + 0.30 * k) * 255;'));
ok('the band still drifts and still stops for Reduce motion',
   page.includes('animation: scGlassLiquid 9s ease-in-out infinite')
   && page.includes('body.sandbox-reduce-motion .sc-glass-liquid{ animation: none;')
   && page.includes('@media (prefers-reduced-motion: reduce){\n    .sc-glass-liquid{ animation: none;'));
ok('the preview still paints the liquid layer', page.includes('<div class="sc-glass-liquid"></div>'));
ok('the Frost dial is still wired to the glass preset',
   page.includes('id="widgetFrostSlider" min="0" max="100"') && page.includes("frostSlider.addEventListener('change'"));

ok('the shell cache is v80.6.6',
   fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'sidecut-shell-v80.6.6'"));

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
