"""80.3.3, section 10 - the copy that is no longer true.

Sequential conversion is quoted in two places on the page; both say "several at a time"
now.

Imported by dev/patch-8033.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 10. The copy that is no longer true
# ---------------------------------------------------------------------------
COPY_SWAPS = [
    ("an album or a playlist link runs through every track, in order.",
     "an album or a playlist link runs through every track, several at a time.",
     'the conversion-tools step (Discover)'),
    ("A song gives you one tagged file; an album or playlist converts and auto-downloads every song one by one, in order, with title/artist/album/track-number and cover art embedded in each file.",
     "A song gives you one tagged file; an album or playlist converts and saves every song, several at a time, with title/artist/album/track-number and cover art embedded in each file.",
     'the converter FAQ'),
]
