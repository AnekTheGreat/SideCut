#!/usr/bin/env python3
"""80.2.3 - the text this release writes into the page, part two.

The changelog head. Kept apart from part one only so each travels in its own call;
patch-8023.py loads both into one namespace.
"""

CHANGELOG_HEAD = r'''  { version: '80.2.3', date: 'October 24, 2026 \u00b7 6:05 PM EDT', title: 'The award card opens for plays too, and every rung is a bigger card than the last', items: [
    'A hundred plays opens the award card now: the same full-screen moment a streak milestone gets, made for the number of plays instead of the number of days.',
    'Every rung after it opens a bigger one - 200, 500, 1,000, 2,000, 3,000, 4,000, 5,000, 7,500 and 10,000 - and the ladder keeps going in steps of 5,000 after that.',
    'The medal climbs with the number: Bronze at a hundred, Silver at five hundred, Gold at two thousand, Platinum at five thousand and Diamond at ten thousand.',
    'Each tier is a louder card than the one before it: more rings behind the number, more confetti across it, and a glow that warms from bronze to ice as the medal climbs.',
    'The play that tips a rung opens the card there and then; a play counted with the screen off opens it when the app comes back to the front, and a library that arrives with its history already in it earns one card instead of nine.',
    'Studio, Tools, Milestones has a Plays block now: the next rung and how far along it is, the awards already won with their dates, and Replay on every one of them.',
    'The streak celebrations are untouched, and so are the badges, the widget, the player and the lyrics view.',
    'The widget, the player, the lyrics view, the letter covers and the album pill dock are untouched, and the song menu and the save row stay where 80.2.2 put them.',
  ],
    details: [
      'The card is the one 80.0 built for a streak: the same overlay, the same rings, the same bits and the same two buttons. It reads the app\u2019s own play total instead of the streak, wears its medal, and paints a ceremony for its tier - three rings and 26 bits on a streak or a Bronze card, up to eight rings and 80 bits on Diamond - so the hundredth play can never look like the ten-thousandth.',
      'The rungs live in one list, with the far tail generated rather than written out: 100, 200, 500, 1,000, 2,000, 3,000, 4,000, 5,000, 7,500, 10,000, then every 5,000 up to 100,000. A rung is recorded the moment it is celebrated, together with every rung below it, so a library restored with thousands of plays already in it says its piece once rather than nine times.',
      'The trigger is the app\u2019s own commitPlay, the one place a play is counted: the check runs right after the count is written, behind a guard, so a missing hook can never stop a play from counting. A start and a return to the foreground check the same rung, because a play heard with the screen off lands in the stats with no card on screen to show for it.',
      'The streak card resets to its own word, its own three rings and its own Keep it going button the next time it plays, so the two celebrations share one card without either inheriting the other look.',
    ],
  },
'''
