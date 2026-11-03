#!/usr/bin/env python3
"""80.8 - hold a song, drag, and the run under the finger is the selection.

    python3 dev/patch-808.py
    python3 dev/patch-808.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHAT THE OWNER ASKED FOR. "Add a hold and drag to select songs, make it nice."

WHY IT WAS NOT THERE. Holding a row armed a timer that called openHoldChoice() the
moment it ran out - so the choice sheet arrived while the finger was still down, the
sheet's backdrop sat over the list, and the one finger that started the press had
nothing left to drag across. Picking a run of songs was: hold, choose "Select multiple
songs", then tap each row one at a time.

WHAT IT IS NOW. The hold arms the row (a tint and a short buzz) and the same finger
carries on into a drag that sweeps the run: down the list, or back up it, the range
follows the direction it is pulled from the row that was held. Rows light with the
selection styling as they are crossed and a count rides at the top of the screen while
the finger is still down. Lifting keeps the selection, so the existing row of actions
is already there. A hold that never moves still opens the sheet it always opened -
the count pill, the tint and the drag are the only things that are new.

The list is NOT re-rendered mid-drag: renderList() rebuilds every row, and doing that
under a moving finger takes the row the gesture started on out of the document. Rows
are painted in place (class + check) and the list is drawn once, properly, on lift.
The click that the lift itself sends to the row under the finger is swallowed, because
in select mode a click toggles and it would have undone the anchor.
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.8'
MARKER = '80.8 - A HOLD IS A PRESS THAT CARRIES ON'
ANCHOR = "  { version: '80.7.12',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-808: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


def span(name, start_marker, end_marker, new):
    """Replace everything from start_marker through the end of end_marker."""
    global SRC
    first = SRC.count(start_marker)
    last = SRC.count(end_marker)
    if first != 1 or last != 1:
        failed.append('%s: start %d, end %d, expected 1 and 1' % (name, first, last))
        return
    a = SRC.find(start_marker)
    b = SRC.find(end_marker, a)
    if b < 0:
        failed.append('%s: the end marker is before the start' % name)
        return
    b += len(end_marker)
    SRC = SRC[:a] + new + SRC[b:]
    applied.append(name)


# -- 1. the version ----------------------------------------------------------
once('the page says 80.8',
     "const APP_VERSION = '80.7.12';",
     "const APP_VERSION = '80.8';")

# -- 2. the look of a sweep, while it is happening ---------------------------
CSS = """  .track.selected{ background: rgba(255,111,89,0.12); }
  /* 80.8 - A SWEEP HAS TO BE VISIBLE WHILE IT HAPPENS. The row under the finger is
     tinted and lifts a hair the moment the hold arms, so the press is answered
     before anything moves; the rows the drag crosses take the selection styling
     the list already has, and the count rides at the top of the screen instead of
     in a bar under the list, because the finger is usually covering the list. */
  .track.sc-held{
    background: rgba(255,111,89,0.10);
    box-shadow: inset 0 0 0 1px rgba(255,111,89,0.55);
    transform: scale(0.99);
  }
  .track.selected .select-check{ animation: scCheckIn 140ms ease-out; }
  @keyframes scCheckIn{ from{ transform: scale(0.55); opacity:0.4; } to{ transform: scale(1); opacity:1; } }
  /* touch-action is pinned for the length of the sweep: without it Android hands
     the vertical gesture to the scroller the first time the finger travels, fires
     pointercancel, and the run ends at the second row. */
  body.scRanging{ -webkit-user-select:none; user-select:none; }
  body.scRanging .track, body.scRanging #listPane{ touch-action:none; overscroll-behavior:contain; }
  #scRangeCount{
    position:fixed; left:50%; top:calc(env(safe-area-inset-top, 0px) + 14px);
    transform:translateX(-50%) translateY(-6px); z-index:260;
    padding:7px 14px; border-radius:999px; background:rgba(22,22,22,0.94);
    border:1px solid var(--coral); color:var(--ink); font-size:12.5px; font-weight:600;
    opacity:0; transition:opacity 0.12s ease, transform 0.12s ease;
    pointer-events:none; box-shadow:0 6px 20px rgba(0,0,0,0.45);
  }
  #scRangeCount.on{ opacity:1; transform:translateX(-50%) translateY(0); }
