// v60.1.5 patch A — album card drag actually stays where you drop it.
//
// Two real causes, both on the device and neither reproducible in a simple
// harness:
//
//  1. The drag measured ONE card and assumed every sibling was that height
//     (`rowHeight`, with midpoints at (i + 0.5) * rowHeight). Album cards are
//     wildly different heights — an expanded card holding 16 songs is many
//     times a collapsed one — so the computed drop index was nonsense and
//     usually came out equal to the card's starting index. The release then
//     saved the OLD order, which is the snap-back exactly as reported.
//     Now every card is measured and the drag works in real slot positions.
//
//  2. A drag never claimed the gesture. touch-action was left alone, so a
//     vertical drag belongs to the list scroller: Android takes it, fires
//     pointercancel, and the old onCancel threw the whole drag away without
//     saving. The list can no longer scroll mid-drag, and a cancel now saves
//     what the finger showed instead of reverting it.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function sub(oldStr, newStr) {
  const n = html.split(oldStr).length - 1;
  if (n !== 1) throw new Error('expected exactly 1 match, found ' + n + ' for: ' + oldStr.slice(0, 90));
  html = html.replace(oldStr, newStr);
}

// ---- 1. real geometry instead of one assumed row height ----------------------
sub(
`              var pane = card.parentElement;
              var siblings = Array.from(pane.querySelectorAll('[data-album-name]'));
              var startIndex = siblings.indexOf(card);
              var rowHeight = card.getBoundingClientRect().height;
              var startY = e.clientY;
              var currentIndex = startIndex;
              function updateDragIndex(dy){
                var crossed = 0;
                for(var i=0;i<siblings.length;i++){
                  if(siblings[i] === card) continue;
                  var sibMid = (i + 0.5) * rowHeight;
                  var rowMid = (startIndex + 0.5) * rowHeight + dy;
                  if(i < startIndex && rowMid < sibMid) crossed--;
                  if(i > startIndex && rowMid > sibMid) crossed++;
                }
                var ni = Math.max(0, Math.min(siblings.length - 1, startIndex + crossed));
                if(ni !== currentIndex){
                  currentIndex = ni;
                  siblings.forEach(function(s, i){
                    if(s === card) return;
                    var shift = 0;
                    if(currentIndex > startIndex && i > startIndex && i <= currentIndex) shift = -rowHeight;
                    else if(currentIndex < startIndex && i < startIndex && i >= currentIndex) shift = rowHeight;
                    s.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
                  });
                }
              }`,
`              var pane = card.parentElement;
              var siblings = Array.from(pane.querySelectorAll('[data-album-name]'));
              var startIndex = siblings.indexOf(card);
              var startY = e.clientY;
              var currentIndex = startIndex;
              // Cards are not all the same height — an expanded album card is many
              // times taller than a collapsed one — and this used to measure only
              // the card under the finger, then compare every sibling against
              // (index + 0.5) x that one height. With mixed heights the comparison
              // was meaningless: the drop index usually came out equal to the
              // starting index, so releasing wrote the old order straight back and
              // the card snapped home. Measure every card and work in real
              // positions instead.
              var others = siblings.filter(function(s){ return s !== card; });
              var GAP_PX = 6;              // the collapsed margin between two cards
              var slotTops = [0];          // top of each slot, in card order
              (function(){
                for(var _m=0;_m<siblings.length;_m++){
                  var _occ = (_m < startIndex) ? others[_m] : (_m === startIndex ? card : others[_m-1]);
                  slotTops.push(slotTops[_m] + (_occ.offsetHeight || 0) + GAP_PX);
                }
              })();
              // Which slot a sibling occupies before the drag, and after it.
              function origSlot(j){ return j < startIndex ? j : j + 1; }
              function movedSlot(j){ return j < currentIndex ? j : j + 1; }
              function applyShifts(){
                others.forEach(function(s, j){
                  var shift = slotTops[movedSlot(j)] - slotTops[origSlot(j)];
                  s.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
                });
              }
              // Where the dragged card's centre sits, expressed in the same
              // coordinate space as slotTops (so the pane's own scroll never
              // enters the maths), then count how many cards it has passed.
              function updateDragIndex(dy){
                var centre = slotTops[startIndex] + (card.offsetHeight || 0) / 2 + dy;
                var p = 0;
                for(var j=0;j<others.length;j++){
                  var mid = slotTops[origSlot(j)] + (others[j].offsetHeight || 0) / 2;
                  if(mid < centre) p++;
                }
                p = Math.max(0, Math.min(others.length, p));
                if(p !== currentIndex){
                  currentIndex = p;
                  applyShifts();
                }
              }
              // Swallow touchmove for the length of the drag. Without this the
              // list keeps its own scroll gesture, Android claims a vertical drag,
              // fires pointercancel, and the drag dies half way — one of the ways
              // a drop ended up not saving anything.
              function stopPageScroll(ev){ if(ev.cancelable) ev.preventDefault(); }`);

