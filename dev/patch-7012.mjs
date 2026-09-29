#!/usr/bin/env node
/**
 * SideCut 70.1.2 - Studio grows up, and Premium gets something to be.
 *
 * The user's two remaining asks, in their words:
 *
 *   "add more features to studio"
 *   "make their an actual reason to get SideCut premium"
 *
 * WHAT IS ADDED, AND WHY THESE.
 *
 *   * SLEEP TIMER (free). Off / 5 / 15 / 30 / 45 minutes / end of this song /
 *     end of the queue. It is the one thing a player is asked for that Studio is
 *     the natural home for, it needs no new permission, and it answers "more
 *     features" with something useful every single day rather than another
 *     effects knob. Free on purpose: a timer that stops your music is not a
 *     creative tool and nobody should pay to fall asleep.
 *
 *   * PRACTICE LOOP (Premium). Set A and B on the song that is playing and it
 *     repeats that section; switch the ramp on and it speeds up a little every
 *     other pass, which is how you actually learn a part. Free users can set the
 *     two points - the sheet is not hidden from them - but starting the loop is
 *     the paid part, and the sheet says so.
 *
 *   * YOUR OWN PRESETS (Premium). The built-in presets are a taste of what the
 *     FX chain can do; this is saving the chain you actually arrived at, under
 *     your own name, and getting it back in one tap.
 *
 *   * A "STUDIO PREMIUM" SECTION, shown only while Premium is off, that names
 *     what Premium adds IN STUDIO - because the old pitch lived in Settings, and
 *     the value lives here.
 *
 * WHAT IS DELIBERATELY NOT DONE.
 *
 *   * Nothing that used to be free is capped to sell Premium. The loop recorder
 *     still layers as many loops as you like; the tools are all still free. The
 *     premium half is additive, which is the only honest way to sell an app that
 *     already gave everything away.
 *   * No new badges. The wall stays exactly 201 and the five rewards stay at 50,
 *     100, 150, 200 and 201: adding features must not move anybody's progress or
 *     un-complete a wall somebody finished. The new tools are tools.
 *
 * The entitlement itself is never copied into Studio - `isPro()` asks the app
 * (`window.__scIsPremium`), which knows about Play, a licence key, a gift code
 * and the badge wall, and there is one answer to one question.
 *
 *   node dev/patch-7012.mjs            # apply
 *   node dev/patch-7012.mjs --check    # report only, change nothing
 *   node dev/patch-7012.mjs --manifest # reseed the root manifest.json only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.1.2';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 21:40 UTC = 5:40 PM EDT, the same day. A stamp in the
// FUTURE is a gate failure (test-6643: "not one of them in the future").
const STAMP = 'September 29, 2026 \u00b7 5:40 PM EDT';
const CACHE = 'sidecut-shell-v63.0.38';
const OLDCACHE = 'sidecut-shell-v63.0.37';
// No "pass" anywhere in a title: test-6642 and test-66421 both refuse the word
// in any recent entry (version >= 60), because the changelog used to call
// whole releases "a polish pass" and the word stopped meaning anything. The
// notes may say it - a practice loop really does repeat a pass - the title
// may not.
const TITLE = 'Studio gets a sleep timer, a practice loop that speeds up as you go, and presets you save yourself - and Premium finally looks like something to buy';
const OLD_TITLE = 'Studio gets a sleep timer, a practice loop that speeds up every pass, and presets you save yourself - and Premium finally looks like something to buy';

// Six notes, none with an apostrophe (a note is emitted into a single-quoted
// literal) and none with a downloader term or the words "play build", "play
// version" or "play install" - test-662 and test-6139 both refuse those.
const NOTES = [
  'Studio has a sleep timer: five, fifteen, thirty or forty-five minutes, or end of this song, or end of the queue. It is free, because a timer that stops your music is not a creative tool and nobody should pay to fall asleep.',
  'Studio has a practice loop. Set the start and the end on the song that is playing and it repeats that section, and with the ramp on it speeds up a little every other pass until you stop, which is how a part is actually learned.',
  'Studio remembers your own presets now. The built-in ones are a taste of what the slowed + reverb chain can do - this is saving the chain you arrived at, under a name you choose, and getting it back in one tap from the same sheet.',
  'Premium now has something to be here. The practice loop and your own presets are what it adds in Studio, and with Premium off the Studio screen names them where they are used instead of leaving the pitch in Settings, where the value of it was invisible.',
  'None of this caps anything that used to be free. The loop recorder still layers as many loops as you like, every tool is still open to everyone, and the wall is still exactly two hundred and one badges with the same five rewards - the new half of Studio is added to Premium rather than taken away from everybody else.',
  'The entitlement is asked for, never copied: Studio puts one question to the app, which is the part that knows about a purchase, a license key, a gift code and the badge wall, so the two can never disagree about whether Premium is on.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

function holder(text){ return { text: text }; }

// A correction that must NOT fail when there is nothing to correct, for the same
// reason patch-708 through patch-7011 have one: index.html is far too large to
// edit by hand and far too load-bearing to revert.
function heal(h, label, from, to){
  const n = count(h.text, from);
  if(n === 0) return;
  h.text = h.text.split(from).join(to);
  applied++;
  console.log('patch-7012: healed ' + label + ' (' + n + ')');
}

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';

/* ============================ the module: the new Studio section =========== */
const NEW_SECTION = block([
  '  /* --------------------------------------------------------------------------',
  '     3b. THE SLEEP TIMER, THE PRACTICE LOOP, AND YOUR OWN PRESETS (70.1.2)',
  '',
  '     "add more features to studio" and "make their an actual reason to get',
  '     SideCut premium", in one section, because they are the same answer to the',
  '     same question: the free half is the sleep timer (a player needs it, a',
  '     musician does not pay for it) and the paid half is the two tools with a',
  '     memory - a loop that speeds up as you learn the part, and presets you save',
  '     yourself.',
  '',
  '     The entitlement is never kept here. `isPro()` asks the app, which is the',
  '     part that knows about a purchase, a licence key, a gift code and the badge',
  '     wall, so Studio cannot disagree with it.',
  '     -------------------------------------------------------------------------- */',
  '  function isPro(){ return !!call(\'__scIsPremium\'); }',
  '  function proOnly(what){',
  '    if(isPro()) return true;',
  '    toast(what + \' is part of Studio Premium \\u2014 the Studio Premium section on this screen opens it.\');',
  '    return false;',
  '  }',
  '',
  '  // ---- the sleep timer (free) ---------------------------------------------',
  '  var SLEEP_CHOICES = [',
  '    [\'off\',   \'Off\',               \'stop it\'],',
  '    [\'5\',     \'5 min\',             \'\'],',
  '    [\'15\',    \'15 min\',            \'\'],',
  '    [\'30\',    \'30 min\',            \'\'],',
  '    [\'45\',    \'45 min\',            \'\'],',
  '    [\'song\',  \'End of this song\',  \'when the song does\'],',
  '    [\'queue\', \'End of the queue\',  \'after the last queued song\']',
  '  ];',
  '  var sleep = { mode: \'\', until: 0, timer: 0, bound: null };',
  '  function sleepClear(){',
  '    if(sleep.timer){ clearTimeout(sleep.timer); sleep.timer = 0; }',
  '    if(sleep.bound){',
  '      try{ sleep.bound.el.removeEventListener(\'ended\', sleep.bound.fn); }catch(_e){ }',
  '      sleep.bound = null;',
  '    }',
  '    sleep.mode = \'\'; sleep.until = 0;',
  '  }',
  '  function sleepLabel(){',
  '    if(!sleep.mode) return \'\';',
  '    if(sleep.mode === \'song\') return \'stops with this song\';',
  '    if(sleep.mode === \'queue\') return \'stops after the queue\';',
  '    var left = Math.max(0, Math.round((sleep.until - Date.now()) / 60000));',
  '    return \'pauses in \' + left + \' min\';',
  '  }',
  '  function sleepFire(){',
  '    sleepClear();',
  '    call(\'__scPause\');',
  '    toast(\'\\ud83c\\udf19 Sleep timer: paused. Tap play when you are back.\');',
  '    renderStudio();',
  '  }',
  '  function setSleep(mode){',
  '    sleepClear();',
  '    if(!mode || mode === \'off\'){ toast(\'Sleep timer off.\'); renderStudio(); return; }',
  '    sleep.mode = mode;',
  '    if(mode === \'song\' || mode === \'queue\'){',
  '      var el = call(\'__scActiveAudio\');',
  '      if(!el){ sleepClear(); toast(\'Play something first and the timer will stop it.\'); renderStudio(); return; }',
  '      var fn = function(){',
  '        // "End of the queue" means the LAST queued song: the app advances on its',
  '        // own, so this only fires when there is nothing after this one.',
  '        if(mode === \'queue\'){',
  '          var q = call(\'__scQueue\') || [], i = call(\'__scQueueIndex\') || 0;',
  '          if(i < q.length - 1) return;',
  '        }',
  '        sleepFire();',
  '      };',
  '      try{ el.addEventListener(\'ended\', fn); }catch(_e2){ }',
  '      sleep.bound = { el: el, fn: fn };',
  '    } else {',
  '      var min = parseInt(mode, 10) || 0;',
  '      if(min > 0){',
  '        sleep.until = Date.now() + min * 60000;',
  '        sleep.timer = setTimeout(sleepFire, min * 60000);',
  '      }',
  '    }',
  '    toast(\'Sleep timer: \' + (sleepLabel() || \'on\'));',
  '    renderStudio();',
  '  }',
  '',
  '  // ---- the practice loop (Premium) ----------------------------------------',
  '  var practice = { on: false, a: 0, b: 0, ramp: false, passes: 0, tick: 0 };',
  '  function practiceMark(which){',
  '    var el = call(\'__scActiveAudio\');',
  '    if(!el){ toast(\'Play a song first, then set the loop.\'); return; }',
  '    var at = Math.round((el.currentTime || 0) * 10) / 10;',
  '    if(which === \'a\'){',
  '      practice.a = at;',
  '      if(practice.b && practice.b <= practice.a + 1) practice.b = 0;',
  '    } else {',
  '      practice.b = at;',
  '      if(practice.a && practice.b <= practice.a + 1) practice.a = 0;',
  '    }',
  '    toast((which === \'a\' ? \'Loop start\' : \'Loop end\') + \': \' + secToClock(at));',
  '    renderStudio();',
  '    openPracticeSheet();',
  '  }',
  '  function practiceStop(quiet){',
  '    if(practice.tick){ clearInterval(practice.tick); practice.tick = 0; }',
  '    var was = practice.on;',
  '    practice.on = false;',
  '    if(!quiet){',
  '      practice.passes = 0;',
  '      if(was) toast(\'Practice loop off.\');',
  '      renderStudio();',
  '    }',
  '  }',
  '  function practiceRun(){',
  '    practiceStop(true);',
  '    if(!practice.a && !practice.b){ toast(\'Set the loop start first - play the song and press Set A.\'); return; }',
  '    if(practice.b <= practice.a){ toast(\'Set the loop end after the loop start.\'); return; }',
  '    if(!proOnly(\'The practice loop\')){ renderStudio(); return; }',
  '    practice.on = true;',
  '    practice.passes = 0;',
  '    practice.tick = setInterval(function(){',
  '      var el = call(\'__scActiveAudio\');',
  '      if(!el || el.paused) return;',
  '      var cur = el.currentTime || 0;',
  '      // Past the end, or before the start (the user or the app sought away), so',
  '      // the section is entered again rather than left half-played.',
  '      if(cur >= practice.b || cur < practice.a - 0.35){',
  '        try{ el.currentTime = practice.a; }catch(_e){ }',
  '        practice.passes++;',
  '        if(practice.ramp && practice.passes % 2 === 0){',
  '          fxState.rate = Math.min(1.5, Math.round((fxState.rate + 0.05) * 100) / 100);',
  '          applyRate();',
  '        }',
  '      }',
  '    }, 120);',
  '    toast(\'Practice loop: \' + secToClock(practice.a) + \' - \' + secToClock(practice.b) +',
  '      (practice.ramp ? \', speeding up every other pass\' : \'\'));',
  '    renderStudio();',
  '  }',
  '',
  '  // ---- your own presets (Premium) -----------------------------------------',
  '  // The built-in presets are a taste; this is the chain you actually arrived at,',
  '  // saved under your own name. Stored beside the rest of the Studio state.',
  '  var myPresets = lsGet(LS.mypresets, []) || [];',
  '  function myPresetsHtml(){',
  '    var head = \'<div class="sc-sub-head">Your presets</div>\';',
  '    var rows = myPresets.length',
  '      ? myPresets.map(function(p){',
  '          return \'<div class="sc-reward"><div class="sc-reward-at">\' + Math.round(p.rate * 100) + \'</div>\' +',
  '            \'<div class="sc-reward-txt"><div class="sc-reward-name">\' + esc(p.name) + \'</div>\' +',
  '            \'<div class="sc-reward-note">\' + p.rate.toFixed(2) + \'x \\u00b7 \' + Math.round(p.reverb * 100) + \'% wet\' +',
  '              (p.karaoke > 0 ? \' \\u00b7 vocal out \' + Math.round(p.karaoke * 100) + \'%\' : \'\') + \'</div></div>\' +',
  '            \'<div class="sc-reward-act"><button class="sc-btn tiny primary" data-myuse="\' + p.id + \'">Use</button>\' +',
  '              \'<button class="sc-btn tiny" data-mydrop="\' + p.id + \'">Delete</button></div></div>\';',
  '        }).join(\'\')',
  '      : \'<div class="sc-note">Nothing saved yet. Set the speed, the reverb and the vocal out how you like them, then name the chain and keep it.</div>\';',
  '    var save = isPro()',
  '      ? \'<div style="display:flex;gap:8px;align-items:center;margin-top:10px;"><input type="text" id="scMyName" maxlength="40" placeholder="Name this chain" autocomplete="off"><button class="sc-btn primary" id="scMySave">Save current</button></div>\'',
  '      : \'<div class="sc-actions"><button class="sc-btn tiny" data-act="openpremium">Unlock Premium to save your own</button></div>\';',
  '    return head + rows + save;',
  '  }',
  '  function saveMyPreset(){',
  '    if(!proOnly(\'Saving your own presets\')) return;',
  '    var el = $(\'scMyName\');',
  '    var name = el ? String(el.value || \'\').trim() : \'\';',
  '    if(!name) name = \'My chain \' + (myPresets.length + 1);',
  '    if(name.length > 40) name = name.slice(0, 40);',
  '    myPresets.push({ id: \'my\' + Date.now(), name: name, rate: fxState.rate, reverb: fxState.reverb, karaoke: fxState.karaoke });',
  '    lsSet(LS.mypresets, myPresets);',
  '    toast(\'Saved "\' + name + \'" to your presets.\');',
  '    openFxSheet();',
  '  }',
  '  function useMyPreset(id){',
  '    var p = myPresets.filter(function(x){ return x.id === id; })[0];',
  '    if(!p) return;',
  '    setFx({ rate: p.rate, reverb: p.reverb, karaoke: p.karaoke, preset: \'\' }, true);',
  '    markFeature(\'studio\');',
  '    if(p.rate !== 1) markFeature(\'slow\');',
  '    if(p.karaoke > 0) markFeature(\'karaoke\');',
  '    toast(\'Preset: \' + p.name);',
  '    openFxSheet();',
  '  }',
  '  function dropMyPreset(id){',
  '    myPresets = myPresets.filter(function(x){ return x.id !== id; });',
  '    lsSet(LS.mypresets, myPresets);',
  '    openFxSheet();',
  '  }',
  '',
  '  // ---- what Premium adds HERE, said where it is used -----------------------',
  '  // The pitch used to live only in Settings, which is where the value was least',
  '  // visible. Shown while Premium is off, and gone the moment it is on.',
  '  function premiumStudioHtml(){',
  '    if(isPro()) return \'\';',
  '    return \'<div class="sc-sec"><div class="sc-sec-head"><span>Studio Premium</span><span class="sc-sec-sub">what it adds here</span></div>\' +',
  '      \'<div class="sc-note">Every tool above is free and stays free. Premium adds the two that remember things for you: the practice loop, which repeats a section and speeds up every other pass, and presets you save yourself. It is also what unlocks Discover, pinned artists, word-by-word lyrics, nine animated themes and the Sandbox toggles.</div>\' +',
  '      \'<div class="sc-actions"><button class="sc-btn tiny primary" data-act="openpremium">See Premium</button></div></div>\';',
  '  }',
]);

