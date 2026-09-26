#!/usr/bin/env node
// SideCut — the reported batch of five:
//
//   1. "Default view on boot when click library should be playlists not albums
//      and thats the default"
//   2. "make sure free users can't access premium or pro things"
//   3. "Is their anything that you can do to make the boot time shorter"
//   4. "First time ever getting into the app make sure it says seizure warning at
//      the top with the details of that"
//   5. "make sure the user must scroll down all the way and click the continue
//      button in order to get past the tutorial and the tutorial only"
//
// MEASURED, not guessed:
//   * "Default view on boot" is a PRO control whose value only ever reached
//     libraryMode at boot, gated on nothing. A free user's stored value was
//     honoured, so the Library could still open on Albums — and the <select>
//     itself stayed live for free users, moving under a tap that then refused to
//     persist. The Library now opens on Playlists for a free user, always.
//   * Every PRO control already refused the CLICK, but the PRO *effects* were
//     applied from the stored values with no premium check at all — so a restore
//     from a backup zip, a lapsed subscription, or a stale IndexedDB row left a
//     free user wearing PRO visuals. applySandboxStyles() is the single place
//     those effects are painted, so the gate lives there.
//   * The two independent boot reads (enrich state, pinned artists) were awaited
//     one after the other, so the slower one set the pace of the other for no
//     reason. They run together now.
//   * The first-run guide had no seizure warning in it at all and could be
//     dismissed by tapping the backdrop or pressing one unguarded Close button,
//     without any of it being read.
//
//   node dev/patch-635.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The Library opens on Playlists. Two things had to change:
//
//    (a) WHERE it is decided. The single original line sat in the library
//        loader, which bails out on its first check when there is no track in
//        the library — so on a brand new install the setting was never read at
//        all — and which runs again on every library reload, so a deliberate
//        switch to Albums could be undone by the next one. It moves to the
//        settings pass: one run, at boot, always.
//    (b) WHETHER it is allowed. "Default view on boot" is a PRO setting, so a
//        free user is kept on Playlists whatever a restored backup or a lapsed
//        unlock left stored.
//
// This block normalises from whichever form is on disk — the committed line, or
// either of the two intermediates an earlier run of this patch wrote — so a
// rerun from any of those states converges on the same text.
// ---------------------------------------------------------------------------
const LOADER_FINAL = String.raw`    // The Library's boot view is decided in the settings pass — one run, at boot,
    // and always — with the sandboxDefaultView load it depends on, not here: this
    // loader bails out on its first check when the library is empty, so a fresh
    // install never read the setting at all, and it runs again on every reload,
    // which would snap the view back after you had chosen Albums yourself.`;

const LOADER_VARIANTS = [
  String.raw`    if(sandboxDefaultView === 'albums' || sandboxDefaultView === 'playlists') libraryMode = sandboxDefaultView;`,
  String.raw`    // Playlists is the default view on boot. Only the PRO "Default view on boot"
    // setting can move it to Albums, and that setting is a premium unlock — so
    // this is also where a free user is kept on Playlists no matter what a
    // backup restore or a lapsed unlock left in storage.
    libraryMode = ((typeof isPremiumActive === 'function' && isPremiumActive()) && sandboxDefaultView === 'albums')
      ? 'albums'
      : 'playlists';`,
  String.raw`    // Playlists is the default view on boot. Only the PRO "Default view on boot"
    // setting can move it to Albums, and that setting is a premium unlock — so
    // this is also where a free user is kept on Playlists no matter what a
    // backup restore or a lapsed unlock left in storage.
    // It has to come from THIS load's own meta map rather than the
    // sandboxDefaultView variable, which a separate async pass fills in —
    // deciding it there was a race between two reads of the same store, so the
    // Library opened on Albums only on the launches where that pass happened to
    // finish first.
    var _scBootView = metaMap.sandboxDefaultView;
    libraryMode = ((typeof isPremiumActive === 'function' && isPremiumActive()) && _scBootView === 'albums')
      ? 'albums'
      : 'playlists';`,
];

