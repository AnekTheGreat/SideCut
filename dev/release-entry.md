## 85.2.0 ({{STAMP}}): the same second at every size, and a transport that steps aside

**85.1.2 shipped a size list, and the sizes did not really work.** Two lines were
the cause, and neither was in the ladder. `scVideoAuxSet` set `currentTime` on the
soundtrack element *before* `load()`; a media element that does not know its own
duration yet ignores or refuses that, so the soundtrack of a 1080p picture began
at 0:00. Then `scVideoSync`, in the mode where that soundtrack carries the sound,
nudged the **picture** onto the soundtrack's clock. The film jumped to the start
the moment a high size was picked - and because closing the tab puts the song back
at the picture's second, the song was put back at the start too. That is a size
change that looks like a restart.

**The picture is the clock now.** A second the element is not ready for is kept on
the element and applied the first time it knows its duration, for the picture and
for its own soundtrack both. The soundtrack is nudged onto the picture, never the
other way round, because a backwards seek in the picture is the one you can see.
The soundtrack is also silent until it is on that second, so a switch cannot play
a quarter second of the intro over a picture two minutes in. A change made while
the picture is paused leaves it paused, and the swap assigns the source instead of
clearing the element first, so a size change is not a black frame either.

**A size that never starts is not a black panel.** Nine seconds after a source is
attached, if nothing has played and no frame has arrived, the tab walks the road a
refusal already took: another codec at that height, then the best size that
carries its own sound, with the footer saying which. A size this phone cannot open
no longer forgets the size that was chosen - it is the phone that refused it, not
a choice that was wrong.

**The transport steps aside in landscape.** Two seconds after the last touch the
play row, the progress line, the size chip, the close button and the scrim under
them fade off the glass together, and a tap on the picture brings them back
without stopping the film - a tap in landscape is a wake-up first and a play/pause
second, the way it is everywhere else. A paused or buffering picture keeps its
controls, and so does an open size list.

**The progress line is a handle.** It has a 26px touch area around the 4px line, a
dot that follows the finger, and no easing while dragging: press anywhere, drag
to any second, and the picture, its soundtrack and the song underneath all follow.
The dot stays where it was dropped.

**What 85.1.2 and 85.1.3 shipped is otherwise untouched.** The ladder is read out
of the answer, AUTO is still the best one-stream size, the choice is still
remembered, the landscape button still turns the stage rather than the browser's
player, and the size chip still fits its label.

`dev/patch-8520.py` replaces the module as one slice (from the 85.1.2 banner to
the shelf comment that follows it) with `dev/video-8520.js`, then moves the
version line, the cache name, one new notes entry and `updates.json` to 85.2.0. A
second run is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8520.cjs` runs the module that ships against a stubbed DOM and
passes 72 assertions. The ones this release is about: a 1080p switch made at 0:33
still has the picture on 0:33 after the load has reset the element; the soundtrack
is attached muted with no position, sits on 0:33 once its own metadata arrives, and
is only unmuted when it is there; a soundtrack that drifts to 0:00 while the
picture is on 0:40 is pulled back to 0:40 and **the picture does not move**; a size
change made while paused stays paused and holds its second; a refusal falls back to
720p, still says so on the footer, and keeps 2160p remembered; two seconds of quiet
in landscape add the idle class and a tap reports it and clears it, while a paused
picture keeps its controls; a press halfway along the progress line seeks to 105 of
210 and a drag back to a quarter seeks to 52.5, with the fill at 50% before the
seek lands. `python3 dev/patch-8520.py --check` exits 1 before and 0 after, a second
run prints `already on the page`, all 7 inline scripts of the patched page parse,
and the module on the page is byte-identical to `dev/video-8520.js`.

Not checked: no phone, and no browser session drove this screen, so the idle fade,
the drag feel and the A/V pairing were verified as code and arithmetic only. What
is proven is the order of the poses and the direction of the nudges; whether a
particular 4K row decodes on a particular phone, and how the two-second fade feels
under a thumb, are for the owner.
