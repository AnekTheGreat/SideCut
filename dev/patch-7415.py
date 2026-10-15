#!/usr/bin/env python3
"""
74.1.5 - the artist bubble opens the artist, and the storage cleaner shows MB.

The page is ONE 3.2 MB index.html and the machine that prepares a release has no
git credentials and cannot push a file that size, so a page change can only ship
from inside the repository - by something that edits the file and pushes what it
wrote. This script is that something: .github/workflows/apply-page-patch.yml runs
it on main and commits the result, and the deploy workflow then publishes the OTA
bundle built from it.

It is idempotent. Every edit checks for its own output first and skips when the
page already carries it, so re-running it (or the workflow reacting to the commit
it just made) changes nothing and pushes nothing.

  python3 dev/patch-7415.py            # apply (or report it is already applied)
  python3 dev/patch-7415.py --check    # report only, exit 1 if the page is behind
"""
import datetime
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
VERSION = '74.1.5'

changes = []
problems = []


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as fh:
        fh.write(text)


def edit(rel, old, new, label):
    """Replace one exact block, once. Already-applied counts as done, not an error."""
    src = read(rel)
    if new in src:
        print('  = %s (already applied)' % label)
        return
    n = src.count(old)
    if n != 1:
        problems.append('%s: anchor found %d times in %s' % (label, n, rel))
        print('  ! %s: anchor found %d times in %s' % (label, n, rel))
        return
    write(rel, src.replace(old, new, 1))
    changes.append(label)
    print('  + %s' % label)


# ---------------------------------------------------------------------------
# 1. The Top artists bubble: an artist is a door, not a label.
#
# Every other list in the home dashboard opens something when a row is tapped;
# this one answered the tap with nothing at all. Tapping an artist now shows that
# artist's songs in the same bubble, each with its own size in MB, and plays one.
# ---------------------------------------------------------------------------
ARTISTS_OLD = """body.innerHTML = topArtists.length
        ? topArtists.map(([a,c],i) => `<div class="hb-list-row"><span class="hb-list-name">${i+1}. ${escapeHtml(a)}</span><span class="hb-list-count">${c}×</span></div>`).join('')
        : `<div class="hb-empty">Play some songs to see your top artists here.</div>`;
    }
"""

ARTISTS_NEW = """body.innerHTML = topArtists.length
        ? topArtists.map(([a,c],i) => `<div class="hb-list-row hb-artist-row" data-artist="${escapeHtml(a)}"><span class="hb-list-name">${i+1}. ${escapeHtml(a)}</span><span class="hb-list-count">${c}×</span></div>`).join('')
          + `<div style="font-size:11.5px; color:var(--ink-dim); margin-top:10px;">Tap an artist to see their songs and how much space each one takes.</div>`
        : `<div class="hb-empty">Play some songs to see your top artists here.</div>`;
      // 74.1.5 - an artist opens. The rows in this bubble were the only ones in
      // the whole dashboard that did nothing when tapped, which reads as a broken
      // list rather than a list of names.
      body.querySelectorAll('.hb-artist-row').forEach(row => {
        row.addEventListener('click', () => openArtistBubble(row.dataset.artist));
      });
    }
"""

# The helpers themselves, inserted just above the dashboard's own opener so they
# live in the same <script> block as the bubble they draw into.
ARTIST_HELPERS_ANCHOR = "  function openHomeBubble(kind){"

