#!/usr/bin/env node
// 80.6.28 - three pages, and the source says whose they are.
//
//   node dev/check-80628.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }
function between(from, to) {
  const a = page.indexOf(from);
  const b = page.indexOf(to, a + from.length);
  return (a < 0 || b < 0) ? '' : page.slice(a, b);
}

/* -- the rail is three pages ---------------------------------------- */
const rail = between('function scShelfRender(){', 'function scShelfMark(){');
ok(/var pages = \[\['library', 'Songs', 'list'\], \['playlists', 'Playlists', 'plist'\], \['albums', 'Albums', 'grid'\]\]/.test(rail),
  'the rail draws Songs, Playlists and Albums');
ok(rail.includes("data-shelf=\"' + t[0] + '\""), 'every page still carries its data-shelf');
ok(rail.includes("scShelfOpenTab(this.getAttribute('data-shelf'))"), 'and opens through the one entry point');
ok(rail.indexOf('scshelf-src') > rail.indexOf('plist'), 'the source switch still sits under the pages');
ok(page.includes("plist: 'M3 6h2.2v2.2H3z"), 'the playlist glyph has its own path');

/* -- the glyph keeps the source and opens the third page ------------ */
const openTab = between('function scShelfOpenTab(', 'function scShelfSetSrc(');
ok(/var page = \(tab === 'albums'\) \? 'albums' : \(tab === 'playlists'\) \? 'playlists' : 'library';/.test(openTab),
  'all three tabs resolve to a page');
const glyphPath = openTab.slice(openTab.indexOf("var page = (tab === 'albums')"));
ok(!/scShelf\.src\s*=[^=]/.test(glyphPath), 'no page glyph moves the source');
ok(/tab === 'streaming'\)\{ scShelf\.page = 'library'; scShelf\.src = 's';/.test(openTab),
  'the streaming entry point still switches the source on');

{
  function make(state) {
    let applied = 0, marked = 0;
    const ctx = {
      SC_STREAM_OK: true,
      scShelf: Object.assign({ page: 'library', src: 's', open: true }, state),
      scStreamState: { pl: state.pl || '' },
      scShelfApply: () => { applied++; },
      scShelfMark: () => { marked++; }
    };
    vm.createContext(ctx);
    vm.runInContext(openTab, ctx);
    return { ctx, counts: () => ({ applied, marked }) };
  }
  let t = make({});
  t.ctx.scShelfOpenTab('playlists');
  ok(t.ctx.scShelf.page === 'playlists' && t.ctx.scShelf.src === 's',
    'on the source, Playlists opens the streaming playlists page');
  ok(t.counts().applied === 1, 'and paints it');

  t = make({ page: 'playlists', src: 's', open: true });
  t.ctx.scShelfOpenTab('playlists');
  ok(t.counts().applied === 0 && t.counts().marked === 1, 'tapping the page already up only marks');

  t = make({ page: 'playlists', src: 'd', open: false });
  t.ctx.scShelfOpenTab('albums');
  ok(t.ctx.scShelf.page === 'albums' && t.ctx.scShelf.src === 'd', 'Albums on the device stays on the device');

  t = make({ page: 'albums', src: 's', open: true });
  t.ctx.scShelfOpenTab('library');
  ok(t.ctx.scShelf.page === 'library' && t.ctx.scShelf.src === 's', 'Songs on the source stays on the source');
}

/* -- the painter maps all three ------------------------------------ */
const apply = between('function scShelfApply(){', 'function scShelfBoot(){');
ok(apply.includes("(scShelf.page === 'playlists') ? 'playlists'"), 'the painter knows the playlists page');
ok(/libraryMode = \(page === 'albums'\) \? 'albums' : 'playlists'/.test(apply),
  'and paints playlists for both the songs and the playlists page on the device');
ok(apply.includes("if(page === 'library'){") && apply.includes("activePlaylist = 'All Songs';"),
  'the Songs glyph lands on All Songs');

