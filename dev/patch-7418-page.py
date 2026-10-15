# The page text dev/patch-7418.py writes, part one: THE FIX.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7418.py's globals.
#
# 74.1.7 shipped a compressor that could not compress. The owner's phone said so in
# one line: "Re-encode failed: scBackSliceMul is not defined".
#
# WHY, EXACTLY. The page is four inline <script> blocks, each its own program.
# 74.1.7 put the hidden-slice multiplier in the LAST of them - the Studio module,
# next to scJobLock and the rest of the background job - while the two encoders that
# read the slice budget (scEncodeMp3Cooperative's block loop and scEncodeWavCooperative's
# sample loop) live in the FIRST, the app's own 2.5 MB script. A bare identifier is
# resolved lexically, in the scope of the function that USES it: never in the scope of
# whichever block published a reference to it. So the call threw, and it threw on the
# very first block of the loop - `>=` evaluates both of its sides, so the multiplier is
# called whether or not the slice is due - which is why EVERY re-encode failed at once
# rather than some long encode failing late.
#
# It also went out with every gate green, and the reason is worth keeping: dev/
# studio-70-check.cjs [6f] drove the job with `win.__scEncodeMp3` STUBBED, so the real
# encoder never ran, and the half of [6f] that reads the multiplier read it through
# SC70.backSliceMul() - the module's own copy, which was defined and answered
# correctly. The gate asked the module a question about itself. dev/storeinfo-7418-block.js
# closes that hole three ways, one of which is general: no script block may call an
# sc-prefixed helper that only another block defines.
#
# THE FIX IS ONE FUNCTION MOVING HOUSE. The real scBackSliceMul is defined in the
# app's own block, beside the two call sites that use it, and published on the window
# the same way __scEncodeMp3 already is; the Studio's copy becomes a thin alias that
# reads the published one at call time, so the two can never drift apart.
# The Studio's copy, and the two lines above it that make this anchor the ONLY place
# the page writes that function name twice: the fix below defines a function with the
# same body in the app's block, so the body alone would no longer be unique.
MODULE_OLD = "  var encodeJob = null;\n  function scBackSliceMul(){ return document.hidden ? 3 : 1; }\n"
MODULE_NEW = """  var encodeJob = null;
  // 74.1.8 - the real one lives in the app's own <script>, beside the two encoders
  // that call it (see the note there). This is the Studio's way in: it reads the
  // published function at call time, so the two cannot drift apart, and it stays a
  // function either way, which is what the panels and the probes expect.
  function scBackSliceMul(){
    return (typeof window !== 'undefined' && typeof window.__scBackSliceMul === 'function')
      ? window.__scBackSliceMul() : 1;
  }
"""

DEF_OLD = """  var SC_ENCODE_SLICE_MS = 90;
  // 74.1.7 - while the page is hidden each slice does three times the work, so a
"""
DEF_NEW = """  var SC_ENCODE_SLICE_MS = 90;
  // 74.1.8 - THE MULTIPLIER LIVES HERE, BESIDE THE TWO CALL SITES THAT READ IT.
  // 74.1.7 defined it in the Studio module's <script> instead, and every re-encode
  // then died with "scBackSliceMul is not defined": a bare identifier is resolved in
  // the scope of the function that USES it, never in the scope of whatever published
  // a reference to it, and both encoders that read this slice budget are in THIS
  // script block. A helper an encoder calls has to be defined with the encoders.
  function scBackSliceMul(){ return document.hidden ? 3 : 1; }
  // Published on the window, the same way __scEncodeMp3 is further down this block,
  // so the Studio module can reach a function that its own scope cannot see.
  window.__scBackSliceMul = scBackSliceMul;
  // 74.1.7 - while the page is hidden each slice does three times the work, so a
"""
