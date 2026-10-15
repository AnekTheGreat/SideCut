# The page text dev/patch-7416.py writes, part two: THE RELEASE ITSELF - the
# version, the service worker's cache name (the OTA suite requires the two to
# match) and the changelog entry the update sheet reads its notes from.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7416.py's globals.

VERSION = '74.1.6'

VERSION_OLD = "const APP_VERSION = '74.1.5';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION

SW_OLD = "const CACHE_NAME = 'sidecut-shell-v74.1.5';"
SW_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"
# The head entry is what the update sheet and the store listing read, so the gates
# require at least six notes in it (test-619 and eight others) and forbid a
# downloader term, the other build's name and the [FULL] marker. Two of them also
# require the LAST note to name the widget, the player, the letter-by-letter lyrics
# and the albums - which is why it reads the way it does.
CHANGELOG_ENTRY = """  { version: '74.1.6', date: '%s', title: 'A song in the storage cleaner opens its own bubble with the whole artist name and the exact size in MB', items: [
    'A row in Studio storage cleaner is a door now: tap the song - the cover, the name, or the line under it - and a bubble opens beneath the row with everything the row had to cut off.',
    'The bubble writes the whole song name and every artist on it in full, where the row stops after a few characters with an ellipsis.',
    'It says the exact size on this phone in MB, the length of the song, the album it came from when it has one, and how many kbps the file reads at.',
    'It also answers what the button beside the row would win: a re-encode at the bitrate chosen above, in MB, or plain nothing to win when the file is already at or under that rate.',
    'Tap the same row again and the bubble closes, and tapping another row moves it there - one bubble at a time, never a list of them.',
    'The Re-encode button is where it was and still does its own job; the tap that opens the bubble never swallows it.',
    'Nothing else moved: the player, the albums, the home widget, the letter-by-letter lyrics and every saved song and setting are where the last release left them.',
  ]},
"""
