#!/usr/bin/env python3
"""80.2.5 - put this release's section into dev/staircase-check.cjs, and check it landed.

dev/staircase-check.cjs answers for the album workflow's own claims, so the two
things this release changes belong in it: the paths that used to make an album
without being asked, and the delete that asks first.

Idempotent: the marker is the section's own heading.

    python3 dev/patch-gate-8025.py
    python3 dev/patch-gate-8025.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = "console.log('[11] 80.2.5: no album is invented, and a delete asks first');"

ANCHOR = "console.log('');\nconsole.log(pass + ' passed, ' + fail + ' failed');"

SECTION = r"""console.log('[11] 80.2.5: no album is invented, and a delete asks first');
{
  // THE LAUNCH. It restores what the app archived, and nothing else.
  ok(src.indexOf('// (3) 80.2.5 - NOTHING IS INVENTED FROM A TAG ANY MORE.') > 0,
    'the boot pass states the new rule');
  ok(src.indexOf('if(tagIds.length < 2 && !archived) return;') === -1 &&
     src.indexOf('tagIds.length < 2') === -1,
    'and no longer makes an album out of a tag');
  ok(src.indexOf('localStorage.getItem(SC_ALBUMS_ARCHIVE_KEY)') > 0 &&
     src.indexOf('var e = _arc[name] && _arc[name].entry;') > 0,
    'it puts back what the archive holds, with the list it holds');
  ok(src.indexOf('if(userDeleted[String(name).toLowerCase()]) return;') > 0,
    'and never a name you deleted');
  ok(src.indexOf('back.manual = true;') > 0, 'what it restores is marked as yours');
  // THE RECORD TAP. A jump opens an album; it does not make one.
  ok(src.indexOf('if(tag && userAlbums[tag]){') > 0, 'the record tap opens an album you have');
  var _jump = src.slice(src.indexOf('function openAlbumForCurrentSong(){'));
  _jump = _jump.slice(0, _jump.indexOf('function jumpToPlayingSong'));
  ok(_jump.indexOf('ensureAlbumSaved(') === -1, 'and never makes one out of the tag');
  ok(src.indexOf('if(ensureAlbumSaved(tag)) added++') > 0,
    'while the rebuild you ask for in Manage albums still can');
  // THE MENU'S THREE ROWS.
  ok(src.indexOf("row('delete', ") > 0, 'the album menu carries a delete row');
  ok(src.indexOf("if(what === 'delete'){ scAlbumDeleteConfirm(key); return; }") > 0,
    'which opens the confirmation');
  ok(src.indexOf("'Removes the album. The songs stay in your library.', true)") > 0,
    'the row says what it does, in the danger colour');
  // THE CONFIRMATION.
  ok(src.indexOf('function scAlbumDeleteConfirm(name){') > 0, 'the confirmation is one function');
  ok(src.indexOf("openDiscoverPopup('Delete album', html, key);") > 0, 'it opens as its own sheet');
  ok(src.indexOf('id="scAlbDelCancel"') > 0 && src.indexOf('id="scAlbDelGo"') > 0,
    'with Keep it and Delete album');
  var _conf = src.slice(src.indexOf('function scAlbumDeleteConfirm(name){'));
  _conf = _conf.slice(0, _conf.indexOf('\n  }'));
  ok(_conf.indexOf('window.confirm(') === -1 && _conf.indexOf('confirm (' ) === -1,
    'and never window.confirm, which the WebView can swallow');
  ok(src.indexOf('stay in your library') > 0, 'it says the songs stay in the library');
  // THE DELETE ITSELF.
  ok(src.indexOf('function deleteUserAlbum(name, opts){') > 0, 'the delete takes a silent path');
  ok(src.indexOf('_ud[_goneKey] = Date.now();') > 0, 'the name is tombstoned at the moment of the delete');
  ok(src.indexOf("toastWithUndo('Deleted \"' + name") > 0, 'the delete carries Undo');
  ok(src.indexOf('albumOrder.splice(_backAt, 0, name);') > 0, 'Undo puts the album back in its place');
  ok(src.indexOf('delete _rm[_goneKey];') > 0, 'and takes the tombstone back off');
  ok(src.indexOf("if(_tEl && _tEl.textContent === 'Manage albums') refreshManageAlbums(true);") > 0,
    'only the panel on screen is rebuilt, so a card delete cannot open Manage albums');
  ok(src.indexOf('scAllowRowDrop(\'userAlbums\', name);') > 0, 'the drop is allowed, as every album delete is');
  // THE DOORS A SUITE KNOCKS ON, and the suite itself.
  ok(src.indexOf('window.__scAlbumDeletePrompt = function(name){ return scAlbumDeleteConfirm(name); };') > 0,
    'the confirmation is exported');
  ok(src.indexOf('window.__scDeleteAlbumQuiet = function(name){ return deleteUserAlbum(name, { silent: true }); };') > 0,
    'and so is the quiet delete');
  ok(fs.existsSync(path.join(__dirname, 'album-auto-delete-check.cjs')),
    'the suite that drives all of it travels with the release');
  // THE 80.2.4 SORT IS UNTOUCHED by any of this.
  ok(src.indexOf('function scRealSortAlbum(name){') > 0 && src.indexOf('function scRealAlbumMenu(name){') > 0,
    'the real-order sort is still there');
  ok(src.indexOf("row('real', '") > 0 && src.indexOf("row('hand', '") > 0,
    'with its two rows above the delete');
}

