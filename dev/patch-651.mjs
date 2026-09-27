#!/usr/bin/env node
// SideCut — "Upcoming releases / Check for drops keeps reopening the popup and
// does not look like it is checking anything".
//
// Two defects, both reproduced against the shipped build before this patch:
//
// 1. IT REOPENS. `__scRebuildReleaseLists` read the popup's open/closed state
//    BEFORE the check ran, and on every run where the release popup was open it
//    called the popup's own handler `fb.onclick()`. That handler ends in
//    `openDiscoverPopup(...)`, which sets `display:flex` unconditionally — so a
//    check you started and then closed by hand put the popup back on screen when
//    it finished. Worse, `__scDiscRelTab` re-armed `__scUpcomingAutofetch` on
//    every redraw of an empty Upcoming tab, and that autofetch ran the same
//    rebuild, so one tap could run the whole check more than once and each run
//    reopened the popup. Measured on the shipped file: two full checks per tap,
//    and the popup reopened 32 s into a run the user had already dismissed.
//    Fix: decide from the state read AFTER the check (closed stays closed), gate
//    the handler to a repaint with `__scReleaseRepaintOnly` (so one tap is one
//    pass over the artists), fire the tab's autofetch only from a genuine redraw
//    and never while a run is already in flight.
//
// 2. IT GIVES NO SIGN IT LOOKED. The empty-state sentence was written once, when
//    the panel was built: writing `textContent` onto the container after the CTA
//    buttons were wired would have taken the buttons with it, so the update was
//    deliberately skipped (`!emptyEl._scUpWired`) — which meant a finished check
//    left you reading the same frozen line, with nothing to show it had just run.
//    Fix: the sentence moves into its own `.sc-up-msg` child, and
//    `__scUpRefreshState(root)` rewrites it in place after every redraw, plus a
//    live "Reading the open catalogs… N/M" line while the run is going.
//
// The catalogs themselves are not the problem and are not touched: live probes
// show the MusicBrainz browse-by-id and the Wikidata pass leaving for every
// pinned artist, and the artists in the report genuinely have no dated future
// release in any open catalog yet. What changes is that the app now says so
// instead of looking dead.
//
//   node dev/patch-651.mjs
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

// ---------------------------------------------------------------- 1. rebuild
const OLD_REBUILD =
'  window.__scRebuildReleaseLists = async function(doFetch){\n' +
'    var popupOpen = false;\n' +
'    try{\n' +
"      var ov = document.getElementById('discPopupOverlay');\n" +
"      popupOpen = !!(ov && getComputedStyle(ov).display !== 'none');\n" +
'    }catch(_eOv){}\n' +
"    var tEl = document.getElementById('discPopupTitle');\n" +
"    var fb = document.getElementById('discoverFetchLatest');\n" +
"    var onReleasePopup = popupOpen && tEl && String(tEl.textContent || '').indexOf('New Releases') !== -1 && fb && fb.onclick;\n" +
'    if(onReleasePopup){ try{ await fb.onclick(); }catch(_eFb){} return; }\n' +
'    if(doFetch){ try{ await checkPinnedArtistReleases(); }catch(_eChk){} }\n' +
'    try{ renderNewReleases(); }catch(_e1){}\n' +
'    try{ renderHome(); }catch(_e2){}\n' +
'    try{ updateNotifBadge(); }catch(_e3){}\n' +
'    try{ scRepaintOpenReleasePanel(); }catch(_eR){}  // keeps the view you are on up to date\n' +
'  };';

