#!/usr/bin/env python3
"""83.2.0 - the page leaves a copy of the song where native code can play it.

The dead-app press now starts NativePlayService (dev/native-play.py), which can play
only a FILE - the library keeps songs in IndexedDB as blobs. So whenever the playing
song changes, its bytes are copied to the app's private files dir beside a small
np/current.json naming it, with the title and the position. The copy is rewritten
only on a change (megabytes); the JSON is refreshed on every state push, because that
is where the position rides. With no copy the service reports it is not ready and the
press falls through to the old path.

Re-running is a no-op, and --check reports without writing.
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.2.0'
OLD = '83.1.0'
CHECK = '--check' in sys.argv

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()

if ("const APP_VERSION = '%s';" % VERSION) in s:
    print('%s is already on the page - nothing to do' % VERSION)
    sys.exit(0)

if CHECK:
    print('%s is NOT on the page - it needs applying' % VERSION)
    sys.exit(1)

changes = []


def sub(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit('%s: %d matches (expected exactly 1)' % (label, n))
    s = s.replace(old, new, 1)
    changes.append(label)
    print('ok  ' + label)


if 'function blobChunkToBase64' not in s:
    sys.exit('the page has no blobChunkToBase64 - this needs it for the copy')

ANCHOR = '  function pushWidgetState(t, playing){\n'

CUSTODY = '''  // 83.2.0 - A COPY THE NATIVE PLAYER CAN REACH.
  //
  // The widget press after a swipe starts NativePlayService, which is real Android
  // audio with no WebView - it can play a file, not an IndexedDB blob. So the playing
  // song is copied to the app's private files dir beside a small JSON that names it:
  // only when the song changes (the bytes are megabytes), while the JSON is refreshed
  // on every state push because it carries the position.
  var scCustodyId = null;
  var scCustodyFile = '';
  var scCustodyBusy = false;
  function scCustodyFs(){
    try{
      if(!__SC_IS_NATIVE) return null;
      var C = window.Capacitor && window.Capacitor.Plugins;
      var FS = C && C.Filesystem;
      return (FS && typeof FS.writeFile === 'function') ? FS : null;
    }catch(_e){ return null; }
  }
  function scCustodyName(t){
    try{
      var n = String((t.file && t.file.name) || t.name || 'audio');
      var m = /\\.([a-z0-9]{2,5})$/i.exec(n);
      var ext = (m ? m[1] : 'mp3').toLowerCase();
      if(['mp3','m4a','aac','wav','ogg','oga','opus','flac','mp4','m4b','webm'].indexOf(ext) < 0) ext = 'mp3';
      return 'current.' + ext;
    }catch(_e){ return 'current.mp3'; }
  }
  function scCustodyPos(){
    try{
      var a = (typeof activeAudio === 'function') ? activeAudio() : null;
      if(!a) return 0;
      var p = Math.round(Number(a.currentTime) || 0);
      var d = Number(a.duration);
      if(!isFinite(p) || p < 0) return 0;
      if(isFinite(d) && d > 0) p = Math.min(p, Math.round(d));
      return p;
    }catch(_e){ return 0; }
  }
  async function scNativeCustody(t){
    var FS = scCustodyFs();
    if(!FS || !t) return;
    var id = t.id || null;
    var want = scCustodyName(t);
    if(id && id !== scCustodyId && !scCustodyBusy && t.file && t.file.size){
      scCustodyBusy = true;
      try{
        var size = t.file.size;
        var step = 512 * 1024;
        var offset = 0;
        var first = true;
        while(offset < size){
          var end = Math.min(size, offset + step);
          var b64 = await blobChunkToBase64(t.file.slice(offset, end));
          if(!b64) throw new Error('the song could not be read');
          if(first){
            await FS.writeFile({ path: 'np/' + want, data: b64, directory: 'DATA', recursive: true });
            first = false;
          }else if(typeof FS.appendFile === 'function'){
            await FS.appendFile({ path: 'np/' + want, data: b64, directory: 'DATA' });
          }else{
            throw new Error('this filesystem cannot append');
          }
          offset = end;
        }
        scCustodyId = id;
        scCustodyFile = want;
      }catch(e){
        // No copy is not a crash: the native player reports it is not ready and the
        // press falls through to the old path.
        scCustodyId = null;
        scCustodyFile = '';
        try{ scGhostStep('copy -> ' + String((e && e.message) || e)); }catch(_e){}
        return;
      }finally{
        scCustodyBusy = false;
      }
    }
    if(!scCustodyId || !scCustodyFile) return;
    try{
      await FS.writeFile({
        path: 'np/current.json',
        directory: 'DATA',
        recursive: true,
        data: JSON.stringify({
          id: scCustodyId,
          file: scCustodyFile,
          title: t.name || 'SideCut',
          artist: t.artist || '',
          positionMs: scCustodyPos(),
          at: Date.now()
        })
      });
    }catch(_e){}
  }

'''

sub(ANCHOR, CUSTODY + ANCHOR, 'the copy of the playing song')
sub(ANCHOR, ANCHOR + '    try{ scNativeCustody(t); }catch(_eCustody){}\n',
    'the push that keeps it current')

sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)

ENTRY = """  { version: '83.2.0', date: 'November 7, 2026 \\u00b7 9:15 AM EST', title: 'The music stops living in the window', items: [
    'The widget plays with the app swiped away for a reason that is not a workaround: SideCut keeps a copy of the song you are playing and plays it with a real Android player, in a service the swipe cannot remove. Every player here until now was a WebView, so the swipe killed the only thing making sound.',
    'Pressing play with nothing open starts that player straight away - no app launch, no window, no waiting for a page to answer.',
    'Opening the app hands playback back to it, so the same song never plays twice.',
    'The copy is written once per song, in the app\\u0027s own storage, and only when the song changes.',
    'With no copy yet - a fresh install that has not played anything - the press behaves exactly as before.'
  ]},
"""

ANCHOR_OLD = "  { version: '%s', date:" % OLD
sub(ANCHOR_OLD, ENTRY + ANCHOR_OLD, 'the changelog entry')

io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
