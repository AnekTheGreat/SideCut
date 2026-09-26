#!/usr/bin/env node
// SideCut 62.0.5 — the albums in 📀 Album History drag the way the albums in the
// Albums tab do.
//
// Two things were reported, in the user's words:
//   * "It should be v62.0.5 not v63" — the release was published under the wrong
//     version. The published bundle on the other channel is 62, so this release is
//     62.0.5 (v63 was never a version anyone was ever offered).
//   * "you didn't fix the problem I should be able to hold and drag to reorder
//     these albums in album history and it should be the smooth reorder like the
//     albums in albums"
//
// MEASURED FIRST — the 63 build really was broken, and here is why:
//   * The hold armed, and `begin()` lifted the row and called
//     `el.setPointerCapture(...)` on the `.dp-ah-album` WRAPPER — but every
//     pointermove/pointerup listener was bound to `.dp-ah-album-hdr`, a CHILD of
//     that wrapper. A captured pointer is dispatched at the capture element and
//     bubbles UP from there, so `move()`/`finish()` never ran again. The row was
//     left lifted with nothing following the finger: a long press that visibly did
//     nothing.
//   * Nothing pinned `touch-action` and nothing swallowed touchmove, so Android
//     was free to claim the vertical gesture for the popup's scroller and fire
//     pointercancel — the drag died on the spot even when it did start. The
//     existing song drag spells this out in a comment; the album drag ignored it.
//   * The row never moved with the finger and the other rows never slid, so even a
//     working swap would have looked like a jump rather than a drag.
//
// So the fix is to drive it exactly like the two reorders that already feel right
// — the album cards in the Albums tab and the grip drag in the library — through
// ONE shared implementation shape:
//   * the lifted row follows the finger (translateY), the other albums slide out
//     of the way with a 0.18s transform transition, and the list auto-scrolls when
//     you drag near the top or bottom edge;
//   * every listener lives on `document`, so reparenting a row mid-drag can never
//     strand the gesture (the exact failure above);
//   * `touch-action:none` on the row from pickup plus a swallowed touchmove, and
//     touchmove/touchend fallbacks for WebViews that never deliver pointer events;
//   * a drop commits the order that is actually on screen and writes it per artist
//     to localStorage `sidecut_ahAlbumOrder`, which the renderer applies on a fresh
//     render and `__scApplyAHAlbumOrder` applies to a cached body;
//   * a 420 ms hold, and any movement before the hold completes cancels it, so a
//     plain scroll still scrolls and a short tap still opens the album's songs;
//   * the artist-group reorder no longer clears the `reordering` body class while an
//     album drag owns it.
//
//   node dev/patch-622.mjs              # code fix + release metadata
//   node dev/patch-622.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Every index.html edit is count==1 asserted and idempotent (each step carries its
// own marker), and the write happens once at the end, so a bad needle can never
// half-apply and a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '62.0.5';   // what the app calls itself now
const OLD_VER = '63';   // what the published-but-never-shipped release called itself
const STAMP = 'September 25, 2026 · 9:56 PM EDT';
const OLD_STAMP = 'September 26, 2026 · 11:30 AM EDT';

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The album row (and its header) must not let Android take the vertical drag
//    while an album is lifted — the song drag already pins this for `.track`.
// ---------------------------------------------------------------------------
const OLD_CSS = '  body.reordering .track{ touch-action:none !important; pointer-events:auto !important; }';
const NEW_CSS = [
  OLD_CSS,
  '  /* Album History album rows while one of them is lifted. Without this the',
  '     popup\'s scroller is free to claim the vertical gesture mid-drag, which fires',
  '     pointercancel and ends the reorder the instant it starts — the same reason',
  '     the song drag pins touch-action on the row it is moving. */',
  '  body.reordering .dp-ah-album, body.reordering .dp-ah-album-hdr{ touch-action:none !important; }'
].join('\n');

// ---------------------------------------------------------------------------
// 2. The reorder block itself: the old copy-pasted gesture is replaced by the
//    fingerprint-and-slide drag the rest of the app already uses.
//
// The old function is located by its opening line and the comment that follows
// it, so the replacement can never half-match a stale body.
// ---------------------------------------------------------------------------
const FN_START = 'window.__wireAHAlbumReorder = function(){';
const FN_END = '\n};\n\n// While a reorder drag is active, swallow touchmove in capture phase';
const FN_MARKER = "window.__scDragDelta('ahAlbumDrag', 480)";

