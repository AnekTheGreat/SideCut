#!/usr/bin/env python3
"""80.2.3 - the text this release writes into the page, part one.

The award card's stylesheet, the ceremony painter, the card itself and the ladder
it is earned on. Loaded by path by dev/patch-8023.py, which does the cutting.
"""

CSS = r'''/* ---------- 3b. 80.2.3: the award, for plays ---------- */
/* ONE CARD, FIVE AWARDS. The card, its rings and its falling bits were built for a
   streak milestone; this is the same card earned by the number of plays, with a
   medal that climbs and a ceremony that grows with it - more rings, more bits and a
   warmer glow at every tier - so a Diamond is never mistakable for a Bronze. */
.sc80-ms-medal{
  display: inline-flex; align-items: center; gap: 6px;
  margin: 9px 0 0; padding: 4px 11px; border-radius: 999px;
  font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; font-weight: 800;
  border: 1px solid color-mix(in srgb, #c98b53 55%, var(--line));
  color: #c98b53; background: color-mix(in srgb, #c98b53 12%, transparent);
}
.sc80-ms-medal[hidden]{ display: none; }
#sc80Milestone[data-kind="plays"] .sc80-ms-num{ font-size: clamp(48px, 16vw, 80px); letter-spacing: -1px; }
#sc80Milestone[data-tier="2"] .sc80-ms-medal{
  color: #cfd6dd; border-color: color-mix(in srgb, #cfd6dd 50%, var(--line));
  background: color-mix(in srgb, #cfd6dd 12%, transparent);
}
#sc80Milestone[data-tier="3"] .sc80-ms-medal{
  color: var(--gold); border-color: color-mix(in srgb, var(--gold) 55%, var(--line));
  background: color-mix(in srgb, var(--gold) 12%, transparent);
}
#sc80Milestone[data-tier="4"] .sc80-ms-medal,
#sc80Milestone[data-tier="4"] .sc80-ms-kicker,
#sc80Milestone[data-tier="4"] .sc80-ms-unit{ color: #7ae0c0; }
#sc80Milestone[data-tier="4"] .sc80-ms-medal{
  border-color: color-mix(in srgb, #7ae0c0 55%, var(--line));
  background: color-mix(in srgb, #7ae0c0 12%, transparent);
}
#sc80Milestone[data-tier="5"] .sc80-ms-medal,
#sc80Milestone[data-tier="5"] .sc80-ms-kicker,
#sc80Milestone[data-tier="5"] .sc80-ms-unit{ color: #b9e6ff; }
#sc80Milestone[data-tier="5"] .sc80-ms-medal{
  border-color: color-mix(in srgb, #b9e6ff 60%, var(--line));
  background: color-mix(in srgb, #b9e6ff 14%, transparent);
}
#sc80Milestone[data-tier="4"] .sc80-ms-card{
  box-shadow: 0 26px 70px rgba(0,0,0,0.55), 0 0 62px -14px #7ae0c0;
}
#sc80Milestone[data-tier="5"] .sc80-ms-card{
  border-color: color-mix(in srgb, #b9e6ff 60%, var(--line));
  box-shadow: 0 26px 74px rgba(0,0,0,0.58), 0 0 80px -12px #b9e6ff;
}
#sc80Milestone[data-tier="4"] .sc80-ms-rings i{ border-color: color-mix(in srgb, #7ae0c0 60%, transparent); }
#sc80Milestone[data-tier="5"] .sc80-ms-rings i{
  border-color: color-mix(in srgb, #b9e6ff 65%, transparent);
  animation-duration: 2.2s;
}
#sc80Milestone[data-tier="4"] .sc80-ms-num{ text-shadow: 0 0 34px color-mix(in srgb, #7ae0c0 45%, transparent); }
#sc80Milestone[data-tier="5"] .sc80-ms-num{ text-shadow: 0 0 44px color-mix(in srgb, #b9e6ff 55%, transparent); }
'''

BITS_OLD = r'''  function bitsHtml(){
    var out = '', colors = ['var(--gold)', 'var(--coral)', '#7ae0c0', '#9b8cff', '#ffd166'];
    for(var i = 0; i < 26; i++){'''

