# -- 8. the deck remembers which streamed song it is holding -----------------
once('the deck has a place for a streamed song',
     "  let djCurrentTrackId = null; // which track is loaded on the deck — independent of the main playback queue\n",
     "  let djCurrentTrackId = null; // which track is loaded on the deck — independent of the main playback queue\n"
     "  let djStreamTrack = null; // 80.7.1 - the streamed song, when the deck is holding one\n")

once('the deck asks one lookup what is loaded',
     "  function djBrowseIds(){\n"
     "    return djSourceIds || playlists[djSourcePlaylist] || [];\n"
     "  }\n",
     "  function djBrowseIds(){\n"
     "    return djSourceIds || playlists[djSourcePlaylist] || [];\n"
     "  }\n"
     + DJ + "\n")

once('the platter reads the streamed song',
     "  function refreshDjMode(){\n"
     "    const t = allTracks.find(tr => tr.id === djCurrentTrackId);\n"
     "    if(!t) return;\n",
     "  function refreshDjMode(){\n"
     "    // 80.7.1 - the deck can hold a streamed song, which is in neither allTracks\n"
     "    // nor a playlist; djTrackById() is the one lookup that knows both.\n"
     "    const t = djTrackById(djCurrentTrackId);\n"
     "    if(!t) return;\n")

# -- 9. entering the rig from a song that is streaming -----------------------
once('DJ Mode opens on the streamed song',
     "  async function enterDjMode(){\n"
     "    if(queueIndex < 0 || queueIndex >= queue.length){ toast('Play a song first to enter DJ Mode'); return; }\n"
     "    const t = allTracks.find(tr => tr.id === queue[queueIndex]);\n"
     "    if(!t) return;\n",
     "  async function enterDjMode(){\n"
     "    // 80.7.1 - THE DECK TAKES THE STREAM. This asked the deck's queue, so DJ Mode\n"
     "    // on a song playing from the source said \"play a song first\" over that song.\n"
     "    // The streamed song is handed over the way a file is: its bytes are already\n"
     "    // an object URL (that is what the element is playing), which is exactly what\n"
     "    // the deck decodes.\n"
     "    const streamSong = (typeof scStreamSong === 'function') ? scStreamSong() : null;\n"
     "    const t = streamSong || allTracks.find(tr => tr.id === queue[queueIndex]);\n"
     "    if(!t){ toast('Play a song first to enter DJ Mode'); return; }\n")

once('the deck takes the sound from the stream',
     "    const a = activeAudio();\n"
     "    const wasPlaying = !a.paused;\n"
     "    const startFrom = a.currentTime || 0;\n"
     "    a.pause(); // the real <audio> element goes silent — the deck engine owns sound in DJ Mode\n",
     "    const a = activeAudio();\n"
     "    const _sAudio = (typeof scStreamAudio === 'function') ? scStreamAudio() : null;\n"
     "    const wasPlaying = streamSong ? !!(_sAudio && !_sAudio.paused) : !a.paused;\n"
     "    const startFrom = streamSong ? ((_sAudio && _sAudio.currentTime) || 0) : (a.currentTime || 0);\n"
     "    if(streamSong){\n"
     "      if(_sAudio){ try{ _sAudio.pause(); }catch(_eDjSp){} }\n"
     "    } else a.pause(); // the real <audio> element goes silent — the deck engine owns sound in DJ Mode\n")

once('the deck is told which song it holds',
     "    if(djSourceIds && !djSourceIds.length) djSourceIds = null;\n"
     "    djCurrentTrackId = t.id;\n",
     "    if(djSourceIds && !djSourceIds.length) djSourceIds = null;\n"
     "    djStreamTrack = streamSong || null;\n"
     "    djCurrentTrackId = t.id;\n")

once('the stream is decoded for the deck',
     "    try{\n"
     "      await ensureDeckBuffer(t);\n"
     "      deckEngine.startOffset = startFrom;\n"
     "      if(wasPlaying) deckStart(startFrom, playbackSpeedDJ || 1);\n",
     "    try{\n"
     "      // 80.7.1 - the deck decodes bytes. A streamed song already has them as an\n"
     "      // object URL, and falls back to a read of the same source when the URL has\n"
     "      // been handed to the read-ahead cache.\n"
     "      if(streamSong && !streamSong.url){\n"
     "        streamSong.url = djStreamUrl(streamSong);\n"
     "        if(!streamSong.url && scStreamState.url){\n"
     "          streamSong.url = await scStreamReadOnly(scStreamState.url, scStreamState.mime, scStreamState.size);\n"
     "        }\n"
     "        if(!streamSong.url){\n"
     "          djStreamTrack = null;\n"
     "          $('djModeBackdrop').style.display = 'none';\n"
     "          toast('The stream is still reading - try DJ Mode again in a second');\n"
     "          return;\n"
     "        }\n"
     "      }\n"
     "      await ensureDeckBuffer(t);\n"
     "      deckEngine.startOffset = startFrom;\n"
     "      if(wasPlaying) deckStart(startFrom, playbackSpeedDJ || 1);\n")

