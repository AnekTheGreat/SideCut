#!/usr/bin/env node
// SideCut - 63.1.3: the check updates the panel it is in and shows a progress
// bar, instead of rebuilding the whole popup once per artist.
//
// The follow-up report, in the user's words: "it keeps reopening the same new
// releases popup for every artist instaid of just showing a progress bar inside
// of the what's new popup".
//
// The cause is `checkPinnedArtistReleases`. It saves and repaints AS EACH ARTIST
// LANDS (deliberately - a partly-finished run keeps what it found), and that
// repaint is `scRepaintOpenReleasePanel()`, which calls
// `openHomeBubble('newreleases')`. `openHomeBubble` writes `body.innerHTML`
// from scratch: the header, the count, the mark-all button, every row and the
// All/Upcoming tab strip are all re-created. Measured on the shipped build with
// 4 pinned artists: THREE full panel rebuilds during one check, and no progress
// indicator anywhere.
//
// The fix is to repaint only what changed:
//   * a new `window.__scHbPaintRelRows(host)` rebuilds the release ROWS in place
//     - keeping the nodes that are still wanted (and their listeners), removing
//     the ones that are gone, adding the new ones, and updating the count line;
//   * `scRepaintOpenReleasePanel` calls that, so the panel keeps its scroll
//     position and the tab you picked, rather than being replaced;
//   * `__scUpRefreshState` grows a real progress BAR (`#scRelProgress`) that
//     shows while a check is running, on whichever release surface is open.
//
//   node dev/patch-655.mjs
//
// Idempotent: a rerun reports 0 edits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

