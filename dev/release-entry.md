## 85.1.1 ({{STAMP}}): the video plays its own sound, and its play button is its own

**85.1.0 played a picture and left the song as its sound.** That is only correct
if the two are the same recording, and nothing made them be. A search could land
on a live take, a cover or a sped-up upload, and the frame would show one
recording while the speakers played another - and even on a perfect match, the
thing coming out of the phone was not the music video.

**The audio is the video's now.** A muxed stream (`itag 18` and friends) carries
its own AAC track, so the element is unmuted and the song underneath is paused:
one sound, and it is the one the picture belongs to. Closing the tab puts the
song back at the second the video stopped on, so the tab is a detour and not a
fork in playback. A stream with no audio track - an adaptive-only row - keeps the
song as its soundtrack, stays muted, and says so on the footer instead of going
silent.

**The video is matched, not just found.** For a file the host is still asked by
"artist title", but what comes back is re-ranked against the song's own length:
within six seconds earns the top of the list, more than about a tenth of the song
away is dropped, and a title that advertises itself as live, a cover, a remix, an
instrumental or nightcore is pushed down. A song from the source keeps its own
video id, because it already knows which video it is. `NEXT` still walks the
results when the first is wrong.

**The play button that waits over a stopped video is drawn for this tab.** It is
no longer the glyph the rest of the app uses: a frosted glass disc with an inner
highlight and a coral glow, a warm gradient triangle with soft corners, and a
slow ripple that says "tap me" without a label. The round button in the transport
is the same drawn triangle, so the tab reads as one control set.

**What 85.1.0 earned stays.** The frame is visible before it plays, a refused
`play()` is printed with the name of the refusal instead of being swallowed, the
alternates are tried before the byte reader, and every failing step - the lookup,
each stream, the reader, the decoder - says which step it was.

`dev/patch-8511.py` replaces the module as one slice (from its banner comment to
the shelf comment that follows it), then moves the version line, the cache name,
one new notes entry and `updates.json` to 85.1.1. The rail glyph and its click
branch are untouched.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.
