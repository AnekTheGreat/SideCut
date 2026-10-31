#!/usr/bin/env python3
"""80.6.27 - the record player takes you to the song that is playing.

    python3 dev/patch-80627.py
    python3 dev/patch-80627.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.27'
OLD = '80.6.26'
MARKER = '80.6.27 - THE RECORD FOLLOWS THE SOUND'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80627: already on the page, the page is %s' % VERSION)
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


# -- 1. the tap asks the stream first -------------------------------------------
# openAlbumForCurrentSong() could only ever answer with the downloaded deck: it
# reads queue/queueIndex and allTracks. A stream lives in its own store and never
# touches those, so while the source was playing this tap resolved the last song
# the deck held - a song nobody is hearing - and opened the album for it. The
# stream, when it owns the bar, is the thing the tap is about.
swap('the record tap asks the stream first',
     r'''  function openAlbumForCurrentSong(){
    let tid = null;
''',
     r'''  function openAlbumForCurrentSong(){
    // 80.6.27 - THE RECORD FOLLOWS THE SOUND. While the source is playing, the
    // downloaded deck queue still holds whatever it played last, so this tap found
    // a song there that is not the one in your ears. When the stream owns the bar,
    // the tap is about the stream and the deck is never consulted.
    try{
      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns() && scStreamJumpToPlaying()) return;
    }catch(_eStreamTap){}
    let tid = null;
''')

# -- 2. where the streaming song lives, and the jump to it ----------------------
BLOCK = r'''  // 80.6.27 - THE SONG THAT IS PLAYING IS THE ONE THE TAP MEANS.
  // The record player could only answer out of the downloaded deck, and a stream
  // lives in its own store. This finds the list the streaming song is actually in:
  // the one already on screen first (that is the one you meant), then the albums,
  // then the playlists.
  function scStreamPlayingList(id){
    var want = String(id || '');
    if(!want) return null;
    function holds(p){
      return ((p && p.items) || []).some(function(x){ return String((x && x.id) || '') === want; });
    }
    var open = scStreamListOpen();
    if(open && holds(open)) return { kind: (scStreamState.plKind === 'al' ? 'al' : 'pl'), name: String(open.name || '') };
    var al = scStreamAlbums().filter(holds)[0];
    if(al) return { kind: 'al', name: String(al.name || '') };
    var pl = (scStreamState.playlists || []).filter(holds)[0];
    if(pl) return { kind: 'pl', name: String(pl.name || '') };
    return null;
  }
  // The tap itself: the source on, that list open, its row scrolled to and lit for
  // a moment. It answers whether it took the tap, so the deck path below is only
  // reached when there is no stream to follow.
  function scStreamJumpToPlaying(){
    if(!SC_STREAM_OK) return false;
    var id = String(scStreamState.curId || '');
    if(!id) return false;
    if(typeof scStreamPhoneOwns === 'function' && !scStreamPhoneOwns()) return false;
    var at = scStreamPlayingList(id);
    // The shelf is only repainted when it is not already the page that is up, so a
    // tap on the page you are looking at does not redraw it underneath you.
    if(!(scShelf.open && scShelf.src === 's' && scShelf.page === 'library')){
      scShelf.src = 's';
      scShelf.page = 'library';
      scShelfApply();
    }
    if(at) scStreamOpenList(at.kind, at.name);
    else scStreamRender();
    var host = document.getElementById('scStreamBlock');
    if(!host) return true;
    function seek(){
      var rows = [];
      var row = null;
      try{ rows = host.querySelectorAll('.scsp-row, .scs-row'); }catch(_eRows){ rows = []; }
      for(var i = 0; i < rows.length; i++){
        if(String(rows[i].getAttribute('data-hold') || '') === id){ row = rows[i]; break; }
      }
      // A song in no list still got the shelf, which is where the playing song is
      // drawn. There is nothing to scroll to, and nothing to complain about.
      if(!row) return;
      // Scrolled in the shelf own pane, never with scrollIntoView: on Android that
      // call bubbles out of the pane and lifts the whole app with it.
      try{
        if(typeof smoothScrollIn !== 'function') throw new Error('no engine');
        smoothScrollIn(host, row);
      }catch(_eScroll){
        try{
          var hb = host.getBoundingClientRect(), rb = row.getBoundingClientRect();
          var to = host.scrollTop + (rb.top - hb.top) - (hb.height / 2) + (rb.height / 2);
          host.scrollTop = Math.max(0, Math.min(to, Math.max(0, host.scrollHeight - host.clientHeight)));
        }catch(_eScroll2){}
      }
      // Lit for a moment, so it is obvious which row the tap landed on - the same
      // answer the downloaded jump gives with its own focus class.
      try{
        row.style.background = 'color-mix(in srgb, var(--coral) 20%, transparent)';
        row.style.boxShadow = 'inset 0 0 0 1.5px var(--coral)';
        row.style.borderRadius = '10px';
      }catch(_eTint){}
      setTimeout(function(){
        try{ row.style.background = ''; row.style.boxShadow = ''; row.style.borderRadius = ''; }catch(_eUntint){}
      }, 2400);
    }
    setTimeout(seek, 60);
    return true;
  }
'''
swap('the playing list and the jump',
     "  function scStreamOpenList(kind, name){\n",
     BLOCK + "  function scStreamOpenList(kind, name){\n")

# -- 3. the release itself ------------------------------------------------------
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
    "  // 80.6.27 - THE RECORD PLAYER TAKES YOU TO THE SONG THAT IS PLAYING. The owner,\n"
    "  // before this release: a tap on the record player while streaming went to some\n"
    "  // random song. It did - the tap asked the downloaded deck, which was not the\n"
    "  // thing playing.\n"
    "  { version: '80.6.27', date: '{{STAMP}}', title: 'The record player takes you to the song that is playing', items: [\n"
    "    '[FULL] Tapping the record player while a song streams now opens the album or the playlist that song is in, scrolled to its row and lit for a moment.',\n"
    "    '[FULL] The tap follows the sound: it asks the stream before the downloaded deck, so it can no longer land on a song that is not playing.',\n"
    "    '[FULL] A streamed song that is in no list opens the streaming shelf, where the song being played is drawn, instead of opening nothing.',\n"
    "    '[FULL] On the downloaded side the tap is unchanged: it opens the album of the playing file, and a long press still opens the turntable angle.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', eastern())
swap('the changelog records the release',
     "  // 80.6.26 - THE STREAMING ALBUMS ARE A PAGE, AND A LIST IS HELD TO DELETE.",
     ENTRY + "  // 80.6.26 - THE STREAMING ALBUMS ARE A PAGE, AND A LIST IS HELD TO DELETE.")

if failed:
    print('patch-80627: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80627: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80627: %d steps applied, page is %s' % (len(applied), VERSION))
