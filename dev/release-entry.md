# 83.7.0 — the Mix Pad becomes an editor

**Mix Pad: drag, crop, crossfade, reverse**

- A **Mix Pad** card now sits in **Studio** with the other tools, so it is one tap from the Studio screen instead of hidden in the header.
- Clips are dragged by hand: pull the body to move it, pull either edge to crop the start or the end. The fades are drawn on the clip as shading, and the selected clip is outlined.
- **CROSSFADE 1s / 2s / 4s / 8s** overlaps the selected clip with the one before it on the same track and fades one out as the other comes in.
- **REVERSE** flips a clip, **FADE IN** and **FADE OUT** set each side by hand, and every clip has its own level.
- Playback and the exported WAV both follow all of it: fades are scheduled on the clip's gain, a reversed clip is built once and shared, and a fade-in that has already been passed is not replayed when playback starts mid-clip.

Page-only release: the installed app picks it up over the air.

## Checks

- `dev/patch-8370.py --check` exits 1 before, 0 after; a second run is a no-op; all anchors match exactly once.
- All 7 script blocks of the patched page parse; every `mixPad*` id the code reaches for exists in the markup; the Studio card and the ten new clip controls are present.
- Node harness: drag graph (120px of 600px across 60s = 12s), head crop +3 and −4 (offset/start/length land where they should), tail crop clamped to the song, crossfade 4s picks the clip before it and pulls the incoming clip to a 4s overlap, crossfade with nothing before returns nothing, the fade schedule is 0→level over the fade-in and level→0 over the last seconds, starting 6s into a clip schedules no fade-in, a reversed buffer plays the last sample first and is cached, and the mixdown schedules each clip at its own start with its own offset and length.
