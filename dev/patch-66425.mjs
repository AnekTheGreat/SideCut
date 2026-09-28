#!/usr/bin/env node
// SideCut - 64.2.5: the bubble that still came back blank, a finished card you
// can tap away, a record tap that glides, and a Things-to-know list that says
// what the app does today.
//
// Four things were reported about 64.2.4:
//
//   "Update things to know about SideCut to now information because it is old
//    and outdated"
//   "the favorites bubble and pinned artist bubble still sometimes disappear
//    when scrolling"
//   "When there is a home screen notification that finishes such as watermark
//    remover I should be able to tap it and it goes away"
//   "when clicking on the record player to go to my current song in my library
//    and playlists it should be smooth not rough like it is now make this nice"
//
//   * THE BUBBLE THAT STILL CAME BACK BLANK is 64.2.4's own repair-only guard.
//     Four releases have now tried to catch the same WebView fault - content
//     inside a scroller keeps its space and loses its paint - and each one paid
//     for the repair elsewhere:
//
//       64.2.1/64.2.2  hid the surface for a frame  -> blinked
//       64.2.3         promoted it onto its own layer, then dropped the
//                      promotion -> re-rastered the whole surface on EVERY
//                      settled scroll, and a layer of its own is the very shape
//                      a phone drops on a long scroll
//       64.2.4         repaired only what carried a drag lift -> threw the
//                      trigger away. A phone that drops a paint writes nothing
//                      in the page to find, so the one condition that could
//                      start the repair was never met, and that is exactly why
//                      the bubble still sometimes disappears.
//
//     The repair is now scRepaint(): a fully transparent outline is written and
//     put back on the next frame. An outline is read by paint only, so the
//     element and everything drawn under it must be painted again - but nothing
//     is hidden, nothing moves, nothing is measured, and no layer is created or
//     destroyed, which is the part that made every earlier version of this
//     visible, slow, or droppable. With the repair this cheap it can run on
//     every settled scroll again (the trigger 64.2.1-64.2.3 had, and the one
//     that actually repaired the fault), for the grid, for every bubble in it,
//     for the strip and for every chip.
//
//   * THE FINISHED CARD could not be dismissed. #homeExportPopup has had a
//     [data-dismiss] click handler since the export card was written, and
//     NOTHING on the page ever carried the attribute - so tapping "Watermarks
//     removed" did nothing at all and the card sat there until its own timeout.
//     Every finished card now carries one, the handler covers each kind, and
//     the badge count is refreshed with it.
//
//   * THE ROUGH RECORD TAP was two scroll animations fighting. jumpToPlayingSong
//     navigated (which renders the list and can start the list's own 350ms
//     auto-scroll), rendered the list a second time, and then 140ms later
//     CANCELLED whatever was in flight and started a hard-coded 220ms scroll
//     from wherever that left it. A sixth of a second for a screen-and-a-half
//     of list is a teleport with a wobble on the end, and a short hop crawled.
//     It is now one glide, started once the rows have been laid out, with the
//     duration the shared engine picks from the distance - the same code path
//     the library's own auto-scroll uses.
//
//   * THINGS TO KNOW ABOUT SIDECUT (Settings > More) still described 64.2.2.
//     The record-tap bullet now describes the glide, and the list gains the
//     things a reader cannot guess: tapping a finished card away, the bell's
//     grouped patch notes, where the cover tools live, and how rollback and
//     Storage behave.
//
//   node dev/patch-66425.mjs
//   node dev/patch-66425.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose and new JS literals that need a glyph get the real
// character, built here so this script stays ASCII (see AGENTS.md).
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use
const ARROW = cp(0x2192);    // the arrow the settings paths are written with
const CROSS = cp(0x2715);    // the small dismiss cross on a finished card
const BULLET = cp(0x2022);   // the bullet the Things-to-know list uses

const VER = '64.2.5';
const OLD_VER = '64.2.4';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 28, 2026 ' + DOT + ' 10:05 PM EDT';
const OLD_STAMP = 'September 28, 2026 ' + DOT + ' 9:10 PM EDT';
const SW_CACHE = '63.0.23';
const OLD_SW_CACHE = '63.0.22';

const TITLE = 'The bubble that still came back blank, a finished card you can tap away, and a record tap that glides';

