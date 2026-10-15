# The page text dev/patch-7418.py writes, part two: THE RELEASE ITSELF - the
# version, the service worker's cache name (the OTA suite requires the two to
# match) and the changelog entry the update sheet reads its notes from.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7418.py's globals.

VERSION = '74.1.8'

VERSION_OLD = "const APP_VERSION = '74.1.7';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION

SW_OLD = "const CACHE_NAME = 'sidecut-shell-v74.1.7';"
SW_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"
# The head entry is what the update sheet and the store listing read, so the gates
# require at least six notes in it and forbid a downloader term, the other build's
# name and the [FULL] marker. Two of them also require the LAST note to name the
# widget, the player, the letter-by-letter lyrics and the albums - which is why it
# reads the way it does. Every note is ASCII, like the entries before it: the store
# listing carries them to a channel this repository cannot see.
CHANGELOG_ENTRY = """  { version: '74.1.8', date: '%s', title: 'Re-encode works again: the slice helper the encoders call lives with them now', items: [
    'The Re-encode button failed the moment a rate was tapped - "Re-encode failed: scBackSliceMul is not defined" - on every song and every rate. That was a regression this app shipped in the last release, and this release is the repair.',
    'The helper that decides how much audio one slice of a compress covers was written into the Studio script while the encoders live in the main app script, and one script cannot call into another. It lives with the encoders now.',
    'Nothing was lost while it was broken. The encode failed before it produced a single byte, so the stored file was never touched and no song was left half-written or quietly smaller than it should be.',
    'Re-encode is one tap again: 96, 128, 160, 192, 256 and 320 kbps, each saying what it would do to that song in MB, and a finished run replaces the stored file and can still be undone.',
    'The background compress works too - the job holds a Web Lock and takes bigger slices while you are away, the cleaner names the song, the rate and the percentage while it runs, and a run the phone killed outright is reported rather than hidden.',
    'The gates drive the real encoder now instead of a stand-in, which is how the last release shipped green: with the encoder stubbed, the failing line never ran. A stub can no longer hide a broken encoder.',
    'A new gate reads the whole page as scripts: no block may call a helper that only another block defines. On the last release it named this one, in the exact block that failed - and on this one it finds nothing.',
    'Nothing else moved: the player, the albums, the home widget, the letter-by-letter lyrics and every saved song and setting are where the last release left them.',
  ]},
"""
