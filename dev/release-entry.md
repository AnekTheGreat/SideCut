## 85.2.3 ({{STAMP}}): a busy signal is not a refusal

**85.2.2 made FULL HD the size a viewer lands on, and the tab kept leaving it for
360p.** The ladder was not the problem; the failure road was. Two things in it
treated trouble as a refusal.

**A dropped connection changed the size.** A network error arrives as a media
error like any other (`MediaError` code 2), and the road answered it by walking one
size down - and after the first demotion the next step is the muxed 360p row. So a
signal that was busy for a second, or a phone that lost a bar in a lift, demoted a
1080p picture to 360p and left it there, silently, for the rest of the song. A
drop now restarts **the same source, at the same second, once**, and does not touch
the size. Only the phone actually refusing the picture - code 3, the decoder, and
code 4, the container - walks the ladder. The footer says `The connection dropped
(...). The same size is starting again.` so a stutter is not a mystery either.

**The nine-second watch called a slow picture dead.** `scVideoWatch` was written
for the smallest row: nine seconds after a source was attached, if nothing had
played, it walked the same road a refusal takes. A 1080p row is three or four times
the bytes of the 360p row, and on a busy signal it reached its first frame well
after nine seconds - so it was demoted while it was working. The deadline now
scales with the weight of the size (`scVideoWatchMs`: 9s plus 300ms per megabyte,
capped at 21s), and the check asks whether anything is arriving at all: a picture
with anything buffered, or one the element is still fetching (`networkState` 2),
is left alone. Only a source that has stopped with nothing buffered is walked.

**A demotion still says where it went.** One step down on the first refusal, the
best one-stream size on the second, the footer naming the size and the reason, and
the size the owner chose kept for the next video - 85.2.2's road, unchanged. What
changed is when it is entered at all.

`dev/patch-8523.py` replaces the module as one slice (from the 85.2.2 banner to the
shelf comment that follows it) with `dev/video-8523.js`, then moves the version
line, the cache name, one new notes entry and `updates.json` to 85.2.3. A second run
is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8523.cjs` runs the module that ships against a stubbed DOM and
passes 117 assertions, the 107 of 85.2.2 included. The ones this release is about:
a media error at code 2 on a 1080p picture **keeps 1080p**, re-attaches the same
URL, holds the second it was on (84s), sets the retry marker once, and puts the
connection on the footer rather than the transient line; a second drop with no
other codec to try walks exactly one size down (1080p to 720p); a decode refusal
(code 4) still steps down and still names the size; `scVideoWatchMs` gives a 24 MB
picture 16200ms rather than 9000 and caps a 400 MB one at 21000; a picture that is
buffering (`networkState` 2, 0.6s buffered) keeps its size through the watch, and
one that has stopped with nothing buffered steps down one. The 85.2.2 default is
asserted unchanged - a fresh install opens 1080p, AUTO is still a stored choice, a
video without 1080p opens at 720p and says so - and so is the 85.2.1 sound lock.
`python3 dev/patch-8523.py --check` exits 1 before and 0 after, a second run prints
`already on the page`, all 7 inline scripts of the patched page parse, the module
on the page is byte-identical to `dev/video-8523.js`, and the sound flag is still
read in all five places. Bundles reached their fixed point and both channels verify
with `--check`.

Not checked: no phone, and no browser session drove this screen, so what is proven
is which error codes change the size and which do not, and the arithmetic of the
watch - not that a particular phone now holds 1080p through a bad minute. If a
picture still lands on a smaller size, the footer now names the size it went to and
the reason, and that line is the thing to send back.
