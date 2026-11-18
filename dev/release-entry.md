## 85.1.3 ({{STAMP}}): the size chip fits, and the wide header sits right

**85.1.2's new size chip was the wrong shape, and the browser said so.** The
header has one `button` rule, written for the round close button: 34 by 34,
border-box. The chip is a button too, so it inherited that box, and its label -
`1080p` measures 41px - spilled out of its own pill and into the close button
beside it. Measured in the page: chip 34 wide, label 41, overflow visible. The
chip now sets its own width and height, and its chevron turns over while the list
is open so the control reads as pressed.

**The wide header lost its spacer.** In landscape the title is hidden, and the
title was the `flex:1` element that pushed the chip and the close button to the
right - so the two controls of the wide picture were sitting at the top left. The
wide header now ends its row on the right.

**The soundtrack element is hidden the way media wants.** The paired track of a
high size was `display:none`; a media element with no box at all is one some
phones will not play, and this is the element that carries the sound of a 1080p
or 4K picture. It keeps a one-pixel, transparent box in the page instead.

**What 85.1.2 shipped is untouched otherwise.** The ladder, the remembered size,
the paired soundtrack with the song held underneath, the fallback footer and the
landscape mode are exactly as that release described them.

`dev/patch-8513.py` applies four exact layout edits to `index.html` and to
`dev/video-8512.js` (so the file stays the module that shipped), then moves the
version line, the cache name, one new notes entry and `updates.json` to 85.1.3.
Each edit is matched exactly once; the harness asserts all four shapes in the
stylesheet it builds.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.