/* -- the streaming playlists page, drawn --------------------------- */
const grid = between('function scShelfGrid(', 'function scStreamAddTo(');
const render = between('function scStreamRender(){', 'function scStreamWire(){');
ok(render.includes("scShelf.page === 'playlists'"), 'the streaming render has a playlists page');
const plPage = between("scShelf.page === 'playlists'", "// 80.6.13 - A PLAYLIST IS A PAGE.");
ok(plPage.includes("scShelfGrid('pl', scStreamState.playlists || [])"), 'drawn as tiles');
ok(plPage.includes('id="scStreamNewPl"'), 'with the button that makes one');
ok(plPage.includes('Hold a playlist for two seconds to delete it.'), 'and the line that says how one goes away');
ok(render.indexOf("scShelf.page === 'playlists'") < render.indexOf('if(open){'),
  'it is decided before a single list page is drawn');

{
  const ctx = {
    scStreamThumb: () => '',
    scIcon: () => '<svg></svg>',
    escapeHtml: (s) => String(s)
  };
  vm.createContext(ctx);
  vm.runInContext(grid, ctx);

  let h = ctx.scShelfGrid('pl', [
    { name: 'Late night', items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
    { name: 'One', items: [{ id: 'd' }] }
  ]);
  ok((h.match(/class="scs-pl"/g) || []).length === 2, 'one tile per playlist (' + (h.match(/class="scs-pl"/g) || []).length + ')');
  ok(h.includes('Late night') && h.includes('3 songs'), 'the name and the count are on it');
  ok(h.includes('1 song<') || h.includes('1 song</div>'), 'and one song is not one songs');
  ok(!h.includes('scs-al'), 'no album tile is drawn on the playlists page');

  h = ctx.scShelfGrid('pl', []);
  ok(h.includes('No streaming playlists yet'), 'an empty page says so');
}

/* -- the pill follows the source ----------------------------------- */
ok(page.includes("if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab('library'); return; }"),
  'the Library half opens the source songs page');
ok(page.includes("if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab('albums'); return; }"),
  'the Albums half opens the source albums page');
const halves = between("var plHalf = document.getElementById('playlistsHalf');", '})();;');
ok(halves.indexOf("scShelfOpenTab('library')") < halves.indexOf("navigate('playlists')"),
  'and it is decided before the downloaded navigation');
ok(halves.includes("navigate('albums');"), 'the device side still lands on the downloaded albums');
ok(page.includes("if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab(scShelf.page === 'albums' ? 'library' : 'albums'); return; }"),
  'the single-button pill flips the source pages too');

/* -- the release is recorded --------------------------------------- */
ok(page.includes("const APP_VERSION = '80.6.28';"), 'the page runs 80.6.28');
const entryStart = page.indexOf("version: '80.6.28'");
ok(entryStart > 0, 'the changelog records 80.6.28');
const entry = page.slice(entryStart, page.indexOf('{ version:', entryStart + 10));
ok(/date: 'October \d{1,2}, 2026 \u00b7 \d{1,2}:\d{2} (AM|PM) EDT'/.test(entry), 'with its day and Eastern time');
ok(entry.includes('The pages follow the source'), 'and a title that says what it does');
const items = entry.match(/'\[FULL\][^']*'/g) || [];
ok(items.length === 4, 'four notes, every one tagged [FULL] (' + items.length + ' tagged)');
ok(!/80\.6\.2[5-8]/.test(items.join(' ')), 'no note names a build number');

/* -- the page still parses ----------------------------------------- */
{
  const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1]));
  let failing = 0;
  for (const s of scripts) {
    try { new vm.Script(s[2]); } catch (_e) { failing++; }
  }
  ok(scripts.length === 7, 'seven inline scripts (' + scripts.length + ')');
  ok(failing === 0, 'all seven inline scripts compile (' + failing + ' fail)');
}

if (bad.length) {
  console.log('check-80628: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80628: %d passed, 0 failed', pass);
