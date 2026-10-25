# -*- coding: utf-8 -*-
"""The 80.2.8 changelog entry, kept beside the patch that puts it in the page."""

# The previous release's opening line: the new entry goes directly above it, so the
# array stays `const CHANGELOG = [ <newest>, <next>, ... ]`.
CHANGELOG_ANCHOR = "  { version: '80.2.7', date:"

CHANGELOG_DATE = 'October 25, 2026 ' + chr(0x00B7) + ' 2:50 PM EDT'

CHANGELOG_HEAD = r"""  { version: '80.2.8', date: '%(date)s', title: 'The lyrics follow the voice through tempo changes, language changes and the silence after a line - and every bubble size is bigger than the one before it on a phone', items: [
    'Word-by-word and letter-by-letter highlighting now follows the voice in the recording instead of a fixed rate: a line sung slowly and then quickly, a song that switches language mid-line, and a chorus taken at a different tempo each stay on the word being sung.',
    'A pause after a line no longer drags the highlight through the silence: the last word stays lit until the singing starts again.',
    'The measurement is made once per song from the audio already on your phone, then saved, so the second play costs nothing.',
    'On a phone, the full-size Home bubble was drawn at 170px, shorter than Roomy at 179 - so one tap made the card smaller. It now draws at its own 200 on every width, and the whole ladder is one ascending line on a phone as it already was on a tablet.',
    'A song the app cannot measure - one that is not stored on this device, or a sheet with no timings at all - keeps the syllable-weighted pacing it had, so nothing that worked before breaks.',
    'The player, the widget, the albums, the Now bar and the monochrome covers are untouched.',
  ],
    details: [
      'The pacer spread a line\'s words by syllable weight at one rate across the window between this line\'s timestamp and the next line\'s. That is exact only when the singer holds one tempo for the whole line, which is why a line that starts slow and ends fast was early at the end, why an English half-line after a Hindi one ran behind, and why a line whose next timestamp is four seconds away because the singer stopped kept sweeping into the gap.',
      'The app already measures the track for alignment (scOnsetEnvelope, the rising-energy envelope). A sung word is an attack, so the starts of a line\'s words are read off the recording itself: with at least as many rises as words the words are the strongest attacks in order, and with fewer they are shared out over the rises that are there. Neither depends on tempo or on language, and a rise after a long silence is simply the next word.',
      'A line whose window holds too little singing to place its words - a held note, a whispered line, a track that is not stored on the device - keeps the syllable weighting it has today, and so does a sheet with no timestamps at all.',
      'The measurement runs once per track, the first time word-by-word or letter-by-letter is used on it, and is cached under lyricWords_<track> in the same store the sync nudges use. It is skipped entirely when a measurement for that sheet is already there, and a sheet whose length has changed is measured again rather than paced with numbers taken from another sheet.',
      'The letter wave inside the current word is driven by the same window as the word, so the letters and the words cannot drift apart when a word\'s length comes from a measured rise rather than from a share of the line.',
      'On a phone the stylesheet overrode the full rung to 170px while Roomy stayed 179, so the walk went 158, 179, 170, 230, 260 - one step backwards in the middle of the ladder, on the one screen the chip is used on. The override is gone and the ladder is the stylesheet\'s own numbers on every width.',
    ],
  },
""" % {'date': CHANGELOG_DATE}
