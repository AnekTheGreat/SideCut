"""The Settings -> More groups for 80.3.2: one card style, six groups, one About card.

Part of the 80.3.2 payload; run dev/patch-8032.py, which applies these in order.
"""

import re

MORE_CSS_ANCHOR = "/* \u2500\u2500\u2500 Settings tab strip horizontal scrollbar \u2500\u2500\u2500 */"

MORE_CSS = """/* \u2500\u2500\u2500 80.3.2 - Settings \u2192 More, as named groups of one kind of card \u2500\u2500\u2500 */
#settingsPaneMore .sc-mgroup{
  font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:1.7px;
  text-transform:uppercase; color:var(--ink-dim); opacity:.78;
  margin:20px 2px 7px; line-height:1;
}
#settingsPaneMore > .sc-mgroup:first-child{ margin-top:2px; }
#settingsPaneMore .sc-set-card{
  border:1px solid var(--line); border-radius:12px; margin-bottom:8px;
  overflow:hidden; background:rgba(255,255,255,0.02);
}
#settingsPaneMore .sc-set-head{
  width:100% !important; padding:13px 14px !important;
  background:none !important; border:none !important;
  color:var(--ink) !important; font-size:13px !important; font-weight:600 !important;
  cursor:pointer; display:flex; justify-content:space-between; align-items:center;
  text-align:left; letter-spacing:.1px;
}
#settingsPaneMore .sc-set-body{ padding:14px !important; border-top:1px solid var(--line) !important; }
#settingsPaneMore .sc-set-body > div:last-child{ margin-bottom:0; }
#settingsPaneMore .playlist-pick-btn{ border-radius:10px; }
#settingsPaneMore > #collapsiblePlaybackSound{
  border:1px solid var(--line) !important; border-radius:12px 12px 0 0 !important;
  background:rgba(255,255,255,0.02) !important;
}
#settingsPaneMore > #collapsiblePlaybackSoundContent{
  border:1px solid var(--line) !important; border-top:1px solid var(--line) !important;
  border-radius:0 0 12px 12px !important; margin-top:-1px;
  background:rgba(255,255,255,0.02);
}
""" + MORE_CSS_ANCHOR

CARD_8 = '<div style="border:1px solid var(--line); border-radius:8px; margin-bottom:8px; overflow:hidden;">'
CARD_16 = '<div style="margin-bottom:16px; border:1px solid var(--line); border-radius:8px; overflow:hidden;">'
CARD_TOP = '<div style="border:1px solid var(--line); border-radius:8px; margin-top:12px; overflow:hidden;">'

GROUP_KNOW = """      <div class="sc-mgroup">Good to know</div>
"""
GROUP_KNOW_ANCHOR = """      <!-- 73.4.8 - the descriptive cards read as collapsible menus too, so the
"""
GROUP_SOUND = """      <div class="sc-mgroup">Sound</div>
"""
GROUP_SOUND_ANCHOR = """<button id="collapsiblePlaybackSound" """
GROUP_PLAYBACK = """      <div class="sc-mgroup">Playback</div>
"""
GROUP_PLAYBACK_ANCHOR = """            <!-- Collapsible: Playback -->
"""
GROUP_APP = """      <div class="sc-mgroup">App &amp; data</div>
"""
GROUP_APP_ANCHOR = """      <!-- Collapsible: Storage -->
"""
GROUP_LIBRARY = """      <div class="sc-mgroup">Library</div>
"""
GROUP_LIBRARY_ANCHOR = """      <div style="margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:13px; color:var(--ink-dim);">Ask artist when importing songs</span>
"""

ABOUT_OLD = """      <div style="margin-top:12px;">
        <button class="playlist-pick-btn" id="viewListeningStreakBtn" style="text-align:center; width:100%;">View listening streak</button>
      </div>

      <div style="margin-top:12px;">
        <button class="playlist-pick-btn" id="viewUpdateLogBtn" style="text-align:center; width:100%;">Update log</button>
        <div style="font-size:11px; color:var(--ink-dim); margin-top:6px; text-align:center;" id="currentVersionLabel">SideCut</div>
      </div>

      <div style="margin-top:12px;">
        <button class="playlist-pick-btn" id="viewVersionChartBtn" style="text-align:center;">Version numbering guide</button>
        <div style="font-size:11px; color:var(--ink-dim); margin-top:6px; text-align:center;">Understanding the version numbers</div>
      </div>
"""

