#!/usr/bin/env node
// v60.1.3, part A — commas between artists.
//
// Root cause: scSafeName() stripped every character outside [\w\s-], and a comma
// is not in that set. So a converted "Diljit Dosanjh, Sia" became the file name
// "Diljit Dosanjh Sia", and the library importer — which parses the artist back
// out of the file name — filed it as ONE artist with the names glued together.
// Commas survive now, and every credit the services hand over is normalized to
// the comma-separated form the rest of SideCut uses ("A & B" / "A x B" /
// "A feat. B" all become "A, B"), including every credited artist instead of only
// the first one.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

let html = fs.readFileSync(HTML, 'utf8');

function sub(name, from, to) {
  const found = html.split(from).length - 1;
  if (found !== 1) throw new Error(`${name}: expected 1, found ${found}`);
  console.log('  ✓ ' + name);
  html = html.split(from).join(to);
}

/* ── 1. the file-name sanitiser keeps commas, + the credit normaliser ─────── */
sub('scSafeName keeps commas + scArtistCredits',
`  function scSafeName(s){
    return String(s || '').replace(/[^\\w\\s-]/g, '').replace(/\\s+/g, ' ').trim().slice(0, 80) || 'audio';
  }`,
`  // File-name sanitiser. Commas are KEPT: a multi-artist credit is
  // "Diljit Dosanjh, Sia" everywhere in SideCut, and this name is what the saved
  // file and the library importer both read the artist back out of. Commas used
  // to fall outside [\\w\\s-], so the credit came back as "Diljit Dosanjh Sia" —
  // one artist as far as the importer, the library and every export were
  // concerned.
  function scSafeName(s){
    return String(s || '')
      .replace(/[^\\w\\s,-]/g, '')
      .replace(/\\s*,\\s*/g, ', ')
      .replace(/\\s+/g, ' ')
      .replace(/^[\\s,]+|[\\s,]+$/g, '')
      .replace(/[\\s,]+$/, '')
      .slice(0, 80) || 'audio';
  }
  // One artist credit, however the service spelled it. "A, B", "A & B", "A x B",
  // "A feat. B" and "A; B" all come out as "A, B" — the comma-separated form
  // every list, file name, tag and library row in SideCut uses. Order is kept,
  // duplicates are dropped, and a single name is returned as it was.
  function scArtistCredits(s){
    var t = String(s == null ? '' : s).replace(/\\s+/g, ' ').trim();
    if(!t) return '';
    var parts = t.split(/\\s*[,;]\\s*|\\s+(?:&|x|\\u00d7|feat\\.?|ft\\.?|featuring)\\s+/i)
      .map(function(p){ return p.replace(/^[\\s\\-,]+|[\\s\\-,]+$/g, '').trim(); })
      .filter(Boolean);
    var out = [];
    for(var i = 0; i < parts.length; i++){
      var key = parts[i].toLowerCase(), dup = false;
      for(var j = 0; j < out.length; j++){ if(out[j].toLowerCase() === key){ dup = true; break; } }
      if(!dup) out.push(parts[i]);
    }
    return out.length ? out.join(', ') : t;
  }
  try{ window.scArtistCredits = scArtistCredits; }catch(_e){}
  // Read a Spotify/SideCut artists array ([{name}, ...]) as one credit.
  function scArtistsArrayCredits(arr){
    try{
      if(!Array.isArray(arr) || !arr.length) return '';
      return scArtistCredits(arr.map(function(a){ return (a && a.name) || ''; }).filter(Boolean).join(', '));
    }catch(_e){ return ''; }
  }`);

/* ── 2. the single-track Spotify read: every credited artist ─────────────── */
sub('single track: all credited artists',
`          if(!csMeta.artist && Array.isArray(ent.artists) && ent.artists.length && ent.artists[0].name) csMeta.artist = String(ent.artists[0].name);`,
`          // EVERY credited artist, comma-separated — not just artists[0]. Spotify
          // is the authority on this credit, so it also wins over oEmbed's single
          // author_name.
          var _entCredits = scArtistsArrayCredits(ent.artists);
          if(_entCredits) csMeta.artist = _entCredits;`);

/* ── 3. the plan resolver: the same for tracks, albums and playlists ─────── */
sub('plan: the track fallback credit',
`            if(!author && Array.isArray(tEnt.artists) && tEnt.artists.length && tEnt.artists[0].name) author = String(tEnt.artists[0].name);`,
`            var _tCred = scArtistsArrayCredits(tEnt.artists);
            if(_tCred) author = _tCred;
            else if(author) author = scArtistCredits(author);`);

sub('plan: the album/playlist artist',
`          var eArtist = String(embedEnt.subtitle || '').trim();`,
`          var eArtist = scArtistCredits(embedEnt.subtitle || '');`);

sub('plan: each album track credit',
`              artist: String(er.subtitle || eArtist || ''),`,
`              artist: scArtistCredits(er.subtitle || eArtist || ''),`);

sub('plan: Deezer fallback track credit',
`              var tArtist = (tr.artist && tr.artist.name) || alArtist;`,
`              var tArtist = scArtistCredits((tr.artist && tr.artist.name) || alArtist);`);

/* ── 4. a converted song's credit, and an imported one ──────────────────── */
sub('converted songs: the library entry',
`      var artist = String((meta && meta.artist) || o.artist || '').trim() || 'Unknown artist';`,
`      var artist = scArtistCredits(String((meta && meta.artist) || o.artist || '').trim()) || 'Unknown artist';`);

sub('imports: cleanOnImport normalizes the credit',
`    return { name: name || rawName || 'Untitled', artist: artist || 'Unknown artist', changed };
  }`,
`    // A credit that arrived as "A & B" or "A feat. B" is normalized to "A, B" on
    // the way in, so the library only ever holds the one form — and the converted
    // file names that carry several artists (their commas survive now) read back
    // as several artists.
    if(artist){
      const _credits = scArtistCredits(artist);
      if(_credits && _credits !== artist){ artist = _credits; changed = true; }
    }
    return { name: name || rawName || 'Untitled', artist: artist || 'Unknown artist', changed };
  }`);

fs.writeFileSync(HTML, html);
console.log('\ncommas between artists: done\n');
