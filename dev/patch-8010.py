#!/usr/bin/env python3
"""80.10 - add to an album shows the albums that exist, and the sheet stays on screen.

    python3 dev/patch-8010.py
    python3 dev/patch-8010.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHAT THE OWNER SAID. "these albums don't exist it should be from existing albums or create
a new album downloaded albums btw, also it shouldn't be cut off".

THE ALBUMS THAT DID NOT EXIST. The shelf keeps its own store for the lists it makes -
streamPlaylists and streamAlbums - and the "Add to an album" sheet offered NOTHING but
that store. On a device whose albums were all made the way albums are made in this app
(Select songs -> Create album, or a song's Add to albums), the sheet answered with one
made-up entry or none at all, while the album the owner actually wanted sat on the Albums
page, invisible to it. Worse, the row popup's own Add to an album went straight to a
text prompt and filed the song under whatever was typed: that is how an album that is in
no library came to exist, holding one song, wearing a name nothing else knows. And the
page drew a tile for EVERY list in the store, so lists that had lost their songs - or
were made and never filled - were drawn as albums with a count of 0: squares that open
nothing, on a page whose subject is albums.

THE PART THAT WAS CUT OFF. scStreamSheet() anchors its panel to the bottom edge and
appends one row per choice with no height limit and no scroller. Past about a dozen rows
the panel grew upwards off the top of the screen, so the first albums - and the choice
that makes a new one, which is always last - could not be reached at all. The downloads
picker, which lists up to sixty songs, was clipped on every device. The panel now stops
at the height of the screen and the rows scroll inside it; the title and Cancel stay put.

WHAT LANDED. (1) scStreamSheet() is a flex column capped at the screen: the choices live
in a scrolling body, the header and Cancel are pinned. (2) scStreamPickList() offers the
albums that exist: the ones on the Albums page first, with how many songs each holds
("... - 12 on device"), then the lists from the source that actually hold something, and
a new album as the last choice. (3) A song filed under a name that exists on the Albums
page goes into this shelf's list of that same name, so one name stays one album instead
of a second album being invented beside it. (4) A list with no songs is not offered and
not drawn. (5) The row popup's Add to an album opens that chooser instead of typing a
name. (6) A tile's name wraps to two lines instead of being cut to one.

WHAT IS NOT TOUCHED. The two stores stay two stores: an album on the device is a set of
file ids (userAlbums), a list here carries entries that can be a song from the source or
a file. This release makes the chooser speak both, it does not merge them.
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.10'
MARKER = '80.10 - THE ALBUM CHOOSER SHOWS THE ALBUMS THAT EXIST'
ANCHOR = "  { version: '80.9',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8010: already on the page, the page is %s' % VERSION)
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


# -- 1. the version ----------------------------------------------------------
once('the page says 80.10',
     "const APP_VERSION = '80.9';",
     "const APP_VERSION = '80.10';")

# -- 2. the sheet is as tall as the glass, and scrolls ------------------------
SHEET_OLD = r"""    var m = document.createElement('div');
    m.className = 'modal';
    m.style.cssText = 'width:100%;max-width:460px;margin:0;border-radius:18px 18px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));';
    var hd = document.createElement('h3');
    hd.style.cssText = 'margin:0 0 4px;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    hd.textContent = String(title || '');
    m.appendChild(hd);
"""

SHEET_NEW = r"""    var m = document.createElement('div');
    m.className = 'modal';
    // 80.10 - A SHEET IS AS TALL AS THE GLASS, NOT AS TALL AS ITS LIST. This panel is
    // anchored to the bottom edge and it appended one row per choice, so a long list -
    // twenty albums, sixty downloads - grew UPWARDS past the top of the screen: the
    // first rows, and the choice that makes a new album, were off the glass with
    // nothing to scroll. It stops at the height of the screen now and the rows scroll
    // inside it; the title and Cancel stay where they are.
    m.style.cssText = 'width:100%;max-width:460px;margin:0;border-radius:18px 18px 0 0;'
      + 'padding:14px 14px calc(14px + env(safe-area-inset-bottom));'
      + 'display:flex;flex-direction:column;max-height:calc(100vh - 18px);max-height:calc(100dvh - 18px);';
    var hd = document.createElement('h3');
    hd.style.cssText = 'margin:0 0 4px;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 0 auto;';
    hd.textContent = String(title || '');
    m.appendChild(hd);
    var body = document.createElement('div');
    body.style.cssText = 'flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;';
    m.appendChild(body);
