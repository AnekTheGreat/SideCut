## 85.2.6 ({{STAMP}}): the picture is where the song is, and a song without one has a cover

**Four reports, and not one of them was the ladder.** The size list offered rows
this phone cannot open, and then offered the same row again for the next song after
it had already refused it - so "random qualities that do not work" was true on both
halves of the sentence. The clip opened at the top of the file instead of at the
second the song was on. And the tab stayed on the song it was opened for: the queue
moved on and the film did not, which is the one thing that makes a music video tab
useless in a queue.

**The list only offers what plays.** A height this phone refuses is remembered by
height for the rest of the session (`scVideoState.deadH`), marked in the list as
`did not play here`, and never landed on automatically again - the default, 1080p
or AUTO, now walks past it to the sharpest size that actually plays
(`scVideoLive`). A height whose only row is a codec the element cannot claim is
marked the same way from `canPlayType`. Neither is hidden, because a hand may want
to try one anyway; neither is offered as if it works. Nothing under 360p is listed
at all unless it is the only thing the video has - those rows are the floor of a bad
connection, and putting 240p beside FULL HD is half of why the list read as random.

**The picture skips to the song.** `scVideoAttach` now takes its starting second
from the song in every mode (`scVideoSongTime`), not just when the picture carries
its own soundtrack. Song mode used to start the film at 0:00 while the song ran on
underneath it. The footer says which second the picture came in at, because a film
that starts halfway otherwise looks like a film that is broken.

**The tab follows the queue.** `scVideoFollow`, called from the same tick that
already keeps the picture on the song's clock, compares the playing song's key with
the one the tab loaded for and - when it changes - gives the sound back, starts the
song, and loads the new song's own video on that song's second. A resolve that comes
back for a song the queue has already left is dropped (`scVideoState.loadSeq`), so
a slow lookup cannot put the old film over the new song.

**A song with no video has a cover.** Where there is nothing to play - a file the
search cannot match, or a single candidate the player cannot resolve - the stage
shows the track's own art, blurred behind itself and square in the middle, with one
line saying so (`scVideoNoVideo`). The video element, the transport and the transport
spinner are hidden while it is up, the song is the sound, and the tab keeps
following the queue, so the next song that has a video gets one. No more black
rectangle that cannot be told apart from a tab that failed.

`dev/patch-8526.py` replaces the module as one slice (from the 85.2.5 banner to the
shelf comment that follows it) with `dev/video-8526.js`, then moves the version
line, the cache name, one new notes entry and `updates.json` to 85.2.6. A second run
is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8526.cjs` passes 157 assertions, the 136 of 85.2.5 included.
The ones this release is about: with 1080p refused by the element at code 4, the
height is recorded, the picture steps to 720p, the **next** video opens at 720p
rather than 1080p again, and the list marks 1080p `off` with `did not play here`
while 720p, 480p and 360p stay offered and 240p is not listed at all; a clip loaded
with the song at 1:32 puts the picture on 92s and the footer says `Started at 1:32,
where the song is`; a song whose search returns nothing turns on the cover with the
track art in the image, the same art blurred behind it, the stage class that hides
the empty element, the line `No music video for this song.`, the song playing as the
sound and the tab still knowing which song it is on; and moving the queue from track
one to track two leaves the picture where it is when the key is unchanged and loads
the new song's video (both player clients asked) when it changes.
`python3 dev/patch-8526.py --check` exits 1 before and 0 after, a second run prints
`already on the page`, all 7 inline scripts of the patched page parse, the module on
the page is byte-identical to `dev/video-8526.js`, and the sound flag is still read
in all five places. Bundles reached their fixed point and both channels verify with
`--check`.

Not checked: no phone, and no browser session drove this screen, so the cover card
was never looked at - its layer, its blur and its sizing are CSS that has not been
rendered here, and the queue-following was proven as a key comparison and a load,
not as a film changing by itself on a device. Whether a particular phone really
cannot open 1080p (as opposed to failing once on a bad second and being marked for
the session) is also unproven; the list still lets a marked height be picked by
hand, and the marking ends with the session.
