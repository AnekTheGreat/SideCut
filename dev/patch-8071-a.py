# -- 1. the release itself ----------------------------------------------------
once('the version moves',
     "  const APP_VERSION = '80.7';",
     "  const APP_VERSION = '80.7.1';")

# -- 2. the bridge, once, where the stream module can see it ------------------
once('the stream answers what is playing',
     '  // --- resolution ------------------------------------------------------------',
     BRIDGE + '  // --- resolution ------------------------------------------------------------')

# -- 3. the lyrics button opens on the streamed song --------------------------
once('the lyrics button asks the stream first',
     "  $('lyricsBtn').addEventListener('click', () => {\n"
     "    if(queueIndex < 0 || queueIndex >= queue.length) {\n"
     "      toast('Play a song first');\n"
     "      return;\n"
     "    }\n"
     "    const t = allTracks.find(tr => tr.id === queue[queueIndex]);\n"
     "    if(t) fetchLyrics(t);\n"
     "  });\n",
     "  $('lyricsBtn').addEventListener('click', () => {\n"
     "    // 80.7.1 - THE STREAM IS A SONG TOO. This asked the deck's queue, so over a\n"
     "    // song playing from the source it said \"Play a song first\". The stream\n"
     "    // answers with its own song, its own length and its own cover.\n"
     "    const st = (typeof scStreamSong === 'function') ? scStreamSong() : null;\n"
     "    if(st){ fetchLyrics(st); return; }\n"
     "    if(queueIndex < 0 || queueIndex >= queue.length) {\n"
     "      toast('Play a song first');\n"
     "      return;\n"
     "    }\n"
     "    const t = allTracks.find(tr => tr.id === queue[queueIndex]);\n"
     "    if(t) fetchLyrics(t);\n"
     "  });\n")

# -- 4. previous and next inside the sheet are the stream's own ---------------
once('the lyrics previous follows the stream',
     "  $('lyricsPrevBtn').addEventListener('click', () => {\n"
     "    const audio = activeAudio();\n",
     "  $('lyricsPrevBtn').addEventListener('click', () => {\n"
     "    // 80.7.1 - on a stream, the sheet's own previous and next are the stream's,\n"
     "    // and the words are re-fetched for the song that actually started.\n"
     "    if(typeof scStreamSong === 'function' && scStreamSong()){\n"
     "      const _sa = scStreamAudio();\n"
     "      if(_sa && (_sa.currentTime || 0) > 3){ try{ _sa.currentTime = 0; }catch(_eLpv){} return; }\n"
     "      scStreamNext(-1);\n"
     "      setTimeout(function(){ var _st = scStreamSong(); if(_st) fetchLyrics(_st); }, 900);\n"
     "      return;\n"
     "    }\n"
     "    const audio = activeAudio();\n")

once('the lyrics next follows the stream',
     "  $('lyricsNextBtn').addEventListener('click', () => {\n"
     "    hardAdvance(1, true);\n",
     "  $('lyricsNextBtn').addEventListener('click', () => {\n"
     "    if(typeof scStreamSong === 'function' && scStreamSong()){\n"
     "      scStreamNext(1);\n"
     "      setTimeout(function(){ var _st = scStreamSong(); if(_st) fetchLyrics(_st); }, 900);\n"
     "      return;\n"
     "    }\n"
     "    hardAdvance(1, true);\n")

# -- 5. the sheet's play button and icon read the element making sound --------
once('the lyrics icon follows the stream',
     "  function syncLyricsPlayPauseIcon(){\n"
     "    const btn = $('lyricsPlayPauseBtn');\n"
     "    if(!btn) return;\n"
     "    const a = activeAudio();\n",
     "  function syncLyricsPlayPauseIcon(){\n"
     "    const btn = $('lyricsPlayPauseBtn');\n"
     "    if(!btn) return;\n"
     "    const a = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();\n")

