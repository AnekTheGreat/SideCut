#!/usr/bin/env node
// v60.5.10: the Fetch latest popup gains a second tab — "Upcoming releases" —
// holding every pinned-artist release dated to drop, soonest first, each row
// opening the release page (cover, countdown, pre-save, tracklist) that v60.5.9
// built. The tab strip is injected at open time like the Singles/Album History
// search bar, so a popup reopened from its offline cache gets it freshly wired
// too. Future-dated rows in the main list now read "drops Oct 3 · in 10d" in
// gold instead of printing the raw date twice (the 60.5.8 changelog already
// claimed this wording — now the popup actually shows it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

if (src.includes('dpRelTabs')) {
  console.log('patch-60510: already applied');
  process.exit(0);
}

function mustCount(hay, needle, want, label) {
  const got = hay.split(needle).length - 1;
  if (got !== want) throw new Error(`${label}: expected ${want} of "${needle}", found ${got}`);
}
function replaceOnce(oldStr, newStr, label) {
  mustCount(src, oldStr, 1, label);
  src = src.replace(oldStr, newStr);
  n++;
  console.log('• ' + label);
}

// ------------------------------------------------- 1. "drops … · in Nd" label
replaceOnce(
  `          var when = r.date ? r.date.slice(0,10) : '';`,
  `          var when = '';
          var upc = false;
          if(r.date){
            var _d0 = r.date.slice(0,10);
            var _days = Math.round((Date.parse(_d0 + 'T00:00:00Z') - Date.parse(new Date().toISOString().slice(0,10) + 'T00:00:00Z')) / 86400000);
            upc = _days > 0;
            when = upc
              ? 'drops ' + new Date(_d0 + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' \\u00b7 in ' + _days + 'd'
              : _d0;
          }`,
  'future rows say "drops Oct 3 · in Nd"'
);

replaceOnce(
  ` + escapeHtml(r.artistName||'') + (when ? ' · ' + when : '') + (r.date ? ' (' + r.date.slice(0,10) + ')' : '') + '</div></div></div>';`,
  ` + escapeHtml(r.artistName||'') + (when ? ' · ' + (upc ? '<span style="color:var(--gold);font-weight:600;">' + escapeHtml(when) + '</span>' : escapeHtml(when)) : '') + '</div></div></div>';`,
  'row subtitle: gold for upcoming, no duplicated raw date'
);

// --------------------------------------- 2. tab strip injected at popup open
replaceOnce(
  `  if(bEl) bEl.innerHTML = bodyHTML || '';`,
  `  if(bEl) bEl.innerHTML = bodyHTML || '';
  // Fetch latest's New Releases popup carries two tabs — "All releases" and
  // "Upcoming releases" — injected at open time like the search bar below, so
  // a popup reopened from its cache after an offline check gets them freshly
  // wired too. The rows already carry data-date, so the filter reads the DOM.
  try{
    if(bEl && title && title.indexOf('New Releases') !== -1 && bEl.querySelector('.dp-track[data-date]') && !document.getElementById('dpRelTabs')){
      var _today = new Date().toISOString().slice(0, 10);
      var _allRows = Array.prototype.slice.call(bEl.querySelectorAll('.dp-track[data-date]'));
      var _upN = _allRows.filter(function(r){ return (r.getAttribute('data-date') || '') > _today; }).length;
      bEl._dpRelOrder = null;
      bEl._dpRelSub = null;
      var _tabs = document.createElement('div');
      _tabs.id = 'dpRelTabs';
      _tabs.style.cssText = 'display:flex;gap:6px;padding:8px 12px 6px;position:sticky;top:0;background:var(--card,#1a2c33);z-index:5;';
      _tabs.innerHTML = ['all:All releases', 'upcoming:Upcoming releases'].map(function(spec){
        var p = spec.split(':'); var mode = p[0]; var label = p[1];
        var badge = (mode === 'upcoming' && _upN) ? ' <span style="font-size:10px;font-weight:700;opacity:0.75;">' + _upN + '</span>' : '';
        return '<button class="dp-rel-tab" data-mode="' + mode + '" style="flex:0 0 auto;padding:8px 14px;border-radius:999px;border:1px solid var(--line);font-size:12.5px;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.05);color:var(--ink-dim);">' + label + badge + '</button>';
      }).join('');
      bEl.insertBefore(_tabs, bEl.firstChild);
      var _upEmpty = document.createElement('div');
      _upEmpty.id = 'dpRelUpEmpty';
      _upEmpty.className = 'dp-empty';
      _upEmpty.style.cssText = 'display:none;';
      _upEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';
      bEl.appendChild(_upEmpty);
      _tabs.querySelectorAll('.dp-rel-tab').forEach(function(btn){
        btn.addEventListener('click', function(){ window.__scDiscRelTab(btn.dataset.mode); });
      });
      window.__scDiscRelTab('all');
      // Cached reopens never re-ran row wiring before — calling it here fixes
      // taps there, and a row ignores a second attach.
      if(typeof window.__wireReleaseRows === 'function') window.__wireReleaseRows();
    }
  }catch(_eRelTabs){ }`,
  'tab strip injected for the New Releases popup'
);

