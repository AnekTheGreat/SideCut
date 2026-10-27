## 80.3.4 ({{STAMP}}): the tabs come back where you left them, the downloader keeps the link and finishes an interrupted album, and the store build carries no downloader at all

- **THE OWNER'S ASK, VERBATIM, IN TWO MESSAGES.** *"discover studio and tools should all autoscroll
  to where you were last, even if you refresh, the link should save in the downloader and it should
  automatically resume downloading"*, then *"in play version of app remove any parts even related to
  downloaders or converter from the app and it's patch notes"*.
- **DISCOVER WAS PINNED TO THE TOP ON PURPOSE, AND THAT RULE IS NOW REVERSED.** `navigate()` and
  `showDiscover()` both forced `#discoverView.scrollTop = 0` on every open, with the reason written
  beside them ("so the pinned-artists + new-releases section, and not the search results below it,
  is what first shows on screen"). Both lines are gone, and the position now lives in
  `sidecut_scroll_discover` / `sidecut_scroll_studio` / `sidecut_scroll_tools` (localStorage, because
  "even if you refresh" is half the ask, and because the app's own snapshot machinery already carries
  these keys across a storage wipe).
- **THE MEMORY IS ONE TOP-LEVEL BLOCK, AND IT WATCHES THE DOM RATHER THAN REACHING INTO THREE
  CLOSURES.** The studio panes and the tab machinery live in blocks the app's own IIFE cannot see by
  name (the revamp block says as much itself), so the new block uses the one thing the app is
  guaranteed to paint: the `active` class on `#discoverView` and `#studioView`, plus - inside the
  studio view - each pane's class. One `MutationObserver` each, and a tab tap, a studio half tap, a
  view resumed after a reload and the app's own boot all land in the same handler.
- **THE POSITION IS READ WHILE ITS TAB IS STILL ON SCREEN, NEVER AT THE MOMENT OF A SWITCH.** Hiding
  a pane re-lays out the container, and a scroll container clamps `scrollTop` to the new content the
  instant anything reads it - so reading late files the incoming pane's clamped number under the
  outgoing tab, which is how Tools would open half way down an album nobody asked for. The outgoing
  number is what the scroll listener last saw; the incoming tab is restored from its own key.
- **THE RESTORE IS A SHORT SETTLE, AND A HAND ENDS IT.** Discover's results and its pinned rows
  arrive after the view opens, so a saved 4000px is not reachable on the frame the view turns active:
  the target is re-applied (every 120 ms, at most ~5 s) until it is reached, and the first real touch
  - a tap, a drag, a wheel, a key - stops it at once. Nothing remembered means the tab opens at the
  top exactly as it always did, which is also what clears one tab's position out of the container the
  other tab shares.
- **A RUN IS NOW WRITTEN DOWN, BECAUSE 80.3.3's HOLD ENDS WITH THE PAGE.** The Web Lock, the
  notification and the Android wake lock all survive leaving the app; none of them survives an OTA
  reload, a storage wipe or Android killing the WebView, and an album is long enough for one of those
  to land in the middle of it. So a run records itself in `sidecut_dl_job`: the link, the format,
  where the songs were going, the plan (so a resume needs no network to plan again), the song list it
  is working through and which of them have landed.
- **"LANDED" COMES FROM THE LIBRARY WRITE, NOT FROM THE RUN.** `scAddConvertedToLibrary` is the one
  place a converted song lands, so that is what takes the song off the queue (matched by title, the
  way the run's own one-source-one-song ledger matches), and both batch runners additionally mark the
  exact slot they were handed (`scDlJobTake(i)`, index-aligned because `scRunPool` hands the slot
  number with the item). A song that failed, or one the app died before landing, stays in the queue -
  which is the whole point of writing it down.
- **THE YOUTUBE PLAYLIST RUN IS A FUNCTION NOW.** It lived inside the click handler that started it -
  a closure over `pl`, `chosen`, `fmt`, `box` and `btnEl`, reachable only by tapping Convert - and
  "automatically resume" needs the same run startable at boot with the songs that never landed. The
  body was lifted into `scYtRunChosen(pl, chosen, fmt, box, btnEl, url)` **unchanged**: the only edits
  inside it are the three record lines. That lift is proven, not asserted - the harness takes the old
  body out of `git archive origin/main` and the new function out of the patched page, normalises both
  and diffs them, and the diff is exactly the `(async function(){` line, the four record lines and
  their comments (20 lines, nothing else). The click path also gained the `.catch` the inline version
  never had, so a throw puts the Convert button back.
- **RESUME IS BOUNDED: TWO AUTOMATIC TRIES, THEN THE LINK IS THE ANSWER.** A song nobody can source
  must not start a download on every single launch for ever. After two automatic resumes the link is
  still in the box and one tap starts the run again by hand. Cancel and the little x beside either
  Convert button clear the record, so a reload never quietly begins a run the owner stopped, and a
  one-song run is written down too (resumed through its own single path, because the song's real
  title is only known while converting).
- **THE STORE BUILD LOST ITS DOWNLOADER, ITS CONVERTER AND THE NOTES ABOUT THEM.** "Remove any parts"
  is taken literally: the Conversion Tools section (`#convToolsCard`, now named so the build can say
  what it removes) and the Settings-side copies are **removed from the document** rather than hidden,
  the tool section beside the Discover how-to goes the same way, and the summary line that used to be
  rewritten to name "MP4 · Expand URL" is gone with the card it labelled. Every converter keeps its
  hard `SC_IS_PLAY` gate, and everything downstream that reaches for those ids was already
  null-guarded (the wiring has been `if(btn && input)` since the cards existed).
- **"IT'S PATCH NOTES" TOO: AN ENTRY THIS BUILD CANNOT SHOW IS NOT SHOWN.** The page already hid
  downloader *items* on the store build; over an entry like 80.3.3 that left a headline ("an album
  converts in minutes") standing over nothing, and a count reading "0 updates". `scChangelogEntries()`
  now drops entries with no visible notes, and all five reads of the array go through it (the
  update-log panel in both modes, the changelog sheet's summary and its list, and the What's New
  popup). The **published store channel** gets the same rule in `dev/ota-bundle-play.mjs`
  (`hidesOnPlay`, the page's own regex kept in step by hand, plus one honest line when a release had
  nothing else to say), and this release's own downloader notes carry `[FULL]`, the marker both
  channels already understand.
- **VERIFIED ON THE PAGE THAT SHIPS.** The payload was applied to a scratch tree taken from
  `origin/main` itself (`git archive origin/main`), so the thing measured is the page this release
  replaces plus this patch and nothing else: `python3 dev/patch-8034.py` (1 step) then `--check`
  (0 steps); **every inline script block parses** (acorn, 7 blocks, 0 failures); the YouTube lift diff
  above; and **`sc-8034-check.cjs` passes 894/894, exit 0** (the session's scratch driver, kept out of
  the repo). It proves, against the release's own source rather than a copy: a scroll in Discover is
  written down and comes back; **the same position survives a fresh document with the same storage**
  (which is what "even if you refresh" means); a position the page cannot reach yet is re-applied when
  the content arrives (clamped 500 -> 3000); Studio and Tools keep separate positions over the one
  container that holds them, and switching back restores the right one; a tab with nothing remembered
  opens at the top; a pointerdown ends a settle instead of fighting it; both "start at the top" resets
  are gone from the page. The record: written with the link, format, mode, plan and all six songs;
  takes by slot, by title at the library write, an unmatched title takes nothing, a double take
  changes nothing; the resume drives the Spotify runner with **exactly the four songs that did not
  land** and their saved format, mode and link; the label reads "6 of 6 still to make"; a record at
  two attempts starts nothing; a single link resumes through its own path with its own format (both
  kinds); the link comes back in the Discover box and the Settings copy, leaves the other kind empty,
  and does not start a run when nothing is left; clearing the record removes it from the device; the
  store build writes and resumes nothing. And the notes: **no entry the store build shows, and no
  published store note, mentions a downloader or a converter** (the page's own rule, including its
  exceptions for "download to phone" and "download crossfaded mix", which are the app's file
  exports), the store build's newest visible entry always has something to say, the full build keeps
  all eight notes with the markers stripped, and both OTA channels reach a true fixed point
  (`ota/` **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.3.4). The store
  build's own build path is unchanged: `patch-playbuild.py` still injects the flag, and the zip in
  `ota-play/` still carries it.
- **WHAT IS NOT CLAIMED.** No phone, no wall clock: the scroll memory was driven in jsdom with the
  containers' own scroll numbers supplied (jsdom has no layout), so what is proven is the logic and
  the storage, not a device's touch physics. The store build's removal is proven on the page and on
  the channel scripts, not on a Play install of the AAB - the Android build remains the compile and
  packaging proof. Nothing about a conversion itself changed: the same song makes the same tagged
  file with the same name, cover and format menu. The player, the library, the albums, the lyrics, the
  equaliser and the widget are where 80.3.3 left them.
