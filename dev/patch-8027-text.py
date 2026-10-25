#!/usr/bin/env python3
"""80.2.7 - the text this release puts into index.html.

Two pieces, kept apart from the edits so the edits read as edits:

  CSS      the stylesheet block for the two new rungs, Roomy (179px) and Grand
           (230px), inserted under the last of the existing size rules.
  CHANGELOG_HEAD   the release's own changelog entry, above the one it replaces.
"""

# THE STYLESHEET BLOCK. Inserted directly under .hb-size-full - the last of the
# existing size rules - so the ladder reads top to bottom in one place.
CSS_ANCHOR = ".home-bubble.hb-size-full{ grid-column:1 / -1; min-height:calc(200px * var(--hb-s, 1)); }\n"

CSS = """/* 80.2.7 - THE SIZES COME IN ORDER, WITH MORE STEPS BETWEEN THEM. The expand
   chip walked mini 60, small 84, medium 146, automatic 118, tall 158, wide 96,
   full 200, XL 260: the card SHRANK twice on the way up (at automatic, then at the
   wide banner), and small to medium (62px) and full to XL (60px) were single taps
   with nothing between them. Two rungs close those jumps - Roomy at 179 between
   tall and full, Grand at 230 between full and XL - so the walk is 60, 84, 96,
   118 automatic, 146, 158, 179, 200, 230, 260 and no step in it is bigger than
   30px. Grand spans the row like full and XL do: a 230px card in half of a phone
   is a column, not a bubble. */
.home-bubble.hb-size-roomy{ min-height:calc(179px * var(--hb-s, 1)); }
.home-bubble.hb-size-grand{ grid-column:1 / -1; min-height:calc(230px * var(--hb-s, 1)); }
"""

# THE RELEASE'S OWN CHANGELOG ENTRY. dev/test-738.mjs reads it: at least seven
# notes, no apostrophe anywhere, no downloader or converter term, every note under
# 260 characters, the stamp ending in EDT, and 80.2.6 still listed next.
CHANGELOG_ANCHOR = "  { version: '80.2.6', date:"

CHANGELOG_HEAD = """  { version: '80.2.7', date: 'October 25, 2026 \\u00b7 1:40 PM EDT', title: 'Every Home bubble size now arrives in order, with more steps between the small ones and the big ones', items: [
    'The size chip on Home now walks one ladder in order: every tap makes the bubble taller than the last, and one tap past XL puts it back to automatic.',
    'Two new sizes fill the two long jumps: Roomy at 179 sits between tall and full, and Grand at 230 sits between full and XL.',
    'The walk used to get shorter twice on the way up, once at automatic and again at the wide banner, so the sizes arrived out of order. It does not any more.',
    'The Sandbox height stepper moves in quarter steps now, so it lands on 148, 177, 207 and 236 instead of only 118 or 236.',
    'The listening stats card grows its two lines on Roomy and Grand as well, so the bigger sizes read as filled rather than sparse.',
    'A bubble that is already a size keeps it, and one wearing the wide banner walks up from where it is instead of starting the ladder over.',
    'The widget, the player, the lyrics view, the letter covers and the album pill dock are untouched.',
  ],
    details: [
      'The walk read mini, small, medium, automatic, tall, wide, full, XL. That is 84 to 146 in one tap, back down to 118, up to 158, down to a 96px full-width banner, then 200 and 260 - two steps backwards and two jumps of more than 60px.',
      'The heights are one line now - 60, 84, 96, 118 automatic, 146, 158, 179, 200, 230, 260 - and the largest step between neighbours in the walk is 30px, so a card can be grown one thumb-tap at a time instead of in halves.',
      'Roomy and Grand are ordinary presets on the same stylesheet rules as the rest, so they scale with the Sandbox bubble size slider like every other size and are saved the same way.',
      'The Sandbox stepper stores quarters cleanly (1.25, not 1.2500000000000002) and offers twelve stops between 1x and 4x where it used to offer six, which is the same request as the ladder from the other end of the screen.',
      'Nothing is pinned to a stored size, so a bubble saved at any preset keeps it, and Reset still returns every bubble to automatic.',
    ],
  },
"""
