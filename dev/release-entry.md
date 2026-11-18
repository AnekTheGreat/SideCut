## 85.2.1 ({{STAMP}}): one sound, and the frame is the clock

**85.2.0 kept the second and lost the sound.** A high size is the picture and the
video's own soundtrack in two elements, and the soundtrack was started the moment
it was ready - which on a phone is usually before the first frame. Whatever head
start it took, it kept: the two clocks then run a fraction of a percent apart, and
85.2.0 only pulled the voice back when it was more than half a second out. So a
1080p or 4K picture ran with its own sound a few tenths of a second off, and it
stayed that way for the whole song. The other half was worse and simpler: the song
under the film was being **started again** by the app's own recovery. The
thirty-second media heartbeat revives a paused source, and a return from the
background revives a paused deck song, and neither of them knew the video tab was
playing - so the film and the song were both audible, seconds apart.

**One sound, and it is the picture's.** Exactly one of the picture, its paired
soundtrack and the song is audible at a time. The tab now publishes which one owns
the sound (`window.__scVideoSoundOwn`), and the app reads it in the four places
that can start a song: both elements' own `play` listeners stop themselves, the
heartbeat does not revive a source under it, and `recoverAudio` returns before it
restarts a deck song. Closing the tab clears the flag **before** the song is handed
back, so the resume on close is not mistaken for a song starting under the film. A
size with no audio row gives the sound to the song, because there the song is the
soundtrack.

**The frame is the clock, and the voice follows it.** The soundtrack waits for the
picture to be playing before it is heard, starts on the picture's second, and is
then held to a tenth of a second - trimmed by running it a hair fast or slow, not
jumped, so the lock is inaudible. Only a real gap is a jump: more than 0.6s, which
is a seek, a size change or a buffered picture. A picture that pauses, stalls or
ends takes its voice with it, and a `seeked` event - a native seek, not just the
progress line - puts the voice on the new second. The one-stream sizes are
untouched: there the picture carries its own sound and nothing else is unmuted.

**What 85.2.0 shipped is otherwise as it was.** A size change holds its second at
every size, a refused size falls back with a line saying which and keeps the size
that was chosen, the landscape transport steps aside two seconds after the last
touch, and the progress line is a handle.

`dev/patch-8521.py` replaces the module as one slice (from the 85.2.0 banner to the
shelf comment that follows it) with `dev/video-8521.js`, adds the four guards in
`index.html` (the deck's play listener, the stream element's play listener, the
heartbeat revive, `recoverAudio`), each matched exactly once, then moves the version
line, the cache name, one new notes entry and `updates.json` to 85.2.1. A second run
is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8521.cjs` runs the module that ships against a stubbed DOM and
passes 93 assertions. The ones this release is about: a soundtrack whose `canplay`
arrives while the picture is paused is **not** started and stays muted, and the same
event with the picture running starts it on the picture's second; a drift of 0.2s
is not seeked but trimmed (`playbackRate` 0.92, position left alone), a drift of
9s is jumped onto the frame, and the rate returns to 1 once the two are back
together; a picture `pause`, `waiting` and `seeked` each pause or move the voice;
a high size leaves the picture muted with only the soundtrack audible, a one-stream
size unmutes the picture and re-mutes the soundtrack, a size with no audio gives the
flag back, and closing clears the flag before the song resumes. The 85.2.0
assertions still pass unchanged - the pose before the load, the picture not being
moved by the voice, the paused size change, the landscape idle, the drag, the
refusal falling back to 720p. `python3 dev/patch-8521.py --check` exits 1 before and
0 after, a second run prints `already on the page`, all 7 inline scripts of the
patched page parse, the module on the page is byte-identical to
`dev/video-8521.js`, and the flag is read in all five places that matter. Bundles
reached their fixed point in three passes and both channels verify with `--check`.

Not checked: no phone, and no browser session drove this screen in this session.
What is proven is the order of the starts, the direction of the corrections and
that the flag is read where a song can begin - as code and arithmetic, not as
lip-sync on a device. Whether a particular phone keeps two media elements locked to
a tenth of a second, and how the rate trim sounds through a real speaker, are for
the owner. Nothing in the tab muxes: a paired soundtrack is still two elements, so
this is a lock, not a single stream.
