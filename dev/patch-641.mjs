#!/usr/bin/env node
// SideCut -- "Its better but still takes forever to load".
//
// 63.0.7 removed the biggest measured cost of startup (every version's rollback
// row read four times over: 174.2 MB -> 0.0 MB). It was not enough, and the
// honest reason is that what is left cannot be seen from a fast machine: the
// remaining startup cost is dominated by things that only exist on the phone --
// the WebView parsing this 2.4 MB page, blob-backed IndexedDB reads, image
// decoding, and the OTA client's own work. So this batch does two things:
//
//   [A] IT MEASURES THE PHONE. A boot stopwatch (started by a stamp BEFORE the
//       app's own script block, so the parse+compile of the page shows up as a
//       phase of its own) records every startup milestone with performance.now()
//       and keeps the last launch in localStorage. It is readable in one tap
//       from the notifications bell ("Startup · 1.9s · tap for the breakdown"),
//       logged to the console, and available as window.__scBootProfile(). The
//       next round of boot work is decided by THOSE numbers, not by a guess on a
//       desktop.
//
//   [B] REMOVES TWO MORE REAL COSTS that are certain regardless of the numbers:
//       * the list render no longer runs at boot AT ALL. It is the heaviest thing
//         the app assembles (a row and a cover per song), it is built for a
//         screen the app is not showing (Home), and opening Library builds it
//         anyway -- navigate('library') has always called renderList() itself.
//       * the restored song's loudness is no longer measured at startup. Auto
//         volume measured it by DECODING THE WHOLE SONG (scDecodeTrack) inside
//         the boot turn -- seconds of CPU and tens of megabytes of samples on a
//         phone, for a track that is restored PAUSED and may never be played.
//         The stored gain is still applied; a track that has never been measured
//         is measured on its next real play, exactly as before.
//       * the notification badge's duplicate scan moves to the first idle slice
//         (it walks the whole library and nothing on screen needs it in the same
//         frame as the Home paint).
//
//   node dev/patch-641.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('\u2022 ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The clock is stamped BEFORE the app's own script block exists, so the first
//    mark inside it measures exactly what a phone spends parsing and setting up
//    this page -- the one cost no desktop profiler can attribute honestly.
// ---------------------------------------------------------------------------
sub('a clock is stamped before the app script block is parsed',
  '<script src="dev/native-updates.js"></script>\n<script>',
  [
    '<script src="dev/native-updates.js"></script>',
    '<!-- Stamped before the app\'s own script block is even parsed, so the boot',
    '     stopwatch can report how long THIS page takes to parse and set up on',
    '     the device it is actually running on. -->',
    '<script>window.__scBootClock = (window.performance && performance.now) ? performance.now() : Date.now();</script>',
    '<script>',
  ].join('\n'),
  undefined, 'window.__scBootClock = (window.performance && performance.now)');

// ---------------------------------------------------------------------------
// 2. The stopwatch itself, defined immediately before the boot IIFE so its own
//    first mark lands at the end of all top-level set-up.
// ---------------------------------------------------------------------------
const STOPWATCH = [
  '  // ---- Boot stopwatch -------------------------------------------------------',
  '  // Startup is the one number that cannot be judged from a fast machine: on a',
  '  // phone it is dominated by the WebView parsing this page, blob-backed storage',
  '  // reads and image decoding. So the app times its own startup, every launch,',
  '  // and keeps the last one where the notifications panel can show it -- one tap,',
  '  // no test mode and no console needed. `window.__scBootProfile()` returns it.',
  '  var scBootT0 = (window.__scBootClock && typeof window.__scBootClock === \'number\') ? window.__scBootClock : null;',
  '  var scBootMarks = [];',
  '  var scBootLastList = null;',
  '  function scNow(){',
  '    try{ return (window.performance && performance.now) ? performance.now() : Date.now(); }catch(_e){ return Date.now(); }',
  '  }',
  '  function scBootT(label, note){',
  '    try{',
  '      if(scBootT0 === null) scBootT0 = scNow();',
  '      var at = Math.round(scNow() - scBootT0);',
  '      if(scBootMarks.length < 40) scBootMarks.push([String(label), at, note == null ? \'\' : String(note)]);',
  '      if(window.__scBootVerbose){ try{ console.log(\'[SideCut boot] \' + at + \'ms \\u00b7 \' + label + (note ? \' (\' + note + \')\' : \'\')); }catch(_c){} }',
  '    }catch(_e){ }',
  '  }',
  '  function scBootPersist(){',
  '    try{',
  '      localStorage.setItem(\'scBootProfile\', JSON.stringify({',
  '        version: String(window.APP_VERSION || \'\'),',
  '        at: Date.now(),',
  '        mobile: (typeof window !== \'undefined\' && window.Capacitor && window.Capacitor.isNativePlatform) ? !!window.Capacitor.isNativePlatform() : false,',
  '        marks: scBootMarks,',
  '        list: scBootLastList',
  '      }));',
  '    }catch(_e){ }',
  '  }',
  '  function scBootRead(){',
  '    try{ return JSON.parse(localStorage.getItem(\'scBootProfile\') || \'null\'); }catch(_e){ return null; }',
  '  }',
  '  window.__scBootProfile = scBootRead;',
  '  window.__scBootT = scBootT;',
  '',
  '  // ---------------- Boot: auto-load anything saved from before ----------------',
].join('\n');

