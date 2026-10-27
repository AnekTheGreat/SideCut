"""80.3.3, sections 4 and 5 - one source, one song, and a reason per song.

The claim on an upload moves BEFORE the download (several songs are in flight at once, so
a ledger written after the decode let two tracks take the same upload), and a song's
failure reason gets its own sink instead of one window-wide slot.

Imported by dev/patch-8033.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 4. One source, one song: the claim moves before the download
# ---------------------------------------------------------------------------
CLAIM_FN = r"""  // One upload serves one song, and in a batch several songs are in flight at once, so
  // the ledger is written BEFORE the download rather than after the decode: two
  // siblings used to be able to pick the same upload while neither had recorded it
  // yet, and the same audio was filed under two titles. A refusal means another song of
  // this run already holds that upload and the caller moves to its next candidate.
  function scSourceClaim(used, videoId, titleKey){
    if(!used || !videoId || !titleKey) return true;
    var held = used[videoId];
    if(held && held !== titleKey) return false;
    used[videoId] = titleKey;
    return true;
  }
"""

CLAIM_SITES = [
    ("""      var entry = verified[vi];
      if(onStatus) onStatus('Downloading the audio on your device (a few seconds)…');
      var decTry = await scFetchDecode(entry.pa, onStatus);""",
     """      var entry = verified[vi];
      if(runUsed && entry.vid && myTitleKey && !scSourceClaim(runUsed, entry.vid, myTitleKey)) continue;
      if(onStatus) onStatus('Downloading the audio on your device (a few seconds)…');
      var decTry = await scFetchDecode(entry.pa, onStatus);""",
     'the verified candidate claim'),
    ("""        fallbackUsable = true;
        if(onStatus) onStatus('Downloading the audio on your device (a few seconds)…');
        var fbDec = await scFetchDecode(fallback, onStatus);""",
     """        fallbackUsable = true;
        // The same rule as the verified loop: the upload is claimed before it is read.
        var fbClaimed = !(runUsed && fallbackCand && fallbackCand.videoId && myTitleKey) || scSourceClaim(runUsed, fallbackCand.videoId, myTitleKey);
        if(onStatus) onStatus('Downloading the audio on your device (a few seconds)…');
        var fbDec = fbClaimed ? await scFetchDecode(fallback, onStatus) : null;""",
     'the fallback claim'),
]

# ---------------------------------------------------------------------------
# 5. Per-song failure reasons (three songs cannot share one slot)
# ---------------------------------------------------------------------------
FAIL_FN = r"""  // A batch runs several songs at once, so the reason a song failed cannot live in one
  // window-wide slot - three songs overwrite each other's and a run reports the wrong
  // cause. A run hands this song's own sink down (ctx.fail / ctx.reason); a one-off save
  // keeps the window slot it always had.
  function scFail(ctx, msg){
    if(ctx && typeof ctx === 'object' && typeof ctx.fail === 'function'){ ctx.fail(msg); return; }
    window.__scSourceFail = msg;
  }
"""

FAIL_SITES = [
    ("    if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }\n    if(onStatus) onStatus('Searching for \"' + title + '\" by '",
     "    if(window.__scCancelDl){ scFail(runCtx, 'cancelled'); return null; }\n    if(onStatus) onStatus('Searching for \"' + title + '\" by '",
     'the search cancel'),
    ("        window.__scSourceFail = 'search could not reach the source (' + window.__scHttpWhy + ') — tap Convert to retry';",
     "        scFail(runCtx, 'search could not reach the source (' + window.__scHttpWhy + ') — tap Convert to retry');",
     'the unreachable-source reason'),
    ("        window.__scSourceFail = 'no source found — the Play build only searches openly-licensed catalogs';",
     "        scFail(runCtx, 'no source found — the Play build only searches openly-licensed catalogs');",
     'the Play-build reason'),
    ("        window.__scSourceFail = 'no source matched this track — try Convert again';",
     "        scFail(runCtx, 'no source matched this track — try Convert again');",
     'the no-match reason'),
    ("      if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }\n      // A sibling track of this run already took this upload",
     "      if(window.__scCancelDl){ scFail(runCtx, 'cancelled'); return null; }\n      // A sibling track of this run already took this upload",
     'the candidate-walk cancel'),
    ("      if(window.__scCancelDl){ window.__scSourceFail = 'cancelled'; return null; }\n      var entry = verified[vi];",
     "      if(window.__scCancelDl){ scFail(runCtx, 'cancelled'); return null; }\n      var entry = verified[vi];",
     'the decode cancel'),
    ("""      if(durationRejected) window.__scSourceFail = 'the sources found are a different length than this track — not saving the wrong audio';
      else if(!fallback && !verified.length) window.__scSourceFail = 'no matching source';
      else if(fallbackUsable || verified.length) window.__scSourceFail = 'download blocked';
      else window.__scSourceFail = 'no matching source';""",
     """      if(durationRejected) scFail(runCtx, 'the sources found are a different length than this track — not saving the wrong audio');
      else if(!fallback && !verified.length) scFail(runCtx, 'no matching source');
      else if(fallbackUsable || verified.length) scFail(runCtx, 'download blocked');
      else scFail(runCtx, 'no matching source');""",
     'the failure reasons'),
]

CONVERT_ONE_OLD = """  async function scConvertOneTrack(meta, fmt, onStatus, ctx){
    window.__scSourceFail = '';
    if(window.__scCancelDl) return { ok: false, reason: 'cancelled' };
    if(onStatus) onStatus('Searching for "' + meta.title + '"…');
    var res = await scSpToBuffer(meta, function(txt){ if(onStatus) onStatus(txt); }, ctx);
    if(!res || !res.buffer) return { ok: false, reason: window.__scSourceFail || 'no source found' };
"""

CONVERT_ONE_NEW = """  async function scConvertOneTrack(meta, fmt, onStatus, ctx){
    if(ctx && typeof ctx === 'object') ctx.reason = ''; else window.__scSourceFail = '';
    if(window.__scCancelDl) return { ok: false, reason: 'cancelled' };
    if(onStatus) onStatus('Searching for "' + meta.title + '"…');
    var res = await scSpToBuffer(meta, function(txt){ if(onStatus) onStatus(txt); }, ctx);
    if(!res || !res.buffer) return { ok: false, reason: ((ctx && ctx.reason) || window.__scSourceFail || 'no source found') };
"""
