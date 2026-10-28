"""80.3.6, section 5 - the sentences that describe what changed.

Three, and each one is a place the app described itself in a way this release
made untrue or incomplete:

  * the Widget tab's own introduction lists what can be customized and now
    misses two of the three things this release adds;
  * the tutorial's "make it yours" line names Theme / Glow / Sandbox and the
    bubble size, which is still true, and gains the one thing a reader looking
    for a calmer screen would want to know: Reduce motion;
  * the Fine-tune heading no longer means "everything else", because two rows
    sit above it.

No sentence here names a feature that is not in the build: the store build has
no downloader and none of this touches one.
"""

COPY_SWAPS = [
    (
        'Customize the home-screen widget. Changes apply to every widget you have placed; re-adding one also picks these up.',
        'Customize the home-screen widget: eight presets, a follow-the-app-theme switch, an idle battery saver and the fine-tune palette. Changes apply to every widget you have placed; re-adding one also picks these up.',
        'the Widget tab introduction',
    ),
    (
        'Settings \u2192 Theme (looks), Glow (edge glow), Sandbox (custom quick actions and Home layout), and the Home bubble size slider.',
        'Settings \u2192 Theme (looks, and Prism is the newest), Glow (edge glow), Widget (its own palette), Sandbox (custom quick actions, Home layout and <b>Reduce motion</b>), and the Home bubble size slider.',
        'the make-it-yours line',
    ),
]
