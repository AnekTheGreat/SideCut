#!/usr/bin/env python3
"""80.7.9 - a song that only exists as a source can be kept.

    python3 dev/patch-8079.py
    python3 dev/patch-8079.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHY. The catalogue is a list of references - a title, an artist, and the id of the
copy a source hands back. Everything a downloaded song can do, a catalogue song
could not: it could not be cropped until 80.7.2, and it could not be KEPT at all.
The owner asked for it plainly: play a song, keep it, and be asked where it goes.

WHAT THIS ADDS, all of it inside the catalogue module so the Play build is
untouched (SC_STREAM_OK is false there and none of this code is reachable):

  1. scStreamKeepTrack() writes the bytes scStreamCropFile() already reads (the
     copy that is playing, the read-ahead copy, then a fresh read - the whole
     song, not a clip) into the library exactly the way a clip off a stream
     lands: its own id, its own blob, persisted, in All Songs and Unsorted.
     A second ask finds the first copy by downloadedFromStream instead of
     keeping the file twice.
  2. scStreamDownload() routes to the destination - All Songs, All Songs and a
     playlist, All Songs and an album, or a file handed to saveExportFile() -
     and says what happened, including when the source does not answer.
  3. scStreamDownloadSheet() is the ask: four answers, in the app's own words.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.9'
MARKER = '80.7.9 - A SONG THAT ONLY EXISTS AS A SOURCE CAN BE KEPT'
ANCHOR = "  { version: '80.7.8',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8079: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- 1. the version ----------------------------------------------------------
once('the page says 80.7.9',
     "const APP_VERSION = '80.7.8';",
     "const APP_VERSION = '80.7.9';")

# -- 2. the keeper -----------------------------------------------------------
BLOCK = r"""  // 80.7.9 - A SONG THAT ONLY EXISTS AS A SOURCE CAN BE KEPT.
  // scStreamCropFile() already knows how to read a catalogue song's bytes - the copy
  // that is playing, the read-ahead copy for its video id, then a fresh read of the
  // same source - and it hands back the WHOLE song as a File, which is what the crop
  // sheet then slices. This keeps that File instead: it lands in the library the same
  // way a clip off a stream does (own id, own blob, persisted, in All Songs), and the
  // menu asks where it should go, because "on this device" and "in this playlist" are
  // different answers.
  var scKeepBusy = '';

  function scStreamKeptFrom(id){
    var want = String(id || '');
    if(!want) return null;
    try{
      for(var i = 0; i < allTracks.length; i++){
        var t = allTracks[i];
        if(t && String(t.downloadedFromStream || '') === want) return t;
      }
    }catch(_eKeepFind){}
    return null;
  }

  function scStreamKeepTrack(id, file){
    var have = scStreamKeptFrom(id);
    if(have) return have;
    var e = scStreamEntry(id) || {};
    var name = String(e.title || 'Untitled');
    var tid = scNextTrackId();
    var track = {
      id: tid, file: file, name: name, artist: String(e.artist || ''),
      album: e.album || null, url: '', duration: Number(e.dur) || 0,
      genre: e.genre || null, gain: null, artBlob: null,
      artUrl: (typeof scStreamThumb === 'function' ? (scStreamThumb(e) || null) : null),
      watermarkCleaned: false, dateAdded: Date.now(),
      downloadedFromStream: String(id)
    };
    try{ track.url = URL.createObjectURL(file); }catch(_eKeepUrl){ track.url = ''; }
    allTracks.push(track);
    if(!playlists['All Songs']) playlists['All Songs'] = [];
    if(playlists['All Songs'].indexOf(tid) === -1) playlists['All Songs'].push(tid);
    if(!playlists['Unsorted']) playlists['Unsorted'] = [];
    if(playlists['Unsorted'].indexOf(tid) === -1) playlists['Unsorted'].push(tid);
    try{ persistTrackMeta(track); }catch(_eKeepMeta){}
    try{ saveMeta(); }catch(_eKeepSave){}
    try{ readLazyMeta(track); }catch(_eKeepLazy){}
    try{ renderTabs(); }catch(_eKeepTabs){}
    try{ renderList(); }catch(_eKeepList){}
    return track;
  }

  function scStreamKeepIn(dest, track){
    if(!track || !dest) return;
    var name = String(dest.name || '');
    if(!name) return;
    if(dest.kind === 'pl'){
      if(!playlists[name]) playlists[name] = [];
      if(playlists[name].indexOf(track.id) === -1) playlists[name].push(track.id);
      try{ saveMeta(); }catch(_eKeepPl){}
    } else {
      try{ addTracksToAlbum([track.id], name, 'Streaming'); }catch(_eKeepAl){}
    }
    try{ renderList(); }catch(_eKeepRl){}
    try{ renderTabs(); }catch(_eKeepRt){}
  }

  // dest: {kind:'lib'} | {kind:'pl', name} | {kind:'al', name} | {kind:'file'}
  async function scStreamDownload(id, dest){
    var e = scStreamEntry(id);
    if(!e){ scStreamSay('That song is not in Streaming any more'); return; }
    if(scKeepBusy){ scStreamSay('Still keeping the last one - give it a second'); return; }
    dest = dest || { kind: 'lib' };
    var title = String(e.title || 'Untitled');
    var kept = scStreamKeptFrom(id);
    scKeepBusy = String(id);
    try{
      if(dest.kind === 'file'){
        scStreamSay('Reading the song from its source\u2026');
        var out = await scStreamCropFile({ streamId: String(id), name: title, artist: String(e.artist || '') });
        await saveExportFile(out, out.name);
        scStreamSay('Handed \u201c' + title + '\u201d to your device');
        return;
      }
      var track = kept;
      if(!track){
        scStreamSay('Reading the song from its source\u2026');
        var file = await scStreamCropFile({ streamId: String(id), name: title, artist: String(e.artist || '') });
        track = scStreamKeepTrack(id, file);
      }
      if(dest.kind === 'pl' || dest.kind === 'al') scStreamKeepIn(dest, track);
      var where = (dest.kind === 'pl' || dest.kind === 'al')
        ? (' and \u201c' + String(dest.name || '') + '\u201d') : ' to All Songs';
      scStreamSay(kept ? ('Already on your device - added' + where) : ('Kept \u201c' + title + '\u201d' + where));
      try{ if(typeof toast === 'function') toast(kept ? ('Added: ' + String(track.name || title) + where) : ('Saved: ' + String(track.name || title) + where), 2800); }catch(_eKeepToast){}
    }catch(err){
      console.warn('Keep from source failed:', err);
      scStreamSay('Could not keep that song: ' + String((err && err.message) || 'the source did not answer'));
    } finally {
      scKeepBusy = '';
    }
  }

  function scStreamDownloadPick(id, kind){
    var names = [], seen = {};
    if(kind === 'pl'){
      try{
        Object.keys(playlists || {}).forEach(function(n){
          if(!n || n === 'All Songs' || n === 'Unsorted' || seen[n]) return;
          seen[n] = 1; names.push(n);
        });
      }catch(_ePickPl){}
    } else {
      try{
        (allTracks || []).forEach(function(t){
          var a = String((t && t.album) || '').trim();
          if(!a || seen[a]) return;
          seen[a] = 1; names.push(a);
        });
      }catch(_ePickAl){}
    }
    names.sort(function(a, b){ return String(a).toLowerCase() < String(b).toLowerCase() ? -1 : 1; });
    var acts = [{ label: 'New ' + (kind === 'pl' ? 'playlist' : 'album') + '\u2026', run: function(){
      var n = '';
      try{ n = String(prompt('Name the ' + (kind === 'pl' ? 'playlist' : 'album') + ':', '') || '').trim(); }catch(_ePickNew){ n = ''; }
      if(!n) return;
      scStreamDownload(id, { kind: kind, name: n });
    } }];
    names.slice(0, 40).forEach(function(n){
      acts.push({ label: n, run: function(){ scStreamDownload(id, { kind: kind, name: n }); } });
    });
    scStreamSheet(kind === 'pl' ? 'All Songs and a playlist' : 'All Songs and an album', acts);
  }

  // 80.7.9 - THE ASK. Four answers, in the app's own words: the library on its own,
  // the library and a playlist, the library and an album, or the file itself out to
  // the device (which is saveExportFile: Filesystem, then the system share sheet).
  function scStreamDownloadSheet(id){
    var e = scStreamEntry(id);
    if(!e){ scStreamSay('That song is not in Streaming any more'); return; }
    var have = scStreamKeptFrom(id);
    var acts = [
      { label: 'All Songs', run: function(){ scStreamDownload(id, { kind: 'lib' }); } },
      { label: 'All Songs and a playlist\u2026', run: function(){ scStreamDownloadPick(id, 'pl'); } },
      { label: 'All Songs and an album\u2026', run: function(){ scStreamDownloadPick(id, 'al'); } },
      { label: 'Save the file to this device\u2026', run: function(){ scStreamDownload(id, { kind: 'file' }); } }
    ];
    scStreamSheet((have ? 'Already kept: ' : 'Keep \u201c') + String(e.title || 'Song') + (have ? '' : '\u201d'), acts);
  }

  function scStreamMenu(id, where){"""

once('the keeper is inserted before the menu that reaches it',
     '  function scStreamMenu(id, where){',
     BLOCK)

# -- 3. the menu reaches it --------------------------------------------------
once('the song menu offers the keep, next to the crop',
     '    // 80.7.2 - the same crop a downloaded song has, on the song that is playing.',
     "    // 80.7.9 - a song that only exists as a source can be kept on the device.\n"
     "    if(!isFile){\n"
     "      acts.push({ label: 'Download this song\\u2026', run: function(){ scStreamDownloadSheet(id); } });\n"
     "    }\n"
     '    // 80.7.2 - the same crop a downloaded song has, on the song that is playing.')

# -- 4. the changelog -------------------------------------------------------

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
    "  // 80.7.9 - A SONG THAT ONLY EXISTS AS A SOURCE CAN BE KEPT.\n"
    "  { version: '80.7.9', date: '{{STAMP}}', title: 'A song you kept', items: [\n"
    "    '[FULL] A song you are playing can be kept on this phone now, from the same menu that already crops it.',\n"
    "    '[FULL] Keeping it asks where it should go: All Songs, All Songs and a playlist, All Songs and an album, or the file itself out to your device.',\n"
    "    '[FULL] The same song is never kept twice, so asking again just points you at the copy you already have.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8079: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8079: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8079: %d steps applied, page is %s' % (len(applied), VERSION))
