#!/usr/bin/env node
/**
 * SideCut 70.0.5 - the badge-rewards half of the release.
 *
 * The user's request, in one message:
 *   "Achivements should have over 200 of them including 1 secret 1 where you have
 *    to enter dev mode in order to obtain them. If you can get all 200 badges you
 *    get a free very nice dynamic theme that whirls with your finger same version
 *    v70.0.5 you should also get a free theme for reaching 50 badges, 100 badges
 *    and 150 badges and at 201 with the secret one you can get a free SideCut
 *    premium"
 *
 * patch-705.mjs moved two dock/header controls. This one is the rest of 70.0.5:
 * the four reward themes, the bridge that lets the badge count gate them, and the
 * one-off Premium grant. dev/sc70-module.js holds the badges themselves (201 of
 * them, in nine groups) and is RE-SPLICED here, so the module file stays the
 * source of truth and index.html is never hand-edited.
 *
 * Two things are deliberately live rather than stored:
 *
 *   * the three static reward themes and Vortex ask the badge count for
 *     permission EVERY time the Theme tab is drawn (window.__scRewardThemeUnlocked).
 *     There is no "unlocked" flag to write, nothing to lose on a reinstall that
 *     keeps badges, and no second copy of the truth that can drift from the
 *     badges themselves.
 *   * Premium is the one reward with a side effect, so it is granted once and
 *     recorded (sidecut_reward_premium) - through the SAME setter the store path
 *     uses, so every premium surface updates at once. A dev-mode badge reset
 *     clears badges, counters and flags; it never clears this.
 *
 * Every edit is anchored and asserted, so a tree that does not match fails loudly
 * instead of being half-patched. Re-running it is a no-op.
 *
 * Run order: `node dev/patch-705.mjs` (the dock/header move) FIRST, then this one.
 * Both write the same changelog entry - it is one release, so its own notes grow
 * rather than a second entry being added - and patch-705's step is keyed on the
 * version line, so a re-run of it recognises its work and leaves this file's
 * wording alone.
 *
 *   node dev/patch-705b.mjs            # apply
 *   node dev/patch-705b.mjs --check    # report only, change nothing
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const CSS = path.join(ROOT, 'dev', 'sc70-styles.css');
const CHECK = process.argv.includes('--check');
const VERSION = '70.0.5';

let html = fs.readFileSync(IDX, 'utf8');
const htmlStart = html;
let applied = 0, already = 0;
const problems = [];

function count(hay, needle){ return hay.split(needle).length - 1; }

function sub(label, oldStr, newStr, opts = {}){
  if(opts.key && count(html, opts.key) >= 1){ already++; return; }
  const times = count(html, oldStr);
  if(times === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(times > 1 && !opts.all){ problems.push('anchor is not unique, found ' + times + ' (' + label + ')'); return; }
  html = html.split(oldStr).join(newStr);
  applied++;
}

/* ------------------------------------------------------- 1. the module file */
// Two small additions to the module: the theme counter the app now reports to,
// and the reward lookup the Theme tab reads. Everything else in the module was
// written by dev/patch-705-module.mjs and is left alone here.
let mod = fs.readFileSync(MOD, 'utf8');
const modStart = mod;
let modWritten = false;
{
  const mstart = mod;
  const mproblems = [];
  function msub(label, oldStr, newStr, opts = {}){
    if(opts.key && count(mod, opts.key) >= 1){ return; }
    const n = count(mod, oldStr);
    if(n === 0){ mproblems.push('module anchor missing (' + label + ')'); return; }
    if(n > 1 && !opts.all){ mproblems.push('module anchor is not unique, found ' + n + ' (' + label + ')'); return; }
    mod = mod.split(oldStr).join(newStr);
  }
  // The app's Theme tab calls this on every applyTheme(), so a theme worn from
  // Settings counts exactly like one worn from the Studio picker.
  msub('__scNoteTheme bridge',
    '\n  // The module\'s own surface, for the gates and for the assistant.\n',
    '\n  // The app applies a theme from its own tab as well as from ours, and the\n' +
    '  // "wore N dynamic themes" badges count either way - so the app reports\n' +
    '  // every change through here.\n' +
    '  window.__scNoteTheme = noteTheme;\n\n' +
    '  // The module\'s own surface, for the gates and for the assistant.\n',
    { key: 'window.__scNoteTheme = noteTheme;' });
  // The Premium reward is the STATE the count implies, not a milestone like a
  // badge, so it is granted whenever the count is evaluated rather than only on
  // the frame a badge happens to unlock. It matters: dev mode's "pretend all
  // earned" changes no badge's own progress, so a fresh-length test would never
  // grant it, and a user sitting on 201 badges with nothing new to unlock would
  // be stuck a reward short.
  msub('grantRewards out of the fresh-only block',
    '      celebrateRewards(before);\n      grantRewards(!!silent);\n      if(!silent){',
    '      celebrateRewards(before);\n      if(!silent){',
    { key: 'celebrateRewards(before);\n      if(!silent){' });
  msub('grantRewards on every check',
    '\n    return fresh;\n  }\n',
    '\n    // See the note above the reward table: Premium follows the count, so it is\n' +
    '    // granted on every evaluation of it, not only when a badge unlocks.\n' +
    '    grantRewards(!!silent);\n' +
    '    return fresh;\n  }\n',
    { key: 'grantRewards(!!silent);\n    return fresh;' });
  // The secret group has to keep SHOWING before dev mode. Returning '' for it
  // made the wall read as exactly 200 badges, which is not what it is: the whole
  // point of the hint is that there is a 201st. One blank tile and a '?' in place
  // of the count says that without spoiling it.
  msub('the secret group stays visible',
    "          '<div class=\"sc-badges\">' + g.items.filter(isUnlocked).map(badgeTile).join('') + '</div></div>' : '';",
    "          '<div class=\"sc-badges\">' + (g.have ? g.items.filter(isUnlocked).map(badgeTile).join('') : secretTile()) + '</div></div>';",
    { key: 'g.have ? g.items.filter(isUnlocked).map(badgeTile).join(\'\') : secretTile()' });
  // ...which means the `g.have ?` that used to guard the whole return has to go
  // too, or the ternary is left with no else. (Also the repair for a run that
  // swapped the tail first.)
  msub('the secret group is unconditional',
    "        return g.have ? '<div class=\"sc-ach-group\">' +\n" +
    "          '<div class=\"sc-ach-group-head\"><span>' + esc(g.title) + '</span><span>' + g.have + '/' + g.items.length + '</span></div>' +\n" +
    "          '<div class=\"sc-badges\">' + (g.have ?",
    "        return '<div class=\"sc-ach-group\">' +\n" +
    "          '<div class=\"sc-ach-group-head\"><span>' + esc(g.title) + '</span><span>' + g.have + '/' + g.items.length + '</span></div>' +\n" +
    "          '<div class=\"sc-badges\">' + (g.have ?",
    { key: "        return '<div class=\"sc-ach-group\">' +\n          '<div class=\"sc-ach-group-head\"><span>' + esc(g.title) + '</span><span>' + g.have" });
  // rewardFor(key): what the Theme tab needs to say "120 badges unlock this".
  msub('rewardFor export',
    '    themeUnlocked: themeUnlocked,\n',
    '    themeUnlocked: themeUnlocked,\n' +
    '    rewardFor: function(key){\n' +
    '      var r = REWARDS.filter(function(x){ return x.key === key; })[0];\n' +
    '      if(!r) return null;\n' +
    '      return { at: r.at, key: r.key, name: r.name, kind: r.kind, earned: rewardEarned(r.at), have: unlockedCount() };\n' +
    '    },\n',
    { key: 'rewardFor: function(key){' });
  if(mproblems.length){
    mproblems.forEach(p => problems.push(p));
  } else if(mod !== mstart){
    // The splice below and the final checks both read the PATCHED text, so
    // --check reports on the tree this run would produce, not the one on disk.
    modWritten = !CHECK;
    applied++;
  } else {
    already++;
  }
}