// Six short notes, published on BOTH channels (no [FULL] marker anywhere), so no
// tooling wording: dev/test-617..620, -60510 and -662 read the WHOLE head entry
// for a downloader term, dev/test-6058 runs the shipped filter over it for the
// store channel, and dev/test-play-copy reads it against a wider list than
// either. The fourth note keeps the word "rollback" (dev/test-662).
const NOTES = [
  'Home bubbles and pinned artists stop coming back blank. The repair now asks the phone to draw them again in a way nothing can see - nothing is hidden, nothing moves, and nothing is put on a layer of its own for a phone to drop in the first place.',
  'A finished card on Home can be tapped away. When a job like Watermark Remover finishes, the card leaves the moment you touch it instead of sitting there until it times itself out.',
  'Tapping the record on the now bar glides to the playing song. It used to cancel the scroll the list had already started and run a shorter, faster one from wherever that left it - that is the roughness you feel. It is one move now, paced by the distance.',
  'The "Things to know about SideCut" list in Settings > More says what the app does today - the record tap, the patch notes in the bell, where the cover tools live, and how rollback and Storage behave.',
  'Nothing in your library is touched. Same songs, playlists, covers and pinned artists, and no setting or saved rollback copy is changed by this update.',
  'This is 64.2.5 and not a rebuild of 64.2.4: a phone already on that version is offered it and installs it.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66425 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker === undefined ? newStr : marker;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the repair that cannot be seen, and a trigger that is never missed
// ═══════════════════════════════════════════════════════════════════════════

// The helper, declared once for both surfaces.
sub('a paint request that cannot hide, move or promote anything',
  `  // ---- Home grid: drawn again after a scroll settles -------------------------`,
  `  // ---- Asking a surface to draw itself again (64.2.5) ------------------------
  // This is the fourth answer to the same report, and the first one that costs
  // nothing anywhere else. Each earlier attempt bought its repair somewhere a
  // user could see or feel it:
  //
  //   - hiding the surface for a frame is a frame a phone can present. That is
  //     "the bubble disappears for a split second and comes back" (64.2.1, and
  //     the pinned rail in 64.2.2);
  //   - promoting the surface onto its own layer and taking the promotion away a
  //     frame later re-rastered the WHOLE surface on every settled scroll
  //     (64.2.3) - the slight blink while scrolling - and a layer of its own is
  //     precisely the shape a phone discards on a long scroll;
  //   - repairing only a surface that carried a drag lift (64.2.4) threw the
  //     trigger away. A phone that drops a paint leaves nothing in the page to
  //     find, so the one condition that could start the repair was never met -
  //     which is why the bubble still sometimes comes back blank.
  //
  // An outline is read by paint and by nothing else: it takes no space, it moves
  // nothing, and a fully transparent one draws no pixels. Writing one and putting
  // it back on the next frame tells the phone that this element, and everything
  // drawn under it, has to be painted again - with nothing hidden, nothing
  // measured and no layer created or destroyed on the way. That makes the repair
  // invisible and cheap enough to run on every settled scroll, which is the
  // trigger that actually repaired the fault.
  function scRepaint(el){
    if(!el || !el.style) return;
    try{
      el.style.outline = '1px solid transparent';
      requestAnimationFrame(function(){
        try{ el.style.outline = ''; }catch(_eRpBack){}
      });
    }catch(_eRp){}
  }
  // A surface and everything in it: whichever of them was left holding dropped
  // pixels, the element that owns them is the one that has to paint again.
  function scRepaintSurface(root, sel){
    scRepaint(root);
    if(!root || !sel) return;
    try{
      var els = root.querySelectorAll(sel);
      for(var i = 0; i < els.length; i++) scRepaint(els[i]);
    }catch(_eRpAll){}
  }

  // ---- Home grid: drawn again after a scroll settles -------------------------`,
  undefined, '  function scRepaint(el){');

// The Home grid's opening comment: the promotion is gone, the trigger is back.
sub('the grid\u2019s comment describes the invisible repair',
  `  //   - the grid's painted pixels are thrown away and painted again WITHOUT
  //     hiding it. 64.2.1 hid the whole grid for a frame to force the redraw, and
  //     a phone can present that frame: that hide is the "the Favorites bubble
  //     disappears for a split second and comes back" reported about it.
  //     Promoting the grid onto its own layer and taking the promotion away one
  //     frame later makes the compositor raster it again while it stays on
  //     screen - the same fresh paint, nothing ever off the screen. It is taken
  //     back on the SECOND frame so the promoted frame is really presented, and
  //     the grid is never measured: reading offsetHeight here (which 64.2.1 and
  //     64.2.2 both did) lays the whole page out again in the same task as the
  //     scroll settle, and that is a lag spike you can feel;
  //   - and a grid that really is missing a bubble the layout asks for is drawn
  //     from the layout again instead of waiting for the next update to notice;
  //
  // and NONE of it runs on a scroll that found nothing wrong. Promoting the grid
  // on every settled scroll re-rastered the whole surface a moment after you
  // stopped - the slight blink while scrolling - so the fresh paint above is now
  // only asked for when there is something to repair.
`,
  `  //   - the grid asks for a fresh paint WITHOUT being hidden and WITHOUT being
  //     put on a layer, bubble by bubble (see scRepaint above). 64.2.1 hid the
  //     whole grid for a frame to force the redraw, and a phone can present that
  //     frame: that hide is the "the Favorites bubble disappears for a split
  //     second and comes back" reported about it. 64.2.2/64.2.3 replaced the
  //     hide with a layer promotion, which re-rastered the whole surface on
  //     every scroll and left the grid on a layer a phone can drop. Nothing is
  //     measured either: reading offsetHeight here (which 64.2.1 and 64.2.2 both
  //     did) lays the whole page out in the same task as the scroll settle, and
  //     that is a lag spike you can feel;
  //   - and a grid that really is missing a bubble the layout asks for is drawn
  //     from the layout again instead of waiting for the next update to notice.
  //
  // This runs on EVERY settled scroll, which is the difference from 64.2.4: that
  // release only repaired a grid carrying a drag lift, and a grid whose paint was
  // dropped carries nothing at all, so the repair never ran and the bubble could
  // still come back blank. Because nothing here can be seen or measured, running
  // it every time is free in the way that matters.
`,
  undefined, '  //     put on a layer, bubble by bubble (see scRepaint above).');

// The grid function itself.
sub('the Home grid repaints through scRepaint, on every settled scroll',
  `    var carried = 0;
    try{
      var phs = wrap.querySelectorAll('.hb-drag-placeholder');
      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); carried++; } }
      var bs = wrap.querySelectorAll('.home-bubble');
      for(var j = 0; j < bs.length; j++){
        var b = bs[j];
        if(!b.classList.contains('hb-dragging') && !b.style.position) continue;
        b.classList.remove('hb-dragging');
        b.style.position = ''; b.style.left = ''; b.style.top = '';
        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';
        carried++;
      }
    }catch(_eCarry){}
    if(!carried) return;
    // A frame of a hidden grid is a frame a phone can show, and that is the
    // blink this replaces. The layer promotion forces the same fresh raster
    // with the grid on screen the whole time, and it is taken away at once so
    // nothing stays promoted (a bubble left on its own layer is the shape this
    // guard exists to clear in the first place).
    wrap.style.transform = 'translateZ(0)';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });
    });
  }`,
  `    try{
      var phs = wrap.querySelectorAll('.hb-drag-placeholder');
      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); } }
      var bs = wrap.querySelectorAll('.home-bubble');
      for(var j = 0; j < bs.length; j++){
        var b = bs[j];
        if(!b.classList.contains('hb-dragging') && !b.style.position) continue;
        b.classList.remove('hb-dragging');
        b.style.position = ''; b.style.left = ''; b.style.top = '';
        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';
      }
    }catch(_eCarry){}
    // Unconditional on purpose - see the note above the function.
    scRepaintSurface(wrap, '.home-bubble');
  }`,
  undefined, '    scRepaintSurface(wrap, \'.home-bubble\');');

// The rail: same repair, same trigger.
sub('the rail\u2019s comment describes the invisible repair',
  `  //   - the card itself is hidden and shown again, which throws its painted
  //     pixels away and paints them fresh, whether or not its artists are there.
  //
  // A rail that really has lost its chips is still drawn again from scratch.`,
  `  //   - the card asks for a fresh paint without being hidden and without being
  //     put on a layer, chip by chip (see scRepaint above), on EVERY settled
  //     scroll. 64.2.4 only repaired a rail carrying a drag lift, and a rail
  //     whose paint was dropped carries nothing to find, so the repair never ran
  //     and the artists could still come back blank.
  //
  // A rail that really has lost its chips is still drawn again from scratch.`,
  undefined, '  //     whose paint was dropped carries nothing to find, so the repair never ran');

sub('the rail repaints through scRepaint, on every settled scroll',
  `    var carried = 0;
    try{
      var chips = list.querySelectorAll('.pinned-artist-chip');
      for(var i = 0; i < chips.length; i++){
        var c = chips[i];
        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }
      }
    }catch(_eLift){}
    // A chip left carrying a drag lift is damage, and the fresh raster below is
    // for it. A settled scroll over a rail that is simply fine is NOT damage:
    // promoting the card on every settled scroll made the compositor raster the
    // whole strip again a moment after you stopped, which is the slight blink
    // seen while scrolling - and a whole extra GPU pass per scroll that bought
    // nothing at all.
    if(!carried) return;
    var strip = $('pinnedArtistsStrip');
    if(!strip) return;`,
  `    try{
      var chips = list.querySelectorAll('.pinned-artist-chip');
      for(var i = 0; i < chips.length; i++){
        var c = chips[i];
        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }
      }
    }catch(_eLift){}
    var strip = $('pinnedArtistsStrip');
    if(!strip) return;`,
  undefined, '    var strip = $(\'pinnedArtistsStrip\');\n    if(!strip) return;\n    // Ask for a fresh paint on every settled scroll');

sub('the rail asks for the fresh paint instead of promoting a layer',
  `    // 64.2.2 took the hide out of Home's repaint and left the rail with it: a
    // frame of a hidden strip is a frame a phone can present, and that is "the
    // pinned artists island sometimes doesn't show but comes back after a split
    // second". Promoting the strip onto its own layer and taking the promotion
    // away one frame later makes the compositor raster it again with the strip
    // on screen the whole time.
    //
    // No forced layout here either. The old \`void strip.offsetHeight\` made the
    // page lay itself out again in the same task as the scroll settle, which is
    // the lag spike felt right after you stop scrolling. That flush was only
    // ever needed by the hide-and-restore - a hidden frame has to be committed
    // before it can be restored - while a transform change is committed by the
    // frame it is scheduled on. The inner requestAnimationFrame is the same
    // two-frame pattern the album reorder sheet uses to let the browser apply
    // an entrance.
    strip.style.transform = 'translateZ(0)';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ try{ strip.style.transform = ''; }catch(_eRpr){} });
    });
  }`,
  `    // Ask for a fresh paint on every settled scroll, whether or not a drag left
    // a lift behind. There is no hidden frame here and no layer: 64.2.2's hide
    // was the "island sometimes doesn't show for a split second", and the layer
    // promotion that replaced it was the slight blink while scrolling in 64.2.3
    // and the shape a phone drops in the first place. Nothing is measured, so
    // this cannot lay the page out in the same task as the scroll settle either.
    scRepaintSurface(strip, '.pinned-artist-chip');
  }`,
  undefined, '    scRepaintSurface(strip, \'.pinned-artist-chip\');');

// ═══════════════════════════════════════════════════════════════════════════
// 2 - a finished card on Home can be tapped away
// ═══════════════════════════════════════════════════════════════════════════

sub('the finished Watermarks-removed card can be dismissed',
  `    if(typeof watermarkCleanState !== 'undefined' && watermarkCleanState && watermarkCleanState.finishedAt && !watermarkCleanState.seen){
      tasks.push(\`
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:18px; color:var(--coral);">\u2713</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13.5px; color:var(--coral);">Watermarks removed</div>
            <div style="font-size:11.5px; color:var(--ink-dim);">Cleaned \${watermarkCleanState.changed} song\${watermarkCleanState.changed===1?'':'s'}.</div>
          </div>
        </div>\`);
    }`,
  `    if(typeof watermarkCleanState !== 'undefined' && watermarkCleanState && watermarkCleanState.finishedAt && !watermarkCleanState.seen){
      tasks.push(\`
        <div data-dismiss="watermark" title="Tap to dismiss" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <span style="font-size:18px; color:var(--coral);">\u2713</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13.5px; color:var(--coral);">Watermarks removed</div>
            <div style="font-size:11.5px; color:var(--ink-dim);">Cleaned \${watermarkCleanState.changed} song\${watermarkCleanState.changed===1?'':'s'}.</div>
          </div>
          <span style="font-size:13px; color:var(--ink-dim); flex-shrink:0;">` + CROSS + `</span>
        </div>\`);
    }`,
  undefined, 'data-dismiss="watermark"');

sub('the finished song-details card can be dismissed too',
  `      tasks.push(\`
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:18px; color:\${ok ? 'var(--coral)' : 'var(--ink-dim)'};">\${ok ? '\u2713' : '\u2014'}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13.5px; color:\${ok ? 'var(--coral)' : 'var(--ink-dim)'};">\${ok ? 'Song details updated' : 'Nothing to update'}</div>
            <div style="font-size:11.5px; color:var(--ink-dim);">\${escapeHtml(msg)}</div>
          </div>
        </div>\`);`,
  `      tasks.push(\`
        <div data-dismiss="enrich" title="Tap to dismiss" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <span style="font-size:18px; color:\${ok ? 'var(--coral)' : 'var(--ink-dim)'};">\${ok ? '\u2713' : '\u2014'}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13.5px; color:\${ok ? 'var(--coral)' : 'var(--ink-dim)'};">\${ok ? 'Song details updated' : 'Nothing to update'}</div>
            <div style="font-size:11.5px; color:var(--ink-dim);">\${escapeHtml(msg)}</div>
          </div>
          <span style="font-size:13px; color:var(--ink-dim); flex-shrink:0;">` + CROSS + `</span>
        </div>\`);`,
  undefined, 'data-dismiss="enrich"');

sub('the finished export card can be dismissed',
  `      inner = \`
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:18px;">\${ok ? '\u2713' : '\u2717'}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13.5px; color:\${ok ? 'var(--coral)' : '#ff6b6b'};">\${ok ? 'Export complete' : 'Export failed'}</div>
            <div style="font-size:11.5px; color:var(--ink-dim);">\${escapeHtml(msg)}</div>
          </div>
        </div>\`;`,
  `      inner = \`
        <div data-dismiss="export" title="Tap to dismiss" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
          <span style="font-size:18px;">\${ok ? '\u2713' : '\u2717'}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13.5px; color:\${ok ? 'var(--coral)' : '#ff6b6b'};">\${ok ? 'Export complete' : 'Export failed'}</div>
            <div style="font-size:11.5px; color:var(--ink-dim);">\${escapeHtml(msg)}</div>
          </div>
          <span style="font-size:13px; color:var(--ink-dim); flex-shrink:0;">` + CROSS + `</span>
        </div>\`;`,
  undefined, 'data-dismiss="export"');

sub('the dismiss handler covers every finished card and refreshes the badge',
  `    // Tapping a finished background-task card dismisses it immediately.
    el.querySelectorAll('[data-dismiss]').forEach(card => {
      card.addEventListener('click', () => {
        if(card.dataset.dismiss === 'pinned' && typeof pinnedCheckState !== 'undefined' && pinnedCheckState){
          pinnedCheckState.seen = true;
        }
        renderHomeExportPopup();
      });
    });`,
  `    // Tapping a finished background-task card dismisses it immediately. The
    // handler has been here since the export card was written, but nothing on
    // the page ever carried the attribute, so a tap on "Watermarks removed" did
    // nothing at all - every finished card carries one now.
    el.querySelectorAll('[data-dismiss]').forEach(card => {
      card.addEventListener('click', () => {
        const which = card.dataset.dismiss;
        try{
          if(which === 'export'){ exportState.seen = true; exportState.finishedAt = 0; }
          else if(which === 'enrich'){ enrichState.seen = true; enrichState.finishedAt = 0; }
          else if(which === 'watermark' && typeof watermarkCleanState !== 'undefined' && watermarkCleanState){
            watermarkCleanState.seen = true; watermarkCleanState.finishedAt = 0;
          }
          else if(which === 'pinned' && typeof pinnedCheckState !== 'undefined' && pinnedCheckState){
            pinnedCheckState.seen = true;
          }
        }catch(_eDismiss){}
        // The 6s auto-hide timer is armed for cards that are never touched, so it
        // can be left alone: with every 'seen' flag set the next render empties
        // the card, and the timer's own pass finds nothing left to clear.
        renderHomeExportPopup();
        try{ updateNotifBadge(); }catch(_eDismissBadge){}
      });
    });`,
  undefined, `      else if(which === 'watermark' && typeof watermarkCleanState !== 'undefined'`);

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the record tap glides instead of jerking
// ═══════════════════════════════════════════════════════════════════════════

sub('the record tap into Playlists is one glide at the engine\u2019s pace',
  `      navigate('playlists');
      renderTabs();
      renderList();
    }catch(_e){ toast('Could not open the song list — try again.'); return; }
    setTimeout(function(){
      try{
        const pane = $('listPane');
        if(!pane) return;
        const row = pane.querySelector('.track[data-id="' + t.id + '"]');
        if(!row){ toast('Opened All Songs — "' + t.name + '" is in your library.'); return; }
        cancelScrollAnim(pane);
        smoothScrollIn(pane, row, 220);
        scFocusRow(t.id);
      }catch(_eFocus){}
    }, 140);`,
  `      // This jump does its own gliding below, so the list is told not to start
      // one of its own. Switching into the Playlists tab makes renderListInner
      // begin a 350ms scroll to the playing row, and this function used to start
      // its own 220ms one 140ms later on top of it - CANCEL the one in flight and
      // begin again from wherever it had got to. That cancel-and-restart, always
      // at the same fixed speed, is the roughness the tap had.
      renderListInner._scrollToPlaying = false;
      navigate('playlists');
    }catch(_e){ toast('Could not open the song list — try again.'); return; }
    // navigate() has already drawn the tabs and the list for the playlists half,
    // and renderList() coalesces its calls into one frame anyway, so the list is
    // not asked for a second time here.
    //
    // Then one glide, started once the rows are really in the DOM and measured
    // (two frames - the first has them, the second has their positions), and
    // sized by the distance it has to travel. The hard-coded 220ms it used to be
    // is the other half of the roughness: a screen and a half of list in a fifth
    // of a second is a teleport with a wobble on the end, while a short hop
    // crawled. The shared engine scales the duration with the distance and
    // honours the user's Scroll speed setting.
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        try{
          const pane = $('listPane');
          if(!pane) return;
          const row = pane.querySelector('.track[data-id="' + t.id + '"]');
          if(!row){ toast('Opened All Songs — "' + t.name + '" is in your library.'); return; }
          smoothScrollIn(pane, row);
          scFocusRow(t.id);
        }catch(_eFocus){}
      });
    });`,
  undefined, '      renderListInner._scrollToPlaying = false;\n      navigate(\'playlists\');');

sub('the album jump glides at the engine\u2019s pace too',
  `        cancelScrollAnim(pane);
        smoothScrollIn(pane, row, 220);`,
  `        smoothScrollIn(pane, row);`,
  undefined, `        smoothScrollIn(pane, row);\n      }catch(_eScroll){`);

sub('landing on the playing song when Playlists opens glides by distance',
  `            requestAnimationFrame(function(){ smoothScrollIn(pane, row, 350); });`,
  `            requestAnimationFrame(function(){ smoothScrollIn(pane, row); });`,
  undefined, 'requestAnimationFrame(function(){ smoothScrollIn(pane, row); });');

sub('the playing row an album opens to glides by distance too',
  `              if(tid === id){
                setTimeout(function(){ smoothScrollIn(body, row, 200); }, 100);
              }`,
  `              if(tid === id){
                setTimeout(function(){ smoothScrollIn(body, row); }, 100);
              }`,
  undefined, 'setTimeout(function(){ smoothScrollIn(body, row); }, 100);');

sub('and the one it highlights in an already-open album',
  `            if(pr) smoothScrollIn(body, pr, 200);`,
  `            if(pr) smoothScrollIn(body, pr);`,
  undefined, 'if(pr) smoothScrollIn(body, pr);', false);

sub('the album the disc opens glides to its row by distance',
  `                if(_tid === t.id){
                  setTimeout(function(){ smoothScrollIn(_body, _row, 200); }, 100);
                }`,
  `                if(_tid === t.id){
                  setTimeout(function(){ smoothScrollIn(_body, _row); }, 100);
                }`,
  undefined, 'setTimeout(function(){ smoothScrollIn(_body, _row); }, 100);');

sub('and so does the row it highlights in an already-open album',
  `              _pr.classList.add('playing');
              setTimeout(function(){ smoothScrollIn(_body, _pr, 200); }, 100);`,
  `              _pr.classList.add('playing');
              setTimeout(function(){ smoothScrollIn(_body, _pr); }, 100);`,
  undefined, 'setTimeout(function(){ smoothScrollIn(_body, _pr); }, 100);');

// ═══════════════════════════════════════════════════════════════════════════
// 4 - Things to know about SideCut says what the app does today
// ═══════════════════════════════════════════════════════════════════════════

sub('the Things-to-know list opens with what is new this release',
  `          <div style="margin-bottom:6px; color:var(--ink);">A few built-in behaviors worth knowing:</div>`,
  `          <div style="margin-bottom:6px; color:var(--ink);">A few built-in behaviors worth knowing:</div>
          <div style="display:flex; gap:8px; margin-bottom:8px;"><span style="color:var(--coral); flex-shrink:0;">` + BULLET + `</span><span><b>Tap a finished card on Home to dismiss it.</b> When a background job finishes -- removing watermarks, fetching covers or lyrics, an export -- its card sits at the top of Home. Tap it and it leaves at once; left alone it clears itself after a few seconds.</span></div>
          <div style="display:flex; gap:8px; margin-bottom:8px;"><span style="color:var(--coral); flex-shrink:0;">` + BULLET + `</span><span><b>The patch notes in the bell are grouped by version.</b> Each release has a header with a one-line summary; tap it to open the detail, or leave every header closed for the glance view.</span></div>
          <div style="display:flex; gap:8px; margin-bottom:8px;"><span style="color:var(--coral); flex-shrink:0;">` + BULLET + `</span><span><b>The library tools live together in Settings ` + ARROW + ` More.</b> <b>Refetch missing covers</b>, the duplicate finder and the rest are under <b>Library Tools &amp; Fetching</b>. <b>Watermark Remover</b> is its own card under them and starts switched on.</span></div>
          <div style="display:flex; gap:8px; margin-bottom:8px;"><span style="color:var(--coral); flex-shrink:0;">` + BULLET + `</span><span><b>Every version keeps its own copy, so a rollback is two-way.</b> The list in <b>Settings ` + ARROW + ` More ` + ARROW + ` Roll back app</b> starts with the way forward to the build you are on. <b>Storage</b> shows the room your phone gives the app -- SideCut sets no size of its own.</span></div>`,
  undefined, 'Tap a finished card on Home to dismiss it.');

sub('the record-tap bullet describes the glide',
  `          <div style="display:flex; gap:8px; margin-bottom:8px;"><span style="color:var(--coral); flex-shrink:0;">\u2022</span><span><b>Jump to the playing song from anywhere.</b> Tap the <b>record</b> on the now bar — in Playlists it scrolls to that song in the list, in Albums it opens the album it is in. Either way the row is highlighted so you never have to hunt for it.</span></div>`,
  `          <div style="display:flex; gap:8px; margin-bottom:8px;"><span style="color:var(--coral); flex-shrink:0;">\u2022</span><span><b>Jump to the playing song from anywhere.</b> Tap the <b>record</b> on the now bar — in Playlists the list glides to that song, in Albums the album it is in opens and glides to the song inside it. Either way the row is highlighted so you never have to hunt for it.</span></div>`,
  undefined, 'the list glides to that song, in Albums the album it is in opens and glides');

// ═══════════════════════════════════════════════════════════════════════════
// 5 - the release itself
// ═══════════════════════════════════════════════════════════════════════════

sub('APP_VERSION is ' + VER,
  `  const APP_VERSION = '` + OLD_VER + `';`,
  `  const APP_VERSION = '` + VER + `';`);

// The new entry goes AHEAD of the 64.2.4 one, which stays exactly where it is:
// every earlier release is still listed and still readable in the bell.
const HEAD_NEW = `  { version: '` + VER + `', date: '` + STAMP + `', title: '` + TITLE + `', items: [` +
  NOTES.map((n) => `\n    '` + n + `',`).join('') + `\n  ] },\n`;

sub('the head changelog entry is ' + VER + ' with ' + NOTES.length + ' notes',
  `  const CHANGELOG = [\n`,
  `  const CHANGELOG = [\n` + HEAD_NEW,
  undefined, `  { version: '` + VER + `', date: '` + STAMP + `'`);

fs.writeFileSync(FILE, src);
console.log('patch-66425: index.html written (' + edits + ' edit(s))');

// sw.js carries a cache name and NOTHING of the app version (dev/ota-guard
// asserts that), so it moves on its own line and its own counter.
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
const SW_NEW = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
const SW_OLD = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
if (sw.indexOf(SW_NEW) !== -1) skip('the service worker cache moves on ' + SW_CACHE);
else {
  if (sw.indexOf(SW_OLD) === -1) throw new Error('sw.js cache was not v' + OLD_SW_CACHE);
  fs.writeFileSync(SW, sw.split(SW_OLD).join(SW_NEW));
  done('the service worker cache moves on ' + SW_CACHE);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 - the gates that pinned the old shape of this repair
// ═══════════════════════════════════════════════════════════════════════════
// Same rule as 64.2.3/64.2.4: a gate that pins how a repair is written has to
// move with it, or it is pinning a release that no longer exists. The checks
// keep their meaning - the surface is never hidden, never measured and never
// put on a layer of its own - they are just pointed at the repair that is there
// now. Versions are read by number, never by a quoted literal.
// A gate that pins a two-line needle writes the line break as the two characters
// backslash and n inside its own double-quoted string, so a needle for one of
// those files needs those two characters, not a real line break. `\n` inside a
// template literal IS a real line break (and a tool round-trip can eat a
// doubling), so it is built from a code point instead - the same reason the real
// glyphs above are.
const BS = String.fromCharCode(92);
const NL = BS + 'n';   // the \n a test file writes, as two characters

function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  for (const [label, oldStr, newStr, marker] of pairs) {
    const m = marker === undefined ? newStr : marker;
    if (m !== '' && s.indexOf(m) !== -1) { skip(rel + ': ' + label); continue; }
    const got = s.split(oldStr).length - 1;
    if (got !== 1) throw new Error(rel + ' - ' + label + ': found ' + got + ' occurrence(s), want 1');
    s = s.split(oldStr).join(newStr);
    done(rel + ': ' + label);
  }
  fs.writeFileSync(p, s);
}

fileSub('dev/test-66423.mjs', [
  ['the version this gate reads', "const VER = '64.2.4';", "const VER = '64.2.5';"],
  ['the rail asks for the fresh paint',
    `  ok(has("    strip.style.transform = 'translateZ(0)';"), 'it promotes the strip to force a fresh raster');`,
    `  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');"), 'the strip and every chip in it are asked to paint again');`],
  ['and does it without a layer',
    `  ok(has("    requestAnimationFrame(function(){${NL}      requestAnimationFrame(function(){ try{ strip.style.transform = ''; }catch(_eRpr){} });"),` + `\n    'and drops the promotion one frame later, so nothing stays on its own layer');`,
    `  ok(!/translateZ/.test(rail) && !/offsetHeight|getBoundingClientRect/.test(rail),
    'and nothing is put on a layer of its own, or measured, on the way');`],
  ['a chip still holding a drag lift',
    `  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }"),
    'a chip still holding what a drag gives it is still put back');`,
    `  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still holding what a drag gives it is still put back');`],
  ['Home follows the same shape',
    `  ok(has("    requestAnimationFrame(function(){${NL}      requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });"),` + `\n    'the promotion is taken back one frame later');`,
    `  ok(has("    scRepaintSurface(wrap, '.home-bubble');"), 'and every bubble on it is asked to paint again');`],
]);

fileSub('dev/test-66424.mjs', [
  ['the version this gate reads', "const VER = '64.2.4';", "const VER = '64.2.5';"],
  ['this gate reads its own release by version',
    `  if (entries) {
    const head = entries[0];
    const items = head.items || [];`,
    `  // The head entry belongs to whatever shipped last, so read the 64.2.4 entry by
  // version: this gate describes 64.2.4.
  const entry6424 = entries ? entries.find((x) => /^64\\.2\\.4$/.test(String(x.version))) : null;
  if (entry6424) {
    const head = entry6424;
    const items = head.items || [];`],
  ['and the entry it reads is the one it describes',
    `    ok(String(head.version) === VER, 'the head entry is v' + head.version);`,
    `    ok(String(head.version) === '64.2.4', 'the entry this gate describes is v' + head.version);`],
  ['the repair runs whether or not a drag left anything',
    `  ok(has("    if(!carried) return;${NL}    var strip = $('pinnedArtistsStrip');"),
    'the rail is left alone when no chip carries a drag');
  ok(has("    if(!carried) return;${NL}    // A frame of a hidden grid is a frame a phone can show"),
    'and so is Home when no bubble carries one and no placeholder is left');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }"),
    'a chip still carrying what a drag gave it is still put back, and counts as damage');
  ok(has("      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); carried++; } }"),
    'a dashed placeholder an abandoned drag left behind still counts too');
  ok(has("        carried++;${NL}      }${NL}    }catch(_eCarry){}${NL}    if(!carried) return;"),
    'and so does a bubble still holding its drag lift');
  ok(has("    strip.style.transform = 'translateZ(0)';\") && has("    wrap.style.transform = 'translateZ(0)';\"),
    'the fresh raster is still there for real damage on both surfaces');
  ok(has("    requestAnimationFrame(function(){${NL}      requestAnimationFrame(function(){ try{ strip.style.transform = ''; }catch(_eRpr){} });\"),
    'and it is still taken back one frame later');`,
    `  ok(has("    }catch(_eLift){}" + "${NL}" + "    var strip = $('pinnedArtistsStrip');"),
    'the rail no longer waits for a drag to leave something behind');
  ok(has("    }catch(_eCarry){}" + "${NL}" + "    // Unconditional on purpose - see the note above the function." + "${NL}" + "    scRepaintSurface(wrap, '.home-bubble');"),
    'and neither does Home');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still carrying what a drag gave it is still put back');
  ok(has("      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); } }"),
    'a dashed placeholder an abandoned drag left behind is still cleared');
  ok(has("        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';"),
    'and a bubble still holding its drag lift is still put back to a plain bubble');
  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');") && has("    scRepaintSurface(wrap, '.home-bubble');"),
    'the fresh paint is asked for on both surfaces');
  ok(has("      el.style.outline = '1px solid transparent';"), 'through a property only paint reads');
  ok(has("        try{ el.style.outline = ''; }catch(_eRpBack){}"), 'that is taken back on the next frame');
  ok(!/translateZ/.test(rail) && !/translateZ/.test(grid), 'so nothing is put on a layer of its own');`],
  ['the carry-forward block reads the new shape',
    `  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }") ||
     has("if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }"),
    'a chip still holding a drag lift is still put back');`,
    `  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }" ) ||
     has("if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still holding a drag lift is still put back');`],
]);

fileSub('dev/railpaint-6423-check.cjs', [
  ['the probe records the paint request too',
    `        frames.push({ v: strip.style.visibility, t: strip.style.transform });`,
    `        frames.push({ v: strip.style.visibility, t: strip.style.transform, o: strip.style.outline });`],
  ['a healthy rail is asked to paint again, invisibly',
    `  ok('and a healthy rail is not re-rastered at all', !frames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(frames.slice(0, 3)));`,
    `  ok('and a healthy rail is asked to paint again, without a layer and without being hidden',
    frames.some((f) => /1px solid transparent/.test(f.o || '')) && !frames.some((f) => /translateZ/.test(f.t || '')),
    JSON.stringify(frames.slice(0, 3)));`],
  ['the drag case records it too',
    `        dragFrames.push({ t: strip.style.transform });`,
    `        dragFrames.push({ t: strip.style.transform, o: strip.style.outline });`],
  ['the chip clean-up is pinned as it now is',
    `    ok('a drag carry on a chip is still cleared', html.indexOf("if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }") !== -1);`,
    `    ok('a drag carry on a chip is still cleared', html.indexOf("if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }") !== -1);`],
  ['and a damaged rail really is repaired',
    `  ok('and that rail really was rastered again', dragFrames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(dragFrames.slice(0, 3)));`,
    `  ok('and that rail was asked to paint again', dragFrames.some((f) => /1px solid transparent/.test(f.o || '')), JSON.stringify(dragFrames.slice(0, 3)));`],
]);

fileSub('dev/chatvis-6422-check.cjs', [
  ['the grid probe records the paint request too',
    `        frames.push({ v: grid.style.visibility, t: grid.style.transform });`,
    `        frames.push({ v: grid.style.visibility, t: grid.style.transform, o: grid.style.outline });`],
  ['a healthy grid is asked to paint again, invisibly',
    `  ok('and a healthy grid is not re-rastered at all', !frames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(frames.slice(0, 3)));`,
    `  ok('and a healthy grid is asked to paint again, without a layer and without being hidden',
    frames.some((f) => /1px solid transparent/.test(f.o || '')) && !frames.some((f) => /translateZ/.test(f.t || '')),
    JSON.stringify(frames.slice(0, 3)));`],
  ['the drag case records it too',
    `        dragFrames.push({ t: grid.style.transform });`,
    `        dragFrames.push({ t: grid.style.transform, o: grid.style.outline });`],
  ['and a damaged grid really is repaired',
    `  ok('and that grid really was rastered again', dragFrames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(dragFrames.slice(0, 3)));`,
    `  ok('and that grid was asked to paint again', dragFrames.some((f) => /1px solid transparent/.test(f.o || '')), JSON.stringify(dragFrames.slice(0, 3)));`],
]);

fileSub('dev/notifgroup-6424-check.cjs', [
  ['the header is judged by what the page says, not by one release',
    `  ok('the header names the version and what it did', /v64\\./.test(headHdr.textContent) && /blink/i.test(headHdr.textContent), headHdr.textContent.slice(0, 60));`,
    `  // This probe describes the GROUP UI, so it reads the newest entry's own words
  // out of the page instead of pinning one release's wording.\n  const headTitle = (html.match(/const CHANGELOG = \\[\\n  \\{ version: '[^']+', date: '[^']+', title: '(.*?)', items:/) || [])[1] || '';\n  const headFirstNote = (html.match(/const CHANGELOG = \\[[\\s\\S]*?items: \\[\\n    '(.*?)',/) || [])[1] || '';\n  ok('the header names the version and what it did', /v64\\./.test(headHdr.textContent) && !!headTitle && headHdr.textContent.indexOf(headTitle) !== -1, headHdr.textContent.slice(0, 60));`],
  ['and so are the notes behind it',
    `  ok('so its notes are the ones you read first', headBody.textContent.indexOf('blink') !== -1);`,
    `  ok('so its notes are the ones you read first', !!headFirstNote && headBody.textContent.indexOf(headFirstNote.slice(0, 40)) !== -1, headBody.textContent.slice(0, 60));`],
]);

fileSub('dev/test-6642.mjs', [
  ['the rail asks the phone for the fresh paint',
    `  ok(has("    strip.style.transform = 'translateZ(0)';"),`,
    `  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');"),`],
  ['and the label says so',
    `    'by asking the compositor to raster the card again');`,
    `    'by asking the phone for a fresh paint of the card and its chips');`],
  ['without a layer of its own',
    `  ok(has("      requestAnimationFrame(function(){ try{ strip.style.transform = ''; }catch(_eRpr){} });"),`,
    `  ok(has("      el.style.outline = '1px solid transparent';"),`],
  ['and the label says that too',
    `    'and taking that back one frame later, without ever hiding it');`,
    `    'taken back one frame later, without ever hiding it or putting it on a layer');`],
  ['a chip still holding a drag lift is still put back',
    `  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }"),`,
    `  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),`],
]);

fileSub('dev/test-66422.mjs', [
  ['the grid is asked to paint again',
    `  ok(has("    wrap.style.transform = 'translateZ(0)';"),`,
    `  ok(has("    scRepaintSurface(wrap, '.home-bubble');"),`],
  ['and the label says so',
    `    'it promotes the grid to force a fresh raster');`,
    `    'it asks every bubble on the grid to paint again');`],
  ['through a paint-only property, not a layer',
    `  ok(has("    requestAnimationFrame(function(){${NL}      requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });"),`,
    `  ok(!/translateZ/.test(repaint) && has("      el.style.outline = '1px solid transparent';"),`],
  ['and the label says that too',
    `    'and takes the promotion back one frame later, so nothing stays on its own layer');`,
    `    'through a transparent outline, so nothing is put on a layer of its own');`],
]);

fileSub('dev/test-66421.mjs', [
  ['the grid is asked to paint again',
    `  ok(has("    wrap.style.transform = 'translateZ(0)';"),`,
    `  ok(has("    scRepaintSurface(wrap, '.home-bubble');"),`],
  ['and the label says so',
    `    'by forcing the grid to be rastered again');`,
    `    'by asking every bubble on the grid to paint again');`],
  ['through a paint-only property, not a layer',
    `  ok(has("    requestAnimationFrame(function(){${NL}      requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });"),`,
    `  ok(has("      el.style.outline = '1px solid transparent';"),`],
  ['and the label says that too',
    `    'and taking that back one frame later, with no layout and no hide');`,
    `    'through a transparent outline - paint only, so no layout and no hide');`],
]);

// ═══════════════════════════════════════════════════════════════════════════
// 7 - the version pins across the suite
// ═══════════════════════════════════════════════════════════════════════════
// A bump rewrites quoted version literals in every dev/test-*.mjs. Gates that
// describe an OLDER release read it by version with a regex and pin nothing
// here; the two that pinned this repair's shape were repinned above, before this
// sweep (so it has nothing left to do in them).
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  [OLD_VER + " heads the changelog", VER + " heads the changelog"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);
let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}
console.log('patch-66425: ' + repinned + ' version repin(s) across dev/test-*.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// verification - every claim above, checked against what was just written
// ═══════════════════════════════════════════════════════════════════════════
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
function must(cond, what) { if (!cond) problems.push(what); }
const has = (needle) => final.indexOf(needle) !== -1;
const mark = (l) => console.log('  ok ' + l);
const code = final.replace(/^\s*\/\/.*$/gm, '');
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

// 1 - the repair
must(has('  function scRepaint(el){'), 'the paint request is declared');
must(has("      el.style.outline = '1px solid transparent';"), 'and it is a paint-only property');
must(has("        try{ el.style.outline = ''; }catch(_eRpBack){}"), 'which is taken back on the next frame');
must(has('  function scRepaintSurface(root, sel){'), 'a surface helper is declared');
must(has("    scRepaintSurface(wrap, '.home-bubble');"), 'the grid repairs every bubble');
must(has("    scRepaintSurface(strip, '.pinned-artist-chip');"), 'the rail repairs every chip');
must(!/void (wrap|strip)\.offsetHeight/.test(code), 'no settled scroll lays the page out again');
const gridBody = sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){');
const railBody = sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){');
must(gridBody !== '' && railBody !== '', 'both repaints are still there');
must(!/visibility/.test(gridBody) && !/visibility/.test(railBody), 'neither ever hides its surface');
must(!/carried/.test(gridBody) && !/carried/.test(railBody), 'and neither waits for a drag to leave something behind');
must(!/translateZ/.test(gridBody) && !/translateZ/.test(railBody), 'nor puts the surface on a layer of its own');
must(!/offsetHeight|getBoundingClientRect/.test(gridBody) && !/offsetHeight|getBoundingClientRect/.test(railBody),
  'and neither measures anything');
must(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
  'a chip still holding a drag lift is still put back');
must(has("        b.classList.remove('hb-dragging');"), 'and so is a bubble still holding its drag lift');
must(has("      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); } }"),
  'and a dashed placeholder an abandoned drag left is still cleared');
must(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
  'a grid really missing a bubble is still drawn from the layout again');
must(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
  'and a rail really missing its chips is still built again');
if (gridBody === '' || railBody === '') {
  problems.push('the repair bodies could not be sliced apart for inspection');
} else {
  mark('the repair is invisible, unmeasured and unconditional on both surfaces');
}

// 2 - the dismissible finished cards
must(has('data-dismiss="watermark"'), 'the Watermarks-removed card can be dismissed');
must(has('data-dismiss="enrich"'), 'so can the song-details card');
must(has('data-dismiss="export"'), 'and the export card');
must(has("          else if(which === 'watermark' && typeof watermarkCleanState !== 'undefined' && watermarkCleanState){"),
  'and the handler clears the watermark state');
must(has('            watermarkCleanState.seen = true; watermarkCleanState.finishedAt = 0;'),
  'so the card has nothing left to draw');
must(has("        try{ updateNotifBadge(); }catch(_eDismissBadge){}"), 'and the bell badge is refreshed with it');
must(final.split('title="Tap to dismiss"').length - 1 === 3, 'every finished card says it is tappable');
must(has('>' + CROSS + '</span>'), 'and carries the glyph the app draws (not an escape)');
mark('a finished card leaves the moment it is tapped');

// 3 - the glide
const jumpBody = sliceC('  function jumpToPlayingSong(t){', '  let _scFocusTrackId = null;');
must(jumpBody.indexOf('smoothScrollIn(pane, row)') !== -1, 'the record tap scrolls through the shared engine');
must(jumpBody.indexOf('smoothScrollIn(pane, row, 220)') === -1, 'with the distance deciding the pace');
must(jumpBody.indexOf('renderListInner._scrollToPlaying = false;') !== -1, 'and the list\u2019s own auto-scroll switched off for it');
must(jumpBody.indexOf('cancelScrollAnim(pane)') === -1, 'so nothing has to be cancelled mid-flight');
must(jumpBody.indexOf('renderTabs();\n      renderList();') === -1, 'and the list is rendered once');
must(jumpBody.indexOf('scrollIntoView') === -1, 'and never outside the pane');
must(!/smoothScrollIn\([^)]*, ?(200|220|350)\)/.test(code), 'no record-tap scroll carries a hard-coded duration any more');
mark('the record tap is one glide, sized by distance');

