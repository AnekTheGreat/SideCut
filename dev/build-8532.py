"""Build dev/video-8532.js - the 85.3.2 music video module - from dev/video-8531.js.

Every edit below is an exact slice of the 85.3.1 module and is asserted to appear
exactly once, so a later edit to the module cannot make this builder land on the
wrong place and still print success.

    python3 dev/build-8532.py
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dev", "video-8531.js")
OUT = os.path.join(ROOT, "dev", "video-8532.js")

BANNER_NEW = """  // ─── 85.3.2 - THE LADDER IS THE LADDER, AND THE RESOLVER IS ALWAYS ASKED ───────
  // THREE REPORTS, AND EACH ONE HAD A CAUSE IN THE CODE.
  //
  // THE LIST WAS NOT A LADDER. It offered whatever height a row happened to report
  // and hid everything under 360p, so 144p and 240p could not be picked at all and
  // an encode with an odd height put a number in the list that is not a size anyone
  // compares. Every height is now read as the nearest one of 144p, 240p, 360p, 480p,
  // 720p, 1080p, 1440p, 2K and 4K, every one of those the video has is listed, and
  // 2K and 4K say their own names.
  //
  // 360p WAS EVERY VIDEO AFTER THE FIRST. One refused height was written into a
  // session-wide memory, so the first video that could not open 1080p on this phone
  // taught the tab to stop asking - every song after it opened on the one-stream row
  // and stayed there. The memory is per video now: a size the phone refused is not a
  // verdict on the next song, and the list still marks it for the video it happened
  // on.
  //
  // AND THE FALLBACK WAS A CLIFF. A refusal stepped down once and then jumped to the
  // smallest row that carries its own sound, so 1080p refused was 720p and 720p
  // refused was 360p - the 480p picture was never offered. Each refusal now steps to
  // the rung directly under the one that failed.
  //
  // THE RESOLVER IS ASKED FOR EVERY VIDEO. 85.3.1 asked `scYtPlayer` only when the
  // tab's own two-client call came back under 1080p - so a call that produced a
  // 1080p row from a client whose address this phone then refused never consulted the
  // resolver, and fell down the ladder to 360p. The resolver is the call the
  // converter, the downloader and Streaming play with, so its rows are seated first
  // at their own height and the answer is kept per video.
  //
  // A TAP ON THE PICTURE ONLY BRINGS THE BAR BACK. It no longer starts a stopped
  // film either: play and pause are the round button and the big drawn button over a
  // still, which is what the bar is for.
"""

R = []


def rep(old, new, what):
    R.append((old, new, what))


rep(
    """  var SC_VFX_AMOUNT = 0.45;                // how much of the clarity pass is laid over the frame
""",
    """  var SC_VFX_AMOUNT = 0.45;                // how much of the clarity pass is laid over the frame
  // THE SIZES A VIDEO CAN HAVE. Whatever height a row reports is read as the nearest
  // one of these, so the list is the ladder a viewer knows instead of a number the
  // encode happened to land on.
  var SC_VQ_STEPS = [144, 240, 360, 480, 720, 1080, 1440, 2048, 2160];
""",
    "the size steps",
)

rep(
    """  function scVideoRungTag(h){
    h = Number(h) || 0;
    if(h >= 2160) return '4K';
    if(h >= 1440) return '2K';
    if(h >= 1080) return 'FULL HD';
    if(h >= 720) return 'HD';
    return 'SD';
  }
""",
    """  function scVideoRungTag(h){
    h = Number(h) || 0;
    if(h >= 2160) return '4K';
    if(h >= 2048) return '2K';
    if(h >= 1440) return 'QHD';
    if(h >= 1080) return 'FULL HD';
    if(h >= 720) return 'HD';
    return 'SD';
  }
  // THE SIZES HAVE NAMES. 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2K and 4K are
  // the ladder. A height that is not one of them is read as the nearest one that is,
  // because a list of in-between numbers is a list nobody can compare.
  function scVideoStd(h){
    h = Number(h) || 0;
    if(!h) return 0;
    var best = SC_VQ_STEPS[0];
    for(var i = 0; i < SC_VQ_STEPS.length; i++){
      var s = SC_VQ_STEPS[i];
      if(Math.abs(s - h) < Math.abs(best - h)) best = s;
    }
    return best;
  }
  function scVideoSizeLabel(h){
    h = Number(h) || 0;
    if(!h) return '';
    if(h >= 2160) return '4K';
    if(h >= 2048) return '2K';
    return h + 'p';
  }
