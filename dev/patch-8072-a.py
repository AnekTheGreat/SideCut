# -- 1. the version ----------------------------------------------------------
once('the page says 80.7.2',
     "const APP_VERSION = '80.7.1';",
     "const APP_VERSION = '80.7.2';")

# -- 2. the stream pushes to the widget with its own sequence ----------------
once('the widget push and the press from outside',
     "    if(now - scStreamPhoneWdAt > 3000){\n"
     "      scStreamPhoneWdAt = now;\n"
     "      try{\n"
     "        var a = scStreamState.audio;\n"
     "        pushWidgetState(scStreamPhoneTrack(), !!(a && !a.paused));\n"
     "      }catch(_ePwd){}\n"
     "    }\n"
     "  }\n",
     "    if(now - scStreamPhoneWdAt > 3000){\n"
     "      scStreamPhoneWdAt = now;\n"
     "      try{ scStreamWidgetPush(); }catch(_ePwd){}\n"
     "    }\n"
     "  }\n"
     + WIDGET_PUSH)

# -- 3. the heartbeat runs for a stream, not only for a downloaded song ------
once('the widget heartbeat follows the stream',
     "    window.__scWidgetHeartbeat = function(){\n"
     "      try{\n"
     "        if(!widgetTrack) return;\n",
     "    window.__scWidgetHeartbeat = function(){\n"
     "      try{\n"
     "        // 80.7.2 - a song that was never on the deck left widgetTrack empty, so\n"
     "        // the heartbeat returned here and the widget sat on SideCut while a\n"
     "        // stream played. The stream is pushed on the same beat as a file.\n"
     "        if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){\n"
     "          try{ scStreamWidgetPush(); }catch(_eWhStream){}\n"
     "          return;\n"
     "        }\n"
     "        if(!widgetTrack) return;\n")

# -- 4. the one-time widget arm does the same --------------------------------
once('the widget arm follows the stream',
     "    window.__scWidgetArm = function(){\n"
     "      if(!widgetTrack) return;\n",
     "    window.__scWidgetArm = function(){\n"
     "      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){\n"
     "        try{ scStreamWidgetPush(); }catch(_eWarm){}\n"
     "        return;\n"
     "      }\n"
     "      if(!widgetTrack) return;\n")

# -- 5. arming the phone does not put the deck's song back on the card -------
once('the boot arm keeps the stream on the card',
     "            var _cur = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; });\n"
     "            if(_cur) mediaSetMetadata(_cur);\n"
     "            var _a = activeAudio();\n"
     "            mediaSetPlaybackState(_a && !_a.paused ? 'playing' : 'paused');\n",
     "            // 80.7.2 - THE CARD BELONGS TO WHAT IS PLAYING. This ran three\n"
     "            // seconds after every launch and handed the phone the deck's song -\n"
     "            // which is exactly the song that is silent while a stream is up.\n"
     "            if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){\n"
     "              try{ scStreamPhoneSync(); }catch(_eArmStream){}\n"
     "            } else {\n"
     "            var _cur = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; });\n"
     "            if(_cur) mediaSetMetadata(_cur);\n"
     "            var _a = activeAudio();\n"
     "            mediaSetPlaybackState(_a && !_a.paused ? 'playing' : 'paused');\n"
     "            }\n")

# -- 6. a play or pause of the stream reaches the widget at once -------------
once('a stream play or pause pushes the widget now',
     "    }catch(_ePs){}\n"
     "    scStreamPhoneTick(true);\n"
     "  }\n",
     "    }catch(_ePs){}\n"
     "    try{ scStreamWidgetPush(); }catch(_ePsW){}\n"
     "    scStreamPhoneTick(true);\n"
     "  }\n")

# -- 7. the press that opens the app resumes the stream ----------------------
once('the restore press asks the stream first',
     "  function scResumeRestoredSong(){\n"
     "    try{\n"
     "      if(queueIndex < 0 || queueIndex >= queue.length) return false;\n",
     "  function scResumeRestoredSong(){\n"
     "    try{\n"
     "      // 80.7.2 - the press from the widget, the lock screen or the now bar\n"
     "      // resumes the song that is actually on the bar, streamed or not.\n"
     "      if(typeof scStreamResumeFromPhone === 'function' && scStreamResumeFromPhone()) return true;\n"
     "      if(queueIndex < 0 || queueIndex >= queue.length) return false;\n")
