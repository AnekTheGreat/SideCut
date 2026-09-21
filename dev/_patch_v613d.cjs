#!/usr/bin/env node
// v60.1.3, part D — the record player in Albums opens the album and goes to the
// playing row, with nothing else on screen.
//
// The jump found the album card and then looked for the song row inside it — but
// album card rows are built the first time a card is expanded, and a re-render
// rebuilds the cards collapsed. So on a fresh render the row did not exist yet,
// and the tap ended in a toast ("Opened …") with no scroll. It now expands the
// card itself, then scrolls to the row and highlights it — and every failure path
// falls through to the list jump silently instead of a toast.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

let html = fs.readFileSync(HTML, 'utf8');

const START = `    if(!albumName){ toast('"` + `' + t.name + '` + `" isn\\'t in one of your albums yet.'); return; }`;
const i = html.indexOf(START);
if (i === -1) throw new Error('the album-name guard was not found');
const OLD_TAIL = `    }, 140);
`;
const j = html.indexOf(OLD_TAIL, i);
if (j === -1) throw new Error('the end of openAlbumForCurrentSong was not found');
const body = html.slice(i, j);
if (body.indexOf(`toast('Opened "'`) === -1) throw new Error('unexpected body');

const NEW = `    if(!albumName){
      // No album for this song anywhere: the tap means "take me to the song", so
      // fall through to the list jump instead of announcing the problem.
      jumpToPlayingSong(t);
      return;
    }
    // Which half of the library the tap belongs in follows the tab you are in:
    // in Playlists it takes you to the song in the list you are looking at, in
    // Albums it opens the album that song is in.
    const _inAlbums = (typeof libraryMode !== 'undefined' && libraryMode === 'albums');
    if(!_inAlbums){ jumpToPlayingSong(t); return; }
    const wanted = t.id;
    navigate('albums');
    // An album card's rows are built the first time the card is expanded, and a
    // re-render rebuilds the cards collapsed — so the row is usually not in the
    // DOM yet when the tap arrives. Expand the card first (its own header click
    // builds the rows, eases the card open and remembers it as expanded), then
    // scroll to the row and highlight it. Nothing else: no toast, in any state.
    let attempts = 0;
    function seekPlayingRow(){
      attempts++;
      let pane = null;
      try{ pane = $('listPane'); }catch(_e){}
      if(!pane) return;
      let card = null;
      try{
        card = Array.prototype.slice.call(pane.querySelectorAll('[data-album-name]'))
          .filter(function(c){ return c.dataset.albumName === albumName; })[0] || null;
      }catch(_e){}
      if(!card && attempts === 1){
        // A search (or the album picker) can filter the cards away. Clear it once
        // and let the list redraw before looking again.
        let hadQuery = false;
        try{
          hadQuery = !!searchQuery;
          if(hadQuery){ searchQuery = ''; $('searchInput').value = ''; renderList(); }
        }catch(_e){}
        if(hadQuery){ setTimeout(seekPlayingRow, 180); return; }
      }
      if(!card){ jumpToPlayingSong(t); return; }
      let row = null;
      try{ row = card.querySelector('.track[data-id="' + wanted + '"]'); }catch(_e){}
      if(!row){
        try{
          const body = card.querySelector('[id^="alb_card_"]');
          const hdr = card.firstElementChild;
          if(hdr && (!body || body.style.display === 'none' || !body.children.length)) hdr.click();
        }catch(_e){}
        try{ row = card.querySelector('.track[data-id="' + wanted + '"]'); }catch(_e){}
      }
      if(!row && attempts < 3){ setTimeout(seekPlayingRow, 130); return; }
      if(!row){ jumpToPlayingSong(t); return; }
      // Scroll inside the list, never with scrollIntoView: on Android that
      // bubbles straight out of #listPane and shifts the WHOLE app (header and
      // nav pills ride up with it — the "app lifting" glitch). The app's own
      // engine only ever writes scrollTop on the pane it was handed.
      try{
        cancelScrollAnim(pane);
        smoothScrollIn(pane, row, 220);
      }catch(_eScroll){
        // Last resort, still only inside the pane: centre the row's own rect.
        try{
          const paneRect = pane.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          const to = pane.scrollTop + (rowRect.top - paneRect.top) - (paneRect.height / 2) + (rowRect.height / 2);
          pane.scrollTop = Math.max(0, Math.min(to, Math.max(0, pane.scrollHeight - pane.clientHeight)));
        }catch(_eScroll2){}
      }
      scFocusRow(t.id);
    }
    setTimeout(seekPlayingRow, 140);
`;

html = html.slice(0, i) + NEW + html.slice(j + OLD_TAIL.length);

fs.writeFileSync(HTML, html);
console.log('  ✓ openAlbumForCurrentSong: expands the album card, no toast');
console.log('\nrecord-player jump: done\n');