function sub(label, oldStr, newStr, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== 1) throw new Error(label + ': found ' + got + ' occurrence(s), want 1');
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ------------------------------------------ 1. the in-place row painter
const PAINTER =
'  // Repaint ONLY the release rows of an open New-releases panel.\n' +
'  //\n' +
'  // A check saves and repaints as each artist lands, on purpose: a partly\n' +
'  // finished run keeps whatever it already found. That repaint used to be a full\n' +
'  // openHomeBubble("newreleases"), which writes the body from scratch - so the\n' +
'  // header, the count, the mark-all button, every row and the All/Upcoming strip\n' +
'  // were all re-created once per artist, and the panel visibly rebuilt itself\n' +
'  // over and over while the check ran. This rewrites the rows and the count and\n' +
'  // leaves everything else exactly where the user left it (including the tab).\n' +
'  window.__scHbRelRowInner = function(rel){\n' +
'    var r = Object.assign({}, rel, { date: window.__scDay10(rel.date) });\n' +
'    var daysAgo = r.date ? Math.floor((Date.now() - new Date(r.date + \'T00:00:00Z\').getTime())/86400000) : null;\n' +
'    var relAt = (typeof window.__scTime12 === \'function\' && window.__scTime12(r.time)) ? \' at \' + window.__scTime12(r.time) : \'\';\n' +
'    var relAtUp = relAt || \' at time TBA\';\n' +
'    var daysUntil = r.date ? Math.ceil((new Date(r.date + \'T00:00:00Z\').getTime() - Date.now())/86400000) : null;\n' +
'    var when = daysAgo == null ? \'\' : daysAgo < 0\n' +
'      ? \'drops \' + new Date(r.date + \'T00:00:00Z\').toLocaleDateString(undefined, { month: \'short\', day: \'numeric\' }) + relAtUp + (daysUntil && daysUntil <= 120 ? \' \u00b7 in \' + daysUntil + \'d\' : \'\')\n' +
'      : daysAgo === 0 ? \'today\' : daysAgo === 1 ? \'yesterday\' : daysAgo + \'d ago\';\n' +
'    var sub = escapeHtml(r.artist) + (when ? \' \u00b7 \' + (when.indexOf(\'drops \') === 0 ? \'<span style="color:var(--gold); font-weight:600;">\' + when + \'</span>\' : when) : \'\');\n' +
'    return \'<div class="hb-track-meta"><div class="hb-track-title">\'\n' +
'      + (r.seen ? \'\' : \'<span style="color:var(--coral); font-size:10px; font-weight:700; margin-right:6px;">NEW</span>\')\n' +
'      + escapeHtml(r.title) + \'</div><div class="hb-track-sub">\' + sub + \'</div></div>\';\n' +
'  };\n' +
'  window.__scHbPaintRelRows = function(host){\n' +
'    if(!host) return;\n' +
'    var all = [];\n' +
'    try{\n' +
'      Object.keys(pinnedReleases).forEach(function(artist){\n' +
'        (pinnedReleases[artist] || []).forEach(function(rel){\n' +
'          if(!window.__scJunkTitle(rel.title)) all.push(Object.assign({}, rel, { artist: artist }));\n' +
'        });\n' +
'      });\n' +
'    }catch(_eAll){}\n' +
'    all.sort(function(a, b){ return String(b.date || \'\').localeCompare(String(a.date || \'\')); });\n' +
'    var keyOf = function(r){ return String(r.artist) + \'\\u0001\' + String(r.title); };\n' +
'    var want = {};\n' +
'    all.forEach(function(r){ want[keyOf(r)] = r; });\n' +
'    // Drop rows whose release is gone (a long-press removal, a refetch).\n' +
'    Array.prototype.slice.call(host.querySelectorAll(\'.hb-track-row[data-hb-rel]\')).forEach(function(row){\n' +
'      if(!want[row.getAttribute(\'data-hb-rel\')]) row.remove();\n' +
'    });\n' +
'    var have = {};\n' +
'    Array.prototype.slice.call(host.querySelectorAll(\'.hb-track-row[data-hb-rel]\')).forEach(function(row){\n' +
'      have[row.getAttribute(\'data-hb-rel\')] = row;\n' +
'    });\n' +
'    var wire = function(row){\n' +
'      if(row._hbRelWired) return;\n' +
'      row._hbRelWired = true;\n' +
'      row.addEventListener(\'click\', function(){\n' +
'        openReleasePage(row.dataset.releaseArtist || \'\', row.dataset.releaseTitle || \'\');\n' +
'      });\n' +
'    };\n' +
'    all.forEach(function(r){\n' +
'      var k = keyOf(r);\n' +
'      var inner = window.__scHbRelRowInner(r);\n' +
'      var row = have[k];\n' +
'      if(row){\n' +
'        // Keep the node (and its listener); refresh only what it shows.\n' +
'        if(row._hbRelSig !== inner){ row.innerHTML = inner; row._hbRelSig = inner; }\n' +
'      } else {\n' +
'        row = document.createElement(\'div\');\n' +
'        row.className = \'hb-track-row\';\n' +
'        row.style.cursor = \'pointer\';\n' +
'        row.setAttribute(\'data-hb-rel\', k);\n' +
'        row.setAttribute(\'data-release-title\', r.title || \'\');\n' +
'        row.setAttribute(\'data-release-artist\', r.artist || \'\');\n' +
'        row.setAttribute(\'data-date\', String(r.date || \'\').slice(0, 10));\n' +
'        row.innerHTML = window.__scHbRelRowInner(r);\n' +
'        row._hbRelSig = row.innerHTML;\n' +
'        host.appendChild(row);\n' +
'      }\n' +
'      wire(row);\n' +
'    });\n' +
'    // Keep the count line (and the tab strip\'s remembered label) current.\n' +
'    var unseenCount = all.filter(function(r){ return !r.seen; }).length;\n' +
'    var countTxt = all.length + \' recent release\' + (all.length > 1 ? \'s\' : \'\') + (unseenCount ? \' \u00b7 \' + unseenCount + \' new\' : \'\');\n' +
'    var countEl = host.querySelector(\'#hbRelCount\');\n' +
'    if(countEl && countEl.textContent !== countTxt) countEl.textContent = countTxt;\n' +
'    host._dpRelSub = countTxt;\n' +
'    var mark = host.querySelector(\'#hbCtaMarkSeen\');\n' +
'    if(mark){\n' +
'      mark.disabled = !unseenCount;\n' +
'      mark.innerHTML = \'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>\'\n' +
'        + (unseenCount ? \'Mark all \' + unseenCount + \' as read\' : \'All caught up\');\n' +
'    }\n' +
'    // New rows land at the end, so re-run the tab filter over the whole set.\n' +
'    try{\n' +
'      if(host.querySelector(\'#dpRelTabs\')){\n' +
'        host._dpRelOrder = null;\n' +
'        if(typeof window.__scDiscRelTab === \'function\') window.__scDiscRelTab(window.__scRelTabMode || \'all\', host);\n' +
'      }\n' +
'    }catch(_eTab){}\n' +
'    try{ if(typeof window.__scUpRefreshState === \'function\') window.__scUpRefreshState(host); }catch(_eSt){}\n' +
'  };\n';

