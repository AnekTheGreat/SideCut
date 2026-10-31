# -- 10. leaving the rig hands the sound back --------------------------------
once('the stream gets its sound back on the way out',
     "    $('djModeBackdrop').style.display = 'none';\n"
     "    const pos = deckNow();\n"
     "    const wasRunning = deckEngine.running;\n"
     "    deckStop();\n",
     "    $('djModeBackdrop').style.display = 'none';\n"
     "    const pos = deckNow();\n"
     "    const wasRunning = deckEngine.running;\n"
     "    deckStop();\n"
     "    // 80.7.1 - THE STREAM GETS ITS SOUND BACK. Leaving the deck used to hand the\n"
     "    // playhead to the deck's <audio> and nothing else, so a song the deck had\n"
     "    // taken from the source left silence behind it. It goes back to its own\n"
     "    // element, at the second the platter stopped on.\n"
     "    const _djStreamSong = djStreamTrack;\n"
     "    djStreamTrack = null;\n"
     "    if(_djStreamSong && _djStreamSong.id === djCurrentTrackId){\n"
     "      var _sa = (typeof scStreamAudio === 'function') ? scStreamAudio() : null;\n"
     "      if(_sa){\n"
     "        try{ _sa.currentTime = Math.max(0, Math.min(Number(_sa.duration) || pos, pos)); }catch(_eDjSeek){}\n"
     "        if(wasRunning){ scStreamState.userPaused = false; Promise.resolve(_sa.play()).catch(function(){}); }\n"
     "      }\n"
     "      return;\n"
     "    }\n")

# -- 11. a start is not a pause, and a resumed stream starts where it stopped -
once('starting the stream clears a deliberate pause',
     "  function scStreamStart(u, at){\n"
     "    var a = scStreamAudio();\n"
     "    if(!u) return Promise.resolve(false);\n"
     "    scStreamState.url = u;\n",
     "  function scStreamStart(u, at){\n"
     "    var a = scStreamAudio();\n"
     "    if(!u) return Promise.resolve(false);\n"
     "    // 80.7.1 - a stream that came back after a launch starts at the second it\n"
     "    // stopped on, and a start of any kind is not a deliberate pause.\n"
     "    if(!at && scStreamState.pendingAt){ at = scStreamState.pendingAt; }\n"
     "    scStreamState.userPaused = false;\n"
     "    scStreamState.revives = 0;\n"
     "    scStreamState.url = u;\n")

once('a stream that starts has carried its second over',
     "    return Promise.resolve(a.play()).then(function(){ scStreamSay(''); return true; }).catch(function(){\n",
     "    return Promise.resolve(a.play()).then(function(){ scStreamState.pendingAt = 0; scStreamState.userPaused = false; scStreamSay(''); return true; }).catch(function(){\n")

once('a pause from the app is a deliberate one',
     "    } else {\n"
     "      a.pause();\n"
     "    }\n"
     "  }\n"
     "  // 80.6.19 - THE NEXT SONG KEEPS THE GENRE.",
     "    } else {\n"
     "      // 80.7.1 - the heartbeat revives a stream the phone silenced, never one\n"
     "      // you paused yourself.\n"
     "      scStreamState.userPaused = true;\n"
     "      a.pause();\n"
     "    }\n"
     "  }\n"
     "  // 80.6.19 - THE NEXT SONG KEEPS THE GENRE.")

once('giving the bar up is a deliberate pause',
     "  function scStreamQuiet(){\n"
     "    try{\n"
     "      var a = scStreamState.audio;\n"
     "      if(a && !a.paused) a.pause();\n",
     "  function scStreamQuiet(){\n"
     "    try{\n"
     "      var a = scStreamState.audio;\n"
     "      scStreamState.userPaused = true;\n"
     "      if(a && !a.paused) a.pause();\n")

once('a pause from the phone is a deliberate one',
     "      mediaSetActionHandler('pause', function(){\n"
     "        var a = el();\n"
     "        if(a && !a.paused){ try{ a.pause(); }catch(_ePpa){} }\n",
     "      mediaSetActionHandler('pause', function(){\n"
     "        var a = el();\n"
     "        scStreamState.userPaused = true;\n"
     "        if(a && !a.paused){ try{ a.pause(); }catch(_ePpa){} }\n")

once('a stop from the phone is a deliberate one',
     "      mediaSetActionHandler('stop', function(){\n"
     "        var a = el();\n"
     "        if(!a) return;\n"
     "        try{ a.pause(); a.currentTime = 0; }catch(_ePst){}\n",
     "      mediaSetActionHandler('stop', function(){\n"
     "        var a = el();\n"
     "        if(!a) return;\n"
     "        scStreamState.userPaused = true;\n"
     "        try{ a.pause(); a.currentTime = 0; }catch(_ePst){}\n")

once('playing the remembered song keeps its second',
     "    scStreamState.curId = String(id);\n"
     "    scStreamState.fixes = 0;\n",
     "    scStreamState.curId = String(id);\n"
     "    // 80.7.1 - the song you were on when the app closed starts where it stopped.\n"
     "    if(String(scStreamState.resumeId || '') !== String(id)) scStreamState.pendingAt = 0;\n"
     "    else scStreamState.pendingAt = Math.max(0, Number(scStreamState.resumeAt) || 0);\n"
     "    scStreamState.fixes = 0;\n")

# -- 12. the second is remembered, and the last song comes back --------------
once('every few seconds of a stream is remembered',
     "    }catch(_e){}\n"
     "    scStreamBarSync();\n"
     "    scStreamPhoneTick();\n"
     "  }\n"
     "  function scStreamTime(s){\n",
     "    }catch(_e){}\n"
     "    try{ if(typeof scStreamRemember === 'function') scStreamRemember(); }catch(_eRemTick){}\n"
     "    scStreamBarSync();\n"
     "    scStreamPhoneTick();\n"
     "  }\n"
     "  function scStreamTime(s){\n")

once('the last stream comes back after a launch',
     "      scStreamSave();            // and the id-only shape is retired on the way out\n"
     "      scStreamRender();\n"
     "      scShelfRender();\n",
     "      scStreamSave();            // and the id-only shape is retired on the way out\n"
     "      scStreamRender();\n"
     "      scShelfRender();\n"
     "      if(typeof scStreamRestoreLast === 'function') scStreamRestoreLast();\n")