/* ------------------------------------------------------------- 2. the themes */
// Four themes, all four badge rewards, none of them purchasable. `reward: true`
// is what the Theme tab keys off: it shows the badge count that unlocks the theme
// instead of the FREE/premium tag, and it gates the tile on the live count.
// Vortex is `dynamic: 'vortex'`, so applyTheme() puts the body in
// body.theme-dyn-vortex - that class is the whole of its CSS, and --whirl-deg
// (written by the module) is the finger-driven rotation.
{
  const newThemes =
    "    // ── v70.0.5 reward themes. These four are never sold: they are earned by\n" +
    "    // badges (50, 100, 150, and the dynamic one at 200), which is why they\n" +
    "    // carry `reward` instead of `premium`. The Theme tab reads the badge count\n" +
    "    // live rather than trusting a stored unlock, so the wall and the theme list\n" +
    "    // can never disagree.\n" +
    "    cinder:      {  name: 'Cinder (reward)',       bg:'#141013', bgRaised:'#1F1A1E', coral:'#FF7A45', gold:'#B9A6A0', reward:true  },\n" +
    "    quartz:      {  name: 'Quartz (reward)',       bg:'#101418', bgRaised:'#1A2027', coral:'#9FD8F5', gold:'#D6E4EC', reward:true  },\n" +
    "    lumen:       {  name: 'Lumen (reward)',        bg:'#0C1710', bgRaised:'#132219', coral:'#5BE49B', gold:'#C8F0A6', reward:true  },\n" +
    "    vortex:      {  name: 'Vortex (dynamic)',      bg:'#0a0718', bgRaised:'#1a1133', coral:'#9B7BFF', gold:'#63E2FF', reward:true, dynamic:'vortex'  }\n";
  // The original table's last entry (Orchid) ended the object, so it carried no
  // trailing comma - it does now. Anchored on that line whatever its spacing, and
  // it doubles as the repair for a run that inserted the block before this fix.
  const commaFix = /^([ \t]*orchid:[^\n]*?)([ \t]*)\}([ \t]*)$/m;
  const addComma = (m, body, sp) => body + sp + '},';
  if(count(html, 'cinder:') >= 1){
    const before = html;
    html = html.replace(commaFix, addComma);
    if(html === before) already++; else applied++;
  } else {
    const before = html;
    html = html.replace(commaFix, (m, body, sp) => body + sp + '},\n' + newThemes.replace(/\n$/, ''));
    if(html === before) problems.push('anchor missing (the THEMES table tail)');
    else applied++;
  }
}

