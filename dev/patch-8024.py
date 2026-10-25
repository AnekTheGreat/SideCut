#!/usr/bin/env python3
"""80.2.4 - an album card gets its own three dots, and an album can be sorted
into the order it really plays.

The owner:

  "add a way in albums and 3 dots to sort an album by if it's an actual album
   then in that actual order get this from album history"

An album's songs are in the order they were imported, which is almost never the
order the record plays in. Album History already knows that order. This release:

  1. THE CARD. Every album card in Albums gets the same three dots a song row
     carries. It opens an album menu: "Sort into the album's real order" and
     "Reorder songs by hand" (the sheet the long press already opened).
  2. THE SONG. The same sort sits in the song's three-dot sheet, whenever the
     song belongs to an album and in every view - not only in Albums.
  3. THE READ. The album is read the way Album History reads it: iTunes album
     search, the collection lookup by id in the storefronts the app walks, then
     Deezer's album search and track endpoint. A collection counts only when its
     name agrees, so a similar record is never filed in.
  4. THE FILE. The album's own trackIds are rewritten in that order - the one
     store the cards, the playback and the queue all read - with every song the
     album does not name kept at the END, in the order it had. Undo on the toast
     puts the old order back.
  5. THE CACHE. The list is kept per album (artist included) in
     sidecut_albumRealOrder, forty albums deep, so the second sort is instant and
     works with no connection.

Idempotent: the marker is the sort itself.

    python3 dev/patch-8024.py
    python3 dev/patch-8024.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.4'
MARKER = 'function scRealSortAlbum(name){'
TEXT = os.path.join(ROOT, 'dev', 'patch-8024-text.py')

# What this release has to have left in the page, once the edit has landed.
CLAIMS = [
    ("const APP_VERSION = '80.2.4';", 'the page runs 80.2.4'),
    (MARKER, 'the album sort is in the page'),
    ('var SCREAL_LS = \'sidecut_albumRealOrder\';', 'the read list has one stored key'),
    ('function scRealFetch(name, artist){', 'the album is read the way Album History reads it'),
    ("'https://itunes.apple.com/search?term='", 'from the iTunes album search'),
    ("'https://api.deezer.com/album/'", 'and from Deezer'),
    ('function scRealApplyOrder(name, titles){', 'the filing is one function'),
    ('songs.forEach(function(s, i){ if(!taken[i]) ordered.push(s.id); });',
     'a song the album does not name is kept at the end'),
    ('function scRealAlbumMenu(name){', 'the card has an album menu'),
    ("row('real', '", 'whose first row is the sort'),
    ("row('hand', '", 'and whose second is the hand reorder'),
    ('data-album-kebab="', 'the album card carries the three dots'),
    ('scRealAlbumMenu(aName);', 'and they open the album menu'),
    ("albRealBtn.id = 'songActionsAlbumReal';", 'the song sheet carries the same sort'),
    ('toastWithUndo(msg, function(){', 'every sort carries undo'),
    ('is not an album Album History knows', 'an album nothing matches says so and moves nothing'),
    ('window.__scSortAlbumRealOrder = function(name){ return scRealSortAlbum(name); };',
     'the sort is published for a gate'),
    ("{ version: '80.2.4', date:", 'the changelog records the release'),
]


def load_text():
    # The new text lives in its own small module, loaded by path: the page is one
    # 3.5 MB file and a payload travels through an API call, so the copy travels
    # as constants and this script does the cutting.
    spec = importlib.util.spec_from_file_location('sc_patch_8024_text', TEXT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8024: %s appears %d times, expected once' % (what, src.count(old)))
    return src.replace(old, new, 1)


def apply_all(src):
    t = load_text()
    # 1. THE CARD'S THREE DOTS, after the track count on the header line.
    count_span = ("          + '<span style=\"font-size:11px;color:var(--ink-dim);flex-shrink:0;\">' + alb.tracks.length + ' track'"
                  " + (alb.tracks.length !== 1 ? 's' : '') + '</span>'\n")
    src = swap(src, count_span, count_span + t.CARD_KEBAB, 'the album card header')
    # 2. AND WHAT THEY OPEN, right after the header is added to the card.
    body_start = '        card.appendChild(hdr);\n        var body = document.createElement(\'div\');\n'
    src = swap(src, body_start,
               '        card.appendChild(hdr);\n' + t.CARD_WIRE + '        var body = document.createElement(\'div\');\n',
               'the album card wiring')
    # 3. THE MODULE, above openSongActions, where everything it reads is in scope.
    src = swap(src, '  function openSongActions(id, _saAlbumCtx){\n',
               t.MODULE + '  function openSongActions(id, _saAlbumCtx){\n', 'the sort module')
    # 4. THE SAME DOOR ON A SONG, after the album-reorder row the sheet has.
    reorder_tail = '        list.appendChild(albReorderBtn);\n      }\n    }\n'
    src = swap(src, reorder_tail, reorder_tail + t.SHEET_ROW, 'the song sheet row')
    # 5. THE DOORS A GATE KNOCKS ON.
    picker_export = '  window.__scOpenAlbumReorderPicker = openAlbumPickerForReorder;\n'
    src = swap(src, picker_export, picker_export + t.EXPORTS, 'the album hooks')
    # 6. THE RELEASE ITSELF.
    src = swap(src, "  { version: '80.2.3', date:", t.CHANGELOG_HEAD + "  { version: '80.2.3', date:",
               'the changelog head')
    src = swap(src, "  const APP_VERSION = '80.2.3';", "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the album sort and the page runs as ' + VERSION)
        print('patch-8024%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8024 --check: the release is pending, 6 steps to apply')
        return 1
    if 'function openSongActions(id, _saAlbumCtx){' not in page or 'albReorderBtn' not in page:
        sys.exit('patch-8024: the page is not the shape this release expects (no album card or song sheet to grow)')
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8024: the page did not end up 80.2.4 (%s)' % ', '.join(missing))
    open(page_path, 'w', encoding='utf-8').write(page)
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v80.2.3'" not in sw:
        sys.exit('patch-8024: the shell cache is not the 80.2.3 one')
    open(sw_path, 'w', encoding='utf-8').write(sw.replace("'sidecut-shell-v80.2.3'", "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the card three dots, the album menu, the song row, the read, the file and the notes')
    print('patch-8024: 6 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
