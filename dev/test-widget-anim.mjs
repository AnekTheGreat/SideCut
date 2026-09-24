// The home-screen widget's animation and frozen-state guards live in the Java
// that CI injects into the Android project (.github/workflows/patch-widget.py).
// Nothing here can compile Java, so this pins the injection contract instead:
// the self-driving EQ loop, its wiring from every state path, and the cover-art
// cache that keeps a ~2 repaints/second loop from re-decoding the same base64
// cover on every frame.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const py = fs.readFileSync('.github/workflows/patch-widget.py', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };

console.log('[1] self-driving animation driver');
ok(/static void setAnimating\(final Context ctx, final boolean on\)/.test(py), 'setAnimating(Context, boolean) defined');
ok(py.includes('private static volatile int animPhase = -1;'), 'animPhase override exists');
ok(py.includes('sAnimH.postDelayed(this, 480L);'), 'loop repaints every 480ms');
ok(py.includes('if (ph >= EQ_WAVE.length) ph = 0;') && !/ph\s*=\s*ph\s*%\s*\d/.test(py), 'phase wraps without a raw % (the template is %-formatted for APP_ID)');

console.log('[2] every state path drives it');
ok(py.includes('SideCutWidgetProvider.setAnimating(ctx, playing);'), 'update() starts/stops the loop with the playing flag');
ok(py.includes('setAnimating(ctx, false); // dead app: stop the shimmer, paint paused'), 'watchdog stops the loop when the app dies mid-song');
ok(py.includes('if (playing && animPhase >= 0) pulse = animPhase;'), 'pushAll renders the live phase while playing');

console.log('[3] repaint cost stays bounded');
ok(py.includes('if (art != null && art.equals(sArtKey))'), 'cover art cached across repaints');
ok(py.includes('sArtKey = art;') && py.includes('sArtBmp = bmp;'), 'cache is refreshed when the cover changes');

console.log('[4] templates still format (literal % must be escaped for % APP_ID)');
if (spawnSync('python3', ['-c', 'import importlib.util,sys;'
  + "spec=importlib.util.spec_from_file_location('pw','.github/workflows/patch-widget.py');"
  + 'm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);'
  + "assert '%}' not in m.PROVIDER_JAVA and '%%' not in m.PROVIDER_JAVA"
  + " and 'setAnimating' in m.PROVIDER_JAVA and 'setAnimating(ctx, playing)' in m.PLUGIN_JAVA"], { encoding: 'utf8' }).status === 0) {
  ok(true, 'both Java templates render and carry the wiring');
} else {
  ok(false, 'both Java templates render and carry the wiring');
}

console.log(failures ? 'WIDGET ANIM: ' + failures + ' FAILURE(S)' : 'WIDGET ANIM: ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
