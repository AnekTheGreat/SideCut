#!/usr/bin/env python3
"""83.0.6 - the page shows what the last widget press actually did.

Two releases were spent guessing why a press did nothing. The native half now writes
a breadcrumb trail (switch, press, which branch, player boot, audio, give-up) and
this puts it in Settings -> Widget, under the switch, where it is two taps away.

Re-running is a no-op, and `--check` reports without writing.

  python3 dev/patch-8306.py           apply
  python3 dev/patch-8306.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.0.6'
OLD = '83.0.5'

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
changes.append('the service worker cache moves to 83.0.6')
print('ok  the service worker cache moves to 83.0.6')


# ---- where the trail is shown ----------------------------------------------------
DIAG_ROW = '''      <div id="widgetGhostDiag" style="display:none; margin:-6px 0 16px; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--line); border-radius:10px; font-size:11px; color:var(--ink-dim); line-height:1.6; white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></div>
'''

sub('      <div id="widgetCustomWrap" style="margin-bottom:16px;">',
    DIAG_ROW + '      <div id="widgetCustomWrap" style="margin-bottom:16px;">',
    'somewhere to show the trail')


# ---- reading it ------------------------------------------------------------------
DIAG_WIRING = '''    // 83.0.6 - WHAT THE LAST WIDGET PRESS ACTUALLY DID. The native half leaves a
    // breadcrumb on every branch it takes; this shows it under the switch. It is the
    // difference between "it does not work" and knowing which step stopped.
    function ghostDiagShow(txt, on){
      const el = $('widgetGhostDiag');
      if(!el) return;
      if(!txt){ el.style.display = 'none'; el.textContent = ''; return; }
      el.style.display = 'block';
      el.textContent = 'Last widget press - switch ' + (on ? 'on' : 'off') + '\\n' + txt;
    }
    function ghostDiagRefresh(){
      try{
        const C = window.Capacitor;
        const P = C && C.Plugins && C.Plugins.SideCutWidget;
        const done = (v) => { if(v && typeof v.diag === 'string') ghostDiagShow(v.diag, !!v.on); };
        if(P && typeof P.getGhostDiag === 'function') P.getGhostDiag({}).then(done).catch(function(){});
        else if(C && typeof C.nativePromise === 'function') C.nativePromise('SideCutWidget', 'getGhostDiag', {}).then(done).catch(function(){});
      }catch(_eGhostDiag){}
    }
    try{
      const wt = $('settingsTabWidget');
      if(wt && !wt._scDiagWired){
        wt._scDiagWired = true;
        wt.addEventListener('click', function(){ setTimeout(ghostDiagRefresh, 200); });
      }
    }catch(_eGhostDiagTab){}
'''

sub('    // 80.3.6 - the two options this release adds, wired the same way.',
    DIAG_WIRING + '    // 80.3.6 - the two options this release adds, wired the same way.',
    'the trail, read when the tab opens')


# ---- the changelog -----------------------------------------------------------------
ENTRY = '''  { version: '%s', date: 'November 7, 2026 · 3:40 AM EST', title: 'The hidden player gets the app\\'s own bridge', items: [
    'The hidden player now starts as SideCut itself, so the page inside it has the widget plugin it needs to learn that a song was waiting - that was why the press still did nothing.',
    'Settings, Widget now shows what the last press did: the switch state, the branch it took, whether the player booted and whether any audio arrived.',
    'If the hidden player cannot start a sound, it opens the app within a few seconds instead of waiting twenty.',
    'This half is native: install the newest Android build for it.'
  ]},
''' % VERSION

sub("  { version: '%s', date: 'November 7, 2026 · 2:20 AM EST', title: 'The widget plays without opening the app, for real', items: [" % OLD,
    ENTRY + "  { version: '%s', date: 'November 7, 2026 · 2:20 AM EST', title: 'The widget plays without opening the app, for real', items: [" % OLD,
    'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
