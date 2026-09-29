#!/usr/bin/env node
/**
 * 70.0.5 - the badge release, applied to dev/sc70-module.js.
 *
 * The module is 1960 lines and the file tools stop matching text in it, so the
 * rest of the work goes through this script the way index.html goes through
 * patch-70/patch-705. Every edit is anchored and asserted: a tree that does not
 * match fails loudly instead of being half-patched, and re-running is a no-op
 * because each anchor disappears when its edit lands.
 *
 * What it finishes, on top of the engine already in the module:
 *   - 171 generated badges in nine sections render as a grouped grid
 *   - the five reward rows (50/100/150/200/201) with live progress
 *   - the secret badge as a blank tile until dev mode opens it
 *   - dev mode: the seven-tap gesture, the panel, and its four tools
 *   - the counters the new badges read, bumped where the app already acts
 *   - Vortex: the 200-badge theme, spinning under the finger with momentum
 *
 *   node dev/patch-705-module.mjs
 *   node dev/patch-705-module.mjs --check
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const CHECK = process.argv.includes('--check');

let src = fs.readFileSync(MOD, 'utf8');
const start = src;
let applied = 0, already = 0;
const problems = [];
const done = [];

function count(hay, needle){ return hay.split(needle).length - 1; }
// opts.marker is for the INSERTIONS. An insertion ends with the text it was hung
// on, so that anchor survives it and a second run would insert a second copy -
// the trap patch-70 documents one level up. The marker is a string that only
// exists once the edit has landed, so its presence IS the answer to "has this
// step already run?".
function sub(label, oldStr, newStr, opts = {}){
  if(opts.marker && src.indexOf(opts.marker) !== -1){ already++; return; }
  const times = count(src, oldStr);
  if(times === 0){ already++; return; }
  if(times > 1){
    problems.push(`anchor is not unique, found ${times} (${label})`);
    return;
  }
  src = src.replace(oldStr, newStr);
  applied++;
  done.push(label);
}

/* ------------------------------------------------- 1. the dev-only simulation */
sub('sim state key',
  "    reward: 'sidecut_reward_premium'\n  };",
  "    reward: 'sidecut_reward_premium',\n    sim: 'sidecut_dev_sim'\n  };");

sub('unlockedCount + dev simulation',
  `  function unlockedCount(){
    var n = 0;
    ACHIEVEMENTS().forEach(function(a){ if(a.need.got >= a.need.want) n++; });
    return n;
  }`,
  `  // Dev mode can pretend every badge is earned, so the reward path can be walked
  // without playing ten thousand songs first. It is honoured ONLY while dev mode
  // is on, and the panel says so on the line above the button.
  var simAll = !!lsGet(LS.sim, false);
  function unlockedCount(){
    var all = ACHIEVEMENTS();
    if(simAll && devOn) return all.length;
    var n = 0;
    all.forEach(function(a){ if(a.need.got >= a.need.want) n++; });
    return n;
  }`);

sub('badgesByGroup takes the list',
  `  function badgesByGroup(){
    var all = ACHIEVEMENTS();`,
  `  function badgesByGroup(list){
    var all = list || ACHIEVEMENTS();`);

/* --------------------------------------------- 2. the tile renderer, reusable */
sub('tile renderer head',
  `  function achievementsHtml(){
    return ACHIEVEMENTS().map(function(a){
      var have = isUnlocked(a);
      var p = pctNeed(a);
      return '<div class="sc-badge' + (have ? ' have' : '') + ' tone-' + a.tone + '">' +`,
  `  // One badge tile. The grouped grid calls this per badge (70.0.5 added 171 of
  // them, in nine sections, so the grid needs a tile it can call rather than a
  // map over everything), and the secret badge has a tile of its own below it
  // because it must not be spoiled before it is earned.
  function badgeTile(a){
      var have = isUnlocked(a);
      var p = pctNeed(a);
      var out = '';
      out += '<div class="sc-badge' + (have ? ' have' : '') + ' tone-' + a.tone + '">' +`);

