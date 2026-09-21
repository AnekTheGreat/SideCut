#!/usr/bin/env node
// v60.0.10d — the last piece. With the artist check fixed, a live run of the
// co-credited album still came back empty: the three searches are merged by
// PREPENDING the quoted search's results, which buried the artist's own upload
// under re-uploads of the same title, and only the first six candidates are
// verified. Live, for "8 ASLE" by "Sukha, Chani", the artist's channel (SUKHA)
// matched but sat past position 6, behind re-uploads ("SYSTEM RECORDS",
// "48 RECORDS", a bass-boost channel). So:
//   • the union is ranked by the score every candidate already carries;
//   • a multi-artist credit scores per credited artist, or the artist's own
//     channel gets no credit at all while a re-upload keeps its title match;
//   • a few more candidates are verified before giving up.
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
const report = [];
function sub(label, needle, repl) {
  const n = src.split(needle).length - 1;
  if (n !== 1) { report.push({ label, ok: false, found: n }); throw new Error(label); }
  src = src.split(needle).join(repl);
  report.push({ label, ok: true });
}

sub('credit-names', `      var artistNorm = normArtist(artistHint);
      var artistWords = artistNorm.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and'; });
      var q = query.toLowerCase();`, `      var artistNorm = normArtist(artistHint);
      var artistWords = artistNorm.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and'; });
      // "Sukha, Chani" as one string never appears in a single channel name, so
      // each credited artist is scored on its own — the same rule the verifier
      // applies later. Without this the artist's OWN channel gets no credit
      // while a re-upload of the same title keeps its title points, and the
      // re-upload outranks the real thing.
      var creditNames = String(artistHint || '')
        .split(/\\s*(?:,|;|\\/|&|\\u00b7|\\bfeat\\.?\\b|\\bft\\.?\\b|\\bwith\\b|\\bx\\b)\\s*/i)
        .map(normArtist).filter(function(s){ return !!s; });
      var q = query.toLowerCase();`);

sub('credit-score', `        if(ownerHits >= Math.min(2, artistWords.length) || (ownerHits === 1 && artistWords.length === 1)) score += 12;
        if(artistWords.length && ownerHits === 0 && t.indexOf(artistNorm) === -1 && !/- topic$/.test(ownLow)) score -= 60;`, `        if(ownerHits >= Math.min(2, artistWords.length) || (ownerHits === 1 && artistWords.length === 1)) score += 12;
        for(var cn = 0; cn < creditNames.length; cn++){
          if(creditNames[cn] && ownLow.indexOf(creditNames[cn]) !== -1){ score += 16; break; }
        }
        if(artistWords.length && ownerHits === 0 && t.indexOf(artistNorm) === -1 && !/- topic$/.test(ownLow)) score -= 60;`);

sub('rank-union', `    for(var ci = 0; ci < cands.length && ci < 6; ci++){`, `    // The three searches are merged, but merging by prepending buried the
    // artist's own upload under re-uploads of the same title — which is how the
    // one correct source ended up outside the window that gets verified. Rank
    // the union by the score every candidate already carries.
    cands.sort(function(a, b){ return (b && b.score ? b.score : 0) - (a && a.score ? a.score : 0); });
    for(var ci = 0; ci < cands.length && ci < 10; ci++){`);

fs.writeFileSync(FILE, src);
for (const r of report) console.log((r.ok ? '✓' : '✗') + ' ' + r.label);
console.log('index.html now ' + src.length + ' bytes');
