#!/usr/bin/env python3
"""
74.1.9 - the album follows the song, the views arrive smoothly, and the tabs can be
one sliding pill dock.

The owner, in one message:

    "In albums, when you skip a song to the next album if it starts a new album, the
     old one should automatically close and the new one should automatically show
     un-collapsed. Also make the apps and transitions in the apps very smooth and add
     a feature in the bottom where the tabs are to set them to a pill like shape all
     together kind of like iOS where you can hold and hover over what you want to
     click or like slide it nicely, that would be a cool feature."

THREE CHANGES, AND WHY EACH ONE IS WHERE IT IS.

1. THE ALBUM FOLLOWS THE SONG. highlightPlaying() is the single place every track
   change in this app passes through: Next, Previous, a song ending, a row tap, a
   track picked in DJ Mode. Its Albums-tab half already opened the card that holds
   the playing song, and it never closed the card it opened for the song before -
   so skipping into another record left two albums open and the row that was playing
   somewhere inside them. The cards THIS rule opened are now tracked and closed
   again on the next track change; only those, so an album the owner opened by hand
   is never shut by the app, and a card that still holds the playing song (a saved
   album and a tag-only card can both hold it) stays open.

2. THE VIEWS COME IN. The four views toggle between display:flex and display:none,
   which is a hard cut. The view that just arrived now fades and settles in about a
   fifth of a second, on the compositor, and nothing at all happens when reduced
   motion has been asked for (the Sandbox switch) or when the device asks for less.

3. THE PILL DOCK, a setting under Studio -> Gestures. The tabs join into one rounded
   capsule with a highlight that slides to the tab being pressed, hovered or slid
   over. Its two drawn pieces are built by the code rather than written into the
   markup, so the dock that ships still holds the four pills and nothing else until
   the setting asks for more. A plain tap is untouched - the pill still gets its own
   pointerdown and its own click - and only a SLIDE is answered here: the highlight
   follows the finger, the tab it finishes on is activated, and the click the
   browser fires at the press's common ancestor is swallowed once, so a press that
   began on Home and ended on Studio cannot open both.

THE SAME OWNER MESSAGE ALSO CARRIED TWO REPAIRS, and they are in this release too
(dev/patch-7419-page.py section 4):

4. THE CONVERTER'S IDENTITY. "the Spotify to mp3 converter will frequently confuse
   songs by the same artist while downloading a song and often duplicate the same
   song in different metadata, this often happens when downloading albums... it
   should download the correct audio". An album is one artist's whole run, so the
   artist check cannot tell its tracks apart and the TITLE check is the only thing
   between them - and both title checks were SUBSTRING tests: "Yaar" is contained in
   "Yaarian", "Pind" in "Pind Waliyan". A track could therefore take its neighbour's
   upload, and the neighbour was then refused its own source as already claimed by
   the run - one audio file filed twice under two sets of tags. Both checks now match
   a RUN OF WHOLE WORDS.

5. THE SLICE THE UI GETS BACK. "frequent lag spikes inside the app while doing
   multiple things simultaneously". The cooperative encoders hold the main thread for
   SC_ENCODE_SLICE_MS at a time, and 90ms is about five dropped frames, so the app
   stutters for as long as a conversion runs. While the page is VISIBLE the budget is
   one frame now; while it is HIDDEN it is exactly what it was, because a hidden page
   has no frames to drop and the long slice is what finishes background work soonest.
   The wake-up between slices is a MessageChannel macrotask rather than a clamped
   timer, since a smaller slice pays that cost more often.

This is the same kind of release tool as dev/patch-7418.py: the page is ONE 3.2 MB
index.html and the machine that prepares a release cannot push a file that size, so a
page change ships by being EDITED inside the repository - by this script, which the
release workflow runs on the checked-out tree.

THE TEXT IT WRITES IS NOT IN THIS FILE. dev/patch-7419-page.py holds the three
changes, dev/patch-7419-notes.py holds the version bump and the changelog entry. Both
are exec'd into this module's globals below, for the same reason: every byte travels
by hand, one API call per file, and a call big enough to be cut off is a release that
does not ship.

It is idempotent. Every edit checks for its own output first and skips when the page
already carries it, so re-running it changes nothing.

  python3 dev/patch-7419.py            # apply (or report it is already applied)
  python3 dev/patch-7419.py --check    # report only, exit 1 if the page is behind
"""
import datetime
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
CHECK = '--check' in sys.argv

