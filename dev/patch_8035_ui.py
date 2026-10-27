"""80.3.5, sections 1 and 3 - Settings -> More, rebuilt as rows that open.

The owner's ask, verbatim:

    "also playback and playback and sound should be merged into one thing and make
     it clean the settings and more tab with like the things on the left and a
     smooth drop-down that shows when you click on it to clean up clutter and
     nothing should be left out of the drop-down everything shuikd be in it it
     should be mapped after color os 17"

Three changes, one file:

  * PLAYBACK AND PLAYBACK & SOUND ARE ONE THING. The pane carried two groups over
    one subject: "Sound" (a bare header - not even a card - whose body held the
    refresh-rate pane, the playback pane and the EQ) and "Playback" (a card whose
    body held the sleep timer, gapless, next album and the per-playlist sort).
    They are ONE card now, "Playback & sound", and its body keeps every control
    that was in either of them, under four labels: Playback, Sleep & queue, Sound,
    Display. The three panes are moved VERBATIM - the harness diffs them against
    origin/main - so this is a move, not a rewrite of anything that works.

  * NOTHING IS LEFT OUT OF A DROP-DOWN. Every direct child of #settingsPaneMore is
    either a section label (.sc-mgroup) or a card (.sc-set-card) with a head and a
    body. The pieces that were sitting bare between cards are rows now: the
    tutorial, the three layout switches (each gets its own row, with the switch
    itself on the row where ColorOS would put it), "Ask artist when importing
    songs", and "About & updates" (the version is on the row, its three buttons
    are in the drop-down). The box that wrapped everything from "Check for
    updates" down to the Sound group is gone: a border around a list of groups is
    a box inside a box.

  * IT READS LIKE A SETTINGS LIST. Title on the left, its own state on the right,
    and a marker that turns as the row opens; the height of the body is what
    opens, so the drop-down slides instead of appearing. See the CSS below and
    scRowSet() in the opener for how the slide is done without breaking the one
    thing the rest of the app depends on: `style.display` stays the truth.

Imported by dev/patch-8035.py; holds constants and the pane rebuild.
"""

MORE_CSS_ANCHOR = "/* \u2500\u2500\u2500 Settings tab strip horizontal scrollbar \u2500\u2500\u2500 */"

# 80.3.2 wrote these two rules for a header that was a direct child of the pane.
# The merged row is a card of its own now, so they match nothing and go.
OLD_DIRECT_RULES = """#settingsPaneMore > #collapsiblePlaybackSound{
  border:1px solid var(--line) !important; border-radius:12px 12px 0 0 !important;
  background:rgba(255,255,255,0.02) !important;
}
#settingsPaneMore > #collapsiblePlaybackSoundContent{
  border:1px solid var(--line) !important; border-top:1px solid var(--line) !important;
  border-radius:0 0 12px 12px !important; margin-top:-1px;
  background:rgba(255,255,255,0.02);
}
"""

