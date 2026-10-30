#!/usr/bin/env python3
"""80.6.18 - the web page says FullDev, and your own genres feed the recommendations.

Three things, all in the builds that carry streaming:
  * on the web page the app's name carries a small FullDev tag, and the tab says so;
  * the genre rail is yours as well as ours - any genre can be added, and one you
    added can be taken away with a long press;
  * Recommended asks the AI for songs across those genres, not just one artist's mix.

    python3 dev/patch-80618.py
    python3 dev/patch-80618.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.18'
OLD = '80.6.17'
MARKER = '80.6.18 - THE GENRES ARE YOURS'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80618: the page is already %s - nothing to do' % VERSION)
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


# ── the web page names itself ───────────────────────────────────────────────
swap('the web page carries the tag',
     "  const APP_VERSION = '" + OLD + "';\n  if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;",
     "  const APP_VERSION = '" + OLD + "';\n  if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;\n"
     "  // 80.6.18 - THE WEB PAGE SAYS WHICH PAGE IT IS. The app on a phone and the page\n"
     "  // in a browser are told apart by one small tag beside the name, and the tab says\n"
     "  // the same. A build with no streaming keeps its plain name.\n"
     "  (function scBrandTag(){\n"
     "    try{\n"
     "      if(typeof SC_IS_WEB === 'undefined' || !SC_IS_WEB) return;\n"
     "      if(typeof SC_WEB_FULL !== 'undefined' && !SC_WEB_FULL) return;\n"
     "      if(typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY) return;\n"
     "      document.title = 'SideCut FullDev';\n"
     "      var h = document.querySelector('header .brand h1');\n"
     "      if(!h || document.getElementById('scBuildTag')) return;\n"
     "      var tag = document.createElement('span');\n"
     "      tag.id = 'scBuildTag';\n"
     "      tag.textContent = 'FullDev';\n"
     "      tag.style.cssText = 'display:inline-block;margin-left:7px;font-size:9px;font-weight:800;'\n"
     "        + 'letter-spacing:1.1px;text-transform:uppercase;color:var(--coral);'\n"
     "        + 'border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);'\n"
     "        + 'border-radius:999px;padding:1px 6px;vertical-align:3px;';\n"
     "      h.appendChild(tag);\n"
     "    }catch(_eBrand){}\n"
     "  })();")

# ── the genres, and whose they are ──────────────────────────────────────────
swap('the state remembers your genres',
     "    via: '', err: '', barOn: false, genre: ''\n  };",
     "    via: '', err: '', barOn: false, genre: '', genres: null\n  };")

swap('a genre that was not wanted is not offered',
     ",\n    { n: 'Gospel', q: 'gospel worship', a: '#f12711', b: '#f5af19' }\n  ];",
     "\n  ];")

GENRES = r'''  // 80.6.18 - THE GENRES ARE YOURS
  // The rail is a starting point, not a menu: any genre can be added, and the ones
  // the owner added are the ones the AI is asked about. A custom genre is a search
  // of its own name, so it works the moment it is typed.
  function scStreamGenreName(s){
    var out = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if(out.length > 24) out = out.slice(0, 24).replace(/\s+$/, '');
    return out;
  }
  function scStreamGenres(){
    var out = SC_STREAM_GENRES.slice();
    var mine = scStreamState.genres || [];
    for(var i = 0; i < mine.length; i++){
      var n = scStreamGenreName(mine[i]);
      if(!n) continue;
      if(out.some(function(g){ return g.n.toLowerCase() === n.toLowerCase(); })) continue;
      out.push({ n: n, q: n + ' hits', a: '#3a2a35', b: '#54404f', custom: true });
    }
    return out;
  }
  function scStreamGenresSave(){
    try{ dbPut('meta', { key: 'streamGenres', value: (scStreamState.genres || []).slice() }); }catch(_eGs){}
  }
  function scStreamGenreAdd(){
    var name = '';
    try{ name = prompt('Add a genre - the AI will recommend songs from it:', ''); }catch(_eGa){ name = ''; }
    name = scStreamGenreName(name);
    if(!name) return;
    var list = (scStreamState.genres || []).slice();
    var known = scStreamGenres().some(function(g){ return g.n.toLowerCase() === name.toLowerCase(); });
    if(!known) list.push(name);
    scStreamState.genres = list;
    scStreamGenresSave();
    scStreamGenre(name);
    scStreamSay(known ? ('\u201c' + name + '\u201d is already on the rail') : ('Added \u201c' + name + '\u201d - tap it any time'));
  }
  function scStreamGenreRemove(name){
    var low = scStreamGenreName(name).toLowerCase();
    var list = (scStreamState.genres || []).slice();
    var next = list.filter(function(x){ return scStreamGenreName(x).toLowerCase() !== low; });
    if(next.length === list.length){
      scStreamSay('\u201c' + name + '\u201d came with the app - only the genres you added can be removed');
      return;
    }
    var go = true;
    try{ go = confirm('Remove \u201c' + name + '\u201d from your genres?'); }catch(_eGc){ go = true; }
    if(!go) return;
    scStreamState.genres = next;
    scStreamGenresSave();
    if(String(scStreamState.genre) === String(name)){ scStreamState.genre = ''; scStreamState.results = null; }
    scStreamRender();
    scStreamSay('Removed \u201c' + name + '\u201d');
  }
  function scStreamGenresLine(limit){
    var names = scStreamGenres().map(function(g){ return g.n; });
    var n = Number(limit) || 0;
    if(n > 0 && names.length > n) return names.slice(0, n).join(', ') + ' and more';
    return names.join(', ');
  }
  // The AI is asked for songs, not links: the titles it names are searched the same
  // way a typed search is, so every offer goes through the path that already works.
  function scStreamAiRecommend(){
    var names = scStreamGenres().map(function(g){ return g.n; });
    if(!names.length) return false;
    var key = (typeof _aiGeminiKey !== 'undefined') ? String(_aiGeminiKey || '') : '';
    var model = (typeof window.__scGeminiModel === 'function') ? String(window.__scGeminiModel() || '') : '';
    if(!key || !model) return false;
    scStreamSay('Asking the AI for songs in ' + scStreamGenresLine(3) + '\u2026');
    var ask = 'Recommend 6 well-known songs across these music tastes: ' + names.join(', ') + '. '
      + 'Use real released songs. Reply with ONLY a JSON array of objects with the keys "song", "artist" and "genre".';
    fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: ask }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 500 }
      })
    }).then(function(r){ return r && r.ok ? r.json() : null; }).then(function(d){
      var tx = (d && d.candidates && d.candidates[0] && d.candidates[0].content
        && d.candidates[0].content.parts && d.candidates[0].content.parts[0].text) || '';
      var body = String(tx).match(/\[[\s\S]*\]/);
      var arr = [];
      try{ arr = body ? JSON.parse(body[0]) : []; }catch(_eAj){ arr = []; }
      if(!Array.isArray(arr) || !arr.length) throw new Error('nothing usable');
      var picks = [];
      function step(i){
        if(i >= arr.length || picks.length >= 4) return Promise.resolve(picks);
        var it = arr[i] || {};
        var q = (String(it.song || '') + ' ' + String(it.artist || '')).trim();
        if(!q) return step(i + 1);
        return Promise.resolve(scYtSearch(q, '', '')).then(function(items){
          var hit = (items || [])[0];
          if(hit){
            hit.genre = scStreamGenreName(it.genre || '');
            picks.push(hit);
          }
          return step(i + 1);
        }).catch(function(){ return step(i + 1); });
      }
      return step(0);
    }).then(function(picks){
      if(!picks || !picks.length) throw new Error('nothing usable');
      scStreamState.results = picks.slice(0, 4);
      scStreamState.q = '';
      scStreamRender();
      scStreamSay('Chosen for your genres - tap Add on the one you want');
    }).catch(function(){
      scStreamSay('The AI had nothing usable just now - the genre tiles still search');
    });
    return true;
  }
'''

swap('the genres are yours, and the AI reads them',
     "  function scStreamGenreStrip(){",
     GENRES + "\n  function scStreamGenreStrip(){")

swap('the rail shows every genre',
     "    SC_STREAM_GENRES.forEach(function(g){",
     "    scStreamGenres().forEach(function(g){")

swap('an added genre is marked as yours',
     "      h += '<button type=\"button\" class=\"scs-genre\" data-g=\"' + escapeHtml(g.n) + '\"'",
     "      h += '<button type=\"button\" class=\"scs-genre\"' + (g.custom ? ' data-custom=\"1\"' : '') + ' data-g=\"' + escapeHtml(g.n) + '\"'")

swap('and there is a tile to add one',
     "    h += '</div></div>';\n    return h;\n  }",
     "    h += '<button type=\"button\" id=\"scStreamGenreAdd\" style=\"flex:0 0 auto;width:94px;height:54px;border-radius:12px;'\n"
     "      + 'padding:8px;text-align:left;display:flex;align-items:flex-end;gap:4px;border:1px dashed var(--line);'\n"
     "      + 'background:none;color:var(--ink-dim);font-size:11px;font-weight:700;\">'\n"
     "      + scIcon('plus', 12) + ' Genre</button>';\n"
     "    h += '</div></div>';\n    return h;\n  }")

swap('a genre is looked up among all of them',
     "  function scStreamGenre(name){\n    var g = null, i;\n    for(i = 0; i < SC_STREAM_GENRES.length; i++){\n      if(String(SC_STREAM_GENRES[i].n) === String(name)){ g = SC_STREAM_GENRES[i]; break; }\n    }",
     "  function scStreamGenre(name){\n    var g = null, i, all = scStreamGenres();\n    for(i = 0; i < all.length; i++){\n      if(String(all[i].n) === String(name)){ g = all[i]; break; }\n    }")

swap('the add tile is wired',
     "    on('scStreamGenreClear', 'click', function(){",
     "    on('scStreamGenreAdd', 'click', scStreamGenreAdd);\n    on('scStreamGenreClear', 'click', function(){")

# A tap searches a genre; a long press on one the owner added takes it away.
swap('a long press removes a genre of your own',
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-genre'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamGenre(this.getAttribute('data-g')); });\n"
     "    });",
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-genre'), function(b){\n"
     "      var tmr = null, held = false;\n"
     "      function stop(){ if(tmr){ clearTimeout(tmr); tmr = null; } }\n"
     "      b.addEventListener('pointerdown', function(){\n"
     "        if(b.getAttribute('data-custom') !== '1') return;\n"
     "        stop();\n"
     "        tmr = setTimeout(function(){\n"
     "          tmr = null; held = true;\n"
     "          scStreamGenreRemove(b.getAttribute('data-g'));\n"
     "        }, 650);\n"
     "      });\n"
     "      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev){ b.addEventListener(ev, stop); });\n"
     "      b.addEventListener('click', function(e){\n"
     "        if(held){ held = false; if(e && e.preventDefault) e.preventDefault(); return; }\n"
     "        scStreamGenre(b.getAttribute('data-g'));\n"
     "      });\n"
     "    });")

swap('the genres come back with the shelf',
     "    scStreamLoad();\n    scStreamRender();",
     "    scStreamLoad();\n"
     "    try{\n"
     "      Promise.resolve(dbGet('meta', 'streamGenres')).then(function(r){\n"
     "        if(r && Array.isArray(r.value)) scStreamState.genres = r.value;\n"
     "        scStreamRender();\n"
     "      }).catch(function(){});\n"
     "    }catch(_eGl){}\n"
     "    scStreamRender();")

# ── Recommended reads the genres ────────────────────────────────────────────
swap('recommendations come from the genres',
     "  function scShelfRecommend(){\n"
     "    var cur = scStreamById(scStreamState.curId);\n"
     "    var who = (cur && (cur.artist || '')) || scStreamState.author || '';\n"
     "    who = String(who).replace(/\\s*-\\s*topic\\s*$/i, '').replace(/vevo$/i, '').trim();\n"
     "    if(!who){ scStreamSay('Play a stream first - the recommendation comes from its artist'); return; }\n"
     "    scStreamState.q = who + ' mix';\n"
     "    scStreamSearchRun(who + ' mix');\n"
     "  }",
     "  // 80.6.18 - RECOMMENDED ASKS ABOUT THE GENRES FIRST. The AI is the only thing in\n"
     "  // the app that can name songs nobody searched for, so it is asked for songs across\n"
     "  // the rail - including the genres the owner added. Without a key there is still a\n"
     "  // recommendation: the genre itself, or the artist that is playing.\n"
     "  function scShelfRecommend(){\n"
     "    if(scStreamAiRecommend()) return;\n"
     "    if((scStreamState.genres || []).length){\n"
     "      var first = scStreamGenres()[0];\n"
     "      if(first){ scStreamGenre(first.n); scStreamSay('Connect a Gemini key in Settings and the AI will pick songs from your genres'); return; }\n"
     "    }\n"
     "    var cur = scStreamById(scStreamState.curId);\n"
     "    var who = (cur && (cur.artist || '')) || scStreamState.author || '';\n"
     "    who = String(who).replace(/\\s*-\\s*topic\\s*$/i, '').replace(/vevo$/i, '').trim();\n"
     "    if(!who){ var any = scStreamGenres()[0]; if(any) scStreamGenre(any.n); return; }\n"
     "    scStreamState.q = who + ' mix';\n"
     "    scStreamSearchRun(who + ' mix');\n"
     "  }")

# The rail is readable from anywhere that can ask, including an AI that is wired later.
swap('the genres can be asked for',
     "  function scStreamGenreStrip(){",
     "  try{ window.__scStreamGenres = function(){ return scStreamGenres().map(function(g){ return g.n; }); }; }catch(_eGx){}\n"
     "  function scStreamGenreStrip(){")

swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'The web page says FullDev, and the genres are yours', items: [\n"
    "    '[FULL] The web page carries a small FullDev tag beside the SideCut name, and the browser tab says it too. The app on a phone keeps its plain name.',\n"
    "    '[FULL] The genre rail is yours as well as ours: a + Genre tile adds any genre you type, it is remembered, and tapping it searches that genre like any other. A long press on a genre you added asks before taking it away; the ones that came with the app stay.',\n"
    "    '[FULL] Recommended now asks the AI for songs across your genres - including the ones you added - and offers what it names as results, with the artist and the length, ready to add. Without a key it recommends from the rail and says so.',\n"
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
    print('patch-80618: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80618: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80618: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
