#!/usr/bin/env python3
"""80.7.5 - an album's cover reaches every song in it, and a failure says where to tap.

    python3 dev/patch-8075.py
    python3 dev/patch-8075.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

 1. THE VERSION.
 2. THE ALBUM COVER, ON EVERY ROW. A downloaded album can carry its cover on the
    album and on the one song the cover was read from, while the rest hold no
    picture of their own - so the album card drew an empty box beside every song
    but the first. A row with no art of its own now shows its album's cover.
 3. THE FAILURE LINE CARRIES ITS WAY OUT. Every list that can show a failure now
    draws Restart beside the line: the albums page, the playlists page, an open
    list and the shelf all said "tap Restart" while the button existed only on the
    now-playing card. A failure with no line on screen says so out loud instead of
    the song going quiet.
 4. THE COPY THAT CAN HOLD THE WHOLE SONG GOES FIRST. The player hands over one
    muxed copy behind a row of audio-only ones, and those are the copies the source
    caps at a megabyte; a copy that stopped early used to walk them one at a time.
 5. ONE MORE ASK BEFORE A SONG IS CALLED UNPLAYABLE. Resolving is one round trip to
    a host that rate-limits; a single empty answer was final.
 6. THE CHANGELOG, as every release has it.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.5'
MARKER = '80.7.5 - THE COVER REACHES EVERY SONG, AND A FAILURE SAYS WHERE TO TAP'
ANCHOR = "  { version: '80.7.4',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8075: already on the page, the page is %s' % VERSION)
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
once('the page says 80.7.5',
     "const APP_VERSION = '80.7.4';",
     "const APP_VERSION = '80.7.5';")

# -- 2. an album's cover, on every row --------------------------------------
ART_BLOCK = """  // 80.7.5 - AN ALBUM'S COVER REACHES EVERY SONG IN IT.
  // A downloaded album can carry its cover on the album and on the one song the
  // cover was read from, with the rest holding no picture of their own - so the
  // card drew an empty box beside every song but the first. A row with no art of
  // its own shows its album's cover: the picture the header above it already
  // draws, which is what the album looks like anyway. The album is found by the
  // song's own tag first and by the album that holds it second, and the answer is
  // kept for the length of one render so a big album costs one lookup, not one
  // per row.
  var scAlbumArtCache = {};
  function scAlbumArtDrop(){ scAlbumArtCache = {}; }
  function scAlbumRowArt(t){
    function asStyle(u){ return "background-image:url('" + String(u).replace(/'/g, '%27') + "');"; }
    var art = String((t && t.artUrl) || '');
    if(art) return asStyle(art);
    var name = String((t && t.album) || '');
    if(name && Object.prototype.hasOwnProperty.call(scAlbumArtCache, name)) art = scAlbumArtCache[name];
    if(!art && name){
      try{
        var ua = (typeof userAlbums !== 'undefined' && userAlbums) ? userAlbums[name] : null;
        art = String((ua && ua.cover) || '');
        if(!art){
          var ids = (ua && ua.trackIds) || [];
          for(var i = 0; i < ids.length && !art; i++){
            var ft = allTracks.find(function(x){ return x.id === ids[i]; });
            if(ft && ft.artUrl) art = String(ft.artUrl);
          }
        }
        scAlbumArtCache[name] = art;
      }catch(_eAlbumArt){ art = ''; }
    }
    return art ? asStyle(art) : '';
  }
"""
once('the album-cover helper lands', '  function scPatchListRows(ids){', ART_BLOCK + '  function scPatchListRows(ids){')

once('every render starts with a fresh cover answer',
     '  function renderList(){\n',
     '  function renderList(){\n    scAlbumArtDrop();   // 80.7.5 - a cover that arrived since the last render is used now\n')

# The five places an album's own rows draw art: the Albums card closed and open,
# the deck's card, the reorder popup - that is the same expression four times over
# `tt` - and the deck's `_tt` copy once.
once('an album row falls back to the album cover',
     "var artStyle = tt.artUrl ? \"background-image:url('\" + tt.artUrl + \"');\" : '';",
     'var artStyle = scAlbumRowArt(tt);', expect=4)

once('the deck copy of an album row falls back too',
     "var _as = _tt.artUrl ? \"background-image:url('\" + _tt.artUrl + \"');\" : '';",
     'var _as = scAlbumRowArt(_tt);', expect=1)

# -- 3. the failure line carries its way out --------------------------------
SAY_BLOCK = """  // 80.7.5 - A LINE THAT SAYS WHAT WENT WRONG CARRIES THE WAY OUT OF IT, AND IT IS
  // NEVER SILENT WHERE IT HAPPENED. Every list that can show a failure now draws
  // Restart beside the line - the albums page, the playlists page, an open list and
  // the shelf all said "tap Restart" while the button existed only on the
  // now-playing card, so the instruction pointed at something that was not on
  // screen. And a failure with no line to land in (the library is what is on screen
  // while a song plays there) says so out loud instead of the song going quiet.
  function scStreamSayLine(){
    return '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">'
      + '<div id="scStreamSay" style="flex:1;min-width:0;font-size:11px;color:var(--coral);min-height:14px;"></div>'
      + '<button type="button" class="scs-fix" title="Try this song again" style="flex:0 0 auto;border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:4px 9px;font-size:10.5px;line-height:1;">Restart</button>'
      + '</div>';
  }
  function scStreamSay(msg){
    var el = null;
    try{ el = document.getElementById('scStreamSay'); }catch(_eSay){ el = null; }
    if(el){ el.textContent = msg || ''; return; }
    // Only what the owner has to act on is said out loud: the progress lines would
    // otherwise toast once per percent.
    if(msg && /restart|could not|not play|no playable|ends at|stopped short/i.test(String(msg))){
      try{ if(typeof toast === 'function') toast(String(msg), 4200); }catch(_eSayToast){}
    }
  }
"""
once('the say line grows a Restart and a voice', """  function scStreamSay(msg){
    try{ var el = document.getElementById('scStreamSay'); if(el) el.textContent = msg || ''; }catch(_e){}
  }
""", SAY_BLOCK)

once('every list draws the Restart beside the line',
     "h += '<div id=\"scStreamSay\" style=\"font-size:11px;color:var(--coral);min-height:14px;margin-top:8px;\"></div>';",
     'h += scStreamSayLine();', expect=4)

once('and the Restart on the line works',
     "    on('scStreamFix', 'click', scStreamRestart);\n",
     "    on('scStreamFix', 'click', scStreamRestart);\n"
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-fix'), function(b){ b.addEventListener('click', scStreamRestart); });\n")

# -- 4. the copy that can hold the whole song goes first --------------------
once('the candidate list can be asked for a whole copy', """  function scStreamAltUrl(){
    var a = scStreamState.alts || [];
    while(a.length){
      var n = a.shift();
      if(n && n.url) return n.url;
    }
    return '';
  }
""", """  // 80.7.5 - THE COPY THAT CAN HOLD THE WHOLE SONG COMES FIRST. The player hands
  // over one muxed copy behind a row of audio-only ones, and the audio-only ones
  // are the copies the source caps at its first megabyte. A copy that stopped early
  // therefore used to walk those capped rows one at a time - a read, a blip and
  // another failure each - before it reached the one copy that carries the music.
  // Asked for a whole copy, the muxed candidate is taken first.
  function scStreamAltUrl(wantWhole){
    var a = scStreamState.alts || [];
    if(wantWhole){
      for(var i = 0; i < a.length; i++){
        if(a[i] && a[i].url && a[i].muxed){ return a.splice(i, 1)[0].url; }
      }
    }
    while(a.length){
      var n = a.shift();
      if(n && n.url) return n.url;
    }
    return '';
  }
""")

once('a short copy asks for a whole one', """    function nextCopy(){
      var alt = scStreamAltUrl();
      if(alt) return Promise.resolve(alt);
      // Every candidate this resolve handed over is spent: ask once more, and take
      // the answer BEHIND its lead - the lead is the capped copy that just stopped.
      return Promise.resolve(scStreamResolve(t.videoId)).then(function(){ return scStreamAltUrl(); });
    }
""", """    function nextCopy(){
      // 80.7.5 - the muxed copy first: it is the one the cap does not touch.
      var alt = scStreamAltUrl(true);
      if(alt) return Promise.resolve(alt);
      // Every candidate this resolve handed over is spent: ask once more, and take
      // the answer BEHIND its lead - the lead is the capped copy that just stopped.
      return Promise.resolve(scStreamResolve(t.videoId)).then(function(){ return scStreamAltUrl(true) || scStreamAltUrl(); });
    }
""")

# -- 5. one more ask before a song is called unplayable ---------------------
once('an empty answer is asked again', """    return Promise.resolve(scStreamResolveCached(t.videoId)).then(function(u){
      if(String(scStreamState.curId) !== wanted) return;
      if(!u){
        scStreamSay('No playable stream for this song right now' + (scStreamReason() ? ' (' + scStreamReason() + ')' : ''));
        scStreamTick();
        return;
      }
      scStreamState.via = 'link';
      beginRead(u);                       // alongside the link, not after it
      return scStreamStart(u).then(function(ok){
        if(ok){ scStreamWatch(u); scStreamWarmNext(); return; }
        scStreamState.err = 'the link was refused';
        return beginRead(u).then(function(src){
          if(!src || String(scStreamState.curId) !== wanted) return;
          scStreamState.via = 'read';
          return scStreamStart(src).then(function(ok2){ if(ok2) scStreamWarmNext(); });
        });
      });
    }).catch(function(){
      scStreamState.err = 'the play call failed';
      scStreamSay('This source will not play this song - tap Restart');
      scStreamTick();
    });
""", """    function playUrl(u){
      scStreamState.via = 'link';
      beginRead(u);                       // alongside the link, not after it
      return scStreamStart(u).then(function(ok){
        if(ok){ scStreamWatch(u); scStreamWarmNext(); return; }
        scStreamState.err = 'the link was refused';
        return beginRead(u).then(function(src){
          if(!src || String(scStreamState.curId) !== wanted) return;
          scStreamState.via = 'read';
          return scStreamStart(src).then(function(ok2){ if(ok2) scStreamWarmNext(); });
        });
      });
    }
    function noneLeft(){
      scStreamSay('No playable stream for this song right now' + (scStreamReason() ? ' (' + scStreamReason() + ')' : ''));
      scStreamTick();
    }
    return Promise.resolve(scStreamResolveCached(t.videoId)).then(function(u){
      if(String(scStreamState.curId) !== wanted) return;
      if(u) return playUrl(u);
      // 80.7.5 - ONE MORE ASK BEFORE THE OWNER IS TOLD THERE IS NOTHING. Resolving is
      // one round trip to a host that rate-limits and times out, and a single empty
      // answer was final: the row said no source was found and stopped. The answer is
      // asked for a second time; only two refusals in a row is a song that cannot be
      // played right now, and the line then says so with Restart beside it.
      return Promise.resolve(scStreamResolve(t.videoId)).then(function(u2){
        if(String(scStreamState.curId) !== wanted) return;
        if(!u2){ noneLeft(); return; }
        if(t.videoId) scStreamResolved[String(t.videoId)] = { url: u2, at: Date.now() };
        return playUrl(u2);
      });
    }).catch(function(){
      scStreamState.err = 'the play call failed';
      scStreamSay('This source will not play this song - tap Restart');
      scStreamTick();
    });
""")

# -- 6. the changelog -------------------------------------------------------


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
    "  // 80.7.5 - THE COVER REACHES EVERY SONG, AND A FAILURE SAYS WHERE TO TAP.\n"
    "  { version: '80.7.5', date: '{{STAMP}}', title: 'The cover reaches every song, and a failure says where to tap', items: [\n"
    "    'Every song in an album now shows that album cover beside it, instead of only the first song having a picture.',\n"
    "    '[FULL] The line that says a song could not be played now has Restart beside it on the albums page, the playlists page and every list, instead of naming a button that was not on screen.',\n"
    "    '[FULL] A copy that stopped early now goes straight to the copy that can hold the whole song, and a search that came back empty is asked once more before the app reports that nothing could be found.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8075: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8075: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8075: %d steps applied, page is %s' % (len(applied), VERSION))
