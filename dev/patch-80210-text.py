# -*- coding: utf-8 -*-
"""The 80.2.10 changelog entry, kept beside the patch that puts it in the page."""

# The previous release's opening line: the new entry goes directly above it, so the
# array stays `const CHANGELOG = [ <newest>, <next>, ... ]`.
CHANGELOG_ANCHOR = "  { version: '80.2.8', date:"

CHANGELOG_DATE = 'October 25, 2026 ' + chr(0x00B7) + ' 5:40 PM EDT'

CHANGELOG_HEAD = r"""  { version: '80.2.10', date: '%(date)s', title: 'A new release announces itself once instead of every day, and the count is the list you can see', items: [
    'A drop from a pinned artist says itself once. It was saying so again on every check - every open of the app and every return to it - because a one-track release is stored under the song name while the catalog keeps offering it as "Song - Single", so the app kept reading its own stored row as a brand-new find.',
    'The alert counts the same list the New releases panel shows: one row per drop, a month back. An artist with one release now says one release, instead of "+4 more".',
    'A drop already in the list is never stored a second time, whichever of the two names it arrives under, so the list stops growing a copy of the same single on every check.',
    'Nothing announced is announced again, and nothing older than that month or still dated to drop is announced at all: it is in the list, it is not news.',
    'An artist stored twice under two spellings, or a single stored under both of its names, collapses to the one row it is - and a copy you already read makes the drop read, so it cannot come back wearing a NEW badge.',
    'The bell counts the same month-long list, so a drop the panel does not show cannot keep the bell lit for ever.',
    'The player, the albums, the widget and the lyrics are untouched by this release.',
  ],
    details: [
      'The catalog pass in fetchArtistReleases keyed a one-track release on the collection name the catalog reports ("Song - Single"), but stored it under the song name ("Song") - so the key it had just written never matched on the next run. Every check therefore found the same single "fresh", appended another copy of it to pinnedReleases, and said so out loud: this is the once-a-day announcement, and it is also where the copies came from.',
      'Both spellings are keys now, for the stored row and for the row in the run, so a release an older build stored under either name is recognised as the drop it already is. Measured in the session that wrote this: a first pass stores one row, a second pass over the same catalog stores nothing and returns no finds.',
      'The announcement no longer reads the raw finds of one run. scReleaseAnnouncements takes the same de-duplicated, month-bounded list every New releases surface paints (window.__scReleaseList(31)), drops what has been read, what has already been announced and what is still on the way, and scReleaseAlert marks what it announces as alerted and saves - so the same drop cannot announce itself twice, on this boot or the next one.',
      'The count in the alert is the length of that list, so "+N more" now means N other drops from pinned artists that the panel also shows, never the copies of one release that a catalog named twice.',
      'scCollapseReleaseDuplicates runs on load, beside the junk-release prune: same normalised title and same day is one drop, a read or announced copy makes the survivor read or announced, and the artwork, link, preview and kind a later copy brought are kept. The stored list stops carrying a duplicate per check from earlier builds.',
      'hasLandedUnseenReleases - what lights the bell - reads that same list instead of scanning every stored row at any age, so a drop older than the month the panel shows can no longer keep the badge up.',
    ],
  },
""" % {'date': CHANGELOG_DATE}
