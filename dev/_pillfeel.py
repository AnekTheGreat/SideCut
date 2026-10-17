#!/usr/bin/env python3
"""
The pill dock, made to feel like the segmented control it is.

The owner, after using 74.1.9:

    "make the pill like drag and move nicer it should feel really smooth and nice and
     easy to use especially the diagonal slant that especially and when I'm dragging it
     and releasing the pill it should be nice"

FOUR EDITS, each one a thing a finger notices:

1. THE HIGHLIGHT FOLLOWS THE FINGER. The thumb carried a 0.24s spring transition and
   it ran DURING the slide too, so the highlight set off after the thumb and arrived a
   quarter of a second later - the drag felt like it was lagging behind the finger.
   The spring is right for a hover preview and for the settle after a release, and it
   is switched off for exactly the length of a slide (`body.sc-dock-dragging`).

2. A DEAD ZONE, WHICH IS WHAT THE DIAGONAL NEEDED. A press was a choice the moment it
   landed: with the split Library pill, a thumb that landed on Playlists and wobbled a
   few pixels over the divider lit the other half, and releasing there opened Albums.
   Nothing is chosen until the finger has travelled SC_DOCK_SLIDE_MIN, and a press that
   never gets there answers the half it was pressed on.

3. THE HIGHLIGHT WEARS THE DIAGONAL. Half of a rounded rectangle is not the half a
   finger picked: the divider runs the pill's full width, corner to corner, so the
   highlight is clipped to that half - from the SAME test that decides which half a
   point is in, so the shape and the hit test can never disagree.

4. THE PRESS THAT GOES NOWHERE. A slide that ends off the dock (or on the plus) is a
   cancel: the highlight goes back to the lit tab and no tab is opened, and the
   dragging class can never be left behind on the page.
"""
import io
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PAGE = os.path.join(ROOT, 'index.html')


def once(src, anchor, replacement, label, done_marker):
    if done_marker in src:
        print('already applied: ' + label)
        return src
    if src.count(anchor) != 1:
        raise SystemExit('FATAL: %s: anchor found %d times' % (label, src.count(anchor)))
    print('applied: ' + label)
    return src.replace(anchor, replacement, 1)


CSS_SPRING = """  transition: transform 0.24s cubic-bezier(0.22,1,0.36,1), width 0.24s cubic-bezier(0.22,1,0.36,1), height 0.2s ease, top 0.2s ease;
}
body.sc-dock-pill #scDockPillTrack, body.sc-dock-pill #scDockPillThumb{ display: block; }"""

CSS_SPRING_NEW = """  transition: transform 0.24s cubic-bezier(0.22,1,0.36,1), width 0.24s cubic-bezier(0.22,1,0.36,1), height 0.2s ease, top 0.2s ease;
  will-change: transform, width;
}
/* WHILE A FINGER IS SLIDING, THE HIGHLIGHT IS THE FINGER'S. The spring above is for a
   hover preview and for the settle after a release. Run under a live drag it is what
   made the highlight set off after the thumb and arrive a quarter of a second later,
   which is the lag the slide was criticised for. The class goes on for the length of a
   slide and comes off on release, so the settle that follows is the spring again. */
body.sc-dock-pill.sc-dock-dragging #scDockPillThumb{ transition: none; }
body.sc-dock-pill #scDockPillTrack, body.sc-dock-pill #scDockPillThumb{ display: block; }"""

VARS = """  var scDockPillSegs = [];        // the pills a slide can land on, in dock order
  var scDockPillRects = [];       // where those pills are, measured while they are still
  try{ scDockPillOn = localStorage.getItem('sidecut_dockPill') === '1'; }catch(_eDockP0){}"""

VARS_NEW = """  var scDockPillSegs = [];        // the pills a slide can land on, in dock order
  var scDockPillRects = [];       // where those pills are, measured while they are still
  var scDockPillSlide = false;    // this press has become a real slide
  var scDockPillDownX = 0;        // where that press began
  var scDockPillDownY = 0;
  try{ scDockPillOn = localStorage.getItem('sidecut_dockPill') === '1'; }catch(_eDockP0){}
  // THE DEAD ZONE, and it is what the split Library tab needed. A press used to be a
  // choice the moment it landed, so a thumb that came down on Playlists and wobbled a
  // few pixels across the divider lit the other half - and releasing there opened the
  // tab nobody picked. Nothing is chosen until the finger has travelled this far, and
  // a press that never gets there answers the half it was pressed on. Eight pixels is
  // under a fingertip's own wobble and well over a deliberate nudge.
  var SC_DOCK_SLIDE_MIN = 8;"""

BOX = """  function scDockPillBox(target, strip){
    var sr = strip.getBoundingClientRect();
    var r = target.getBoundingClientRect();
    var left = r.left, width = r.width, top = r.top, height = r.height;
    if(target.id === 'albumsHalf' || target.id === 'playlistsHalf'){
      var pr = target.parentNode.getBoundingClientRect();
      left = pr.left + (target.id === 'albumsHalf' ? pr.width / 2 : 0);
      width = pr.width / 2;
      top = pr.top;
      height = pr.height;
    }
    return { left: left - sr.left, top: top - sr.top, width: width, height: height };
  }"""