MORE_CSS = """/* \u2500\u2500\u2500 80.3.5 - Settings \u2192 More, as rows with the title on the left \u2500\u2500\u2500
   The shape is a phone settings list: a section label, then cards, and every
   card is one row you tap to open. A row carries its own state on the right (a
   switch, a value, or the version) and one marker that turns when it opens; the
   controls and the explanation live in the drop-down under it. */
#settingsPaneMore .sc-mgroup{
  font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:1.8px;
  text-transform:uppercase; color:var(--ink-dim); opacity:.66;
  margin:24px 5px 8px; line-height:1;
}
#settingsPaneMore > .sc-mgroup:first-child{ margin-top:2px; }
#settingsPaneMore .sc-set-card{
  border:1px solid var(--line); border-radius:14px; margin-bottom:8px;
  overflow:hidden; background:rgba(255,255,255,0.025);
}
#settingsPaneMore .sc-set-head{
  width:100% !important; padding:14px 15px !important;
  background:none !important; border:none !important;
  color:var(--ink) !important; font-size:13.5px !important; font-weight:600 !important;
  font-family:var(--font-ui); cursor:pointer; display:flex; align-items:center;
  gap:10px; text-align:left; letter-spacing:.1px; box-sizing:border-box;
  -webkit-tap-highlight-color:transparent;
}
#settingsPaneMore .sc-set-head .sc-set-title{ flex:1 1 auto; min-width:0; }
#settingsPaneMore .sc-set-val{
  flex:0 0 auto; font-size:11.5px; font-weight:500; color:var(--ink-dim);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
#settingsPaneMore .sc-set-head > button,
#settingsPaneMore .sc-set-head > .tab{ flex:0 0 auto; }
#settingsPaneMore .sc-set-head > span:last-child{
  flex:0 0 auto; font-size:10px; color:var(--ink-dim); opacity:.7; line-height:1;
  transition:transform .3s cubic-bezier(.22,.61,.36,1);
}
#settingsPaneMore .sc-set-card.sc-open > .sc-set-head > span:last-child{ transform:rotate(180deg); }
/* THE DROP-DOWN IS A HEIGHT. Shut, the body is clipped to nothing and its padding
   is zero, so a closed row is one line tall; open, it is its own height with its
   padding back. The row carries `sc-open`, so the marker turns on the same frame
   the slide starts rather than when it lands. */
#settingsPaneMore .sc-set-body{
  box-sizing:border-box; overflow:hidden; opacity:0;
  padding:0 15px !important; border-top:1px solid var(--line) !important;
  transition:max-height .34s cubic-bezier(.22,.61,.36,1),
             padding-top .34s cubic-bezier(.22,.61,.36,1),
             padding-bottom .34s cubic-bezier(.22,.61,.36,1),
             opacity .22s ease;
}
#settingsPaneMore .sc-set-card.sc-open > .sc-set-body{ padding:14px 15px !important; opacity:1; }
#settingsPaneMore .sc-set-body > div:last-child{ margin-bottom:0; }
/* The labels that divide the one Playback & sound drop-down into its parts. */
#settingsPaneMore .sc-sub{
  font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:1.6px;
  text-transform:uppercase; color:var(--coral); opacity:.85;
  margin:2px 0 12px; line-height:1;
}
#settingsPaneMore .sc-set-body > .sc-sub:not(:first-child){
  margin-top:22px; padding-top:16px; border-top:1px solid var(--line);
}
#settingsPaneMore .playlist-pick-btn{ border-radius:10px; }
"""

# ---------------------------------------------------------------------------
# The pieces that were bare and are rows now.
# ---------------------------------------------------------------------------
WRAP_OPEN_OLD = """      <div style="margin-bottom:16px; border:1px solid var(--line); border-radius:10px; overflow:hidden;">
        <!-- Collapsible: Check for updates (native only, unhidden below) -->"""

WRAP_OPEN_NEW = """      <div class="sc-mgroup">General</div>
      <!-- 80.3.5 - the box that used to wrap everything from here down to the
           Sound group is gone. A border around a list of groups is a box inside a
           box, and every item below is a card of its own now. -->
      <!-- Collapsible: Check for updates (native only, unhidden below) -->"""

OTA_OLD = """      <div id="otaSettingsBlock" style="border:1px solid var(--line); border-radius:8px; margin-bottom:8px; overflow:hidden; display:none;">"""
OTA_NEW = """      <div class="sc-set-card" id="otaSettingsBlock" style="display:none;">"""

MEDIA_OLD = """      <div id="mediaNotifSettingsBlock" style="display:none; border:1px solid var(--line); border-radius:8px; margin-bottom:16px; overflow:hidden;">"""
MEDIA_NEW = """      <div class="sc-set-card" id="mediaNotifSettingsBlock" style="display:none;">"""

TUT_ROW_OLD = """      <div style="margin-bottom:16px;">
        <button class="playlist-pick-btn" id="howToUseBtn" style="text-align:center;">\U0001f393 Replay tutorial</button>
        <div style="font-size:11px; color:var(--ink-dim); margin-top:6px; text-align:center;">Shown automatically the first time you open the app \u2014 replay it anytime from here.</div>
      </div>"""

