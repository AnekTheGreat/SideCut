#!/usr/bin/env python3
"""80.2.5 - albums only come from you, and an album can be deleted from its dots.

The owner:

  "sometimes they're making random albums with singles and stuff idk why it
   shouldn't be doing that and in the album 3 dots it should have an option to
   delete the album with confirmation"

Two automatic creators and one missing row. This release:

  1. THE LAUNCH. The boot recovery pass used to make an album out of any album tag
     on the files that no entry held and that at least two songs carried (and, for
     a name in the archive, even a one-song tag). That is the whole of the "random
     albums with singles" report: the tags on a phone are what the files arrived
     with. It now restores only what the app itself took - the names in
     sidecut_albumsArchive - with the song list each had at the moment it went.
  2. THE RECORD TAP. Tapping the mini turntable made an album out of the playing
     song's tag on the spot. It now opens the album only when you have one, and
     falls through to the song jump when you do not.
  3. THE DELETE. The album card's three dots grows a third row, "Delete album", in
     the danger colour, which asks first - the album named, the songs accounted
     for, Keep it / Delete album - and then deletes with an Undo.
  4. THE TOMBSTONE. A deleted album stays deleted: its name is written down at the
     moment of the delete, so neither that pass nor a restore can bring it back.
     Undo takes the tombstone off as it puts the album back.

Idempotent: the marker is the delete confirmation function itself.

    python3 dev/patch-8025.py
    python3 dev/patch-8025.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.5'
MARKER = 'function scAlbumDeleteConfirm(name){'
TEXT = os.path.join(ROOT, 'dev', 'patch-8025-text.py')
GATES = os.path.join(ROOT, 'dev', 'patch-8025-gates.py')

# What this release has to have left in the page, once the edit has landed.
CLAIMS = [
    ("const APP_VERSION = '80.2.5';", 'the page runs 80.2.5'),
    (MARKER, 'the delete confirmation is in the page'),
    ('function deleteUserAlbum(name, opts){', 'the delete takes the silent path'),
    ('toastWithUndo(\'Deleted "\'', 'and carries Undo'),
    ("delete _rm[_goneKey];", 'Undo takes the tombstone back off'),
    ('if(_tEl && _tEl.textContent === \'Manage albums\') refreshManageAlbums(true);',
     'only the panel on screen is rebuilt'),
    (r"row('delete', ", 'the album menu has a delete row'),
    ('scAlbumDeleteConfirm(key); return;', 'and the row opens the confirmation'),
    ('id="scAlbDelGo"', 'the confirmation has a delete button'),
    ('id="scAlbDelCancel"', 'and a way to keep it'),
    ('// (3) 80.2.5 - NOTHING IS INVENTED FROM A TAG ANY MORE.', 'the boot invents no album'),
    ("localStorage.getItem(SC_ALBUMS_ARCHIVE_KEY); _arc =", 'it restores only the archive'),
    ('if(tag && userAlbums[tag]){', 'the record tap opens an album only when there is one'),
    ('is not an album Album History knows', 'the 80.2.4 sort is untouched'),
    ('window.__scAlbumDeletePrompt = function(name){ return scAlbumDeleteConfirm(name); };',
     'the confirmation is published for a gate'),
    ("{ version: '80.2.5', date:", 'the changelog records the release'),
]

# The pieces the release must NOT leave behind.
GONE = [
    ("} else if(typeof ensureAlbumSaved === 'function' && ensureAlbumSaved(tag) && typeof markAlbumManual === 'function'){",
     'the record tap still makes an album'),
    ('if(tagIds.length < 2 && !archived) return;', 'the boot still invents albums from tags'),
]


def load_text():
    spec = importlib.util.spec_from_file_location('sc_patch_8025_text', TEXT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8025: %s appears %d times, expected once' % (what, src.count(old)))
    return src.replace(old, new, 1)


def cut(src, start, end, new, what):
    """Replace everything from `start` up to (not including) `end` with `new`."""
    if src.count(start) != 1:
        raise SystemExit('patch-8025: the start of %s appears %d times' % (what, src.count(start)))
    i = src.index(start)
    j = src.find(end, i)
    if j == -1:
        raise SystemExit('patch-8025: the end of %s was not found after its start' % what)
    return src[:i] + new + src[j:]


def load_gates():
    # The gate files this release has to change travel as small exact edits (see the
    # header of dev/patch-8025-gates.py), the way the page's text does.
    spec = importlib.util.spec_from_file_location('sc_patch_8025_gates', GATES)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def apply_gates():
    g = load_gates()
    for path, old, new, what in g.EDITS:
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            raise SystemExit('patch-8025: %s is missing' % path)
        src = open(full, encoding='utf-8').read()
        if new in src:
            continue
        if src.count(old) != 1:
            raise SystemExit('patch-8025: %s no longer reads the way this release expects (%s)' % (path, what))
        open(full, 'w', encoding='utf-8').write(src.replace(old, new, 1))
        print('  applied: %s - %s' % (path, what))


def apply_all(src):
    t = load_text()
    # 1. THE RECORD TAP, both its promise and its body.
    src = swap(src,
               "  // Tap the mini turntable in the now bar \u2192 open the album the playing song is\n"
               "  // in, scrolled to the song and highlighted. If the song isn't in one of your\n"
               "  // albums yet, its file tag is used to make that album yours (you tapped the\n"
               "  // record asking for it), so this can never dead-end in an empty Albums tab.\n",
               t.TURNTABLE_DOC, 'the record tap comment')
    src = cut(src, '    // 2. otherwise the album tag on the file\n',
              '    if(!albumName){\n      // No album for this song anywhere:',
              t.TURNTABLE, 'the record tap body')
    # 2. THE LAUNCH, from the step-3 comment to the save at the end of the pass.
    src = cut(src, '      // (3) Albums that no entry holds at all',
              '      if(healed || restored || removed){\n',
              t.RECOVERY, 'the boot recovery pass')
    # 3. DELETE AN ALBUM, and the panel-only rebuild that keeps the card menu clean.
    src = cut(src, '  function deleteUserAlbum(name){\n', '\n  function openManageAlbums(){',
              t.DELETE_ALBUM, 'deleteUserAlbum')
    # 4. THE MENU: the row helper's danger variant...
    src = swap(src,
               "    function row(action, icon, label, sub){\n"
               "      return '<button class=\"sc-alm-row\" data-alm=\"' + action + '\" style=\"display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,0.04);color:var(--ink);font-size:13.5px;cursor:pointer;\">'\n"
               "        + '<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" style=\"width:18px;height:18px;flex-shrink:0;color:var(--coral);\">' + icon + '</svg>'\n"
               "        + '<span style=\"flex:1;min-width:0;\"><span style=\"display:block;font-weight:600;\">' + escapeHtml(label) + '</span>'\n"
               "        + (sub ? '<span style=\"display:block;font-size:11px;color:var(--ink-dim);margin-top:2px;\">' + escapeHtml(sub) + '</span>' : '')\n"
               "        + '</span></button>';\n"
               "    }\n",
               t.MENU_ROW, 'the menu row helper')
    # ...the delete row under the two that are there...
    src = swap(src,
               "      + '</div>'\n"
               "      + '<div style=\"padding:0 16px 14px;font-size:11px;color:var(--ink-dim);line-height:1.5;\">Songs the album does not list stay at the end, and every sort carries Undo.</div>';\n",
               t.MENU_ROW_HTML, 'the menu rows')
    # ...and what it does when tapped.
    src = swap(src,
               "        if(what === 'hand'){\n"
               "          if(typeof window.showAlbumReorderPopup === 'function') window.showAlbumReorderPopup(key);\n"
               "          else toast('Reorder sheet unavailable.', 2600);\n"
               "        }\n",
               t.MENU_HANDLER, 'the menu handler')
    # 5. THE CONFIRMATION, above the menu that calls it.
    src = swap(src,
               "  // THE ALBUM'S OWN MENU - what the three dots on a card opens. Two rows: the\n"
               "  // sort, and the hand reorder the long press already offered, so the card is\n"
               "  // not a one-button menu.\n",
               t.CONFIRM +
               "  // THE ALBUM'S OWN MENU - what the three dots on a card opens. Three rows now:\n"
               "  // the sort, the hand reorder the long press already offered, and the delete\n"
               "  // that asks first, so the card is not a one-button menu.\n",
               'the album menu comment')
    # 6. THE DOORS A GATE KNOCKS ON.
    src = swap(src, '  window.__scAlbumRealCache = function(){ return scRealCacheAll(); };\n',
               '  window.__scAlbumRealCache = function(){ return scRealCacheAll(); };\n' + t.EXPORTS,
               'the album hooks')
    # 7. THE RELEASE ITSELF.
    src = swap(src, "  { version: '80.2.4', date:", t.CHANGELOG_HEAD + "  { version: '80.2.4', date:",
               'the changelog head')
    src = swap(src, "  const APP_VERSION = '80.2.4';", "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the confirmed delete and the page runs as ' + VERSION)
        print('patch-8025%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8025 --check: the release is pending, 7 steps to apply')
        return 1
    if "const APP_VERSION = '80.2.4';" not in page:
        sys.exit('patch-8025: the page is not 80.2.4, so it is not the shape this release expects')
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8025: the page did not end up 80.2.5 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle in page]
    if left:
        sys.exit('patch-8025: the page still carries the old behaviour (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)
    # 6b. THE GATES THAT PROMISED THE OLD RULE, before the repin sweeps them.
    apply_gates()
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v80.2.4'" not in sw:
        sys.exit('patch-8025: the shell cache is not the 80.2.4 one')
    open(sw_path, 'w', encoding='utf-8').write(sw.replace("'sidecut-shell-v80.2.4'", "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the launch, the record tap, the delete row, the confirmation, Undo and the notes')
    print('patch-8025: 7 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