# The page text, into this module's globals: the three changes, and VERSION, the
# changelog anchor and entry.
for _text in ('patch-7419-page.py', 'patch-7419-notes.py'):
    with open(os.path.join(HERE, _text), encoding='utf-8') as _fh:
        exec(_fh.read(), globals())

changes = []
problems = []


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as fh:
        fh.write(text)


def edit(rel, old, new, label):
    """Replace one exact block, once. Already-applied counts as done, not an error."""
    src = read(rel)
    if new in src:
        print('  = %s (already applied)' % label)
        return
    n = src.count(old)
    if n != 1:
        problems.append('%s: anchor found %d times in %s' % (label, n, rel))
        print('  ! %s: anchor found %d times in %s' % (label, n, rel))
        return
    write(rel, src.replace(old, new, 1))
    changes.append(label)
    print('  + %s' % label)


def eastern_stamp():
    """Eastern time of this run as 'Month D, YYYY \u00b7 H:MM PM EDT'.

    The build sandbox runs on UTC with no tzdata, so Eastern is computed as UTC minus
    four hours (EDT) rather than asked for - the same arithmetic every release before
    this one used, so the entries in the changelog are comparable.
    """
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    hour = now.hour % 12 or 12
    ampm = 'AM' if now.hour < 12 else 'PM'
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, hour, now.minute, ampm)


# Every inline <script> in the page, parsed. 74.1.8's failure was a scope mistake that
# only showed at runtime, and this release adds a whole block to the app's own script,
# so the cheapest true answer to "did I break the page" is asked on every --check run:
# node parses each block the way the browser will.
PARSE_JS = """
const fs = require('fs');
const src = fs.readFileSync(process.argv[1], 'utf8');
const re = /<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/g;
let m, blocks = 0, bad = 0;
while ((m = re.exec(src))) {
  if (/\\bsrc=/.test(m[1])) continue;
  blocks++;
  try { new Function(m[2]); } catch (e) { bad++; console.log('  ! block ' + blocks + ' does not parse: ' + e.message); }
}
console.log('  ' + (bad ? '!' : '\u2713') + ' all ' + blocks + ' inline script blocks parse' + (bad ? ' (' + bad + ' bad)' : ''));
process.exit(bad ? 1 : 0);
"""


def parse_check():
    try:
        r = subprocess.run(['node', '-e', PARSE_JS, os.path.join(ROOT, 'index.html')],
                           capture_output=True, text=True)
    except FileNotFoundError:
        print('  = node is not available here, so the script blocks were not parsed')
        return True
    out = (r.stdout or '').strip()
    if out:
        print(out)
    if r.returncode != 0:
        problems.append('an inline script block does not parse')
        return False
    return True