/* ------------------------------------------------- 3. the live theme gate */
// Both halves of the gate: the tiles (a lock + the badge count) and the click.
// The helper is defined next to themeButtonHTML rather than near THEMES so it
// reads beside the two places that use it.
{
  sub('reward theme helpers',
    "  function themeGroupHTML(title, keys, startOpen){\n",
    "  // 70.0.5 - four themes are badge rewards, not purchases. This asks the Studio\n" +
    "  // block for the live badge count every time it is called (never caches it), so\n" +
    "  // there is no second copy of \"unlocked\" that can drift from the badges. If the\n" +
    "  // block has not loaded yet the theme is left usable rather than wrongly locked.\n" +
    "  function rewardThemeOK(key){\n" +
    "    try{ return (typeof window.__scRewardThemeUnlocked === 'function') ? !!window.__scRewardThemeUnlocked(key) : true; }catch(e){ return true; }\n" +
    "  }\n" +
    "  function rewardThemeNeed(key){\n" +
    "    try{\n" +
    "      const p = (typeof window.__scRewardThemeProgress === 'function') ? window.__scRewardThemeProgress(key) : null;\n" +
    "      return p ? Math.max(0, p.at) : 0;\n" +
    "    }catch(e){ return 0; }\n" +
    "  }\n" +
    "  function themeGroupHTML(title, keys, startOpen){\n",
    { key: 'function rewardThemeOK(key){' });

  sub('reward theme tile',
    "    const lock = (th.premium && !isPremiumActive()) ? '\ud83d\udd12 ' : '';\n" +
    "    const freeTag = (!th.premium && !isPremiumActive()) ? ' <span style=\"color:#7BC96F; font-size:10px; font-weight:700; letter-spacing:.5px;\">FREE</span>' : '';",
    "    const reward = !!th.reward;\n" +
    "    const rewardOk = reward ? rewardThemeOK(key) : true;\n" +
    "    const lock = (th.premium && !isPremiumActive()) ? '\ud83d\udd12 ' : (reward && !rewardOk ? '\ud83c\udfc5 ' : '');\n" +
    "    // A reward theme wears the badge it costs, not FREE - FREE would read as\n" +
    "    // \"available now\", which is exactly what it is not.\n" +
    "    const freeTag = reward\n" +
    "      ? ' <span style=\"color:#E3B23C; font-size:10px; font-weight:700; letter-spacing:.5px;\">' + (rewardOk ? 'BADGE REWARD' : rewardThemeNeed(key) + ' BADGES') + '</span>'\n" +
    "      : ((!th.premium && !isPremiumActive()) ? ' <span style=\"color:#7BC96F; font-size:10px; font-weight:700; letter-spacing:.5px;\">FREE</span>' : '');",
    { key: 'const rewardOk = reward ? rewardThemeOK(key) : true;' });

  sub('reward theme click gate',
    "        if(th.premium && !isPremiumActive()){\n" +
    "          toast('This theme is a premium feature \u2014 unlock it to use it.');\n" +
    "          openPremiumSettings();\n" +
    "          return;\n" +
    "        }\n" +
    "        applyTheme(key);",
    "        if(th.premium && !isPremiumActive()){\n" +
    "          toast('This theme is a premium feature \u2014 unlock it to use it.');\n" +
    "          openPremiumSettings();\n" +
    "          return;\n" +
    "        }\n" +
    "        // A reward theme is free the moment the badges are there, for everyone,\n" +
    "        // with or without Premium - so it is checked after the premium gate.\n" +
    "        if(th.reward && !rewardThemeOK(key)){\n" +
    "          toast('\ud83c\udfc5 ' + th.name.split(' (')[0] + ' is a badge reward \u2014 ' + rewardThemeNeed(key) + ' badges unlock it. Studio \u2192 Achievements shows where you are.', 3800);\n" +
    "          return;\n" +
    "        }\n" +
    "        applyTheme(key);",
    { key: 'badges unlock it. Studio' });
}

