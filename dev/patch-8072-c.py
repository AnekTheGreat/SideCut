# -- 13. the changelog -------------------------------------------------------
def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.7.2 - THE PHONE FOLLOWS THE SONG THAT IS PLAYING.\n"
    "  // The notification, the lock-screen buttons and the home-screen widget were\n"
    "  // fed by the deck, and widgetTrackSeq - the number the native side keeps as its\n"
    "  // high-water mark - was only ever bumped by a downloaded song, so a song played\n"
    "  // from the catalogue went out behind that mark and the widget kept the deck\n"
    "  // while it played. The widget and the card now carry whichever player is\n"
    "  // making sound, the press from outside resumes it, and a clip can be cropped\n"
    "  // off it into the library.\n"
    "  { version: '80.7.2', date: '{{STAMP}}', title: 'The notification, the widget and Crop follow a song played from the catalogue', items: [\n"
    "    'The notification, the lock-screen buttons and the home-screen widget follow a song played straight from the catalogue, and every press there - play, pause, next, previous, the 30-second jumps and the seek bar - reaches that song instead of the download player behind it.',\n"
    "    'Crop works on a song played straight from the catalogue: hold it in its list, pick Crop a clip, drag the two ends and the part you keep is saved to your library as a song you can play, crop again, share and export.',\n"
    "    'A song paused straight from the catalogue is picked back up by the widget at the second it stopped on, that same song comes back on the bar after the app is closed, and leaving the lock screen alone no longer hands the card to a download that is not playing.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)
