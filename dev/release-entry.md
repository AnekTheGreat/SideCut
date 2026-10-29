## 80.6.10 ({{STAMP}}): The streaming note stops naming a build

- **WHAT WAS WRONG.** The 80.6.9 entry's fifth line said where the Streaming block lives, in the words
  *"full builds only"*. The owner's standing instruction is that neither the app nor a release note
  names the full build: a reader is not told which build they are holding. The wording was the only
  fault - the section, the gate and the module are untouched by this release.
- **WHAT CHANGED.** That one item loses its build clause and keeps its point: *a stream uses its own
  player, so a stream that dies cannot touch your queue, widget or downloaded playback*. The entry is
  then re-labelled 80.6.10 rather than a second entry being added, so the update sheet still shows the
  streaming notes - corrected - instead of a note about a note. `dev/patch-80610.py` makes those two
  text swaps, moves `APP_VERSION` to 80.6.10 and the shell cache to `sidecut-shell-v80.6.10`, and
  asserts on the way out that the page carries no build clause in the note and no 80.6.9 entry.
- **WHY THE FIRST ATTEMPT COULD NOT COMMIT.** The release step reads its commit subject out of the page
  (`{ version: '80.6.10', ..., title: ... }`) and the job runs under `set -euo pipefail`, so a page
  with no entry for its own version made the grep fail and the commit step stop before it started.
  Re-labelling the entry gives the release a title and keeps the sheet honest at the same time: one
  entry, one release, corrected words.
- **WHAT WAS RUN.** The page was built from 80.6.8 and 80.6.9 in the session that wrote this, then
  `dev/patch-80610.py` applied over it: one step, `--check` green (a second run is a no-op), the old
  clause absent and the new sentence present, the entry filed under 80.6.10, the release step's own
  title extraction run against the page and returning `Streaming, experimental`, and
  `dev/check-8069.cjs` still passing every assertion including the compile of all inline scripts. The
  release step rebuilds the OTA bundles to a true fixed point - root + `ota/` **{{ROOT}}** bytes,
  `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.10.