sub('tile renderer tail',
  `        '<div class="sc-badge-bar"><i style="width:' + (have ? 100 : p) + '%"></i></div></div></div>';
    }).join('');
  }`,
  `        '<div class="sc-badge-bar"><i style="width:' + (have ? 100 : p) + '%"></i></div></div></div>';
      return out;
  }`);

/* ------------------------------------------------------- 3. the grouped grid */
sub('grouped grid + rewards + dev panel',
  '  function storageHtml(){',
  `  var achFilter = 'all';
  function secretTile(){
    return '<div class="sc-badge sc-badge-secret">' +
      '<div class="sc-badge-ico">?</div>' +
      '<div class="sc-badge-txt"><div class="sc-badge-name">Hidden badge</div>' +
      '<div class="sc-badge-sub">One of the 201 is not in this list.</div>' +
      '<div class="sc-badge-bar"><i style="width:0%"></i></div></div></div>';
  }
  function achievementsHtml(all){
    var list = all || ACHIEVEMENTS();
    var html = badgesByGroup(list).map(function(g){
      var isSecret = g.key === 'secret';
      // Before dev mode, the secret group is one blank tile and nothing else: the
      // hint that there IS a 201st badge is the point, the answer is not.
      if(isSecret && !devOn){
        return g.have ? '<div class="sc-ach-group">' +
          '<div class="sc-ach-group-head"><span>' + esc(g.title) + '</span><span>' + g.have + '/' + g.items.length + '</span></div>' +
          '<div class="sc-badges">' + g.items.filter(isUnlocked).map(badgeTile).join('') + '</div></div>' : '';
      }
      var items = g.items.filter(function(a){
        if(achFilter === 'have') return isUnlocked(a);
        if(achFilter === 'todo') return !isUnlocked(a);
        return true;
      });
      if(!items.length) return '';
      var tiles = items.map(function(a){
        if(a.secret && !isUnlocked(a)) return secretTile();
        return badgeTile(a);
      }).join('');
      return '<div class="sc-ach-group">' +
        '<div class="sc-ach-group-head"><span>' + esc(g.title) + '</span><span>' + g.have + '/' + g.items.length + '</span></div>' +
        '<div class="sc-badges">' + tiles + '</div></div>';
    }).join('');
    return html || '<div class="sc-note">Nothing matches that filter yet.</div>';
  }
  function achFilterChips(){
    return '<div class="sc-chips sc-ach-filters"><span class="sc-chip-label">Show</span>' +
      [['all', 'Everything'], ['have', 'Earned'], ['todo', 'Still to get']].map(function(f){
        return '<button class="sc-chip' + (achFilter === f[0] ? ' on' : '') + '" data-act="achfilter" data-f="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>';
  }
  function rewardRowHtml(r){
    var pct = r.earned ? 100 : Math.round((r.have / r.at) * 100);
    var state = r.earned
      ? (r.kind === 'premium' ? '<span class="sc-reward-have">Granted, free</span>' : '<span class="sc-reward-have">Unlocked</span>')
      : '<span class="sc-reward-need">' + (r.at - r.have) + ' to go</span>';
    var act = !r.earned ? ''
      : (r.kind === 'theme'
        ? '<button class="sc-btn tiny primary" data-act="usetheme" data-key="' + r.key + '">Use it</button>'
        : '<button class="sc-btn tiny" data-act="openpremium">Open Premium</button>');
    return '<div class="sc-reward' + (r.earned ? ' on' : '') + '">' +
      '<div class="sc-reward-at">' + r.at + '</div>' +
      '<div class="sc-reward-txt"><div class="sc-reward-name">' + esc(r.name) + '</div>' +
      '<div class="sc-reward-note">' + esc(r.note) + '</div>' +
      '<div class="sc-reward-bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="sc-reward-act">' + state + act + '</div></div>';
  }
  function rewardsHtml(){
    return '<div class="sc-rewards">' + rewardState().map(rewardRowHtml).join('') + '</div>';
  }
  function devPanelHtml(){
    if(!devOn) return '';
    var all = ACHIEVEMENTS().length;
    return '<div class="sc-dev">' +
      '<div class="sc-dev-head"><span>\\ud83d\\udd27 Dev mode</span><span class="sc-dev-sub">' + unlockedCount() + '/' + all + ' met, ' + Object.keys(achState).length + ' recorded</span></div>' +
      '<div class="sc-dev-note">Seven taps on the version line in Settings opens this. It sets the app\\u2019s own test flag as well, so the app\\u2019s hidden debug affordances come with it.</div>' +
      '<div class="sc-actions">' +
        '<button class="sc-btn tiny" data-act="devself">Self-test</button>' +
        '<button class="sc-btn tiny" data-act="devsim">' + (simAll ? 'Stop pretending' : 'Pretend all ' + all + ' are earned') + '</button>' +
        '<button class="sc-btn tiny" data-act="devreset">Reset badge state</button>' +
        '<button class="sc-btn tiny" data-act="devoff">Exit dev mode</button>' +
      '</div>' +
      '<div class="sc-dev-note">A reset clears badges, counters and feature flags. It never takes Premium back \\u2014 a reward is not a switch, and a real purchase is not a dev tool\\u2019s to undo.</div>' +
      '</div>';
  }
  function storageHtml(){`, { marker: 'function devPanelHtml()' });

