## 83.9.0 ({{STAMP}}): the Mix Pad window fits, and a song lands by itself

83.8.0's window looked broken on a phone, and the cause was a name: three
rules shared the class `.mp-head` - the title row (83.6.0), the 2px playhead
line (83.6.0) and the 14px knob hit area (83.8.0). The title row won the
`position:absolute`, `width:14px`, `margin-left:-7px` rules, so the panel header
became a 14px absolutely-positioned column and everything under it stacked on
top of everything else. The screenshot that reported it showed exactly that:
the `mp-sub` sentence running down the middle of the window as a narrow column.

The playhead is now `.mp-lane-head`; nothing else uses it. `.mp-head` keeps its
83.6.0 meaning (the title row) and there is exactly one rule for it, which is
`display:flex`.

Also in this release:

- `.modal.mp-modal` is capped at `88vh` with its own scroll, so the four tracks
  are reachable on a phone instead of running off the bottom of the screen.
- `.mp-chip-label` (CROSSFADE) takes a full row (`flex:1 1 100%`), so it cannot
  sit on CROP START any more.
- The fade sliders keep three columns (`74px minmax(0,1fr) 46px`) with nowrap
  labels, so FADE IN and FADE OUT cannot overlap, and the range inputs are
  allowed to shrink (`min-width:0`).
- The song picker and the ADD button each get their own line when the window is
  narrow instead of squeezing.

And the behaviour the report asked for: opening the Mix Pad with an empty
timeline now seeds track 1 with the working song (`mpSeedIfEmpty`), and choosing
a song from the picker adds it at the playhead immediately - one tap instead of
two. `mpOpen` is wrapped in `mpWireSeed` rather than edited in place, so the
Studio card, the header button and anything else that opens the window all seed.

Sizing on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only.

### What was checked

`dev/patch-8390.py --check` exits 1 before, 0 after; the second run is a no-op;
nine anchors each match exactly once (both old `.mp-head` rules, the element
creation, the 83.8.0 knob lookup, the scrub lookup, the stylesheet end, the
version line, the 83.8.0 changelog entry, `ensureDeckGainNode`). On the patched
page: `.mp-head{` matches once and carries no `position:absolute`;
`.mp-lane-head{` matches twice; the JS refers to `.mp-lane-head` in the create,
paint and scrub paths; `.modal.mp-modal{ max-height:88vh` is present; the seed
functions and the `mpOpen` wrapper are present; all 7 script blocks parse; and
every id the window depends on (`mixPadPlay/Stop/Rec/Export/SongPick/Target/Add`,
lane 1, lane 4, crop, crossfade, fades, level, close) is still in the markup.

Not checked: no phone, and the window was not seen. The collision is proven from
the stylesheet itself - one class did two jobs, and the fix removes the second
job - but the layout was not rendered here, so the next thing that needs doing
is a look at it on the device.
