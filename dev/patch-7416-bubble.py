# The page text dev/patch-7416.py writes, part one: THE BUBBLE and THE ROW.
#
# It lives in its own file for a reason worth stating: the machine that prepares
# this release has no git credentials, so every byte of the page patch travels by
# hand, one API call per file. A 14 KB patch script is one call that can be cut off
# mid-flight - this one was - and a call that is cut off is a release that does not
# ship. Two files of four kilobytes cannot be.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7416.py's globals.

# 1. The bubble itself: the state, the two readings and the markup, inserted just
#    above the function that draws the rows, so they live in the same scope as the
#    cleaner they describe.
STORAGE_ANCHOR = "  function storageHtml(){\n"

INFO_HELPERS = """  // 74.1.6 - the cleaner row is a door. A row is one line of a 24-row list, so its
  // name and its artist are clipped with an ellipsis to fit beside the button - and
  // the exact size is squeezed into that same clipped line. The two things this
  // screen was asked for, the whole artist and the size in MB, are therefore the
  // two the row cannot show in full. The bubble under the row shows them whole, and
  // answers the rest while it is open: the length, the album, the bitrate the file
  // reads at, and what the button beside it would win.
  var scInfoId = '';
  function scInfoLine(label, value){
    return '<div class="sc-info-line"><span>' + label + '</span><b>' + value + '</b></div>';
  }
  // The file's own reading of its bitrate: bytes x 8 / seconds. Nothing here reads a
  // tag, because an MP3 tag can say anything - this is how the file sizes up, which
  // is the same thing the size in MB is saying, in the unit people ask about.
  function scInfoKbps(t){
    try{
      if(!t || !t.file || !t.file.size || !t.duration) return 0;
      var kbps = Math.round((t.file.size * 8) / t.duration / 1000);
      return (kbps > 0 && kbps < 2000) ? kbps : 0;
    }catch(e){ return 0; }
  }
  function scInfoHtml(t, size){
    var saved = scEstSaved(t, reenKbps);
    var kbps = scInfoKbps(t);
    var lines = scInfoLine('Size on this phone', scMb(size));
    if(t.duration) lines += scInfoLine('Length', secToClock(t.duration));
    if(t.album) lines += scInfoLine('Album', esc(t.album));
    if(kbps) lines += scInfoLine('The file reads', 'about ' + kbps + ' kbps');
    lines += scInfoLine('Re-encode at ' + reenKbps + ' kbps', saved ? 'wins back ' + scMb(saved) : 'nothing to win');
    return '<div class="sc-info" data-info="' + esc(t.id) + '">' +
      '<div class="sc-info-name">' + esc(t.name || 'Untitled') + '</div>' +
      '<div class="sc-info-artist">' + esc(t.artist || 'Unknown artist') + '</div>' +
      '<div class="sc-info-lines">' + lines + '</div>' +
      (t.reencoded ? '<div class="sc-info-tag">Already re-encoded by the cleaner</div>' : '') +
      '</div>';
  }
"""

# 2. The row: the whole left of it becomes the tap target, and the open row carries
#    its own bubble underneath. The Re-encode button stays exactly where it was - it
#    is a separate control and still does its own thing.
ROW_START = "    html += '<div class=\"sc-store-list\">' + rows.map(function(r){\n"
# The END marker is the two lines that follow the row builder: its own last line is
# not unique in a 3.2 MB page (other lists close the same way), and a marker that
# matched twice would let this rewrite the wrong block.
ROW_END = "    }).join('') + '</div>';\n    if(measured.length > 24 || scStoreAll){\n"

ROW_NEW = """    html += '<div class="sc-store-list">' + rows.map(function(r){
      var t = r.t;
      var big = r.size > 8 * 1048576;
      var estSaved = scEstSaved(t, reenKbps);
      var open = scInfoId === t.id;
      // The cover, the name and the line under it are ONE button, so the tap a person
      // aims at the song name lands on the song. A button rather than a click handler
      // on the row, so a keyboard and a screen reader reach it too; aria-expanded says
      // whether its own bubble is showing. The Re-encode button is a second control
      // beside it and keeps its own job.
      return '<div class="sc-store-row' + (open ? ' open' : '') + '">' +
        '<button class="sc-store-hit" data-act="storeinfo" data-id="' + esc(t.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="sc-art sm" style="' + (t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></span>' +
        '<span class="sc-store-txt"><span class="sc-store-name">' + esc(t.name || 'Untitled') + '</span>' +
        '<span class="sc-store-sub">' + esc(t.artist || 'Unknown artist') + ' \\u00b7 ' + scMb(r.size) + (estSaved ? ' \\u00b7 re-encode wins ~' + scMb(estSaved) : '') + (t.reencoded ? ' \\u00b7 already re-encoded' : '') + '</span></span>' +
        '</button>' +
        '<button class="sc-btn tiny' + (big ? ' primary' : '') + '" data-reenc="' + esc(t.id) + '">Re-encode</button>' +
        '</div>' +
        (open ? scInfoHtml(t, r.size) : '');
    }).join('') + '</div>';
    if(measured.length > 24 || scStoreAll){
"""

# The row's own lines are clipped by these rules; the bubble's are not clipped at
# all, which is the whole point of opening it.
CSS_ANCHOR = ".sc-store-sub{ font-size: 10.5px; color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n"

CSS_NEW = CSS_ANCHOR + """.sc-store-hit{ flex: 1; min-width: 0; display: flex; gap: 10px; align-items: center; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.sc-store-hit .sc-store-txt{ display: block; flex: 1; min-width: 0; }
.sc-store-row.open{ border-color: var(--ink-dim); }
.sc-info{ margin: -2px 0 4px 42px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg-raised); }
.sc-info-name{ font-size: 12.5px; font-weight: 600; white-space: normal; }
.sc-info-artist{ font-size: 11.5px; color: var(--ink-dim); margin-top: 2px; white-space: normal; }
.sc-info-lines{ margin-top: 8px; display: flex; flex-direction: column; gap: 3px; }
.sc-info-line{ display: flex; justify-content: space-between; gap: 10px; font-size: 11.5px; color: var(--ink-dim); }
.sc-info-line b{ color: var(--ink); font-weight: 600; text-align: right; }
.sc-info-tag{ margin-top: 6px; font-size: 11px; color: var(--ink-dim); }
"""

# 3. The action the new button asks for: one bubble at a time, and the same row
#    closes the one it opened.
ACT_OLD = """        else if(act === 'storeall'){ scStoreAll = !scStoreAll; renderStudio(); }
"""
ACT_NEW = """        else if(act === 'storeall'){ scStoreAll = !scStoreAll; renderStudio(); }
        else if(act === 'storeinfo'){ var _sid = b.getAttribute('data-id') || ''; scInfoId = (scInfoId === _sid ? '' : _sid); renderStudio(); }
"""
