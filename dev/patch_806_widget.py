"""80.6, section 1 - the frosted-glass widget and the dial that tunes it.

The owner's ask, verbatim:

    "add a transparent frosted type widgit with a frosted adjustable thing so you
     can tune it"

WHAT "FROSTED" CAN BE, HONESTLY. The widget is a RemoteViews layout: an ImageView
filled with a bitmap the page hands over. RemoteViews cannot blur the wallpaper -
there is no backdrop filter to ask for and no way to read what is behind the
widget. What it CAN do is draw a translucent panel: Android's Color.parseColor
accepts #AARRGGBB, the bitmap is ARGB_8888, and the layout's root has no
background of its own, so a panel drawn at 44-88% opacity lets the wallpaper
through. That is the transparency.

The frost is the milk in the glass: the panel colour is mixed toward white, and
the mix plus the opacity both follow one number, 0-100, owned by Settings >
Widget. At 0 the glass is thin and the wallpaper clearly tints it; at 100 it is a
soft near-solid pane. One dial, one number, and the preview in the app shows the
same thing over a strip of colour so the dial has something to act on.

WHY THE MATH LIVES IN THE PAGE. Every widget redraw is fed by the theme object
the page already pushes on every heartbeat, so the glass needs no new bridge
call, no new key on the native side and no APK rebuild. The theme entry itself
stays a plain opaque colour; scFrostGlass() turns it into ARGB at push time, after
the fine-tune overrides have been merged, so a custom background picked in
Fine-tune keeps its colour and simply gains the glass.

THE OTHER PRESETS ARE UNTOUCHED. A theme without `glass: true` goes through
getWidgetTheme() exactly as it did in 80.5.2 - opaque, no extra keys that matter.

Imported by dev/patch-806.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# The preset. First in the object, because it is the one an owner goes looking
# for after asking for a frosted widget.
# ---------------------------------------------------------------------------
THEMES_ANCHOR = "  const WIDGET_THEMES = {\n"

THEMES_ADD = """  const WIDGET_THEMES = {
    // 80.6 - THE FROSTED GLASS. Its seven colours are a panel, not a wall: the
    // opacity and the milk are worked out by scFrostGlass() from the Frost dial,
    // so this stays a plain describing colour and the fine-tune swatches keep
    // working on top of it. A light panel with dark type, because a veil that
    // goes from thin to thick is always lighter than a wallpaper - the type
    // never has to change colour with the dial.
    frost:  { label: 'Frosted glass', glass: true, bg1: '#F6F9FF', bg2: '#CBD8EF', title: '#111A2B', artist: '#41506B', accent: '#2F6BFF', accentText: '#FFFFFF', pill: '#FFFFFF', pillText: '#111A2B' },
"""

# ---------------------------------------------------------------------------
# State. 55 is a glass with visible milk and visible wallpaper; the dial's ends
# are still in reach in both directions.
# ---------------------------------------------------------------------------
STATE_ANCHOR = """  let widgetThemeKey = 'candy';
  try{ const _savedWT = localStorage.getItem('sidecut_widgetTheme'); if(_savedWT && WIDGET_THEMES[_savedWT]) widgetThemeKey = _savedWT; }catch(_){ }"""

STATE_ADD = """  let widgetThemeKey = 'candy';
  try{ const _savedWT = localStorage.getItem('sidecut_widgetTheme'); if(_savedWT && WIDGET_THEMES[_savedWT]) widgetThemeKey = _savedWT; }catch(_){ }
  // 80.6 - HOW MUCH MILK IS IN THE GLASS, 0-100. Only the frosted presets read
  // it (see scFrostGlass); every other preset ignores it, so switching away and
  // back keeps the dial where it was left. Clamped on read: a hand-edited store
  // cannot put the widget in a state the layout has no colour for.
  let widgetFrost = 55;
  try{ var _scWFrost = parseInt(localStorage.getItem('sidecut_widgetFrost'), 10); if(!isNaN(_scWFrost) && _scWFrost >= 0 && _scWFrost <= 100) widgetFrost = _scWFrost; }catch(_eWFR){ }"""

# ---------------------------------------------------------------------------
# The glass math + the setter, both placed just above getWidgetTheme.
# ---------------------------------------------------------------------------
MATH_ANCHOR = "  function getWidgetTheme(){"

MATH_ADD = """  // 80.6 - THE GLASS. A frosted preset is a plain colour description; this turns
  // it into the thing the widget paints: an ARGB panel whose opacity and whose
  // whiteness both follow widgetFrost, plus the two CSS colours the Settings
  // preview needs (CSS has no #AARRGGBB - it is #RRGGBBAA - so the preview must
  // not be handed the string the widget gets).
  //
  // The first stop is mixed further toward white than the second on purpose: a
  // panel that is evenly milky reads as a flat sheet, and the 160deg preview
  // gradient plus the native 200px diagonal gradient both get a soft lit corner.
  function scFrostHexToRgb(h){
    h = String(h || '').replace('#', '');
    if(h.length === 8) h = h.slice(2);   // #AARRGGBB -> RRGGBB
    if(h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return [255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function scFrostMixTowardWhite(rgb, amount){
    return [Math.round(rgb[0] + (255 - rgb[0]) * amount),
            Math.round(rgb[1] + (255 - rgb[1]) * amount),
            Math.round(rgb[2] + (255 - rgb[2]) * amount)];
  }
  function scFrostArgb(rgb, alpha){
    var a = Math.max(0, Math.min(255, Math.round(alpha))).toString(16);
    if(a.length < 2) a = '0' + a;
    var p = function(n){ var s = n.toString(16); return s.length < 2 ? '0' + s : s; };
    return '#' + a.toUpperCase() + p(rgb[0]).toUpperCase() + p(rgb[1]).toUpperCase() + p(rgb[2]).toUpperCase();
  }
  function scFrostGlass(base){
    var k = Math.max(0, Math.min(100, parseInt(widgetFrost, 10) || 0)) / 100;
    // 0.44 of a white-ish panel is already a readable dull glass; 0.88 is a pane
    // you can barely see through. Both ends keep the wallpaper as a tint.
    var alpha = (0.44 + 0.44 * k) * 255;
    var c1 = scFrostMixTowardWhite(scFrostHexToRgb(base.bg1), 0.12 + 0.28 * k);
    var c2 = scFrostMixTowardWhite(scFrostHexToRgb(base.bg2), 0.04 + 0.14 * k);
    var out = Object.assign({}, base);
    out.bg1 = scFrostArgb(c1, alpha);
    out.bg2 = scFrostArgb(c2, alpha);
    out.css1 = 'rgba(' + c1[0] + ',' + c1[1] + ',' + c1[2] + ',' + (alpha / 255).toFixed(3) + ')';
    out.css2 = 'rgba(' + c2[0] + ',' + c2[1] + ',' + c2[2] + ',' + (alpha / 255).toFixed(3) + ')';
    out.glass = true;
    out.frost = Math.round(k * 100);
    return out;
  }
  // The dial. `commit` is false while a finger is on the slider (the preview
  // moves with every pixel) and true when it lifts (the widget itself is pushed,
  // so a drag costs one bridge call rather than sixty).
  function setWidgetFrost(v, commit){
    var n = parseInt(v, 10);
    if(isNaN(n)) n = 55;
    widgetFrost = Math.max(0, Math.min(100, n));
    var fv = $('widgetFrostValue');
    if(fv) fv.textContent = widgetFrost + '%';
    try{ renderWidgetPreview(); }catch(_eFP){ }
    if(commit){
      try{ localStorage.setItem('sidecut_widgetFrost', String(widgetFrost)); }catch(_eFSt){ }
      try{ pushWidgetState(widgetTrack, widgetPlaying); }catch(_eFS){ }
    }
  }
  function getWidgetTheme(){"""

# getWidgetTheme's own body: route the merged theme through the glass.
THEME_OLD = """    const _wt = applyWidgetCustom(widgetFollow ? widgetThemeFromApp() : (WIDGET_THEMES[widgetThemeKey] || WIDGET_THEMES.ocean));
    // 71.5 - the switch travels with the colours: every push (state, theme
    // change, and the battery-saving dim) already sends this object, so the
    // native widget learns the answer with no extra bridge call.
    _wt.eq = !!widgetBarsOn;"""

THEME_NEW = """    let _wt = applyWidgetCustom(widgetFollow ? widgetThemeFromApp() : (WIDGET_THEMES[widgetThemeKey] || WIDGET_THEMES.ocean));
    // 80.6 - the frosted presets leave this function as ARGB with the dial's
    // opacity and milk already in them. Everything else leaves untouched, which
    // is why 80.5.2's widgets look exactly as they did.
    try{ if(_wt && _wt.glass === true) _wt = scFrostGlass(_wt); }catch(_eGlass){ }
    // 71.5 - the switch travels with the colours: every push (state, theme
    // change, and the battery-saving dim) already sends this object, so the
    // native widget learns the answer with no extra bridge call.
    _wt.eq = !!widgetBarsOn;"""

# ---------------------------------------------------------------------------
# Settings > Widget: the dial, hidden for every preset that is not glass.
# ---------------------------------------------------------------------------
GRID_ANCHOR = """      <div id="widgetThemeGrid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-bottom:16px;"></div>
"""

GRID_ADD = """      <div id="widgetThemeGrid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-bottom:16px;"></div>
      <div id="widgetFrostRow" style="display:none; margin-bottom:16px; background:rgba(255,255,255,0.04); border:1px solid var(--line); border-radius:12px; padding:12px 14px;">
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:8px;">
          <span style="font-size:13px; font-weight:600;">Frost</span>
          <span id="widgetFrostValue" style="font-size:12px; color:var(--ink-dim);">55%</span>
        </div>
        <input type="range" id="widgetFrostSlider" min="0" max="100" step="1" value="55" style="width:100%;">
        <div style="font-size:11px; color:var(--ink-dim); margin-top:6px; line-height:1.5;">How much milk is in the glass. Left is thin and clear &mdash; the wallpaper shows through and tints the panel; right is a soft, nearly solid pane. Drag it and the preview below moves with your finger; let go and the widget on your home screen takes the same setting.</div>
      </div>
"""

# The wiring, inside renderWidgetThemeControls, right above the Playing bars
# switch (which is where the grid's own listeners have just been attached).
WIRE_ANCHOR = """    // 71.5 - the Playing bars switch. Wired once, then only re-synced: this
    // render runs on every Settings > Widget open, and re-adding the listener
    // would push a state update per tick."""

WIRE_ADD = """    // 80.6 - the Frost dial. Shown only for a glass preset: it is the one preset
    // with a dial, and hiding (not disabling) it keeps the panel short for the
    // other eighteen.
    const frostRow = $('widgetFrostRow');
    if(frostRow){
      // Following the app theme replaces the preset with the app's own colours, so
      // the dial would tune a glass that is not being drawn: hidden then too.
      const glassy = !widgetFollow && !!(WIDGET_THEMES[widgetThemeKey] && WIDGET_THEMES[widgetThemeKey].glass);
      frostRow.style.display = glassy ? '' : 'none';
      const frostSlider = $('widgetFrostSlider');
      if(frostSlider){
        frostSlider.value = String(widgetFrost);
        const frostValue = $('widgetFrostValue');
        if(frostValue) frostValue.textContent = widgetFrost + '%';
        if(!frostSlider._scWired){
          frostSlider._scWired = true;
          // input = every pixel of the drag, change = the finger lifted.
          frostSlider.addEventListener('input', () => { setWidgetFrost(frostSlider.value, false); });
          frostSlider.addEventListener('change', () => { setWidgetFrost(frostSlider.value, true); });
        }
      }
    }
    // 71.5 - the Playing bars switch. Wired once, then only re-synced: this
    // render runs on every Settings > Widget open, and re-adding the listener
    // would push a state update per tick."""

# ---------------------------------------------------------------------------
# The preview: over a strip of colour, so transparency and blur are visible.
# ---------------------------------------------------------------------------
# The preview's old body, replaced whole: the tile is lifted into a function so
# the glass branch and the opaque branch paint the same widget.
PREVIEW_START = """    const t = getWidgetTheme();
    pv.style.background = 'linear-gradient(160deg,' + t.bg1 + ',' + t.bg2 + ')';"""

# The last line of that body. Everything between the two markers goes.
PREVIEW_END = """'<div style=\"display:flex; gap:22px; font-size:18px; color:' + t.title + ';\"><span>|&#9664;</span><span>&#9654;</span><span>&#9654;|</span></div>';"""

PREVIEW_NEW = """    const t = getWidgetTheme();
    // 80.6 - a glass widget is shown over a strip of colour, because a
    // translucent panel on a flat dark pane proves nothing: this is what the
    // wallpaper does to it, and the blur is the one thing the preview can show
    // that the home screen cannot.
    if(t.glass === true){
      const blur = 6 + Math.round((t.frost || 0) * 0.16);
      const edge = (0.18 + (t.frost || 0) * 0.0032).toFixed(3);
      pv.style.background = 'transparent';
      pv.style.padding = '0';
      pv.innerHTML = '<div style=\"position:relative; border-radius:16px; overflow:hidden;\">' +
        '<div style=\"position:absolute; inset:0; background:linear-gradient(135deg,#FF8FB1 0%,#7AC6FF 42%,#9D7BFF 72%,#FFD166 100%);\"></div>' +
        '<div style=\"position:relative; padding:14px; border-radius:16px; -webkit-backdrop-filter:blur(' + blur + 'px) saturate(1.1); backdrop-filter:blur(' + blur + 'px) saturate(1.1); background:linear-gradient(160deg,' + t.css1 + ',' + t.css2 + '); border:1px solid rgba(255,255,255,' + edge + ');\">' +
        scWidgetPreviewBody(t) + '</div></div>';
      return;
    }
    pv.style.padding = '14px';
    pv.style.background = 'linear-gradient(160deg,' + t.bg1 + ',' + t.bg2 + ')';
    pv.innerHTML = scWidgetPreviewBody(t);"""

# The body of the preview, split out so both branches paint the same widget.
BODY_FUNC = """  // 80.6 - the tile both preview branches paint: identical in both, so the glass
  // preview cannot drift from the opaque one when a cover or a row changes.
  function scWidgetPreviewBody(t){
    const barsHtml = widgetBarsOn
      ? '<span style="display:inline-flex; align-items:flex-end; gap:2px; height:14px; margin-left:8px; vertical-align:middle;">' +
        '<span style="display:inline-block; width:3px; height:8px; border-radius:2px; background:' + t.accent + ';"></span>' +
        '<span style="display:inline-block; width:3px; height:14px; border-radius:2px; background:' + t.accent + ';"></span>' +
        '<span style="display:inline-block; width:3px; height:10px; border-radius:2px; background:' + t.accent + ';"></span>' +
        '</span>'
      : '';
    return '<div style="width:64px; height:64px; border-radius:12px; background:linear-gradient(135deg,#3a3f4b,#22252c); margin-bottom:10px; overflow:hidden;"></div>' +
      '<div style="font-size:16px; font-weight:700; color:' + t.title + '; margin-bottom:3px;">Song title</div>' +
      '<div style="font-size:13px; color:' + t.artist + '; margin-bottom:12px;">Artist name' + barsHtml + '</div>' +
      '<div style="display:flex; gap:22px; font-size:18px; color:' + t.title + ';"><span>|&#9664;</span><span>&#9654;</span><span>&#9654;|</span></div>';
  }
"""

# ---------------------------------------------------------------------------
# The blurb still says eight presets; there have been nineteen since 80.6.
# ---------------------------------------------------------------------------
BLURB_OLD = "Customize the home-screen widget: eight presets, a follow-the-app-theme switch, an idle battery saver and the fine-tune palette."

BLURB_NEW = "Customize the home-screen widget: nineteen presets from bright to frosted glass, a Frost dial on the glass one, a follow-the-app-theme switch, an idle battery saver and the fine-tune palette."
