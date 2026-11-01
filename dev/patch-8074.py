#!/usr/bin/env python3
"""80.7.4 - a song played from the catalogue is the whole song, or the row says so.

    python3 dev/patch-8074.py
    python3 dev/patch-8074.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

 1. THE VERSION.
 2. THE LENGTH CHECK. The source caps the audio-only copy of a music upload at its
    first megabyte, and when the player reported no length the reader cannot tell
    that copy from a whole file. Nothing compared what came back with the length
    the row already carries, so a three-minute song could arrive as its first
    minute and go quiet - kept in memory for the next tap, and used as the audio a
    crop decodes. A copy that ends more than fifteen seconds (or a tenth) before
    the song does is now read as a fragment: dropped from memory, replaced by the
    full copy the player handed over behind it, resumed at the same second, and
    named when no copy is whole.
 3. THE CHANGELOG, as every release has it.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.4'
MARKER = '80.7.4 - A SONG FROM THE CATALOGUE IS THE WHOLE SONG'
ANCHOR = "  { version: '80.7.3',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8074: already on the page, the page is %s' % VERSION)
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
once('the page says 80.7.4',
     "const APP_VERSION = '80.7.3';",
     "const APP_VERSION = '80.7.4';")

# -- 2. a fragment of a song is not the song --------------------------------
BLOCK = """  // 80.7.4 - A SONG FROM THE CATALOGUE IS THE WHOLE SONG, OR IT SAYS SO.
  // The source caps the audio-only copy of a music upload at its first megabyte
  // (a 403 past it), and when the player never reported the stream's length the
  // reader cannot tell that copy from a whole file: the row said 3:12 and what
  // came back ended at 1:04. Nothing compared the audio with the length the row
  // already knows, so a fragment was played, remembered for the next tap and
  // decoded as the song by a crop. A copy that ends more than fifteen seconds (or
  // a tenth) before the song does is a fragment: it is never kept in memory, and
  // the full copy the player handed over behind it is read instead, at the second
  // the fragment stopped on. When every copy is short, the row says which second
  // it ends at instead of playing a minute of a three-minute song and falling
  // silent as if the song had finished.
  function scStreamWhole(want, got){
    want = Number(want) || 0;
    got = Number(got) || 0;
    if(!(want > 0) || !(got > 0)) return true;        // nothing to judge on yet
    if(!isFinite(got)) return true;                   // a live copy has no end
    return (want - got) <= Math.max(15, want * 0.1);  // shorter than the song: a fragment
  }
  function scStreamFragCheck(a){
    if(!a || scStreamState.busy) return;
    var t = scStreamById(scStreamState.curId);
    if(!t || !t.videoId) return;
    var want = Number(t.dur) || 0, got = 0, at = 0;
    try{ got = Number(a.duration) || 0; }catch(_eFd){ got = 0; }
    if(scStreamWhole(want, got)) return;
    try{ at = Number(a.currentTime) || 0; }catch(_eFa){ at = 0; }
    // A fragment is never carried: not in memory for the next tap, and not the
    // audio a crop would decode.
    try{ scStreamCacheDrop(t.videoId); }catch(_eFdrop){}
    scStreamState.err = 'the source sent a fragment';
    scStreamState.fixes = (Number(scStreamState.fixes) || 0) + 1;
    if(scStreamState.fixes > 12){
      scStreamSay('Every copy of this song stopped short - tap Restart');
      return;
    }
    scStreamState.busy = true;
    function nextCopy(){
      var alt = scStreamAltUrl();
      if(alt) return Promise.resolve(alt);
      // Every candidate this resolve handed over is spent: ask once more, and take
      // the answer BEHIND its lead - the lead is the capped copy that just stopped.
      return Promise.resolve(scStreamResolve(t.videoId)).then(function(){ return scStreamAltUrl(); });
    }
    Promise.resolve(nextCopy()).then(function(u){
      if(!u || String(scStreamState.curId) !== String(t.id)){
        scStreamState.busy = false;
        scStreamSay('This copy of the song ends at ' + scStreamTime(got) + ' of ' + scStreamTime(want)
          + ' - tap Restart to try another copy');
        return;
      }
      scStreamSay('That copy stopped at ' + scStreamTime(got) + ' - reading the whole song\\u2026');
      return scStreamSource({ url: u, mime: '', size: 0 }).then(function(src){
        scStreamState.busy = false;
        if(!src || String(scStreamState.curId) !== String(t.id)) return;
        scStreamState.via = 'read';
        return scStreamStart(src, at);
      });
    }).catch(function(){ scStreamState.busy = false; });
  }

"""
once('a short copy is caught and replaced', '  function scStreamPlay(id, ctxIds){', BLOCK + '  function scStreamPlay(id, ctxIds){')

once('the clock on the bar runs the check',
     "      if(!a) return;\n      var d = a.duration;\n",
     "      if(!a) return;\n      var d = a.duration;\n"
     "      scStreamFragCheck(a);   // 80.7.4 - a fragment is not the song\n")

# -- 3. the changelog -------------------------------------------------------
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
    "  // 80.7.4 - THE WHOLE SONG, OR A ROW THAT SAYS WHERE IT STOPPED.\n"
    "  { version: '80.7.4', date: '{{STAMP}}', title: 'The whole song, or a row that says where it stopped', items: [\n"
    "    'A song played straight from the catalogue now checks how long the audio that came back actually is: a copy that stops before the song does is swapped for the full copy behind it instead of playing a minute and going quiet.',\n"
    "    'A short copy is never kept in memory, so pressing play again, or cropping that song, uses the whole song rather than the piece that happened to arrive first.',\n"
    "    'When every copy of a song comes back short, the row says which second it ends at and offers Restart, instead of falling silent as though the song had finished.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8074: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8074: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8074: %d steps applied, page is %s' % (len(applied), VERSION))