const NEW_FN = String.raw`window.__wireAHAlbumReorder = function(){
  var bodyEl = document.getElementById('discPopupBody');
  if(!bodyEl) return;
  var albums = Array.prototype.slice.call(bodyEl.querySelectorAll('.dp-ah-album'));
  // Apply the saved order to each artist list once (fresh render or cached body).
  albums.forEach(function(el){
    var cont = el.parentElement;
    if(cont && !cont._ahAlbOrderApplied){
      cont._ahAlbOrderApplied = true;
      var h0 = el.querySelector('.dp-ah-album-hdr');
      if(h0) window.__scApplyAHAlbumOrder(cont, h0.getAttribute('data-artist') || '');
    }
  });
  albums.forEach(function(el){
    if(el._ahAlbReorderWired) return;
    var hdr = el.querySelector('.dp-ah-album-hdr');
    if(!hdr) return;
    el._ahAlbReorderWired = true;

    // 420 ms is the same hold the artists at the top of this popup use: long
    // enough that a tap and a scroll are never mistaken for a drag, short enough
    // that it does not feel like a secret.
    var HOLD_MS = 420;
    var GAP_PX = 0;          // the rows sit flush; each one's own border is the seam
    var holdTimer = null, dragging = false, moved = false;
    var rows = [], others = [], slotTops = [], startIndex = 0, currentIndex = 0;
    var startY = 0, lastPt = null, autoRaf = null, lastPtrDown = 0;

    function rowList(){
      var cont = el.parentElement;
      if(!cont || !cont.children) return [];
      return Array.prototype.filter.call(cont.children, function(k){
        return k.classList && k.classList.contains('dp-ah-album');
      });
    }
    function keyOf(a){
      var h = a.querySelector ? a.querySelector('.dp-ah-album-hdr') : null;
      if(!h) return '';
      var cid = h.getAttribute('data-collection-id') || '';
      return cid ? cid : String(h.getAttribute('data-album') || '');
    }
    function persistOrder(){
      var list = rowList(), order = [];
      list.forEach(function(k){ var kk = keyOf(k); if(kk) order.push(kk); });
      if(typeof window.__scSaveAHAlbumOrder === 'function') window.__scSaveAHAlbumOrder(hdr.getAttribute('data-artist') || '', order);
    }
    function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
    // Which slot a row occupies before the lift, and after it (the lifted row is
    // taken out of the sequence, so every slot after it shifts by one).
    function origSlot(j){ return j < startIndex ? j : j + 1; }
    function movedSlot(j){ return j < currentIndex ? j : j + 1; }
    // Everything except the lifted row eases into its new slot. This transition
    // is the difference between a reorder that reads as a drag and one that reads
    // as the list snapping a row at a time.
    function applyShifts(){
      for(var j = 0; j < others.length; j++){
        var shift = slotTops[movedSlot(j)] - slotTops[origSlot(j)];
        others[j].style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      }
    }
    // How many albums the lifted row's centre has passed, measured against each
    // neighbour's real midpoint — so an album with its track list open, which is
    // many times taller than a collapsed one, still lands where it is dropped.
    function updateIndex(dy){
      var centre = slotTops[startIndex] + (el.offsetHeight || 0) / 2 + dy;
      var p = 0;
      for(var j = 0; j < others.length; j++){
        var mid = slotTops[origSlot(j)] + (others[j].offsetHeight || 0) / 2;
        if(mid < centre) p++;
      }
      p = Math.max(0, Math.min(others.length, p));
      if(p !== currentIndex){ currentIndex = p; applyShifts(); }
    }
    // A touch drag has to be swallowed for its whole length, or the popup's
    // scroller takes the gesture and the browser fires pointercancel.
    function stopPageScroll(ev){ if(ev.cancelable) ev.preventDefault(); }
    function drive(y){
      lastPt = { clientY: y };
      var dy = y - startY;
      el.style.transform = 'translateY(' + dy + 'px)';
      if(dy > 3 || dy < -3) moved = true;
      updateIndex(dy);
      // Auto-scroll while the finger is held near an edge, so albums further down
      // the list are reachable without dropping the one being moved.
      var rect = bodyEl.getBoundingClientRect();
      var edge = 56, dir = 0;
      if(y - rect.top < edge) dir = -1;
      else if(rect.bottom - y < edge) dir = 1;
      if(dir !== 0){
        if(!autoRaf){
          var step = function(){
            if(!dragging){ autoRaf = null; return; }
            var r = bodyEl.getBoundingClientRect();
            var p = lastPt, still = false;
            if(dir < 0 && p && p.clientY - r.top < edge) still = true;
            if(dir > 0 && p && r.bottom - p.clientY < edge) still = true;
            if(!still){ autoRaf = null; return; }
            // A list that does not overflow has nothing to scroll.
            if(!bodyEl.scrollHeight || bodyEl.scrollHeight <= bodyEl.clientHeight){ autoRaf = null; return; }
            var stepPx = window.__scDragDelta('ahAlbumDrag', 480);
            var before = bodyEl.scrollTop;
            bodyEl.scrollTop += dir * stepPx;
            if(bodyEl.scrollTop === before){ autoRaf = null; return; }
            // Keep the row glued to the finger while the content scrolls under it.
            startY -= dir * stepPx;
            var ty = p.clientY - startY;
            el.style.transform = 'translateY(' + ty + 'px)';
            updateIndex(ty);
            autoRaf = requestAnimationFrame(step);
          };
          autoRaf = requestAnimationFrame(step);
        }
      } else if(autoRaf){ cancelAnimationFrame(autoRaf); autoRaf = null; }
    }
    function resetStyles(){
      el.classList.remove('dragging');
      var list = rows.concat(rowList());
      for(var i = 0; i < list.length; i++){
        var r = list[i];
        r.style.transform = '';
        r.style.transition = '';
        r.style.opacity = '';
        r.style.zIndex = '';
        r.style.boxShadow = '';
        r.style.background = '';
        r.style.touchAction = '';
        r.style.willChange = '';
        if(r === el){ r.style.position = ''; }
      }
    }
    function begin(pickY){
      if(dragging) return;
      rows = rowList();
      startIndex = rows.indexOf(el);
      if(startIndex === -1 || rows.length < 2) return;   // nothing to reorder
      others = rows.filter(function(r){ return r !== el; });
      dragging = true;
      moved = false;
      // Where the finger was when the hold armed. Every move is measured from
      // here, so the row travels with the finger instead of jumping to it.
      startY = pickY;
      lastPt = { clientY: pickY };
      currentIndex = startIndex;
      // Slots are measured rather than assumed: heights differ once an album's
      // track list is open.
      slotTops = [0];
      for(var m = 0; m < rows.length; m++) slotTops.push(slotTops[m] + (rows[m].offsetHeight || 0) + GAP_PX);
      try{ document.body.classList.add('reordering'); }catch(err0){}
      try{ window.__scAHAlbumDragging = true; }catch(err1){}
      el.classList.add('dragging');
      el.style.position = 'relative';
      el.style.opacity = '0.92';
      el.style.zIndex = '30';
      el.style.boxShadow = '0 10px 24px rgba(0,0,0,0.5)';
      el.style.background = 'rgba(255,255,255,0.06)';
      el.style.transition = 'none';
      el.style.touchAction = 'none';
      el.style.willChange = 'transform';
      for(var s = 0; s < others.length; s++) others[s].style.transition = 'transform 0.18s ease';
      // Document-level, on purpose: a row that is re-ordered is removed and
      // re-inserted, which drops pointer capture and would strand row-bound
      // listeners with the row still lifted.
      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onUp);
      document.addEventListener('touchcancel', onUp);
      haptic(12);
    }
    function onMove(ev){
      if(!dragging) return;
      if(ev.cancelable) ev.preventDefault();
      drive(ev.clientY);
    }
    // Some Android WebViews stop delivering pointermove once the browser takes the
    // gesture and only send touchmove. Both paths use the same maths.
    function onTouchMove(ev){
      if(!dragging) return;
      if(ev.cancelable) ev.preventDefault();
      var t = ev.touches && ev.touches[0];
      if(!t) return;
      drive(t.clientY);
    }
    function onUp(){
      if(!dragging) return;
      dragging = false;
      if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
      if(autoRaf){ cancelAnimationFrame(autoRaf); autoRaf = null; }
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      try{ document.body.classList.remove('reordering'); }catch(e2){}
      try{ window.__scAHAlbumDragging = false; }catch(e3){}
      var changed = currentIndex !== startIndex;
      // The release also lands as a click on the header, which would toggle the
      // track list open as the album was dropped. A real drag must not do that.
      if(moved){
        hdr._ahSuppressClick = true;
        setTimeout(function(){ hdr._ahSuppressClick = false; }, 700);
      }
      // Snap onto the slot it was dropped in, so what is on screen is what gets saved.
      var finalShift = slotTops[currentIndex] - slotTops[startIndex];
      el.style.transition = 'transform 0.15s ease';
      el.style.transform = finalShift ? 'translateY(' + finalShift + 'px)' : '';
      for(var i = 0; i < others.length; i++) others[i].style.transition = 'transform 0.15s ease';
      if(!changed){
        // Dropped back where it started: put the neighbours back, write nothing.
        setTimeout(resetStyles, 170);
        return;
      }
      haptic(8);
      setTimeout(function(){
        // Commit the order that is actually on screen. Re-appending each row in
        // turn moves them, so a nested track list travels with its album.
        var cont = el.parentElement;
        if(cont){
          var next = rows.slice();
          var from = next.indexOf(el);
          if(from !== -1) next.splice(from, 1);
          next.splice(Math.max(0, Math.min(next.length, currentIndex)), 0, el);
          for(var n = 0; n < next.length; n++) cont.appendChild(next[n]);
        }
        resetStyles();
        persistOrder();
      }, 160);
    }
    // The hold only arms while the finger stays still. Moving more than 12 px
    // before it completes is a scroll, exactly as before — and an interrupted
    // gesture still saves what the finger showed instead of throwing it away.
    function armHold(x, y){
      if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
      var sx = x, sy = y;
      function detachCancel(){
        document.removeEventListener('pointermove', cancelHold, true);
        document.removeEventListener('pointerup', cancelHold, true);
        document.removeEventListener('pointercancel', cancelHold, true);
      }
      function cancelHold(ev){
        if(ev && ev.type === 'pointermove'){
          var dx = ev.clientX - sx, dy = ev.clientY - sy;
          if(dx * dx + dy * dy < 144) return;   // still a hold, not yet a scroll
        }
        if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
        detachCancel();
      }
      holdTimer = setTimeout(function(){
        holdTimer = null;
        detachCancel();
        // Select mode turns these rows into checkboxes — a hold there is a
        // selection, not a reorder.
        if(dragging || window.__ahSelectMode || !el.parentElement || !bodyEl.contains(el)) return;
        begin(sy);
      }, HOLD_MS);
      document.addEventListener('pointermove', cancelHold, true);
      document.addEventListener('pointerup', cancelHold, true);
      document.addEventListener('pointercancel', cancelHold, true);
    }
    var NO_GRAB = '.dp-ah-edit,.dp-ah-rm,.dp-ah-cb,.dp-ah-artist-refetch,.dp-si-refetch,[data-art-url],img,button,a,input,select';
    hdr.addEventListener('pointerdown', function(e){
      if(dragging) return;
      if(e.target && e.target.closest && e.target.closest(NO_GRAB)) return;
      lastPtrDown = Date.now();
      armHold(e.clientX, e.clientY);
    });
    // WebViews that never deliver pointer events only offer touch — pointerdown
    // has already armed this whenever it did fire, so this is a no-op there.
    hdr.addEventListener('touchstart', function(e){
      if(dragging) return;
      if(Date.now() - lastPtrDown < 500) return;
      if(e.target && e.target.closest && e.target.closest(NO_GRAB)) return;
      var t = e.touches && e.touches[0];
      if(!t) return;
      armHold(t.clientX, t.clientY);
    }, { passive: true });
  });
};`;

