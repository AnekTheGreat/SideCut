#!/usr/bin/env python3
"""80.7.8 - phones keep their own layout.

    python3 dev/patch-8078.py
    python3 dev/patch-8078.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHY. 80.7.7 shipped a fitting stylesheet that reached into the phone layout where
it had no business being: it hid the line under the title ("Your files, no ads\never") at 380 and below and on a landscape phone, and it resized the dock pills,
the tabs, the header icons and the player buttons on any coarse pointer. The
owner noticed immediately. A phone was never the problem - the problem was the
desktop and the television - so this release keeps the wide-screen rungs and
deletes every rule that touched a phone.

WHAT THIS LEAVES. The sheet still starts on a screen that is at least 561px wide
and at least 521px tall, so a phone held sideways (the short-and-wide case) keeps
its phone layout rather than being handed the tablet one. Above that: fluid side
padding measured against the display insets, the inner-fold measure, the centred
desktop dock, the big-monitor rung and the television rung. Nothing hides the
line under the title, and nothing anywhere in it changes a target size.
"""
import datetime
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.8'
MARKER = '80.7.8 - PHONES KEEP THEIR OWN LAYOUT'
ANCHOR = "  { version: '80.7.7',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8078: already on the page, the page is %s' % VERSION)
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
once('the page says 80.7.8',
     "const APP_VERSION = '80.7.7';",
     "const APP_VERSION = '80.7.8';")

