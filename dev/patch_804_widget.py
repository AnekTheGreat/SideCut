"""80.4, section 4 - the widget's cover, rounded by the app.

The owner's ask, verbatim:

    "make the track art thing on the widgit slightly rounded and nice"

WHY THIS IS DONE IN THE PAGE. The widget is a RemoteViews layout in the APK: an
ImageView that scales a bitmap and cannot clip it, so "rounded corners" is not a
setting it has and this release cannot rebuild the APK to give it one. What it
CAN do is draw whatever bitmap it is handed - so the app draws the corners before
the bitmap leaves.

WHAT THIS DOES. `scRoundArtDataUrl()` takes the cover data URL the widget push was
already sending, draws it cover-fit into a 256 px square with an 18% corner radius,
and returns a PNG data URL of that. Every path in pushWidgetState - a blob cover, a
remote cover, a cached one - goes through it, because it wraps `send` rather than
each of the three call sites. The result is cached per source URL (a dozen entries,
oldest dropped) so a heartbeat does not redraw the same cover ten times.

WHAT IT COSTS. One canvas and one drawImage per track change, off the main paint
path, and a PNG that is smaller than the JPEG it replaces at this size. A track
that fails to load falls back to the original URL, which is what the widget drew
before - a rectangular cover is a worse look, not a broken widget.

The widget PREVIEW in Settings > Widget draws the same 18% radius, so the picture
in the app matches the picture on the home screen.

Imported by dev/patch-804.py; holds constants only.
"""

# The push's own send, renamed so a wrapper can sit in front of it.
SEND_OLD = """      const send = (art) => {
        try{
          // Drop stale art from an earlier track (a slow cover fetch resolving
          // after the song already changed) so it can't overwrite the widget."""

SEND_NEW = """      const sendRaw = (art) => {
        try{
          // Drop stale art from an earlier track (a slow cover fetch resolving
          // after the song already changed) so it can't overwrite the widget."""

# The end of that function, where the wrapper is attached.
SEND_END_OLD = """        }catch(e){ window.__scWd.lastErr = String(e && e.message || e); }
      };
      if(!t){ send(''); return; }"""

SEND_END_NEW = """        }catch(e){ window.__scWd.lastErr = String(e && e.message || e); }
      };
      // 80.4 - every cover leaves through the rounder: the blob path, the remote
      // path and the cached path all call send(), and none of them had to change.
      const send = (art) => { if(!art){ sendRaw(''); return; } scRoundArtDataUrl(art, sendRaw); };
      if(!t){ send(''); return; }"""

# The rounder itself, defined just above pushWidgetState.
ROUND_ANCHOR = "  function pushWidgetState(t, playing){"

ROUND_ADD = """  // 80.4 - THE ROUNDED COVER. The widget's ImageView scales a bitmap and cannot
  // clip it, so the corners are drawn here, before the bitmap is handed over:
  // cover-fit into a 256 square with an 18% radius (46px), which is what the widget
  // preview and the cloud now bar use at their own sizes. Cached per source, and
  // a failure returns the original URL rather than nothing.
  function scRoundArtDataUrl(url, cb){
    try{
      if(!url){ cb(''); return; }
      var cache = window.__scRoundArt || (window.__scRoundArt = {});
      if(cache[url]){ cb(cache[url]); return; }
      var img = new Image();
      img.onload = function(){
        try{
          var size = 256, r = Math.round(size * 0.18);
          var c = document.createElement('canvas');
          c.width = size; c.height = size;
          var g = c.getContext('2d');
          if(!g){ cb(url); return; }
          g.save();
          g.beginPath();
          if(typeof g.roundRect === 'function'){ g.roundRect(0, 0, size, size, r); }
          else{
            g.moveTo(r, 0);
            g.lineTo(size - r, 0); g.quadraticCurveTo(size, 0, size, r);
            g.lineTo(size, size - r); g.quadraticCurveTo(size, size, size - r, size);
            g.lineTo(r, size); g.quadraticCurveTo(0, size, 0, size - r);
            g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
          }
          g.closePath();
          g.clip();
          var s = Math.max(size / img.width, size / img.height);
          var w = img.width * s, h = img.height * s;
          g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          g.restore();
          var out = c.toDataURL('image/png');
          // A dozen covers is more than a listening session needs and small enough
          // that the cache cannot grow with the library.
          var keys = Object.keys(cache);
          if(keys.length > 12) delete cache[keys[0]];
          cache[url] = out;
          cb(out);
        }catch(_eDraw){ cb(url); }
      };
      img.onerror = function(){ cb(url); };
      img.src = url;
    }catch(_eRound){ cb(url); }
  }
  function pushWidgetState(t, playing){"""

# The preview's 64px art tile: the same 18% radius the widget will draw.
PREVIEW_OLD = "'<div style=\"width:64px; height:64px; border-radius:10px; background:linear-gradient(135deg,#3a3f4b,#22252c); margin-bottom:10px;\"></div>' +"

PREVIEW_NEW = "'<div style=\"width:64px; height:64px; border-radius:12px; background:linear-gradient(135deg,#3a3f4b,#22252c); margin-bottom:10px; overflow:hidden;\"></div>' +"