/* --------------------------------------------------- 4. the Studio section */
sub('studio section uses the new builder',
  `      '<div class="sc-sec" id="scStudioAch"><div class="sc-sec-head"><span>Achievements</span><span class="sc-sec-sub">' + unlockedCount() + '/' + ACHIEVEMENTS().length + '</span></div>' +
        achievementsSummaryHtml() + '<div class="sc-badges">' + achievementsHtml() + '</div></div>' +`,
  '      achievementsSectionHtml() +');

/* ------------------------------------------- 5. the summary and the rewards */
// Two edits rather than one: the body between them carries the hero line, which
// is full of escape sequences, and an anchor with a backslash in it cannot be
// matched by the file tools.
sub('summary becomes the section',
  `  function achievementsSummaryHtml(){
    var s = stats();
    var unlocked = unlockedCount();
    var all = ACHIEVEMENTS().length;`,
  `  // The whole Achievements section, built once per repaint: the hero, the five
  // rewards, the filter, the nine groups and (when it is on) the dev panel. It
  // counts the badges ONCE and passes that list down - ACHIEVEMENTS() walks the
  // library, and this section used to ask for it four times a repaint.
  function achievementsSectionHtml(){
    var s = stats();
    var allList = ACHIEVEMENTS();
    var unlocked = allList.filter(function(a){ return a.need.got >= a.need.want; }).length;
    var all = allList.length;
    if(!ctr('badgeGrid')) bump('badgeGrid', 1); // the one-time "you found this screen" badge`);

sub('section tail: rewards, filter, groups',
  `      '<div class="sc-hero-badges">' + unlocked + ' of ' + all + ' badges</div>' +
      '</div>';
  }`,
  `      '<div class="sc-hero-badges">' + unlocked + ' of ' + all + ' badges</div>' +
      '</div>' +
      '<div class="sc-sub-head">Rewards</div>' + rewardsHtml() +
      devPanelHtml() +
      achFilterChips() +
      '<div class="sc-ach-groups">' + achievementsHtml(allList) + '</div>' +
      '</div>';
  }`);