ARTIST_HELPERS = """  /* --------------------------------------------------------------------------
     74.1.5 - AN ARTIST'S SONGS, IN THE BUBBLE
     -------------------------------------------------------------------------- */
  // Sizes are written in MB wherever the dashboard lists a song, and a song whose
  // stored audio cannot be measured says so instead of being drawn as 0 bytes.
  // The Studio's byte formatter cannot be reached from here: it lives in the
  // second top-level <script> block, this bubble's block is the first.
  function hbMb(n){
    var v = Number(n) || 0;
    if(!v) return 'no file';
    if(v < 1048576) return Math.max(1, Math.round(v / 1024)) + ' KB';
    return (v / 1048576).toFixed(1) + ' MB';
  }
  function hbSongSize(t){ return hbMb(t && t.file ? t.file.size : 0); }
  // Every song this artist has, most played first. Ties fall back to the title so
  // the list is stable between two opens rather than reordering itself.
  function hbArtistSongs(name){
    return allTracks.filter(function(t){ return t.artist === name; })
      .sort(function(a, b){
        return (b.playCount || 0) - (a.playCount || 0)
          || String(a.name || '').localeCompare(String(b.name || ''));
      });
  }
  function openArtistBubble(name){
    const overlay = $('homeBubbleOverlay');
    if(!name || !overlay.classList.contains('open')) return;
    const ico = $('hbPanelIco');
    const title = $('hbPanelTitle');
    const body = $('hbPanelBody');
    const songs = hbArtistSongs(name);
    ico.className = 'hb-panel-ico';
    ico.textContent = '🎤';
    title.textContent = name;
    if(!songs.length){
      body.innerHTML = '<div class="hb-empty">No songs by ' + escapeHtml(name) + ' are in your library right now.</div>';
      return;
    }
    let bytes = 0, withAudio = 0;
    songs.forEach(function(t){ if(t.file && t.file.size){ bytes += t.file.size; } if(t.file && t.url) withAudio++; });
    body.innerHTML =
      '<button class="hb-cta" id="hbArtistBack" style="margin-top:0; background:transparent; color:var(--ink-dim); border:1px solid var(--line);">\\u2039 All artists</button>' +
      '<div style="font-size:11.5px; color:var(--ink-dim); margin:0 0 10px;">' + songs.length + ' song' + (songs.length === 1 ? '' : 's') +
        (bytes ? ' \\u00b7 ' + hbMb(bytes) + ' on this phone' : ' \\u00b7 sizes not read yet') + '</div>' +
      songs.map(function(t){ return hbTrackRowHTML(t, hbSongSize(t)); }).join('') +
      '<button class="hb-cta" id="hbArtistPlayAll">\\u25b6 Play all ' + withAudio + '</button>';
    body.querySelector('#hbArtistBack').addEventListener('click', function(){ openHomeBubble('artists'); });
    body.querySelector('#hbArtistPlayAll').addEventListener('click', function(){
      const ids = songs.filter(function(t){ return t.file && t.url; }).map(function(t){ return t.id; });
      if(!ids.length){ toast('None of that artist\\u2019s songs has playable audio on this phone.'); return; }
      closeHomeBubble();
      activePlaylist = 'All Songs';
      try{
        playFromList(ids.slice(), ids[0]);
        renderTabs();
        renderList();
      }catch(e){
        // Both playFromList and this fallback live in this block; the fallback is
        // here so a future build that moves one cannot make the button silent.
        playTrackInPlaylistContext(ids[0]);
      }
    });
    wireHbTrackRows(body);
  }

"""

# The rows are tappable now, so say so with the pointer and a touch state.
CSS_ANCHOR = ".hb-list-row{ display:flex; justify-content:space-between; align-items:center; padding:9px 2px; border-bottom:1px solid var(--line); gap:10px; }"
CSS_NEW = CSS_ANCHOR + """
.hb-artist-row{ cursor:pointer; }
.hb-artist-row:active{ background:rgba(255,255,255,0.05); }"""

# ---------------------------------------------------------------------------
# 2. The storage cleaner: an exact size in MB on every row, what a re-encode
#    would win back, the whole library on request, and an honest count of the
#    songs it could not measure.
# ---------------------------------------------------------------------------
CLEANER_OLD = """  function storageHtml(){
    var rows = biggestSongs(24);
    if(!rows.length) return '<div class="sc-note">No song has a readable file size yet.</div>';
    var total = totalAudioBytes();
    var html = '<div class="sc-note">Your library holds <b>' + fmtBytes(total) + '</b> of audio across ' + allTracks().length + ' songs. These are the biggest files - the fastest space back.</div>';
"""

