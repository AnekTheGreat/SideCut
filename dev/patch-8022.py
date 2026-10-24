#!/usr/bin/env python3
"""80.2.2 - one song or a whole selection to the phone, and one menu behind both
sets of dots.

The owner:

  "add a feature where I can download a single song with its 3 dots menu or if I
   select multiple songs I can download those specific songs make this nice the 3
   dots menu in the now bar and in the actual 3 dots menu for the song should be
   the same"

Three things, one page:

  1. THE SONG MENU SAVES ONE SONG. openSongActions gains a Download this song row
     bound to the writer the playlist sheet already used, handed one id: the audio
     blob that song plays from, written to Documents under its own name.
  2. THE SELECTION BAR SAVES A SELECTION. A save icon beside the zip export hands
     the same writer the ticked ids, so a long press plus one tap writes each
     selected song as its own file, and the selection stays up.
  3. THERE IS ONE 3-DOT MENU. The now bar had a second, shorter menu of its own.
     showNpMenu now opens openSongActions for the playing song, that menu's modal
     is gone, and the three switches the slim bar hides - Shuffle, Repeat, DJ Mode
     - are a Playback group inside the sheet, clicking the very buttons on the bar.

The new text lives in dev/patch-8022-text.py, loaded by path (the way
dev/release-record.py loads dev/agents-shipping-note.py): the page is one 3.5 MB
file and this payload has to travel, so the copy travels as small constants and
this script does the cutting, with a check on every anchor before it cuts.

Idempotent: the marker is the save row in the song sheet.

    python3 dev/patch-8022.py
    python3 dev/patch-8022.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.2'
MARKER = "dlSongBtn.id = 'songActionsDownload'"
TEXT = os.path.join(ROOT, 'dev', 'patch-8022-text.py')
TEXT_C = os.path.join(ROOT, 'dev', 'patch-8022-text-c.py')

# What this release has to have left in the page, once the edit has landed.
CLAIMS = [
    ("const APP_VERSION = '80.2.2';", 'the page runs 80.2.2'),
    (MARKER, 'the song sheet has its own save row'),
    ("downloadTracksToDevice([id], 'Downloading this song');", 'and it saves the one song it was opened for'),
    ('id="selectDownloadBtn"', 'the selection bar has a save button'),
    ('async function downloadTracksToDevice(ids, label)', 'one writer for one song and for a selection'),
    ('function appendPlaybackGroup(host)', 'the Playback group is in the sheet'),
    ('openSongActions(id);', 'the now bar 3-dot opens the song sheet'),
    ("const PREV = '80.2.2'", 'never true - the version is the only pin here'),
]


def load_text():
    # Two small modules, one namespace: the new text a release carries is split so
    # each part travels in its own API call.
    ns = {'__name__': 'sc_patch_8022_text'}
    for path in (TEXT, TEXT_C):
        spec = importlib.util.spec_from_file_location('sc_patch_8022_text_part', path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        ns.update({k: v for k, v in vars(mod).items() if not k.startswith('__')})
    return type('Sc8022Text', (), ns)


def cut(src, start, end, replacement, what):
    i = src.find(start)
    if i < 0:
        raise SystemExit('patch-8022: %s is not in the page (start anchor)' % what)
    j = src.find(end, i)
    if j < 0:
        raise SystemExit('patch-8022: %s is not in the page (end anchor)' % what)
    return src[:i] + replacement + src[j + len(end):]


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8022: %s appears %d times, expected once' % (what, src.count(old)))
    return src.replace(old, new, 1)


def apply_all(src):
    t = load_text()
    # 1. THE MENU MODAL COMES OUT OF THE PAGE.
    src = cut(src, '<!-- Now Playing Menu (3-dot) -->', '<!-- Lyrics Modal -->',
              t.MENU_COMMENT + '<!-- Lyrics Modal -->', 'the now bar menu modal')
    # 2. AND SHOW-NP-MENU BECOMES A HAND-OFF TO THE SONG SHEET.
    src = cut(src, '  // ---------------- Now Playing Menu (3-dot) ----------------',
              "  $('npMenuBackdrop').addEventListener('click', e => { if(e.target === $('npMenuBackdrop')) $('npMenuBackdrop').style.display = 'none'; });\n",
              t.NP_NEW, 'the showNpMenu block')
    # 3. THE SONG SHEET'S OWN SAVE ROW.
    anchor = '    list.appendChild(abBtn);\n'
    src = swap(src, anchor, anchor + t.SONG_DOWNLOAD, 'the Add to albums anchor')
    # 4. THE PLAYBACK GROUP, AFTER THE GROUPING.
    src = swap(src, t.SHEET_TAIL_OLD, t.SHEET_TAIL_NEW, 'the end of the song sheet')
    # 5. ONE WRITER: the rename, the empty-audio guard, the label and the tail.
    src = swap(src, t.WRITER_DOC_OLD, t.WRITER_DOC_NEW, 'the writer doc comment')
    src = swap(src, '  async function downloadPlaylistToDevice(ids, isAllSongs){',
               '  async function downloadTracksToDevice(ids, label){', 'the writer signature')
    empty = "    if(!tracks.length){ toast('Nothing to download yet.'); return; }\n"
    src = swap(src, empty, empty + t.WRITER_GUARD, 'the empty-list return')
    src = swap(src, "    const chip = scDlChip('Downloading songs');",
               "    const chip = scDlChip(label || (tracks.length === 1 ? 'Downloading song' : 'Downloading songs'));",
               'the progress chip')
    src = swap(src, t.WRITER_TAIL_OLD, t.WRITER_TAIL_NEW, 'the end-of-run messages')
    src = swap(src, 'downloadPlaylistToDevice(ids, isAllSongs);', 'downloadTracksToDevice(ids);', 'the playlist sheet caller')
    # 6. THE SELECTION BAR'S SAVE BUTTON.
    exportBtn = '          <button class="icon-btn" id="selectExportBtn" title="Export selected to .zip">'
    src = swap(src, exportBtn, t.SELECT_BUTTON + exportBtn, 'the selection export button')
    src = swap(src, "      $('selectExportBtn').addEventListener('click', exportSelected);\n",
               t.SELECT_WIRING, 'the selection export wiring')
    # 7. THE PROBE THE GATE READS.
    safeName = '    scExportSafeName: (name) => scExportSafeName(name),\n'
    src = swap(src, safeName, safeName + t.PROBE, 'the export probe')
    # 8. THE RELEASE ITSELF.
    src = swap(src, "  { version: '80.2.1', date:", t.CHANGELOG_HEAD + "  { version: '80.2.1', date:", 'the changelog head')
    src = swap(src, "  const APP_VERSION = '80.2.1';", "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src, t


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the save row and the page runs as ' + VERSION)
        print('patch-8022%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8022 --check: the release is pending, 8 steps to apply')
        return 1
    if 'id="npMenuBackdrop"' not in page:
        sys.exit('patch-8022: the page is not the shape this release expects (no npMenu to fold in)')
    page, _t = apply_all(page)
    missing = [why for needle, why in CLAIMS[:-1] if needle not in page]
    if missing:
        sys.exit('patch-8022: the page did not end up 80.2.2 (%s)' % ', '.join(missing))
    open(page_path, 'w', encoding='utf-8').write(page)
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v80.2.1'" not in sw:
        sys.exit('patch-8022: the shell cache is not the 80.2.1 one')
    open(sw_path, 'w', encoding='utf-8').write(sw.replace("'sidecut-shell-v80.2.1'", "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the folded menu, the save row, the selection button, the writer, the notes and the cache')
    print('patch-8022: 8 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
