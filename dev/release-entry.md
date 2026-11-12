## 84.1.0 ({{STAMP}}): the Mix Pad's one door, and a desk you can touch

The Mix Pad had two doors and neither opened onto a usable desk. The MIX PAD button
sat in the row under the player, next to DJ MODE, on the screen you are on to listen
to a song - and the window it opened was a bottom sheet at 82vh with 44px lanes and
9px buttons padded by 3px.

The button is gone. The Mix Pad is opened from **Studio**, where its card already
sat with the rest of the tools, and nowhere else: `#mixPadBtn` is deleted from the
player row, and `on()` already tolerates a missing element, so the listener it used
to carry is inert.

On a phone (`max-width:760px`) the window is the whole screen instead of a sheet:
`#mixPadBackdrop .mp-modal` is 100dvh with no margins or radius, `.mp-head` and
`.mp-transport` are `position:sticky` at the top so PLAY / STOP / REC / EXPORT stay
put while the timeline scrolls under them, `#mixPadBackdrop .modal-btns` is sticky at
the bottom so Close is always in reach, and the explanatory `.mp-sub` and `.mp-hint`
paragraphs are hidden - the timeline is big enough to say it now. Every `.mp-mini`
button is at least 32px tall, the lanes are 58px instead of 44, the VOL / PAN sliders
are 28px tall, and the deck buttons are 36px. Outside that breakpoint the window is
untouched apart from the same larger buttons and a 52px lane.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.
