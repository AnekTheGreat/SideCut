#!/usr/bin/env node
// v64.2.1 - the Home bubble that came back blank, one check per thing it took.
//
//   [1] the release itself: 64.2.1 is what runs, the head entry says so, its six
//       notes publish on both channels, and the store channel never reads a
//       downloader term.
//   [2] the paint guard on Home: the view has its own stacking context, a
//       settled scroll repaints the grid, a bubble still holding a drag lift is
//       put back, and the grid draws itself again if a bubble is really gone.
//   [3] the two surfaces that were fixed before still carry their guard, so this
//       release cannot have quietly dropped them.
//   [4] the entry names: nothing in the log calls itself a pass any more.
//   [5] the file still holds together: every inline script parses and every name
//       the app reads is declared.
//
//   node dev/test-66421.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '64.2.8';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  // The head entry belongs to whatever shipped last, so read the 64.2.1 entry by
  // version: this gate describes 64.2.1.
  const entry6421 = entries ? entries.find((x) => /^64\.2\.1$/.test(String(x.version))) : null;
  ok(!!entry6421 && String(entry6421.version) === '64.2.1', 'the 64.2.1 entry this gate describes is still here');
  if (entry6421) {
    const head = entry6421;
    const items = head.items || [];
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release did');
    ok(/favorites/i.test(notes), 'it names the bubble that was reported');
    ok(/scroll/i.test(notes), 'and the scroll it came back blank on');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the change (' + head.title + ')');
    ok(/EDT$/.test(head.date || ''), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('4:05 PM') === -1, 'and it is not 64.2\'s stamp');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] Home repaints its grid once a scroll settles');
{
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }'),
    'Home has its own stacking context');
  ok(has('/* Needs its own stacking context, for the same reason #listPane and') ,
    'and says why, the way #listPane and Discover do');
  ok(count('position:relative; z-index:20') >= 3, 'so all three scrolling pages carry one');
  ok(has('  function repaintHomeGrid(){'), 'a settled scroll repaints the grid');
  // 64.2.2 replaced the hide-and-restore with a layer promotion: hiding the whole
  // grid for a frame IS the blink that release reported, so these two now pin the
  // repaint that cannot be seen instead of the one that could.
  ok(has("    scRepaintSurface(wrap, '.home-bubble');"),
    'by asking every bubble on the grid to paint again');
  ok(has("      el.style.outline = '1px solid transparent';"),
    'through a transparent outline - paint only, so no layout and no hide');
  ok(!/void wrap\.offsetHeight/.test(src.slice(src.indexOf('  function repaintHomeGrid(){'), src.indexOf('  function homeGridIsWhole(){'))),
    'the forced layout that made a settled scroll hitch is gone');
  ok(has("      var phs = wrap.querySelectorAll('.hb-drag-placeholder');"),
    'a dashed placeholder an abandoned drag left behind is removed');
  ok(has("        if(!b.classList.contains('hb-dragging') && !b.style.position) continue;"),
    'a bubble still holding a drag lift is put back to a plain bubble');
  ok(has("        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';"),
    'including the box and layer the carry gave it');
  ok(has('  function homeGridIsWhole(){'), 'the grid knows what it should contain');
  ok(has("        if(!wrap.querySelector('[data-bubble=\"' + k + '\"]')) return false;"),
    'and reports a bubble that is missing');
  ok(has("      return wrap.querySelectorAll('.home-bubble').length === count;"),
    'or a grid that is short one');
  ok(has("    if(!wrap || wrap.classList.contains('reorder-mode')) return true;"),
    'a deliberate reorder in progress is never treated as a fault');
  ok(has('  (function watchHomePaint(){'), 'the watch runs off the Home scroll');
  ok(has('!v || v._hbPaintWatch'), 'and is wired once, not once per render');
  ok(has("      }, 140);"), 'with the same 140ms settle the rail uses');
  ok(has('          if(hbDrag) return; // a drag in progress owns the grid'),
    'a live drag owns the grid, so nothing is stolen from it mid-gesture');
  ok(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
    'the grid is repainted, and drawn again if a bubble is really gone');
  const watchAt = src.indexOf('(function watchHomePaint(){');
  ok(watchAt !== -1 && watchAt < src.indexOf('  // ---- Reorder Home bubbles ----'),
    'and it sits with the rest of Home, not inside the reorder code');
  ok(src.indexOf('repaintHomeGrid()') < src.indexOf('function wireHomeBubbleDrag'),
    'the repaint is defined before anything can call it');
}

console.log('[3] the surfaces fixed before still carry their guard');
{
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; }'),
    'Discover still has its own stacking context');
  ok(has('  function repaintPinnedRail(list){'), 'and still repaints the pinned-artists card');
  ok(has("  function repaintPinnedRail(list){"),
    'the rail is still the surface Home copied its repaint from');
  ok(has('#pinnedArtistsStrip{ position:relative; z-index:1; }'), 'the rail card is still lifted out of the glow wash');
  const listPane = src.slice(src.indexOf('#listPane{ flex:1;'), src.indexOf('.pane-header{'));
  ok(/position:relative; z-index:20;/.test(listPane), 'and the library list keeps the stacking context it was given first');
}

console.log('[4] the entry names state the changes');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = [];
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  const recent = entries.filter((e) => parseFloat(String(e.version)) >= 60);
  ok(recent.length > 5, 'the recent entries are readable (' + recent.length + ')');
  ok(recent.every((e) => !/\bpass\b/i.test(String(e.title))), 'and none of them names itself a pass');
  const e642 = entries.find((x) => /^64\.2$/.test(String(x.version)));
  const e641 = entries.find((x) => /^64\.1$/.test(String(x.version)));
  const e64 = entries.find((x) => /^64$/.test(String(x.version)));
  ok(!!e642 && /pinned/i.test(String(e642.title)) && /settings/i.test(String(e642.title)),
    'the 64.2 entry still states what 64.2 changed (' + (e642 && e642.title) + ')');
  ok(!!e641 && /crop/i.test(String(e641.title)), 'the 64.1 entry still states what 64.1 changed');
  ok(!!e64 && /cover/i.test(String(e64.title)) && /rollback/i.test(String(e64.title)),
    'and the 64 entry still states what 64 changed');
}

console.log('[5] the file still holds together');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'every inline script block parses (' + bad + ' bad)');
  let code = 0, out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code === 0, 'every name the app reads is declared: ' + first.trim());
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
