#!/usr/bin/env python3
"""83.0.1 - SideCut: Other apps under the gear, right before More.

Settings had no way to reach the rest of the family. FamTM and UJournal both carry an Other apps tab;
SideCut, the app a person is most likely to open first, carried none of the names at all.

This adds the tab last before More, in the strip's own shape, and a pane of four cards: FamTM,
UJournal, MeasureT and My Hub, each with the one line that says what it does and the page it installs
from. Nothing else in Settings moves.

index.html is over 4 MB, so the change ships as a patch script. Every replacement asserts it matches
exactly once: if the page has drifted, this fails loudly rather than half-applying. Re-running it is a
no-op, and `--check` reports without writing.

  python3 dev/patch-8301.py           apply
  python3 dev/patch-8301.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
VERSION = '83.0.1'
OLD = '83'
MARK = 'settingsPaneOther'

s = io.open(PAGE, encoding='utf-8').read()
CHECK = '--check' in sys.argv

if MARK in s:
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


# ---- the version ---------------------------------------------------------------------------------
sub("  const APP_VERSION = '83';",
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')


# ---- the tab, last before More -------------------------------------------------------------------
sub('''      <button class="tab" id="settingsTabWidget" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Widget</button>
      <button class="tab" id="settingsTabMore" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">More</button>''',
    '''      <button class="tab" id="settingsTabWidget" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Widget</button>
      <button class="tab" id="settingsTabOther" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">Other apps</button>
      <button class="tab" id="settingsTabMore" style="min-width:100px; padding:12px 18px; text-align:center; white-space:nowrap; font-size:13px;">More</button>''',
    'the Other apps tab, last before More')


# ---- the pane ------------------------------------------------------------------------------------
CARDS = [
    ('FamTM',
     'The family tree in your pocket: everyone, their dates, their photos, and how they are related.',
     'https://play.google.com/store/apps/details?id=com.FamTM.app'),
    ('UJournal',
     'Keeps the days you write down, and the birthdays this family hands over.',
     'https://play.google.com/store/apps/details?id=app.ujournal'),
    ('MeasureT',
     'Elevation, location, a level and a converter.',
     'https://play.google.com/store/apps/details?id=com.CompassEDC.myapp'),
    ('My Hub',
     'One screen that launches this family of apps.',
     'https://github.com/AnekTheGreat/My-Hub'),
]

card_html = []
for name, line, href in CARDS:
    card_html.append(
        '''      <div style="border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:rgba(255,255,255,0.03); margin-bottom:10px;">
        <div style="font-size:14px; font-weight:600;">%s</div>
        <div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">%s</div>
        <a href="%s" target="_blank" rel="noopener" style="display:inline-block; margin-top:8px; font-size:12px; font-weight:600; color:var(--coral); text-decoration:none;">Open its page &rarr;</a>
      </div>''' % (name, line, href))

PANE = ('''    <!-- 83.0.1 - the rest of the family, in the same place the other two apps keep it: one line each
         and the page each one installs from. The links leave for the phone's own browser; nothing is
         installed from here without a tap. -->
    <div id="settingsPaneOther" style="display:none; padding:6px 0;">
      <div style="font-size:15px; font-weight:600; margin-bottom:6px;">Other apps</div>
      <div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-bottom:12px;">Four more, made the same way and free the same way.</div>
''' + '\n'.join(card_html) + '''
      <div style="font-size:11px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">A link opens in the phone's own browser. If an app is not installed yet, its page opens where it can be installed.</div>
    </div>

''')

sub('''    <div id="settingsPanesWrap" class="settings-scroll">
''',
    '''    <div id="settingsPanesWrap" class="settings-scroll">
''' + PANE,
    'the pane of four cards')


# ---- the tab shows its pane, and wears its own state ---------------------------------------------
sub("    $('settingsPaneSandbox').style.display = tab === 'sandbox' ? '' : 'none';",
    "    $('settingsPaneSandbox').style.display = tab === 'sandbox' ? '' : 'none';\n"
    "    $('settingsPaneOther').style.display = tab === 'other' ? '' : 'none';",
    'the pane is shown for its own tab')

sub("    $('settingsTabSandbox').classList.toggle('active', tab === 'sandbox');",
    "    $('settingsTabSandbox').classList.toggle('active', tab === 'sandbox');\n"
    "    $('settingsTabOther').classList.toggle('active', tab === 'other');",
    'the tab shows itself as the open one')

sub("$('settingsTabMore').addEventListener('click', () => showSettingsTab('more'));",
    "$('settingsTabMore').addEventListener('click', () => showSettingsTab('more'));\n"
    "$('settingsTabOther').addEventListener('click', () => showSettingsTab('other'));",
    'the tab answers a tap')


# ---- the changelog -------------------------------------------------------------------------------
ENTRY = '''  { version: '%s', date: 'November 6, 2026 · 10:20 PM EST', title: 'Other apps under the gear, the whole family in one place', items: [
    'Settings has an Other apps tab now, last before More: FamTM, UJournal, MeasureT and My Hub, each with the one line that says what it does and the link to the page it is installed from.',
    'It is the same list the other two apps carry, in the same place, so whichever of them you have open the family is one tap from the gear instead of something to remember.',
    'A link opens in the phone’s own browser and nothing is installed from here without a tap.',
    'This one is in the page: it arrives the next time the app opens, with nothing to install.'
  ]},
''' % VERSION

sub('''  { version: '83', date: 'November 6, 2026 · 9:40 PM EST', title: 'The speed sits in the song\\'s settings, and the mixes keep it', items: [''',
    ENTRY + '''  { version: '83', date: 'November 6, 2026 · 9:40 PM EST', title: 'The speed sits in the song\\'s settings, and the mixes keep it', items: [''',
    'the changelog entry')


# PATCH_NOTES.md is deliberately not written here: it is outside the paths a release commits
# (release.yml fails on a stray path), and the page's own CHANGELOG is the source of truth for it.
io.open(PAGE, 'w', encoding='utf-8').write(s)
print('wrote %s: %d bytes (%d changes)' % (PAGE, len(s), len(changes)))
