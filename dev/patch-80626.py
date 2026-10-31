#!/usr/bin/env python3
"""80.6.26 - the streaming albums are a page of their own, and a list is held to delete.

    python3 dev/patch-80626.py
    python3 dev/patch-80626.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.26'
OLD = '80.6.25'
MARKER = '80.6.26 - A PAGE GLYPH STAYS IN THE SOURCE'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80626: already on the page, the page is %s' % VERSION)
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


# -- 1. a page glyph stays in the source that is on --------------------------
# 80.6.25 made both page glyphs leave the source so the downloaded songs were
# reachable. That left the streaming albums reachable only as a row inside the
# streaming library: the Albums glyph could not open the page it is named after.
# The switch is the source; the two glyphs are the pages of whichever source is up.
swap('a page glyph keeps the source',
     r'''    var page = (tab === 'albums') ? 'albums' : 'library';
    // 80.6.23 - A PAGE THAT IS ALREADY UP IS NOT DRAWN AGAIN. Tapping the page you are
    // on is not a request for it, and repainting it is the rest of the same flicker.
    if(page === scShelf.page && scShelf.src === 'd' && !scShelf.open){ scShelfMark(); return; }
    // 80.6.25 - THE PAGE GLYPHS ARE THE DEVICE'S. Library and Albums name what is on
    // this phone, but with the switch on the source they drew the streaming set
    // instead - so the downloaded songs could not be reached from the two glyphs that
    // are named after them. A tap on either one now leaves the source.
    scShelf.page = page;
    scShelf.src = 'd';
    scShelfApply();
''',
     r'''    var page = (tab === 'albums') ? 'albums' : 'library';
    // 80.6.26 - A PAGE GLYPH STAYS IN THE SOURCE THAT IS ON. 80.6.25 made both glyphs
    // leave the source, so while the source was on, the Albums glyph opened the
    // downloaded albums and the streaming ones could only be reached as a row inside
    // the library. The switch is the source; Library and Albums are its two pages.
    // 80.6.23 - A PAGE THAT IS ALREADY UP IS NOT DRAWN AGAIN. Tapping the page you are
    // on is not a request for it, and repainting it is the rest of the same flicker.
    var already = (page === scShelf.page) &&
      ((scShelf.src === 's') ? (scShelf.open && !scStreamState.pl) : !scShelf.open);
    if(already){ scShelfMark(); return; }
    scShelf.page = page;
    scShelfApply();
''')

# -- 2. the albums page says which source it is ---------------------------------
swap('the streaming albums page is labelled',
     r'''      h += '<span style="font-size:13.5px;font-weight:700;">Streaming albums</span>';
''',
     r'''      h += '<span style="font-size:13.5px;font-weight:700;">Streaming albums</span>';
      h += '<span style="font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--coral);border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);border-radius:999px;padding:2px 7px;">From the source</span>';
''')

# -- 3. and it says how a list goes away ----------------------------------------
swap('the page names the hold',
     r'''      h += '<div style="font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;">Albums of songs that play from the source, and of files already on this device. Nothing on this page is downloaded.</div>';
''',
     r'''      h += '<div style="font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;">Albums of songs that play from the source, and of files already on this device. Nothing on this page is downloaded. Hold an album for two seconds to delete it.</div>';
''')

# -- 4. a list is held, and its popup can delete it -----------------------------
# The shelf's holds were wired to song rows only. A list made by mistake was
# permanent: the tile opened, the chips opened, and nothing anywhere removed one.
# Two seconds is the same decision a row already takes, and the popup carries the
# delete - with the same toast-and-undo every other destructive change in the app has.
BLOCK = r'''  // 80.6.26 - AN ALBUM OR A PLAYLIST IS HELD, TOO. Every list on the shelf was
  // tap-only: a tile opened and a chip opened, and nothing on the page could delete
  // one, so a list made by mistake lived forever. Two seconds is the decision a song
  // row already takes - the popup opens, and deleting is one of the things in it.
  function scStreamHoldList(els, kind){
    Array.prototype.forEach.call(els || [], function(b){
      var tmr = null, held = false;
      function stop(){ if(tmr){ clearTimeout(tmr); tmr = null; } }
      b.addEventListener('pointerdown', function(){
        stop(); held = false;
        tmr = setTimeout(function(){
          tmr = null; held = true;
          scStreamLibMenu(kind, b.getAttribute('data-name'));
        }, 2000);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev){ b.addEventListener(ev, stop); });
      b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
      // The tap that follows a hold is swallowed, so a long press never also opens.
      b.addEventListener('click', function(e){
        if(!held) return;
        held = false;
        if(e && e.preventDefault) e.preventDefault();
        if(e && e.stopPropagation) e.stopPropagation();
      }, true);
    });
  }
  function scStreamLibMenu(kind, name){
    var isAl = (kind === 'al');
    var list = isAl ? scStreamAlbums() : (scStreamState.playlists || []);
    var p = (list || []).filter(function(x){ return String((x && x.name) || '') === String(name || ''); })[0];
    if(!p) return;
    var n = ((p && p.items) || []).length;
    scStreamSheet(String(p.name || '') + ' \u00b7 ' + n + ' song' + (n === 1 ? '' : 's'), [
      { label: 'Open', run: function(){ scStreamOpenList(isAl ? 'al' : 'pl', p.name); } },
      { danger: true, label: (isAl ? 'Delete this album' : 'Delete this playlist'),
        run: function(){ scStreamLibDelete(kind, name); } }
    ]);
  }
  function scStreamLibDelete(kind, name){
    var isAl = (kind === 'al');
    var before = isAl ? scStreamAlbums() : (scStreamState.playlists || []);
    var at = -1;
    for(var i = 0; i < (before || []).length; i++){
      if(String((before[i] && before[i].name) || '') === String(name || '')){ at = i; break; }
    }
    if(at < 0) return false;
    var gone = before[at];
    var rest = before.slice(0, at).concat(before.slice(at + 1));
    if(isAl) scStreamState.albums = rest; else scStreamState.playlists = rest;
    // A list that is up comes off the page with it, or the shelf draws a page for
    // something that no longer exists.
    if(String(scStreamState.pl || '') === String(name || '')) scStreamState.pl = '';
    scStreamSave();
    scStreamRender();
    scStreamSay((isAl ? 'Deleted the album ' : 'Deleted the playlist ') + '\u201c' + String(name || '') + '\u201d');
    // A delete is not final while the toast is up - the same undo the rest of the app
    // offers. It puts the list back where it was, not at the end of the row.
    try{
      if(typeof toastWithUndo === 'function'){
        toastWithUndo((isAl ? 'Album' : 'Playlist') + ' \u201c' + String(name || '') + '\u201d deleted', function(){
          var now = isAl ? scStreamAlbums() : (scStreamState.playlists || []);
          var back = now.slice(0, at).concat([gone]).concat(now.slice(at));
          if(isAl) scStreamState.albums = back; else scStreamState.playlists = back;
          scStreamSave();
          scStreamRender();
        });
      }
    }catch(_eUndo){}
    return true;
  }
'''
swap('the hold, the popup and the delete',
     "  function scStreamMenu(id, where){\n",
     BLOCK + "  function scStreamMenu(id, where){\n")

# -- 5. every list on the shelf takes the hold ----------------------------------
swap('the tiles and chips take the hold',
     r'''    Array.prototype.forEach.call(host.querySelectorAll('.scs-al'), function(b){
      b.addEventListener('click', function(){ scStreamOpenList('al', this.getAttribute('data-name')); });
    });
''',
     r'''    Array.prototype.forEach.call(host.querySelectorAll('.scs-al'), function(b){
      b.addEventListener('click', function(){ scStreamOpenList('al', this.getAttribute('data-name')); });
    });
    // 80.6.26 - and the lists take the same two seconds a song row does: the album
    // tiles on their page, and the playlist chips under the shelf.
    scStreamHoldList(host.querySelectorAll('.scs-al'), 'al');
    scStreamHoldList(host.querySelectorAll('.scs-pl'), 'pl');
''')

# -- 6. the release itself -----------------------------------------------------
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
    "  // 80.6.26 - THE STREAMING ALBUMS ARE A PAGE, AND A LIST IS HELD TO DELETE. The\n"
    "  // owner, after the rail release: the streaming albums should be easy to see, the\n"
    "  // glyph should not go to the downloaded ones, and a list should delete on a hold.\n"
    "  { version: '80.6.26', date: '{{STAMP}}', title: 'The streaming albums are a page, and a list is held to delete', items: [\n"
    "    '[FULL] Albums on the side rail opens the streaming albums while the source is on, so the page is one tap away instead of a row inside the library. The switch alone changes the source.',\n"
    "    '[FULL] The streaming albums page says where its songs come from, and says that holding an album for two seconds deletes it.',\n"
    "    '[FULL] Hold an album or a playlist for two seconds and its own popup offers to delete it. The tap that follows a hold does not open it.',\n"
    "    '[FULL] A deleted album or playlist can be brought back from the toast, in the place it was in.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
swap('the changelog records the release',
     "  // 80.6.25 - THE RAIL HOLDS STILL, AND THE SONGS ARE ONE TAP AWAY.",
     ENTRY + "  // 80.6.25 - THE RAIL HOLDS STILL, AND THE SONGS ARE ONE TAP AWAY.")

if failed:
    print('patch-80626: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80626: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80626: %d steps applied, page is %s' % (len(applied), VERSION))
