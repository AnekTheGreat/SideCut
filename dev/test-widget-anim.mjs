// The home-screen widget's animation and frozen-state guards live in the Java
// that CI injects into the Android project (.github/workflows/patch-widget.py).
// Nothing here can compile Java, so this pins the injection contract instead:
// the self-driving EQ loop, its frame time, its wiring from every state path,
// the cover-art cache that keeps the loop from re-decoding the same base64 cover
// on every frame, and - since 71.5 - the "Playing bars" switch that hides the
// heartbeat outright (no bars drawn AND no loop running, so it costs nothing).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const py = fs.readFileSync('.github/workflows/patch-widget.py', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };

console.log('[1] self-driving animation driver');
ok(/static void setAnimating\(final Context ctx, final boolean on\)/.test(py), 'setAnimating(Context, boolean) defined');
ok(py.includes('private static volatile int animPhase = -1;'), 'animPhase override exists');
ok(py.includes('sAnimH.postDelayed(this, EQ_FRAME_MS);'), "the loop's frame time is named, not a magic number");
ok(/static final long EQ_FRAME_MS = 900L;/.test(py), 'one frame per beat (900ms), not the 480ms flicker');
ok(!py.includes('480L'), 'and no 480ms frame constant survives anywhere in the file');
ok(py.includes('if (ph >= EQ_WAVE.length) ph = 0;') && !/ph\s*=\s*ph\s*%\s*\d/.test(py), 'phase wraps without a raw % (the template is %-formatted for APP_ID)');

console.log('[2] the Playing bars switch (71.5)');
ok(/static boolean barsOn\(Context ctx\) \{\n\s*try \{ return readTheme\(ctx\)\.optBoolean\("eq", true\); \}/.test(py),
  'barsOn() reads the theme flag, defaulting to on');
ok(py.includes('boolean bars = th.optBoolean("eq", true);'), 'pushAll() reads it once per render');
ok(py.includes('if (playing && bars) {'), 'and only draws the bars when it is on');
ok(py.includes('if (playing && bars && animPhase >= 0) pulse = animPhase;'), 'the live phase is only used when the bars are on');
ok(py.includes('if (sAnimCtx != null && !barsOn(sAnimCtx)) { setAnimating(sAnimCtx, false); return; }'),
  'a switch flipped mid-song stops the loop instead of painting hidden frames');

console.log('[3] every state path drives it');
ok(py.includes('SideCutWidgetProvider.setAnimating(ctx, playing && SideCutWidgetProvider.barsOn(ctx));'),
  'update() starts/stops the loop with the playing flag AND the switch');
ok(py.includes('setAnimating(ctx, false); // dead app: stop the shimmer, paint paused'), 'watchdog stops the loop when the app dies mid-song');

console.log('[4] repaint cost stays bounded');
ok(py.includes('if (art != null && art.equals(sArtKey))'), 'cover art cached across repaints');
ok(py.includes('sArtKey = art;') && py.includes('sArtBmp = bmp;'), 'cache is refreshed when the cover changes');

console.log('[5] templates still format (literal % must be escaped for % APP_ID)');
if (spawnSync('python3', ['-c', 'import importlib.util,sys;'
  + "spec=importlib.util.spec_from_file_location('pw','.github/workflows/patch-widget.py');"
  + 'm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);'
  + "assert '%}' not in m.PROVIDER_JAVA and '%%' not in m.PROVIDER_JAVA"
  + " and 'setAnimating' in m.PROVIDER_JAVA"
  + " and 'setAnimating(ctx, playing && SideCutWidgetProvider.barsOn(ctx))' in m.PLUGIN_JAVA"], { encoding: 'utf8' }).status === 0) {
  ok(true, 'both Java templates render and carry the wiring');
} else {
  ok(false, 'both Java templates render and carry the wiring');
}

console.log(failures ? 'WIDGET ANIM: ' + failures + ' FAILURE(S)' : 'WIDGET ANIM: ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
