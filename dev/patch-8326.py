#!/usr/bin/env python3
"""SideCut 83.2.6 - the actual artist, and the check happens on its own.

Two things the owner reported:

  "it should do that in the background then notify you about it" - the check ran on a
  six-hour clock that was stamped BEFORE the run, and returned immediately when the pin
  list had not loaded yet. A launch that beat the library therefore wrote "checked just
  now" and did nothing for the next six hours. The stamp is written after a run that
  actually happened, the floor is two hours, and a tick runs while the app is open -
  including in the background - so the phone is told when a drop lands.

  "if the artist name is SUKHA it should just get me songs from the dude named SUKHA in
  the right genre, it should not add anything like SUKHA MANN" - the name test accepted
  any credit that merely STARTED with the pinned name, so every artist called "Sukha
  Something" was treated as Sukha. Names are exact now, and the pinned artist is resolved
  to their own catalog ids (and genre) once, so a namesake in another genre stays out.

--check says whether the tree ALREADY carries the change, which is what the release asks
it before deciding there is nothing to do.

    python3 dev/patch-8326.py            # apply
    python3 dev/patch-8326.py --check    # verify only, writes nothing
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGE = "index.html"
SW = "sw.js"

V = "83.2.6"
OLD = "83.2.5"

ENTRY = """  { version: '%s', date: 'November 10, 2026', title: 'The right artist, and a check that runs on its own', items: [
    'Pinning an artist watches that artist, not a name that starts the same way. A song by a different act whose name merely begins with yours - Sukha Mann beside Sukha - was landing in New releases; names are compared exactly now.',
    'The artist is looked up once and kept: their Apple catalogue id and their genre. Every source is then filtered by that id, so a namesake in another genre stays out, and the rows keep the name you pinned.',
    'The release check runs by itself instead of waiting for a tap: shortly after the app opens, again while it is open (including in the background), and when you come back to it. The six-hour clock used to be written before the check ran, so a launch that beat the library silenced it for the rest of the day.',
    'The list is rebuilt once with the right artist, quietly, so the songs an earlier build filed under the wrong name leave it without the phone announcing a dozen rows.'
  ] },
""" % V

SAME_NEW = """// IS THIS THE SAME ARTIST? The names have to MATCH, whole. 83.2.6 made this exact:
// it used to accept a whole-word prefix, so a pinned "Sukha" treated "Sukha Mann",
// "Sukha Dhal" and every other Sukha as the same person and filed their releases under
// your artist. Two spellings of one name (a leading "The", punctuation, case) still
// match; anything with words added to it is somebody else and is refused.
window.__scSameArtistName = function(a, b){
  var n = function(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, ''); };
  var x = n(a), y = n(b);
  if(!x || !y) return false;
  return x === y;
};
"""

IDENT_NEW = """  function scCreditHas(credit, artist){
    if(!artist) return false;
    var want = String(artist).trim();
    return scCreditNames(credit).some(function(n){
      return window.__scSameArtistName(n, want);
    });
  }
  // 83.2.6 - WHOSE SONGS ARE THESE? A name is not an identity. Two artists can carry
  // one name, and a catalogue search for "Sukha" answers with everything that sounds
  // like it. So the pinned artist is resolved ONCE to the Apple artist ids that carry
  // exactly this name, and to their genres; when the listener's own library says which
  // genre theirs is - the songs they already have by that artist - only that genre's
  // artist is kept. The answer is cached for a fortnight, so a check does not pay for
  // it every time.
  function scIdentNorm(s){
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
  }
  async function scArtistIdentity(name){
    var key = scIdentNorm(name);
    var out = { ids: [], genres: [] };
    if(!key) return out;
    if(!window.__scIdentStore){
      var seed = {};
      try{ seed = JSON.parse(localStorage.getItem('sidecut_artist_ident_v1') || '{}') || {}; }catch(_eSeed){ seed = {}; }
      window.__scIdentStore = seed;
    }
    var store = window.__scIdentStore;
    var hit = store[key];
    if(hit && hit.t && (Date.now() - hit.t) < 14 * 86400000 && hit.ids && hit.ids.length){
      return { ids: hit.ids.slice(), genres: (hit.genres || []).slice() };
    }
    try{
      var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(name) + '&media=music&entity=musicArtist&limit=25';
      var resp = await fetchWithProxy(url, SC_RELEASE_FETCH);
      if(resp && resp.ok){
        var data = await resp.json();
        var rows = [];
        ((data && data.results) || []).forEach(function(r){
          if(!r || !r.artistId) return;
          if(scIdentNorm(r.artistName) !== key) return;      // this name, not this name plus words
          rows.push({ id: String(r.artistId), g: String(r.primaryGenreName || '').toLowerCase().trim() });
        });
        // The library decides between namesakes: the genre of the songs already there.
        var mine = [];
        try{
          for(var i = 0; i < allTracks.length && !mine.length; i++){
            var t = allTracks[i];
            if(!t || scIdentNorm(t.artist) !== key) continue;
            var lg = String(t.genre || '').toLowerCase().trim();
            if(lg) mine.push(lg);
          }
        }catch(_eLib){}
        if(mine.length && rows.length > 1){
          var narrow = rows.filter(function(x){ return x.g && mine.indexOf(x.g) !== -1; });
          if(narrow.length) rows = narrow;
        }
        // Still more than one: the catalogue's own first answer for this exact name.
        if(rows.length > 1) rows = [rows[0]];
        rows.forEach(function(x){
          if(out.ids.indexOf(x.id) === -1) out.ids.push(x.id);
          if(x.g && out.genres.indexOf(x.g) === -1) out.genres.push(x.g);
        });
      }
    }catch(_eId){}
    if(out.ids.length){
      store[key] = { ids: out.ids.slice(), genres: out.genres.slice(), t: Date.now() };
      try{ localStorage.setItem('sidecut_artist_ident_v1', JSON.stringify(store)); }catch(_eSave){}
    }
    return out;
  }
  // Does this catalogue row belong to the artist we resolved? A row with no artist id
  // cannot contradict the name test that already let it through; a row with one has to
  // be that artist's.
  function scResultArtistOk(r, ident){
    if(!r) return false;
    var ids = (ident && ident.ids) || [];
    if(!ids.length) return true;
    if(r.artistId == null) return true;
    return ids.indexOf(String(r.artistId)) !== -1;
  }
  // Read by the release list and by the checks that stand behind this file.
  window.__scArtistIdentity = scArtistIdentity;
  window.__scResultArtistOk = scResultArtistOk;
