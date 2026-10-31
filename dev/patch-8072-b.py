# -- 8. the crop sheet accepts a song that has no File -----------------------
once('the crop sheet accepts a streamed song',
     "    if(!t) return;\n"
     "    if(!t.file){\n"
     "      toast('This song has no audio file to crop.');\n"
     "      return;\n"
     "    }\n"
     "    const isMp3 = /\\.(mp3|mpeg)$/i.test((t.file.name || t.name) + '');\n",
     "    if(!t) return;\n"
     "    // 80.7.2 - A SONG PLAYED FROM THE CATALOGUE HAS BYTES TOO. It has no File on\n"
     "    // the device, and that is the only thing this sheet ever asked for, so the\n"
     "    // one feature that edits a song refused every song that was not downloaded.\n"
     "    const cropStream = (!t.file && (t.stream || t.streamId)) ? t : null;\n"
     "    if(!t.file && !cropStream){\n"
     "      toast('This song has no audio file to crop.');\n"
     "      return;\n"
     "    }\n"
     "    const isMp3 = !cropStream && /\\.(mp3|mpeg)$/i.test((t.file.name || t.name) + '');\n")

# -- 9. the bytes come from whatever the stream already holds ---------------
once('the crop reads the stream bytes',
     "    $('cropSongBackdrop').style.display = 'flex';\n"
     "    try{\n"
     "      const arrBuf = await blobToArrayBufferFallbackCrop(t.file);\n"
     "      if(!arrBuf) throw new Error('could not read audio data');\n",
     "    $('cropSongBackdrop').style.display = 'flex';\n"
     "    try{\n"
     "      // 80.7.2 - the same File a download has, read out of the stream's own\n"
     "      // pieces: the object URL it is playing, the read-ahead copy, or a fresh\n"
     "      // read of the source. The sheet never learns the difference.\n"
     "      if(cropStream) $('cropSongLoading').textContent = 'Reading the song\\u2026';\n"
     "      const source = cropStream ? await scStreamCropFile(cropStream) : t.file;\n"
     "      $('cropSongLoading').textContent = 'Decoding audio\\u2026';\n"
     "      const arrBuf = await blobToArrayBufferFallbackCrop(source);\n")

# -- 10. applying a stream crop writes a library song, never the stream row --
once('a stream crop is saved as a library song',
     "  $('cropSongApply').addEventListener('click', async () => {\n"
     "    if(!cropTrack || !cropBuf || !(cropSelEnd - cropSelStart >= 0.5)) return;\n"
     "    cropStopPreview();\n",
     "  $('cropSongApply').addEventListener('click', async () => {\n"
     "    if(!cropTrack || !cropBuf || !(cropSelEnd - cropSelStart >= 0.5)) return;\n"
     "    cropStopPreview();\n"
     "    // 80.7.2 - A CLIP OFF A STREAM IS A NEW SONG. The rest of this handler\n"
     "    // rewrites the file it was handed, and a streamed row is not a file.\n"
     "    if(cropTrack.stream || cropTrack.streamId){\n"
     "      $('cropSongApply').disabled = true;\n"
     "      $('cropSongApply').textContent = 'Encoding\\u2026';\n"
     "      try{ await scCropStreamSave(); }\n"
     "      catch(_eCsErr){ console.warn('Stream crop failed:', _eCsErr);\n"
     "        toast('Crop failed: ' + ((_eCsErr && _eCsErr.message) || 'could not encode the file')); }\n"
     "      finally{ $('cropSongApply').disabled = false; $('cropSongApply').textContent = 'Save cropped song'; }\n"
     "      return;\n"
     "    }\n")

# -- 11. the new save function ---------------------------------------------
once('the stream crop writer',
     "  $('cropSongCancel').addEventListener('click', () => {\n",
     CROP_SAVE + "\n  $('cropSongCancel').addEventListener('click', () => {\n")

# -- 12. the menu entry, so a stream can be cropped at all ------------------
once('the stream menu offers a crop',
     "    acts.push({ label: 'Add to a playlist\\u2026', run: function(){ scStreamToPlaylist(id); } });\n",
     "    // 80.7.2 - the same crop a downloaded song has, on the song that is playing.\n"
     "    if(!isFile){\n"
     "      acts.push({ label: 'Crop a clip from this song\\u2026', run: function(){ scStreamCrop(id); } });\n"
     "    }\n"
     "    acts.push({ label: 'Add to a playlist\\u2026', run: function(){ scStreamToPlaylist(id); } });\n")

once('the stream crop opener',
     "  function scStreamToAlbum(id){\n",
     STREAM_CROP + "\n  function scStreamToAlbum(id){\n")

# -- 12b. the reader that turns a streamed row into a File ------------------
once('the stream crop reader',
     "  function scStreamCrop(id){\n",
     CROP_FILE + "\n  function scStreamCrop(id){\n")