/* ---------------------------------------- 4. the theme counter bridge (app) */
{
  sub('applyTheme counter report',
    "        dyn: th.dynamic || ''\n" +
    "      }));\n" +
    "    }catch(_ePrepaint){}\n" +
    "  }",
    "        dyn: th.dynamic || ''\n" +
    "      }));\n" +
    "    }catch(_ePrepaint){}\n" +
    "    // 70.0.5 - the badge wall counts which themes have actually been worn, and\n" +
    "    // that counter lives in the Studio block. Optional on purpose: the block\n" +
    "    // loads right after this one, and a theme picked before it is up is one\n" +
    "    // count missed, never an error.\n" +
    "    try{ if(typeof window.__scNoteTheme === 'function') window.__scNoteTheme(key); }catch(_eNote){}\n" +
    "  }",
    { key: 'window.__scNoteTheme(key);' });
}

/* --------------------------------------------------------- 5. the new hooks */
{
  sub('70.0.5 reward hooks',
    "  window.__scResume = function(){ try{ var _a2 = activeAudio(); if(_a2 && _a2.paused) $('playPauseBtn').click(); }catch(e){} };",
    "  window.__scResume = function(){ try{ var _a2 = activeAudio(); if(_a2 && _a2.paused) $('playPauseBtn').click(); }catch(e){} };\n" +
    "\n" +
    "  // ---- 70.0.5 reward hooks -------------------------------------------------\n" +
    "  // The badge count itself lives in the Studio block; these three are how the\n" +
    "  // rest of the app reaches it. Each one is a plain read or one named call.\n" +
    "  window.__scRewardThemeUnlocked = function(key){\n" +
    "    try{ return (window.SC70 && SC70.themeUnlocked) ? !!SC70.themeUnlocked(key) : true; }catch(e){ return true; }\n" +
    "  };\n" +
    "  window.__scRewardThemeProgress = function(key){\n" +
    "    try{ return (window.SC70 && SC70.rewardFor) ? SC70.rewardFor(key) : null; }catch(e){ return null; }\n" +
    "  };\n" +
    "  // The 201-badge reward. It is a real grant through the same setter the store\n" +
    "  // path uses, so every premium surface updates at once - but it is recorded as\n" +
    "  // gifted and carries where it came from, so the Premium tab can say so, and\n" +
    "  // nothing but a real purchase is what it takes to lose. A dev-mode badge reset\n" +
    "  // deliberately does not touch it.\n" +
    "  window.__scGrantPremium = function(opts){\n" +
    "    try{\n" +
    "      if(isPremiumActive()) return true;\n" +
    "      setPremiumActive(Object.assign({ plan: 'gifted', gifted: true, source: 'badges' }, opts || {}));\n" +
    "      return true;\n" +
    "    }catch(e){ return false; }\n" +
    "  };",
    { key: 'window.__scGrantPremium = function(opts){' });
}

/* ------------------------------------------------------------ 6. changelog */
// Same version, so the release's own entry GROWS rather than a second 70.0.5
// entry appearing. The dock move shipped first, the badge wall second, and the
// reader sees one release with both in it.
{
  sub('70.0.5 title',
    "  { version: '70.0.5', date: 'September 28, 2026 · 10:06 PM EDT', title: 'Add songs moves to the top of the screen, and the dock drops to four tabs', items: [",
    "  { version: '70.0.5', date: 'September 28, 2026 · 10:06 PM EDT', title: 'Add songs moves to the top of the screen, the dock drops to four tabs, and achievements grow to 201 with five rewards', items: [",
    { key: 'achievements grow to 201 with five rewards' });
  sub('70.0.5 badge notes',
    "    'The how-to text that pointed at the old dock pill now just names the Add songs menu, since there is no pill down there to tap any more.',\n  ] },",
    "    'The how-to text that pointed at the old dock pill now just names the Add songs menu, since there is no pill down there to tap any more.',\n" +
    "    'Achievements grew from thirty badges to 201, sorted into nine sections - listening, streaks, discovery, library, Studio, the assistant, themes, milestones, and one that has to be found. Every locked one shows how far along it is.',\n" +
    "    'One badge is secret and is not on the grid at all until you find the door: tap the version line in Settings seven times to open dev mode. The panel that appears can also self-test and pretend the whole wall is earned.',\n" +
    "    'Badges pay out five times. Fifty badges unlocks the Cinder theme, a hundred Quartz, and a hundred and fifty Lumen - free, with or without Premium. Two hundred unlocks Vortex, a dynamic theme that whirls around as you drag a finger across the screen.',\n" +
    "    'All 201, the secret one included, grants SideCut Premium for free. It is a real unlock down the same path a purchase takes, and putting the badges back does not take it away.',\n" +
    "  ] },",
    { key: 'The panel that appears can also self-test' });
}

