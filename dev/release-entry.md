## 80.7.7 ({{STAMP}}): every screen fits

- **WHAT THE OWNER SAID.** *"WHY DOES SIDECUT LOOK SO BAD ON OTHER DEVICES LIKE A FOLDING PHONE MAKE IT NICE AND ACTUALLY EASY TO
  USE, FLIP, FOLD, ROLL, TRI-FOLD, COMPUTER, TV"* - and, in the same breath, *"PUSH TO BOTH VERSIONS"*.
- **THE FAULT.** The page was laid out for exactly one device: a phone in one hand. There were breakpoints up to 1600px, but all
  they did was move the `max-width` of the four views - the three surfaces that a finger or a remote actually touches were still built
  out of phone numbers. The dock's five pills carried `flex: 1 1 0`, so on a 27-inch monitor Home and the plus sat at opposite
  ends of the desk; a television got 11px labels and a 42px dock at the very bottom edge; the player's disc, its title and its
  controls were phone-sized on every display; and every view's side padding was a fixed number, so the only thing standing between
  a song title and a fold hinge or a notch was the `max(20px, env(safe-area-inset-...))` block that three surfaces used and the
  rest ignored.
- **WHAT LANDED.** One appended stylesheet, `<style id="sc77Fit">`, last in the head so it is the last word on every property it
  sets, and every rule inside a query - the phone layout below 561px is untouched. Nine rungs: an **outer fold / split window**
  rung at 380 and below (the brand subtitle and the player's disc give up their room first, because they are decoration); **fluid
  side padding** from 561 up, written as `max(clamp(...), env(safe-area-inset-...))` so a hinge, a notch and a rounded corner stay
  edges rather than bezels; an **inner fold** rung (568-1023) that gives the song list a measure instead of the full panel; a
  **desktop** rung where the dock's five pills become a centred cluster of at most 176px each instead of spreading across the
  window; a **1440** rung for content and a wider cluster; a **television** rung at 1800x900 (or 2400 wide) where the brand, tabs,
  search, rows, bubbles, player and focus rings all grow together; a **short-and-wide** rung for a landscape phone, a split window
  and a car screen; and a **coarse pointer** rung that gives the tabs, the dock and the header icons a 44px target (the player's own
  buttons only from 420px, where six of them plus the disc and the title still fit). Nothing in it uses `!important` - it wins by
  position - and nothing in it transforms `#actionStrip`, which holds fixed children that a transform would take with it.
- **WHY IT IS SAFE WHERE IT MATTERS.** Every player and bubble size is gated `body:not(.sc80-cloud)`, because the cloud theme
  deliberately scales its own, and the padding rules all keep the display inset as a `max()` floor rather than replacing it.
- **WHAT WAS RUN.** `dev/patch-8077.py` over the released 80.7.6 page: `--check` **1** before, **3 steps** applied, a second run a
  no-op, `--check` **0**. Both channels at a true fixed point, and `dev/channel-hold.json` now says `play: false`, so **Play ships
  this release too** - which also delivers 80.7.6's last-played fix to it, the two releases reaching it in one update. The Play
  build is the same page with one flag injected and no code stripped, so nothing had to be ported. `dev/check-8077.cjs`
  **50 passed, 0 failed** against the landed bytes: it audits the sheet as text (every brace closed, all eight rungs present,
  every side padding measured against the display inset, no `padding-inline` shorthand to dodge that, no `transform`, no
  `!important`), pins that the sheet comes after `sc80Css` and that no stylesheet follows it in the head, checks that the
  viewport still asks for `viewport-fit=cover` (without which no inset is delivered at all) and that the sheet takes text sizing
  back from the platform, re-checks 80.7.6's record and 80.7.5's covers, compiles every inline script, and pins both channels at
  v80.7.7 with the same three notes. Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** There is no browser in this environment, so nobody has looked at the new sheet on a folding phone, a rollable, a
  tri-fold, a monitor or a television. What is proven is that the stylesheet is present, closed, last in the head, gated off the
  theme it would fight, measured against the display insets on every side padding it sets, and shipped in both bundles - the
  layout itself still needs a pair of eyes on the hardware, which is exactly why the rungs are additive and query-scoped.