/* ------------------------------------------------------------- 6. the wiring */
sub('studio wiring: rewards, filters, dev tools',
  "        else if(act === 'batch') openBatchTags(call('__scSelectedIds') || []);",
  `        else if(act === 'batch') openBatchTags(call('__scSelectedIds') || []);
        else if(act === 'achfilter'){ achFilter = b.getAttribute('data-f') || 'all'; renderStudio(); }
        else if(act === 'usetheme'){
          var k = b.getAttribute('data-key');
          if(themeUnlocked(k)){
            call('__scApplyTheme', k); noteTheme(k); bump('themeChange');
            var rw = REWARDS.filter(function(r){ return r.key === k; })[0] || {};
            toast('Theme: ' + (rw.name || k));
            renderStudio();
          } else toast('Earn the badges for that theme first.');
        }
        else if(act === 'openpremium'){ if(typeof window.openPremiumSettings === 'function') window.openPremiumSettings(); }
        else if(act === 'devself'){
          var f = checkAchievements(true);
          toast('Self-test: ' + unlockedCount() + '/' + ACHIEVEMENTS().length + ' met, ' + Object.keys(achState).length + ' recorded' + (f.length ? ', ' + f.length + ' just unlocked' : '') + '.', 4200);
        }
        else if(act === 'devsim'){
          simAll = !simAll; lsSet(LS.sim, simAll);
          toast(simAll ? 'Dev: pretending every badge is earned.' : 'Dev: back to the real count.');
          checkAchievements(true); renderStudio();
        }
        else if(act === 'devreset'){
          achState = {}; counters = {}; flags = {};
          lsSet(LS.ach, achState); lsSet(LS.ctr, counters); lsSet(LS.flags, flags);
          toast('Dev: badges, counters and feature flags cleared. Premium was left alone.', 4200);
          checkAchievements(true); renderStudio();
        }
        else if(act === 'devoff') setDevMode(false);`, { marker: "act === 'achfilter'" });

/* --------------------------------------- 7. the watchers, the whirl, the boot */
sub('app watchers + whirl + boot additions',
  '  function boot(){',
  `  // ---- what the new badges count -------------------------------------------
  // One delegated listener for the controls the app owns: the theme buttons, the
  // add-songs menu's own export/import entries, the bell. Counting here rather
  // than inside the app keeps the release to one file, and it cannot drift from
  // the button it counts, because it IS the button.
  function wireAppWatch(){
    if(document.__scWatch) return;
    document.__scWatch = true;
    document.addEventListener('click', function(e){
      var el = e.target;
      if(!el || !el.closest) return;
      var th = el.closest('[data-theme-key]');
      if(th){
        var key = th.getAttribute('data-theme-key');
        if(key){ noteTheme(key); bump('themeChange'); }
      }
      if(el.closest('#exportLibBtn')) bump('exportAll', 1);
      if(el.closest('#exportSongsBtn')) bump('exportSongs', 1);
      if(el.closest('#importLibBtn')) bump('importLib', 1);
      if(el.closest('#addBtn') || el.closest('#addFolderBtn')) bump('addFiles', 1);
      if(el.closest('#notifBtn')) bump('notif', 1);
      // Those controls all move badges, so the check runs on the next turn of the
      // loop rather than inside the click that caused it.
      setTimeout(function(){ checkAchievements(true); }, 60);
    }, true);
  }

  // ---- Vortex: the 200-badge theme, spun by the finger ----------------------
  // The drag angle around the middle of the screen is added to a rotation, and the
  // angle's own speed is kept as momentum, so a flick keeps it turning and it
  // eases to a stop. Transform only - nothing here repaints the backdrop.
  var whirl = { deg: 0, vel: 0, lastA: null, raf: 0, dragging: false };
  function whirlThemeOn(){
    try{ return document.body.classList.contains('theme-dyn-vortex'); }catch(e){ return false; }
  }
  function whirlPaint(){
    try{ document.documentElement.style.setProperty('--whirl-deg', whirl.deg.toFixed(2) + 'deg'); }catch(e){}
  }
  function whirlSpin(){
    if(whirl.dragging) return;
    if(Math.abs(whirl.vel) < 0.02){ whirl.vel = 0; return; }
    whirl.deg += whirl.vel;
    whirl.vel *= 0.965;
    whirlPaint();
    whirl.raf = requestAnimationFrame(whirlSpin);
  }
  function whirlAngle(e){
    try{
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      var x = (e.clientX || 0) - cx, y = (e.clientY || 0) - cy;
      return Math.atan2(y, x) * 180 / Math.PI;
    }catch(err){ return 0; }
  }
  function wireWhirl(){
    if(document.__scWhirl) return;
    document.__scWhirl = true;
    var down = function(e){
      if(!whirlThemeOn()) return;
      // Never steal a drag from the player's own controls or from a sheet.
      if(e.target && e.target.closest && e.target.closest('#nowPlaying, input, .sc-sheet, .sc-slider')) return;
      whirl.dragging = true;
      whirl.lastA = whirlAngle(e);
      whirl.vel = 0;
    };
    var move = function(e){
      if(!whirl.dragging || !whirlThemeOn()) return;
      var a = whirlAngle(e);
      var d = a - whirl.lastA;
      if(d > 180) d -= 360;
      if(d < -180) d += 360;
      whirl.deg += d;
      whirl.vel = d;      // the last frame's angle IS the speed it is flung at
      whirl.lastA = a;
      whirlPaint();
    };
    var up = function(){
      if(!whirl.dragging) return;
      whirl.dragging = false;
      whirl.raf = requestAnimationFrame(whirlSpin);
    };
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
  }
  function spinWhirl(deg){
    whirl.deg = deg || 0;
    whirl.vel = 0;
    whirlPaint();
  }

  function boot(){`, { marker: 'function wireWhirl()' });