/* -------------------------------------------------------- 7. re-splice both */
// The module and the stylesheet are spliced from their own files, and BOTH are
// replaced in place rather than only inserted - index.html is far too large for
// the editor tools to reach into, so the .js/.css files are the source of truth
// and this is the step that publishes them.
{
  const openTag = '<script id="sc-studio-70">';
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = openTag + '\n' + mod + '</script>\n';
  if(blockRe.test(html)){
    const before = html;
    html = html.replace(blockRe, wrapped);
    if(html === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }

  const cssText = fs.readFileSync(CSS, 'utf8');
  const cssBlockRe = /\n\/\* =+\n   SideCut 70\.0 -[\s\S]*?<\/style>/;
  if(cssBlockRe.test(html)){
    const before = html;
    html = html.replace(cssBlockRe, '\n' + cssText + '</style>');
    if(html === before) already++; else applied++;
  } else {
    problems.push('the SideCut 70.0 stylesheet block is missing');
  }
}

/* ------------------------------------------------------------------- checks */
const must = (cond, msg) => { if(!cond) problems.push(msg); };
must(count(html, "const APP_VERSION = '70.0.5';") === 1, 'the version is not 70.0.5 exactly once');
must(count(html, 'cinder:') === 1, 'the Cinder reward theme is missing');
must(count(html, 'quartz:') === 1, 'the Quartz reward theme is missing');
must(count(html, 'lumen:') === 1, 'the Lumen reward theme is missing');
must(count(html, "dynamic:'vortex'") === 1, 'the Vortex reward theme is missing');
must(count(html, 'reward:true') === 4, 'there are not exactly four reward themes (' + count(html, 'reward:true') + ')');
must(count(html, 'function rewardThemeOK(key){') === 1, 'the live reward gate is missing in index.html');
must(count(html, 'window.__scRewardThemeUnlocked') >= 2, 'the reward gate is defined but never asked');
must(count(html, '__scGrantPremium') >= 2, 'the premium grant hook is defined but never called');
must(count(html, 'window.__scNoteTheme') >= 3, 'the theme counter bridge is not both halves');
must(count(html, 'window.__scNoteTheme = noteTheme;') === 1, 'the module does not publish the theme counter');
must(count(html, 'rewardFor: function(key){') === 1, 'the module does not publish the reward lookup');
must(count(html, 'body.theme-dyn-vortex::before') === 1, 'the Vortex backdrop is missing from the stylesheet');
must(count(html, '.sc-ach-groups{') === 1, 'the badge wall styles are missing (' + count(html, '.sc-ach-groups{') + ')');
must(count(html, '.sc-rewards{') === 1, 'the reward row styles are missing');
must(count(html, '.sc-dev{') === 1, 'the dev panel styles are missing');
must(count(html, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');
must(count(html, '.sc-tools{') === 2, 'the Studio stylesheet is not in the page (' + count(html, '.sc-tools{') + ')');
must(count(html, "title: 'Add songs moves to the top of the screen, the dock drops to four tabs") === 1, 'the 70.0.5 head entry title is wrong');
must(count(html, 'five rewards') >= 1, 'the changelog does not mention the rewards');

if(problems.length){
  console.error('patch-705b: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-705b: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}
if(modWritten){ fs.writeFileSync(MOD, mod); console.log('patch-705b: dev/sc70-module.js updated'); }
if(html === htmlStart && applied === 0){
  console.log('patch-705b: nothing to change, tree is already at ' + VERSION + ' (' + already + ' in place)');
  process.exit(0);
}
fs.writeFileSync(IDX, html);
console.log('patch-705b: index.html written - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-705b: run `node dev/patch-70.mjs` to re-verify the release, then the OTA rebuild');