""",
    "the rung tag",
)

rep(
    """    function seat(row, isMux){
      var h = Number(row && row.h) || 0;
      if(!h || h < 144) return;
""",
    """    function seat(row, isMux){
      var raw = Number(row && row.h) || 0;
      var h = scVideoStd(raw);
      if(!h || h < 144) return;
      row.rawH = raw;
""",
    "the ladder seat",
)

rep(
    """        if(!!x.muxed !== !!y.muxed) return (y.muxed ? 1 : 0) - (x.muxed ? 1 : 0);
        var c = scVideoCodecRank(x.mime) - scVideoCodecRank(y.mime);
""",
    """        if(!!x.muxed !== !!y.muxed) return (y.muxed ? 1 : 0) - (x.muxed ? 1 : 0);
        // THE APP'S OWN RESOLVER WINS A TIE. It is the call the downloader and the
        // converter play with, so an address from it is the one measured to open here.
        if(!!x.app !== !!y.app) return (x.app ? 0 : 1) - (y.app ? 0 : 1);
        var c = scVideoCodecRank(x.mime) - scVideoCodecRank(y.mime);
""",
    "the rung order",
)

rep(
    """        h: b.h, label: b.h + 'p', tag: scVideoRungTag(b.h),
""",
    """        h: b.h, label: scVideoSizeLabel(b.h), tag: scVideoRungTag(b.h),
""",
    "the rung label",
)

rep(
    """    function take(list, into, kind){
""",
    """    function take(list, into, kind, app){
""",
    "the row intake",
)

rep(
    """        into.push({ url: u, mime: String(f.mimeType), itag: Number(f.itag) || 0, size: size,
                    h: scVideoHeight(f), bits: Number(f.bitrate) || 0 });
""",
    """        into.push({ url: u, mime: String(f.mimeType), itag: Number(f.itag) || 0, size: size,
                    h: scVideoHeight(f), bits: Number(f.bitrate) || 0, app: !!app });
""",
    "the row",
)

rep(
    """      var own = assemble();
      // FULL HD HAS TO REACH THE LIST. A client that answers with only the muxed 360p
      // row has not answered, so the sizes are asked of the app's resolver and its
      // picture rows are seated in the same ladder.
      if(own && own.rungs[0] && own.rungs[0].h >= SC_VQ_DEFAULT) return own;
      return scVideoAppRows(videoId).then(function(app){
        if(!app) return own;
        take(app.videos, adaptive, 'video');
        if(!snd && app.snd) snd = scVideoSnd(app.snd);
        var merged = assemble();
        if(!merged) return own;
        if(!own) return merged;
        return (merged.rungs[0].h > own.rungs[0].h) ? merged : own;
      }).catch(function(){ return own; });
""",
    """      var own = assemble();
      // THE APP'S RESOLVER IS ASKED FOR EVERY VIDEO, not only when this call came
      // back short. It is the call the converter, the downloader and Streaming play
      // with, so its addresses are the measured ones - and asking it unconditionally
      // is what stops a ladder that has a 1080p row on it from playing as 360p
      // because the 1080p row that reached it could not be opened on this phone. One
      // request per video is kept, so a size change or a NEXT does not pay again.
      var key = String(videoId || '');
      var have = (key && scVideoState.app) ? scVideoState.app[key] : null;
      return (have ? Promise.resolve(have) : scVideoAppRows(videoId)).then(function(app){
        if(app && key && scVideoState.app) scVideoState.app[key] = app;
        if(app && app.videos && app.videos.length){
          take(app.videos, adaptive, 'video', true);
          if(!snd && app.snd) snd = scVideoSnd(app.snd);
        }
        var merged = assemble();
        return merged || own;
      }).catch(function(){ return own; });
""",
    "the resolver fallback",
)

rep(
    """    // NOTHING UNDER 360p IS AN OFFER. Those rows exist in every answer as the floor
    // of a bad connection, and listing them beside FULL HD is half of why the list
    // read as a set of random sizes. They are still landed on as a last resort.
    var shown = rungs.filter(function(r){ return r.h >= 360; });
    if(!shown.length) shown = rungs;
    shown.forEach(function(r){
""",
    """    // EVERY SIZE THE VIDEO HAS IS ON THE LIST. The rows under 360p used to be
    // hidden as "the floor of a bad connection", which left a viewer who wanted 144p
    // or 240p with no way to pick one. The ladder is the ladder.
    rungs.forEach(function(r){
""",
    "the list filter",
)

rep(
    """    var pool = scVideoLive(scVideoState.rungs);
    if(!pool.length) pool = scVideoState.rungs;
    var def = null;
    if(!(Number(scVideoState.drops) > 0)){
      def = scVideoRungBelow(pool, scVideoState.rung ? scVideoState.rung.h : 0);
      if(def) scVideoState.drops = 1;
    }
    if(!def) def = scVideoDefault(pool);
""",
    """    var pool = scVideoLive(scVideoState.rungs);
    if(!pool.length) pool = scVideoState.rungs;
    // ONE STEP AT A TIME, ALL THE WAY DOWN. The first refusal took the rung under the
    // one that failed and the second jumped to the one-stream row, so a phone that
    // refused 1080p and 720p was never offered the 480p picture it could open. Every
    // refusal now steps to the rung directly under the one that failed, and only the
    // bottom of the ladder is the one-stream fallback.
    var def = null;
    if(Number(scVideoState.drops) < 4){
      def = scVideoRungBelow(pool, scVideoState.rung ? scVideoState.rung.h : 0);
      if(def) scVideoState.drops = Number(scVideoState.drops) + 1;
    }
    if(!def) def = scVideoDefault(pool);
""",
    "the fallback road",
)

rep(
    """    scVideoState.drops = 0;
    scVideoState.retries = 0;
    scVideoState.want = scVideoWant();
""",
    """    scVideoState.drops = 0;
    scVideoState.retries = 0;
    // A SIZE ONE VIDEO REFUSED IS NOT A VERDICT ON THE NEXT. This memory was kept for
    // the whole session, so the first video that could not open 1080p here made every
    // song after it open on 360p. It belongs to the video it happened on.
    scVideoState.deadH = {};
    scVideoState.want = scVideoWant();
""",
    "the load reset",
)

rep(
    """        scVideoBig(false); scVideoSpin(false); scVideoSay(''); scVideoBarState();
""",
    """        scVideoBig(false); scVideoSpin(false); scVideoSay(''); scVideoBarState();
        scVideoState.drops = 0;              // a picture that plays has used no steps
""",
    "the playing event",
)

rep(
    """      if(scVideoIdleWake()) return;
      var q = scVideoEl('scVideoQ');
      if(q && q.classList.contains('on')){ scVideoQualityToggle(false); return; }
      scVideoPictureTap();
""",
    """      var q = scVideoEl('scVideoQ');
      if(q && q.classList.contains('on')){ scVideoQualityToggle(false); return; }
      scVideoPictureTap();
""",
    "the stage click",
)

rep(
    """  function scVideoPictureTap(){
    var v = scVideoEl('scVideoEl');
    if(!v || !v.src){ if(scVideoState.open) scVideoStart(scVideoState.last || scVideoTrack()); return; }
    if(scVideoIdleWake()) return;
    if(v.paused || v.ended) scVideoTap();
  }
""",
    """  function scVideoPictureTap(){
    // ONLY THE BAR. A tap on the film used to reach the play/pause, so looking at the
    // picture stopped it; it brings the mini bar back and does nothing else. Play and
    // pause belong to the round button, and to the big drawn button over a still.
    scVideoIdleWake();
  }
""",
    "the picture tap",
)

rep(
    """        lines.push('This video has no ' + scVideoState.want + 'p - it tops out at ' + top + 'p.');
""",
    """        lines.push('This video has no ' + scVideoSizeLabel(scVideoState.want) +
                   ' - it tops out at ' + scVideoSizeLabel(top) + '.');
""",
    "the tops-out note",
)

rep(
    """    deadH: {}, songKey: '', loadSeq: 0, openedAt: 0, coverOn: false,
""",
    """    deadH: {}, app: {}, songKey: '', loadSeq: 0, openedAt: 0, coverOn: false,
""",
    "the resolver cache",
)


def main():
    src = io.open(SRC, encoding="utf-8").read()
    out = src
    # The banner is replaced as a whole: everything from the first banner line to the
    # blank line before `var scVideoState`.
    head = out.index("  // ─── 85.3.1 - ")
    cut = out.index("  var scVideoState = {")
    out = out[:head] + BANNER_NEW + "\n" + out[cut:]
    for old, new, what in R:
        n = out.count(old)
        if n != 1:
            raise SystemExit("build-8532: %s appears %d times, expected exactly 1" % (what, n))
        out = out.replace(old, new, 1)
    # What the release promises has to be in the module that ships.
    for mark in ("var SC_VQ_STEPS", "function scVideoStd", "scVideoSizeLabel",
                 "scVideoState.app[key]", "scVideoState.deadH = {};",
                 "scVideoState.drops = Number(scVideoState.drops) + 1"):
        if mark not in out:
            raise SystemExit("build-8532: the module lacks %r" % mark)
    if "scVideoRungBelow(pool, scVideoState.rung ? scVideoState.rung.h : 0);" not in out:
        raise SystemExit("build-8532: the fallback road is not stepped")
    if "if(v.paused || v.ended) scVideoTap();" in out:
        raise SystemExit("build-8532: the picture tap still reaches the play/pause")
    io.open(OUT, "w", encoding="utf-8").write(out)
    print("wrote %s (%d lines)" % (os.path.relpath(OUT, ROOT), out.count("\n")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