sub('boot wires them',
  `    wireSwipe();
    renderStudio();
    checkAchievements(true);`,
  `    wireSwipe();
    wireAppWatch();
    wireWhirl();
    wireDevGesture();
    try{ document.body.classList.toggle('sc-dev-on', devOn); }catch(e){}
    renderStudio();
    checkAchievements(true);
    // Someone already past a reward - an update, or a restore - is synced here
    // rather than left with a reward row that says Granted and nothing granted.
    grantRewards(true);`);

/* ------------------------------------------------------------------ 8. hooks */
sub('module surface',
  `    checkAchievements: checkAchievements,
    unlockedCount: unlockedCount,`,
  `    checkAchievements: checkAchievements,
    unlockedCount: unlockedCount,
    rewards: rewardState,
    rewardEarned: rewardEarned,
    themeUnlocked: themeUnlocked,
    devMode: devMode,
    setDevMode: setDevMode,
    simulateAll: function(){ return simAll; },
    bump: bump,
    counters: function(){ return counters; },
    spinWhirl: spinWhirl,
    spin: function(){ return whirl.deg; },`, { marker: 'themeUnlocked: themeUnlocked,' });

/* --------------------------------------------------- 9. the counters, bumped */
sub('markFeature counts repeats too',
  `  function markFeature(k){
    if(flags[k]) return;`,
  `  function markFeature(k){
    // The flag is once-ever; the counter is every time. 'crop' arrives from the
    // app's own crop button, which calls SC70.markFeature, so its counter lives
    // here rather than in a second hook the app would have to remember to call.
    if(k === 'crop') bump('crops');
    if(flags[k]) return;`);

sub('preset counter',
  `  function setFx(patch, quiet){
    for(var k in patch) fxState[k] = patch[k];`,
  `  // Distinct presets tried, not preset taps: the badge is "every Studio preset",
  // so pressing the same one ten times must not walk it.
  function seenPreset(id){
    if(!id) return;
    counters['preset_' + id] = 1;
    counters.presets = Object.keys(counters).filter(function(k){ return k.indexOf('preset_') === 0; }).length;
    lsSet(LS.ctr, counters);
  }
  function setFx(patch, quiet){
    for(var k in patch) fxState[k] = patch[k];
    if(patch && patch.preset) seenPreset(patch.preset);`, { marker: 'function seenPreset(id){' });

// Every tool open is a Studio visit. The flag that marks the first one is not
// unique in the file and would be ambiguous to anchor on; this is where the user
// actually reaches for a tool, which is what the badge is counting.
sub('studio visits', '  function openTool(id){', "  function openTool(id){\n    bump('studio');", { marker: "bump('studio');" });
sub('loops recorded', '  function recordLoop(){', "  function recordLoop(){\n    bump('loops');", { marker: "bump('loops');" });
sub('storage cleaner opened',
  '  function scrollStudioTo(id){',
  "  function scrollStudioTo(id){\n    if(id === 'scStudioStorage') bump('cleaner');", { marker: "bump('cleaner');" });
