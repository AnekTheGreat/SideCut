"""80.3.5, sections 3 and 5 - one opener, one slide, and every row that needs one.

The owner's ask, verbatim: *"a smooth drop-down that shows when you click on it to
clean up clutter"*.

WHAT THE OPENER IS NOW. 80.3.2 wrote a four-line `setupCollapsible` that flipped
`display` and swapped the header's marker between a down and an up arrow, and every
card in the pane reused it. That is still the truth of it - `style.display` remains
what the rest of the app reads, and what the closed state IS - but three things
change:

  * IT SLIDES. The body's own height is what opens: the clip goes from nothing to
    the measured height (padding included), then the inline height is dropped so
    the content can still grow while it is open - the storage panel and the DJ list
    both do. The row carries `sc-open` from the first frame, so the marker turns
    with the tap rather than when the slide lands.
  * A CONTROL ON THE ROW IS ITS OWN TAP. Four of the rows this release adds carry
    the setting itself on the right (the layout switches, the artist prompt, the
    version). Their head is a div rather than a button, which is what makes a
    switch inside it legal HTML, and the opener ignores a click that landed on a
    control that is not the row.
  * ONE ANIMATION, MEASURED ONCE. If the platform will not report a height (or
    motion is reduced) it flips exactly as it did before this release, which is
    also what keeps the pane usable on a WebView that refuses the transition.

THE TWO HANDLERS THAT USED TO BE THEIR OWN - storage and Check for updates - are
calls to this one now, with what they do on opening passed in (the storage panel
re-reads itself; the refresh-rate row re-renders its options), so every row in the
pane opens the same way.

THE CHIP. A row can carry its state on the right, and for a switch that IS the
control, sitting on the row. The one thing that cannot be on the row is a slider's
number, so the volume-boost readout is mirrored onto the Playback & sound row by a
small sync that runs on a mutation of the pane (debounced) - the merged row then
reads "Playback & sound    Boost +6 dB" the way a settings list should.

Imported by dev/patch-8035.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 3a. The opener.
# ---------------------------------------------------------------------------
OPENER_OLD = """  // Collapsible sections
  function setupCollapsible(id, contentId, iconId) {
    const btn = $(id);
    const content = $(contentId);
    const icon = $(iconId);
    if(btn && content && icon) {
      btn.addEventListener('click', () => {
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        icon.textContent = isOpen ? '\u25be' : '\u25b4';
      });
    }
  }
  setupCollapsible('collapsiblePlayback', 'collapsiblePlaybackContent', 'collapsePlaybackIcon');
  setupCollapsible('collapsibleLibrary', 'collapsibleLibraryContent', 'collapseLibraryIcon');
  setupCollapsible('collapsibleWatermark', 'collapsibleWatermarkContent', 'collapseWatermarkIcon');
  setupCollapsible('collapsibleVersions', 'collapsibleVersionsContent', 'collapseVersionsIcon');
  setupCollapsible('collapsibleThingsToKnow', 'collapsibleThingsToKnowContent', 'collapseThingsToKnowIcon');
  setupCollapsible('collapsibleTutorialSummary', 'collapsibleTutorialSummaryContent', 'collapseTutorialSummaryIcon');
  // 72.9 - the feature map opens and closes like the tutorial summary does.
  try{ setupCollapsible('collapsibleFeatureMap', 'collapsibleFeatureMapContent', 'collapseFeatureMapIcon'); }catch(_eFeatMap){}
  setupCollapsible('collapsibleSeizureWarn', 'collapsibleSeizureWarnContent', 'collapseSeizureWarnIcon');
  setupCollapsible('collapsibleDjPerPlaylist', 'collapsibleDjPerPlaylistContent', 'collapseDjPerPlaylistIcon');
  // 73.4.8 - the More pane's own entries open and close the same way: the
  // notification player (which carries its state in the header row), and the two
  // descriptive cards that follow the tutorial summary.
  setupCollapsible('collapsibleMediaNotif', 'collapsibleMediaNotifContent', 'collapseMediaNotifIcon');
  setupCollapsible('collapsibleWorksOffline', 'collapsibleWorksOfflineContent', 'collapseWorksOfflineIcon');
  setupCollapsible('collapsibleAcceptedTypes', 'collapsibleAcceptedTypesContent', 'collapseAcceptedTypesIcon');"""

OPENER_NEW = """  // Collapsible sections
  // 80.3.5 - ONE OPENER FOR EVERY ROW, AND IT SLIDES.
  //
  // `display` is still the closed state and still what the rest of the app reads;
  // the slide is drawn ON TOP of it by the body's own height, and a platform that
  // will not measure (or a reader who reduced motion) just flips as it always did.
  function scRowCard(el){
    try{ return (el && el.closest) ? el.closest('.sc-set-card') : null; }catch(_eCard){ return null; }
  }
  function scRowClose(id, contentId){
    var btn = $(id), content = $(contentId);
    if(!content) return;
    var card = scRowCard(btn);
    if(card) card.classList.remove('sc-open');
    try{ if(btn && btn.setAttribute) btn.setAttribute('aria-expanded', 'false'); }catch(_eRowA){}
    content._scGen = (content._scGen || 0) + 1;   // a settle in flight is dropped
    content.style.display = 'none';
    content.style.maxHeight = '';
  }
  function scRowSettle(content, gen, done){
    var finished = false;
    function end(){
      if(finished || content._scGen !== gen) return;
      finished = true;
      try{ content.removeEventListener('transitionend', onEnd); }catch(_eRowR){}
      try{ done(); }catch(_eRowD){}
    }
    function onEnd(ev){
      if(ev && ev.target === content && (!ev.propertyName || ev.propertyName === 'max-height')) end();
    }
    try{ content.addEventListener('transitionend', onEnd); }catch(_eRowL){}
    setTimeout(end, 430);
  }
  function scRowSet(btn, content, open, slide){
    var card = scRowCard(btn);
    if(card) card.classList.toggle('sc-open', !!open);
    try{ if(btn && btn.setAttribute) btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }catch(_eRowA2){}
    var gen = (content._scGen || 0) + 1;
    content._scGen = gen;
    var h = 0;
    if(slide) { try{ h = content.scrollHeight || 0; }catch(_eRowH){ h = 0; } }
    if(!h){
      content.style.maxHeight = '';
      content.style.display = open ? 'block' : 'none';
      return;
    }
    content.style.display = 'block';
    if(open){
      content.style.maxHeight = '0px';
      void content.offsetHeight;                  // one reflow: the 0 above is the start
      content.style.maxHeight = h + 'px';
      scRowSettle(content, gen, function(){ content.style.maxHeight = ''; });
    }else{
      content.style.maxHeight = h + 'px';
      void content.offsetHeight;
      content.style.maxHeight = '0px';
      scRowSettle(content, gen, function(){
        if(content.style.display !== 'none'){ content.style.display = 'none'; content.style.maxHeight = ''; }
      });
    }
  }
  function setupCollapsible(id, contentId, iconId, onOpen) {
    const btn = $(id);
    const content = $(contentId);
    if(!btn || !content) return;
    // The slide happens inside Settings -> More only: the CSS that clips a body
    // lives in that pane's rules, and the one collapsible outside it (the Support
    // pane's feature map) keeps the instant flip it has always had.
    var slide = false;
    try{ slide = !!(content.closest && content.closest('#settingsPaneMore')); }catch(_eSlide){ slide = false; }
    btn.addEventListener('click', function(ev){
      // A CONTROL ON THE ROW IS ITS OWN TAP: a switch sitting on the row must not
      // open the row as well.
      var hit = null;
      try{ hit = (ev.target && ev.target.closest) ? ev.target.closest('button, input, select, textarea, a') : null; }catch(_eHit){ hit = null; }
      if(hit && hit !== btn) return;
      var open = content.style.display === 'none';
      scRowSet(btn, content, open, slide);
      if(open && typeof onOpen === 'function'){ try{ onOpen(); }catch(_eOnOpen){} }
    });
  }
  window.__scRowSet = scRowSet;
  window.__scRowClose = scRowClose;
  setupCollapsible('collapsibleLibrary', 'collapsibleLibraryContent', 'collapseLibraryIcon');
  setupCollapsible('collapsibleWatermark', 'collapsibleWatermarkContent', 'collapseWatermarkIcon');
  setupCollapsible('collapsibleVersions', 'collapsibleVersionsContent', 'collapseVersionsIcon');
  setupCollapsible('collapsibleThingsToKnow', 'collapsibleThingsToKnowContent', 'collapseThingsToKnowIcon');
  setupCollapsible('collapsibleTutorialSummary', 'collapsibleTutorialSummaryContent', 'collapseTutorialSummaryIcon');
  // 72.9 - the feature map opens and closes like the tutorial summary does.
  try{ setupCollapsible('collapsibleFeatureMap', 'collapsibleFeatureMapContent', 'collapseFeatureMapIcon'); }catch(_eFeatMap){}
  setupCollapsible('collapsibleSeizureWarn', 'collapsibleSeizureWarnContent', 'collapseSeizureWarnIcon');
  setupCollapsible('collapsibleDjPerPlaylist', 'collapsibleDjPerPlaylistContent', 'collapseDjPerPlaylistIcon');
  // 73.4.8 - the More pane's own entries open and close the same way: the
  // notification player (which carries its state in the header row), and the two
  // descriptive cards that follow the tutorial summary.
  setupCollapsible('collapsibleMediaNotif', 'collapsibleMediaNotifContent', 'collapseMediaNotifIcon');
  setupCollapsible('collapsibleWorksOffline', 'collapsibleWorksOfflineContent', 'collapseWorksOfflineIcon');
  setupCollapsible('collapsibleAcceptedTypes', 'collapsibleAcceptedTypesContent', 'collapseAcceptedTypesIcon');
  // 80.3.5 - the merged Playback & sound row, and the two that used to carry a
  // handler of their own. The work they do when they open is passed in, so the row
  // itself stays the one place that knows how a row opens.
  setupCollapsible('collapsiblePlaybackSound', 'collapsiblePlaybackSoundContent', 'collapsePlaybackSoundIcon', function(){
    if(typeof renderRefreshRateOptions === 'function') renderRefreshRateOptions();
  });
  setupCollapsible('collapsibleStorage', 'collapsibleStorageContent', 'collapseStorageIcon', function(){
    if(typeof renderStoragePanel === 'function') renderStoragePanel();
  });
  setupCollapsible('collapsibleOta', 'collapsibleOtaContent', 'collapseOtaIcon');
  // 80.3.5 - the rows this release adds: the tutorial, the three layout switches,
  // the artist prompt and About.
  setupCollapsible('collapsibleTutorial', 'collapsibleTutorialContent', 'collapseTutorialIcon');
  setupCollapsible('collapsibleSplit', 'collapsibleSplitContent', 'collapseSplitIcon');
  setupCollapsible('collapsibleAutoScroll', 'collapsibleAutoScrollContent', 'collapseAutoScrollIcon');
  setupCollapsible('collapsibleAlbumFocus', 'collapsibleAlbumFocusContent', 'collapseAlbumFocusIcon');
  setupCollapsible('collapsibleArtistAsk', 'collapsibleArtistAskContent', 'collapseArtistAskIcon');
  setupCollapsible('collapsibleAbout', 'collapsibleAboutContent', 'collapseAboutIcon');
  // 80.3.5 - THE ROW'S OWN SUMMARY. A row shows its state; a switch can just sit on
  // the row, but a slider's number has to be mirrored, so the volume-boost readout
  // is copied onto the Playback & sound row whenever the pane changes. One writer,
  // no loop: it only writes when the text actually differs.
  (function(){
    var pane = $('settingsPaneMore');
    if(!pane) return;
    function sync(){
      var chips = pane.querySelectorAll('[data-sc-val]');
      for(var i = 0; i < chips.length; i++){
        var src = $(chips[i].getAttribute('data-sc-val'));
        var pre = chips[i].getAttribute('data-sc-prefix') || '';
        var txt = src ? (pre + (src.textContent || '').trim()) : '';
        if(chips[i].textContent !== txt) chips[i].textContent = txt;
      }
    }
    window.__scRowChips = sync;
    sync();
    if(window.MutationObserver){
      var pending = 0;
      try{
        new MutationObserver(function(){
          if(pending) return;
          pending = setTimeout(function(){ pending = 0; sync(); }, 80);
        }).observe(pane, { subtree:true, childList:true, characterData:true });
      }catch(_eChipObs){}
    }
    setTimeout(sync, 900);
  })();"""

# ---------------------------------------------------------------------------
# 5. The three handlers that were their own, and the tab's own reset.
# ---------------------------------------------------------------------------
PB_OLD = """  // Playback & sound collapsible (Refresh rate / Playback / EQ now live here).
try{
  const _pbBtn = $('collapsiblePlaybackSound');
  if(_pbBtn && !_pbBtn._wired){
    _pbBtn._wired = true;
    _pbBtn.addEventListener('click', () => {
      const c = $('collapsiblePlaybackSoundContent');
      if(!c) return;
      const open = c._open === false;
      c._open = open;
      c.style.display = open ? '' : 'none';
      const ic = $('collapsePlaybackSoundIcon');
      if(ic) ic.textContent = open ? '\u25be' : '\u25b8';
      if(open && typeof renderRefreshRateOptions === 'function') renderRefreshRateOptions();
    });
  }
}catch(_e){}"""

PB_NEW = """  // 80.3.5 - the Playback & sound row's own handler is gone: it is one of the rows
  // `setupCollapsible` opens now, and what it does when it opens (re-render the
  // refresh-rate options) is passed in there beside every other row. The row opens
  // with a slide and carries its state on itself, which is why there is nothing
  // left to wire here."""

