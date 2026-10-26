#!/usr/bin/env python3
"""80.2.10 - a new release is announced once, and the count is the list you can see.

The owner, after a string of releases:

  "why does the new releases keep showing the new release every single friken day
   after the release came out I only need to see it once and it says +4 other
   releases when there is only 1 release in total fix this crap dude"

TWO THINGS, ONE CAUSE. fetchArtistReleases stores a one-track release under the SONG's
name (every catalog files it as "<Song> - Single", and the wrapper is dropped), but the
catalog pass keyed it on the CATALOG's name. The key it had just written never matched on
the next pass, so on every check - boot, the six-hour check, a return to the app - the
same single came back as a brand-new find:

  - it was stored a second time (a copy per check, for months);
  - totalNew > 0, so scReleaseAlert fired every time;
  - the alert counted the raw finds, capped at five and aggregated across artists, so
    one artist's single could be announced as "is out (+4 more)" while the panel - which
    de-duplicates by title and day, and stops at a month - showed one row.

So: the catalog pass keys on the stored name (both spellings, so rows an older build
wrote are recognised), the announcement is taken from the same de-duplicated month-long
list every New-releases surface paints, and each announced drop is marked as announced
and never announced again. The stored list collapses its own duplicates on load, and the
bell reads that same list instead of every row at any age.

Idempotent: the marker is the announcement block's own banner comment.

    python3 dev/patch-80210.py
    python3 dev/patch-80210.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.10'
OLD_VERSION = '80.2.8'
MARKER = '  // \u2500\u2500\u2500 80.2.10 - A DROP IS ANNOUNCED ONCE'
TEXT = os.path.join(ROOT, 'dev', 'patch-80210-text.py')

# ---- 0. A STORED ROW ANSWERS TO BOTH NAMES A ONE-TRACK RELEASE HAS ------------
OLD_PREV_KEYS = """      prev.forEach(pr => { const pk = (pr.title||'').toLowerCase().trim() + '|' + (pr.date||''); prevKeys.add(pk); prevKeys.add('alb:' + pk); });
"""

NEW_PREV_KEYS = """      prev.forEach(pr => {
        const pk = (pr.title||'').toLowerCase().trim() + '|' + (pr.date||'');
        prevKeys.add(pk); prevKeys.add('alb:' + pk);
        // 80.2.10 - AND UNDER THE OTHER NAME THE SAME DROP IS FILED UNDER. A one-track
        // release is stored as "Song" here and offered as "Song - Single" by every
        // catalog, so a row written under either name has to answer to both - otherwise
        // the passes below read their own stored row as a brand-new find, add a copy of
        // it, and announce it again on the next check.
        const flat = String(window.__scSingleTitle(pr.title) || '').toLowerCase().trim() + '|' + (pr.date||'');
        if(flat !== pk){ prevKeys.add(flat); prevKeys.add('alb:' + flat); }
      });
"""

# ---- 1. THE CATALOG PASS KEYS THE DROP BY THE NAME IT IS STORED UNDER ---------
OLD_CAT_KEYS = """          var _cDate = (r.releaseDate || '').slice(0, 10);
          var _ck = 'alb:' + r.collectionName.toLowerCase().trim() + '|' + _cDate;
          if(prevKeys.has(_ck)) return;
          if(freshTitles.has(r.collectionName.toLowerCase().trim() + '|' + _cDate)) return;
          for(var _fi = 0; _fi < fresh.length; _fi++){
            var _fe = fresh[_fi];
            if(_fe && String(_fe.title || '').toLowerCase().trim() === r.collectionName.toLowerCase().trim() && String(_fe.date || '').slice(0, 10) === _cDate) return;
          }