BOX_NEW = """  function scDockPillBox(target, strip){
    var sr = strip.getBoundingClientRect();
    var r = target.getBoundingClientRect();
    var left = r.left, width = r.width, top = r.top, height = r.height;
    var half = null, pill = null;
    if(target.id === 'albumsHalf' || target.id === 'playlistsHalf'){
      var pr = target.parentNode.getBoundingClientRect();
      half = target.id === 'albumsHalf' ? 'al' : 'pl';
      pill = pr;
      left = pr.left + (target.id === 'albumsHalf' ? pr.width / 2 : 0);
      width = pr.width / 2;
      top = pr.top;
      height = pr.height;
    }
    // The viewport box as well as the dock-relative one: the shape of a half is
    // measured against the divider, which lives in the pill's own coordinates, and
    // the clip-path is written in the percentages of the highlight's own box.
    return { left: left - sr.left, top: top - sr.top, width: width, height: height,
             vleft: left, vtop: top, vright: left + width, vbottom: top + height,
             half: half, pill: pill };
  }
  // THE SHAPE OF A HALF. The divider runs the pill's full width: from its top-right
  // corner to its bottom-left one, which is the line `scDockPillHalf` tests a point
  // against. The highlight is the region of the box on that half's side of it, found
  // by clipping the box against the line itself - so the shape is derived from the
  // same expression the hit test uses and the two cannot drift apart.
  function scDockDividerPoly(b){
    try{
      var pr = b.pill;
      if(!b.half || !pr || !pr.width || !pr.height) return '';
      // The highlight sits 4px inside the half, the same inset the capsule gives it.
      var box = { left: b.vleft + 4, top: b.vtop + 4, right: b.vright - 4, bottom: b.vbottom - 4 };
      if(!(box.right > box.left) || !(box.bottom > box.top)) return '';
      // Negative on the top-left (Playlists) side of the divider, positive below it.
      function f(x, y){ return ((x - pr.left) / pr.width) + ((y - pr.top) / pr.height) - 1; }
      var keep = b.half === 'pl' ? -1 : 1;
      var poly = [[box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom]];
      var out = [];
      for(var i = 0; i < poly.length; i++){
        var p = poly[i], q = poly[(i + 1) % poly.length];
        var fp = f(p[0], p[1]) * keep, fq = f(q[0], q[1]) * keep;
        if(fp >= 0) out.push(p);
        if((fp >= 0) !== (fq >= 0)){
          var t = fp / (fp - fq);
          out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
      if(out.length < 3) return '';
      var w = Math.max(1, box.right - box.left), h = Math.max(1, box.bottom - box.top);
      return 'polygon(' + out.map(function(pt){
        return (((pt[0] - box.left) / w) * 100).toFixed(1) + '% ' +
               (((pt[1] - box.top) / h) * 100).toFixed(1) + '%';
      }).join(', ') + ')';
    }catch(e){ return ''; }
  }"""

SYNC_TAIL = """      var t = scDockPillHotEl || scDockPillRest();
      if(!t){ e.thumb.style.width = '0px'; return; }
      var b = scDockPillBox(t, e.strip);
      e.thumb.style.width = Math.max(0, b.width - 8) + 'px';
      e.thumb.style.height = Math.max(0, b.height - 8) + 'px';
      e.thumb.style.top = Math.max(0, b.top + 4) + 'px';
      e.thumb.style.transform = 'translateX(' + (b.left + 4) + 'px)';"""

SYNC_TAIL_NEW = """      var t = scDockPillHotEl || scDockPillRest();
      if(!t){ e.thumb.style.width = '0px'; e.thumb.style.clipPath = ''; return; }
      var b = scDockPillBox(t, e.strip);
      e.thumb.style.width = Math.max(0, b.width - 8) + 'px';
      e.thumb.style.height = Math.max(0, b.height - 8) + 'px';
      e.thumb.style.top = Math.max(0, b.top + 4) + 'px';
      e.thumb.style.transform = 'translateX(' + (b.left + 4) + 'px)';
      // A half of the split Library tab wears the diagonal; every other pill is its
      // own rounded box and needs no clip at all.
      e.thumb.style.clipPath = b.half ? scDockDividerPoly(b) : '';"""

WIRE = """    function offDrag(){
      try{
        window.removeEventListener('pointermove', onDrag, true);
        window.removeEventListener('pointerup', onDrop, true);
        window.removeEventListener('pointercancel', onDrop, true);
      }catch(e){}
    }
    function onDrag(ev){
      if(!scDockPillOn || !scDockPillDown) return;
      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(t && t !== scDockPillHotEl){
        scDockPillHotEl = t;
        scDockPillMark(t);
        scDockPillSync();
      }
    }
    function onDrop(ev){
      var down = scDockPillDown;
      scDockPillDown = null;
      offDrag();
      if(!scDockPillOn || !down) return;
      var up = scDockPillAt(ev.clientX, ev.clientY) || down;
      if(up !== down){"""