ABOUT_NEW = """      <div class="sc-mgroup">About &amp; updates</div>
      <div class="sc-set-card">
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
      </div>
"""


def tidy_more_pane(page):
    start = page.index('<div id="settingsPaneMore"')
    end = page.index('<div id="settingsPaneSandbox"')
    pane = page[start:end]
    before = pane
    pane = pane.replace(GROUP_KNOW_ANCHOR, GROUP_KNOW + GROUP_KNOW_ANCHOR, 1)
    pane = pane.replace(GROUP_SOUND_ANCHOR, GROUP_SOUND + GROUP_SOUND_ANCHOR, 1)
    pane = pane.replace(GROUP_PLAYBACK_ANCHOR, GROUP_PLAYBACK + GROUP_PLAYBACK_ANCHOR, 1)
    if pane.count(GROUP_LIBRARY_ANCHOR) != 1:
        raise SystemExit('patch-8032: the ask-artist card is not where it was')
    pane = pane.replace(GROUP_LIBRARY_ANCHOR, GROUP_LIBRARY + GROUP_LIBRARY_ANCHOR, 1)
    if pane.count(GROUP_APP_ANCHOR) != 1:
        raise SystemExit('patch-8032: the storage card is not where it was')
    pane = pane.replace(GROUP_APP_ANCHOR, GROUP_APP + GROUP_APP_ANCHOR, 1)
    if pane.count(ABOUT_OLD) != 1:
        raise SystemExit('patch-8032: the loose About buttons are not where they were')
    pane = pane.replace(ABOUT_OLD, ABOUT_NEW, 1)
    pane = pane.replace(CARD_8, '<div class="sc-set-card">')
    pane = pane.replace(CARD_16, '<div class="sc-set-card">')
    pane = pane.replace(CARD_TOP, '<div class="sc-set-card">')
    pane = pane.replace('<button id="collapsible', '<button class="sc-set-head" id="collapsible')
    pane, bodies = re.subn(r'<div id="(collapsible\w+Content)"', r'<div class="sc-set-body" id="\1"', pane)
    if bodies < 10:
        raise SystemExit('patch-8032: only %d collapsible bodies were found' % bodies)
    if pane == before:
        raise SystemExit('patch-8032: the More pane did not change')
    return page[:start] + pane + page[end:]


CHANGELOG_ANCHOR = "  { version: '80.3.1', date:"

CHANGELOG_HEAD = """  { version: '80.3.2', date: 'October 27, 2026 \u00b7 9:40 AM EDT', title: 'Lyrics fill in letter by letter, a volume boost sits beside the EQ, Settings is grouped, and a download can go into an album', items: [
    'Letter-by-letter lyrics fill the line now. A word the singer has passed keeps its letters lit, the word being sung sweeps across its own letters, and the words to come stay dark \u2014 the line fills in instead of one word flashing in place.',
    'The sweep no longer skips words. On a line whose window was longer than the singing inside it the highlight used to jump from the first word to the last one, fully lit; every word is visited now, in order.',
    'When the sheet moves on, the line just sung goes back to the trough, so a song cannot turn into a wall of gold by the second verse.',
    'A <b>Volume boost</b> sits right under the equalizer in Settings \u2192 More. Slide it up to +15 dB \u2014 about five and a half times the signal \u2014 for a quiet master or quiet headphones. A soft ceiling catches the peaks it would otherwise clip, so it gets louder instead of crackling, and 0 dB (Off) is exactly how SideCut sounded before.',
    'The boost is one saved number: it comes back on the next launch and applies to whatever is already playing, with no restart and no press of play.',
    'Settings \u2192 More is six named groups now \u2014 Good to know, Sound, Playback, Library, App &amp; data and About &amp; updates \u2014 in one card style, with the version number, the update log, the listening streak and the version guide together in one About card instead of floating between the rollback list and the DJ card.',
    'A downloaded song can be filed the moment it lands. The finished download card carries <b>+ Album</b>: pick an album you have, or name a new one, and the song goes into it \u2014 the same picker the library uses, on the song that was just saved.',
  ]},
"""


def apply(page, swap):
    page = swap(page, MORE_CSS_ANCHOR, MORE_CSS, 'the settings stylesheet')
    page = tidy_more_pane(page)
    return swap(page, CHANGELOG_ANCHOR, CHANGELOG_HEAD + CHANGELOG_ANCHOR, 'the changelog anchor')
