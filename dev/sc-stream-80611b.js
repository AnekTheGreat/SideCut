  // ─── 80.6.11 - THE SHELF: Library opens a rail, the rail opens a sheet ──────
  // What was wrong with 80.6.9's shape: streaming was painted INTO the library
  // list, above the downloaded songs, so two different things shared one scroll
  // and one heading. The owner asked for the opposite: the Library keeps its own
  // list, and streaming gets its own place - a rail of three tabs where it is,
  // with the streaming sheet sliding in from the right over the list.
  //
  // THREE TABS, AND TWO OF THEM ARE THE APP'S OWN. "Library" and "Albums" are not
  // reimplementations: they close the sheet and drive the page's existing library
  // (libraryMode + navigate), so sorting, search, selection and the album
  // expansion all keep behaving exactly as they already do.
  var scShelf = { tab: 'library', open: false, built: false };

  function scShelfSheet(){
    return document.getElementById('scStreamBlock');
  }
  function scShelfCss(){
    if(document.getElementById('scShelfCss')) return;
    var st = document.createElement('style');
    st.id = 'scShelfCss';
    // The sheet is fixed to the right edge on every size, so the list underneath
    // is never re-laid-out and never re-rendered by opening it.
    st.textContent = [
      '#scStreamBlock{position:fixed;top:0;right:0;bottom:0;left:auto;width:min(88%,430px);',
      'z-index:60;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg);',
      'border-left:1px solid var(--line);box-shadow:-18px 0 40px rgba(0,0,0,.35);',
      'transform:translateX(102%);transition:transform .28s cubic-bezier(.22,.61,.36,1);',
      'padding:14px 0 28px;visibility:hidden;margin:0}',
      '#scStreamBlock.scShelfOpen{transform:translateX(0);visibility:visible}',
      '#scShelfScrim{position:fixed;inset:0;z-index:55;background:rgba(4,8,10,.42);',
      'opacity:0;pointer-events:none;transition:opacity .22s ease}',
      '#scShelfScrim.scShelfOpen{opacity:1;pointer-events:auto}',
      '#scShelfRail{display:flex;gap:8px;margin:0 20px 10px;overflow-x:auto;',
      'scrollbar-width:none;-webkit-overflow-scrolling:touch}',
      '#scShelfRail::-webkit-scrollbar{display:none}',
      '#scShelfRail .scshelf-tab{flex:0 0 auto;border:1px solid var(--line);background:none;',
      'color:var(--ink-dim);border-radius:999px;padding:7px 14px;font-size:12px;',
      'font-family:var(--font-ui);transition:background .18s ease,color .18s ease}',
      '#scShelfRail .scshelf-tab.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}',
      '#scShelfHead{display:flex;align-items:center;gap:8px;padding:0 16px 6px}',
      '#scShelfHead .scshelf-title{font-size:13.5px;font-weight:700;flex:1}'
    ].join('');
    document.head.appendChild(st);
  }
  function scShelfRender(){
    if(!SC_STREAM_OK) return;                 // no rail, no sheet, outside the full builds
    var rail = document.getElementById('scShelfRail');
    if(!rail) return;
    var tabs = [['streaming', 'Streaming'], ['library', 'Library'], ['albums', 'Albums']];
    rail.innerHTML = tabs.map(function(t){
      var on = (t[0] === 'streaming') ? scShelf.open : (!scShelf.open && scShelf.tab === t[0]);
      return '<button type="button" class="scshelf-tab' + (on ? ' on' : '') + '" data-shelf="' + t[0] + '">' +
        escapeHtml(t[1]) + '</button>';
    }).join('');
    Array.prototype.forEach.call(rail.querySelectorAll('.scshelf-tab'), function(b){
      b.addEventListener('click', function(){ scShelfOpenTab(this.getAttribute('data-shelf')); });
    });
  }
  function scShelfClose(){
    scShelf.open = false;
    var sheet = scShelfSheet(), scrim = document.getElementById('scShelfScrim');
    if(sheet) sheet.classList.remove('scShelfOpen');
    if(scrim) scrim.classList.remove('scShelfOpen');
    scShelfRender();
  }
  function scShelfOpenTab(tab){
    if(!SC_STREAM_OK) return;
    if(tab === 'library' || tab === 'albums'){
      // The app's own halves: close the sheet, switch the half, let it re-render.
      scShelf.tab = tab;
      scShelfClose();
      try{
        if(tab === 'albums'){ if(typeof libraryMode !== 'undefined'){ libraryMode = 'albums'; } }
        else { if(typeof libraryMode !== 'undefined'){ libraryMode = 'playlists'; } }
        if(typeof navigate === 'function') navigate('library');
        if(typeof renderTabs === 'function') renderTabs();
        if(typeof renderList === 'function') renderList();
      }catch(_eShelf){}
      return;
    }
    scShelf.tab = 'streaming';
    scShelf.open = true;
    scShelfCss();
    var sheet = scShelfSheet(), scrim = document.getElementById('scShelfScrim');
    if(scrim){ scrim.classList.add('scShelfOpen'); }
    if(sheet){ sheet.classList.add('scShelfOpen'); }
    scStreamRender();
    scShelfRender();
  }
  function scShelfBoot(){
    if(!SC_STREAM_OK) return;
    if(scShelf.built) return;
    var rail = document.getElementById('scShelfRail');
    if(!rail) return;
    scShelf.built = true;
    scShelfCss();
    var scrim = document.getElementById('scShelfScrim');
    if(!scrim){
      scrim = document.createElement('div');
      scrim.id = 'scShelfScrim';
      scrim.addEventListener('click', scShelfClose);
      document.body.appendChild(scrim);
    }
    var sheet = scShelfSheet();
    if(sheet){ sheet.setAttribute('aria-hidden', 'true'); sheet.setAttribute('role', 'dialog'); }
    scShelfRender();
  }
