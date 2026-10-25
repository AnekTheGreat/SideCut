## 80.2.8 ({{STAMP}}): the lyrics follow the voice through slow-then-fast, a change of language and the silence after a line - and the phone's size ladder stops going backwards

- **THE OWNER ASKED FOR TWO THINGS IN ONE UPDATE.** *"add to the same update a fix
  with the lyrics that makes it absolute correct with tempo changes and language
  changes slow then fast breaks after lines everything fix that"*, and, of the Home
  bubble sizes that shipped in 80.2.7, *"fix it"*.
- **THE LYRICS WERE PACED BY ARITHMETIC, NOT BY SINGING.** `scPaceWords` gave every
  word a share of the line's window by syllable weight, at one rate from this line's
  timestamp to the next one's. That is exact only if the singer holds one tempo for the
  whole line. It is wrong for exactly the four cases named: a line sung slow then fast,
  a song that changes language mid-line (syllables per second change, and no weight
  table can know which half is which), a stamp seconds away because the singer stopped
  (the window IS that gap, so the sweep crawled into the silence), and a chorus repeated
  at a different tempo.
- **THE WORDS ARE NOW TIMED BY THE RECORDING.** A sung word is an attack, and the app
  already computes a rising-energy envelope for the track (`scOnsetEnvelope`, 20ms hops,
  used by the auto-alignment). `scWordStartsForWindow` reads that envelope inside the
  line's own window: with at least as many rises as words, the words are the strongest
  attacks in order (two rises closer than 90ms are one word, extras are dropped from the
  weakest, so a consonant cluster or a drum under the voice cannot split a word); with
  fewer rises than words, the words are shared out across the rises that are there. It
  never looks at the words themselves, so it is language-blind, and a rise after a long
  silence is simply the next word.
- **FALLBACK IS THE OLD BEHAVIOUR, EXACTLY.** A window with fewer than two rises (a held
  note, a whisper, a track that is not on the device) returns `null` and the pacer runs
  the syllable share it has always run. A sheet with no timestamps at all never reaches
  the measurement, because there are no windows to measure.
- **MEASURED ONCE, CACHED.** `scWordMeasureKick` decodes the track the first time
  word-by-word or letter-by-letter is switched on for a song, writes
  `lyricWords_<track>` to the meta store, and returns immediately on every later tick -
  including a remembered "no file for this track" record, so a song that cannot be
  measured is not re-scanned twenty times a second.
- **THE PACER READS IT FIRST.** `scMeasuredWordStarts` matches the live line by its own
  timestamp and word count (a sheet edited since the measurement is never paced by the
  old numbers), and the pacer lights the word whose measured window holds the playhead;
  before the first rise nothing is lit, and past the last rise the last word holds, so a
  line cannot walk into the gap behind it. The letter wave rides the same window, so
  letters and words cannot drift apart.
- **THE PHONE'S LADDER.** 80.2.7 made the walk one ascending line, but `@media
  (max-width:480px)` still overrode the full rung to 170px while Roomy stayed 179, so a
  phone drew 158, 179, **170**, 230, 260 - one step backwards in the middle of the
  ladder, on the only screen the chip is used on. The override is gone.
- **VERIFIED, ON THE SHIPPED SOURCE.** Its own harness (not a gate, run in the session
  that wrote it) extracts `scWordStartsForWindow` and `scPaceWords` from `index.html` and
  drives them: slow-then-fast lands on 10.2/11.6/13.0/13.4/13.8/14.2 where the rises are;
  a break (tag 18s away, singing done by 11.2) keeps the last word at 11.2; a held line
  with 2 rises for 5 words stays ordered inside its window; a window with one rise
  returns `null`; the pacer lights 0,1,2,3,3 through a measured slow-then-fast line,
  holds the last word past its rise, lights nothing before the first rise, and still
  falls back to the syllable path when there is no measurement. In headless Chrome at
  390px the ten rungs render 60/84/96/118/146/158/179/200/230/260, strictly ascending,
  with the full rung at its own 200; at 1024px the ladder still ascends
  (60/84/96/140/146/158/179/220/230/260). The page boots with no script error.
- **WHAT ONLY A REAL SONG CAN SHOW.** The decode-and-measure path runs on a local file
  with a timed sheet; the pacer and the reader are verified, and the decode path reuses
  the primitives the auto-alignment has shipped for releases. Open a song with
  word-by-word on, and the first play of it is the one that measures.