"""

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[11] 80.2.5: no album is invented, and a delete asks first", 'the gate names 80.2.5'),
    ('the boot pass states the new rule', 'the launch rule is pinned'),
    ('and no longer makes an album out of a tag', 'the old tag rebuild is pinned out'),
    ('it puts back what the archive holds, with the list it holds', 'the archive restore is pinned'),
    ('and never a name you deleted', 'the tombstone is pinned'),
    ('the record tap opens an album you have', 'the record tap is pinned'),
    ('and never makes one out of the tag', 'and pinned not to create'),
    ('the album menu carries a delete row', 'the delete row is pinned'),
    ('which opens the confirmation', 'its handler is pinned'),
    ('the confirmation is one function', 'the confirmation is pinned'),
    ('with Keep it and Delete album', 'both buttons are pinned'),
    ('it says the songs stay in the library', 'the promise to the songs is pinned'),
    ('the name is tombstoned at the moment of the delete', 'the tombstone write is pinned'),
    ('the delete carries Undo', 'Undo is pinned'),
    ('Undo puts the album back in its place', 'and its place is pinned'),
    ('and takes the tombstone back off', 'and the tombstone removal is pinned'),
    ('only the panel on screen is rebuilt, so a card delete cannot open Manage albums', 'the panel rule is pinned'),
    ('the suite that drives all of it travels with the release', 'the suite is required to exist'),
    ('the real-order sort is still there', '80.2.4 is pinned untouched'),
    ("const APP_VERSION = '80.2.5';", 'the gate pins 80.2.5'),
    ('sidecut-shell-v80.2.5', 'the gate pins the 80.2.5 shell cache'),
    ("version: '80.2.5'", 'the gate pins the 80.2.5 changelog head'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8025: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: section [11] is already in the gate')
    else:
        if CHECK:
            print('patch-gate-8025 --check: section [11] is not in the gate yet')
            return 1
        if src.count(ANCHOR) != 1:
            sys.exit('patch-gate-8025: the gate is not the shape this release expects')
        src = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        open(GATE, 'w', encoding='utf-8').write(src)
        print('  applied: section [11]')
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8025: the gate is not the 80.2.5 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2.5: the launch, the record tap, the delete, the undo (%d claims)' % len(CLAIMS))
    print('patch-gate-8025%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
