# -- 13. outside the app: the heartbeat listens to the sound that is playing ---
once('the heartbeat listens to whichever player is making sound',
     "      if(document.hidden && (!activeAudio() || activeAudio().paused)) return;\n"
     "      const a = activeAudio();\n"
     "      if(!a) return;\n",
     "      // 80.7.1 - THE HEARTBEAT LISTENS TO WHICHEVER PLAYER IS MAKING SOUND. It\n"
     "      // watched the deck's element only, so a backgrounded stream read as \"nothing\n"
     "      // playing\" and the one thing that keeps a page alive out there stopped\n"
     "      // running for the song that was actually playing.\n"
     "      const listen = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();\n"
     "      if(document.hidden && (!listen || listen.paused)) return;\n"
     "      const a = activeAudio();\n"
     "      if(!a) return;\n")

once('a stream the phone silenced is started again',
     "      // While we are away the notification must not claim a song is playing that\n"
     "      // Android has already silenced: the element still says `paused === false`\n"
     "      // once the WebView is frozen, so the playhead is the only honest witness.\n"
     "      const bgDead = !userPaused && !playbackSurvivedBackground();\n"
     "      if(bgDead) mediaSetPlaybackState('paused');\n",
     "      // 80.7.1 - THE STREAM IS REVIVED THE SAME WAY. A backgrounded page is\n"
     "      // silenced exactly like any other element; a stream that is paused without\n"
     "      // ever being asked to pause is the phone reclaiming it, not the owner, so it\n"
     "      // starts again from the second it stopped on. A pause you made is left\n"
     "      // alone, and the attempts are counted so a dead source is not hammered.\n"
     "      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){\n"
     "        const sa = scStreamState.audio;\n"
     "        if(sa && sa.paused && !scStreamState.userPaused && !audioFocusInterrupted && !scInCall()){\n"
     "          scStreamState.revives = (Number(scStreamState.revives) || 0) + 1;\n"
     "          if(scStreamState.revives <= 20){\n"
     "            Promise.resolve(sa.play()).catch(function(){\n"
     "              var hit = null;\n"
     "              try{ hit = scStreamCacheGet((scStreamById(scStreamState.curId) || {}).videoId); }catch(_eSrv){}\n"
     "              if(hit && hit.url){ try{ scStreamStart(hit.url, Number(sa.currentTime) || 0); }catch(_eSrv2){} }\n"
     "            });\n"
     "          }\n"
     "        }\n"
     "        try{ scStreamPhoneTick(true); }catch(_eStTick){}\n"
     "      }\n"
     "      // While we are away the notification must not claim a song is playing that\n"
     "      // Android has already silenced: the element still says `paused === false`\n"
     "      // once the WebView is frozen, so the playhead is the only honest witness.\n"
     "      const bgDead = (typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns())\n"
     "        ? false : (!userPaused && !playbackSurvivedBackground());\n"
     "      if(bgDead) mediaSetPlaybackState('paused');\n")

# -- 14. the changelog -------------------------------------------------------
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
    "  // 80.7.1 - THE STREAM IS A SONG OUTSIDE THE APP. The lyrics sheet and DJ\n"
    "  // Mode answered only out of the deck's queue, so on a song playing from the\n"
    "  // source both of them said \"play a song first\" over a song that could be\n"
    "  // heard; the background heartbeat watched the deck's element, so a stream in\n"
    "  // the background read as silence and nothing kept it alive. The stream answers\n"
    "  // for itself now, and the song and the second are remembered.\n"
    "  { version: '80.7.1', date: '{{STAMP}}', title: 'Lyrics, DJ Mode and background play for a streaming song', items: [\n"
    "    'Lyrics open on a streaming song. The sheet is fed the song that is playing, the highlight and the play button follow the stream element instead of the paused deck, and the words are kept on the streamed song so a second open costs no request.',\n"
    "    'DJ Mode takes a streaming song. The deck decodes the same bytes the stream is playing, so the platter, pitch, loops, hot cues and pads all work on it, and leaving DJ Mode hands the sound back to the stream at the second it stopped on.',\n"
    "    'A stream keeps playing with the app in the background, and a song the phone silenced out there starts again where it stopped instead of dying. Closing the app remembers the song and the second, so the bar comes back on it and play carries on from there.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)
