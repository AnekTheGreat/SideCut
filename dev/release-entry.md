## 85.2.4 ({{STAMP}}): an error for a source that is gone is not a refusal

**1080p still slid back to 360p on the click that asked for it.** The cause was in
the handler, not the ladder and not the sizes. A size change assigns a new source
and calls `load()`, which aborts the load that was running. That abort can arrive
as an `error` event **after** the new source is attached, by which time the element
has already cleared `media.error` - so `scVideoFailed` ran with no `MediaError` at
all, took the default wording ("the element could not play this source"), and
walked the road: an alternate codec at 1080p, then one size down, then the 360p
row. Two of those events back to back is exactly "click 1080p, end up on 360p".

**An error has to be an error.** The handler now requires a real `MediaError` on
the element, and it has to belong to the source this tab attached: `scVideoAttach`
records the source it set (`scVideoState.srcNow`) and an event whose element is no
longer on that source is dropped. A queued abort, a late event from the size
before, and an `error` with nothing behind it all become no-ops. The one caller
allowed to act without a `MediaError` is `scVideoWatch`, which passes `true`
because it is inspecting the element itself rather than reading an event.

**A real refusal now names the row.** The footer that says which size the picture
landed on also names the size and codec that refused it - `This size did not play
here (this source is not a video the element can open) - 1080p H.264. Now at
720p.` The failing rung is read before the road changes it, because
`scVideoApplyRung` has already moved `scVideoState.rung` by the time the footer is
written.

**Everything 85.2.3 and 85.2.2 shipped is otherwise untouched.** A dropped
connection still restarts the same source at the same second without touching the
size, the silent-source watch still scales with the size, one step down on the
first real refusal, FULL HD by default, and the single-sound lock of 85.2.1.

`dev/patch-8524.py` replaces the module as one slice (from the 85.2.3 banner to the
shelf comment that follows it) with `dev/video-8524.js`, then moves the version
line, the cache name, one new notes entry and `updates.json` to 85.2.4. A second run
is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8524.cjs` passes 123 assertions, the 117 of 85.2.3 included.
The ones this release is about: with the element's `error` cleared, a call that is
what a queued abort looks like at 1080p **changes nothing** - the size stays 1080p
and no line is written to the footer; an `error` while the element is on a
different source from the one the tab attached changes nothing either; restoring
the source and the error makes the very next call step down to 720p and write
`1080p H.264` into the footer; the silent-source watch still demotes when it finds
nothing, because it passes `dead`. The 85.2.3 assertions still pass - a network
drop keeps the size and restarts the same source on the same second, the watch
gives a 24 MB picture 16200ms and ignores a buffering one - and so do 85.2.2's
default and 85.2.1's sound lock.
`python3 dev/patch-8524.py --check` exits 1 before and 0 after, a second run prints
`already on the page`, all 7 inline scripts of the patched page parse, the module
on the page is byte-identical to `dev/video-8524.js`, and the sound flag is still
read in all five places. Bundles reached their fixed point and both channels verify
with `--check`.

Not checked: no phone, and no browser session drove this screen - and the player
call could not be re-measured from this sandbox either, because the host now
answers `LOGIN_REQUIRED` to a datacenter address. So what is proven is that an
error with nothing behind it can no longer resize the picture, and what a real
refusal says on the screen; whether this particular phone can open a 1080p
video-only row at all is still unproven. If it still lands on a smaller size, the
footer now names the row and the codec, and that line is the next thing to read.
