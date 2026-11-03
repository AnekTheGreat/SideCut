#!/usr/bin/env python3
"""81.2 - the album sheet offers your albums, not the tags on your files; and the
version counts the way this app has always counted.

    python3 dev/patch-812.py
    python3 dev/patch-812.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHAT THE OWNER SAID. A photograph of the phone: a sheet headed "All Songs and an album"
listing Bambiha Bole (feat. Sidhu Moose Wala), BATIDAO FUNK, BK Songs, BLUE EYES, Bobby,
Brown Munde - plain alphabetical names, no counts. "THESE ARENT MY ACTUAL ALBUMS DAWG FIX
THIS AND FIX THE VERSIINS THERE ARE NEVER . 11 OR . 12 ECT..."

1. THE LIST WAS TAGS. scStreamDownloadPick's album branch walked allTracks and collected
   String(t.album) - the album TAG on every file, trimmed - and offered that. So the sheet
   showed whatever names other people's files carry: the single a file was cut from, a
   compilation, a playlist burned onto a tag, "BK Songs". Not one of them had to be an
   album, and the albums the owner actually made were not in it at all. This is the bug
   the Albums page fixed for itself long ago - its own comment says cards come from
   userAlbums only, because tag grouping "listed albums the user never created". The
   Add to an album sheet was taught the same lesson in 80.10; this sheet was missed.

   It now reads scStreamDeviceAlbums() - visibleAlbumNames() through scAlbumCardOrder,
   with the count of songs in each, empty albums dropped - which is exactly what the
   80.10 sheet reads. The two sheets offer one list. The write path was already right:
   scStreamKeepIn calls addTracksToAlbum, so the song lands in a real album on the
   Albums page (and a name typed as a new album becomes one there, not in a side store).

2. THE VERSION. Every release in this page's changelog before these two had a one-digit
   count after the first dot: 80.6.x, 80.7.x, 80.8, 80.9. Then came 80.10 and 80.11 -
   the only two-digit ones in the whole history, and the owner is not having them. The
   rule this page already writes down is that a number stops at nine; it said so about
   the third one. It is true of the second one too: 80.9 is followed by 81, a fix on top
   of 81 is 81.1, and this release is 81.2. The two shipped labels are renumbered in the
   changelog to match (80.10 -> 81, 80.11 -> 81.1); nothing on a device reads an old
   changelog label - the updater reads the manifest's version - so the history and the
   code now say the same thing.

WHAT IS NOT TOUCHED. The playlist branch of the same sheet (playlists are playlists, not
other than gaining its song counts; the write path; scStreamSheet; the 80.10
Add to an album sheet. No apostrophes in the notes and none of the words the updater
drops (streaming|streams?\\b|from the source|pinned artist).
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '81.2'
MARKER = '81.2 - THE NAME ON THE ROW IS AN ALBUM OF YOURS'
ANCHOR = "  { version: '81.1',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-812: already on the page, the page is %s' % VERSION)
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
once('the page says 81.2',
     "const APP_VERSION = '80.11';",
     "const APP_VERSION = '81.2';")

# -- 2. the rule that was always true, written down for the second number ----
once('the numbering rule covers the second number',
     "  //   AND THE DATE ROLLS BACK WITH IT.",
     """  //   AND THE SECOND NUMBER STOPS AT NINE TOO, from 81 on. The count after the
  //   first dot is one digit, 0 to 9: 80.9 is followed by 81, a fix on top of 81
  //   is 81.1, and the next one is 81.2 - never 80.10 or 80.11. Those two shipped
  //   that way and are renumbered here to 81 and 81.1. Nothing on a device reads an
  //   old changelog label (the updater compares the manifest's version), so no
  //   install is left behind by the correction.
  //   AND THE DATE ROLLS BACK WITH IT.""")

# -- 3. the album sheet lists albums, not the tags on the files --------------
PICK_OLD = r"""  function scStreamDownloadPick(id, kind){
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
    });"""