// 4 - the list a reader sees
must(has('Tap a finished card on Home to dismiss it.'), 'Things to know covers the dismissable card');
must(has('The patch notes in the bell are grouped by version.'), 'the grouped notes');
must(has('<b>The library tools live together in Settings ' + ARROW + ' More.</b>'), 'where the cover tools live');
must(has('Every version keeps its own copy, so a rollback is two-way.'), 'and how rollback behaves');
must(has('glides to that song, in Albums the album it is in opens and glides to the song inside it'),
  'while the record-tap bullet describes the glide');
must(!/scrolls to that song in the list, in Albums it opens the album it is in/.test(final),
  'and no longer describes the old jump');
mark('Things to know says what the app does today');

// 5 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
if (block) {
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
  if (entries) {
    const head = entries[0];
    must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
    must(head.date === STAMP, 'stamped ' + STAMP + ' (' + head.date + ')');
    must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
    const notes = (head.items || []).join('\n');
    must((head.items || []).every((it) => it.length <= 260), 'every note is short (longest ' + Math.max(...(head.items || ['']).map((i) => i.length)) + ' chars)');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
    must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
    must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor carry a term the wider store list knows');
    must(/rollback/i.test(notes), 'while still saying what this release left alone');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    must(entries.some((e) => /^64\.2\.4$/.test(String(e.version))), 'and the release before it is still listed');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

if (problems.length) {
  console.error('\npatch-66425: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66425: all verification checks passed (' + edits + ' edit(s))');
