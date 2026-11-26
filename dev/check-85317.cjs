// 85.3.17 harness - the rail's shipped stylesheet, and the release it belongs to.
//
// The owner's follow-up: "what I meant by clean up the side tab bar was make it look nicer
// and cleaner". 85.3.16 tidied the rail's STRUCTURE (one hairline for the tools, the three
// dots on it) and left its paint as it was, so four details were still working against it:
//
//   * the page you were on was a WHITE disc - the rule asked for `--accent`, a variable this
//     app has never defined, so it fell back to plain ink on every theme;
//   * the gap inside a group was the same 5px as the gap between two groups, so six glyphs
//     read as six separate things;
//   * the edge was a flat --line border under a 26px drop shadow, which smudged the songs
//     the rail is laid over;
//   * the switch said it was on with a dot drawn on top of the icon it was describing.
//
// This gate reads the style block `scShelfCss()` builds, straight out of index.html, and
// asserts the strings this release is about one at a time. Nothing here is a copy of the
// CSS and nothing is rendered: what a phone draws is still unproven (see AGENTS.md).
//
//   node dev/check-85317.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function grab(name) {
  const key = 'function ' + name + '(';
  const start = page.indexOf(key);
  if (start < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}

// The stylesheet scShelfCss() writes: from its own opening to the end of the array it joins.
const cssStart = page.indexOf('function scShelfCss(');
const css = page.slice(cssStart, page.indexOf('var SC_RAIL_PAGES', cssStart));
const render = grab('scShelfRender');
const mark = grab('scShelfMark');

console.log('1. The rail is one set');
{
  ok('the rail still takes no height when it is off', css.includes("'#scShelfRail{display:none;height:0}'"));
  ok('the rail is a column with one rhythm', css.includes("'#scShelfRail.scShelfRailOn{display:flex;flex-direction:column;gap:3px;height:auto;'"));
  ok('and there is no second gap value for the rail', (css.match(/gap:5px/g) || []).length === 0);
  ok('the glyphs sit on 6px of rail', css.includes('top:50%;margin:0;padding:6px;z-index:70;'));
  ok('the rail keeps clear of a curved screen edge',
    css.includes('right:calc(9px + env(safe-area-inset-right, 0px));'));
  ok('the pill is still a pill and still passes the touch through',
    css.includes('transform:translateY(-50%);border-radius:999px;pointer-events:none;'));
  ok('only the glyphs catch a tap',
    css.includes("'#scShelfRail .scshelf-tab{pointer-events:auto;width:34px;height:34px;flex:0 0 auto;'"));
  ok('every glyph is one size and one radius',
    (css.match(/width:34px;height:34px/g) || []).length === 1 &&
    (css.match(/border-radius:999px;background:none;/g) || []).length === 1);
}

console.log('\n2. The edge is a hairline, not a slab');
{
  ok('the border is mixed ink, not a flat line',
    /'border:1px solid color-mix\(in srgb, var\(--ink\) 1[0-2]%, transparent\);'/.test(css),
    (css.match(/border:1px[^\n]*/) || [])[0]);
  ok('the old 26px drop shadow is gone', !css.includes('0 10px 26px'));
  ok('the shadow is smaller and seats the pill', css.includes('box-shadow:0 8px 22px rgba(0,0,0,.26),'));
  ok('with one light line along the top edge',
    css.includes('inset 0 1px 0 color-mix(in srgb, var(--ink) 7%, transparent)}'));
  ok('the see-through weight Tools writes is still the background',
    css.includes('background:color-mix(in srgb, var(--bg-raised) var(--scshelf-solid, 15%), transparent);'));
}

