#!/usr/bin/env node
// v60.4.8 — the playlist/album runtime line clamps with an ellipsis on narrow
// screens ("238 tracks · 12h ..."), so the total length was unreadable.
//
// Fix: tapping the line pops the exact total in a bubble styled like the media
// player's song-name bubble, floating above the line (below it when there is no
// room), auto-hiding after 4s.
//
//   1. CSS: .dur-bubble (fixed-position clone of .name-bubble)
//   2. window.__scDurBubble helper: format, position, toggle, dismiss
//   3. Playlist/album pane header ".sub" wire-up (renderList)
//   4. Album card subtitle wire-up (tap must NOT expand/collapse the card)
//   5. Version 60.4.8 + changelog entry with the real EDT time
//
// Idempotent: every replacement asserts it matched exactly once.
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

function rep(oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error(`FAIL [${label}] expected 1 match, found ${count}`);
    process.exit(1);
  }
  src = src.replace(oldStr, newStr);
  n++;
  console.log(`ok   [${label}]`);
}

// ---- 1. CSS: bubble styled exactly like the media player's name bubble ----
rep(
  `  .name-bubble .ba{ font-size:12px; color:var(--ink-dim); margin-top:3px; word-break:break-word; }`,
  `  .name-bubble .ba{ font-size:12px; color:var(--ink-dim); margin-top:3px; word-break:break-word; }
  /* Exact-runtime bubble: appears when a clamped playlist/album time is tapped.
     Fixed-positioned so it can float above the header line wherever the row sits,
     same look as .name-bubble above the media player. */
  .dur-bubble{
    position:fixed; display:none; min-width:150px; max-width:min(300px, calc(100vw - 24px));
    background:var(--bg-raised); border:1px solid var(--line); border-radius:12px; padding:10px 14px;
    box-shadow:0 8px 24px rgba(0,0,0,0.45); z-index:80;
  }
  .dur-bubble::after{
    content:''; position:absolute; bottom:-7px; left:18px; width:12px; height:12px;
    background:var(--bg-raised); border-right:1px solid var(--line); border-bottom:1px solid var(--line);
    transform:rotate(45deg);
  }
  .dur-bubble.below::after{ bottom:auto; top:-7px; transform:rotate(225deg); }
  .dur-bubble .bt{ font-size:15px; font-weight:600; line-height:1.3; font-family:'JetBrains Mono',monospace; white-space:nowrap; }
  .dur-bubble .ba{ font-size:12px; color:var(--ink-dim); margin-top:3px; word-break:break-word; }`,
  'css'
);

// ---- 2. Helper, right after the existing name-bubble dismiss listener ----
rep(
  `  document.addEventListener('click', (e) => {
    if(!e.target.closest('#npInfo')) $('nameBubble').style.display = 'none';
  });`,
  `  document.addEventListener('click', (e) => {
    if(!e.target.closest('#npInfo')) $('nameBubble').style.display = 'none';
  });
  // ---------------- Tap a clamped playlist/album runtime for the exact total ----------------
  // The pane header and album cards squash the runtime with an ellipsis on narrow
  // screens ("238 tracks \u00b7 12h ..."), so the full length was unreadable.
  // Tapping the line pops the exact total (to the second) in the same little
  // bubble the media player uses for the song name.
  window.__scDurBubble = (function(){
    function fmtPrecise(sec){
      sec = Math.max(0, Math.round(Number(sec) || 0));
      var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec % 60;
      if(h) return h + 'h ' + m + 'm ' + s + 's';
      if(m) return m + 'm ' + s + 's';
      return s + 's';
    }
    function hide(){
      var b = document.getElementById('durBubble');
      if(b) b.style.display = 'none';
    }
    function toggle(anchor, totalSec, subText){
      if(!anchor) return;
      var b = document.getElementById('durBubble');
      if(!b){
        b = document.createElement('div');
        b.id = 'durBubble';
        b.className = 'dur-bubble';
        b.innerHTML = '<div class="bt"></div><div class="ba"></div>';
        document.body.appendChild(b);
      }
      // Second tap on the same line closes it (same contract as the name bubble).
      if(b.style.display === 'block' && b._anchor === anchor){ hide(); return; }
      b.querySelector('.bt').textContent = fmtPrecise(totalSec);
      b.querySelector('.ba').textContent = subText || '';
      // Show hidden at the origin so measurement below uses the real width.
      b.style.display = 'block';
      b.style.visibility = 'hidden';
      b.classList.remove('below');
      b.style.left = '0px'; b.style.top = '0px';
      var r = anchor.getBoundingClientRect();
      var bw = b.offsetWidth, bh = b.offsetHeight;
      var left = Math.min(Math.max(10, r.left), Math.max(10, window.innerWidth - bw - 10));
      var top = r.top - bh - 12, below = false;
      if(top < 10){ top = r.bottom + 12; below = true; }              // no room above: drop below
      if(top + bh > window.innerHeight - 10){ top = r.top - bh - 12; below = false; } // prefer above
      if(top < 10) top = 10;
      b.classList.toggle('below', below);
      b.style.left = left + 'px';
      b.style.top = top + 'px';
      b.style.visibility = 'visible';
      b._anchor = anchor;
      clearTimeout(b._hideTimer);
      b._hideTimer = setTimeout(hide, 4000);
    }
    // Tap anywhere that is not an anchor, or scroll, dismisses it.
    document.addEventListener('click', function(e){
      if(e.target && e.target.closest && e.target.closest('[data-dur-bubble]')) return;
      hide();
    }, true);
    window.addEventListener('scroll', hide, true);
    return { toggle: toggle, hide: hide, fmtPrecise: fmtPrecise };
  })();`,
  'helper'
);

