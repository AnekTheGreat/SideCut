# The page text dev/patch-7419.py writes, part two: THE RELEASE ITSELF - the
# version, the service worker's cache name (the OTA suite requires the two to
# match) and the changelog entry the update sheet reads its notes from.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7419.py's globals.

VERSION = '74.1.9'

VERSION_OLD = "const APP_VERSION = '74.1.8';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION

SW_OLD = "const CACHE_NAME = 'sidecut-shell-v74.1.8';"
SW_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"
# The head entry is what the update sheet and the store listing read, so the gates
# require at least six notes in it and forbid a downloader term, the other build's
# name and the [FULL] marker. Two of them also require the LAST note to name the
# widget, the player, the letter-by-letter lyrics and the albums - which is why it
# reads the way it does. Every note is ASCII, like the entries before it: the store
# listing carries them to a channel this repository cannot see.
CHANGELOG_ENTRY = """  { version: '74.1.9', date: '%s', title: 'The album follows the song, the views arrive smoothly, the tabs can be one sliding pill dock, and two repairs from the phone: an album stops mixing its own tracks, and the app stops stuttering while it works', items: [
    'Skipping into another album closes the album you were in and opens the new one, so the song that is playing is never the one you cannot see. A card still holding the playing song stays open, and albums you opened by hand are left alone.',
    'The Studio has a new switch under Gestures: Pill dock. It joins the tabs into one rounded capsule with a highlight that slides to the tab you are pressing, hovering or sliding over, the way an iOS segmented control behaves.',
    'With a mouse, moving over the dock says which tab a click would take before you take it. With a thumb, press anywhere on the dock and slide across it: releasing picks the tab the finger finished on, and the tab it started on never fires as well.',
    'The split Library tab is part of it too. Slide from the Library side to the Albums side and the highlight moves with you, so both halves are picked the same way the rest of the dock is.',
    'Every view now comes in instead of cutting in: Home, Discover, Library and Studio fade and settle in about a fifth of a second, and the whole effect is skipped when reduced motion is on - by the Sandbox switch or by the device itself.',
    'Pill dock is off until it is switched on, so the four separate tabs are exactly where they were for anyone who likes them that way.',
    'An album can no longer mismatch its own songs: a track is picked by the whole words of its title, so a similarly named song by the same artist can no longer take the wrong recording. That was a wrongly tagged second copy once an album, and it is gone.',
    'The app stops stuttering while a file is being made: the long job hands the screen back every frame while you are looking at it, so scrolling and tapping stay smooth, and it keeps its long turn when the app is out of sight, which is where it finishes soonest.',
    'The words stay with the song: a lyric sheet whose timestamps belong to a different cut is measured against the recording that is playing and lined back up with it, and the sync nudge now reaches far enough to fix a sheet that is tens of seconds out.',
    'The card that appears when a song has been saved now leads with Open library, so the way into the song you just kept is a button rather than a report - and a run that saved nothing still says so instead of offering a library it did not fill.',
    'Nothing about the music moved: the player, the home widget, the letter-by-letter lyrics and the albums are where the last release left them, and no saved song or setting changed.',
  ]},
"""