# -- 2. the fitting stylesheet, with the phone rungs taken out ----------------
FIT = r"""<style id="sc77Fit">
/* ==========================================================================
   80.7.8 - PHONES KEEP THEIR OWN LAYOUT.

   80.7.7 tried to fit every screen at once and reached into the phone layout on
   the way past: the line under the title was hidden at 380 and below and on a
   landscape phone, and the dock, the tabs, the header icons and the player
   buttons were resized for any coarse pointer. That was wrong - the phone was
   never the screen that looked bad. Every rule that touched one is gone.

   What is left starts at 561px wide AND 521px tall, so a phone held sideways
   (short and wide) keeps the phone layout instead of being handed the tablet
   one, and it grows from there: fluid side padding, the inner-fold measure, the
   centred desktop dock, a big monitor and a television.

   TWO RULES HOLD THE REST TOGETHER.
   1. Side padding is always max(<a size>, env(safe-area-inset-...)). A fold
      hinge, a notch and a rounded corner are display edges, not bezels, and the
      inset is subtracted from the usable width, so a bare 20px here would put a
      song title under the hinge on a Flex.
   2. Nothing in here transforms a fixed surface. #actionStrip holds fixed
      children (#addSongsMenu, #addSongsBackdrop) and a transform on the strip
      would make the strip their containing block and move both of them.
   ========================================================================== */

/* ---------- 0. AN EDGE CASE NEVER PUSHES THE PAGE SIDEWAYS ---------------- */
html{ -webkit-text-size-adjust:100%; text-size-adjust:100%; }
html, body{ max-width:100%; overflow-x:hidden; }
#listPane, #homeView, #discoverView, #studioView, #nowPlaying, #library{ min-width:0; }

/* ---------- 1. FLUID SIDE PADDING (>=561 WIDE, AT LEAST 521 TALL) --------- */
/* One clamp for every surface instead of a fixed 20 that becomes 24 at 561, 28
   at 1024 and nothing at 1600. max() keeps the display inset as the floor. The
   height floor is what keeps a landscape phone out of this rung. */
@media (min-width:561px) and (min-height:521px){
  header{
    padding-left:max(clamp(18px, 3.2vw, 44px), env(safe-area-inset-left));
    padding-right:max(clamp(18px, 3.2vw, 44px), env(safe-area-inset-right));
  }
  #homeView, #discoverView, #studioView{
    padding-left:max(clamp(16px, 3.2vw, 44px), env(safe-area-inset-left));
    padding-right:max(clamp(16px, 3.2vw, 44px), env(safe-area-inset-right));
  }
  #listPane{
    padding-left:max(clamp(8px, 1.6vw, 24px), env(safe-area-inset-left));
    padding-right:max(clamp(8px, 1.6vw, 24px), env(safe-area-inset-right));
  }
  #nowPlaying{
    padding-left:max(clamp(12px, 2vw, 28px), env(safe-area-inset-left));
    padding-right:max(clamp(12px, 2vw, 28px), env(safe-area-inset-right));
  }
  .tabs{
    padding-left:max(clamp(10px, 2vw, 28px), env(safe-area-inset-left));
    padding-right:max(clamp(10px, 2vw, 28px), env(safe-area-inset-right));
  }
  .pane-header{ margin-left:auto; margin-right:auto; }
}

/* ---------- 2. INNER FOLD, SMALL TABLET (568-1023) ------------------------ */
/* The open half of a folding phone. The list is what gets read here, so it is
   given a measure instead of the full width of the panel. */
@media (min-width:568px) and (max-width:1023px) and (min-height:521px){
  #listPane{ max-width:1000px; margin-left:auto; margin-right:auto; width:100%; }
  .pane-header{ max-width:960px; }
  .track{ padding:13px 20px; }
}

/* ---------- 3. DESKTOP WINDOW (>=1024) ------------------------------------ */
/* THE DOCK STOPS SPREADING. Five pills with flex:1 across a 27-inch monitor put
   Home and the plus in different postcodes. They are a centred cluster now, and
   the strip behind them still spans the window so the player above it keeps its
   full width. */
@media (min-width:1024px){
  body:not(.sc80-cloud) #actionStrip{ justify-content:center; gap:10px; }
  body:not(.sc80-cloud) #actionStrip > #homeBtn,
  body:not(.sc80-cloud) #actionStrip > #libraryBtn,
  body:not(.sc80-cloud) #actionStrip > #discoverBtn,
  body:not(.sc80-cloud) #actionStrip > #studioBtn,
  body:not(.sc80-cloud) #actionStrip > #dockAddBtn{
    flex:0 1 176px; max-width:176px; min-width:0;
  }
  #searchInput{ max-width:620px; }
  #discoverSearchRow{ max-width:820px; }
  .pane-header h2{ font-size:19px; }
  .track{ padding:13px 24px; }
  #nowPlaying{ max-width:1280px; }
}

/* ---------- 4. BIG MONITOR (>=1440) --------------------------------------- */
@media (min-width:1440px){
  header, #homeView, #discoverView, #studioView, #library, #nowPlaying{ max-width:1360px; }
  body:not(.sc80-cloud) #homeBubbles{ max-width:1360px; grid-template-columns:repeat(5, minmax(0, 1fr)); }
  body.sc80-cloud #homeBubbles{ max-width:1360px; }
  body:not(.sc80-cloud) #actionStrip > #homeBtn,
  body:not(.sc80-cloud) #actionStrip > #libraryBtn,
  body:not(.sc80-cloud) #actionStrip > #discoverBtn,
  body:not(.sc80-cloud) #actionStrip > #studioBtn,
  body:not(.sc80-cloud) #actionStrip > #dockAddBtn{
    flex:0 1 200px; max-width:200px;
  }
}

/* ---------- 5. TELEVISION AND VERY WIDE (1800+ AND TALL, OR 2400+) -------- */
/* A ten-foot interface, not a phone mirrored onto a big panel: the type, the
   targets and the player all grow together, and keyboard focus is always
   visible because a remote is a keyboard. This is the only rung in the sheet
   that changes a target size, and it cannot match a phone. */
@media (min-width:1800px) and (min-height:900px), (min-width:2400px){
  header{ max-width:1600px; }
  #homeView, #discoverView, #studioView, #library, #nowPlaying{ max-width:1600px; }
  body:not(.sc80-cloud) #homeBubbles{ max-width:1600px; grid-template-columns:repeat(6, minmax(0, 1fr)); }
  body.sc80-cloud #homeBubbles{ max-width:1600px; }
  .brand h1{ font-size:28px; }
  .brand span{ font-size:12.5px; }
  .brand-mark{ width:34px; height:34px; }
  body:not(.sc80-cloud) #actionStrip > #homeBtn,
  body:not(.sc80-cloud) #actionStrip > #libraryBtn,
  body:not(.sc80-cloud) #actionStrip > #discoverBtn,
  body:not(.sc80-cloud) #actionStrip > #studioBtn,
  body:not(.sc80-cloud) #actionStrip > #dockAddBtn{
    flex:0 1 240px; max-width:240px;
  }
  .action-pill{ font-size:16px; min-height:58px; }
  #tabs .tab{ min-height:50px; padding:12px 20px; font-size:15px; }
  #searchInput{ font-size:16px; padding:13px 42px 13px 18px; max-width:720px; }
  .pane-header h2{ font-size:22px; }
  .track{ padding:16px 26px; }
  body:not(.sc80-cloud) #homeGreeting{ font-size:19px; }
  .home-bubble{ min-height:170px; }
  body:not(.sc80-cloud) #npPlayerStage{ width:96px; height:78px; }
  body:not(.sc80-cloud) #npInfo .t{ font-size:21px; }
  body:not(.sc80-cloud) #npInfo .a{ font-size:14.5px; }
  body:not(.sc80-cloud) #npControls button{ width:52px; height:52px; }
  #curTime, #totalTime{ font-size:13px; }
  .modal{ max-width:760px; }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible{
    outline:3px solid var(--coral); outline-offset:3px;
  }
  .track:focus-visible, .home-bubble:focus-visible{ outline:3px solid var(--coral); outline-offset:-3px; }
}
</style>"""

START = '<style id="sc77Fit">'
END = '</style>\n</head>'
if SRC.count(START) != 1 or SRC.count(END) != 1:
    failed.append('the 80.7.7 sheet: found %d starts and %d ends, expected 1 each'
                  % (SRC.count(START), SRC.count(END)))
else:
    s = SRC.index(START)
    e = SRC.index(END, s) + len('</style>')
    OLD = SRC[s:e]
    # The sheet being replaced must be the 80.7.7 one, or nothing happens at all.
    if '1. OUTER FOLD, SPLIT WINDOW' not in OLD:
        failed.append('the sheet in the page is not the 80.7.7 one')
    else:
        SRC = SRC[:s] + FIT + SRC[e:]
        applied.append('the phone rungs are out of the fitting stylesheet')

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
    "  // 80.7.8 - PHONES KEEP THEIR OWN LAYOUT.\n"
    "  { version: '80.7.8', date: '{{STAMP}}', title: 'Phones kept their own', items: [\n"
    "    'The line under the title is back on every phone, exactly where it was, because nothing about the phone needed changing.',\n"
    "    'Buttons on phones are the size they were before, so nothing you already knew how to reach has moved or grown.',\n"
    "    'A phone held sideways keeps its own layout too, and the roomier layout is reserved for the wide screens it was meant for.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8078: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8078: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8078: %d steps applied, page is %s' % (len(applied), VERSION))