BITS_NEW = r'''  // 80.2.3 - the falling bits take a count now, so a Diamond card can throw twice
  // as many as a Bronze one. No argument is the streak cards' own 26, unchanged.
  function bitsHtml(n){
    n = n || 26;
    var out = '', colors = ['var(--gold)', 'var(--coral)', '#7ae0c0', '#9b8cff', '#ffd166'];
    for(var i = 0; i < n; i++){'''

CARD_OLD = r'''        '<div class="sc80-ms-kicker">Milestone</div>' +
        '<div class="sc80-ms-num">50</div>' +'''

CARD_NEW = r'''        '<div class="sc80-ms-kicker">Milestone</div>' +
        '<div class="sc80-ms-medal" hidden></div>' +
        '<div class="sc80-ms-num">50</div>' +'''

CELEBRATE_NEW = r'''  // ---- 80.2.3: THE PLAYS LADDER ----
  // A streak milestone is a number of days. This is a number of plays, and the rungs
  // are the ones the owner named; the tail past ten thousand is generated, so the
  // ladder never runs out.
  var PLAY_MILESTONES = [100, 200, 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000];
  var PLAY_LADDER_STEP = 5000, PLAY_LADDER_TOP = 100000;
  // The five medals, lowest first. A rung wears the highest one it reaches, so 100 is
  // Bronze and 10,000 is Diamond, and every tier is a louder card than the one before.
  var PLAY_AWARDS = [
    { tier: 1, name: 'Bronze',   at: 100 },
    { tier: 2, name: 'Silver',   at: 500 },
    { tier: 3, name: 'Gold',     at: 2000 },
    { tier: 4, name: 'Platinum', at: 5000 },
    { tier: 5, name: 'Diamond',  at: 10000 }
  ];

  // ---- 80.2.3: the ceremony is painted per card ----
  function paintCeremony(host, tier){
    tier = Math.max(0, Math.min(5, Number(tier) || 0));
    var rings = host.querySelector('.sc80-ms-rings');
    if(rings){
      var want = 3 + tier;
      rings.innerHTML = '';
      for(var i = 0; i < want; i++) rings.appendChild(document.createElement('i'));
      for(var j = 0; j < rings.children.length; j++){
        rings.children[j].style.animationDelay = (j * 0.55).toFixed(2) + 's';
      }
    }
    var bits = host.querySelector('.sc80-ms-bits');
    if(bits) bits.innerHTML = bitsHtml(tier ? 20 + tier * 12 : 26);
  }
  function showCard(host){
    host.classList.remove('show');
    void host.offsetWidth;
    host.classList.add('show');
    document.documentElement.style.overflow = 'hidden';
  }
  function celebrate(days, opts){
    opts = opts || {};
    days = Number(days) || 0;
    if(!days) return false;
    var host = ensureCelebration();
    // A streak card is not a plays award: the medal goes, the kicker is the
    // streak's own word again, and the ceremony drops back to its three rings.
    host.setAttribute('data-kind', 'streak');
    host.setAttribute('data-tier', '0');
    var medal = host.querySelector('.sc80-ms-medal');
    if(medal){ medal.hidden = true; medal.textContent = ''; }
    host.querySelector('.sc80-ms-kicker').textContent = 'Milestone';
    host.querySelector('.sc80-ms-num').textContent = String(days);
    host.querySelector('.sc80-ms-unit').textContent = 'DAY STREAK';
    host.querySelector('.sc80-ms-sub').textContent = opts.manual
      ? 'This is what ' + days + ' days of listening looks like. Your best so far is ' + streakBest() + ' — every day counts.'
      : days + ' days in a row of listening. That is not luck any more, that is a habit. Best streak: ' + streakBest() + '.';
    var keep = host.querySelector('.sc80-ms-btns button.primary');
    if(keep) keep.textContent = 'Keep it going';
    paintCeremony(host, 0);
    showCard(host);
    if(!opts.manual) markCelebrated(days);
    return true;
  }

  /* ------------------------------------------------------------------------
     3b. THE PLAYS AWARDS - the same card, earned by the plays themselves

     The owner: "make the awards popup screen show up for hitting records in
     plays too like 100 and 200, 500, 1000, 2000, 3000, 4000, 5000, 7500,
     10000 ect... make them better every time". The card already existed for a
     streak. This is that card, read off the app's own play total, with five
     medals and a ceremony that grows with every rung it climbs.
     ------------------------------------------------------------------------ */
  function fmtPlays(n){
    return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function playRungs(){
    var out = PLAY_MILESTONES.slice();
    // "ect..." - the ladder does not stop at ten thousand. Every five thousand
    // plays after the last named rung is another rung, up to a hundred thousand,
    // so a library that keeps growing keeps earning awards.
    for(var n = PLAY_MILESTONES[PLAY_MILESTONES.length - 1] + PLAY_LADDER_STEP;
        n <= PLAY_LADDER_TOP; n += PLAY_LADDER_STEP){ out.push(n); }
    return out;
  }
  function playAward(plays){
    var won = PLAY_AWARDS[0];
    for(var i = 0; i < PLAY_AWARDS.length; i++){
      if((Number(plays) || 0) >= PLAY_AWARDS[i].at) won = PLAY_AWARDS[i];
    }
    return won;
  }
  function playsNow(){ var s = stats(); return s ? (Number(s.plays) || 0) : 0; }
  function playedCelebrated(){
    var m = lsGet(LS.plays, null);
    return (m && typeof m === 'object') ? m : {};
  }
  function markPlayCelebrated(n){
    var m = playedCelebrated();
    if(!m[String(n)]){ m[String(n)] = Date.now(); lsSet(LS.plays, m); }
    return m;
  }
  // Every rung at or below this many plays is recorded at once, so a library that
  // arrives with its history already in it earns one card, not a queue of nine.
  function markPlaysThrough(plays){
    var m = playedCelebrated();
    playRungs().forEach(function(r){ if(r <= plays && !m[String(r)]) m[String(r)] = Date.now(); });
    lsSet(LS.plays, m);
    return m;
  }
  function reachedPlayRung(plays){
    var rungs = playRungs(), hit = 0;
    for(var i = 0; i < rungs.length; i++){ if((plays || 0) >= rungs[i]) hit = rungs[i]; }
    return hit;
  }
  function nextPlayRung(plays){
    var rungs = playRungs();
    for(var i = 0; i < rungs.length; i++){ if((plays || 0) < rungs[i]) return rungs[i]; }
    return 0;
  }
  // What the card says. Every tier reads as a step up, because the point is that
  // the next one is better than the one before it.
  function playLine(plays, award, next, opts){
    var n = fmtPlays(plays);
    var tip = next
      ? 'Next award at ' + fmtPlays(next) + ' plays.'
      : 'That is the top of the ladder - and every five thousand after it is another award.';
    if(opts && opts.manual) return n + ' plays, and this is the card that goes with it. ' + tip;
    var line;
    switch(award.tier){
      case 1: line = n + ' plays out of your own library. Bronze is yours, and the cards only get bigger from here.'; break;
      case 2: line = n + ' plays. Silver - a louder card than Bronze, and a brighter one is next.'; break;
      case 3: line = n + ' plays. Gold, and the number has stopped being a coincidence.'; break;
      case 4: line = n + ' plays. Platinum, and this is the loudest card the app had before ten thousand.'; break;
      default: line = n + ' plays. Diamond, and the ladder keeps going: every five thousand plays after this opens another award.';
    }
    return line + ' ' + tip;
  }
  function celebratePlays(plays, opts){
    opts = opts || {};
    plays = Number(plays) || 0;
    if(!plays) return false;
    var award = playAward(plays);
    var next = nextPlayRung(plays);
    var host = ensureCelebration();
    host.setAttribute('data-kind', 'plays');
    host.setAttribute('data-tier', String(award.tier));
    var medal = host.querySelector('.sc80-ms-medal');
    if(medal){ medal.hidden = false; medal.textContent = '\u25c6 ' + award.name; }
    host.querySelector('.sc80-ms-kicker').textContent = 'Award';
    host.querySelector('.sc80-ms-num').textContent = fmtPlays(plays);
    host.querySelector('.sc80-ms-unit').textContent = 'PLAYS';
    host.querySelector('.sc80-ms-sub').textContent = playLine(plays, award, next, opts);
    var keep = host.querySelector('.sc80-ms-btns button.primary');
    if(keep) keep.textContent = 'Keep playing';
    paintCeremony(host, award.tier);
    showCard(host);
    if(!opts.manual) markPlaysThrough(plays);
    return true;
  }
  // Called from the app's own play counter, from a start and whenever the app comes
  // back to the front - the three moments a play can land. The HIGHEST rung crossed
  // is the one that gets the card; the rungs below it are recorded quietly.
  function checkPlays(opts){
    opts = opts || {};
    var plays = playsNow();
    if(!plays) return 0;
    var hit = reachedPlayRung(plays);
    if(!hit) return 0;
    if(playedCelebrated()[String(hit)]) return 0;
    markPlaysThrough(hit);
    if(opts.silent) return hit;
    celebratePlays(hit);
    return hit;
  }
  // The plays block in Studio, Tools, Milestones: what the next rung is, how far
  // along it is, and a Replay on the ones already earned.
  function playsCard(){
    var plays = playsNow(), seen = playedCelebrated();
    var award = playAward(plays), next = nextPlayRung(plays);
    var reached = playRungs().filter(function(n){ return plays >= n; });
    var rows = reached.slice(-4).reverse().map(function(n){
      var a = playAward(n), at = seen[String(n)];
      var when = at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      return '<div class="sc80-ms-row">' +
        '<div class="sc80-ms-days">' + fmtPlays(n) + '</div>' +
        '<div class="sc80-ms-txt">' + (when ? 'Celebrated ' + esc(when) : 'Reached - not played back yet') + ' \u00b7 ' + esc(a.name) + '</div>' +
        (at ? '<button class="sc-btn tiny" data-sc80-plays="' + n + '">Replay</button>' : '') +
      '</div>';
    }).join('');
    var nextTxt = next
      ? fmtPlays(next - plays) + ' to go \u00b7 ' + esc(playAward(next).name)
      : 'every award earned';
    return '<div class="sc-sec" id="sc80Plays">' +
      '<div class="sc-sec-head" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<div style="flex:1;font-size:13.5px;font-weight:700;">Plays</div>' +
        '<span style="font-size:11px;color:var(--ink-dim);">' + fmtPlays(plays) + ' played</span>' +
      '</div>' +
      '<div class="sc-note">A hundred plays opens the first award and every rung after it opens a bigger card: 200, 500, 1,000, 2,000, 3,000, 4,000, 5,000, 7,500, 10,000, then every 5,000. Each one plays once; any of them can be replayed here.</div>' +
      '<div class="sc80-ms-row">' +
        '<div class="sc80-ms-days">' + (next ? fmtPlays(next) : '\u2605') + '</div>' +
        '<div class="sc80-ms-txt"><b>' + (next ? 'Next award' : 'Every award earned') + '</b> \u00b7 ' + nextTxt + '</div>' +
      '</div>' +
      rows +
      '<div class="sc-actions" style="margin-top:10px;">' +
        '<button class="sc-btn primary" data-sc80-plays="' + (reached.length ? reached[reached.length - 1] : 100) + '">' +
          (reached.length ? 'Replay the ' + esc(award.name) + ' card' : 'Play the 100-play card') + '</button>' +
        '<button class="sc-btn" data-sc80-plays="10000">Preview 10,000 plays</button>' +
      '</div>' +
    '</div>';
  }
'''