// ---------------------------------------------------------------------------
// 3. The artist-group reorder and the album reorder both end on the same
//    pointerup. The artist finish() cleared the `reordering` body class
//    unconditionally, which handed the in-flight album drag back to the scroller.
// ---------------------------------------------------------------------------
const OLD_GROUP_FINISH = [
  '    function finish(){',
  '      clearTimeout(holdTimer);',
  '      if(autoRaf){ cancelAnimationFrame(autoRaf); autoRaf = null; }',
  '      try{ document.body.classList.remove(\'reordering\'); }catch(e2){}',
  '      if(drag){',
  "        drag.style.opacity = ''; drag.style.zIndex = ''; drag.style.boxShadow = ''; drag.style.background = ''; drag.style.transition = '';"
].join('\n');

const NEW_GROUP_FINISH = [
  '    function finish(){',
  '      clearTimeout(holdTimer);',
  '      if(autoRaf){ cancelAnimationFrame(autoRaf); autoRaf = null; }',
  '      // An album row inside this group may be the one being dragged right now.',
  '      // Its drag ends on this same event, so the class it needs to hold Android',
  '      // off the gesture must not be cleared out from under it here.',
  '      if(window.__scAHAlbumDragging) return;',
  '      try{ document.body.classList.remove(\'reordering\'); }catch(e2){}',
  '      if(drag){',
  "        drag.style.opacity = ''; drag.style.zIndex = ''; drag.style.boxShadow = ''; drag.style.background = ''; drag.style.transition = '';"
].join('\n');

