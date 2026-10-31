#!/usr/bin/env python3
"""80.6.28 - three pages, and the source says whose they are.

    python3 dev/patch-80628.py
    python3 dev/patch-80628.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.28'
OLD = '80.6.27'
MARKER = '80.6.28 - THREE PAGES, AND THE SOURCE SAYS WHOSE THEY ARE'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80628: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- 1. the rail is three pages -------------------------------------------------
swap('the rail has three pages',
     r'''      var pages = [['library', 'Library', 'list'], ['albums', 'Albums', 'grid']];
''',
     r'''      // 80.6.28 - THREE PAGES, AND THE SOURCE SAYS WHOSE THEY ARE. Playlists had no
      // page at all: the streaming lists were a row of chips under the shelf, so on
      // the source there was no button that showed all of them. Every page now
      // answers in the source that is on - the streaming songs, playlists and
      // albums, or the downloaded ones - and no glyph ever moves the source.
      var pages = [['library', 'Songs', 'list'], ['playlists', 'Playlists', 'plist'], ['albums', 'Albums', 'grid']];
''')

# -- 2. a glyph for it ----------------------------------------------------------
swap('the playlist glyph',
     "      list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10.5v2H4z',\n",
     "      list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10.5v2H4z',\n"
     "      // 80.6.28 - a playlist has its own glyph now that it has its own page: ruled\n"
     "      // lines with a mark beside each one, so it is not the library glyph again.\n"
     "      plist: 'M3 6h2.2v2.2H3zm4.4 0H21v2.2H7.4zM3 10.9h2.2v2.2H3zm4.4 0H21v2.2H7.4zM3 15.8h2.2v2.2H3zm4.4 0H21v2.2H7.4z',\n")

# -- 3. the third page is a page ------------------------------------------------
swap('the glyph opens the playlists page',
     "    var page = (tab === 'albums') ? 'albums' : 'library';\n",
     "    // 80.6.28 - SONGS, PLAYLISTS, ALBUMS. All three stay in the source that is on;\n"
     "    // the switch is still the only thing that changes it.\n"
     "    var page = (tab === 'albums') ? 'albums' : (tab === 'playlists') ? 'playlists' : 'library';\n")

# -- 4. and the painter knows it ------------------------------------------------
swap('the painter accepts the third page',
     "    var page = (scShelf.page === 'albums') ? 'albums' : 'library';\n",
     "    var page = (scShelf.page === 'albums') ? 'albums' : (scShelf.page === 'playlists') ? 'playlists' : 'library';\n")
swap('the downloaded pages land where they say',
     "    scShelf.open = false;\n    scShelfPage(false);\n",
     "    // 80.6.28 - ON THE DEVICE THE THREE PAGES ARE THE LIBRARY THREE. Songs is All\n"
     "    // Songs, Playlists is the strip it has always been, Albums is Albums. The Songs\n"
     "    // glyph used to land on whatever playlist was last used, which is not what the\n"
     "    // word says, so the three glyphs answered with two pages between them.\n"
     "    if(page === 'library'){\n"
     "      try{ if(typeof activePlaylist !== 'undefined') activePlaylist = 'All Songs'; }catch(_eAllSongs){}\n"
     "    }\n"
     "    scShelf.open = false;\n    scShelfPage(false);\n")

# -- 5. the streaming playlists page -------------------------------------------
PLAYLISTS_PAGE = r'''    // 80.6.28 - THE PLAYLISTS ARE A PAGE, THE WAY THE ALBUMS ARE. They lived as a row
    // of chips under the shelf, so there was no button that showed every streaming
    // playlist, and nothing on a page of its own to hold for two seconds.
    if(!open && scShelf.src === 's' && scShelf.page === 'playlists'){
      h += '<div style="' + card + '">';
      h += '<div style="display:flex;align-items:center;gap:8px;">';
      h += '<span style="font-size:13.5px;font-weight:700;">Streaming playlists</span>';
      h += '<span style="font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--coral);border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);border-radius:999px;padding:2px 7px;">From the source</span>';
      h += '<span style="flex:1;"></span>';
      h += '<button type="button" id="scStreamNewPl" style="background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:999px;padding:5px 10px;font-size:11px;">New playlist</button>';
      h += '</div>';
      h += '<div style="font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;">Playlists of songs that play from the source, and of files already on this device. Nothing on this page is downloaded. Hold a playlist for two seconds to delete it.</div>';
      h += scShelfGrid('pl', scStreamState.playlists || []);
      h += '<div id="scStreamSay" style="font-size:11px;color:var(--coral);min-height:14px;margin-top:8px;"></div>';
      h += '</div>';
      host.innerHTML = h;
      scStreamWire();
      scStreamTick();
      return;
    }
'''
swap('the streaming playlists page',
     "    // 80.6.13 - A PLAYLIST IS A PAGE. It shows the songs it holds with the cover,\n",
     PLAYLISTS_PAGE + "    // 80.6.13 - A PLAYLIST IS A PAGE. It shows the songs it holds with the cover,\n")

# -- 6. the pill halves follow the source --------------------------------------
swap('the library pill follows the source',
     r'''    if(plHalf) plHalf.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      navigate('playlists');
    });
    if(alHalf) alHalf.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      navigate('albums');
    });
''',
     r'''    if(plHalf) plHalf.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      // 80.6.28 - THE PILL BELONGS TO THE SOURCE THAT IS ON. These two halves set the
      // downloaded half and navigated behind the shelf, so while the source was up
      // they changed nothing you could see: the shelf stayed on the page it was on.
      if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab('library'); return; }
      navigate('playlists');
    });
    if(alHalf) alHalf.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab('albums'); return; }
      navigate('albums');
    });
''')
swap('the single pill flips the source pages',
     "    if(!useDiagonalSplit && !e.target.closest('#playlistsHalf') && !e.target.closest('#albumsHalf')){\n",
     "    if(!useDiagonalSplit && !e.target.closest('#playlistsHalf') && !e.target.closest('#albumsHalf')){\n"
     "      // 80.6.28 - in single-button mode the one pill flips the source pages too,\n"
     "      // instead of changing the downloaded half underneath the shelf.\n"
     "      if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab(scShelf.page === 'albums' ? 'library' : 'albums'); return; }\n")

# -- 7. the release itself ------------------------------------------------------
swap('the version moves',
     "  const APP_VERSION = '%s';" % OLD,
     "  const APP_VERSION = '%s';" % VERSION)


# The stamp is the Eastern wall clock of the moment the payload is applied, so a
# release never carries a date someone typed. EDT or EST comes off the date itself.
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
    "  // 80.6.28 - THE PAGES FOLLOW THE SOURCE. The owner, after the record release: the\n"
    "  // playlists and the albums should be in here in streaming, and the buttons should\n"
    "  // do what they say - streaming all, streaming playlists and albums, and the\n"
    "  // regular ones when the device is the source.\n"
    "  { version: '80.6.28', date: '{{STAMP}}', title: 'The pages follow the source', items: [\n"
    "    '[FULL] The side rail has three pages now - Songs, Playlists and Albums - and each one answers in the source that is on: the streaming songs, playlists and albums, or the downloaded ones.',\n"
    "    '[FULL] Streaming playlists have a page of their own, drawn as tiles with a cover, a name and a count, instead of a row of chips under the shelf.',\n"
    "    '[FULL] The Library pill halves follow the source too: on the source they open the source pages rather than changing the downloaded half behind the shelf.',\n"
    "    '[FULL] On the downloaded side each glyph lands where its name says - Songs opens All Songs, Playlists the playlist tabs, Albums the albums.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
swap('the changelog records the release',
     "  // 80.6.27 - THE RECORD PLAYER TAKES YOU TO THE SONG THAT IS PLAYING. The owner,",
     ENTRY + "  // 80.6.27 - THE RECORD PLAYER TAKES YOU TO THE SONG THAT IS PLAYING. The owner,")

if failed:
    print('patch-80628: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80628: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80628: %d steps applied, page is %s' % (len(applied), VERSION))
