#!/usr/bin/env python3
"""83.0.4 - the switch for playing without opening the app.

The native half is dev/ghost-host.py (a hidden host activity the widget opens when
SideCut is gone). This is the half a person can see: Settings -> Widget gains one
switch, off by default, and the note above the presets stops saying the widget needs
the app opened.

Re-running is a no-op, and `--check` reports without writing.

  python3 dev/patch-8304.py           apply
  python3 dev/patch-8304.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.0.4'
OLD = '83.0.3'

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
changes.append('the service worker cache moves to 83.0.4')
print('ok  the service worker cache moves to 83.0.4')


# ---- the switch ----------------------------------------------------------------------------------
ROW = '''      <div id="widgetGhostRow" style="margin-bottom:16px; background:rgba(255,255,255,0.04); border:1px solid var(--line); border-radius:12px; padding:12px 14px;">
        <label for="widgetGhostToggle" style="display:flex; align-items:flex-start; gap:12px; cursor:pointer;">
          <input type="checkbox" id="widgetGhostToggle" style="width:18px; height:18px; margin:1px 0 0; flex:0 0 auto; accent-color:var(--gold);">
          <span>
            <span style="font-size:13px; font-weight:600;">Play without opening the app</span>
            <span style="display:block; font-size:11px; color:var(--ink-dim); margin-top:4px; line-height:1.5;">When SideCut has been swiped away or put to sleep, the widget's play button starts a hidden copy of the player that plays your last song and shows nothing at all &mdash; the screen stays where it is. It only does this when the app is really gone: if SideCut is still alive behind the widget, the press goes to the running player as it always did, and the hidden copy closes itself when the music stops. Off by default.</span>
          </span>
        </label>
      </div>
'''

sub('      <div id="widgetCustomWrap" style="margin-bottom:16px;">',
    ROW + '      <div id="widgetCustomWrap" style="margin-bottom:16px;">',
    'the switch in Settings -> Widget')

WIRING = '''    // 83.0.4 - THE SWITCH THAT LETS THE WIDGET START MUSIC WITH NOTHING ON SCREEN.
    // The choice is kept on the page so the switch remembers itself even on a build
    // without the native host, and it is written to the widget's own preferences so
    // the provider can choose the hidden host over opening the app.
    const ghostTog = $('widgetGhostToggle');
    if(ghostTog){
      try{ ghostTog.checked = localStorage.getItem('sidecut_ghost_play') === '1'; }catch(_eGhostRead){}
      if(!ghostTog._scWired){
        ghostTog._scWired = true;
        ghostTog.addEventListener('change', () => {
          const on = !!ghostTog.checked;
          try{ localStorage.setItem('sidecut_ghost_play', on ? '1' : '0'); }catch(_eGhostWrite){}
          try{
            const C = window.Capacitor;
            const P = C && C.Plugins && C.Plugins.SideCutWidget;
            if(P && typeof P.setGhostPlay === 'function') P.setGhostPlay({ on: on }).catch(function(){});
            else if(C && typeof C.nativePromise === 'function') C.nativePromise('SideCutWidget', 'setGhostPlay', { on: on }).catch(function(){});
          }catch(_eGhostNative){}
          toast(on ? 'The widget starts music on its own now' : 'The widget opens the app to play');
        });
      }
    }
'''

sub('    // 80.3.6 - the two options this release adds, wired the same way.',
    WIRING + '    // 80.3.6 - the two options this release adds, wired the same way.',
    'the switch, wired once')


# ---- the note that still said the widget needs the app -------------------------------------------
sub('A paused song stays reachable from this widget, the lock screen and your headphones - press play '
    'there and it resumes without opening the app, even after twenty minutes or an hour. The one case '
    'that still needs the app is a phone that has killed SideCut (swiped away from recents, or short '
    'of memory): open it once and the song is back.',
    'A paused song stays reachable from this widget, the lock screen and your headphones - press play '
    'there and it resumes without opening the app, even after twenty minutes or an hour. If the phone '
    'has thrown SideCut away entirely, <b>Play without opening the app</b> below decides what happens: '
    'on, the widget starts a hidden copy that plays with nothing on screen; off, the app opens and '
    'picks the song up. It needs the newest Android build - this half is native.',
    'the note under the presets tells the truth')


# ---- the changelog -------------------------------------------------------------------------------
ENTRY = '''  { version: '%s', date: 'November 7, 2026 · 3:05 PM EST', title: 'The widget plays without opening the app', items: [
    'The play button on the home-screen widget can now start your last song with nothing on screen, even after SideCut has been swiped away from recents.',
    'It is a switch, off by default: Settings, Widget, "Play without opening the app". With it off the widget opens the app exactly as before.',
    'It only steps in when the app is really gone. If SideCut is still alive behind the widget, the press goes to the running player - no second copy, no double audio.',
    'The hidden copy shows nothing, sits in no recents list, and closes itself when the music stops or when there is nothing to pick back up.',
    'This half is native, so it arrives with the new Android build rather than over the air. The switch itself is in the page, so it shows up on its own.'
  ]},
''' % VERSION

sub("  { version: '%s', date: 'November 7, 2026 · 1:20 PM EST', title: 'A paused song answers the headphones and the widget again', items: [" % OLD,
    ENTRY + "  { version: '%s', date: 'November 7, 2026 · 1:20 PM EST', title: 'A paused song answers the headphones and the widget again', items: [" % OLD,
    'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