WIRE_NEW = """    function endSlide(){
      scDockPillSlide = false;
      try{ document.body.classList.remove('sc-dock-dragging'); }catch(_eDockEnd){}
    }
    function offDrag(){
      try{
        window.removeEventListener('pointermove', onDrag, true);
        window.removeEventListener('pointerup', onDrop, true);
        window.removeEventListener('pointercancel', onDrop, true);
      }catch(e){}
      endSlide();
    }
    function onDrag(ev){
      if(!scDockPillOn || !scDockPillDown) return;
      // The dead zone. Until the finger has travelled SC_DOCK_SLIDE_MIN this is still
      // the press it started as, and the highlight stays where the press put it - so a
      // thumb that wobbles across the divider of the split tab does not light a half
      // it did not mean, and the release that follows it answers the half it landed on.
      if(!scDockPillSlide){
        if(Math.abs(ev.clientX - scDockPillDownX) < SC_DOCK_SLIDE_MIN &&
           Math.abs(ev.clientY - scDockPillDownY) < SC_DOCK_SLIDE_MIN) return;
        scDockPillSlide = true;
        // From here the finger owns the highlight: the spring is for the settle.
        try{ document.body.classList.add('sc-dock-dragging'); }catch(_eDockDr){}
      }
      // Nothing under the finger - off the dock, or over the plus - is a drag that is
      // going to open nothing, so the highlight goes back to the lit tab and says so
      // while there is still time to change your mind. It is null, not the pill the
      // press came from: sync falls back to the rest position and the mark is cleared.
      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(t !== scDockPillHotEl){
        scDockPillHotEl = t;
        scDockPillMark(t);
        scDockPillSync();
      }
    }
    function onDrop(ev){
      var down = scDockPillDown;
      var slid = scDockPillSlide;
      scDockPillDown = null;
      offDrag();
      if(!scDockPillOn || !down) return;
      // A press that never became a slide is the press's own target, whatever the
      // finger's last pixel was doing - that is the dead zone answering a tap, and it
      // is also the half of the split tab the thumb came down on. A real slide is a
      // choice; a slide that ended off the dock (or on the plus) is a cancel, and the
      // press's own tab - whose click is still on its way - is what answers it.
      var landed = scDockPillAt(ev.clientX, ev.clientY);
      var up = (slid && landed) ? landed : down;
      if(up !== down){"""

DOWN = """      scDockPillSwallow = false;      // a new press is never the old press's business
      scDockPillMeasure();
      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(!t) return;                 // the plus and the menu are their own thing
      scDockPillDown = t;
      scDockPillHotEl = t;"""

DOWN_NEW = """      scDockPillSwallow = false;      // a new press is never the old press's business
      scDockPillMeasure();
      scDockPillSlide = false;
      scDockPillDownX = ev.clientX;
      scDockPillDownY = ev.clientY;
      var t = scDockPillAt(ev.clientX, ev.clientY);
      if(!t) return;                 // the plus and the menu are their own thing
      scDockPillDown = t;
      scDockPillHotEl = t;"""


def main():
    src = io.open(PAGE, encoding='utf-8').read()
    before = len(src)
    src = once(src, CSS_SPRING, CSS_SPRING_NEW, 'the spring runs only for a hover and a settle', 'sc-dock-dragging #scDockPillThumb')
    src = once(src, VARS, VARS_NEW, 'the dead zone and the press point', 'SC_DOCK_SLIDE_MIN = 8')
    src = once(src, BOX, BOX_NEW, 'the box of a half, and the divider polygon', 'function scDockDividerPoly(b)')
    src = once(src, SYNC_TAIL, SYNC_TAIL_NEW, 'the highlight wears the diagonal', "e.thumb.style.clipPath = b.half ? scDockDividerPoly(b) : ''")
    src = once(src, WIRE, WIRE_NEW, 'the slide, the cancel and the settle', 'function endSlide()')
    src = once(src,
               "      var t = scDockPillAt(ev.clientX, ev.clientY);\n      if(t && t !== scDockPillHotEl){\n        scDockPillHotEl = t;\n        scDockPillMark(t);\n        scDockPillSync();\n      }\n    }\n    function onDrop(ev){",
               "      // Nothing under the finger - off the dock, or over the plus - is a drag that is\n      // going to open nothing, so the highlight goes back to the lit tab and says so\n      // while there is still time to change your mind. It is null, not the pill the\n      // press came from: sync falls back to the rest position and the mark is cleared.\n      var t = scDockPillAt(ev.clientX, ev.clientY);\n      if(t !== scDockPillHotEl){\n        scDockPillHotEl = t;\n        scDockPillMark(t);\n        scDockPillSync();\n      }\n    }\n    function onDrop(ev){",
               'a drag that will open nothing says so', 'Nothing under the finger - off the dock')
    src = once(src, DOWN, DOWN_NEW, 'a press records where it began', 'scDockPillDownY = ev.clientY;')
    io.open(PAGE, 'w', encoding='utf-8').write(src)
    print('index.html: %d -> %d bytes' % (before, len(src)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
