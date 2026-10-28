"""80.3.6, section 4 - the widget gets more options that it can actually honour.

The owner's ask, verbatim:

    "add more options to the widgit there should be more options"

THE RULE THIS MODULE KEEPS. The widget is native: a RemoteViews layout compiled
into the APK (`sidecut_widget.xml`, one 2x2 shape) drawn by
`SideCutWidgetProvider`, which reads only these keys out of the theme JSON the
page pushes - `bg1`, `bg2`, `title`, `artist`, `accent`, `eq`. An option the
native side does not read is a switch that does nothing, so this release adds
only options that ride the payload that already exists:

  * FIVE MORE PRESETS - Aurora, Sand, Slate, Sakura, Lime. Pure colour objects,
    honoured by the same gradient bitmap and text colours every preset uses.
  * FOLLOW THE APP THEME - one switch that builds the widget's palette from
    whatever theme the app is wearing (`THEMES[currentTheme]`) instead of a
    second palette the reader has to keep in step. It also updates when the
    theme does, because the state push carries `getWidgetTheme()` every time.
  * IDLE BATTERY SAVER - how long a PAUSED widget keeps being refreshed before it
    dims to "Tap to show": 25 seconds (what it always was), 1 minute, or never.
    This one is the page's own timer, so the setting is the behaviour, not a
    label on it.

WHAT IS NOT HERE, AND WHY. Widget SIZES are not an option: the layout is one 2x2
RemoteViews and the provider inflates `R.layout.sidecut_widget` by name, so a
size switch would need a second compiled layout in the APK - a native change
this release cannot build, let alone verify. Same for hiding the cover, moving
the transport, or a blur: all of them are in that layout. Nothing here pretends
otherwise.

Imported by dev/patch-8036.py; holds constants only.
"""

# The last entry in WIDGET_THEMES, with the object's closing brace.
PRESETS_OLD = """    rose:   { label: 'Rosewood',            bg1: '#2A1A21', bg2: '#120A0D', title: '#FCEFF3', artist: '#CFA3B2', accent: '#E36A8A', accentText: '#1F060D', pill: '#36222C', pillText: '#F6E2EA' }
  };"""

PRESETS_NEW = """    rose:   { label: 'Rosewood',            bg1: '#2A1A21', bg2: '#120A0D', title: '#FCEFF3', artist: '#CFA3B2', accent: '#E36A8A', accentText: '#1F060D', pill: '#36222C', pillText: '#F6E2EA' },
    // 80.3.6 - five more, in the same shape as the seven above: two background
    // stops the native side renders as one gradient bitmap, a title and an
    // artist colour it sets with setTextColor, and an accent it paints the
    // playing bars with. Every one of them is read from the payload that was
    // already being pushed, so nothing on the native side had to change.
    aurora: { label: 'Aurora',              bg1: '#0F1B3A', bg2: '#08101F', title: '#F2F7FF', artist: '#9FC0E8', accent: '#8FE3FF', accentText: '#04131F', pill: '#152346', pillText: '#E3EEFF' },
    sand:   { label: 'Sand',                bg1: '#2B2118', bg2: '#120D09', title: '#FBF3E6', artist: '#CDB79B', accent: '#E8B23C', accentText: '#241703', pill: '#34271B', pillText: '#F4E7D4' },
    slate:  { label: 'Slate',               bg1: '#1B2027', bg2: '#0B0E12', title: '#F1F4F8', artist: '#A6B0BC', accent: '#7FB2E5', accentText: '#06131F', pill: '#242B34', pillText: '#E2E8F0' },
    sakura: { label: 'Sakura',              bg1: '#2E1A22', bg2: '#140A0E', title: '#FFF0F4', artist: '#D7A9B8', accent: '#FF9EC4', accentText: '#2A0713', pill: '#3A2029', pillText: '#FFE1EB' },
    lime:   { label: 'Lime',                bg1: '#162312', bg2: '#080F06', title: '#F3FBE9', artist: '#B4CE96', accent: '#A6E22E', accentText: '#101B03', pill: '#1D2C18', pillText: '#EAF7DA' }
  };"""

