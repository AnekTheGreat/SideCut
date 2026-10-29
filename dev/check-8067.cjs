/* 80.6.7 - what the owner asked for, measured on the page that ships.
 *
 * The two tables are SLICED out of the page and evaluated, because the rows are
 * the thing being changed and a grep would pass on a comment. Everything else is
 * read the way the app reads it: the group order renderThemeOptions() computes,
 * the payload the widget push builds, and the page's own inline scripts.
 *
 *   node dev/check-8067.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PAGE = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(PAGE, 'utf8');

let pass = 0, fail = 0;
function ok(what, cond, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log('FAIL  ' + what + (detail === undefined ? '' : '  [' + String(detail).slice(0, 300) + ']'));
}

/* ---------- slice a balanced object literal, starting at its opening brace ---------- */
function objectAt(needle) {
  const at = src.indexOf(needle);
  if (at < 0) return { __error: 'not found: ' + needle };
  const open = src.indexOf('{', at);
  let depth = 0, quote = null, esc = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return vm.runInNewContext('(' + src.slice(open, i + 1) + ')'); }
  }
  return { __error: 'unbalanced: ' + needle };
}

/* ---------- 1. Amber dusk is gone, from both tables ---------- */
const THEMES = objectAt('const THEMES = {');
const PRESETS = objectAt('const WIDGET_THEMES = {');
ok('THEMES was read out of the page', !!THEMES && !THEMES.__error, THEMES && THEMES.__error);
ok('WIDGET_THEMES was read out of the page', !!PRESETS && !PRESETS.__error, PRESETS && PRESETS.__error);
ok('no amber theme is left on the wall', !(THEMES && THEMES.amberdusk));
ok('no amber preset is left on the shelf', !(PRESETS && PRESETS.amberdusk));
ok('the word amberdusk is gone from the page entirely', src.toLowerCase().indexOf('amberdusk') < 0);
// The name may only survive in the changelog's own history: 80.6.5 and 80.6.6
// recorded it, and 80.6.7 records that it left. A LABEL, a theme entry or a
// preset must not carry it.
const beforeChangelog = src.slice(0, src.indexOf('const CHANGELOG = ['));
ok('no label, preset or theme entry still says Amber dusk',
   beforeChangelog.indexOf('Amber dusk') < 0);

/* ---------- 2. Lagoon closes the dynamic group ---------- */
const dyn = Object.keys(THEMES).filter(k => !THEMES[k].reward && (THEMES[k].rgb || THEMES[k].dynamic));
ok('Lagoon is a dynamic theme', !!THEMES.prism && THEMES.prism.name === 'Lagoon (dynamic)');
ok('Lagoon is the LAST dynamic theme', dyn[dyn.length - 1] === 'prism', dyn.join(','));
ok('Lagoon no longer wears the fresh flag', THEMES.prism.fresh === undefined);
ok('and nothing else is fresh either',
   Object.keys(THEMES).every(k => k === 'custom' || !THEMES[k].fresh));
ok('Lagoon keeps its palette and its dynamic class',
   THEMES.prism.bg === '#07181A' && THEMES.prism.coral === '#37E6C4' && THEMES.prism.dynamic === 'prism');
ok('four themes are still badge rewards',
   Object.keys(THEMES).filter(k => THEMES[k].reward).length === 4);

/* ---------- 3. The pastel liquid ---------- */
const KEYS = ['label', 'bg1', 'bg2', 'title', 'artist', 'accent', 'accentText', 'pill', 'pillText'];
const pastel = PRESETS && PRESETS.pastel;
ok('the pastel preset exists', !!pastel);
ok('it is called Liquid pastel', pastel && pastel.label === 'Liquid pastel', pastel && pastel.label);
ok('it is a GLASS preset (the same pane as Liquid glass)', pastel && pastel.glass === true);
ok('it carries the nine keys the native provider reads',
   pastel && KEYS.every(k => typeof pastel[k] === 'string'), pastel && Object.keys(pastel).join(','));
ok('its stops are the preview strip rose->lilac',
   pastel && /^#[0-9A-F]{6}$/i.test(pastel.bg1) && /^#[0-9A-F]{6}$/i.test(pastel.bg2),
   pastel && (pastel.bg1 + ' ' + pastel.bg2));
ok('the shelf is still 20 presets', Object.keys(PRESETS).length === 20, Object.keys(PRESETS).length);
const grid = Object.keys(PRESETS);
ok('the two glass presets lead the grid',
   grid[0] === 'frost' && grid[1] === 'pastel', grid.slice(0, 4).join(','));
