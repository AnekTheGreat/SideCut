#!/usr/bin/env python3
"""80.7.10 - the save is a button, and the song starts from its first second.

    python3 dev/patch-8080.py
    python3 dev/patch-8080.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHY. Two things were wrong, and the owner said both plainly.

  1. "WHERE IS THE BUTTON". 80.7.9 put the save in the song menu, and the song menu
     opens on a TWO SECOND HOLD. A tap on a streamed row plays it, so the only way to
     find the save was to already know it was there. Every streamed row now carries a
     device button next to its add button, and the player card carries one next to its
     transport, so the ask is one visible tap.

  2. "I CLICK IT THEN IT PLAYS IT 3 MINUTES LATER". That is not a slow resolver: it is
     scStreamSource(), which reads the WHOLE song - first range, then six lanes, then
     the tail - and only then hands the blob to the element. A three minute song on a
     phone is minutes of a bar that says Reading the song, and a song played before is
     instant because the blob is already in memory. That is the inconsistency: the same
     tap is one second or three minutes depending on the cache. A stream now opens from
     its FIRST MEGABYTE - the same range the full reader asks for first, and the exact
     range the source's audio-only copies serve without refusing - and the full copy is
     read behind it and swapped in at the second the listener has reached.
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.10'
MARKER = '80.7.10 - THE SAVE IS A BUTTON, AND THE SONG STARTS FROM ITS FIRST SECOND'
ANCHOR = "  { version: '80.7.9',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8080: already on the page, the page is %s' % VERSION)
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


def splice(name, start, end, new):
    """Replace everything from `start` up to (not including) `end`."""
    global SRC
    a = SRC.find(start)
    b = SRC.find(end, a if a >= 0 else 0)
    if a < 0 or b < 0:
        failed.append('%s: the span was not found' % name)
        return
    SRC = SRC[:a] + new + SRC[b:]
    applied.append(name)


# -- 1. the version ----------------------------------------------------------
once('the page says 80.7.10',
     "const APP_VERSION = '80.7.9';",
     "const APP_VERSION = '80.7.10';")

# -- 2. the opening ----------------------------------------------------------
BLOCK = r"""  // 80.7.10 - THE SONG STARTS FROM ITS FIRST SECOND, NOT FROM ITS LAST.
  // scStreamSource() reads the WHOLE song before anything is heard: one range, then six
  // lanes, then the tail. On a phone that is minutes of silence for a song nobody has
  // played, and one second for a song already read - the same tap, two different apps.
  // The source serves the first mebibyte of a copy to the same bounded range the full
  // reader opens with (and the audio-only copies are capped at exactly that first
  // megabyte), so the song can open from it in about a second while the rest is read
  // behind it.
  function scStreamPrefix(u, mime){
    if(!u) return Promise.resolve('');
    var type = String(mime || '').split(';')[0].trim();
    if(!type || /^video\//i.test(type)) type = 'audio/mp4';
    return Promise.resolve(scFetchRange(u, 0, SC_AUDIO_CHUNK - 1))
      .then(function(part){
        if(!part || !part.bytes || !part.bytes.length) return '';
        if(!part.partial) return '';       // a whole file already: the full read has it
        var blob = new Blob([part.bytes], { type: type });
        if(!blob.size) return '';
        if(scStreamState.prefixUrl){ try{ URL.revokeObjectURL(scStreamState.prefixUrl); }catch(_ePfxRev){} }
        scStreamState.prefixUrl = URL.createObjectURL(blob);
        scStreamState.prefixBytes = Number(blob.size) || 0;
        return scStreamState.prefixUrl;
      })
      .catch(function(){ return ''; });
  }

  // The link was refused or went quiet: open the song from its first megabyte.
  function scStreamFallback(u, want){
    var wanted = String(want || scStreamState.curId || '');
    return Promise.resolve(scStreamPrefix(u, scStreamState.mime)).then(function(src){
      if(!src) return false;
      if(String(scStreamState.curId || '') !== wanted) return false;
      scStreamState.via = 'prefix';
      scStreamSay('Playing the song from its first second\u2026');
      return scStreamStart(src).then(function(ok){
        if(!ok) return false;
        scStreamWarmNext();
        return true;
      });
    });
  }

  // 80.7.10 - AND THE WHOLE SONG ARRIVES BEHIND THE ONE THAT IS PLAYING.
  // The first megabyte is a minute of the song, not the song: as soon as the full read
  // lands it replaces the opening at the second the listener is on, so the file plays
  // through instead of stopping at the end of the first megabyte. It is also what the
  // cache keeps, so the next tap on this song is instant.
  function scStreamUpgrade(u, videoId, want){
    var wanted = String(want || scStreamState.curId || '');
    return Promise.resolve(scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }))
      .then(function(src){
        if(!src) return false;
        try{ scStreamCachePut(videoId, { url: src, mime: scStreamState.mime, size: scStreamState.size }); }catch(_eUpCache){}
        if(String(scStreamState.curId || '') !== wanted) return false;
        var a = null, at = 0;
        try{ a = scStreamAudio(); }catch(_eUpA){ a = null; }
        try{ at = Number(a && a.currentTime) || 0; }catch(_eUpAt){ at = 0; }
        scStreamState.via = 'full';
        if(scStreamState.prefixUrl){
          try{ URL.revokeObjectURL(scStreamState.prefixUrl); }catch(_eUpRev){}
          scStreamState.prefixUrl = '';
        }
        return Promise.resolve(scStreamStart(src, at)).then(function(ok){
          if(ok) scStreamWarmNext();
          return !!ok;
        });
      })
      .catch(function(){ return false; });
  }

  function scStreamSource(info){"""

once('the opening is inserted before the full reader',
     '  function scStreamSource(info){',
     BLOCK)

# -- 3. the fresh path plays the opening first --------------------------------
PLAYFRESH = r"""  // The fresh path: the opening and the link go out together, and the whole song is
  // read behind whichever of them makes a sound.
  // 80.7.10 - the whole song used to be read BEFORE the element was given anything, so
  // a song nobody had played sat at zero for as long as its file took to arrive. The
  // order is now: ask for the first megabyte and the link at the same time, play
  // whichever answers first, and hand the rest of the file over as it lands.
  function scStreamPlayFresh(t){
    var wanted = String(t.id);
    function openFrom(u, why){
      scStreamState.via = 'prefix';
      scStreamState.err = why || '';
      return Promise.resolve(scStreamFallback(u, wanted)).then(function(ok){
        if(!ok || String(scStreamState.curId) !== wanted) return;
        return scStreamUpgrade(u, t.videoId, wanted);
      });
    }
    function playUrl(u){
      scStreamState.via = 'link';
      var pref = scStreamPrefix(u, scStreamState.mime);   // asked for with the link
      return scStreamStart(u).then(function(ok){
        if(ok){
          scStreamWatch(u);
          scStreamWarmNext();
          scStreamUpgrade(u, t.videoId, wanted);
          return;
        }
        scStreamState.err = 'the link was refused';
        return pref.then(function(src){
          if(!src || String(scStreamState.curId) !== wanted) return openFrom(u, 'the link was refused');
          scStreamState.via = 'prefix';
          scStreamSay('Playing the song from its first second\u2026');
          return scStreamStart(src).then(function(ok2){
            if(!ok2) return openFrom(u, 'the opening would not play');
            scStreamWarmNext();
            return scStreamUpgrade(u, t.videoId, wanted);
          });
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
      // 80.7.5 - ONE MORE ASK BEFORE THE OWNER IS TOLD THERE IS NOTHING.
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
  }
"""

splice('the fresh path opens from the first megabyte', '  function scStreamPlayFresh(t){', '  function scStreamToggle(){', PLAYFRESH)

# -- 4. a short copy is the opening, not a fragment ---------------------------
once('the fragment check knows an opening is not a fragment',
     """  function scStreamFragCheck(a){
    if(!a || scStreamState.busy) return;""",
     """  function scStreamFragCheck(a){
    if(!a || scStreamState.busy) return;
    // 80.7.10 - the opening is a minute of the song by design, and the row already
    // knows the song is longer. Judging it as a fragment would throw the opening away
    // and start the whole read again, which is the wait this release removed.
    if(scStreamState.via === 'prefix') return;""")

# -- 5. the end of the opening is not the end of the song ---------------------
once('the end of the opening does not advance the queue',
     "    a.addEventListener('ended', function(){ scStreamNext(1); });",
     """    a.addEventListener('ended', function(){
      // 80.7.10 - the opening ends a minute in and the whole song is still arriving:
      // advancing here would skip a song that is being listened to.
      if(scStreamState.via === 'prefix') return;
      scStreamNext(1);
    });""")

# -- 6. a quiet link opens from the first megabyte ---------------------------
once('a quiet link opens the song instead of reading all of it first',
     """      return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){
        if(!src) return;
        return scStreamStart(src);
      });""",
     """      return scStreamFallback(u, id).then(function(ok){
        if(!ok) return;
        var cur = scStreamById(id) || {};
        return scStreamUpgrade(u, cur.videoId, id);
      });""")

# -- 7. the button, on a streamed row ---------------------------------------
once('a streamed row carries the save button beside its add button',
     """          + '<button type="button" class="scs-list" data-id="' + escapeHtml(String(t.id)) + '" title="Add to a playlist or an album" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;line-height:1;">' + scIcon('plus', 12) + '</button>'
          + '</div>';""",
     """          + '<button type="button" class="scs-list" data-id="' + escapeHtml(String(t.id)) + '" title="Add to a playlist or an album" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;line-height:1;">' + scIcon('plus', 12) + '</button>'
          // 80.7.10 - THE SAVE IS A BUTTON. It was only in the two second menu, so the
          // only way to find it was to already know: the owner did not.
          + '<button type="button" class="scs-keep" data-id="' + escapeHtml(String(t.id)) + '" title="Save this song to a playlist, an album or your device" aria-label="Save this song" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;line-height:1;">' + scIcon('device', 12) + '</button>'
          + '</div>';""")

# -- 8. the button, on a row inside a playlist or an album ------------------
once('a row inside a list carries it too',
     """        h += '<div style="font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(scStreamRowMeta(t)) + '</div>';
        h += '</button>';
        h += '</div>';""",
     """        h += '<div style="font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(scStreamRowMeta(t)) + '</div>';
        h += '</button>';
        h += '<button type="button" class="scsp-keep" data-id="' + escapeHtml(String(t.id)) + '" title="Save this song to a playlist, an album or your device" aria-label="Save this song" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;line-height:1;">' + scIcon('device', 12) + '</button>';
        h += '</div>';""")

# -- 9. the button, on the player -------------------------------------------
once('the player carries it beside its transport',
     """      h += '<button type="button" id="scStreamNextB" aria-label="Next" style="background:none;border:none;color:var(--ink);line-height:0;padding:6px;">' + scIcon('next', 18) + '</button>';
      h += '<span id="scStreamAt\"""",
     """      h += '<button type="button" id="scStreamNextB" aria-label="Next" style="background:none;border:none;color:var(--ink);line-height:0;padding:6px;">' + scIcon('next', 18) + '</button>';
      // 80.7.10 - the song on the player is the song the save means, and it says so
      // without a menu: the device glyph, in the transport row.
      h += '<button type="button" id="scStreamSave" title="Save this song to a playlist, an album or your device" aria-label="Save this song" style="background:none;border:none;color:var(--ink);line-height:0;padding:6px;margin-left:auto;">' + scIcon('device', 18) + '</button>';
      h += '<span id="scStreamAt\"""")

# -- 10. and every one of them opens the same ask ---------------------------
once('the three buttons open the destination ask',
     """    Array.prototype.forEach.call(host.querySelectorAll('.scs-list'), function(b){
      b.addEventListener('click', function(){ scStreamAddTo(this.getAttribute('data-id')); });
    });""",
     """    Array.prototype.forEach.call(host.querySelectorAll('.scs-list'), function(b){
      b.addEventListener('click', function(){ scStreamAddTo(this.getAttribute('data-id')); });
    });
    // 80.7.10 - one tap, the same four answers the menu gives.
    on('scStreamSave', 'click', function(){ scStreamDownloadSheet(scStreamState.curId); });
    ['.scs-keep', '.scsp-keep'].forEach(function(sel){
      Array.prototype.forEach.call(host.querySelectorAll(sel), function(b){
        b.addEventListener('click', function(e){
          if(e && e.preventDefault) e.preventDefault();
          if(e && e.stopPropagation) e.stopPropagation();
          scStreamDownloadSheet(this.getAttribute('data-id'));
        });
      });
    });""")

# -- 11. the changelog ------------------------------------------------------

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
    "  // 80.7.10 - THE SAVE IS A BUTTON, AND THE SONG STARTS FROM ITS FIRST SECOND.\n"
    "  { version: '80.7.10', date: '{{STAMP}}', title: 'A button you can see, and a song that starts', items: [\n"
    "    '[FULL] Every song that plays from a source has a save button on its row and beside the player, so keeping it is one visible tap instead of a two second hold.',\n"
    "    '[FULL] A song now starts from its first second instead of after its whole file has arrived, so a tap makes sound in a moment and the rest of the file is read behind it.',\n"
    "    '[FULL] The whole copy takes over from the opening at the second you have reached, so the song plays through and the next tap on it is instant.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8080: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8080: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8080: %d steps applied, page is %s' % (len(applied), VERSION))