once('the lyrics play button drives the sound that is playing',
     "  $('lyricsPlayPauseBtn').addEventListener('click', () => {\n"
     "    const a = activeAudio();\n"
     "    if(!a) return;\n"
     "    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});\n"
     "    if(a.paused){ a.play().catch(() => recoverAudio(a, 'lyrics play failed')); }\n"
     "    else { scPauseDeck(); }\n"
     "    syncLyricsPlayPauseIcon();\n"
     "  });\n",
     "  $('lyricsPlayPauseBtn').addEventListener('click', () => {\n"
     "    // 80.7.1 - the button under the words is play and pause for whatever you can\n"
     "    // hear, which on a stream is the stream's own element.\n"
     "    const _onStream = (typeof scStreamSong === 'function') ? !!scStreamSong() : false;\n"
     "    const a = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();\n"
     "    if(!a) return;\n"
     "    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});\n"
     "    if(a.paused){\n"
     "      a.play().catch(() => { if(_onStream){ try{ scStreamRestart(); }catch(_eLpr){} } else recoverAudio(a, 'lyrics play failed'); });\n"
     "    } else if(_onStream){\n"
     "      scStreamState.userPaused = true;\n"
     "      try{ a.pause(); }catch(_eLps){}\n"
     "    } else { scPauseDeck(); }\n"
     "    syncLyricsPlayPauseIcon();\n"
     "  });\n")

# -- 6. the clock the highlight follows ---------------------------------------
once('the lyrics clock follows the stream',
     "      const audio = activeAudio();\n"
     "      if (!audio) return;\n"
     "      // Paused means the clock has stopped, so the highlight and the\n",
     "      const audio = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();\n"
     "      if (!audio) return;\n"
     "      // Paused means the clock has stopped, so the highlight and the\n")

once('a plain sheet is paced by the streamed length',
     "        if(!_sheetDur){\n"
     "          try{\n"
     "            var _qid = (queueIndex >= 0 && queueIndex < queue.length) ? queue[queueIndex] : null;\n",
     "        // 80.7.1 - a streamed song knows its own length, which is what a plain\n"
     "        // sheet is paced against before the element has published one.\n"
     "        if(!_sheetDur){\n"
     "          try{\n"
     "            var _stSong = (typeof scStreamSong === 'function') ? scStreamSong() : null;\n"
     "            var _stDur = _stSong ? Number(_stSong.duration) : 0;\n"
     "            if(_stDur > 0 && isFinite(_stDur)) _sheetDur = _stDur;\n"
     "          }catch(_eStDur){}\n"
     "        }\n"
     "        if(!_sheetDur){\n"
     "          try{\n"
     "            var _qid = (queueIndex >= 0 && queueIndex < queue.length) ? queue[queueIndex] : null;\n")

# -- 7. the words a stream finds are kept on the stream ----------------------
once('the words are written where the song lives',
     "  async function fetchLyrics(track) {\n",
     "  // 80.7.1 - WORDS FOR A STREAM. fetchLyrics() writes what it finds with\n"
     "  // persistTrackMeta(), which writes a LIBRARY record - and a streamed song has\n"
     "  // none, so its words were lost the moment the sheet closed. A streamed song\n"
     "  // keeps its words in the stream's own store, which is the store it came from.\n"
     "  function scLyricsPersist(track){\n"
     "    try{\n"
     "      if(track && track.stream && typeof scStreamLyricsSave === 'function'){\n"
     "        return scStreamLyricsSave(track.streamId || track.id, track.lyrics, track.lyricsSynced);\n"
     "      }\n"
     "      return persistTrackMeta(track);\n"
     "    }catch(_eLp){ return false; }\n"
     "  }\n"
     "  async function fetchLyrics(track) {\n")

once('a found sheet is saved to the stream too',
     '        persistTrackMeta(track);\n',
     '        scLyricsPersist(track);\n')

once('a missing sheet is stamped on the stream too',
     '      try{ persistTrackMeta(track); }catch(_eMissStamp){}\n',
     '      try{ scLyricsPersist(track); }catch(_eMissStamp){}\n')