if (src.indexOf(LOADER_FINAL) !== -1) {
  skip('the Library boot view moves out of the library loader');
} else {
  const hit = LOADER_VARIANTS.findIndex(function(v){ return src.indexOf(v) !== -1; });
  if (hit === -1) throw new Error('Library boot view: none of the known forms is on disk');
  src = src.split(LOADER_VARIANTS[hit]).join(LOADER_FINAL);
  done('the Library boot view moves out of the library loader');
}

sub('the settings pass decides the Library boot view',
  String.raw`      const sandboxDefaultViewRow = metaRows.find(r => r.key === 'sandboxDefaultView');
      if(sandboxDefaultViewRow && sandboxDefaultViewRow.value) sandboxDefaultView = sandboxDefaultViewRow.value;`,
  String.raw`      const sandboxDefaultViewRow = metaRows.find(r => r.key === 'sandboxDefaultView');
      if(sandboxDefaultViewRow && sandboxDefaultViewRow.value) sandboxDefaultView = sandboxDefaultViewRow.value;
      // ---- Which view the Library opens on ----------------------------------
      // Playlists, always, unless the PRO "Default view on boot" setting asked
      // for Albums AND the device is actually unlocked — a free user is kept on
      // Playlists whatever a restored backup or a lapsed unlock left stored.
      // Decided here, in the one settings pass, because this pass always runs
      // and runs once: the library loader that used to decide it skips out
      // immediately when the library is empty (so a fresh install never got the
      // setting) and runs again on every reload (so it would undo a deliberate
      // switch to Albums). Reading the variable here is safe — it was set on the
      // line above.
      // Reading the variable here is safe: it was set on the line above, in this
      // same pass — the loader used to read it from a different async pass, so
      // the value it saw depended on which read resolved first.
      libraryMode = ((typeof isPremiumActive === 'function' && isPremiumActive()) && sandboxDefaultView === 'albums')
        ? 'albums'
        : 'playlists';`,
  undefined, null);

// ---------------------------------------------------------------------------
// 2. Free users get no PRO effects. The click gates were already there; what
//    was missing is the gate on the EFFECT, which is painted in exactly one
//    place. `sandbox*` values arrive from IndexedDB, so they can be non-default
//    for a free user (a restored backup, a lapsed subscription, or a row left
//    by an older build), and every one of these classes changes how the app
//    looks. The PRO set is the one marked PRO in the Sandbox panel.
// ---------------------------------------------------------------------------
sub('PRO visuals are applied only to a premium unlock',
  String.raw`  function applySandboxStyles(){
    document.body.classList.toggle('sandbox-compact', sandboxCompactRows);
    document.body.classList.toggle('sandbox-hide-art', sandboxHideArt);
    document.body.classList.toggle('sandbox-dur-tabs', sandboxDurOnTabs);
    document.body.classList.toggle('sandbox-large-touch', sandboxLargeTouch);
    document.body.classList.toggle('sandbox-show-playcount', sandboxShowPlayCount);
    document.body.classList.toggle('sandbox-compact-nowbar', sandboxCompactNowbar);
    document.body.classList.toggle('sandbox-always-search', sandboxAlwaysSearch);
    document.body.classList.toggle('sandbox-reduce-motion', sandboxReduceMotion);
    document.body.classList.toggle('sandbox-high-contrast', sandboxHighContrast);
    document.body.classList.toggle('sandbox-big-seek', sandboxBigSeek);
    document.body.classList.toggle('sandbox-invert-colors', sandboxInvertColors);
    document.body.classList.toggle('sandbox-compact-header', sandboxCompactHeader);
    document.body.classList.toggle('sandbox-big-art', sandboxBigArt);`,
  String.raw`  function applySandboxStyles(){
    // One premium check for every PRO control in this panel. The click gates stop
    // a free user from SETTING these, but the values are read back out of storage
    // on every boot — so without this the effects of a PRO setting could survive
    // a lapsed unlock, or arrive with a restored backup. The five below are the
    // panel's free settings and are applied unchanged.
    var _proFx = (typeof isPremiumActive === 'function' && isPremiumActive());
    document.body.classList.toggle('sandbox-compact', sandboxCompactRows);
    document.body.classList.toggle('sandbox-hide-art', sandboxHideArt);
    document.body.classList.toggle('sandbox-dur-tabs', sandboxDurOnTabs);
    document.body.classList.toggle('sandbox-large-touch', sandboxLargeTouch);
    document.body.classList.toggle('sandbox-show-playcount', sandboxShowPlayCount);
    document.body.classList.toggle('sandbox-always-search', sandboxAlwaysSearch);
    // ---- PRO, from here down ----
    document.body.classList.toggle('sandbox-compact-nowbar', _proFx && sandboxCompactNowbar);
    document.body.classList.toggle('sandbox-reduce-motion', _proFx && sandboxReduceMotion);
    document.body.classList.toggle('sandbox-high-contrast', _proFx && sandboxHighContrast);
    document.body.classList.toggle('sandbox-big-seek', _proFx && sandboxBigSeek);
    document.body.classList.toggle('sandbox-invert-colors', _proFx && sandboxInvertColors);
    document.body.classList.toggle('sandbox-compact-header', _proFx && sandboxCompactHeader);
    document.body.classList.toggle('sandbox-big-art', _proFx && sandboxBigArt);`,
  undefined, null);

