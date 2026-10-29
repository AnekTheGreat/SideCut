## 80.6.10 ({{STAMP}}): The streaming note stops naming a build

- **WHAT WAS WRONG.** The 80.6.9 entry's fifth line said where the Streaming block lives, in the words
  *"full builds only"*. The owner's standing instruction is that neither the app nor a release note
  names the full build: a reader is not told which build they are holding. The wording was the only
  fault - the section, the gate and the module are untouched by this release.
- **WHAT CHANGED.** That one item loses its build clause and keeps its point: *a stream uses its own
  player, so a stream that dies cannot touch your queue, widget or downloaded playback*. Nothing else
  in the page is edited: `dev/patch-80610.py` makes one text swap, moves `APP_VERSION` to 80.6.10 and
  the shell cache to `sidecut-shell-v80.6.10`, and asserts on the way out that the note carries no
  "full builds only" and no "full APK".
- **WHY THERE IS NO 80.6.10 NOTE IN THE APP.** The changelog list is what the update sheet shows. An
  entry reading *"a note was reworded"* is noise in the one place a reader looks for news; the entry
  being corrected is the newest one, so the corrected text is exactly what the sheet will show. The
  fix is recorded here, in the shipping log, and in the commit.
- **WHAT WAS RUN.** The page was built from 80.6.8 and 80.6.9 in the session that wrote this, then
  `dev/patch-80610.py` applied over it: one step, then `--check` green (a second run is a no-op), the
  old clause absent and the new sentence present, `dev/check-8069.cjs` still passing every assertion
  including the compile of all inline scripts. The release step rebuilds the OTA bundles to a true
  fixed point - root + `ota/` **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at
  v80.6.10.
