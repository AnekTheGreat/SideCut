#!/usr/bin/env python3
"""80.6.17 - the stream owns the now bar, and genres you can browse.

A streamed song used to play from a card halfway up the Library and nowhere else:
the bar at the bottom kept the last local song, its play button drove the local
player, and the card's own play/pause redrew the whole page every time. This
release gives the stream the bar itself - cover, title, artist, length, a STREAM
pill, a seek bar you can drag - and wires the bar's five buttons to the stream
while it owns it. Pausing stops redrawing the page: the button and the clock are
updated in place. Above the search there is now a row of genre tiles; tapping one
searches that genre and the genre stays on the songs it adds.

    python3 dev/patch-80617.py
    python3 dev/patch-80617.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.17'
OLD = '80.6.16'
MARKER = '80.6.17 - THE STREAM OWNS THE BAR'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80617: the page is already %s - nothing to do' % VERSION)
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# ── the bar's state, and the genres ──────────────────────────────────────────
swap('the state remembers who owns the bar',
     "    via: '', err: ''\n  };",
     "    via: '', err: '', barOn: false, genre: ''\n  };")

BAR = r'''  // 80.6.17 - THE STREAM OWNS THE BAR
  // A streamed song is a song. It gets the same bar as a downloaded one - the
  // cover on the disc, the title, the artist and the length, a line you can drag
  // to seek - and the five buttons on that bar drive the stream while it owns it.
  // Everything here is guarded: the bar is shared with a player that must never be
  // broken by a stream that is half through failing.
  function scStreamBarOwns(){ return !!scStreamState.barOn; }
  function scStreamRowMeta(t){
    t = t || {};
    var out = String(t.artist || '') || 'Streaming';
    var d = Number(t.dur) || 0;
    if(d > 0) out += ' \u00b7 ' + scStreamTime(d);
    if(t.genre) out += ' \u00b7 ' + String(t.genre);
    return out;
  }
  function scStreamBarSync(){
    if(!scStreamState.barOn) return;
    try{
      var a = scStreamAudio();
      var d = Number(a && a.duration);
      if(!isFinite(d) || d < 0) d = 0;
      var at = Number(a && a.currentTime) || 0;
      var pct = d > 0 ? Math.max(0, Math.min(100, (at / d) * 100)) : 0;
      var cur = document.getElementById('curTime');
      var tot = document.getElementById('totalTime');
      var sb = document.getElementById('seekBar');
      var arc = document.getElementById('discProgressArc');
      var mini = document.getElementById('miniFill');
      var known = scStreamById(scStreamState.curId) || {};
      if(cur) cur.textContent = scStreamTime(at);
      if(tot) tot.textContent = scStreamTime(d > 0 ? d : (Number(known.dur) || 0));
      // Held out of the clock's hands while a finger is on it, exactly as the local
      // path does - the thumb used to be pulled out from under the drag.
      if(sb && !scSeekDragging){ sb.value = pct; sb.style.setProperty('--seek-fill', pct + '%'); }
      if(arc) arc.style.strokeDashoffset = 157 - (pct / 100) * 157;
      if(mini) mini.style.width = pct + '%';
      var icon = document.getElementById('playIcon');
      if(icon) icon.innerHTML = scStreamState.playing
        ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>'
        : '<path d="M8 5v14l11-7z"/>';
      var disc = document.getElementById('npDisc');
      if(disc) disc.classList.toggle('spinning', !!scStreamState.playing);
      // The card's own button follows the element, without redrawing the page.
      var cardBtn = document.getElementById('scStreamPlay');
      if(cardBtn) cardBtn.innerHTML = scIcon(scStreamState.playing ? 'pause' : 'play', 18);
    }catch(_eBar){}
  }
  function scStreamBarOn(t){
    if(!t || !t.title) return;
    scStreamState.barOn = true;
    try{
      var np = document.getElementById('nowPlaying');
      if(np) np.style.display = 'flex';
      var title = document.getElementById('npTitle');
      if(title) title.textContent = String(t.title);
      var who = document.getElementById('npArtist');
      if(who){
        var pill = '<span style="display:inline-block;font-size:8.5px;font-weight:800;letter-spacing:1.2px;'
          + 'color:var(--coral);border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);'
          + 'border-radius:999px;padding:1px 5px;margin-right:5px;vertical-align:1.5px;">STREAM</span>';
        who.innerHTML = pill + escapeHtml(scStreamMeta(t));
      }
      var label = document.getElementById('npDiscLabel');
      var art = scStreamThumb(t);
      if(label) label.style.backgroundImage = art ? 'url("' + String(art).replace(/"/g, '%22') + '")' : '';
      try{ document.body.classList.add('sc-stream-now'); }catch(_eCls){}
      // One sound at a time: the local player gives way the moment a stream starts.
      var la = null;
      try{ la = activeAudio(); }catch(_eAct){}
      if(la && !la.paused){ try{ la.pause(); }catch(_ePz){} }
      scStreamBarSync();
    }catch(_eBarOn){}
  }
  function scStreamBarOff(){
    if(!scStreamState.barOn) return;
    scStreamState.barOn = false;
    try{ document.body.classList.remove('sc-stream-now'); }catch(_eOff){}
  }
  function scStreamQuiet(){
    try{
      var a = scStreamState.audio;
      if(a && !a.paused) a.pause();
    }catch(_eQ){}
    scStreamBarOff();
  }

  // The genres. A tile is a search, not a list kept in the app: the source is asked
  // for the genre and the songs it answers with keep the genre they were found under.
  var SC_STREAM_GENRES = [
    { n: 'Pop', q: 'pop hits', a: '#ff5f6d', b: '#ffc371' },
    { n: 'Hip-Hop', q: 'hip hop hits', a: '#7f00ff', b: '#e100ff' },
    { n: 'R&B', q: 'r&b slow jams', a: '#8e2de2', b: '#4a00e0' },
    { n: 'Afrobeats', q: 'afrobeats hits', a: '#f7971e', b: '#ffd200' },
    { n: 'Punjabi', q: 'punjabi hits', a: '#00c6ff', b: '#0072ff' },
    { n: 'Latin', q: 'latin hits', a: '#ff0844', b: '#ffb199' },
    { n: 'Rock', q: 'rock classics', a: '#232526', b: '#616161' },
    { n: 'Electronic', q: 'electronic dance', a: '#00f260', b: '#0575e6' },
    { n: 'K-Pop', q: 'kpop hits', a: '#ff9a9e', b: '#b06ab3' },
    { n: 'Indie', q: 'indie songs', a: '#43cea2', b: '#185a9d' },
    { n: 'Country', q: 'country hits', a: '#c79081', b: '#8e5b3f' },
    { n: 'Jazz', q: 'jazz standards', a: '#42275a', b: '#734b6d' },
    { n: 'Chill', q: 'chill lofi', a: '#667eea', b: '#764ba2' },
    { n: 'Dance', q: 'dance party', a: '#11998e', b: '#38ef7d' },
    { n: 'Old School', q: 'old school hits', a: '#b79891', b: '#94716b' },
    { n: 'Gospel', q: 'gospel worship', a: '#f12711', b: '#f5af19' }
  ];
  function scStreamGenreStrip(){
    var h = '<div style="margin-top:10px;">';
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
    h += '<span style="font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-dim);font-weight:800;">Browse</span>';
    h += '<span style="flex:1;"></span>';
    if(scStreamState.genre) h += '<button type="button" id="scStreamGenreClear" style="border:none;background:none;color:var(--ink-dim);font-size:10.5px;padding:2px 0;">' + escapeHtml(scStreamState.genre) + ' \u00d7</button>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:1px 0 3px;">';
    SC_STREAM_GENRES.forEach(function(g){
      var on = String(scStreamState.genre) === String(g.n);
      h += '<button type="button" class="scs-genre" data-g="' + escapeHtml(g.n) + '"'
        + ' style="flex:0 0 auto;width:94px;height:54px;border-radius:12px;padding:8px;text-align:left;'
        + 'display:flex;align-items:flex-end;color:#fff;font-size:11.5px;font-weight:800;line-height:1.1;'
        + 'text-shadow:0 1px 3px rgba(0,0,0,.5);background:linear-gradient(135deg,' + g.a + ' 0%,' + g.b + ' 100%);'
        + 'border:' + (on ? '1.5px solid var(--coral)' : '1px solid rgba(255,255,255,.14)') + ';">'
        + escapeHtml(g.n) + '</button>';
    });
    h += '</div></div>';
    return h;
  }
  function scStreamGenre(name){
    var g = null, i;
    for(i = 0; i < SC_STREAM_GENRES.length; i++){
      if(String(SC_STREAM_GENRES[i].n) === String(name)){ g = SC_STREAM_GENRES[i]; break; }
    }
    scStreamState.genre = g ? g.n : '';
    if(!g){ scStreamState.results = null; scStreamRender(); return; }
    scStreamSearchRun(g.q);
  }
'''

swap('the bar and the genres are in the script',
     "\n  function scStreamSay(msg){",
     "\n" + BAR + "\n  function scStreamSay(msg){")

# ── the clock and the buttons ────────────────────────────────────────────────
swap('the clock feeds the bar',
     "      if(at) at.textContent = scStreamTime(a.currentTime || 0) + (isFinite(d) && d > 0 ? ' / ' + scStreamTime(d) : '');\n    }catch(_e){}\n  }",
     "      if(at) at.textContent = scStreamTime(a.currentTime || 0) + (isFinite(d) && d > 0 ? ' / ' + scStreamTime(d) : '');\n    }catch(_e){}\n    scStreamBarSync();\n  }")

# Play and pause stop rebuilding the page. Rebuilding it on every pause reset the
# card's scroll and its own bar, which is the flicker the owner is asking about.
swap('playing and pausing do not redraw the page',
     "    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamRender(); });\n"
     "    a.addEventListener('pause', function(){ scStreamState.playing = false; scStreamRender(); });",
     "    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamBarSync(); });\n"
     "    a.addEventListener('pause', function(){ scStreamState.playing = false; scStreamBarSync(); });")

swap('a played stream takes the bar',
     "    scStreamSay('Loading the stream\\u2026');\n    scStreamRender();",
     "    scStreamSay('Loading the stream\\u2026');\n    scStreamRender();\n    scStreamBarOn(t);")

swap('a local song takes the bar back',
     "  function updateNowPlayingUI(t){\n    $('nowPlaying').style.display = 'flex';",
     "  function updateNowPlayingUI(t){\n    scStreamQuiet();\n    $('nowPlaying').style.display = 'flex';")

swap('the bar plays the stream',
     "    $('playPauseBtn').classList.remove('pulse-cue');\n    if(window.__scMark){",
     "    $('playPauseBtn').classList.remove('pulse-cue');\n"
     "    if(scStreamBarOwns()){ scStreamToggle(); return; }\n"
     "    if(window.__scMark){")

swap('the bar skips the stream',
     "  $('nextBtn').addEventListener('click', () => hardAdvance(1, true));\n"
     "  $('prevBtn').addEventListener('click', () => {\n"
     "    if(activeAudio().currentTime > 3){ activeAudio().currentTime = 0; return; }\n"
     "    hardAdvance(-1, true);\n"
     "  });",
     "  $('nextBtn').addEventListener('click', () => {\n"
     "    if(scStreamBarOwns()){ scStreamNext(1); return; }\n"
     "    hardAdvance(1, true);\n"
     "  });\n"
     "  $('prevBtn').addEventListener('click', () => {\n"
     "    if(scStreamBarOwns()){\n"
     "      var sa = scStreamAudio();\n"
     "      if(sa && sa.currentTime > 3){ try{ sa.currentTime = 0; }catch(_eS0){} return; }\n"
     "      scStreamNext(-1);\n"
     "      return;\n"
     "    }\n"
     "    if(activeAudio().currentTime > 3){ activeAudio().currentTime = 0; return; }\n"
     "    hardAdvance(-1, true);\n"
     "  });")

swap('the bar seeks the stream',
     "  $('seekBar').addEventListener('input', () => {\n    const a = activeAudio();",
     "  $('seekBar').addEventListener('input', () => {\n"
     "    if(scStreamBarOwns()){\n"
     "      var sa = scStreamAudio();\n"
     "      var sd = Number(sa && sa.duration) || 0;\n"
     "      if(sd > 0){\n"
     "        var p = (Number($('seekBar').value) || 0) / 100;\n"
     "        try{ sa.currentTime = p * sd; }catch(_eSeek){} \n"
     "      }\n"
     "      scStreamBarSync();\n"
     "      return;\n"
     "    }\n"
     "    const a = activeAudio();")

# ── genres on the page ───────────────────────────────────────────────────────
swap('the page shows the genres',
     "    h += '<div style=\"font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;\">Plays from the source. Nothing is saved to your device, and a source can expire.</div>';",
     "    h += '<div style=\"font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;\">Plays from the source. Nothing is saved to your device, and a source can expire.</div>';\n"
     "    h += scStreamGenreStrip();")

swap('a tile runs its search',
     "    on('scStreamNewPl', 'click', scStreamNewPlaylist);",
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-genre'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamGenre(this.getAttribute('data-g')); });\n"
     "    });\n"
     "    on('scStreamGenreClear', 'click', function(){\n"
     "      scStreamState.genre = '';\n"
     "      scStreamState.results = null;\n"
     "      scStreamRender();\n"
     "    });\n"
     "    on('scStreamNewPl', 'click', scStreamNewPlaylist);")

swap('the results say who and how long',
     "        var who = String(it.author || it.channel || '');",
     "        var who = String(it.owner || it.author || it.channel || '');\n"
     "        var len = Number(it.duration) || 0;\n"
     "        if(len > 0) who += ' \\u00b7 ' + scStreamTime(len);")

# A row keeps the genre it was found under, and shows it beside the length.
swap('a row keeps its genre',
     "      thumb: thumb\n    }]);",
     "      thumb: thumb,\n      genre: String(it.genre || scStreamState.genre || '')\n    }]);")

swap('a playlist copy keeps it too',
     "      dur: Number(t.dur) || 0,\n      thumb: String(t.thumb || '')",
     "      dur: Number(t.dur) || 0,\n      thumb: String(t.thumb || ''),\n      genre: String(t.genre || '')")

swap('an old playlist copy fills it in',
     "        if(!it.dur) it.dur = Number(t.dur) || 0;",
     "        if(!it.dur) it.dur = Number(t.dur) || 0;\n        if(!it.genre) it.genre = String(t.genre || '');")

swap('the rows show the genre',
     "'<div style=\"font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(t.artist || 'Streaming') + (t.dur ? ' \\u00b7 ' + scStreamTime(t.dur) : '') + '</div>'",
     "'<div style=\"font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(scStreamRowMeta(t)) + '</div>'",
     expect=2)

# ── the bar's own look while a stream owns it ────────────────────────────────
swap('the bar answers in colour',
     "#nowPlaying.mini #miniBar{ display:block; }",
     "#nowPlaying.mini #miniBar{ display:block; }\n"
     "body.sc-stream-now #nowPlaying{ border-top:1px solid color-mix(in srgb, var(--coral) 32%, transparent); }\n"
     "body.sc-stream-now #npDisc{ box-shadow: 0 0 0 2px color-mix(in srgb, var(--coral) 22%, transparent), 0 0 18px color-mix(in srgb, var(--coral) 16%, transparent); }\n"
     "body.sc-stream-now #npArtist .sc-pill{ }\n")

swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'The stream takes the player bar, and genres to browse', items: [\n"
    "    '[FULL] A streamed song now owns the player bar at the bottom: its cover on the disc, its title, the artist and the length, a STREAM pill, and a progress line you can drag to seek. Play, pause, next and previous on that bar control the stream instead of the last downloaded song.',\n"
    "    '[FULL] Genres above the search. Tap a tile (Pop, Hip-Hop, Afrobeats, Punjabi, Latin, Rock and more) and it searches that genre; the genre stays on the songs you add and shows beside the artist and the length.',\n"
    "    '[FULL] Pausing a stream no longer redraws the page. The button and the clock update in place, so the card does not jump or lose where you were.',\n"
    "    '[FULL] Search results now show the artist and the length, so you can tell the versions of a song apart before adding one.',\n"
    "  ]},\n"
)
if "version: '" + VERSION + "'" not in SRC:
    at = SRC.find("\n  { version: '%s'" % OLD)
    if at == -1:
        failed.append('changelog: no %s entry to insert before' % OLD)
    else:
        SRC = SRC[:at + 1] + ENTRY + SRC[at + 1:]
        applied.append('the changelog entry')

if failed:
    print('patch-80617: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80617: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80617: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