print('74.1.9 patch - %s' % ROOT)
if CHECK:
    for rel, needle, label in (
        ('index.html', VERSION_NEW, 'APP_VERSION is %s' % VERSION),
        ('sw.js', SW_NEW, 'sw cache is v%s' % VERSION),
        ('index.html', "version: '%s'" % VERSION, 'changelog entry'),
        ('index.html', 'function scAlbumCollapseCard(card){', 'the album card can be closed'),
        ('index.html', 'scAlbPlayingCards = _scOpenNow.map(', 'and the cards the track change opened are remembered'),
        ('index.html', 'function scViewIn(el){', 'a view can come in'),
        ('index.html', '.sc-view-in{ animation: scViewIn', 'and the animation is in the stylesheet'),
        ('index.html', 'function scDockPillApply(on){', 'the dock can be joined'),
        ('index.html', 'window.__scSetDockPill = function(on){', 'and the setting is published for the Studio'),
        ('index.html', '#scDockPillTrack, #scDockPillThumb{', 'the capsule and the highlight are styled'),
        ('index.html', 'data-act="dockpill"', 'the Studio carries the switch'),
        ('index.html', 'function dockPillOn(){', 'and a way to ask the app what it is set to'),
        ('index.html', 'function hasRun(blob, phrase){', 'a title is matched as whole words'),
        ('index.html', 'var SC_ENCODE_FRAME_MS = 12;', 'a visible page gets a frame-sized slice'),
        ('index.html', 'document.hidden ? SC_ENCODE_SLICE_MS * scBackSliceMul() : SC_ENCODE_FRAME_MS',
         'both encoders read it, and the hidden lane is untouched'),
        ('index.html', '_scYieldCh.port2.postMessage(0)', 'and the wake-up is a macrotask, not a timer'),
        ('index.html', 'function scLyricsSheetOffset(rows, env, hopSec, duration){',
         'a stamped lyric sheet can be measured against the recording'),
        ('index.html', 'function scAutoAlignLyricsToAudio(){', 'and lined up from that measurement'),
        ('index.html', 'var SC_LYRICS_OFF_MAX = 120;', 'the sync nudge can reach the error it is shown'),
        ('index.html', 'try{ scAutoAlignLyricsToAudio(); }catch(_eAlignCall){}',
         'and the measurement runs where a sheet is put on screen'),
        ("index.html", "if(t) t.textContent = _opened ? 'Open library' : (text || 'Conversions finished');",
         'the finished pill says what it does: Open library'),
        ("index.html", r"!/could not|nothing was added|(\D|^)0 songs/i.test(_dtxt)",
         'and a run that saved nothing keeps its own text, by name or by count'),
    ):
        if needle not in read(rel):
            problems.append('%s: %s missing' % (label, rel))
            print('  ! %s missing in %s' % (label, rel))
        else:
            print('  \u2713 %s' % label)
    # One implementation of each, so a second copy can never drift away from the
    # first - the lesson 74.1.8 paid for.
    for needle, want, label in (
        ('function scViewIn(', 1, 'one view transition'),
        ('function scDockPillApply(', 1, 'one place that applies the dock setting'),
        ('function scDockPillSync(', 1, 'one place that places the highlight'),
        ('function scAlbumCollapseCard(', 1, 'one place that closes an album card'),
        ('function hasRun(blob, phrase){', 2, 'one word-run test in each title gate'),
        ('function scLyricsSheetOffset(', 1, 'one measurement of a lyric sheet'),
        ('function scAutoAlignLyricsToAudio(', 1, 'one place that lines a sheet up'),
        ('try{ scAutoAlignLyricsToAudio(); }catch(_eAlignCall){}', 1,
         'called from the one place a sheet becomes the sheet on screen'),
        ('document.hidden ? SC_ENCODE_SLICE_MS * scBackSliceMul() : SC_ENCODE_FRAME_MS', 2,
         'and both encoders ask the frame budget the same way'),
    ):
        n = read('index.html').count(needle)
        if n != want:
            problems.append('%s: found %d time(s), expected %d' % (label, n, want))
            print('  ! %s: found %d time(s), expected %d' % (label, n, want))
        else:
            print('  \u2713 %s' % label)
    parse_check()
    print('CHECKS: %s' % ('FAILED' if problems else 'OK'))
    sys.exit(1 if problems else 0)

