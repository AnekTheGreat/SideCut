"""80.5.1 - the web page's version row points at the full web app.

80.5 put the converters behind `?full` and left a card in Discover saying where
they went. This is the second half of that: the place a reader actually goes to
find out WHICH BUILD THEY ARE RUNNING is Settings -> More -> About & updates, the
row that carries `SideCut v80.5.1 - Web build - your files only`. If that row is
where the question is asked, that row is where the answer belongs.

WHAT IT IS. One link appended to that card, on the web page only, when that page
is NOT in full mode: "Open the full web app" with the one line that explains the
difference ("the same page with the song tools"). It is an `<a href="./full/">`,
not a script navigation, so the browser's own affordances work - long-press to
copy the address, open in a new tab, the back button - and the door at /full/
turns it into `../?full=1`.

WHY IT IS GATED THE WAY IT IS. `SC_IS_WEB && SC_IS_PLAY` is exactly "a browser,
not in full mode": the store AAB and the sideloaded APK are both `SC_IS_WEB` false,
and a web page opened with `?full` has `SC_IS_PLAY` false because it already has
the tools. So the row can never appear in an installed build - which matters,
because a store build that links to a page full of converters is the swap its
review was about.

Imported by dev/patch-8051.py; holds constants only.
"""

# The line the block goes in front of. It is the comment that opens the version
# stamp, right after the label is written, so the link is created in the one place
# the app already knows which build it is.
ANCHOR = """      // Confirm the bundle from the app itself, not only from the OTA client: a"""

BLOCK = r'''      // 80.5.1 - THE WEB PAGE'S VERSION ROW KNOWS WHERE THE FULL BUILD IS. A browser
      // that opens the page without `?full` gets the build for the files you already
      // have, and "where did the tools go" is the one question that page creates.
      // About & updates is where a reader checks which build is running, so the
      // answer sits in it: one link to ./full/. WEB ONLY, and only without full
      // mode - the store build never renders it, so an installed copy still points
      // at nothing it does not carry.
      try{
        if(SC_IS_WEB && SC_IS_PLAY){
          var _about = document.getElementById('collapsibleAboutContent');
          if(_about && !document.getElementById('scFullWebRow')){
            var _fullRow = document.createElement('a');
            _fullRow.id = 'scFullWebRow';
            _fullRow.href = './full/';
            _fullRow.style.cssText = 'display:block; margin-top:8px; padding:10px 12px; border-radius:10px;'
              + ' border:1px solid color-mix(in srgb, var(--coral) 42%, var(--line));'
              + ' background:color-mix(in srgb, var(--coral) 9%, transparent);'
              + ' color:var(--ink); text-decoration:none; font-size:12px; line-height:1.5;';
            _fullRow.innerHTML = '<b style="color:var(--coral);">Open the full web app \u2197</b>'
              + '<span style="display:block; font-size:11px; color:var(--ink-dim); margin-top:3px;">'
              + 'This page is the build for the files you already have. The full web app is the same '
              + 'page with the song tools \u2014 one tap, nothing to install.</span>';
            _about.appendChild(_fullRow);
          }
        }
      }catch(_eScFullRow){}
'''

# The changelog note. It has to survive the no-tools filter (this is the build the
# note is for), so it names no converter, no download and no source: it describes
# a row and a link.
CHANGELOG_TITLE = 'The web page About row opens the other build in one tap'

CHANGELOG_ITEM = ('On the web page, <b>About &amp; updates</b> now ends with a link to the '
                  '<b>other build</b> \u2014 the same page, one tap \u2014 '
                  'so the address is never typed or remembered.')