"""

once('the sheet stops at the screen and scrolls', SHEET_OLD, SHEET_NEW)

once('its rows go in the scrolling body',
     """      b.addEventListener('click', function(){ scStreamSheetClose(); try{ a.run(); }catch(_eAct){} });
      m.appendChild(b);
    });
""",
     """      b.addEventListener('click', function(){ scStreamSheetClose(); try{ a.run(); }catch(_eAct){} });
      body.appendChild(b);
    });
""")

once('Cancel stays pinned under the rows',
     """    c.style.cssText = 'display:block;width:100%;margin-top:8px;background:none;border:1px solid var(--line);border-radius:12px;'""",
     """    c.style.cssText = 'flex:0 0 auto;display:block;width:100%;margin-top:8px;background:none;border:1px solid var(--line);border-radius:12px;'""")

# -- 3. the album chooser lists the albums that exist ------------------------
PICK_OLD = r"""  function scStreamPickList(kind, id){
    var t = scStreamEntry(id);
    if(!t){ scStreamSay('That song is not in Streaming any more'); return; }
    var isAl = (kind === 'al');
    var lists = isAl ? scStreamAlbums() : (scStreamState.playlists || []);
    var acts = [];
    (lists || []).forEach(function(p){
      var name = String((p && p.name) || '');
      var n = ((p && p.items) || []).length;
      acts.push({ label: name + ' \u00b7 ' + n + ' song' + (n === 1 ? '' : 's'), run: function(){
        if(isAl) scStreamState.albums = scLibAdd(scStreamAlbums(), name, t);
        else scStreamState.playlists = scLibAdd(scStreamState.playlists || [], name, t);
        scStreamSave();
        scStreamRender();
        scStreamSay('In \u201c' + name + '\u201d');
      } });
    });
    acts.push({ label: (isAl ? 'New album' : 'New playlist') + '\u2026', run: function(){
      if(isAl) scStreamToAlbum(id); else scStreamToPlaylist(id);
    } });
    scStreamSheet(isAl ? 'Add to an album' : 'Add to a playlist', acts);
  }
"""

PICK_NEW = r"""  // 80.10 - THE ALBUMS THAT EXIST, AND A NEW ONE IF YOU WANT IT.
  // This sheet used to offer only the store this shelf keeps for itself, so a device
  // whose albums were all made in the app answered with one made-up entry or none,
  // while the album the owner wanted sat on the Albums page out of its reach. The last
  // choice typed a name into a second store, which is exactly how an album that is in
  // no library came to exist. It lists your albums first, with how many songs each
  // holds, then the lists that actually hold something, then a new album.
  function scStreamDeviceAlbums(){
    var out = [];
    try{
      if(typeof userAlbums === 'undefined' || typeof visibleAlbumNames !== 'function') return out;
      var names = visibleAlbumNames();
      if(typeof scAlbumCardOrder === 'function'){
        names = scAlbumCardOrder(names, function(n){ var e = userAlbums[n]; return (e && e.artist) || ''; });
      }
      names.forEach(function(n){
        var e = userAlbums[n];
        if(!e || !Array.isArray(e.trackIds) || !e.trackIds.length) return;
        out.push({ name: String(n), n: e.trackIds.length });
      });
    }catch(_eDevAlb){}
    return out;
  }
  function scStreamPickList(kind, id){
    var t = scStreamEntry(id);
    if(!t){ scStreamSay('That song is not in Streaming any more'); return; }
    var isAl = (kind === 'al');
    var lists = isAl ? scStreamAlbums() : (scStreamState.playlists || []);
    var acts = [];
    var seen = {};
    // A list that holds nothing is not a place a song can go, and it is not an album
    // either - an empty square was one of the albums that did not exist.
    (lists || []).forEach(function(p){
      var name = String((p && p.name) || '');
      var n = ((p && p.items) || []).length;
      if(!name || !n) return;
      seen[name.toLowerCase()] = 1;
      acts.push({ label: name + ' \u00b7 ' + n + ' song' + (n === 1 ? '' : 's'), run: function(){
        if(isAl) scStreamState.albums = scLibAdd(scStreamAlbums(), name, t);
        else scStreamState.playlists = scLibAdd(scStreamState.playlists || [], name, t);
        scStreamSave();
        scStreamRender();
        scStreamSay('In \u201c' + name + '\u201d');
      } });
    });
    if(isAl){
      scStreamDeviceAlbums().forEach(function(a){
        var key = String(a.name || '').toLowerCase();
        if(!key || seen[key]) return;
        seen[key] = 1;
        acts.push({ label: a.name + ' \u00b7 ' + a.n + ' on device', run: function(){
          // THE ALBUM IS THE ONE YOU HAVE. Filing a song under a name that is already
          // an album on the Albums page keeps one name for the album: this shelf's list
          // carries what plays from the source, the page carries what is on the device,
          // and neither invents a third album beside them.
          scStreamState.albums = scLibAdd(scStreamAlbums(), a.name, t);
          scStreamSave();
          scStreamRender();
          scStreamSay('In \u201c' + a.name + '\u201d');
        } });
      });
    }
    if(!acts.length){
      acts.push({ label: isAl ? 'No albums yet - make the first one' : 'No playlists yet - make the first one', run: function(){} });
    }
    acts.push({ label: (isAl ? 'New album' : 'New playlist') + '\u2026', run: function(){
      if(isAl) scStreamToAlbum(id); else scStreamToPlaylist(id);
    } });
    scStreamSheet(isAl ? 'Add to an album' : 'Add to a playlist', acts);
  }
