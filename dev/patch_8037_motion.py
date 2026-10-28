"""80.3.7, section 3 - the wall opens the way a list should, and a theme change
settles instead of snapping.

The owner's ask, verbatim:

    "make it more smooth"

80.3.6 gave the app one motion system. This release spends it in the one place
the owner was actually looking - the theme wall - instead of adding a second set
of numbers:

  * A GROUP THAT OPENS STAGGERED. Sixteen rows appearing in one frame reads as a
    flash; the same rows arriving 14ms apart reads as a list. Pure CSS on
    `[open]`, no listener, no timer: the animation only exists while a group is
    open, so a closed group costs nothing.
  * THE NEW THEME'S TAG. `.sc-new-tag` is the small badge on the row 80.3.7 adds.
  * A THEME CHANGE SETTLES THE SHEET. Picking a theme repaints the whole sheet at
    once. The sheet you are standing in fades from 72% to full over the app's own
    view duration instead of snapping. Guarded three ways: nothing when the sheet
    is not open, nothing when motion is reduced (either switch), and the class is
    removed before it is re-added so tapping through three themes does not
    stutter.

Reduce motion turns both off, exactly as it does for the press states and the
navigation cross-fade - the wall still opens, it just opens instantly.

Imported by dev/patch-8037.py; holds constants only.
"""

# The last line of the theme-group block in the stylesheet.
CSS_ANCHOR = ".theme-group .theme-group-body{ padding:4px 10px 10px; display:flex; flex-direction:column; gap:8px; }"

CSS_NEW = CSS_ANCHOR + """
/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 80.3.7 - the wall opens, and a theme settles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Both of these read the 80.3.6 motion tokens rather than inventing numbers, and
   both are switches on an existing element: no listener, no timer, no rAF. */
.sc-new-tag{
  font-size:9px; font-weight:700; letter-spacing:.6px; line-height:1;
  padding:3px 5px; border-radius:5px; vertical-align:middle;
  background: color-mix(in srgb, var(--coral) 22%, transparent);
  color: var(--coral); border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);
}
/* A group that opens arrives row by row. The delay is capped at ten rows: past
   that the wait would be longer than the animation, and nobody counts rows. */
.theme-group[open] .theme-group-body > *{ animation: scThemeRowIn var(--sc-t-fade) var(--sc-e-out) both; }
.theme-group[open] .theme-group-body > *:nth-child(1){ animation-delay: 0ms; }
.theme-group[open] .theme-group-body > *:nth-child(2){ animation-delay: 14ms; }
.theme-group[open] .theme-group-body > *:nth-child(3){ animation-delay: 28ms; }
.theme-group[open] .theme-group-body > *:nth-child(4){ animation-delay: 42ms; }
.theme-group[open] .theme-group-body > *:nth-child(5){ animation-delay: 56ms; }
.theme-group[open] .theme-group-body > *:nth-child(6){ animation-delay: 70ms; }
.theme-group[open] .theme-group-body > *:nth-child(7){ animation-delay: 84ms; }
.theme-group[open] .theme-group-body > *:nth-child(8){ animation-delay: 98ms; }
.theme-group[open] .theme-group-body > *:nth-child(9){ animation-delay: 112ms; }
.theme-group[open] .theme-group-body > *:nth-child(n+10){ animation-delay: 126ms; }
@keyframes scThemeRowIn{ from{ opacity:0; transform: translateY(6px); } to{ opacity:1; transform:none; } }
/* Picking a theme repaints the sheet; it settles instead of snapping. */
.sc-theme-settle{ animation: scSheetSettle var(--sc-t-view) var(--sc-e-out); }
@keyframes scSheetSettle{ from{ opacity:.72; } to{ opacity:1; } }
body.sandbox-reduce-motion .theme-group[open] .theme-group-body > *,
body.sandbox-reduce-motion .sc-theme-settle{ animation: none !important; }
@media (prefers-reduced-motion: reduce){
  .theme-group[open] .theme-group-body > *, .sc-theme-settle{ animation: none !important; }
}"""

# The tail of applyTheme, after the badge counter is told about the change.
SETTLE_ANCHOR = "    try{ if(typeof window.__scNoteTheme === 'function') window.__scNoteTheme(key); }catch(_eNote){}\n  }"

SETTLE_NEW = """    try{ if(typeof window.__scNoteTheme === 'function') window.__scNoteTheme(key); }catch(_eNote){}
    // 80.3.7 - and the sheet you picked it in settles, rather than snapping to a
    // completely repainted screen.
    scThemeSettle();
  }
  // 80.3.7 - A THEME CHANGE ANSWERS. Everything that reads --bg/--coral repaints
  // in the same frame, and the settings sheet is where you watch it happen. One
  // animation class, removed and re-added so a second tap restarts it instead of
  // being ignored.
  //
  // The guards are the point: while the sheet is CLOSED (boot, a deep link, the
  // prepaint restore) nothing runs at all, and with motion reduced - either the
  // Sandbox switch or the device's - nothing runs either. This is the same rule
  // scNavigateSmooth follows, written out here because that one is sealed inside
  // its own closure around navigate().
  function scThemeSettle(){
    try{
      var bd = $('themeBackdrop');
      if(!bd || bd.style.display !== 'flex') return;
      var _rm = false;
      try{
        _rm = !!(document.body && document.body.classList.contains('sandbox-reduce-motion')) ||
              !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }catch(_eRm){ }
      if(_rm) return;
      var sheet = bd.querySelector('.modal');
      if(!sheet) return;
      sheet.classList.remove('sc-theme-settle');
      void sheet.offsetWidth; // forces the restart without a timer
      sheet.classList.add('sc-theme-settle');
    }catch(_eSettle){ }
  }"""
