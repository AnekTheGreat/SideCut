# The AI button — **built in 74.1.9** (Ask SideCut)

**The ask, in the owner's words:** *"an ai button that I can ask anything with like my songs and it'll do it
like create a new playlist containing these songs that Crossfade with specific DJ mode settings or smth.
like save that idea for later."*

This file is the single source of truth for that idea so it does not get lost, half-built, or rebuilt from
scratch. **It shipped in 74.1.9 as "Ask SideCut".** What was built is section *What shipped* below; the
rest of the file is the design it was built from and stays as the map for the next round.

---

## What the app already has (do not build this twice)

| Piece | Where it is today | What it can do |
| --- | --- | --- |
| In-app assistant chat | Settings → Support (`initAIAssistant`) | Answers questions from a built-in knowledge base; falls back to Gemini when the owner has pasted a key (Settings → Important). |
| Assistant that **acts** | since 70.0 ("the assistant acts instead of only answering") | A handful of commands are executed, not described: crop a range, "make a playlist of my most played songs", switch theme, start karaoke, open the storage cleaner. It reports what it did. |
| Music commands that already exist as functions | Library block + Studio block | `createAlbumFromIds`, `promptAddToPlaylist`'s commit path, `playlists[name]`, crossfade/gapless settings, DJ Mode playlist toggles (`djDisabledPlaylists`), per-playlist sort, the queue. |
| Safety primitives this note depends on | 74.1.9 | `modalConfirm` (in-app confirm — `window.confirm` is swallowed by the Android WebView) and `scDeleteSongs` / `toastWithUndo` (a destructive change can be undone from the toast). |

So the assistant's *brain* and its *place in the app* exist. What does not exist is a **single tap from the
music to the assistant**, and a **declared set of things it may do to the library**.

## What is missing

1. **A way in from the music.** Today the assistant lives three taps deep in Settings → Support. There is
   no button on Home, in the dock, or on a selection bar.
2. **The library as context.** It knows about the app; it does not know that "these songs" means the eleven
   rows the owner just selected, or that "my songs" is `allTracks`.
3. **A declared tool surface.** The 70.0 commands are special cases in a switch. Nothing enumerates
   *create a playlist*, *add these ids*, *set crossfade to 6s*, *turn DJ Mode on for this playlist* as
   callable operations with arguments, so a free-form sentence cannot be composed out of them safely.
4. **A confirmation + undo story for bulk changes.** "Make a playlist of everything I played this week" is
   one sentence and 300 playlist entries. It needs a preview and the same Undo the delete path now has.

## The shape worth building (when it is picked up)

**One button, three entry points, one drawer.**

- A small ✦ button in the dock's quick-action area (or beside the search field on Home), plus an
  "Ask about these N songs" entry on the multi-select bar, plus the existing chat in Settings. All three
  open the same bottom drawer, so there is one assistant to maintain.
- The drawer carries the selection as **context**, never as a hidden assumption: the header says
  "11 songs selected" and tapping it shows which.

**The model proposes a plan; the app executes it.** A reply is not free text that the app parses. It is a
JSON list of calls against a small, fixed tool surface, each with a typed argument list:

```
createPlaylist({ name })
addToPlaylist({ playlist, trackIds })
setPlaylistOrder({ playlist, order: "bpm" | "manual" | "mostPlayed" })
setCrossfade({ seconds })                 // 0-12, the same clamp the app uses
setDjMode({ playlist, on })               // the same per-playlist flag the ⋮ menu writes
createAlbumFromSelection({ name })
```

The drawer renders that list as a sentence the owner can read ("Create playlist *Late Night* · add 11
songs · crossfade 6s · DJ Mode on") with **Do it** and **Cancel**. Do it runs the calls through the same
functions the UI uses, in one `saveMeta()`, so the result is exactly what doing it by hand would produce.
Anything not in that list is refused out loud, which is what keeps a hallucinated "delete my library"
from ever being executable.

**Offline honesty.** The built-in knowledge base keeps working with no key; anything that *acts* on the
library needs either a key or a local model, and the drawer says which one answered. A plan is shown before
it runs, so the offline/online distinction is never a surprise.

## Gates this needs before it may ship

- A driven check that a sentence becomes the right plan (stubbed model), that the plan is rendered before
  it runs, and that Cancel changes nothing.
- A check that every tool maps to the app's existing function and clamps: crossfade stays 0-12s, DJ Mode
  writes `djDisabledPlaylists`, a playlist name collision asks instead of overwriting.
- A check that an unknown tool, or a track id that is not in the library, is refused — never silently
  dropped.
- A check that executing a plan is undoable from the toast it leaves, the same way a delete is.

## What shipped in 74.1.9 (the shape chosen)

- **One button, two places:** a sparkle in the **Home header**, and one on the **multi-select bar** so a
  selection can be acted on directly. Both open the same bottom drawer (`#scAiBackdrop`, `window.SCAI`).
- **The selection is the context**, shown in a chip ("2 songs selected · Aurora, Born To Shine") and never
  assumed silently.
- **A plan, not an execution.** A sentence becomes typed steps (playlist create/append, crossfade,
  DJ-mode switch, or one delegated `window.SCACT` sentence) and **nothing runs until Do it**. Cancel
  leaves the library untouched.
- **Everything goes through the app's own functions:** `__scSetPlaylist`, `__scSetCrossfade`,
  `__scSetDjDisabled`, `__scDropPlaylist` - so the result is exactly what doing it by hand produces.
- **Undo covers the whole plan:** the playlist bodies are restored, a playlist it created is removed, and
  the crossfade and DJ switch go back to their previous values (`toastWithUndo`).
- **Questions are answered from the shipped knowledge base** (`__scAiLookup` → `_aiFuzzyMatch`), with no
  plan and nothing to run. With a Gemini key the Support chat still gives the long-form answer.
- **Proven by** `dev/ai-button-check.cjs` (wired into `dev/gates.sh`): the button, the context, three plan
  steps with no side effects, Cancel, Do it, and Undo - **33 / 0**, five named reds on the page before.

Still open (the next round): choosing tracks *by description* ("everything I played this week"), a typed
model response instead of the small grammar, and per-step editing of a plan before it runs.

## Why it waited

The owner asked for it to be saved, and for the app to be made **nicer to use** first. The work that went
in instead is the friction a thumb hits every day: buttons that said "Deleted" and deleted nothing, system
dialogs where every other ask is in-app, and no way back from a mis-tap.