/* ================================ the module: the two new sheets =========== */
const NEW_SHEETS = block([
  '  function openSleepSheet(){',
  '    var body = \'<div class="sc-note">The music stops by itself: after a set time, when this song ends, or after the last song in the queue. Free, and it stays free.</div>\' +',
  '      \'<div class="sc-chips sc-sleep-chips">\' + SLEEP_CHOICES.map(function(c){',
  '        return \'<button class="sc-chip\' + (sleep.mode === c[0] ? \' on\' : \'\') + \'" data-sleepmin="\' + c[0] + \'"><b>\' + c[1] + \'</b>\' + (c[2] ? \'<i>\' + c[2] + \'</i>\' : \'\') + \'</button>\';',
  '      }).join(\'\') + \'</div>\' +',
  '      \'<div class="sc-layer-hint">\' + (sleep.mode ? \'Set: \' + sleepLabel() : \'Not set\') + \'</div>\' +',
  '      \'<div class="sc-actions"><button class="sc-btn" id="scSleepOff">Cancel the timer</button><button class="sc-btn primary" id="scSleepDone">Done</button></div>\';',
  '    openSheet(\'Sleep timer\', body);',
  '    document.querySelectorAll(\'#scSheetBody [data-sleepmin]\').forEach(function(b){',
  '      b.addEventListener(\'click\', function(){',
  '        var m = b.getAttribute(\'data-sleepmin\');',
  '        if(m === \'off\') setSleep(\'off\'); else setSleep(m);',
  '        if($(\'scSheet\') && $(\'scSheet\').style.display === \'flex\' && $(\'scSheetTitle\').textContent === \'Sleep timer\') openSleepSheet();',
  '      });',
  '    });',
  '    var off = $(\'scSleepOff\');',
  '    if(off) off.addEventListener(\'click\', function(){ setSleep(\'off\'); openSleepSheet(); });',
  '    var done = $(\'scSleepDone\');',
  '    if(done) done.addEventListener(\'click\', function(){ closeSheet(); renderStudio(); });',
  '  }',
  '',
  '  function openPracticeSheet(){',
  '    var setAB = (practice.a || practice.b)',
  '      ? \'<div class="sc-note">Looping <b>\' + secToClock(practice.a) + \' \\u2192 \' + secToClock(practice.b) + \'</b>\' +',
  '          (practice.ramp ? \' \\u00b7 speeding up every other pass\' : \'\') + \'</div>\'',
  '      : \'<div class="sc-note">Play the song, press Set A where the part starts and Set B where it ends. Then loop it until you have it.</div>\';',
  '    var pro = isPro()',
  '      ? \'<button class="sc-btn primary" id="scPracGo">\' + (practice.on ? \'Restart the loop\' : \'Start looping\') + \'</button>\' +',
  '        (practice.on ? \'<button class="sc-btn" id="scPracOff">Stop</button>\' : \'\')',
  '      : \'<button class="sc-btn primary" data-act="openpremium">Unlock Premium to loop it</button>\';',
  '    var body = \'<div class="sc-note">A practice loop repeats one section of the song. With the ramp on it is a little faster every other pass, which is how a part is actually learned rather than played once.</div>\' +',
  '      setAB +',
  '      \'<div class="sc-actions"><button class="sc-btn" id="scPracA">Set A \\u00b7 start</button><button class="sc-btn" id="scPracB">Set B \\u00b7 end</button></div>\' +',
  '      \'<div class="sc-chips"><button class="sc-chip\' + (practice.ramp ? \' on\' : \'\') + \'" id="scPracRamp">\' + (practice.ramp ? \'Ramp on \\u00b7 faster every other pass\' : \'Ramp off \\u00b7 same speed\') + \'</button></div>\' +',
  '      (practice.on ? \'<div class="sc-layer-hint">Pass \' + practice.passes + \' \\u00b7 \' + fxState.rate.toFixed(2) + \'x</div>\' : \'\') +',
  '      \'<div class="sc-actions">\' + pro + \'<button class="sc-btn" id="scPracDone">Done</button></div>\';',
  '    openSheet(\'Practice loop\', body);',
  '    var a = $(\'scPracA\'); if(a) a.addEventListener(\'click\', function(){ practiceMark(\'a\'); });',
  '    var b = $(\'scPracB\'); if(b) b.addEventListener(\'click\', function(){ practiceMark(\'b\'); });',
  '    var ramp = $(\'scPracRamp\');',
  '    if(ramp) ramp.addEventListener(\'click\', function(){',
  '      practice.ramp = !practice.ramp;',
  '      toast(practice.ramp ? \'Ramp on: every other pass is a little faster\' : \'Ramp off: same speed every pass\');',
  '      if(practice.on) practiceRun(); else openPracticeSheet();',
  '      renderStudio();',
  '    });',
  '    var go = $(\'scPracGo\'); if(go) go.addEventListener(\'click\', function(){ practiceRun(); openPracticeSheet(); });',
  '    var stop = $(\'scPracOff\'); if(stop) stop.addEventListener(\'click\', function(){ practiceStop(); openPracticeSheet(); });',
  '    var done = $(\'scPracDone\'); if(done) done.addEventListener(\'click\', function(){ closeSheet(); renderStudio(); });',
  '  }',
]);

