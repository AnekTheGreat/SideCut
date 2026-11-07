#!/usr/bin/env python3
"""83.0.5 - the switch stops lying about what the build can do.

83.0.4 shipped a switch in Settings -> Widget whose native half lives in the Android
build. The page updates over the air, so the switch appeared on every install - and
on an install without the native half it stored a choice nothing reads, which looked
exactly like "the feature is broken". This release writes the choice, reads it back
from the widget's own preferences, and says plainly when the phone cannot honour it.

Re-running is a no-op, and `--check` reports without writing.

  python3 dev/patch-8305.py           apply
  python3 dev/patch-8305.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.0.5'
OLD = '83.0.4'

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
changes.append('the service worker cache moves to 83.0.5')
print('ok  the service worker cache moves to 83.0.5')


# ---- the switch: write it, then read it back and say what actually happened -------
OLD_TOAST = "          toast(on ? 'The widget starts music on its own now' : 'The widget opens the app to play');"

NEW_TOAST = """          // 83.0.5 - A SWITCH MUST NOT LIE. The setting lives in this page, so it
          // appears on any build; the hidden player only exists in a build that
          // carries it. The choice is written, then read back from the widget's own
          // preferences, and the toast reports what the phone can actually do.
          const ghostSaid = (confirmed) => {
            if(!confirmed) toast('Saved, but this Android build has no hidden player - install the new SideCut build');
            else toast(on ? 'The widget starts music on its own now' : 'The widget opens the app to play');
          };
          try{
            const G = window.Capacitor;
            const GP = G && G.Plugins && G.Plugins.SideCutWidget;
            const ghostReadBack = (v) => ghostSaid(!!v && (v.on === on || v === on));
            if(GP && typeof GP.getGhostPlay === 'function') GP.getGhostPlay({}).then(ghostReadBack).catch(function(){ ghostSaid(false); });
            else if(G && typeof G.nativePromise === 'function') G.nativePromise('SideCutWidget', 'getGhostPlay', {}).then(ghostReadBack).catch(function(){ ghostSaid(false); });
            else ghostSaid(false);
          }catch(_eGhostVerify){ ghostSaid(false); }"""

sub(OLD_TOAST, NEW_TOAST, 'the switch reads its own choice back')


# ---- the changelog -----------------------------------------------------------------
ENTRY = '''  { version: '%s', date: 'November 7, 2026 · 2:20 AM EST', title: 'The widget plays without opening the app, for real', items: [
    'The switch in Settings, Widget now tells the truth: if this Android build has no hidden player, flipping it says so instead of quietly saving a choice nothing acts on.',
    'The press on the widget decides what to do when you press it, not when the widget was last drawn - which is why the first attempt could still open the app.',
    'When the hidden player never manages to start a sound, the press now opens the app instead of doing nothing at all.',
    'This half is native: install the newest Android build for it.'
  ]},
''' % VERSION

sub("  { version: '%s', date: 'November 7, 2026 · 3:05 PM EST', title: 'The widget plays without opening the app', items: [" % OLD,
    ENTRY + "  { version: '%s', date: 'November 7, 2026 · 3:05 PM EST', title: 'The widget plays without opening the app', items: [" % OLD,
    'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