sub('the boot stopwatch is defined just before boot runs',
  '  // ---------------- Boot: auto-load anything saved from before ----------------',
  STOPWATCH,
  undefined, 'var scBootMarks = [];');

// ---------------------------------------------------------------------------
// 3. Marks along the boot path.
// ---------------------------------------------------------------------------
sub('the end of top-level set-up is the first mark',
  "      if(window.__scMark) __scMark('starting up');",
  [
    "      scBootT('page ready: script parsed, compiled and set up');",
    "      if(window.__scMark) __scMark('starting up');",
  ].join('\n'),
  undefined, "scBootT('page ready: script parsed, compiled and set up');");

sub('the storage read of the library is timed on its own',
  [
    '    const [trackRows, metaRows] = await Promise.all([',
    '        dbGetAll(\'tracks\'),',
    '        scMetaSettingsRows()',
    '    ]);',
  ].join('\n'),
  [
    '    var _scReadT = scNow();',
    '    const [trackRows, metaRows] = await Promise.all([',
    '        dbGetAll(\'tracks\'),',
    '        scMetaSettingsRows()',
    '    ]);',
    '    scBootT(\'boot: library read from storage\', trackRows.length + \' songs, \' + Math.round(scNow() - _scReadT) + \' ms\');',
  ].join('\n'),
  undefined, "scBootT('boot: library read from storage'");

sub('boot marks: notification, theme, recovery',
  [
    '      await loadNotifReadState();',
    '      updateNotifBadge();',
    '      await loadSavedTheme();',
  ].join('\n'),
  [
    '      await loadNotifReadState();',
    '      scBootT(\'boot: notification state read\');',
    '      scRunWhenIdle(updateNotifBadge);',
    '      await loadSavedTheme();',
    '      scBootT(\'boot: settings + theme applied\');',
  ].join('\n'),
  undefined, 'scRunWhenIdle(updateNotifBadge);');

sub('boot marks: recovery check, library built, tabs, Home',
  [
    '      catch(e){ console.error(\'Snapshot restore failed\', e); }',
    '      let loaded = await loadFromDB();',
  ].join('\n'),
  [
    '      catch(e){ console.error(\'Snapshot restore failed\', e); }',
    '      scBootT(\'boot: recovery check done\');',
    '      let loaded = await loadFromDB();',
    '      scBootT(\'boot: library built\', loaded ? allTracks.length + \' tracks\' : \'empty\');',
  ].join('\n'),
  undefined, "scBootT('boot: library built',");

sub('boot marks: tabs rendered, and the list no longer built here',
  [
    '        renderTabs();',
    '        // The list is the heaviest thing boot builds -- a row and a cover per',
    '        // song -- and it is not the screen the app lands on (Home is). Building',
    '        // it on the first idle slice lets the shell and Home paint first;',
    '        // opening Library renders it for real anyway, because',
    '        // navigate(\'library\') calls renderList() itself.',
    '        scRunWhenIdle(function(){ renderList(); });',
  ].join('\n'),
  [
    '        renderTabs();',
    '        scBootT(\'boot: tabs rendered\');',
    '        // NOTE: the list is deliberately NOT built here any more. It is the',
    '        // heaviest thing the app assembles -- a row and a cover per song -- and',
    '        // it was being built for a screen the app is not showing: boot always',
    '        // lands on Home, and opening Library renders it for real anyway,',
    '        // because navigate(\'library\') has always called renderList() itself.',
    '        // Moving it to the first idle slice (63.0.7) stopped it blocking the',
    '        // paint; not building it at all stops it competing with the app the',
    '        // user is actually using (63.0.8). The list render is timed separately',
    '        // (see the mark in renderList below), so its cost still shows up.',
  ].join('\n'),
  undefined, 'the list is deliberately NOT built here any more');