"""

NEW_CAT_KEYS = """          var _cDate = (r.releaseDate || '').slice(0, 10);
          // 80.2.10 - THE KEY IS THE NAME THE ROW IS STORED UNDER. A one-track release
          // is stored under the SONG's name ("Song"), because every catalog files it as
          // "Song - Single" and the wrapper is dropped from the title. This pass keyed
          // it on the CATALOG's name, so the row it had just written never matched on
          // the next run: the same single came back as a brand-new find on every check,
          // was stored a second time, and announced itself again the next day. Both
          // spellings are checked, so a row an older build stored under either name is
          // recognised as the drop it already is.
          var _cOne = (r.trackCount || 0) === 1;
          var _cTitle = _cOne ? window.__scSingleTitle(r.collectionName) : r.collectionName;
          var _cKeyTitle = String(_cTitle || '').toLowerCase().trim();
          var _cRawTitle = String(r.collectionName || '').toLowerCase().trim();
          if(prevKeys.has('alb:' + _cKeyTitle + '|' + _cDate)) return;
          if(_cRawTitle !== _cKeyTitle && prevKeys.has('alb:' + _cRawTitle + '|' + _cDate)) return;
          if(freshTitles.has(_cKeyTitle + '|' + _cDate)) return;
          if(freshTitles.has(_cRawTitle + '|' + _cDate)) return;
          for(var _fi = 0; _fi < fresh.length; _fi++){
            var _fe = fresh[_fi];
            if(!_fe || String(_fe.date || '').slice(0, 10) !== _cDate) continue;
            var _feTitle = String(_fe.title || '').toLowerCase().trim();
            if(_feTitle === _cKeyTitle || _feTitle === _cRawTitle) return;
          }