BOOT_OLD = r'''      // The library and the streak load out of IndexedDB, so an early read can
      // legitimately be zero. Give it a few seconds before calling it a miss.
      if(tries < 10 && (!s || (!s.library && !s.streak))) setTimeout(attempt, 1500);
    })();
  }
'''

BOOT_NEW = r'''      // The library and the streak load out of IndexedDB, so an early read can
      // legitimately be zero. Give it a few seconds before calling it a miss.
      if(tries < 10 && (!s || (!s.library && !s.streak))) setTimeout(attempt, 1500);
    })();
  }
  // The play total loads with the library too, so the first read can be zero. Once
  // it is real, the highest rung it has passed gets one card - the same rule the
  // streak milestones use, so an old library is a moment and not a queue.
  function bootPlays(){
    var tries = 0;
    (function attempt(){
      tries++;
      var plays = playsNow();
      if(plays){ setTimeout(function(){ try{ checkPlays(); }catch(_ePlays){} }, 1800); return; }
      if(tries < 10) setTimeout(attempt, 1500);
    })();
  }
'''

START_OLD = r'''    try{ bootMilestones(); }catch(e){}
'''

START_NEW = r'''    try{ bootMilestones(); }catch(e){}
    try{ bootPlays(); }catch(e){}
    // A play counted with the screen off lands in the stats while the app is in the
    // background, so the card it earned is owed when the app comes back to the front.
    document.addEventListener('visibilitychange', function(){
      if(!document.hidden){ try{ checkPlays(); }catch(e){} }
    });
'''

