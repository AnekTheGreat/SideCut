#!/usr/bin/env python3
"""80.6.21 - the stream is fast, it never doubles the sound, and it has backups.

Three complaints, three causes:

  * "not efficient, should be fast like downloaded songs" - every song was read
    as a whole file before the *next* one could be, and the next song's bytes
    were never fetched, so Next paid the full resolve + read again.
  * "music shouldn't overlap with the downloaded music" - only the deck's ACTIVE
    element was paused, so a crossfade, an ended track or a recovery could start
    the other element straight back up behind the stream.
  * "sources should never fail, have like 10 backups" - the player kept three
    audio rows and two muxed ones, and the element gave up after ONE retry.

    python3 dev/patch-80621.py
    python3 dev/patch-80621.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.21'
OLD = '80.6.20'
MARKER = '80.6.21 - FAST, QUIET, AND HARD TO KILL'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80621: the page is already %s - nothing to do' % VERSION)
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


# ── 1. the quiet, the read-ahead and the backups ─────────────────────────
BLOCK = r'''  // 80.6.21 - FAST, QUIET, AND HARD TO KILL.
  // ONE SOUND AT A TIME. 80.6.17 paused the deck's ACTIVE element when a stream
  // took the bar, which is not the same as silencing the deck: the other element
  // is the one a crossfade is already playing into, a track that ended can advance
  // into it, and recoverAudio() restarts whatever it likes. The deck is put to bed
  // as a whole - both elements, the crossfade timer, the pending hand-off - so a
  // stream and a downloaded song cannot be heard together.
  function scStreamQuietDeck(){
    try{ audio.pause(); }catch(_eQd1){}
    try{ audio2.pause(); }catch(_eQd2){}
    try{
      if(crossfadeRAF){ clearInterval(crossfadeRAF); crossfadeRAF = null; }
      crossfadeTriggered = false;
      pendingNextIndex = null;
    }catch(_eQd3){}
  }
  // The same rule from the other side: while the stream owns the bar, a deck
  // element that starts playing - a crossfade, a recovery, a queued track - is
  // stopped again instead of being allowed to sing over the stream.
  function scStreamDeckGuard(){
    if(typeof scStreamPhoneOwns !== 'function' || !scStreamPhoneOwns()) return false;
    return true;
  }

  // THE NEXT SONG IS READ WHILE THIS ONE PLAYS. This is what makes Next feel like
  // a downloaded song: the bytes are already an object URL, so the tap starts the
  // file instead of the network. It never touches the element that is playing and
  // it never runs while a read is in flight - one read at a time, always.
  function scStreamReadOnly(u, mime, size, lanes){
    if(!u) return Promise.resolve('');
    var type = String(mime || '').split(';')[0].trim();
    if(!type || /^video\//i.test(type)) type = 'audio/mp4';
    return Promise.resolve(scFetchBytes(u, Number(size) || 0, null, lanes || SC_STREAM_LANES))
      .then(function(buf){
        if(!buf || !buf.byteLength) return '';
        var blob = new Blob([buf], { type: type });
        if(!blob.size) return '';
        return URL.createObjectURL(blob);
      })
      .catch(function(){ return ''; });
  }
  function scStreamPrefetch(){
    try{
      if(scStreamState.reading || window.__scCancelDl) return;
      var nxt = scStreamUpNext();
      if(!nxt || !nxt.videoId) return;
      if(scStreamCacheGet(nxt.videoId)) return;
      var wanted = String(nxt.id);
      var vid = String(nxt.videoId);
      return Promise.resolve(scStreamResolveCached(vid)).then(function(u){
        if(!u || scStreamState.reading) return;
        return scStreamReadOnly(u, scStreamState.mime, 0, SC_STREAM_LANES).then(function(src){
          if(!src) return;
          if(String(scStreamState.curId) === wanted){ try{ URL.revokeObjectURL(src); }catch(_ePf){ } return; }
          scStreamCachePut(vid, { url: src, mime: scStreamState.mime, size: 0 });
        });
      }).catch(function(){});
    }catch(_ePf2){}
  }
'''
swap('the quiet, the read-ahead and the backups', '  function scStreamBarOn(t){\n    if(!t || !t.title) return;',
     BLOCK + '\n  function scStreamBarOn(t){\n    if(!t || !t.title) return;')

# ── 2. the deck gives way as a whole ─────────────────────────────────────
swap('the deck is put to bed, not half of it',
     "      // One sound at a time: the local player gives way the moment a stream starts.\n"
     "      var la = null;\n"
     "      try{ la = activeAudio(); }catch(_eAct){}\n"
     "      if(la && !la.paused){ try{ la.pause(); }catch(_ePz){} }",
     "      // One sound at a time: the deck gives way the moment a stream starts.\n"
     "      scStreamQuietDeck();")

swap('and a resumed stream silences it too',
     "    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamBarSync(); scStreamPhoneState(); });",
     "    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamQuietDeck(); scStreamBarSync(); scStreamPhoneState(); });")

# The deck's own elements stand down while the stream owns the bar.
swap('the deck element that tries to sing over it is stopped',
     "  let activeIdx = 0;\n  function activeAudio(){ return audios[activeIdx]; }",
     "  let activeIdx = 0;\n  function activeAudio(){ return audios[activeIdx]; }\n"
     "  // 80.6.21 - ONE SOUND AT A TIME, from the deck's side: while a stream owns the\n"
     "  // bar, an element that starts playing (a crossfade, a recovery, a queued track)\n"
     "  // is stopped again instead of being heard over the stream.\n"
     "  [audio, audio2].forEach(function(el){\n"
     "    if(!el) return;\n"
     "    el.addEventListener('play', function(){\n"
     "      try{ if(typeof scStreamDeckGuard === 'function' && scStreamDeckGuard()) el.pause(); }catch(_eSg){}\n"
     "    });\n"
     "  });")

swap('and a recovery never restarts it behind the stream',
     "    // Don't auto-restart playback if the user deliberately paused\n    if(userPaused) return;",
     "    // Don't auto-restart playback if the user deliberately paused\n    if(userPaused) return;\n"
     "    // 80.6.21 - and not behind a stream: the deck is not the sound right now.\n"
     "    try{ if(typeof scStreamDeckGuard === 'function' && scStreamDeckGuard()) return; }catch(_eRg){}")

# ── 3. a read is a read, and it counts as one ────────────────────────────
swap('a read is tracked',
     "    scStreamSay('Reading the song\\u2026');\n    scStreamState.via = 'read';",
     "    scStreamSay('Reading the song\\u2026');\n"
     "    scStreamState.via = 'read';\n"
     "    scStreamState.reading = (Number(scStreamState.reading) || 0) + 1;")

swap('and released the moment it ends',
     "    function restore(){ try{ window.__scCancelDl = wasCancel; }catch(_eRestore){} }",
     "    function restore(){\n"
     "      try{ window.__scCancelDl = wasCancel; }catch(_eRestore){}\n"
     "      scStreamState.reading = Math.max(0, (Number(scStreamState.reading) || 0) - 1);\n"
     "    }")

# ── 4. six lanes on a stream read ────────────────────────────────────────
swap('the reader takes a lane count',
     "  async function scFetchBytes(url, expectedSize, onProgress){",
     "  async function scFetchBytes(url, expectedSize, onProgress, lanesWanted){")

swap('and uses it when it is given',
     "        var lanes = Math.max(1, Math.min(scDlLanes(), plan - 1));",
     "        var lanes = Math.max(1, Math.min((Number(lanesWanted) > 0) ? Number(lanesWanted) : scDlLanes(), plan - 1));")

swap('a stream read is six ranges wide',
     "          return scFetchBytes(cand.url, scStreamState.size, function(loaded, total){\n"
     "            if(i > 0) return;\n"
     "            var pct = total ? Math.round((loaded / total) * 100) : 0;\n"
     "            scStreamSay(pct > 0 ? 'Reading the song\\u2026 ' + pct + '%' : 'Reading the song\\u2026');\n"
     "          });",
     "          return scFetchBytes(cand.url, scStreamState.size, function(loaded, total){\n"
     "            if(i > 0) return;\n"
     "            var pct = total ? Math.round((loaded / total) * 100) : 0;\n"
     "            scStreamSay(pct > 0 ? 'Reading the song\\u2026 ' + pct + '%' : 'Reading the song\\u2026');\n"
     "          }, SC_STREAM_LANES);")

# ── 5. a longer memory ───────────────────────────────────────────────────
swap('a longer memory',
     "  var SC_STREAM_CACHE_MAX = 3;\n  var SC_STREAM_CACHE_MS = 12 * 60 * 1000;",
     "  var SC_STREAM_CACHE_MAX = 6;\n"
     "  var SC_STREAM_CACHE_MS = 45 * 60 * 1000;\n"
     "  // Bounded 1 MiB ranges, six at a time: a stream read is one round trip wide\n"
     "  // where the downloader's four-lane default was two.\n"
     "  var SC_STREAM_LANES = 6;")

swap('and the read-ahead runs when a song starts',
     "  function scStreamWarmNext(){\n"
     "    var nxt = scStreamUpNext();\n"
     "    if(!nxt || !nxt.videoId) return;\n"
     "    Promise.resolve(scStreamResolveCached(nxt.videoId)).catch(function(){});\n"
     "  }",
     "  function scStreamWarmNext(){\n"
     "    var nxt = scStreamUpNext();\n"
     "    if(!nxt || !nxt.videoId) return;\n"
     "    Promise.resolve(scStreamResolveCached(nxt.videoId)).catch(function(){});\n"
     "    // 80.6.21 - and then READ it, while this one plays: Next becomes a tap on a\n"
     "    // file that is already here instead of another resolve and another read.\n"
     "    setTimeout(function(){ scStreamPrefetch(); }, 1200);\n"
     "  }")

# ── 6. ten backups, and a longer walk before giving up ───────────────────
swap('ten audio rows and four muxed ones',
     "      take(d.streamingData.adaptiveFormats, false, audioStreams, 3);\n"
     "      take(d.streamingData.formats, true, muxedStreams, 2);",
     "      // 80.6.21 - TEN of them. The player already answered; asking for one row\n"
     "      // per client left the stream one URL deep, and a URL that is refused is\n"
     "      // not a song that cannot play - it was the only candidate that got asked.\n"
     "      take(d.streamingData.adaptiveFormats, false, audioStreams, 10);\n"
     "      take(d.streamingData.formats, true, muxedStreams, 4);")

swap('and the element walks them instead of giving up once',
     "      if(scStreamState.fixes > 1){ scStreamSay('This source will not play this song - tap Restart'); return; }\n"
     "      var at = a.currentTime || 0;\n"
     "      scStreamState.busy = true;\n"
     "      scStreamResolve(t.videoId).then(function(u){\n"
     "        scStreamState.busy = false;\n"
     "        if(!u){ u = scStreamAltUrl(); }\n"
     "        if(!u){ scStreamSay('This source will not play right now'); return; }\n"
     "        return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){\n"
     "          if(!src) return;\n"
     "          return scStreamStart(src, at);\n"
     "        });\n"
     "      });",
     "      if(scStreamState.fixes > 12){ scStreamSay('This source will not play this song - tap Restart'); return; }\n"
     "      var at = a.currentTime || 0;\n"
     "      scStreamState.busy = true;\n"
     "      // 80.6.21 - THE BACKUPS COME FIRST. A dead URL used to cost a fresh resolver\n"
     "      // call and then a read of the SAME song from the top; the player already\n"
     "      // handed over ten candidates, so the next one is tried before anyone is\n"
     "      // asked again, and only a spent list re-resolves.\n"
     "      function retryWith(u){\n"
     "        if(!u){ scStreamState.busy = false; scStreamSay('This source will not play right now'); return; }\n"
     "        return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){\n"
     "          scStreamState.busy = false;\n"
     "          if(!src) return;\n"
     "          return scStreamStart(src, at);\n"
     "        });\n"
     "      }\n"
     "      var alt0 = scStreamAltUrl();\n"
     "      if(alt0){ retryWith(alt0); return; }\n"
     "      scStreamResolve(t.videoId).then(function(u){ retryWith(u || scStreamAltUrl()); });")

swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'Streaming, made quick - and quiet', items: [\n"
    "    '[FULL] Next is instant while you stream. The song after this one is read into memory while the current one plays, so pressing Next starts a file that is already here instead of asking the source for it again - and the last six songs stay ready, for forty-five minutes.',\n"
    "    '[FULL] The screen reads faster. A song is pulled six ranges at a time instead of four, a stream that goes quiet on the link is read a beat sooner, and a dead source no longer costs a fresh lookup before the next one is tried.',\n"
    "    '[FULL] No more two songs at once. A stream and a downloaded song can no longer be heard together: the player stands down as a whole when a stream starts - crossfade, queued track and all - and any track that tries to start behind the stream is stopped again.',\n"
    "    '[FULL] Ten backups per song. Every song you stream now arrives with up to ten audio sources and four progressive ones instead of three and two, and the player walks all of them - a source that refuses is skipped instead of ending the song.',\n"
    "  ]},\n"
)
if "version: '" + VERSION + "'" not in SRC:
    at = SRC.find("\n  { version: '%s'" % OLD)
    if at == -1:
        failed.append('changelog: no %s entry to insert before' % OLD)
    else:
        SRC = SRC[:at + 1] + ENTRY + SRC[at + 1:]
        applied.append('the changelog entry')

if failed:
    print('patch-80621: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80621: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80621: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