ok('Liquid glass is still first and still glass', PRESETS.frost.label === 'Liquid glass' && PRESETS.frost.glass === true);
ok('exactly two presets claim the Frost dial',
   grid.filter(k => PRESETS[k].glass === true).length === 2,
   grid.filter(k => PRESETS[k].glass === true).join(','));

/* contrast of the dark plum type on both stops of the new gradient */
function lum(hex) {
  const c = hex.replace('#', '');
  const ch = [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
if (pastel) {
  const t1 = ratio(pastel.title, pastel.bg1), t2 = ratio(pastel.title, pastel.bg2);
  ok('the title is readable on the rose stop', t1 >= 4.5, t1.toFixed(2));
  ok('the title is readable on the lilac stop', t2 >= 4.5, t2.toFixed(2));
  const a1 = ratio(pastel.artist, pastel.bg2);
  ok('the artist line clears the large-text floor', a1 >= 3, a1.toFixed(2));
}

/* ---------- 4. The timeline rides in the payload ---------- */
const pushAt = src.indexOf('function pushWidgetState(');
const pushEnd = src.indexOf('function ', src.indexOf('window.__scWidgetHeartbeat'));
const pushSrc = src.slice(pushAt, pushAt + 8000);
ok('pushWidgetState was found', pushAt > 0);
ok('the payload carries pos', pushSrc.indexOf('pos: wdAt.pos') > 0);
ok('the payload carries dur', pushSrc.indexOf('dur: wdAt.dur') > 0);
ok('and the reading comes from the audio element, not a cache',
   pushSrc.indexOf('activeAudio()') > 0 && pushSrc.indexOf('currentTime') > 0);
ok('the old payload shape is not still there',
   pushSrc.indexOf('pulse: (window.__scWidgetPulse || 0) }') < 0);

/* ---------- 5. A dead theme key selects the fallback ---------- */
const applyAt = src.indexOf('function applyTheme(key){');
ok('applyTheme was found', applyAt > 0);
ok('it re-points an unknown key at Coral',
   src.slice(applyAt, applyAt + 600).indexOf("if(!THEMES[key] && key !== 'custom'){ key = 'coral'; }") > 0);

/* ---------- 6. The blurb counts both glass presets ---------- */
ok('the widget blurb still says twenty', src.indexOf('twenty presets from bright to liquid glass') > 0);
ok('and it says the dial is on the two glass ones', src.indexOf('a Frost dial on the two glass ones') > 0);

/* ---------- 6b. The native half is wired where a release can reach it ---------- */
const sizesPy = fs.readFileSync(path.join(__dirname, 'widget-sizes.py'), 'utf8');
const buildYml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'android-build.yml'), 'utf8');
ok('dev/widget-sizes.py carries the three placements',
   ['COMPACT_XML', 'WIDE_XML', 'TALL_XML'].every(n => sizesPy.indexOf(n + ' = ') > 0));
ok('and the size picker with the resize override',
   sizesPy.indexOf('sizeClass(AppWidgetManager mgr, int id)') > 0
   && sizesPy.indexOf('onAppWidgetOptionsChanged') > 0);
ok('and the themed progress strip', sizesPy.indexOf('makeBarBitmap') > 0);
ok('every placement carries the timeline ids',
   ['@+id/wBar', '@+id/wPos', '@+id/wDur'].every(id => sizesPy.indexOf(id) > 0));
ok('the sizes run right after the generator in android-build.yml',
   buildYml.indexOf('.github/workflows/patch-widget.py') > 0
   && buildYml.indexOf('dev/widget-sizes.py') > buildYml.indexOf('.github/workflows/patch-widget.py'));

/* ---------- 7. The version, the cache, the changelog ---------- */
ok('the page runs 80.6.7', src.indexOf("const APP_VERSION = '80.6.7';") > 0);
ok('the release comment is in the script', src.indexOf('80.6.7 - AMBER DUSK IS GONE') > 0);
ok('the changelog records it', src.indexOf("{ version: '80.6.7',") > 0);
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
ok('the shell cache moved', sw.indexOf("'sidecut-shell-v80.6.7'") > 0);
ok('the changelog names no other copy of the app',
   src.slice(src.indexOf('const CHANGELOG = ['), src.indexOf('const APP_VERSION'))
     .indexOf('/full/') < 0);

/* ---------- 8. Every inline script still compiles ---------- */
const blocks = src.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
let compiled = 0, firstErr = '';
blocks.forEach(b => {
  if (/\bsrc=/.test(b.slice(0, b.indexOf('>')))) return;
  const body = b.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
  if (!body.trim()) return;
  try { new vm.Script(body); compiled++; }
  catch (e) { if (!firstErr) firstErr = e.message; }
});
ok('every inline script block compiles', firstErr === '', firstErr);
ok('and there were blocks to compile', compiled > 5, compiled);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
