## 80.0.4 ({{STAMP}}): the Studio tab is cut the way the Library tab is

- **HOW THIS RELEASE REACHED GITHUB - AND WHY THAT KEEPS COMING UP.** The sandbox that
  cuts a release has **no git write credential**: no `GH_TOKEN` / `GITHUB_TOKEN` / PAT in
  `env`, no `~/.git-credentials`, no `~/.netrc`, no `~/.config/gh/hosts.yml`, `gh auth
  status` says not logged in, `~/.ssh` holds only `known_hosts` (`git@github.com` ->
  *Permission denied (publickey)*), and `git push` fails with *could not read Username
  for 'https://github.com'*. Reads work (`git fetch`, `git ls-remote`); writes do not.
  The credential that does exist is the **connected GitHub app (AnekTheGreat)**: files
  land through its create/update-file call and the workflow starts through its dispatch
  call. 80.0.4 went up that way - `dev/patch-8004.py`, `dev/repin-8004.mjs`, the gate
  block, the store block, this entry and the proof - each verified by blob SHA
  (`git hash-object` before, `content.sha` after), then `release.yml` with
  `version=80.0.4`. **Do not hunt for a token that is not there; use the app.**
- **AND IT IS IN THE REPOSITORY'S MEMORY NOW, NOT JUST IN A CHANGELOG.** Asking the
  same question every session is what the top of `AGENTS.md` is for, and `AGENTS.md` is
  ~860 KB - bigger than any API call can carry - so the note cannot be hand-carried out
  of a sandbox either. `dev/agents-shipping-note.py` holds it, and this release's record
  step runs it: `dev/release-record.py` writes the entry and then the note, in that
  order, so the note lands directly under the title, above the newest entry, and a
  session that reads one screenful of memory finds out that the credential is the app
  connection before it goes looking for a git token. Both halves are idempotent
  (marker-based), and a note that fails to insert is printed and skipped rather than
  failing a release.
- **THE OWNER'S CORRECTION.** "the diagonal for tools and studio should be like the one
  for library and albums except top left to bottom right." 80.0.3 shipped a seam that
  leaned - 60% of the pill's width at the top to 40% at the bottom - which is not the
  Library pill's construction at all. The Library pill has been one straight line from
  corner to corner since 70.0, with a name in each of the two triangles.
- **SO IT IS THE LIBRARY CUT, MIRRORED.** `#studioHalf` is
  `clip-path:polygon(0 0, 0 100%, 100% 100%)` - the lower triangle, its name in the
  bottom left corner - and `#toolsHalf` is `polygon(0 0, 100% 0, 100% 100%)` - the upper
  triangle, its name in the top right one. The seam is one SVG line from `0,0` to
  `100%,100%`: top left to bottom right, exactly the other diagonal from the Library
  tab's `100%,0 -> 0,100%`.
- **TOOLS IS STILL ON THE RIGHT.** The owner asked for that in 80.0.3 and it survives
  the mirror: with this seam the right-hand region is the upper triangle, so Tools owns
  it and Studio owns the lower one. The two names now sit in opposite corners, the way
  Library and Albums do, instead of both on one centre line.
- **ONE TABLE, THREE CONSUMERS.** The seam is written down once, in `SC_DOCK_SPLITS`:
  `studioBtn` becomes `line: (xn, yn) => xn - yn` (the same signed-distance form the
  Library cut uses) and `edge: 0.5`. The hit test that decides which half a finger is
  over, the sliding highlight that lights it and the drawn SVG line all read that one
  entry, so the half a tap lands on, the half that lights and the side of the line that
  is drawn cannot disagree - which is what let this release be a geometry change rather
  than a rewrite.
- **THE GATES MOVED WITH IT, AND ONE OF THEM GOT STRONGER.**
  `dev/revamp-check.cjs` [6] now asserts the line at `0,0 -> 100%,100%`, both clip
  polygons, and that the names sit in opposite corners (bottom left / top start) -
  **106/0**. `dev/album-follow-dock-check.cjs` derives the expected highlight from the
  seam itself, and adds the other side of it: a drift over the pill's top right lights
  the Tools half and opens Studio on Tools - **108/0** (it was 106/0; the new checks are
  the Tools drift). `dev/studio-70-check.cjs`, untouched, still passes **570/0**.
- **NOTHING ELSE.** The bar across the top, the player on the safe area, the bubbles, the
  library, Discover, Studio's tools and the album pill dock are where 80.0.3 left them.
- **THE REPIN.** `dev/repin-8004.mjs`: the live pin moves 80.0.3 -> **80.0.4**, adjacency
  `PREV` moves 80.0.2 -> **80.0.3**, and the release-regex sweep now writes the version
  it is sweeping *to* (80.0.3's copy wrote `.3` on the way out of `.3` and left
  `/^80\.0\.3$/` in the album-follow probe, which its own stale check then caught).
  126 edits across 51 gate files, `--check` clean in 0.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  (third pass) and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1** ("and it no longer fires every
  half hour"), the recorded pre-existing red this repository has carried for months. The
  battery is otherwise green - `dev/gates-report.txt` in the release commit is the full
  list.