STORAGE_OLD = """(function(){
  var head = $('collapsibleStorage'), pane = $('collapsibleStorageContent'), icon = $('collapseStorageIcon');
  if(head && pane){
    head.addEventListener('click', function(){
      var open = pane.style.display === 'none';
      pane.style.display = open ? 'block' : 'none';
      if(icon) icon.style.transform = open ? 'rotate(180deg)' : 'none';
      if(open) renderStoragePanel();
    });
  }
  var refresh = $('storageRefreshBtn');"""

STORAGE_NEW = """(function(){
  // 80.3.5 - the Storage row opens through `setupCollapsible` like every other row
  // (the re-read it used to do here is passed in there as its on-open step), so this
  // block is only the three buttons that live inside it now.
  var refresh = $('storageRefreshBtn');"""

OTA_OLD = """  $('collapsibleOta').addEventListener('click', () => {
    const c = $('collapsibleOtaContent'), ic = $('collapseOtaIcon');
    const open = c.style.display === 'none';
    c.style.display = open ? 'block' : 'none';
    if(ic) ic.style.transform = open ? 'rotate(180deg)' : '';
  });"""

OTA_NEW = """  // 80.3.5 - Check for updates opens through `setupCollapsible` too, so the marker
  // and the slide are the same as every other row's."""

RESET_OLD = """      // Playback & sound always starts collapsed when the More tab opens \u2014
      // tap the header to expand it for this visit only.
      if($('collapsiblePlaybackSoundContent')){
        $('collapsiblePlaybackSoundContent')._open = false;
        $('collapsiblePlaybackSoundContent').style.display = 'none';
        if($('collapsePlaybackSoundIcon')) $('collapsePlaybackSoundIcon').textContent = '\u25b8';
      }"""

RESET_NEW = """      // 80.3.5 - the one Playback & sound row starts collapsed when the More tab
      // opens - tap it to expand it for this visit only. Every other row keeps
      // whatever the reader left it at, which is how a settings list is expected to
      // behave now that the rows are rows.
      try{ scRowClose('collapsiblePlaybackSound', 'collapsiblePlaybackSoundContent'); }catch(_eRow){}
      try{ if(typeof scRowClose !== 'function' && window.__scRowClose) window.__scRowClose('collapsiblePlaybackSound', 'collapsiblePlaybackSoundContent'); }catch(_eRow2){}"""