TUT_ROW_NEW = """      <div class="sc-set-card">
        <button class="sc-set-head" id="collapsibleTutorial" aria-expanded="false">
          <span class="sc-set-title">Tutorial</span><span id="collapseTutorialIcon" class="sc-set-chev">\u25be</span>
        </button>
        <div class="sc-set-body" id="collapsibleTutorialContent" style="display:none;">
          <button class="playlist-pick-btn" id="howToUseBtn" style="text-align:center; width:100%;">\U0001f393 Replay tutorial</button>
          <div style="font-size:11px; color:var(--ink-dim); margin-top:6px;">Shown automatically the first time you open the app \u2014 replay it anytime from here.</div>
        </div>
      </div>"""

# The three switches that shared one box. Each is a row now, with its own switch
# ON the row (the head is a div, not a button, so a switch inside it is legal HTML
# and its own tap stays its own tap) and the explanation in its drop-down.
LAYOUT_OLD = """      <!-- Diagonal / Single button toggle -->
      <div style="margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--line);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:13px; font-weight:600;">Playlists / Albums button</div>
            <div style="font-size:11px; color:var(--ink-dim); margin-top:2px;">Diagonal split or single toggle button</div>
          </div>
          <button id="diagonalSplitToggle" style="padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Loading\u2026</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0 4px;">
          <div>
            <div style="font-size:13px; font-weight:600;">Auto-scroll to song</div>
            <div style="font-size:11px; color:var(--ink-dim); margin-top:2px;">Jump to the playing song when switching tabs</div>
          </div>
          <button id="autoScrollToggle" style="padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Off</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0 4px;">
          <div>
            <div style="font-size:13px; font-weight:600;">Keep the playing album open</div>
            <div style="font-size:11px; color:var(--ink-dim); margin-top:2px;">Leaving Albums closes every album except the one the playing song is in</div>
          </div>
          <button id="albumFocusPlayingToggle" style="padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Off</button>
        </div>
      </div>"""

SW = "padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap; flex:0 0 auto;"

LAYOUT_NEW = """      <!-- 80.3.5 - three switches in one box are three rows now. Each carries its
           own switch on the row (what the setting IS) and its explanation in the
           drop-down (what it does), like every other setting in this tab. -->
      <div class="sc-set-card">
        <div class="sc-set-head" id="collapsibleSplit" role="button" tabindex="0" aria-expanded="false">
          <span class="sc-set-title">Playlists / Albums button</span>
          <button id="diagonalSplitToggle" style="__SW__">Loading\u2026</button>
          <span id="collapseSplitIcon" class="sc-set-chev">\u25be</span>
        </div>
        <div class="sc-set-body" id="collapsibleSplitContent" style="display:none;">
          <div style="font-size:11.5px; color:var(--ink-dim); line-height:1.6;">Two libraries, one button: the Playlists and Albums tabs split it on a diagonal so both are one tap away, or it becomes a single button you tap to switch between them. The switch on this row is the one in the library header.</div>
        </div>
      </div>

      <div class="sc-set-card">
        <div class="sc-set-head" id="collapsibleAutoScroll" role="button" tabindex="0" aria-expanded="false">
          <span class="sc-set-title">Auto-scroll to song</span>
          <button id="autoScrollToggle" style="__SW__">Off</button>
          <span id="collapseAutoScrollIcon" class="sc-set-chev">\u25be</span>
        </div>
        <div class="sc-set-body" id="collapsibleAutoScrollContent" style="display:none;">
          <div style="font-size:11.5px; color:var(--ink-dim); line-height:1.6;">Jump to the playing song when switching tabs: the list glides down to it and highlights the row, so a long library does not have to be scrolled by hand. Off leaves every list where it was.</div>
        </div>
      </div>

      <div class="sc-set-card">
        <div class="sc-set-head" id="collapsibleAlbumFocus" role="button" tabindex="0" aria-expanded="false">
          <span class="sc-set-title">Keep the playing album open</span>
          <button id="albumFocusPlayingToggle" style="__SW__">Off</button>
          <span id="collapseAlbumFocusIcon" class="sc-set-chev">\u25be</span>
        </div>
        <div class="sc-set-body" id="collapsibleAlbumFocusContent" style="display:none;">
          <div style="font-size:11.5px; color:var(--ink-dim); line-height:1.6;">Leaving Albums closes every album except the one the playing song is in. Off closes them all, so the albums list is a list of covers again.</div>
        </div>
      </div>""".replace('__SW__', SW)