if (!MANIFEST_ONLY) {
  // 1 + 2 + 3
  sub('Album History — rows pin touch-action while a reorder is live', OLD_CSS, NEW_CSS, 1,
    'body.reordering .dp-ah-album, body.reordering .dp-ah-album-hdr{ touch-action:none !important; }');
  sub('Album History — block header carries the release version',
    '// ---- 63: reorder the ALBUMS under one artist in Album History ------------',
    '// ---- 62.0.5: reorder the ALBUMS under one artist in Album History --------', 1,
    '// ---- 62.0.5: reorder the ALBUMS');
  {
    const i = src.indexOf(FN_START);
    if (i === -1) throw new Error('album reorder: could not find ' + FN_START);
    if (src.indexOf(FN_MARKER, i) !== -1) skip('Album History — the finger-following album drag');
    else {
      const j = src.indexOf(FN_END, i);
      if (j === -1) throw new Error('album reorder: could not find the end of the old function');
      src = src.slice(0, i) + NEW_FN + src.slice(j + 3);   // j+3 skips the old "\n};" delimiter
      done('Album History — the finger-following album drag');
    }
  }
  sub('Album History — artist drag no longer drops the album drag\'s state', OLD_GROUP_FINISH, NEW_GROUP_FINISH, 1,
    'if(window.__scAHAlbumDragging) return;');
  // The auto-scroll step bails on a list that cannot scroll. Kept as its own
  // idempotent edit so the guard can be added to an already-patched build —
  // a harness that reports zero heights would otherwise spin the loop.
  // The lift must remember where the finger was, or every move is measured from
  // zero and the row leaps to the pointer instead of following it.
  sub('Album History — the lift records where the finger was',
    '    function begin(){\n      if(dragging) return;\n      rows = rowList();',
    '    function begin(pickY){\n      if(dragging) return;\n      rows = rowList();',
    1, '    function begin(pickY){');
  sub('Album History — the drag baseline is the pickup point',
    '      dragging = true;\n      moved = false;\n      currentIndex = startIndex;',
    '      dragging = true;\n      moved = false;\n      // Where the finger was when the hold armed, so the row travels with the finger.\n      startY = pickY;\n      lastPt = { clientY: pickY };\n      currentIndex = startIndex;',
    1, '      startY = pickY;');
  sub('Album History — the hold hands its point to the lift',
    '        if(dragging || !el.parentElement || !bodyEl.contains(el)) return;\n        begin();',
    '        if(dragging || !el.parentElement || !bodyEl.contains(el)) return;\n        begin(sy);',
    1, 'begin(sy);');
  // Select mode makes these rows checkboxes, so the hold must stand down there.
  sub('Album History — the reorder hold stands down in select mode',
    '        if(dragging || !el.parentElement || !bodyEl.contains(el)) return;\n        begin(sy);',
    '        // Select mode turns these rows into checkboxes — a hold there is a\n        // selection, not a reorder.\n        if(dragging || window.__ahSelectMode || !el.parentElement || !bodyEl.contains(el)) return;\n        begin(sy);',
    1, 'if(dragging || window.__ahSelectMode');
  sub('Album History — auto-scroll bails on a list that cannot scroll',
    "            if(!still){ autoRaf = null; return; }\n            var stepPx = window.__scDragDelta('ahAlbumDrag', 480);",
    "            if(!still){ autoRaf = null; return; }\n            // A list that does not overflow has nothing to scroll.\n            if(!bodyEl.scrollHeight || bodyEl.scrollHeight <= bodyEl.clientHeight){ autoRaf = null; return; }\n            var stepPx = window.__scDragDelta('ahAlbumDrag', 480);",
    1, 'A list that does not overflow has nothing to scroll.');
}

