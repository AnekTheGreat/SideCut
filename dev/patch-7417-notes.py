# The page text dev/patch-7417.py writes, part two: THE RELEASE ITSELF - the
# version, the service worker's cache name (the OTA suite requires the two to
# match) and the changelog entry the update sheet reads its notes from.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7417.py's globals.

VERSION = '74.1.7'

VERSION_OLD = "const APP_VERSION = '74.1.6';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION

SW_OLD = "const CACHE_NAME = 'sidecut-shell-v74.1.6';"
SW_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"
# The head entry is what the update sheet and the store listing read, so the gates
# require at least six notes in it and forbid a downloader term, the other build's
# name and the [FULL] marker. Two of them also require the LAST note to name the
# widget, the player, the letter-by-letter lyrics and the albums - which is why it
# reads the way it does.
CHANGELOG_ENTRY = """  { version: '74.1.7', date: '%s', title: 'A compressor that carries on in the background, a Re-encode button that asks the rate, and playlists you can reorder', items: [
    'The storage cleaner no longer lets a song name out of its row: the name and the artist clip inside the row they belong to instead of running across the Re-encode button and off the screen.',
    'The Re-encode button opens the rates now - 96, 128, 160, 192, 256 and 320 kbps - and every one of them says what it would do to that song in MB before anything is encoded.',
    'Higher quality is offered and named for what it is: a rate above what the file already reads cannot put back detail the first encode threw away, so it says it grows the file instead of dressing it up as an upgrade.',
    'A re-encode carries on when you leave the app. The job holds a Web Lock and works in bigger slices while the page is hidden, so a phone put down mid-compress finishes the song instead of stalling there.',
    'The Studio says where a running compress is: a strip in the storage cleaner names the song, the rate and the percentage, and the row reads Encoding... until it is done.',
    'A compress that the phone killed outright is reported as it is - the song is never half-written, because the stored file is only replaced once the encoder has produced its bytes - and it can be started again at the same rate from that note.',
    'Nothing else moved: the player, the albums, the home widget, the letter-by-letter lyrics and every saved song and setting are where the last release left them.',
  ]},
"""
