## 83.7.0 ({{STAMP}}): the Mix Pad becomes an editor, and Studio gets a door to it

83.6.0 shipped a four-track timeline whose clips could only be nudged with
buttons, and whose only way in was a small `MIX PAD` button in the library
header - hidden from anyone looking in Studio. Both complaints are answered
here: there is a **Mix Pad card in Studio**, with the other tools, and a clip is
now something you pick up and shape rather than select and press buttons at.

- **Studio card.** `renderStudio()` emits `toolCard('mixpad', ...)` straight
after the DJ Mode card. Its click is handled by a capture-phase listener in the
Mix Pad block (`#studioView [data-tool="mixpad"]` -> `mpOpen()`), so it opens
the window whether or not `openTool()` knows the name. The card's sub-line falls
back to a fixed string when `mpCardSub` is in a different script block - the Mix
Pad block and `renderStudio()` are not in the same one.
- **Dragging.** Pointer events on `.mp-lane`, delegated, so `mpRender()` did not
have to change: `mpPaint()` (formerly `mpPaint`, now painting over `mpPaintBase`)
stamps `data-t`/`data-i` on each clip, and pointerdown decides mode from where
inside the clip the finger landed - left 16px crops the head, right 16px sets the
length, the body moves it. Moves are computed from the drag origin against the
lane width, not accumulated, so a slow drag and a fast one land in the same place.
- **Crossfade.** `mpXFadePlan()` finds the nearest clip that ends before the
selected one on the same track, overlaps the incoming clip by N seconds and sets
the outgoing fade-out and the incoming fade-in to N. Nothing before it -> a toast,
not a silent no-op.
- **Reverse.** `mpClipBuffer()` builds a reversed copy once per song, caches four,
and both playback and the mixdown call it.
- **Level and fades.** Each clip has `gain`, `fadeIn`, `fadeOut`; `mpShapeGain()`
schedules them on the clip's gain node, and a fade-in already passing is not
replayed when playback starts mid-clip (`into` seconds are skipped).

Sizing on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only release - an installed 83.4.0+ app picks it up over the
air, no APK.

### What was checked, and what was not

Checked: `dev/patch-8370.py --check` exits 1 before and 0 after, a second run is
a no-op, and every anchor (version line, 83.6.0 changelog entry, DJ Mode card,
clip tool row, stylesheet marker, `mpPaint`, the playback schedule, the mixdown
schedule, `ensureDeckGainNode`) matches exactly once. All 7 script blocks of the
patched page parse; every `mixPad*` id the code reaches for exists in the markup;
the Studio card and the ten new clip controls are present; the repo's copy of the
engine is byte-identical to the tested one. Node harness: 120px of 600px across a
60s timeline reads 12s; head crop +3 gives start 13 / offset 8 / length 17 and -4
gives 6 / 1 / 24; tail crop stops at the end of the song and floors at 0.3s; a 4s
crossfade on a clip at 22s behind a clip ending at 20s pulls it to 16s with 4s
fades both ways; a crossfade with nothing before returns null; the fade schedule
is 0 -> level over the fade-in and level -> 0 over the last seconds; starting 6s
into a 2s fade-in schedules no ramp at all; a reversed buffer plays the last
sample first and is served from cache on the second call; the mixdown schedules
two clips at 0/0/10 and 4/2/6 and reports a saved 60s file.

Not checked: nothing was listened to and no phone was used, so how a real
crossfade sounds, and how the drag feels under a finger, are still unproven -
the arithmetic is what was verified. A first release attempt failed at the
AGENTS step because this file did not start with `## <version> (`; this version
of it does.