TUTSUM_OLD = """      <div style="border:1px solid var(--line); border-radius:8px; margin-bottom:16px; overflow:hidden;">
        <button class="sc-set-head" id="collapsibleTutorialSummary\""""

TUTSUM_NEW = """      <div class="sc-set-card">
        <button class="sc-set-head" id="collapsibleTutorialSummary\""""

SEIZURE_OLD = """      <div style="border:1px solid var(--line); border-radius:8px; margin-bottom:16px; overflow:hidden;">
        <button class="sc-set-head" id="collapsibleSeizureWarn\""""

SEIZURE_NEW = """      <div class="sc-set-card">
        <button class="sc-set-head" id="collapsibleSeizureWarn\""""

ARTIST_OLD = """      <div style="margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:13px; color:var(--ink-dim);">Ask artist when importing songs</span>
          <button class="tab" id="artistAskToggle" style="padding:5px 12px; font-size:12px;">On</button>
        </div>
        <div style="font-size:11px; color:var(--ink-dim); line-height:1.5;">When you add files, SideCut asks who the artist is \u2014 once for the whole batch \u2014 so covers and lyrics fetch for the right artist. You can always skip the question.</div>
      </div>"""

ARTIST_NEW = """      <div class="sc-set-card">
        <div class="sc-set-head" id="collapsibleArtistAsk" role="button" tabindex="0" aria-expanded="false">
          <span class="sc-set-title">Ask artist when importing songs</span>
          <button class="tab" id="artistAskToggle" style="padding:5px 12px; font-size:12px; flex:0 0 auto;">On</button>
          <span id="collapseArtistAskIcon" class="sc-set-chev">\u25be</span>
        </div>
        <div class="sc-set-body" id="collapsibleArtistAskContent" style="display:none;">
          <div style="font-size:11.5px; color:var(--ink-dim); line-height:1.6;">When you add files, SideCut asks who the artist is \u2014 once for the whole batch \u2014 so covers and lyrics fetch for the right artist. You can always skip the question.</div>
        </div>
      </div>"""

ABOUT_OLD = """      <div class="sc-set-card">
        <div class="sc-set-body" style="border-top:none !important; padding-top:13px !important;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
            <span style="font-size:12px; color:var(--ink-dim);">Version</span>
            <span id="currentVersionLabel" style="font-family:'JetBrains Mono',monospace; font-size:11.5px; color:var(--coral);">SideCut</span>
          </div>
          <button class="playlist-pick-btn" id="viewUpdateLogBtn" style="text-align:center; width:100%;">Update log</button>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="playlist-pick-btn" id="viewListeningStreakBtn" style="flex:1; text-align:center;">Listening streak</button>
            <button class="playlist-pick-btn" id="viewVersionChartBtn" style="flex:1; text-align:center;">Version guide</button>
          </div>
        </div>
      </div>"""

