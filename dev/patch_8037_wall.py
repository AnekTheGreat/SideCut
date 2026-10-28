"""80.3.7, section 2 - the wall is ordered by what you can actually pick.

The owner's ask, verbatim:

    "all non badge themes should be before the badge themes in line ... make the
     app nice and user friendly"

WHAT WAS WRONG. `renderThemeOptions()` put every theme into one of two groups -
static, or animated - and the four badge rewards were mixed into those groups in
object order. Cinder, Quartz and Lumen sat at the end of the static list, and
Vortex sat in the middle of the dynamic one, two rows above the theme 80.3.6 had
just added. So the one new theme on the wall was below a theme that is locked
until you earn 200 badges, and it looked like the new theme was missing.

WHAT THIS DOES.

  * A THIRD GROUP. Badge rewards get their own collapsible, printed last, so
    every free theme is above every earned one - the ask, literally. They still
    wear their BADGE REWARD / "N BADGES" tag and still refuse to apply until the
    badges are there; nothing about how they unlock moved.
  * THE NEW THEME COMES FIRST. `fresh:true` on the entry is what puts it at the
    top of its group (and puts a NEW tag on the row); when the next release drops
    the flag, the theme settles back into object order. No hand-maintained list.
  * THE CHIP SHOWS THE PALETTE. The row's swatch used to be one dot of the accent,
    so two themes with the same accent and different backgrounds were
    indistinguishable. It is a three-band chip now: background, accent, second
    accent - the three things a theme actually decides.
  * Every tap on a row opens it with a short stagger (CSS, in patch_8037_motion),
    which is what makes a sixteen-row list feel like it arrived rather than
    appeared. Nothing about picking changed.

Imported by dev/patch-8037.py; holds constants only.
"""

# The grouping code, from the two-group literal to the end of the forEach.
GROUP_OLD = """    const groups = { static: [], dynamic: [] };
    if(THEMES.custom) groups.static.push('custom'); // user's custom theme first
    Object.keys(THEMES).forEach(key => {
      if(key === 'custom') return;
      const th = THEMES[key];
      (th.rgb || th.dynamic ? groups.dynamic : groups.static).push(key);
    });"""

GROUP_NEW = """    // 80.3.7 - BADGE THEMES LAST. Three groups: a badge reward is earned, so it
    // belongs after every theme anyone can pick today, not between two of them.
    // 80.3.6's new theme shipped below Vortex (a 200-badge reward) and read as
    // missing - this is that, fixed at the ordering rather than at the theme.
    const groups = { static: [], dynamic: [], reward: [] };
    if(THEMES.custom) groups.static.push('custom'); // user's custom theme first
    Object.keys(THEMES).forEach(key => {
      if(key === 'custom') return;
      const th = THEMES[key];
      if(th.reward){ groups.reward.push(key); return; }
      (th.rgb || th.dynamic ? groups.dynamic : groups.static).push(key);
    });
    // 80.3.7 - the theme this release adds sits at the top of its group instead of
    // sixteen rows down. `fresh` lives on the theme entry, so it leaves with the
    // entry when the next release takes the flag off - there is no second list.
    ['static', 'dynamic'].forEach(function(g){
      groups[g] = groups[g].filter(function(k){ return THEMES[k] && THEMES[k].fresh; })
                           .concat(groups[g].filter(function(k){ return !(THEMES[k] && THEMES[k].fresh); }));
    });"""

# The three groups, in the order they are printed.
RENDER_OLD = "    container.innerHTML = themeGroupHTML('Static themes', groups.static, false) + themeGroupHTML('Dynamic themes (animated)', groups.dynamic, false);"

RENDER_NEW = """    // 80.3.7 - printed in this order, and the earned group last, always.
    container.innerHTML = themeGroupHTML('Static themes', groups.static, false) +
                          themeGroupHTML('Dynamic themes (animated)', groups.dynamic, false) +
                          themeGroupHTML('Badge rewards (earned)', groups.reward, false);"""

# The swatch: one dot of the accent, replaced by the theme's own three colours.
SWATCH_OLD = """    const swatch = th.rgb
      ? 'background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);'
      : (th.dynamic || th.liquidGlass)
        ? 'background: linear-gradient(135deg, ' + th.coral + ', ' + th.gold + ');' + (th.liquidGlass ? ' backdrop-filter: blur(2px);' : '')
        : 'background:' + th.coral + ';';"""

SWATCH_NEW = """    // 80.3.7 - the chip is the theme, not one of its colours: a third of it is the
    // background the app will be painted with, a third the accent, a third the
    // second accent. The old dot showed the accent alone, so two themes with the
    // same accent and different backgrounds looked identical in the wall.
    const swatch = th.rgb
      ? 'background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);'
      : 'background: linear-gradient(90deg, ' + (th.bg || '#0E1B1F') + ' 0 33%, ' +
        (th.coral || '#FF6F59') + ' 33% 66%, ' + (th.gold || '#D4A574') + ' 66% 100%);';"""

# The row's lock/tick line and its swatch shape.
ROW_OLD = """    return '<button class="playlist-pick-btn' + (key === currentTheme ? ' already' : '') + '" data-theme-key="' + key + '" style="display:flex; align-items:center; gap:10px; width:100%; text-align:left;">' +
      '<span style="width:18px; height:18px; border-radius:50%; ' + swatch + ' display:inline-block; flex-shrink:0; border:1px solid rgba(255,255,255,' + (th.liquidGlass ? 0.45 : 0.2) + ');"></span>' +
      lock + (key === currentTheme ? '\u2713 ' : '') + th.name + freeTag + '</button>';"""

ROW_NEW = """    // 80.3.7 - the theme this release adds says so, in the one place a reader is
    // looking for it. The flag is on the entry, so the tag disappears on its own.
    const freshTag = th.fresh ? ' <span class="sc-new-tag">NEW</span>' : '';
    return '<button class="playlist-pick-btn' + (key === currentTheme ? ' already' : '') + '" data-theme-key="' + key + '" style="display:flex; align-items:center; gap:10px; width:100%; text-align:left;">' +
      '<span style="width:26px; height:18px; border-radius:5px; ' + swatch + ' display:inline-block; flex-shrink:0; border:1px solid rgba(255,255,255,' + (th.liquidGlass ? 0.45 : 0.2) + ');"></span>' +
      lock + (key === currentTheme ? '\u2713 ' : '') + th.name + freeTag + freshTag + '</button>';"""