"""

once('the album chooser lists the albums that exist', PICK_OLD, PICK_NEW)

# -- 4. an album with no songs is not drawn ---------------------------------
GRID_OLD = r"""  function scShelfGrid(kind, list){
    var isAl = (kind === 'al');
    if(!(list || []).length){
      return '<div style="font-size:11.5px;color:var(--ink-dim);margin-top:10px;line-height:1.5;">'
        + (isAl ? 'No streaming albums yet. Make one here, then add songs to it from the shelf or from a row popup.'
                : 'No streaming playlists yet. Make one on the shelf, then add songs to it.') + '</div>';
    }
    var h = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;">';
    (list || []).forEach(function(p){
      var items = (p && p.items) || [];
"""

GRID_NEW = r"""  function scShelfGrid(kind, list){
    var isAl = (kind === 'al');
    // 80.10 - AN ALBUM WITH NO SONGS IS NOT AN ALBUM. A tile was drawn for every list
    // in the store, so the page could fill with squares that open nothing - lists made
    // and never filled, or ones whose songs had gone - each wearing a count of 0. Only
    // the ones that hold something are drawn now.
    var draw = (list || []).filter(function(p){ return !isAl || (((p && p.items) || []).length > 0); });
    if(!draw.length){
      return '<div style="font-size:11.5px;color:var(--ink-dim);margin-top:10px;line-height:1.5;">'
        + (isAl ? 'No albums yet. Make one here, or add a song to an album you already have.'
                : 'No playlists yet. Make one on the shelf, then add songs to it.') + '</div>';
    }
    var h = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;">';
    draw.forEach(function(p){
      var items = (p && p.items) || [];
"""

once('an album with no songs is not drawn', GRID_OLD, GRID_NEW)

once('a tile name wraps instead of being cut to one line',
     """      h += '<div style="font-size:12px;font-weight:600;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(name) + '</div>';""",
     """      h += '<div style="font-size:12px;font-weight:600;margin-top:6px;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;">' + escapeHtml(name) + '</div>';""")

# -- 5. the row popup asks the chooser, not a blank name box ----------------
once('the row popup opens the chooser',
     r"""    acts.push({ label: 'Add to an album\u2026', run: function(){ scStreamToAlbum(id); } });""",
     r"""    acts.push({ label: 'Add to an album\u2026', run: function(){ scStreamPickList('al', id); } });""")

# -- 6. the changelog --------------------------------------------------------

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
    "  // 80.10 - THE ALBUM CHOOSER SHOWS THE ALBUMS THAT EXIST.\n"
    "  { version: '80.10', date: '{{STAMP}}', title: 'Add to an album shows the albums you have', items: [\n"
    "    '[FULL] Adding a song to an album now lists the albums you already have, with how many songs each one holds, instead of asking you to type a name and making a second album behind your back.',\n"
    "    '[FULL] A long list of albums no longer runs off the top of the screen: the sheet stops at the height of the glass and the rows scroll inside it, so the choice that makes a new album is always reachable.',\n"
    "    '[FULL] An album with no songs is not drawn as an album any more, and a name on a tile wraps onto a second line instead of being cut off - so the page shows albums that exist.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8010: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8010: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8010: %d steps applied, page is %s' % (len(applied), VERSION))