// ---- 3. Playlist/album pane header ".sub" line ----
rep(
  `      pane.appendChild(header);
      var _sb = $('sortBtn');`,
  `      pane.appendChild(header);
      // The runtime clamps with an ellipsis on narrow screens ("238 tracks \u00b7
      // 12h ..."). Tap the line for the exact total length in a bubble above it.
      if(totalSeconds > 0){
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
      }
      var _sb = $('sortBtn');`,
  'pane-header sub'
);

// ---- 4a. Album card subtitle becomes tappable when it carries a runtime ----
rep(
  `text-overflow:ellipsis;">' + escapeHtml(alb.artist || 'Unknown artist')`,
  `text-overflow:ellipsis;' + (albTotalStr ? 'cursor:pointer;' : '') + '" ' + (albTotalStr ? 'data-dur-bubble="1" ' : '') + '>' + escapeHtml(alb.artist || 'Unknown artist')`,
  'album subtitle attr'
);

// ---- 4b. Tap on the subtitle shows the bubble and must NOT toggle the card ----
rep(
  `        hdr.addEventListener('click', function(){`,
  `        var _albDurEl = hdr.querySelector('[data-dur-bubble]');
        if(_albDurEl) _albDurEl.addEventListener('click', function(ev){
          ev.stopPropagation(); // tapping the time must not expand/collapse the album
          window.__scDurBubble.toggle(_albDurEl, albTotalSec,
            alb.tracks.length + ' track' + (alb.tracks.length !== 1 ? 's' : '') + ' \\u00b7 ' + alb.name);
        });
        hdr.addEventListener('click', function(){`,
  'album subtitle wire'
);

// ---- 5. Version + changelog (real EDT time) ----
rep(
  `  const APP_VERSION = '60.4.7';`,
  `  const APP_VERSION = '60.4.8';`,
  'version'
);

rep(
  `  { version: '60.4.7', date: 'September 21, 2026 · 11:03 PM EDT',`,
  `  { version: '60.4.8', date: '${edtNow()}', title: 'Tap a clamped playlist or album time for the exact length', items: [
    'The playlist header runtime no longer dies behind an ellipsis on narrow screens: tap the "238 tracks \\u00b7 12h ..." line and a bubble pops up above it with the exact total length, down to the second.',
    'Album cards work the same way \\u2014 tap the runtime under an album name for its exact total time, without expanding or collapsing the album.',
    'The popup looks and behaves like the media player song-name bubble: floats above the line you tapped, second tap or scrolling closes it, and it auto-hides after four seconds.',
  ] },
  { version: '60.4.7', date: 'September 21, 2026 · 11:03 PM EDT',`,
  'changelog'
);

fs.writeFileSync(FILE, src);
console.log(`\\n${n}/7 replacements applied -> ${path.relative(ROOT, FILE)}`);
