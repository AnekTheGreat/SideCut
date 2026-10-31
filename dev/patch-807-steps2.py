# -- 4. the delete: two seconds, a button, every stored copy -------------------
once('the delete helpers land above the release list',
     "  function renderNewReleases(){\n    const sec = $('newReleasesSection');",
     HELPERS + "  function renderNewReleases(){\n    const sec = $('newReleasesSection');")

# The old hold is cut between two anchors instead of carried as a literal: forty
# lines of page text copied into this file would only be a place to mistype them.
HOLD_START = "    // Hold (~600ms) a release to remove it"
HOLD_END = "        // A tap opens the release page (cover, countdown, tracklist)"
HOLD_NEW = (
    "    // 80.7 - two seconds, then Delete. See scWireReleaseHold: one delegated\n"
    "    // hold for every release surface, and it deletes nothing without a button.\n"
    "    scWireReleaseHold();\n"
)
_hs = SRC.find(HOLD_START)
_he = SRC.find(HOLD_END, _hs) if _hs >= 0 else -1
if _hs >= 0 and _he > _hs:
    SRC = SRC[:_hs] + HOLD_NEW + SRC[_he:]
    applied.append('the six-hundred-millisecond hold is retired')
else:
    failed.append('the six-hundred-millisecond hold is not where it was')

