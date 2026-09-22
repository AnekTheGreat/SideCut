#!/usr/bin/env node
// v60.4.9 — two reported issues on 60.4.8:
//
// A. The exact-length bubble popped on EVERY tap, even when the time was
//    fully readable. Now it only appears when the line is genuinely cut off
//    (scrollWidth > clientWidth — the runtime sits at the END of both the
//    playlist header line and the album subtitle, so an ellipsis clamp always
//    means the time is the part hidden). Unclamped tap = nothing happens, and
//    the pointer cursor only shows on clamped lines (re-synced after render
//    and on resize).
//
// B. Remove the random markers next to songs: the orange "⚠ No audio" badge
//    (which showed even on songs that play fine — see Difference) and the
//    genre chips (.genre-tag, e.g. a "Pop" pill).
//
// C. Version 60.4.9 + changelog entry with the real EDT time (ICU).
//
// Idempotent: every replacement asserts its match count.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function edtNow() {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'long', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value || '';
  return `${g('month')} ${g('day')}, ${g('year')} · ${g('hour')}:${g('minute')} ${g('dayPeriod')} EDT`;
}

function rep(oldStr, newStr, label, expect = 1) {
  const count = src.split(oldStr).length - 1;
  if (count !== expect) {
    console.error(`FAIL [${label}] expected ${expect} match(es), found ${count}`);
    process.exit(1);
  }
  src = src.split(oldStr).join(newStr);
  n++;
  console.log(`ok   [${label}]`);
}

function dropLineContaining(needle, label) {
  const lines = src.split('\n');
  const idxs = lines.map((l, i) => (l.includes(needle) ? i : -1)).filter(i => i >= 0);
  if (idxs.length !== 1) {
    console.error(`FAIL [${label}] expected 1 line, found ${idxs.length}`);
    process.exit(1);
  }
  lines.splice(idxs[0], 1);
  src = lines.join('\n');
  n++;
  console.log(`ok   [${label}]`);
}

// ---- A1. Helper: isClamped / syncCursor / syncAll + resize re-sync ----
rep(
  `    // Tap anywhere that is not an anchor, or scroll, dismisses it.`,
  `    // The bubble is only for lines whose text is actually cut off. The runtime
    // sits at the END of both the playlist header line and the album subtitle,
    // so an ellipsis clamp always means the time is the part that got hidden.
    // No clamp -> the tap does nothing.
    function isClamped(el){
      return !!el && typeof el.scrollWidth === 'number' && el.scrollWidth > el.clientWidth + 1;
    }
    function syncCursor(el){
      if(el) el.style.cursor = isClamped(el) ? 'pointer' : '';
    }
    function syncAll(){
      var list = document.querySelectorAll('[data-dur-bubble]');
      for(var i = 0; i < list.length; i++) syncCursor(list[i]);
    }
    window.addEventListener('resize', syncAll);
    // Tap anywhere that is not an anchor, or scroll, dismisses it.`,
  'helper: clamp tools'
);

rep(
  `    return { toggle: toggle, hide: hide, fmtPrecise: fmtPrecise };`,
  `    return { toggle: toggle, hide: hide, fmtPrecise: fmtPrecise,
             isClamped: isClamped, syncCursor: syncCursor, syncAll: syncAll };`,
  'helper: exports'
);

// ---- A2. Playlist/album pane header: gate + cursor sync ----
rep(
  `      if(totalSeconds > 0){
        var _subEl = header.querySelector('.sub');
        if(_subEl){
          _subEl.setAttribute('data-dur-bubble', '1');
          _subEl.style.cursor = 'pointer';
          _subEl.addEventListener('click', function(ev){
            ev.stopPropagation();
            var _ctx = (libraryMode === 'albums') ? 'Albums' : activePlaylist;
            window.__scDurBubble.toggle(_subEl, totalSeconds,
              ids.length + ' track' + (ids.length === 1 ? '' : 's') + ' \\u00b7 ' + _ctx);
          });
        }
      }`,
  `      if(totalSeconds > 0){
        var _subEl = header.querySelector('.sub');
        if(_subEl){
          _subEl.setAttribute('data-dur-bubble', '1');
          // Pointer cursor only while the line is really cut off (re-checked as
          // fonts/layout settle and whenever the viewport changes).
          requestAnimationFrame(function(){ window.__scDurBubble.syncCursor(_subEl); });
          setTimeout(function(){ window.__scDurBubble.syncCursor(_subEl); }, 400);
          _subEl.addEventListener('click', function(ev){
            ev.stopPropagation();
            // Clamped lines only — a fully visible runtime needs no popup.
            if(!window.__scDurBubble.isClamped(_subEl)){ window.__scDurBubble.hide(); return; }
            var _ctx = (libraryMode === 'albums') ? 'Albums' : activePlaylist;
            window.__scDurBubble.toggle(_subEl, totalSeconds,
              ids.length + ' track' + (ids.length === 1 ? '' : 's') + ' \\u00b7 ' + _ctx);
          });
        }
      }`,
  'pane header: clamp gate'
);

