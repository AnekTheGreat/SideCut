#!/usr/bin/env node
// v60.5.10 follow-up: combine the new "Upcoming releases" tab with the Home
// bubble's New releases panel — the same two tabs (All releases / Upcoming
// releases) over the panel's own rows, same switcher, same empty state, same
// soonest-first order. The switcher generalizes from the popup body to any
// container (row selector, count line and trailing buttons all scoped to the
// root), the popup's strip guard becomes container-scoped so a hidden Home
// panel can never block it, and the Home rows gain data-date + gold drops
// labels to match the popup.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

if (src.includes('_dpRelRowSel')) {
  console.log('patch-60510b: already applied');
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

// ------------------------------------------------- 1. generalize the switcher
replaceOnce(
`window.__scDiscRelTab = function(mode){
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
};`,
`window.__scDiscRelTab = function(mode, root){
  root = root || document.getElementById('discPopupBody');
  if(!root) return;
  var upcoming = mode === 'upcoming';
  var today = new Date().toISOString().slice(0, 10);
  var rowSel = root._dpRelRowSel || '.dp-track[data-date]';
  var rows = Array.prototype.slice.call(root.querySelectorAll(rowSel));
  if(!rows.length) return;
  if(!root._dpRelOrder) root._dpRelOrder = rows.slice();
  var up = rows.filter(function(r){ return (r.getAttribute('data-date') || '') > today; });
  up.sort(function(a, b){ return (a.getAttribute('data-date') || '').localeCompare(b.getAttribute('data-date') || ''); });
  root.querySelectorAll('#dpRelTabs .dp-rel-tab').forEach(function(t){
    var on = t.dataset.mode === mode;
    t.style.background = on ? 'var(--ink)' : 'rgba(255,255,255,0.05)';
    t.style.color = on ? 'var(--bg)' : 'var(--ink-dim)';
    t.style.borderColor = on ? 'var(--ink)' : 'var(--line)';
  });
  var snap = root._dpRelOrder;
  snap.forEach(function(r){ r.style.display = (!upcoming || up.indexOf(r) !== -1) ? '' : 'none'; });
  var finalOrder = upcoming ? up.concat(snap.filter(function(r){ return up.indexOf(r) === -1; })) : snap;
  finalOrder.forEach(function(r){ root.appendChild(r); });
  // The Home bubble's Mark-all chip acts on the whole list, so it rides after
  // the rows and only shows while the whole list is showing.
  var mr = root.querySelector('#hbCtaMarkSeen');
  if(mr){ root.appendChild(mr); mr.style.display = upcoming ? 'none' : ''; }
  var emptyEl = root.querySelector('#dpRelUpEmpty');
  if(emptyEl){ root.appendChild(emptyEl); emptyEl.style.display = (upcoming && !up.length) ? 'block' : 'none'; }
  var sEl = root._dpRelSubEl;
  if(sEl === undefined) sEl = document.getElementById('discPopupSub');
  if(sEl){
    if(root._dpRelSub === null || root._dpRelSub === undefined) root._dpRelSub = sEl.textContent || '';
    sEl.textContent = upcoming
      ? (up.length + ' upcoming release' + (up.length !== 1 ? 's' : '') + ' \\u00b7 soonest first')
      : root._dpRelSub;
  }
};`,
  'switcher generalized to any container (root, row selector, scoped sub/empty/chip)'
);

// --------------------------------------------- 2. popup guard scoped to bEl
replaceOnce(
  `!document.getElementById('dpRelTabs')){`,
  `!bEl.querySelector('#dpRelTabs')){`,
  'popup strip guard scoped to its own body'
);

// ------------------------------------------- 3. Home rows carry data-date +
// gold drops labels (matching the popup), count line gets an id to swap into
replaceOnce(
`            return '<div class="hb-track-row" style="cursor:pointer;" data-release-title="' + escapeHtml(rel.title) + '" data-release-artist="' + escapeHtml(rel.artist) + '"><div class="hb-track-meta"><div class="hb-track-title">' + (rel.seen ? '' : '<span style="color:var(--coral); font-size:10px; font-weight:700; margin-right:6px;">NEW</span>') + escapeHtml(rel.title) + '</div><div class="hb-track-sub">' + escapeHtml(rel.artist) + (when ? ' · ' + when : '') + '</div></div></div>';`,
`            return '<div class="hb-track-row" style="cursor:pointer;" data-date="' + escapeHtml(String(rel.date || '').slice(0,10)) + '" data-release-title="' + escapeHtml(rel.title) + '" data-release-artist="' + escapeHtml(rel.artist) + '"><div class="hb-track-meta"><div class="hb-track-title">' + (rel.seen ? '' : '<span style="color:var(--coral); font-size:10px; font-weight:700; margin-right:6px;">NEW</span>') + escapeHtml(rel.title) + '</div><div class="hb-track-sub">' + escapeHtml(rel.artist) + (when ? ' · ' + (when.indexOf('drops ') === 0 ? '<span style="color:var(--gold); font-weight:600;">' + when + '</span>' : when) : '') + '</div></div></div>';`,
  'Home rows: data-date + gold drops label'
);

replaceOnce(
  `        body.innerHTML = '<div style="font-size:12px; color:var(--ink-dim); margin-bottom:8px;">' + all.length`,
  `        body.innerHTML = '<div id="hbRelCount" style="font-size:12px; color:var(--ink-dim); margin-bottom:8px;">' + all.length`,
  'Home count line gets #hbRelCount'
);

// --------------------------------------- 4. inject the tabs into the panel
replaceOnce(
`        if(_markSeenBtn && !_markSeenBtn.disabled) _markSeenBtn.addEventListener('click', () => { markReleasesSeen(); closeHomeBubble(); });
      }`,
`        if(_markSeenBtn && !_markSeenBtn.disabled) _markSeenBtn.addEventListener('click', () => { markReleasesSeen(); closeHomeBubble(); });
        // The same two tabs as the Fetch latest popup — All releases and
        // Upcoming releases — injected on every render (this panel's HTML is
        // rebuilt each open, never cached), over this panel's own rows.
        try{
          if(!body.querySelector('#dpRelTabs')){
            var _hbToday = new Date().toISOString().slice(0, 10);
            var _hbUpN = all.filter(function(r){ return String(r.date || '').slice(0,10) > _hbToday; }).length;
            body._dpRelOrder = null;
            body._dpRelSub = null;
            body._dpRelRowSel = '.hb-track-row[data-date]';
            body._dpRelSubEl = $('hbRelCount');
            var _hbTabs = document.createElement('div');
            _hbTabs.id = 'dpRelTabs';
            _hbTabs.style.cssText = 'display:flex; gap:6px; padding:0 0 10px 0;';
            _hbTabs.innerHTML = ['all:All releases', 'upcoming:Upcoming releases'].map(function(spec){
              var p = spec.split(':'); var _m = p[0]; var _l = p[1];
              var _b = (_m === 'upcoming' && _hbUpN) ? ' <span style="font-size:10px;font-weight:700;opacity:0.75;">' + _hbUpN + '</span>' : '';
              return '<button class="dp-rel-tab" data-mode="' + _m + '" style="flex:0 0 auto;padding:7px 13px;border-radius:999px;border:1px solid var(--line);font-size:12px;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.05);color:var(--ink-dim);">' + _l + _b + '</button>';
            }).join('');
            body.insertBefore(_hbTabs, body.firstChild);
            var _hbEmpty = document.createElement('div');
            _hbEmpty.id = 'dpRelUpEmpty';
            _hbEmpty.style.cssText = 'display:none; color:var(--ink-dim); font-size:13px; padding:14px 4px; text-align:center;';
            _hbEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';
            body.appendChild(_hbEmpty);
            _hbTabs.querySelectorAll('.dp-rel-tab').forEach(function(btn){
              btn.addEventListener('click', function(){ window.__scDiscRelTab(btn.dataset.mode, body); });
            });
            window.__scDiscRelTab('all', body);
          }
        }catch(_eHbRelTabs){ }
      }`,
  'tab strip injected into the Home New releases panel'
);

// ------------------------------------------------- 5. changelog note (6th)
replaceOnce(
  `    'Both tabs and their rows are rebuilt and rewired every time the popup opens, so a reopen from its offline cache gets the tabs too, and an upcoming row tapped there opens the same release page.',`,
  `    'Both tabs and their rows are rebuilt and rewired every time the popup opens, so a reopen from its offline cache gets the tabs too, and an upcoming row tapped there opens the same release page.',
    'The New releases panel on Home wears the same two tabs \\u2014 All releases and Upcoming releases \\u2014 over its own rows, soonest drop first, the same count badge and empty state, and gold drops labels to match; Mark all as read stays with the All tab, where it belongs.',`,
  'changelog: Home bubble carries the same tabs (6 notes)'
);

fs.writeFileSync(FILE, src);
console.log(`patch-60510b: ${n} replacements applied`);
