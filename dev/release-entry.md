## 80.6.4 ({{STAMP}}): the tab transition waits for a visible page, and stops leaking its aborts

- **THE BUG THE OWNER PHOTOGRAPHED.** A red strip across the top of the app reading
  `SideCut error: Transition was aborted because of invalid state. Document hidden`. That message is
  Chrome's, not the app's: `navigate()` runs the view swap inside `document.startViewTransition()`
  (80.3.6), and Chrome aborts a view transition when the page is hidden as it starts or goes hidden
  while it runs. It reports the abort by **rejecting the transition's promises** - starting with `ready`.
- **WHY IT REACHED THE SCREEN.** The wrapper caught `finished` only. So `ready`'s rejection had no owner,
  became an `unhandledrejection`, and the boot banner (line 7491) prints unhandled rejections in full.
  A backgrounded app is the normal case on Android, which is why it kept happening: tap a tab as you
  leave the app and the abort is guaranteed.
- **THE FIX IS THREE THINGS IN ONE FUNCTION.** (1) **The door**: a page whose `visibilityState` is not
  `visible` never starts a transition - it takes the plain `navigate()` path, which is the same door
  reduced motion already used. Nothing to abort. (2) **The leak**: `ready`, `updateCallbackDone` and
  `finished` each get a `catch`, so an abort is handled however late it lands. (3) **The lost tap**: an
  abort can land *before* the update callback ran, which means the DOM never swapped and the tap went
  nowhere - the callback now records that it ran, and a navigation that was swallowed is replayed
  outside the transition, guarded by the same flag so a swap that did happen is never done twice.
- **THE ANIMATION IS NOT CHANGED.** Same tokens, same duration and curve, same arrival for a pane's
  first paint, same two reduce-motion switches. This release only decides *whether* a transition may
  start and what happens to the promise it hands back.
- **VERIFIED BY CAUSING THE ABORT, NOT BY GREPPING FOR THE FIX.** `python3 dev/patch-8064.py` (1 step)
  then `--check` (0 steps); **every inline script block parses** (7 blocks); `dev/check-8064.cjs`
  passes **22/22**. It slices the page's own navigation IIFE out of `index.html` (not a copy), runs it in
  a vm against a fake `document`, and drives it with a **process-level `unhandledRejection` counter
  standing in for the banner**: a hidden page starts no transition and still navigates once; a normal
  swap starts one and runs it once; an abort on `ready` raises **no** unhandled rejection and does not
  repeat the swap; an abort **before** the update callback still lands the navigation, exactly once, and
  leaks nothing; reduce motion still skips the transition. It then asserts the shape - the visibility
  door, all three owned promises, the guarded replay, the absent lone-`finished` catch - and that the
  run as a whole left no rejection behind. The same driver run against the **pre-patch page** fails
  **8/22**, including `the whole run left no unhandled rejection - Transition was aborted because of
  invalid state. Document hidden`, which is the screenshot's own message: the check is known to fail on
  the bug and pass on the fix, not merely to pass. The OTA bundles reach a true fixed point in the
  release step - root + `ota/` **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at
  v80.6.4.
- **WHAT IS NOT CLAIMED.** No phone: that the strip is gone on the device it was photographed on. What is
  proven is that the exact rejection that produced it is now owned and cannot reach the `unhandledrejection`
  listener, and that the swallowed-navigation case still switches tabs. Nothing moved in the glass, the
  widget, the player, the library, the lyrics or the audio graph.
