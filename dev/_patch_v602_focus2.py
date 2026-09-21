#!/usr/bin/env python3
"""The main list row builder (the one renderList uses) is where a re-render of the
Playlists half builds its rows — it has to apply the focus class too, or the
highlight is lost the moment the list redraws."""
import io, sys

p = 'index.html'
src = io.open(p, encoding='utf-8').read()
old = "      row.className = 'track' + (selectMode && selectedIds.has(id) ? ' selected' : '') + (reorderMode ? ' reordering' : '');"
new = "      row.className = 'track' + (selectMode && selectedIds.has(id) ? ' selected' : '') + (reorderMode ? ' reordering' : '') + scFocusClassFor(id);"
n = src.count(old)
if n != 1:
    sys.exit('ANCHOR FAIL: found %d' % n)
io.open(p, 'w', encoding='utf-8').write(src.replace(old, new, 1))
print('ok  the main list rows carry the focus')