# The two saved switches, next to the one the widget already had.
STATE_ANCHOR = "  try{ const _savedWB = localStorage.getItem('sidecut_widgetBars'); if(_savedWB === '1') widgetBarsOn = true; else if(_savedWB === '0') widgetBarsOn = false; }catch(_){ }"

STATE_ADD = STATE_ANCHOR + """
  // 80.3.6 - FOLLOW THE APP THEME. One palette, not two: switched on, the widget
  // borrows the background, the raised tone and the accent of whatever theme the
  // app is wearing, and picks up a theme change on the very next push (that is
  // what getWidgetTheme() is called for on every state beat).
  let widgetFollow = false;
  try{ widgetFollow = localStorage.getItem('sidecut_widgetFollow') === '1'; }catch(_eWF){ }
  // 80.3.6 - IDLE BATTERY SAVER. A paused widget used to stop refreshing after
  // 25 seconds flat, which is a number nobody chose. 25 seconds, 1 minute, or
  // never - and 25 is the default, so an existing install behaves as it did.
  let widgetIdleSec = 25;
  try{ var _scWIdle = parseInt(localStorage.getItem('sidecut_widgetIdle'), 10); if(_scWIdle === 60 || _scWIdle === 0) widgetIdleSec = _scWIdle; }catch(_eWI){ }
  function widgetThemeFromApp(){
    // THEMES is the app's own wall. Read through guards: this runs at the first
    // widget push, which can happen before applyTheme() has been reached.
    var th = null;
    try{ th = (typeof THEMES === 'object' && THEMES && THEMES[currentTheme]) ? THEMES[currentTheme] : (THEMES ? THEMES.coral : null); }catch(_eT){ th = null; }
    if(!th) th = { name: 'Coral', bg: '#0E1B1F', bgRaised: '#16262B', coral: '#FF6F59' };
    // Title and artist are white and a dimmed white on purpose: every theme's
    // background is dark (the wall has no light theme), so a theme-driven
    // foreground is the same foreground, and the accent - the one colour that
    // actually changes between themes - is the theme's own.
    return { label: th.name || 'App theme', bg1: th.bg || '#0E1B1F', bg2: th.bgRaised || '#16262B',
             title: '#FFFFFF', artist: '#B9BDC7', accent: th.coral || '#FF6F59',
             accentText: '#0A0A0A', pill: th.bgRaised || '#16262B', pillText: '#EDEDED' };
  }
  function setWidgetFollow(on){
    widgetFollow = !!on;
    try{ localStorage.setItem('sidecut_widgetFollow', widgetFollow ? '1' : '0'); }catch(_eSF){ }
    try{ renderWidgetPreview(); }catch(_eSFP){ }
    try{ pushWidgetState(widgetTrack, widgetPlaying); }catch(_eSFS){ }
  }
  function setWidgetIdle(sec){
    var n = parseInt(sec, 10);
    widgetIdleSec = (n === 60 || n === 0) ? n : 25;
    try{ localStorage.setItem('sidecut_widgetIdle', String(widgetIdleSec)); }catch(_eSI){ }
    // A widget that was dimmed under the old setting is a beat away from the new
    // one: push once so the change is visible without waiting for a tap.
    try{ pushWidgetState(widgetTrack, widgetPlaying); }catch(_eSIS){ }
  }"""

# getWidgetTheme picks its base instead of always taking the preset.
GET_OLD = """  function getWidgetTheme(){
    const _wt = applyWidgetCustom(WIDGET_THEMES[widgetThemeKey] || WIDGET_THEMES.ocean);"""

GET_NEW = """  function getWidgetTheme(){
    // 80.3.6 - the base is either the preset the reader picked, or the app's own
    // theme. Custom colours still apply on top of both: following the theme is a
    // starting point, not a lock.
    const _wt = applyWidgetCustom(widgetFollow ? widgetThemeFromApp() : (WIDGET_THEMES[widgetThemeKey] || WIDGET_THEMES.ocean));"""