console.log('\n3. The page you are on wears the theme');
{
  ok('the mark is the theme accent, not plain ink',
    css.includes("'#scShelfRail .scshelf-tab.on{background:var(--coral);color:var(--on-coral);'"));
  // The release comment names the variable it retired, so this asks that no RULE reads it.
  ok('the undefined --accent variable is not asked for again', !/var\(--accent/.test(css));
  ok('the text on the disc is not the page background any more', !css.includes('.on{background:var(--coral);color:var(--bg)'));
  ok('the glow is built from the accent and is smaller',
    css.includes("'box-shadow:0 3px 12px color-mix(in srgb, var(--coral) 32%, transparent)}'"));
  ok('the mark still answers a press', css.includes("'#scShelfRail .scshelf-tab.on:active{transform:scale(.94)}'"));
}

console.log('\n4. A press is felt, and the groups are drawn');
{
  ok('a press still scales the glyph', css.includes("'#scShelfRail .scshelf-tab:active{transform:scale(.9)}'"));
  ok('a glyph that is not the page washes with ink when pressed',
    css.includes('not(.on):not(.s-on):active{background:color-mix(in srgb, var(--ink) 9%, transparent)}'));
  ok('the hover tint only exists where a pointer can hover',
    css.includes('@media (hover:hover){#scShelfRail .scshelf-tab:not(.on):not(.s-on):hover{'));
  ok('and it never lands on the marked page or an engaged switch',
    !/@media \(hover:hover\)\{#scShelfRail \.scshelf-tab:hover/.test(css));
  ok('the divider is short, inset and rounded',
    css.includes("'#scShelfRail .scshelf-sep{height:1px;flex:0 0 auto;margin:4px 5px;border-radius:1px;'"));
  ok('the divider is mixed ink, so it reads on every theme',
    css.includes("'background:color-mix(in srgb, var(--ink) 12%, transparent)}'"));
  ok('the divider is no longer a full-width --line band', !css.includes('.scshelf-sep{height:1px;background:var(--line)'));
}

console.log('\n5. The switch says it is on without a dot over its own icon');
{
  ok('the on state is a hairline accent ring',
    css.includes("'#scShelfRail .scshelf-src.s-on{color:var(--coral);'") &&
    css.includes("'box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--coral) 42%, transparent)}'"));
  ok('the corner dot is gone', !css.includes('.scshelf-src.s-on::after'));
  ok('both halves of the switch are still built once',
    css.includes("'#scShelfRail .scshelf-src > span{display:none;line-height:0}'") &&
    css.includes("'#scShelfRail .scshelf-src > span.on{display:block}'"));
}

console.log('\n6. Nothing the rail could already do was taken away');
{
  ok('the lift is still there',
    css.includes("'#scShelfRail .scshelf-tab.lift{transform:scale(1.14);opacity:.92;z-index:3;'"));
  ok('a drag still owns the vertical gesture',
    css.includes("'#scShelfRail .scshelf-tab{pointer-events:auto;touch-action:none}'"));
  ok('and says it is dragging', css.includes('body.sc-rail-drag #scShelfRail .scshelf-tab{cursor:grabbing}'));
  ok('reduced motion still turns the transitions off',
    css.includes('@media (prefers-reduced-motion: reduce){#scShelfRail .scshelf-tab{transition:none}}'));
  ok('the stylesheet is written once', /if\(document\.getElementById\('scShelfCss'\)\) return;/.test(css) &&
    /st\.id = 'scShelfCss';/.test(css));
  ok('the rail still builds two groups and the three dots',
    (render.match(/scshelf-sep/g) || []).length === 2 && /data-dots="1"/.test(render));
  ok('the dots still open the song actions and no page',
    /data-dots'\) === '1'\)\{ scShelfDots\(\); return;/.test(render) &&
    /data-dots'\) === '1'\) return;/.test(mark));
  ok('the mark still writes classes and never replaces a node',
    !/innerHTML/.test(mark) && /b\.className = markcls;/.test(mark));
  ok('the switch keeps its own class when it is marked',
    /var swcls = 'scshelf-tab scshelf-src' \+ \(s \? ' s-on' : ''\);/.test(mark));
}

console.log('\n7. The release itself');
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) {
    scripts++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
  }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  // The version pin reads "this release or newer" through dev/version.cjs, because a version
// here is two numbers and a third that only runs 0-9 (85.3.9 -> 85.4), never 85.3.10.
const { atLeast } = require('./version.cjs');
const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  // 85.3.18 - rewritten for this release's contract: this suite is about the rail's paint,
  // which 85.3.18 did not touch, so it asks for 85.3.17 or newer instead of pinning it.
  ok('the page is on 85.3.17 or newer', atLeast(vPage, '85.3.17'), vPage);
  ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
  ok('the notes carry the 85.3.17 entry', page.includes("version: '85.3.17'"));
  ok('the new entry is above 85.3.16',
    page.indexOf("version: '85.3.17'") < page.indexOf("version: '85.3.16'"));
  const entry = page.slice(page.indexOf("version: '85.3.17'"), page.indexOf("version: '85.3.16'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(downloader|downloading|converter|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
    entry.slice(0, 160));
  ok('the new entry carries the three lines it describes', (entry.match(/: '/g) || []).length >= 3);
  ok('the entry names the rail', /side rail/i.test(entry));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
