# The new page code for 80.7.2, kept as strings so the step files stay readable.

WIDGET_PUSH = '''
  // 80.7.2 - THE WIDGET AND THE CARD ARE THE PLAYING SONG'S, NOT THE DECK'S.
  // widgetTrackSeq is the native side's high-water mark: a push carrying an older
  // sequence is dropped as stale. Only a downloaded song ever bumped it, so a
  // streamed song went out carrying the last download's number - behind the mark
  // the moment that song had been pushed once - and the widget kept the deck while
  // the stream played. A streamed song is a new sequence, exactly like a new file.
  var scWidgetStreamSeen = '';
  function scStreamWidgetPush(){
    if(!scStreamPhoneOwns()) return false;
    var id = String(scStreamState.curId || '');
    if(String(scWidgetStreamSeen) !== id){
      scWidgetStreamSeen = id;
      try{ widgetTrackSeq++; }catch(_eWsq){}
    }
    var a = scStreamState.audio;
    var playing = !!(a && !a.paused);
    var t = scStreamPhoneTrack();
    try{ widgetTrack = t; widgetPlaying = playing; }catch(_eWt){}
    try{ pushWidgetState(t, playing); }catch(_eWp){}
    return true;
  }
  // The press from outside, answered by the song that is playing. A stream paused
  // out there is started again at the second it stopped on; a stream that was given
  // up is taken back out of the store instead of being reported as nothing to do.
  function scStreamResumeFromPhone(){
    if(!scStreamPhoneOwns()) return false;
    var a = scStreamState.audio;
    if(!a || !a.src){
      if(scStreamState.curId){ try{ scStreamPlay(scStreamState.curId); }catch(_eSrp){ } return true; }
      return false;
    }
    if(!a.paused) return true;
    scStreamState.userPaused = false;
    scStreamState.revives = 0;
    Promise.resolve(a.play()).catch(function(){});
    try{ scStreamPhoneState(); }catch(_eSrp2){}
    return true;
  }
'''

CROP_FILE = '''
  // 80.7.2 - A SONG PLAYED FROM THE CATALOGUE HAS BYTES TO CROP.
  // The crop sheet has always wanted a File. A streamed song has one, in pieces: the
  // object URL it is playing, the read-ahead copy for its video id, or a fresh read
  // of the same source when both are gone. This hands the sheet the same File a
  // download has, so the waveform, the selection and the encoder never have to know
  // where it came from.
  async function scStreamCropFile(t){
    var id = String((t && (t.streamId || t.id)) || '').replace(/^scstream:/, '');
    var entry = scStreamById(id) || {};
    var vid = String(entry.videoId || (t && t.videoId) || '');
    var url = '';
    var fresh = '';
    try{ if(String(scStreamState.curId) === id && scStreamState.blobUrl) url = scStreamState.blobUrl; }catch(_eCf1){}
    if(!url && vid){ try{ var hit = scStreamCacheGet(vid); if(hit && hit.url) url = hit.url; }catch(_eCf2){} }
    if(!url && vid){
      var src = await scStreamResolve(vid);
      if(src) fresh = await scStreamReadOnly(src, scStreamState.mime, 0);
      url = fresh;
    }
    if(!url) throw new Error('the song could not be read from its source');
    try{
      var res = await fetch(url);
      var blob = await res.blob();
      if(!blob || !blob.size) throw new Error('the song came back empty');
      var type = String(blob.type || 'audio/mp4');
      var ext = /webm/i.test(type) ? '.webm' : (/ogg/i.test(type) ? '.ogg' : '.m4a');
      var base = scSafeName(String(entry.title || (t && t.name) || 'stream'));
      return new File([blob], base + ext, { type: type });
    } finally {
      if(fresh){ try{ URL.revokeObjectURL(fresh); }catch(_eCf3){} }
    }
  }
'''

CROP_SAVE = '''
  // 80.7.2 - THE CLIP FROM A STREAMED SONG IS A SONG.
  // The crop sheet rewrites the file it was given, which is right for a download and
  // wrong for a row that is a source URL and nothing else. A clip taken off a stream
  // is written into the library instead: its own id, its own blob, its own record -
  // so it plays, crops again, shares and exports like anything else on the device.
  async function scCropStreamSave(){
    var t = cropTrack;
    if(!t || !cropBuf) return;
    var slice = cropRenderSlice(cropBuf);
    var title = String(t.name || 'Clip');
    var meta = { title: title, artist: String(t.artist || ''), album: t.album || null,
                 year: null, genre: t.genre || null, track: null };
    var usedFmt = 'mp3';
    var newBlob = await scEncodeAudioCooperative(slice, 'mp3', meta, null, true);
    if(!newBlob){ usedFmt = 'wav'; newBlob = await scEncodeAudioCooperative(slice, 'wav', meta, null, true); }
    if(!newBlob) throw new Error('could not encode the cropped audio');
    var name = title + ' (clip)';
    var file = new File([newBlob], scSafeName(name) + (usedFmt === 'mp3' ? '.mp3' : '.wav'),
      { type: newBlob.type || (usedFmt === 'mp3' ? 'audio/mpeg' : 'audio/wav') });
    var id = scNextTrackId();
    var track = {
      id: id, file: file, name: name, artist: String(t.artist || ''),
      album: t.album || null, url: URL.createObjectURL(file), duration: slice.duration,
      genre: t.genre || null, gain: null, artBlob: null, artUrl: t.artUrl || null,
      watermarkCleaned: false, dateAdded: Date.now(),
      croppedFromStream: String(t.streamId || t.id || '')
    };
    allTracks.push(track);
    if(!playlists['All Songs']) playlists['All Songs'] = [];
    if(playlists['All Songs'].indexOf(id) === -1) playlists['All Songs'].push(id);
    if(!playlists['Unsorted']) playlists['Unsorted'] = [];
    if(playlists['Unsorted'].indexOf(id) === -1) playlists['Unsorted'].push(id);
    persistTrackMeta(track);
    saveMeta();
    readLazyMeta(track);
    try{ renderTabs(); }catch(_eCsTab){}
    try{ renderList(); }catch(_eCsList){}
    if(cropEndDrag) cropEndDrag();
    $('cropSongBackdrop').style.display = 'none';
    var note = usedFmt === 'mp3' ? '' : ' - saved as WAV, the MP3 encoder could not be fetched';
    toast('Saved "' + name + '" to your library (' + cropFmtTime(slice.duration) + ')' + note, 3200);
    cropTrack = null; cropBuf = null;
  }
'''

STREAM_CROP = '''
  function scStreamCrop(id){
    var e = scStreamEntry(id);
    if(!e) return;
    var live = (String(scStreamState.curId) === String(id) && typeof scStreamSong === 'function') ? scStreamSong() : null;
    var row = live || {
      id: 'scstream:' + String(id), name: String(e.title || 'Streaming'),
      artist: String(e.artist || ''), album: e.album || null, genre: e.genre || null,
      duration: Number(e.dur) || 0, dur: Number(e.dur) || 0,
      videoId: String(e.videoId || ''), artUrl: scStreamThumb(e)
    };
    if(!row.artUrl && typeof scStreamThumb === 'function') row.artUrl = scStreamThumb(e);
    row.stream = true;
    row.streamId = String(id);
    openCropSongModal(row);
  }
'''
