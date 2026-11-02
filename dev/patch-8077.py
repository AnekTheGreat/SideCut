#!/usr/bin/env python3
"""80.7.7 - every screen has a right size.

    python3 dev/patch-8077.py
    python3 dev/patch-8077.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

THE FAULT. The page was laid out for one screen: a phone held in one hand. The
stylesheet had breakpoints up to 1600px, but they only moved the max-width of the
views, and the three surfaces that actually get touched - the dock, the tab strip
and the player - were still built out of phone numbers: five pills stretched edge
to edge across a monitor, 11px labels on a television, the same 12px padding on a
fold hinge as on a bezel.

 1. THE VERSION.
 2. THE FITTING STYLESHEET, appended last so it is the last word on the properties
    it sets: a narrow-screen rung for an outer folding display and a split window,
    fluid side padding that is max()ed against the display insets (so a hinge, a
    notch and a rounded corner keep their gap), a dock that becomes a centred
    cluster on a wide screen instead of five words at opposite ends of a desk, and
    a television rung that grows the text, the targets and the player with the
    screen.
 3. THE CHANGELOG, as every release has it.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.7'
MARKER = '80.7.7 - EVERY SCREEN HAS A RIGHT SIZE'
ANCHOR = "  { version: '80.7.6',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8077: already on the page, the page is %s' % VERSION)
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
once('the page says 80.7.7',
     "const APP_VERSION = '80.7.6';",
     "const APP_VERSION = '80.7.7';")

# -- 2. the fitting stylesheet ------------------------------------------------
FIT = r"""<style id="sc77Fit">
/* ==========================================================================
   80.7.7 - EVERY SCREEN HAS A RIGHT SIZE.

   The page was built for one phone held in one hand: five dock pills stretched
   edge to edge across a monitor, 11px labels on a television, the same 12px of
   side padding against a fold hinge as against a bezel. This sheet is appended
   last, so it is the last word on every property it sets, and it only ever sets
   a property inside a query - the phone layout below 561px is untouched.

   TWO RULES HOLD THE WHOLE THING TOGETHER.
   1. Side padding is always max(<a size>, env(safe-area-inset-...)). A fold
      hinge, a notch and a rounded corner are display edges, not bezels, and the
      inset is subtracted from the usable width, so a rule that set a bare 20px
      here would put a song title under the hinge on a Flex.
   2. Nothing in here transforms a fixed surface. #actionStrip holds fixed
      children (#addSongsMenu, #addSongsBackdrop) and a transform on the strip
      would make the strip their containing block and move both of them.
   ========================================================================== */

/* ---------- 0. AN EDGE CASE NEVER PUSHES THE PAGE SIDEWAYS ---------------- */
html{ -webkit-text-size-adjust:100%; text-size-adjust:100%; }
html, body{ max-width:100%; overflow-x:hidden; }
#listPane, #homeView, #discoverView, #studioView, #nowPlaying, #library{ min-width:0; }

/* ---------- 1. OUTER FOLD, SPLIT WINDOW, VERY NARROW (<=380) ------------- */
/* The cover screen of a folded phone and half of a split window land here. The
   brand subtitle and the player's disc give up their room first, because they
   are decoration and the title, the controls and the dock are not. */
@media (max-width:380px){
  header{ padding:14px 12px 8px; }
  .brand h1{ font-size:17px; }
  .brand span{ display:none; }
  .brand-mark{ width:26px; height:26px; }
  #homeView{ padding:10px 10px 150px; }
  #discoverView{ padding:10px 10px 150px; }
  #studioView{ padding:10px 10px 150px; }
  #nowPlaying{
    padding-left:max(10px, env(safe-area-inset-left));
    padding-right:max(10px, env(safe-area-inset-right));
  }
  body:not(.sc80-cloud) #npPlayerStage{ width:46px; height:40px; }
  .np-row{ gap:8px; }
  body:not(.sc80-cloud) #npInfo .t{ font-size:12.5px; }
  body:not(.sc80-cloud) #npInfo .a{ font-size:10.5px; }
  #npControls{ gap:0; }
  body:not(.sc80-cloud) #npControls button{ width:30px; height:34px; }
  .action-pill{ font-size:10.5px; letter-spacing:0; padding:6px 3px; }
  #tabs .tab{ min-height:34px; padding:7px 12px; font-size:12px; }
  .track{ padding:9px 10px; gap:8px; }
  .pane-header{ padding:6px 10px; margin:2px 8px 8px; }
  #searchInput{ font-size:13px; }
}

