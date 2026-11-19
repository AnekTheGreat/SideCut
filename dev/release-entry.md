## 85.2.5 ({{STAMP}}): the clip has to be this song, and half a file is not a source

**Two reports, one root each.** The tab put someone else's clip on screen for a
song, and it kept landing on 360p. Neither was a mystery in the code once they were
read together.

**The catalogue clip was never checked.** A song from the source carries a video
id, and `scVideoStart` trusted it: one candidate, no search, `NEXT` hidden. When
the catalogue's clip is right, that is exactly what should happen - but when it is
a live take, a remix or another song entirely, nothing asked and nothing said, and
there was no way to walk away from it. A clip is now measured against the song it
was opened for: if the resolved video's length is more than twenty seconds **and**
more than a tenth away from the song's, the clip is not trusted. The search runs
once by artist and title, `scVideoRank` orders the results by length first, and
those results become `scVideoState.cands` - so the picture that appears is the
length-matched recording and `NEXT` walks the rest. A clip that matches is played
exactly as handed over, untouched. If the search finds nothing, the catalogue clip
still plays and the footer says why.

**Half a file is not a source.** A player row can carry its own `range` in the URL -
`&range=0-1023` - because that is what the player asked for when it built the row.
Handed straight to an element that then makes its own range requests, that URL is a
partial file, and a partial file is refused with `MEDIA_ERR_SRC_NOT_SUPPORTED`,
exactly like a phone that cannot decode the sharp size. `scVideoNoRange` strips the
parameter from every video and audio URL in `take()` and in `scVideoSnd`, so the
element asks for the bytes it wants. That refusal was indistinguishable from a
device limit, which is why the picture kept sliding to the one-stream row.

**And the tab says which page it is.** Two tabs that look identical can be two
builds after an update, and every report about "still 360p" that arrives while a
week-old bundle is on the screen costs a release. The size card's header now reads
`QUALITY · v85.2.5`, from `window.APP_VERSION`, so the number that ships is the
number on the screen.

**When a one-stream row is the floor, it says so.** A demotion that ends on a muxed
row adds `That is the sharpest size this phone will play here.` - different news
from a single stumble, and the thing worth knowing before opening the list again.

`dev/patch-8525.py` replaces the module as one slice (from the 85.2.4 banner to the
shelf comment that follows it) with `dev/video-8525.js`, then moves the version
line, the cache name, one new notes entry and `updates.json` to 85.2.5. A second run
is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8525.cjs` passes 136 assertions, the 123 of 85.2.4 included.
The ones this release is about: `scVideoNoRange` removes a middle `range` and a
trailing one, leaves a URL with no range alone, and the 1080p rung the element is
given has no `range` while its `itag` and `mime` survive; the paired soundtrack
row is cleaned the same way; the size card carries the app version; a catalogue
clip that runs 262s for a 210s song is not trusted - the search is asked once, the
length-matched result (`right`, 209s) is what plays, its title reaches the header
and `NEXT` is offered - while a catalogue clip that matches (209s for 210s) is
played as handed over and the search is never asked. The 85.2.4 guard against an
error with no `MediaError` still holds, so does 85.2.3's retry and watch, 85.2.2's
FULL HD default and 85.2.1's single sound.
`python3 dev/patch-8525.py --check` exits 1 before and 0 after, a second run prints
`already on the page`, all 7 inline scripts of the patched page parse, the module
on the page is byte-identical to `dev/video-8525.js`, and the sound flag is still
read in all five places. Bundles reached their fixed point and both channels verify
with `--check`.

Not checked: no phone, and no browser session drove this screen. The `range` strip
is proven as text surgery on the URL the element is handed, not as a 1080p frame on
a device - and the player call still cannot be re-measured from this sandbox, which
the host answers with `LOGIN_REQUIRED`. So: if the sharp sizes now play, the range
was the cause; if they still land on the one-stream row, the footer names the row
and the codec and the size card names the build, and those two lines are what the
next step needs.
