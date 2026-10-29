## 80.6.8 ({{STAMP}}): Every word lands on the voice, and none can be skipped

- **THE OWNER'S ASK, VERBATIM.** *"lyrics are incorrect fix them they should be 100 percent correct
  flowing to the next word dawg"*. "Correct" here is the second clause: the words flow to the next
  word, in time, one at a time. Four faults were producing exactly the wrongness described, and all
  four live in the pacer.
- **THE SHEET'S OWN WORD STAMPS WERE BEING THROWN AWAY.** Enhanced LRC stamps the word it starts:
  `[00:12.00]<00:12.00>Hello <00:12.62>world`. `SC_LRC_TAG_SRC` has always MATCHED those stamps - its
  bracket forms include the angle ones - so `formatSyncedLyrics` stripped them out of the row with the
  line stamps and kept the text. The row printed correctly and every word in it was paced by a
  syllable guess. `scLrcBody()` now takes the repeated-line stamps off and leaves the inline ones in,
  `scWordParts()` splits what is left into pacing units carrying the stamp that introduced each of
  them, and the render writes it onto the span as `data-word-at`. `scSheetWordStarts()` reads those
  back on every frame and the pacer uses them **verbatim**. A word between two stamps takes its own
  syllable share of the gap, so a sheet that stamps only the long words still moves at the phrase's
  own pace. A sheet with no stamps is unchanged in every respect.
- **THE MEASUREMENT COULD NEVER APPLY TO SUCH A SHEET.** `scWordMeasureKick()` counts the words of
  each row from `scParseLrcLines()`'s text, which still carried the inline stamps, so a stamp was
  counted as a word; the count then disagreed with the number of spans drawn, and
  `scMeasuredWordStarts()` refuses a record whose count disagrees (it compares them on purpose). So a
  sheet with stamps was paced by the guess that the same song had already been measured to replace.
  The stamps are stripped **at that count** now - not in `scParseLrcLines()`, which also feeds the
  line-up writer, and that writer must not lose a sheet's own stamps when it rebuilds it.
- **A WORD COULD BE SKIPPED OUTRIGHT.** The pacer asked *which word's window contains now*, and a
  window is only as wide as the gap to the next start. Two words clamped onto one rise, or a fast
  line, made windows of a few hundredths of a second - narrower than the 50 ms poll - so those words
  were never lit: the highlight jumped. `scPickLitIdx()` asks the other question, **the last start the
  playhead has passed**, and walking a list of starts forward cannot skip one. `dev/check-8068.cjs`
  drives the shipped function over a 5 ms sweep and asserts it never goes backwards and that a 50 ms
  window is still picked at the 50 ms poll.
- **A LINE COULD SIT DARK.** When a measurement put a line's first rise later than the line's own
  stamp, nothing was lit until that rise arrived - the current row sat there with no lit word at all.
  It lights its first word for that stretch now.
- **AND THE TAIL.** `scWordStartsForWindow()` clamped every word past the end of the window onto `to`
  **itself**, so a line that ran a little long came out with several words sharing one instant: those
  words had no stretch of their own and were the ones being stepped over. The tail is pulled back from
  the end with room between the words instead (`gapMin`), and a final pass forces strict order.
- **THE LIGHT GLIDES.** The word transition goes from a 15 ms linear snap to 220 ms on the app's own
  `cubic-bezier(0.22,0.61,0.36,1)`, so the highlight travels to the next word instead of jumping onto
  it. Letter mode's per-letter curve is untouched.
- **WHAT THE PAGE PATCH TOUCHES.** `dev/patch-8068.py`, one step: the words the measurement counts,
  the render, the five helpers inserted at the head of `scPaceWords`, the pick, the window tail, the
  two transitions, the changelog head, `APP_VERSION`, and the shell cache to `sidecut-shell-v80.6.8`.
- **WHAT IS NOT CLAIMED.** No phone, no APK, no listening test - the pacing was not judged by ear, and
  the onset-derived starts are only as good as the recording's envelope. What IS proven, by
  `dev/check-8068.cjs` (52 assertions, and it RUNS the shipped code rather than reading it): the row
  body and the stamped words are parsed and spelled exactly, an unstamped sheet still hands the line
  back to the recording, the starts of a mixed sheet are ordered and inside their own gap, a rewind
  stamp is pulled forward, the pick never goes backwards and never skips a 50 ms window, the window's
  tail keeps every start distinct even at 24 words in half a second, and every inline script on the
  page still compiles. The OTA bundles reach a true fixed point in the release step - root + `ota/`
  **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.8.