sub('boot marks: Home on screen, background reads, done',
  [
    "      navigate(loaded ? 'home' : 'home');",
  ].join('\n'),
  [
    "      navigate(loaded ? 'home' : 'home');",
    "      scBootT('boot: Home on screen');",
  ].join('\n'),
  undefined, "scBootT('boot: Home on screen');");

sub('boot marks: background reads and boot done',
  [
    '        loadPinnedArtists().catch(function(e){ console.error(\'loadPinnedArtists failed\', e); })',
    '      ]);',
  ].join('\n'),
  [
    '        loadPinnedArtists().catch(function(e){ console.error(\'loadPinnedArtists failed\', e); })',
    '      ]);',
    "      scBootT('boot: enrich state + pinned artists read');",
  ].join('\n'),
  undefined, "scBootT('boot: enrich state + pinned artists read');");

sub('the whole boot is closed out with a mark and a saved profile',
  [
    "      if(loaded) setTimeout(() => { try{ scLyricsRecheckRun(); }catch(e){ console.error('lyrics re-check failed', e); } }, 20000);",
    '      if(window.__scMarkDone) __scMarkDone();',
  ].join('\n'),
  [
    "      if(loaded) setTimeout(() => { try{ scLyricsRecheckRun(); }catch(e){ console.error('lyrics re-check failed', e); } }, 20000);",
    "      scBootT('boot: DONE (everything startup does)', allTracks.length + ' tracks');",
    '      scBootPersist();',
    "      try{ console.log('[SideCut] startup: ' + (scBootMarks.length ? scBootMarks[scBootMarks.length - 1][1] : 0) + ' ms' + (scBootLastList ? ' (list ' + scBootLastList + ')' : '') + ' — open the bell for the breakdown.'); }catch(_bc){}",
    '      if(window.__scMarkDone) __scMarkDone();',
  ].join('\n'),
  undefined, "scBootT('boot: DONE (everything startup does)'");

// ---------------------------------------------------------------------------
// 4. The first list render is timed wherever it happens (Library, a refetch, a
//    search) -- it is the heaviest thing the app builds and it is no longer the
//    boot's business, so it needs its own row.
// ---------------------------------------------------------------------------
sub('the first list render is timed on its own',
  [
    '      _renderListRAF = null;',
    '      if(!_renderListPending) return;',
    '      _renderListPending = false;',
    '      try{ renderListInner(); }',
    '      catch(e){',
    "        console.error('renderList failed', e);",
    '      }',
  ].join('\n'),
  [
    '      _renderListRAF = null;',
    '      if(!_renderListPending) return;',
    '      _renderListPending = false;',
    '      try{',
    '        var _scListT = scNow();',
    '        renderListInner();',
    '        if(!window.__scListTimed){',
    '          window.__scListTimed = true;',
    '          var _scPane = document.getElementById(\'listPane\');',
    '          scBootLastList = Math.round(scNow() - _scListT) + \' ms, \' + (_scPane ? _scPane.children.length : 0) + \' rows\';',
    '          scBootT(\'list: first render (opening Library, not boot)\', scBootLastList);',
    '          scBootPersist();',
    '        }',
    '      }',
    '      catch(e){',
    "        console.error('renderList failed', e);",
    '      }',
  ].join('\n'),
  undefined, "scBootT('list: first render (opening Library, not boot)'");

// ---------------------------------------------------------------------------
// 5. The restored song is not measured at startup. Auto volume measures loudness
//    by decoding the ENTIRE song; doing that in the boot turn, for a track that
//    is restored paused, was seconds of work the user never asked for.
// ---------------------------------------------------------------------------
sub('loudness is not measured for a song that is merely restored',
  [
    '  function applyNormalizedGain(t, audioIdx){',
  ].join('\n'),
  [
    '  function applyNormalizedGain(t, audioIdx, opts){',
  ].join('\n'),
  undefined, 'function applyNormalizedGain(t, audioIdx, opts){');

sub('the measurement itself is skipped when the caller says so',
  [
    '    if(t.gain == null){',
    '      if(document.hidden) return; // measured on the next play instead',
  ].join('\n'),
  [
    '    if(t.gain == null){',
    '      // A restore is not a play. Measuring loudness here decodes the whole song',
    '      // (scDecodeTrack) -- seconds of CPU and tens of MB of samples on a phone --',
    '      // at startup, for a track that is restored PAUSED and may never be played.',
    '      // The gain already stored is still applied; an unmeasured track is measured',
    '      // on its next real play, exactly as before.',
    '      if(opts && opts.skipMeasure) return;',
    '      if(document.hidden) return; // measured on the next play instead',
  ].join('\n'),
  undefined, 'if(opts && opts.skipMeasure) return;');