sub('the in-place release-row painter',
  '  function openHomeBubble(kind){\n' +
  "    const overlay = $('homeBubbleOverlay');",
  PAINTER + '  function openHomeBubble(kind){\n' +
  "    const overlay = $('homeBubbleOverlay');",
  'window.__scHbPaintRelRows = function(host){');

// ------------------------------------- 2. panel initial render uses it
// The block is located by anchor rather than embedded, because it carries a
// non-ASCII middle dot that is easy to mangle in a patch needle.
{
  const label = 'the panel builds its rows through the shared painter';
  const MARK = '        window.__scHbPaintRelRows(body);';
  if (src.indexOf(MARK) !== -1) skip(label);
  else {
    const start = src.indexOf('        body.innerHTML = \'<div id="hbRelCount"');
    const endAnchor = "        var _markSeenBtn = $('hbCtaMarkSeen');";
    const end = src.indexOf(endAnchor, start);
    if (start === -1 || end === -1) throw new Error(label + ': anchors not found');
    const block = src.slice(start, end);
    // Cut the inline row builder off the innerHTML expression: it now ends at
    // the mark-all button, and the rows come from the shared painter.
    const cut = block.indexOf("            + '</button>' +");
    if (cut === -1) throw new Error(label + ': could not find the row-builder tail');
    const head = block.slice(0, cut) + "            + '</button>';\n" +
      '        // The rows are painted by the shared in-place painter, so the panel a\n' +
      '        // running check refreshes and the panel opened from scratch are built\n' +
      '        // by exactly the same code (and neither re-creates the header).\n' +
      '        window.__scHbPaintRelRows(body);\n';
    src = src.slice(0, start) + head + src.slice(end);
    done(label);
  }
}

// ------------------------- 3. the per-artist repaint stops rebuilding the panel
const OLD_REPAINT =
'  function scRepaintOpenReleasePanel(){\n' +
'    try{\n' +
"      var overlay = document.getElementById('homeBubbleOverlay');\n" +
"      if(!overlay || !overlay.classList.contains('open')) return;   // popup path repaints itself\n" +
"      var tEl = document.getElementById('hbPanelTitle');\n" +
"      if(!tEl || String(tEl.textContent || '').indexOf('New releases') !== 0) return;\n" +
"      var panel = document.getElementById('homeBubblePanel');\n" +
"      if(panel) panel.style.animation = 'none';\n" +
"      try{ if(typeof openHomeBubble === 'function') openHomeBubble('newreleases'); }\n" +
"      finally{ if(panel) panel.style.animation = ''; }\n" +
'    }catch(_eRp){}\n' +
'  }';
const NEW_REPAINT =
'  // Called once per artist as a check lands, so it must NOT rebuild the panel:\n' +
'  // openHomeBubble re-creates the header, the buttons, every row and the\n' +
'  // All/Upcoming strip, which made a 4-artist check rebuild the whole panel four\n' +
'  // times and threw away the scroll position and the tab the user had picked.\n' +
'  // This updates the rows in place and moves on.\n' +
'  function scRepaintOpenReleasePanel(){\n' +
'    try{\n' +
"      var overlay = document.getElementById('homeBubbleOverlay');\n" +
"      if(!overlay || !overlay.classList.contains('open')) return;   // popup path repaints itself\n" +
"      var tEl = document.getElementById('hbPanelTitle');\n" +
"      if(!tEl || String(tEl.textContent || '').indexOf('New releases') !== 0) return;\n" +
"      var host = document.getElementById('hbPanelBody');\n" +
"      if(typeof window.__scHbPaintRelRows === 'function'){ window.__scHbPaintRelRows(host); return; }\n" +
'      // Fallback for an older shell: the full rebuild, animation suppressed.\n' +
"      var panel = document.getElementById('homeBubblePanel');\n" +
"      if(panel) panel.style.animation = 'none';\n" +
"      try{ if(typeof openHomeBubble === 'function') openHomeBubble('newreleases'); }\n" +
"      finally{ if(panel) panel.style.animation = ''; }\n" +
'    }catch(_eRp){}\n' +
'  }';
sub('the per-artist repaint updates rows in place', OLD_REPAINT, NEW_REPAINT,
  'if(typeof window.__scHbPaintRelRows === \'function\'){ window.__scHbPaintRelRows(host); return; }');

