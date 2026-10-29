#!/usr/bin/env python3
"""80.6.4 - the tab transition waits for a visible page, and stops leaking its aborts.

The bug, as the owner saw it: a red strip across the top of the app reading

    SideCut error: Transition was aborted because of invalid state. Document hidden

Where it comes from. `navigate()` runs the view swap inside
`document.startViewTransition()` (the 80.3.6 motion layer). Chrome aborts a view
transition when the page is hidden as it starts, or goes hidden while it runs, and
it reports that abort by REJECTING the transition's promises. The wrapper caught
`finished` only. `ready` was left dangling, so every such abort became an unhandled
rejection - and the boot banner prints unhandled rejections in full, over the top
of whatever you were looking at.

Three fixes, one function, no new plumbing:

1. THE DOOR. A hidden page does not start a transition at all - it takes the plain
   navigate() path, which is what reduced motion already does. Nothing to abort.

2. THE LEAK. `ready`, `updateCallbackDone` and `finished` all get a catch. An abort
   is a normal outcome for this call, however late it arrives, so it is not an error
   to report - it is an error to report it.

3. THE LOST TAP. An abort can land BEFORE the update callback ran, which means the
   DOM swap never happened and the tap went nowhere. The callback is watched now and
   a navigation that was swallowed is replayed outside the transition - once, guarded,
   so a swap that did happen is never done twice.

Nothing else moves: the motion tokens, the arrival for a pane's first paint, the
reduce-motion switches, every caller of navigate() and the app chrome are untouched.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8064.py
    python3 dev/patch-8064.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.4'
OLD_VERSION = '80.6.3'
MARKER = '80.6.4 - THE TRANSITION WAITS FOR A VISIBLE PAGE'

# ---------------------------------------------------------------------------
# 1. The function itself: the door, the three catches, the replayed tap.
# ---------------------------------------------------------------------------
NAV_OLD = """    function scNavigateSmooth(view){
      if(scMotionOff() || typeof document.startViewTransition !== 'function') return _scNavInner(view);
      try{
        var vt = document.startViewTransition(function(){ return _scNavInner(view); });
        if(vt && vt.finished && typeof vt.finished.catch === 'function') vt.finished.catch(function(){});
        return;
      }catch(_eVt){ return _scNavInner(view); }
    }"""

NAV_NEW = """    function scNavigateSmooth(view){
      if(scMotionOff() || typeof document.startViewTransition !== 'function') return _scNavInner(view);
      // 80.6.4 - A HIDDEN PAGE DOES NOT TRANSITION. Chrome aborts a view transition
      // that starts (or runs) while the document is hidden, and it says so by
      // rejecting the transition's promises. A tab tap that lands as the app is
      // backgrounded is not an error, and it must not paint one across the screen:
      // take the plain path instead, the same one reduced motion takes.
      try{ if(document.visibilityState !== 'visible') return _scNavInner(view); }catch(_eVis){ }
      var ran = false;
      var vt;
      try{
        vt = document.startViewTransition(function(){ ran = true; return _scNavInner(view); });
      }catch(_eVt){ return _scNavInner(view); }
      if(!vt) return _scNavInner(view);
      // EVERY PROMISE GETS AN OWNER. `finished` was the only one caught, and the abort
      // arrives on `ready` first - which is exactly the rejection that used to escape
      // into the banner. An abort here is an expected outcome, not a failure.
      function scVtQuiet(p){
        try{ if(p && typeof p.catch === 'function') p.catch(function(){}); }catch(_eQuiet){ }
      }
      scVtQuiet(vt.ready);
      scVtQuiet(vt.updateCallbackDone);
      scVtQuiet(vt.finished);
      // AND THE TAP SURVIVES IT. If the abort landed before the update callback ran,
      // the DOM never swapped and the tap goes nowhere. Replay the navigation outside
      // the transition - guarded by `ran`, so a swap that did happen runs once.
      try{
        if(vt.updateCallbackDone && typeof vt.updateCallbackDone.catch === 'function'){
          vt.updateCallbackDone.catch(function(){
            if(ran) return;
            setTimeout(function(){
              if(ran) return;
              ran = true;
              try{ _scNavInner(view); }catch(_eLate){ }
            }, 0);
          });
        }
      }catch(_eCd){ }
      return;
    }"""


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'A red error strip no longer appears when you tap a tab as the app is going to the background. The tab animation was being aborted by the system, and the abort was reported as a failure &mdash; it is not one. The animation now waits until the app is actually on screen, and an abort is handled quietly wherever it lands.',
        'The <b>tap is no longer lost</b> either. If the system cancels the animation before the screen had swapped, the same navigation runs again without it, so the tab you tapped is the tab you get. Once, never twice.',
        'The tab animation itself is unchanged: same slide, same timing, and it still stands aside for Reduce motion and for the app&rsquo;s own reduce-motion switch.',
        'Nothing else moved &mdash; the player, the library, the widget, the glass, the lyrics and the audio graph are exactly as they were.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'Transitions that survive a backgrounded app', body))


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-8064: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


CLAIMS = [
    ("const APP_VERSION = '80.6.4';", 'the page runs 80.6.4'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.4', date:", 'the changelog records the release'),
    ("if(document.visibilityState !== 'visible') return _scNavInner(view);",
     'a hidden page takes the plain path'),
    ('scVtQuiet(vt.ready);', 'ready is owned'),
    ('scVtQuiet(vt.updateCallbackDone);', 'updateCallbackDone is owned'),
    ('scVtQuiet(vt.finished);', 'finished is owned'),
    ('vt = document.startViewTransition(function(){ ran = true; return _scNavInner(view); });',
     'the update callback is watched'),
    ('if(ran) return;', 'the replay cannot double a swap'),
]

GONE = [
    ("const APP_VERSION = '80.6.3';", 'the old version constant'),
    ("if(vt && vt.finished && typeof vt.finished.catch === 'function') vt.finished.catch(function(){});",
     'the lone finished catch that leaked ready'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the transition waits for a visible page')
        print('patch-8064%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8064 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8064: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, NAV_OLD, NAV_NEW, 'the smooth navigate wrapper')

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "// 80.6.3 - THE GLASS IS LIQUID\nvar SC_IS_WEB = (function(){",
                "// 80.6.3 - THE GLASS IS LIQUID\n// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8064: the page did not end up 80.6.4 (%s)' % why)
    # The GONE half runs against the WRITTEN page, before the write: a release that
    # claims something is gone has to have looked.
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8064: the page still carries %s (%s)' % (why, needle[:60]))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8064: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the visibility door, the three owned promises, the watched update '
          'callback and its single replay, the changelog head, the version and the shell cache')
    print('patch-8064: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