sub('the PRO now-bar size is applied only to a premium unlock',
  String.raw`    if(sandboxNowbarSize === 50) document.body.classList.add('sandbox-nowbar-size-50');
    else if(sandboxNowbarSize === 75) document.body.classList.add('sandbox-nowbar-size-75');
    else if(sandboxNowbarSize === 125) document.body.classList.add('sandbox-nowbar-size-125');
    else if(sandboxNowbarSize === 150) document.body.classList.add('sandbox-nowbar-size-150');`,
  String.raw`    if(_proFx && sandboxNowbarSize === 50) document.body.classList.add('sandbox-nowbar-size-50');
    else if(_proFx && sandboxNowbarSize === 75) document.body.classList.add('sandbox-nowbar-size-75');
    else if(_proFx && sandboxNowbarSize === 125) document.body.classList.add('sandbox-nowbar-size-125');
    else if(_proFx && sandboxNowbarSize === 150) document.body.classList.add('sandbox-nowbar-size-150');`,
  undefined, null);

sub('the PRO scroll speed is read only by a premium unlock',
  String.raw`  function _scScrollSpeed(){
    try{ return (typeof sandboxScrollSpeed !== 'undefined' && sandboxScrollSpeed) || 400; }
    catch(_e){ return 400; }
  }`,
  String.raw`  function _scScrollSpeed(){
    // Scroll speed is a PRO setting, so a free user gets the default pace even if
    // a stored value says otherwise (the same reason as the visuals above).
    try{
      if(!(typeof isPremiumActive === 'function' && isPremiumActive())) return 400;
      return (typeof sandboxScrollSpeed !== 'undefined' && sandboxScrollSpeed) || 400;
    }
    catch(_e){ return 400; }
  }`,
  undefined, null);

// The PRO controls have to READ as locked, not just refuse the tap. The
// <select> was the worst of them: a native dropdown, so it visibly moved for a
// free user while the change handler quietly threw the choice away.
sub('the PRO controls read as locked for a free user',
  String.raw`    var _sdv = $('sandboxDefaultViewSel'); if(_sdv) _sdv.value = sandboxDefaultView;
    $('nowbarSizeValue').textContent = sandboxNowbarSize + '%';
    applySandboxStyles();`,
  String.raw`    // A PRO control a free user cannot use should look that way. Without this the
    // "Default view on boot" dropdown moved under the finger and then did nothing,
    // which reads as the setting being broken rather than as it being locked.
    var _sdv = $('sandboxDefaultViewSel');
    if(_sdv){
      var _sdvOk = (typeof isPremiumActive === 'function' && isPremiumActive());
      _sdv.value = _sdvOk ? sandboxDefaultView : 'playlists';
      _sdv.disabled = !_sdvOk;
      _sdv.style.opacity = _sdvOk ? '' : '0.5';
      _sdv.style.cursor = _sdvOk ? '' : 'not-allowed';
      _sdv.title = _sdvOk ? '' : 'PRO — unlock in Settings';
    }
    $('nowbarSizeValue').textContent = (typeof isPremiumActive === 'function' && isPremiumActive()) ? (sandboxNowbarSize + '%') : '100%';
    applySandboxStyles();`,
  undefined, null);