# The version moves ONTO the row (the id stays where every reader already reads
# it) and the three buttons go under it, in the drop-down.
ABOUT_NEW = """      <div class="sc-set-card">
        <div class="sc-set-head" id="collapsibleAbout" role="button" tabindex="0" aria-expanded="false">
          <span class="sc-set-title">About &amp; updates</span>
          <span id="currentVersionLabel" style="font-family:'JetBrains Mono',monospace; font-size:11.5px; color:var(--coral); flex:0 0 auto;">SideCut</span>
          <span id="collapseAboutIcon" class="sc-set-chev">\u25be</span>
        </div>
        <div class="sc-set-body" id="collapsibleAboutContent" style="display:none;">
          <button class="playlist-pick-btn" id="viewUpdateLogBtn" style="text-align:center; width:100%;">Update log</button>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="playlist-pick-btn" id="viewListeningStreakBtn" style="flex:1; text-align:center;">Listening streak</button>
            <button class="playlist-pick-btn" id="viewVersionChartBtn" style="flex:1; text-align:center;">Version guide</button>
          </div>
        </div>
      </div>"""

# ---------------------------------------------------------------------------
# The merge: one row, "Playback & sound", over both of the old groups.
# ---------------------------------------------------------------------------
# WHERE THE REGION STARTS, AND WHY IT IS EXACTLY HERE. It is tempting to begin on
# the `</div>` above the Sound label, but that close belongs to the LAST CARD of the
# section above it (the seizure warning) - the box that wraps the top of the pane is
# a different one, and it closes at the far end of this region, after the merged
# block used to be. Taking that close with the region leaves the seizure card open
# and swallows everything from here down into it, which is precisely what the first
# cut of this patch did and what the jsdom probe caught. The region therefore starts
# on the label and ends on the next label; the box's open tag is removed at the top
# of the pane and its close goes with this region, so the two cancel out.
SOUND_START = """      <div class="sc-mgroup">Sound</div>"""
LIBRARY_LABEL = """      <div class="sc-mgroup">Library</div>"""

PANE_OPEN = {
    'playback': '<div id="settingsPanePlayback"',
    'eq': '<div id="settingsPaneEQ"',
    'refresh': '<div id="settingsPaneRefresh"',
}

MERGED_HEAD = """      <div class="sc-mgroup">Playback &amp; sound</div>
      <!-- 80.3.5 - ONE ROW OVER WHAT USED TO BE TWO GROUPS. "Sound" and "Playback"
           were the same subject split in half: the first was a bare header with the
           refresh-rate pane, the playback pane and the EQ inside it, the second a
           card with the sleep timer, gapless, the next-album roll and the
           per-playlist sort. This is one card, and the four labels inside it are
           the parts a person would name out loud. The three panes below are moved
           VERBATIM: no control inside them was edited, only re-housed. -->
      <div class="sc-set-card">
        <div class="sc-set-head" id="collapsiblePlaybackSound" role="button" tabindex="0" aria-expanded="false">
          <span class="sc-set-title">Playback &amp; sound</span>
          <span class="sc-set-val" data-sc-val="boostDbValue" data-sc-prefix="Boost "></span>
          <span id="collapsePlaybackSoundIcon" class="sc-set-chev">\u25be</span>
        </div>
        <div class="sc-set-body" id="collapsiblePlaybackSoundContent" style="display:none;">
          <div class="sc-sub">Playback</div>
"""

MERGED_NEXT = """          <div class="sc-sub">Sleep &amp; queue</div>
"""

MERGED_SOUND = """          <div class="sc-sub">Sound</div>
"""

MERGED_DISPLAY = """          <div class="sc-sub">Display</div>
"""

MERGED_TAIL = """        </div>
      </div>

"""


def _one(src, marker, what):
    if src.count(marker) != 1:
        raise SystemExit('patch-8035: %s appears %d times, expected 1 (marker: %s)'
                         % (what, src.count(marker), marker[:70].replace('\n', '\\n')))
    return src.index(marker)


def _slice_pane(region, key):
    """One pane, whole and unedited. This is what the harness diffs against
    origin/main to prove the controls MOVED and did not change: the slice starts at
    the pane's own opening tag and ends at the first four-space `</div>`, which is
    where each of the three panes closes in the page this release replaces."""
    i = _one(region, PANE_OPEN[key], 'the %s pane' % key)
    j = region.index('\n    </div>', i)
    if j < 0:
        raise SystemExit('patch-8035: the %s pane does not close where it used to' % key)
    return region[i:j + len('\n    </div>')]


