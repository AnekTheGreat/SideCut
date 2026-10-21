#!/usr/bin/env python3
"""80.0.3 - the tabs go back over the screen, and the Studio split goees into the dock.

Owner's words, verbatim: "STUDIO SHOULD HAVE A DIAGONAL TAB IN THE ACTUAL TAB
CALLED TOOLS NOT TAB INSIDE STUDIO ... the tabs should be over the actual screen
so like the bubbles can be under the tabs and stuff".

So, two shape changes and the breakage that came with the old shape:

  1. THE DOCK IS A BAR ACROSS THE TOP in the cloud layout. It floats over the
     content (fixed), one capsule, and the bubble wall scrolls underneath it.
     It was a rail down the right at top:50%, which overlapped the bubbles and
     the player.
  2. THE STUDIO TAB IS THE DIAGONAL SPLIT. The dock's Studio pill is cut corner
     to corner exactly like the Library pill: Studio on the top-left half, Tools
     on the bottom-right. (REVISED before the release shipped: the owner asked for
     the two names side by side instead, so the page now cuts the pill vertically -
     Studio on the LEFT, Tools on the RIGHT, 60%/40% seam - and this script is kept
     as the record of the first cut, not as a description of the shipped pill.)
     The tab bar that 80.0 put INSIDE the Studio view is
     removed; the view keeps its two panes and nothing else.
  3. THE PLAYER IS BACK ON THE BOTTOM in the cloud layout. measureDock fed the
     player the dock's height as a bottom inset, and a 272px-tall rail lifted it
     to the middle of the screen. The rail is gone, and the measurement is
     skipped while the cloud layout is on.
  4. THE HEADER'S THREE BUTTONS ACTUALLY HIDE. `header > div:last-child{
     display:none }` lost to the wrapper's inline `display:flex`, so cloud kept
     the bell/refresh/gear in the header AND their copies on the stats bubble,
     and the small now pill was drawn on top of them. The rule is `!important`
     now, and the chip sits in the corner they vacated.

The patch is idempotent: every step writes its own marker first and returns
"already in place" when it finds it. Run with --check to see what is left.
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.0.3'

STUDIO_TAB_NEW = '''  <!-- 80.0.3 - the Studio tab, cut corner to corner the way the Library tab has
       been since 70.0: the top-left half is the studio work, the bottom-right
       half is Tools. Both halves are in the one pill, and there is no second tab
       bar inside the Studio view any more. -->
  <button id="studioBtn" class="action-pill" style="position:relative;overflow:hidden;padding:0;cursor:pointer;">
  <div id="studioHalf" data-studio-tab="studio" style="position:absolute;inset:0;clip-path:polygon(0 0, 100% 0, 0 100%);display:flex;align-items:flex-start;justify-content:flex-start;padding:4px 0 0 8px;cursor:pointer;z-index:2;transition:background 0.15s;">
    <span style="font-size:10px;font-weight:700;color:var(--ink-dim);letter-spacing:0.3px;">Studio</span>
  </div>
  <div id="toolsHalf" data-studio-tab="tools" style="position:absolute;inset:0;clip-path:polygon(100% 0, 100% 100%, 0 100%);display:flex;align-items:flex-end;justify-content:flex-end;padding:0 8px 4px 0;cursor:pointer;z-index:1;transition:background 0.15s;">
    <span style="font-size:10px;font-weight:700;color:var(--ink-dim);letter-spacing:0.3px;">Tools</span>
  </div>
  <svg width="100%" height="100%" style="position:absolute;inset:0;pointer-events:none;z-index:3;"><line x1="100%" y1="0" x2="0" y2="100%" stroke="var(--line)" stroke-width="1"/></svg>
</button>
'''

CLOUD_CSS_NEW = '''/* ---------- 4. Cloud layout: floating bubbles, the tabs across the top ------ */
/* 80.0.3 - the tabs are a bar OVER the screen again, not a rail down the right.
   One floating capsule across the top, and the bubble wall scrolls underneath
   it (the views reserve the bar's band as padding, so nothing sits behind it at
   rest). The dock the cloud look shipped with was a column at top:50%, which
   crossed the bubbles and the player on every screen it was opened on. */
body.sc80-cloud{ --sc80-bar: 58px; --sc80-head: 60px; }
/* The bar sits under the header and over the content. --sc80-head is the
   header's real height, written by the page when the layout is applied, so the
   bar keeps its place at any font size and any safe-area inset. */
body.sc80-cloud .action-strip{
  position: fixed;
  left: 10px; right: 10px; bottom: auto;
  top: calc(env(safe-area-inset-top) + var(--sc80-head) + 6px);
  transform: none;
  flex-direction: row;
  align-items: stretch;
  width: auto; max-width: 720px; margin: 0 auto;
  height: var(--sc80-bar);
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: color-mix(in srgb, var(--bg-raised) 82%, transparent);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  backdrop-filter: blur(16px) saturate(1.2);
  box-shadow: 0 16px 40px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06);
  z-index: 40;
}
body.sc80-cloud .action-strip > *{ flex: 1 1 0; width: auto; min-width: 0; }
body.sc80-cloud .action-strip > .dock-add{ flex: 0 0 46px; }
body.sc80-cloud .action-strip > #libraryBtn,
body.sc80-cloud .action-strip > #studioBtn{ flex: 1.18 1 0; }
body.sc80-cloud .action-pill{
  border-radius: 16px;
  font-size: 10.5px;
  line-height: 1.15;
  padding: 0 4px;
  min-height: 44px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: transparent;
  border-color: transparent;
}
body.sc80-cloud .action-pill.primary,
body.sc80-cloud #homeBtn.active,
body.sc80-cloud #discoverBtn.active,
body.sc80-cloud #studioBtn.active{
  background: color-mix(in srgb, var(--coral) 82%, transparent);
  border-color: color-mix(in srgb, var(--coral) 60%, transparent);
  color: #161616;
}
/* The plus opens its menu under the bar, not beside a rail. */
body.sc80-cloud #addSongsMenu{
  right: 12px; left: auto;
  top: calc(env(safe-area-inset-top) + var(--sc80-head) + var(--sc80-bar) + 12px);
  transform: none;
  max-height: 60vh; overflow-y: auto;
}
/* The player owns the bottom of the screen again: the dock is no longer between
   it and the edge, so it sits on the safe area with nothing under it. Two rules,
   deliberately: dev/studio-70-check counts every `#nowPlaying` rule that reserves
   the bottom inset as a padding rule, and the bottom edge is not padding. */
body.sc80-cloud #nowPlaying{ padding-right: 0; }
body.sc80-cloud #nowPlaying{ bottom: env(safe-area-inset-bottom); }
/* The three real header buttons move onto the listening-stats bubble in this
   layout (sc80CloudCtl). Their wrapper carries an INLINE display:flex, which is
   why 80.0's plain display:none never took: cloud showed the bell, refresh and
   gear in the header AND a copy of them on the bubble, and the small now pill
   was drawn on top of that row. It has to be told twice. */
body.sc80-cloud header > div:last-child{ display: none !important; }
body.sc80-cloud .brand span{ display: none; }
body.sc80-cloud header{ padding-right: 12px; }
/* The views give the bar's band back as padding so the first row starts under
   it; everything after that scrolls beneath the bar, which is the point of
   floating it. scroll-padding keeps a focused row from landing behind it. */
body.sc80-cloud #homeView, body.sc80-cloud #library, body.sc80-cloud #discoverView,
body.sc80-cloud #studioView{
  padding-top: calc(var(--sc80-bar) + 12px);
  padding-right: 0;
  scroll-padding-top: calc(var(--sc80-bar) + 12px);
}
'''

STUDIO_CSS_NEW = '''/* ---------- 2. Studio: the split, in the dock ------------------------------ */
/* 80.0.3 - the diagonal moved out of the view and into the tab. The Studio view
   is two panes and nothing else: no tab bar inside it, because the tab bar the
   user already has is the dock. */
.sc80-pane{ display: none; flex-direction: column; }
.sc80-pane.active{ display: flex; }
.sc80-pane .sc-sec:first-child{ margin-top: 0; }
/* The Studio pill is cut corner to corner like the Library pill: the two halves
   are the controls, and the diagonal is the seam between them. */
#studioBtn{ flex: 1.18 1 0; border-radius: 14px; }
#studioBtn #studioHalf, #studioBtn #toolsHalf{ transition: background 0.15s; }
#studioBtn #studioHalf span, #studioBtn #toolsHalf span{ font-size: 9.5px; }
#studioHalf:active, #toolsHalf:active{ transform: scale(0.97); }
#studioHalf:hover, #toolsHalf:hover{ background: rgba(255,255,255,0.06); }
#studioHalf.active-half, #toolsHalf.active-half{ background: transparent !important; }
#studioHalf.active-half span, #toolsHalf.active-half span{ color: var(--coral) !important; font-weight: 700; }
#studioHalf.active-half, #toolsHalf.active-half{ box-shadow: inset 0 0 12px -4px var(--coral); }
'''

STUDIO_JS_NEW = '''  // 80.0.3 - the Studio tab is a diagonal split, the same construction the
  // Library tab has used since 70.0: the top-left half is the studio work, the
  // bottom-right half is Tools. Both halves land on the Studio view and pick
  // their pane; there is no second tab bar inside the view for either to fight
  // with. Tapping the half you are already on leaves you where you are (the old
  // single pill toggled back to Home, which a two-sided tab cannot do without
  // one side meaning two things).
  $('studioBtn').addEventListener('click', (ev) => {
    const half = ev.target && ev.target.closest ? ev.target.closest('[data-studio-tab]') : null;
    const which = half ? half.getAttribute('data-studio-tab') : 'studio';
    const inStudio = $('studioView').classList.contains('active');
    let showing = 'studio';
    try{ if(window.SC80 && SC80.studioTab) showing = SC80.studioTab(); }catch(_eShow){}
    // The half you are already on takes you Home, the way Discover's tab does; the
    // other half moves you across without leaving the view.
    if(inStudio && showing === which){ navigate('home'); return; }
    try{ if(window.SC80 && SC80.setStudioTab) SC80.setStudioTab(which); }catch(_ePick){}
    navigate('studio');
  });
'''

DECORATE_JS_NEW = '''    // 80.0.3 - no bar is built here any more. The split is the dock's Studio
    // tab, so the view is only the two panes.
    host.appendChild(paneStudio);
    host.appendChild(paneTools);
'''

PAINT_TABS_OLD = """    var want = studioTab();
    var tabs = host.querySelectorAll('.sc80-tab');
    for(var i = 0; i < tabs.length; i++){
      var on = tabs[i].getAttribute('data-tab') === want;
      tabs[i].classList.toggle('active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
"""
PAINT_TABS_NEW = """    var want = studioTab();
    // 80.0.3 - the control is in the dock now, so the halves carry the state.
    // A half only lights while the Studio view is the one on screen; the dock
    // itself is painted by navigate(), which is the only thing that knows.
    var open = host.classList.contains('active');
    var sh = document.getElementById('studioHalf');
    var th = document.getElementById('toolsHalf');
    if(sh) sh.classList.toggle('active-half', open && want === 'studio');
    if(th) th.classList.toggle('active-half', open && want === 'tools');
"""

NAV_OLD = """    // Pill highlights
    $('homeBtn').classList.toggle('active', isHome);
"""
NAV_NEW = """    // 80.0.3 - the Studio pill's two halves say which half you are in, the way
    // the Library pill's do, and neither half is lit when Studio is not the view.
    var _stH = document.getElementById('studioHalf');
    var _tlH = document.getElementById('toolsHalf');
    var _stTab = 'studio';
    try{ if(window.SC80 && SC80.studioTab) _stTab = SC80.studioTab(); }catch(_eStTab){}
    if(_stH) _stH.classList.toggle('active-half', isStudio && _stTab === 'studio');
    if(_tlH) _tlH.classList.toggle('active-half', isStudio && _stTab === 'tools');
    // Pill highlights
    $('homeBtn').classList.toggle('active', isHome);
"""

MEASURE_OLD = """      if(!strip || !root) return false;
      var h = Math.round(strip.getBoundingClientRect().height || 0);
"""
MEASURE_NEW = """      if(!strip || !root) return false;
      // 80.0.3 - in the cloud layout the dock is a bar across the TOP, so its
      // height is not a bottom inset and must never be handed to the player as
      // one. It was: a 272px-tall rail pushed the player to the middle of the
      // screen, over the bubbles. The stylesheet puts the player on the safe
      // area in that layout and this drops the measurement so nothing overrides
      // it.
      if(document.body && document.body.classList.contains('sc80-cloud')){
        root.classList.remove('sc-dock-measured');
        return false;
      }
      var h = Math.round(strip.getBoundingClientRect().height || 0);
"""

APPLY_OLD = """    if(cloud){ ensureNowChip(); updateNowChip(); }
    syncCloudControls();
"""
APPLY_NEW = """    if(cloud){ ensureNowChip(); updateNowChip(); }
    syncCloudControls();
    // 80.0.3 - the player's bottom is the dock's height in the classic layout and
    // the screen's own edge in the cloud one, so a switch re-measures the dock
    // (and measureDock itself refuses to measure the top bar). The header's real
    // height goes into --sc80-head on the way, because the cloud bar sits under it.
    requestAnimationFrame(function(){
      try{
        var hd = document.querySelector('header');
        if(hd){
          var hh = Math.round(hd.getBoundingClientRect().height || 0);
          if(hh > 20 && hh < 160) document.documentElement.style.setProperty('--sc80-head', hh + 'px');
        }
      }catch(_eHead){}
      try{ if(window.SC70 && SC70.measureDock) SC70.measureDock(); }catch(_eMeasure){}
    });
"""

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"
CHANGELOG_ENTRY = r"""  { version: '80.0.3', date: 'October 21, 2026 \u00b7 9:15 AM EDT', title: 'The tabs move over the screen, and Tools is a half of the Studio tab', items: [
    'The tabs are one bar across the top of the screen now, floating over the bubbles so the wall scrolls underneath them.',
    'The Studio tab is a diagonal split - Studio on one half, Tools on the other - so Tools is a tab in the dock you can tap, not a tab hidden inside Studio.',
    'Opening Studio no longer shows a second tab bar: the Studio view is just its two halves of work.',
    'The player is back on the bottom edge of the screen in the bubbles layout, where a thumb can reach it.',
    'The header keeps one row now: the bell, refresh and settings stop doubling up, and the small now-playing pill sits in the corner they freed.',
    'The Library pill and the Studio pill are cut the same way, so the two split tabs read as one idea.',
    'The home-screen widget, the player, the letter-by-letter lyrics, the album pill dock and the albums are exactly where 80.0.2 left them.',
  ],
    details: [
      'The bar sits under the header and over the content: it stays put while the bubble wall moves beneath it, so a row of bubbles is never pushed aside to make room for the tabs.',
      'The pill is cut corner to corner, the way the Library pill has been since 70.0: the top-left half is the studio work, the bottom-right half is Tools. Either half opens the Studio view on its side, and the half you are in is the one that lights.',
      'The tab bar that 80.0 put inside the Studio view is gone. Tools is a place in the dock now, so there is one place to look for it and the view keeps its room for the work.',
      'The player was being lifted by the height of the dock so it would clear it. In the bubbles layout the dock is at the top, so that arithmetic put the player in the middle of the page over the bubbles; it sits on the bottom edge now, above the safe area, with nothing underneath it.',
      'The three header buttons move onto the listening-stats bubble in this layout, and their old row was supposed to hide. It did not, because its own inline style beat the stylesheet, so the same three buttons were on the screen twice and the small now pill was drawn over them. The row hides for real now and the pill has that corner.',
      'Two splits in one dock could easily read as two different ideas; they are the same seam, the same corner-to-corner cut and the same corner labels, so a tap in the top-left half means the first thing and a tap in the bottom-right half means the second, in both pills.',
      'Nothing about the music changed in this release: the widget, the player, the letter-by-letter lyrics and the albums are untouched.',
    ] },
"""


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def write(rel, src):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        f.write(src)


def once(rel, old, new, label, applied):
    src = read(rel)
    if new in src:
        print('  present: ' + label)
        return applied
    if src.count(old) != 1:
        # The owner asked for changes while the release was open, so some steps are
        # revised by a later step: on a page that already carries the revisions, this
        # step's OLD anchor and its NEW text are both gone. SC_DOCK_SPLITS is the
        # marker those revisions introduce, and it cannot be on an unrevised page -
        # the rehearsal from 80.0.2 proves the anchors still bite there.
        if src.count(old) == 0 and 'var SC_DOCK_SPLITS = {' in src:
            print('  present (revised by a later step): ' + label)
            return applied
        sys.exit('patch-8003: anchor for "%s" found %d times (want 1)' % (label, src.count(old)))
    if not CHECK:
        write(rel, src.replace(old, new, 1))
    print('  applied: ' + label)
    return applied + 1


def between(rel, start, end, new, label, applied):
    src = read(rel)
    # A step whose block a LATER step revises (the owner asked for changes while the
    # release was open) can no longer find its own text verbatim, and its start anchor
    # is gone too - this step is the only thing that removes it. Either one means the
    # step has already run; an unpatched page always still has the start anchor.
    if new in src or src.find(start) == -1:
        print('  present: ' + label)
        return applied
    i = src.find(start)
    j = src.find(end, i + 1) if i != -1 else -1
    if i == -1 or j == -1:
        sys.exit('patch-8003: block "%s" not found (start %s, end %s)' % (label, i != -1, j != -1))
    if not CHECK:
        write(rel, src[:i] + new + src[j:])
    print('  applied: ' + label)
    return applied + 1


def once_old(rel, old, new, label, applied):
    """Same as once(), for the steps whose NEW text is a prefix that is already
    in the file (deleting a line leaves its neighbour behind). The old anchor is
    the only reliable "not done yet" signal here."""
    src = read(rel)
    if src.count(old) == 1:
        if not CHECK:
            write(rel, src.replace(old, new, 1))
        print('  applied: ' + label)
        return applied + 1
    if new and new in src:
        print('  present: ' + label)
        return applied
    if not new:
        # A deletion: the anchor above is gone, which is the whole job.
        print('  present: ' + label)
        return applied
    sys.exit('patch-8003: anchor for "%s" found %d times (want 1)' % (label, src.count(old)))


def load_revisions():
    """The unified diff the revisions are carried in (a sibling file: the diff is
    most of this release's text, and a .py beside this one is hashed by
    dev/release-proof.sh already)."""
    import importlib.util
    path = os.path.join(ROOT, 'dev', 'patch-8003-revisions.py')
    spec = importlib.util.spec_from_file_location('sc8003_revisions', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.REVISIONS_PATCH


def apply_revisions(applied):
    """Apply dev/patch-8003-revisions.py over the tree the steps above produced.

    The owner looked at the first cut and changed two things - the Studio pill is
    cut side by side with Tools on the RIGHT, and the Look-and-feel card is in
    Studio, Tools only, not in Settings, More - so this release's page is that
    first cut PLUS this diff. It is a diff rather than another dozen hand-written
    anchors because the two halves of the pill moved: the seam, the hit test and
    the drawn line all changed together, and a diff says that once.

    `patch` (not `git apply`) because the proof harness rehearses this in a plain
    directory as well as in the checkout.
    """
    import subprocess
    if ('var SC_DOCK_SPLITS = {' in read('index.html')
            and 'the look switches live in Tools' in read('dev/revamp-check.cjs')):
        print('  present: the revisions - the pill cut side by side, the look card in Tools')
        return applied
    diff = load_revisions()
    tmp = os.path.join(ROOT, 'dev', '.8003-revisions.diff')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(diff)
    cmd = ['patch', '-p1', '-s', '--batch', '--forward', '--no-backup-if-mismatch']
    if CHECK:
        cmd.append('--dry-run')
    cmd += ['-i', tmp]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        sys.exit('patch-8003: the revisions did not apply (%d)\n%s%s' % (r.returncode, r.stdout, r.stderr))
    print('  applied: the revisions - the pill cut side by side, the look card in Tools')
    return applied + 1


def main():
    applied = 0

    # ---- CSS ----------------------------------------------------------------
    applied = between('index.html',
                      '/* ---------- 4. Cloud layout: floating bubbles, dock on the right ---------- */',
                      '\n/* Bubbles are bubbles:',
                      CLOUD_CSS_NEW, 'the cloud dock becomes a bar across the top', applied)

    applied = between('index.html',
                      '/* ---------- 2. Studio: the diagonal Studio / Tools split ---------- */',
                      '\n/* The milestones card and the look card are the same card the rest of Studio',
                      STUDIO_CSS_NEW, 'the in-view tab bar CSS is replaced by the split pill', applied)

    # `right: 12px` is all over this stylesheet, so the OLD anchor is the only
    # honest "not done yet" test for this one.
    applied = once_old('index.html',
                   '  right: calc(var(--sc80-dock, 76px) + 14px);',
                   '  right: 12px;',
                   'the now pill takes the header corner', applied)

    # ---- markup -------------------------------------------------------------
    applied = once('index.html',
                   '  <button id="studioBtn" class="action-pill">Studio</button>\n',
                   STUDIO_TAB_NEW, 'the Studio pill is a diagonal split', applied)

    # ---- the dock's two halves ---------------------------------------------
    applied = once('index.html',
                   """  $('studioBtn').addEventListener('click', () => {
    navigate($('studioView').classList.contains('active') ? 'home' : 'studio');
  });
""",
                   STUDIO_JS_NEW, 'each half picks its pane and opens Studio', applied)

    # ---- the view keeps its panes, loses its bar ----------------------------
    # The anchor carries the class it sets, because `var bar = createElement` on
    # its own appears all over a 55,000-line page (it did: the first match was
    # 40,000 lines above this one, and the block delete took everything between).
    applied = between('index.html',
                      '    var bar = document.createElement(\'div\');\n    bar.className = \'sc80-tabs\';',
                      '    wireLookCard(paneTools);\n',
                      DECORATE_JS_NEW, 'decorateStudio stops building a tab bar', applied)

    # The "already split" guard WAS the tab bar's presence. With the bar gone
    # the guard has to name the panes, or every MutationObserver tick re-wraps
    # the panes inside new ones (it did: 200 nested .sc80-pane nodes).
    applied = once('index.html',
                   "    if(host.querySelector('.sc80-tabs')) return; // already split\n",
                   "    if(host.querySelector('.sc80-pane')) return; // already split - the split is the dock tab now\n",
                   'the already-split guard names the panes', applied)

    # Copy that described the old shape, in the two places the reader meets it.
    applied = once('index.html',
                   "'Cloud layout - bubbles, the dock on the right, the small now bar up top'",
                   "'Cloud layout - bubbles, the tabs across the top, the small now bar up top'",
                   'the layout toast describes the bar, not the rail', applied)

    applied = once('index.html',
                   'Cloud bubbles<small>Floating round bubbles, the dock down the right, a small now bar up top.</small>',
                   'Cloud bubbles<small>Floating round bubbles, the tabs across the top, a small now bar up top.</small>',
                   'the Look and feel card describes the bar, not the rail', applied)

    applied = once('index.html', PAINT_TABS_OLD, PAINT_TABS_NEW,
                   'paintStudioTab lights the dock halves instead of in-view tabs', applied)

    applied = once('index.html', NAV_OLD, NAV_NEW,
                   'navigate keeps the dock halves in step with the pane', applied)

    applied = once('index.html', MEASURE_OLD, MEASURE_NEW,
                   'measureDock refuses to measure the top bar', applied)

    applied = once('index.html', APPLY_OLD, APPLY_NEW,
                   'switching layout re-measures the dock and the header', applied)

    # ---- the breakpoints that named the old rail ---------------------------
    applied = once_old('index.html',
                   '  body.sc80-cloud .home-bubble{ width: calc(25% - 14px); }\n  .sc80-tabs{ max-width: 560px; }\n',
                   '  body.sc80-cloud .home-bubble{ width: calc(25% - 14px); }\n',
                   'the 760px breakpoint stops naming the in-view bar', applied)

    applied = once('index.html',
                   '  body.sc80-cloud .action-strip{ right: 22px; }\n',
                   '  body.sc80-cloud .action-strip{ left: 22px; right: 22px; }\n',
                   'the wide breakpoint keeps the bar centred', applied)

    applied = once_old('index.html',
                   '  #studioView .sc80-tabs{ max-width: 620px; }\n',
                   '', 'the 1000px breakpoint stops naming the in-view bar', applied)

    applied = once('index.html',
                   '  body.sc80-cloud{ --sc80-dock: 64px; }\n',
                   '  body.sc80-cloud{ --sc80-bar: 50px; }\n',
                   'landscape shortens the bar', applied)

    # ---- the release itself -------------------------------------------------
    src = read('index.html')
    if "const APP_VERSION = '80.0.3';" not in src:
        applied = once('index.html', "  const APP_VERSION = '80.0.2';",
                       "  const APP_VERSION = '80.0.3';", 'the page runs as 80.0.3', applied)

    src = read('index.html')
    if "{ version: '80.0.3'," not in src:
        applied = once('index.html', CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + CHANGELOG_ENTRY,
                       'the 80.0.3 changelog entry', applied)

    sw = read('sw.js')
    if "const CACHE_NAME = 'sidecut-shell-v80.0.3';" not in sw:
        applied = once('sw.js', "const CACHE_NAME = 'sidecut-shell-v80.0.2';",
                       "const CACHE_NAME = 'sidecut-shell-v80.0.3';",
                       'the shell cache moves with the release', applied)


    # ---- the revisions the owner asked for while the release was open --------
    applied = apply_revisions(applied)

    print('patch-8003%s: %d step(s) applied' % (' --check' if CHECK else '', applied))
    return 0


if __name__ == '__main__':
    sys.exit(main())
