# -*- coding: utf-8 -*-
"""The 80.3 changelog head, kept beside the renumber that puts it in the page.

The 80.2.10 entry is not kept under a number that breaks the page's own rule: it BECOMES
the 80.3 entry, so the list reads 80.3, then 80.2.8 - the same thing 80.1 did to 80.0.10.
"""

MIDDOT = chr(0x00B7)

# The entry as 80.2.10 wrote it.
CHANGELOG_OLD = (
    "  { version: '80.2.10', date: 'October 25, 2026 " + MIDDOT + " 5:40 PM EDT', "
    "title: 'A new release announces itself once instead of every day, and the count is "
    "the list you can see', items: ["
)

# The same notes, under the number the page's own rule allows, stamped with the Eastern
# time of the commit that ships it.
CHANGELOG_NEW = (
    "  { version: '80.3', date: 'October 26, 2026 " + MIDDOT + " 7:20 AM EDT', "
    "title: 'A new release announces itself once instead of every day, and the count is "
    "the list you can see', items: ["
)

# The FIRST bullet of the items list. The note that explains the number goes above it, so
# it is one of the notes the update card carries (the card shows the first six).
FIRST_OLD = "    'A drop from a pinned artist says itself once."

FIRST_NEW = (
    "    'This release is 80.3, not 80.2.10: the third number stops at nine, so 80.2.9 is "
    "followed by 80.3. The page is the same fix either way - the app only moves forward, "
    "so the number is how it reaches you.',\n"
    "    'A drop from a pinned artist says itself once."
)
