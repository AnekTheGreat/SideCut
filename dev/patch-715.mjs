#!/usr/bin/env node
/**
 * SideCut 71.5 - a calmer widget heartbeat, and a switch to switch it off.
 *
 * The user's words: "This heartbeat is way too fast in the widgit and it's it
 * necessary like is their a way to hide it like I don't see other widgits have
 * it" (with a screenshot of the SideCut Full widget: cover art, Ashke / Karan
 * Aujla, Mxrci, two little blue bars, then prev / pause / next).
 *
 * The bars next to the artist are the widget's playing equalizer - the
 * "heartbeat". Two things, one release:
 *
 *   1. IT IS SLOWER. The wave used to step every 480ms, which reads as a fast
 *      blink. It now steps once a beat (900ms), so it breathes instead of
 *      strobing - and it repaints half as often while a song plays. That half
 *      lives in the Java CI injects (.github/workflows/patch-widget.py), because
 *      the bars are drawn by the Android widget, not by the web layer.
 *
 *   2. YOU CAN HIDE IT. Settings > Widget gains a "Playing bars" switch. It is
 *      stored on the device, it rides to the native widget inside the SAME theme
 *      payload the colours already use (as "eq"), and the native side then draws
 *      no bars AND never starts the repaint loop - so a hidden heartbeat costs
 *      no battery at all. Default is on: the bars are what most people see now,
 *      and the switch is there for anyone who wants the calmer widget.
 *
 *   node dev/patch-715.mjs
 *   node dev/patch-715.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-715.mjs --check   # and name every sub it skips
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '71.5';
const STAMP = 'September 30, 2026 \u00b7 10:15 PM EDT';
const CACHE = 'sidecut-shell-v63.0.51';
const OLDCACHE = 'sidecut-shell-v63.0.50';
const TITLE = 'The widget heartbeat slows to a calm once-a-beat pulse and gains a switch to hide it';

// Seven notes. The head entry's first SIX are copied into ota-play/updates.json
// verbatim by dev/ota-bundle-play.mjs, so the first six are audited against the
// wider Play term list in dev/test-play-copy.mjs: no
// download/downloading/converter/convert(s|ing|ion)/mp3/"get song"/"no source
// found"/hand-off/vocal remover/spotisaver, and never the words "Play build".
// The seventh is deliberately past the cut, for the sideloaded build's sake.
//
// test-714.mjs keeps a check that the head entry carries a note PAST the six
// (it pins the cut) and that the first six never mention Stripe - which is why
// this release publishes seven notes and names no card page at all.
const NOTES = [
  'The widget heartbeat is slower. The little bars beside the artist used to step through their wave about twice a second, which read as a fast blink; they now step once a beat, so the widget breathes instead of strobing.',
  'And you can hide them. Settings > Widget has a Playing bars switch: turn it off and the bars are gone from every widget you have placed, and the redraw loop behind them stops too - so a hidden heartbeat costs no battery at all.',
  'The switch rides along with the widget theme, which is what the colours already do, so every widget you have placed picks it up on the next state push. Nothing has to be removed and re-added.',
  'Your answer is remembered on the device, so a relaunch, an update, or a widget you add next month all keep it.',
  'Everything else about the widget is exactly as it was: the cover art, the title and artist colours, the theme presets, the fine-tune colours and the prev / play-pause / next buttons.',
  'And the player in the app is untouched - the dock, the queue, the equalizer and your library all behave exactly as they did before this release.',
  'A library saved before this release comes back exactly as it was, and no stored song, cover or playlist is rewritten by any of it.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-715: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. THE SWITCH - state, the theme flag the native widget reads, and the setter
   ========================================================================== */

// 1a. The state, right beside the theme it rides with, plus the setter. The
//     flag is a real boolean in the theme payload ("eq": true / false) on
//     purpose: the native side reads it with org.json's optBoolean, which
//     understands true/false and ignores a 1 or a 0.
sub(html, 'the playing-bars flag and its setter',
  `  let widgetThemeKey = 'ocean';
  try{ const _savedWT = localStorage.getItem('sidecut_widgetTheme'); if(_savedWT && WIDGET_THEMES[_savedWT]) widgetThemeKey = _savedWT; }catch(_){ }
  function getWidgetTheme(){ return applyWidgetCustom(WIDGET_THEMES[widgetThemeKey] || WIDGET_THEMES.ocean); }
`,
  `  let widgetThemeKey = 'ocean';
  try{ const _savedWT = localStorage.getItem('sidecut_widgetTheme'); if(_savedWT && WIDGET_THEMES[_savedWT]) widgetThemeKey = _savedWT; }catch(_){ }
  // 71.5 - the widget's playing bars (the little "heartbeat" beside the artist)
  // are optional. Settings > Widget owns this flag; it is stored on the device,
  // it rides to the native widget in the theme payload every state push already
  // carries, and the native side then draws no bars and runs no repaint loop.
  // Default ON - it is what the widget has always shown; the switch is there for
  // anyone who would rather have the calmer widget.
  let widgetBarsOn = true;
  try{ const _savedWB = localStorage.getItem('sidecut_widgetBars'); if(_savedWB === '1') widgetBarsOn = true; else if(_savedWB === '0') widgetBarsOn = false; }catch(_){ }
  function setWidgetBars(on){
    widgetBarsOn = !!on;
    try{ localStorage.setItem('sidecut_widgetBars', widgetBarsOn ? '1' : '0'); }catch(_){ }
    try{ renderWidgetPreview(); }catch(_){ }
    // Push straight away so a placed widget follows the switch without waiting
    // for the next beat (this is the same push the theme buttons use).
    try{ pushWidgetState(widgetTrack, widgetPlaying); }catch(_){ }
  }
  function getWidgetTheme(){
    const _wt = applyWidgetCustom(WIDGET_THEMES[widgetThemeKey] || WIDGET_THEMES.ocean);
    // 71.5 - the switch travels with the colours: every push (state, theme
    // change, and the battery-saving dim) already sends this object, so the
    // native widget learns the answer with no extra bridge call.
    _wt.eq = !!widgetBarsOn;
    return _wt;
  }
`,
  { key: 'let widgetBarsOn = true;' });

