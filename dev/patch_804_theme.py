"""80.4, section 1 - one dot again, and the theme loses its brand name.

The owner's ask, verbatim:

    "you don't need to mention color os anywhere in the app or themes or patch
     notes dawg ... what is this random ahh color palette thing remove that and
     make that how it was before. rename the color os theme."

THREE THINGS, ONE FILE.

  * THE CHIP GOES BACK TO A DOT. 80.3.7 replaced the round accent dot with a
    three-band chip - background, accent, second accent - to show a theme's whole
    palette. On a phone it reads as a random colour swatch strip, not a theme, and
    it changed a row people had been reading for years. The dot is back: 18px,
    round, the accent (a coral-to-gold gradient for a dynamic theme, the conic
    wheel for RGB, exactly as before). The row is otherwise untouched.
  * THE THEME IS RENAMED. It is `Lagoon (dynamic)` now. Lagoon, because the
    palette is a deep teal-black with a mint accent over aqua - and because a phone
    theme should be named after what it looks like, not after another company's
    operating system. The key stays `prism` and so does `dynamic:'prism'`, so a
    phone that already wears it keeps its pick, its prepaint cache and its curtain.
  * `fresh:true` STAYS. It is the newest theme on the wall and it keeps the NEW
    pill; the flag is the release's, not the theme's.

The word itself is removed from the page by patch_804_scrub.py, which rewrites the
changelog items and comments that named it. A driver assertion checks the page
carries no occurrence of it at all, in any case.

Imported by dev/patch-804.py; holds constants only.
"""

# The theme entry as 80.3.7 left it.
THEME_OLD = "    prism:       {  name: 'ColorOS (dynamic)',    bg:'#07181A', bgRaised:'#0E2A2C', coral:'#37E6C4', gold:'#7FD1FF', dynamic:'prism', fresh:true }"

THEME_NEW = "    prism:       {  name: 'Lagoon (dynamic)',     bg:'#07181A', bgRaised:'#0E2A2C', coral:'#37E6C4', gold:'#7FD1FF', dynamic:'prism', fresh:true }"

# 80.3.7's three-band chip.
SWATCH_OLD = """    // 80.3.7 - the chip is the theme, not one of its colours: a third of it is the
    // background the app will be painted with, a third the accent, a third the
    // second accent. The old dot showed the accent alone, so two themes with the
    // same accent and different backgrounds looked identical in the wall.
    const swatch = th.rgb
      ? 'background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);'
      : 'background: linear-gradient(90deg, ' + (th.bg || '#0E1B1F') + ' 0 33%, ' +
        (th.coral || '#FF6F59') + ' 33% 66%, ' + (th.gold || '#D4A574') + ' 66% 100%);';"""

SWATCH_NEW = """    // 80.4 - ONE DOT AGAIN. 80.3.7 turned this into a three-band chip of the whole
    // palette; on a phone that reads as a strip of random colours rather than as a
    // theme, and it changed a row people had been reading for years. The dot is
    // the accent - a coral-to-gold gradient when the theme moves, the hue wheel for
    // RGB, the plain accent otherwise - which is what it was before.
    const swatch = th.rgb
      ? 'background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);'
      : (th.dynamic || th.liquidGlass)
        ? 'background: linear-gradient(135deg, ' + th.coral + ', ' + th.gold + ');' + (th.liquidGlass ? ' backdrop-filter: blur(2px);' : '')
        : 'background:' + th.coral + ';';"""

# The row's swatch geometry.
ROW_OLD = """    const freshTag = th.fresh ? ' <span class="sc-new-tag">NEW</span>' : '';
    return '<button class="playlist-pick-btn' + (key === currentTheme ? ' already' : '') + '" data-theme-key="' + key + '" style="display:flex; align-items:center; gap:10px; width:100%; text-align:left;">' +
      '<span style="width:26px; height:18px; border-radius:5px; ' + swatch + ' display:inline-block; flex-shrink:0; border:1px solid rgba(255,255,255,' + (th.liquidGlass ? 0.45 : 0.2) + ');"></span>' +"""

ROW_NEW = """    const freshTag = th.fresh ? ' <span class="sc-new-tag">NEW</span>' : '';
    return '<button class="playlist-pick-btn' + (key === currentTheme ? ' already' : '') + '" data-theme-key="' + key + '" style="display:flex; align-items:center; gap:10px; width:100%; text-align:left;">' +
      '<span style="width:18px; height:18px; border-radius:50%; ' + swatch + ' display:inline-block; flex-shrink:0; border:1px solid rgba(255,255,255,' + (th.liquidGlass ? 0.45 : 0.2) + ');"></span>' +"""
