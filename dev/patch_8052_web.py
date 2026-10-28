"""80.5.2 - nothing in the app names another build.

The owner's ask, verbatim:

    "don't mention the actual full version web or apk in the app or apk or web,
     same thing in patch notes don't mention this"

80.5 and 80.5.1 answered "where did the tools go" by pointing at a second build:
a card in Discover, a row in About & updates, a three-way version label, and
changelog notes naming the full web app and the full APK. All of that is
advertising, and it goes. The BEHAVIOUR stays exactly as 80.5 shipped it - the web
page still has no converters, the installed builds still have them, and /full/
still opens the full web app for anyone who knows the address.

WHAT GOES:

  * the Discover card (`scFullWebNote`, 80.5);
  * the About & updates row (`scFullWebRow`, 80.5.1);
  * the build name on the version line - it reads `SideCut v80.5.2` and stops;
  * the changelog notes that named a build: 80.5.1 asked for a link that no longer
    exists, so its entry goes entirely; 80.5 keeps only the one note that is about
    the page itself; and four older notes that mentioned "the full build", "the
    other build" or "the Play build" lose that clause;
  * the one runtime sentence that named the Play build by name.

WHAT STAYS (and is not a mention): the flags, the class names, the comment
architecture. A maintainer reading `SC_IS_PLAY` learns there are two builds; a
person using the app sees one app.

Imported by dev/patch-8052.py; holds constants only.
"""

# The runtime string a failed licensed-catalog search prints. It names the store
# build by name; the person reading it only needs to know this copy's limits.
RUNTIME_OLD = "no source found \u2014 the Play build only searches openly-licensed catalogs"
RUNTIME_NEW = "no source found \u2014 this copy only searches openly-licensed catalogs"

# Older changelog notes that name another build. Each is one clause inside an item
# that stays; the replacement keeps the item true without naming a build.
ITEMS = [
    # 60.5.4 - "nothing was taken" is about the store build; the clause names the
    # other one to say so.
    ('Nothing was taken from the other build: it keeps the whole tool section, every card and the format explainer exactly as they were.',
     'Everything else is exactly as it was.', 1),
    # 60.5.x - the transport note.
    ('The full build\\u2019s converter transport now gets a second chance',
     'The converter transport now gets a second chance', 1),
    # 56.x - the hand-off sentence.
    (' The full build keeps its hand-off.', '', 2),
    # 60.5.0 - the channel note.
    ("Each build checks its own update channel (ota/ or ota-play/), so one install can never receive the other build\u2019s bundle.",
     'Each install checks its own update channel, so one copy can never receive another channel\u2019s bundle.', 1),
    # 60.5.4 - the verification sentence.
    ('so the full build\\u2019s Spotify and YouTube converters are known working in this build.',
     'so the Spotify and YouTube converters are known working in this copy.', 1),
]

# The 80.5 entry keeps this title and its first note (the one about the page), and
# loses the three that named a build.
ENTRY_805_TITLE = 'The web page is the build for the files you already have'

# This release's own note: about the row, not about any other build.
ENTRY_TITLE = 'The version line is the version, and nothing on the page points elsewhere'

ENTRY_ITEMS = [
    'The version line reads <b>SideCut v80.5.2</b> and nothing else \u2014 the words that sat after it are gone, so the row is one short line again.',
    'Two cards that talked about other copies are gone with it: <b>Discover</b> and <b>About &amp; updates</b> now describe only what this copy does.',
]