/* ============================================================================
   2. THE SWITCH ITSELF - Settings > Widget
   ========================================================================== */

// 2a. The control, between the theme presets and the fine-tune colours.
sub(html, 'the Playing bars row in Settings > Widget',
  `      <div id="widgetThemeGrid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-bottom:16px;"></div>
`,
  `      <div id="widgetThemeGrid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-bottom:16px;"></div>
      <div id="widgetBarsRow" style="margin-bottom:16px; background:rgba(255,255,255,0.04); border:1px solid var(--line); border-radius:12px; padding:12px 14px;">
        <label for="widgetBarsToggle" style="display:flex; align-items:flex-start; gap:12px; cursor:pointer;">
          <input type="checkbox" id="widgetBarsToggle" style="width:18px; height:18px; margin:1px 0 0; flex:0 0 auto; accent-color:var(--gold);">
          <span>
            <span style="font-size:13px; font-weight:600;">Playing bars</span>
            <span style="display:block; font-size:11px; color:var(--ink-dim); margin-top:4px; line-height:1.5;">The small equalizer that pulses beside the artist while a song plays. Turn it off for a calmer widget &mdash; the bars are hidden on every widget you have placed and nothing else changes.</span>
          </span>
        </label>
      </div>
`,
  { key: 'id="widgetBarsToggle"' });

// 2b. Wire it, and keep the checkbox in step with the stored answer.
sub(html, 'the Playing bars switch wiring',
  `    renderWidgetCustomColors();
    renderWidgetPreview();
  }
  function renderWidgetCustomColors(){`,
  `    // 71.5 - the Playing bars switch. Wired once, then only re-synced: this
    // render runs on every Settings > Widget open, and re-adding the listener
    // would push a state update per tick.
    const barsTog = $('widgetBarsToggle');
    if(barsTog){
      barsTog.checked = !!widgetBarsOn;
      if(!barsTog._wired){
        barsTog._wired = true;
        barsTog.addEventListener('change', () => {
          setWidgetBars(barsTog.checked);
          toast(barsTog.checked ? 'Playing bars on' : 'Playing bars hidden');
        });
      }
    }
    renderWidgetCustomColors();
    renderWidgetPreview();
  }
  function renderWidgetCustomColors(){`,
  { key: 'barsTog._wired' });

// 2c. The preview draws the bars exactly as the widget does - three bars in the
//     theme accent, sitting after the artist - or nothing at all when the
//     switch is off, so the choice is visible before it reaches the launcher.
sub(html, 'the preview shows the bars',
  `    const t = getWidgetTheme();
    pv.style.background = 'linear-gradient(160deg,' + t.bg1 + ',' + t.bg2 + ')';
    pv.innerHTML = '<div style="width:64px; height:64px; border-radius:10px; background:linear-gradient(135deg,#3a3f4b,#22252c); margin-bottom:10px;"></div>' +
      '<div style="font-size:16px; font-weight:700; color:' + t.title + '; margin-bottom:3px;">Song title</div>' +
      '<div style="font-size:13px; color:' + t.artist + '; margin-bottom:12px;">Artist name</div>' +
`,
  `    const t = getWidgetTheme();
    pv.style.background = 'linear-gradient(160deg,' + t.bg1 + ',' + t.bg2 + ')';
    // 71.5 - the three little bars the widget paints while a song plays, in the
    // theme's own accent. Switched off, the preview shows the same widget with
    // nothing there - which is the whole point of the row above it.
    const barsHtml = widgetBarsOn
      ? '<span style="display:inline-flex; align-items:flex-end; gap:2px; height:14px; margin-left:8px; vertical-align:middle;">' +
        '<span style="display:inline-block; width:3px; height:8px; border-radius:2px; background:' + t.accent + ';"></span>' +
        '<span style="display:inline-block; width:3px; height:14px; border-radius:2px; background:' + t.accent + ';"></span>' +
        '<span style="display:inline-block; width:3px; height:10px; border-radius:2px; background:' + t.accent + ';"></span>' +
        '</span>'
      : '';
    pv.innerHTML = '<div style="width:64px; height:64px; border-radius:10px; background:linear-gradient(135deg,#3a3f4b,#22252c); margin-bottom:10px;"></div>' +
      '<div style="font-size:16px; font-weight:700; color:' + t.title + '; margin-bottom:3px;">Song title</div>' +
      '<div style="font-size:13px; color:' + t.artist + '; margin-bottom:12px;">Artist name' + barsHtml + '</div>' +
`,
  { key: 'const barsHtml = widgetBarsOn' });

/* ===================== 3. THE RELEASE ITSELF ================================ */
sub(html, 'the app version',
  "  const APP_VERSION = '71.4';\n",
  "  const APP_VERSION = '" + VERSION + "';\n",
  { key: "const APP_VERSION = '" + VERSION + "';" });

const ENTRY = "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',\n").join('') +
  "  ] },\n";
sub(html, 'the changelog head entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + ENTRY,
  { key: "{ version: '" + VERSION + "'" });

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

if(!CHECK){
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-715: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-715: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
