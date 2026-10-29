#!/usr/bin/env node
// 80.6.5 - the warm preset, checked on the page that ships.
//
//   node dev/check-8065.cjs
//
// The preset is DATA, not behaviour, so the check is against the real object:
// the WIDGET_THEMES literal is sliced out of index.html (never copied), evaluated,
// and read the way the native provider reads it - every key it needs, on every
// preset, with colours it can parse. Then the new one gets measured: contrast on
// BOTH ends of its gradient (the title is painted across the whole panel, so the
// light end is the worst case), its place in the list, and the fact that it is not
// a second glass preset competing for the Frost dial.
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

ok('the page runs 80.6.5', page.includes("const APP_VERSION = '80.6.5';"));
ok('the release marker is in the script', page.includes('80.6.5 - THE WARM DUSK WIDGET'));
ok('the changelog records 80.6.5', page.includes("{ version: '80.6.5', date: '"));

// ---- every inline script block still parses --------------------------------
const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let parsed = 0;
scripts.forEach((src, i) => {
  if (!src.trim() || /^\s*import /.test(src)) return;
  try { new Function(src); parsed++; }
  catch (e) { fail++; console.log('  FAIL script block ' + (i + 1) + ' does not parse — ' + e.message); }
});
ok('every inline script block parses', parsed > 0 && fail === 0, parsed + ' block(s)');

// ---- the real preset table ------------------------------------------------
const start = page.indexOf('  const WIDGET_THEMES = {');
const end = start > -1 ? page.indexOf('\n  };', start) : -1;
ok('the preset table is in the page once', start > -1 && end > start);
if (!(start > -1 && end > start)) { console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); process.exit(1); }

const themes = vm.runInNewContext('(' + page.slice(start + '  const WIDGET_THEMES = '.length, end + 4) + ')');
const keys = Object.keys(themes);
const BEFORE = ['frost', 'candy', 'mint', 'sunny', 'sky', 'tangerine', 'grape', 'coral', 'ocean',
  'dark', 'black', 'warm', 'forest', 'rose', 'aurora', 'sand', 'slate', 'sakura', 'lime'];

ok('the table still parses as one object', themes && typeof themes === 'object');
ok('there are twenty presets', keys.length === 20, keys.length + ': ' + keys.join(','));
ok('all nineteen earlier presets are still there, unchanged in name',
   BEFORE.every(k => keys.includes(k)), BEFORE.filter(k => !keys.includes(k)).join(','));
ok('the new one is Amber dusk', !!themes.amberdusk && themes.amberdusk.label === 'Amber dusk',
   themes.amberdusk && themes.amberdusk.label);

// The nine keys the native provider reads off the theme payload.
const NEEDED = ['label', 'bg1', 'bg2', 'title', 'artist', 'accent', 'accentText', 'pill', 'pillText'];
const missing = keys.filter(k => NEEDED.some(f => themes[k][f] == null));
ok('every preset carries all nine keys the widget reads', missing.length === 0, missing.join(','));
const badColour = keys.filter(k => ['bg1', 'bg2', 'title', 'artist', 'accent', 'accentText', 'pill', 'pillText']
  .some(f => !/^#[0-9a-fA-F]{6}$/.test(String(themes[k][f]))));
ok('and every colour is a plain #RRGGBB', badColour.length === 0, badColour.join(','));

// ---- the new one, measured ------------------------------------------------
const a = themes.amberdusk;
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (x, y) => {
  const [hi, lo] = lum(x) > lum(y) ? [lum(x), lum(y)] : [lum(y), lum(x)];
  return (hi + 0.05) / (lo + 0.05);
};

const titleOnTop = ratio(a.title, a.bg1);
const titleOnBottom = ratio(a.title, a.bg2);
const artistOnTop = ratio(a.artist, a.bg1);
ok('the title clears 4.5:1 on the LIGHT end of the gradient', titleOnTop >= 4.5, titleOnTop.toFixed(2) + ':1');
ok('and on the dark end', titleOnBottom >= 4.5, titleOnBottom.toFixed(2) + ':1');
ok('the artist line clears 3:1 on the light end', artistOnTop >= 3, artistOnTop.toFixed(2) + ':1');

ok('it is a warm gradient, light at the top and near-black at the bottom',
   lum(a.bg1) > 0.03 && lum(a.bg2) < 0.02, 'L ' + lum(a.bg1).toFixed(4) + ' -> ' + lum(a.bg2).toFixed(4));
ok('its top stop is gold, not grey (red leads, blue trails)',
   parseInt(a.bg1.slice(1, 3), 16) > parseInt(a.bg1.slice(5, 7), 16) + 40, a.bg1);
ok('the accent is a sun gold', parseInt(a.accent.slice(1, 3), 16) >= 0xF0
  && parseInt(a.accent.slice(3, 5), 16) >= 0xA0 && parseInt(a.accent.slice(5, 7), 16) <= 0x80, a.accent);

// ---- its place in the grid, and the one glass preset ----------------------
const iGrape = keys.indexOf('grape'), iAmber = keys.indexOf('amberdusk'), iCoral = keys.indexOf('coral');
ok('it closes the bright block, above the dark one', iAmber === iGrape + 1 && iAmber < iCoral,
   'grape ' + iGrape + ', amberdusk ' + iAmber + ', coral ' + iCoral);
const glassy = keys.filter(k => themes[k].glass === true);
ok('Frost is still the ONLY glass preset', glassy.length === 1 && glassy[0] === 'frost', glassy.join(','));
ok('the new preset is opaque, so the Frost dial stays hidden for it', a.glass === undefined);

// ---- the copy that counts the shelf ---------------------------------------
ok('the blurb counts twenty presets',
   page.includes('twenty presets from bright to frosted glass'));
ok('and no stale nineteen is left in the blurb',
   !page.includes('nineteen presets from bright to frosted glass'));

ok('the shell cache is v80.6.5',
   fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'sidecut-shell-v80.6.5'"));

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