// --------------------------------------------- 4. a real progress bar
// Anchored: the surrounding block carries the real (non-ASCII) ellipsis, and a
// JS \u2026 escape in a needle would not match the literal in the file.
{
  const label = 'the release surfaces show a progress bar while a check runs';
  const MARK = "prog.id = 'scRelProgress';";
  if (src.indexOf(MARK) !== -1) skip(label);
  else {
    const anchor = "      } else if(bar){ bar.style.display = 'none'; }";
    const at = src.indexOf(anchor, src.indexOf("var bar = el.querySelector('.sc-up-run');"));
    if (at === -1) throw new Error(label + ': anchor not found');
    const add =
      anchor + '\n' +
'      // A progress BAR at the top of the panel, independent of which tab is\n' +
'      // showing - on "All releases" the empty state is hidden, so the line above\n' +
'      // was invisible exactly while the check was running. It is removed when the\n' +
'      // run ends, so the panel goes back to being a plain list.\n' +
'      var scopeEl = (scope === document) ? null : scope;\n' +
'      var progHost = scopeEl || el.parentNode || el;\n' +
'      var prog = progHost.querySelector ? progHost.querySelector(\'#scRelProgress\') : null;\n' +
'      var total = (st && st.total) || 0;\n' +
'      var doneN = (st && st.done) || 0;\n' +
'      if(st && st.active && total > 0){\n' +
'        var pct = Math.max(4, Math.round((doneN / total) * 100));\n' +
'        if(!prog){\n' +
'          prog = document.createElement(\'div\');\n' +
'          prog.id = \'scRelProgress\';\n' +
'          prog.style.cssText = \'padding:2px 0 10px 0;\';\n' +
'          if(progHost.insertBefore) progHost.insertBefore(prog, progHost.firstChild);\n' +
'        }\n' +
'        prog.innerHTML = \'<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--gold);margin-bottom:5px;font-weight:600;"><span>Looking for upcoming releases\u2026</span><span>\'\n' +
'          + doneN + \'/\' + total + \'</span></div>\'\n' +
'          + \'<div style="height:4px;background:rgba(255,255,255,0.12);border-radius:999px;overflow:hidden;"><div style="height:100%;width:\' + pct + \'%;background:var(--gold);border-radius:999px;transition:width 0.3s ease;"></div></div>\';\n' +
'      } else if(prog){ prog.remove(); }';
    src = src.slice(0, at) + add + src.slice(at + anchor.length);
    done(label);
  }
}

// Scope has to be callable for the progress host lookup; make `root` optional
// and resolve every open release surface when it is not given.
const OLD_SCOPE =
'  window.__scUpRefreshState = function(root){\n' +
'    try{\n' +
'      var scope = (root && root.querySelector) ? root : document;\n' +
'      var el = scope.querySelector(\'#dpRelUpEmpty\');\n' +
'      if(!el) return;';
const NEW_SCOPE =
'  window.__scUpRefreshState = function(root){\n' +
'    try{\n' +
'      // Called with a root while a redraw is already in flight, and without one\n' +
'      // from the progress ticker. With no root, update EVERY open release surface\n' +
'      // (the Fetch latest popup and the Home panel), so the bar shows on whichever\n' +
'      // one the user is actually looking at instead of on a hidden one.\n' +
'      if(!root){\n' +
'        var _surfaces = [];\n' +
'        [\'discPopupBody\', \'hbPanelBody\'].forEach(function(id){\n' +
'          var n = document.getElementById(id);\n' +
'          if(n && n.querySelector && n.querySelector(\'#dpRelUpEmpty\')) _surfaces.push(n);\n' +
'        });\n' +
'        if(!_surfaces.length) return;\n' +
'        _surfaces.forEach(function(n){ window.__scUpRefreshState(n); });\n' +
'        return;\n' +
'      }\n' +
'      var scope = (root && root.querySelector) ? root : document;\n' +
'      var el = scope.querySelector(\'#dpRelUpEmpty\');\n' +
'      if(!el) return;';
sub('the refresh helper can target every open release surface', OLD_SCOPE, NEW_SCOPE,
  'var _surfaces = [];');

fs.writeFileSync(FILE, src);
console.log('\npatch-655: ' + edits + ' index.html edit(s)');