"""

OLD_CAT_TITLE = """          fresh.push({
            title: _oneTrack ? window.__scSingleTitle(r.collectionName) : r.collectionName,
"""
NEW_CAT_TITLE = """          fresh.push({
            title: _cTitle,
"""

OLD_CAT_NOTE = """          freshTitles.add(r.collectionName.toLowerCase().trim() + '|' + _cDate);
          prevKeys.add(_ck);
"""
NEW_CAT_NOTE = """          freshTitles.add(_cKeyTitle + '|' + _cDate);
          if(_cRawTitle !== _cKeyTitle) freshTitles.add(_cRawTitle + '|' + _cDate);
          prevKeys.add('alb:' + _cKeyTitle + '|' + _cDate);
"""

# ---- 2. ONE ROW PER DROP, AND ONE ANNOUNCEMENT -----------------------------
ANNOUNCE_BLOCK = r'''  // ─── 80.2.10 - A DROP IS ANNOUNCED ONCE ─────────────────────────────────────
  // The alert used to fire whenever a catalog pass returned anything "fresh", and count
  // those raw finds: a drop already in the list that arrived under a second name counted
  // again, an album from years back that a first pin pulled in counted, and every one of
  // them counted again on the next check - which is how a phone announced the same
  // release every day, "+4 more" of the one release the panel showed.
  //
  // The announcement is now taken from the SAME de-duplicated, month-bounded list every
  // New-releases surface paints: one row per drop, nothing already read, nothing already
  // announced, nothing still on the way. Each announced row is marked `alerted` and
  // saved, so no boot, check or return to the app can announce it a second time.
  function scReleaseKey(r){
    // The wrapper a one-track release wears is not part of the drop: "Song" and
    // "Song - Single" are one row, or the copies an older build made never meet.
    var flat = r && r.title;
    try{ flat = window.__scSingleTitle(flat) || flat; }catch(_eFlat){}
    return scNormRelTitle(flat) + '|' + (window.__scDay10(r && r.date) || '');
  }
  // The drops this check may announce, newest first - the panel's own list, filtered.
  function scReleaseAnnouncements(){
    var out = [];
    try{
      window.__scReleaseList(31).forEach(function(r){
        if(!r || !r.title) return;
        if(r.seen || r.alerted) return;                       // read, or said already
        if(!r.date) return;                                   // nothing says it is out
        if(window.__scUpcomingDay(r.date)) return;            // still on the way
        if(window.__scJunkTitle && window.__scJunkTitle(r.title)) return;
        out.push(r);
      });
    }catch(_eAnn){}
    return out;
  }
  // Mark every stored copy of an announced drop, so the mark survives the next load.
  function scMarkReleaseAlerted(rel){
    var want = scReleaseKey(rel);
    Object.keys(pinnedReleases || {}).forEach(function(artist){
      (pinnedReleases[artist] || []).forEach(function(r){
        if(r && scReleaseKey(r) === want) r.alerted = true;
      });
    });
  }
  // Same normalised title and same day is the same drop. Earlier builds stored a copy of
  // a single on every check (the key mismatch above), and each copy arrived unseen - so
  // the list is collapsed here, keeping what a later copy brought and marking the row
  // read or announced if ANY copy was. Returns how many copies left.
  function scCollapseReleaseDuplicates(map){
    if(!map || typeof map !== 'object') return 0;
    var dropped = 0;
    Object.keys(map).forEach(function(artist){
      var list = map[artist];
      if(!Array.isArray(list) || list.length < 2) return;
      var byKey = {}, out = [];
      list.forEach(function(rel){
        if(!rel || !rel.title){ dropped++; return; }
        var k = scReleaseKey(rel);
        var kept = byKey[k];
        if(!kept){ byKey[k] = rel; out.push(rel); return; }
        dropped++;
        if(rel.seen) kept.seen = true;
        if(rel.alerted) kept.alerted = true;
        if(rel.upSeen) kept.upSeen = true;
        if(!kept.art && rel.art) kept.art = rel.art;
        if(!kept.url && rel.url) kept.url = rel.url;
        if(!kept.previewUrl && rel.previewUrl) kept.previewUrl = rel.previewUrl;
        if(!kept.cid && rel.cid) kept.cid = rel.cid;
        if(!kept.kind && rel.kind) kept.kind = rel.kind;
        if(!kept.time && rel.time) kept.time = rel.time;
      });
      if(out.length !== list.length) map[artist] = out;
    });
    return dropped;
  }
'''

# ---- 3. THE BELL READS THAT SAME LIST, NOT EVERY ROW AT ANY AGE --------------
OLD_LANDED = """  function hasLandedUnseenReleases(){
    try{
      if(!pinnedReleases) return false;
      return Object.keys(pinnedReleases).some(function(artist){
        return (pinnedReleases[artist] || []).some(function(r){
          if(!r || r.seen) return false;                             // already read
          if(!r.title || !r.date) return false;                      // nothing to announce
          if(r.date && window.__scUpcomingDay(r.date)) return false; // still on the way
          if(window.__scJunkTitle && window.__scJunkTitle(r.title)) return false; // remixes
          return true;
        });
      });
    }catch(_eLand){ return false; }
  }
"""

NEW_LANDED = """  function hasLandedUnseenReleases(){
    try{
      if(!pinnedReleases) return false;
      // 80.2.10 - the SAME list the panel paints: one row per drop, a month deep. It used
      // to scan every stored row at any age, so a drop too old for the panel to show -
      // and the copies earlier builds made of it - kept the bell lit for ever.
      return window.__scReleaseList(31).some(function(r){
        if(!r || r.seen) return false;                             // already read
        if(!r.title || !r.date) return false;                      // nothing to announce
        if(r.date && window.__scUpcomingDay(r.date)) return false; // still on the way
        if(window.__scJunkTitle && window.__scJunkTitle(r.title)) return false; // remixes
        return true;
      });
    }catch(_eLand){ return false; }
  }
"""

# ---- 4. THE ALERT MARKS WHAT IT SAID, AND COUNTS WHAT IT SHOWS ---------------
OLD_ALERT = """  function scReleaseAlert(found){
    if(!found || !found.length) return;
    const first = found[0];
    const more = found.length > 1 ? ' (+' + (found.length - 1) + ' more)' : '';
    const head = 'New release — ' + first.artist;
    const line = '\"' + (first.title || 'New release') + '\" is out' + more + '.';
"""

NEW_ALERT = """  function scReleaseAlert(found){
    if(!found || !found.length) return;
    // 80.2.10 - SAID ONCE. Every drop handed in here is marked announced before it is
    // said, so no later boot, check or return to the app can announce it again - and the
    // count is the number of DISTINCT drops in the same list the panel paints, never the
    // copies of one release a catalog named twice.
    try{ found.forEach(function(r){ scMarkReleaseAlerted(r); }); }catch(_eMk){}
    try{ const _sv = savePinnedArtists(); if(_sv && _sv.catch) _sv.catch(function(){}); }catch(_eSvp){}
    try{ renderNewReleases(); }catch(_eRnr){}
    try{ updateNotifBadge(); }catch(_eUnb){}
    const first = found[0];
    const more = found.length > 1 ? ' (+' + (found.length - 1) + ' more from your pinned artists)' : '';
    const head = 'New release — ' + first.artist;
    const line = '\"' + (first.title || 'New release') + '\" is out' + more + '.';
"""

# ---- 5. THE CHECK ANNOUNCES FROM THE LIST, NOT FROM WHAT A CATALOG RETURNED ----
OLD_ALERT_CALL = """    renderNewReleases();
    if(totalNew > 0){
      renderHome(); // Updates the new releases bubble count
      // …and SAY so: a drop that landed is announced, not merely counted somewhere.
      try{ scReleaseAlert(found); }catch(_eAlert){ console.warn('release alert skipped', _eAlert); }
    }
"""
NEW_ALERT_CALL = """    renderNewReleases();
    // 80.2.10 - announce from the LIST, never from what a catalog returned this run: a
    // drop that is already stored, already read or already announced is not news, however
    // many checks keep finding it.
    let _announce = [];
    try{ _announce = scReleaseAnnouncements(); }catch(_eAnn2){}
    if(_announce.length || totalNew > 0){
      renderHome(); // Updates the new releases bubble count
      // …and SAY so: a drop that landed is announced, not merely counted somewhere.
      try{ scReleaseAlert(_announce); }catch(_eAlert){ console.warn('release alert skipped', _eAlert); }
    }
"""

# The raw per-run find list is no longer what anyone speaks from.
OLD_FOUND_DECL = """    let totalNew = 0;
    const found = [];   // { artist, title } for the drops this run actually found
"""
NEW_FOUND_DECL = """    let totalNew = 0;
"""

OLD_FOUND_PUSH = """        totalNew += (fresh ? fresh.length : 0);
        if(fresh && fresh.length){
          for(let _fi = 0; _fi < fresh.length && found.length < 5; _fi++){
            const _one = fresh[_fi];
            if(_one) found.push({ artist: a.name, title: String(_one.title || '') });
          }
        }
"""
NEW_FOUND_PUSH = """        totalNew += (fresh ? fresh.length : 0);
"""

# ---- 6. THE STORED LIST COLLAPSES ITS OWN COPIES ON LOAD ---------------------
OLD_LOAD = """    // A remix or a cover that an older build stored leaves now, not whenever
    // that artist is next refetched.
    try{ window.__scPruneJunkReleases(pinnedReleases); }catch(_ePrJ){}
"""
NEW_LOAD = """    // A remix or a cover that an older build stored leaves now, not whenever
    // that artist is next refetched.
    try{ window.__scPruneJunkReleases(pinnedReleases); }catch(_ePrJ){}
    // 80.2.10 - …and the copies earlier builds made of one drop leave with it: same
    // normalised title and same day is one row, with a read or announced copy making the
    // survivor read or announced.
    try{ scCollapseReleaseDuplicates(pinnedReleases); }catch(_eDup){}
"""

# The insertion point: the landed/announcement test, whose own prose stays put above it.
LANDED_HEAD = "  function hasLandedUnseenReleases(){"

CLAIMS = [
    ("const APP_VERSION = '80.2.10';", 'the page runs 80.2.10'),
    (MARKER, 'the announcement block is in the page'),
    ('function scReleaseKey(r){', 'the drop key is there'),
    ("    try{ flat = window.__scSingleTitle(flat) || flat; }catch(_eFlat){}", 'the drop key folds the "- Single" wrapper'),
    ('function scReleaseAnnouncements(){', 'the announcement list is there'),
    ('function scMarkReleaseAlerted(rel){', 'a drop can be marked announced'),
    ('function scCollapseReleaseDuplicates(map){', 'the stored copies collapse'),
    ("if(flat !== pk){ prevKeys.add(flat); prevKeys.add('alb:' + flat); }", 'a stored row answers to both names'),
    ("if(prevKeys.has('alb:' + _cKeyTitle + '|' + _cDate)) return;", 'the catalog keys the stored name'),
    ("if(_cRawTitle !== _cKeyTitle && prevKeys.has('alb:' + _cRawTitle + '|' + _cDate)) return;",
     'and the catalog name too'),
    ('            title: _cTitle,', 'the row is stored under the keyed name'),
    ('      return window.__scReleaseList(31).some(function(r){', 'the bell reads the panel list'),
    ('    try{ found.forEach(function(r){ scMarkReleaseAlerted(r); }); }catch(_eMk){}',
     'the alert marks what it says'),
    ('    try{ _announce = scReleaseAnnouncements(); }catch(_eAnn2){}',
     'the check announces from the list'),
    ("try{ scCollapseReleaseDuplicates(pinnedReleases); }catch(_eDup){}",
     'the load collapses copies'),
    ("{ version: '80.2.10', date:", 'the changelog records the release'),
    ("{ version: '80.2.8', date:", 'with 80.2.8 still listed next'),
]

GONE = [
    ("          var _ck = 'alb:' + r.collectionName.toLowerCase().trim() + '|' + _cDate;\n", None),
    ('    const found = [];   // { artist, title } for the drops this run actually found\n', None),
    ('for(let _fi = 0; _fi < fresh.length && found.length < 5; _fi++){\n', None),
    ('    const more = found.length > 1 ? \' (+\' + (found.length - 1) + \' more)\' : \'\';\n', None),
]


def load_text():
    spec = importlib.util.spec_from_file_location('sc_patch_80210_text', TEXT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def swap(src, old, new, what, times=1):
    if src.count(old) != times:
        raise SystemExit('patch-80210: %s appears %d times, expected %d' % (what, src.count(old), times))
    return src.replace(old, new)


def apply_all(src):
    t = load_text()
    # 1. A STORED ROW ANSWERS TO BOTH NAMES, then the catalog keys on both.
    src = swap(src, OLD_PREV_KEYS, NEW_PREV_KEYS, 'the stored keys')
    src = swap(src, OLD_CAT_KEYS, NEW_CAT_KEYS, 'the catalog keys')
    src = swap(src, OLD_CAT_TITLE, NEW_CAT_TITLE, 'the catalog row title')
    src = swap(src, OLD_CAT_NOTE, NEW_CAT_NOTE, 'the catalog row note')
    # 2. ONE ROW PER DROP, ONE ANNOUNCEMENT.
    src = swap(src, LANDED_HEAD, ANNOUNCE_BLOCK + LANDED_HEAD, 'the landed test head')
    src = swap(src, OLD_LANDED, NEW_LANDED, 'the landed test')
    src = swap(src, OLD_ALERT, NEW_ALERT, 'the alert')
    src = swap(src, OLD_FOUND_DECL, NEW_FOUND_DECL, 'the run find list')
    src = swap(src, OLD_FOUND_PUSH, NEW_FOUND_PUSH, 'the run find push')
    src = swap(src, OLD_ALERT_CALL, NEW_ALERT_CALL, 'the alert call')
    src = swap(src, OLD_LOAD, NEW_LOAD, 'the load collapse')
    # 3. THE RELEASE ITSELF.
    src = swap(src, t.CHANGELOG_ANCHOR, t.CHANGELOG_HEAD + t.CHANGELOG_ANCHOR, 'the changelog head')
    src = swap(src, "  const APP_VERSION = '%s';" % OLD_VERSION,
               "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the announcement block and the page runs as ' + VERSION)
        print('patch-80210%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-80210 --check: the release is pending, 15 steps to apply')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-80210: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-80210: the page did not end up 80.2.10 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle is not None and needle in page]
    if left:
        sys.exit('patch-80210: the page still carries this (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v%s'" % OLD_VERSION not in sw:
        sys.exit('patch-80210: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(
        sw.replace("'sidecut-shell-v%s'" % OLD_VERSION, "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the catalog keys, the once-only announcement, the collapsed list, the notes and the shell cache')
    print('patch-80210: 15 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
