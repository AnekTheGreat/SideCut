## 80.3.2 ({{STAMP}}): the lyrics fill in letter by letter, the boost sits beside the EQ, Settings is grouped, and a download can go into an album

- **THE OWNER'S ASK, VERBATIM.** *"lyrics is not working letter by letter fix it, and add a
  thing in SideCut in settings and more next to eq a decibal increaser up to like 15. fix
  settings and more to make it more cleaner and organize it better and when downloading song
  in the full version, add an option to add to a specific album or create a new album"*.
- **LETTER BY LETTER HAD TWO FAULTS, AND THE HARNESS SHOWS BOTH ON THE 80.3.1 TREE.** A scratch
  driver (`sc-8032-check.mjs`, lifted out of the session after its work) boots the shipped page
  in jsdom, opens a timed sheet through the real LYRICS button, turns the real chips on and
  walks the playhead across a line. On 80.3.1: **64 frames where a word already sung was not
  fully lit** and **2 frames where the line's total lit-letter count went backwards** - the
  light was wiped off the words behind it on every tick, and the jump to the last word put
  light where nothing had been sung yet. On 80.3.2 the same driver reports **0 and 0**, with
  the current word caught mid-sweep in 56 of 70 frames.
- **FAULT 1 - THE SWEEP SKIPPED WORDS.** `scPaceWords` spread a line's words over the WHOLE
  line window (`wordDurs ... * gap`) and then cut them off at `pace`, the line's natural
  singing length. Every word past that cut had no window at all, and the `litIdx === -1`
  fallback then lit **the last word, complete**. Measured on a plain sheet whose first line
  owned thirteen seconds of the song: word 1 swept, word 2 never lit, word 3 arrived finished -
  which is what "letter by letter is not working" looks like. The words are now spread across
  `pace` itself, so every word has a window inside the stretch the pacer walks.
- **FAULT 2 - THE LIGHT DID NOT STAY.** The 73.4.4 rule wiped every word but the current one on
  every frame, so a line was one word flashing in place with nothing lit between two words.
  Letter mode now **fills the line left to right**: a word the singer has passed keeps every
  letter lit, the sung word sweeps, later words stay dark. The 73.4.4 intent survives - nothing
  is left DIMMED behind the light, no gold travels along the sheet, and the passed words are
  touched only where a letter is not already lit so a finished word never re-runs a transition
  and never flickers. `scLettersWipeOthers` runs **once per line change** (not per tick) so the
  song cannot turn into a wall of gold by the second verse.
- **VOLUME BOOST, 0 TO +15 dB, UNDER THE EQ.** `scBoostGain` is a GainNode on the master: both
  decks' limiters land on it, and it feeds `scBoostGuard` and then the assistant duck's
  `scDuckMaster`, so it multiplies the mixed signal as the last thing before the speakers.
  +15 dB is 10^(15/20) = **5.62x**. A near-flat DynamicsCompressor after it is the soft ceiling
  that keeps a loud master loud instead of crackling - and at 0 dB that compressor is a
  **straight wire** (`ratio 1`, threshold 0), so Off is the same signal the app made before this
  release rather than "nearly". The slider applies on `input` and writes on `change` (one saved
  setting per drag), `boostDb` is restored beside `autoVolume` in the boot restore, and
  `setBoostDb` calls `ensureAudioGraph` first so moving it before anything has played still
  takes effect.
- **SETTINGS -> MORE IS SIX NAMED GROUPS.** Good to know, Sound, Playback, Library, App & data,
  About & updates - every collapsible header carrying `sc-set-head`, every body `sc-set-body`
  and every card `sc-set-card`, styled once in the page's stylesheet instead of four inline
  variants. The three loose buttons that floated between the rollback list and the DJ card (the
  update log, the listening streak and the version guide) are now rows of one **About &
  updates** card with the version label as its first row. Every id the wiring uses is unchanged,
  and the sound section's bare header/body pair (it holds three nested panes) is given the
  card's edges in CSS rather than re-wrapped - the driver asserts the groups are in order, that
  the three buttons share a card, and that headers and bodies carry the shared classes.
- **A DOWNLOAD CAN BE FILED.** A converted single landed in All songs and Unsorted and stayed
  there. `window.__scAlbumPickForTrack(id, label)` opens the **same** `pickUserAlbum` the library
  uses (an album you have, or a new one you name on the spot), and `scArmAddToAlbum` binds the
  card's `+ Album` button after the card is in the document, so a click can only ever file the
  song that was just written. It appears on the two single-song cards (YouTube and Spotify) and
  only when the song really reached the library; a whole-playlist conversion is untouched and
  still files its songs as they land. Driven: the door is published, calling it with a library
  song opens the picker, and calling it with an unknown id says so instead of throwing.
- **VERIFIED ON THE PAGE THAT SHIPS.** `python3 dev/patch-8032.py` then `--check` (0 steps);
  all six inline script blocks parse; the driver passes **21/21** on the patched tree and fails
  **17** on the 80.3.1 tree, including both letter faults. `APP_VERSION 80.3.1 -> 80.3.2`, the
  7-note head entry at `October 27, 2026 · 9:40 AM EDT`, `sw.js` cache
  `sidecut-shell-v80.3.2`, and the OTA bundles are rebuilt to a fixed point by `release.yml` in
  the same commit. Nothing else moved: the player, the library, the albums, the tabs, the home
  widget and the assistant are where 80.3.1 left them.