sub('the boot restore asks for the measurement to be skipped',
  '    applyNormalizedGain(track, activeIdx); applyEQ(track, activeIdx);',
  '    applyNormalizedGain(track, activeIdx, { skipMeasure: true }); applyEQ(track, activeIdx);',
  undefined, 'applyNormalizedGain(track, activeIdx, { skipMeasure: true });');

// Repair for the intermediate state an earlier run of this patch left behind: it
// bracketed that catch with a second '}' (the try's own brace is on the line
// above). Tolerant on purpose -- silent when there is nothing to repair, which is
// the case on a clean tree.
if (src.indexOf("      }catch(e){ console.error('Snapshot restore failed', e); }") !== -1) {
  src = src.split("      }catch(e){ console.error('Snapshot restore failed', e); }").join("      catch(e){ console.error('Snapshot restore failed', e); }");
  done('the recovery-check try/catch is closed exactly once');
}

// ---------------------------------------------------------------------------
// 6. The startup profile is readable from the notification bell: one line, and
//    a tap opens the phase table.
// ---------------------------------------------------------------------------
const NOTIF_HTML = [
  '  function bootProfileNotifHtml(){',
  '    const p = scBootRead();',
  '    if(!p || !p.marks || !p.marks.length) return \'\';',
  '    const total = p.marks[p.marks.length - 1][1] || 0;',
  '    const when = p.at ? new Date(p.at).toLocaleString() : \'\';',
  '    const rows = p.marks.map(function(m, i){',
  '      const d = i ? (m[1] - p.marks[i - 1][1]) : m[1];',
  '      return \'<div style="display:flex; gap:8px; font-size:11px; color:var(--ink-dim); line-height:1.55;">\'',
  '        + \'<span style="min-width:64px; text-align:right; flex-shrink:0; font-variant-numeric:tabular-nums;">+\' + m[1] + \'ms</span>\'',
  '        + \'<span style="color:var(--ink); min-width:44px; flex-shrink:0; font-variant-numeric:tabular-nums;">+\' + d + \'ms</span>\'',
  '        + \'<span>\' + escapeHtml(m[0]) + (m[2] ? \' <span style="opacity:.75;">· \' + escapeHtml(m[2]) + \'</span>\' : \'\') + \'</span>\'',
  '        + \'</div>\';',
  '    }).join(\'\');',
  '    return \'<div id="notifBootEntry" style="border-bottom:1px solid var(--line); padding-bottom:10px; cursor:pointer;">\'',
  '      + \'<div style="font-weight:600; font-size:13.5px; margin-bottom:6px;">\\u23f1 Startup \\u2014 \' + (total / 1000).toFixed(1) + \'s</div>\'',
  '      + \'<div style="font-size:12px; color:var(--ink-dim);">Last launch\' + (when ? \' · \' + escapeHtml(when) : \'\')',
  '      + (p.list ? \' · library list \' + escapeHtml(String(p.list)) : \'\')',
  '      + (p.mobile ? \' · on this phone\' : \'\') + \'. Tap for the step-by-step breakdown.</div>\'',
  '      + \'<div id="notifBootDetail" style="display:none; margin-top:8px; border-top:1px dashed var(--line); padding-top:8px;">\' + rows + \'</div>\'',
  '      + \'</div>\';',
  '  }',
].join('\n');

sub('the startup profile is rendered in the notifications panel',
  '  function renderNotifPanel(){',
  NOTIF_HTML + '\n  function renderNotifPanel(){',
  undefined, 'function bootProfileNotifHtml(){');

sub('the startup row is part of the panel body',
  "    summary.innerHTML = summaryHtml;\n    body.innerHTML = html;",
  "    html += bootProfileNotifHtml();\n    summary.innerHTML = summaryHtml;\n    body.innerHTML = html;",
  undefined, 'html += bootProfileNotifHtml();');

sub('tapping the startup row opens the phase breakdown',
  [
    "    const dupEntry = document.getElementById('notifDupEntry');",
  ].join('\n'),
  [
    '    const bootEntry = document.getElementById(\'notifBootEntry\');',
    '    if(bootEntry) bootEntry.addEventListener(\'click\', () => {',
    '      const det = document.getElementById(\'notifBootDetail\');',
    '      if(det) det.style.display = det.style.display === \'none\' ? \'block\' : \'none\';',
    '    });',
    "    const dupEntry = document.getElementById('notifDupEntry');",
  ].join('\n'),
  undefined, "const bootEntry = document.getElementById('notifBootEntry');");

fs.writeFileSync(FILE, src);
console.log('\n' + edits + ' edit' + (edits === 1 ? '' : 's') + ' applied to index.html');
