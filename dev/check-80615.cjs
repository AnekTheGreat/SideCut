#!/usr/bin/env node
// 80.6.15 - what must be true of the rail and the watch:
// the tabs are glyphs, the rail floats and takes no room, only the glyphs catch a
// tap, and a link that goes quiet is read instead of sitting at 0:00.
//
//   node dev/check-80615.cjs
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.15';"), 'the page runs 80.6.15');
ok(page.includes("version: '80.6.15'"), 'the changelog records 80.6.15');
ok(!page.includes("const APP_VERSION = '80.6.14';"), 'the previous version string is gone');

// --- the rail floats, and costs the page no room -------------------------
const css = page.slice(page.indexOf("st.id = 'scShelfCss';"), page.indexOf("document.head.appendChild(st);"));
ok(css.length > 800, 'the shelf stylesheet was found');
ok(css.includes("'#scShelfRail{display:none;height:0}'"), 'the rail takes no height when it is off');
ok(css.includes('flex-direction:column'), 'the rail is a column');
ok(css.includes('position:fixed'), 'and it is fixed to the viewport, not to the flow');
ok(css.includes("'position:fixed;right:8px;top:50%;margin:0;padding:5px;z-index:70;'"), 'on the right edge, centred');
ok(css.includes('pointer-events:none'), 'the rail itself is not a tap target');
ok(css.includes("'#scShelfRail .scshelf-tab{pointer-events:auto;width:32px;height:32px;flex:0 0 auto;'"),
  'only the glyphs are, and they are small');
ok(css.includes("'transform .14s ease,box-shadow .22s ease}'"), 'the change of tab is eased');
ok(css.includes('#scShelfRail .scshelf-tab:active{transform:scale(.9)}'), 'and answers a press');
ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'and respects a reduced-motion setting');
ok(!/margin:0 14px 12px/.test(css), 'the old full-width pill row is gone');

// --- the tabs are icons --------------------------------------------------
const render = page.slice(page.indexOf('function scShelfRender(){'), page.indexOf('function scShelfPage(on){'));
ok(render.includes("['streaming', 'Streaming', 'stream'], ['library', 'Library', 'list'], ['albums', 'Albums', 'grid']"),
  'the three tabs carry the three glyphs');
ok(render.includes('scIcon(t[2], 17)'), 'each button draws its glyph');
ok(!render.includes("escapeHtml(t[1]) + '</button>'"), 'the word is no longer the button');
ok(render.includes("aria-label=\"' + escapeHtml(t[1])"), 'the word is the accessible name');
ok(render.includes("title=\"' + escapeHtml(t[1])"), 'and the long-press title');
ok(render.includes("data-shelf=\"' + t[0] + '\""), 'the data-shelf wiring is untouched');
ok(render.includes("scShelfOpenTab(this.getAttribute('data-shelf'))"), 'and still switches pages');

// --- the three glyphs exist ---------------------------------------------
const iconSrc = page.slice(page.indexOf('function scIcon(name, size){'), page.indexOf('function scStreamResolve(videoId){'));
['stream:', 'list:', 'grid:'].forEach((k) => ok(iconSrc.includes(k), 'the ' + k.replace(':', '') + ' glyph is defined'));

// --- a silent link is read ----------------------------------------------
ok(page.includes('function scStreamWatch(u){'), 'there is a watch on the link');
const watch = page.slice(page.indexOf('function scStreamWatch(u){'), page.indexOf('function scStreamStart(u, at){'));
ok(watch.includes('}, 6000);'), 'it waits six seconds');
ok(watch.includes('now > at0 + 0.4'), 'and treats real progress as playback');
ok(watch.includes("scStreamState.err = 'the link went quiet'"), 'and names the silence');
ok(watch.includes('scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size })'),
  'then reads the song instead');
ok(watch.includes('scStreamStart(src)'), 'and starts what it read');
const play = page.slice(page.indexOf('function scStreamPlay(id, ctxIds){'), page.indexOf('function scStreamToggle(){'));
ok(play.includes('scStreamWatch(u)'), 'the watch is armed when the link starts');

// --- the glyphs, run -----------------------------------------------------
try {
  const vm = require('node:vm');
  const icon = vm.runInNewContext(iconSrc + '\nscIcon', {});
  ['stream', 'list', 'grid'].forEach((n) => {
    const svg = icon(n, 17);
    ok(/^<svg /.test(svg) && svg.includes('<path d="M') && svg.includes('width="17"'), 'the ' + n + ' glyph draws at 17px');
  });
  ok(icon('stream', 17) !== icon('list', 17), 'the stream and library glyphs differ');
  ok(icon('list', 17) !== icon('grid', 17), 'the library and albums glyphs differ');
  const strip = (s) => s.replace(/width="\d+"/, 'w').replace(/height="\d+"/, 'h');
  ok(strip(icon('stream', 17)) === strip(icon('stream', 20)) && icon('stream', 20).includes('width="20"'),
    'a glyph keeps its shape at any size');
} catch (e) {
  bad.push('the glyphs could not be drawn: ' + e.message);
}

console.log('\ncheck-80615: ' + pass + ' passed, ' + bad.length + ' failed');
bad.forEach((b) => console.log('  x ' + b));
process.exit(bad.length ? 1 : 0);
