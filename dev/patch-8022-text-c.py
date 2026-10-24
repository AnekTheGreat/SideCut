#!/usr/bin/env python3
"""80.2.2 - the text this release writes into the page, part two.

The changelog head, the selection bar button and wiring, the probe and the writer
messages. Kept apart from part one only so each travels in its own call;
patch-8022.py loads both into one namespace.
"""

CHANGELOG_HEAD = r'''  { version: '80.2.2', date: 'October 24, 2026 \u00b7 3:44 PM EDT', title: 'One song or a whole selection to your phone, and one menu behind both sets of dots', items: [
    'Every song menu has its own save row now: one tap writes that song to your phone as its own file, with its real name and no zip in between.',
    'Select songs with a long press and the selection bar saves every one of them at once, each as its own file, in the order they are listed.',
    'The three dots in the now bar and the three dots on a song row open one and the same menu now, so the same song answers the same way in both places.',
    'Shuffle, Repeat and DJ Mode are a Playback group at the bottom of that menu, so the slim bar still answers all three.',
    'A run shows its progress in a small chip with a bar you can stop, and it names the song it is writing as it goes.',
    'A song with no stored audio says so plainly instead of reporting a failed save after a full progress bar.',
    'In a plain browser the toast names where the file actually went instead of promising a Documents folder the browser cannot write to.',
    'The widget, the player, the lyrics view, the letter covers and the album pill dock are untouched.',
  ],
    details: [
      'The save row is the writer the playlist sheet already had, handed one id: the audio blob this song plays from, written to Documents under its own file name. The selection bar hands it the ids you ticked instead, so a long press plus one tap saves ten songs as ten files.',
      'The now bar had a second menu of its own since 80.0.9 - a shorter list that only the bar knew about. It is gone: both 3-dots call openSongActions for the same song, and the three switches the slim bar hides sit in a Playback group inside that sheet, clicking the very buttons on the bar.',
      'A song whose audio was never stored now says so before the progress chip opens, and a browser save says where the file went rather than calling the browser Downloads folder a Documents folder.',
      'Nothing about the round cloud home, the flight, the bar itself or the lyrics view moved in this release.',
    ],
  },
'''

SELECT_BUTTON = r'''          <button class="icon-btn" id="selectDownloadBtn" title="Download the selected songs to your phone" aria-label="Download the selected songs to your phone"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6zM5 20h14v-2H5v2z"/></svg></button>
'''

SELECT_WIRING = r'''      // 80.2.2 - THE SELECTION, ON THE PHONE. Select many, one tap, each song lands
      // as its own file: no zip to open afterwards, and the selection stays up so
      // the same songs can still be album-ed, tagged or exported.
      $('selectDownloadBtn').addEventListener('click', function(){
        const ids = Array.from(selectedIds);
        if(!ids.length){ toast('Select some songs first.'); return; }
        downloadTracksToDevice(ids, ids.length === 1 ? 'Downloading this song' : 'Downloading ' + ids.length + ' songs');
      });
      $('selectExportBtn').addEventListener('click', exportSelected);
'''

PROBE = r'''    // 80.2.2 - the per-song and per-selection writer, so a gate can prove one song
    // writes one file and a selection writes exactly the rows it holds.
    downloadTracks: (ids, label) => downloadTracksToDevice(ids, label),
'''

WRITER_DOC_OLD = r'''  // "Download to phone" — save every song in the current view (playlist / All
  // Songs / Unsorted) as its own audio file directly on the device. Unlike
  // "Export playlist" this skips the .zip entirely: each track's existing audio
  // blob (the same file that plays in-app) is written straight to the device's
  // Documents folder, keeping its real file name + extension. Works on native
  // (Capacitor Filesystem) and falls back to a per-file <a download> anchor in
  // plain browsers.
'''

WRITER_DOC_NEW = r'''  // "Download to phone" — save the songs you hand it as their own audio files,
  // straight on the device. It started as the playlist sheet's action (a whole
  // playlist / All Songs / Unsorted at once); 80.2.2 gives it one song from its own
  // menu and the multi-select bar's selection too, so it takes any list of ids and
  // a line that says what the run is. Unlike "Export playlist" this skips the
  // .zip entirely: each track's existing audio blob (the same file that plays
  // in-app) is written straight to the device's Documents folder, keeping its real
  // file name and extension. Works on native (Capacitor Filesystem) and falls back
  // to a per-file <a download> anchor in plain browsers.
'''

WRITER_GUARD = r'''    // A song with no stored audio (a row rebuilt from tags, a file the picker
    // never handed over) cannot be written - say so once instead of walking a
    // progress bar that can only end at "0 saved, 1 failed".
    if(!tracks.some(t => t.file)){
      toast(tracks.length === 1
        ? 'This song has no audio file to download.'
        : 'None of those songs have an audio file to download.', 4500);
      return;
    }
'''

WRITER_TAIL_OLD = r'''    chip.close();
    if(skipped){
      toast(`Stopped — saved ${done} of ${tracks.length} songs.`, 4500);
    } else if(failed){
      toast(`Downloaded ${done} song${done===1?'':'s'}, ${failed} failed — they may be missing audio files.`, 4500);
    } else {
      toast(`✓ Saved ${done} song${done===1?'':'s'} to your phone's Documents`, 4000);
    }
'''

WRITER_TAIL_NEW = r'''    chip.close();
    if(skipped){
      toast(`Stopped — saved ${done} of ${tracks.length} songs.`, 4500);
    } else if(failed && !done){
      toast(tracks.length === 1
        ? 'Could not save this song — its audio file could not be written.'
        : 'None of those songs could be saved — their audio files could not be written.', 4500);
    } else if(failed){
      toast(`Saved ${done} song${done===1?'':'s'}, ${failed} failed — they may be missing audio files.`, 4500);
    } else if(nativeOk){
      toast(`✓ Saved ${done} song${done===1?'':'s'} to your phone's Documents`, 4000);
    } else {
      // The browser fallback hands each file to the browser's own downloader, so
      // it lands in Downloads, not the app's Documents folder.
      toast(`✓ Saved ${done} file${done===1?'':'s'}`, 4000);
    }
'''

