
#!/usr/bin/env python3
"""80.2 - the cloud layout, tidied.

The owner, looking at the phone: "THE CIRCLES NEED TO BE MORE WELL OPTIMIZED THINGS
ARE LOOKING WEIRD AND TABS SHOULD LEGIT JUST BE ICONS ... SHOULD KIND OF CURVE UP
BUT NICELY, IT'S NOT SMOOTH AT ALL IN THIS MODE LIKE IT SHOULD BE AND IN THE NOW BAR
THERE SHOULD BE LYRICS OPTIONS STILL, IN ALBUMS AND PLAYLISTS A WHOLE PART GETS LIKE
TURNS THEME MATCHING BLUE AT THE BOTTOM WHICH WASTES SPACE ... JUST MAKE THIS MODE
BETTER."

Four changes, one page block, appended after 80.1's so every 80.1 rule still holds
unless this block says otherwise:

  1. THE BUBBLES HOLD THEIR OWN WORDS. The wall is a two-column grid; a bubble is a
     column (icon, value, label) with the label clamped, instead of an absolutely
     placed icon landing on the first line of the value.
  2. THE FLIGHT IS A CURVE OF ICON TILES. Five 46px tiles, equal and separate, lifted
     0/6/16/28/42px so the row rises smoothly to the plus; one glyph per tab, and the
     split treads' two icons stop painting.
  3. LYRICS IS BACK IN THE BAR, as an icon button injected into #npControls and wired
     to the same #lyricsBtn.
  4. THE VIEWS STOP RESERVING A BAND OF EMPTY THEME COLOUR. They keep the bar and a
     breath (12px) instead of the bar plus the whole 86px rail, and the flight floats
     over the corner.

Smoother, in the same block: the bubbles lose the 7.5s float animation and the flight
tiles lose their per-tile backdrop blur.

Idempotent: the marker is the 80.2 banner in the page.

    python3 dev/patch-802.py
    python3 dev/patch-802.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2'
MARKER = '/* ---------- 11. 80.2: the cloud layout, tidied'

CSS_ANCHOR = '/* ---------- 5. Bigger screens, foldables, landscape ---------- */'
JS_ANCHOR = '</body>'

CSS_BLOCK = r'''/* ---------- 11. 80.2: the cloud layout, tidied ------------------------------ */
/* "THE CIRCLES NEED TO BE MORE WELL OPTIMIZED THINGS ARE LOOKING WEIRD AND TABS
   SHOULD LEGIT JUST BE ICONS ... SHOULD KIND OF CURVE UP BUT NICELY, IT'S NOT
   SMOOTH AT ALL IN THIS MODE LIKE IT SHOULD BE AND IN THE NOW BAR THERE SHOULD BE
   LYRICS OPTIONS STILL, IN ALBUMS AND PLAYLISTS A WHOLE PART GETS LIKE TURNS THEME
   MATCHING BLUE AT THE BOTTOM WHICH WASTES SPACE ... JUST MAKE THIS MODE BETTER."

   1. THE BUBBLES DID NOT HOLD THEIR OWN WORDS. .hb-ico was placed absolutely at the
      bubble's centre, 128% of its own height up, so on a 172px circle the icon
      landed on the first line of the value - a headphone on top of "0m" - and a
      two-line label pushed the value back up into it. The wall is a two-column grid
      now and a bubble is a COLUMN: icon, value, label, clamped. Every bubble is the
      same circle, whatever "wide" or "tall" the template asks for, and the two
      resize controls that were fighting the label have corners of their own.
   2. THE FLIGHT WAS A RECTANGULAR STAIRCASE. Five 46px treads joined edge to edge,
      each a hard step taller than the one before, with a hairline across every one.
      It is five icon tiles now, equal and separate, lifted along a curve - 0, 6, 16,
      28, 42px - so the row rises smoothly to the plus instead of stepping there.
      ONE GLYPH A TAB: the split treads keep both of their tap targets, but they no
      longer paint two icons inside one tile.
   3. LYRICS WAS MISSING FROM THE BAR. The cloud bar hides the second np row, and the
      LYRICS pill lived in it. A compact icon button is injected into #npControls and
      clicks the same #lyricsBtn, so there is one handler and one place to fix.
   4. THE BAND UNDER ALBUMS AND PLAYLISTS. Every view reserved the bar AND the whole
      86px rail under it - 146px of empty page that, in a theme with a coloured
      background, is a band of theme colour under every list. The views reserve the
      bar and a breath now; the flight floats over the corner instead.

   AND IT IS SMOOTHER. Six 172px circles floating on a 7.5s loop is a repaint every
   frame while the list underneath scrolls, and five backdrop blurs stacked over a
   moving list is the rest of the dropped frames. Both are gone; the tiles are plain
   surfaces with a shadow. */

/* 1. THE WALL. Two equal columns, one circle each, and the content is a column. */
body.sc80-cloud #homeBubbles{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:16px 14px;
  /* The wall keeps its own bottom air: a circle is 172px tall and a row of them
     under the flight is a whole bubble lost. The LISTS need no such air - a row
     under the tiles still reads - which is why the band came off the views and
     stayed off the wall. */
  padding:6px 0 92px;
  align-items:start;
  justify-items:stretch;
}
body.sc80-cloud #homeBubbles > .home-bubble{
  width:100%; max-width:none; min-height:0 !important;
  height:auto; aspect-ratio:1 / 1;
  grid-column:auto;
  border-radius:50%;
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  gap:2px;
  padding:15% 12%;
  overflow:hidden;
  text-align:center;
  transform:none;
  animation:none;
  background:
    radial-gradient(circle at 34% 26%, color-mix(in srgb, var(--coral) 16%, transparent), transparent 60%),
    linear-gradient(158deg, color-mix(in srgb, var(--bg-raised) 96%, transparent), color-mix(in srgb, var(--bg-raised) 76%, #000));
  box-shadow:0 12px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06);
}
body.sc80-cloud #homeBubbles > .home-bubble.gold-bubble{
  background:
    radial-gradient(circle at 34% 26%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 60%),
    linear-gradient(158deg, color-mix(in srgb, var(--bg-raised) 96%, transparent), color-mix(in srgb, var(--bg-raised) 76%, #000));
}
/* The icon is a flex item now, above the value, not an absolute layer over it. */
body.sc80-cloud #homeBubbles > .home-bubble .hb-ico{
  position:static; top:auto; left:auto;
  transform:none;
  width:30px; height:30px;
  margin:0 0 6px;
  flex:0 0 auto;
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-value{
  font-size:clamp(15px, 4.4vw, 20px);
  line-height:1.12;
  letter-spacing:-0.2px;
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-label{
  font-size:10.5px; line-height:1.32;
  margin-top:1px; max-width:98%;
  display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
  overflow:hidden;
}
/* The corner controls, off the text: the resize chip top right, Ask top left, the
   play button and the three header buttons on the bottom rim. */
body.sc80-cloud #homeBubbles > .home-bubble .hb-hint{ display:none; }
body.sc80-cloud #homeBubbles > .home-bubble .hb-expand{
  top:15%; right:15%; width:22px; height:22px; opacity:0.28;
}
body.sc80-cloud #homeBubbles > .home-bubble .hb-ask{
  top:15%; left:15%; right:auto;
}
/* The play button and the three header buttons are IN the column, under the label,
   not on top of it - they used to sit on the second line of the label. */
body.sc80-cloud #homeBubbles > .home-bubble .hb-miniplay{
  position:static; bottom:auto; right:auto;
  transform:none;
  order:9; margin-top:5px;
  width:30px; height:30px;
}
body.sc80-cloud #sc80CloudCtl{
  position:static;
  top:auto; bottom:auto; right:auto;
  transform:none;
  order:9;
  margin-top:5px;
  justify-content:center;
}
/* A tablet gets the same circles, more to a row. */
@media (min-width:600px){
  body.sc80-cloud #homeBubbles{ grid-template-columns:repeat(3, minmax(0, 1fr)); }
}
@media (min-width:900px){
  body.sc80-cloud #homeBubbles{ grid-template-columns:repeat(4, minmax(0, 1fr)); }
}

/* 2. THE FLIGHT. Equal tiles, one glyph, lifted along a curve. */
body.sc80-cloud{ --sc11-tile:44px; --sc11-gap:8px; }
body.sc80-cloud .action-strip{
  left:auto; right:12px;
  top:auto; bottom:calc(var(--sc10-bar) + 10px);
  width:auto; max-width:none; height:auto;
  margin:0; padding:0;
  display:flex; flex-direction:row;
  align-items:flex-end; justify-content:flex-end;
  gap:var(--sc11-gap);
  border:none; border-radius:0;
  background:none;
  -webkit-backdrop-filter:none; backdrop-filter:none;
  box-shadow:none;
  pointer-events:none;
  z-index:45;
}
/* A soft scrim under the flight: the list keeps scrolling beneath it, and the row
   under the tiles fades into the page instead of arguing with them. */
body.sc80-cloud .action-strip::before{
  content:'';
  position:absolute;
  left:-18px; right:-18px; bottom:-12px;
  height:calc(100% + 26px);
  border-radius:26px;
  background:linear-gradient(to top,
    color-mix(in srgb, var(--bg) 88%, transparent) 34%,
    color-mix(in srgb, var(--bg) 46%, transparent) 66%,
    transparent);
  z-index:-1;
  pointer-events:none;
}
body.sc80-cloud .action-strip > #homeBtn,
body.sc80-cloud .action-strip > #libraryBtn,
body.sc80-cloud .action-strip > #discoverBtn,
body.sc80-cloud .action-strip > #studioBtn,
body.sc80-cloud .action-strip > #dockAddBtn{
  position:relative;
  pointer-events:auto;
  flex:0 0 var(--sc11-tile);
  width:var(--sc11-tile); height:var(--sc11-tile); min-height:0;
  margin:0; padding:0;
  display:flex; align-items:center; justify-content:center;
  border-radius:16px;
  border:1px solid var(--line);
  border-top-color:color-mix(in srgb, var(--ink) 24%, transparent);
  background:color-mix(in srgb, var(--bg-raised) 94%, #000);
  box-shadow:0 10px 22px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.07);
  color:var(--ink-dim);
  font-size:0;
  -webkit-backdrop-filter:none; backdrop-filter:none;
  transition:transform 160ms cubic-bezier(0.2,0.9,0.2,1), background 160ms ease, color 160ms ease;
}
/* THE CURVE: 0, 6, 16, 28, 42 pixels. Equal gaps and a rising line, not five steps. */
body.sc80-cloud .action-strip > #homeBtn{ transform:translateY(0); }
body.sc80-cloud .action-strip > #libraryBtn{ transform:translateY(-6px); }
body.sc80-cloud .action-strip > #discoverBtn{ transform:translateY(-16px); }
body.sc80-cloud .action-strip > #studioBtn{ transform:translateY(-28px); }
body.sc80-cloud .action-strip > #dockAddBtn{ transform:translateY(-42px); }
body.sc80-cloud .action-strip > button:active{ filter:brightness(1.12); }
/* ONE GLYPH A TAB, painted over whatever the button holds. */
body.sc80-cloud .action-strip > #homeBtn::before,
body.sc80-cloud .action-strip > #libraryBtn::before,
body.sc80-cloud .action-strip > #discoverBtn::before,
body.sc80-cloud .action-strip > #studioBtn::before{
  content:''; display:block;
  position:absolute; left:50%; top:50%;
  width:22px; height:22px;
  transform:translate(-50%,-50%);
  background-color:currentColor;
  -webkit-mask-image:var(--sc89-icon);
  -webkit-mask-position:center;
  -webkit-mask-size:22px 22px;
  -webkit-mask-repeat:no-repeat;
  mask-image:var(--sc89-icon);
  mask-position:center;
  mask-size:22px 22px;
  mask-repeat:no-repeat;
}
body.sc80-cloud #libraryBtn{
  --sc89-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 5h11v2H4zm0 6h11v2H4zm0 6h11v2H4zM18 5h2v2h-2zm0 6h2v2h-2zm0 6h2v2h-2z'/%3E%3C/svg%3E");
}
body.sc80-cloud #studioBtn{
  --sc89-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 4h2.4v16H6zm4.8 5h2.4v11h-2.4zm4.8-3h2.4v14h-2.4z'/%3E%3C/svg%3E");
}
/* The two halves stay tappable - two things in one tab - but they stop painting. */
body.sc80-cloud #libraryBtn > div,
body.sc80-cloud #studioBtn > div{
  opacity:0;
  padding:0 !important;
}

/* 3. LYRICS, BACK IN THE BAR. */
#sc11Lyrics{
  display:none;
  align-items:center; justify-content:center;
  width:32px; height:32px;
  padding:0; border:none; background:none;
  color:var(--ink-dim);
  cursor:pointer;
}
#sc11Lyrics svg{ width:18px; height:18px; }
body.sc80-cloud #npControls #sc11Lyrics{ display:flex; }
body.sc80-cloud #npControls #sc11Lyrics:active{ color:var(--coral); }

/* 4. THE BAND IS GONE. The bar, and a breath - the flight floats over the corner. */
body.sc80-cloud #homeView,
body.sc80-cloud #library,
body.sc80-cloud #discoverView,
body.sc80-cloud #studioView{
  padding-right:0;
  padding-bottom:calc(var(--sc10-bar) + 12px);
  scroll-padding-bottom:calc(var(--sc10-bar) + 12px);
}
/* The bar keeps some glass, less of the blur that has to be recomputed on scroll. */
body.sc80-cloud #nowPlaying{
  -webkit-backdrop-filter:blur(10px) saturate(1.15);
  backdrop-filter:blur(10px) saturate(1.15);
}
@media (prefers-reduced-motion: reduce){
  body.sc80-cloud .action-strip > button{ transition:none; }
}

'''

JS_BLOCK = r'''<script>
/* 80.2 - LYRICS, BACK IN THE BAR. The cloud bar hides the second np row, and the
   LYRICS pill lived in it. A compact icon button goes into #npControls and clicks
   the same #lyricsBtn, so there is one handler and one lyrics view. */
(function(){
  function sc11AddLyrics(){
    try{
      var controls = document.getElementById('npControls');
      var menu = document.getElementById('npMenuBtn');
      if(!controls || !menu || document.getElementById('sc11Lyrics')) return;
      var b = document.createElement('button');
      b.id = 'sc11Lyrics';
      b.type = 'button';
      b.title = 'Lyrics';
      b.setAttribute('aria-label', 'Lyrics');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        var pill = document.getElementById('lyricsBtn');
        if(pill) pill.click();
      });
      menu.parentNode.insertBefore(b, menu);
    }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sc11AddLyrics);
  else sc11AddLyrics();
  window.addEventListener('load', sc11AddLyrics);
  setTimeout(sc11AddLyrics, 1200);
})();
</script>
'''

HEAD_OLD = "  { version: '80.1', date: 'October 22, 2026 \\u00b7 9:05 PM EDT', "
HEAD_NEW = (
    "  { version: '80.2', date: 'October 22, 2026 \\u00b7 10:50 PM EDT', "
    "title: 'Round bubbles that hold their words, a curve of icon tabs, and Lyrics back in the bar', items: [\n"
    "    'Every bubble on the cloud home is one circle now, and its icon, number and label sit in a column inside it instead of stacked on top of each other.',\n"
    "    'The tabs are icons and only icons: five equal tiles lifted along a curve, one glyph each, the plus at the top. The split treads keep both taps but paint one icon.',\n"
    "    'Lyrics is back in the mini bar, as an icon beside the controls.',\n"
    "    'Albums and Playlists stop reserving a band of empty theme colour under the list - the views keep the bar and a breath, and the flight floats over the corner.',\n"
    "    'It moves smoother: the bubbles no longer float in a loop and the tabs drop their per-tile blur, so scrolling the list under them stops paying for both.',\n"
    "    'Every bubble keeps its resize chip, its Ask sparkle, its play button and its three header buttons on the rim, clear of the reading.',\n"
    "    'Nothing else moved - the widget, the player, the letter covers, the lyrics view and the album pill dock are where 80.1 left them.',\n"
    "  ],\n"
    "    details: [\n"
    "      'The bubble icon used to be an absolute layer: at 128% of its own height above the middle of a 172px circle it landed on the first line of the value, which is why a headphone sat on top of \"0m\" and \"Now playing\" had a dot in it. The icon is a flex item above the value now, the label is clamped to two lines, and the resize chip, Ask, the play button and the three header buttons each have a corner of the circle.',\n"
    "      'The flight was five joined treads with a lit hairline each: a staircase of rectangles. It is five equal 46px tiles with an 8px gap, lifted 0/6/16/28/42px so the row curves up to the plus, with one painted glyph per tab - home, a stack for library, the compass, sliders for studio, and the plus.',\n"
    "      'The reserved band was `--sc10-bar + --sc10-rail + 16px` under every view: 146px of page under the last row, which is the theme colour with nothing in it. It is the bar plus 12px now, and the tiles float over the corner of the list.',\n"
    "      'The cloud bar hides the second np row by design, so Lyrics went with it. #sc11Lyrics is injected into #npControls before the ... menu and clicks the LYRICS pill, so the lyric view, its saved-versus-online behaviour and its offline fallback are the same code.',\n"
    "    ],\n"
    "  },\n"
) + HEAD_OLD


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and (("const APP_VERSION = '%s';" % VERSION) in page):
        print('  present: the 80.2 block and the page runs as ' + VERSION)
        print('patch-802%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    bad = []
    if page.count(CSS_ANCHOR) != 1:
        bad.append('the bigger-screens banner (%d)' % page.count(CSS_ANCHOR))
    if page.count(JS_ANCHOR) != 1:
        bad.append('the closing body tag (%d)' % page.count(JS_ANCHOR))
    if page.count(HEAD_OLD) != 1:
        bad.append('the 80.1 changelog head (%d)' % page.count(HEAD_OLD))
    if "const APP_VERSION = '80.1';" not in page:
        bad.append('the version')
    if "'sidecut-shell-v80.1'" not in sw:
        bad.append('the shell cache')
    if bad:
        sys.exit('patch-802: the page is not the shape this release expects (%s)' % ', '.join(bad))
    if CHECK:
        print('patch-802 --check: the release is pending, 5 steps to apply')
        return 1
    page = page.replace(CSS_ANCHOR, CSS_BLOCK + CSS_ANCHOR, 1)
    page = page.replace(JS_ANCHOR, JS_BLOCK + JS_ANCHOR, 1)
    page = page.replace(HEAD_OLD, HEAD_NEW, 1)
    page = page.replace("const APP_VERSION = '80.1';", "const APP_VERSION = '%s';" % VERSION, 1)
    open(page_path, 'w', encoding='utf-8').write(page)
    sw = sw.replace("'sidecut-shell-v80.1'", "'sidecut-shell-v%s'" % VERSION, 1)
    open(sw_path, 'w', encoding='utf-8').write(sw)
    print('  applied: the 80.2 block, the lyrics button, the changelog head, the version and the shell cache')
    print('patch-802: 5 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
