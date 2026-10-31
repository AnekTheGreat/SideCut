#!/usr/bin/env node
// 80.6.25 - the rail holds still, and the downloaded songs are one tap away.
//
//   node dev/check-80625.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

// The shelf module's own slice of the page: everything from the rail's CSS to the
// painter. Assertions read this, not the whole 4 MB, so a match cannot come from
// another rail (there is more than one rail in this page's history).
const start = page.indexOf('function scShelfCss(');
const end = page.indexOf('function scShelfApply(');
const shelf = page.slice(start, end);
ok(start > 0 && end > start, 'the shelf module is in the page');

/* -- the pill does not blur what it floats over --------------------- */
const railCss = page.slice(page.indexOf("'#scShelfRail.scShelfRailOn{"), page.indexOf("'#scShelfHead{"));
ok(!/backdrop-filter\s*:/.test(railCss), 'the rail carries no backdrop-filter (a fixed pill over a scroller)');
ok(/background:color-mix\(in srgb, var\(--bg-raised\) 96%, #000\)/.test(railCss),
  'the rail is painted by its own background instead');
ok(/position:fixed;right:8px;top:50%/.test(railCss), 'the rail is still fixed on the right, above the songs');

/* -- one glyph switched, not repainted ----------------------------- */
ok(/scshelf-i-dev/.test(shelf) && /scshelf-i-str/.test(shelf), 'the switch is built with both of its icons');
ok(!/b\.innerHTML/.test(shelf), 'marking the rail writes no innerHTML');
const mark = shelf.slice(shelf.indexOf('function scShelfMark('), shelf.indexOf('function scShelfPage('));
ok(!/innerHTML/.test(mark), 'scShelfMark replaces no node at all');
ok(/if\(b\.className !== markcls\) b\.className = markcls;/.test(mark),
  'a page glyph is only restyled when its mark actually changes');
ok(/if\(b\.className !== swcls\) b\.className = swcls;/.test(mark), 'the switch is the same way');
ok(/span\.on\{display:block\}/.test(page), 'the shown half of the switch is a class, not a rewrite');
ok(/scshelf-src > span\{display:none/.test(page), 'the other half is hidden by the same stylesheet');

/* -- the icon is the destination ----------------------------------- */
ok(/var s = \(scShelf\.src === 's'\);/.test(mark), 'the switch reads the current source');
ok(/scshelf-i-dev' \+ \(s \? ' on' : ''\)/.test(mark),
  'on the source the device arrow is the icon that shows (a tap goes to the device)');
ok(/scshelf-i-str' \+ \(s \? '' : ' on'\)/.test(mark),
  'on the device the waveform shows (a tap goes to the source)');
ok(/aria-label', s \? 'On this device' : 'Streaming'/.test(mark), 'the words follow the same rule');

/* -- Library and Albums mean the songs on this phone ---------------- */
const openTab = shelf.slice(shelf.indexOf('function scShelfOpenTab('), shelf.indexOf('function scShelfSetSrc('));
ok(/scShelf\.src = 'd';/.test(openTab), 'a tap on Library or Albums leaves the source');
ok(/scShelf\.page = page;/.test(openTab), 'and keeps the page the glyph names');
ok(/if\(page === scShelf\.page && scShelf\.src === 'd' && !scShelf\.open\)\{ scShelfMark\(\); return; \}/.test(openTab),
  'the already-up page still repaints nothing');
ok(/tab === 'streaming'\)\{ scShelf\.page = 'library'; scShelf\.src = 's';/.test(openTab),
  'the streaming entry point still switches the source on');

/* -- coming back to the device lands on the songs ------------------ */
const setSrc = page.slice(page.indexOf('function scShelfSetSrc('), page.indexOf('function scShelfApply('));
ok(/if\(want === 'd'\) scShelf\.page = 'library';/.test(setSrc),
  'flipping to the device comes home to the song list');
ok(/scShelf\.src = want;/.test(setSrc) && /scShelfApply\(\);/.test(setSrc),
  'and it still goes through the one painter');

/* -- the release is recorded --------------------------------------- */
ok(page.includes("const APP_VERSION = '80.6.25';"), 'the page runs 80.6.25');
const entryStart = page.indexOf("version: '80.6.25'");
const entry = page.slice(entryStart, page.indexOf('{ version:', entryStart + 10));
ok(entryStart > 0, 'the changelog records 80.6.25');
ok(/date: 'October 30, 2026 \u00b7 \d{1,2}:\d{2} (AM|PM) EDT'/.test(entry), 'with its day and Eastern time');
ok(entry.includes('The side rail holds still'), 'and a title that says what it repairs');
// The rule is about the notes a reader sees, so it is the items that are tested - the
// comment block that follows this entry belongs to 80.6.24 and names builds on purpose.
const items = entry.match(/'\[FULL\][^']*'/g) || [];
ok(items.length === 4, 'four notes, every one tagged [FULL] (' + items.length + ' tagged)');
ok(!/80\.6\.2[45]/.test(items.join(' ')), 'no note names a build number');

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
  console.log('check-80625: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80625: %d passed, 0 failed', pass);