# The heartbeat's own timeout, read live so the setting is the behaviour.
IDLE_OLD = "        if(!widgetPlaying && Date.now() - _widgetLastInteraction > _widgetTimeoutMs){"

IDLE_NEW = """        // 80.3.6 - the timeout is the saved setting now, read on every beat
        // rather than captured when this block ran, so changing it takes effect
        // without a relaunch. 0 means never: the widget keeps its song.
        if(widgetIdleSec > 0 && !widgetPlaying && Date.now() - _widgetLastInteraction > widgetIdleSec * 1000){"""

# The two new rows, above Fine-tune in Settings > Widget.
UI_ANCHOR = """      <div id="widgetCustomWrap" style="margin-bottom:16px;">"""

UI_NEW = """      <div id="widgetFollowRow" style="margin-bottom:16px; background:rgba(255,255,255,0.04); border:1px solid var(--line); border-radius:12px; padding:12px 14px;">
        <label for="widgetFollowToggle" style="display:flex; align-items:flex-start; gap:12px; cursor:pointer;">
          <input type="checkbox" id="widgetFollowToggle" style="width:18px; height:18px; margin:1px 0 0; flex:0 0 auto; accent-color:var(--gold);">
          <span>
            <span style="font-size:13px; font-weight:600;">Follow the app theme</span>
            <span style="display:block; font-size:11px; color:var(--ink-dim); margin-top:4px; line-height:1.5;">The widget borrows the background and the accent of whatever theme the app is wearing, and follows along when you change it &mdash; no second palette to keep in step. Fine-tune still wins over both.</span>
          </span>
        </label>
      </div>
      <div id="widgetIdleRow" style="margin-bottom:16px; background:rgba(255,255,255,0.04); border:1px solid var(--line); border-radius:12px; padding:12px 14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-size:13px; font-weight:600;">Idle battery saver</div>
            <div style="font-size:11px; color:var(--ink-dim); margin-top:4px; line-height:1.5;">How long a paused widget keeps refreshing before it dims to &ldquo;Tap to show&rdquo;. It wakes on the next song or tap either way.</div>
          </div>
          <select id="widgetIdleSelect" style="background:var(--bg-raised); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:7px 9px; font-size:12px;">
            <option value="25">25 seconds</option>
            <option value="60">1 minute</option>
            <option value="0">Never</option>
          </select>
        </div>
      </div>
      <div id="widgetCustomWrap" style="margin-bottom:16px;">"""

# Both rows are wired once and re-synced on every render, exactly as the bars
# switch is, so re-opening the tab does not add a listener per visit.
WIRE_ANCHOR = """        barsTog.addEventListener('change', () => {
          setWidgetBars(barsTog.checked);
          toast(barsTog.checked ? 'Playing bars on' : 'Playing bars hidden');
        });
      }
    }"""

WIRE_NEW = WIRE_ANCHOR + """
    // 80.3.6 - the two options this release adds, wired the same way.
    const followTog = $('widgetFollowToggle');
    if(followTog){
      followTog.checked = !!widgetFollow;
      if(!followTog._scWired){
        followTog._scWired = true;
        followTog.addEventListener('change', () => {
          setWidgetFollow(followTog.checked);
          renderWidgetThemeControls();
          toast(followTog.checked ? 'Widget follows the app theme' : 'Widget uses its own theme');
        });
      }
    }
    const idleSel = $('widgetIdleSelect');
    if(idleSel){
      idleSel.value = String(widgetIdleSec);
      if(!idleSel._scWired){
        idleSel._scWired = true;
        idleSel.addEventListener('change', () => {
          setWidgetIdle(idleSel.value);
          toast(widgetIdleSec === 0 ? 'Widget never sleeps'
                : 'Widget idles after ' + (widgetIdleSec === 60 ? '1 minute' : widgetIdleSec + ' seconds'));
        });
      }
    }"""
