"""80.3.5, section 4 - the copy that named two groups that are one row.

Four sentences on the page send the reader to "Settings -> Playback" or
"Settings -> Equalizer" as if they were separate places. There has been no
Playback tab and no Equalizer tab since 70.1.3 (both fold into More), and after
this release there is not even a separate row or group: it is one menu called
"Playback & sound" with everything that makes a sound inside it. A help line that
sends someone to a menu that does not exist is worse than no line.

Imported by dev/patch-8035.py; holds constants only.
"""

COPY_SWAPS = [
    # The feature map's sound line: two destinations, one menu.
    ("""Settings \u2192 <b>Playback</b>. <b>8-band EQ + bass boost:</b> Settings \u2192 <b>Equalizer</b>.""",
     """Settings \u2192 <b>Playback &amp; sound</b>. Everything that makes a sound is in that one menu \u2014 crossfade, gapless, auto-volume, the 8-band EQ, the volume boost and the anti-muffler.""",
     'the feature map (seek style, crossfade, gapless, auto-volume)'),

    # The tutorial summary's "Look" line.
    ("""<b>Playback</b> for crossfade/gapless, <b>Equalizer</b> for 8-band EQ.""",
     """<b>Playback &amp; sound</b> for crossfade, gapless, the 8-band EQ and the volume boost.""",
     'the tutorial summary (Look)'),

    # The tips panel's "Sound" line.
    ("""Settings \u2192 <b>Playback</b> (crossfade, gapless, auto-volume) and Settings \u2192 <b>Equalizer</b> (8 bands and bass boost).""",
     """Settings \u2192 <b>Playback &amp; sound</b> (crossfade, gapless, auto-volume, 8 bands, the volume boost and the anti-muffler).""",
     'the tips panel (Sound)'),

    # The FAQ-ish line about normalization.
    ("""Settings \u2192 More \u2192 Playback has crossfade, gapless mode, and normalization""",
     """Settings \u2192 More \u2192 <b>Playback &amp; sound</b> has crossfade, gapless mode, normalization, the 8-band equalizer, the volume boost and the anti-muffler""",
     'the answer about normalization'),
]