// ----------------------------------------------- 3. the tab switcher itself
replaceOnce(
  `function openDiscoverPopup(title, bodyHTML, subtitle){`,
  `// Fetch latest popup: swap between "All releases" and "Upcoming releases".
// The rows are the source of truth (data-date), so the tab works on a popup
// reopened from its cache exactly as it does on a fresh open.
window.__scDiscRelTab = function(mode){
  var bEl = document.getElementById('discPopupBody');
  if(!bEl) return;
  var upcoming = mode === 'upcoming';
  var today = new Date().toISOString().slice(0, 10);
  var rows = Array.prototype.slice.call(bEl.querySelectorAll('.dp-track[data-date]'));
  if(!rows.length) return;
  if(!bEl._dpRelOrder) bEl._dpRelOrder = rows.slice();
  var up = rows.filter(function(r){ return (r.getAttribute('data-date') || '') > today; });
  up.sort(function(a, b){ return (a.getAttribute('data-date') || '').localeCompare(b.getAttribute('data-date') || ''); });
  bEl.querySelectorAll('#dpRelTabs .dp-rel-tab').forEach(function(t){
    var on = t.dataset.mode === mode;
    t.style.background = on ? 'var(--ink)' : 'rgba(255,255,255,0.05)';
    t.style.color = on ? 'var(--bg)' : 'var(--ink-dim)';
    t.style.borderColor = on ? 'var(--ink)' : 'var(--line)';
  });
  var snap = bEl._dpRelOrder;
  snap.forEach(function(r){ r.style.display = (!upcoming || up.indexOf(r) !== -1) ? '' : 'none'; });
  var finalOrder = upcoming ? up.concat(snap.filter(function(r){ return up.indexOf(r) === -1; })) : snap;
  finalOrder.forEach(function(r){ bEl.appendChild(r); });
  var emptyEl = document.getElementById('dpRelUpEmpty');
  if(emptyEl) bEl.appendChild(emptyEl);
  if(emptyEl) emptyEl.style.display = (upcoming && !up.length) ? 'block' : 'none';
  var sEl = document.getElementById('discPopupSub');
  if(sEl){
    if(bEl._dpRelSub === null || bEl._dpRelSub === undefined) bEl._dpRelSub = sEl.textContent || '';
    sEl.textContent = upcoming
      ? (up.length + ' upcoming release' + (up.length !== 1 ? 's' : '') + ' \\u00b7 soonest first')
      : bEl._dpRelSub;
  }
};

function openDiscoverPopup(title, bodyHTML, subtitle){`,
  '__scDiscRelTab switcher added'
);

// ------------------------------------------------ 4. version + changelog head
replaceOnce(
  `  const APP_VERSION = '60.5.9';`,
  `  const APP_VERSION = '60.5.10';`,
  'APP_VERSION → 60.5.10'
);

replaceOnce(
  `  { version: '60.5.9', date: 'September 23, 2026 · 7:58 AM EDT', title: 'Pinned-artist drops open on their own countdown page', items: [`,
  `  { version: '60.5.10', date: 'September 23, 2026 · 7:25 PM EDT', title: 'Fetch latest grows an "Upcoming releases" tab', items: [
    'The Fetch latest popup gains a second tab \\u2014 "Upcoming releases" \\u2014 beside the full list: every release your pinned artists have dated to drop, soonest first, with a count on the tab and how long is left on each row.',
    'Tap an upcoming row and it opens the release page: the cover, your artist photo, the countdown ticking down days hours minutes and seconds to the drop, Pre-save, Share and the tracklist preview \\u2014 the same page New releases and the bell open.',
    'A release already dated to drop now reads "drops Oct 3 \\u00b7 in 10d" in gold in the main list instead of printing the raw date twice, so something on the way never looks like it landed today.',
    'When nothing is on the way the tab says so \\u2014 "No upcoming releases yet \\u2014 pin an artist whose next drop is dated." \\u2014 instead of opening onto an empty screen, and the subtitle counts what the tab is showing.',
    'Both tabs and their rows are rebuilt and rewired every time the popup opens, so a reopen from its offline cache gets the tabs too, and an upcoming row tapped there opens the same release page.',
  ] },
  { version: '60.5.9', date: 'September 23, 2026 · 7:58 AM EDT', title: 'Pinned-artist drops open on their own countdown page', items: [`,
  'changelog head 60.5.10 (5 shared notes)'
);

fs.writeFileSync(FILE, src);
console.log(`patch-60510: ${n} replacements applied`);
