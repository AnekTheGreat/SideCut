#!/usr/bin/env python3
"""80.6.32 - pills that stop where you aimed, and a rail you can arrange.

    python3 dev/patch-80632.py
    python3 dev/patch-80632.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.

The owner: "make the pills easy to navigate / the dragging for the tabs at the
bottom and add the drag and hold thing nice to the right sub tabs as well".

  1. The playlist pills. The strip scrolled freely, so a flick left it parked
     between two pills with each name half on screen, and the pill you wanted was
     another swipe away. It snaps now, one pill at a time; each pill is taller so a
     thumb lands on it; and the strip stops snapping while a pill is being carried,
     or the snap would fight the finger rearranging it.

  2. The rail on the right. Its three glyphs were fixed in one order and a long
     press did nothing. They take the same hold-and-drag the bottom strip has - lift
     after 380ms, follow the finger, swap with a neighbour whose middle was passed -
     and the order is kept, so the page dragged to the top is at the top next launch.

The long-form account is in dev/release-entry.md.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.32'
OLD = '80.6.31'
MARKER = '80.6.32 - THE PILLS SNAP, AND THE RAIL CAN BE ARRANGED'
ANCHOR = '  // 80.6.31 - THE RAIL IS ON EVERY VERSION.'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80632: already on the page, the page is %s' % VERSION)
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


# -- 1. the release itself -------------------------------------------------------
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


# -- 2. the playlist pills stop where they were thrown ---------------------------
once('the pill strip snaps to a pill',
     "  .tab.active{ color:var(--bg); background:var(--gold); border-color:var(--gold); font-weight:600; }\n",
     "  .tab.active{ color:var(--bg); background:var(--gold); border-color:var(--gold); font-weight:600; }\n"
     "  /* 80.6.32 - A PILL STOPS WHERE YOU THREW IT. The strip scrolled freely, so a\n"
     "     flick left it parked between two pills with each name half cut off by an edge,\n"
     "     and the one you wanted was a second, smaller swipe away. It snaps now, one pill\n"
     "     at a time, and each pill is taller so a thumb can land on it first time. The\n"
     "     snapping is off while a pill is being carried - the strip would otherwise fight\n"
     "     the finger that is rearranging it - which is what body.sc-tab-drag says. */\n"
     "  #tabs{ scroll-snap-type: x proximity; scroll-padding: 0 20px; }\n"
     "  #tabs .tab{ scroll-snap-align: center; min-height: 38px; padding: 9px 16px; display: inline-flex; align-items: center; }\n"
     "  body.sc-tab-drag #tabs{ scroll-snap-type: none; }\n")

once('the strip stops snapping while a pill is carried',
     "      pressTimer = setTimeout(() => {\n"
     "        if(moved) return;\n"
     "        dragging = true;\n"
     "        el.setPointerCapture(e.pointerId);\n"
     "        el.style.opacity = '0.55';\n"
     "        el.style.zIndex = '5';\n"
     "      }, 380);",
     "      pressTimer = setTimeout(() => {\n"
     "        if(moved) return;\n"
     "        dragging = true;\n"
     "        el.setPointerCapture(e.pointerId);\n"
     "        el.style.opacity = '0.55';\n"
     "        el.style.zIndex = '5';\n"
     "        // 80.6.32 - no snapping under a carried pill.\n"
     "        document.body.classList.add('sc-tab-drag');\n"
     "      }, 380);")

once('and snaps again when it is let go',
     "    function endDrag(e){\n"
     "      clearTimeout(pressTimer);",
     "    function endDrag(e){\n"
     "      // 80.6.32 - the strip may snap again the moment nothing is being carried, and\n"
     "      // that includes a release that never became a drag.\n"
     "      document.body.classList.remove('sc-tab-drag');\n"
     "      clearTimeout(pressTimer);")

# -- 3. a glyph on the rail can be picked up -------------------------------------
once('the lifted glyph has a look',
     "      '#scShelfRail .scshelf-tab.on:active{transform:scale(.94)}',\n",
     "      '#scShelfRail .scshelf-tab.on:active{transform:scale(.94)}',\n"
     "      // 80.6.32 - A GLYPH CAN BE PICKED UP. Holding one for a moment lifts it out\n"
     "      // of the rail, and it rides the finger until it is dropped. touch-action:none\n"
     "      // is what makes that possible: the rail sits over the song list, and without\n"
     "      // it a vertical drag that starts on a glyph scrolls the list instead of moving\n"
     "      // the glyph. It costs nothing else - a tap still taps, and the gaps between\n"
     "      // the glyphs still pass the finger through to the song underneath.\n"
     "      '#scShelfRail .scshelf-tab{pointer-events:auto;touch-action:none}',\n"
     "      '#scShelfRail .scshelf-tab.lift{transform:scale(1.14);opacity:.92;z-index:3;',\n"
     "      'box-shadow:0 8px 20px rgba(0,0,0,.35)}',\n"
     "      'body.sc-rail-drag #scShelfRail .scshelf-tab{cursor:grabbing}',\n")

once('the page order is read from storage',
     "      var pages = [['library', 'Songs', 'list'], ['playlists', 'Playlists', 'plist'], ['albums', 'Albums', 'grid']];",
     "      // 80.6.32 - THE ORDER IS THE OWNER'S. The three glyphs used to be baked in this\n"
     "      // order with no way to change it; they are read from scShelfOrder() now, so a\n"
     "      // page dragged to the top of the rail is at the top of it next launch too.\n"
     "      var _pageMeta = { library: ['Songs', 'list'], playlists: ['Playlists', 'plist'], albums: ['Albums', 'grid'] };\n"
     "      var pages = scShelfOrder().map(function(id){ return [id, _pageMeta[id][0], _pageMeta[id][1]]; });")

HELPERS = (
    "  // 80.6.32 - A GLYPH CAN BE PICKED UP AND PUT SOMEWHERE ELSE. The rail's three pages\n"
    "  // are the library's pages, and the order they sit in is the order the owner reads\n"
    "  // them in. Holding one for a moment lifts it, dragging it past a neighbour swaps\n"
    "  // the two, and the order is written down; a drag never opens the page it carried.\n"
    "  var SC_RAIL_PAGES = ['library', 'playlists', 'albums'];\n"
    "  function scShelfOrder(){\n"
    "    // Whatever is stored is filtered against the three pages this build knows about,\n"
    "    // so a stale order from an older page - or a page that was renamed - cannot leave\n"
    "    // the rail empty or draw a glyph that opens nothing.\n"
    "    try{\n"
    "      var raw = JSON.parse(localStorage.getItem('sidecut_railOrder') || 'null');\n"
    "      if(Array.isArray(raw)){\n"
    "        var out = raw.filter(function(id){ return SC_RAIL_PAGES.indexOf(id) !== -1; });\n"
    "        SC_RAIL_PAGES.forEach(function(id){ if(out.indexOf(id) === -1) out.push(id); });\n"
    "        if(out.length === SC_RAIL_PAGES.length) return out;\n"
    "      }\n"
    "    }catch(_eRailOrder){}\n"
    "    return SC_RAIL_PAGES.slice();\n"
    "  }\n"
    "  function scShelfSaveOrder(){\n"
    "    try{\n"
    "      var ids = Array.prototype.map.call(\n"
    "        document.querySelectorAll('#scShelfRail .scshelf-tab[data-shelf]'),\n"
    "        function(b){ return b.getAttribute('data-shelf'); }\n"
    "      ).filter(function(id){ return SC_RAIL_PAGES.indexOf(id) !== -1; });\n"
    "      if(ids.length === SC_RAIL_PAGES.length){\n"
    "        localStorage.setItem('sidecut_railOrder', JSON.stringify(ids));\n"
    "      }\n"
    "    }catch(_eRailSave){}\n"
    "  }\n"
    "  function scRailDrag(b){\n"
    "    var rail = b.parentNode, hold = null, dragging = false, moved = false;\n"
    "    var startX = 0, startY = 0;\n"
    "    function stopHold(){ if(hold){ clearTimeout(hold); hold = null; } }\n"
    "    function drop(){\n"
    "      stopHold();\n"
    "      if(!dragging) return;\n"
    "      dragging = false;\n"
    "      b.classList.remove('lift');\n"
    "      b.style.transform = '';\n"
    "      document.body.classList.remove('sc-rail-drag');\n"
    "      // The release still lands as a click. data-dragged swallows that one and is\n"
    "      // cleared on a timer, so the glyph is tappable again straight afterwards.\n"
    "      b.setAttribute('data-dragged', '1');\n"
    "      setTimeout(function(){ b.removeAttribute('data-dragged'); }, 400);\n"
    "      scShelfSaveOrder();\n"
    "    }\n"
    "    b.addEventListener('pointerdown', function(e){\n"
    "      startX = e.clientX; startY = e.clientY; moved = false;\n"
    "      stopHold();\n"
    "      hold = setTimeout(function(){\n"
    "        if(moved) return;\n"
    "        dragging = true;\n"
    "        try{ b.setPointerCapture(e.pointerId); }catch(_eCap){}\n"
    "        b.classList.add('lift');\n"
    "        document.body.classList.add('sc-rail-drag');\n"
    "      }, 380);\n"
    "    });\n"
    "    b.addEventListener('pointermove', function(e){\n"
    "      if(!dragging){\n"
    "        // Anything past a thumb's jitter is a scroll, not a hold.\n"
    "        if(Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8){ moved = true; stopHold(); }\n"
    "        return;\n"
    "      }\n"
    "      b.style.transform = 'translateY(' + (e.clientY - startY) + 'px) scale(1.14)';\n"
    "      var r = b.getBoundingClientRect();\n"
    "      var mid = r.top + r.height / 2;\n"
    "      var sibs = Array.prototype.slice.call(rail.querySelectorAll('.scshelf-tab[data-shelf]'))\n"
    "        .filter(function(s){ return s !== b; });\n"
    "      for(var i = 0; i < sibs.length; i++){\n"
    "        var sr = sibs[i].getBoundingClientRect();\n"
    "        if(mid > sr.top && mid < sr.bottom){\n"
    "          if(mid < sr.top + sr.height / 2) rail.insertBefore(b, sibs[i]);\n"
    "          else rail.insertBefore(b, sibs[i].nextSibling);\n"
    "          // The glyph is already where the finger is, so the drag restarts from here\n"
    "          // rather than carrying the distance it just travelled a second time.\n"
    "          startY = e.clientY;\n"
    "          b.style.transform = '';\n"
    "          break;\n"
    "        }\n"
    "      }\n"
    "    });\n"
    "    function end(e){\n"
    "      drop();\n"
    "      // Unconditionally, the way the pill strip had to learn to: a capture left on a\n"
    "      // node that is no longer under the finger makes everything else ignore taps.\n"
    "      if(e && e.pointerId != null){ try{ b.releasePointerCapture(e.pointerId); }catch(_eRel){} }\n"
    "    }\n"
    "    b.addEventListener('pointerup', end);\n"
    "    b.addEventListener('pointercancel', end);\n"
    "    b.addEventListener('click', function(ev){\n"
    "      if(b.getAttribute('data-dragged') === '1'){\n"
    "        b.removeAttribute('data-dragged');\n"
    "        ev.stopImmediatePropagation();\n"
    "        ev.preventDefault();\n"
    "      }\n"
    "    }, true);\n"
    "  }\n"
)

once('the rail learns to carry a glyph',
     "  function scShelfRender(){",
     HELPERS + "  function scShelfRender(){")

once('a glyph is wired before it can be tapped',
     "      Array.prototype.forEach.call(rail.querySelectorAll('.scshelf-tab'), function(b){\n"
     "        b.addEventListener('click', function(){",
     "      Array.prototype.forEach.call(rail.querySelectorAll('.scshelf-tab'), function(b){\n"
     "        // 80.6.32 - wired first, because the guard that swallows the click at the end of\n"
     "        // a drag has to be the first listener on the glyph, or the page opens anyway.\n"
     "        if(b.getAttribute('data-shelf')) scRailDrag(b);\n"
     "        b.addEventListener('click', function(){")

# -- 4. the changelog ------------------------------------------------------------
ENTRY = (
    "  // 80.6.32 - THE PILLS SNAP, AND THE RAIL CAN BE ARRANGED. The owner: \"make the pills\n"
    "  // easy to navigate / the dragging for the tabs at the bottom and add the drag and hold\n"
    "  // thing nice to the right sub tabs as well\". The strip stops on a pill instead of\n"
    "  // between two, the pills are taller to hit, and the rail's three glyphs take the same\n"
    "  // hold-and-drag the strip has - with the order kept.\n"
    "  { version: '80.6.32', date: '{{STAMP}}', title: 'Pills that stop where you aimed, and a rail you can arrange', items: [\n"
    "    'The playlist pills stop one at a time now instead of drifting to a halt between two of them, so the name you were aiming for is the one you get.',\n"
    "    'Each pill is a little taller and wider, which makes the strip easier to hit and to read as it moves.',\n"
    "    'The rail on the right can be arranged: hold a glyph until it lifts, drag it past its neighbours, and the order you leave it in is the order it comes back in.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
if ANCHOR in SRC:
    once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)
else:
    failed.append('the changelog anchor for 80.6.31 is not on the page')

if failed:
    print('patch-80632: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80632: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80632: %d steps applied, page is %s' % (len(applied), VERSION))
