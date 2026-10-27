"""80.3.4, section 5 - the copy that has to change with the behaviour.

Two sentences on the page promised the wrong thing (or too little) once the run
started writing itself down and the tabs started remembering where they were.

Imported by dev/patch-8034.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 5. The copy
# ---------------------------------------------------------------------------
COPY_SWAPS = [
    # The batch card told the owner the run carries on when the window closes. It now
    # also survives the page going away, which is the half that used to lose an album.
    ("Converting in the background \u2014 close this window if you like, the run carries on and the progress stays on screen.",
     "Converting in the background \u2014 close this window if you like, the run carries on and the progress stays on screen, and the link is kept: if the app is reloaded while it runs, the downloader picks it up where it stopped.",
     'the batch card'),
]
