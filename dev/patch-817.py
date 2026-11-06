#!/usr/bin/env python3
"""81.7 - three faults behind "the converters do not work" and "nothing shows in Streaming".

1. scHttpJson sent "Content-Type: application/json" on plain GETs. In a browser that is no
   longer a simple request: it is preflighted, and the open catalogues answer OPTIONS with
   nothing, so every browser GET came back "Failed to fetch" while the same URL opened in a
   tab. This is why a Streaming search found nothing on a computer.
2. The Streaming search asked the player first even where the page cannot make that request
   (no CORS headers on youtubei). With no native transport it now asks the catalogue that
   can answer.
3. Both converters went player -> googlevideo, and a browser is refused by both. With no
   native transport they now fall back to the open catalogue's own file, which is readable
   from the page (measured: a 206 carrying the bytes).
"""
import io
import sys

PATH = 'index.html'
page = io.open(PATH, encoding='utf-8').read()

if 'scArchiveAudioSource' in page:
    print('81.7 is already applied')
    sys.exit(0)


def sub(old, new, label):
    global page
    found = page.count(old)
    if found != 1:
        sys.exit('%s: expected exactly one match, found %d' % (label, found))
    page = page.replace(old, new, 1)
    print('applied:', label)


sub(
    """    try{
      var r = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: bodyStr });""",
    """    try{
      // 81.7 - NO CONTENT-TYPE WITHOUT A BODY. A GET carrying
      // "Content-Type: application/json" is not a simple request: the browser
      // preflights it and the open catalogue answers OPTIONS with nothing, so every
      // browser GET came back "Failed to fetch" while the same URL opened fine in a
      // new tab. The header belongs only on a request that has a body.
      var pageOpts = (bodyStr != null)
        ? { method: method, headers: { 'Content-Type': 'application/json' }, body: bodyStr }
        : { method: method };
      var r = await fetch(url, pageOpts);""",
    'plain GETs are simple requests again')

sub(
    """    Promise.resolve(scYtSearch(q, '', '')).then(function(items){
      var got = Array.isArray(items) ? items.slice(0, 12) : [];""",
    """    // 81.7 - ASK THE PLAYER ONLY WHERE THE PAGE MAY ASK IT. The search POST has no
    // CORS headers to answer it from a browser, so it could only fail - slowly, in
    // front of the open catalogue that answers in one round trip. With no native
    // transport to make that call, the open catalogue is asked first.
    var _nativeHttp = scNativeHttpAvailable();
    Promise.resolve(_nativeHttp ? scYtSearch(q, '', '') : null).then(function(items){
      var got = Array.isArray(items) ? items.slice(0, 12) : [];""",
    'the Streaming search asks what can answer')

sub(
    """      var audio = await scYtPlayer(videoId);
      if(!isCurrentYtRun() || window.__scCancelDl) return null;
      if(!audio){ _ytFails.push(fmt.toUpperCase() + ': YouTube returned no streams \u2014 the video is unavailable or this network is blocking YouTube'); return null; }""",
    """      var audio = await scYtPlayer(videoId);
      if(!isCurrentYtRun() || window.__scCancelDl) return null;
      // 81.7 - THE CONVERTERS ANSWER IN A BROWSER TOO. Asking the player for a
      // stream is a request this page is not allowed to make, and googlevideo does
      // not answer a fetch from here either, so in the full web build both
      // converters said "no streams" for every link. The open catalogue is readable
      // from the page (measured: a 206 with the bytes), so when the player gives
      // nothing and there is no native transport, the song is looked up there and
      // its own file is what gets converted.
      if(!audio && !scNativeHttpAvailable()){
        var _archQ = (title && title !== 'YouTube video')
          ? (title + ' ' + (typeof ytAuthor === 'string' ? ytAuthor : '')).trim()
          : '';
        if(_archQ) audio = await scArchiveAudioSource(_archQ);
        if(audio && audio.videoTitle && (!title || title === 'YouTube video')) title = audio.videoTitle;
      }
      if(!audio){ _ytFails.push(fmt.toUpperCase() + ': YouTube returned no streams \u2014 the video is unavailable or this network is blocking YouTube'); return null; }""",
    'the converters fall back to a source a page can read')

sub(
    """  async function scFetchDecode(stream, onStatus, onProgress){""",
    """  // 81.7 - IS THERE A NATIVE TRANSPORT BEHIND THIS PAGE? The Android app answers
  // through Capacitor's Http plugin, which is not subject to CORS; a plain browser
  // has nothing but fetch, and fetch is refused by the player and by googlevideo.
  function scNativeHttpAvailable(){
    try{ var H = (typeof __scCapHttp === 'function') ? __scCapHttp() : null; return !!(H && typeof H.request === 'function'); }
    catch(_eNH){ return false; }
  }
  // The open catalogue's own file for a song, in the shape the downloader already
  // understands: a url, a size if the archive states one, and the item's title.
  async function scArchiveAudioSource(query){
    var terms = String(query || '').trim().toLowerCase();
    if(!terms) return null;
    var words = terms.split(/\\s+/).map(function(w){ return w.replace(/[^\\w'-]/g, ''); })
      .filter(function(w){ return w.length > 1; }).slice(0, 6);
    if(!words.length) return null;
    var clause = words.map(function(w){ return '(title:(' + w + ') OR creator:(' + w + '))'; }).join(' AND ');
    var search = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('mediatype:(audio) AND ' + clause)
      + '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=downloads&sort%5B%5D=downloads%20desc&rows=5&page=1&output=json';
    var found = await scHttpJson(search, null);
    var docs = (found && found.response && found.response.docs) || [];
    for(var i = 0; i < docs.length; i++){
      var ident = String((docs[i] && docs[i].identifier) || '').trim();
      if(!ident) continue;
      var md = await scHttpJson('https://archive.org/metadata/' + encodeURIComponent(ident), null);
      var files = (md && md.files) || [];
      var pick = null, fallback = null;
      for(var f = 0; f < files.length; f++){
        var name = String((files[f] && files[f].name) || '');
        if(!name || !/\\.(mp3|m4a|ogg|oga|opus|flac)$/i.test(name)) continue;
        if(!pick && /\\.mp3$/i.test(name)) pick = files[f];
        if(!fallback) fallback = files[f];
        if(pick) break;
      }
      var file = pick || fallback;
      if(!file) continue;
      var url = 'https://archive.org/download/' + encodeURIComponent(ident) + '/'
        + String(file.name).split('/').map(encodeURIComponent).join('/');
      var title = String(Array.isArray(docs[i].title) ? docs[i].title[0] : (docs[i].title || '')).trim();
      var creator = String(Array.isArray(docs[i].creator) ? docs[i].creator.join(', ') : (docs[i].creator || '')).trim();
      return { url: url, size: Number(file.size) || 0, alts: [], muxed: false, videoTitle: title, author: creator };
    }
    return null;
  }
  async function scFetchDecode(stream, onStatus, onProgress){""",
    'the two helpers the fallbacks need')

io.open(PATH, 'w', encoding='utf-8').write(page)
print('81.7 written')
