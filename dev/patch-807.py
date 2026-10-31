#!/usr/bin/env python3
"""80.7 - a collab is a drop, a fake release can be deleted, and the album
sheet opens in two seconds.

    python3 dev/patch-807.py
    python3 dev/patch-807.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

 1. THE COLLAB. fetchArtistReleases compared the FIRST name of a credit with the
    pinned artist, so a record filed under one artist and credited to both was
    thrown away when the pinned artist was not printed first - the Daddy Yankee x
    Diljit Dosanjh single never reached Diljit's list. A credit is a list of names
    now, and any credited name matching is enough.
 2. THE FAKE RELEASE. The Discover list dropped a row on a ~600ms hold, looked it
    up in one artist key only, and never asked. It is a two-second hold and a
    Delete button on every release surface, with Undo, and the delete goes through
    every stored copy of the drop.
 3. THE ALBUM SHEET. Both holds that open "Reorder Songs" were three seconds. They
    are two, and the sheet opens on the song that was held instead of the top.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7'
OLD = '80.6.32'
MARKER = '80.7 - A COLLAB IS A DROP'
ANCHOR = '  // 80.6.32 - THE PILLS SNAP, AND THE RAIL CAN BE ARRANGED.'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-807: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


# The two literals this release inserts live in patch-807-blocks.py - see the note
# at the top of that file for why.
BLOCKS = os.path.join(HERE, 'patch-807-blocks.py')
with open(BLOCKS, encoding='utf-8') as fh:
    exec(compile(fh.read(), BLOCKS, 'exec'), globals())


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- 1. the release itself ----------------------------------------------------
once('the version moves',
     "  const APP_VERSION = '%s';" % ODL,
     "  const APP_VERSION = '%s';" % VERSION)

# -- 2. a credit is a list ----------------------------------------------------
once('a credit is read as a list of names',
     "    const primary = name.split(/\\s*[,;&]|\\s+feat\\.?\\s+|\\s+ft\\.?\\s+|\\s+vs\\.?\\s+|\\s+x\\s+/i)[0].trim();\n"
     "    return primary || name;\n"
     "  }\n",
     "    const primary = name.split(/\\s*[,;&]|\\s+feat\\.?\\s+|\\s+ft\\.?\\s+|\\s+vs\\.?\\s+|\\s+x\\s+/i)[0].trim();\n"
     "    return primary || name;\n"
     "  }\n"
     "  // 80.7 - A COLLAB IS A DROP, WHEREVER IT IS FILED. primaryArtistName\n"
     "  // answers \"whose name is printed first\", and that is the wrong question for a\n"
     "  // catalog result: a collaboration is filed under one artist and credited to\n"
     "  // both, so the pinned artist sitting second was filtered out before listing.\n"
     "  // This splits a credit into every name it carries and puts each one to the\n"
     "  // same test the rest of the app uses - so \"Karan Aujla Tribute Band\" is still\n"
     "  // not Karan Aujla.\n"
     "  function scCreditNames(credit){\n"
     "    return String(credit == null ? '' : credit)\n"
     "      .split(/\\s*(?:,|&|;|\\/|\\bwith\\b|\\bfeat\\.?\\b|\\bft\\.?\\b|\\bfeaturing\\b|\\bvs\\.?\\b|\\band\\b|\\u00d7|\\sx\\s)\\s*/i)\n"
     "      .map(function(s){ return s.trim(); })\n"
     "      .filter(Boolean);\n"
     "  }\n"
     "  function scCreditHas(credit, artist){\n"
     "    if(!artist) return false;\n"
     "    var want = String(artist).trim();\n"
     "    return scCreditNames(credit).some(function(n){\n"
     "      return window.__scSameArtistName(n, want);\n"
     "    });\n"
     "  }\n")

once('the song pass stops asking who is printed first',
     "          primaryArtistName(r.artistName || '').toLowerCase().trim() === primaryArtistName(artist).toLowerCase().trim());",
     "          scCreditHas(r.artistName || '', artist));")

once('the album pass stops asking who is printed first',
     "            const rArtist = primaryArtistName(r.artistName || '').toLowerCase().trim();\n"
     "            const pArtist = primaryArtistName(artist).toLowerCase().trim();\n"
     "            // Same artist by name, never by substring: \"Karan Aujla Tribute\n"
     "            // Band\" is not Karan Aujla, and a remix album is not his drop.\n"
     "            if(!window.__scSameArtistName(rArtist, pArtist)) return;",
     "            // 80.7 - any credited name counts, not just the first: a\n"
     "            // collaboration album is filed under one name and credited to both.\n"
     "            // The test is still by name, never by substring.\n"
     "            if(!scCreditHas(r.artistName || '', artist)) return;")

# -- 3. the release rows carry the day the drop is filed under -----------------
once('a release row carries its day',
     'return `<div class="new-release-row" data-title="${escapeHtml(rel.title)}" data-artist=',
     'return `<div class="new-release-row" data-title="${escapeHtml(rel.title)}" data-date="${escapeHtml(rel.date || \'\')}" data-artist=')

# -- 4. the delete: two seconds, a button, every stored copy -------------------
once('the delete helpers land above the release list',
     "  function renderNewReleases(){\n    const sec = $('newReleasesSection');",
     HELPERS + "  function renderNewReleases(){\n    const sec = $('newReleasesSection');")

# The old hold is cut between two anchors instead of carried as a literal: forty
# lines of page text copied into this file would only be a place to mistype them.
HOLD_START = "    // Hold (~600ms) a release to remove it"
HOLD_END = "        // A tap opens the release page (cover, countdown, tracklist)"
HOLD_NEW = (
    "    // 80.7 - two seconds, then Delete. See scWireReleaseHold: one delegated\n"
    "    // hold for every release surface, and it deletes nothing without a button.\n"
    "    scWireReleaseHold();\n"
)
_hs = SRC.find(HOLD_START)
_he = SRC.find(HOLD_END, _hs) if _hs >= 0 else -1
if _hs >= 0 and _he > _hs:
    SRC = SRC[:_hs] + HOLD_NEW + SRC[_he:]
    applied.append('the six-hundred-millisecond hold is retired')
else:
    failed.append('the six-hundred-millisecond hold is not where it was')

# -- 5. the album reorder sheet: two seconds, and it opens on the held song ----
once('the row hold is two seconds',
     "      if(wasMoved || held < 2800) return;",
     "      if(wasMoved || held < 1800) return;")

once('the row hold timer is two seconds',
     "      // Three seconds (matching the delegated handler): long enough that a press\n"
     "      // cannot open the reorder sheet by accident.\n",
     "      // 80.7 - Two seconds (matching the delegated handler): long enough that\n"
     "      // a press cannot open the reorder sheet by accident, short enough that the\n"
     "      // sheet does not feel like a refused gesture.\n")

once('the row hold timer fires at two seconds',
     "      }, 3000);\n      addTracking();",
     "      }, 2000);\n      addTracking();")

once('the row hold hands the song to the sheet',
     "        if(typeof window.showAlbumReorderPopup === 'function') window.showAlbumReorderPopup(albumName);",
     "        if(typeof window.showAlbumReorderPopup === 'function') window.showAlbumReorderPopup(albumName, (row.dataset && row.dataset.id) || '');")

once('the delegated hold is two seconds',
     "  // Three full seconds, on purpose: a press this long cannot be an accident, so an\n",
     "  // Two full seconds, on purpose: a press this long cannot be an accident, so an\n")

once('the delegated hold timer is two seconds',
     "  var HOLD_MS = 3000;         // press length that opens the Reorder Songs sheet\n"
     "  var RELEASE_MIN_MS = 2800;  // a press this long still counts if Android cancels it early",
     "  var HOLD_MS = 2000;         // press length that opens the Reorder Songs sheet\n"
     "  var RELEASE_MIN_MS = 1800;  // a press this long still counts if Android cancels it early")

once('the delegated hold says two seconds',
     "      // The finger must still be on the screen when the three seconds are up.\n",
     "      // The finger must still be on the screen when the two seconds are up.\n")

once('the delegated hold hands the song to the sheet',
     "    try{ showAlbumReorderPopup(album); }",
     "    try{ showAlbumReorderPopup(album, (row && row.dataset && row.dataset.id) || ''); }")

once('the sheet takes the song it was opened for',
     "window.showAlbumReorderPopup = function(albumName){",
     "window.showAlbumReorderPopup = function(albumName, focusTrackId){")

once('the sheet opens on that song',
     "      row.appendChild(durDiv);\n      listEl.appendChild(row);\n",
     "      row.appendChild(durDiv);\n      listEl.appendChild(row);\n"
     "      // 80.7 - THE SONG YOU HELD IS THE ONE YOU SEE. The sheet builds from the\n"
     "      // top of the album, so holding the twelfth song opened a list that did not\n"
     "      // show it. It scrolls that row into the middle and lights it instead.\n"
     "      if(focusTrackId && !_focusDone && String(tt.id) === String(focusTrackId)){\n"
     "        _focusDone = true;\n"
     "        var _focusRow = row;\n"
     "        setTimeout(function(){\n"
     "          try{\n"
     "            var want = _focusRow.offsetTop - (listEl.clientHeight || 0) / 2 + (_focusRow.offsetHeight || 0) / 2;\n"
     "            listEl.scrollTop = Math.max(0, want);\n"
     "            _focusRow.style.background = 'rgba(227,178,60,0.20)';\n"
     "            setTimeout(function(){ try{ _focusRow.style.background = ''; }catch(_e){ } }, 900);\n"
     "          }catch(_e){ }\n"
     "        }, 30);\n"
     "      }\n")

once('the sheet only lights one row',
     "    if(!__origOrders[targetAlbumName]) __origOrders[targetAlbumName] = (targetAlbum.trackIds || []).slice();\n"
     "    listEl.innerHTML = '';\n",
     "    if(!__origOrders[targetAlbumName]) __origOrders[targetAlbumName] = (targetAlbum.trackIds || []).slice();\n"
     "    listEl.innerHTML = '';\n"
     "    var _focusDone = false;\n")

once('the sheet comment stops promising three seconds',
     "  /* No progress bar. A three-second hold used to draw a bar crawling across the\n"
     "     bottom of the row, which read as \"something is happening to my song\". The\n"
     "     armed tint above is the whole of the feedback now: tint means the press is\n"
     "     registered, the sheet simply opens when the three seconds are up. */",
     "  /* No progress bar. A hold used to draw a bar crawling across the bottom of the\n"
     "     row, which read as \"something is happening to my song\". The armed tint above\n"
     "     is the whole of the feedback: tint means the press is registered, and the\n"
     "     sheet opens when the two seconds are up. */")

# -- 6. the help text stops promising three seconds ---------------------------
once('the album help says two seconds (1)',
     "Hold a song for 3 seconds inside an album to reorder it.",
     "Hold a song for 2 seconds inside an album to reorder it.")

once('the album help says two seconds (2)',
     "Hold a song 3 seconds inside an album to reorder it; Done keeps, Cancel restores.",
     "Hold a song 2 seconds inside an album to reorder it; Done keeps, Cancel restores.")

once('the album help says two seconds (3)',
     "Hold a row <b>3 seconds</b> inside an album to reorder it.",
     "Hold a row <b>2 seconds</b> inside an album to reorder it.")

# -- 7. the changelog ---------------------------------------------------------
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
    "  // 80.7 - A COLLAB IS A DROP, A FAKE RELEASE CAN BE DELETED, AND THE ALBUM\n"
    "  // SHEET OPENS IN TWO SECONDS. The owner: a Daddy Yankee collab with Diljit\n"
    "  // Dosanjh \"didn't show up in new releases like it should have\", a fake release\n"
    "  // should go on a two-second hold and Delete, and the album sheet should open in\n"
    "  // two seconds instead of three - and be better for it.\n"
    "  { version: '80.7', date: '{{STAMP}}', title: 'Collabs filed under the other artist, a fake release you can delete, and the reorder sheet in two seconds', items: [\n"
    "    'A collaboration that is filed under the other artist\\'s name now shows up in New Releases: a credit is read as every name it carries, so pinning one artist finds the track they are credited second on.',\n"
    "    'A fake or mis-filed release can be deleted: hold it for two seconds, press Delete in the sheet that opens, and it leaves every New Releases surface with an Undo behind it. A tap still opens the release as before.',\n"
    "    'The album reorder sheet opens after two seconds instead of three, and it opens on the song you held - that row is scrolled into view and lit for a moment instead of the sheet starting at the top of the album.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
if ANCHOR in SRC:
    once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)
else:
    failed.append('the changelog anchor for 80.6.32 is not on the page')

if failed:
    print('patch-807: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-807: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-807: %d steps applied, page is %s' % (len(applied), VERSION))
