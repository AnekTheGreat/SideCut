#!/usr/bin/env python3
"""80.6.29 - one Library pill, and a rail that holds still.

    python3 dev/patch-80629.py
    python3 dev/patch-80629.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.
The blocks being replaced are found by their first and last line rather than
restated, so this file carries the new text and the reason, not a copy of the old.
The long-form diagnosis is in dev/release-entry.md.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.29'
OLD = '80.6.28'
MARKER = '80.6.29 - ONE LIBRARY PILL, A RAIL YOU CAN SEE THROUGH'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80629: already on the page, the page is %s' % VERSION)
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


def cut(name, start, end, new):
    """Replace the whole block from `start` through the first `end` after it."""
    global SRC
    i = SRC.find(start)
    if i < 0:
        failed.append(name + ': start not found')
        return
    j = SRC.find(end, i + len(start))
    if j < 0:
        failed.append(name + ': end not found')
        return
    SRC = SRC[:i] + new + SRC[j + len(end):]
    applied.append(name)


# -- 1. the dock tab is one Library pill ---------------------------------------
cut('the dock tab is one Library pill',
    '  <button id="libraryBtn" class="action-pill" style="position:relative;overflow:hidden;padding:0;cursor:pointer;">',
    '\n</button>\n',
    '''  <!-- 80.6.29 - ONE LIBRARY PILL. The dock tab was one pill cut corner to corner
       into Library and Albums since 70.0, and the owner asked for the word back:
       "make the bottom tab with the diagonal of library and albums just Library".
       The route the Albums half carried is not lost - the library's own Albums tab
       is still there, the side rail's Albums page is one tap away on the full build,
       and this pill opens the source's songs page first when the source is on. -->
  <button id="libraryBtn" class="action-pill">Library</button>
''')

cut('the pill takes the plain tab shape',
    '#libraryBtn{ flex: 1.18 1 0;',
    '#albumsHalf span{ font-size: 9.5px; }\n',
    '''/* 80.6.29 - the Library tab shares the row like the other tabs do now that it is
   not carrying two names on one pill. */
#libraryBtn{ flex: 1 1 0; border-radius: 13px; }
''')

cut('nothing is left to wire on the halves',
    "    var plHalf = document.getElementById('playlistsHalf');",
    "    var alHalf = document.getElementById('albumsHalf');\n",
    '''    // 80.6.29 - THE HALVES ARE GONE. The dock tab is one Library pill, so there is
    // no #playlistsHalf or #albumsHalf to wire; the two guarded blocks below do
    // nothing, and the boot flags this block sets are still what the page reads.
    var plHalf = null, alHalf = null;
''')

cut('the Library pill follows the source',
    '    // In single-button mode, toggle between playlists/albums on click',
    '      return;\n    }\n',
    '''    // 80.6.29 - ONE TAB, AND IT BELONGS TO THE SOURCE THAT IS ON. The pill used to be
    // cut in two and each half set a different downloaded page; with one pill there is
    // no half to choose, so on the source it opens the source's songs page (where the
    // playlists and albums pages are one glyph away) and on the device it falls
    // through to the library exactly as before.
    if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab('library'); return; }
''')

# -- 2. the split's own switch retires with it ---------------------------------
cut('the split mode has nothing to apply',
    '  function applyLibraryButtonMode(){',
    '\n  }\n',
    '''  // 80.6.29 - THE DOCK TAB IS ONE LIBRARY PILL, so this has nothing left to apply.
  // It used to hide the two halves and append a "🎵 Playlists ▾" label when the split
  // setting was off - and that label would now write over the word the pill carries,
  // which is the one thing the owner asked for. It is kept as the one place the dock
  // mode is applied, and it applies nothing; navigate() keeps calling it, and an
  // install with the old setting saved simply sees no difference.
  function applyLibraryButtonMode(){}
''')

# -- 3. the setting that described the split becomes the rail's glass ----------
cut('the split card becomes the rail card',
    '      <div class="sc-set-card">\n        <div class="sc-set-head" id="collapsibleSplit"',
    '\n      </div>\n',
    '''      <!-- 80.6.29 - THE SPLIT CARD IS THE RAIL'S GLASS NOW. A switch that splits a
           dock tab has nothing to split: that tab is one Library pill. The rail it
           was sitting beside does have one thing worth a setting - how much of the
           songs behind it you can see through it. -->
      <div class="sc-set-card" id="scRailGlassCard">
        <div class="sc-set-head" id="collapsibleRail" role="button" tabindex="0" aria-expanded="false">
          <span class="sc-set-title">Streaming rail</span>
          <span id="railGlassVal" style="font-size:11px; font-weight:600; color:var(--ink-dim);">85% see-through</span>
          <span id="collapseRailIcon" class="sc-set-chev">▾</span>
        </div>
        <div class="sc-set-body" id="collapsibleRailContent" style="display:none;">
          <input type="range" id="railGlassSlider" min="0" max="100" step="5" value="85" style="width:100%; accent-color:var(--coral);">
          <div style="font-size:11.5px; color:var(--ink-dim); line-height:1.6; margin-top:8px;">How much of the songs behind the side rail you can see through it. 85% is the default; 0 is a solid rail and 100 leaves only the glyphs, which stay solid either way.</div>
        </div>
      </div>
''')

once('the rail card opens and closes',
     "  setupCollapsible('collapsibleSplit', 'collapsibleSplitContent', 'collapseSplitIcon');\n",
     "  setupCollapsible('collapsibleRail', 'collapsibleRailContent', 'collapseRailIcon');\n")

# -- 4. the setting itself ------------------------------------------------------
once('the rail remembers how see-through it is',
     '''  // Diagonal split toggle
  var useDiagonalSplit = localStorage.getItem('sidecut_diagonalSplit') !== 'false'; // default true
''',
     '''  // 80.6.29 - THE RAIL'S GLASS. The rail is a fixed pill laid over the songs, and at
  // 96% of the raised background it was a slab on top of them. It is 85% see-through by
  // default and Tools moves it: 0 is solid, 100 leaves only the glyphs. The weight is
  // written as ONE CSS variable rather than as a rule on the rail, so it holds for a
  // rail that has not been built yet, and the choice is remembered.
  var railSee = 85;
  try{
    var _railSeeSaved = parseInt(localStorage.getItem('sidecut_railSee'), 10);
    if(isFinite(_railSeeSaved)) railSee = Math.max(0, Math.min(100, _railSeeSaved));
  }catch(_eRailSee){}
  function scRailSee(v){
    var n = Number(v);
    railSee = isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 85;
    // 100 see-through is 0 solid, and the rail's own CSS mixes its background with
    // transparent at that weight. Nothing else about the rail changes: no blur comes
    // back with it (80.6.25 took that off a fixed pill for judder).
    try{ document.documentElement.style.setProperty('--scshelf-solid', (100 - railSee) + '%'); }catch(_eRailVar){}
    var val = document.getElementById('railGlassVal');
    if(val) val.textContent = railSee + '% see-through';
    var sl = document.getElementById('railGlassSlider');
    if(sl && String(sl.value) !== String(railSee)) sl.value = String(railSee);
    // The rail is only in the full builds, so the row that sets it is only there too.
    var card = document.getElementById('scRailGlassCard');
    if(card && typeof SC_STREAM_OK !== 'undefined' && !SC_STREAM_OK) card.style.display = 'none';
  }
  try{ scRailSee(railSee); }catch(_eRailSeeInit){}
  (function(){
    var sl = document.getElementById('railGlassSlider');
    if(!sl) return;
    // Live while the thumb moves, saved when it comes off - a slider that only wrote
    // localStorage would leave the rail looking solid until the app was reopened.
    sl.addEventListener('input', function(){ try{ scRailSee(this.value); }catch(_eRailMove){} });
    sl.addEventListener('change', function(){
      try{ scRailSee(this.value); localStorage.setItem('sidecut_railSee', String(railSee)); }catch(_eRailSave){}
    });
  })();
  // 80.6.29 - THE SPLIT SETTING IS RETIRED, NOT FORGOTTEN. It is still read so an
  // install that has it saved keeps its value; there is no split left to apply it to.
  var useDiagonalSplit = localStorage.getItem('sidecut_diagonalSplit') !== 'false';
''')

# -- 5. the rail holds still ----------------------------------------------------
cut('the rail belongs to the page, not to the library box',
    '  function scShelfRender(){',
    "    if(!rail) return;\n",
    '''  function scShelfRender(){
    if(!SC_STREAM_OK) return;                 // no rail, no sheet, outside the full builds
    var rail = document.getElementById('scShelfRail');
    if(!rail) return;
    // 80.6.29 - THE RAIL CANNOT BE MOVED BY THE PAGE IT SITS ON. Every view that
    // arrives plays .sc-view-in, and that is an animation on transform - and a
    // transformed ancestor becomes the containing block for a fixed child. So for the
    // length of every page change, `top:50%` meant half of the library's WHOLE scroll
    // height instead of half the screen: the rail dropped into the middle of the list
    // and slid back, once per tap of a glyph. On the body there is no view above it to
    // borrow a transform from, so 50% is the screen and it stays there.
    if(rail.parentNode !== document.body){ document.body.appendChild(rail); }
''')

once('the rail is shown and hidden with the library',
     "    $('library').style.display = isLibrary ? 'flex' : 'none';\n",
     "    $('library').style.display = isLibrary ? 'flex' : 'none';\n"
     "    // 80.6.29 - the rail lives on the body now (scShelfRender puts it there), so it\n"
     "    // is shown and hidden with the library rather than being hidden by it.\n"
     "    try{ var _railEl = document.getElementById('scShelfRail'); if(_railEl) _railEl.style.display = isLibrary ? '' : 'none'; }catch(_eRailEl){}\n")

once('the rail is glass, not a slab',
     '''      // thumb scrolls the songs under it. At 96% the background is the pill.
''',
     '''      // thumb scrolls the songs under it. The background is a mix now, and the weight
      // is the owner's (see the rail setting in Tools).
''')

once('the rail background is the setting',
     "      'background:color-mix(in srgb, var(--bg-raised) 96%, #000);',\n",
     "      // 80.6.29 - 85% SEE-THROUGH BY DEFAULT. 96% of the raised background is a slab\n"
     "      // laid over the songs; this is the same colour mixed with transparent at whatever\n"
     "      // weight Tools is set to, 15% unless the owner moves it. The border stays: an\n"
     "      // edge is what says the glyphs are a rail and not loose icons over the cover art.\n"
     "      'background:color-mix(in srgb, var(--bg-raised) var(--scshelf-solid, 15%), transparent);',\n")

# -- 6. the release itself -------------------------------------------------------
once('the version moves',
     "  const APP_VERSION = '%s';" % OLD,
     "  const APP_VERSION = '%s';" % VERSION)


def eastern():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.6.29 - ONE LIBRARY PILL, A RAIL YOU CAN SEE THROUGH, AND A RAIL THAT HOLDS STILL.\n"
    "  // The owner: the bottom tab cut between library and albums should be just Library,\n"
    "  // the side rail should be 85% see-through with the amount adjustable in Tools, and it\n"
    "  // should stop moving down every time he moves between its pages.\n"
    "  { version: '80.6.29', date: '{{STAMP}}', title: 'One Library pill, and a rail that holds still', items: [\n"
    "    'The dock tab is one Library pill: the diagonal it shared with Albums is gone, and the library\u2019s own Albums tab still has the albums.',\n"
    "    '[FULL] The side rail is 85% see-through by default, and Tools has a slider for it - solid at one end, only the glyphs at the other.',\n"
    "    '[FULL] The rail holds its place. Bringing a view in animates a transform, and a transformed ancestor is the box a fixed pill is measured from, so the rail dropped into the middle of the list on every page change.',\n"
    "    '[FULL] On the source the Library pill opens the streaming songs page first, the way its two halves used to; on the device it opens the library as before.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
once('the changelog records the release',
     "  // 80.6.28 - THE PAGES FOLLOW THE SOURCE. The owner, after the record release: the",
     ENTRY + "  // 80.6.28 - THE PAGES FOLLOW THE SOURCE. The owner, after the record release: the")

if failed:
    print('patch-80629: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80629: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80629: %d steps applied, page is %s' % (len(applied), VERSION))