// Turning premium off has to take the effects with it that same moment.
sub('losing premium re-applies the sandbox gate at once',
  String.raw`      if(codeBox && codeVal){
        if(info && info.code){
          codeVal.textContent = info.code;
          codeBox.style.display = 'block';
        } else {
          codeBox.style.display = 'none';
        }
      }
    }
  }`,
  String.raw`      if(codeBox && codeVal){
        if(info && info.code){
          codeVal.textContent = info.code;
          codeBox.style.display = 'block';
        } else {
          codeBox.style.display = 'none';
        }
      }
    }
    // Losing premium must strip the PRO effects and re-lock the PRO controls the
    // moment it happens, not on the next boot.
    try{ if(typeof updateSandboxToggles === 'function') updateSandboxToggles(); }catch(_eSbFx){}
  }`,
  undefined, null);

// The panel paints the sandbox state from the meta load, so the same moment is
// where the controls are first declared locked.
sub('the sandbox state is applied to the panel at boot',
  String.raw`      renderCustomActionList();
      applySandboxStyles();`,
  String.raw`      renderCustomActionList();
      applySandboxStyles();
      // The same moment also declares which PRO controls are locked, so the panel
      // reads correctly the first time it is opened rather than only after a tap.
      try{ if(typeof updateSandboxToggles === 'function') updateSandboxToggles(); }catch(_eSbBoot){}`,
  undefined, null);

// ---------------------------------------------------------------------------
// 3. Boot: the two independent reads ran one after the other. They run together
//    now, each with its own guard so neither can skip the other. (They land
//    after navigate('home'), so this shortens boot completion, not first paint.)
// ---------------------------------------------------------------------------
sub('the two boot reads run together instead of one after the other',
  String.raw`      try{ await loadEnrichState(); }catch(e){ console.error('loadEnrichState failed', e); }
      try{ await loadPinnedArtists(); }catch(e){ console.error('loadPinnedArtists failed', e); }`,
  String.raw`      // Both are independent metadata reads. Awaiting them in turn made the boot
      // wait for the sum of two round trips to the same store; started together
      // it waits for the slower one. Each keeps its own guard, because a failure
      // in one must never skip the other (pinned artists especially).
      await Promise.all([
        loadEnrichState().catch(function(e){ console.error('loadEnrichState failed', e); }),
        loadPinnedArtists().catch(function(e){ console.error('loadPinnedArtists failed', e); })
      ]);`,
  undefined, null);