const NEW_REBUILD =
'  window.__scRebuildReleaseLists = async function(doFetch){\n' +
'    if(doFetch){ try{ await checkPinnedArtistReleases(); }catch(_eChk){} }\n' +
"    // The popup's state is read AFTER the check, never before it. Deciding first\n" +
'    // meant a run that finished while you were somewhere else went on to redraw\n' +
'    // the release popup — and drawing it shows it — so a check you started and\n' +
'    // then closed came back on screen by itself. Closed stays closed now.\n' +
"    var tEl = document.getElementById('discPopupTitle');\n" +
"    var fb = document.getElementById('discoverFetchLatest');\n" +
'    var popupOpen = false;\n' +
'    try{\n' +
"      var ov = document.getElementById('discPopupOverlay');\n" +
"      popupOpen = !!(ov && getComputedStyle(ov).display !== 'none');\n" +
'    }catch(_eOv){}\n' +
"    var onReleasePopup = popupOpen && tEl && String(tEl.textContent || '').indexOf('New Releases') !== -1 && fb && fb.onclick;\n" +
'    if(onReleasePopup){\n' +
'      // Still open: redraw its rows from what the check just stored. The flag\n' +
'      // tells the handler this is a repaint — without it the handler asks for a\n' +
'      // second full check of every pinned artist, so one tap ran the whole thing\n' +
'      // twice and each pass reopened the popup.\n' +
'      try{ window.__scReleaseRepaintOnly = true; await fb.onclick(); }\n' +
'      catch(_eFb){}\n' +
'      finally{ window.__scReleaseRepaintOnly = false; }\n' +
'      try{ if(typeof window.__scUpRefreshState === \'function\') window.__scUpRefreshState(); }catch(_eUpS){}\n' +
'      return;\n' +
'    }\n' +
'    try{ renderNewReleases(); }catch(_e1){}\n' +
'    try{ renderHome(); }catch(_e2){}\n' +
'    try{ updateNotifBadge(); }catch(_e3){}\n' +
'    try{ scRepaintOpenReleasePanel(); }catch(_eR){}  // keeps the view you are on up to date\n' +
'  };';
sub('__scRebuildReleaseLists reads the popup state after the check', OLD_REBUILD, NEW_REBUILD,
  'window.__scReleaseRepaintOnly = true; await fb.onclick();');

// --------------------------------------------------- 2. Fetch latest handler
const OLD_FL =
"        this.textContent = '\u23f3 Checking...'; this.disabled = true;\n" +
'        try{ await checkPinnedArtistReleases(); }catch(e){}\n' +
"        this.textContent = '\ud83d\udd04 Fetch latest from pinned artists'; this.disabled = false;\n" +
'        renderPinnedArtists(); renderNewReleases();';

const NEW_FL =
'        var _repaintOnly = !!window.__scReleaseRepaintOnly;\n' +
'        window.__scReleaseRepaintOnly = false;\n' +
'        if(!_repaintOnly){\n' +
"          this.textContent = '\u23f3 Checking...'; this.disabled = true;\n" +
'          try{ await checkPinnedArtistReleases(); }catch(e){}\n' +
"          this.textContent = '\ud83d\udd04 Fetch latest from pinned artists'; this.disabled = false;\n" +
'          renderPinnedArtists(); renderNewReleases();\n' +
'        }';
sub('the Fetch latest handler checks only when not repainting', OLD_FL, NEW_FL,
  'var _repaintOnly = !!window.__scReleaseRepaintOnly;');

// --------------------------------------------------------- 3. wire the CTA
const OLD_WIRE =
'      if(!el || el._scUpWired) return;\n' +
'      el._scUpWired = true;\n' +
"      var wrap = document.createElement('div');";
const NEW_WIRE =
'      if(!el || el._scUpWired) return;\n' +
'      el._scUpWired = true;\n' +
'      // The sentence has to be its own node, so a later check can rewrite it\n' +
'      // without taking the buttons below it with it.\n' +
'      var _msg = document.createElement(\'div\');\n' +
"      _msg.className = 'sc-up-msg';\n" +
'      _msg.textContent = el.textContent || \'\';\n' +
'      el.textContent = \'\';\n' +
'      el.appendChild(_msg);\n' +
"      var wrap = document.createElement('div');";
sub('the empty state keeps its message in its own child', OLD_WIRE, NEW_WIRE,
  "_msg.className = 'sc-up-msg';");