/* --------------------------------------------------------------------- page */
const html = holder(fs.readFileSync(IDX, 'utf8'));
const mod = holder(fs.readFileSync(MOD, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

sub(html, 'APP_VERSION', "const APP_VERSION = '70.1.1';", "const APP_VERSION = '70.1.2';",
  { key: "const APP_VERSION = '70.1.2';" });

const ENTRY =
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',").join('\n') + '\n' +
  '  ] },\n';
sub(html, 'the 70.1.2 changelog entry',
  "  const CHANGELOG = [\n  { version: '70.1.1',",
  '  const CHANGELOG = [\n' + ENTRY + "  { version: '70.1.1',",
  { key: "  { version: '70.1.2', date: '" });

// The entry that is already in the page carries the wording this release was
// first written with, and the idempotence key above means the `sub` will not
// touch it - so the title is corrected in place instead. A tree that has never
// seen 70.1.2 gets the right title from ENTRY and this finds nothing.
heal(html, 'the 70.1.2 title', "title: '" + OLD_TITLE + "'", "title: '" + TITLE + "'");

sub(sw, 'shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

// The one thing Studio needs from the app: the entitlement. The app already
// publishes __scGrantPremium next to this, and isPremiumActive is the function
// behind every other gate in the page, so this asks exactly the same question.
sub(html, 'the entitlement bridge',
  '  window.__scGrantPremium = function(opts){',
  block([
    '  // 70.1.2 - Studio asks the app whether Premium is on, once per question,',
    '  // instead of keeping a copy that could disagree with the purchase, the licence',
    '  // key, the gift code or the badge wall. Same function every other gate uses.',
    '  window.__scIsPremium = function(){',
    '    try{ return isPremiumActive(); }catch(e){ return false; }',
    '  };',
    '  window.__scGrantPremium = function(opts){',
  ]).replace(/\n$/, ''),
  { key: 'window.__scIsPremium = function(){' });

/* ------------------------------------------------------------------ module */
sub(mod, 'the presets key',
  "    ctr: 'sidecut_ach_counters',",
  "    ctr: 'sidecut_ach_counters',\n    mypresets: 'sidecut_studio_mypresets',",
  { key: "mypresets: 'sidecut_studio_mypresets'," });

sub(mod, 'the new Studio section',
  block([
    '  /* --------------------------------------------------------------------------',
    '     4. CROP -> SHARE AS CLIP, AND THE RE-ENCODER',
    '     -------------------------------------------------------------------------- */',
  ]),
  NEW_SECTION +
  block([
    '  /* --------------------------------------------------------------------------',
    '     4. CROP -> SHARE AS CLIP, AND THE RE-ENCODER',
    '     -------------------------------------------------------------------------- */',
  ]),
  { key: "function isPro(){ return !!call('__scIsPremium'); }" });

sub(mod, 'the two tool cards',
  "        toolCard('looper', '\\ud83d\\udd01', 'Loop recorder', looper.layers.length ? looper.layers.length + ' loop' + (looper.layers.length === 1 ? '' : 's') + ' repeating' : 'Record a bar and layer it.', looper.layers.length ? 'on' : '') +\n",
  "        toolCard('looper', '\\ud83d\\udd01', 'Loop recorder', looper.layers.length ? looper.layers.length + ' loop' + (looper.layers.length === 1 ? '' : 's') + ' repeating' : 'Record a bar and layer it.', looper.layers.length ? 'on' : '') +\n" +
  block([
    "        // 70.1.2. The sleep timer is free and says so by not mentioning money;",
    "        // the practice loop is the paid one, so Premium is named on the card",
    "        // itself rather than only inside the sheet.",
    "        toolCard('sleep', '\\ud83c\\udf19', 'Sleep timer', sleep.mode ? 'Set: ' + sleepLabel() : 'Stop the music after a while.', sleep.mode ? 'on' : '') +",
    "        toolCard('practice', '\\ud83c\\udfaf', 'Practice loop', (practice.on ? 'Looping ' + secToClock(practice.a) + ' - ' + secToClock(practice.b) + (practice.ramp ? ', faster every other pass' : '') : 'Loop a section until you have it' + (practice.ramp ? ', speeding up every other pass' : '') + '.'), practice.on ? 'on' : '') +",
  ]),
  { key: "toolCard('sleep'" });

sub(mod, 'the Studio Premium section',
  "      '</div>' +\n      achievementsSectionHtml() +\n",
  "      '</div>' +\n      premiumStudioHtml() +\n      achievementsSectionHtml() +\n",
  { key: 'premiumStudioHtml() +' });

sub(mod, 'the new tools in openTool',
  "    if(id === 'looper') return openLooperSheet();",
  "    if(id === 'looper') return openLooperSheet();\n" +
  "    if(id === 'sleep') return openSleepSheet();\n" +
  "    if(id === 'practice') return openPracticeSheet();",
  { key: "if(id === 'sleep') return openSleepSheet();" });

sub(mod, 'your presets in the FX sheet',
  "      '<div class=\"sc-note\">Slowed down, the pitch drops with the speed \\u2014 that is the sound of the preset, not a bug.</div>' +\n",
  "      '<div class=\"sc-note\">Slowed down, the pitch drops with the speed \\u2014 that is the sound of the preset, not a bug.</div>' +\n" +
  "      myPresetsHtml() +\n",
  { key: 'myPresetsHtml() +' });

sub(mod, 'the wiring for your presets',
  "    var rate = $('scFxRate');",
  block([
    '    // Your own presets. The sheet is not part of #studioView, so wireStudio never',
    '    // sees these buttons - they are wired here, the way the loop recorder does it.',
    "    document.querySelectorAll('#scSheetBody [data-myuse]').forEach(function(b){",
    "      b.addEventListener('click', function(){ useMyPreset(b.getAttribute('data-myuse')); });",
    '    });',
    "    document.querySelectorAll('#scSheetBody [data-mydrop]').forEach(function(b){",
    "      b.addEventListener('click', function(){ dropMyPreset(b.getAttribute('data-mydrop')); });",
    '    });',
    "    var saveMy = $('scMySave');",
    '    if(saveMy) saveMy.addEventListener(\'click\', saveMyPreset);',
    "    var rate = $('scFxRate');",
  ]).replace(/\n$/, ''),
  { key: 'var saveMy = $(\'scMySave\');' });

sub(mod, 'the two new sheets',
  block([
    '  /* --------------------------------------------------------------------------',
    '     13. THE SONG MENU, GROUPED (called from openSongActions in block 1)',
    '     -------------------------------------------------------------------------- */',
  ]),
  NEW_SHEETS +
  block([
    '  /* --------------------------------------------------------------------------',
    '     13. THE SONG MENU, GROUPED (called from openSongActions in block 1)',
    '     -------------------------------------------------------------------------- */',
  ]),
  { key: 'function openSleepSheet(){' });

sub(mod, 'the new tools on the module surface',
  '    measureDock: measureDock,',
  block([
    '    // 70.1.2 - the new half of Studio, for the gates and the assistant.',
    '    isPro: isPro,',
    '    sleep: function(){ return sleep; },',
    '    setSleep: setSleep,',
    '    sleepLabel: sleepLabel,',
    '    practice: practice,',
    '    practiceMark: practiceMark,',
    '    practiceRun: practiceRun,',
    '    practiceStop: practiceStop,',
    '    openPracticeSheet: openPracticeSheet,',
    '    myPresets: function(){ return myPresets; },',
    '    saveMyPreset: saveMyPreset,',
    '    useMyPreset: useMyPreset,',
    '    dropMyPreset: dropMyPreset,',
    '    measureDock: measureDock,',
  ]).replace(/\n$/, ''),
  { key: 'isPro: isPro,' });

/* --------------------------------------------------------- re-splice it in */
{
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = '<script id="sc-studio-70">\n' + mod.text + '</script>\n';
  if(blockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(blockRe, wrapped);
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }
}

/* ================================================================== the gate */
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
sub(t705, 'test-705 the 70.1.2 rules',
  "  mustStillReserve(src, '.action-strip');",
  "  mustStillReserve(src, '.action-strip');\n" +
  '  // 70.1.2. More Studio, and a Premium that is worth something - without taking\n' +
  '  // anything away from the free half or moving the badge wall.\n' +
  "  ok(has('window.__scIsPremium = function(){'), 'Studio has no way to ask whether Premium is on');\n" +
  "  ok(countMod(\"function isPro(){ return !!call('__scIsPremium'); }\") === 1,\n" +
  "     'and it keeps its own copy of the entitlement instead of asking');\n" +
  "  ok(countMod(\"toolCard('sleep'\") === 1 && countMod(\"toolCard('practice'\") === 1,\n" +
  "     'the two new Studio tools are not on the tools row');\n" +
  "  ok(countMod('function setSleep(mode){') === 1 && countMod(\"el.addEventListener('ended', fn)\") === 1,\n" +
  "     'the sleep timer does not really stop anything');\n" +
  "  ok(countMod(\"if(!proOnly('The practice loop')){ renderStudio(); return; }\") === 1,\n" +
  "     'the practice loop is not the paid half');\n" +
  "  ok(countMod('function saveMyPreset(){') === 1 && countMod(\"function proOnly(what){\") === 1,\n" +
  "     'and saving your own presets is not');\n" +
  "  ok(countMod('FREE_LOOPS') === 0 && countMod('looper.layers.length >=') === 0,\n" +
  "     'something that used to be free was capped to sell Premium');\n" +
  "  ok(countMod('function premiumStudioHtml(){') === 1 && countMod('if(isPro()) return \\'\\';') === 1,\n" +
  "     'and Premium is not named where it is used');\n" +
  "  // The wall must not move: the same FEATURE_KEYS, the same one capstone, the\n" +
  "  // same five rewards. New tools are tools, not badges.\n" +
  "  ok(countMod(\"var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures'];\") === 1,\n" +
  "     'the feature list the capstone badge counts was changed');\n" +
  "  ok(countMod('at: 201, kind: \\'premium\\'') === 1 && countMod('function myPresetsHtml(){') === 1,\n" +
  "     'the rewards moved, or the presets are not in the sheet');",
  { key: 'Studio has no way to ask whether Premium is on' });

const studio = holder(fs.readFileSync(STUDIO, 'utf8'));
// The tool row grew from six cards to eight, and this assertion counts them on the
// real screen. Same edit 70.0.8 made at five -> six: the count is stated and the
// names are checked one by one, so a card cannot be added silently.
sub(studio, 'studio-70-check the tool count',
  block([
    "    ok(tools.length === 6, 'six tool cards (' + tools.join(',') + ')');",
    "    ['crop', 'clip', 'fx', 'karaoke', 'sampler', 'looper'].forEach((k) =>",
  ]),
  block([
    "    // 70.1.2: eight of them. The sleep timer and the practice loop were added to",
    "    // the row, and nothing that was there was traded away for either.",
    "    ok(tools.length === 8, 'eight tool cards (' + tools.join(',') + ')');",
    "    ['crop', 'clip', 'fx', 'karaoke', 'sampler', 'looper', 'sleep', 'practice'].forEach((k) =>",
  ]),
  { key: 'eight tool cards' });

sub(studio, 'studio-70-check the 70.1.2 rules',
  "  console.log('[12] the page still holds together');",
  block([
    "  console.log('[11e] the sleep timer stops the music, the practice loop only loops on Premium');",
    '  {',
    '    // 70.1.2 - "add more features to studio" and "make their an actual reason to',
    '    // get SideCut premium". Both halves driven: the free timer really pauses when',
    '    // the song ends, and the paid loop really refuses to run until Premium is on',
    '    // and really seeks back to A when it is.',
    "    ok(typeof win.SC70.setSleep === 'function' && typeof win.SC70.practiceRun === 'function',",
    "      'the new tools are on the module surface');",
    "    ok(!!doc.querySelector('#studioView [data-tool=\"sleep\"]') && !!doc.querySelector('#studioView [data-tool=\"practice\"]'),",
    "      'and both are cards on the Studio screen');",
    '    // --- the free half: the sleep timer',
    "    const audio = win.__scActiveAudio();",
    "    ok(!!audio, 'the app has an audio element to stop');",
    '    // jsdom never plays anything, so the app own pause hook is watched instead:',
    '    // the timer has to ASK the app to pause - that is the whole mechanism.',
    '    let pauses = 0;',
    '    const realPause = win.__scPause;',
    '    win.__scPause = function(){ pauses++; };',
    "    win.SC70.setSleep('song');",
    "    ok(win.SC70.sleep().mode === 'song', 'a sleep timer can be set to the end of the song');",
    "    audio.dispatchEvent(new win.Event('ended'));",
    "    await wait(40);",
    "    ok(win.SC70.sleep().mode === '', 'and when the song ends the timer has done its job');",
    "    ok(pauses === 1, 'and it asks the app to pause (' + pauses + ' call(s))');",
    '    win.__scPause = realPause;',
    "    win.SC70.setSleep('15');",
    "    ok(win.SC70.sleep().mode === '15' && /15 min/.test(win.SC70.sleepLabel()),",
    "      'and a timed one counts down (' + win.SC70.sleepLabel() + ')');",
    "    win.SC70.setSleep('off');",
    "    ok(win.SC70.sleep().mode === '', 'and it can be cancelled');",
    '    // --- the paid half: the practice loop',
    "    win.localStorage.removeItem('sidecut_premium');",
    "    ok(win.SC70.isPro() === false, 'Premium is off');",
    "    audio.currentTime = 12;",
    "    win.SC70.practiceMark('a');",
    "    audio.currentTime = 20;",
    "    win.SC70.practiceMark('b');",
    "    ok(win.SC70.practice.a === 12 && win.SC70.practice.b === 20, 'the loop can be set to a section');",
    "    win.SC70.practiceRun();",
    "    ok(win.SC70.practice.on === false, 'and it does not loop without Premium');",
    "    win.__scGrantPremium({ plan: 'lifetime' });",
    "    ok(win.SC70.isPro() === true, 'Premium granted, and Studio sees it through the app');",
    '    // The loop only steps while the element says it is playing, and jsdom is',
    '    // never playing anything, so this is the one thing that has to be forced.',
    "    Object.defineProperty(audio, 'paused', { get: () => false, configurable: true });",
    "    win.SC70.practiceRun();",
    "    ok(win.SC70.practice.on === true, 'now it loops');",
    "    audio.currentTime = 21;",
    '    await wait(320);',
    "    ok(audio.currentTime >= 12 && audio.currentTime < 20, 'and it really pulled playback back to the start of the section (' + audio.currentTime + ')');",
    "    const passes = win.SC70.practice.passes;",
    "    ok(passes >= 1, 'a pass was counted (' + passes + ')');",
    "    const rateBefore = win.SC70.fx.rate;",
    "    win.SC70.practice.ramp = true;",
    "    win.SC70.practiceRun();",
    "    win.SC70.practice.passes = 1;",
    "    audio.currentTime = 21;",
    '    await wait(320);',
    "    ok(win.SC70.fx.rate > rateBefore, 'and the ramp speeds it up (' + rateBefore + 'x -> ' + win.SC70.fx.rate + 'x)');",
    "    win.SC70.practiceStop();",
    "    ok(win.SC70.practice.on === false, 'stopping the loop stops the seeking');",
    '    // --- the paid half: your own presets',
    "    win.localStorage.removeItem('sidecut_sidecut_studio_mypresets');",
    "    win.SC70.myPresets().length = 0;",
    "    win.SC70.fx.rate = 0.9; win.SC70.fx.reverb = 0.4; win.SC70.fx.karaoke = 0;",
    "    const beforeCount = win.SC70.myPresets().length;",
    '    win.localStorage.removeItem(\'sidecut_premium\');',
    "    win.SC70.saveMyPreset();",
    "    ok(win.SC70.myPresets().length === beforeCount, 'a preset is not saved without Premium');",
    "    win.__scGrantPremium({ plan: 'lifetime' });",
    "    win.SC70.saveMyPreset();",
    "    ok(win.SC70.myPresets().length === beforeCount + 1, 'and is saved with it');",
    "    const saved = win.SC70.myPresets()[win.SC70.myPresets().length - 1];",
    "    win.SC70.fx.rate = 1.2; win.SC70.fx.reverb = 0.1;",
    "    win.SC70.useMyPreset(saved.id);",
    "    ok(win.SC70.fx.rate === saved.rate && win.SC70.fx.reverb === saved.reverb, 'and recalling it puts the chain back');",
    "    win.SC70.dropMyPreset(saved.id);",
    "    ok(win.SC70.myPresets().length === beforeCount, 'and it can be deleted again');",
    '  }',
    '',
    "  console.log('[12] the page still holds together');",
  ]).replace(/\n$/, ''),
  { key: "console.log('[11e] the sleep timer stops the music, the practice loop only loops on Premium');" });

/* ------------------------------------------------------------------- checks */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  must(count(page, "const APP_VERSION = '70.1.2';") === 1, 'the version is not 70.1.2 exactly once');
  must(count(page, "version: '70.1.2'") === 1, 'the 70.1.2 changelog entry is missing');
  must(count(page, "date: 'September 29, 2026 \u00b7 5:40 PM EDT'") === 1,
    'the 70.1.2 stamp is not the one this release was cut at');
  must(count(page, "title: '" + TITLE + "'") === 1, 'the 70.1.2 title is not the one this release was cut with');
  must(count(page, "title: '" + OLD_TITLE + "'") === 0, 'the old 70.1.2 title is still in the page');
  must(count(page, "version: '70.1.1'") === 1, 'the 70.1.1 entry left the array');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';") === 0, 'the old shell cache is still in sw.js');

  must(count(page, 'window.__scIsPremium = function(){') === 1, 'the entitlement bridge is missing');
  must(count(page, "function isPro(){ return !!call('__scIsPremium'); }") === 1,
    'Studio does not ask the app for the entitlement');
  must(count(page, "toolCard('sleep'") === 1 && count(page, "toolCard('practice'") === 1,
    'the new tools are not on the tools row');
  must(count(page, 'function openSleepSheet(){') === 1 && count(page, 'function openPracticeSheet(){') === 1,
    'the new sheets are missing');
  must(count(page, 'function myPresetsHtml(){') === 1 && count(page, 'function saveMyPreset(){') === 1,
    'your own presets are missing');
  must(count(page, 'function premiumStudioHtml(){') === 1, 'the Studio Premium section is missing');
  must(count(page, 'FREE_LOOPS') === 0, 'something free was capped for Premium');
  must(count(page, "var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures'];") === 1,
    'the badge wall feature list moved');
  must(count(page, "at: 201, kind: 'premium'") === 1, 'the 201 reward moved');
  must(count(page, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');

  must(count(t705.text, 'Studio has no way to ask whether Premium is on') === 1,
    'test-705 does not assert the release');
  must(count(studio.text, "console.log('[11e] the sleep timer stops the music, the practice loop only loops on Premium');") === 1,
    'the real-app probe does not assert the new tools');
  must(count(studio.text, "ok(tools.length === 8, 'eight tool cards") === 1,
    'the real-app probe does not count the new tool cards');
}

if(problems.length){
  console.error('patch-7012: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-7012: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-7012: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [[IDX, html.text], [MOD, mod.text], [SW, sw.text], [TEST705, t705.text], [STUDIO, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7012: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7012: next `node dev/repin-7012.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