"""
once('the sweep has a look', "  .track.selected{ background: rgba(255,111,89,0.12); }\n", CSS)

# -- 3. the gesture itself ---------------------------------------------------
BLOCK = """  // ---------------- Multi-select (hold, then drag) ----------------
  // 80.8 - A HOLD IS A PRESS THAT CARRIES ON. The timer used to open the choice
  // sheet the moment it ran out: the sheet's backdrop landed over the list while
  // the finger was still down, so the finger that started the press had nothing
  // left to drag across, and a run of songs meant hold, "Select multiple songs",
  // then one tap per row. The hold arms the row now and the same finger carries
  // on into a drag that sweeps the run from the row that was held. A hold that
  // never moves still opens the sheet - a press without a drag has not changed.
  let scHold = null;

  function scHoldRows(){
    var pane = $('listPane');
    return pane ? Array.prototype.slice.call(pane.querySelectorAll('.track')) : [];
  }
  function scHoldIndexOf(rows, id){
    for(var i = 0; i < rows.length; i++){ if(rows[i].dataset.id === id) return i; }
    return -1;
  }
  function scRangeCount(){
    var n = selectedIds.size;
    var el = document.getElementById('scRangeCount');
    if(!el){ el = document.createElement('div'); el.id = 'scRangeCount'; document.body.appendChild(el); }
    el.textContent = n + (n === 1 ? ' song selected' : ' songs selected');
    el.classList.add('on');
  }
  function scRangeCountOff(){
    var el = document.getElementById('scRangeCount');
    if(el) el.classList.remove('on');
  }
  function scRangePaint(){
    // PAINTED IN PLACE, NOT RE-RENDERED. renderList() rebuilds the pane, and a
    // rebuild under a moving finger takes the row the gesture started on out of
    // the document mid-drag - so the sweep would keep working off stale nodes.
    // Classes and checks only; the list is drawn once, properly, when it lifts.
    var rows = scHoldRows();
    for(var i = 0; i < rows.length; i++){
      var row = rows[i];
      var on = selectedIds.has(row.dataset.id);
      row.classList.toggle('selected', on);
      var check = row.querySelector('.select-check');
      var idx = row.querySelector('.idx');
      if(on && !check){
        check = document.createElement('div');
        check.className = 'select-check';
        row.insertBefore(check, row.firstChild);
        if(idx) idx.style.display = 'none';
      } else if(!on && check){
        check.remove();
        if(idx) idx.style.display = '';
        continue;
      }
      if(check) check.classList.toggle('checked', on);
    }
    scRangeCount();
  }
  function scRangeTo(id){
    if(!scHold || !scHold.anchor) return;
    var rows = scHoldRows();
    var a = scHoldIndexOf(rows, scHold.anchor);
    var b = scHoldIndexOf(rows, id);
    if(a < 0 || b < 0) return;
    var lo = Math.min(a, b), hi = Math.max(a, b), next = new Set();
    for(var i = lo; i <= hi; i++) next.add(rows[i].dataset.id);
    selectedIds = next;
    scHold.lastId = id;
    scRangePaint();
  }
  function scRangeRowAt(x, y){
    if(!document.elementFromPoint) return null;
    var el = document.elementFromPoint(x, y);
    var row = el && el.closest ? el.closest('.track') : null;
    if(row && scHold && scHold.pane && !scHold.pane.contains(row)) return null;
    return row;
  }
  function scRangeEdge(y){
    // The list is long and the finger cannot leave the screen: near either edge
    // the sweep scrolls the pane under itself, faster the closer it gets.
    var pane = scHold && scHold.pane;
    if(!pane || !pane.getBoundingClientRect) return;
    var box = pane.getBoundingClientRect(), edge = 64, step = 0;
    if(y < box.top + edge) step = -Math.max(4, Math.round((box.top + edge - y) / 4));
    else if(y > box.bottom - edge) step = Math.max(4, Math.round((y - (box.bottom - edge)) / 4));
    if(step) pane.scrollTop += step;
  }
  function scRangeNoTouch(ev){ if(scHold && scHold.swept) ev.preventDefault(); }
  function scHoldRelease(swept){
    if(!scHold) return;
    var state = scHold;
    scHold = null;
    clearTimeout(state.timer);
    document.body.classList.remove('scRanging');
    document.removeEventListener('touchmove', scRangeNoTouch, { passive: false });
    if(state.row) state.row.classList.remove('sc-held');
    window.removeEventListener('pointermove', state.onMove, true);
    window.removeEventListener('pointerup', state.onUp, true);
    window.removeEventListener('pointercancel', state.onCancel, true);
    scRangeCountOff();
    var pane = state.pane;
    if(swept){
      // The lift that ended the sweep still sends a click to the row under the
      // finger. In select mode a click toggles, so it would deselect the anchor
      // and leave the run one short - this one is swallowed, the next is a tap.
      if(pane){
        state.until = Date.now() + 500;
        var swallow = function(ev){
          if(Date.now() > state.until){ pane.removeEventListener('click', swallow, true); return; }
          ev.stopPropagation();
          ev.preventDefault();
        };
        pane.addEventListener('click', swallow, true);
        setTimeout(function(){ pane.removeEventListener('click', swallow, true); }, 700);
      }
      renderList();
      return;
    }
    if(state.armed && !selectMode && !reorderMode) openHoldChoice(state.id);
  }
  function attachLongPressChoice(row, id){
    row.addEventListener('pointerdown', (e) => {
      if(e.target.closest('.kebab-btn,.grip-handle,.select-check,.reorder-btns')) return;
      if(e.button && e.button !== 0) return;
      if(scHold) scHoldRelease(false);
      var state = {
        id: id, row: row, pane: $('listPane'), x: e.clientX, y: e.clientY,
        armed: false, dead: false, swept: false, anchor: id, lastId: id, timer: null, until: 0
      };
      state.onMove = function(ev){
        if(!scHold || scHold !== state) return;
        if(!state.swept){
          if(Math.abs(ev.clientX - state.x) <= 10 && Math.abs(ev.clientY - state.y) <= 10) return;
          // Moved before the hold armed: that is a scroll, not a selection.
          if(!state.armed){ state.dead = true; clearTimeout(state.timer); return; }
          state.swept = true;
          selectMode = true;
          selectedIds = new Set([state.id]);
          document.body.classList.add('scRanging');
          document.addEventListener('touchmove', scRangeNoTouch, { passive: false });
          if(state.row) state.row.classList.remove('sc-held');
          if(navigator.vibrate) navigator.vibrate([0, 8, 30, 8]);
          scRangePaint();
        }
        ev.preventDefault();
        scRangeEdge(ev.clientY);
        var over = scRangeRowAt(ev.clientX, ev.clientY);
        if(over && over.dataset.id && over.dataset.id !== state.lastId) scRangeTo(over.dataset.id);
      };
      state.onUp = function(){ scHoldRelease(!!state.swept); };
      state.onCancel = function(){ scHoldRelease(!!state.swept); };
      state.timer = setTimeout(function(){
        if(scHold !== state || state.dead) return;
        state.armed = true;
        if(state.row) state.row.classList.add('sc-held');
        if(navigator.vibrate) navigator.vibrate(12);
      }, 320);
      scHold = state;
      window.addEventListener('pointermove', state.onMove, true);
      window.addEventListener('pointerup', state.onUp, true);
      window.addEventListener('pointercancel', state.onCancel, true);
    });
  }
"""

OLD_START = "  function attachLongPressChoice(row, id){"
OLD_END = "    row.addEventListener('pointercancel', () => clearTimeout(timer));\n  }\n"
span('the hold arms instead of opening the sheet', OLD_START, OLD_END, BLOCK)

# -- 4. the changelog --------------------------------------------------------

def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.8 - A HOLD IS A PRESS THAT CARRIES ON.\n"
    "  { version: '80.8', date: '{{STAMP}}', title: 'Hold and drag to pick a run of songs', items: [\n"
    "    '[FULL] Holding a song and dragging down or up the list selects that whole run, from the row you held to the row under your finger.',\n"
    "    '[FULL] The count rides at the top of the screen while the drag is happening, so the number is readable under your thumb.',\n"
    "    '[FULL] Lifting keeps the selection and the actions are already there; a hold that does not move still opens the same menu.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-808: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-808: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-808: %d steps applied, page is %s' % (len(applied), VERSION))