// ---------------------------------------------------------------------------
// 4. The seizure warning, at the very top of the tutorial, with the details.
//    Same text as Settings → More → ⚠ Seizure warning, so the two can never
//    drift apart, and it is the first thing on screen for a brand new install.
// ---------------------------------------------------------------------------
sub('the tutorial opens with the seizure warning',
  String.raw`  <div class="modal">
    <h3>How to use SideCut</h3>
    <div style="display:flex; flex-direction:column; gap:16px; max-height:65vh; overflow-y:auto; -webkit-overflow-scrolling:touch;">

      <div>
        <div id="howToGetMusicHead" style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>`,
  String.raw`  <div class="modal">
    <h3>How to use SideCut</h3>
    <div id="howToUseScroll" style="display:flex; flex-direction:column; gap:16px; max-height:65vh; overflow-y:auto; -webkit-overflow-scrolling:touch;">

      <!-- First thing on screen, on the very first launch, before anything else
           is read. The details below match Settings → More → ⚠ Seizure warning. -->
      <div id="howToUseSeizure" style="border:1px solid rgba(255,199,90,0.45); background:rgba(255,199,90,0.08); border-radius:10px; padding:12px;">
        <div style="font-weight:700; font-size:14px; color:var(--ink); margin-bottom:8px;">⚠ Seizure warning — read this first</div>
        <div style="font-size:12.5px; color:var(--ink-dim); line-height:1.6;">
          <div style="margin-bottom:6px;">SideCut has themes, glow effects, and an RGB color mode that produce <b>flashing, pulsing, and rapidly changing colors</b> — including along the edges of your screen while music plays.</div>
          <div style="margin-bottom:6px;">A very small number of people may experience <b>seizures or loss of consciousness</b> when exposed to certain flashing lights or patterns, even with no history of seizures or epilepsy.</div>
          <div style="margin-bottom:6px;"><b>If you have photosensitive epilepsy, or have ever had a seizure triggered by flashing lights,</b> turn these effects off:</div>
          <div style="display:flex; gap:8px; margin-bottom:4px;"><span style="color:var(--coral); flex-shrink:0;">•</span><span>Avoid the <b>RGB</b>, <b>RGB+</b>, and animated <b>dynamic themes</b> (Aurora, Synthwave, Ocean, Ember, Galaxy, Cyberpunk, Glacier).</span></div>
          <div style="display:flex; gap:8px; margin-bottom:4px;"><span style="color:var(--coral); flex-shrink:0;">•</span><span>In <b>Glow</b> settings, leave the edge lines, blur bands, and corner glow <b>off</b>.</span></div>
          <div style="display:flex; gap:8px; margin-bottom:4px;"><span style="color:var(--coral); flex-shrink:0;">•</span><span>Use a <b>static theme</b> (Rose Gold, Violet, Onyx, etc.) and the DJ Mode visuals with caution.</span></div>
          <div style="display:flex; gap:8px; margin-bottom:6px;"><span style="color:var(--coral); flex-shrink:0;">•</span><span>Sandbox → <b>Reduce motion</b> disables all animations and transitions across the app.</span></div>
          <div><b>Stop using the app and consult a doctor</b> if you experience dizziness, altered vision, eye or muscle twitching, loss of awareness, or disorientation while using it. Keep a safe distance from the screen and play in a well-lit room.</div>
        </div>
      </div>

      <div>
        <div id="howToGetMusicHead" style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>`,
  undefined, null);

// ---------------------------------------------------------------------------
// 5. The tutorial has to be READ to the end: the button says so, and it does
//    nothing until the panel is scrolled to the bottom. Only the first-ever
//    showing is gated — Replay tutorial opens the same panel with the button
//    live — and no other modal in the app is touched.
// ---------------------------------------------------------------------------
sub('the tutorial button is named for what it does',
  String.raw`    <div class="modal-btns">
      <button class="cancel" id="howToUseClose" style="flex:1;">Close</button>
    </div>`,
  String.raw`    <div id="howToUseGateHint" style="display:none; font-size:11.5px; color:var(--gold); text-align:center; margin-top:10px;">Scroll all the way down — the button unlocks at the end.</div>
    <div class="modal-btns">
      <button class="cancel" id="howToUseClose" style="flex:1;">Continue</button>
    </div>`,
  undefined, null);