PICK_NEW = r"""  // 81.2 - THE NAME ON THE ROW IS AN ALBUM OF YOURS, NOT A TAG ON A FILE.
  // The album branch of this sheet walked allTracks and collected t.album - the tag
  // on each file - so it offered whatever names other people's files happen to
  // carry: the single a file was cut from, a compilation, "BK Songs". Not one of
  // them had to be an album, and the albums the owner made were not in it at all.
  // That is the bug the Albums page fixed for itself long ago (its own note says
  // cards come from userAlbums only, because tag grouping "listed albums the user
  // never created"), and the Add to an album sheet was taught it in 80.10; this
  // sheet was missed. It now reads scStreamDeviceAlbums() - the albums you have,
  // in card order, with the songs each holds, empty ones dropped - which is the very
  // list the 80.10 sheet reads. The write path was already right: scStreamKeepIn
  // calls addTracksToAlbum, so the song joins a real album on the Albums page.
  function scStreamDownloadPick(id, kind){
    var names = [], seen = {}, counts = {};
    if(kind === 'pl'){
      try{
        Object.keys(playlists || {}).forEach(function(n){
          if(!n || n === 'All Songs' || n === 'Unsorted' || seen[n]) return;
          seen[n] = 1; names.push(n);
          // A list that holds nothing is not a place a song can go, so the row
          // says how many it holds and the count is read, not guessed.
          try{ var ids = (playlists || {})[n]; counts[n] = (ids && ids.length) || 0; }catch(_ePickCnt){}
        });
      }catch(_ePickPl){}
      names.sort(function(a, b){ return String(a).toLowerCase() < String(b).toLowerCase() ? -1 : 1; });
    } else {
      try{
        var mine = (typeof scStreamDeviceAlbums === 'function') ? scStreamDeviceAlbums() : [];
        (mine || []).forEach(function(a){
          var n = String((a && a.name) || '').trim();
          if(!n || seen[n]) return;
          seen[n] = 1; names.push(n);
          counts[n] = Number(a && a.n) || 0;
        });
      }catch(_ePickAl){}
    }
    var newLabel = 'New ' + (kind === 'pl' ? 'playlist' : 'album') + '\u2026';
    // Nothing to choose from is not a dead sheet: the one choice names itself.
    if(!names.length) newLabel = (kind === 'pl' ? 'No playlists yet - make the first one' : 'No albums yet - make the first one');
    var acts = [{ label: newLabel, run: function(){
      var n = '';
      try{ n = String(prompt('Name the ' + (kind === 'pl' ? 'playlist' : 'album') + ':', '') || '').trim(); }catch(_ePickNew){ n = ''; }
      if(!n) return;
      scStreamDownload(id, { kind: kind, name: n });
    } }];
    names.slice(0, 40).forEach(function(n){
      var c = Number(counts[n]) || 0;
      var label = c ? (n + ' \u00b7 ' + c + ' song' + (c === 1 ? '' : 's')) : n;
      acts.push({ label: label, run: function(){ scStreamDownload(id, { kind: kind, name: n }); } });
    });"""

once('the album sheet lists your albums', PICK_OLD, PICK_NEW)

# -- 4. the two labels that should never have shipped ------------------------
once('80.10 is 81',
     "  { version: '80.10',",
     "  { version: '81',")
once('its one-line label reads 81',
     "  // 80.10 - THE ALBUM CHOOSER SHOWS THE ALBUMS THAT EXIST.",
     "  // 81 - THE ALBUM CHOOSER SHOWS THE ALBUMS THAT EXIST.")
once('80.11 is 81.1',
     "  { version: '80.11',",
     "  { version: '81.1',")
once('its one-line label reads 81.1',
     "  // 80.11 - THE LAPTOP DESK, AND ANOTHER ROAD INTO THE LIBRARY.",
     "  // 81.1 - THE LAPTOP DESK, AND ANOTHER ROAD INTO THE LIBRARY.")

# -- 5. the changelog entry --------------------------------------------------

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
    "  // 81.2 - YOUR ALBUMS IN THE CHOOSER, AND THE NAME ON THE ROW MEANS SOMETHING.\n"
    "  { version: '81.2', date: '{{STAMP}}', title: 'Your albums, not the tags on your files', items: [\n"
    "    '[FULL] Sending a song to an album now lists the albums you actually made, in the order the Albums page keeps them, with how many songs each one holds - instead of names picked up from the tags on your files.',\n"
    "    '[FULL] No more made-up album names in that list: a tag is not an album, so a single, a compilation or a junk label can no longer appear there, and a song you send this way joins its album on the Albums page.',\n"
    "    '[FULL] The version number counts the way it always has: one digit after the first dot, so 80.9 is followed by 81, then 81.1 and 81.2 - 80.10 and 80.11 are gone from the history.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-812: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-812: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-812: %d steps applied, page is %s' % (len(applied), VERSION))
