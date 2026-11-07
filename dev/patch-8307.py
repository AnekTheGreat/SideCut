#!/usr/bin/env python3
"""83.0.7 - the page reports its half of a widget resume, and asks more than once.

83.0.6 gave the hidden player the app's own plugins; a press still ended in silence.
The page could fail in four different places and every one of them looked identical
from the outside - nothing. This makes each of them say so, through a native method
that lands in the trail on Settings -> Widget (and on the phone's shade), and it asks
for the pending resume four times after boot instead of once, so a press that arrives
before the library has hydrated is not thrown away.

Re-running is a no-op, and `--check` reports without writing.

  python3 dev/patch-8307.py           apply
  python3 dev/patch-8307.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.0.7'
OLD = '83.0.6'

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()
CHECK = '--check' in sys.argv

if "const APP_VERSION = '%s';" % VERSION in s:
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


sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)


# ---- the page's own account of the resume ----------------------------------------
STEP = '''  // 83.0.7 - THE PAGE'S HALF OF THE STORY. A resume that quietly found nothing to
  // play looked exactly like a press that never arrived: both were silence. Every
  // step that can fail now says so - it lands in the trail on Settings -> Widget and
  // on the phone's shade - so "it does not work" can turn into "it stopped here".
  function scGhostStep(txt){
    try{
      var C = window.Capacitor;
      var P = C && C.Plugins && C.Plugins.SideCutWidget;
      var args = { step: String(txt || '') };
      if(P && typeof P.ghostStep === 'function') P.ghostStep(args).catch(function(){});
      else if(C && typeof C.nativePromise === 'function') C.nativePromise('SideCutWidget', 'ghostStep', args).catch(function(){});
    }catch(_eGhostStep){}
  }
'''

sub('  var scWidgetResumeBusy = false;\n  var scWidgetResumeSeen = false;\n',
    STEP + '  var scWidgetResumeBusy = false;\n  var scWidgetResumeSeen = false;\n',
    'a way to report a step')

# Reading the request used to consume it, so a second ask always came back empty and
# a press that landed before the library hydrated was lost for good. This prefers the
# native "ask without consuming" call; the old one stays as the fallback.
sub("""      if(P && typeof P.getPendingResume === 'function'){
        return Promise.resolve(P.getPendingResume({})).catch(function(){ return null; });
      }
""",
    """      if(P && typeof P.ghostAskResume === 'function'){
        return Promise.resolve(P.ghostAskResume({})).catch(function(){ return null; });
      }
      if(P && typeof P.getPendingResume === 'function'){
        return Promise.resolve(P.getPendingResume({})).catch(function(){ return null; });
      }
""",
    'ask for the pending resume without consuming it')


# ---- the four places a resume can quietly stop ------------------------------------
sub('''      if(typeof scStreamResumeFromPhone === 'function' && scStreamResumeFromPhone()) return true;
      if(queueIndex < 0 || queueIndex >= queue.length) return false;
''',
    '''      if(typeof scStreamResumeFromPhone === 'function' && scStreamResumeFromPhone()) return true;
      if(queueIndex < 0 || queueIndex >= queue.length){ scGhostStep("nothing queued to resume"); return false; }
''',
    'say when nothing is queued')

sub('      if(!t || !t.file || !t.url) return false;\n',
    "      if(!t || !t.file || !t.url){ scGhostStep('the queued song has no file loaded'); return false; }\n",
    'say when the queued song has no file')

sub("      a.play().catch(function(){ recoverAudio(a, 'widget resume rejected'); });\n",
    """      scGhostStep('found "' + t.name + '", pressing play');
      a.play().then(function(){ scGhostStep('playing "' + t.name + '"'); })
              .catch(function(){ scGhostStep('the phone refused the play'); recoverAudio(a, 'widget resume rejected'); });
""",
    'say whether the phone accepted the play')


# ---- one ask was not enough -------------------------------------------------------
sub('        setTimeout(function(){ try{ scWidgetResumeCheck(); }catch(_eWr){} }, 700);\n',
    """        // 83.0.7 - ONE ASK WAS NOT ENOUGH. A hidden boot has to hydrate the
        // library out of the database before there is a queue to resume, so a press
        // that asked at 700 ms could read the request and find nothing to play. The
        // request is no longer consumed by asking, which makes asking again safe.
        [700, 2500, 5000, 8000].forEach(function(ms){
          setTimeout(function(){ try{ scWidgetResumeCheck(); }catch(_eWr){} }, ms);
        });
""",
    'ask four times, not once')


# ---- the changelog -----------------------------------------------------------------
ENTRY = """  { version: '%s', date: 'November 7, 2026 · 4:55 AM EST', title: 'The press stops lying about what it did', items: [
    'If the app looks alive but nothing plays within a couple of seconds, the press now starts the hidden player anyway instead of handing it to a player that is already gone.',
    'The hidden player asks for the song four times as the library loads, and asking no longer uses the request up - a press that arrived a moment too early used to be lost for good.',
    'The page now reports each step of a resume: nothing queued, the song has no file, pressing play, playing. That report is what the trail on Settings, Widget and the phone notification are made of.',
    'This half is native: install the newest Android build for it.'
  ]},
""" % VERSION

# Only the version and the date, so this does not care how the previous title is quoted.
ANCHOR = "  { version: '%s', date: 'November 7, 2026 · 3:40 AM EST'" % OLD
sub(ANCHOR, ENTRY + ANCHOR, 'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