def rebuild_more_pane(page):
    """The whole Settings -> More rebuild, as one function over the page."""
    start = _one(page, '<div id="settingsPaneMore"', 'the More pane')
    end = page.index('<div id="settingsPaneSandbox"')
    pane = page[start:end]

    # --- the Sound + Playback merge (the one structural part) -----------------
    mstart = _one(pane, SOUND_START, 'the Sound group')
    mend = _one(pane, LIBRARY_LABEL, 'the Library label')
    region = pane[mstart:mend]
    panes = {k: _slice_pane(region, k) for k in PANE_OPEN}

    body_old = '<div class="sc-set-body" id="collapsiblePlaybackContent"'
    bi = _one(region, body_old, "the Playback card's body")
    bi = region.index('>', bi) + 1
    bj = region.index('\n        </div>\n      </div>', bi)  # body close, then the card's
    if bj < 0:
        raise SystemExit('patch-8035: the Playback card does not close where it used to')
    playback_inner = region[bi:bj].strip('\n')
    for needle, why in (('id="sleepTimerReadout"', 'the sleep timer readout'),
                        ('id="gaplessToggle"', 'the gapless switch'),
                        ('id="autoNextAlbumToggle"', 'the next-album switch'),
                        ('id="perPlaylistSortToggle"', 'the per-playlist sort switch')):
        if needle not in playback_inner:
            raise SystemExit('patch-8035: the Playback card lost %s' % why)

    merged = (MERGED_HEAD + panes['playback'] + '\n' + MERGED_NEXT + playback_inner + '\n'
              + MERGED_SOUND + panes['eq'] + '\n' + MERGED_DISPLAY + panes['refresh'] + '\n'
              + MERGED_TAIL)
    pane = pane[:mstart] + merged + pane[mend:]

    # --- the pieces that were bare -------------------------------------------
    for old, new, what in (
        (WRAP_OPEN_OLD, WRAP_OPEN_NEW, 'the box that wrapped the top of the pane'),
        (OTA_OLD, OTA_NEW, 'the Check-for-updates card'),
        (MEDIA_OLD, MEDIA_NEW, 'the notification-player card'),
        (TUT_ROW_OLD, TUT_ROW_NEW, 'the bare tutorial button'),
        (LAYOUT_OLD, LAYOUT_NEW, 'the three layout switches in one box'),
        (TUTSUM_OLD, TUTSUM_NEW, 'the tutorial-summary card'),
        (SEIZURE_OLD, SEIZURE_NEW, 'the seizure-warning card'),
        (ARTIST_OLD, ARTIST_NEW, 'the bare ask-artist card'),
        (ABOUT_OLD, ABOUT_NEW, 'the About card with no head'),
    ):
        pane = pane.replace(old, new, 1) if pane.count(old) == 1 else _fail(old, what)

    # NO EXTRA CLEANUP HERE, AND THAT IS THE POINT. The box that wrapped the top of
    # the pane opened at WRAP_OPEN_OLD and closed on the `/div` that SOUND_START
    # begins with, so removing the open tag above and the close inside the merge
    # keeps the pane's divs balanced - there is nothing left to take out. (The
    # harness asserts exactly that: every direct child of the pane is a section
    # label or a card, and no div is left unclosed.)
    return page[:start] + pane + page[end:]


def _fail(old, what):
    raise SystemExit('patch-8035: %s is not the shape this release expects (marker: %s)'
                     % (what, old[:70].replace('\n', '\\n')))


def apply(page, swap):
    page = swap(page, MORE_CSS_ANCHOR, MORE_CSS + MORE_CSS_ANCHOR, 'the settings stylesheet')
    page = swap(page, OLD_DIRECT_RULES, '', 'the two obsolete direct-child rules')
    return rebuild_more_pane(page)
