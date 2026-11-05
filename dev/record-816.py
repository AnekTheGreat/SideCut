#!/usr/bin/env python3
"""81.6 - write the release into the repository memory.

    python3 dev/record-816.py

AGENTS.md is newest-first, under the title. This inserts the 81.6 entry there once;
a second run is a no-op, so a workflow can call it without checking first.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, '..', 'AGENTS.md')
MARKER = '## 81.6 (November 5, 2026'
HEAD = '# SideCut \u2014 repository memory\n'

ENTRY = """## 81.6 (November 5, 2026 \u00b7 12:20 PM EST): the headphones work after a pause

- **WHAT THE OWNER SAID.** *"when I'm listening to music with headphones and I pause it using the headphone pause
  control, it doesn't let me unpause it with skipping forward a song and back, fix this so I can pause and unpause and
  use all controls on headphones"*.
- **A PAUSE DISMANTLED THE THING THAT UNDOES IT.** Four things happened at once, and every way back lived behind one
  of them: the element paused and `userPaused` was set; the keep-alive heartbeat was stopped; and, because the page is
  hidden when the phone is in a pocket, `armMediaRelease()` armed a ten minute clock that ends by PARKING or RELEASING
  the session. `scTransportResume()` - what play, next and previous called - cleared only the two marks, so a press was
  obeyed by a player whose keep-alive had been stopped by the pause it was undoing. `mediaResumableTrack()` then asked
  for a **File**, so a song played from a URL answered null and was RELEASED outright: a notification that no longer
  exists has no buttons to press.
- **THE STREAM HAD ITS OWN HALF.** `scStreamPhoneArm()`'s play and previous never cleared `scStreamState.userPaused`, so
  a source paused from the headphones kept telling the app "the owner paused this on purpose" while the press asked it
  to sound - and previous on a paused stream past three seconds seeked to zero and returned without starting.
- **THE ANSWER.** `scTransportPress()` is now what play, next and previous call: it clears the marks, cancels the release
  clock, clears the parked/released flags, re-arms the handlers on whatever session the phone rebuilt and restarts the
  keep-alive - then the press is obeyed. A transport pause in the background keeps the keep-alive for the grace window
  instead of dropping it on the spot, and `armMediaRelease()` still stops every bit of it at the end of the window (it now
  gives the phone hold back there too, which is where that battery cost was always meant to be paid). `mediaResumableTrack()`
  answers with anything that can sound, File OR URL. The stream's buttons clear the mark, and previous plays what it rewound.
  `playCurrent()` remakes a blob URL the phone reclaimed before it hands it to the element.
- **WHAT WAS CHECKED.** `python3 dev/patch-816.py --check` reported 1 before the payload and 0 after it, and a second run
  was a no-op; `node dev/check-816.cjs` runs 39 checks - `scTransportPress` lifted out of the page and driven with stub
  plumbing (mark cleared, clock cancelled, flags cleared, handlers re-armed, heartbeat restarted), `mediaResumableTrack`
  handed a file, a URL and neither, the stream's handlers pinned in the source, and every inline script compiling.
  `node dev/ota-bundle.mjs` reached a fixed point at 1219132 bytes and `--check` agrees; the store bundle is 1219140.
- **NOT CLAIMED.** No phone, no headphones and no Android build ran here: the press that lands on a parked session was
  driven through the lifted functions, not heard. Whether a particular headset's AVRCP profile sends previous as
  `previoustrack` is the phone's business, not this page's.

"""

with open(PATH, encoding='utf-8') as fh:
    src = fh.read()

if MARKER in src:
    print('record-816: already recorded')
    sys.exit(0)

if HEAD not in src:
    print('record-816: AGENTS.md has no title line to record under')
    sys.exit(2)

with open(PATH, 'w', encoding='utf-8') as fh:
    fh.write(src.replace(HEAD, HEAD + '\n' + ENTRY, 1))
print('record-816: recorded 81.6 in AGENTS.md')