# 1. the album follows the song
edit('index.html', ALB_STATE_OLD, ALB_STATE_NEW, 'the cards a track change opened are remembered, and one helper closes a card')
edit('index.html', ALB_OPEN_OLD, ALB_OPEN_NEW, 'the Albums half of highlightPlaying tracks what it opens')
edit('index.html', ALB_PUSH_OLD, ALB_PUSH_NEW, 'every card that holds the playing song is noted')
edit('index.html', ALB_CLOSE_OLD, ALB_CLOSE_NEW, 'and the album the song just left is closed as the new one opens')
# 2. + 3. the views, and the pill dock
edit('index.html', NAV_TAIL_OLD, NAV_TAIL_NEW, 'a view that arrives animates in, and the dock highlight is kept in place')
edit('index.html', DOCK_JS_OLD, DOCK_JS_NEW, 'the pill dock and the view transition live in the app script')
edit('index.html', CSS_OLD, CSS_NEW, 'the capsule, the highlight and the entrance are styled')
# the Studio's own switch for it
edit('index.html', GEST_FOLD_OLD, GEST_FOLD_NEW, 'Gestures counts the dock setting too')
edit('index.html', GEST_ROW_OLD, GEST_ROW_NEW, 'Gestures carries the Pill dock switch')
edit('index.html', GEST_HELPER_OLD, GEST_HELPER_NEW, 'and a way to ask the app what it is set to')
edit('index.html', GEST_WIRE_OLD, GEST_WIRE_NEW, 'the switch is wired')
# 4. the converter's identity, and the slice the UI gets back
edit('index.html', IDENT_MATCH_OLD, IDENT_MATCH_NEW, 'a title is matched as whole words, not as a substring (scTitleMatch)')
edit('index.html', IDENT_STRONG_OLD, IDENT_STRONG_NEW, 'and so is the exact-title bar (scTitleStrong)')
edit('index.html', FRAME_DEF_OLD, FRAME_DEF_NEW, 'the slice a VISIBLE page gets is one frame')
edit('index.html', FRAME_MP3_OLD, FRAME_MP3_NEW, 'the mp3 loop yields on that budget while on screen')
edit('index.html', FRAME_WAV_OLD, FRAME_WAV_NEW, 'and so does the wav loop')
edit('index.html', YIELD_OLD, YIELD_NEW, 'the wake-up between slices no longer waits for a clamped timer')
# 6. the words line up with the song
edit('index.html', LYR_OFF_DEF_OLD, LYR_OFF_DEF_NEW, 'the sync nudge can reach the error it is shown (120s, was 15)')
edit('index.html', LYR_NUDGE_OLD, LYR_NUDGE_NEW, 'and the nudge buttons clamp to that')
edit('index.html', LYR_MEASURE_OLD, LYR_MEASURE_NEW, 'the recording measures a stamped sheet and the answer is stored as its nudge')
edit('index.html', LYR_ALIGN_CALL_OLD, LYR_ALIGN_CALL_NEW, 'and a stamped sheet is measured instead of trusted')
# 7. what the finished pill says
edit('index.html', PILL_TITLE_OLD, PILL_TITLE_NEW, 'the finished pill leads with Open library, with what happened under it')
# 6b. the measurement, second cut - the probe refused the first one, and rightly:
# matching each stamp to its nearest onset cannot see a uniform offset at all, because
# a late sheet is late into a different part of the singing where every line still has
# an onset a second away. What a uniform offset moves is the SHAPE of the song.
# 7. the release itself
edit('index.html', VERSION_OLD, VERSION_NEW, 'APP_VERSION -> %s' % VERSION)
edit('sw.js', SW_OLD, SW_NEW, 'sw cache -> v%s' % VERSION)
# The changelog entry carries the RUN'S OWN timestamp, so its exact bytes can never
# match the previous run's. The idempotency check has to be the VERSION, not the text,
# or a second run files the same release twice - which it did, twice, while 74.1.9 was
# being prepared (each re-run inserted another copy of the same entry).
if "version: '%s'" % VERSION in read('index.html'):
    print('  = changelog entry (already applied)')
else:
    edit('index.html', CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + CHANGELOG_ENTRY % eastern_stamp(), 'changelog entry')

if problems:
    print('\nFATAL: %d anchor(s) could not be applied - the page has moved on:' % len(problems))
    for p in problems:
        print('  - %s' % p)
    sys.exit(1)

if not changes:
    print('\nThe page already carries %s - nothing written.' % VERSION)
else:
    print('\nApplied %d edit(s) for %s.' % (len(changes), VERSION))
    print('\nNow: node dev/repin-7419.mjs (the gates pin the version), then the probe.')
