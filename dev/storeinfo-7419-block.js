  console.log('[11s] the album follows the song, the views come in, and the dock can be one sliding pill');
  {
    // 74.1.9, from the owner's message: "when you skip a song to the next album if it
    // starts a new album, the old one should automatically close and the new one
    // should automatically show un-collapsed. Also make the apps and transitions in
    // the apps very smooth and add a feature in the bottom where the tabs are to set
    // them to a pill like shape all together kind of like iOS where you can hold and
    // hover over what you want to click or like slide it nicely".
    //
    // WHAT THIS BLOCK IS FOR, since the release also ships a driven probe
    // (dev/album-follow-dock-check.cjs, run by dev/gates.sh): that probe drives the
    // whole feature on a synthetic dock geometry, and this block pins the four rules
    // the feature must never lose - the ones that would be lost by a small, sensible
    // looking edit rather than by removing the feature. Each is read off the shipped
    // bytes and then the one of them that can be driven here is driven.
    const cnt = (n) => html.split(n).length - 1;

    // (1) ONE OWNER OF THE COLLAPSE, AND IT ONLY CLOSES WHAT IT OPENED. The rule is
    // "the album that was playing closes", never "every album but this one closes":
    // an album the owner opened by hand and never played is not the app's to shut.
    // That distinction is exactly one line - the guard that skips a card the rule did
    // not open - so it is the line that is pinned.
    ok(cnt('function scAlbumCollapseCard(card){') === 1,
      'one place closes an album card');
    ok(cnt('if(_scWasCards.indexOf(card.dataset.albumName) === -1) return;') === 1,
      'and it only ever closes a card a track change opened itself');
    ok(cnt('scAlbPlayingCards = _scOpenNow.map(') === 1,
      'the cards this track change opened are the cards the next one may close');
    ok(/function scAlbumCollapseCard\(card\)\{[\s\S]{0,900}chev\.style\.transform = '';/.test(html),
      'and closing a card puts its chevron back, so it still reads as one you can open');

    // (2) THE VIEW ENTRANCE IS SKIPPABLE. An animation that cannot be turned off is a
    // defect, not a feature: both the device's own preference and the Sandbox switch
    // have to reach it.
    ok(cnt('.sc-view-in{ animation: scViewIn') === 1, 'the view entrance is one animation');
    ok(cnt('@media (prefers-reduced-motion: reduce){ .sc-view-in{ animation: none; } }') === 1,
      'which the device can switch off');
    ok(cnt('body.sandbox-reduce-motion .sc-view-in{ animation: none; }') === 1,
      'and so can the Sandbox reduce-motion switch');
    ok(cnt('function scViewIn(el){') === 1, 'and it is applied in exactly one place');

    // (3) THE JOINED DOCK IS A SETTING, NOT A SECOND DOCK. The capsule and the
    // highlight are built by the code, so the markup the app ships still holds the
    // four tabs and nothing else - a hand-written capsule would make the setting a
    // lie and would leave a stray element on every screen that never joins.
    const dockMarkup = html.slice(html.indexOf('<div class="action-strip" id="actionStrip">'),
      html.indexOf('<div id="addSongsBackdrop"'));
    ok((dockMarkup.match(/<button id="[A-Za-z0-9_]+" class="action-pill"/g) || []).length === 4,
      'the dock markup still holds the four tabs');
    ok(dockMarkup.indexOf('scDockPillTrack') === -1 && dockMarkup.indexOf('scDockPillThumb') === -1,
      'and no capsule or highlight is written into it');
    ok(cnt('#scDockPillTrack, #scDockPillThumb{') === 1,
      'the capsule and the highlight are styled once');
    ok(/z-index: -1; pointer-events: none;/.test(html) &&
       /body\.sc-dock-pill #scDockPillTrack, body\.sc-dock-pill #scDockPillThumb\{ display: block; \}/.test(html),
      'and drawn behind the labels, shown only when the dock is joined');
    ok(cnt('data-act="dockpill"') === 1 && cnt('function dockPillOn(){') === 1,
      'the Studio carries exactly one switch for it, and asks through one name');
    ok(cnt('window.__scDockPillOn = function(){') === 1 && cnt('window.__scSetDockPill = function(on){') === 1,
      'which the app publishes, instead of the Studio reaching into its scope');

    // (4) THE SLIDE CANNOT FIRE TWO TABS, AND CANNOT EAT A LATER ONE. This is the pair
    // of mistakes the feature can make, and both live in the same six lines:
    //   - the tab the press STARTED on must not also answer, which is the click the
    //     browser fires at the press's common ancestor being swallowed once;
    //   - and that swallow has to be SPENT, because a click that never arrives (an
    //     engine, another listener) would otherwise be left armed to eat the next,
    //     unrelated one. It expires, and a new press clears it.
    // The dock's own text is sliced out first: the page uses setPointerCapture
    // elsewhere (the album drag), so these questions have to be asked of this code.
    const dockCode = html.slice(html.indexOf('74.1.9 - THE PILL DOCK, AND THE VIEWS THAT COME IN'),
      html.indexOf('// ---- Add-songs collapsible menu ----'));
    ok(dockCode.length > 2000, 'the dock code is where this block expects it (' + dockCode.length + ' chars)');
    ok(dockCode.indexOf('setPointerCapture') === -1,
      'the dock never captures the pointer, so a plain tap still fires at its own pill');
    ok(cnt('scDockPillSwallow = true;') === 1, 'a slide arms one swallow');
    ok(dockCode.indexOf("ev.stopPropagation();\n      ev.preventDefault();") !== -1 ||
       /scDockPillSwallow = false;\s*\n\s*ev\.stopPropagation\(\);/.test(dockCode),
      'which swallows exactly one click, in the capture phase');
    ok(dockCode.indexOf('setTimeout(function(){ scDockPillSwallow = false; }, 600);') !== -1,
      'and it expires, so a click that never arrives cannot eat a later one');
    ok(dockCode.indexOf('scDockPillSwallow = false;      // a new press is never the old press') !== -1,
      'with the next press clearing it as well');
    ok(/body\.sc-dock-pill \.action-strip > \.action-pill\{[^}]*touch-action: none/.test(html),
      'the joined pills own the slide, so the touch is not handed to the page scroll');

    // (5) DRIVEN: THE SETTING ITSELF, ON THE REAL STUDIO. The switch is found on the
    // screen, tapped, and the dock has to join; tapped again, and it has to come apart
    // and be written down. Nothing is stubbed: this is the app's own handler, the
    // app's own published name, and the app's own class on the body.
    win.navigate('studio');
    await wait(400);
    const sw = doc.querySelector('#studioView [data-act="dockpill"]');
    ok(!!sw, 'the Studio renders the Pill dock switch');
    ok(!doc.body.classList.contains('sc-dock-pill') && typeof win.__scSetDockPill === 'function',
      'and the dock starts apart, with a way to join it');
    if (sw) sw.click();
    await wait(120);
    ok(doc.body.classList.contains('sc-dock-pill'), 'tapping it joins the dock');
    ok(!!doc.getElementById('scDockPillTrack') && !!doc.getElementById('scDockPillThumb'),
      'and builds the capsule and the highlight');
    ok(String(win.localStorage.getItem('sidecut_dockPill')) === '1',
      'the choice is written down, so the next boot comes back joined');
    const sw2 = doc.querySelector('#studioView [data-act="dockpill"]');
    if (sw2) sw2.click();
    await wait(120);
    ok(!doc.body.classList.contains('sc-dock-pill'), 'tapping it again takes the dock apart');
    ok(String(win.localStorage.getItem('sidecut_dockPill')) === '0', 'and writes that down too');

    // (6) THE CONVERTER'S IDENTITY, AND THE SLICE THE UI GETS BACK. Both came off the
    // phone with this release already prepared, and each is one rule: a title is a RUN
    // OF WHOLE WORDS, and a page that is on screen gets the thread back inside a
    // frame. The driven half is dev/converter-identity-check.cjs - the real gates, run
    // over the pairs an album actually produces, red on the page before this release -
    // and this is the half that has to survive any edit to them.
    const gates = html.slice(html.indexOf('function scTitleMatch(expectedTitle'),
      html.indexOf('function scDurationOk(expectedSec'));
    ok(gates.length > 3000, 'the title and claim block is where this checks it (' + gates.length + ' chars)');
    ok((gates.match(/function hasRun\(blob, phrase\)\{/g) || []).length === 2,
      'a title is matched as whole words in BOTH gates');
    ok(gates.indexOf("blob.indexOf(wantWords[i]) !== -1") === -1 && gates.indexOf('vt.indexOf(want) !== -1') === -1,
      'and no gate answers a title by finding it inside a longer word');
    ok(cnt('document.hidden ? SC_ENCODE_SLICE_MS * scBackSliceMul() : SC_ENCODE_FRAME_MS') === 2,
      'both encoders hand the thread back within a frame while the page is on screen');
    const fm = Number((html.match(/var SC_ENCODE_FRAME_MS = (\d+);/) || [])[1]);
    ok(fm > 0 && fm <= 24, 'and that budget is a frame, not a guess (' + fm + 'ms)');
    ok(cnt('var SC_ENCODE_SLICE_MS = 90;') === 1 && cnt('SC_ENCODE_SLICE_MS * scBackSliceMul()') === 2,
      'the long, deliberate background slice is exactly what it was');
    ok(cnt('_scYieldCh.port2.postMessage(0)') === 1 &&
       html.indexOf('return new Promise(function(res){ setTimeout(res, 0); });') !== -1,
      'and the wake-up is a macrotask, with the timer kept as the fallback under it');

    // (7) THE WORDS LINE UP WITH THE RECORDING. Reported later the same day: "the
    // lyrics for multi language songs ... it like doesn't play for 50 seconds while the
    // audio is already playing and then starts really late". A stamped sheet is now
    // measured against the file that is playing - where its SINGING runs, which is what
    // an offset actually moves - and the answer is stored as the song's own nudge. The
    // driven half is dev/lyrics-timing-check.cjs: 29 checks over synthetic recordings
    // with known singing starts, 10 of them red on a page without this.
    ok(cnt('function scLyricsSheetOffset(') === 1 && cnt('function scAutoAlignLyricsToAudio(') === 1,
      'one measurement of a stamped sheet, and one place that lines it up');
    ok(cnt('try{ scAutoAlignLyricsToAudio(); }catch(_eAlignCall){}') === 1,
      'called from the one place a sheet becomes the sheet on screen');
    ok(html.slice(html.indexOf('async function scAutoAlignLyricsToAudio(){'),
        html.indexOf('// The fingerprint of the old guess')).indexOf('if(scLyricsAlignedNow()) return false;') !== -1,
      'and never over a sheet the owner has pinned by hand');
    const sheetFn = html.slice(html.indexOf('function scLyricsSheetOffset(rows, env, hopSec, duration){'),
      html.indexOf('  var scLyricsAlignBusy = false;'));
    ok(sheetFn.length > 1200 && sheetFn.indexOf('firstLive') !== -1 &&
       sheetFn.indexOf('scFindQuietGaps(') !== -1 && sheetFn.indexOf('sungStart') !== -1,
      'the measurement reads where the SINGING runs, which is what a uniform offset moves');
    ok(sheetFn.indexOf('peak * 0.05') !== -1 && sheetFn.indexOf('outside') !== -1,
      'on the quiet floor the layout already uses, refusing words that land outside the song');
    ok(cnt('var SC_LYRICS_OFF_MAX = 120;') === 1 && cnt('Math.max(-15, Math.min(15,') === 0 &&
       cnt('Math.max(-SC_LYRICS_OFF_MAX, Math.min(SC_LYRICS_OFF_MAX,') === 1,
      'and the nudge reaches the error it was shown - the old 15s ceiling is gone');
    ok(html.indexOf("dbPut('meta', { key: 'lyricsSyncOff_' + String(tid), value: off })") !== -1,
      'the answer is stored as the per-song nudge the highlight already applies');


    // (8) THE FINISHED PILL LEADS WITH THE ACTION. "the in tab thing that shows up after
    // you download a song should be replaced with open library". The pill used to carry
    // the run's own sentence as its TITLE with the way in as small print under it, so the
    // one thing anyone wants at the end of a save read as a report about a save. The label
    // is the action now; what happened sits under it, and a run that saved nothing still
    // says so instead of offering a library it did not fill - which is the second half of
    // this repair, because that test was a SUBSTRING test on the run's own sentence:
    // "Cancelled - nothing was added" contains "added", and so does the batch line for a
    // run where every track failed ("0 songs added to your library - 3 failed"). Either
    // one promised a library that was never filled.
    const pillDone = html.slice(html.indexOf('function scConvertPillDone(text){'),
      html.indexOf('// Runs one track end-to-end through the single-track pipeline'));
    ok(pillDone.length > 900, 'the finished pill is where this checks it (' + pillDone.length + ' chars)');
    ok(pillDone.indexOf("_opened ? 'Open library'") !== -1, 'the finished pill leads with Open library');
    ok(pillDone.indexOf("_dtxt") < pillDone.indexOf("_opened ? 'Open library'"),
      'and the flag is worked out BEFORE the label is written, so the label cannot read a stale one');
    ok(pillDone.indexOf('Tap here to open your library') === -1, 'the old hint is gone from under it');
    ok(pillDone.indexOf('tap to open') !== -1 && pillDone.indexOf('scOpenLibraryAfterDownload()') !== -1,
      'the run\'s own sentence is kept underneath, and tapping still opens All Songs');
    ok(pillDone.indexOf("'See the ") !== -1 && pillDone.indexOf('bell for details') !== -1,
      'a run that saved nothing still points at the bell instead of promising a library');
    ok(pillDone.indexOf('nothing was added') !== -1 && pillDone.indexOf('0 songs/i.test(_dtxt)') !== -1,
      'and the flag refuses an empty run by name AND by count, not only a failed one');
    // DRIVEN, because a label is a behavior. The real function is taken out of the
    // shipped bytes and run over a synthetic pill for the three shapes a run ends on;
    // the second of them is the one the string test read as a success.
    const drivePill = (text) => {
      const el = () => ({ textContent: '', style: {}, set outerHTML(v) { this.replaced = v; } });
      const title = el(), sub = el(), bar = el(), spin = el(), cancel = el();
      const pill = { style: {}, onclick: null,
        querySelector: (s) => ({ '.sc-pill-title': title, '.sc-pill-sub': sub, '.sc-pill-bar': bar,
          '.sc-pill-cancel': cancel, 'div': spin }[s] || null) };
      const state = { el: pill, timer: null, pct: 55, cancelRequested: false };
      const log = [];
      const fn = new Function('scConvertPillState', 'scConvertPill', 'window', 'setTimeout', 'clearTimeout',
        'scNotifyProgress', 'updateNotifBadge', '$', 'renderNotifPanel', 'toast', 'scOpenLibraryAfterDownload',
        pillDone + '\n return scConvertPillDone;')(
        state, (show) => log.push('pill:' + show), {}, () => 1, () => {},
        () => {}, () => {}, () => null, () => {}, () => {},
        () => log.push('open-library'));
      fn(text);
      return { title: title.textContent, sub: sub.textContent, taps: typeof pill.onclick === 'function',
        tap: () => { if (typeof pill.onclick === 'function') pill.onclick(); }, log };
    };
    const saved = drivePill('3 songs added to your library · files saved');
    ok(saved.title === 'Open library', "a run that saved songs leads with it: '" + saved.title + "'");
    ok(/added to your library/.test(saved.sub) && /tap to open/.test(saved.sub),
      'with what happened kept underneath: "' + saved.sub + '"');
    saved.tap();
    ok(saved.log.join(',') === 'pill:false,open-library',
      'and tapping the card dismisses it and opens All Songs (' + saved.log.join(',') + ')');
    const empty = drivePill('0 songs added to your library · 3 failed');
    ok(empty.title === '0 songs added to your library · 3 failed' && !empty.taps,
      'a batch where nothing was added is not dressed as a way in: "' + empty.title + '"');
    const stopped = drivePill('Cancelled — nothing was added');
    ok(stopped.title === 'Cancelled — nothing was added' && !stopped.taps,
      'and neither is a cancelled save: "' + stopped.title + '"');
    const partway = drivePill('Cancelled — 2 songs added to your library');
    ok(partway.title === 'Open library' && partway.taps,
      'while a run stopped part-way, with songs saved, still offers them: "' + partway.title + '"');

    win.navigate('home');
    await wait(150);
  }