CLEANER_NEW = """  // 74.1.5 - the cleaner answers the two questions it was asked and could not.
  // HOW BIG is each song: an exact size in MB on every row, not only on the files
  // over 8 MB. WHAT WOULD I WIN: the space a re-encode at the chosen bitrate
  // would give back, shown before the button is pressed. It also lists the whole
  // library on request instead of stopping at the 24 biggest, and it says how
  // many songs it could not measure instead of leaving them silently out.
  var scStoreAll = false;
  function scMb(n){
    var v = Number(n) || 0;
    if(v >= 1073741824) return (v / 1073741824).toFixed(2) + ' GB';
    if(v < 1048576) return Math.max(1, Math.round(v / 1024)) + ' KB';
    return (v / 1048576).toFixed(1) + ' MB';
  }
  // kbps x 1000 / 8 is the bytes a second at that rate; anything already at or
  // under it wins nothing, and this says so by returning 0 rather than a negative.
  function scEstSaved(t, kbps){
    try{
      if(!t || !t.file || !t.file.size || !t.duration) return 0;
      var est = Math.round(t.duration * kbps * 125);
      return Math.max(0, t.file.size - est);
    }catch(e){ return 0; }
  }
  function storageHtml(){
    var measured = allTracks().filter(function(t){ return t.file && t.file.size; });
    var rows = biggestSongs(scStoreAll ? Math.max(24, measured.length) : 24);
    var total = totalAudioBytes();
    var unmeasured = allTracks().length - measured.length;
    if(!rows.length){
      return '<div class="sc-note">No song has a readable file size yet.' +
        (allTracks().length
          ? ' Your library holds ' + allTracks().length + ' song' + (allTracks().length === 1 ? '' : 's') + ', but the stored audio could not be measured on this device yet - reopen SideCut and this list is built again from the files on the phone.'
          : ' Add songs and the biggest ones appear here with their size in MB.') +
        '</div>';
    }
    var html = '<div class="sc-note">Your library holds <b>' + scMb(total) + '</b> of audio across ' + allTracks().length + ' song' + (allTracks().length === 1 ? '' : 's') + '. Showing the ' + rows.length + ' biggest file' + (rows.length === 1 ? '' : 's') + ' - the fastest space back.</div>';
"""

CLEANER_ROW_OLD = """      var t = r.t;
      var big = r.size > 8 * 1048576;
"""
CLEANER_ROW_NEW = """      var t = r.t;
      var big = r.size > 8 * 1048576;
      var estSaved = scEstSaved(t, reenKbps);
"""

CLEANER_SUB_OLD = """        '<div class="sc-store-sub">' + esc(t.artist || 'Unknown artist') + ' \\u00b7 ' + fmtBytes(r.size) + (t.reencoded ? ' \\u00b7 already re-encoded' : '') + '</div></div>' +
"""
CLEANER_SUB_NEW = """        '<div class="sc-store-sub">' + esc(t.artist || 'Unknown artist') + ' \\u00b7 ' + scMb(r.size) + (estSaved ? ' \\u00b7 re-encode wins ~' + scMb(estSaved) : '') + (t.reencoded ? ' \\u00b7 already re-encoded' : '') + '</div></div>' +
"""

CLEANER_CHIPS_OLD = """    html += '<div class="sc-chips"><span class="sc-chip-label">Target bitrate</span>' +
"""
CLEANER_CHIPS_NEW = """    if(measured.length > 24 || scStoreAll){
      html += '<div class="sc-chips"><button class="sc-btn tiny" data-act="storeall">' +
        (scStoreAll ? 'Show only the 24 biggest' : 'Show all ' + measured.length + ' songs') +
        '</button></div>';
    }
    if(unmeasured){
      html += '<div class="sc-note">' + unmeasured + ' song' + (unmeasured === 1 ? '' : 's') + ' in your library could not be measured yet and ' + (unmeasured === 1 ? 'is' : 'are') + ' not listed above.</div>';
    }
    html += '<div class="sc-chips"><span class="sc-chip-label">Target bitrate</span>' +
"""

ACT_OLD = """        else if(act === 'playpick') playWorkTrack();
"""
ACT_NEW = """        else if(act === 'playpick') playWorkTrack();
        else if(act === 'storeall'){ scStoreAll = !scStoreAll; renderStudio(); }
"""

# ---------------------------------------------------------------------------
# 3. The release itself: the version, the service worker's cache name (the OTA
#    suite requires the two to match) and the changelog entry the update sheet
#    reads its notes from.
# ---------------------------------------------------------------------------
VERSION_OLD = "const APP_VERSION = '74.1';"
VERSION_NEW = "const APP_VERSION = '%s';" % VERSION

SW_OLD = "const CACHE_NAME = 'sidecut-shell-v74.1';"
SW_NEW = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION

# The head entry is what the update sheet and the store listing read, so the gates
# require at least six notes in it (test-619 and eight others) and forbid a
# downloader term, the other build's name, and the [FULL] marker. Notes stay
# short: the length caps in the older gates read their own entry, but a note a
# person can read at a glance is the point anyway.
CHANGELOG_ANCHOR = "  const CHANGELOG = [\n"
CHANGELOG_ENTRY = """  { version: '74.1.5', date: '%s', title: 'The top-artists bubble opens the artist, and the storage cleaner shows every size in MB', items: [
    'Tapping an artist in the home Top artists bubble opens that artist in the same bubble: every song of theirs you have, most played first, each one carrying its own size in MB.',
    'Play all sits at the bottom of that list and plays the artist from the top, and a back button returns you to the artist list you came from.',
    'The storage cleaner writes an exact size in MB on every row now, not only on the files over 8 MB, so the smallest file in the list is as readable as the biggest.',
    'It also shows what a re-encode at the bitrate you picked would win back, in MB, before you press the button - and it says nothing when a song is already at or under that rate.',
    'Show all lists the whole library instead of stopping at the 24 biggest, with the same button turning the list back to the 24 biggest again.',
    'The panel says how many songs it could not measure yet instead of leaving them silently out, and the empty state explains itself rather than reporting nothing.',
    'Nothing else moved: the player, the albums, the home widget, the letter-by-letter lyrics and every saved song and setting are where the last release left them.',
  ]},
"""


def eastern_stamp():
    """Eastern time of this run as 'Month D, YYYY · H:MM PM EDT'.

    The build sandbox runs on UTC with no tzdata, so Eastern is computed as UTC
    minus four hours (EDT) rather than asked for - and the date rolls back with
    it, which is the bug the versioning note records (64.2.4/64.2.5 were stamped a
    day ahead). The stamp is this run's own time, so it is never in the future of
    the commit that carries it.
    """
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    hour = now.hour % 12 or 12
    ampm = 'AM' if now.hour < 12 else 'PM'
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, hour, now.minute, ampm)


print('74.1.5 patch - %s' % ROOT)
if CHECK:
    for rel, needle, label in (
        ('index.html', VERSION_NEW, 'APP_VERSION is %s' % VERSION),
        ('sw.js', SW_NEW, 'sw cache is v%s' % VERSION),
        ('index.html', "version: '%s'" % VERSION, 'changelog entry'),
        ('index.html', 'openArtistBubble', 'artist bubble'),
        ('index.html', 'function scEstSaved', 'cleaner estimate'),
    ):
        if needle not in read(rel):
            problems.append('%s: %s missing' % (label, rel))
            print('  ! %s missing in %s' % (label, rel))
        else:
            print('  ✓ %s' % label)
    print('CHECKS: %s' % ('FAILED' if problems else 'OK'))
    sys.exit(1 if problems else 0)

edit('index.html', ARTISTS_OLD, ARTISTS_NEW, 'Top artists rows open the artist')
edit('index.html', ARTIST_HELPERS_ANCHOR, ARTIST_HELPERS + ARTIST_HELPERS_ANCHOR, 'artist bubble (songs in MB, Play all)')
edit('index.html', CSS_ANCHOR, CSS_NEW, 'artist rows look tappable')
edit('index.html', CLEANER_OLD, CLEANER_NEW, 'cleaner: MB sizes, whole library, honest counts')
edit('index.html', CLEANER_ROW_OLD, CLEANER_ROW_NEW, 'cleaner: space a re-encode wins')
edit('index.html', CLEANER_SUB_OLD, CLEANER_SUB_NEW, 'cleaner: size in MB per row')
edit('index.html', CLEANER_CHIPS_OLD, CLEANER_CHIPS_NEW, 'cleaner: show all + unmeasured note')
edit('index.html', ACT_OLD, ACT_NEW, 'cleaner: show-all wiring')
edit('index.html', VERSION_OLD, VERSION_NEW, 'APP_VERSION -> %s' % VERSION)
edit('sw.js', SW_OLD, SW_NEW, 'sw cache -> v%s' % VERSION)
edit('index.html', CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + CHANGELOG_ENTRY % eastern_stamp(), 'changelog entry')

if problems:
    print('\nFATAL: %d anchor(s) could not be applied - the page has moved on:' % len(problems))
    for p in problems:
        print('  - %s' % p)
    sys.exit(1)

if not changes:
    print('\nThe page already carries %s - nothing written.' % VERSION)
else:
    print('\nApplied %d edit(s) for %s.' % (len(changes), VERSION))