// ---------------------------------------------------------------------------
// 4. Release metadata: the version, the service worker and the changelog head.
//
// NOTE on wording: the head entry's items become the OTA patch notes for BOTH
// channels, and dev/test-6058 + dev/test-60510 forbid a downloader/desktop term
// there. Keep every note free of download*, convert*, "to mp3", "get song" and
// "play build".
// ---------------------------------------------------------------------------
const ENTRY = String.raw`  { version: '62.0.5', date: 'September 25, 2026 · 9:56 PM EDT', title: 'The albums in Album History can be dragged into the order you want', items: [
    'In \ud83d\udcc0 Album History, press and hold an album for a moment, then drag it up or down. The row lifts under your finger, the other albums ease out of the way, and the album stays where you let go.',
    'It now moves the way the album cards in the Albums tab do: the row keeps up with your finger instead of jumping, the list slides over to open the gap it is heading for, and the list scrolls itself if you hold it near the top or bottom edge, so albums further down are reachable in one drag.',
    'The order is remembered for each artist. Close the popup, reopen it, refetch the list, or restart the app, and that artist\'s albums come back in the order you gave them.',
    'A short tap is unchanged — it still opens the album\'s songs. Only a press-and-hold starts a reorder, and moving the finger before the hold finishes still just scrolls the list.',
    'Holding an album\'s artwork still sets a custom cover; the reorder lives on the rest of the row, so the two gestures no longer compete for the same press.',
    'Reordering the artists at the top of Album History works exactly as it did, and the other popups are untouched.',
  ] },`;

