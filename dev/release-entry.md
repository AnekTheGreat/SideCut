## 85.2.2 ({{STAMP}}): FULL HD by default, and one step down

**85.2.1 made every size sound right, and the tab still opened on the soft one.**
AUTO is the best row that carries its own sound, which on most videos is the 360p
progressive row a phone is handed - so the sharpest picture the video had was one
tap away in a list, and nothing on the screen said so. A viewer who never opened
that list watched the music video at the lowest quality the video offered. The
other half was a cliff: a size the phone refused fell straight to that same 360p
row, so one refused 1080p cost the 720p picture as well.

**Full HD unless you say otherwise.** A viewer who has never chosen a size opens
at 1080p, and a video with no 1080p opens at the largest size under it rather than
at the smallest. AUTO is still a choice and is stored as one, so "never chose" and
"chose AUTO" are no longer the same answer, and a size picked by hand is still kept
for the next video. The 1080p row in the list is marked as the default, so the
size the picture landed on has a reason on the screen.

**A refusal steps down one size, not to the floor.** The road is unchanged - two
more codecs at the height that was asked for, and only then smaller - but the step
after that is now the rung directly under the one that failed: 1080p refused is a
720p picture, a second refusal takes the best one-stream size. The footer still
names the size it landed on, and the size that was chosen is still remembered for
the next video, because it was this phone that could not open it.

**The list says why the picture is not the size expected.** A video that tops out
at 720p now says so in the size list, where the sizes are, instead of leaving it to
be worked out from a list whose largest row is smaller than the default. The note
that explains a paired soundtrack sits under the same line.

**The sound of 85.2.1 is untouched.** One audible element, the picture as the
clock, its own voice held to a tenth of a second by trimming its rate, and the
song unable to start underneath the film. Nothing in the app half changed, so the
tab still publishes the flag and the four guards still read it.

`dev/patch-8522.py` replaces the module as one slice (from the 85.2.1 banner to the
shelf comment that follows it) with `dev/video-8522.js`, checks that the four
85.2.1 guards are still on the page, then moves the version line, the cache name,
one new notes entry and `updates.json` to 85.2.2. A second run is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8522.cjs` runs the module that ships against a stubbed DOM and
passes 107 assertions. The ones this release is about: with nothing stored the tab
asks for 1080p and opens on the 1080p rung, muted, with its own track as the voice
and the song parked; a ladder without 1080p opens at 720p; `scVideoRungBelow`
answers 720p under 1080p and nothing under the smallest rung; the list marks
1080p as current and as the default and says AUTO is the best one-stream size; a
stored 720 opens at 720, a stored `auto` asks for AUTO and not FULL HD, and an
empty store asks for 1080p again; a refused 4K lands on 1440p and says so, a
second refusal takes the 720p one-stream row and unmutes the picture, and picking
a size by hand clears the step-down so the road starts again; a video whose only
row is a 360p adaptive one says in the list that it has no 1080p and tops out at
360p. The 85.2.1 assertions still pass unchanged - the voice waiting for a running
frame, the trimmed drift, the pause, the buffer, the seek, one sound, and closing
handing the song back at the picture's second.

`python3 dev/patch-8522.py --check` exits 1 before and 0 after, a second run prints
`already on the page`, all 7 inline scripts of the patched page parse, the module
on the page is byte-identical to `dev/video-8522.js`, and the sound flag is still
read in all five places. Bundles reached their fixed point in three passes and both
channels verify with `--check`.

Not checked: no phone, and no browser session drove this screen in this session.
What is proven is which rung a fresh install asks for, which rung a refusal lands
on and what the list says - as code and arithmetic, not as a 1080p picture on a
device. Whether a particular phone decodes a particular 1080p row, and how long
the switch takes on a real radio, are for the owner.