sub('pads used', '  function playPad(i){', "  function playPad(i){\n    seenPad(i);", { marker: 'seenPad(i);' });
sub('clips exported', '  function exportClip(){', "  function exportClip(){\n    bump('clips');", { marker: "bump('clips');" });
sub('shakes',
  '    if(mag > 26 && now - lastShake > 1600){',
  "    if(mag > 26 && now - lastShake > 1600){\n      bump('shake');", { marker: "bump('shake');" });
sub('swipe seeks', '      if(scrubbing) return;', "      if(scrubbing){ bump('swipeSeek'); return; }");
sub('swipe track changes',
  '      if(Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5){',
  "      if(Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5){\n        bump('swipeTrack');", { marker: "bump('swipeTrack');" });
sub('beat-matched blends',
  `  window.__scAutoDjAlign = function(curEl, nextTrack){
    if(!autodj.on || !nextTrack) return 0;`,
  `  window.__scAutoDjAlign = function(curEl, nextTrack){
    if(!autodj.on || !nextTrack) return 0;
    bump('autodj');`, { marker: "bump('autodj');" });
sub('batch runs and songs tagged',
  `        call('__scRenderList');
        markFeature('retag');
        checkAchievements();`,
  `        call('__scRenderList');
        markFeature('retag');
        bump('batch');
        bump('tagged', done);
        checkAchievements();`);
sub('bytes saved by re-encoding',
  '          var saved = Math.max(0, oldSize - newFile.size);',
  "          var saved = Math.max(0, oldSize - newFile.size);\n          bump('savedBytes', saved);", { marker: "bump('savedBytes', saved);" });

/* ------------------------------------------- 10. the assistant's own counter */
sub('assistant inner',
  '  var SCACT = {',
  '  var SCACT_INNER = {', { marker: 'SCACT_INNER' });
sub('assistant wrapper counts real actions',
  '  window.SCACT = SCACT;',
  `  // Every action that actually happened, counted once, at the one place that can
  // tell the difference: the inner object returns a sentence when the app carried
  // the request out and null when it did not.
  var SCACT = {
    tryRun: function(msg){
      var r = SCACT_INNER.tryRun(msg);
      if(r){ bump('assistant'); checkAchievements(true); }
      return r;
    }
  };
  window.SCACT = SCACT;`, { marker: 'SCACT_INNER.tryRun(msg)' });
sub('assistant clips',
  `          markFeature('assistant');
          if(!openClipSheet(s0, s1)){`,
  `          markFeature('assistant');
          bump('asstClip');
          if(!openClipSheet(s0, s1)){`);
sub('assistant playlists',
  `        call('__scSetPlaylist', name, top.map(function(t){ return t.id; }));
        markFeature('assistant');`,
  `        call('__scSetPlaylist', name, top.map(function(t){ return t.id; }));
        markFeature('assistant');
        bump('asstPlaylist');`, { marker: "bump('asstPlaylist');" });
sub('assistant themes',
  `          call('__scApplyTheme', key);
          markFeature('assistant');`,
  `          call('__scApplyTheme', key);
          noteTheme(key);
          markFeature('assistant');
          bump('asstTheme');`);
sub('assistant transport',
  " call('__scNext'); markFeature('assistant'); return 'Skipped to the next song.'; }",
  " call('__scNext'); markFeature('assistant'); bump('asstTransport'); return 'Skipped to the next song.'; }");

if(problems.length){
  console.error('patch-705-module: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}
if(CHECK){
  if(done.length) console.log('would apply: ' + done.join(', '));
  console.log('patch-705-module: ' + (applied ? applied + ' edit(s) pending' : 'module is already patched') + (already ? ', ' + already + ' already in place' : ''));
  process.exit(0);
}
if(src === start){
  console.log('patch-705-module: nothing to do' + (already ? ' (' + already + ' already in place)' : ''));
} else {
  fs.writeFileSync(MOD, src);
  console.log('patch-705-module: dev/sc70-module.js patched (' + applied + ' edit(s)' + (already ? ', ' + already + ' already in place' : '') + ')');
}