/* ---------- 2. FLUID SIDE PADDING (>=561) --------------------------------- */
/* One clamp for every surface instead of a fixed 20 that becomes 24 at 561, 28
   at 1024 and nothing at 1600. max() keeps the display inset as the floor. */
@media (min-width:561px){
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
  body:not(.sc80-cloud) #npPlayerStage{ width:70px; height:58px; }
}

/* ---------- 3. INNER FOLD, SMALL TABLET (568-1023) ------------------------ */
/* The open half of a folding phone. The list is what gets read here, so it is
   given a measure instead of the full width of the panel, and the bubbles keep
   three to a row so each one still fits a thumb. */
@media (min-width:568px) and (max-width:1023px){
  #listPane{ max-width:1000px; margin-left:auto; margin-right:auto; width:100%; }
  .pane-header{ max-width:960px; }
  body:not(.sc80-cloud) #homeBubbles{ grid-template-columns:repeat(3, minmax(0, 1fr)); }
  .track{ padding:13px 20px; }
}

/* ---------- 4. DESKTOP WINDOW (>=1024) ------------------------------------ */
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
  body:not(.sc80-cloud) #npPlayerStage{ width:76px; height:62px; }
  body:not(.sc80-cloud) #npInfo .t{ font-size:15px; }
  body:not(.sc80-cloud) #npInfo .a{ font-size:12px; }
  #nowPlaying{ max-width:1280px; }
}

/* ---------- 5. BIG MONITOR (>=1440) --------------------------------------- */
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
  .action-pill{ font-size:13px; min-height:46px; }
}

/* ---------- 6. TELEVISION AND VERY WIDE (1800+ AND TALL, OR 2400+) -------- */
/* A ten-foot interface, not a phone mirrored onto a big panel: the type, the
   targets and the player all grow together, the dock stays inside a comfortable
   width in the middle of the screen, and keyboard focus is always visible
   because a remote is a keyboard. */
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

/* ---------- 7. SHORT AND WIDE: LANDSCAPE PHONE, SPLIT WINDOW, CAR ---------- */
/* Height is the scarce axis here, so the player gives up its disc first and the
   header gives up its padding, in that order, and both keep their titles. */
@media (orientation:landscape) and (max-height:520px){
  header{ padding-top:8px; padding-bottom:4px; }
  .brand span{ display:none; }
  #homeView, #discoverView, #studioView{ padding-top:8px; padding-bottom:130px; }
  #nowPlaying{ padding-top:6px; padding-bottom:6px; }
  body:not(.sc80-cloud) #npPlayerStage{ width:40px; height:34px; }
  body:not(.sc80-cloud) #npInfo .t{ font-size:12.5px; }
  body:not(.sc80-cloud) #npInfo .a{ font-size:10.5px; }
  .np-row{ gap:8px; }
  .action-pill{ min-height:38px; font-size:10.5px; padding:5px 3px; }
  .modal{ max-height:92vh; }
}

/* ---------- 8. THUMBS, NOT CURSORS --------------------------------------- */
/* A coarse pointer gets a 44px target on the things that are always on screen -
   the tabs, the dock and the header icons - and the player's own buttons are
   left alone at the very narrow widths, where six of them plus the disc and the
   title have to share 320px. */
@media (pointer:coarse){
  #tabs .tab{ min-height:44px; }
  .action-pill{ min-height:44px; }
  #notifBtn, #refreshBtn, #themeBtn{ min-width:44px; min-height:44px; }
}
@media (pointer:coarse) and (min-width:420px){
  #npControls button{ min-width:44px; min-height:44px; }
}
</style>
</head>"""

once('the fitting stylesheet is appended before the end of the head',
     '</style>\n</head>',
     '</style>\n' + FIT)

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
    "  // 80.7.7 - EVERY SCREEN HAS A RIGHT SIZE.\n"
    "  { version: '80.7.7', date: '{{STAMP}}', title: 'Every screen fits', items: [\n"
    "    'The whole page now fits the display it is on, from an outer folding screen through an unfolded one, a split window, a desktop and a television, with nothing cut off at any width.',\n"
    "    'The dock stays a reachable cluster of five buttons instead of five words spread across a wide monitor, and the text, the tap targets and the player grow with the screen instead of staying phone sized.',\n"
    "    'Every view keeps clear of a hinge, a notch and a rounded corner, because the space at the edges is measured from the display instead of assumed.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8077: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8077: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8077: %d steps applied, page is %s' % (len(applied), VERSION))
