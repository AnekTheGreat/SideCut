#!/usr/bin/env python3
"""v60.3 — patch-note timestamps in true Eastern time, the playlist name gets the
whole tab row until the back-to-top arrow appears, and lyrics stop hanging on
"Searching for lyrics…" (hard timeouts, a deadline, one more source).

Also carries the v60.2 work that has not shipped yet: the record-player jump
follows the tab you are in, and the foreground work behind the RGB cycle and the
audio analysis was cut.
"""
import io, re, sys
from datetime import datetime, timedelta, timezone

p = 'index.html'
src = io.open(p, encoding='utf-8').read()


def rep(label, old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit('ANCHOR FAIL %s: expected %d, found %d\n---\n%s' % (label, count, n, old[:400]))
    src = src.replace(old, new, count)
    print('ok  ' + label)


# ══════════════════════════════════════════════════════════════════ 1. timestamps
# The entries written in today's session were stamped from the sandbox clock, which
# is UTC, so every one of them read four hours into the future for anyone in
# Eastern time (11:05 PM when it was 7:05 PM). Shift them back by four hours — the
# same rule this file's own header states (UTC minus 4 = EDT).
sep_re = re.compile(r"date: '(?P<month>[A-Z][a-z]+) (?P<day>\d{1,2}), (?P<year>\d{4})(?P<sep> \\u00b7 | \\\\u00b7 | · )(?P<h>\d{1,2}):(?P<mi>\d{2}) (?P<ap>[AP]M)(?P<zone> EDT| ET| EST)?'")
shifted = []


def shift(m):
    zone = m.group('zone') or ''
    if zone.strip() not in ('EDT', 'ET', 'EST'):
        return m.group(0)
    h24 = int(m.group('h')) % 12 + (12 if m.group('ap') == 'PM' else 0)
    month_i = datetime.strptime(m.group('month'), '%B').month
    when = datetime(int(m.group('year')), month_i, int(m.group('day')), h24, int(m.group('mi')))
    when -= timedelta(hours=4)
    ap = 'AM' if when.hour < 12 else 'PM'
    h12 = when.hour % 12 or 12
    shifted.append(m.group(0))
    return ("date: '%s %d, %d%s%d:%02d %s EDT'" %
            (when.strftime('%B'), when.day, when.year, m.group('sep'), h12, when.minute, ap))


def date_fix(text):
    def on_match(m):
        val = m.group(0)
        if 'September 20, 2026' not in val:
            return val
        return sep_re.sub(shift, val)
    return re.sub(r"date: '[^']*'", on_match, text)


src = date_fix(src)
print('ok  shifted %d entries stamped from the UTC clock' % len(shifted))

n_et = src.count(" ET'")
if n_et:
    src = src.replace(" ET'", " EDT'")
print('ok  %d entries said just "ET" and now say EDT' % n_et)

rep('the tutorial says EDT, not "ET"',
    "<b>Update timestamps are in Eastern Time.</b> Every changelog entry shows its date and time in ET (EDT in summer, EST in winter) — never UTC.",
    "<b>Update timestamps are in Eastern time (EDT).</b> Every changelog entry shows its date and time in Eastern time — never UTC, and never the build machine's clock.")

# ══════════════════════════════════════════════════════════ 2. the tab row width
rep('the arrow gives up its space until it is needed',
    """  #backToTopBtn.is-idle{ opacity:0; transform: translateY(-6px) scale(0.84); pointer-events:none; }""",
    """  /* The arrow shares this row with the playlist tabs, and while it is idle it no
     longer holds a slot: the name you are on gets the whole width until you scroll
     down and the arrow actually appears. */
  #backToTopBtn.is-idle{ opacity:0; transform: translateY(-6px) scale(0.84); pointer-events:none; display:none; }""")

rep('the tab you are on is kept fully in view',
    """    // Update DJ MODE button to show red X when current playlist has DJ mode disabled
    var djBtn = $('djModeBtn');""",
    """    // Keep the tab you are on fully in view. The strip shares its row with the
    // back-to-top arrow, and a long playlist name could otherwise sit half under
    // the edge — which is a name cut off mid-word, not a name that is too long.
    try{
      var _tabsEl = $('tabs');
      var _act = _tabsEl && _tabsEl.querySelector('.tab.active');
      if(_tabsEl && _act && _tabsEl.scrollWidth > _tabsEl.clientWidth){
        var _want = _act.offsetLeft - (_tabsEl.clientWidth - _act.offsetWidth) / 2;
        var _maxLeft = _tabsEl.scrollWidth - _tabsEl.clientWidth;
        _tabsEl.scrollLeft = Math.max(0, Math.min(_want, _maxLeft));
      }
    }catch(_eTabs){}
    // Update DJ MODE button to show red X when current playlist has DJ mode disabled
    var djBtn = $('djModeBtn');""")

# ═══════════════════════════════════════════════════════ 3. lyrics: never hang
rep('a lyric request can time out',
    """  function scLyricsJson(url){
    function once(){
      return fetch(url).then(function(r){""",
    """  // Every lyric lookup in this file goes through one clock. Before this, a request
  // that never answered simply never answered: the sheet sat on "Searching for
  // lyrics…" for as long as the phone's connection felt like it, with up to two
  // dozen requests queued one after another. Each request now has its own timeout,
  // and the whole lookup has a deadline it cannot run past.
  var scLyricsDeadline = 0;
  function scLyricsOutOfTime(){ return scLyricsDeadline > 0 && Date.now() > scLyricsDeadline; }
  function scFetchWithTimeout(url, ms, opts){
    var timeout = ms || 3500;
    try{
      if(typeof AbortController !== 'function') return fetch(url, opts);
      var ctl = new AbortController();
      var timer = setTimeout(function(){ try{ ctl.abort(); }catch(_eAbort){} }, timeout);
      var o = {};
      for(var k in (opts || {})){ if(Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k]; }
      o.signal = ctl.signal;
      return fetch(url, o).then(function(r){ clearTimeout(timer); return r; },
                                function(e){ clearTimeout(timer); throw e; });
    }catch(_e){
      return fetch(url, opts);
    }
  }
  window.__scFetchWithTimeout = scFetchWithTimeout;
  function scLyricsJson(url){
    if(scLyricsOutOfTime()) return Promise.resolve({ __status: -1 });
    function once(){
      return scFetchWithTimeout(url, 4000).then(function(r){""")

rep('and a lookup can be split into a deadline-guarded core',
    """  async function scLookupLyrics(artistRaw, titleRaw, duration){
    var artist = applyWatermarkPatterns(artistRaw || '', true);""",
    """  async function scLookupLyrics(artistRaw, titleRaw, duration){
    scLyricsDeadline = Date.now() + 12000;
    try{
      return await scLookupLyricsInner(artistRaw, titleRaw, duration);
    }finally{
      scLyricsDeadline = 0;
    }
  }
  async function scLookupLyricsInner(artistRaw, titleRaw, duration){
    var artist = applyWatermarkPatterns(artistRaw || '', true);""")

rep('the artist loops respect the deadline',
    """    for(var ai = 0; ai < Math.min(artistVars.length, 3) && !best; ai++){""",
    """    for(var ai = 0; ai < Math.min(artistVars.length, 3) && !best && !scLyricsOutOfTime(); ai++){""")
rep('so does the search loop',
    """    for(var ai2 = 0; ai2 < Math.min(artistVars.length, 3) && !best; ai2++){
      for(var ti = 0; ti < Math.min(titleVars.length, 2); ti++){""",
    """    for(var ai2 = 0; ai2 < Math.min(artistVars.length, 3) && !best && !scLyricsOutOfTime(); ai2++){
      for(var ti = 0; ti < Math.min(titleVars.length, 2) && !scLyricsOutOfTime(); ti++){""")
rep('and the title-only pass',
    """    if(!best && titleVars.length){
      var tRes = await scLyricsJson('https://lrclib.net/api/search?track_name=' + encodeURIComponent(titleVars[0]));""",
    """    if(!best && titleVars.length && !scLyricsOutOfTime()){
      var tRes = await scLyricsJson('https://lrclib.net/api/search?track_name=' + encodeURIComponent(titleVars[0]));""")

rep('one more source, and it is the one that carries recent releases',
    """    // 4. lyrics.ovh — an old database with almost nothing recent, but free.
    try{
      var ovh = await fetch('https://api.lyrics.ovh/v1/' + encodeURIComponent(primary) + '/' + encodeURIComponent(titleVars[0]));""",
    """    // 4. textyl — Apple Music's own lyric lines. This is where a lot of recent
    //    releases and non-English catalogue live first, which is exactly the gap
    //    that left newer and smaller artists with "no lyrics". Requests come back
    //    with a timestamp per line, so the result is real synced lyrics.
    if(!scLyricsOutOfTime()){
      try{
        var tyRes = await scFetchWithTimeout('https://api.textyl.co/api/lyrics?q=' +
                    encodeURIComponent((primary ? primary + ' ' : '') + titleVars[0]), 4500);
        if(tyRes && tyRes.ok){
          var ty = await tyRes.json();
          if(Array.isArray(ty) && ty.length){
            var _tyLines = ty.filter(function(l){ return l && l.lyrics; });
            if(_tyLines.length){
              var _tyText = _tyLines.map(function(l){
                var _s = Math.max(0, Math.round(Number(l.seconds) || 0));
                var _mm = String(Math.floor(_s / 60)).padStart(2, '0');
                var _ss = String(_s % 60).padStart(2, '0');
                return '[' + _mm + ':' + _ss + '.00]' + String(l.lyrics).trim();
              }).join('\\n');
              if(_tyText.trim().length > 20){
                return { lyrics: _tyText, isSynced: true, title: titleVars[0], artist: primary,
                         duration: dur, source: 'textyl (Apple Music)', score: 1 };
              }
            }
          }
        }
      }catch(_tyE){}
    }
    // 5. lyrics.ovh — an old database with almost nothing recent, but free.
    try{
      if(scLyricsOutOfTime()) return null;
      var ovh = await scFetchWithTimeout('https://api.lyrics.ovh/v1/' + encodeURIComponent(primary) + '/' + encodeURIComponent(titleVars[0]), 4000);""")

rep('the Genius fallbacks go through the same clock',
    """    try{
      var sra = await fetch('https://some-random-api.com/lyrics?title=' + encodeURIComponent((titleVars[0] + ' ' + (primary || '')).trim()));""",
    """    try{
      if(scLyricsOutOfTime()) return null;
      var sra = await scFetchWithTimeout('https://some-random-api.com/lyrics?title=' + encodeURIComponent((titleVars[0] + ' ' + (primary || '')).trim()), 4500);""")

rep('the lyrist fallback stops after two tries',
    """    try{
      for(var lv = 0; lv < Math.min(titleVars.length, 2) && !best; lv++){
        for(var la = 0; la < Math.min(artistVars.length, 3); la++){
          var lyr = await fetch('https://lyrist.vercel.app/api/' + encodeURIComponent(titleVars[lv]) + '/' + encodeURIComponent(artistVars[la]));""",
    """    try{
      var _lyTries = 0;
      for(var lv = 0; lv < Math.min(titleVars.length, 2) && !best; lv++){
        for(var la = 0; la < Math.min(artistVars.length, 3); la++){
          if(scLyricsOutOfTime() || _lyTries >= 2) break;
          _lyTries++;
          var lyr = await scFetchWithTimeout('https://lyrist.vercel.app/api/' + encodeURIComponent(titleVars[lv]) + '/' + encodeURIComponent(artistVars[la]), 4500);""")

rep('the candidate list has a deadline too',
    """  async function scListLyricsCandidates(artistRaw, titleRaw, duration){
    var artist = applyWatermarkPatterns(artistRaw || '', true);""",
    """  async function scListLyricsCandidates(artistRaw, titleRaw, duration){
    scLyricsDeadline = Date.now() + 12000;
    var artist = applyWatermarkPatterns(artistRaw || '', true);""")
rep('and releases it',
    """    out.sort(function(a, b){ return b.score - a.score; });
    return out;
  }
  window.__scLookupLyrics = scLookupLyrics;""",
    """    out.sort(function(a, b){ return b.score - a.score; });
    scLyricsDeadline = 0;
    return out;
  }
  window.__scLookupLyrics = scLookupLyrics;""")

rep('the not-found panel gets a line for what was searched',
    """        <div style="margin-bottom:8px;">No lyrics found</div>""",
    """        <div style="margin-bottom:8px;">No lyrics found</div>
        <div id="lyricsNotFoundWhat" style="font-size:12px; color:var(--ink); margin-bottom:6px; word-break:break-word;"></div>
        <div style="font-size:11.5px;">Tap <b>↻ Refetch</b> to search by hand — the artist and title there are editable.</div>""")

rep('a helper says what was searched for',
    """  function titleCleanup(str) {""",
    """  // Say what was actually looked for, so a wrong artist tag is obvious rather than
  // a mystery, and never leave the sheet sitting on a spinner.
  function scLyricsSayNotFound(artist, title){
    try{
      var loading = $('lyricsLoading');
      if(loading) loading.style.display = 'none';
      var panel = $('lyricsNotFound');
      if(panel) panel.style.display = 'block';
      var what = $('lyricsNotFoundWhat');
      if(what){
        var t = String(title || '').trim(), a = String(artist || '').trim();
        what.textContent = t ? ('Searched: “' + t + '”' + (a ? ' — ' + a : '')) : '';
      }
    }catch(_e){}
  }

  function titleCleanup(str) {""")

rep('both failure branches use it',
    """      $('lyricsLoading').style.display = 'none';
      $('lyricsNotFound').style.display = 'block';
    } catch(e) {
      console.error('Lyrics fetch error:', e);
      $('lyricsLoading').style.display = 'none';
      $('lyricsNotFound').style.display = 'block';
    }""",
    """      scLyricsSayNotFound(cleanArtist, cleanTitle);
    } catch(e) {
      console.error('Lyrics fetch error:', e);
      scLyricsSayNotFound(cleanArtist, cleanTitle);
    }""")

# ═══════════════════════════════════════════════════════════ 4. version + notes
rep('version', "  const APP_VERSION = '60.2';", "  const APP_VERSION = '60.3';")

edt_now = datetime.now(timezone.utc) - timedelta(hours=4)
ap = 'AM' if edt_now.hour < 12 else 'PM'
h12 = edt_now.hour % 12 or 12
stamp = '%s %d, %d \\u00b7 %d:%02d %s EDT' % (edt_now.strftime('%B'), edt_now.day, edt_now.year, h12, edt_now.minute, ap)

anchor = "  { version: '60.2', date:"
assert src.count(anchor) == 1, 'changelog anchor'
entry = """  { version: '60.3', date: '%s', title: 'Patch-note times in true Eastern time, the whole row for the playlist name, and lyrics that cannot hang', items: [
    'Patch-note timestamps are now the real Eastern time. The entries written today were stamped from the build machine, which runs on UTC, so every one of them sat four hours in the future (11:05 PM on an evening that was really 7:05 PM) \\u2014 which is exactly the "random time zone" you were reading. They are corrected, and the tutorial now says Eastern time outright',
    'A name that is genuinely too long is the only one that still gives way. The back-to-top arrow shares its row with the playlist tabs and used to hold its slot even while invisible, which is what cut "Punjabi Gaane" off mid-word. While the arrow is hidden the tabs get the entire row, and the tab you are on is always scrolled fully into view',
    'Lyrics can no longer get stuck on "Searching for lyrics\\u2026". Every request had no timeout and up to two dozen ran one after another, so a slow connection simply meant an endless spinner. Each request now times out on its own and the whole lookup has a 12-second ceiling',
    'A new lyrics source: textyl carries Apple Music\\u2019s own lyric lines, which is where a lot of recent releases and non-English catalogue live first \\u2014 the exact gap that left smaller artists with "no lyrics". It returns real synced lines',
    'When nothing is found the sheet says so and names what it searched for ("Searched: \\u201cCRUISE CONTROL\\u201d \\u2014 BK"), so a wrong artist tag is obvious and one tap on \\u21bb Refetch fixes it',
    'The Genius fallbacks are reached with the same clock and stop after two tries instead of six, so a miss is quick instead of a long queue of requests',
    'The record player on the now bar follows the tab you are in: in Playlists it scrolls to the playing song in the list you have open (falling back to All Songs only when that playlist does not hold it), and in Albums it opens the album the song is in. Either way the row is highlighted, the highlight survives the list redrawing, and neither path scrolls the page itself \\u2014 no more whole-app lift',
    'Much less foreground work while a song plays: one shared audio decode instead of two per track, no waveform decode unless the Waveform seek style is actually on screen, no restyling of hidden bars on every timeupdate, and the RGB cycle repaints the theme about 11 times a second instead of on every display frame',
  ]},
""" % stamp
src = src.replace(anchor, entry + anchor, 1)
print('ok  changelog entry %s' % stamp)

io.open(p, 'w', encoding='utf-8').write(src)
print('\npatched index.html')
