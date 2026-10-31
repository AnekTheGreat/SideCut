#!/usr/bin/env node
// 80.6.29 - one Library pill, and a rail that holds still.
//
//   node dev/check-80629.cjs
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

/* -- the dock tab is one Library pill ------------------------------- */
ok(page.includes('<button id="libraryBtn" class="action-pill">Library</button>'),
  'the dock tab is one plain Library pill');
ok(!page.includes('id="playlistsHalf"'), 'there is no Library half left in the markup');
ok(!page.includes('id="albumsHalf"'), 'and no Albums half either');
ok(!page.includes('id="diagonalSplitToggle"'), 'the split switch is off the Tools card list');
ok(page.includes('#libraryBtn{ flex: 1 1 0; border-radius: 13px; }'),
  'the pill shares the dock row like the other tabs');

const handler = between("$('libraryBtn').addEventListener('click'", "$('discoverBtn').addEventListener");
ok(handler.length > 200, 'the Library tab still has its handler');
ok(!handler.includes('useDiagonalSplit'), 'the single-button toggle branch is gone');
ok(handler.indexOf("scShelfOpenTab('library')") > 0, 'the pill asks the shelf for the source songs page');
ok(handler.indexOf("scShelfOpenTab('library')") < handler.indexOf("navigate('library')"),
  'and it does that BEFORE the downloaded library is opened');
ok(/if\(typeof scShelf !== 'undefined' && scShelf\.src === 's'\)\{ scShelfOpenTab\('library'\); return; \}/.test(handler),
  'only while the source is the source that is on');

ok(page.includes('function applyLibraryButtonMode(){}'),
  'the split mode applies nothing at all now');
ok(!page.includes('lib-single-label'), 'and nothing can write a label over the word Library');

/* -- the rail is glass, and adjustable ------------------------------ */
const railRule = between("'#scShelfRail.scShelfRailOn", "'#scShelfRail .scshelf-tab{");
ok(railRule.includes('var(--scshelf-solid, 15%)'), 'the rail is mixed with transparent at the set weight');
ok(!railRule.includes('96%, #000'), 'the 96% slab is gone');
ok(!railRule.includes("'backdrop-filter"), 'and no blur came back with it');
ok(railRule.includes('top:50%') && railRule.includes('transform:translateY(-50%)'),
  'it is still centred on the screen');

ok(page.includes('id="scRailGlassCard"'), 'Tools has the rail card');
ok(page.includes('id="railGlassSlider" min="0" max="100" step="5" value="85"'),
  'with a 0-100 slider that starts at 85');
ok(page.includes('>85% see-through</span>'), 'and the row says what it is set to');
ok(page.includes("setupCollapsible('collapsibleRail', 'collapsibleRailContent', 'collapseRailIcon');"),
  'the card opens and closes like the others');

const seeBoot = between('var railSee = 85;', "var useDiagonalSplit =");
ok(seeBoot.includes("localStorage.getItem('sidecut_railSee')"), 'the choice is remembered');
ok(seeBoot.includes("setProperty('--scshelf-solid'"), 'and written as one CSS variable');
ok(seeBoot.includes("if(card && typeof SC_STREAM_OK !== 'undefined' && !SC_STREAM_OK) card.style.display = 'none';"),
  'the row is hidden in the builds that have no rail');
ok(seeBoot.includes("localStorage.setItem('sidecut_railSee'"), 'the slider saves the value it settled on');

{
  const vars = {};
  const card = { style: {} };
  const val = { textContent: '' };
  const sl = { value: '85' };
  function make(streamOk) {
    const ctx = {
      railSee: 85,
      SC_STREAM_OK: streamOk,
      document: {
        documentElement: { style: { setProperty: (k, v) => { vars[k] = v; } } },
        getElementById: (id) => id === 'railGlassVal' ? val : id === 'railGlassSlider' ? sl : id === 'scRailGlassCard' ? card : null
      }
    };
    vm.createContext(ctx);
    vm.runInContext(seeBoot.slice(seeBoot.indexOf('function scRailSee('), seeBoot.indexOf("try{ scRailSee(railSee); }")), ctx);
    return ctx;
  }
  const ctx = make(true);
  ctx.scRailSee(85);
  ok(vars['--scshelf-solid'] === '15%', '85% see-through is 15% solid (' + vars['--scshelf-solid'] + ')');
  ok(val.textContent === '85% see-through', 'and the row reads it back');
  ok(sl.value === '85', 'the slider is put where the setting is');
  ctx.scRailSee(0);
  ok(vars['--scshelf-solid'] === '100%', 'solid is 100% solid');
  ctx.scRailSee(100);
  ok(vars['--scshelf-solid'] === '0%', 'and only-the-glyphs is 0%');
  ctx.scRailSee(140);
  ok(ctx.railSee === 100, 'above 100 is clamped to 100 (' + ctx.railSee + ')');
  ctx.scRailSee(-20);
  ok(ctx.railSee === 0, 'below 0 is clamped to 0 (' + ctx.railSee + ')');
  ctx.scRailSee('abc');
  ok(ctx.railSee === 85, 'a value that is not a number falls back to 85');
  ctx.scRailSee(42.6);
  ok(ctx.railSee === 43 && vars['--scshelf-solid'] === '57%', 'a fraction is rounded and the weight follows (' + ctx.railSee + ' -> ' + vars['--scshelf-solid'] + ')');
  ok(card.style.display === undefined, 'the row stands on the full build');

  const play = make(false);
  play.scRailSee(85);
  ok(card.style.display === 'none', 'and it is hidden on the build that has no rail');
}

/* -- the rail cannot be moved by a view that is arriving -------------- */
const render = between('function scShelfRender(){', 'function scShelfMark(){');
ok(render.includes('if(rail.parentNode !== document.body){ document.body.appendChild(rail); }'),
  'the rail is moved onto the body');
ok(render.indexOf('appendChild(rail)') < render.indexOf("rail.getAttribute('data-built')"),
  'before it is built, so the first painter puts it there');
const nav = between('function navigate(view){', "$('homeBtn').addEventListener");
ok(nav.includes("_railEl.style.display = isLibrary ? '' : 'none'"),
  'and it is shown and hidden with the library, so it does not float over Home');
ok(page.includes('.sc-view-in{ animation: scViewIn 0.22s cubic-bezier(0.22,1,0.36,1) both; }') &&
  /@keyframes scViewIn\{ from\{ opacity: 0; transform: translateY\(6px\)/.test(page),
  'the view animation is the transform the rail used to be measured from');

/* -- the release is recorded --------------------------------------- */
ok(page.includes("const APP_VERSION = '80.6.29';"), 'the page runs 80.6.29');
const entryStart = page.indexOf("version: '80.6.29'");
ok(entryStart > 0, 'the changelog records 80.6.29');
const entry = page.slice(entryStart, page.indexOf('{ version:', entryStart + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
ok(entry.includes('One Library pill, and a rail that holds still'), 'and a title that says what it does');
const items = (entry.slice(entry.indexOf('items: [')).match(/'[^']*'/g) || []);
ok(items.length === 4, 'four notes (' + items.length + ')');
ok(items.filter((i) => i.startsWith("'[FULL]")).length === 3, 'three of them belong to the full build');
ok(items.filter((i) => !i.startsWith("'[FULL]")).length === 1, 'and one is true of both builds');
ok(items.some((i) => /Library pill/.test(i) && !i.startsWith("'[FULL]")), 'the dock change is published on both channels');
ok(!/80\.6\.2[5-9]/.test(items.join(' ')), 'no note names a build number');

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
  console.log('check-80629: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80629: %d passed, 0 failed', pass);
