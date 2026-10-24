#!/usr/bin/env python3
"""80.2.2 - put this release's section into dev/staircase-check.cjs, and check it landed.

dev/staircase-check.cjs is the gate for the cloud layout, the flight and the bar.
This release folds the now bar's own 3-dot menu into the song sheet, so that gate
gets one more section answering for the fold, the save row and the selection bar's
save button.

Idempotent: the marker is the section's own heading.

    python3 dev/patch-gate-8022.py
    python3 dev/patch-gate-8022.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = "console.log('[8] 80.2.2: one menu behind both sets of dots"

ANCHOR = "console.log('');\nconsole.log(pass + ' passed, ' + fail + ' failed');"

SECTION = """console.log('[8] 80.2.2: one menu behind both sets of dots, one song or a selection saved');
{
  // THE FOLD. The now bar's own menu is gone: its modal, its list and its close
  // button, and showNpMenu hands the playing song to the one sheet a row opens.
  ok(src.indexOf('id=\"npMenuBackdrop\"') === -1 && src.indexOf('id=\"npMenuList\"') === -1,
    'the now bar has no menu of its own');
  const np = src.slice(src.indexOf('function showNpMenu()'));
  ok(np.slice(0, np.indexOf('\\n  }')).indexOf('openSongActions(id);') !== -1,
    'its 3-dot opens the song sheet');
  ok(src.indexOf("$('npMenuClose')") === -1, 'and the old menu close button is gone');
  // ONE SONG. The sheet's save row, handed exactly the song it was opened for.
  ok(src.indexOf("dlSongBtn.id = 'songActionsDownload'") > 0, 'the song sheet has a save row');
  ok(src.indexOf("downloadTracksToDevice([id], 'Downloading this song');") > 0,
    'and it saves the one song it was opened for');
  // A SELECTION. The selection bar's button, handed the ticked ids.
  ok(src.indexOf('id=\"selectDownloadBtn\"') > 0, 'the selection bar has a save button');
  ok(src.indexOf("downloadTracksToDevice(ids, ids.length === 1 ? 'Downloading this song' : 'Downloading ' + ids.length + ' songs');") > 0,
    'and it saves the rows that are ticked');
  // ONE WRITER, and the switches the slim bar hides live in the same sheet.
  ok(src.indexOf('async function downloadTracksToDevice(ids, label)') > 0 &&
     src.indexOf('function downloadPlaylistToDevice') === -1,
    'one writer serves the row, the playlist and the selection');
  ok(src.indexOf('function appendPlaybackGroup(host)') > 0 &&
     src.indexOf('try{ appendPlaybackGroup(list); }catch(_ePlayback){}') > 0,
    'the Playback group is appended after the grouping');
  ok(src.indexOf('const barBtn = $(r.btn);') > 0 && src.indexOf('if(barBtn) barBtn.click();') > 0,
    'and its rows click the bar own switches');
  ok(src.indexOf('has no audio file to download.') > 0,
    'a song with no stored audio says so instead of failing a progress bar');
}

"""

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[8] 80.2.2: one menu behind both sets of dots", 'the gate names 80.2.2'),
    ('the now bar has no menu of its own', 'the folded menu is pinned'),
    ('its 3-dot opens the song sheet', 'the delegation is pinned'),
    ("dlSongBtn.id = 'songActionsDownload'", 'the save row is pinned'),
    ('id=\"selectDownloadBtn\"', 'the selection save button is pinned'),
    ('async function downloadTracksToDevice(ids, label)', 'the one writer is pinned'),
    ('try{ appendPlaybackGroup(list); }catch(_ePlayback){}', 'the Playback group is pinned'),
    ("const APP_VERSION = '80.2.2';", 'the gate pins 80.2.2'),
    ('sidecut-shell-v80.2.2', 'the gate pins the 80.2.2 shell cache'),
    ("version: '80.2.2'", 'the gate pins the 80.2.2 changelog head'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8022: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: section [8] is already in the gate')
    else:
        if CHECK:
            print('patch-gate-8022 --check: section [8] is not in the gate yet')
            return 1
        if src.count(ANCHOR) != 1:
            sys.exit('patch-gate-8022: the gate is not the shape this release expects')
        src = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        open(GATE, 'w', encoding='utf-8').write(src)
        print('  applied: section [8]')
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8022: the gate is not the 80.2.2 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2.2: the fold, the save row, the selection (%d claims)' % len(CLAIMS))
    print('patch-gate-8022%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