if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '" + OLD_VER + "';", "  const APP_VERSION = '" + VER + "';", 1,
    "const APP_VERSION = '" + VER + "';");

  const start = src.indexOf("  { version: '" + OLD_VER + "',");
  if (start !== -1) {
    const end = src.indexOf('\n  ] },', start);
    if (end === -1) throw new Error('CHANGELOG: could not find the end of the ' + OLD_VER + ' entry');
    const tail = '\n  ] },'.length;
    const cur = src.slice(start, end + tail);
    const norm = (s) => s.replace(/\s+/g, ' ');
    if (norm(cur) === norm(ENTRY)) skip('CHANGELOG ' + VER + ' entry');
    else { src = src.slice(0, start) + ENTRY + src.slice(end + tail); done('CHANGELOG ' + VER + ' entry rewritten'); }
  } else if (src.indexOf("  { version: '" + VER + "',") !== -1) {
    skip('CHANGELOG ' + VER + ' entry');
  } else {
    throw new Error('CHANGELOG: neither the ' + OLD_VER + ' nor the ' + VER + ' entry was found');
  }
}

if (!MANIFEST_ONLY) fs.writeFileSync(FILE, src);

// ---------------------------------------------------------------------------
// 5. sw.js cache name.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_VER + "';";
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + VER + "';";
  if (sw.includes(newSw)) console.log('= sw.js CACHE_NAME (already ' + VER + ')');
  else {
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> v' + VER);
  }
}

// ---------------------------------------------------------------------------
// 6. Repin the repo-wide release assertions.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const REPINS = [
    ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
    ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
    ["const CACHE_NAME = 'sidecut-shell-v" + OLD_VER + "';", "const CACHE_NAME = 'sidecut-shell-v" + VER + "';"],
    ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
    ["entries[0].date === '" + OLD_STAMP + "'", "entries[0].date === '" + STAMP + "'"],
    ["'the " + OLD_VER + " entry heads the changelog'", "'the " + VER + " entry heads the changelog'"]
  ];

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (a === b) continue;
      if (t.indexOf(a) === -1) continue;
      repinned += t.split(a).length - 1;
      t = t.split(a).join(b);
      console.log('• ' + name + ' — ' + a.slice(0, 46));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-622: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-622 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