sub('the tutorial cannot be dismissed before it is read',
  String.raw`  $('howToUseBtn').addEventListener('click', () => { $('howToUseBackdrop').style.display = 'flex'; });
  $('howToUseClose').addEventListener('click', () => { $('howToUseBackdrop').style.display = 'none'; dbPut('meta', { key: 'hasSeenOnboarding', value: true }); });
  $('howToUseBackdrop').addEventListener('click', (e) => { if(e.target === $('howToUseBackdrop')){ $('howToUseBackdrop').style.display = 'none'; dbPut('meta', { key: 'hasSeenOnboarding', value: true }); } });`,
  String.raw`  // ---- The first-run guide has to be read to the end ------------------------
  // The seizure warning is at the top of it, so this is the one panel a brand new
  // person must not be able to dismiss without passing it: no backdrop tap, no
  // untried button, and the button only unlocks when the panel is scrolled the
  // whole way down. ONLY the first-ever showing is gated — Replay tutorial opens
  // the same panel with the button live, because the user has already read it,
  // and no other modal in the app behaves any differently.
  window.__scTutorialGate = false;
  function _scTutorialScroll(){
    return document.getElementById('howToUseScroll');
  }
  function _scTutorialAtEnd(){
    var el = _scTutorialScroll();
    // No panel (or one that fits without scrolling, which jsdom and a tall
    // desktop both do) has nothing left to read.
    if(!el) return true;
    if(el.scrollHeight - el.clientHeight <= 24) return true;
    return (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 24);
  }
  function _scTutorialSync(){
    var btn = document.getElementById('howToUseClose');
    if(!btn) return;
    var _gated = !!window.__scTutorialGate;
    var _atEnd = !_gated || _scTutorialAtEnd();
    btn.disabled = !_atEnd;
    btn.style.opacity = _atEnd ? '' : '0.45';
    btn.style.cursor = _atEnd ? 'pointer' : 'not-allowed';
    // The label IS the instruction: it never reads "Continue" while there is
    // still something below the fold.
    btn.textContent = _gated ? (_atEnd ? 'Continue' : 'Scroll to the end to continue') : 'Close';
    var hint = document.getElementById('howToUseGateHint');
    if(hint) hint.style.display = _gated ? (_atEnd ? 'none' : 'block') : 'none';
  }
  window.__scTutorialSync = _scTutorialSync;
  window.__scOpenTutorial = function(gated){
    var bd = document.getElementById('howToUseBackdrop');
    if(!bd) return;
    window.__scTutorialGate = !!gated;
    bd.style.display = 'flex';
    var el = _scTutorialScroll();
    if(el){
      if(window.__scTutorialGate) el.scrollTop = 0;
      if(!el._scGateWired){
        el._scGateWired = true;
        // A phone can move this panel with momentum, with the wheel, or with a
        // finger — so the gate is re-checked on all three rather than only on a
        // scroll event that some WebViews never deliver.
        el.addEventListener('scroll', function(){ _scTutorialSync(); }, { passive: true });
        el.addEventListener('touchmove', function(){ _scTutorialSync(); }, { passive: true });
        el.addEventListener('wheel', function(){ _scTutorialSync(); }, { passive: true });
        window.addEventListener('resize', function(){ if(window.__scTutorialGate) _scTutorialSync(); });
      }
    }
    _scTutorialSync();
    if(window.__scTutorialGate){
      try{ toast('Read to the bottom — the Continue button unlocks there.', 3200); }catch(_eTutT){}
    }
  };
  function _scTutorialDone(){
    $('howToUseBackdrop').style.display = 'none';
    window.__scTutorialGate = false;
    dbPut('meta', { key: 'hasSeenOnboarding', value: true });
  }
  $('howToUseBtn').addEventListener('click', () => { window.__scOpenTutorial(false); });
  $('howToUseClose').addEventListener('click', (e) => {
    if(window.__scTutorialGate && !_scTutorialAtEnd()){
      e.preventDefault();
      e.stopPropagation();
      _scTutorialSync();
      return;
    }
    _scTutorialDone();
  });
  $('howToUseBackdrop').addEventListener('click', (e) => {
    if(e.target !== $('howToUseBackdrop')) return;
    // The first-run guide is not dismissable from the backdrop — it has to be
    // read and then continued past.
    if(window.__scTutorialGate) return;
    _scTutorialDone();
  });`,
  undefined, null);

sub('the first-ever launch opens the gated guide',
  String.raw`      if(!onboardingRow){
        $('howToUseBackdrop').style.display = 'flex';
      }`,
  String.raw`      if(!onboardingRow){
        // Brand new install: the gated one, with the seizure warning at the top.
        if(typeof window.__scOpenTutorial === 'function') window.__scOpenTutorial(true);
        else $('howToUseBackdrop').style.display = 'flex';
      }`,
  undefined, null);

fs.writeFileSync(FILE, src);
console.log('patch-635: ' + edits + ' index.html edit(s)');
