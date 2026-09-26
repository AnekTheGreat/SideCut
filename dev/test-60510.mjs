// v61 — the "Upcoming releases" tab inside the Fetch latest popup.
//
// (Version note: the release was briefly drafted as "60.5.10" — banned by the
// first rule in AGENTS.md; after 60.5.9 it is v61.)
//
// The tab strip is injected at popup-open time (never cached), reads the rows'
// data-date to filter, and the rows themselves are the source of truth — so
// this test asserts against the shipped source: injection site, the switcher's
// filter/sort/order/empty/subtitle behavior, the "drops … · in Nd" row label,
// the tap-through to the release page, and (60510b) the same tabs combined
// into the Home bubble's New releases panel. Release metadata follows the same
// shape as every other version's audit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

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
ok(ver === '63.0.4', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
  const shared = entries[0].items.filter((i) => !i.startsWith('[FULL] '));
  ok(shared.length >= 1, 'shared notes for the other channel: ' + shared.length);
  ok(!/play build|play version|play install/i.test(entries[0].items.join('\n')), 'notes never name the play build');
  ok(!/\bdownload|converter|convert\b/i.test(entries[0].items.join('\n')), 'new notes carry no downloader term (shared channel)');
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version);

console.log('[2] tab strip injected at popup open');
{
  const open = sliceBetween('function openDiscoverPopup(title, bodyHTML, subtitle){', '\nfunction ');
  ok(open.includes("title.indexOf('New Releases') !== -1"), 'injection gated to the New Releases popup');
  ok(open.includes("bEl.querySelector('.dp-track[data-date]')"), 'injection needs dated rows (empty state gets no tabs)');
  ok(open.includes("id = 'dpRelTabs'"), 'tab strip element created');
  ok(open.includes('All releases') && open.includes('Upcoming releases'), 'both tab labels present');
  ok(open.includes("id = 'dpRelUpEmpty'"), 'upcoming empty-state note created');
  ok(open.includes('No upcoming releases yet'), 'empty-state speaks up when nothing is dated');
  ok(open.indexOf("bEl.innerHTML = bodyHTML || ''") < open.indexOf("id = 'dpRelTabs'"), 'injection happens after the body is set');
  ok(open.includes('__wireReleaseRows'), 'rows re-wired at open (cached reopens included)');
  ok(open.includes("window.__scDiscRelTab(btn.dataset.mode)"), 'tab buttons wired to the switcher');
  // The cache stores the original bodyHTML parameter, so the strip is never
  // baked into a cached snapshot.
  ok(src.includes('body:bodyHTML'), 'popup cache still stores the raw body (tabs never cached)');
}

console.log('[3] __scDiscRelTab switcher behavior');
{
  const sw2 = sliceBetween('window.__scDiscRelTab = function(mode, root){', 'function openDiscoverPopup');
  ok(sw2.includes("window.__scUpcomingDay(r.getAttribute('data-date'))"), 'filter: data-date gated by __scUpcomingDay (strict future day, junk rejected)');
  ok(sw2.includes(".sort(function(a, b){ return (a.getAttribute('data-date') || '')"), 'upcoming sorted soonest first');
  ok(sw2.includes('root._dpRelOrder'), 'original order snapshotted and restored');
  ok(sw2.includes('(upcoming && !up.length)'), 'empty note only on the upcoming tab with nothing to show');
  ok(sw2.includes('upcoming release'), 'subtitle counts what the upcoming tab shows');
  ok(sw2.includes("t.style.background = on ? 'var(--ink)'"), 'active tab styled');
  ok(sw2.includes('root._dpRelRowSel'), 'row selector scoped per container');
  ok(sw2.includes("root.querySelector('#hbCtaMarkSeen')"), 'Home mark-all chip rides with the rows');
  ok(sw2.includes('mr.style.display = upcoming ?'), 'mark-all chip hidden on the upcoming tab');
  ok(sw2.includes('root._dpRelSubEl'), 'count line scoped to the container');
  ok(!src.includes("!document.getElementById('dpRelTabs')"), 'no document-wide strip guard left');
  ok(src.includes("!bEl.querySelector('#dpRelTabs')"), 'popup strip guard scoped to its own body');
}

console.log('[4] Home bubble combines the same tabs');
{
  const hb = sliceBetween("else if(kind === 'newreleases'){", "else if(kind === 'nowplaying'){");
  ok(hb.includes('data-date="'), 'hb rows carry data-date');
  ok(hb.includes('String(rel.date || \'\').slice(0,10)'), 'hb data-date is the date part');
  ok(hb.includes('id="hbRelCount"'), 'count line gets an id to swap');
  ok(hb.includes("_dpRelRowSel = '.hb-track-row[data-date]'"), 'switcher pointed at hb rows');
  ok(hb.includes("body.querySelector('#dpRelTabs')"), 'strip injected once per render');
  ok(hb.includes("window.__scDiscRelTab(window.__scRelTabMode || 'all', body)"), 'tabs applied with the panel body as root, mode preserved');
  ok(hb.includes('color:var(--gold)'), 'hb drops label painted gold');
  ok(hb.includes("'upcoming:Upcoming releases'"), 'both tab labels present in the panel');
}

console.log('[5] Fetch latest row labels + release-page tap-through');
{
  const fl = sliceBetween('// Build popup content from pinnedReleases', "openDiscoverPopup('");
  ok(fl.includes("'drops '"), 'future rows build a "drops" label');
  ok(fl.includes('\\u00b7 in '), 'label carries the "· in Nd" form');
  ok(fl.includes('color:var(--gold)'), 'upcoming label painted gold');
  ok(!fl.includes("' (' + r.date.slice(0,10) + ')'"), 'the duplicated raw date is gone');
  const wire = sliceBetween('window.__wireReleaseRows = function(){', '\n      };\n      // Fetch Latest button');
  ok(wire.includes('openReleasePage(_dd.artist, _dd.title)'), 'future-dated rows open the release page');
  ok(wire.includes('_dd.date > new Date().toISOString().slice(0, 10)'), 'row tap gates on a genuinely future date');
}

console.log('[6] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
