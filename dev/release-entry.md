## 83.10.0 ({{STAMP}}): manual placement in the Mix Pad

The Mix Pad was still deciding things for you: it snapped to a tenth of a second
whether you wanted it or not, a clip could only live on the track you added it
to, and two clips in the same place meant one of them simply disappeared
underneath the other. This makes it a manual editor.

- **Free placement.** `mpSnapDelta` rounds to 0.05s when `mixPad.snap` is
  `'off'` (the default now), to 0.5s or to 1s when the SNAP row says so. The
  three chips write `mixPad.snap` and re-mark themselves.
- **Across tracks.** `move()` hit-tests the finger against every `.mp-lane`
  (14px of slack above and below, so a drop between lanes still lands), stores
  `drag.targetTi`, and `end()` commits it with `mpMoveClipTo`, which splices the
  clip out of one track's array and pushes it onto the other, then selects it at
  its new index. Same-track drops are refused rather than reordering the list.
- **Overlaps.** `mpClipBands` walks a track's clips in start order and marks any
  clip that starts before the previous one ends (`start < curEnd - 0.01`, so
  butt-joined clips are not "overlapping"). Overlapping clips take alternate
  halves of the lane - `top:4px / bottom:50%` and `top:50% / bottom:4px` - so
  both waveforms stay readable where they cross. `mpBandPaint` runs at the end of
  `mpPaint`, which it wraps rather than replaces, so the 83.7.0/83.8.0 handles,
  fades, knob and waveforms are all still painted first.
- **Feedback.** A fixed `.mp-badge` follows the finger during a drag, saying
  `TRACK n · start + length` only when the target track differs from the source.

Sizing on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only.

### What was checked

`dev/patch-83100.py --check` exits 1 before, 0 after; second run is a no-op; nine
anchors match exactly once. The drag section is replaced by slicing between its
comment and `function mpCardSub`, and the page ends up with exactly one
`mpWireEdit`, one `mpDragBadge` element and three snap chips. All 7 script blocks
parse, and the paint wrapper sits in the same script block as `mpPaint` (block 1)
- which matters, because `const mpPaintNoBands = mpPaint` would throw at load if
it did not.

Harness on the extracted Mix Pad block: snap off turns 1.234 into 1.25, half a
second turns it into 1, a whole second turns 2.6 into 2 - and a drag delta of
0.6 goes to 1. `mpClipBands` marks a clip at 0-10 and one at 5-10 as overlapping
(top/bottom), leaves butt-joined clips at 0-10 and 10-15 unbanded, and alternates
0/1/0 for three clips stacked at 0, 2 and 4. `mpMoveClipTo(0, 0, 2)` empties
track 1, fills track 3 and selects index 0; a same-track move returns false.

Not checked: no phone, and none of this was seen on a screen. The banding maths
and the drag arithmetic are verified; whether the halves are tall enough to read
on a phone, and whether a vertical drag feels right, are not.
