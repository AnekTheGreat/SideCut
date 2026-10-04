#!/usr/bin/env node
/**
 * 71.5 - the widget heartbeat, slowed, and the switch that hides it.
 *
 * The user's words: "This heartbeat is way too fast in the widgit and it's it
 * necessary like is their a way to hide it like I don't see other widgits have
 * it". The bars beside the artist are the widget's playing equalizer, and they
 * are drawn by the Android widget (the Java CI injects), not by the web layer -
 * so this gate pins both halves of the contract and the seam between them:
 *
 *   [1] release metadata    - APP_VERSION, the head entry, the shell cache;
 *   [2] the switch          - the Settings > Widget row and its copy;
 *   [3] the flag and payload- stored answer, setter, and the "eq" that rides in
 *                             the theme object every push already sends;
 *   [4] the preview         - the bars in the theme preview follow the switch;
 *   [5] the native widget   - no bars AND no repaint loop when it is off, and a
 *                             frame time that reads as a beat, not a blink;
 *   [6] what did not move   - presets, fine-tune, transport, heartbeat cadence.
 *
 *   node dev/test-715.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const py = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-widget.py'), 'utf8');

const VER = '73.1'; /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */ /* repinned by dev/repin-715.mjs */
const PREV = '73'; /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */
// The release this gate DESCRIBES, which never moves. A check on what 71.5's
// notes SAY has to look them up, because VER moves with every release and the
// head entry with it.
const OWN = '71.5';
const SHELL_CACHE = 'sidecut-shell-v73.1';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;
const sliceBetween = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  return (a === -1 || b === -1) ? '' : src.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next');
    const notes = items.join('\n');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/stripe/i.test(items.slice(0, 6).join('\n')), 'and the first six name no card page');
    // 71.6 - these two read THIS release's entry, not the head. VER moves with
    // every release (the gate runs on whatever the app is now); what 71.5's
    // notes SAY does not move, so they are looked up by version. OWN is
    // deliberately not a `const VER`/`{ version: … }` pin, so the repin sweep
    // leaves it alone.
    const own = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (own.items || []).join('\n');
    ok(/widget/i.test(ownNotes), 'the notes actually talk about the widget');
    ok(/heartbeat|bars/i.test(ownNotes), 'and name the thing that was too fast');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the service worker cache moves on for the shell that shipped (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the switch, in Settings > Widget');
{
  const pane = sliceBetween('<div id="settingsPaneWidget"', '<div id="settingsPaneGlow"');
  ok(pane.indexOf('id="widgetBarsRow"') !== -1, 'the widget pane has a Playing bars row');
  ok(pane.indexOf('id="widgetBarsToggle"') !== -1, 'with its own checkbox');
  ok(/<input type="checkbox" id="widgetBarsToggle"/.test(pane), 'and it is a real checkbox, not a button');
  ok(/<label for="widgetBarsToggle"/.test(pane), 'every part of the row is the label, so the text is tappable too');
  ok(pane.indexOf('Playing bars') !== -1, 'labelled in plain words');
  ok(/equalizer that pulses beside the artist/.test(pane), 'the copy says what the bars are');
  ok(/hidden on every widget you have placed/.test(pane), 'and that off means off everywhere, not just here');
  ok(/nothing else changes/.test(pane), 'and that nothing else in the widget moves with it');
  // Order: after the presets, before the fine-tune colours.
  ok(pane.indexOf('id="widgetThemeGrid"') < pane.indexOf('id="widgetBarsRow"')
    && pane.indexOf('id="widgetBarsRow"') < pane.indexOf('id="widgetCustomWrap"'),
    'and it sits between the theme presets and the fine-tune colours');
  ok(pane.indexOf('id="widgetCustomColors"') !== -1 && pane.indexOf('id="widgetThemePreview"') !== -1,
    'the rest of the pane is untouched around it');
}

console.log('[3] the answer, and how the widget hears it');
{
  ok(src.indexOf('let widgetBarsOn = true;') !== -1, 'the flag exists and defaults to on');
  ok(/localStorage\.getItem\('sidecut_widgetBars'\)/.test(src), 'and is restored from its own storage key');
  ok(/else if\(_savedWB === '0'\) widgetBarsOn = false;/.test(src), 'an explicit off is honoured');
  ok(/localStorage\.setItem\('sidecut_widgetBars', widgetBarsOn \? '1' : '0'\)/.test(src), 'the setter stores the answer');
  const setter = src.slice(src.indexOf('function setWidgetBars(on){'), src.indexOf('function setWidgetBars(on){') + 520);
  ok(/widgetBarsOn = !!on;/.test(setter), 'the setter coerces, so a stray string cannot half-hide it');
  ok(/pushWidgetState\(widgetTrack, widgetPlaying\)/.test(setter), 'and pushes a placed widget straight away');
  ok(/_wt\.eq = !!widgetBarsOn;/.test(src), 'the theme object carries the flag as "eq"');
  ok(!/_wt\.eq = widgetBarsOn \? 1 : 0;/.test(src),
    'as a real boolean - the native side reads it with optBoolean, which ignores a 1 or a 0');
  const pushes = count(src, 'JSON.stringify(getWidgetTheme())');
  ok(pushes >= 2, 'every theme payload is built from getWidgetTheme (' + pushes + ' of them)');
  ok(count(src, 'theme: JSON.stringify(getWidgetTheme())') === pushes, 'including the state push and the battery-saving dim');
  const wiring = src.slice(src.indexOf("const barsTog = $('widgetBarsToggle');"), src.indexOf('renderWidgetCustomColors();'));
  ok(/barsTog\.checked = !!widgetBarsOn;/.test(wiring), 'opening the pane re-syncs the checkbox with the stored answer');
  ok(/barsTog\.addEventListener\('change'/.test(wiring), 'and a change applies it');
  ok(/if\(!barsTog\._wired\)/.test(wiring), 'wired exactly once, so re-rendering the pane cannot stack listeners');
  ok(/toast\(barsTog\.checked \? 'Playing bars on' : 'Playing bars hidden'\)/.test(wiring), 'with a toast either way');
}

console.log('[4] the preview follows it');
{
  const pv = src.slice(src.indexOf('function renderWidgetPreview(){'), src.indexOf('function renderGlowControls(){'));
  ok(/const barsHtml = widgetBarsOn/.test(pv), 'the preview branches on the switch');
  ok(/background:' \+ t\.accent \+ '/.test(pv), 'and paints the bars in the theme accent, like the widget does');
  ok(count(pv, 'border-radius:2px;') === 3, 'three of them');
  ok(/Artist name' \+ barsHtml/.test(pv), 'beside the artist, where the widget puts them');
  ok(/&(?:#9664|#x25C0);|9664/.test(pv) || pv.indexOf('|&#') !== -1 || /font-size:18px/.test(pv), 'with the transport row still below them');
}

console.log('[5] the native widget obeys it');
{
  ok(/static boolean barsOn\(Context ctx\) \{\n\s*try \{ return readTheme\(ctx\)\.optBoolean\("eq", true\); \}/.test(py),
    'the provider reads the flag, defaulting to on for an install that never opened the pane');
  ok(py.indexOf('boolean bars = th.optBoolean("eq", true);') !== -1, 'pushAll() reads it once per render');
  ok(py.indexOf('if (playing && bars) {') !== -1, 'and draws the bars only when it is on');
  ok(py.indexOf('if (playing && bars && animPhase >= 0) pulse = animPhase;') !== -1, 'the live phase is gated on it too');
  ok(py.indexOf('SideCutWidgetProvider.setAnimating(ctx, playing && SideCutWidgetProvider.barsOn(ctx));') !== -1,
    'and the repaint loop never even starts when the bars are hidden');
  ok(py.indexOf('if (sAnimCtx != null && !barsOn(sAnimCtx)) { setAnimating(sAnimCtx, false); return; }') !== -1,
    'a switch flipped mid-song stops the loop instead of painting hidden frames');
  ok(/static final long EQ_FRAME_MS = 900L;/.test(py), 'the frame is one beat, 900ms');
  ok(py.indexOf('sAnimH.postDelayed(this, EQ_FRAME_MS);') !== -1, 'and the loop uses it');
  ok(py.indexOf('480L') === -1, 'the old 480ms flicker is gone entirely');
  for (const id of ['wEqWrap', 'wEq1', 'wEq2', 'wEq3', 'wPrev', 'wPlay', 'wNext', 'wArt', 'wTitle', 'wArtist']) {
    ok(py.indexOf('@+id/' + id) !== -1, 'the layout still has ' + id);
  }
  ok(/if \(ph >= EQ_WAVE\.length\) ph = 0;/.test(py), 'the wave still wraps without a raw %');
}

console.log('[6] what did not move');
{
  ok((src.match(/\n    (coral|ocean|dark|black|warm|forest|rose):\s+\{ label:/g) || []).length === 7, 'still seven widget presets');
  ok(count(src, "['bg1', 'Background top']") === 1 && count(src, "['accent', 'Accent']") === 1, 'the fine-tune fields are intact');
  const heartbeat = src.slice(src.indexOf('window.__scWidgetHeartbeat = function(){'), src.indexOf('setInterval(function(){ if(document.hidden) return;'));
  ok(/if\(widgetPlaying\) window\.__scWidgetPulse = \(\(window\.__scWidgetPulse \|\| 0\) \+ 1\) % 16;/.test(heartbeat),
    'the web heartbeat still bumps the pulse while playing');
  ok(src.indexOf('}, 6000);') !== -1, 'and still beats every six seconds');
  ok(/if\(!widgetPlaying && Date\.now\(\) - _widgetLastInteraction > _widgetTimeoutMs\)/.test(heartbeat),
    'the battery-saving dim still leaves a playing widget alone');
  ok(src.indexOf('function renderWidgetCustomColors(){') !== -1 && src.indexOf("id=\"widgetCustomReset\"") !== -1,
    'and the reset-to-preset control is still there');
  ok(src.indexOf('window.scWidgetSwitchPlaylist = function(name){') !== -1, 'the playlist pills on the widget are untouched');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
