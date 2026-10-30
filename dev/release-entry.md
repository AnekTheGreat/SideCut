## 80.6.24 ({{STAMP}}): the patch notes carry their day and their time

- **WHAT THE OWNER SAID.** *"WHAT THE HELL DID YOU SO WOTH THE PACTCH NOTES IT SHOULD BE OCTOBER 30th
  2026 AND THE TIME IN EST"* - and the notes were wrong: twelve releases were stamped with a bare day.
- **THE REPAIR.** Every 80.x changelog entry before 80.6.12 carries the day it landed *and* the Eastern
  time it landed at (`October 29, 2026 · 8:04 PM EDT`): 55 entries from 80.0 on, 230 of the page's
  entries with a literal `·` and 173 with the escaped `\u00b7` - both render the same. The twelve from
  80.6.12 through 80.6.23 were stamped with a bare `2026-10-30`: no clock on it at all, and for nine of
  them the wrong day, because they landed on the *evening of October 29* Eastern and were dated the
  30th. Each of the twelve now carries the Eastern time of its own release commit: 80.6.12 at 8:04 PM,
  80.6.13 at 9:14, 80.6.14 at 9:37, 80.6.15 at 9:46, 80.6.16 at 10:24, 80.6.17 at 10:37, 80.6.18 at
  10:46, 80.6.19 at 10:54, 80.6.20 at 11:10 (all October 29), then 80.6.21 at 7:26 AM, 80.6.22 at
  5:20 PM and 80.6.23 at 6:25 PM on October 30.
- **THE CLOCK IS EASTERN, AND THE LABEL IS EDT.** October 30 is still daylight time in New York - the
  change back to EST is in November - so the label stays `EDT`, the same label as every 80.x entry before
  these. The time shown is Eastern, which is what was asked for; if the letters themselves are wanted as
  `EST`, that is one word in the next payload and every release to follow.
- **NOTHING ELSE MOVED.** No song, list, album, rail or player code is touched: the payload replaces
  twelve `date:` values that are only ever drawn as text on the changelog screen (`entry.date`, at the
  release row - nothing parses it), adds this release's entry, and bumps the version. The change is in
  the notes themselves, which is the point.
- **WHERE IT WENT WRONG.** The nine payloads from 80.6.12 on each wrote `date: '2026-10-30'` by hand
  instead of computing the Eastern stamp at apply time - which is what `eastern()` in this payload does,
  and what `dev/release-record.py` has always done for this file. The verifier now fails a release that
  writes a bare ISO day again: `check-80624.cjs` asserts that no entry is a `YYYY-MM-DD`, that all 55
  entries from 80.0 on carry a day and an Eastern clock, that the twelve repaired stamps and this one run
  forward in time, and that the 361 older entries - written in four other shapes before 57.0 - are not
  touched by the repair.
- **WHAT WAS RUN.** `dev/patch-80624.py` over a fresh clone of the released 80.6.23 page: fourteen steps
  (twelve dates, the version, the entry), a second run a no-op with `--check` 0. `dev/check-80624.cjs`
  passes **28 checks**, including a compile of all seven inline scripts, so the page whose notes changed
  is still the page that boots. OTA rebuilt to a true fixed point - root + `ota/` **{{ROOT}}** bytes at
  v80.6.24, `ota-play/` still HELD (**{{PLAY}}** bytes). **Not claimed:** no browser and no phone here, so
  the changelog screen was not opened on a device; what is verified is the strings the screen draws and
  that the page still parses.