// ---------------------------------------------- 4. __scUpRefreshState helper
const HELPER =
'  // Keep the empty Upcoming tab honest while it is open. The verdict line lives\n' +
'  // in its own child so it can be rewritten in place — writing textContent onto\n' +
'  // the container itself would take the two buttons with it, which is why the old\n' +
'  // line could only ever be set once, when the panel was built: a check that ran\n' +
'  // afterwards left you reading the same sentence, with nothing to show the check\n' +
'  // had happened at all.\n' +
'  //\n' +
'  // `root` may be the Discover popup body, the Home panel body, or omitted (the\n' +
'  // document). The live progress line is created on demand.\n' +
'  window.__scUpRefreshState = function(root){\n' +
'    try{\n' +
'      var scope = (root && root.querySelector) ? root : document;\n' +
"      var el = scope.querySelector('#dpRelUpEmpty');\n" +
'      if(!el) return;\n' +
"      var msg = el.querySelector('.sc-up-msg');\n" +
'      if(!msg){\n' +
"        msg = document.createElement('div');\n" +
"        msg.className = 'sc-up-msg';\n" +
'        Array.prototype.slice.call(el.childNodes).forEach(function(n){\n' +
"          if(n.nodeType === 1 && (n.className || '').indexOf('sc-up-') === 0) return;\n" +
'          if(n.nodeType === 3) el.removeChild(n);\n' +
'        });\n' +
'        el.insertBefore(msg, el.firstChild);\n' +
'      }\n' +
"      var want = (typeof window.__scUpcomingEmptyText === 'function') ? window.__scUpcomingEmptyText() : '';\n" +
"      if(want && msg.textContent !== want) msg.textContent = want;\n" +
"      var st = (typeof pinnedCheckState !== 'undefined' && pinnedCheckState) ? pinnedCheckState : null;\n" +
"      var bar = el.querySelector('.sc-up-run');\n" +
"      var txt = (st && st.active) ? ('Reading the open catalogs\u2026 ' + (st.done || 0) + '/' + (st.total || 0)) : '';\n" +
'      if(txt){\n' +
"        if(!bar){ bar = document.createElement('div'); bar.className = 'sc-up-run'; bar.style.cssText = 'font-size:11.5px;color:var(--gold);margin-top:8px;'; el.appendChild(bar); }\n" +
"        if(bar.textContent !== txt) bar.textContent = txt;\n" +
"        bar.style.display = '';\n" +
"      } else if(bar){ bar.style.display = 'none'; }\n" +
'    }catch(_eUpState){}\n' +
'  };\n';
sub('__scUpRefreshState helper added',
  '  window.__scWireUpcomingCta = function(el){',
  HELPER + '  window.__scWireUpcomingCta = function(el){',
  'window.__scUpRefreshState = function(root){');

// ------------------------------------- 5. the tab redraws the line in place
const OLD_EMPTYE =
'    // Keep the line current — but only while the buttons have not been wired\n' +
'    // into it yet: writing textContent after __scWireUpcomingCta ran would take\n' +
'    // the CTA buttons with it.\n' +
'    if(upcoming && !up.length && !emptyEl._scUpWired){\n' +
'      try{ emptyEl.textContent = window.__scUpcomingEmptyText(); }catch(_eEmpty){}\n' +
'    }';
const NEW_EMPTYE =
'    // Refresh the verdict line in place — it lives in its own child now, so this\n' +
'    // can run after the buttons are wired without taking them with it.\n' +
'    try{ if(typeof window.__scUpRefreshState === \'function\') window.__scUpRefreshState(root); }catch(_eUpSt){}';
sub('the tab refresh rewrites the empty-state line in place', OLD_EMPTYE, NEW_EMPTYE,
  'window.__scUpRefreshState(root); }catch(_eUpSt){}');

