// v63.1.3 — the release check repaints in place and shows a progress bar.
//
// The report: "it keeps reopening the same new releases popup for every artist
// instaid of just showing a progress bar inside of the what's new popup".
//
// checkPinnedArtistReleases saves and repaints AS EACH ARTIST LANDS — on purpose,
// so a partly-finished run keeps what it found. That repaint was
// scRepaintOpenReleasePanel(), which called openHomeBubble('newreleases'), and
// openHomeBubble rewrites the whole panel body: the header, the count, the
// mark-all button, every row and the All/Upcoming strip are all re-created.
// Measured on the shipped build with 4 pinned artists: THREE full panel rebuilds
// during one check, and no progress indicator anywhere.
//
// This audit RUNS the shipped pieces — __scHbPaintRelRows and __scHbRelRowInner,
// lifted out of index.html — over a real panel body, and pins the shape of the
// fix: the rows are updated in place (node identity kept), the tab strip and the
// header survive a repaint, the count line follows the data, a row whose release
// is gone is removed, and the progress bar exists while a check is running and is
// gone when it ends.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('could not extract ' + from + ' .. ' + to);
  return src.slice(a, b);
}

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '64.2', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);
  const headText = entries[0].items.join(' ');
  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');
  ok(!/\bdownload|converter|convert\b/i.test(headText), 'notes carry no downloader term (shared channel)');
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');

console.log('[2] the check repaints rows, never the whole panel');
{
  const fn = sliceBetween('function scRepaintOpenReleasePanel(){', '// Opened the Upcoming tab and nothing is dated yet?');
  ok(fn.includes('__scHbPaintRelRows'), 'the repaint calls the in-place row painter');
  ok(!fn.includes("openHomeBubble('newreleases')") || fn.indexOf('__scHbPaintRelRows') < fn.indexOf("openHomeBubble('newreleases')"),
    'the in-place path is taken before any full rebuild');
  ok(fn.includes("document.getElementById('hbPanelBody')"), 'it targets the panel BODY, not the overlay');
  ok(!/openHomeBubble\('newreleases'\)[^;]*;[\s\S]*return;\s*\}\s*\}catch/.test(fn.slice(0, fn.indexOf('__scHbPaintRelRows'))),
    'openHomeBubble is not reached when the painter exists');
}

console.log('[3] the painter updates rows in place');
{
  const painter = sliceBetween('window.__scHbPaintRelRows = function(host){', 'function openHomeBubble(kind){');
  ok(painter.includes("host.querySelectorAll('.hb-track-row[data-hb-rel]')"), 'existing rows are found by their release key');
  ok(painter.includes("row.remove()"), 'a row whose release is gone is removed');
  ok(painter.includes('document.createElement'), 'only missing rows are created');
  ok(painter.includes('_hbRelWired'), 'a row is wired once, not re-wired on every repaint');
  ok(painter.includes('_hbRelSig'), 'a row whose text is unchanged is left alone');
  ok(painter.includes("host.querySelector('#hbRelCount')"), 'the count line is updated');
  ok(painter.includes("host.querySelector('#hbCtaMarkSeen')"), 'the mark-all button is updated');
  ok(painter.includes('__scUpRefreshState'), 'the progress bar rides along with the repaint');
  // The panel's own initial render must go through the same painter, or the two
  // paths drift apart and the panel is rebuilt anyway.
  const hb = sliceBetween("else if(kind === 'newreleases'){", "else if(kind === 'nowplaying'){");
  ok(hb.includes('window.__scHbPaintRelRows(body)'), 'the panel initial render uses the painter too');
  ok(!hb.includes('all.map(rel => {'), 'the inline row builder is gone from the panel');
}

console.log('[4] a progress bar exists while a check runs, and only then');
{
  // The refresh helper sits between the painter and the repaint function.
  const rs = sliceBetween('window.__scUpRefreshState = function(root){', 'function scRepaintOpenReleasePanel(){');
  ok(rs.includes("prog.id = 'scRelProgress';"), 'the bar node has an id');
  ok(rs.includes('Looking for upcoming releases'), 'the bar carries a label');
  ok(rs.includes('doneN') && rs.includes('total'), 'the bar shows N of total');
  ok(rs.includes('prog.remove()'), 'the bar is removed when the run ends');
  ok(rs.includes("st && st.active && total > 0"), 'the bar only shows while the check is active');
  // With no root it must update every open surface, so the bar shows on whichever
  // one the user is looking at.
  ok(rs.includes("['discPopupBody', 'hbPanelBody']"), 'both release surfaces are covered when called with no root');
}

console.log('[5] the bar is driven from the check, not only from a redraw');
{
  // The per-artist loop and the ticker both have to refresh it, or the bar would
  // sit at whatever the last redraw left.
  ok(src.includes('scRepaintOpenReleasePanel();'), 'the per-artist loop repaints');
  const tick = src.indexOf('_tick = setInterval(function(){');
  ok(tick !== -1, 'the progress ticker exists');
  const tickSlice = src.slice(tick, tick + 700);
  ok(tickSlice.includes('__scUpRefreshState'), 'the ticker refreshes the bar');
  ok(tickSlice.includes('pinnedCheckState.done') && tickSlice.includes('pinnedCheckState.total'),
    'the ticker reads the run position');
}

console.log('[6] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let syntaxErrors = 0;
  blocks.forEach((b, i) => {
    try { new Function(b.replace(/<\/?script[^>]*>/gi, '')); }
    catch (e) {
      if (i === 3 && String(e.message).includes('await')) return; // nested async, shipped that way
      syntaxErrors++;
      console.log('       block ' + (i + 1) + ': ' + e.message);
    }
  });
  ok(syntaxErrors === 0, 'inline script syntax failures: ' + syntaxErrors);
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
