"""84.1.1 - hold-to-reorder opens the sheet again.

The sheet threw "scAlbumRowArt is not defined". The page is two top-level <script>
blocks: the first (an IIFE) owns scAlbumRowArt, the second draws the reorder sheet and
only sees what the first publishes on window. The art lookup was never published.

Idempotent: this payload already ran to put 84.1.1 on main, so on a clean tree it finds
the fixes present, the version correct, and writes nothing. --check exits 0 when the
page already says what this release says.
"""

import io
import json
import sys

PAGE = 'index.html'
SW = 'sw.js'
UPD = 'updates.json'
VERSION = '84.1.1'
BRIDGE = "  window.__scAlbumRowArt = function(t){ try{ return scAlbumRowArt(t); }catch(e){ return ''; } };\n"
LOCAL = ("function scAlbumRowArt(t){\n"
         "  try{ if(typeof window.__scAlbumRowArt === 'function') return window.__scAlbumRowArt(t); }catch(e){}\n"
         "  return '';\n"
         "}\n")
A1 = "  window.__scGetAllTracks = function(){ return allTracks; };\n"
A2 = "document.addEventListener('lostpointercapture',()=>{},true);\n"
NOTES = ("Holding a song inside an album opens the reorder sheet again instead of failing "
         "with \"scAlbumRowArt is not defined\". The sheet is drawn in a later script than the "
         "one that finds a song's cover art, and that lookup was never handed over; it is now, "
         "and a row that cannot find its cover just draws without one.")


def main(argv):
    check = '--check' in argv
    src = io.open(PAGE, encoding='utf-8').read()
    sw = io.open(SW, encoding='utf-8').read()
    upd = json.load(io.open(UPD, encoding='utf-8'))

    done = (BRIDGE in src and LOCAL in src and ("const APP_VERSION = '%s';" % VERSION) in src
            and ('sidecut-shell-v%s' % VERSION) in sw and upd.get('version') == VERSION)
    if done:
        print('84.1.1 is already on the page - nothing to write')
        return 0
    if check:
        sys.exit('patch-8411: the page is not on %s yet' % VERSION)

    if BRIDGE not in src:
        if src.count(A1) != 1:
            sys.exit('patch-8411: the album bridge anchor is not in the page once')
        src = src.replace(A1, A1 + BRIDGE, 1)
    if LOCAL not in src:
        if src.count(A2) != 1:
            sys.exit('patch-8411: the second block anchor is not in the page once')
        src = src.replace(A2, A2 + LOCAL, 1)

    ver = "const APP_VERSION = '84.1.0';"
    if ver in src:
        src = src.replace(ver, "const APP_VERSION = '%s';" % VERSION, 1)
    io.open(PAGE, 'w', encoding='utf-8').write(src)

    sw = sw.replace('sidecut-shell-v84.1.0', 'sidecut-shell-v%s' % VERSION)
    io.open(SW, 'w', encoding='utf-8').write(sw)

    upd['version'] = VERSION
    upd['date'] = 'November 13, 2026'
    upd['notes'] = [NOTES]
    io.open(UPD, 'w', encoding='utf-8').write(json.dumps(upd, ensure_ascii=False) + '\n')
    print('patch-8411: the reorder sheet can reach the row art, page is %s' % VERSION)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