// ------------------------------------------------ 6. tab autofetch gating
const OLD_AUTO =
'  if(upcoming && !up.length){\n' +
"    try{ if(typeof window.__scUpcomingAutofetch === 'function') window.__scUpcomingAutofetch(); }catch(_eUpAuto){}\n" +
'  }';
const NEW_AUTO =
'  // The dates are looked up only when YOU tap the Upcoming tab. This block used to\n' +
'  // fire from inside the switcher itself, so every redraw re-armed it — and the\n' +
'  // redraw that follows a finished check re-armed it again, which is part of why a\n' +
'  // single tap felt like the popup kept reopening itself and re-checking.\n' +
'  if(upcoming && !up.length && window.__scUserTabTap && !window.__scReleaseRepaintOnly\n' +
"     && !(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState.active)){\n" +
"    try{ if(typeof window.__scUpcomingAutofetch === 'function') window.__scUpcomingAutofetch(root); }catch(_eUpAuto){}\n" +
'  }';
sub('the empty tab only autofetches on a real tab tap', OLD_AUTO, NEW_AUTO,
  'window.__scUserTabTap && !window.__scReleaseRepaintOnly\n');

// The two tab strips must mark a genuine tap, so the switcher can tell a tap
// apart from one of its own programmatic redraws.
sub('the popup tab strip marks a real tap',
  "        btn.addEventListener('click', function(){ window.__scDiscRelTab(btn.dataset.mode); });",
  "        btn.addEventListener('click', function(){ window.__scUserTabTap = true; try{ window.__scDiscRelTab(btn.dataset.mode); } finally { window.__scUserTabTap = false; } });",
  'window.__scUserTabTap = true; try{ window.__scDiscRelTab(btn.dataset.mode);');
sub('the Home panel tab strip marks a real tap',
  "              btn.addEventListener('click', function(){ window.__scDiscRelTab(btn.dataset.mode, body); });",
  "              btn.addEventListener('click', function(){ window.__scUserTabTap = true; try{ window.__scDiscRelTab(btn.dataset.mode, body); } finally { window.__scUserTabTap = false; } });",
  'window.__scUserTabTap = true; try{ window.__scDiscRelTab(btn.dataset.mode, body);');

const OLD_AUTOBUSY =
'  window.__scUpcomingAutofetch = async function(){\n' +
'    if(window.__scUpAutoBusy) return;';
const NEW_AUTOBUSY =
'  window.__scUpcomingAutofetch = async function(){\n' +
'    if(window.__scUpAutoBusy) return;\n' +
"    if(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState.active) return;";
sub('the autofetch never starts on top of a running check', OLD_AUTOBUSY, NEW_AUTOBUSY,
  "pinnedCheckState.active) return;\n    if(typeof isPremiumActive");

// ------------------------------------------- 7. live progress on the panel
// The ticker line stores a LITERAL backslash-u escape in index.html (it was
// written inside a quoted string there), so the needle must carry one too.
const OLD_TICK =
"          btn.textContent = 'Checking\\u2026 ' + pinnedCheckState.done + '/' + pinnedCheckState.total;";
const NEW_TICK =
"          btn.textContent = 'Checking\\u2026 ' + pinnedCheckState.done + '/' + pinnedCheckState.total;\n" +
"          try{ if(typeof window.__scUpRefreshState === 'function') window.__scUpRefreshState(); }catch(_eUpS){}";
sub('the progress ticker updates the open panel too', OLD_TICK, NEW_TICK,
  "pinnedCheckState.total;\n          try{ if(typeof window.__scUpRefreshState === 'function') window.__scUpRefreshState(); }catch(_eUpS){}");

const OLD_TAPTAIL =
"    finally{ try{ if(_tick) clearInterval(_tick); }catch(_eTc){} }\n" +
"    try{ if(btn){ btn.textContent = 'Check for drops'; btn.disabled = false; } }catch(_eB1){}\n" +
'  };';
const NEW_TAPTAIL =
"    finally{ try{ if(_tick) clearInterval(_tick); }catch(_eTc){} }\n" +
"    try{ if(btn){ btn.textContent = 'Check for drops'; btn.disabled = false; } }catch(_eB1){}\n" +
"    try{ if(typeof window.__scUpRefreshState === 'function') window.__scUpRefreshState(); }catch(_eUpR){}\n" +
'  };';
sub('the empty state is refreshed when the run ends', OLD_TAPTAIL, NEW_TAPTAIL,
  'window.__scUpRefreshState(); }catch(_eUpR){}');

fs.writeFileSync(FILE, src);
console.log('\npatch-651: ' + edits + ' index.html edit(s)');