CARD_INSERT_OLD = r'''    paneTools.insertAdjacentHTML('beforeend', milestonesCard() + lookCard());
'''

CARD_INSERT_NEW = r'''    paneTools.insertAdjacentHTML('beforeend', milestonesCard() + playsCard() + lookCard());
'''

WIRE_SEL_OLD = r'''      var t = ev.target && ev.target.closest ? ev.target.closest('[data-sc80-layout],[data-sc80-pinned],[data-sc80-ms]') : null;
'''

WIRE_SEL_NEW = r'''      var t = ev.target && ev.target.closest ? ev.target.closest('[data-sc80-layout],[data-sc80-pinned],[data-sc80-ms],[data-sc80-plays]') : null;
'''

WIRE_ELSE_OLD = r'''      else if(t.hasAttribute('data-sc80-ms')) celebrate(Number(t.getAttribute('data-sc80-ms')), { manual: true });
'''

WIRE_ELSE_NEW = r'''      else if(t.hasAttribute('data-sc80-ms')) celebrate(Number(t.getAttribute('data-sc80-ms')), { manual: true });
      else if(t.hasAttribute('data-sc80-plays')) celebratePlays(Number(t.getAttribute('data-sc80-plays')), { manual: true });
'''

EXPORT_OLD = r'''    celebrate: celebrate,
    reached: reachedMilestone,
    celebrated: celebrated,
'''

