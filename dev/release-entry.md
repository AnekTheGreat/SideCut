## 83.8.0 ({{STAMP}}): the Mix Pad shows the song, and the playhead is something you pull

The crop sheet has drawn the waveform and given you white handles since early
on; the Mix Pad asked you to place clips blind, with a playhead you could only
reach through the buttons. Both are gone: a clip now shows what is inside it and
the playhead has a knob you can drag.

- **Waveforms.** `mpPeaks(buffer)` reads the decoded song once into 1600
loudest-sample buckets and keeps it (a `Map`, capped at 8 songs).
`mpClipPeaks(clip, n)` resamples the window that clip actually plays -
`offset` for `dur` seconds - so a clip cropped to the chorus shows the chorus,
not the whole song, and cropping visibly changes the picture.
`mpDrawWave(canvas, peaks)` paints one bar per pixel column, centred, at least
1px tall so silence still reads as a line.
- **Grab handles.** The selected clip gets two white `.mp-grab` bars, the same
shape as the crop sheet's handles. They are `pointer-events:none`: the drag
zones are still the outer 16px of the clip, so the bars show where to press
without stealing the press from the clip underneath.
- **The playhead.** `.mp-head` is now 14px wide with a centred hit area, and lane
1 carries a round `.mp-knob` at the top. Pointerdown on either starts a scrub:
playback stops, `playhead` follows the finger at 0.1s, and on release the mix
resumes from where it was dropped if it had been playing. Releasing outside the
window (`pointercancel`) does the same rather than leaving it paused.
- `mpPaint()` in 83.7.0 was renamed `mpPaintTracks()` and the new `mpPaint()`
wraps it, so the 83.7.0 handles, fades and slider state are all still painted -
the waveforms are added on top rather than replacing any of it.

Sizing on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only.

### What was checked

`dev/patch-8380.py --check` exits 1 before, 0 after; a second run is a no-op; six
anchors each match exactly once. All 7 script blocks parse; `mpPaintTracks` and
`mpPaint` each exist once; the 83.8.0 stylesheet, the grab bars, the knob and the
new hint line are on the page. Node harness against a 10s song that is quiet for
its first half and loud for its second: peaks come back 1000 long, 0.10 at the
start and 0.90 at the end, and the second read is the same cached array; a clip
covering 0-5s reads 0.10 throughout and one covering 5-10s reads 0.90; a clip
from 4s for 2s over 4 bars reads 0.10, 0.10, 0.90, 0.90 - the window maths is
right at the boundary; a 40px canvas draws 40 bars plus the clear; drawing with
no canvas and no peaks does not throw.

Not checked: no phone, nothing listened to, and the canvas was never seen. The
waveform arithmetic is verified; whether a bar-per-pixel reads well on a phone
screen is not. The scrub is wired to `pointerdown/move/up`, so it works with a
finger or a mouse, but it has only been exercised as code.
