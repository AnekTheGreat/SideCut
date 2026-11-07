#!/usr/bin/env python3
"""83.2.1 - the copy is the song, not a picture of the song.

83.2.0 started a real Android player on a widget press and could not work for one
reason: the page handed it base64 TEXT. Capacitor's Filesystem writes `data` as UTF-8
unless encoding: 'base64' is passed, and the copy went out without it - a 1.2 MB track
landed as 1.6 MB of base64 letters. MediaPlayer read the first bytes, found no audio
header, and stopped with 'native -> cannot decode this file'. The press routed
perfectly and the file it was handed was noise.

This passes the encoding on both writes and refuses to call the copy ready unless the
bytes on disk are exactly the bytes of the song. A wrong copy is now a diag line
instead of silence, which is the difference between a bug to fix and a mystery.

Re-running is a no-op, and --check reports without writing.
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.2.1'
OLD = '83.2.0'
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


if 'scNativeCustody' not in s:
    sys.exit('the page has no scNativeCustody - apply dev/patch-8320.py first')

# THE BUG. The same option list Capacitor's Filesystem takes for every other base64
# write in this page, except that its absence silently means "this is text".
sub("await FS.writeFile({ path: 'np/' + want, data: b64, directory: 'DATA', recursive: true });",
    "await FS.writeFile({ path: 'np/' + want, data: b64, encoding: 'base64', directory: 'DATA', recursive: true });",
    'the first chunk is written as bytes')

sub("await FS.appendFile({ path: 'np/' + want, data: b64, directory: 'DATA' });",
    "await FS.appendFile({ path: 'np/' + want, data: b64, encoding: 'base64', directory: 'DATA' });",
    'every later chunk too')

VERIFY_OLD = """          offset = end;
        }
        scCustodyId = id;
        scCustodyFile = want;
"""

VERIFY_NEW = """          offset = end;
        }
        // 83.2.1 - A COPY THAT IS NOT THE SONG IS NOT A COPY.
        // The encoding above is the fix; this is the belt. A copy that is text, that
        // stopped early, or that was never written is refused here and named in the
        // diag trail, so the press falls through to the old path instead of handing
        // Android a file it cannot decode.
        var st = null;
        try{ st = await FS.stat({ path: 'np/' + want, directory: 'DATA' }); }catch(_eSt){ st = null; }
        if(!st || Number(st.size) !== size){
          throw new Error('the copy is ' + ((st && st.size) || 0) + ' of ' + size + ' bytes');
        }
        scCustodyId = id;
        scCustodyFile = want;
        try{ scGhostStep('copy -> ' + size + ' bytes ready'); }catch(_e){}
"""

sub(VERIFY_OLD, VERIFY_NEW, 'the copy is checked against the song')

sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)

ENTRY = """  { version: '83.2.1', date: 'November 7, 2026 \\u00b7 10:05 AM EST', title: 'The press plays your music, for real this time', items: [
    'The widget press with the app swiped away now produces sound. 83.2.0 built the player that survives the swipe but handed it a broken copy of the song, so this is the fix that makes it audible.',
    'The copy was being saved as text instead of audio - a 1.2 MB song arrived as 1.6 MB of encoded letters - and the player, quite correctly, refused to play it. The copy is now written as real bytes.',
    'The app also checks the copy against the song before trusting it. If the file that landed is not the song, the press says so in the widget diagnostics instead of going quiet.',
    'Everything from 83.2.0 stands: the player is a real Android service outside the app window, pressing again pauses it, and opening the app takes playback back.'
  ]},
"""

ANCHOR_OLD = "  { version: '%s', date:" % OLD
sub(ANCHOR_OLD, ENTRY + ANCHOR_OLD, 'the changelog entry')

io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