// ---- 2. the finger's own release: land on the slot, and commit --------------
sub(
`              function onUp(){
                if(autoScrollRAF){ cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
                try{ document.body.classList.remove('reordering'); }catch(_rb){}
                try{ card.releasePointerCapture(origPointerId); }catch(_pc){}
                card.style.opacity = '';
                card.style.zIndex = '';
                card.style.boxShadow = '';
                card.style.transition = 'transform 0.15s ease';
                var finalShift = (currentIndex - startIndex) * rowHeight;
                card.style.transform = 'translateY(' + finalShift + 'px)';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onCancel);
                setTimeout(function(){`,
`              function onUp(){
                if(autoScrollRAF){ cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
                try{ document.body.classList.remove('reordering'); }catch(_rb){}
                try{ card.releasePointerCapture(origPointerId); }catch(_pc){}
                document.removeEventListener('touchmove', stopPageScroll, { passive: false });
                card.style.opacity = '';
                card.style.zIndex = '';
                card.style.boxShadow = '';
                card.style.transition = 'transform 0.15s ease';
                // Snap onto the slot it was dropped in, so what you see is exactly
                // what gets saved.
                var finalShift = slotTops[currentIndex] - slotTops[startIndex];
                card.style.transform = finalShift ? 'translateY(' + finalShift + 'px)' : '';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onCancel);
                // Dropped back where it started: nothing to write, so put the
                // neighbours back and leave the saved order alone.
                if(currentIndex === startIndex){
                  others.forEach(function(s){ s.style.transform = ''; });
                  return;
                }
                setTimeout(function(){`);

// ---- 3. a cancel saves what the finger showed, it does not revert ---------- 
sub(
`              function onCancel(){
                if(autoScrollRAF){ cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
                try{ document.body.classList.remove('reordering'); }catch(_rb){}
                try{ card.releasePointerCapture(origPointerId); }catch(_pc){}
                card.style.opacity = '';
                card.style.zIndex = '';
                card.style.boxShadow = '';
                card.style.transition = '';
                card.style.transform = '';
                siblings.forEach(function(s){ s.style.transform = ''; s.style.transition = ''; });
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onCancel);
              }
              document.addEventListener('pointermove', onMove);
              document.addEventListener('pointerup', onUp);
              document.addEventListener('pointercancel', onCancel);`,
`              // A cancel is the browser taking the gesture back mid-drag (or a
              // call arriving). It used to throw the whole drag away \u2014 the card
              // went home and nothing was saved, which is the second half of
              // \"it flicks back the second I lift my finger\". Whatever the finger
              // showed is what was asked for, so a cancel saves it too.
              function onCancel(){ onUp(); }
              document.addEventListener('pointermove', onMove);
              document.addEventListener('pointerup', onUp);
              document.addEventListener('pointercancel', onCancel);
              document.addEventListener('touchmove', stopPageScroll, { passive: false });`);

fs.writeFileSync(file, html);
console.log('v615a: card drag geometry + gesture + cancel-commits applied');