"""

IDENT_CALL = """    try{
      // 83.2.6 - who this artist IS, before anything is read in their name.
      const ident = await scArtistIdentity(artist);
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=song&limit=200`;"""

SONG_FILTER_OLD = """        results = (data.results || []).filter(r => r && r.trackName &&
          !window.__scJunkTitle(r.trackName) &&
          scCreditHas(r.artistName || '', artist));"""
SONG_FILTER_NEW = """        results = (data.results || []).filter(r => r && r.trackName &&
          !window.__scJunkTitle(r.trackName) &&
          scCreditHas(r.artistName || '', artist) &&
          scResultArtistOk(r, ident));"""

ALB_FILTER_OLD = """            if(!scCreditHas(r.artistName || '', artist)) return;"""
ALB_FILTER_NEW = """            if(!scCreditHas(r.artistName || '', artist)) return;
            if(!scResultArtistOk(r, ident)) return;   // 83.2.6 - another artist with the same name"""

CAT_OLD = """  async function scItunesArtistAlbums(artist){"""
CAT_NEW = """  async function scItunesArtistAlbums(artist, ident){"""

CAT_ID_OLD = """      var artistId = null;
      ((arData && arData.results) || []).forEach(function(r){
        if(artistId || !r || !r.artistName) return;
        if(credited(norm(primaryArtistName(r.artistName)))) artistId = r.artistId;
      });"""
CAT_ID_NEW = """      // 83.2.6 - the identity the release check already resolved wins: it is the id whose
      // name is exactly this artist's, and the one the rest of the run is filtered by.
      var artistId = (ident && ident.ids && ident.ids.length) ? ident.ids[0] : null;
      if(!artistId){
        ((arData && arData.results) || []).forEach(function(r){
          if(artistId || !r || !r.artistName) return;
          if(credited(norm(primaryArtistName(r.artistName)))) artistId = r.artistId;
        });
      }"""

# the run that fills a stored row on its day must belong to the pinned artist too
DELIVER_OLD = """          var _want = String(_d.rel.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          var _match = null;
          ((_data && _data.results) || []).forEach(function(s){
            if(_match || !s || !s.trackName) return;
            if(!window.__scSameArtistName(primaryArtistName(s.artistName || ''), primaryArtistName(_d.artist))) return;"""
DELIVER_NEW = """          var _want = String(_d.rel.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          var _match = null;
          ((_data && _data.results) || []).forEach(function(s){
            if(_match || !s || !s.trackName) return;
            if(!window.__scSameArtistName(primaryArtistName(s.artistName || ''), primaryArtistName(_d.artist))) return;
            if(!scResultArtistOk(s, _d.ident)) return;   // 83.2.6 - a namesake's song is not this drop"""

AUTO_OLD = """  async function scPinnedAutoCheck(){
    try{
      if(!pinnedArtists || !pinnedArtists.length) return;
      if(typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState.active) return;
      let last = 0;
      try{ last = parseInt(localStorage.getItem('sidecut_pinnedAutoAt') || '0', 10) || 0; }catch(_eL){}
      if(Date.now() - last < 6 * 60 * 60 * 1000) return;
      try{ localStorage.setItem('sidecut_pinnedAutoAt', String(Date.now())); }catch(_eS){}
      await checkPinnedArtistReleases();
    }catch(_eAuto){ console.warn('auto pinned check skipped', _eAuto); }
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) scPinnedAutoCheck(); });
  setTimeout(function(){ scPinnedAutoCheck(); }, 75000);"""

AUTO_NEW = """  async function scPinnedAutoCheck(){
    try{
      if(typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState.active) return;
      // 83.2.6 - NO PINS YET IS NOT "NOTHING TO DO". This used to return here, after the
      // caller had already stamped the six-hour clock: a launch that beat the pin list
      // wrote "checked just now" and then every timer for six hours read it and did
      // nothing. It asks again shortly instead.
      if(!pinnedArtists || !pinnedArtists.length){
        if(!window.__scPinRetry){
          window.__scPinRetry = setTimeout(function(){ window.__scPinRetry = 0; scPinnedAutoCheck(); }, 45000);
        }
        return;
      }
      let last = 0;
      try{ last = parseInt(localStorage.getItem('sidecut_pinnedAutoAt') || '0', 10) || 0; }catch(_eL){}
      if(Date.now() - last < 2 * 60 * 60 * 1000) return;   // 83.2.6 - two hours, not six
      await checkPinnedArtistReleases();
      // Written AFTER a run that happened, so a run that never happened cannot look like one.
      try{ localStorage.setItem('sidecut_pinnedAutoAt', String(Date.now())); }catch(_eS){}
    }catch(_eAuto){ console.warn('auto pinned check skipped', _eAuto); }
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) scPinnedAutoCheck(); });
  setTimeout(function(){ scPinnedAutoCheck(); }, 75000);
  // 83.2.6 - WHILE THE APP IS OPEN, INCLUDING IN THE BACKGROUND. A tick every twenty
  // minutes; the two-hour floor above is what decides whether a tick really checks, so a
  // phone in a pocket still finds a drop on its own and says so on the shade.
  setInterval(function(){ scPinnedAutoCheck(); }, 20 * 60 * 1000);"""

RESET_NEW = """  // 83.2.6 - THE LIST IS REBUILT ONCE, WITH THE RIGHT ARTIST. Rows an earlier build
  // stored were matched on the first words of a name, so an artist's list can carry
  // another act's songs, and those rows have no artist id to test. Throwing the snapshot
  // away once and refilling it is the only honest correction - done quietly, so the phone
  // does not announce a dozen rows that should never have been there.
  function scResetReleaseSnapshot(){
    var want = 'release-reset-' + '83.2.6';
    var done = '';
    try{ done = localStorage.getItem('sidecut_releaseReset') || ''; }catch(_eR0){ return false; }
    if(done === want) return false;
    try{ Object.keys(pinnedReleases || {}).forEach(function(k){ pinnedReleases[k] = []; }); }
    catch(_eR1){}
    try{ localStorage.setItem('sidecut_releaseReset', want); }catch(_eR2){}
    return true;
  }
  async function scPinnedAutoCheck(){"""

# the check: reset first, then remember the run, and never announce the rebuild
CHECK_OPEN_OLD = """    pinnedCheckState = { active:true, total:pinnedArtists.length, done:0, newCount:0, finishedAt:0, seen:false };
    let totalNew = 0;
    try{
    renderHomeExportPopup();"""
CHECK_OPEN_NEW = """    pinnedCheckState = { active:true, total:pinnedArtists.length, done:0, newCount:0, finishedAt:0, seen:false };
    let totalNew = 0;
    try{
    // 83.2.6 - one clean list, and a rebuild that says nothing.
    try{
      if(scResetReleaseSnapshot()){
        window.__scQuietRebuild = true;
        try{ await savePinnedArtists(); }catch(_eRq){}
      }
    }catch(_eRs){}
    renderHomeExportPopup();"""

QUIET_OLD = """    try{ renderNewReleases(); }catch(_eRnr){}
    try{ updateNotifBadge(); }catch(_eUnb){}
    const first = found[0];"""
QUIET_NEW = """    try{ renderNewReleases(); }catch(_eRnr){}
    try{ updateNotifBadge(); }catch(_eUnb){}
    // 83.2.6 - the one rebuild after the artist change is silent: the rows were already
    // marked announced above, so nothing is said twice and nothing is said about songs
    // that were never this artist's.
    if(window.__scQuietRebuild){ window.__scQuietRebuild = false; return; }
    const first = found[0];"""

END_OLD = """      try{ scReleaseAlert(_announce); }catch(_eAlert){ console.warn('release alert skipped', _eAlert); }
    }
    renderHomeExportPopup();"""
END_NEW = """      try{ scReleaseAlert(_announce); }catch(_eAlert){ console.warn('release alert skipped', _eAlert); }
    }
    // 83.2.6 - the silent rebuild is over whether or not it found anything to say.
    window.__scQuietRebuild = false;
    renderHomeExportPopup();"""

LIST_OLD = """          out.push(Object.assign({}, rel, { artist: rel.artist || artist }));"""
LIST_NEW = """          // 83.2.6 - the row wears the name that was pinned, never the credit a catalogue
          // printed for somebody with a longer name.
          out.push(Object.assign({}, rel, { artist: artist }));"""


def path(p):
    return os.path.join(ROOT, p)


def read(p):
    return open(path(p), encoding="utf-8").read()


def write(p, s):
    open(path(p), "w", encoding="utf-8").write(s)


def swap(text, old, new, why, count=1):
    got = text.count(old)
    if got != count:
        sys.exit("%s (found %d, expected %d)" % (why, got, count))
    return text.replace(old, new, 1)


def applied():
    return ("const APP_VERSION = '%s';" % V) in read(PAGE) and "window.__scArtistIdentity = scArtistIdentity;" in read(PAGE)


def check():
    page = read(PAGE)
    probes = [
        (("const APP_VERSION = '%s';" % V) in page, "the page does not say %s" % V),
        (("version: '%s'" % V) in page, "the changelog has no %s entry" % V),
        ("window.__scArtistIdentity = scArtistIdentity;" in page, "there is no artist identity"),
        ("function scResultArtistOk(r, ident){" in page, "results are not filtered by artist id"),
        ("scResultArtistOk(r, ident))" in page, "the song pass is not filtered"),
        ("if(!scResultArtistOk(r, ident)) return;" in page, "the album pass is not filtered"),
        ("if(!scResultArtistOk(s, _d.ident)) return;" in page, "the due-drop pass is not filtered"),
        ("try{ _d.ident = await scArtistIdentity(_d.artist); }" in page, "the due-drop pass has no identity"),
        ("var longer = (x + ' ').indexOf(y + ' ')" not in page, "the prefix test is still there"),
        ("if(Date.now() - last < 6 * 60 * 60 * 1000) return;" not in page, "the six-hour clock is still there"),
        ("setInterval(function(){ scPinnedAutoCheck(); }, 20 * 60 * 1000);" in page, "nothing checks while the app is open"),
        ("function scResetReleaseSnapshot(){" in page, "the one rebuild is missing"),
        ("window.__scQuietRebuild = true;" in page, "the rebuild would announce itself"),
        ("window.__scQuietRebuild = false;\n    renderHomeExportPopup();" in page, "the rebuild flag is never cleared"),
        ("{ artist: artist }));" in page, "a row can still wear another credit"),
        ("window.__scIdentStore" in page, "the identity is not cached"),
        (("const APP_VERSION = '%s';" % OLD) not in page, "the page still says %s" % OLD),
    ]
    bad = [why for ok, why in probes if not ok]
    if bad:
        sys.exit("; ".join(bad))
    sw = read(SW)
    if ("sidecut-shell-v%s" % V) not in sw:
        sys.exit("the service-worker cache is not on %s" % V)


def main(argv):
    page = read(PAGE)
    touched = []

    if ("window.__scArtistIdentity = scArtistIdentity;" in page) and (("const APP_VERSION = '%s';" % V) in page):
        check()
        print("already applied - nothing written")
        return

    # ---- 1. a name is a name, not a prefix ---------------------------------
    if "window.__scSameArtistName = function(a, b){\n  var n = function(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };" in page:
        old_fn = page[page.index("window.__scSameArtistName = function(a, b){"):]
        old_fn = old_fn[:old_fn.index("\n};\n") + 3]
        page = page.replace(old_fn, SAME_NEW, 1)
        touched.append("the exact-name test")
    elif "return x === y;" not in page:
        sys.exit("the name test is neither the old one nor the new one")

    # ---- 2. whose songs are they -------------------------------------------
    if "window.__scArtistIdentity = scArtistIdentity;" not in page:
        anchor = """  function scCreditHas(credit, artist){
    if(!artist) return false;
    var want = String(artist).trim();
    return scCreditNames(credit).some(function(n){
      return window.__scSameArtistName(n, want);
    });
  }
"""
        page = swap(page, anchor, IDENT_NEW, "scCreditHas is not where it was expected")
        touched.append("the artist identity")

    if "const ident = await scArtistIdentity(artist);" not in page:
        page = swap(page, "    try{\n      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=song&limit=200`;",
                    IDENT_CALL, "the release check does not start where it was expected")
        page = swap(page, SONG_FILTER_OLD, SONG_FILTER_NEW, "the song filter is not where it was expected")
        page = swap(page, ALB_FILTER_OLD, ALB_FILTER_NEW, "the album filter is not where it was expected")
        touched.append("the id filter on both passes")

    if "async function scItunesArtistAlbums(artist, ident){" not in page:
        page = swap(page, CAT_OLD, CAT_NEW, "scItunesArtistAlbums is not where it was expected")
        page = swap(page, CAT_ID_OLD, CAT_ID_NEW, "its id resolution is not where it was expected")
        page = page.replace("var _catAlbums = await scItunesArtistAlbums(artist);",
                            "var _catAlbums = await scItunesArtistAlbums(artist, ident);", 1)
        touched.append("the catalogue read by the resolved id")

    if "if(!scResultArtistOk(s, _d.ident)) return;" not in page:
        page = swap(page, DELIVER_OLD, DELIVER_NEW, "the due-drop match is not where it was expected")
        page = swap(page, "        var _d = _due[i];\n        _d.rel._deliverTried = _today;",
                    "        var _d = _due[i];\n        _d.rel._deliverTried = _today;\n        try{ _d.ident = await scArtistIdentity(_d.artist); }catch(_eIdn){ _d.ident = { ids: [], genres: [] }; }",
                    "the due-drop identity is not where it was expected")
        touched.append("the due-drop pass")

    # ---- 3. the check runs on its own, and says so --------------------------
    if "setInterval(function(){ scPinnedAutoCheck(); }, 20 * 60 * 1000);" not in page:
        page = swap(page, AUTO_OLD, AUTO_NEW, "the automatic check is not where it was expected")
        if "function scResetReleaseSnapshot(){" not in page:
            page = swap(page, "  async function scPinnedAutoCheck(){", RESET_NEW,
                        "the automatic check is declared more than once")
        touched.append("the automatic check")

    if "window.__scQuietRebuild = true;" not in page:
        page = swap(page, CHECK_OPEN_OLD, CHECK_OPEN_NEW, "the check does not open where it was expected")
        page = swap(page, QUIET_OLD, QUIET_NEW, "the alert does not sit where it was expected")
        page = swap(page, LIST_OLD, LIST_NEW, "the release list does not paint where it was expected")
        page = swap(page, END_OLD, END_NEW, "the end of the check is not where it was expected")
        touched.append("the quiet rebuild")

    # ---- 4. the version and the notes --------------------------------------
    if (("const APP_VERSION = '%s';" % V) not in page):
        page = swap(page, "const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V,
                    "the page does not say %s" % OLD)
        page = swap(page, "{ version: '%s', date:" % OLD, ENTRY + "{ version: '%s', date:" % OLD,
                    "the changelog does not start at %s" % OLD)
        touched.append("APP_VERSION and the changelog")

    check_or_write(page, touched)
    sw = read(SW)
    if ("sidecut-shell-v%s" % V) not in sw:
        m = re.search(r"const CACHE_NAME = 'sidecut-shell-v([0-9.]+)';", sw)
        if not m:
            sys.exit("the service-worker cache name is not where it was expected")
        sw = sw.replace(m.group(0), "const CACHE_NAME = 'sidecut-shell-v%s';" % V, 1)
        write(SW, sw)


def check_or_write(page, touched):
    if "--check" in sys.argv:
        if touched:
            sys.exit("the tree does not carry %s yet (%s)" % (V, ", ".join(touched)))
        print("the tree carries SideCut %s" % V)
        return
    write(PAGE, page)
    print("SideCut %s written to index.html (%s)" % (V, ", ".join(touched)))
    print("next: release.yml rebuilds the OTA bundles from it")


if __name__ == "__main__":
    if "--check" in sys.argv and not (("const APP_VERSION = '%s';" % V) in read(PAGE)):
        sys.exit("the tree does not carry %s yet" % V)
    main(sys.argv)
    if "--check" in sys.argv:
        check()
        print("all checks pass - the tree carries SideCut %s" % V)