// ---- A3. Album subtitle: drop the unconditional inline pointer cursor ----
rep(
  `text-overflow:ellipsis;' + (albTotalStr ? 'cursor:pointer;' : '') + '" ' + (albTotalStr ? 'data-dur-bubble="1" ' : '') + '>'`,
  `text-overflow:ellipsis;' + '" ' + (albTotalStr ? 'data-dur-bubble="1" ' : '') + '>'`,
  'album subtitle: no forced cursor'
);

// ---- A4. Album wire: gate + cursor sync (whole block, keeps braces balanced) ----
rep(
  `        if(_albDurEl) _albDurEl.addEventListener('click', function(ev){
          ev.stopPropagation(); // tapping the time must not expand/collapse the album
          window.__scDurBubble.toggle(_albDurEl, albTotalSec,
            alb.tracks.length + ' track' + (alb.tracks.length !== 1 ? 's' : '') + ' \\u00b7 ' + alb.name);
        });`,
  `        if(_albDurEl){
          // Pointer cursor only while the line is really cut off.
          requestAnimationFrame(function(){ window.__scDurBubble.syncCursor(_albDurEl); });
          setTimeout(function(){ window.__scDurBubble.syncCursor(_albDurEl); }, 400);
          _albDurEl.addEventListener('click', function(ev){
            ev.stopPropagation(); // tapping the time must not expand/collapse the album
            // Clamped lines only — a fully visible runtime needs no popup.
            if(!window.__scDurBubble.isClamped(_albDurEl)){ window.__scDurBubble.hide(); return; }
            window.__scDurBubble.toggle(_albDurEl, albTotalSec,
              alb.tracks.length + ' track' + (alb.tracks.length !== 1 ? 's' : '') + ' \\u00b7 ' + alb.name);
          });
        }`,
  'album wire: clamp gate'
);

// ---- B1. Remove the "⚠ No audio" badge (keep the plain duration column) ----
{
  const before = src;
  src = src.replace(/t\._noAudio \? '<span[^>]*>[^<]*No audio<\/span>' : /, '');
  if (src === before || !before.includes(`⚠ No audio`)) {
    console.error('FAIL [No audio badge] pattern not found');
    process.exit(1);
  }
  n++;
  console.log('ok   [No audio badge removed]');
}

// ---- B2. Remove the genre chip from song rows ----
dropLineContaining(`<div class="genre-tag">`, 'genre chip removed');

// ---- C. Version + changelog (real EDT time) ----
rep(
  `  const APP_VERSION = '60.4.8';`,
  `  const APP_VERSION = '60.4.9';`,
  'version'
);

rep(
  `  { version: '60.4.8', date: 'September 22, 2026 · 7:34 AM EDT',`,
  `  { version: '60.4.9', date: '${edtNow()}', title: 'Length popup only when the time is cut off · stray No audio and genre chips removed', items: [
    'The exact-length popup now only appears when the playlist or album time is actually cut off by an ellipsis \\u2014 if the full time fits on screen, tapping the line does nothing, and the pointer cursor only shows on lines that are really clamped.',
    'Removed the random markers that appeared next to songs: the orange "No audio" warning (it could show up on songs that play perfectly) and the genre chips.',
  ] },
  { version: '60.4.8', date: 'September 22, 2026 · 7:34 AM EDT',`,
  'changelog'
);

fs.writeFileSync(FILE, src);
console.log(`\\n${n} edits applied -> ${path.relative(ROOT, FILE)}`);
