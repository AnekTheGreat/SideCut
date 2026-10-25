#!/usr/bin/env python3
"""80.2.6 - the page text, kept beside the patch that writes it.

Two blocks, both long enough to be unreadable inside the patch's own control flow:

  CSS      the stylesheet block this release adds to the Home bubbles: the
           full-width stats card anchors its words to the card floor, and the two
           lines grow on the sizes that have the height to hold them.
  CHANGELOG_HEAD
           the release's own entry, written above 80.2.5.

Nothing here is version-swept by dev/repin-8026.mjs: the CSS carries no pin and the
changelog head names 80.2.6 as text, which is the release this file belongs to.

  (imported by dev/patch-8026.py; not run on its own)
"""

# THE STYLESHEET BLOCK. Inserted directly under the .hb-size-full rule - the last of
# the size rules, so this sits with them and can read every size above it.
CSS = """/* 80.2.6 - THE WIDE STATS BUBBLE PUTS ITS WORDS ON THE FLOOR. It is the one card
   that is full-width, and on the owner's phone it wears the middle size (146px),
   which centres its two lines so the extra height is shared above and below them.
   The icon is pinned in the top-left corner, so the room above the words was
   already spoken for and the room below them was a hole - "why is there a random
   bottom gap in the listening stats bubble". The words now sit on the card's own
   floor like every other bubble's do, and both lines are a little bigger so the
   card reads as filled instead of padded out. Same answer at any size the card is
   given: what is left over goes above the words, behind the icon, never under
   them. The bigger two lines wait for a card with the height to hold them -
   the 96px automatic wide card fits its words exactly, and growing them there
   put the icon's foot on the number. body:not(.sc80-cloud) keeps the circle
   wall's own centring out of this. */
body:not(.sc80-cloud) #homeBubbles .home-bubble[data-bubble="stats"]{ justify-content:flex-end; }
body:not(.sc80-cloud) #homeBubbles .home-bubble[data-bubble="stats"]:is(.hb-size-medium, .hb-size-tall, .hb-size-full, .hb-size-xl) .hb-value{ font-size:calc(26px * var(--hb-s, 1)); line-height:1.05; }
/* The expand hint owns the bottom-right corner, so the label stops short of it. */
body:not(.sc80-cloud) #homeBubbles .home-bubble[data-bubble="stats"]:is(.hb-size-medium, .hb-size-tall, .hb-size-full, .hb-size-xl) .hb-label{ font-size:calc(12.5px * var(--hb-s, 1)); margin-top:5px; padding-right:26px; }
"""

# THE RELEASE'S OWN CHANGELOG ENTRY. test-738 reads it: at least seven notes, no
# apostrophe anywhere, no downloader or converter term, every note under 260
# characters, the stamp ending in EDT, and 80.2.5 still listed next.
CHANGELOG_HEAD = """  { version: '80.2.6', date: 'October 25, 2026 \\u00b7 1:10 AM EDT', title: 'The listening stats bubble keeps its words on the floor, and both lines are bigger', items: [
    'The listening stats bubble no longer leaves a strip of empty card under its words on Home.',
    'Its two lines now sit on the card floor like every other bubble, so the room the card is given goes above them, behind the icon, instead of under them.',
    'The time and the line beneath it are bigger on the middle, tall, full and extra-large sizes, where the card has the height to hold them.',
    'The automatic wide card is unchanged to the pixel: its height fits its words exactly, so nothing there was grown into the icon.',
    'It reads the same whether the height came from the expand chip or from the Sandbox stepper, because nothing here is pinned to one size.',
    'Every other bubble on Home keeps the centring it had, and the circle wall and the classic layout are untouched.',
    'The widget, the player, the lyrics view, the letter covers and the album pill dock are untouched.',
  ],
    details: [
      'The middle size centres its two lines so its extra height is shared above and below them, which is right for a card with an icon in the middle and wrong for this one: the stats icon is pinned in the top-left corner, so the room above the words was already taken.',
      'The full-width stats card now anchors to its own floor, so whatever height it is given lands above the words rather than beneath them; measured on the middle size, the empty card under the words went from 53px to 13px.',
      'Both lines grow on the sizes with room for them - the value from 20px to 26px and the label from 11.5px to 12.5px - and the label stops short of the expand hint in the bottom-right corner.',
      'The automatic wide card was left exactly as it was: at 96px the words already fill the card, and the larger type put the icon foot on the number.',
      'The circle wall is excluded by body:not(.sc80-cloud), so the same bubble in that layout is still centred at its own 20px.',
    ],
  },
"""

# Where the stylesheet block goes: under the last of the size rules.
CSS_ANCHOR = (".home-bubble.hb-size-full{ grid-column:1 / -1; min-height:calc(200px * var(--hb-s, 1)); }\n")

# Where the changelog head goes: above the release this one replaces.
CHANGELOG_ANCHOR = "  { version: '80.2.5', date:"