EXPORT_NEW = r'''    celebrate: celebrate,
    reached: reachedMilestone,
    celebrated: celebrated,
    // 80.2.3 - the plays awards, and the ceremony a gate can drive.
    playMilestones: playRungs(),
    playAward: playAward,
    nextPlayRung: nextPlayRung,
    celebratePlays: celebratePlays,
    checkPlays: checkPlays,
    playsCelebrated: playedCelebrated,
    playsNow: playsNow,
'''

LS_OLD = r'''    milestones: 'sc80Milestones' // { "50": <ms celebrated> }
'''

LS_NEW = r'''    milestones: 'sc80Milestones', // { "50": <ms celebrated> }
    plays: 'sc80Plays'             // { "100": <ms celebrated> }
'''

HOOK_OLD = r'''    t.playCount = (t.playCount || 0) + 1;
    totalPlays++;
    scSidecarSet(t.id, { playCount: t.playCount });
'''

HOOK_NEW = r'''    t.playCount = (t.playCount || 0) + 1;
    totalPlays++;
    scSidecarSet(t.id, { playCount: t.playCount });
    // 80.2.3 - a play that tips a plays award opens its card. Guarded: the revamp
    // block is a separate scope, and a missing hook must never stop a play counting.
    try{ if(window.SC80 && typeof SC80.checkPlays === 'function') SC80.checkPlays(); }catch(_eAward){}
'''
