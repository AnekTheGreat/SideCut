## 80.6.2 ({{STAMP}}): plain notes, and a settings strip that scrolls like paper

- **THE OWNER'S ASK, VERBATIM.** *"horizontal scroll in settings should be smooth and what the hell are
  these grater than symbols with a b then a less then symbol in the patch notes remove all of those form
  patch notes"*. Two bugs, unrelated, fixed together.
- **THE TAGS IN THE NOTES.** Changelog notes are allowed to carry emphasis — **171 of them in this page do**
  — but every panel escapes the note before it paints it (`escapeHtml(brief)` in `scClItemHtml`,
  `escapeHtml(i)` in the What's new summary, the glance line in the update log). So `<b>Settings</b>`
  reached the screen as literal characters and `&mdash;` arrived as its own name. The escaping is right and
  stays — notes are data. What was missing was a cleaner in front of it.
- **ONE CLEANER, ONE PLACE.** `scNoteText()` drops the emphasis tags the changelog uses, turns a
  placeholder like `lyricWords_<track>` into `lyricWords_track`, decodes the dozen entities the notes use,
  and decodes `&amp;` **last** so a note that legitimately says `&amp;lt;` cannot become a tag after the
  pass. `scClBrief()` runs every note through it, so bullets, the collapsed glance, the update counts and
  the What's new popup all get the same plain sentence — old history included, not just the new entry.
- **THE ONE EXCEPTION, DELIBERATELY.** A note that quotes markup as an example — *"a window.open or an
  `<a target="_blank">`"* — keeps its brackets: it is describing code, and reads wrong without them. The
  check allows exactly that and nothing else.
- **THE SNAP WAS THE STICKY FEELING.** The settings strip had `scroll-snap-type: x proximity` with a
  centred snap point per tab; on a slow drag the snap re-engaged repeatedly and tugged the strip out from
  under the finger. It is `none` now: the strip keeps the platform's momentum and stays where the finger
  leaves it. The tab you OPEN still glides to the centre — `scTabIntoView()` already asked for a smooth
  scroll, and the strip now carries `scroll-behavior: smooth` for it. The dock at the bottom of the app and
  the pinned-artists row keep their own snapping; this release never touched them.
- **A TAB IS A DRAG HANDLE.** The children claim `touch-action: pan-x` and refuse `-webkit-user-drag` and
  text selection, so a swipe that starts on a tab moves the row instead of turning the tab into a ghost
  image or doing nothing.
- **A GUARD IN THIS RELEASE WAS DEAD, AND IS FIXED.** The driver's `GONE` list — the "the page must not
  still carry this" half of its own proof — was defined and then never run, and two of its entries (the
  proximity snap) are true of other rows in the app, so a global check would have failed honestly. The loop
  is wired in front of the write now, its entries are the version constant, and the snap assertions are
  scoped to the `#settingsTabStrip` block. The release entry says so rather than quietly tidying it.
- **VERIFIED ON THE PAGE THAT SHIPS.** `python3 dev/patch-8062.py` (1 step) then `--check` (0 steps); every
  inline script block parses; and `node dev/check-8062.cjs` pulls the page's own `scNoteText()` /
  `scClBrief()` out of `index.html` and **runs every note in the CHANGELOG through them** — briefs and
  details, 400-odd strings — asserting that no emphasis tag and no named entity survives and that no note
  is emptied. **20/20**, including the strip's scoped CSS and the cache name.
- **IT SHIPS OVER THE AIR.** OTA root **{{ROOT}} bytes**, store channel **{{PLAY}} bytes**; the APK the
  widget runs in does not change.
